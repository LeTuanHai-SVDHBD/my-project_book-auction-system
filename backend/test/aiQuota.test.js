/** Quota failures keep a pending review, pause the worker and require a deliberate retry. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createAiProcessor} from '../src/ai/processor.js';
import {createGemini} from '../src/ai/gemini.js';
import {parseAiConfig} from '../src/config/ai.js';
import {inputHash} from '../src/ai/input.js';
import {consumeAi} from '../src/ai/consumer.js';
import {enqueueAutoReviews} from '../src/ai/scheduler.js';
import {geminiHttpFailure} from '../src/ai/errors.js';

const config=parseAiConfig({AI_ENABLED:'true',GEMINI_API_KEY:'quota-test-only',CLOUDINARY_CLOUD_NAME:'demo'});
const version='0000000000000001';
const job=()=>({postId:7,requestId:randomUUID(),sourceVersion:version,inputHash:inputHash({}),trigger:'auto',state:'queued'});
const quotaResponse=()=>Response.json({error:{status:'TOO_MANY_REQUESTS',details:[{'@type':'type.googleapis.com/google.rpc.RetryInfo',retryDelay:'91s'}]}},{status:429,headers:{'Retry-After':'90'}});

test('429 records a safe delay and does not retry or switch to the fallback model',async()=>{
  let calls=0;
  const provider=createGemini({config:{...config,fallbackModel:'gemini-fixture-fallback'},fetchImpl:async()=>{calls++;return quotaResponse();},wait:()=>assert.fail('No retry for 429')});
  await assert.rejects(provider.analyze({}),e=>e.code==='AI_QUOTA_EXCEEDED'&&e.aiRetryAfterMs===91000&&e.aiContext.execution.attempts===1);
  assert.equal(calls,1);
});

test('Files 429 stops the remaining video uploads and the model request',async()=>{
  const mp4=Buffer.from('000000186674797069736f6d0000000069736f6d6d703432','hex');
  let downloads=0,uploads=0;
  const provider=createGemini({config,fetchImpl:async url=>{
    if(String(url).startsWith('https://res.cloudinary.com/')){downloads++;return new Response(mp4,{headers:{'content-type':'video/mp4'}});}
    assert(String(url).endsWith('/upload/v1beta/files'));uploads++;
    return new Response('not JSON',{status:429,headers:{'Retry-After':'110'}});
  }});
  const media=[1,2].map(n=>({kind:'video',url:`https://res.cloudinary.com/demo/video/upload/${n}.mp4`}));
  await assert.rejects(provider.analyze({media}),e=>e.code==='AI_QUOTA_EXCEEDED'&&e.aiRetryAfterMs===110000&&e.aiContext.execution.attempts===0);
  assert.equal(downloads,1);assert.equal(uploads,1);
});

test('processor persists 429 without a verdict and skips an older queued retry of the same version',async()=>{
  let calls=0,writes=0,paused=0,lastJob;
  const row={row_version:version,trang_thai_phien:'cho_kiem_duyet'};
  const process=createAiProcessor({config,posts:{detail:async()=>row},provider:{analyze:async()=>{calls++;throw geminiHttpFailure(429,{error:{status:'RESOURCE_EXHAUSTED'}},'90');}},
    queue:{get:async()=>null,update:async(job,patch)=>{lastJob={...job,...patch};return lastJob;}},
    quota:{pauseUntil:async value=>{paused=value;}},locks:{acquire:async()=>({renew:async()=>true,release:async()=>{}})},
    model:{find:async()=>null,save:async(j,result,info,check,verdict)=>{
      await check();assert.equal(verdict,undefined);assert.equal(result.trang_thai,'that_bai');assert.equal(info.retry_not_before,paused);
      row.ai={...result,phan_tich_id:++writes,thong_tin:info};return row.ai;
    }}});
  const start=Date.now();await process(job());
  assert.equal(lastJob.state,'done');assert(paused>=start+90000);
  await process(job());assert.equal(lastJob.state,'skipped');assert.equal(calls,1);
  await process({...job(),retryOf:row.ai.phan_tich_id});assert.equal(lastJob.state,'done');assert.equal(calls,2);
  await process({...job(),retryOf:1});assert.equal(lastJob.state,'skipped');assert.equal(calls,2);
});

test('a shared pause stops new scheduling and stream reads until the worker can resume',async()=>{
  const controller=new AbortController();
  await enqueueAutoReviews({model:{autoCandidates:()=>assert.fail('No SQL scan during pause')},quota:{until:async()=>Date.now()+60000},signal:controller.signal});
  let release,reads=0,handled=0;
  const paused=new Promise(resolve=>{release=resolve;});
  const run=consumeAi({signal:controller.signal,consumer:'fixture',quota:{wait:()=>paused},
    client:{xAutoClaim:async()=>({nextId:'0-0',messages:[]}),multi:()=>({xAck(){return this;},xDel(){return this;},exec:async()=>{}})},
    reader:{xReadGroup:async()=>{reads++;return [{messages:[{id:'1-0',message:{event:JSON.stringify(job())}}]}];}},
    handle:async()=>{handled++;controller.abort();}});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(reads,0);
  release();await run;
  assert.equal(reads,1);assert.equal(handled,1);
});
