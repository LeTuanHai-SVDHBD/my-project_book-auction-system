/** SQL thật opt-in: chỉ database BookAuctionTest_*, kết quả/chi tiết nguyên tử, replay và version cũ. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createAiModel} from '../src/models/ai.model.js';
import {createPostModel} from '../src/models/post.model.js';
import {inputHash} from '../src/ai/input.js';
import {RULE_VERSION,CRITERIA} from '../src/ai/criteria.js';
import {scoreObservations} from '../src/ai/scoring.js';
test('SQL AI: lưu chi tiết cùng điểm, replay không thêm dòng và version thay đổi bị chặn', {skip:process.env.AI_TEST_SQL!=='true',timeout:30000},async t=>{
  assert.match(process.env.DB_DATABASE||'',/^BookAuctionTest_[A-Za-z0-9_]+$/);
  const {getPool,sql,closeDatabase}=await import('../src/config/database.js'),{config}=await import('../src/config/env.js');
  const master=await new sql.ConnectionPool({...config.sql,database:'master'}).connect();try{await master.request().query(`IF DB_ID('${config.sql.database}') IS NULL CREATE DATABASE [${config.sql.database}]`);}finally{await master.close();}
  const pool=await getPool();let userId,postId,bookId;
  t.after(async()=>{try{if(postId)await pool.request().input('post',sql.Int,postId).input('user',sql.Int,userId).input('book',sql.Int,bookId).query(`DELETE dbo.ChiTietPhanTichAI WHERE phan_tich_id IN(SELECT phan_tich_id FROM dbo.PhanTichAI WHERE bai_dang_id=@post);DELETE dbo.PhanTichAI WHERE bai_dang_id=@post;DELETE dbo.PhienDauGia WHERE bai_dang_id=@post;DELETE dbo.BaiDang WHERE bai_dang_id=@post;DELETE dbo.Sach WHERE sach_id=@book;DELETE dbo.NguoiDung WHERE nguoi_dung_id=@user;`);}finally{await closeDatabase();}});
  if(!(await pool.request().query("SELECT OBJECT_ID('dbo.PhanTichAI') AS id")).recordset[0].id){const ddl=await readFile(new URL('../migrations/001_schema.sql',import.meta.url),'utf8');for(const batch of ddl.split(/^\s*GO\s*$/gim).filter(x=>x.trim()))await pool.request().batch(batch);}
  for(const name of ['002_cloudinary_metadata.sql','003_auction_decisions.sql','004_notifications.sql','005_review_exports.sql'])await pool.request().batch(await readFile(new URL('../migrations/'+name,import.meta.url),'utf8'));
  const id=randomUUID(),created=(await pool.request().input('email',sql.VarChar(254),`ai-${id}@example.test`).input('code',sql.VarChar(40),'AI'+id.replaceAll('-','')).query(`INSERT dbo.NguoiDung(ho_ten,email,mat_khau) VALUES(N'AI fixture',@email,'fixture-only');DECLARE @u INT=SCOPE_IDENTITY();INSERT dbo.Sach(ten_sach,tinh_trang_sach) VALUES(N'AI fixture',N'Dữ liệu thử');DECLARE @s INT=SCOPE_IDENTITY();INSERT dbo.BaiDang(nguoi_dung_id,sach_id,ma_san_pham,tieu_de,mo_ta_tinh_trang) VALUES(@u,@s,@code,N'AI fixture',N'Dữ liệu thử');DECLARE @p INT=SCOPE_IDENTITY();INSERT dbo.PhienDauGia(bai_dang_id,gia_khoi_diem,gia_toi_thieu,buoc_gia) VALUES(@p,100000,200000,1000);SELECT @u AS userId,@s AS bookId,@p AS postId;`)).recordset[0];
  ({userId,postId,bookId}=created);const posts=createPostModel({getPool,sql}),model=createAiModel({getPool,sql}),row=await posts.detail(postId,{admin:true});
  const job={postId,requestId:randomUUID(),sourceVersion:row.row_version,inputHash:inputHash(row)},metadata={request_id:job.requestId,source_version:job.sourceVersion,input_hash:job.inputHash,rule_version:RULE_VERSION,model:'fixture'};
  const observations={criteria:CRITERIA.map(c=>({id:c.id,status:c.id==='dust_jacket'?'not_applicable':'assessed',findings:[c.group==='do_hiem'?'meets':c.id==='cover'||c.id==='edges'?'light':c.id==='spine'?'moderate':'intact'],evidence:'Fixture SQL kiểm thử quy đổi, không phải thẩm định thật.',media_refs:['M1'],sources:[]})),warnings:[]};
  const result=scoreObservations(observations,{mediaIds:['M1']});
  await assert.rejects(model.save(job,result,metadata,async()=>{throw Error('before COMMIT');}),/before COMMIT/);assert.equal((await model.history(postId)).length,0);
  const first=await model.save(job,result,metadata);assert.equal((await model.save(job,result,metadata)).phan_tich_id,first.phan_tich_id);assert.equal((await model.history(postId)).length,1);
  const stored=await model.get(postId,first.phan_tich_id);assert.equal(stored.diem_do_hiem,100);assert.equal(stored.diem_tinh_trang,76.39);assert.equal(stored.chi_tiet.length,10);
  assert.equal((await posts.detail(postId,{admin:true})).ai.loi_thoi,false);
  await pool.request().input('post',sql.Int,postId).query('UPDATE dbo.PhienDauGia SET buoc_gia=2000 WHERE bai_dang_id=@post');
  await assert.rejects(model.save({...job,requestId:randomUUID()},result,metadata),{code:'AI_INPUT_CHANGED'});assert.equal((await model.history(postId)).length,1);
});
