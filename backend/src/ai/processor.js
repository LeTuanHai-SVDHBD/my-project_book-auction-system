/** Analyse a fixed source version; persist the automatic verdict with the score receipt. */
import {scoreObservations} from './scoring.js';
import {currentAnalysisId,inputHash} from './input.js';
import {moderationDecision} from './moderation.js';
import {RULE_VERSION} from './criteria.js';
import {aiFailureMessage,safeAiDiagnostics,safeAiExecution} from './errors.js';
import {isQuotaAnalysis,quotaResumeAt} from './quota.js';
export function createAiProcessor({posts,model,queue,provider,locks,quota,config,signal}) {
  return async job=>{
    const automatic=job.trigger==='auto';
    if(automatic!==Boolean(config.autoModeration)){await queue.update(job,{state:'skipped'});return;}
    const stored=await model.find(job);if(stored){await queue.update(job,{state:'done',analysisId:stored.phan_tich_id});return;}
    const lease=await locks.acquire(job.postId);if(!lease)throw Error('AI_BUSY');
    const ownership=new AbortController();let renewTimer,renewTask,stopped=false;
    const renew=async()=>{
      try{if(!await lease.renew())throw Error('AI_LEASE_LOST');}
      catch{ownership.abort(Error('AI_LEASE_LOST'));}
      if(!stopped&&!ownership.signal.aborted){renewTimer=setTimeout(()=>{renewTask=renew();},config.leaseRenewMs||15000);renewTimer.unref();}
    };
    renewTimer=setTimeout(()=>{renewTask=renew();},config.leaseRenewMs||15000);renewTimer.unref();
    const assertOwnership=()=>{ownership.signal.throwIfAborted();signal?.throwIfAborted();};
    try{
      let row;try{row=await posts.detail(job.postId,{admin:true});}catch(error){if(error.status===404){await queue.update(job,{state:'skipped'});return;}throw error;}
      if(!config.configured||row.row_version!==job.sourceVersion||row.trang_thai_phien!=='cho_kiem_duyet'||automatic&&inputHash(row)!==job.inputHash){await queue.update(job,{state:'skipped'});return;}
      const latestId=currentAnalysisId(row);
      // A background job may recover the first run; only an explicit retry can supersede a saved analysis.
      if((job.retryOf!==undefined&&job.retryOf!==latestId)
        ||(latestId&&job.retryOf===undefined&&(automatic||isQuotaAnalysis(row.ai)))){
        await queue.update(job,{state:'skipped'});return;
      }
      let cached=await queue.get(job.requestId),result=cached?.result,metadata=cached?.metadata;
      if(!result){
        await queue.update(job,{state:'running'});
        const base={request_id:job.requestId,input_hash:job.inputHash,source_version:job.sourceVersion,rule_version:RULE_VERSION,model:config.model,trigger:job.trigger};
        try{
          const response=await provider.analyze(row,AbortSignal.any([AbortSignal.timeout(config.jobTimeout),ownership.signal,...(signal?[signal]:[])]),{
            onProgress:progress=>queue.update(job,{state:'running',progress})
          });
          assertOwnership();
          result=scoreObservations(response.observations,{mediaIds:response.mediaIds,sourceUrls:response.sourceUrls});
          const warnings=[...result.canh_bao,...response.warnings];if(warnings.length)result.trang_thai='chua_day_du';
          metadata={...base,model:response.providerModel,media:response.manifest,execution:safeAiExecution(response.execution),warnings};
        }catch(error){assertOwnership();result={diem_do_hiem:null,diem_tinh_trang:null,trang_thai:'that_bai',chi_tiet:[]};metadata={...base,model:error.aiContext?.model||base.model,error_code:error.code||'AI_INVALID_RESPONSE',provider_error:safeAiDiagnostics(error.aiDiagnostics),
          media:(error.aiContext?.media||[]).filter(item=>row.media?.some(source=>source.url===item.url&&source.kind===item.kind)),execution:safeAiExecution(error.aiContext?.execution),
          warnings:[aiFailureMessage(error.code)]};
          if(error.code==='AI_QUOTA_EXCEEDED')metadata.retry_not_before=quotaResumeAt(error);
        }
        assertOwnership();
        cached=await queue.update(job,{state:'running',result,metadata});
      }
      try{
        assertOwnership();
        if(metadata.retry_not_before)await quota?.pauseUntil(metadata.retry_not_before);
        const verdict=automatic?moderationDecision(result,metadata,config.autoModeration):null;
        if(automatic)metadata={...metadata,moderation:{thresholds:config.autoModeration,decision:verdict?(verdict.approve?'approved':'rejected'):'retry'}};
        const saved=await model.save(job,result,metadata,async()=>{assertOwnership();if(!await lease.renew())throw Error('AI_LEASE_LOST');},verdict);
        await queue.update(job,{state:'done',analysisId:saved.phan_tich_id});
      }catch(error){if(error.code==='AI_INPUT_CHANGED')await queue.update(job,{state:'skipped'});else throw error;}
    }finally{stopped=true;clearTimeout(renewTimer);await renewTask;await lease.release();}
  };
}
