/** Lỗi Cloudinary có thông báo tĩnh; không trả/log body provider hoặc thông tin xác thực. */
import {HttpError} from '../middlewares/errorHandler.js';
export const MEDIA_MESSAGES=Object.freeze({
 MEDIA_NOT_CONFIGURED:'Chưa cấu hình Cloudinary trên API. Kiểm tra CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY và CLOUDINARY_API_SECRET rồi khởi động lại API.',
 MEDIA_PROVIDER_TIMEOUT:'Cloudinary chưa trả xong phản hồi trong thời gian chờ. Chưa xác nhận được kết quả xử lý tệp.',
 MEDIA_PROVIDER_NETWORK:'Kết nối tới Cloudinary bị gián đoạn. Chưa xác nhận được kết quả xử lý tệp.',
 MEDIA_PROVIDER_AUTH:'Cloudinary từ chối quyền truy cập. Kiểm tra cấu hình Cloudinary trên máy chủ.',
 MEDIA_PROVIDER_LIMIT:'Cloudinary báo vượt hạn mức hoặc dung lượng cho phép. Kiểm tra giới hạn tài khoản và tệp.',
 MEDIA_PROVIDER_REJECTED:'Cloudinary từ chối tệp hoặc cấu hình tải lên. Kiểm tra định dạng video, dung lượng và tài khoản Cloudinary.',
 MEDIA_PROVIDER_ERROR:'Cloudinary tạm chưa xác nhận được tệp. Vui lòng thử lại sau.',
 INVALID_MEDIA_RESPONSE:'Cloudinary trả thông tin tệp không khớp. Chưa thể dùng tệp này.',
 MEDIA_DELETE_FAILED:'Cloudinary chưa xác nhận xóa tệp. Vui lòng thử lại sau.'
});
const transports=new Set(['ENOTFOUND','EAI_AGAIN','ECONNRESET','ETIMEDOUT','ECONNREFUSED','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_SOCKET','CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','SELF_SIGNED_CERT_IN_CHAIN','DEPTH_ZERO_SELF_SIGNED_CERT']);
export function safeMediaDiagnostics(value={}) {
 if(!value||typeof value!=='object')return {};
 const safe={};if(['upload','recover','destroy'].includes(value.operation))safe.operation=value.operation;
 if(Number.isInteger(value.http_status)&&value.http_status>=100&&value.http_status<=599)safe.http_status=value.http_status;
 if(transports.has(value.transport_code))safe.transport_code=value.transport_code;
 return safe;
}
export function mediaFailure(code,details={}) {const error=new HttpError(code==='MEDIA_NOT_CONFIGURED'?503:502,code,MEDIA_MESSAGES[code]||MEDIA_MESSAGES.MEDIA_PROVIDER_ERROR);error.publicMediaError=Object.hasOwn(MEDIA_MESSAGES,code);error.mediaDiagnostics=safeMediaDiagnostics(details);return error;}
export const recoverableMediaError=error=>['MEDIA_PROVIDER_TIMEOUT','MEDIA_PROVIDER_NETWORK','MEDIA_PROVIDER_ERROR'].includes(error.code);
