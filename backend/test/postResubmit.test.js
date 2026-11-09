/** SQL adapter có transaction fixture: chạy model thật, không giả danh SQL Server. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPostModel} from '../src/models/post.model.js';
import {validatePost} from '../src/services/postValidation.js';
import {inputHash} from '../src/ai/input.js';
const version='0000000000000001';
const body=()=>({sach:{ten_sach:'Tên sách đã sửa',tac_gia:'Tác giả',the_loai:'Văn học cổ điển',nha_xuat_ban:'NXB mới',nam_xuat_ban:2020,isbn:null,mo_ta:'Mô tả mới '.repeat(600)},bai_dang:{tieu_de:'Bản sửa',mo_ta_tinh_trang:'Bìa có vết xước, ảnh mới để đối chiếu'},phien:{gia_khoi_diem:'100000',gia_toi_thieu:'300000',buoc_gia:'1000'},media:[],row_version:version,remove_media:[{kind:'image',id:1},{kind:'video',id:1}]});
function fixture(){
 const state={book:{ten_sach:'Tên cũ',tac_gia:'Tác giả cũ',the_loai:'Văn học cổ điển',nha_xuat_ban:'NXB cũ',nam_xuat_ban:2000,isbn:'000-old',tinh_trang_sach:'Bìa cũ',mo_ta:'Mô tả cũ'},profile:null,
  post:{bai_dang_id:7,sach_id:3,nguoi_dung_id:1,ma_san_pham:'fixture',tieu_de:'Bài cũ',mo_ta_tinh_trang:'Bìa cũ',trang_thai_bai:'tu_choi',trang_thai_phien:'khong_dat_kiem_duyet',phien_dau_gia_id:9,row_version:version},
  reviews:[{kiem_duyet_id:1,ket_qua:'Từ chối',phan_hoi_admin:'Cần sửa ISBN và ảnh',ngay_kiem_duyet:'2026-10-30T00:00:00Z'}],snapshots:{},media:[{id:1,kind:'image',url:'https://res.cloudinary.com/demo/image/upload/old.jpg',title:'Ảnh cũ',active:true,order:1,publicId:'old-image'},...Array.from({length:3},(_,i)=>({id:i+1,kind:'video',url:`https://res.cloudinary.com/demo/video/upload/${i}.mp4`,title:'Video '+i,active:true,order:i+1,publicId:'video-'+i}))],history:[]};
 let commits=0,rollbacks=0;
 class Transaction{async begin(){this.data=structuredClone(state);}request(){return request(this.data);}async commit(){Object.assign(state,this.data);commits++;}async rollback(){rollbacks++;}}
 const project=data=>({...data.post,...(data.profile||data.book),trang_thai:data.post.trang_thai_bai,ho_so_sach:data.profile?JSON.stringify(data.profile):null,row_version:Buffer.from(data.post.row_version,'hex')});
 function request(data){const p={};return {input(key,type,value){p[key]=value;return this;},async query(q){
  if(q.startsWith('SELECT bai_dang_id,nguoi_dung_id'))return {recordset:[]};
  if(q.startsWith('INSERT dbo.Sach'))return {recordset:[{sach_id:3}]};
  if(q.startsWith('INSERT dbo.BaiDang')){
   data.profile=JSON.parse(p.profile);data.post.tieu_de=p.title;data.post.trang_thai_bai='cho_kiem_duyet';
   return {recordset:[{bai_dang_id:7}]};
  }
  if(q.startsWith('INSERT dbo.PhienDauGia')){data.post.trang_thai_phien='cho_kiem_duyet';return {recordset:[{phien_dau_gia_id:9}]};}
  if(q.includes('JOIN dbo.PhienDauGia p WITH'))return {recordset:p.id===7?[project(data)]:[]};
  if(q.includes('JOIN dbo.Sach s'))return {recordset:p.id===7?[project(data)]:[]};
  if(q.startsWith('UPDATE dbo.KiemDuyet')){if(!data.snapshots[p.id])data.snapshots[p.id]=p.snapshot;return {rowsAffected:[1]};}
  if(q.startsWith('SELECT ket_qua_snapshot'))return {recordset:p.post===7&&data.reviews.some(x=>x.kiem_duyet_id===p.id)?[{ket_qua_snapshot:data.snapshots[p.id]||null}]:[]};
  if(q.includes('FROM dbo.KiemDuyet'))return {recordset:data.reviews.map(x=>({...x,co_the_xuat:Boolean(data.snapshots[x.kiem_duyet_id])}))};
  if(q.includes('FROM dbo.PhanTichAI'))return {recordset:[]};
  if(q.includes('AS allowed'))return {recordset:[{allowed:0}]};
  const kind=q.includes('dbo.HinhAnh')?'image':q.includes('dbo.Video')?'video':null;
  if(q.includes('SELECT 1 AS moved')){
   const active=data.media.filter(x=>x.kind==='image'&&x.active);
   const first=active.find(x=>x.id===p.first),cover=active.find(x=>x.id===p.cover);
   if(!first||!cover)return {recordset:[{moved:0}]};
   [first.order,cover.order]=[cover.order,first.order];
   return {recordset:[{moved:1}]};
  }
  if(kind&&q.startsWith('UPDATE')){const found=data.media.find(x=>x.kind===kind&&x.id===p.media);if(found)found.active=false;return {};}
  if(kind&&q.startsWith('INSERT')){const all=data.media.filter(x=>x.kind===kind),id=Math.max(0,...all.map(x=>x.id))+1;data.media.push({id,kind,url:p.url,title:p.title,publicId:p.publicId,active:true,order:Math.max(0,...all.map(x=>x.order))+1});return {recordset:[{id}]};}
  if(kind)return {recordset:data.media.filter(x=>x.kind===kind&&x.active).sort((a,b)=>a.order-b.order).map(({active,order,...x})=>x)};
  if(q.startsWith('UPDATE dbo.BaiDang')){data.profile=JSON.parse(p.profile);data.post.tieu_de=p.title;data.post.mo_ta_tinh_trang=p.description;data.post.trang_thai_bai='cho_kiem_duyet';return {};}
  if(q.startsWith('UPDATE dbo.PhienDauGia')){data.post.trang_thai_phien='cho_kiem_duyet';data.post.row_version='0000000000000002';return {};}
  if(q.startsWith('INSERT dbo.LichSuDauGia')){data.history.push(p.action);return {};}
  assert.fail(q);
 }};}
 const pool={request:()=>request(state)},sql={Transaction,ISOLATION_LEVEL:{SERIALIZABLE:'SERIALIZABLE'},Int:'int',NVarChar:()=>'',VarChar:()=>'',DateTime2:()=>'',MAX:'max'};
 return {state,model:createPostModel({getPool:async()=>pool,sql}),commits:()=>commits,rollbacks:()=>rollbacks};
}
test('gửi lại sửa hồ sơ, gỡ ảnh/video và thay video đủ giới hạn; Sach/ảnh lịch sử/snapshot/hash cũ giữ nguyên',async()=>{
 const f=fixture(),before=await f.model.detail(7,{owner:1}),book=structuredClone(f.state.book),hash=inputHash(before);
 const input=validatePost(body(),{mode:'resubmit'});await f.model.resubmit({owner:1,postId:7,input,items:[{kind:'video',url:'https://res.cloudinary.com/demo/video/upload/new.mp4',title:'Video mới'}],limits:{maxVideos:3}});
 const after=await f.model.detail(7,{owner:1});assert.equal(after.ten_sach,input.book.ten_sach);assert.equal(after.isbn,null);assert.equal(after.mo_ta,input.book.mo_ta);assert.notEqual(inputHash(after),hash);assert.deepEqual(f.state.book,book);
 assert.equal(after.sach_id,before.sach_id);assert.equal(after.trang_thai_phien,'cho_kiem_duyet');assert.equal(after.media.length,3);assert(after.media.every(x=>x.kind==='video'));assert(f.state.media.find(x=>x.publicId==='old-image'));assert.equal(f.state.media.at(-1).order,4);
 const old=await f.model.exportReview(1,7,1);assert.equal(old.book.ten_sach,book.ten_sach);assert.equal(old.book.isbn,book.isbn);assert.equal(old.media.length,4);assert(old.media.some(x=>x.url.endsWith('old.jpg')));assert.equal(f.commits(),2);
});
test('quyền, trạng thái/version, media giả hoặc vượt video đều rollback cả hồ sơ và snapshot legacy',async()=>{
 for(const variant of ['owner','version','state','foreign-media','video-limit','genre']){
  const f=fixture(),data=body();let owner=1,items=[];
  if(variant==='owner')owner=2;if(variant==='version')data.row_version='0000000000000099';if(variant==='state')f.state.post.trang_thai_phien='da_kich_hoat';
  if(variant==='foreign-media')data.remove_media=[{kind:'image',id:99}];
  if(variant==='video-limit'){data.remove_media=[];items=[{kind:'video',url:'https://res.cloudinary.com/demo/video/upload/new.mp4'}];}
  if(variant==='genre')data.sach.the_loai='Tự chèn thể loại';
  const before=structuredClone(f.state);await assert.rejects(f.model.resubmit({owner,postId:7,input:validatePost(data,{mode:'resubmit'}),items,limits:{maxVideos:3}}),{code:variant==='owner'?'POST_NOT_FOUND':variant==='video-limit'?'MEDIA_COUNT':'POST_CONFLICT'});assert.deepEqual(f.state,before,variant);assert.equal(f.commits(),0);assert.equal(f.rollbacks(),1);
 }
});
test('client cũ gửi lại không có sach/remove_media giữ hồ sơ và toàn bộ media',async()=>{
 const f=fixture(),data=body();delete data.sach;delete data.remove_media;await f.model.resubmit({owner:1,postId:7,input:validatePost(data,{mode:'resubmit'}),items:[],limits:{maxVideos:3}});
 assert.deepEqual(f.state.profile,f.state.book);assert(f.state.media.every(x=>x.active));
});
test('gửi duyệt lại dùng ảnh chính đã chọn nhưng bản kiểm duyệt trước vẫn giữ ảnh đầu cũ',async()=>{
 for(const isUpload of [false,true]){
  const f=fixture(),data=body(),upload_id='00000000-0000-4000-8000-000000000001';
  const next={kind:'image',url:'https://res.cloudinary.com/demo/image/upload/cover.jpg',title:'Ảnh chính'};
  data.remove_media=[];let items=[];
  if(isUpload){data.media=[{upload_id}];data.cover_image={upload_id};items=[{...next,uploadId:upload_id}];}
  else{data.cover_image={id:2};f.state.media.push({...next,id:2,active:true,order:2});}
  await f.model.resubmit({owner:1,postId:7,input:validatePost(data,{mode:'resubmit'}),items,limits:{maxVideos:3}});
  const after=await f.model.detail(7,{owner:1});
  assert.equal(after.media[0].url,next.url);
  assert.equal(after.media[1].id,1);
  assert.equal((await f.model.exportReview(1,7,1)).media[0].url,'https://res.cloudinary.com/demo/image/upload/old.jpg');
 }
});
test('bài mới lưu ảnh được chọn trước ảnh tải lên đầu tiên',async()=>{
 const f=fixture(),data=body();f.state.media=[];f.state.reviews=[];
 delete data.row_version;delete data.remove_media;
 data.ma_yeu_cau='00000000-0000-4000-8000-000000000001';
 const uploadIds=['00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003'];
 data.media=uploadIds.map(upload_id=>({upload_id}));data.cover_image={upload_id:uploadIds[1]};
 const items=uploadIds.map((uploadId,i)=>({uploadId,kind:'image',url:`https://res.cloudinary.com/demo/image/upload/${i}.jpg`}));
 await f.model.create({owner:1,input:validatePost(data),items,limits:{maxVideos:3},code:'fixture-new'});
 assert.deepEqual((await f.model.detail(7,{owner:1})).media.map(x=>x.url),[items[1].url,items[0].url]);
});
test('hợp đồng gỡ media kiểm tra loại/ID/trùng/chèn trường và chỉ nhận ở resubmit',()=>{
 for(const removed of [null,{},[{kind:'other',id:1}],[{kind:'image',id:0}],[{kind:'image',id:1,url:'https://evil.test'}],[{kind:'image',id:1},{kind:'image',id:1}]])assert.throws(()=>validatePost({...body(),remove_media:removed},{mode:'resubmit'}),{status:400});
 const data=body();delete data.remove_media;data.ma_yeu_cau='00000000-0000-4000-8000-000000000001';assert.throws(()=>validatePost({...data,remove_media:[]}),{status:400});
});

test('HTTP gửi lại: session/CSRF/owner/state guard, hồ sơ mới không tự gọi AI',async t=>{
 const [{createServer},{default:session},{createApp},{createAuthRouter},{createPostRouter},{createPostService},{createSessionMiddleware},{parseAuthConfig}]=await Promise.all([
  import('node:http'),import('express-session'),import('../src/app.js'),import('../src/routes/auth.routes.js'),import('../src/routes/post.routes.js'),import('../src/services/post.service.js'),import('../src/middlewares/session.js'),import('../src/config/auth.js')]);
 const f=fixture(),rows=[1,2,3].map(id=>({nguoi_dung_id:id,email:`r${id}@example.test`,ho_ten:'Fixture',vai_tro:id===3?'admin':'nguoi_dung'})),users={findById:async id=>rows.find(x=>x.nguoi_dung_id===id),findByEmail:async email=>rows.find(x=>x.email===email)},authConfig=parseAuthConfig({SESSION_SECRET:'resubmit-http-fixture-'.repeat(4)}),sessionMiddleware=createSessionMiddleware(authConfig,new session.MemoryStore());
 let enqueued=0,bound=0,released=0;
 const service=createPostService({model:f.model,limits:{maxVideos:3},ledger:{claim:async()=>({items:[]}),bound:async()=>{bound++;},release:async()=>{released++;}},enqueueAi:async()=>{enqueued++;}});
 const authRouter=createAuthRouter({authConfig,sessionMiddleware,users,passwords:{verify:async()=>true},limiter:{consume:async()=>0}}),postRouter=createPostRouter({sessionMiddleware,users,model:f.model,service,limits:{maxVideos:3}});
 const server=createServer(createApp({config:{mode:'development',origins:[],probeToken:'fixture'},deps:{},probes:{},authRouter,postRouter}));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
 const base=`http://127.0.0.1:${server.address().port}/api`;
 function client(){return {cookie:'',token:'',async call(path,method='GET',data,token=this.token){const response=await fetch(base+path,{method,headers:{cookie:this.cookie,'x-csrf-token':token,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});for(const cookie of response.headers.getSetCookie())if(cookie.startsWith('bookauction.sid='))this.cookie=cookie.split(';')[0];const json=await response.json();if(json.csrfToken)this.token=json.csrfToken;return {status:response.status,data:json};},async login(id){await this.call('/auth/csrf');assert.equal((await this.call('/auth/login','POST',{email:`r${id}@example.test`,mat_khau:'fixture-password'})).status,200);}};}
 const guest=client(),owner=client(),other=client(),admin=client();assert.equal((await guest.call('/posts/7/resubmit','POST',body())).status,401);await owner.login(1);await other.login(2);await admin.login(3);
 assert.equal((await admin.call('/posts/7/resubmit','POST',body())).status,403);assert.equal((await other.call('/posts/7/resubmit','POST',body())).status,404);assert.equal((await owner.call('/posts/7/resubmit','POST',body(),'')).status,403);
 const bad=body();bad.remove_media=[{kind:'image',id:99}];assert.equal((await owner.call('/posts/7/resubmit','POST',bad)).status,409);assert.equal(enqueued,0);assert(released>=2);
 const response=await owner.call('/posts/7/resubmit','POST',body());assert.equal(response.status,200);assert.equal(enqueued,0);assert.equal(bound,1);
 const read=await owner.call('/posts/7');assert.equal(read.data.ten_sach,body().sach.ten_sach);assert.equal(read.data.isbn,null);assert.equal(read.data.media.length,2);assert.equal(read.data.ai,null);assert.equal(read.data.kiem_duyet[0].co_the_xuat,true);
 assert.equal((await owner.call('/posts/7/resubmit','POST',body())).status,409);assert.equal(enqueued,0);
});
