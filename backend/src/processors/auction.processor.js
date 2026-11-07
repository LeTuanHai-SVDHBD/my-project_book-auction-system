/** Khóa/lease phối hợp worker; chỉ trả kết quả sau model COMMIT, SQL bảo vệ khi lease bị mất. */
import {AUCTION} from '../constants/auction.js';
import {validateBidRequest} from '../services/bidPolicy.js';
import {parseAuctionId} from '../services/auction.service.js';

export function validateAuctionEvent(event,settings=AUCTION) {
  if(!event||typeof event!=='object'||Array.isArray(event))throw new Error('INVALID_AUCTION_EVENT');
  if(typeof event.eventId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(event.eventId)||
    typeof event.createdAt!=='string'||!Number.isFinite(Date.parse(event.createdAt)))throw new Error('INVALID_AUCTION_EVENT');
  if(typeof event.auctionId!=='number'||parseAuctionId(event.auctionId)!==event.auctionId)throw new Error('INVALID_AUCTION_EVENT');
  let keys=['eventId','eventType','auctionId','createdAt'];
  if(event.eventType===settings.bidType) {
    const input=validateBidRequest({ma_yeu_cau:event.requestId,muc_gia:event.amount});
    if(event.requestId!==input.requestId||event.eventId!==event.requestId||!Number.isInteger(event.userId)||event.userId<1||event.userId>2147483647)throw new Error('INVALID_AUCTION_EVENT');
    keys.push('requestId','userId','amount');
  } else if(event.eventType!==settings.closeType)throw new Error('INVALID_AUCTION_EVENT');
  if(Object.keys(event).some(key=>!keys.includes(key)))throw new Error('INVALID_AUCTION_EVENT');
  return event;
}
export function createAuctionProcessor({model,locks,notify=async()=>{},leaseMs=AUCTION.leaseMs,settings=AUCTION,log=()=>{}}) {
  return async event=>{
    validateAuctionEvent(event,settings);
    const lease=await locks.acquire(event.auctionId);
    if(!lease)throw Object.assign(new Error('Phiên đang có worker xử lý.'),{code:'AUCTION_BUSY'});
    let renewal,renewing=false,lost=false;
    const renew=async()=>{if(!await lease.renew()){lost=true;throw new Error('AUCTION_LEASE_LOST');}};
    const timer=setInterval(()=>{
      if(renewing||lost)return;renewing=true;
      renewal=renew().catch(error=>{lost=true;log(error,{component:'auction-lease'});}).finally(()=>{renewing=false;});
    },Math.max(25,Math.floor(leaseMs/3)));timer.unref();
    try {
      const beforeCommit=async()=>{if(lost)throw new Error('AUCTION_LEASE_LOST');await renew();};
      const result=event.eventType===settings.bidType?await model.processBid(event,{beforeCommit}):await model.closeExpired(event.auctionId,{beforeCommit});
      // If publishing fails, the stream stays pending. Replay reads the committed SQL decision and notifies again.
      if(result)await notify(event.auctionId);
      return result;
    } finally {
      clearInterval(timer);await renewal;
      try{await lease.release();}catch(error){log(error,{component:'auction-unlock'});}
    }
  };
}
