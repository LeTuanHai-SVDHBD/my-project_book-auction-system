/** SQL bài đăng/phiên: khóa cặp trạng thái và sách vật lý, tiền được truyền/đọc bằng chuỗi. */
import {searchPattern,catalogOrders} from '../services/catalogSearch.js';
import { HttpError } from '../middlewares/errorHandler.js';
import {analysisView} from '../ai/input.js';
import {withRowVersion} from '../utils/rowVersion.js';
import {assertVersion,assertStatePair,assertRelistable} from '../services/postPolicy.js';
const conflict = message => { throw new HttpError(409,'POST_CONFLICT',message); };
const notFound = () => { throw new HttpError(404,'POST_NOT_FOUND','Không tìm thấy bài đăng.'); };
const projection = `b.bai_dang_id,b.sach_id,b.nguoi_dung_id,b.ma_san_pham,b.tieu_de,b.mo_ta_tinh_trang,b.trang_thai AS trang_thai_bai,b.ngay_dang,
 s.ten_sach,s.tac_gia,s.the_loai,s.nha_xuat_ban,s.nam_xuat_ban,s.isbn,s.tinh_trang_sach,s.mo_ta,
 p.phien_dau_gia_id,p.trang_thai AS trang_thai_phien,p.thoi_gian_bat_dau,p.thoi_gian_ket_thuc,
 CONVERT(VARCHAR(18),p.gia_khoi_diem) AS gia_khoi_diem,CONVERT(VARCHAR(18),p.gia_hien_tai) AS gia_hien_tai,
 CONVERT(VARCHAR(18),p.buoc_gia) AS buoc_gia,p.thoi_gian_cho_dat_lai,CONVERT(BINARY(8),p.row_version) AS row_version`;
