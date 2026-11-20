/** Quyền HTTP, dữ liệu công bố và bản in; dùng SQL model fixture, không thay cho SQL Server thật. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import session from 'express-session';
import {createPostModel} from '../src/models/post.model.js';
import {createReviewSnapshot,readReviewSnapshot} from '../src/services/reviewExport.js';
import {renderReviewDocument} from '../../frontend/src/services/reviewDocument.js';
import {createApp} from '../src/app.js';
import {createPostRouter} from '../src/routes/post.routes.js';
import {createAuthRouter} from '../src/routes/auth.routes.js';
import {createSessionMiddleware} from '../src/middlewares/session.js';
import {parseAuthConfig} from '../src/config/auth.js';

const media=[{kind:'image',url:'https://res.cloudinary.com/demo/image/upload/old.jpg',title:'Bìa'},
  {kind:'video',url:'https://res.cloudinary.com/demo/video/upload/old.mp4',title:'Gáy'}];
function fixture() {
  return {bai_dang_id:7,sach_id:4,nguoi_dung_id:1,ten_sach:'Truyện Kiều',tieu_de:'Ấn bản đặc biệt',mo_ta_tinh_trang:'Một bản sách vật lý',
    trang_thai_bai:'tu_choi',trang_thai_phien:'khong_dat_kiem_duyet',row_version:Buffer.from('0000000000000003','hex'),media:structuredClone(media),
    gia_toi_thieu:'secret-reserve',email:'private@example.test',
    kiem_duyet:[{kiem_duyet_id:2,ket_qua:'Từ chối',phan_hoi_admin:'Cần bổ sung giấy chứng nhận.',ngay_kiem_duyet:'2026-10-30T03:00:00.000Z'},
      {kiem_duyet_id:1,ket_qua:'Từ chối',phan_hoi_admin:'Lần trước',ngay_kiem_duyet:'2026-10-30T01:00:00.000Z'}],
    ai:{phan_tich_id:10,ngay_phan_tich:'2026-10-30T02:00:00.000Z',loi_thoi:false,trang_thai:'chua_day_du',diem_do_hiem:null,diem_tinh_trang:'100.00',chi_tiet:[],
      thong_tin:{error_code:'never-publish',model:'private-diagnostic',rule_version:'fixture',warnings:['Cần xác minh độ hiếm']}}};
}
test('bản kết quả giữ NULL độc lập, chỉ công bố AI đúng vòng và không chứa giá/tài khoản/chẩn đoán',()=>{
  const post=fixture(),result=createReviewSnapshot(post);
  assert.equal(result.review.kiem_duyet_id,2);assert.equal(result.ai.diem_do_hiem,null);assert.equal(result.ai.diem_tinh_trang,'100.00');
  for(const forbidden of ['secret-reserve','private@example.test','never-publish','private-diagnostic','nguoi_dung_id'])assert(!JSON.stringify(result).includes(forbidden));
  assert.deepEqual(readReviewSnapshot(JSON.stringify(result),7,2),JSON.parse(JSON.stringify(result)));
  assert.throws(()=>readReviewSnapshot(JSON.stringify(result),7,1));
  for(const patch of [{loi_thoi:true},{ngay_phan_tich:'2026-10-30T00:00:00Z'},{ngay_phan_tich:'2026-10-30T04:00:00Z'}])assert.equal(createReviewSnapshot({...post,ai:{...post.ai,...patch}}).ai,null);
  assert.throws(()=>createReviewSnapshot({...post,trang_thai_bai:'cho_kiem_duyet',trang_thai_phien:'cho_kiem_duyet'}));
  const failed=createReviewSnapshot({...post,ai:{...post.ai,trang_thai:'that_bai',diem_do_hiem:100}});
  assert.equal(failed.ai.diem_do_hiem,null);assert(!JSON.stringify(failed).includes('never-publish'));
});

// Transaction double persists only at COMMIT; real locking/migration tested separately, opt-in.
function modelFixture() {
  const state={post:fixture(),snapshots:{},failSave:false,commits:0,rollbacks:0};
  class Transaction {
    async begin(){this.snapshots=structuredClone(state.snapshots);}
    request(){return req(this);}
    async commit(){state.snapshots=this.snapshots;state.commits++;}
    async rollback(){state.rollbacks++;}
  }
  function req(tx) {
    const params={};
    return {input(name,type,value){params[name]=value;return this;},async query(query){
      const post=state.post;
      if(query.includes('UPDATE dbo.KiemDuyet SET ket_qua_snapshot')){
        if(state.failSave)throw Error('fixture snapshot failure');
        tx.snapshots[params.id]=params.snapshot;return {rowsAffected:[1]};
      }
      if(query.startsWith('SELECT ket_qua_snapshot'))return {recordset:post.kiem_duyet.some(row=>row.kiem_duyet_id===params.id)&&params.post===7?[{ket_qua_snapshot:tx.snapshots[params.id]||null}]:[]};
      if(query.includes('JOIN dbo.PhienDauGia p WITH'))return {recordset:params.id===7?[{...post}]:[]};
      if(query.includes('JOIN dbo.Sach s'))return {recordset:[{...post}]};
      if(query.includes('FROM dbo.HinhAnh'))return {recordset:post.media.filter(x=>x.kind==='image')};
      if(query.includes('FROM dbo.Video'))return {recordset:post.media.filter(x=>x.kind==='video')};
      if(query.includes('FROM dbo.KiemDuyet'))return {recordset:post.kiem_duyet};
      if(query.includes('FROM dbo.PhanTichAI'))return {recordset:[]};
      assert.fail(query);
    }};
  }
  const sql={Transaction,ISOLATION_LEVEL:{SERIALIZABLE:'serializable'},Int:'Int',DateTime2:()=>'',NVarChar:()=>'',MAX:'max'};
  return {state,model:createPostModel({sql,getPool:async()=>({})})};
}
test('xuất lại giữ nguyên bản đã lưu sau gửi duyệt lại; không ghép dữ liệu mới cho vòng cũ',async()=>{
  const {model,state}=modelFixture();
  const first=await model.exportReview(1,7,2);
  assert.equal(first.media.length,2);assert.equal(first.ai,null);
  state.post.tieu_de='Dữ liệu mới';state.post.media.push({kind:'image',url:'https://res.cloudinary.com/demo/image/upload/new.jpg'});
  state.post.trang_thai_bai='cho_kiem_duyet';state.post.trang_thai_phien='cho_kiem_duyet';
  const again=await model.exportReview(1,7,2);assert.deepEqual(again,first);assert.equal(again.media.length,2);
  await assert.rejects(model.exportReview(1,7,1),{status:409,code:'REVIEW_EXPORT_UNAVAILABLE'});
  await assert.rejects(model.exportReview(2,7,2),{status:404});
  await assert.rejects(model.exportReview(1,7,99),{status:404});
  assert.equal(state.commits,2);
});
test('lỗi lưu bản kết quả rollback; không trả bản chưa COMMIT',async()=>{
  const {model,state}=modelFixture();state.failSave=true;
  await assert.rejects(model.exportReview(1,7,2),/fixture snapshot failure/);
  assert.deepEqual(state.snapshots,{});assert.equal(state.commits,0);assert.equal(state.rollbacks,1);
});

test('bản in tiếng Việt, điểm không có .00; link Cloudinary và nguồn an toàn, không thực thi nội dung bài',()=>{
  const post=fixture();post.tieu_de='<script>bad()</script>';
  post.mo_ta_tinh_trang='</p><img src=x onerror="bad()">';
  post.ai.chi_tiet=[{tieu_chi:'Trang ruột',trang_thai_danh_gia:'Đã đánh giá',diem:100,trong_so:30,bang_chung:'Trang sạch',
    nguon_doi_chieu:JSON.stringify([{url:'javascript:bad()'},{url:'https://publisher.example.test/book'}])}];
  const report=createReviewSnapshot(post);
  report.media.push({kind:'image',url:'javascript:bad()'});
  const html=renderReviewDocument(report);
  assert.match(html,/Truyện Kiều/);assert.match(html,/100 \/ 100/);assert(!html.includes('100.00'));assert.match(html,/Chưa đủ dữ liệu/);
  assert.match(html,/href="https:\/\/res.cloudinary.com\/demo\/video\/upload\/old.mp4"/);
  assert.match(html,/href="https:\/\/publisher.example.test\/book"/);
  assert(!html.includes('<script>'));assert(!html.includes('<img'));assert(!html.includes('href="javascript:'));
  assert.match(html,/&lt;script&gt;/);assert.match(html,/Lần kiểm duyệt #2/);assert.match(html,/UTC\+7/);
  assert(!html.includes('<video'));assert(!html.includes('secret-reserve'));
});

test('HTTP xuất riêng tư: login, vai trò, CSRF, ID và sở hữu; không cache kết quả',async t=>{
  const authConfig=parseAuthConfig({SESSION_SECRET:'review-export-fixture-only-'.repeat(4)});
  const sessionMiddleware=createSessionMiddleware(authConfig,new session.MemoryStore());
  const rows=[1,2,3].map(id=>({nguoi_dung_id:id,email:`e${id}@example.test`,ho_ten:'Fixture',vai_tro:id===3?'admin':'nguoi_dung'}));
  const users={findById:async id=>rows.find(row=>row.nguoi_dung_id===id),findByEmail:async email=>rows.find(row=>row.email===email)};
  const {model,state}=modelFixture();
  const authRouter=createAuthRouter({authConfig,sessionMiddleware,users,passwords:{verify:async()=>true},limiter:{consume:async()=>0}});
  const postRouter=createPostRouter({sessionMiddleware,users,model,service:{},limits:{}});
  const server=createServer(createApp({config:{origins:[],mode:'development',probeToken:'x'},deps:{},probes:{},authRouter,postRouter}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const base=`http://127.0.0.1:${server.address().port}/api`;
  function client(){return {cookie:'',token:'',async call(path,method='POST',body={},csrf=true){
    const response=await fetch(base+path,{method,headers:{cookie:this.cookie,'Content-Type':'application/json',...(csrf?{'x-csrf-token':this.token}:{})},body:method==='POST'?JSON.stringify(body):undefined});
    for(const value of response.headers.getSetCookie())this.cookie=value.split(';')[0];
    const data=await response.json();if(data.csrfToken)this.token=data.csrfToken;return {status:response.status,data,cache:response.headers.get('cache-control')};
  },async login(id){await this.call('/auth/csrf','GET');assert.equal((await this.call('/auth/login','POST',{email:`e${id}@example.test`,mat_khau:'fixture-password'})).status,200);}};}
  const guest=client(),owner=client(),other=client(),admin=client();await owner.login(1);await other.login(2);await admin.login(3);
  const path='/posts/7/reviews/2/export';
  assert.equal((await guest.call(path)).status,401);
  assert.equal((await other.call(path)).status,404);
  assert.equal((await admin.call(path)).status,403);
  assert.equal((await owner.call(path,'POST',{},false)).status,403);
  assert.equal((await owner.call('/posts/7/reviews/nope/export')).status,400);
  assert.equal((await owner.call('/posts/8/reviews/2/export')).status,404);
  assert.equal(state.commits,0);
  const result=await owner.call(path);assert.equal(result.status,200);assert.equal(result.cache,'no-store');assert.equal(result.data.review.kiem_duyet_id,2);
  assert(!JSON.stringify(result.data).includes('secret-reserve'));
});
