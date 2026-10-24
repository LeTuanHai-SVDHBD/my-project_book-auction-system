/** Hồi quy một cookie jar chung: hai tài khoản ở hai tab, CSRF/rotate/logout và selector không có quyền xác thực. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import session from 'express-session';
import {createClient} from 'redis';
import {RedisStore} from 'connect-redis';
import {createApp} from '../src/app.js';
import {parseAuthConfig} from '../src/config/auth.js';
import {createSessionMiddleware} from '../src/middlewares/session.js';
import {createAuthRouter} from '../src/routes/auth.routes.js';
const tabId=()=>randomUUID().replaceAll('-','');
async function fixture(t,{store=new session.MemoryStore(),prefix}={}){
  const authConfig=parseAuthConfig({SESSION_SECRET:'tab-session-tests-only-'.repeat(4)});
  const usersData=[{nguoi_dung_id:1,ho_ten:'Admin',email:'admin@example.test',vai_tro:'admin'},
    {nguoi_dung_id:2,ho_ten:'User',email:'user@example.test',vai_tro:'nguoi_dung'}];
  const users={findById:async id=>usersData.find(x=>x.nguoi_dung_id===id),findByEmail:async email=>usersData.find(x=>x.email===email)};
  const router=createAuthRouter({authConfig,users,sessionMiddleware:createSessionMiddleware(authConfig,store),
    passwords:{verify:async(hash,password)=>password==='valid-password-long'},limiter:{consume:async()=>0}});
  const server=createServer(createApp({config:{mode:'development',origins:[],probeToken:'test'},deps:{},probes:{},authRouter:router}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const base=`http://127.0.0.1:${server.address().port}/api/auth`;const jar=new Map();
  function client(id=tabId(),cookieJar=jar){return {id,csrf:'',async call(path,body,{token=this.csrf}={}){
    const response=await fetch(base+path,{method:body?'POST':'GET',headers:{...(this.id===null?{}:{'x-tab-id':this.id}),cookie:[...cookieJar].map(([key,value])=>`${key}=${value}`).join('; '),...(body?{'Content-Type':'application/json','x-csrf-token':token}:{})},body:body?JSON.stringify(body):undefined});
    for(const value of response.headers.getSetCookie()){
      const pair=value.split(';')[0];const index=pair.indexOf('=');const name=pair.slice(0,index),content=pair.slice(index+1);
      if(!content)cookieJar.delete(name);else cookieJar.set(name,content);
    }
    const data=response.status===204?null:await response.json();if(data?.csrfToken)this.csrf=data.csrfToken;
    return {status:response.status,data,response};
  },async login(email){await this.call('/csrf');return this.call('/login',{email,mat_khau:'valid-password-long'});}};}
  return {client,jar,store,authConfig,prefix};
}
test('hai tab cùng cookie jar giữ Admin/người dùng độc lập; login và logout một tab không đổi tab khác',async t=>{
  const {client,jar}=await fixture(t);const admin=client(),user=client();
  assert.equal((await admin.login('admin@example.test')).status,200);
  const adminCookie=jar.get(`bookauction.sid.${admin.id}`);
  assert.equal((await user.login('user@example.test')).status,200);
  assert.equal(jar.get(`bookauction.sid.${admin.id}`),adminCookie);
  assert.equal((await admin.call('/me')).data.user.vai_tro,'admin');assert.equal((await user.call('/me')).data.user.vai_tro,'nguoi_dung');
  assert.equal((await admin.call('/admin-check')).status,200);assert.equal((await user.call('/admin-check')).status,403);
  const userCookie=jar.get(`bookauction.sid.${user.id}`);
  await admin.login('user@example.test');assert.equal(jar.get(`bookauction.sid.${user.id}`),userCookie);
  assert.equal((await user.call('/me')).status,200);
  const reply=await admin.call('/logout',{});assert.equal(reply.status,204);
  assert(!jar.has(`bookauction.sid.${admin.id}`));assert.equal(jar.get(`bookauction.sid.${user.id}`),userCookie);
  assert.equal((await admin.call('/me')).status,401);assert.equal((await user.call('/me')).status,200);
});
test('cookie HttpOnly giữ nguyên, mỗi tab đổi mã session khi login và không dùng CSRF của tab khác',async t=>{
  const {client,jar}=await fixture(t);const a=client(),b=client();
  const boot=await a.call('/csrf');const anonymous=jar.get(`bookauction.sid.${a.id}`);
  assert(boot.response.headers.getSetCookie().every(value=>value.startsWith(`bookauction.sid.${a.id}=`)&&/HttpOnly/.test(value)&&/SameSite=Lax/.test(value)));
  await b.call('/csrf');const oldToken=a.csrf;
  assert.equal((await a.call('/login',{email:'admin@example.test',mat_khau:'valid-password-long'},{token:b.csrf})).status,403);
  assert.equal((await a.call('/login',{email:'admin@example.test',mat_khau:'valid-password-long'})).status,200);
  assert.notEqual(jar.get(`bookauction.sid.${a.id}`),anonymous);assert.notEqual(a.csrf,oldToken);
  const replay=client(a.id,new Map([[`bookauction.sid.${a.id}`,anonymous]]));assert.equal((await replay.call('/me')).status,401);
});
test('tab mới không đọc cookie tab cũ hoặc cookie chung; chỉ có selector mà không có cookie vẫn nhận 401',async t=>{
  const {client}=await fixture(t);const legacy=client(null);await legacy.login('admin@example.test');
  const a=client();assert.equal((await a.call('/me')).status,401);await a.login('admin@example.test');
  const fresh=client();assert.equal((await fresh.call('/me')).status,401);
  const noCookie=client(a.id,new Map());assert.equal((await noCookie.call('/me')).status,401);
});
test('tab selector sai bị chặn; middleware không tăng listener theo số tab',async t=>{
  const {client,store}=await fixture(t);const initial=store.listenerCount('connect')+store.listenerCount('disconnect');
  assert.equal((await client('bad-id').call('/csrf')).status,400);
  for(let i=0;i<20;i++)assert.equal((await client().call('/csrf')).status,200);
  assert.equal(store.listenerCount('connect')+store.listenerCount('disconnect'),initial);
});
test('Redis thật: hai tab trong cùng cookie jar có session/TTL riêng và thu hồi độc lập',
  {skip:!process.env.AUTH_TEST_REDIS_URL,timeout:20000},async t=>{
    const redis=createClient({url:process.env.AUTH_TEST_REDIS_URL,disableOfflineQueue:true,socket:{connectTimeout:3000,reconnectStrategy:false}});redis.on('error',()=>{});await redis.connect();
    const prefix=`bookauction:test:tabs:${randomUUID()}:`;
    t.after(async()=>{if(redis.isReady){const keys=await redis.keys(prefix+'*');if(keys.length)await redis.del(keys);}if(redis.isOpen)redis.destroy();});
    const {client}=await fixture(t,{store:new RedisStore({client:redis,prefix})});const a=client(),b=client();await a.login('admin@example.test');await b.login('user@example.test');
    const keys=await redis.keys(prefix+'*');assert.equal(keys.length,2);for(const key of keys)assert((await redis.ttl(key))>=7197);
    assert.equal((await a.call('/admin-check')).status,200);assert.equal((await b.call('/me')).data.user.vai_tro,'nguoi_dung');
    await a.call('/logout',{});assert.equal((await redis.keys(prefix+'*')).length,1);assert.equal((await b.call('/me')).status,200);
  });
