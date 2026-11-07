/** Recover pending submissions from SQL after a restart or a Redis outage. */
import {setTimeout as delay} from 'node:timers/promises';
export async function enqueueAutoReviews({posts,model,queue,signal,quota,log=()=>{}}) {
  if(quota&&await quota.until()>Date.now())return;
  for (const candidate of await model.autoCandidates()) {
    if (signal.aborted) break;
    try {
      const active=await queue.status(candidate.bai_dang_id);
      if(active?.source_version===candidate.row_version&&active.trigger==='auto'&&['queued','running'].includes(active.state))continue;
      const row=await posts.detail(candidate.bai_dang_id,{admin:true});
      if(row.row_version===candidate.row_version&&row.trang_thai_phien==='cho_kiem_duyet')await queue.enqueue(row,'auto');
    } catch(error) {
      if(error.status!==404)log(error,{component:'auto-moderation-enqueue',postId:candidate.bai_dang_id});
    }
  }
}
export async function runAutoModeration(options) {
  const {signal,log=()=>{}}=options;
  while(!signal.aborted){
    try{await enqueueAutoReviews(options);}catch(error){if(!signal.aborted)log(error,{component:'auto-moderation-scan'});}
    await delay(10000,undefined,{signal}).catch(()=>{});
  }
}
