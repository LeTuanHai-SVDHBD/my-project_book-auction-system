/** Materialize committed, durable domain records into a per-account inbox. No public Socket or chat body. */
import { HttpError } from "../middlewares/errorHandler.js";
// The existing history/decision/result rows are durable event sources. Reading on reconnect
// repairs a missed refresh without changing the auction transaction or SQL OUTPUT contracts.
export const notificationSources = `
 SELECT CONCAT('submission:',h.lich_su_id) AS nguon,'pending' AS loai,b.bai_dang_id AS doi_tuong_id,
 N'Có bài đăng chờ kiểm duyệt' AS tieu_de,N'Mở hồ sơ để đối chiếu sách và bằng chứng.' AS noi_dung,h.thoi_gian AS ngay_tao
 FROM dbo.LichSuDauGia h JOIN dbo.PhienDauGia p ON p.phien_dau_gia_id=h.phien_dau_gia_id JOIN dbo.BaiDang b ON b.bai_dang_id=p.bai_dang_id
 WHERE @admin=1 AND (h.hanh_dong=N'Tạo sách, bài đăng và phiên chờ kiểm duyệt' OR h.hanh_dong LIKE N'Đăng lại từ bài %' OR h.hanh_dong=N'Bổ sung thông tin/media và gửi kiểm duyệt lại; giữ lịch sử kiểm duyệt')
 UNION ALL
 SELECT CONCAT('review:',k.kiem_duyet_id),'mine',b.bai_dang_id,
 CASE WHEN k.ket_qua=N'Phê duyệt' THEN N'Bài đăng đã được duyệt' ELSE N'Bài đăng bị từ chối' END,
 N'Mở bài đăng để xem quyết định và hướng dẫn tiếp theo.',k.ngay_kiem_duyet
 FROM dbo.KiemDuyet k JOIN dbo.BaiDang b ON b.bai_dang_id=k.bai_dang_id WHERE b.nguoi_dung_id=@user
 UNION ALL
 SELECT CONCAT('result:',k.ket_qua_id),'catalog',b.bai_dang_id,N'Phiên đấu giá đã kết thúc',
 CASE WHEN k.nguoi_thang_dau_id=@user THEN N'Bạn là người thắng. Mở phiên để xem kết quả và giao dịch.' ELSE N'Kết quả đã được lưu. Mở phiên để xem chi tiết.' END,k.thoi_gian_ket_thuc
 FROM dbo.KetQuaDauGia k JOIN dbo.PhienDauGia p ON p.phien_dau_gia_id=k.phien_dau_gia_id JOIN dbo.BaiDang b ON b.bai_dang_id=p.bai_dang_id
 WHERE b.nguoi_dung_id=@user OR k.nguoi_thang_dau_id=@user
 UNION ALL
 SELECT CONCAT('message:',t.tin_nhan_id),'trades',c.giao_dich_id,N'Tin nhắn giao dịch mới',N'Bên còn lại đã gửi tin nhắn. Mở giao dịch để đọc.',t.thoi_gian_gui
 FROM dbo.TinNhan t JOIN dbo.CuocTroChuyen c ON c.cuoc_tro_chuyen_id=t.cuoc_tro_chuyen_id
 WHERE (@user=c.nguoi_mua_id OR @user=c.nguoi_ban_id) AND t.nguoi_gui_id<>@user
 UNION ALL
 SELECT CONCAT('confirm:',g.giao_dich_id,':buyer'),'trades',g.giao_dich_id,N'Người mua đã xác nhận hoàn tất',N'Mở giao dịch để xem xác nhận của hai bên.',g.thoi_gian_xac_nhan_mua
 FROM dbo.GiaoDich g WHERE g.nguoi_ban_id=@user AND g.thoi_gian_xac_nhan_mua IS NOT NULL
 UNION ALL
 SELECT CONCAT('confirm:',g.giao_dich_id,':seller'),'trades',g.giao_dich_id,N'Người bán đã xác nhận hoàn tất',N'Mở giao dịch để xem xác nhận của hai bên.',g.thoi_gian_xac_nhan_ban
 FROM dbo.GiaoDich g WHERE g.nguoi_mua_id=@user AND g.thoi_gian_xac_nhan_ban IS NOT NULL
 UNION ALL
 SELECT CONCAT('complaint:',k.khieu_nai_id),'complaints',k.khieu_nai_id,N'Có khiếu nại mới',N'Mở hồ sơ để xem bằng chứng và tiếp nhận xử lý.',k.ngay_khieu_nai FROM dbo.KhieuNai k WHERE @admin=1
 UNION ALL
 SELECT CONCAT('resolved:',k.khieu_nai_id),'complaints',k.khieu_nai_id,N'Khiếu nại đã có phản hồi',N'Mở hồ sơ để đọc kết quả xử lý của Admin.',k.ngay_xu_ly FROM dbo.KhieuNai k WHERE k.nguoi_khieu_nai_id=@user AND k.trang_thai='da_xu_ly'`;
