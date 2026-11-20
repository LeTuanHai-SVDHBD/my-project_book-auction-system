/** Seller AI is published only after the current moderation round has a decision. */
export function currentReview(post) {
  const latest = post.kiem_duyet?.[0];
  if (!latest) return null;
  const rejected = post.trang_thai_bai === 'tu_choi' && post.trang_thai_phien === 'khong_dat_kiem_duyet';
  const approved = post.trang_thai_bai === 'da_duyet' && ['da_qua_kiem_duyet', 'da_kich_hoat', 'da_ket_thuc'].includes(post.trang_thai_phien);
  return rejected && latest.ket_qua === 'Từ chối' || approved && latest.ket_qua === 'Phê duyệt' ? latest : null;
}
