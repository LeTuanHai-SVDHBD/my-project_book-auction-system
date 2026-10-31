/** Mạng/provider có độ trễ và stream fixture; không gọi Gemini, SQL hoặc Redis thật. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {createGemini,boundedBytes} from '../src/ai/gemini.js';
import {parseAiConfig,aiRequestTimeout} from '../src/config/ai.js';
import {inputHash} from '../src/ai/input.js';
import {aiProgressMessage} from '../../frontend/src/utils/aiProgress.js';

const base=parseAiConfig({AI_ENABLED:'true',GEMINI_API_KEY:'fixture-runtime-private',CLOUDINARY_CLOUD_NAME:'demo'});
const png=Buffer.from('89504e470d0a1a0a','hex');
const media=n=>Array.from({length:n},(_,i)=>({kind:'image',url:`https://res.cloudinary.com/demo/image/upload/${i+1}.png`}));
const completed=()=>Response.json({status:'completed',model:base.model,steps:[{type:'model_output',content:[{type:'text',text:'{"criteria":[],"warnings":[]}'}]}]});

test('cấu hình cũ 60 giây tự mở cửa sổ theo media; tổng deadline chứa chuẩn bị và tối đa hai lượt',()=>{
  const c=parseAiConfig({AI_PROVIDER_TIMEOUT_MS:'60000'});
  assert.equal(aiRequestTimeout(c,0),60000);assert.equal(aiRequestTimeout(c,32),188000);assert.equal(aiRequestTimeout(c,1000),300000);
  assert(c.jobTimeout>=c.mediaPrepareTimeout+c.providerMaxTimeout*c.maxAttempts+5000);
  for(const patch of [{AI_PROVIDER_MAX_ATTEMPTS:'3'},{AI_THINKING_LEVEL:'minimal'},{AI_PROVIDER_TIMEOUT_MS:'300001'},{AI_PROVIDER_MAX_TIMEOUT_MS:'1000',AI_PROVIDER_TIMEOUT_MS:'60000'}])assert.throws(()=>parseAiConfig(patch));
});
test('32 ảnh tổng 8 MiB tải tối đa 4 luồng, giữ thứ tự/ID, cùng payload được dùng lại khi 503',async()=>{
  const bytes=Buffer.alloc(256*1024);png.copy(bytes);let active=0,peak=0,calls=0;const bodies=[],progress=[];
  const row={ten_sach:'32 ảnh mẫu',gia_toi_thieu:'never-send-price',media:media(32)},hash=inputHash(row);
  const provider=createGemini({config:{...base,retryDelayMs:1},wait:async()=>{},fetchImpl:async(url,options)=>{
    if(String(url).includes('res.cloudinary.com')){active++;peak=Math.max(peak,active);await delay(2);active--;return new Response(bytes,{headers:{'content-type':'image/png'}});}
    calls++;bodies.push(options.body);return calls===1?Response.json({error:{code:'service_unavailable'}},{status:503}):completed();
  }});
  const result=await provider.analyze(row,AbortSignal.timeout(5000),{onProgress:async value=>progress.push(value)});
  assert.equal(peak,4);assert.equal(calls,2);assert.equal(result.mediaIds.length,32);assert.equal(result.manifest.length,32);assert(result.manifest.every(x=>x.sent));
  assert.deepEqual(result.mediaIds,Array.from({length:32},(_,i)=>'M'+(i+1)));assert.equal(bodies[0],bodies[1]);assert.equal(inputHash(row),hash);
  const sent=JSON.parse(bodies[0]);assert.equal(sent.store,false);assert.equal(sent.generation_config.thinking_level,'low');assert.equal(sent.input.filter(x=>x.type==='image').length,32);assert(!bodies[0].includes('never-send-price'));
  assert.equal(result.execution.attempts,2);assert.equal(result.execution.provider_timeout_ms,188000);assert(progress.some(x=>x.phase==='retry'));
});
test('hết ngân sách không tiếp tục tải các nhóm sau; vẫn ghi đủ media bị bỏ qua',async()=>{
  const bytes=Buffer.alloc(32);png.copy(bytes);let downloads=0;
  const provider=createGemini({config:{...base,mediaMaxBytes:32},fetchImpl:async url=>{
    if(String(url).includes('res.cloudinary.com')){downloads++;return new Response(bytes,{headers:{'content-type':'image/png'}});}return completed();
  }});
  const r=await provider.analyze({media:media(32)},AbortSignal.timeout(1000));
  assert.equal(downloads,4);assert.deepEqual(r.mediaIds,['M1']);assert.equal(r.manifest.length,32);assert.equal(r.manifest.filter(x=>!x.sent).length,31);assert(r.warnings.length===31);
});
test('media quá chậm không lấy hết thời gian của Gemini; dừng tải đúng deadline và không bịa media đã gửi',async()=>{
  let downloads=0,called=false;
  const provider=createGemini({config:{...base,mediaPrepareTimeout:20,mediaDownloadTimeout:100},fetchImpl:async(url,{signal})=>{
    if(String(url).includes('res.cloudinary.com')){downloads++;await delay(200,undefined,{signal});return new Response(png,{headers:{'content-type':'image/png'}});}
    called=true;return completed();
  }});
  const r=await provider.analyze({media:media(32)},AbortSignal.timeout(1000));assert(called);assert.equal(downloads,4);assert.deepEqual(r.mediaIds,[]);assert.equal(r.manifest.length,32);assert(r.manifest.every(x=>!x.sent));
});
test('body bị treo cũng bị timeout/hủy; retry đúng một lần, không chỉ giới hạn thời gian nhận headers',async()=>{
  let calls=0,cancelled=0;
  const provider=createGemini({config:{...base,providerTimeout:20,providerMaxTimeout:20},wait:async()=>{},fetchImpl:async()=>{
    calls++;
    if(calls===2)return completed();
    let timer;return new Response(new ReadableStream({start(c){timer=setTimeout(()=>c.enqueue(new TextEncoder().encode('{}')),200);},cancel(){clearTimeout(timer);cancelled++;}}));
  }});
  const r=await provider.analyze({},AbortSignal.timeout(1000));assert.equal(calls,2);assert.equal(cancelled,1);assert.equal(r.execution.attempts,2);
});
test('stream vượt giới hạn bị hủy; lỗi không tạm thời không retry hoặc lộ response',async()=>{
  let cancelled=false;
  const response=new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(100));},cancel(){cancelled=true;}}));
  await assert.rejects(boundedBytes(response,10),/AI_RESPONSE_TOO_LARGE/);assert(cancelled);
  for(const status of [400,401,402,403,404,429]){
    let calls=0;const p=createGemini({config:base,fetchImpl:async()=>{calls++;return new Response('private body',{status});}});
    await assert.rejects(p.analyze({},AbortSignal.timeout(1000)),error=>!JSON.stringify(error).includes('private body'));assert.equal(calls,1);
  }
});
test('timeout cuối vẫn giữ manifest/timing, hủy tác vụ không retry, không retry TLS hoặc DNS cố định',async()=>{
  let calls=0;const p=createGemini({config:base,wait:async()=>{},fetchImpl:async url=>{
    if(String(url).includes('res.cloudinary.com'))return new Response(png,{headers:{'content-type':'image/png'}});
    calls++;throw new DOMException('private','TimeoutError');
  }});
  await assert.rejects(p.analyze({media:media(1)},AbortSignal.timeout(1000)),e=>e.code==='AI_TIMEOUT'&&e.aiContext.media[0].sent&&e.aiContext.execution.attempts===2);assert.equal(calls,2);
  for(const code of ['ENOTFOUND','CERT_HAS_EXPIRED']){
    let n=0;const p=createGemini({config:base,fetchImpl:async()=>{n++;throw new TypeError('private',{cause:{code}});}});
    await assert.rejects(p.analyze({},AbortSignal.timeout(1000)),{code:'AI_NETWORK_ERROR'});assert.equal(n,1);
  }
  const controller=new AbortController();controller.abort();let n=0;
  const cancelled=createGemini({config:base,fetchImpl:async()=>{n++;return completed();}});
  await assert.rejects(cancelled.analyze({},controller.signal),{code:'AI_JOB_TIMEOUT'});assert.equal(n,0);
});
test('thông báo tiến độ không gọi kết quả cũ là kết quả của yêu cầu mới',()=>{
  assert.match(aiProgressMessage({state:'running',progress:{phase:'media',media_completed:4,media_total:32}}),/4\/32/);
  assert.match(aiProgressMessage({state:'running',progress:{phase:'provider',attempt:1,max_attempts:2,provider_timeout_ms:188000}}),/188 giây/);
  assert.match(aiProgressMessage({state:'running',progress:{phase:'retry',attempt:1,max_attempts:2}}),/2\/2/);
});
