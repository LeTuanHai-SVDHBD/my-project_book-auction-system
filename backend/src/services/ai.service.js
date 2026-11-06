/** Admission/đọc phân tích riêng; Gemini chạy ở worker, không trong giao dịch đăng sách. */
import {HttpError} from '../middlewares/errorHandler.js';
import {analysisView} from '../ai/input.js';
import {aiFailureMessage} from '../ai/errors.js';
import {ownerAiResult} from './aiPresentation.js';
const pendingReview=row=>row.trang_thai_phien==='cho_kiem_duyet';
const hasAttempt=row=>Boolean(row.ai&&!row.ai.loi_thoi&&row.ai.thong_tin?.source_version===row.row_version);
const activeJob=job=>['queued','running'].includes(job?.state);
export function createAiService({posts,model,queue,config}) {
  return {
    async enqueueSubmission(postId){
      if(!config.autoModeration||!config.configured)return;
      const row=await posts.detail(postId,{admin:true});
      if(pendingReview(row))await queue.enqueue(row,'auto');
    },
    async request(postId,user,sourceVersion){
      if(!config.configured)throw new HttpError(503,'AI_NOT_CONFIGURED','Gemini chưa bật hoặc chưa cấu hình. Bài vẫn chờ kiểm duyệt.');
      const row=await posts.detail(postId,{owner:user.nguoi_dung_id,admin:user.vai_tro==='admin'});
      if(row.row_version!==sourceVersion||!pendingReview(row))throw new HttpError(409,'AI_POST_CHANGED','Bài đã thay đổi hoặc không còn chờ duyệt. Hãy tải lại chi tiết.');
      if(config.autoModeration&&!hasAttempt(row))throw new HttpError(409,'AI_FIRST_ANALYSIS_AUTOMATIC','Hệ thống sẽ tự chạy lần phân tích đầu tiên.');
      // A retry uses the same trigger and deduplication key as the scheduler.
      return queue.enqueue(row,config.autoModeration?'auto':'manual');
    },
    async status(postId,user,analysisId=null){
      const row=await posts.detail(postId,{owner:user.nguoi_dung_id,admin:user.vai_tro==='admin'});
      if(user.vai_tro!=='admin'){
        const analysis=ownerAiResult(row.ai,row);
        if(analysisId&&analysis?.phan_tich_id!==analysisId)throw new HttpError(404,'AI_NOT_FOUND','Không tìm thấy kết quả AI đã công bố cho lần kiểm duyệt này.');
        return {configured:config.configured,job:null,analysis,history:[]};
      }
      let raw=analysisId?await model.get(postId,analysisId):row.ai;
      if(analysisId&&!raw)throw new HttpError(404,'AI_NOT_FOUND','Không tìm thấy lần phân tích của bài này.');
      let job=null;try{job=await queue.status(postId);}catch{/* Kết quả đã lưu SQL vẫn đọc được khi Redis lỗi. */}
      if(job?.trigger!==(config.autoModeration?'auto':'manual'))job=null;
      if(!analysisId&&job?.source_version===row.row_version&&job.analysis_id&&raw?.phan_tich_id!==job.analysis_id)raw=await model.get(postId,job.analysis_id);
      const currentJob=job?.source_version===row.row_version?job:null;
      let analysis=raw?.thong_tin?raw:analysisView(raw,row);
      if(analysis?.trang_thai==='that_bai'&&analysis.thong_tin){
        // Refresh guidance for failed records saved before automatic moderation.
        analysis={...analysis,thong_tin:{...analysis.thong_tin,warnings:[aiFailureMessage(analysis.thong_tin.error_code)]}};
      }
      const canRetry=config.configured&&pendingReview(row)&&hasAttempt(row)&&!activeJob(currentJob);
      return {configured:config.configured,job:currentJob,can_retry:canRetry,analysis,history:await model.history(postId)};
    }
  };
}
