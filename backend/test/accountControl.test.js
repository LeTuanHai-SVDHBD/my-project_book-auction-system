/** Redis/HTTP/Socket thật opt-in: hai API chia sẻ quyền, không dùng giả lập Lua hoặc kết quả phân quyền. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createClient} from 'redis';
import {RedisStore} from 'connect-redis';
import {Server} from 'socket.io';
import {io} from 'socket.io-client';
import {createApp} from '../src/app.js';
import {parseAuthConfig} from '../src/config/auth.js';
import {createSessionMiddleware} from '../src/middlewares/session.js';
import {createAuthRouter} from '../src/routes/auth.routes.js';
import {createAuctionRouter} from '../src/routes/auction.routes.js';
import {createAccountControl} from '../src/services/accountControl.service.js';
import {attachAccountSockets} from '../src/realtime/accountSockets.js';
const uuid=()=>randomUUID().replaceAll('-','');
test('hai API: login mới ngắt chủ cũ, HTTP bị chặn, reconnect không reclaim, F5 lấy lại và logout cũ không xóa chủ mới',
  {skip:!process.env.AUTH_TEST_REDIS_URL,timeout:20000},async t=>{
  const redis=createClient({url:process.env.AUTH_TEST_REDIS_URL});redis.on('error',()=>{});await redis.connect();
  const prefix=`bookauction:test:control:${randomUUID()}:`,channel=prefix+'updates',subscribers=[],servers=[],sockets=[];
  t.after(async()=>{for(const socket of sockets)socket.disconnect();for(const server of servers)await new Promise(resolve=>server.io.close(resolve));for(const sub of subscribers)if(sub.isOpen)sub.destroy();if(redis.isReady){const keys=await redis.keys(prefix+'*');if(keys.length)await redis.del(keys);}if(redis.isOpen)redis.destroy();});
  const authConfig=parseAuthConfig({SESSION_SECRET:'control-fixture-'.repeat(5)}),usersData=[1,2].map(id=>({nguoi_dung_id:id,ho_ten:'Fixture '+id,email:`control-${id}@example.test`,vai_tro:'nguoi_dung'}));
  const users={findById:async id=>usersData.find(x=>x.nguoi_dung_id===id),findByEmail:async email=>usersData.find(x=>x.email===email)};let bids=0;
  async function api(){
    const control=createAccountControl({getRedis:()=>redis,idleSeconds:7200,keyPrefix:prefix+'owner:',channel});
    const sessionMiddleware=createSessionMiddleware(authConfig,new RedisStore({client:redis,prefix:prefix+'session:'}),{control});
    const authRouter=createAuthRouter({authConfig,sessionMiddleware,users,passwords:{verify:async()=>true},limiter:{consume:async()=>0}});
    const auctionRouter=createAuctionRouter({sessionMiddleware,users,model:{publicAuction:async()=>({})},service:{submit:async()=>{bids++;return {status:202,body:{ok:true}};}}});
    const server=createServer(createApp({config:{mode:'development',origins:[],probeToken:'fixture'},deps:{},probes:{},authRouter,auctionRouter})),socketServer=new Server(server);
    const accounts=attachAccountSockets({io:socketServer,sessionMiddleware,users,control,heartbeatMs:100});
    const sub=redis.duplicate();await sub.connect();await sub.subscribe(channel,accounts.changed);subscribers.push(sub);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const value={io:socketServer,accounts,base:`http://127.0.0.1:${server.address().port}`};servers.push(value);return value;
  }
  const first=await api(),second=await api();
  function client(server){return {tab:uuid(),control:uuid(),cookie:'',token:'',async call(path,body,token=this.token){
    const response=await fetch(server.base+'/api'+path,{method:body?'POST':'GET',headers:{'x-tab-id':this.tab,'x-control-id':this.control,cookie:this.cookie,...(body?{'content-type':'application/json','x-csrf-token':token}:{})},body:body?JSON.stringify(body):undefined});
    const cookies=response.headers.getSetCookie();if(cookies.length)this.cookie=cookies[0].split(';')[0];const data=response.status===204?null:await response.json();if(data?.csrfToken)this.token=data.csrfToken;return {status:response.status,data};
  },async login(id=1){await this.call('/auth/csrf');assert.equal((await this.call('/auth/login',{email:`control-${id}@example.test`,mat_khau:'fixture'})).status,200);},socket(){const socket=io(server.base+'/account',{autoConnect:false,forceNew:true,transports:['websocket'],reconnection:false,extraHeaders:{cookie:this.cookie},auth:{tabId:this.tab,controlId:this.control}});sockets.push(socket);return socket;}};}
  const a=client(first),b=client(second),other=client(second);await a.login();const old=a.socket(),connected=once(old,'connect');old.connect();await connected;
  const gone=once(old,'disconnect'),replaced=once(old,'account:replaced');await b.login();await replaced;assert.equal((await gone)[0],'io server disconnect');
  assert.equal((await a.call('/auth/control-status')).data.error,'ACCOUNT_REPLACED');
  assert.equal((await a.call('/auctions/8/bids',{ma_yeu_cau:randomUUID(),muc_gia:'100000'})).status,409);assert.equal(bids,0);
  assert.equal((await b.call('/auctions/8/bids',{ma_yeu_cau:randomUUID(),muc_gia:'100000'})).status,202);assert.equal(bids,1);
  const stale=a.socket(),rejected=once(stale,'connect_error');stale.connect();assert.equal((await rejected)[0].data.code,'ACCOUNT_REPLACED');
  await other.login(2);assert.equal((await b.call('/auth/control-status')).status,200);
  assert.equal((await a.call('/auth/me')).status,200);assert.equal((await a.call('/auth/control',{},'wrong-csrf')).status,403);
  assert.equal((await a.call('/auth/control',{userId:1})).status,400);assert.equal((await b.call('/auth/control-status')).status,200);
  const active=b.socket(),activeConnected=once(active,'connect');active.connect();await activeConnected;const activeGone=once(active,'disconnect');
  const previous=a.control;a.control=uuid();assert.equal((await a.call('/auth/control',{})).status,200);await activeGone;
  assert.equal((await b.call('/auth/control-status')).status,409);
  const current=a.control;a.control=previous;assert.equal((await a.call('/auth/control-status')).status,409);a.control=current;
  assert.equal((await b.call('/auth/logout',{})).status,204);assert.equal((await a.call('/auth/control-status')).status,200);
  // Missing ownership after Redis data loss fails closed; a valid CSRF-protected reclaim restores it.
  await redis.del(prefix+'owner:1');assert.equal((await a.call('/auth/control-status')).status,409);assert.equal((await a.call('/auth/control',{})).status,200);
  const forged=a.socket();forged.auth.tabId=uuid();const forgedError=once(forged,'connect_error');forged.connect();assert.equal((await forgedError)[0].data.code,'UNAUTHENTICATED');
  // A missed Pub/Sub invalidation still disconnects through server heartbeat; no reconnect can claim.
  await subscribers[0].unsubscribe(channel);const fallback=a.socket(),fallbackConnected=once(fallback,'connect');fallback.connect();await fallbackConnected;
  await first.accounts.changed(JSON.stringify({userId:1,owner:'f'.repeat(64)}));assert.equal(fallback.connected,true,'Delayed claim notification must not kick the current owner.');
  const fallbackReplaced=once(fallback,'account:replaced'),fallbackGone=once(fallback,'disconnect');await b.login();await fallbackReplaced;assert.equal((await fallbackGone)[0],'io server disconnect');
  assert.equal((await b.call('/auth/logout',{})).status,204);assert.equal(await redis.exists(prefix+'owner:1'),0);
});
