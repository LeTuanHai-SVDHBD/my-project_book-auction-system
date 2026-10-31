/** Cấu hình Gemini phía backend; tắt mặc định, không làm hỏng luồng kiểm duyệt thủ công. */
export function parseAiConfig(env) {
  if(env.AI_ENABLED!==undefined&&!['true','false',''].includes(env.AI_ENABLED))throw Error('AI_ENABLED chỉ nhận true hoặc false.');
  const integer=(name,fallback,min,max)=>{const n=Number(env[name]||fallback);if(!Number.isInteger(n)||n<min||n>max)throw Error(`${name} không hợp lệ.`);return n;};
  const key=env.GEMINI_API_KEY||'',model=env.GEMINI_MODEL||'gemini-3.8-flash';
  if(!/^[a-z0-9][a-z0-9._-]{0,100}$/.test(model))throw Error('GEMINI_MODEL không hợp lệ.');
  const providerTimeout=integer('AI_PROVIDER_TIMEOUT_MS',60000,1000,300000);
  const providerMaxTimeout=integer('AI_PROVIDER_MAX_TIMEOUT_MS',Math.max(300000,providerTimeout),providerTimeout,300000);
  const mediaPrepareTimeout=integer('AI_MEDIA_PREPARE_TIMEOUT_MS',45000,1000,90000);
  const maxAttempts=integer('AI_PROVIDER_MAX_ATTEMPTS',2,1,2),thinkingLevel=env.AI_THINKING_LEVEL||'low';
  if(!['low','medium','high','default'].includes(thinkingLevel))throw Error('AI_THINKING_LEVEL không hợp lệ.');
  return {enabled:env.AI_ENABLED==='true',configured:env.AI_ENABLED==='true'&&key.length>10&&!key.includes('CHANGE_ME'),key,model,
    cloudName:env.CLOUDINARY_CLOUD_NAME||'',providerTimeout,providerMaxTimeout,maxAttempts,thinkingLevel,mediaPrepareTimeout,
    jobTimeout:mediaPrepareTimeout+providerMaxTimeout*maxAttempts+10000,
    leaseRenewMs:15000,mediaConcurrency:4,mediaDownloadTimeout:15000,
    mediaMaxBytes:integer('AI_MEDIA_TOTAL_MB',12,1,12)*1048576};
}
export const aiRequestTimeout=(config,mediaCount)=>Math.min(config.providerMaxTimeout||300000,config.providerTimeout+4000*mediaCount);