export function createNotificationModel({ getPool, sql }) {
  const request = (target) =>
    target.request ? target.request() : new sql.Request(target);
  async function synchronize(user) {
    const tx = new sql.Transaction(await getPool());
    let started = false;
    try {
      await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
      started = true;
      const lock = await request(tx)
        .input(
          "resource",
          sql.NVarChar(255),
          `bookauction:inbox:${user.nguoi_dung_id}`,
        )
        .query(
          "DECLARE @r INT; EXEC @r=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000; SELECT @r AS result;",
        );
      if (lock.recordset[0].result < 0)
        throw new HttpError(
          503,
          "INBOX_BUSY",
          "Hộp thông báo đang cập nhật. Vui lòng thử lại.",
        );
      await request(tx)
        .input("user", sql.Int, user.nguoi_dung_id)
        .input("admin", sql.Bit, user.vai_tro === "admin").query(`
        INSERT dbo.ThongBao(nguoi_dung_id,nguon,loai,doi_tuong_id,tieu_de,noi_dung,ngay_tao)
        SELECT TOP(2147483647) @user,e.nguon,e.loai,e.doi_tuong_id,e.tieu_de,e.noi_dung,e.ngay_tao FROM (${notificationSources}) e
        WHERE NOT EXISTS(SELECT 1 FROM dbo.ThongBao n WHERE n.nguoi_dung_id=@user AND n.nguon=e.nguon) ORDER BY e.ngay_tao,e.nguon`);
      await tx.commit();
      started = false;
    } catch (error) {
      if (started)
        try {
          await tx.rollback();
        } catch {}
      throw error;
    }
  }
  return {
    async list(user, before = 2147483647) {
      await synchronize(user);
      const result = await request(await getPool())
        .input("user", sql.Int, user.nguoi_dung_id)
        .input("before", sql.Int, before).query(`
        SELECT TOP(30) thong_bao_id,loai,doi_tuong_id,tieu_de,noi_dung,ngay_tao,ngay_doc FROM dbo.ThongBao WHERE nguoi_dung_id=@user AND thong_bao_id<@before ORDER BY thong_bao_id DESC;
        SELECT COUNT(*) AS unread FROM dbo.ThongBao WHERE nguoi_dung_id=@user AND ngay_doc IS NULL;`);
      const items = result.recordsets[0];
      return {
        items,
        unread: result.recordsets[1][0].unread,
        nextBefore: items.length === 30 ? items.at(-1).thong_bao_id : null,
      };
    },
    async read(user, id) {
      const r = await request(await getPool())
        .input("user", sql.Int, user.nguoi_dung_id)
        .input("id", sql.Int, id)
        .query(
          "UPDATE dbo.ThongBao SET ngay_doc=COALESCE(ngay_doc,SYSUTCDATETIME()) WHERE nguoi_dung_id=@user AND thong_bao_id=@id; SELECT @@ROWCOUNT AS affected;",
        );
      if (!r.recordset[0].affected)
        throw new HttpError(
          404,
          "NOTIFICATION_NOT_FOUND",
          "Không tìm thấy thông báo.",
        );
      return { ok: true };
    },
  };
}
