/** Admission/đọc phân tích riêng; Gemini chạy ở worker, không trong giao dịch đăng sách. */
import {HttpError} from '../middlewares/errorHandler.js';
import {analysisView} from '../ai/input.js';
export function createAiService({posts,model,queue,config}) {
  async function enqueue(postId){if(!config.configured)return null;const row=await posts.detail(postId,{admin:true});return row.trang_thai_phien==='cho_kiem_duyet'?queue.enqueue(row):null;}
  return {enqueue,
    async request(postId,user,sourceVersion){
      if(!config.configured)throw new HttpError(503,'AI_NOT_CONFIGURED','Gemini chưa bật hoặc chưa cấu hình. Admin vẫn có thể kiểm duyệt thủ công.');
      const row=await posts.detail(postId,{owner:user.nguoi_dung_id,admin:user.vai_tro==='admin'});
      if(row.row_version!==sourceVersion||row.trang_thai_phien!=='cho_kiem_duyet')throw new HttpError(409,'AI_POST_CHANGED','Bài đã thay đổi hoặc không còn chờ duyệt. Hãy tải lại chi tiết.');
      return queue.enqueue(row,{manual:true});
    },
    async status(postId,user,analysisId=null){
      const row=await posts.detail(postId,{owner:user.nguoi_dung_id,admin:user.vai_tro==='admin'});
      let raw=analysisId?await model.get(postId,analysisId):row.ai;
      if(analysisId&&!raw)throw new HttpError(404,'AI_NOT_FOUND','Không tìm thấy lần phân tích của bài này.');
      let job=null;try{job=await queue.status(postId);}catch{/* SQL và kiểm duyệt thủ công vẫn dùng được khi Redis lỗi. */}
      if(!analysisId&&job?.source_version===row.row_version&&job.analysis_id&&raw?.phan_tich_id!==job.analysis_id)raw=await model.get(postId,job.analysis_id);
      return {configured:config.configured,job:job?.source_version===row.row_version?job:null,analysis:raw?.thong_tin?raw:analysisView(raw,row),history:await model.history(postId)};
    }
  };
}
