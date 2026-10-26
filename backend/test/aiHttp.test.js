/** HTTP thật: chủ bài/Admin, CSRF, version và không lộ config bí mật hoặc phân tích của người khác. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import session from 'express-session';
import {createApp} from '../src/app.js';
import {createAuthRouter} from '../src/routes/auth.routes.js';
import {createAiRouter} from '../src/routes/ai.routes.js';
import {createAiService} from '../src/services/ai.service.js';
import {createSessionMiddleware} from '../src/middlewares/session.js';
import {parseAuthConfig} from '../src/config/auth.js';
import {HttpError} from '../src/middlewares/errorHandler.js';
test('HTTP phân tích giữ quyền sở hữu/Admin, CSRF, version, key ở backend và điểm NULL',async t=>{
  const authConfig=parseAuthConfig({SESSION_SECRET:'ai-http-fixture-only-'.repeat(4)}),sessionMiddleware=createSessionMiddleware(authConfig,new session.MemoryStore());
  const rows=[1,2,3].map(id=>({nguoi_dung_id:id,email:`a${id}@example.test`,ho_ten:'Fixture',vai_tro:id===3?'admin':'nguoi_dung'}));
  const users={findById:async id=>rows.find(x=>x.nguoi_dung_id===id),findByEmail:async email=>rows.find(x=>x.email===email)};
  let enqueued=0;
  const posts={detail:async(id,options)=>{if(id!==7||!options.admin&&options.owner!==1)throw new HttpError(404,'POST_NOT_FOUND','Không tìm thấy.');return {row_version:'0000000000000001',trang_thai_phien:'cho_kiem_duyet',ai:null};}};
  const config={configured:true,key:'never-send-this-secret'},service=createAiService({posts,config,model:{history:async()=>[],get:async()=>null},queue:{status:async()=>null,enqueue:async()=>{enqueued++;return {requestId:'fixture',state:'queued'};}}});
  const authRouter=createAuthRouter({authConfig,sessionMiddleware,users,passwords:{verify:async()=>true},limiter:{consume:async()=>0}}),aiRouter=createAiRouter({sessionMiddleware,users,service});
  const server=createServer(createApp({config:{mode:'development',origins:[],probeToken:'x'},deps:{},probes:{},authRouter,aiRouter}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const base=`http://127.0.0.1:${server.address().port}/api`;
  function client(){return {cookie:'',token:'',async call(path,method='GET',body,csrf=true){const response=await fetch(base+path,{method,headers:{cookie:this.cookie,...(body?{'Content-Type':'application/json'}:{}),...(csrf?{'x-csrf-token':this.token}:{})},body:body?JSON.stringify(body):undefined});for(const value of response.headers.getSetCookie())this.cookie=value.split(';')[0];const data=await response.json();if(data.csrfToken)this.token=data.csrfToken;return {status:response.status,data};},async login(id){await this.call('/auth/csrf');await this.call('/auth/login','POST',{email:`a${id}@example.test`,mat_khau:'fixture-password'});}};}
  const guest=client(),owner=client(),other=client(),admin=client();await owner.login(1);await other.login(2);await admin.login(3);
  assert.equal((await guest.call('/ai/7')).status,401);assert.equal((await other.call('/ai/7')).status,404);
  const status=await owner.call('/ai/7');assert.equal(status.status,200);assert.equal(status.data.analysis,null);assert(!JSON.stringify(status).includes(config.key));
  assert.equal((await owner.call('/ai/7','POST',{row_version:'0000000000000001'})).status,403);
  assert.equal((await admin.call('/ai/7','POST',{row_version:'0000000000000001'},false)).status,403);
  assert.equal((await admin.call('/ai/7','POST',{row_version:'0000000000000002'})).status,409);
  assert.equal((await admin.call('/ai/7','POST',{row_version:'0000000000000001',diem_do_hiem:100})).status,400);assert.equal(enqueued,0);
  assert.equal((await admin.call('/ai/7','POST',{row_version:'0000000000000001'})).status,202);assert.equal(enqueued,1);
  assert.equal((await owner.call('/ai/7?analysis=10')).status,404);
  config.configured=false;assert.equal((await admin.call('/ai/7','POST',{row_version:'0000000000000001'})).status,503);
});
