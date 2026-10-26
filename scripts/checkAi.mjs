/** Chẩn đoán trực tiếp Gemini bằng một lượt không ảnh; không cần SQL/Redis/API, chỉ in thông báo Google đã che khóa, không in toàn bộ provider body. */
import {config as loadEnv} from 'dotenv';
import {pathToFileURL} from 'node:url';
import {parseAiConfig} from '../backend/src/config/ai.js';
import {createGemini} from '../backend/src/ai/gemini.js';
import {scoreObservations} from '../backend/src/ai/scoring.js';
import {formatAiFailure} from '../backend/src/ai/errors.js';
export async function checkAi({env,fetchImpl,write=console.log}={}){
  if(!env){loadEnv({path:new URL('../.env',import.meta.url),quiet:true});env=process.env;}
  try{
    const config=parseAiConfig(env);write(`Model Gemini: ${config.model}`);
    if(!config.configured){write('FAIL AI_NOT_CONFIGURED — Cần AI_ENABLED=true và GEMINI_API_KEY trong .env gốc.');return 1;}
    write('Gọi Gemini một lần với văn bản mẫu, không gửi ảnh hoặc dữ liệu SQL.');
    const provider=createGemini({config,fetchImpl,onHttpError:details=>{if(details.message)write(`Google trả lời (đã che khóa): ${details.message}`);}});
    const response=await provider.analyze({ten_sach:'Kiểm tra kết nối Gemini',mo_ta_tinh_trang:'Mẫu không có ảnh. Không đủ căn cứ quan sát thì đánh dấu missing, không tự cho điểm.',media:[]});
    const result=scoreObservations(response.observations,{mediaIds:response.mediaIds,sourceUrls:response.sourceUrls});
    if(result.diem_do_hiem!==null||result.diem_tinh_trang!==null)throw Error('INVALID_NULL_TEST');
    write('PASS Gemini trả JSON dùng được; mẫu thiếu ảnh giữ hai điểm NULL. Chưa kiểm tra SQL/Redis hoặc chất lượng thẩm định ảnh.');return 0;
  }catch(error){write(`FAIL ${formatAiFailure({error_code:error.code||'AI_INVALID_RESPONSE',provider_error:error.aiDiagnostics})}`);return 1;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await checkAi();
