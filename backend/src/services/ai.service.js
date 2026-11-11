/** Admission/đọc phân tích riêng; Gemini chạy ở worker, không trong giao dịch đăng sách. */
import {analysisWorkload,averageAnalysisTime} from '../ai/timing.js';
import {RULE_VERSION} from '../ai/criteria.js';
import {HttpError} from '../middlewares/errorHandler.js';
import {analysisView,currentAnalysisId} from '../ai/input.js';
import {aiFailureMessage} from '../ai/errors.js';
import {ownerAiResult} from './aiPresentation.js';
import {isQuotaAnalysis,storedQuotaResumeAt} from '../ai/quota.js';
const pendingReview=row=>row.trang_thai_phien==='cho_kiem_duyet';
const activeJob=job=>['queued','running'].includes(job?.state);
export function createAiService({posts,model,queue,config,quota}) {
  const quotaTime=async row=>Math.max(currentAnalysisId(row)?storedQuotaResumeAt(row.ai):0,await quota?.until()||0);
  return {
    async enqueueSubmission(postId){
      if(!config.autoAnalysis||!config.configured)return;
      const row=await posts.detail(postId,{admin:true});
      if(pendingReview(row)&&!currentAnalysisId(row)&&await quotaTime(row)<=Date.now())await queue.enqueue(row,'auto');
    },
    async request(postId,user,sourceVersion){
      if(!config.configured)throw new HttpError(503,'AI_NOT_CONFIGURED','Gemini chưa bật hoặc chưa cấu hình. Bài vẫn chờ kiểm duyệt.');
      const row=await posts.detail(postId,{owner:user.nguoi_dung_id,admin:user.vai_tro==='admin'});
      if(row.row_version!==sourceVersion||!pendingReview(row))throw new HttpError(409,'AI_POST_CHANGED','Bài đã thay đổi hoặc không còn chờ duyệt. Hãy tải lại chi tiết.');
      const retryOf=currentAnalysisId(row)??undefined;
      if(config.autoAnalysis&&!retryOf)throw new HttpError(409,'AI_FIRST_ANALYSIS_AUTOMATIC','Hệ thống sẽ tự chạy lần phân tích đầu tiên.');
      const remaining=await quotaTime(row)-Date.now();
      if(remaining>0){
        const error=new HttpError(429,'AI_QUOTA_PAUSED','Gemini đang tạm dừng vì chạm giới hạn. Xem thời điểm có thể thử lại trong phần kiểm duyệt.');
        error.retryAfterSeconds=Math.ceil(remaining/1000);
        throw error;
      }
      return queue.enqueue(row,config.autoAnalysis?'auto':'manual',retryOf);
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
      if(job?.trigger!==(config.autoAnalysis?'auto':'manual'))job=null;
      const latestId=currentAnalysisId(row);
      if(config.autoAnalysis&&activeJob(job)&&(job.retry_of??null)!==latestId)job=null;
      if(!analysisId&&job?.source_version===row.row_version&&job.analysis_id&&raw?.phan_tich_id!==job.analysis_id)raw=await model.get(postId,job.analysis_id);
      const currentJob=job?.source_version===row.row_version?job:null;
      let analysis=raw?.thong_tin?raw:analysisView(raw,row);
      if(analysis?.trang_thai==='that_bai'&&analysis.thong_tin){
        // Refresh guidance for failed records saved before automatic moderation.
        analysis={...analysis,thong_tin:{...analysis.thong_tin,warnings:[aiFailureMessage(analysis.thong_tin.error_code)]}};
      }
      const waiting=pendingReview(row);
      const quotaLimited=waiting&&Boolean(latestId)&&isQuotaAnalysis(row.ai);
      let resumeAt=quotaLimited?storedQuotaResumeAt(row.ai):0;
      if(waiting&&config.configured)try{resumeAt=Math.max(resumeAt,await quota?.until()||0);}catch{/* Fall back to the saved attempt. */}
      const paused=resumeAt>Date.now();
      const canRetry=config.configured&&waiting&&Boolean(latestId)&&!activeJob(currentJob)&&!paused;
      let timing=null;
      try {
        const manifest=currentAnalysisId(row)?row.ai?.thong_tin?.media:[];
        const workload=currentJob?.progress?.workload||analysisWorkload(row,manifest);
        timing=averageAnalysisTime(workload,await model.timingSamples?.(config.model,RULE_VERSION)||[]);
      } catch { /* Thống kê không được chặn đọc kết quả hoặc quyết định của Admin. */ }
      return {timing,configured:config.configured,job:currentJob,can_retry:canRetry,quota_limited:quotaLimited,
        quota_resume_at:paused?resumeAt:null,analysis,history:await model.history(postId)};
    }
  };
}
