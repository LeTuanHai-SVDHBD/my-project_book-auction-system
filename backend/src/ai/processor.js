/** Tính/lưu kết quả tách biệt vòng đời duyệt; replay dùng SQL receipt hoặc cache, không thay quyết định Admin. */
import {scoreObservations} from './scoring.js';
import {RULE_VERSION} from './criteria.js';
export function createAiProcessor({posts,model,queue,provider,locks,config,signal}) {
  return async job=>{
    const stored=await model.find(job);if(stored){await queue.update(job,{state:'done',analysisId:stored.phan_tich_id});return;}
    const lease=await locks.acquire(job.postId);if(!lease)throw Error('AI_BUSY');
    try{
      if(job.trigger!=='manual'&&model.forVersion){const existing=await model.forVersion(job);if(existing){await queue.update(job,{state:'done',analysisId:existing.phan_tich_id});return;}}
      let row;try{row=await posts.detail(job.postId,{admin:true});}catch(error){if(error.status===404){await queue.update(job,{state:'skipped'});return;}throw error;}
      if(!config.configured||row.row_version!==job.sourceVersion||row.trang_thai_phien!=='cho_kiem_duyet'){await queue.update(job,{state:'skipped'});return;}
      let cached=await queue.get(job.requestId),result=cached?.result,metadata=cached?.metadata;
      if(!result){
        await queue.update(job,{state:'running'});
        const base={request_id:job.requestId,input_hash:job.inputHash,source_version:job.sourceVersion,rule_version:RULE_VERSION,model:config.model,trigger:job.trigger};
        try{
          const response=await provider.analyze(row,AbortSignal.any([AbortSignal.timeout(config.jobTimeout),...(signal?[signal]:[])]));
          result=scoreObservations(response.observations,{mediaIds:response.mediaIds,sourceUrls:response.sourceUrls});
          const warnings=[...result.canh_bao,...response.warnings];if(warnings.length)result.trang_thai='chua_day_du';
          metadata={...base,model:response.providerModel,media:response.manifest,warnings};
        }catch(error){if(signal?.aborted)throw error;result={diem_do_hiem:null,diem_tinh_trang:null,trang_thai:'that_bai',chi_tiet:[]};metadata={...base,error_code:error.code||'AI_INVALID_RESPONSE',warnings:['Phân tích thất bại; không thay thế bằng điểm 0. Admin có thể thử lại hoặc kiểm duyệt thủ công.']};}
        cached=await queue.update(job,{state:'running',result,metadata});
      }
      try{
        const saved=await model.save(job,result,metadata,async()=>{if(!await lease.renew())throw Error('AI_LEASE_LOST');});
        await queue.update(job,{state:'done',analysisId:saved.phan_tich_id});
      }catch(error){if(error.code==='AI_INPUT_CHANGED')await queue.update(job,{state:'skipped'});else throw error;}
    }finally{await lease.release();}
  };
}
