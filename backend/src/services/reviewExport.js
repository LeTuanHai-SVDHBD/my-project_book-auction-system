/** Bản kết quả đã công bố cho người bán; chỉ lưu dữ liệu của đúng vòng kiểm duyệt. */
import {currentReview} from '../../../shared/aiVisibility.js';
import {bookReviewDescription} from '../../../shared/bookCondition.js';
import {ownerAiResult} from './aiPresentation.js';

const pick=(value,keys)=>Object.fromEntries(keys.map(key=>[key,value[key]??null]));
export function createReviewSnapshot(post) {
  const review=currentReview(post);
  if(!review)throw new Error('REVIEW_SNAPSHOT_WITHOUT_DECISION');
  return {
    version:1,
    post:pick(post,['bai_dang_id','ma_san_pham','tieu_de','mo_ta_tinh_trang']),
    book:{...pick(post,['sach_id','ten_sach','tac_gia','the_loai','nha_xuat_ban','nam_xuat_ban','isbn','mo_ta']),
      tinh_trang_va_bang_chung:bookReviewDescription(post)},
    review:pick(review,['kiem_duyet_id','ket_qua','phan_hoi_admin','ngay_kiem_duyet']),
    media:(post.media||[]).map(item=>pick(item,['kind','url','title'])),
    ai:ownerAiResult(post.ai,post),
  };
}

export function readReviewSnapshot(json,postId,reviewId) {
  const value=JSON.parse(json);
  if(value.version!==1||value.post?.bai_dang_id!==postId||value.review?.kiem_duyet_id!==reviewId||
    !['Phê duyệt','Từ chối'].includes(value.review.ket_qua))throw new Error('INVALID_REVIEW_SNAPSHOT');
  return value;
}
