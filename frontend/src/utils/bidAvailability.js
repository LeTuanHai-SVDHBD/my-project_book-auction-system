/** Đếm chờ từ đồng hồ SQL và thời gian đơn điệu của trình duyệt, không dùng giờ trên máy người mua. */
export function observeBidStatus(row,observedAt) {
  const serverTime=Date.parse(row.server_time);
  const nextTime=row.duoc_dat_lai_luc===null?serverTime:Date.parse(row.duoc_dat_lai_luc);
  if(typeof row.la_chu_sach!=='boolean'||!Number.isFinite(serverTime)||!Number.isFinite(nextTime)||!Number.isFinite(observedAt)) {
    throw new Error('Chưa xác định được điều kiện đặt giá. Hãy tải lại phiên.');
  }
  return {...row,observedAt,waitMs:Math.max(0,nextTime-serverTime)};
}
export function remainingBidSeconds(status,now) {
  return status?Math.ceil(Math.max(0,status.waitMs-Math.max(0,now-status.observedAt))/1000):0;
}
