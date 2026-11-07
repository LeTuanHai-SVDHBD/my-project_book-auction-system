/** Presentation only: SQL states stay authoritative; dates describe the visible auction phase. */
const palette = {
  amber: ['#805300', '#fff5d6', '#ead49b'],
  green: ['#24613c', '#eaf6ee', '#badcc7'],
  red: ['#a12e38', '#fff0f1', '#edc5ca'],
  violet: ['#6540a0', '#f3edfc', '#d8c8ed'],
  blue: ['#195fa1', '#eaf3ff', '#bad5ef'],
  orange: ['#984509', '#fff0e3', '#edc6a8'],
  slate: ['#4c596b', '#edf0f4', '#ccd3dd'],
  cyan: ['#156478', '#e7f7fb', '#b4dce6'],
  teal: ['#11665e', '#e7f7f3', '#b1dbd2'],
  indigo: ['#444b9c', '#eef0ff', '#c9cef0'],
};
const entry = (label, tone, icon) => Object.freeze({ label, tone, icon, colors: palette[tone] });
export const STATUS = Object.freeze({
  unknown: entry('Chưa xác định', 'slate', '?'),
  pending: entry('Chờ kiểm duyệt', 'amber', '◷'),
  approved: entry('Đã duyệt · Chờ kích hoạt', 'green', '✓'),
  rejected: entry('Bị từ chối', 'red', '×'),
  scheduled: entry('Sắp bắt đầu', 'violet', '◷'),
  live: entry('Đang đấu giá', 'blue', '●'),
  closing: entry('Chờ chốt kết quả', 'orange', '◷'),
  ended: entry('Đã kết thúc', 'slate', '■'),
  cho_xac_nhan: entry('Chờ hai bên xác nhận', 'cyan', '◷'),
  hoan_tat: entry('Hoàn tất', 'teal', '✓'),
  cho_xu_ly: entry('Chờ xử lý', 'orange', '◷'),
  dang_xu_ly: entry('Đang xử lý', 'indigo', '↻'),
  da_xu_ly: entry('Đã xử lý', 'teal', '✓'),
  not_analyzed: entry('Chưa phân tích', 'slate', '—'),
  queued: entry('Đang chờ phân tích', 'amber', '◷'),
  running: entry('Đang phân tích', 'blue', '↻'),
  quota_paused: entry('Tạm dừng vì hạn mức', 'orange', '◷'),
  thanh_cong: entry('Đã phân tích', 'green', '✓'),
  chua_day_du: entry('Phân tích chưa đầy đủ', 'orange', '!'),
  that_bai: entry('Phân tích thất bại', 'red', '×'),
  da_chap_nhan: entry('Giá được chấp nhận', 'green', '✓'),
  bi_tu_choi: entry('Giá bị từ chối', 'red', '×'),
  bid_pending: entry('Đang chờ xử lý giá', 'amber', '◷'),
  connected: entry('Đã kết nối', 'green', '●'),
  syncing: entry('Đang đồng bộ', 'blue', '↻'),
  reconnecting: entry('Đang kết nối lại', 'orange', '↻'),
  co_nguoi_thang: entry('Có người thắng', 'teal', '✓'),
  khong_co_nguoi_thang: entry('Không có người thắng', 'slate', '—'),
  unread: entry('Chưa đọc', 'blue', '●'),
  read: entry('Đã đọc', 'slate', '✓'),
  ready: entry('Sẵn sàng', 'green', '✓'),
  down: entry('Chưa sẵn sàng', 'red', '×'),
  waiting: entry('Đang kiểm tra', 'amber', '◷'),
});
export function postStatus(post, now = Date.now()) {
  switch (post.trang_thai_phien ?? post.trang_thai) {
    case 'cho_kiem_duyet': return 'pending';
    case 'khong_dat_kiem_duyet': return 'rejected';
    case 'da_qua_kiem_duyet': return 'approved';
    case 'da_ket_thuc': return 'ended';
    case 'da_kich_hoat': {
      const start = Date.parse(post.thoi_gian_bat_dau), end = Date.parse(post.thoi_gian_ket_thuc);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return 'syncing';
      if (now < start) return 'scheduled';
      // Never imply a saved result before the server has closed the auction.
      return now >= end ? 'closing' : 'live';
    }
    default: return 'unknown';
  }
}
