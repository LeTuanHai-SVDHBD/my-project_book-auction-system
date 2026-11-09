/** Publish a result from the completed review round; provider diagnostics stay with Admin. */
import {currentReview} from '../../../shared/aiVisibility.js';
const timestamp = value => value == null ? NaN : new Date(value).getTime();
export function ownerAiResult(analysis, post) {
  const review = currentReview(post);
  if (!review || !analysis || analysis.loi_thoi !== false) return null;
  if (review.phan_tich_id != null && review.phan_tich_id !== analysis.phan_tich_id) return null;
  const analyzedAt = timestamp(analysis.ngay_phan_tich), decidedAt = timestamp(review.ngay_kiem_duyet);
  const previous = post.kiem_duyet[1];
  const previousAt = previous ? timestamp(previous.ngay_kiem_duyet) : -Infinity;
  if (!Number.isFinite(analyzedAt) || !Number.isFinite(decidedAt) || Number.isNaN(previousAt) || analyzedAt > decidedAt || (review.phan_tich_id == null && analyzedAt <= previousAt)) return null;
  const failed = analysis.trang_thai === 'that_bai';
  return {
    phan_tich_id: analysis.phan_tich_id, trang_thai: analysis.trang_thai, ngay_phan_tich: analysis.ngay_phan_tich,
    diem_do_hiem: failed ? null : analysis.diem_do_hiem, diem_tinh_trang: failed ? null : analysis.diem_tinh_trang,
    loi_thoi: false, tinh_diem: failed ? null : analysis.tinh_diem, chi_tiet: failed ? [] : analysis.chi_tiet,
    thong_tin: failed ? {warnings:['AI chưa phân tích thành công. Vui lòng xem quyết định và lý do kiểm duyệt.']}
      : {rule_version:analysis.thong_tin?.rule_version, moderation:analysis.thong_tin?.moderation, media:analysis.thong_tin?.media, warnings:analysis.thong_tin?.warnings}
  };
}

export function publicAiResult(analysis, post) {
  const review = currentReview(post);
  if (!['da_kich_hoat', 'da_ket_thuc'].includes(post.trang_thai_phien)
    || review?.ket_qua !== 'Phê duyệt' || review.phan_tich_id == null) return null;
  const current = ownerAiResult(analysis, post);
  if (!current || !['thanh_cong', 'chua_day_du'].includes(current.trang_thai)) return null;
  return {
    diem_do_hiem: current.diem_do_hiem,
    diem_tinh_trang: current.diem_tinh_trang,
    ngay_phan_tich: current.ngay_phan_tich,
    chi_tiet: (current.chi_tiet || []).map(row => {
      let media = [];
      try {
        const refs = JSON.parse(row.nguon_doi_chieu)?.media;
        if (Array.isArray(refs)) media = refs.filter(ref => typeof ref === 'string' && /^M[1-9]\d{0,4}$/.test(ref));
      } catch { /* Legacy evidence may not have structured references. */ }
      return {
        tieu_chi: row.tieu_chi, trang_thai_danh_gia: row.trang_thai_danh_gia,
        diem: row.diem, trong_so: row.trong_so, bang_chung: row.bang_chung,
        nguon_doi_chieu: JSON.stringify({ media }),
      };
    }),
  };
}
