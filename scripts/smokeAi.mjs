/** Nghiệm thu AI thật: một bài không có ảnh, hai điểm NULL đúng nghĩa, Admin vẫn quyết định; dọn fixture riêng. */
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {config} from '../backend/src/config/env.js';
import {parseAiConfig} from '../backend/src/config/ai.js';
import {getPool,closeDatabase,sql} from '../backend/src/config/database.js';
import {createUserModel} from '../backend/src/models/user.model.js';
import {passwords} from '../backend/src/services/password.service.js';
const runId=randomUUID(),secret=randomBytes(24).toString('base64url'),base=`http://${config.host}:${config.port}/api`,accounts=[];
let pool,postId,stage='cấu hình',finished=false,cleanupSafe=true;
class Client{cookie='';token='';async call(path,method='GET',body){const response=await fetch(base+path,{method,headers:{cookie:this.cookie,'x-csrf-token':this.token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});for(const value of response.headers.getSetCookie())if(value.startsWith('bookauction.sid='))this.cookie=value.split(';')[0];const data=await response.json();if(data.csrfToken)this.token=data.csrfToken;assert(response.ok,`${stage}: HTTP ${response.status} (${data.error||''})`);return data;}}
try{
  assert.equal(config.mode,'development','Chỉ chạy smoke trong development.');assert(parseAiConfig(process.env).configured,'Cần AI_ENABLED=true và GEMINI_API_KEY trên máy; khởi động lại API/worker.');
  const seller=new Client(),admin=new Client();assert((await seller.call('/health/ready')).ok,'API/worker/SQL/Redis chưa sẵn sàng.');
  pool=await getPool();const users=createUserModel({getPool,sql}),hash=await passwords.hash(secret);
  for(const [label,role,client] of [['seller','nguoi_dung',seller],['admin','admin',admin]]){const user=await users.create({ho_ten:'AI smoke fixture',email:`ai-${label}-${runId}@example.test`,passwordHash:hash,role});accounts.push(user);await client.call('/auth/csrf');await client.call('/auth/login','POST',{email:user.email,mat_khau:secret});}
  stage='đăng bài và nhận job AI tự động';
  const created=await seller.call('/posts','POST',{ma_yeu_cau:randomUUID(),sach:{ten_sach:`AI SMOKE ${runId}`,tinh_trang_sach:'Fixture không có ảnh, không được suy ra tình trạng tốt.'},bai_dang:{tieu_de:`AI SMOKE ${runId}`,mo_ta_tinh_trang:'Không có dữ liệu hình ảnh. Chỉ kiểm thử kết nối và NULL.'},phien:{gia_khoi_diem:'100000',gia_toi_thieu:'200000',buoc_gia:'1000',thoi_gian_cho_dat_lai:20},media:[]});postId=created.id;cleanupSafe=false;
  stage='chờ Gemini/worker lưu SQL';console.log('Đang kiểm tra Gemini thật; dữ liệu mẫu thiếu ảnh nên điểm phải giữ NULL.');
  let data;const deadline=Date.now()+180000;
  while(Date.now()<deadline){data=await admin.call(`/ai/${postId}`);if(data.analysis&&(!data.job||data.job.state==='done')){cleanupSafe=true;break;}await delay(1000);}
  assert(data?.analysis,'Hết thời gian chờ kết quả AI.');assert.notEqual(data.analysis.trang_thai,'that_bai',`Gemini chưa hoàn tất: ${data.analysis.thong_tin?.error_code||'AI_ERROR'}`);
  assert.equal(data.analysis.diem_do_hiem,null);assert.equal(data.analysis.diem_tinh_trang,null);assert.equal(data.analysis.chi_tiet.length,9);
  const owner=await seller.call(`/ai/${postId}`);assert.equal(owner.analysis.phan_tich_id,data.analysis.phan_tich_id);
  assert.equal((await admin.call(`/posts/${postId}`)).trang_thai_phien,'cho_kiem_duyet');assert(!JSON.stringify(data).includes(process.env.GEMINI_API_KEY));
  finished=true;
}catch(error){console.error(`FAIL AI tại ${stage}, run=${runId}: ${error.message}`);process.exitCode=1;}
finally{
  try{if(pool&&cleanupSafe){const req=pool.request();accounts.forEach((row,i)=>req.input('u'+i,sql.Int,row.nguoi_dung_id));if(postId)await req.input('post',sql.Int,postId).query(`SET XACT_ABORT ON;BEGIN TRANSACTION;DECLARE @book INT;SELECT @book=sach_id FROM dbo.BaiDang WITH (UPDLOCK,HOLDLOCK) WHERE bai_dang_id=@post;DELETE dbo.ChiTietPhanTichAI WHERE phan_tich_id IN(SELECT phan_tich_id FROM dbo.PhanTichAI WHERE bai_dang_id=@post);DELETE dbo.PhanTichAI WHERE bai_dang_id=@post;DELETE dbo.LichSuDauGia WHERE phien_dau_gia_id IN(SELECT phien_dau_gia_id FROM dbo.PhienDauGia WHERE bai_dang_id=@post);DELETE dbo.PhienDauGia WHERE bai_dang_id=@post;DELETE dbo.BaiDang WHERE bai_dang_id=@post;DELETE dbo.Sach WHERE sach_id=@book;COMMIT TRANSACTION;`);if(accounts.length)await pool.request().query(`DELETE dbo.NguoiDung WHERE nguoi_dung_id IN(${accounts.map(x=>x.nguoi_dung_id).join(',')})`);console.log('Đã dọn đúng dữ liệu SQL thử AI. Job Redis tự hết hạn.');}
    else if(postId){console.error(`Job còn chờ; giữ fixture bài #${postId}, run=${runId} để worker/nhóm đối soát.`);process.exitCode=1;}}
  catch{console.error(`Chưa dọn xong fixture AI, bài #${postId}, run=${runId}.`);process.exitCode=1;}
  await closeDatabase();
}
if(finished&&!process.exitCode)console.log('PASS AI thật: Gemini JSON → Backend kiểm tra/tính điểm → SQL, thiếu ảnh giữ NULL, chủ bài/Admin cùng kết quả và bài vẫn chờ Admin.');
