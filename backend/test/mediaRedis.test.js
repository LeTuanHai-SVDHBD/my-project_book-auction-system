/** Redis thật: claim đồng thời, ownership và cleanup sau crash, prefix UUID không chạm khóa ứng dụng. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from 'redis';
import {createMediaLedger} from '../src/services/mediaLedger.service.js';
test('Redis media thật: một claim thắng, không lấy vé người khác, rollback/retry, bảo vệ file đã commit và giữ claim chưa rõ',
  {skip:!process.env.AUTH_TEST_REDIS_URL,timeout:20000},async t=>{
    const redis=createClient({url:process.env.AUTH_TEST_REDIS_URL,disableOfflineQueue:true,socket:{connectTimeout:3000,reconnectStrategy:false}});redis.on('error',()=>{});await redis.connect();
    const keyPrefix=`bookauction:test:media:${randomUUID()}:`;
    t.after(async()=>{if(redis.isReady){const keys=await redis.keys(keyPrefix+'*');if(keys.length)await redis.del(keys);}if(redis.isOpen)redis.destroy();});
    let now=Date.now();const refs=new Set();const deleted=[];let sqlAvailable=true;
    const ledger=createMediaLedger({getRedis:()=>redis,keyPrefix,now:()=>now,config:{pendingSeconds:10},provider:{destroy:async item=>{deleted.push(item.publicId);}},isReferenced:async id=>{if(!sqlAvailable)throw Error('SQL unavailable');return refs.has(id);}});
    async function upload(owner=1){const item=await ledger.begin(owner,'image');await ledger.ready(item,'https://res.cloudinary.com/demo/image/upload/x.png');return item;}
    const item=await upload();
    await assert.rejects(ledger.claim(2,[{upload_id:item.uploadId}]),{status:409});
    const attempts=await Promise.allSettled([ledger.claim(1,[{upload_id:item.uploadId}]),ledger.claim(1,[{upload_id:item.uploadId}])]);
    assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
    const claim=attempts.find(x=>x.status==='fulfilled').value;
    await assert.rejects(ledger.discard(1,item.uploadId),{status:409});
    await ledger.release(claim);const retry=await ledger.claim(1,[{upload_id:item.uploadId}]);
    refs.add(item.publicId);now+=11000;await ledger.cleanup();
    assert.equal(await redis.exists(keyPrefix+'stage:'+item.uploadId),0);assert.equal(deleted.length,0);
    await ledger.bound(retry); // Acknowledgement after cleanup remains idempotent.
    const uncertain=await upload();await ledger.claim(1,[{upload_id:uncertain.uploadId}]);now+=11000;
    assert.equal((await ledger.cleanup()).retainedClaims,1);assert.equal(deleted.length,0);
    const abandoned=await upload();now+=11000;sqlAvailable=false;
    await assert.rejects(ledger.cleanup());assert.equal(deleted.length,0);
    sqlAvailable=true;await ledger.cleanup();assert(deleted.includes(abandoned.publicId));assert(!deleted.includes(uncertain.publicId));
    const canceled=await upload();await assert.rejects(ledger.discard(2,canceled.uploadId),{status:404});await ledger.discard(1,canceled.uploadId);assert(deleted.includes(canceled.publicId));
    const crashDuringUpload=await ledger.begin(1,'video');now+=11000;await ledger.cleanup();assert(deleted.includes(crashDuringUpload.publicId));
    const expired=await upload();now+=11000;await assert.rejects(ledger.claim(1,[{upload_id:expired.uploadId}]),{status:409});
  });
