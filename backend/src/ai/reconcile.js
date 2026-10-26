/** Bù enqueue bị lỡ sau COMMIT; mỗi phiên bản đã có kết quả, kể cả thất bại, không tự gọi AI lại liên tục. */
import {setTimeout as delay} from 'node:timers/promises';
export async function reconcileAi({model,service,config,signal,log=()=>{}}){
  while(!signal.aborted){
    try{if(config.configured)for(const postId of await model.pending()){if(signal.aborted)break;await service.enqueue(postId);}}
    catch(error){if(!signal.aborted)log(error,{component:'ai-reconcile'});}
    await delay(15000,undefined,{signal}).catch(()=>{});
  }
}
