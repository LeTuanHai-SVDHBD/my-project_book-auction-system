/** Cấu hình Gemini phía backend; bài đăng dùng tự duyệt khi dịch vụ sẵn sàng. */
export const AI_MAX_RETRY_WAIT_MS=15000;
export function parseAiConfig(env) {
  if(env.AI_ENABLED!==undefined&&!['true','false',''].includes(env.AI_ENABLED))throw Error('AI_ENABLED chỉ nhận true hoặc false.');
  const integer=(name,fallback,min,max)=>{const n=Number(env[name]||fallback);if(!Number.isInteger(n)||n<min||n>max)throw Error(`${name} không hợp lệ.`);return n;};
  // Only the isolated smoke environment can exercise the legacy manual endpoint.
  const manualFixture=env.AI_TEST_MANUAL_REVIEW==='true';
  if(manualFixture&&((env.NODE_ENV||'development')!=='development'||!/^BookAuctionTest_[A-Za-z0-9_]+$/.test(env.DB_DATABASE||'')))throw Error('AI_TEST_MANUAL_REVIEW chỉ dùng ở development với DB_DATABASE=BookAuctionTest_* riêng.');
  const autoModeration=manualFixture?null:{
    rarity:integer('AI_MIN_RARITY_SCORE',70,1,100),
    condition:integer('AI_MIN_CONDITION_SCORE',70,1,100),
  };
  const modelName=(name,fallback)=>{const value=(env[name]||fallback).trim();if(!/^[a-z0-9][a-z0-9._-]{0,100}$/.test(value))throw Error(`${name} không hợp lệ.`);return value;};
  const key=env.GEMINI_API_KEY||'',model=modelName('GEMINI_MODEL','gemini-3.8-flash');
  const fallbackModel=env.GEMINI_FALLBACK_MODEL?.trim()?modelName('GEMINI_FALLBACK_MODEL',''):null;
  const providerTimeout=integer('AI_PROVIDER_TIMEOUT_MS',60000,1000,300000);
  const providerMaxTimeout=integer('AI_PROVIDER_MAX_TIMEOUT_MS',Math.max(300000,providerTimeout),providerTimeout,300000);
  const mediaPrepareTimeout=integer('AI_MEDIA_PREPARE_TIMEOUT_MS',45000,1000,90000);
  const videoPrepareTimeout=integer('AI_VIDEO_PREPARE_TIMEOUT_MS',300000,1000,600000);
  const videoDownloadTimeout=integer('AI_VIDEO_DOWNLOAD_TIMEOUT_MS',120000,1000,300000);
  const videoMaxCount=integer('MEDIA_MAX_VIDEOS',3,1,5);
  const videoMaxBytes=integer('AI_VIDEO_MAX_MB',100,1,100)*1048576;
  const maxAttempts=integer('AI_PROVIDER_MAX_ATTEMPTS',2,1,2),thinkingLevel=env.AI_THINKING_LEVEL||'low';
  if(!['low','medium','high','default'].includes(thinkingLevel))throw Error('AI_THINKING_LEVEL không hợp lệ.');
  return {autoModeration,enabled:env.AI_ENABLED==='true',configured:env.AI_ENABLED==='true'&&key.length>10&&!key.includes('CHANGE_ME'),key,model,fallbackModel:fallbackModel===model?null:fallbackModel,
    cloudName:env.CLOUDINARY_CLOUD_NAME||'',providerTimeout,providerMaxTimeout,maxAttempts,thinkingLevel,mediaPrepareTimeout,videoPrepareTimeout,videoDownloadTimeout,videoMaxBytes,videoMaxCount,
    jobTimeout:mediaPrepareTimeout+videoPrepareTimeout*videoMaxCount+providerMaxTimeout*maxAttempts+AI_MAX_RETRY_WAIT_MS*(maxAttempts-1)+10000,
    leaseRenewMs:15000,mediaConcurrency:4,mediaDownloadTimeout:15000,
    mediaMaxBytes:integer('AI_MEDIA_TOTAL_MB',12,1,12)*1048576};
}
export const aiRequestTimeout=(config,mediaCount,videoCount=0)=>Math.min(config.providerMaxTimeout||300000,config.providerTimeout+4000*mediaCount+120000*videoCount);
