/** Bộ lọc/cursor Admin: ưu tiên bài chờ duyệt trước bài từ chối, không trộn cursor hai nhóm. */
import {HttpError} from '../middlewares/errorHandler.js';
const invalid=()=>{throw new HttpError(400,'INVALID_MODERATION_FILTER','Bộ lọc hoặc vị trí danh sách kiểm duyệt không hợp lệ.');};
export function moderationQuery(query={}) {
  if(Object.keys(query).some(key=>!['status','before'].includes(key)))invalid();
  const reviewStatus=query.status??'all';if(!['all','pending','rejected'].includes(reviewStatus))invalid();
  let after=2147483647,reviewCursorRank=null;
  if(query.before!==undefined){
    if(typeof query.before!=='string')invalid();
    const match=/^(pending|rejected):([1-9]\d{0,9})$/.exec(query.before);if(!match)invalid();
    after=Number(match[2]);if(after>2147483647||reviewStatus!=='all'&&reviewStatus!==match[1])invalid();
    reviewCursorRank=match[1]==='pending'?0:1;
  }
  return {pending:true,reviewStatus,after,reviewCursorRank};
}
export function moderationPage(items) {
  const last=items.at(-1);
  return {items,nextBefore:items.length===30?`${last.trang_thai_phien==='cho_kiem_duyet'?'pending':'rejected'}:${last.bai_dang_id}`:null};
}
