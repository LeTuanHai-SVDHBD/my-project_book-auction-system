/** Redis thật opt-in: admission đồng thời, phiên bản mới, pending/reclaim và ACK sau lưu. SQL/provider giả. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from 'redis';
import {AI_QUEUE,createAiQueue} from '../src/ai/queue.js';
import {ensureAiGroup,processAiMessage} from '../src/ai/consumer.js';
test('Redis AI: enqueue trùng chỉ một job, SQL lỗi giữ pending và reclaim an toàn', {skip:!process.env.AUTH_TEST_REDIS_URL,timeout:10000},async t=>{
  const client=createClient({url:process.env.AUTH_TEST_REDIS_URL,socket:{reconnectStrategy:false}});client.on('error',()=>{});await client.connect();const prefix=`bookauction:test:ai:${randomUUID()}:`,settings={...AI_QUEUE,prefix,stream:prefix+'events',group:prefix+'workers'};
  t.after(async()=>{try{const keys=await client.keys(prefix+'*');if(keys.length)await client.del(keys);}finally{client.destroy();}});
  const queue=createAiQueue({getRedis:()=>client,settings}),row={bai_dang_id:7,row_version:'0000000000000001',media:[]};await ensureAiGroup(client,settings);
  const jobs=await Promise.all(Array.from({length:10},()=>queue.enqueue(row)));assert.equal(new Set(jobs.map(x=>x.requestId)).size,1);assert.equal(await client.xLen(settings.stream),1);
  const message=(await client.xReadGroup(settings.group,'first',{key:settings.stream,id:'>'},{COUNT:1}))[0].messages[0];
  await processAiMessage({client,message,settings,handle:async()=>{throw Error('SQL unavailable');}});assert.equal((await client.xPending(settings.stream,settings.group)).pending,1);
  const claimed=await client.xAutoClaim(settings.stream,settings.group,'replacement',0,'0-0',{COUNT:1});let writes=0;
  await processAiMessage({client,message:claimed.messages[0],settings,handle:async job=>{writes++;await queue.update(job,{state:'done'});}});assert.equal(writes,1);assert.equal((await client.xPending(settings.stream,settings.group)).pending,0);
  const next=await queue.enqueue({...row,row_version:'0000000000000002'});assert.notEqual(next.requestId,jobs[0].requestId);
});
