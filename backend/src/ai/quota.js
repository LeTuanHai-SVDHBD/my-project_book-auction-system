/** Shared pause for the API and workers using one Gemini credential. */
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

const DEFAULT_PAUSE_MS=5*60000;
const MIN_PAUSE_MS=60000;
const MAX_PAUSE_MS=24*60*60000;
const quotaCode='AI_QUOTA_EXCEEDED';

export function retryAfterMs(header, now=Date.now()) {
  if(!header)return 0;
  const ms=/^\d+$/.test(header)?Number(header)*1000:Date.parse(header)-now;
  return Number.isFinite(ms)&&ms>0?ms:0;
}
export function quotaResumeAt(error,now=Date.now()) {
  const hint=error.aiRetryAfterMs||DEFAULT_PAUSE_MS;
  return now+Math.ceil(Math.min(MAX_PAUSE_MS,Math.max(MIN_PAUSE_MS,hint)));
}
export function isQuotaAnalysis(analysis) {
  return analysis?.trang_thai==='that_bai'&&analysis.thong_tin?.error_code===quotaCode;
}
export function storedQuotaResumeAt(analysis) {
  if(!isQuotaAnalysis(analysis))return 0;
  const saved=analysis.thong_tin.retry_not_before;
  if(Number.isSafeInteger(saved)&&saved>0)return saved;
  const stamp=new Date(analysis.ngay_phan_tich).getTime();
  return Number.isFinite(stamp)&&stamp>0?stamp+DEFAULT_PAUSE_MS:0;
}

// Concurrent failures may extend the pause but must never shorten it.
const pauseLua=`local stamp=redis.call('TIME')
local now=tonumber(stamp[1])*1000+math.floor(tonumber(stamp[2])/1000)
local old=tonumber(redis.call('GET',KEYS[1])) or 0
local deadline=tonumber(ARGV[1])
if deadline>old and deadline>now then
  redis.call('SET',KEYS[1],ARGV[1],'PX',deadline-now)
end`;
export function createAiQuotaGate({getRedis,apiKey,prefix='bookauction:ai:quota:'}) {
  const key=prefix+createHash('sha256').update(apiKey).digest('hex');
  const until=async()=>Number(await getRedis().get(key))||0;
  return {
    until,
    pauseUntil:deadline=>getRedis().eval(pauseLua,{keys:[key],arguments:[String(deadline)]}),
    async wait(signal) {
      while(!signal.aborted){
        const remaining=await until()-Date.now();
        if(remaining<=0)return;
        await delay(Math.min(remaining,10000),undefined,{signal});
      }
      signal.throwIfAborted();
    }
  };
}
