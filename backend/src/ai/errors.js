/** Mã lỗi Gemini có hướng xử lý; chỉ giữ chẩn đoán thuộc allowlist, không lưu body/message từ provider. */
import {HttpError} from '../middlewares/errorHandler.js';
const messages={
  AI_KEY_INVALID:'Gemini từ chối API key. Kiểm tra GEMINI_API_KEY trong .env và khởi động lại API/worker.',
  AI_ACCESS_DENIED:'Gemini từ chối quyền truy cập. Kiểm tra quyền API key, project, giới hạn truy cập và quyền dùng model.',
  AI_BILLING_REQUIRED:'Gemini yêu cầu kiểm tra billing hoặc số dư của project. Không tự chạy lại liên tục.',
  AI_MODEL_NOT_FOUND:'Gemini không tìm thấy model/tài nguyên được yêu cầu. Kiểm tra GEMINI_MODEL và quyền truy cập của project.',
  AI_REQUEST_REJECTED:'Gemini từ chối đầu vào/cấu hình yêu cầu. Đối chiếu mã provider, tham số API và điều kiện project.',
  AI_QUOTA_EXCEEDED:'Gemini đã chạm giới hạn lượt/token hoặc quota. Kiểm tra hạn mức project trước khi thử lại.',
  AI_PROVIDER_UNAVAILABLE:'Dịch vụ Gemini tạm không khả dụng. Thử lại sau khi kiểm tra trạng thái dịch vụ.',
  AI_TIMEOUT:'Yêu cầu Gemini hết thời gian chờ. Kiểm tra kết nối hoặc AI_PROVIDER_TIMEOUT_MS.',
  AI_NETWORK_ERROR:'Không kết nối được Gemini. Kiểm tra mạng, DNS, proxy và chứng chỉ TLS của máy chạy worker.',
  AI_INVALID_RESPONSE:'Gemini trả dữ liệu không đúng JSON/hợp đồng. Chưa thể dùng để tính điểm.',
  AI_RESPONSE_TOO_LARGE:'Phản hồi Gemini vượt giới hạn đọc của ứng dụng.',
  AI_INCOMPLETE_RESPONSE:'Gemini chưa trả kết quả hoàn tất. Có thể phản hồi bị chặn hoặc chạm giới hạn đầu ra.',
  AI_PROVIDER_ERROR:'Chưa phân tích được bằng Gemini. Cần xem mã HTTP/provider để xác định nguyên nhân.'
};
const providerCodes=new Set(['INVALID_REQUEST','FAILED_PRECONDITION','PARAMETER_UNKNOWN','AUTHENTICATION','PAYMENT_REQUIRED','PERMISSION_DENIED','NOT_FOUND','MODEL_NOT_FOUND','RATE_LIMIT_EXCEEDED','QUOTA_EXCEEDED','TOO_MANY_REQUESTS','API_ERROR','UNIMPLEMENTED','SERVICE_UNAVAILABLE','DEADLINE_EXCEEDED','INVALID_ARGUMENT','UNAUTHENTICATED','RESOURCE_EXHAUSTED','INTERNAL','UNAVAILABLE','API_KEY_INVALID','API_KEY_EXPIRED','API_KEY_SERVICE_BLOCKED','API_KEY_HTTP_REFERRER_BLOCKED','API_KEY_IP_ADDRESS_BLOCKED','SERVICE_DISABLED','BILLING_DISABLED']);
const transports=new Set(['ENOTFOUND','EAI_AGAIN','ECONNRESET','ETIMEDOUT','ECONNREFUSED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','SELF_SIGNED_CERT_IN_CHAIN','CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT']);
const fields=new Set(['model','input','response_format','response_format.type','response_format.mime_type','response_format.schema','generation_config','generation_config.max_output_tokens','system_instruction','store','background','stream','tools']);
export const aiFailureMessage=code=>messages[code]||messages.AI_PROVIDER_ERROR;
export function safeAiDiagnostics(value={}){
  if(!value||typeof value!=='object')return {};
  const result={};if(Number.isInteger(value.http_status)&&value.http_status>=100&&value.http_status<=599)result.http_status=value.http_status;
  if(providerCodes.has(value.provider_code))result.provider_code=value.provider_code;
  if(transports.has(value.transport_code))result.transport_code=value.transport_code;
  if(fields.has(value.field))result.field=value.field;
  return result;
}
export function geminiFailure(code,details={}){const error=new HttpError(502,code,aiFailureMessage(code));error.aiDiagnostics=safeAiDiagnostics(details);return error;}
export function geminiHttpFailure(status,body){
  const error=body?.error,normalize=value=>typeof value==='string'?value.toUpperCase():'';
  const candidates=[...(Array.isArray(error?.details)?error.details.map(x=>normalize(x?.reason)):[]),normalize(error?.code),normalize(error?.status)];
  const providerCode=candidates.find(x=>providerCodes.has(x));
  const code=['API_KEY_INVALID','API_KEY_EXPIRED','AUTHENTICATION','UNAUTHENTICATED'].includes(providerCode)||status===401?'AI_KEY_INVALID'
    :status===402||['PAYMENT_REQUIRED','BILLING_DISABLED'].includes(providerCode)?'AI_BILLING_REQUIRED'
    :status===403?'AI_ACCESS_DENIED':status===404?'AI_MODEL_NOT_FOUND':status===429?'AI_QUOTA_EXCEEDED'
    :[408,504].includes(status)?'AI_TIMEOUT':status===503?'AI_PROVIDER_UNAVAILABLE':status>=400&&status<500?'AI_REQUEST_REJECTED':'AI_PROVIDER_ERROR';
  return geminiFailure(code,{http_status:status,provider_code:providerCode,field:error?.param});
}
export function formatAiFailure(info={}){
  info=info||{};const diagnostics=safeAiDiagnostics(info.provider_error),parts=[info.error_code||'AI_PROVIDER_ERROR'];
  if(diagnostics.http_status)parts.push(`HTTP ${diagnostics.http_status}`);if(diagnostics.provider_code)parts.push(`provider=${diagnostics.provider_code}`);
  if(diagnostics.transport_code)parts.push(`network=${diagnostics.transport_code}`);if(diagnostics.field)parts.push(`field=${diagnostics.field}`);
  return `${parts.join(' | ')} — ${aiFailureMessage(info.error_code)}`;
}
