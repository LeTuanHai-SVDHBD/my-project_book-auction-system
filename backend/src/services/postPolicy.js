/** Quy tắc chuyển trạng thái; chỉ gọi sau khi model đã lấy khóa SQL. */
import {HttpError} from '../middlewares/errorHandler.js';
export function assertVersion(row,expected) {
  if(row.row_version!==expected)throw new HttpError(409,'POST_CONFLICT','Bài đăng đã thay đổi. Hãy tải lại trước khi thao tác.');
}
export function assertStatePair(row,postState,auctionState,message) {
  if(row.trang_thai!==postState||row.trang_thai_phien!==auctionState)throw new HttpError(409,'POST_CONFLICT',message);
}
export function canRelist({sourceId,latestId,state,outcome}) {
  return sourceId===latestId&&state==='da_ket_thuc'&&outcome?.trang_thai==='khong_co_nguoi_thang'&&outcome.nguoi_thang_dau_id===null;
}
export function assertRelistable(input) {
  if(!canRelist(input))throw new HttpError(409,'POST_CONFLICT','Chỉ đăng lại phiên mới nhất của sách đã kết thúc và có kết quả không có người thắng.');
}

/** Image count has no per-listing business cap; video count includes reused media. */
export function assertVideoLimit(items,maxVideos) {
  if(items.filter(item=>item.kind==='video').length>maxVideos)throw new HttpError(400,'MEDIA_COUNT',`Tối đa ${maxVideos} video cho mỗi bài đăng.`);
}
