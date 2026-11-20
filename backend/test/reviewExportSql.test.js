/** SQL Server thật opt-in: bản kết quả nguyên tử, giữ từng vòng, migration chạy lại được. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {applyMigrations} from '../scripts/schemaMigrations.js';
import {createPostModel} from '../src/models/post.model.js';
import {moderationQuery} from '../src/services/moderationList.js';
import {validatePost,validateReview} from '../src/services/postValidation.js';

test('SQL xuất kết quả: trigger đang bật, hai quyết định và snapshot cùng COMMIT, không lẫn media',
  {skip:process.env.REVIEW_TEST_SQL!=='true',timeout:60000},async t=>{
    assert.match(process.env.DB_DATABASE||'',/^BookAuctionTest_[A-Za-z0-9_]+$/);
    const {getPool,sql,closeDatabase}=await import('../src/config/database.js');
    const {config}=await import('../src/config/env.js');
    const master=await new sql.ConnectionPool({...config.sql,database:'master'}).connect();
    try{await master.request().query(`IF DB_ID('${config.sql.database}') IS NULL CREATE DATABASE [${config.sql.database}]`);}finally{await master.close();}
    const pool=await getPool(),users=[];let postId,bookId,auctionId,legacyBookId,relistedId,relistedAuction;
    t.after(async()=>{try{
      if(relistedId)await pool.request().input('post',sql.Int,relistedId).input('auction',sql.Int,relistedAuction).query('DELETE dbo.KiemDuyet WHERE bai_dang_id=@post;DELETE dbo.HinhAnh WHERE bai_dang_id=@post;DELETE dbo.Video WHERE bai_dang_id=@post;DELETE dbo.KetQuaDauGia WHERE phien_dau_gia_id=@auction;DELETE dbo.LichSuDauGia WHERE phien_dau_gia_id=@auction;DELETE dbo.PhienDauGia WHERE bai_dang_id=@post;DELETE dbo.BaiDang WHERE bai_dang_id=@post;');
      if(postId)await pool.request().input('post',sql.Int,postId).input('book',sql.Int,bookId).input('auction',sql.Int,auctionId).query(`
        DELETE dbo.KiemDuyet WHERE bai_dang_id=@post;DELETE dbo.HinhAnh WHERE bai_dang_id=@post;DELETE dbo.Video WHERE bai_dang_id=@post;
        DELETE dbo.KetQuaDauGia WHERE phien_dau_gia_id=@auction;DELETE dbo.LichSuDauGia WHERE phien_dau_gia_id=@auction;DELETE dbo.PhienDauGia WHERE bai_dang_id=@post;
        DELETE dbo.BaiDang WHERE bai_dang_id=@post;DELETE dbo.Sach WHERE sach_id=@book;`);
      if(legacyBookId)await pool.request().input('id',sql.Int,legacyBookId).query('DELETE dbo.Sach WHERE sach_id=@id');
      for(const user of users)await pool.request().input('id',sql.Int,user).query('DELETE dbo.NguoiDung WHERE nguoi_dung_id=@id');
    }finally{await closeDatabase();}});
    if(!(await pool.request().query("SELECT OBJECT_ID('dbo.KiemDuyet') AS id")).recordset[0].id){
      const ddl=await readFile(new URL('../migrations/001_schema.sql',import.meta.url),'utf8');
      for(const batch of ddl.split(/^\s*GO\s*$/gim).filter(value=>value.trim()))await pool.request().batch(batch);
    }
    legacyBookId=(await pool.request().query("INSERT dbo.Sach(ten_sach,tinh_trang_sach,isbn) OUTPUT INSERTED.sach_id VALUES(N'Legacy ISBN fixture',N'Test only','0306406152')")).recordset[0].sach_id;
    await applyMigrations(pool);await applyMigrations(pool);
    const trigger=(await pool.request().query("SELECT is_disabled FROM sys.triggers WHERE object_id=OBJECT_ID('dbo.TR_KiemDuyet_admin_insert') AND parent_id=OBJECT_ID('dbo.KiemDuyet')")).recordset[0];
    assert(trigger,'Migration 010 phải tạo trigger bảo vệ quyết định');assert.equal(trigger.is_disabled,false);
    assert.equal((await pool.request().input('id',sql.Int,legacyBookId).query('SELECT isbn FROM dbo.Sach WHERE sach_id=@id')).recordset[0].isbn,'0306406152');
    const run=randomUUID();
    for(let i=0;i<3;i++)users.push((await pool.request().input('email',sql.VarChar(254),`export-${run}-${i}@example.test`).input('role',sql.VarChar(20),i===2?'admin':'nguoi_dung')
      .query("INSERT dbo.NguoiDung(ho_ten,email,mat_khau,vai_tro) OUTPUT INSERTED.nguoi_dung_id VALUES(N'Export fixture',@email,'fixture-only',@role)")).recordset[0].nguoi_dung_id);
    const [owner,other,admin]=users,model=createPostModel({getPool,sql});
    const input=validatePost({ma_yeu_cau:run,sach:{ten_sach:'Sách kiểm thử xuất PDF',isbn:'ISBN 000–123–456–789–012–345–678–X'},bai_dang:{tieu_de:'Bản thứ nhất',mo_ta_tinh_trang:'Chỉ kiểm thử phần mềm'},phien:{gia_khoi_diem:'100000',gia_toi_thieu:'200000',buoc_gia:'1000'},media:[]});
    ({id:postId}=await model.create({owner,input,items:[{kind:'image',url:'https://res.cloudinary.com/demo/image/upload/first.jpg'}],limits:{maxVideos:3},code:'EX'+run.replaceAll('-','')}));
    let detail=await model.detail(postId,{owner});bookId=detail.sach_id;auctionId=detail.phien_dau_gia_id;assert.equal(detail.isbn,input.book.isbn);
    const ownerPhase=async (phase,viewer=owner)=>(await model.list({owner:viewer,ownerStatus:phase})).find(p=>p.bai_dang_id===postId)?.owner_status;
    assert.equal(await ownerPhase('pending'),'pending');assert.equal(await ownerPhase('pending',other),undefined);
    const review=async decision=>model.review({admin,postId,input:validateReview({quyet_dinh:decision,ly_do:'Quyết định kiểm thử',xac_nhan_quy_hiem:true,row_version:(await model.detail(postId,{owner})).row_version})});
    assert((await model.list({...moderationQuery({status:'pending'}),owner})).some(p=>p.bai_dang_id===postId));
    await review('tu_choi');detail=await model.detail(postId,{owner});const firstId=detail.kiem_duyet[0].kiem_duyet_id;
    assert(detail.kiem_duyet[0].co_the_xuat);
    assert.equal(await ownerPhase('rejected'),'rejected');assert.equal(await ownerPhase('pending'),undefined);
    const rejected=await model.list(moderationQuery({status:'rejected'}));const card=rejected.find(p=>p.bai_dang_id===postId);assert(card);assert.equal(card.ly_do_tu_choi,'Quyết định kiểm thử');assert(card.ngay_tu_choi);
    assert(!(await model.list(moderationQuery({status:'pending'}))).some(p=>p.bai_dang_id===postId));
    assert(!(await model.list(moderationQuery({before:`rejected:${postId}`}))).some(p=>p.bai_dang_id===postId));
    const [first,again]=await Promise.all([model.exportReview(owner,postId,firstId),model.exportReview(owner,postId,firstId)]);
    assert.deepEqual(first,again);assert.equal(first.media.length,1);assert.equal(first.book.isbn,input.book.isbn);
    const raw=(await pool.request().input('id',sql.Int,firstId).query('SELECT ket_qua_snapshot FROM dbo.KiemDuyet WHERE kiem_duyet_id=@id')).recordset[0];
    assert.deepEqual(JSON.parse(raw.ket_qua_snapshot),JSON.parse(JSON.stringify(first)));
    await assert.rejects(model.exportReview(other,postId,firstId),{status:404});
    // Clear the legacy snapshot to verify resubmit captures it before edits/removal.
    await pool.request().input('id',sql.Int,firstId).query('UPDATE dbo.KiemDuyet SET ket_qua_snapshot=NULL WHERE kiem_duyet_id=@id');
    const next=structuredClone(input);next.book.ten_sach='Sách đã sửa';next.book.isbn=null;next.book.mo_ta='Nội dung dài '.repeat(600);next.removeMedia=[{kind:'image',id:detail.media[0].id}];next.post.tieu_de='Đã bổ sung';next.post.mo_ta_tinh_trang='Thông tin mới';next.rowVersion=detail.row_version;
    await model.resubmit({owner,postId,input:next,items:[{kind:'video',url:'https://res.cloudinary.com/demo/video/upload/second.mp4'}],limits:{maxVideos:3}});
    assert.deepEqual(await model.exportReview(owner,postId,firstId),first);
    const corrected=await model.detail(postId,{owner});assert.equal(corrected.ten_sach,'Sách đã sửa');assert.equal(corrected.isbn,null);assert.equal(corrected.mo_ta,next.book.mo_ta);assert.equal(corrected.media.length,1);assert.equal(corrected.media[0].kind,'video');await applyMigrations(pool);assert.equal((await model.detail(postId,{owner})).ten_sach,'Sách đã sửa');
    const canonical=(await pool.request().input('id',sql.Int,bookId).query('SELECT ten_sach,isbn FROM dbo.Sach WHERE sach_id=@id')).recordset[0];assert.equal(canonical.ten_sach,input.book.ten_sach);assert.equal(canonical.isbn,input.book.isbn);
    assert.equal((await pool.request().input('post',sql.Int,postId).query('SELECT dang_su_dung FROM dbo.HinhAnh WHERE bai_dang_id=@post')).recordset[0].dang_su_dung,false);
    assert((await model.list(moderationQuery({status:'pending'}))).some(p=>p.bai_dang_id===postId));
    await review('phe_duyet');assert(!(await model.list(moderationQuery({}))).some(p=>p.bai_dang_id===postId));const secondId=(await model.detail(postId,{owner})).kiem_duyet[0].kiem_duyet_id;
    const second=await model.exportReview(owner,postId,secondId);assert.equal(second.media.length,1);assert.equal(second.review.ket_qua,'Phê duyệt');assert.equal(second.post.tieu_de,'Đã bổ sung');
    assert.equal(await ownerPhase('approved'),'approved');
    for(const [phase,start,end] of [['scheduled',1,2],['live',-1,1],['ended',-2,-1]]){
      await pool.request().input('id',sql.Int,auctionId).input('start',sql.Int,start).input('end',sql.Int,end)
        .query("UPDATE dbo.PhienDauGia SET trang_thai='da_kich_hoat',thoi_gian_bat_dau=DATEADD(HOUR,@start,SYSUTCDATETIME()),thoi_gian_ket_thuc=DATEADD(HOUR,@end,SYSUTCDATETIME()) WHERE phien_dau_gia_id=@id");
      assert.equal(await ownerPhase(phase),phase);
      if(phase==='ended'){
        assert.equal(await ownerPhase('live'),undefined);
        assert.equal((await model.detail(postId,{owner})).trang_thai_phien,'da_kich_hoat');
      }else assert.equal(await ownerPhase('ended'),undefined);
    }
    await pool.request().input('id',sql.Int,auctionId).query("UPDATE dbo.PhienDauGia SET trang_thai='da_ket_thuc',thoi_gian_bat_dau=DATEADD(HOUR,-2,SYSUTCDATETIME()),thoi_gian_ket_thuc=DATEADD(HOUR,-1,SYSUTCDATETIME()) WHERE phien_dau_gia_id=@id;INSERT dbo.KetQuaDauGia(phien_dau_gia_id,trang_thai,thoi_gian_ket_thuc) VALUES(@id,'khong_co_nguoi_thang',SYSUTCDATETIME());");
    assert.equal(await ownerPhase('ended'),'ended');assert.equal((await model.detail(postId,{owner})).trang_thai_phien,'da_ket_thuc');
    const searchable=await model.search({q:'Sách đã sửa',genre:'',group:'',phase:'ended',sort:'newest',page:1});const publicCard=searchable.items.find(x=>x.bai_dang_id===postId);assert(publicCard);assert.equal(publicCard.anh_bia,null);assert.equal((await model.detail(postId,{publicOnly:true})).media.length,1);
    const relistInput={...input,book:undefined,requestId:randomUUID(),reuseMedia:true};
    ({id:relistedId}=await model.create({owner,input:relistInput,sourceId:postId,items:[],limits:{maxVideos:3},code:'EX'+randomUUID().replaceAll('-','')}));
    const relisted=await model.detail(relistedId,{owner});relistedAuction=relisted.phien_dau_gia_id;assert.equal(relisted.sach_id,bookId);assert.equal(relisted.ten_sach,'Sách đã sửa');assert.equal(relisted.media.length,1);
    await model.review({admin,postId:relistedId,input:validateReview({quyet_dinh:'tu_choi',ly_do:'Cần thêm ảnh',row_version:relisted.row_version})});
    const relistEdit={...next,book:{...next.book,ten_sach:'Chỉ sửa lần đăng sau'},removeMedia:[],rowVersion:(await model.detail(relistedId,{owner})).row_version};
    await model.resubmit({owner,postId:relistedId,input:relistEdit,items:[],limits:{maxVideos:3}});assert.equal((await model.detail(postId,{owner})).ten_sach,'Sách đã sửa');assert.equal((await model.detail(relistedId,{owner})).ten_sach,'Chỉ sửa lần đăng sau');
    // Legacy records: capture only a still-current decision; never invent old-round media.
    await pool.request().input('post',sql.Int,postId).query('UPDATE dbo.KiemDuyet SET ket_qua_snapshot=NULL WHERE bai_dang_id=@post');
    await assert.rejects(model.exportReview(owner,postId,firstId),{status:409});
    assert.equal((await model.exportReview(owner,postId,secondId)).media.length,1);
  });
