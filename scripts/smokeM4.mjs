/** Smoke M4 với SQL/Redis/API/Cloudinary thật, chỉ tạo/dọn dữ liệu mang UUID riêng của lần chạy. */
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {config} from '../backend/src/config/env.js';
import {getPool,closeDatabase,sql} from '../backend/src/config/database.js';
import {createPostModel} from '../backend/src/models/post.model.js';
import {validatePost} from '../backend/src/services/postValidation.js';
import {createUserModel} from '../backend/src/models/user.model.js';
import {passwords} from '../backend/src/services/password.service.js';
import {parseMediaConfig} from '../backend/src/config/media.js';
import {createCloudinary} from '../backend/src/services/cloudinary.service.js';
const base=`http://${config.host}:${config.port}`;
const runId=randomUUID();const secret=randomBytes(24).toString('base64url');const accounts=[];const assets=[];
let passed=false;let stage='kiểm tra cấu hình';let pool;
class Client {
  cookie='';token='';
  async call(path,method='GET',body,{csrf=true,mime}={}) {
    const response=await fetch(base+'/api'+path,{method,headers:{...(this.cookie?{cookie:this.cookie}:{}),...(csrf&&this.token?{'x-csrf-token':this.token}:{}),...(body?{'Content-Type':mime||'application/json'}:{})},body:body?(mime?body:JSON.stringify(body)):undefined,signal:AbortSignal.timeout(mime?150000:30000)});
    for(const cookie of response.headers.getSetCookie())if(cookie.startsWith('bookauction.sid='))this.cookie=cookie.split(';')[0];
    const data=response.status===204?null:await response.json();if(data?.csrfToken)this.token=data.csrfToken;
    return {status:response.status,data};
  }
  async login(email){assert.equal((await this.call('/auth/csrf')).status,200);assert.equal((await this.call('/auth/login','POST',{email,mat_khau:secret})).status,200);}
}
const check=(result,status)=>{assert.equal(result.status,status,`${stage}: HTTP ${result.status}, cần ${status} (${result.data?.error||''})`);return result.data;};
const body=()=>({ma_yeu_cau:randomUUID(),sach:{ten_sach:`SMOKE M4 ${runId}`,tinh_trang_sach:'Dữ liệu thử, không đưa ra giao dịch thật'},bai_dang:{tieu_de:`SMOKE M4 ${runId}`,mo_ta_tinh_trang:'Bằng chứng giả lập chỉ phục vụ kiểm tra phần mềm'},phien:{gia_khoi_diem:'100000',gia_toi_thieu:'999999999999999999',buoc_gia:'1000'},media:[]});
const provider=createCloudinary({config:parseMediaConfig(process.env)});
try {
  assert.equal(config.mode,'development','Chỉ chạy smoke M4 trong NODE_ENV=development.');
  assert(parseMediaConfig(process.env).configured,'Cần điền Cloudinary trong .env trước.');
  const alice=new Client(),bob=new Client(),admin=new Client();
  check(await alice.call('/health/ready'),200);
  pool=await getPool();const users=createUserModel({getPool,sql});const hash=await passwords.hash(secret);
  stage='tạo ba tài khoản thử riêng';
  for(const [label,role,client] of [['seller','nguoi_dung',alice],['other','nguoi_dung',bob],['reviewer','admin',admin]]) {
    const user=await users.create({ho_ten:`Smoke M4 ${label}`,email:`m4-${label}-${runId}@example.test`,passwordHash:hash,role});accounts.push(user);await client.login(user.email);
  }
  stage='rollback SQL khi bước gắn media thất bại';
  const rollbackInput=body();rollbackInput.sach.ten_sach=`ROLLBACK ${runId}`;
  const model=createPostModel({getPool,sql});
  await assert.rejects(model.create({owner:accounts[0].nguoi_dung_id,input:validatePost(rollbackInput),items:[{kind:'image',url:'https://example.test/never-committed.png'}],limits:{maxImages:0,maxVideos:0},code:`RB${runId.replaceAll('-','')}`}));
  const count=await pool.request().input('title',sql.NVarChar(300),rollbackInput.sach.ten_sach).query('SELECT COUNT(*) AS n FROM dbo.Sach WHERE ten_sach=@title');assert.equal(count.recordset[0].n,0);
  stage='upload PNG thật lên Cloudinary';
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPQDHUAAAFpAL/Yu1/IAAAAAElFTkSuQmCC','base64');
  const uploaded=check(await alice.call('/media/image','POST',png,{mime:'image/png'}),201);assets.push(uploaded);
  const input=body();input.media=[{upload_id:uploaded.upload_id,tieu_de:'Ảnh thử 1 pixel'}];
  stage='tạo và retry bài đăng';
  const created=check(await alice.call('/posts','POST',input),201);const postId=created.id;
  assert.equal(check(await alice.call('/posts','POST',input),200).id,postId);
  let detail=check(await alice.call(`/posts/${postId}`),200);const auctionId=detail.phien_dau_gia_id;const bookId=detail.sach_id;
  assert.equal(detail.trang_thai_bai,'cho_kiem_duyet');assert.equal(detail.trang_thai_phien,'cho_kiem_duyet');assert.equal(detail.thoi_gian_bat_dau,null);assert.equal(detail.thoi_gian_ket_thuc,null);assert.equal(detail.gia_toi_thieu,'999999999999999999');assert.equal(detail.ai,null);
  stage='quyền sở hữu, CSRF, không kích hoạt trước duyệt';
  check(await bob.call(`/posts/${postId}`),404);check(await alice.call('/posts/pending'),403);
  check(await alice.call('/posts','POST',body(),{csrf:false}),403);
  const schedule=()=>({thoi_gian_bat_dau:new Date(Date.now()+600000).toISOString(),thoi_gian_ket_thuc:new Date(Date.now()+3600000).toISOString(),row_version:detail.row_version});
  check(await alice.call(`/posts/${postId}/activate`,'POST',schedule()),409);
  check(await bob.call(`/posts/${postId}/activate`,'POST',schedule()),404);
  stage='Admin từ chối và chủ sách bổ sung';
  const oldVersion=detail.row_version;
  check(await admin.call(`/posts/${postId}/review`,'POST',{quyet_dinh:'phe_duyet',ly_do:'Kiểm tra thử',row_version:oldVersion}),400);
  check(await admin.call(`/posts/${postId}/review`,'POST',{quyet_dinh:'tu_choi',ly_do:'Bổ sung nguồn đối chiếu (smoke)',row_version:oldVersion}),200);
  detail=check(await alice.call(`/posts/${postId}`),200);assert.equal(detail.trang_thai_bai,'tu_choi');assert.equal(detail.trang_thai_phien,'khong_dat_kiem_duyet');
  const resubmit=body();delete resubmit.sach;delete resubmit.ma_yeu_cau;resubmit.row_version=detail.row_version;resubmit.reuse_media=true;
  check(await alice.call(`/posts/${postId}/resubmit`,'POST',resubmit),200);
  detail=check(await admin.call(`/posts/${postId}`),200);assert.equal(detail.phien_dau_gia_id,auctionId);assert.equal(detail.media.length,1);assert.equal(detail.kiem_duyet.length,1);
  stage='duyệt thủ công khi chưa tích hợp AI và chống dữ liệu cũ';
  check(await admin.call(`/posts/${postId}/review`,'POST',{quyet_dinh:'phe_duyet',ly_do:'Căn cứ smoke',xac_nhan_quy_hiem:true,row_version:oldVersion}),409);
  const reviewInput={quyet_dinh:'phe_duyet',ly_do:'Căn cứ giả lập để kiểm tra phần mềm; không phải thẩm định sách thật',xac_nhan_quy_hiem:true,row_version:detail.row_version};
  const reviews=await Promise.all([admin.call(`/posts/${postId}/review`,'POST',reviewInput),admin.call(`/posts/${postId}/review`,'POST',reviewInput)]);
  assert.deepEqual(reviews.map(x=>x.status).sort(),[200,409]);
  detail=check(await alice.call(`/posts/${postId}`),200);assert.equal(detail.trang_thai_bai,'da_duyet');assert.equal(detail.trang_thai_phien,'da_qua_kiem_duyet');assert.equal(detail.thoi_gian_bat_dau,null);
  stage='kích hoạt đúng phiên và không lộ ngưỡng giá';
  check(await alice.call(`/posts/${postId}/activate`,'POST',{...schedule(),thoi_gian_bat_dau:new Date(Date.now()-60000).toISOString()}),409);
  check(await alice.call(`/posts/${postId}/activate`,'POST',schedule()),200);
  check(await alice.call(`/posts/${postId}/activate`,'POST',schedule()),409);
  const publicDetail=check(await bob.call(`/posts/catalog/${postId}`),200);assert.equal(publicDetail.phien_dau_gia_id,auctionId);assert(!('gia_toi_thieu'in publicDetail));assert(!JSON.stringify(check(await bob.call('/posts/catalog'),200)).includes('gia_toi_thieu'));
  const relist=body();delete relist.sach;relist.reuse_media=true;
  check(await alice.call(`/posts/${postId}/relist`,'POST',relist),409);
  stage='fixture SQL riêng: kết thúc không người thắng rồi đăng lại';
  // This development fixture only touches the UUID-owned smoke auction; no manual-end HTTP API exists.
  await pool.request().input('id',sql.Int,auctionId).query("UPDATE dbo.PhienDauGia SET trang_thai='da_ket_thuc',thoi_gian_bat_dau=DATEADD(HOUR,-2,SYSUTCDATETIME()),thoi_gian_ket_thuc=DATEADD(HOUR,-1,SYSUTCDATETIME()) WHERE phien_dau_gia_id=@id; INSERT dbo.KetQuaDauGia(phien_dau_gia_id,trang_thai,thoi_gian_ket_thuc) VALUES(@id,'khong_co_nguoi_thang',DATEADD(HOUR,-1,SYSUTCDATETIME()))");
  const second=check(await alice.call(`/posts/${postId}/relist`,'POST',relist),201);
  const secondDetail=check(await alice.call(`/posts/${second.id}`),200);assert.equal(secondDetail.sach_id,bookId);assert.notEqual(secondDetail.phien_dau_gia_id,auctionId);assert.equal(secondDetail.trang_thai_phien,'cho_kiem_duyet');assert.equal(secondDetail.media.length,1);
  assert.equal(check(await alice.call(`/posts/${postId}`),200).trang_thai_phien,'da_ket_thuc');
  check(await alice.call(`/posts/${postId}/relist`,'POST',{...relist,ma_yeu_cau:randomUUID()}),409);
  stage='fixture SQL riêng: phiên cuối có người thắng thì không đăng lại';
  await pool.request().input('id',sql.Int,secondDetail.phien_dau_gia_id).input('winner',sql.Int,accounts[1].nguoi_dung_id).query("UPDATE dbo.PhienDauGia SET trang_thai='da_ket_thuc',thoi_gian_bat_dau=DATEADD(HOUR,-2,SYSUTCDATETIME()),thoi_gian_ket_thuc=DATEADD(HOUR,-1,SYSUTCDATETIME()) WHERE phien_dau_gia_id=@id; INSERT dbo.KetQuaDauGia(phien_dau_gia_id,nguoi_thang_dau_id,muc_gia_thang,trang_thai,thoi_gian_ket_thuc) VALUES(@id,@winner,100000,'co_nguoi_thang',DATEADD(HOUR,-1,SYSUTCDATETIME()))");
  check(await alice.call(`/posts/${second.id}/relist`,'POST',{...relist,ma_yeu_cau:randomUUID()}),409);
  passed=true;
} catch(error) {console.error(`FAIL M4 tại bước: ${stage}, run=${runId}.`,error.name==='AssertionError'?error.message:'Không hoàn tất yêu cầu; kiểm tra terminal API/SQL/Cloudinary.');process.exitCode=1;}
finally {
  if(accounts.length) {
    try {
      pool ||= await getPool();const tx=new sql.Transaction(pool);await tx.begin();
      try {
        const ids=accounts.map(x=>x.nguoi_dung_id);const req=new sql.Request(tx);
        ids.forEach((value,index)=>req.input(`u${index}`,sql.Int,value));
        const params=ids.map((_,index)=>`@u${index}`).join(',');
        const result=await req.query(`DECLARE @posts TABLE(id INT); DECLARE @auctions TABLE(id INT); DECLARE @books TABLE(id INT);
          INSERT @posts SELECT bai_dang_id FROM dbo.BaiDang WHERE nguoi_dung_id IN (${params});
          INSERT @auctions SELECT phien_dau_gia_id FROM dbo.PhienDauGia WHERE bai_dang_id IN(SELECT id FROM @posts);
          INSERT @books SELECT DISTINCT sach_id FROM dbo.BaiDang WHERE bai_dang_id IN(SELECT id FROM @posts);
          SELECT 'image' AS kind,cloudinary_public_id AS publicId FROM dbo.HinhAnh WHERE bai_dang_id IN(SELECT id FROM @posts) AND cloudinary_public_id IS NOT NULL
          UNION SELECT 'video',cloudinary_public_id FROM dbo.Video WHERE bai_dang_id IN(SELECT id FROM @posts) AND cloudinary_public_id IS NOT NULL;
          DELETE dbo.ChiTietPhanTichAI WHERE phan_tich_id IN(SELECT phan_tich_id FROM dbo.PhanTichAI WHERE bai_dang_id IN(SELECT id FROM @posts));
          DELETE dbo.PhanTichAI WHERE bai_dang_id IN(SELECT id FROM @posts);
          DELETE dbo.KiemDuyet WHERE bai_dang_id IN(SELECT id FROM @posts);
          DELETE dbo.HinhAnh WHERE bai_dang_id IN(SELECT id FROM @posts); DELETE dbo.Video WHERE bai_dang_id IN(SELECT id FROM @posts);
          DELETE dbo.LichSuDauGia WHERE phien_dau_gia_id IN(SELECT id FROM @auctions);
          DELETE dbo.KetQuaDauGia WHERE phien_dau_gia_id IN(SELECT id FROM @auctions);
          DELETE dbo.PhienDauGia WHERE phien_dau_gia_id IN(SELECT id FROM @auctions);
          DELETE dbo.BaiDang WHERE bai_dang_id IN(SELECT id FROM @posts);
          DELETE dbo.Sach WHERE sach_id IN(SELECT id FROM @books) AND NOT EXISTS(SELECT 1 FROM dbo.BaiDang b WHERE b.sach_id=dbo.Sach.sach_id);
          DELETE dbo.NguoiDung WHERE nguoi_dung_id IN(${params});`);
        await tx.commit();
        const all=new Map(result.recordset.map(item=>[item.publicId,item]));
        for(const item of assets)all.set(`bookauction/${accounts[0].nguoi_dung_id}/${item.upload_id}`,{kind:item.kind,publicId:`bookauction/${accounts[0].nguoi_dung_id}/${item.upload_id}`});
        for(const item of all.values())await provider.destroy(item);
      } catch(error){try{await tx.rollback();}catch{/* a committed SQL cleanup is never reversed */}throw error;}
      console.log('Đã dọn dữ liệu và media thử của lần chạy M4.');
    }catch{console.error(`Chưa dọn hoàn tất dữ liệu thử run=${runId}; tài khoản ID=${accounts.map(x=>x.nguoi_dung_id).join(',')}. Giữ thông tin này để đối soát, không xóa dữ liệu khác.`);process.exitCode=1;}
  }
  await closeDatabase();
}
if(passed&&!process.exitCode)console.log('PASS M4: upload Cloudinary, quyền/CSRF, tạo nguyên tử, retry, từ chối/bổ sung/duyệt, lịch kích hoạt, ẩn ngưỡng giá, đăng lại giữ sách và chặn có người thắng.');
