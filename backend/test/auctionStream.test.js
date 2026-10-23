/** Redis thật: admission trùng, ACK sau xử lý, giữ pending khi lỗi, reclaim và dead-letter. SQL ở bài này là giả. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from 'redis';
import {AUCTION} from '../src/constants/auction.js';
import {createAuctionPublisher} from '../src/events/auctionPublisher.js';
import {ensureAuctionGroup,processAuctionMessage} from '../src/events/auctionConsumer.js';
import {validateAuctionEvent,createAuctionProcessor} from '../src/processors/auction.processor.js';

const bid=()=>({requestId:randomUUID(),auctionId:7,userId:2,amount:'100000'});
test('sự kiện nghiệp vụ không nhận probe, người giả, giá kiểu number hoặc trường client tự chèn',()=>{
  const input=bid(),event={...input,eventId:input.requestId,eventType:AUCTION.bidType,createdAt:new Date().toISOString()};
  assert.deepEqual(validateAuctionEvent(event),event);
  for(const patch of [{eventType:'system.probe'},{eventId:'z'.repeat(8)+'-0000-4000-8000-000000000000'},{userId:0},{amount:100000},{row_version:'0000000000000001'},{auctionId:'7'}])assert.throws(()=>validateAuctionEvent({...event,...patch}));
});
test('tranh khóa không gọi SQL; lease mất trước COMMIT không cho model hoàn tất',async()=>{
  const input=bid(),event={...input,eventId:input.requestId,eventType:AUCTION.bidType,createdAt:new Date().toISOString()};
  const busy=createAuctionProcessor({model:{processBid:()=>assert.fail('Không được vào SQL')},locks:{acquire:async()=>null}});
  await assert.rejects(busy(event),{code:'AUCTION_BUSY'});
  let released=0,committed=0;
  const lost=createAuctionProcessor({model:{processBid:async(_,{beforeCommit})=>{await beforeCommit();committed++;}},locks:{acquire:async()=>({renew:async()=>false,release:async()=>{released++;}})}});
  await assert.rejects(lost(event),/LEASE_LOST/);assert.equal(committed,0);assert.equal(released,1);
});
test('Redis Stream thật: admission, lỗi pending, ACK/reclaim và sự kiện độc lập probe',
  {skip:!process.env.AUTH_TEST_REDIS_URL,timeout:15000},async t=>{
    const redis=createClient({url:process.env.AUTH_TEST_REDIS_URL,disableOfflineQueue:true,socket:{connectTimeout:3000,reconnectStrategy:false}});redis.on('error',()=>{});await redis.connect();
    const prefix=`bookauction:test:stream:${randomUUID()}:`,settings={...AUCTION,stream:prefix+'events',group:prefix+'group',deadLetter:prefix+'dead',admissionPrefix:prefix+'request:',closePrefix:prefix+'close:'};
    t.after(async()=>{if(redis.isReady){const keys=await redis.keys(prefix+'*');if(keys.length)await redis.del(keys);}if(redis.isOpen)redis.destroy();});
    const publisher=createAuctionPublisher({getRedis:()=>redis,settings});await ensureAuctionGroup(redis,settings);await ensureAuctionGroup(redis,settings);
    const input=bid();await Promise.all(Array.from({length:12},()=>publisher.bid(input)));assert.equal(await redis.xLen(settings.stream),1);
    await assert.rejects(publisher.bid({...input,amount:'101000'}),{status:409});await assert.rejects(publisher.bid({...input,userId:3}),{status:409});
    assert.equal((await publisher.pending(input.requestId)).amount,'100000');assert.equal(await redis.ttl(settings.admissionPrefix+input.requestId),-1);
    const first=(await redis.xReadGroup(settings.group,'first',{key:settings.stream,id:'>'},{COUNT:10}))[0].messages[0];
    let writes=0;const receipts=new Map(),logs=[];
    const handle=async event=>{if(!receipts.has(event.requestId)){writes++;receipts.set(event.requestId,'committed');}};
    await processAuctionMessage({client:redis,message:first,settings,handle,beforeAck:async()=>{assert.equal(writes,1);throw Error('crash after fake SQL commit');},log:error=>logs.push(error)});
    assert.equal(logs.length,1);assert.equal((await redis.xPending(settings.stream,settings.group)).pending,1);
    const reclaimed=await redis.xAutoClaim(settings.stream,settings.group,'replacement',0,'0-0',{COUNT:10});assert.equal(reclaimed.messages.length,1);
    await processAuctionMessage({client:redis,message:reclaimed.messages[0],settings,handle});
    assert.equal(writes,1);assert.equal((await redis.xPending(settings.stream,settings.group)).pending,0);assert.equal(await redis.xLen(settings.stream),0);assert((await redis.ttl(settings.admissionPrefix+input.requestId))>0);
    const next=bid();await publisher.bid(next);const second=(await redis.xReadGroup(settings.group,'first',{key:settings.stream,id:'>'},{COUNT:10}))[0].messages[0];
    await processAuctionMessage({client:redis,message:second,settings,handle:async()=>{throw Error('SQL unavailable');}});
    assert.equal((await redis.xPending(settings.stream,settings.group)).pending,1);assert.equal(await redis.xLen(settings.deadLetter),0);
    await processAuctionMessage({client:redis,message:second,settings,handle});assert.equal((await redis.xPending(settings.stream,settings.group)).pending,0);
    await redis.xAdd(settings.stream,'*',{event:JSON.stringify({eventType:'system.probe'})});
    const invalid=(await redis.xReadGroup(settings.group,'first',{key:settings.stream,id:'>'},{COUNT:10}))[0].messages[0];
    await processAuctionMessage({client:redis,message:invalid,settings,handle:()=>assert.fail('Không xử lý probe như đặt giá')});
    assert.equal(await redis.xLen(settings.deadLetter),1);assert.equal((await redis.xPending(settings.stream,settings.group)).pending,0);
    assert.equal(await publisher.expiry(7),true);assert.equal(await publisher.expiry(7),false);assert.equal(await publisher.expiry(8),true);
  });
