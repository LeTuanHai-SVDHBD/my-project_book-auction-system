/** HTTP thật, model/queue giả: phân quyền, CSRF, 202 không phải thành công và quyền đọc quyết định. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import session from 'express-session';
import {createApp} from '../src/app.js';
import {createSessionMiddleware} from '../src/middlewares/session.js';
import {parseAuthConfig} from '../src/config/auth.js';
import {createAuthRouter} from '../src/routes/auth.routes.js';
import {createAuctionRouter} from '../src/routes/auction.routes.js';
import {createAuctionService} from '../src/services/auction.service.js';
import {HttpError} from '../src/middlewares/errorHandler.js';
import {assertSameBid} from '../src/models/auction.model.js';

async function fixture(t) {
  const authConfig=parseAuthConfig({SESSION_SECRET:'auction-tests-only-'.repeat(5)});
  const sessionMiddleware=createSessionMiddleware(authConfig,new session.MemoryStore());
  const rows=[1,2,3].map(id=>({nguoi_dung_id:id,ho_ten:'Test',email:`u${id}@example.test`,vai_tro:id===3?'admin':'nguoi_dung'}));
  const users={findById:async id=>rows.find(x=>x.nguoi_dung_id===id),findByEmail:async email=>rows.find(x=>x.email===email)};
  const decisions=new Map(),pending=new Map();let writes=0;
  const model={findRequest:async id=>decisions.get(id)||null,
    bidStatus:async(id,userId)=>id===7?{la_chu_sach:userId===2,duoc_dat_lai_luc:userId===1?'2026-10-24T01:00:20.000Z':null,server_time:'2026-10-24T01:00:05.000Z',nguoi_dung_id:userId,gia_toi_thieu:'hidden-secret'}:null,
    publicAuction:async id=>id===7?{phien_dau_gia_id:7,trang_thai:'da_kich_hoat',gia_khoi_diem:'100000',gia_toi_thieu:'hidden-secret',email:'private',row_version:'0000000000000001',gia_hien_tai:null,buoc_gia:'1000',ket_qua:null}:null};
  const publisher={async bid(input){const old=pending.get(input.requestId);if(old)assertSameBid({ma_yeu_cau:old.requestId,phien_dau_gia_id:old.auctionId,nguoi_dung_id:old.userId,muc_gia:old.amount},input);else{writes++;pending.set(input.requestId,input);}return old||input;},pending:async id=>pending.get(id)||null};
  const service=createAuctionService({model,publisher});
  const authRouter=createAuthRouter({authConfig,sessionMiddleware,users,passwords:{verify:async()=>true},limiter:{consume:async()=>0}});
  const auctionRouter=createAuctionRouter({sessionMiddleware,users,model,service});
  const server=createServer(createApp({config:{origins:[],mode:'development',probeToken:'x'},deps:{},probes:{},authRouter,auctionRouter}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const base=`http://127.0.0.1:${server.address().port}/api`;
  function client(){return {cookie:'',token:'',async call(path,method='GET',body,csrf=true){
    const response=await fetch(base+path,{method,headers:{...(this.cookie?{cookie:this.cookie}:{}),...(this.token&&csrf?{'x-csrf-token':this.token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    for(const cookie of response.headers.getSetCookie())if(cookie.startsWith('bookauction.sid='))this.cookie=cookie.split(';')[0];
    const data=await response.json();if(data.csrfToken)this.token=data.csrfToken;return {status:response.status,data};
  },async login(id){await this.call('/auth/csrf');assert.equal((await this.call('/auth/login','POST',{email:`u${id}@example.test`,mat_khau:'test password'})).status,200);}};}
  return {client,model,publisher,decisions,pending,writes:()=>writes,rows};
}
test('HTTP điều kiện đặt giá: lấy người xem từ session, không công khai cooldown cá nhân hoặc dữ liệu SQL khác',async t=>{
  const f=await fixture(t),guest=f.client(),buyer=f.client(),seller=f.client();
  assert.equal((await guest.call('/auctions/7/bid-status')).status,401);
  const publicView=(await guest.call('/auctions/7')).data;
  assert(!('duoc_dat_lai_luc' in publicView));assert(!('la_chu_sach' in publicView));
  await buyer.login(1);await seller.login(2);
  assert.deepEqual((await buyer.call('/auctions/7/bid-status?nguoi_dung_id=2')).data,
    {la_chu_sach:false,duoc_dat_lai_luc:'2026-10-24T01:00:20.000Z',server_time:'2026-10-24T01:00:05.000Z'});
  assert.deepEqual((await seller.call('/auctions/7/bid-status?nguoi_dung_id=1')).data,
    {la_chu_sach:true,duoc_dat_lai_luc:null,server_time:'2026-10-24T01:00:05.000Z'});
  assert.equal((await buyer.call('/auctions/0/bid-status')).status,400);
  assert.equal((await buyer.call('/auctions/8/bid-status')).status,404);
});
test('HTTP đấu giá: công khai lọc giá ẩn; gửi giá cần login, vai trò hiện tại và CSRF',async t=>{
  const f=await fixture(t),guest=f.client(),body={ma_yeu_cau:randomUUID(),muc_gia:'100000'};
  const snapshot=await guest.call('/auctions/7');assert.equal(snapshot.status,200);assert(!JSON.stringify(snapshot.data).includes('hidden-secret'));assert(!('row_version' in snapshot.data));
  assert.equal((await guest.call('/auctions/7/bids','POST',body)).status,401);
  const user=f.client(),admin=f.client();await user.login(1);await admin.login(3);
  assert.equal((await admin.call('/auctions/7/bids','POST',body)).status,403);
  assert.equal((await user.call('/auctions/7/bids','POST',body,false)).status,403);
  for(const extra of [{nguoi_dung_id:2},{thoi_gian_dat:new Date().toISOString()},{muc_gia:100000}])assert.equal((await user.call('/auctions/7/bids','POST',{...body,...extra})).status,400);
  assert.equal((await user.call('/auctions/0/bids','POST',body)).status,400);
  assert.equal((await user.call('/auctions/8/bids','POST',body)).status,404);assert.equal(f.writes(),0);
  const queued=await user.call('/auctions/7/bids','POST',body);assert.equal(queued.status,202);assert.equal(queued.data.trang_thai,'dang_cho_xu_ly');assert.equal(queued.data.thoi_gian_xu_ly,null);assert.equal(f.writes(),1);
  f.rows[0].vai_tro='admin';assert.equal((await user.call('/auctions/7/bids','POST',{...body,ma_yeu_cau:randomUUID()})).status,403);
});
test('HTTP quyết định: retry cùng nội dung, chặn dùng lại mã, chỉ chủ yêu cầu đọc, SQL ưu tiên hơn cache',async t=>{
  const f=await fixture(t),a=f.client(),b=f.client();await a.login(1);await b.login(2);
  const body={ma_yeu_cau:randomUUID(),muc_gia:'999999999999999999'};
  assert.equal((await a.call('/auctions/7/bids','POST',body)).status,202);
  assert.equal((await a.call('/auctions/7/bids','POST',body)).status,202);assert.equal(f.writes(),1);
  assert.equal((await a.call('/auctions/7/bids','POST',{...body,muc_gia:'1'})).status,409);
  assert.equal((await b.call('/auctions/7/bids','POST',body)).status,409);
  assert.equal((await b.call(`/auctions/7/requests/${body.ma_yeu_cau}`)).status,404);
  f.decisions.set(body.ma_yeu_cau,{...body,phien_dau_gia_id:7,nguoi_dung_id:1,trang_thai:'da_chap_nhan',ly_do:null,thoi_gian_xu_ly:new Date()});
  f.publisher.pending=async()=>{throw new Error('Redis cache unavailable');};
  const result=await a.call(`/auctions/7/requests/${body.ma_yeu_cau}`);assert.equal(result.status,200);assert.equal(result.data.trang_thai,'da_chap_nhan');assert.equal(result.data.muc_gia,body.muc_gia);assert(!('nguoi_dung_id' in result.data));
  assert.equal((await a.call('/auctions/7/bids','POST',body)).status,200);
  assert.equal((await a.call(`/auctions/8/requests/${body.ma_yeu_cau}`)).status,404);
  assert.equal((await b.call(`/auctions/7/requests/${body.ma_yeu_cau}`)).status,404);
});
test('HTTP lỗi tiếp nhận không biến thành quyết định từ chối giả hoặc trả chi tiết phụ thuộc',async t=>{
  const f=await fixture(t),a=f.client();await a.login(1);
  f.publisher.bid=async()=>{throw Error('sensitive dependency connection');};
  const response=await a.call('/auctions/7/bids','POST',{ma_yeu_cau:randomUUID(),muc_gia:'100000'});
  assert.equal(response.status,500);assert.equal(response.data.error,'DEPENDENCY_UNAVAILABLE');assert(!JSON.stringify(response.data).includes('sensitive'));
  f.publisher.bid=async()=>{throw new HttpError(409,'REQUEST_ID_CONFLICT','Mã đã dùng.');};
  assert.equal((await a.call('/auctions/7/bids','POST',{ma_yeu_cau:randomUUID(),muc_gia:'100000'})).status,409);
});