const joins = 'FROM dbo.BaiDang b JOIN dbo.Sach s ON s.sach_id=b.sach_id JOIN dbo.PhienDauGia p ON p.bai_dang_id=b.bai_dang_id';
export function createPostModel({ getPool, sql }) {
  const request = target => target.request ? target.request() : new sql.Request(target);
  async function transaction(work) {
    let tx; let started=false; let committing=false;
    try {
      tx = new sql.Transaction(await getPool());
      await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE); started=true;
      const result=await work(tx); committing=true; await tx.commit(); return result;
    } catch (error) {
      let rolledBack=!started || error.number===1205;
      if (started && !committing) { try { await tx.rollback(); rolledBack=true; } catch { /* keep claims if rollback is uncertain */ } }
      error.sqlRolledBack=rolledBack; throw error;
    }
  }
  async function findRequest(code, owner, target, lock=false) {
    const result=await request(target||await getPool()).input('code',sql.VarChar(40),code).query(`SELECT bai_dang_id,nguoi_dung_id FROM dbo.BaiDang ${lock?'WITH (UPDLOCK,HOLDLOCK)':''} WHERE ma_san_pham=@code`);
    const row=result.recordset[0];
    if (row && row.nguoi_dung_id!==owner) notFound();
    return row?.bai_dang_id||null;
  }
  async function locked(tx, postId, user, role='owner') {
    const result=await request(tx).input('id',sql.Int,postId).query(`SELECT b.*,p.phien_dau_gia_id,p.trang_thai AS trang_thai_phien,
      CONVERT(BINARY(8),p.row_version) AS row_version FROM dbo.BaiDang b WITH (UPDLOCK,HOLDLOCK)
      JOIN dbo.PhienDauGia p WITH (UPDLOCK,HOLDLOCK) ON p.bai_dang_id=b.bai_dang_id WHERE b.bai_dang_id=@id`);
    const row=result.recordset[0]; if (!row || role==='owner' && row.nguoi_dung_id!==user) notFound(); return withRowVersion(row);
  }
  async function history(tx,auctionId,owner,action) {
    await request(tx).input('auction',sql.Int,auctionId).input('owner',sql.Int,owner).input('action',sql.NVarChar(2000),action)
      .query('INSERT dbo.LichSuDauGia(phien_dau_gia_id,nguoi_dung_id,hanh_dong) VALUES(@auction,@owner,@action)');
  }
  async function media(target,postId) {
    const images=await request(target).input('id',sql.Int,postId).query("SELECT 'image' AS kind,duong_dan_img AS url,tieu_de_img AS title,cloudinary_public_id AS publicId FROM dbo.HinhAnh WHERE bai_dang_id=@id ORDER BY thu_tu_img");
    const videos=await request(target).input('id',sql.Int,postId).query("SELECT 'video' AS kind,duong_dan_video AS url,tieu_de_video AS title,cloudinary_public_id AS publicId FROM dbo.Video WHERE bai_dang_id=@id ORDER BY thu_tu_video");
    return [...images.recordset,...videos.recordset];
  }
  async function insertMedia(tx,postId,items,limits,existing=[]) {
    const all=[...existing,...items];
    if (all.filter(x=>x.kind==='image').length>limits.maxImages || all.filter(x=>x.kind==='video').length>limits.maxVideos) throw new HttpError(400,'MEDIA_COUNT','Số tệp vượt giới hạn ảnh/video.');
    const count={image:existing.filter(x=>x.kind==='image').length,video:existing.filter(x=>x.kind==='video').length};
    for (const item of items) {
      const image=item.kind==='image'; const table=image?'HinhAnh':'Video'; const suffix=image?'img':'video';
      await request(tx).input('id',sql.Int,postId).input('url',sql.VarChar(2048),item.url).input('title',sql.NVarChar(500),item.title||null)
        .input('publicId',sql.VarChar(255),item.publicId||null).input('order',sql.SmallInt,++count[item.kind])
        .query(`INSERT dbo.${table}(bai_dang_id,duong_dan_${suffix},tieu_de_${suffix},thu_tu_${suffix},cloudinary_public_id) VALUES(@id,@url,@title,@order,@publicId)`);
    }
  }
  function prices(req,input) {
    for (const key of ['gia_khoi_diem','gia_toi_thieu','buoc_gia']) req.input(key,sql.VarChar(18),input.prices[key]);
    return req.input('wait',sql.Int,input.prices.thoi_gian_cho_dat_lai);
  }
  return {
    findRequest,
    async isMediaReferenced(publicId) {
      const result=await request(await getPool()).input('publicId',sql.VarChar(255),publicId).query('SELECT CASE WHEN EXISTS(SELECT 1 FROM dbo.HinhAnh WHERE cloudinary_public_id=@publicId) OR EXISTS(SELECT 1 FROM dbo.Video WHERE cloudinary_public_id=@publicId) OR EXISTS(SELECT 1 FROM dbo.BangChungKhieuNai WHERE CHARINDEX(@publicId,duong_dan_anh_khieu_nai)>0) THEN 1 ELSE 0 END AS used');
      return result.recordset[0].used===1;
    },
    async search({q,genre,phase,sort,page}) {
      const folded=column=>`REPLACE(LOWER(${column}),N'đ',N'd') COLLATE Vietnamese_100_CI_AI`;
      const result=await request(await getPool()).input('q',sql.NVarChar(250),searchPattern(q)).input('genre',sql.NVarChar(100),genre)
        .input('phase',sql.VarChar(10),phase).input('skip',sql.Int,(page-1)*30).query(`
          SELECT ${projection},(SELECT TOP(1) duong_dan_img FROM dbo.HinhAnh WHERE bai_dang_id=b.bai_dang_id ORDER BY thu_tu_img) AS anh_bia
          ${joins} WHERE b.trang_thai='da_duyet' AND p.trang_thai IN ('da_kich_hoat','da_ket_thuc')
          AND (${['s.ten_sach','b.tieu_de','s.tac_gia','s.isbn','s.the_loai'].map(c=>`${folded(c)} LIKE @q COLLATE Vietnamese_100_CI_AI ESCAPE N'~'`).join(' OR ')})
          AND (@genre=N'' OR s.the_loai COLLATE Vietnamese_100_CI_AI=@genre COLLATE Vietnamese_100_CI_AI)
          AND (@phase='all' OR @phase='ended' AND p.trang_thai='da_ket_thuc'
            OR @phase='live' AND p.trang_thai='da_kich_hoat' AND p.thoi_gian_bat_dau<=SYSUTCDATETIME() AND p.thoi_gian_ket_thuc>SYSUTCDATETIME()
            OR @phase='scheduled' AND p.trang_thai='da_kich_hoat' AND p.thoi_gian_bat_dau>SYSUTCDATETIME())
          ORDER BY ${catalogOrders[sort]} OFFSET @skip ROWS FETCH NEXT 31 ROWS ONLY`);
      const items=result.recordset.slice(0,30);return {items,nextPage:result.recordset.length>30?page+1:null};
    },
    async list({owner=null,pending=false,publicOnly=false,after=2147483647}) {
      const result=await request(await getPool()).input('owner',sql.Int,owner).input('pending',sql.Bit,pending).input('public',sql.Bit,publicOnly).input('after',sql.Int,after)
        .query(`SELECT TOP(30) ${projection},(SELECT TOP(1) duong_dan_img FROM dbo.HinhAnh WHERE bai_dang_id=b.bai_dang_id ORDER BY thu_tu_img) AS anh_bia ${joins} WHERE b.bai_dang_id<@after AND (@owner IS NULL OR b.nguoi_dung_id=@owner)
          AND (@pending=0 OR (b.trang_thai='cho_kiem_duyet' AND p.trang_thai='cho_kiem_duyet'))
          AND (@public=0 OR (b.trang_thai='da_duyet' AND p.trang_thai IN ('da_kich_hoat','da_ket_thuc'))) ORDER BY b.bai_dang_id DESC`);
      return result.recordset.map(withRowVersion);
    },
    async detail(postId,{owner=null,admin=false,publicOnly=false}={}) {
      const pool=await getPool();
      const result=await request(pool).input('id',sql.Int,postId).query(`SELECT ${projection}${publicOnly?'':',CONVERT(VARCHAR(18),p.gia_toi_thieu) AS gia_toi_thieu'} ${joins} WHERE b.bai_dang_id=@id`);
      const row=withRowVersion(result.recordset[0]);
      if (!row || publicOnly && (row.trang_thai_bai!=='da_duyet'||!['da_kich_hoat','da_ket_thuc'].includes(row.trang_thai_phien)) || !publicOnly && !admin && row.nguoi_dung_id!==owner) notFound();
      row.media=(await media(pool,postId)).map(({publicId,...item})=>item);
      if (publicOnly) return row;
      row.kiem_duyet=(await request(pool).input('id',sql.Int,postId).query('SELECT kiem_duyet_id,ket_qua,phan_hoi_admin,ngay_kiem_duyet FROM dbo.KiemDuyet WHERE bai_dang_id=@id ORDER BY kiem_duyet_id DESC')).recordset;
      row.ai=(await request(pool).input('id',sql.Int,postId).query('SELECT TOP(1) phan_tich_id,diem_do_hiem,diem_tinh_trang,trang_thai,ngay_phan_tich FROM dbo.PhanTichAI WHERE bai_dang_id=@id ORDER BY phan_tich_id DESC')).recordset[0]||null;
      if (row.ai) row.ai.chi_tiet=(await request(pool).input('id',sql.Int,row.ai.phan_tich_id).query('SELECT tieu_chi,diem,bang_chung,do_tin_cay,canh_bao,nhom_tieu_chi,trang_thai_danh_gia,trong_so,nguon_doi_chieu FROM dbo.ChiTietPhanTichAI WHERE phan_tich_id=@id ORDER BY chi_tiet_id')).recordset;
      row.ai=analysisView(row.ai,row);
      row.co_the_dang_lai=(await request(pool).input('id',sql.Int,postId).query(`SELECT CASE WHEN p.trang_thai='da_ket_thuc' AND k.trang_thai='khong_co_nguoi_thang' AND k.nguoi_thang_dau_id IS NULL
        AND NOT EXISTS(SELECT 1 FROM dbo.BaiDang newer WHERE newer.sach_id=b.sach_id AND newer.bai_dang_id>b.bai_dang_id) THEN 1 ELSE 0 END AS allowed
        FROM dbo.BaiDang b JOIN dbo.PhienDauGia p ON p.bai_dang_id=b.bai_dang_id LEFT JOIN dbo.KetQuaDauGia k ON k.phien_dau_gia_id=p.phien_dau_gia_id WHERE b.bai_dang_id=@id`)).recordset[0].allowed===1;
      return row;
    },
    async create({owner,input,items,limits,code,sourceId=null}) {
      // Resolve the immutable book FK before SERIALIZABLE; otherwise two relists can
      // retain shared post locks while waiting for the same book anchor (lock inversion).
      let sourceBookId;
      if (sourceId) {
        try {
          const anchor=await request(await getPool()).input('id',sql.Int,sourceId).query('SELECT sach_id FROM dbo.BaiDang WHERE bai_dang_id=@id');
          if (!anchor.recordset[0]) notFound(); sourceBookId=anchor.recordset[0].sach_id;
        } catch(error) { error.sqlRolledBack=true; throw error; } // No transaction has begun.
      }
      return transaction(async tx=>{
        const prior=await findRequest(code,owner,tx,true); if (prior) return {id:prior,replayed:true};
        let bookId; let reused=[];
        if (sourceId) {
          // Sach is the stable lock anchor across every generation of a relisted physical copy.
          bookId=sourceBookId;
          await request(tx).input('id',sql.Int,bookId).query('SELECT sach_id FROM dbo.Sach WITH (UPDLOCK,HOLDLOCK) WHERE sach_id=@id');
          const source=await locked(tx,sourceId,owner);
          const latest=await request(tx).input('book',sql.Int,bookId).query('SELECT TOP(1) bai_dang_id FROM dbo.BaiDang WITH (UPDLOCK,HOLDLOCK) WHERE sach_id=@book ORDER BY bai_dang_id DESC');
          const outcome=await request(tx).input('auction',sql.Int,source.phien_dau_gia_id).query('SELECT trang_thai,nguoi_thang_dau_id FROM dbo.KetQuaDauGia WITH (UPDLOCK,HOLDLOCK) WHERE phien_dau_gia_id=@auction');
          assertRelistable({sourceId,latestId:latest.recordset[0].bai_dang_id,state:source.trang_thai_phien,outcome:outcome.recordset[0]});
          if (input.reuseMedia) reused=await media(tx,sourceId);
        } else {
          const book=input.book; const req=request(tx);
          for (const [key,size] of Object.entries({ten_sach:300,tac_gia:200,the_loai:100,nha_xuat_ban:200,tinh_trang_sach:1000,mo_ta:sql.MAX})) req.input(key,sql.NVarChar(size),book[key]);
          req.input('year',sql.SmallInt,book.nam_xuat_ban).input('isbn',sql.VarChar(13),book.isbn);
          bookId=(await req.query('INSERT dbo.Sach(ten_sach,tac_gia,the_loai,nha_xuat_ban,nam_xuat_ban,isbn,tinh_trang_sach,mo_ta) OUTPUT INSERTED.sach_id VALUES(@ten_sach,@tac_gia,@the_loai,@nha_xuat_ban,@year,@isbn,@tinh_trang_sach,@mo_ta)')).recordset[0].sach_id;
        }
        const postId=(await request(tx).input('owner',sql.Int,owner).input('book',sql.Int,bookId).input('code',sql.VarChar(40),code)
          .input('title',sql.NVarChar(300),input.post.tieu_de).input('description',sql.NVarChar(sql.MAX),input.post.mo_ta_tinh_trang)
          .query('INSERT dbo.BaiDang(nguoi_dung_id,sach_id,ma_san_pham,tieu_de,mo_ta_tinh_trang) OUTPUT INSERTED.bai_dang_id VALUES(@owner,@book,@code,@title,@description)')).recordset[0].bai_dang_id;
        const auctionId=(await prices(request(tx).input('post',sql.Int,postId),input).query(`INSERT dbo.PhienDauGia(bai_dang_id,gia_khoi_diem,gia_toi_thieu,buoc_gia,thoi_gian_cho_dat_lai)
          OUTPUT INSERTED.phien_dau_gia_id VALUES(@post,CONVERT(DECIMAL(18,0),@gia_khoi_diem),CONVERT(DECIMAL(18,0),@gia_toi_thieu),CONVERT(DECIMAL(18,0),@buoc_gia),@wait)`)).recordset[0].phien_dau_gia_id;
        await insertMedia(tx,postId,[...reused,...items],limits);
        await history(tx,auctionId,owner,sourceId?`Đăng lại từ bài ${sourceId}; giữ sách ${bookId}; chờ kiểm duyệt`:'Tạo sách, bài đăng và phiên chờ kiểm duyệt');
        return {id:postId,replayed:false};
      });
    },
    async resubmit({owner,postId,input,items,limits}) {
      return transaction(async tx=>{
        const row=await locked(tx,postId,owner); assertVersion(row,input.rowVersion);
        assertStatePair(row,'tu_choi','khong_dat_kiem_duyet','Chỉ bổ sung bài đã bị từ chối.');
        await request(tx).input('id',sql.Int,postId).input('title',sql.NVarChar(300),input.post.tieu_de).input('description',sql.NVarChar(sql.MAX),input.post.mo_ta_tinh_trang)
          .query("UPDATE dbo.BaiDang SET tieu_de=@title,mo_ta_tinh_trang=@description,trang_thai='cho_kiem_duyet' WHERE bai_dang_id=@id");
        await prices(request(tx).input('id',sql.Int,row.phien_dau_gia_id),input).query(`UPDATE dbo.PhienDauGia SET gia_khoi_diem=CONVERT(DECIMAL(18,0),@gia_khoi_diem),gia_toi_thieu=CONVERT(DECIMAL(18,0),@gia_toi_thieu),buoc_gia=CONVERT(DECIMAL(18,0),@buoc_gia),thoi_gian_cho_dat_lai=@wait,trang_thai='cho_kiem_duyet' WHERE phien_dau_gia_id=@id`);
        await insertMedia(tx,postId,items,limits,await media(tx,postId));
        await history(tx,row.phien_dau_gia_id,owner,'Bổ sung thông tin/media và gửi kiểm duyệt lại; giữ lịch sử kiểm duyệt');
        return {id:postId};
      });
    },
    async review({admin,postId,input}) {
      return transaction(async tx=>{
        const row=await locked(tx,postId,admin,'admin'); assertVersion(row,input.rowVersion);
        if (row.nguoi_dung_id===admin) throw new HttpError(403,'SELF_REVIEW','Không tự kiểm duyệt bài của mình.');
        assertStatePair(row,'cho_kiem_duyet','cho_kiem_duyet','Bài không còn chờ kiểm duyệt.');
        const approve=input.decision==='phe_duyet';
        await request(tx).input('id',sql.Int,postId).input('state',sql.VarChar(30),approve?'da_duyet':'tu_choi').query('UPDATE dbo.BaiDang SET trang_thai=@state WHERE bai_dang_id=@id');
        await request(tx).input('id',sql.Int,row.phien_dau_gia_id).input('state',sql.VarChar(30),approve?'da_qua_kiem_duyet':'khong_dat_kiem_duyet').query('UPDATE dbo.PhienDauGia SET trang_thai=@state WHERE phien_dau_gia_id=@id');
        await request(tx).input('id',sql.Int,postId).input('admin',sql.Int,admin).input('result',sql.NVarChar(20),approve?'Phê duyệt':'Từ chối')
          .input('reason',sql.NVarChar(sql.MAX),(approve?'Đã kiểm tra bằng chứng về yếu tố quý hiếm. ':'')+input.reason)
          .query('INSERT dbo.KiemDuyet(bai_dang_id,admin_id,ket_qua,phan_hoi_admin) VALUES(@id,@admin,@result,@reason)');
        await history(tx,row.phien_dau_gia_id,admin,approve?'Admin phê duyệt bài đăng và phiên':'Admin từ chối bài đăng và phiên');
        return {id:postId};
      });
    },
    async activate({owner,postId,input}) {
      return transaction(async tx=>{
        const row=await locked(tx,postId,owner); assertVersion(row,input.rowVersion);
        assertStatePair(row,'da_duyet','da_qua_kiem_duyet','Phiên cần được Admin phê duyệt và chưa kích hoạt.');
        const result=await request(tx).input('id',sql.Int,row.phien_dau_gia_id).input('start',sql.DateTime2(3),input.start).input('end',sql.DateTime2(3),input.end)
          .query("UPDATE dbo.PhienDauGia SET thoi_gian_bat_dau=@start,thoi_gian_ket_thuc=@end,trang_thai='da_kich_hoat' OUTPUT INSERTED.phien_dau_gia_id WHERE phien_dau_gia_id=@id AND @start>SYSUTCDATETIME() AND @end>@start");
        if (!result.recordset.length) conflict('Giờ bắt đầu phải ở tương lai theo đồng hồ SQL Server; kết thúc phải sau bắt đầu.');
        await history(tx,row.phien_dau_gia_id,owner,'Chủ sách đặt lịch và kích hoạt phiên đã được kiểm duyệt');
        return {id:postId,auctionId:row.phien_dau_gia_id};
      });
    },
  };
}
