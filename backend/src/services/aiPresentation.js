/** Publish a result from the completed review round; provider diagnostics stay with Admin. */
import {currentReview} from '../../../shared/aiVisibility.js';
const timestamp = value => value == null ? NaN : new Date(value).getTime();
export function ownerAiResult(analysis, post) {
  const review = currentReview(post);
  if (!review || !analysis || analysis.loi_thoi !== false) return null;
  const analyzedAt = timestamp(analysis.ngay_phan_tich), decidedAt = timestamp(review.ngay_kiem_duyet);
  const previous = post.kiem_duyet[1];
  const previousAt = previous ? timestamp(previous.ngay_kiem_duyet) : -Infinity;
  if (!Number.isFinite(analyzedAt) || !Number.isFinite(decidedAt) || Number.isNaN(previousAt) || analyzedAt > decidedAt || analyzedAt <= previousAt) return null;
  const failed = analysis.trang_thai === 'that_bai';
  return {
    phan_tich_id: analysis.phan_tich_id, trang_thai: analysis.trang_thai, ngay_phan_tich: analysis.ngay_phan_tich,
    diem_do_hiem: failed ? null : analysis.diem_do_hiem, diem_tinh_trang: failed ? null : analysis.diem_tinh_trang,
    loi_thoi: false, tinh_diem: failed ? null : analysis.tinh_diem, chi_tiet: failed ? [] : analysis.chi_tiet,
    thong_tin: failed ? {warnings:['AI chưa phân tích thành công. Vui lòng xem quyết định và lý do kiểm duyệt của Admin.']}
      : {rule_version:analysis.thong_tin?.rule_version, media:analysis.thong_tin?.media, warnings:analysis.thong_tin?.warnings}
  };
}
