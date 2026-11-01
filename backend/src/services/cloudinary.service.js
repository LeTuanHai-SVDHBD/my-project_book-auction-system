/** Cloudinary REST phía server; không nhận URL tùy ý, không đưa bí mật vào phản hồi/lỗi. */
import { HttpError } from '../middlewares/errorHandler.js';
import {setTimeout as delay} from 'node:timers/promises';
import {providerJson} from '../utils/providerJson.js';
import {mediaFailure,recoverableMediaError} from './mediaErrors.js';
export function createCloudinary({ config, fetchImpl = fetch, wait=delay }) {
  const root=`https://api.cloudinary.com/v1_1/${config.cloudName}`;
  const endpoint = kind => `${root}/${kind}`;
  const headers = { Authorization: `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}` };
  async function call(url,body,{operation,timeout,method='POST'}) {
    if (!config.configured) throw mediaFailure('MEDIA_NOT_CONFIGURED');
    const signal=AbortSignal.timeout(timeout);
    try {
      const response=await fetchImpl(url,{method,headers,body,signal,redirect:'error'});
      if(!response.ok){
        void response.body?.cancel().catch(()=>{});
        if(operation==='recover'&&response.status===404)return null;
        const code=[408,504].includes(response.status)?'MEDIA_PROVIDER_TIMEOUT':[401,403].includes(response.status)?'MEDIA_PROVIDER_AUTH':[413,420,429].includes(response.status)?'MEDIA_PROVIDER_LIMIT':response.status>=400&&response.status<500?'MEDIA_PROVIDER_REJECTED':'MEDIA_PROVIDER_ERROR';
        throw mediaFailure(code,{operation,http_status:response.status});
      }
      // Plain json() stubs remain supported in existing unit fixtures; real fetch Responses use bounded streams.
      return response.body===undefined?await response.json():await providerJson(response,signal);
    } catch(error) {
      if(error instanceof HttpError)throw error;
      const code=signal.aborted||['TimeoutError','AbortError'].includes(error.name)?'MEDIA_PROVIDER_TIMEOUT':error instanceof TypeError?'MEDIA_PROVIDER_NETWORK':'MEDIA_PROVIDER_ERROR';
      throw mediaFailure(code,{operation,transport_code:error.cause?.code});
    }
  }
  function verified(result,kind,publicId) {
    let url;try{url=new URL(result?.secure_url);}catch{}
    if(result?.public_id!==publicId||result.resource_type!==kind||result.placeholder||result.type&&result.type!=='upload'||!url||url.protocol!=='https:'||url.hostname!=='res.cloudinary.com'||url.username||url.password||url.port||!url.pathname.startsWith(`/${config.cloudName}/${kind}/upload/`)||result.secure_url.length>2048)throw mediaFailure('INVALID_MEDIA_RESPONSE');
    return {url:result.secure_url,publicId,kind};
  }
  return {
    async upload({kind,publicId,bytes,mime}) {
      const form=new FormData();form.set('file',new Blob([bytes],{type:mime}),'upload');form.set('public_id',publicId);form.set('overwrite','false');
      let original;
      try {
        const result=await call(`${endpoint(kind)}/upload`,form,{operation:'upload',timeout:kind==='video'?(config.videoUploadTimeoutMs||300000):config.uploadTimeoutMs});
        if(!result.existing)return verified(result,kind,publicId);
        if(result.public_id&&result.public_id!==publicId)throw mediaFailure('INVALID_MEDIA_RESPONSE');
        original=mediaFailure('MEDIA_PROVIDER_ERROR',{operation:'upload'});
      }catch(error){if(!recoverableMediaError(error))throw error;original=error;}
      // Read-only recovery of this server-issued UUID; never repeat the upload or guess a delivery URL.
      for(let attempt=0;attempt<(config.recoveryAttempts||3);attempt++){
        if(attempt)await wait(config.recoveryDelayMs??1000);
        try{
          const result=await call(`${root}/resources/${kind}/upload/${encodeURIComponent(publicId)}`,undefined,{operation:'recover',method:'GET',timeout:config.recoveryTimeoutMs||15000});
          if(result)return verified(result,kind,publicId);
          original.recoveryDiagnostics={operation:'recover',http_status:404};
        }catch(error){
          if(error.code==='INVALID_MEDIA_RESPONSE')throw error;
          original.recoveryDiagnostics=error.mediaDiagnostics;
          if(!recoverableMediaError(error))break;
        }
      }
      throw original;
    },
    async destroy({kind,publicId}) {
      const result=await call(`${endpoint(kind)}/destroy`,new URLSearchParams({public_id:publicId,invalidate:'true'}),{operation:'destroy',timeout:config.uploadTimeoutMs});
      if(!['ok','not found'].includes(result?.result))throw mediaFailure('MEDIA_DELETE_FAILED');
    },
  };
}
export function verifyMedia(bytes, mime, kind) {
  const prefix = value => bytes.subarray(0, value.length).equals(Buffer.from(value));
  const valid = kind === 'image' ? (
    mime === 'image/jpeg' && prefix([255,216,255]) ||
    mime === 'image/png' && prefix([137,80,78,71,13,10,26,10]) ||
    mime === 'image/webp' && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP'
  ) : (
    mime === 'video/mp4' && bytes.toString('ascii',4,8) === 'ftyp' ||
    mime === 'video/webm' && prefix([26,69,223,163])
  );
  if (!valid) throw new HttpError(415, 'INVALID_MEDIA_TYPE', 'Nội dung tệp không khớp định dạng được hỗ trợ.');
}
