/** Socket/HTTP thật; model giả để kiểm tra COMMIT, room công khai, replay và không phát payload riêng tư. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {Server} from 'socket.io';
import {io as connect} from 'socket.io-client';
import {createClient} from 'redis';
import {attachAuctionSockets} from '../src/realtime/auctionSockets.js';
import {createAuctionProcessor} from '../src/processors/auction.processor.js';
import {createAuctionNotifier,subscribeAuctionUpdates} from '../src/events/auctionUpdates.js';
import {AUCTION} from '../src/constants/auction.js';
import {createPostService} from '../src/services/post.service.js';
import {createAuctionPublisher} from '../src/events/auctionPublisher.js';
import {ensureAuctionGroup,processAuctionMessage} from '../src/events/auctionConsumer.js';

async function fixture(t) {
  const server=createServer(),io=new Server(server),sockets=[];
  const updates=attachAuctionSockets({io,model:{publicAuction:async id=>[7,8].includes(id)?{gia_toi_thieu:'hidden-secret'}:null}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{sockets.forEach(socket=>socket.disconnect());await new Promise(resolve=>io.close(resolve));});
  async function client(){
    const socket=connect(`http://127.0.0.1:${server.address().port}/auctions`,{forceNew:true,reconnection:false});sockets.push(socket);
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
    const events=[];socket.on('auction:changed',value=>events.push(value));
    return {socket,events,watch:input=>socket.timeout(2000).emitWithAck('auction:watch',input)};
  }
  return {client,updates};
}
const event=()=>{const requestId=randomUUID();return {eventId:requestId,requestId,eventType:AUCTION.bidType,auctionId:7,userId:2,amount:'100000',createdAt:new Date().toISOString()};};
const locks={acquire:async()=>({renew:async()=>true,release:async()=>{}})};
test('hai client chỉ nhận tín hiệu sau model COMMIT; room công khai không chứa ngưỡng hoặc quyết định riêng',async t=>{
  const f=await fixture(t),a=await f.client(),b=await f.client();
  assert.equal((await a.watch({auctionId:7})).ok,true);assert.equal((await b.watch({auctionId:7})).ok,true);
  let release,entered;const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
  let committed=false;
  const process=createAuctionProcessor({locks,model:{processBid:async(_,{beforeCommit})=>{await beforeCommit();entered();await gate;committed=true;return {trang_thai:'da_chap_nhan',gia_toi_thieu:'hidden-secret'};}},notify:async id=>{assert(committed);f.updates.changed(id);}});
  const work=process(event());await started;await delay(30);assert.equal(a.events.length,0);assert.equal(b.events.length,0);
  release();await work;await delay(30);
  assert.deepEqual(a.events,[{auctionId:7}]);assert.deepEqual(b.events,[{auctionId:7}]);
});
test('không phát khi SQL thất bại; lỗi publish sau COMMIT được retry nhưng không ghi lượt lần hai',async()=>{
  let notifications=0,committed=0,stored;
  const failed=createAuctionProcessor({locks,model:{processBid:async()=>{throw Error('SQL rollback');}},notify:async()=>{notifications++;}});
  await assert.rejects(failed(event()),/SQL rollback/);assert.equal(notifications,0);
  let publishFailed=true;
  const process=createAuctionProcessor({locks,model:{processBid:async()=>{if(!stored){committed++;stored={trang_thai:'da_chap_nhan'};}return stored;}},notify:async()=>{if(publishFailed)throw Error('publish failed');notifications++;}});
  const input=event();await assert.rejects(process(input),/publish failed/);assert.equal(committed,1);
  publishFailed=false;await process(input);assert.equal(committed,1);assert.equal(notifications,1);
});
test('room từ chối phiên chưa công bố, dữ liệu tự chèn và lệnh giả; chuyển room bỏ phiên cũ',async t=>{
  const f=await fixture(t),a=await f.client(),catalog=await f.client();
  assert.equal((await a.watch({auctionId:9})).ok,false);
  assert.equal((await a.watch({auctionId:7,userId:99})).ok,false);
  assert.equal((await a.watch({auctionId:'7'})).ok,false);
  assert.equal((await a.watch({auctionId:7})).ok,true);
  assert.equal((await a.watch({auctionId:8})).ok,true);
  assert.equal((await catalog.watch({catalog:true})).ok,true);
  a.socket.emit('auction:changed',{auctionId:8,gia_toi_thieu:'forged'});await delay(20);assert.equal(catalog.events.length,0);
  f.updates.changed(7);await delay(20);assert.equal(a.events.length,0);assert.deepEqual(catalog.events,[{auctionId:7}]);
  f.updates.changed(8);await delay(20);assert.deepEqual(a.events,[{auctionId:8}]);
});
test('kích hoạt đã COMMIT vẫn thành công khi kênh thông báo lỗi',async()=>{
  let committed=false,logged=false;
  const service=createPostService({model:{activate:async()=>{committed=true;return {id:11,auctionId:7};}},notify:async()=>{assert(committed);throw Error('Redis unavailable');},log:()=>{logged=true;}});
  assert.deepEqual(await service.activate(1,11,{}),{id:11,auctionId:7});assert(logged);
});
test('Redis thật: cùng tín hiệu tới hai API, không kèm giá/người đặt/quyết định',
  {skip:!process.env.AUTH_TEST_REDIS_URL,timeout:10000},async t=>{
    const channel=`bookauction:test:realtime:${randomUUID()}`,clients=[];
    async function client(){const c=createClient({url:process.env.AUTH_TEST_REDIS_URL,socket:{reconnectStrategy:false}});c.on('error',()=>{});clients.push(c);await c.connect();return c;}
    t.after(async()=>{try{if(clients[0]?.isReady){const keys=await clients[0].keys(channel+'*');if(keys.length)await clients[0].del(keys);}}finally{clients.forEach(c=>{if(c.isOpen)c.destroy();});}});
    const publisher=await client(),first=await client(),second=await client(),a=[],b=[];
    await subscribeAuctionUpdates({subscriber:first,channel,onChange:id=>a.push(id)});
    await subscribeAuctionUpdates({subscriber:second,channel,onChange:id=>b.push(id)});
    await createAuctionNotifier({getRedis:()=>publisher,channel})(7);await delay(50);
    assert.deepEqual(a,[7]);assert.deepEqual(b,[7]);
    await publisher.publish(channel,JSON.stringify({auctionId:7,gia_toi_thieu:'hidden-secret'}));await delay(30);
    assert.deepEqual(a,[7]);assert.deepEqual(b,[7]);
    const settings={...AUCTION,stream:channel+':events',group:channel+':workers',deadLetter:channel+':dead',admissionPrefix:channel+':request:'};
    await ensureAuctionGroup(publisher,settings);const queue=createAuctionPublisher({getRedis:()=>publisher,settings}),input=event();
    await queue.bid(input);const firstMessage=(await publisher.xReadGroup(settings.group,'first',{key:settings.stream,id:'>'},{COUNT:1}))[0].messages[0];
    let committed=0,receipt,fail=true;
    const handle=createAuctionProcessor({locks,settings,model:{processBid:async()=>{if(!receipt){committed++;receipt={trang_thai:'da_chap_nhan'};}return receipt;}},
      notify:async id=>{if(fail)throw Error('publish failed after COMMIT');await createAuctionNotifier({getRedis:()=>publisher,channel})(id);}});
    await processAuctionMessage({client:publisher,message:firstMessage,handle,settings});
    assert.equal(committed,1);assert.equal((await publisher.xPending(settings.stream,settings.group)).pending,1);
    fail=false;const recovered=await publisher.xAutoClaim(settings.stream,settings.group,'replacement',0,'0-0',{COUNT:1});
    await processAuctionMessage({client:publisher,message:recovered.messages[0],handle,settings});await delay(30);
    assert.equal(committed,1);assert.equal((await publisher.xPending(settings.stream,settings.group)).pending,0);
    assert.deepEqual(a,[7,7]);assert.deepEqual(b,[7,7]);
  });
