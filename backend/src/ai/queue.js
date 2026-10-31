/** Hàng đợi AI tách khỏi đấu giá; chỉ ID/hash/version, admission Lua và kết quả tạm có TTL. */
import {randomUUID} from 'node:crypto';
import {inputHash} from './input.js';
export const AI_QUEUE=Object.freeze({stream:'bookauction:ai:events',group:'bookauction:ai:workers',prefix:'bookauction:ai:'});
const enqueueLua=`local old=redis.call('GET',KEYS[1]);if old then local j=redis.call('GET',ARGV[3]..old);if j then local v=cjson.decode(j);if v.sourceVersion==ARGV[4] and (v.state=='queued' or v.state=='running') then return j end end end
redis.call('SET',KEYS[1],ARGV[1],'EX',86400);redis.call('SET',KEYS[2],ARGV[2],'EX',86400);redis.call('XADD',KEYS[3],'*','event',ARGV[2]);return ARGV[2]`;
export function createAiQueue({getRedis,settings=AI_QUEUE}) {
  const current=id=>settings.prefix+'post:'+id,jobKey=id=>settings.prefix+'job:'+id;
  return {
    async enqueue(row,{manual=false}={}){const job={requestId:randomUUID(),postId:row.bai_dang_id,sourceVersion:row.row_version,inputHash:inputHash(row),trigger:manual?'manual':'auto',state:'queued'};
      return JSON.parse(await getRedis().eval(enqueueLua,{keys:[current(job.postId),jobKey(job.requestId),settings.stream],arguments:[job.requestId,JSON.stringify(job),settings.prefix+'job:',job.sourceVersion]}));},
    async get(id){const value=await getRedis().get(jobKey(id));return value?JSON.parse(value):null;},
    async status(postId){const id=await getRedis().get(current(postId));if(!id)return null;const value=await this.get(id);return value?{request_id:value.requestId,state:value.state,source_version:value.sourceVersion,analysis_id:value.analysisId??null,progress:value.progress??null}:null;},
    async update(job,patch){const next={...job,...patch};await getRedis().set(jobKey(job.requestId),JSON.stringify(next),{EX:86400});return next;}
  };
}
