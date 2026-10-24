/** Ghi mỗi lần phân tích cùng chi tiết trong SQL; khóa bài/phiên, bảo vệ replay và đầu vào đã thay đổi. */
import {META_CRITERION} from '../ai/criteria.js';
import {encodeRowVersion} from '../utils/rowVersion.js';
const changed=()=>Object.assign(new Error('AI_INPUT_CHANGED'),{code:'AI_INPUT_CHANGED'});
export function createAiModel({getPool,sql}) {
  const request=target=>target.request?target.request():new sql.Request(target);
  async function find(job,target) {
    const rows=await request(target||await getPool()).input('post',sql.Int,job.postId).input('request',sql.VarChar(36),job.requestId).input('meta',sql.NVarChar(200),META_CRITERION)
      .query(`SELECT TOP(1) p.phan_tich_id,p.trang_thai FROM dbo.PhanTichAI p JOIN dbo.ChiTietPhanTichAI c ON c.phan_tich_id=p.phan_tich_id
        WHERE p.bai_dang_id=@post AND c.tieu_chi=@meta AND JSON_VALUE(CASE WHEN ISJSON(c.bang_chung)=1 THEN c.bang_chung ELSE N'{}' END,'$.request_id')=@request`);
    return rows.recordset[0]||null;
  }
  return {find,
    async forVersion(job){return (await request(await getPool()).input('post',sql.Int,job.postId).input('version',sql.VarChar(16),job.sourceVersion).input('meta',sql.NVarChar(200),META_CRITERION).query(`SELECT TOP(1) p.phan_tich_id FROM dbo.PhanTichAI p JOIN dbo.ChiTietPhanTichAI c ON c.phan_tich_id=p.phan_tich_id WHERE p.bai_dang_id=@post AND c.tieu_chi=@meta AND JSON_VALUE(CASE WHEN ISJSON(c.bang_chung)=1 THEN c.bang_chung ELSE N'{}' END,'$.source_version')=@version ORDER BY p.phan_tich_id DESC`)).recordset[0]||null;},
    async pending() {
      return (await request(await getPool()).input('meta',sql.NVarChar(200),META_CRITERION).query(`SELECT TOP(20) b.bai_dang_id FROM dbo.BaiDang b JOIN dbo.PhienDauGia p ON p.bai_dang_id=b.bai_dang_id
        WHERE b.trang_thai='cho_kiem_duyet' AND p.trang_thai='cho_kiem_duyet' AND NOT EXISTS(
          SELECT 1 FROM dbo.PhanTichAI a JOIN dbo.ChiTietPhanTichAI c ON c.phan_tich_id=a.phan_tich_id
          WHERE a.bai_dang_id=b.bai_dang_id AND c.tieu_chi=@meta AND JSON_VALUE(CASE WHEN ISJSON(c.bang_chung)=1 THEN c.bang_chung ELSE N'{}' END,'$.source_version')=CONVERT(VARCHAR(16),CONVERT(BINARY(8),p.row_version),2))
        ORDER BY b.bai_dang_id`)).recordset.map(x=>x.bai_dang_id);
    },
    async history(postId) {
      return (await request(await getPool()).input('post',sql.Int,postId).query('SELECT TOP(20) phan_tich_id,diem_do_hiem,diem_tinh_trang,trang_thai,ngay_phan_tich FROM dbo.PhanTichAI WHERE bai_dang_id=@post ORDER BY phan_tich_id DESC')).recordset;
    },
    async get(postId,analysisId) {
      const pool=await getPool(),row=(await request(pool).input('post',sql.Int,postId).input('id',sql.Int,analysisId).query('SELECT phan_tich_id,diem_do_hiem,diem_tinh_trang,trang_thai,ngay_phan_tich FROM dbo.PhanTichAI WHERE bai_dang_id=@post AND phan_tich_id=@id')).recordset[0];
      if(row)row.chi_tiet=(await request(pool).input('id',sql.Int,analysisId).query('SELECT tieu_chi,diem,bang_chung,do_tin_cay,canh_bao,nhom_tieu_chi,trang_thai_danh_gia,trong_so,nguon_doi_chieu FROM dbo.ChiTietPhanTichAI WHERE phan_tich_id=@id ORDER BY chi_tiet_id')).recordset;
      return row||null;
    },
    async save(job,result,metadata,beforeCommit=async()=>{}) {
      const tx=new sql.Transaction(await getPool());let started=false,committing=false;
      try{
        await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);started=true;
        const row=(await request(tx).input('post',sql.Int,job.postId).query(`SELECT b.trang_thai AS post_state,p.trang_thai AS auction_state,CONVERT(BINARY(8),p.row_version) AS row_version
          FROM dbo.BaiDang b WITH (UPDLOCK,HOLDLOCK) JOIN dbo.PhienDauGia p WITH (UPDLOCK,HOLDLOCK) ON p.bai_dang_id=b.bai_dang_id WHERE b.bai_dang_id=@post`)).recordset[0];
        const prior=await find(job,tx);if(prior){await tx.commit();return prior;}
        if(!row||row.post_state!=='cho_kiem_duyet'||row.auction_state!=='cho_kiem_duyet'||encodeRowVersion(row.row_version)!==job.sourceVersion)throw changed();
        const saved=(await request(tx).input('post',sql.Int,job.postId).input('rarity',sql.Decimal(5,2),result.diem_do_hiem).input('condition',sql.Decimal(5,2),result.diem_tinh_trang).input('state',sql.VarChar(30),result.trang_thai)
          .query('INSERT dbo.PhanTichAI(bai_dang_id,diem_do_hiem,diem_tinh_trang,trang_thai) OUTPUT inserted.phan_tich_id VALUES(@post,@rarity,@condition,@state)')).recordset[0];
        const details=[...result.chi_tiet,{tieu_chi:META_CRITERION,nhom_tieu_chi:'khac',trang_thai_danh_gia:'Đã đánh giá',diem:null,trong_so:null,do_tin_cay:null,canh_bao:null,nguon_doi_chieu:null,bang_chung:JSON.stringify(metadata)}];
        for(const item of details) {
          const query=request(tx).input('analysis',sql.Int,saved.phan_tich_id);
          for(const key of ['tieu_chi','bang_chung','canh_bao','nguon_doi_chieu'])query.input(key,sql.NVarChar(key==='tieu_chi'?200:sql.MAX),item[key]??null);
          for(const key of ['diem','trong_so','do_tin_cay'])query.input(key,sql.Decimal(5,2),item[key]??null);
          query.input('group',sql.VarChar(20),item.nhom_tieu_chi).input('state',sql.NVarChar(30),item.trang_thai_danh_gia);
          await query.query(`INSERT dbo.ChiTietPhanTichAI(phan_tich_id,tieu_chi,diem,bang_chung,do_tin_cay,canh_bao,nhom_tieu_chi,trang_thai_danh_gia,trong_so,nguon_doi_chieu)
            VALUES(@analysis,@tieu_chi,@diem,@bang_chung,@do_tin_cay,@canh_bao,@group,@state,@trong_so,@nguon_doi_chieu)`);
        }
        await beforeCommit();committing=true;await tx.commit();return {...saved,trang_thai:result.trang_thai};
      }catch(error){if(started&&!committing)try{await tx.rollback();}catch{}throw error;}
    }
  };
}
