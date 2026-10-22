/** Vé upload Redis bền vững; claim nguyên tử, cleanup kiểm tra tham chiếu SQL trước khi xóa Cloudinary. */
import { randomUUID } from 'node:crypto';
import { HttpError } from '../middlewares/errorHandler.js';
const claimScript = `
for i,key in ipairs(KEYS) do
 local raw=redis.call('GET',key)
 if not raw then return 0 end
 local item=cjson.decode(raw)
 if tostring(item.owner)~=ARGV[1] or item.status~='ready' or item.expires<tonumber(ARGV[3]) then return 0 end
end
for i,key in ipairs(KEYS) do
 local item=cjson.decode(redis.call('GET',key)); item.status='claimed'; item.claim=ARGV[2]
 redis.call('SET',key,cjson.encode(item))
end
return 1`;
const transitionScript = `
local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end
local item=cjson.decode(raw)
if item.status~=ARGV[1] or (ARGV[3]~='' and item.claim~=ARGV[3]) then return 0 end
if ARGV[2]=='removed' then redis.call('DEL',KEYS[1]); redis.call('ZREM',KEYS[2],ARGV[4]); return 1 end
item.status=ARGV[2]; redis.call('SET',KEYS[1],cjson.encode(item)); return 1`;
export function createMediaLedger({ getRedis, provider, isReferenced, config, now = Date.now, keyPrefix = 'bookauction:media:' }) {
  const prefix = keyPrefix + 'stage:'; const dueKey = keyPrefix + 'due';
  const read = async uploadId => { const raw = await getRedis().get(prefix + uploadId); return raw ? JSON.parse(raw) : null; };
  async function transition(item, from, to, claim = '') {
    return await getRedis().eval(transitionScript, { keys: [prefix + item.uploadId,dueKey], arguments: [from,to,claim,item.uploadId] }) === 1;
  }
  async function remove(item, from, claim = '') { return transition(item, from, 'removed', claim); }
  return {
    async begin(owner, kind) {
      const redis = getRedis();
      const rateKey = `${keyPrefix}rate:${owner}:${Math.floor(now()/3600000)}`;
      const count = await redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],7200) end; return n", {keys:[rateKey], arguments:[]});
      if (count > 60) throw new HttpError(429, 'MEDIA_RATE_LIMIT', 'Giới hạn 60 lần tải tệp mỗi giờ.');
      const uploadId = randomUUID();
      const item = { uploadId, owner, kind, publicId: `bookauction/${owner}/${uploadId}`, status: 'uploading', expires: now() + config.pendingSeconds*1000 };
      await redis.multi().set(prefix+uploadId,JSON.stringify(item)).zAdd(dueKey,{score:item.expires,value:uploadId}).exec();
      return item;
    },
    async ready(item, url) {
      const value = { ...item, status:'ready',url };
      // Upload timeout is shorter than staging lifetime; an expired ticket is never reused.
      if (now() >= item.expires) throw new HttpError(409, 'UPLOAD_EXPIRED', 'Tệp tải lên đã hết hạn.');
      await getRedis().set(prefix+item.uploadId,JSON.stringify(value));
      return { upload_id:item.uploadId, url, kind:item.kind };
    },
    async claim(owner, requested) {
      if (!requested.length) return { token:randomUUID(), items:[] };
      const token = randomUUID(); const keys = requested.map(x=>prefix+x.upload_id);
      const ok = await getRedis().eval(claimScript,{keys,arguments:[String(owner),token,String(now())]});
      if (!ok) throw new HttpError(409,'UPLOAD_NOT_AVAILABLE','Tệp đã hết hạn, đang được dùng hoặc không thuộc tài khoản này.');
      const items = await Promise.all(requested.map(async x=>({...await read(x.upload_id),title:x.tieu_de})));
      return {token,items};
    },
    async release(claim) { for (const item of claim.items) await transition(item,'claimed','ready',claim.token); },
    async bound(claim) { for (const item of claim.items) await remove(item,'claimed',claim.token); },
    async discard(owner, uploadId) {
      const item = await read(uploadId);
      if (!item || item.owner!==owner) throw new HttpError(404,'UPLOAD_NOT_FOUND','Không tìm thấy tệp của bạn.');
      if (!await transition(item,'ready','deleting')) throw new HttpError(409,'UPLOAD_IN_USE','Tệp đang được sử dụng.');
      if (!await isReferenced(item.publicId)) await provider.destroy(item);
      await remove(item,'deleting');
    },
    async cleanup() {
      const ids = await getRedis().zRangeByScore(dueKey,0,now(),{LIMIT:{offset:0,count:30}});
      let retainedClaims=0;
      for (const uploadId of ids) {
        const item = await read(uploadId);
        if (!item) { await getRedis().zRem(dueKey,uploadId); continue; }
        // A committed SQL transaction may have lost its HTTP/Redis acknowledgement.
        if (await isReferenced(item.publicId)) { await remove(item,item.status,item.claim||''); continue; }
        // Unknown commit outcomes are retained for reconciliation, never destructively guessed.
        if (item.status==='claimed') { retainedClaims++; await getRedis().zAdd(dueKey,{score:now()+3600000,value:uploadId}); continue; }
        if (item.status!=='deleting' && !await transition(item,item.status,'deleting')) continue;
        await provider.destroy(item); await remove(item,'deleting');
      }
      return {retainedClaims};
    },
  };
}
