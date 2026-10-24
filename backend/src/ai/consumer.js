/** Consumer AI độc lập; lỗi SQL giữ pending, reclaim sau 3 phút, không chặn các vòng đặt giá/chốt hạn. */
import {setTimeout as delay} from 'node:timers/promises';
import {AI_QUEUE} from './queue.js';
export async function ensureAiGroup(client,settings=AI_QUEUE){try{await client.xGroupCreate(settings.stream,settings.group,'0',{MKSTREAM:true});}catch(error){if(!String(error.message).includes('BUSYGROUP'))throw error;}}
export async function processAiMessage({client,message,handle,settings=AI_QUEUE,log=()=>{}}){
  let job;
  try{job=JSON.parse(message.message.event);if(!job||Object.keys(job).some(key=>!['requestId','postId','sourceVersion','inputHash','state','trigger'].includes(key))||!['auto','manual'].includes(job.trigger)||job.state!=='queued'||!Number.isInteger(job.postId)||job.postId<1||job.postId>2147483647||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(job.requestId)||!/^[0-9A-F]{16}$/.test(job.sourceVersion)||!/^[a-f0-9]{64}$/.test(job.inputHash))throw Error('INVALID_AI_JOB');}
  catch{await client.multi().xAdd(settings.prefix+'dead','*',{streamId:message.id,reason:'INVALID_AI_JOB'}).xAck(settings.stream,settings.group,message.id).xDel(settings.stream,message.id).exec();return;}
  try{await handle(job);await client.multi().xAck(settings.stream,settings.group,message.id).xDel(settings.stream,message.id).exec();}
  catch(error){log(error,{component:'ai-consumer',requestId:job.requestId});}
}
export async function consumeAi({client,reader,consumer,signal,handle,settings=AI_QUEUE,log=()=>{}}){
  let reclaimedAt=0,cursor='0-0';
  while(!signal.aborted)try{
    if(Date.now()-reclaimedAt>5000){const claimed=await client.xAutoClaim(settings.stream,settings.group,consumer,180000,cursor,{COUNT:1});cursor=claimed.nextId;reclaimedAt=Date.now();for(const message of claimed.messages)if(!signal.aborted)await processAiMessage({client,message,handle,settings,log});}
    const streams=await reader.xReadGroup(settings.group,consumer,{key:settings.stream,id:'>'},{COUNT:1,BLOCK:1000});
    for(const stream of streams||[])for(const message of stream.messages)if(!signal.aborted)await processAiMessage({client,message,handle,settings,log});
  }catch(error){if(!signal.aborted){log(error,{component:'ai-reader'});await delay(1000,undefined,{signal}).catch(()=>{});}}
}
