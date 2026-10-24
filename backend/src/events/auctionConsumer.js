/** Consumer nghiệp vụ at-least-once: lỗi tạm giữ pending, XAUTOCLAIM phục hồi, ACK/xóa chỉ sau COMMIT. */
import {setTimeout as delay} from 'node:timers/promises';
import {AUCTION} from '../constants/auction.js';
import {validateAuctionEvent} from '../processors/auction.processor.js';

export async function ensureAuctionGroup(client,settings=AUCTION) {
  try{await client.xGroupCreate(settings.stream,settings.group,'0',{MKSTREAM:true});}
  catch(error){if(!String(error.message).includes('BUSYGROUP'))throw error;}
}
export async function processAuctionMessage({client,message,handle,settings=AUCTION,log=()=>{},beforeAck=async()=>{}}) {
  const quarantine=async(reason,event)=>{
    const batch=client.multi().xAdd(settings.deadLetter,'*',{streamId:message.id,reason,...(event?{event:JSON.stringify(event)}:{})})
      .xAck(settings.stream,settings.group,message.id).xDel(settings.stream,message.id);
    if(event?.eventType===settings.bidType&&reason!=='REQUEST_ID_CONFLICT') {
      const key=settings.admissionPrefix+event.requestId,raw=await client.get(key),pending=raw?JSON.parse(raw):null;
      if(pending?.userId===event.userId&&pending?.auctionId===event.auctionId&&pending?.amount===event.amount)
        batch.set(key,JSON.stringify({...pending,failure:reason}),{EX:86400});
    }
    await batch.exec();
  };
  let event;
  try{event=validateAuctionEvent(JSON.parse(message.message.event),settings);}
  catch{await quarantine('INVALID_AUCTION_EVENT');return;}
  try {
    await handle(event);await beforeAck(event);
    // The SQL receipt survives lost Redis responses; a reclaimed event reads that receipt again.
    const batch=client.multi().xAck(settings.stream,settings.group,message.id).xDel(settings.stream,message.id);
    if(event.eventType===settings.bidType)batch.expire(settings.admissionPrefix+event.requestId,86400);
    await batch.exec();
  } catch(error) {
    if(error.permanent===true){await quarantine(error.code||'OBSOLETE_AUCTION_EVENT',event);return;}
    log(error,{component:'auction-consumer',requestId:event.eventId});
  }
}
export async function consumeAuctions({client,reader,consumer,signal,handle,settings=AUCTION,log=()=>{}}) {
  let cursor='0-0',reclaimedAt=0;
  const process=message=>processAuctionMessage({client,message,handle,settings,log});
  while(!signal.aborted) {
    try {
      if(Date.now()-reclaimedAt>=settings.reclaimEveryMs) {
        const claim=await client.xAutoClaim(settings.stream,settings.group,consumer,settings.minIdleMs,cursor,{COUNT:10});
        cursor=claim.nextId;reclaimedAt=Date.now();
        for(const message of claim.messages)if(!signal.aborted)await process(message);
      }
      const streams=await reader.xReadGroup(settings.group,consumer,{key:settings.stream,id:'>'},{COUNT:10,BLOCK:1000});
      for(const stream of streams||[])for(const message of stream.messages)if(!signal.aborted)await process(message);
    } catch(error) {
      if(!signal.aborted){log(error,{component:'auction-reader'});await delay(500,undefined,{signal}).catch(()=>{});}
    }
  }
}
