/** Kiểm tra hợp đồng, quyền HTTP và ranh giới commit SQL/claim media; không giả danh SQL thật. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import session from 'express-session';
import {createApp} from '../src/app.js';
import {createPostRouter} from '../src/routes/post.routes.js';
import {createMediaRouter} from '../src/routes/media.routes.js';
import {createAuthRouter} from '../src/routes/auth.routes.js';
import {createSessionMiddleware} from '../src/middlewares/session.js';
import {parseAuthConfig} from '../src/config/auth.js';
import {parseMediaConfig} from '../src/config/media.js';
import {validatePost,validateReview,validateActivation} from '../src/services/postValidation.js';
import {canRelist,assertStatePair,assertVersion,assertVideoLimit} from '../src/services/postPolicy.js';
import {createPostService} from '../src/services/post.service.js';
import {publicPost} from '../src/controllers/post.controller.js';
import {createCloudinary,verifyMedia} from '../src/services/cloudinary.service.js';
const version='0000000000000001';
const payload=()=>({ma_yeu_cau:randomUUID(),sach:{ten_sach:'Bản sách thử',tinh_trang_sach:'Bìa sờn'},bai_dang:{tieu_de:'Ấn bản đầu',mo_ta_tinh_trang:'Thông tin và nguồn đối chiếu'},phien:{gia_khoi_diem:'100000',gia_toi_thieu:'999999999999999999',buoc_gia:'1000'},media:[]});
const mediaConfig=parseMediaConfig({CLOUDINARY_CLOUD_NAME:'demo',CLOUDINARY_API_KEY:'testkey',CLOUDINARY_API_SECRET:'testsecret'});
test('tiền 18 chữ số giữ chính xác; từ chối number, thập phân, trường trạng thái/lịch/URL tự chèn',()=>{
  assert.equal(validatePost(payload()).prices.gia_toi_thieu,'999999999999999999');
  for(const value of [100000,'1.5','-1','01','1e5','1000000000000000000']){
    const body=payload();body.phien.gia_khoi_diem=value;assert.throws(()=>validatePost(body));
  }
  for(const [key,value] of [['trang_thai','da_duyet'],['thoi_gian_bat_dau',new Date().toISOString()],['url','https://example.test']]){
    assert.throws(()=>validatePost({...payload(),[key]:value}));
  }
  const body=payload();body.phien.gia_toi_thieu='1';assert.throws(()=>validatePost(body));
  body.phien.gia_toi_thieu='100000';body.phien.thoi_gian_cho_dat_lai=31;assert.throws(()=>validatePost(body));
});
test('không sửa sách dùng trong lịch sử khi đăng lại; reject vé media lặp và giới hạn dài',()=>{
  assert.throws(()=>validatePost(payload(),{mode:'relist'}),/Sách/);
  const body=payload();const upload_id=randomUUID();body.media=[{upload_id},{upload_id}];assert.throws(()=>validatePost(body),/lặp/);
  body.media=[];body.sach.ten_sach='x'.repeat(301);assert.throws(()=>validatePost(body));
  const relist=payload();delete relist.sach;relist.reuse_media=true;assert.equal(validatePost(relist,{mode:'relist'}).reuseMedia,true);
});
test('Admin phải ghi lý do và xác nhận kiểm tra yếu tố quý hiếm khi duyệt; lịch cần múi giờ',()=>{
  assert.throws(()=>validateReview({quyet_dinh:'phe_duyet',ly_do:'Bìa đẹp',row_version:version}));
  assert.throws(()=>validateReview({quyet_dinh:'tu_choi',ly_do:'  ',row_version:version}));
  assert.equal(validateReview({quyet_dinh:'tu_choi',ly_do:'Cần bằng chứng ấn bản',row_version:version}).decision,'tu_choi');
  assert.throws(()=>validateActivation({thoi_gian_bat_dau:'2026-12-01T10:00',thoi_gian_ket_thuc:'2026-12-02T10:00',row_version:version}));
  assert.throws(()=>validateActivation({thoi_gian_bat_dau:'2026-12-02T10:00:00Z',thoi_gian_ket_thuc:'2026-12-01T10:00:00Z',row_version:version}));
  assert.equal(validateActivation({thoi_gian_bat_dau:'2026-12-01T10:00:00+07:00',thoi_gian_ket_thuc:'2026-12-02T10:00:00+07:00',row_version:version}).start.toISOString(),'2026-12-01T03:00:00.000Z');
});
test('chỉ phiên cuối đã kết thúc có kết quả rõ không người thắng mới được đăng lại',()=>{
  const input={sourceId:1,latestId:1,state:'da_ket_thuc',outcome:{trang_thai:'khong_co_nguoi_thang',nguoi_thang_dau_id:null}};
  assert(canRelist(input));
  for(const patch of [{latestId:2},{state:'da_kich_hoat'},{outcome:null},{outcome:{trang_thai:'co_nguoi_thang',nguoi_thang_dau_id:2}},{outcome:{trang_thai:'khong_co_nguoi_thang',nguoi_thang_dau_id:2}}])assert.equal(canRelist({...input,...patch}),false);
});
test('cặp trạng thái và phiên bản cũ bị chặn trước khi cập nhật',()=>{
  const row={trang_thai:'da_duyet',trang_thai_phien:'da_qua_kiem_duyet',row_version:version};
  assert.doesNotThrow(()=>assertStatePair(row,'da_duyet','da_qua_kiem_duyet','Sai'));
  assert.throws(()=>assertStatePair({...row,trang_thai_phien:'cho_kiem_duyet'},'da_duyet','da_qua_kiem_duyet','Sai'),{status:409});
  assert.throws(()=>assertVersion(row,'0000000000000002'),{status:409});
});
test('projection công khai không đưa giá kết thúc sớm, owner/email hay kết quả nội bộ ra ngoài',()=>{
  const result=publicPost({gia_toi_thieu:'999999999999999999',email:'secret',nguoi_dung_id:3,ai:{},row_version:version,gia_khoi_diem:'1000',media:[]});
  assert.deepEqual(result,{gia_khoi_diem:'1000',media:[]});
});
test('claim media chỉ release khi rollback chắc chắn; lỗi acknowledgement sau commit không báo thất bại',async()=>{
  for(const rolledBack of [true,false]){
    let releases=0;const error=Object.assign(new Error('SQL failure'),{sqlRolledBack:rolledBack});
    const service=createPostService({model:{findRequest:async()=>null,create:async()=>{throw error;}},ledger:{claim:async()=>({items:[]}),release:async()=>{releases++;}},limits:mediaConfig});
    await assert.rejects(service.create(1,validatePost(payload())));assert.equal(releases,rolledBack?1:0);
  }
  const service=createPostService({model:{findRequest:async()=>null,create:async()=>({id:7})},ledger:{claim:async()=>({items:[]}),bound:async()=>{throw Error('Redis disconnected');}},limits:mediaConfig});
  assert.deepEqual(await service.create(1,validatePost(payload())),{id:7});
});
test('retry mã đã commit không claim lại vé đã dùng; đua idempotency không làm mất vé chưa gắn',async()=>{
  const service=createPostService({model:{findRequest:async()=>7},ledger:{claim:()=>{throw Error('Must not claim');}},limits:mediaConfig});
  assert.deepEqual(await service.create(1,validatePost(payload())),{id:7,replayed:true});
  let released=0,bound=0;
  const concurrent=createPostService({model:{findRequest:async()=>null,create:async()=>({id:8,replayed:true})},ledger:{claim:async()=>({items:[]}),release:async()=>{released++;},bound:async()=>{bound++;}},limits:mediaConfig});
  await concurrent.create(1,validatePost(payload()));assert.equal(released,1);assert.equal(bound,0);
});
test('nhận diện ảnh/video theo magic bytes; Cloudinary REST không lộ secret, kiểm tra URL/public_id và destroy idempotent',async()=>{
  assert.doesNotThrow(()=>verifyMedia(Buffer.from([255,216,255,0]),'image/jpeg','image'));
  assert.throws(()=>verifyMedia(Buffer.from('not an image'),'image/jpeg','image'),{status:415});
  assert.doesNotThrow(()=>verifyMedia(Buffer.from([26,69,223,163]),'video/webm','video'));
  const publicId='bookauction/1/test';let calls=0;
  const provider=createCloudinary({config:mediaConfig,fetchImpl:async(url,options)=>{
    calls++;assert(url.startsWith('https://api.cloudinary.com/v1_1/demo/'));assert(!url.includes('testsecret'));
    assert(options.headers.Authorization.startsWith('Basic '));
    if(url.endsWith('/destroy'))return {ok:true,json:async()=>({result:'not found'})};
    assert.equal(options.body.get('overwrite'),'false');return {ok:true,json:async()=>({public_id:publicId,resource_type:'image',secure_url:'https://res.cloudinary.com/demo/image/upload/test.jpg'})};
  }});
  assert.equal((await provider.upload({kind:'image',publicId,bytes:Buffer.from([255,216,255]),mime:'image/jpeg'})).publicId,publicId);
  await provider.destroy({kind:'image',publicId});assert.equal(calls,2);
  const bad=createCloudinary({config:mediaConfig,fetchImpl:async()=>({ok:true,json:async()=>({public_id:publicId,resource_type:'image',secure_url:'https://evil.test/a'})})});
  await assert.rejects(bad.upload({kind:'image',publicId,bytes:Buffer.from('x'),mime:'image/jpeg'}),{status:502});
  const unavailable=createCloudinary({config:mediaConfig,fetchImpl:async()=>{throw Error('testsecret');}});
  await assert.rejects(unavailable.destroy({kind:'image',publicId}),error=>!error.message.includes('testsecret'));
});
async function serverFixture(t,{providerUpload,mediaOverrides={}}={}){
  const authConfig=parseAuthConfig({SESSION_SECRET:'tests-only-'.repeat(8)});
  const sessionMiddleware=createSessionMiddleware(authConfig,new session.MemoryStore());
  const rows=[{nguoi_dung_id:1,ho_ten:'A',email:'a@example.test',vai_tro:'nguoi_dung'},{nguoi_dung_id:2,ho_ten:'Admin',email:'admin@example.test',vai_tro:'admin'}];
  const users={findById:async id=>rows.find(x=>x.nguoi_dung_id===id),findByEmail:async email=>rows.find(x=>x.email===email)};
  let writes=0,uploads=0;
  const model={list:async()=>[{bai_dang_id:7,gia_toi_thieu:'secret',gia_khoi_diem:'10'}],detail:async()=>({bai_dang_id:7,gia_toi_thieu:'secret',gia_khoi_diem:'10'})};
  const service={create:async()=>{writes++;return {id:7};},review:async()=>{writes++;return {id:7};}};
  const authRouter=createAuthRouter({authConfig,sessionMiddleware,users,passwords:{verify:async()=>true},limiter:{consume:async()=>0}});
  const postRouter=createPostRouter({sessionMiddleware,users,model,service,limits:mediaConfig});
  const mediaRouter=createMediaRouter({sessionMiddleware,users,config:{...mediaConfig,...mediaOverrides},provider:{upload:async()=>{uploads++;if(providerUpload)return providerUpload();return {url:'https://res.cloudinary.com/demo/image/upload/x.png'};}},ledger:{begin:async()=>({publicId:'test'}),ready:async()=>({upload_id:randomUUID()})}});
  const server=createServer(createApp({config:{origins:[],mode:'development',probeToken:'x'},deps:{},probes:{},authRouter,postRouter,mediaRouter}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const base=`http://127.0.0.1:${server.address().port}`;
  function client(){return {cookie:'',token:'',async call(path,method='GET',body,csrf=this.token,mime){const r=await fetch(base+'/api'+path,{method,headers:{...(this.cookie?{cookie:this.cookie}:{}),...(csrf?{'x-csrf-token':csrf}:{}),...(body?{'Content-Type':mime||'application/json'}:{})},body:body?(mime?body:JSON.stringify(body)):undefined});for(const c of r.headers.getSetCookie())if(c.startsWith('bookauction.sid='))this.cookie=c.split(';')[0];const data=await r.json();if(data.csrfToken)this.token=data.csrfToken;return {status:r.status,data};},async login(email){await this.call('/auth/csrf');assert.equal((await this.call('/auth/login','POST',{email,mat_khau:'test password'})).status,200);}};}
  return {client,writes:()=>writes,uploads:()=>uploads};
}
test('HTTP M4: công khai lọc giá ẩn; API riêng yêu cầu login, vai trò hiện tại và CSRF',async t=>{
  const fixture=await serverFixture(t);const anonymous=fixture.client();
  assert.equal((await anonymous.call('/posts/mine')).status,401);
  assert(!JSON.stringify((await anonymous.call('/posts/catalog')).data).includes('gia_toi_thieu'));
  assert(!JSON.stringify((await anonymous.call('/posts/catalog/7')).data).includes('secret'));
  const user=fixture.client();await user.login('a@example.test');const admin=fixture.client();await admin.login('admin@example.test');
  assert.equal((await user.call('/posts/pending')).status,403);
  assert.equal((await admin.call('/posts/pending')).status,200);
  assert.equal((await admin.call('/posts','POST',payload())).status,403);
  assert.equal((await user.call('/posts/7/review','POST',{})).status,403);
  assert.equal((await user.call('/posts','POST',payload(),'')).status,403);
  assert.equal(fixture.writes(),0);
  assert.equal((await user.call('/posts','POST',payload())).status,201);assert.equal(fixture.writes(),1);
});
test('HTTP upload: chặn chưa login, CSRF, MIME giả, magic sai trước khi gửi provider',async t=>{
  const fixture=await serverFixture(t);const c=fixture.client();const bytes=Buffer.from([255,216,255,1]);
  assert.equal((await c.call('/media/image','POST',bytes,'','image/jpeg')).status,401);
  await c.login('a@example.test');
  assert.equal((await c.call('/media/image','POST',bytes,'','image/jpeg')).status,403);
  assert.equal((await c.call('/media/image','POST',bytes,c.token,'text/html')).status,415);
  assert.equal((await c.call('/media/image','POST',Buffer.from('bad'),c.token,'image/jpeg')).status,415);
  assert.equal(fixture.uploads(),0);
  assert.equal((await c.call('/media/image','POST',bytes,c.token,'image/jpeg')).status,201);assert.equal(fixture.uploads(),1);
});

test('HTTP upload: body quá lớn trả 413 và giải phóng slot; cấu hình công khai không chứa credentials',async t=>{
  const fixture=await serverFixture(t,{mediaOverrides:{imageMaxBytes:8}});const c=fixture.client();await c.login('a@example.test');
  const oversized=Buffer.alloc(16);oversized.set([255,216,255]);
  assert.equal((await c.call('/media/image','POST',oversized,c.token,'image/jpeg')).status,413);assert.equal(fixture.uploads(),0);
  assert.equal((await c.call('/media/image','POST',Buffer.from([255,216,255,0]),c.token,'image/jpeg')).status,201);
  const config=await c.call('/media/config');assert.equal(config.status,200);assert.equal(config.data.imageMaxBytes,8);
  for(const key of ['apiSecret','apiKey','CLOUDINARY_API_SECRET'])assert(!JSON.stringify(config.data).includes(key));
});
test('HTTP upload: chưa cấu hình provider trả 503 trước khi nhận tệp hoặc gọi Cloudinary',async t=>{
  const fixture=await serverFixture(t,{mediaOverrides:{configured:false}});const c=fixture.client();await c.login('a@example.test');
  assert.equal((await c.call('/media/image','POST',Buffer.from([255,216,255]),c.token,'image/jpeg')).status,503);assert.equal(fixture.uploads(),0);
});
test('HTTP upload: chỉ hai provider call đồng thời, request thứ ba bị chặn',async t=>{
  let started=0;let ready;let finish;
  const bothStarted=new Promise(resolve=>{ready=resolve;});const pending=new Promise(resolve=>{finish=resolve;});
  const fixture=await serverFixture(t,{providerUpload:async()=>{if(++started===2)ready();await pending;return{url:'https://res.cloudinary.com/demo/image/upload/x.png'};}});
  const c=fixture.client();await c.login('a@example.test');const bytes=Buffer.from([255,216,255,0]);
  const first=c.call('/media/image','POST',bytes,c.token,'image/jpeg');const second=c.call('/media/image','POST',bytes,c.token,'image/jpeg');
  try {await bothStarted;assert.equal((await c.call('/media/image','POST',bytes,c.token,'image/jpeg')).status,429);}
  finally{finish();}
  assert.equal((await first).status,201);assert.equal((await second).status,201);assert.equal(started,2);
});

test('listing images have no count cap; videos still include reused media in their limit',()=>{
 const config=parseMediaConfig({MEDIA_MAX_IMAGES:'12'});assert.equal(config.maxImages,null);assert.equal(config.maxVideos,3);
 const body=payload();body.media=Array.from({length:100},()=>({upload_id:randomUUID()}));assert.equal(validatePost(body,config).media.length,100);
 const images=body.media.map(()=>({kind:'image'}));assert.doesNotThrow(()=>assertVideoLimit([...images,...Array.from({length:3},()=>({kind:'video'}))],3));
 assert.throws(()=>assertVideoLimit([...images,...Array.from({length:4},()=>({kind:'video'}))],3),{status:400,code:'MEDIA_COUNT'});
 body.sach.isbn=null;assert.equal(validatePost(body).book.isbn,null);body.sach.isbn='123';assert.throws(()=>validatePost(body),{status:400});
});
