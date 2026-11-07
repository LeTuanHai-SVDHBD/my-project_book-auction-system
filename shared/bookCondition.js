/** One review description; retain distinct condition text from historical book records. */
export function bookReviewDescription(row) {
  const current = (row.mo_ta_tinh_trang || '').trim();
  const legacy = (row.tinh_trang_sach || '').trim();
  if (!legacy || current.includes(legacy)) return current;
  return current ? `${current}\n\nTình trạng đã lưu trước đây:\n${legacy}` : legacy;
}

/** Compatibility preview for Sach.NVARCHAR(1000); the full text stays on BaiDang. */
export function conditionPreview(description) {
  return description.slice(0, 1000).replace(/[\uD800-\uDBFF]$/, '').trimEnd();
}
