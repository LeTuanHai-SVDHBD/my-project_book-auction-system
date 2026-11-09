import {COMPLAINT_OUTCOMES} from '../../../shared/complaints.js';
/** Quyền sau phiên và đầu vào chặt chẽ; danh tính, đối tác, trạng thái và giờ không lấy từ client. */
import {HttpError} from '../middlewares/errorHandler.js';
import {object,uuid} from './postValidation.js';
export const missing=()=>{throw new HttpError(404,'COMMUNITY_NOT_FOUND','Không tìm thấy dữ liệu bạn được phép xem.');};
export const conflict=message=>{throw new HttpError(409,'COMMUNITY_CONFLICT',message);};
export function participant(row,user){if(!row||user.vai_tro!=='nguoi_dung'||![row.nguoi_mua_id,row.nguoi_ban_id].includes(user.nguoi_dung_id))missing();}
export function assertTrade(row){
  if(row.ket_qua_trang_thai!=='co_nguoi_thang'||row.trang_thai_phien!=='da_ket_thuc'||row.nguoi_mua_id!==row.nguoi_thang_dau_id||row.nguoi_ban_id!==row.chu_bai_id||row.so_tien!==row.gia_thang||row.nguoi_mua_id===row.nguoi_ban_id)conflict('Liên kết giao dịch/kết quả không nhất quán; cần đối soát.');
}
export function assertConversation(chat,trade){if(!chat||chat.nguoi_mua_id!==trade.nguoi_mua_id||chat.nguoi_ban_id!==trade.nguoi_ban_id||chat.giao_dich_id!==trade.giao_dich_id)conflict('Cuộc trò chuyện không khớp hai bên giao dịch.');}
export function assertReview(row,user){participant(row,user);if(user.nguoi_dung_id!==row.nguoi_mua_id||row.trang_thai!=='hoan_tat'||!row.thoi_gian_xac_nhan_mua||!row.thoi_gian_xac_nhan_ban)throw new HttpError(403,'REVIEW_NOT_ALLOWED','Chỉ người mua được đánh giá sau khi đủ hai xác nhận hoàn tất.');}
export function assertComment(row){if(!row)missing();if(row.trang_thai!=='da_kich_hoat'||!row.thoi_gian_bat_dau||!row.thoi_gian_ket_thuc||new Date(row.server_time)<new Date(row.thoi_gian_bat_dau)||new Date(row.server_time)>=new Date(row.thoi_gian_ket_thuc))conflict('Chỉ bình luận khi phiên đang diễn ra.');}
export function complaintReader(item,user,trade){
  if(!item)missing();
  if(user.vai_tro==='admin')return;
  participant(trade,user);
  if(!item.han_giai_trinh&&item.nguoi_khieu_nai_id!==user.nguoi_dung_id)missing();
}
export function responsePending(item,now){
  return Boolean(item.han_giai_trinh&&!item.ngay_giai_trinh&&item.trang_thai!=='da_xu_ly'&&new Date(now)<new Date(item.han_giai_trinh));
}
export function assertComplaintResponse(item,user,trade,now){
  complaintReader(item,user,trade);
  if(user.vai_tro!=='nguoi_dung'||user.nguoi_dung_id===item.nguoi_khieu_nai_id)missing();
  if(!responsePending(item,now))conflict('Hồ sơ đã có giải trình, hết hạn phản hồi hoặc đã đóng.');
}
export function validateComplaintDecision(body){
  object(body,['phan_hoi_admin','ket_luan','ghi_chu_noi_bo'],'Kết quả xử lý');
  if(typeof body.ket_luan!=='string'||!Object.hasOwn(COMPLAINT_OUTCOMES,body.ket_luan))
    throw new HttpError(400,'INVALID_COMPLAINT_OUTCOME','Hãy chọn kết luận xử lý.');
  return {reply:text(body.phan_hoi_admin,8000),outcome:body.ket_luan,note:text(body.ghi_chu_noi_bo,8000,false)};
}
export function assignedAdmin(row,user){if(!row||user.vai_tro!=='admin'||row.admin_id!==user.nguoi_dung_id)throw new HttpError(403,'COMPLAINT_NOT_ASSIGNED','Admin cần tiếp nhận và được phân công khiếu nại này trước khi xem trao đổi hoặc xử lý.');}
export function text(value,max,required=true){if(value===undefined||value===null||value===''){if(!required)return null;throw new HttpError(400,'INVALID_COMMUNITY_INPUT','Thiếu nội dung bắt buộc.');}if(typeof value!=='string'||!value.trim()||value.trim().length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))throw new HttpError(400,'INVALID_COMMUNITY_INPUT',`Nội dung cần từ 1 đến ${max} ký tự hợp lệ.`);return value.trim();}
export function validateText(body,max){object(body,['noi_dung'],'Nội dung');return text(body.noi_dung,max);}
export function validateRating(body){object(body,['so_sao','noi_dung'],'Đánh giá');if(!Number.isInteger(body.so_sao)||body.so_sao<1||body.so_sao>5)throw new HttpError(400,'INVALID_RATING','Số sao phải là số nguyên từ 1 đến 5.');return {stars:body.so_sao,content:text(body.noi_dung,2000,false)};}
export function validateComplaint(body,response=false){object(body,response?['noi_dung','media']:['ly_do','noi_dung','media'],'Khiếu nại');if(!Array.isArray(body.media)||body.media.length>5)throw new HttpError(400,'INVALID_EVIDENCE','Tối đa 5 ảnh bằng chứng.');
  const media=body.media.map(item=>{object(item,['upload_id','tieu_de'],'Bằng chứng');return {upload_id:uuid(item.upload_id),tieu_de:text(item.tieu_de,500,false)};});
  if(new Set(media.map(x=>x.upload_id)).size!==media.length)throw new HttpError(400,'INVALID_EVIDENCE','Không lặp vé ảnh bằng chứng.');
  return {...(response?{}:{reason:text(body.ly_do,300)}),content:text(body.noi_dung,12000),media};
}
export const tradeView=row=>Object.fromEntries(['giao_dich_id','ma_giao_dich','ket_qua_id','phien_dau_gia_id','bai_dang_id','sach_id','ten_sach','tieu_de','nguoi_mua_id','nguoi_ban_id','ten_nguoi_mua','ten_nguoi_ban','so_tien','trang_thai','ngay_tao','ngay_hoan_tat','thoi_gian_xac_nhan_mua','thoi_gian_xac_nhan_ban'].map(key=>[key,row[key]]));
