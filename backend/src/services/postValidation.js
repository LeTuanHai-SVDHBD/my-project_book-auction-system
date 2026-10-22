/** Hợp đồng bài đăng: tên trường theo schema, tiền VND nguyên dưới dạng chuỗi, lịch có múi giờ. */
import { HttpError } from '../middlewares/errorHandler.js';
const bad = message => { throw new HttpError(400, 'INVALID_POST_INPUT', message); };
export function object(value, allowed, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) bad(`${name} không hợp lệ.`);
  if (Object.keys(value).some(key => !allowed.includes(key))) bad(`${name} có trường không được phép.`);
  return value;
}
function text(value, max, name, required = false) {
  if (value === undefined || value === null || value === '') { if (required) bad(`Thiếu ${name}.`); return null; }
  if (typeof value !== 'string' || value.trim().length > max || !value.trim() || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) bad(`${name} không hợp lệ (tối đa ${max} ký tự).`);
  return value.trim();
}
export function id(value) {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > 2147483647) bad('Mã đối tượng không hợp lệ.');
  return Number(value);
}
export function uuid(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) bad('Mã yêu cầu/upload phải là UUID v4.');
  return value.toLowerCase();
}
export function version(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{16}$/i.test(value)) bad('Thiếu phiên bản dữ liệu. Hãy tải lại bài đăng.');
  return value.toUpperCase();
}
function money(value, name) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,17}$/.test(value)) bad(`${name} phải là chuỗi số nguyên VND dương, tối đa 18 chữ số.`);
  return value;
}
export function validatePost(body, { mode = 'create', maxImages = 12, maxVideos = 3 } = {}) {
  object(body, ['ma_yeu_cau', 'sach', 'bai_dang', 'phien', 'media', 'reuse_media', 'row_version'], 'Bài đăng');
  if (body.reuse_media !== undefined && typeof body.reuse_media !== 'boolean') bad('reuse_media không hợp lệ.');
  const book = mode === 'create' ? object(body.sach, ['ten_sach','tac_gia','the_loai','nha_xuat_ban','nam_xuat_ban','isbn','tinh_trang_sach','mo_ta'], 'Sách') : null;
  if (mode !== 'create' && body.sach !== undefined) bad('Đăng lại/gửi duyệt lại không sửa bản ghi Sách dùng trong lịch sử.');
  const post = object(body.bai_dang, ['tieu_de','mo_ta_tinh_trang'], 'Nội dung bài đăng');
  const auction = object(body.phien, ['gia_khoi_diem','gia_toi_thieu','buoc_gia','thoi_gian_cho_dat_lai'], 'Thông số giá');
  const prices = { gia_khoi_diem: money(auction.gia_khoi_diem, 'Giá khởi điểm'),
    gia_toi_thieu: money(auction.gia_toi_thieu, 'Giá kết thúc sớm'), buoc_gia: money(auction.buoc_gia, 'Bước giá'),
    thoi_gian_cho_dat_lai: auction.thoi_gian_cho_dat_lai ?? 20 };
  if (BigInt(prices.gia_toi_thieu) < BigInt(prices.gia_khoi_diem)) bad('Giá kết thúc sớm phải lớn hơn hoặc bằng giá khởi điểm.');
  if (!Number.isInteger(prices.thoi_gian_cho_dat_lai) || prices.thoi_gian_cho_dat_lai < 10 || prices.thoi_gian_cho_dat_lai > 30) bad('Thời gian chờ đặt lại phải từ 10 đến 30 giây.');
  if (!Array.isArray(body.media) || body.media.length > maxImages + maxVideos) bad('Danh sách media không hợp lệ.');
  const media = body.media.map(item => {
    object(item, ['upload_id','tieu_de'], 'Media');
    return { upload_id: uuid(item.upload_id), tieu_de: text(item.tieu_de, 500, 'Tiêu đề media') };
  });
  if (new Set(media.map(item => item.upload_id)).size !== media.length) bad('Không lặp mã upload trong cùng bài đăng.');
  let normalizedBook;
  if (book) {
    normalizedBook = { ten_sach: text(book.ten_sach, 300, 'Tên sách', true), tac_gia: text(book.tac_gia, 200, 'Tác giả'),
      the_loai: text(book.the_loai, 100, 'Thể loại'), nha_xuat_ban: text(book.nha_xuat_ban, 200, 'Nhà xuất bản'),
      tinh_trang_sach: text(book.tinh_trang_sach, 1000, 'Tình trạng sách', true), mo_ta: text(book.mo_ta, 12000, 'Mô tả sách'),
      nam_xuat_ban: book.nam_xuat_ban ?? null, isbn: text(book.isbn, 13, 'ISBN') };
    if (normalizedBook.nam_xuat_ban !== null && (!Number.isInteger(normalizedBook.nam_xuat_ban) || normalizedBook.nam_xuat_ban < 1 || normalizedBook.nam_xuat_ban > 9999)) bad('Năm xuất bản phải từ 1 đến 9999.');
    if (normalizedBook.isbn && !/^(?:\d{13}|\d{9}[\dX])$/.test(normalizedBook.isbn)) bad('ISBN cần 13 chữ số hoặc ISBN-10 hợp lệ về định dạng.');
  }
  return { requestId: mode === 'resubmit' ? null : uuid(body.ma_yeu_cau), book: normalizedBook,
    post: { tieu_de: text(post.tieu_de, 300, 'Tiêu đề bài đăng', true), mo_ta_tinh_trang: text(post.mo_ta_tinh_trang, 12000, 'Mô tả tình trạng bản sách', true) },
    prices, media, reuseMedia: mode !== 'create' && body.reuse_media === true,
    rowVersion: mode === 'resubmit' ? version(body.row_version) : null };
}
export function validateReview(body) {
  object(body, ['quyet_dinh','ly_do','xac_nhan_quy_hiem','row_version'], 'Kiểm duyệt');
  if (!['phe_duyet','tu_choi'].includes(body.quyet_dinh)) bad('Quyết định kiểm duyệt không hợp lệ.');
  if (body.quyet_dinh === 'phe_duyet' && body.xac_nhan_quy_hiem !== true) bad('Admin cần xác nhận đã kiểm tra bằng chứng về yếu tố quý hiếm.');
  return { decision: body.quyet_dinh, reason: text(body.ly_do, 8000, 'Căn cứ và lý do kiểm duyệt', true), rowVersion: version(body.row_version) };
}
export function validateActivation(body) {
  object(body, ['thoi_gian_bat_dau','thoi_gian_ket_thuc','row_version'], 'Lịch đấu giá');
  function date(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)) || Number(value.slice(0,4))<1) bad('Lịch cần thời điểm ISO có múi giờ.');
    const calendar=new Date(value.slice(0,10)+'T00:00:00.000Z');
    if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0,10)!==value.slice(0,10)) bad('Ngày trong lịch không hợp lệ.');
    return new Date(value);
  }
  const start = date(body.thoi_gian_bat_dau); const end = date(body.thoi_gian_ket_thuc);
  if (end <= start) bad('Thời gian kết thúc phải sau thời gian bắt đầu.');
  return { start, end, rowVersion: version(body.row_version) };
}
