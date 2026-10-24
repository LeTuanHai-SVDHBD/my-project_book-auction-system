/** SQL đấu giá: quyết định bền vững, khóa theo thứ tự bài/phiên, rowversion và COMMIT nguyên tử. */
import {randomUUID} from 'node:crypto';
import {HttpError} from '../middlewares/errorHandler.js';
import {evaluateBid,deriveEndResult} from '../services/bidPolicy.js';
import {encodeRowVersion} from '../utils/rowVersion.js';

const receiptColumns='ma_yeu_cau,phien_dau_gia_id,nguoi_dung_id,CONVERT(VARCHAR(18),muc_gia) AS muc_gia,trang_thai,ly_do,thoi_gian_xu_ly';
export function assertSameBid(row,{auctionId,userId,requestId,amount}) {
  if(row&&(row.ma_yeu_cau!==requestId||row.phien_dau_gia_id!==auctionId||row.nguoi_dung_id!==userId||row.muc_gia!==amount)) {
    throw Object.assign(new HttpError(409,'REQUEST_ID_CONFLICT','Mã yêu cầu đã được dùng cho nội dung khác.'),{permanent:true});
  }
}
export function decisionView(row) {
  return Object.fromEntries(['ma_yeu_cau','phien_dau_gia_id','muc_gia','trang_thai','ly_do','thoi_gian_xu_ly'].map(key=>[key,row[key]]));
}
export function createAuctionModel({getPool,sql}) {
  const request=target=>target.request?target.request():new sql.Request(target);
  const failReference=code=>{throw Object.assign(new Error(code),{code,permanent:true});};
  async function transaction(work,beforeCommit=async()=>{}) {
    const tx=new sql.Transaction(await getPool());let started=false,committing=false;
    try {
      await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);started=true;
      const result=await work(tx);await beforeCommit();committing=true;await tx.commit();return result;
    } catch(error) {
      if(started&&!committing)try{await tx.rollback();}catch{/* Unknown commit/rollback is retried through SQL receipts. */}
      throw error;
    }
  }
  async function findRequest(requestId,target,lock=false) {
    const result=await request(target||await getPool()).input('code',sql.VarChar(64),requestId)
      .query(`SELECT ${receiptColumns} FROM dbo.YeuCauDatGia ${lock?'WITH (UPDLOCK,HOLDLOCK)':''} WHERE ma_yeu_cau=@code`);
    return result.recordset[0]||null;
  }
  async function anchor(auctionId) {
    const result=await request(await getPool()).input('id',sql.Int,auctionId).query('SELECT bai_dang_id FROM dbo.PhienDauGia WHERE phien_dau_gia_id=@id');
    if(!result.recordset[0])failReference('AUCTION_NOT_FOUND');
    return result.recordset[0].bai_dang_id;
  }
  async function locked(tx,auctionId,postId) {
    const post=await request(tx).input('id',sql.Int,postId)
      .query('SELECT nguoi_dung_id,trang_thai FROM dbo.BaiDang WITH (UPDLOCK,HOLDLOCK) WHERE bai_dang_id=@id');
    const result=await request(tx).input('id',sql.Int,auctionId).input('post',sql.Int,postId).query(`SELECT phien_dau_gia_id,bai_dang_id,trang_thai,
      thoi_gian_bat_dau,thoi_gian_ket_thuc,thoi_gian_cho_dat_lai,
      CONVERT(VARCHAR(18),gia_khoi_diem) AS gia_khoi_diem,CONVERT(VARCHAR(18),gia_hien_tai) AS gia_hien_tai,
      CONVERT(VARCHAR(18),gia_toi_thieu) AS gia_toi_thieu,CONVERT(VARCHAR(18),buoc_gia) AS buoc_gia,
      CONVERT(BINARY(8),row_version) AS row_version FROM dbo.PhienDauGia WITH (UPDLOCK,HOLDLOCK)
      WHERE phien_dau_gia_id=@id AND bai_dang_id=@post`);
    if(!post.recordset[0]||!result.recordset[0])failReference('AUCTION_NOT_FOUND');
    return {...result.recordset[0],nguoi_ban_id:post.recordset[0].nguoi_dung_id,trang_thai_bai:post.recordset[0].trang_thai};
  }
  async function clock(tx) {
    return (await request(tx).query('SELECT SYSUTCDATETIME() AS checked_at')).recordset[0].checked_at;
  }
  async function topBid(tx,auctionId) {
    const result=await request(tx).input('id',sql.Int,auctionId).query(`SELECT TOP(1) nguoi_dung_id,
      CONVERT(VARCHAR(18),muc_gia) AS muc_gia FROM dbo.LuotDatGia WITH (HOLDLOCK)
      WHERE phien_dau_gia_id=@id ORDER BY muc_gia DESC,luot_dat_gia_id`);
    return result.recordset[0]||null;
  }
  async function resultFor(tx,auctionId) {
    const result=await request(tx).input('id',sql.Int,auctionId).query(`SELECT ket_qua_id,trang_thai,nguoi_thang_dau_id,
      CONVERT(VARCHAR(18),muc_gia_thang) AS muc_gia_thang,ly_do_ket_thuc,thoi_gian_ket_thuc
      FROM dbo.KetQuaDauGia WHERE phien_dau_gia_id=@id`);
    return result.recordset[0]||null;
  }
  function versionRequest(tx,auction) {
    return request(tx).input('id',sql.Int,auction.phien_dau_gia_id)
      .input('version',sql.Binary(8),Buffer.from(encodeRowVersion(auction.row_version),'hex'));
  }
  function changed(result) {
    if(!result.recordset[0])throw Object.assign(new Error('Phiên thay đổi trong lúc ghi SQL.'),{code:'AUCTION_WRITE_CONFLICT'});
    return result.recordset[0];
  }
  async function history(tx,auctionId,userId,action,amount=null) {
    await request(tx).input('id',sql.Int,auctionId).input('user',sql.Int,userId).input('action',sql.NVarChar(2000),action)
      .input('amount',sql.VarChar(18),amount).query(`INSERT dbo.LichSuDauGia(phien_dau_gia_id,nguoi_dung_id,hanh_dong,muc_gia)
        VALUES(@id,@user,@action,CAST(@amount AS DECIMAL(18,0)))`);
  }
  async function finish(tx,auction,top,now,reason) {
    const outcome=deriveEndResult({auction,topBid:top,now,reason});if(!outcome)return null;
    changed(await versionRequest(tx,auction).query(`UPDATE dbo.PhienDauGia SET trang_thai='da_ket_thuc'
      OUTPUT inserted.phien_dau_gia_id WHERE phien_dau_gia_id=@id AND row_version=@version AND trang_thai='da_kich_hoat'`));
    const saved=await request(tx).input('id',sql.Int,auction.phien_dau_gia_id).input('winner',sql.Int,outcome.nguoi_thang_dau_id)
      .input('amount',sql.VarChar(18),outcome.muc_gia_thang).input('state',sql.VarChar(30),outcome.trang_thai)
      .input('reason',sql.VarChar(30),reason).input('at',sql.DateTime2(3),now).query(`INSERT dbo.KetQuaDauGia
        (phien_dau_gia_id,nguoi_thang_dau_id,muc_gia_thang,trang_thai,ly_do_ket_thuc,thoi_gian_ket_thuc)
        OUTPUT inserted.ket_qua_id VALUES(@id,@winner,CAST(@amount AS DECIMAL(18,0)),@state,@reason,@at)`);
    if(outcome.nguoi_thang_dau_id!==null) {
      await request(tx).input('code',sql.VarChar(40),'GD'+randomUUID().replaceAll('-','')).input('result',sql.Int,saved.recordset[0].ket_qua_id)
        .input('buyer',sql.Int,outcome.nguoi_thang_dau_id).input('seller',sql.Int,auction.nguoi_ban_id).input('amount',sql.VarChar(18),outcome.muc_gia_thang)
        .query(`INSERT dbo.GiaoDich(ma_giao_dich,ket_qua_id,nguoi_mua_id,nguoi_ban_id,so_tien)
          VALUES(@code,@result,@buyer,@seller,CAST(@amount AS DECIMAL(18,0)))`);
    }
    await history(tx,auction.phien_dau_gia_id,null,`Kết thúc phiên: ${reason}`,outcome.muc_gia_thang);
    return {...outcome,ket_qua_id:saved.recordset[0].ket_qua_id};
  }
  async function saveDecision(tx,event,decision,now) {
    await request(tx).input('code',sql.VarChar(64),event.requestId).input('id',sql.Int,event.auctionId)
      .input('user',sql.Int,event.userId).input('amount',sql.VarChar(18),event.amount)
      .input('state',sql.VarChar(20),decision.accepted?'da_chap_nhan':'bi_tu_choi')
      .input('reason',sql.VarChar(64),decision.accepted?null:decision.code).input('at',sql.DateTime2(3),now)
      .query(`INSERT dbo.YeuCauDatGia(ma_yeu_cau,phien_dau_gia_id,nguoi_dung_id,muc_gia,trang_thai,ly_do,thoi_gian_xu_ly)
        VALUES(@code,@id,@user,CAST(@amount AS DECIMAL(18,0)),@state,@reason,@at)`);
    return findRequest(event.requestId,tx);
  }
  return {
    findRequest,
    async bidStatus(auctionId,userId) {
      const result=await request(await getPool()).input('id',sql.Int,auctionId).input('user',sql.Int,userId)
        .query(`SELECT CAST(CASE WHEN b.nguoi_dung_id=@user THEN 1 ELSE 0 END AS BIT) AS la_chu_sach,
          DATEADD(SECOND,p.thoi_gian_cho_dat_lai,personal.last_at) AS duoc_dat_lai_luc,
          SYSUTCDATETIME() AS server_time
          FROM dbo.PhienDauGia p JOIN dbo.BaiDang b ON b.bai_dang_id=p.bai_dang_id
          OUTER APPLY (SELECT MAX(l.thoi_gian_dat) AS last_at FROM dbo.LuotDatGia l
            WHERE l.phien_dau_gia_id=p.phien_dau_gia_id AND l.nguoi_dung_id=@user) personal
          WHERE p.phien_dau_gia_id=@id AND b.trang_thai='da_duyet' AND p.trang_thai IN ('da_kich_hoat','da_ket_thuc')`);
      return result.recordset[0]||null;
    },
    async publicAuction(auctionId) {
      return transaction(async tx=>{
      const result=await request(tx).input('id',sql.Int,auctionId).query(`SELECT p.phien_dau_gia_id,p.bai_dang_id,p.trang_thai,
        p.thoi_gian_bat_dau,p.thoi_gian_ket_thuc,p.thoi_gian_cho_dat_lai,
        CONVERT(VARCHAR(18),p.gia_khoi_diem) AS gia_khoi_diem,CONVERT(VARCHAR(18),p.gia_hien_tai) AS gia_hien_tai,
        CONVERT(VARCHAR(18),p.buoc_gia) AS buoc_gia,SYSUTCDATETIME() AS server_time
        FROM dbo.PhienDauGia p JOIN dbo.BaiDang b ON b.bai_dang_id=p.bai_dang_id
        WHERE p.phien_dau_gia_id=@id AND b.trang_thai='da_duyet' AND p.trang_thai IN ('da_kich_hoat','da_ket_thuc')`);
      const row=result.recordset[0];if(!row)return null;
      const outcome=await resultFor(tx,auctionId);
      return {...row,ket_qua:outcome};
      });
    },
    async expired(limit=50) {
      return (await request(await getPool()).input('limit',sql.Int,limit).query(`SELECT TOP(@limit) phien_dau_gia_id FROM dbo.PhienDauGia
        WHERE trang_thai='da_kich_hoat' AND thoi_gian_ket_thuc<=SYSUTCDATETIME() ORDER BY thoi_gian_ket_thuc,phien_dau_gia_id`)).recordset;
    },
    async processBid(event,{beforeCommit}={}) {
      const postId=await anchor(event.auctionId);
      return transaction(async tx=>{
        const prior=await findRequest(event.requestId,tx,true);assertSameBid(prior,event);if(prior)return prior;
        const auction=await locked(tx,event.auctionId,postId);
        const actor=await request(tx).input('user',sql.Int,event.userId).query('SELECT vai_tro FROM dbo.NguoiDung WITH (HOLDLOCK) WHERE nguoi_dung_id=@user');
        if(!actor.recordset[0])failReference('BIDDER_NOT_FOUND');
        const last=await request(tx).input('id',sql.Int,event.auctionId).input('user',sql.Int,event.userId).query(`SELECT MAX(thoi_gian_dat) AS last_at FROM dbo.LuotDatGia WITH (HOLDLOCK)
          WHERE phien_dau_gia_id=@id AND nguoi_dung_id=@user`);
        const now=await clock(tx);
        const decision=actor.recordset[0].vai_tro!=='nguoi_dung'?{accepted:false,code:'BIDDER_NOT_ALLOWED'}:
          auction.trang_thai_bai!=='da_duyet'?{accepted:false,code:'AUCTION_NOT_ACTIVE'}:
          evaluateBid({auction,bidderId:event.userId,amount:event.amount,now,lastBidAt:last.recordset[0].last_at});
        if(decision.accepted) {
          await request(tx).input('id',sql.Int,event.auctionId).input('user',sql.Int,event.userId).input('code',sql.VarChar(64),event.requestId)
            .input('amount',sql.VarChar(18),event.amount).input('at',sql.DateTime2(3),now).query(`INSERT dbo.LuotDatGia(phien_dau_gia_id,nguoi_dung_id,muc_gia,thoi_gian_dat,ma_yeu_cau)
              VALUES(@id,@user,CAST(@amount AS DECIMAL(18,0)),@at,@code)`);
          const updated=changed(await versionRequest(tx,auction).input('amount',sql.VarChar(18),event.amount).query(`UPDATE dbo.PhienDauGia SET gia_hien_tai=CAST(@amount AS DECIMAL(18,0))
            OUTPUT CONVERT(BINARY(8),inserted.row_version) AS row_version WHERE phien_dau_gia_id=@id AND row_version=@version AND trang_thai='da_kich_hoat'`));
          await history(tx,event.auctionId,event.userId,`Chấp nhận đặt giá: ${event.requestId}`,event.amount);
          if(decision.endsEarly)await finish(tx,{...auction,gia_hien_tai:event.amount,row_version:updated.row_version},{nguoi_dung_id:event.userId,muc_gia:event.amount},now,'dat_gia_toi_thieu');
        } else if(decision.closeExpired) {
          await finish(tx,auction,await topBid(tx,event.auctionId),now,'het_thoi_gian');
        }
        return saveDecision(tx,event,decision,now);
      },beforeCommit);
    },
    async closeExpired(auctionId,{beforeCommit}={}) {
      const postId=await anchor(auctionId);
      return transaction(async tx=>{
        const auction=await locked(tx,auctionId,postId);
        if(auction.trang_thai==='da_ket_thuc') {
          const prior=await resultFor(tx,auctionId);if(!prior)throw new Error('Phiên đã kết thúc thiếu kết quả; cần đối soát.');
          return prior;
        }
        if(auction.trang_thai!=='da_kich_hoat'||auction.trang_thai_bai!=='da_duyet')return null;
        const top=await topBid(tx,auctionId),now=await clock(tx);
        return finish(tx,auction,top,now,'het_thoi_gian');
      },beforeCommit);
    }
  };
}
