/** Hồi quy rowversion tại ranh giới SQL → JSON → HTTP → SQL khóa dòng; driver được giả lập bằng bytes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import session from 'express-session';
import sql from 'mssql';
import {encodeRowVersion} from '../src/utils/rowVersion.js';
import {version,validateActivation,validateReview} from '../src/services/postValidation.js';
import {createPostModel} from '../src/models/post.model.js';
import {createPostService} from '../src/services/post.service.js';
import {createApp} from '../src/app.js';
import {createPostRouter} from '../src/routes/post.routes.js';
import {createAuthRouter} from '../src/routes/auth.routes.js';
import {createSessionMiddleware} from '../src/middlewares/session.js';
import {parseAuthConfig} from '../src/config/auth.js';
const raw=Buffer.from('00000000000000AB','hex');
const expected='00000000000000AB';
const schedule=rowVersion=>({thoi_gian_bat_dau:new Date(Date.now()+600000).toISOString(),thoi_gian_ket_thuc:new Date(Date.now()+3600000).toISOString(),row_version:rowVersion});
test('rowversion giữ đủ 8 byte và byte 0 đầu, xuất hex chuẩn, không chấp nhận thiếu dữ liệu hay Number',()=>{
  assert.equal(encodeRowVersion(raw),expected);
  assert.equal(encodeRowVersion(new Uint8Array(raw)),expected);
  assert.equal(encodeRowVersion(Buffer.from('FEDCBA9876543210','hex')),'FEDCBA9876543210');
  for(const invalid of [undefined,null,7,Buffer.alloc(7),Buffer.alloc(9),'00000000000000AB'])assert.throws(()=>encodeRowVersion(invalid));
  // HTTP chỉ nhận token hex, không nhận đối tượng Buffer JSON hoặc nới lỏng kiểm tra để bỏ qua xung đột.
  assert.throws(()=>version(raw.toJSON()),{status:400});assert.throws(()=>version('0x'+expected),{status:400});
});
function databaseFixture(){
  const state={row:{bai_dang_id:7,sach_id:9,nguoi_dung_id:1,phien_dau_gia_id:11,trang_thai:'cho_kiem_duyet',trang_thai_bai:'cho_kiem_duyet',trang_thai_phien:'cho_kiem_duyet',row_version:Buffer.from(raw)},reviews:[],commits:0,rollbacks:0};
  const copy=row=>({...row,row_version:Buffer.from(row.row_version)});
  function bump(){const value=Buffer.alloc(8);value.writeBigUInt64BE(state.row.row_version.readBigUInt64BE()+1n);state.row.row_version=value;}
  class Request{
    values={};
    input(name,type,value){this.values[name]=value;return this;}
    async query(text){
      if(text.startsWith('SELECT')&&text.includes('FROM dbo.BaiDang b'))return {recordset:text.includes(' AS allowed')?[{allowed:0}]:[copy(state.row)]};
      if(text.startsWith('SELECT')&&text.includes('FROM dbo.KiemDuyet'))return {recordset:state.reviews.map(x=>({...x}))};
      if(text.startsWith('SELECT'))return {recordset:[]};
      if(text.startsWith('UPDATE dbo.BaiDang')){state.row.trang_thai=state.row.trang_thai_bai=this.values.state;return {recordset:[]};}
      if(text.startsWith('UPDATE dbo.PhienDauGia')){
        if(this.values.state)state.row.trang_thai_phien=this.values.state;
        else{state.row.trang_thai_phien='da_kich_hoat';state.row.thoi_gian_bat_dau=this.values.start;state.row.thoi_gian_ket_thuc=this.values.end;}
        bump();return {recordset:[{phien_dau_gia_id:state.row.phien_dau_gia_id}]};
      }
      if(text.startsWith('INSERT dbo.KiemDuyet')){
        const row={kiem_duyet_id:state.reviews.length+1,ket_qua:this.values.result,phan_hoi_admin:this.values.reason,ngay_kiem_duyet:new Date()};
        state.reviews.push(row);return {recordset:[{kiem_duyet_id:row.kiem_duyet_id}]};
      }
      if(text.startsWith('UPDATE dbo.KiemDuyet SET ket_qua_snapshot')){
        if(state.failSnapshot)throw Error('fixture snapshot failure');
        state.reviews.find(row=>row.kiem_duyet_id===this.values.id).ket_qua_snapshot=this.values.snapshot;
      }
      return {recordset:[]};
    }
  }
  class Transaction{
    async begin(){this.snapshot={row:copy(state.row),reviews:state.reviews.map(x=>({...x}))};}
    request(){return new Request();}
    async commit(){state.commits++;}
    async rollback(){state.row=this.snapshot.row;state.reviews=this.snapshot.reviews;state.rollbacks++;}
  }
  const pool={request:()=>new Request()};
  return {state,model:createPostModel({getPool:async()=>pool,sql:{...sql,Transaction}})};
}
test('model list/detail chuyển Buffer SQL thành cùng token JSON, activation pending trả 409 thay vì input 400',async()=>{
  const {model}=databaseFixture();const list=await model.list({owner:1});const detail=await model.detail(7,{owner:1});
  assert.equal(list[0].row_version,expected);assert.equal(detail.row_version,expected);
  const body=JSON.parse(JSON.stringify(detail));assert.equal(typeof body.row_version,'string');assert.equal(version(body.row_version),expected);
  await assert.rejects(model.activate({owner:1,postId:7,input:validateActivation(schedule(body.row_version))}),{status:409,code:'POST_CONFLICT'});
});
test('model dùng cùng encoder khi đọc khóa: duyệt thành công, bản cũ trả 409, bản mới kích hoạt đúng phiên',async()=>{
  const {model,state}=databaseFixture();const before=await model.detail(7,{admin:true});
  await model.review({admin:2,postId:7,input:validateReview({quyet_dinh:'phe_duyet',ly_do:'Đã kiểm tra bằng chứng ấn bản',xac_nhan_quy_hiem:true,row_version:before.row_version})});
  const after=await model.detail(7,{owner:1});assert.notEqual(after.row_version,before.row_version);assert.equal(after.row_version,'00000000000000AC');
  await assert.rejects(model.review({admin:2,postId:7,input:validateReview({quyet_dinh:'phe_duyet',ly_do:'Thử lại bản cũ',xac_nhan_quy_hiem:true,row_version:before.row_version})}),{status:409});
  await model.activate({owner:1,postId:7,input:validateActivation(schedule(after.row_version))});
  assert.equal(state.reviews.length,1);assert.equal(state.row.phien_dau_gia_id,11);assert.equal(state.row.trang_thai_phien,'da_kich_hoat');assert.equal(state.commits,2);
  assert.equal(JSON.parse(state.reviews[0].ket_qua_snapshot).review.ket_qua,'Phê duyệt');
});
test('model rollback cả quyết định và cặp trạng thái nếu lưu bản kết quả thất bại',async()=>{
  const {model,state}=databaseFixture();state.failSnapshot=true;
  await assert.rejects(model.review({admin:2,postId:7,input:validateReview({quyet_dinh:'tu_choi',ly_do:'Kiểm thử rollback',row_version:expected})}),/fixture snapshot failure/);
  assert.equal(state.commits,0);assert.equal(state.rollbacks,1);assert.equal(state.reviews.length,0);
  assert.equal(state.row.trang_thai_bai,'cho_kiem_duyet');assert.equal(state.row.trang_thai_phien,'cho_kiem_duyet');
  assert.equal(encodeRowVersion(state.row.row_version),expected);
});
test('HTTP dùng model thật với SQL Buffer: dữ liệu chi tiết đi qua activation/duyệt mà không mất row_version',async t=>{
  const {model,state}=databaseFixture();const authConfig=parseAuthConfig({SESSION_SECRET:'rowversion-regression-'.repeat(4)});
  const sessionMiddleware=createSessionMiddleware(authConfig,new session.MemoryStore());
  const rows=[{nguoi_dung_id:1,ho_ten:'Seller',email:'seller@example.test',vai_tro:'nguoi_dung'},{nguoi_dung_id:2,ho_ten:'Admin',email:'admin@example.test',vai_tro:'admin'}];
  const users={findById:async id=>rows.find(x=>x.nguoi_dung_id===id),findByEmail:async email=>rows.find(x=>x.email===email)};
  const authRouter=createAuthRouter({authConfig,sessionMiddleware,users,passwords:{verify:async()=>true},limiter:{consume:async()=>0}});
  const service=createPostService({model,ledger:{},limits:{}});
  const postRouter=createPostRouter({sessionMiddleware,users,model,service,limits:{}});
  const server=createServer(createApp({config:{mode:'development',origins:[],probeToken:'test'},deps:{},probes:{},authRouter,postRouter}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const base=`http://127.0.0.1:${server.address().port}/api`;
  function client(){return {cookie:'',token:'',async call(path,body){const reply=await fetch(base+path,{method:body?'POST':'GET',headers:{...(this.cookie?{cookie:this.cookie}:{}),...(body?{'Content-Type':'application/json','x-csrf-token':this.token}:{})},body:body?JSON.stringify(body):undefined});for(const c of reply.headers.getSetCookie())if(c.startsWith('bookauction.sid='))this.cookie=c.split(';')[0];const data=await reply.json();if(data.csrfToken)this.token=data.csrfToken;return{status:reply.status,data};},async login(email){await this.call('/auth/csrf');assert.equal((await this.call('/auth/login',{email,mat_khau:'regression test password'})).status,200);}};}
  const seller=client(),admin=client();await seller.login('seller@example.test');await admin.login('admin@example.test');
  const detail=await seller.call('/posts/7');assert.equal(detail.data.row_version,expected);
  const early=await seller.call('/posts/7/activate',schedule(detail.data.row_version));assert.equal(early.status,409);assert.equal(early.data.error,'POST_CONFLICT');
  const approved=await admin.call('/posts/7/review',{quyet_dinh:'phe_duyet',ly_do:'Đã đối chiếu bằng chứng quý hiếm',xac_nhan_quy_hiem:true,row_version:detail.data.row_version});assert.equal(approved.status,200);
  const current=await seller.call('/posts/7');assert.equal(current.data.row_version,'00000000000000AC');
  const stale=await seller.call('/posts/7/activate',schedule(detail.data.row_version));assert.equal(stale.status,409);
  const activated=await seller.call('/posts/7/activate',schedule(current.data.row_version));assert.equal(activated.status,200);assert.equal(state.row.phien_dau_gia_id,11);
});
