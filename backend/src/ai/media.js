/** Chuẩn bị media song song có giới hạn, chọn theo thứ tự gốc để giữ ngân sách và mã bằng chứng. */
import {verifyMedia} from '../services/cloudinary.service.js';
import {boundedBytes} from './transport.js';
export async function prepareAiMedia({media,config,fetchImpl,signal,onProgress=async()=>{}}) {
  const started=Date.now(),deadline=AbortSignal.timeout(config.mediaPrepareTimeout||45000);
  const prepareSignal=AbortSignal.any([signal,deadline]),manifest=[],parts=[],mediaIds=[],warnings=[];let used=0;
  const reasons={budget:'vượt ngân sách media',prepare_timeout:'hết thời gian chuẩn bị media',download_timeout:'tải media hết thời gian chờ',untrusted:'URL không được phép',invalid:'định dạng media không hợp lệ',unavailable:'không tải được media'};
  const skip=(item,reason)=>{manifest.push({id:item.id,kind:item.kind,url:item.url,sent:false,reason});warnings.push(`Media ${item.id} chưa được phân tích: ${reasons[reason]}.`);};
  async function download(item,limit) {
    let response;
    try {
      const url=new URL(item.url);
      if(!['image','video'].includes(item.kind)||url.protocol!=='https:'||url.hostname!=='res.cloudinary.com'||url.username||url.password||url.port||!config.cloudName||!url.pathname.startsWith(`/${config.cloudName}/`))return {reason:'untrusted'};
      const requestSignal=AbortSignal.any([prepareSignal,AbortSignal.timeout(config.mediaDownloadTimeout||15000)]);
      response=await fetchImpl(url.href,{redirect:'error',signal:requestSignal});
      if(!response.ok){void response.body?.cancel().catch(()=>{});return {reason:'unavailable'};}
      const mime=(response.headers.get('content-type')||'').split(';')[0];
      if(!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(mime)||!mime.startsWith(item.kind+'/')){void response.body?.cancel().catch(()=>{});return {reason:'invalid'};}
      const bytes=await boundedBytes(response,limit,requestSignal);verifyMedia(bytes,mime,item.kind);return {bytes,mime};
    }catch(error){
      void response?.body?.cancel().catch(()=>{});
      return {reason:deadline.aborted?'prepare_timeout':['TimeoutError','AbortError'].includes(error.name)?'download_timeout':error.message==='AI_RESPONSE_TOO_LARGE'?'budget':'invalid'};
    }
  }
  await onProgress({phase:'media',media_completed:0,media_total:media.length});
  for(let offset=0;offset<media.length;) {
    signal.throwIfAborted();
    if(deadline.aborted||used>=config.mediaMaxBytes){for(const item of media.slice(offset))skip(item,deadline.aborted?'prepare_timeout':'budget');break;}
    const batch=media.slice(offset,offset+(config.mediaConcurrency||4));
    const results=await Promise.all(batch.map(item=>download(item,config.mediaMaxBytes-used)));
    signal.throwIfAborted();
    for(let i=0;i<batch.length;i++) {
      const item=batch[i],result=results[i];
      if(result.reason){skip(item,result.reason);continue;}
      if(used+result.bytes.length>config.mediaMaxBytes){skip(item,'budget');continue;}
      used+=result.bytes.length;
      parts.push({type:'text',text:`Media ${item.id}: ${item.title||item.kind}`},{type:item.kind,data:result.bytes.toString('base64'),mime_type:result.mime});
      mediaIds.push(item.id);manifest.push({id:item.id,kind:item.kind,url:item.url,sent:true});
    }
    offset+=batch.length;await onProgress({phase:'media',media_completed:offset,media_total:media.length});
  }
  return {parts,mediaIds,manifest,warnings,media_ms:Date.now()-started};
}
