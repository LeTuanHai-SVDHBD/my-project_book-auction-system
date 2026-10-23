/** Kiểm chứng Redis thật: tranh khóa, gia hạn, hết hạn và chủ cũ không xóa/gia hạn khóa của chủ mới. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {createClient} from 'redis';
import {createAuctionLock} from '../src/concurrency/auctionLock.js';

test('khóa phiên từ chối thời hạn sai trước khi gọi Redis',()=>{
  for(const leaseMs of [0,99,1.5,NaN])assert.throws(()=>createAuctionLock({getRedis:()=>{},leaseMs}),TypeError);
});
test('Redis khóa phiên: chỉ một chủ, độc lập theo phiên, token cũ không ảnh hưởng chủ mới',
  {skip:!process.env.AUTH_TEST_REDIS_URL,timeout:10000},async t=>{
    const redis=createClient({url:process.env.AUTH_TEST_REDIS_URL,disableOfflineQueue:true,socket:{reconnectStrategy:false,connectTimeout:3000}});
    redis.on('error',()=>{});await redis.connect();
    const keyPrefix=`bookauction:test:auction-lock:${randomUUID()}:`;
    t.after(async()=>{if(redis.isReady){const keys=await redis.keys(keyPrefix+'*');if(keys.length)await redis.del(keys);}if(redis.isOpen)redis.destroy();});
    const locks=createAuctionLock({getRedis:()=>redis,keyPrefix,leaseMs:500});
    const attempts=await Promise.all(Array.from({length:12},()=>locks.acquire(1)));
    assert.equal(attempts.filter(Boolean).length,1);
    const first=attempts.find(Boolean),other=await locks.acquire(2);assert(other);
    assert.equal(await first.renew(),true);assert((await redis.pTTL(keyPrefix+1))>0);
    assert.equal(await other.release(),true);assert.equal(await other.release(),false);
    await delay(550);
    const second=await locks.acquire(1);assert(second);
    assert.equal(await first.renew(),false);assert.equal(await first.release(),false);
    assert.equal(await locks.acquire(1),null);assert.equal(await second.renew(),true);assert.equal(await second.release(),true);
    await assert.rejects(locks.acquire(-1),TypeError);
  });
