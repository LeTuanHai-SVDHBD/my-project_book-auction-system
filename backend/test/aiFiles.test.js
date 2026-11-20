/** File API transport and long-video orchestration use HTTP fixtures, not real paid Gemini calls. */
import test from 'node:test';import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {createGemini} from '../src/ai/gemini.js';
import {createGeminiFiles} from '../src/ai/files.js';
import {parseAiConfig,aiRequestTimeout} from '../src/config/ai.js';
import {aiProgressMessage} from '../../frontend/src/utils/aiProgress.js';
const root='https://generativelanguage.googleapis.com';
const config={...parseAiConfig({AI_ENABLED:'true',GEMINI_API_KEY:'fixture-long-video-secret',CLOUDINARY_CLOUD_NAME:'demo',AI_PROVIDER_MAX_ATTEMPTS:'2'}),filePollDelayMs:0,retryDelayMs:0};
const header=Buffer.from('000000186674797069736f6d0000000069736f6d6d703432','hex');
const file=(patch={})=>({name:'files/test-video',uri:root+'/v1beta/files/test-video',mimeType:'video/mp4',state:'ACTIVE',videoMetadata:{videoDuration:'361.5s'},...patch});
const complete=()=>Response.json({status:'completed',model:config.model,steps:[{type:'model_output',content:[{type:'text',text:'{"criteria":[],"warnings":[]}'}]}]});
function fixture({bytes=header,failInteraction=false,state='ACTIVE',startUrl=root+'/upload/v1beta/files?upload_id=fixture',changedFile={}}={}){
 const counts={start:0,upload:0,poll:0,remove:0,interactions:0},payloads=[],progress=[];
 const fetchImpl=async(url,options={})=>{
  assert(!String(url).includes(config.key));
  if(String(url).startsWith('https://res.cloudinary.com'))return new Response(bytes,{headers:{'content-type':'video/mp4'}});
  if(options.method==='DELETE'){counts.remove++;assert.equal(url,root+'/v1beta/files/test-video');return new Response(null,{status:200});}
  if(url===root+'/upload/v1beta/files'){counts.start++;assert.equal(options.headers['X-Goog-Upload-Header-Content-Length'],String(bytes.length));assert.equal(options.headers['x-goog-api-key'],config.key);assert(!options.body.includes('private-price'));return new Response(null,{headers:{'x-goog-upload-url':startUrl}});}
  if(String(url).includes('upload_id=fixture')){counts.upload++;assert.equal(options.body.length,bytes.length);assert.equal(options.headers['X-Goog-Upload-Command'],'upload, finalize');assert(!options.headers['x-goog-api-key']);return Response.json({file:file({state,...changedFile})});}
  if(url===root+'/v1beta/files/test-video'){counts.poll++;return Response.json(file(changedFile));}
  assert.equal(url,root+'/v1beta/interactions');counts.interactions++;payloads.push(JSON.parse(options.body));return failInteraction?Response.json({error:{status:'UNAVAILABLE'}},{status:503}):complete();
 };
 return {fetchImpl,counts,payloads,progress};
}
test('video >12 MiB / 6 minutes uses one Files upload, polls ACTIVE, references full file and cleans up after inference',async()=>{
 const bytes=Buffer.alloc(13*1048576);header.copy(bytes);const f=fixture({bytes,state:'PROCESSING'}),p=createGemini({config,fetchImpl:f.fetchImpl,wait:async()=>{}});
 const result=await p.analyze({gia_toi_thieu:'private-price',media:[{kind:'video',url:'https://res.cloudinary.com/demo/video/upload/long.mp4'}]},AbortSignal.timeout(5000),{onProgress:async x=>f.progress.push(x)});
 assert.deepEqual(f.counts,{start:1,upload:1,poll:1,remove:1,interactions:1});assert.deepEqual(result.mediaIds,['M1']);assert.equal(result.manifest[0].duration_seconds,361.5);assert.equal(result.manifest[0].bytes,bytes.length);assert(result.manifest[0].full_file);assert.equal(result.manifest[0].input_method,'files_api');assert.equal(result.warnings.length,0);
 const part=f.payloads[0].input.find(x=>x.type==='video');assert.equal(part.uri,file().uri);assert(!part.data);assert(!part.processing);assert(!JSON.stringify(f.payloads).includes('private-price'));assert(!JSON.stringify(result.manifest).includes('/v1beta/files/'));assert(f.progress.some(x=>x.phase==='video_processing'));
});
test('exhausted image budget still processes video and retains original IDs/order for all evidence',async()=>{
 const f=fixture(),fetchImpl=f.fetchImpl;f.fetchImpl=(url,options)=>String(url).includes('/image/')?Promise.resolve(new Response(Buffer.from('89504e470d0a1a0a','hex'),{headers:{'content-type':'image/png'}})):fetchImpl(url,options);
 const p=createGemini({config:{...config,mediaMaxBytes:8},fetchImpl:f.fetchImpl,wait:async()=>{}});
 const result=await p.analyze({media:[{kind:'image',url:'https://res.cloudinary.com/demo/image/upload/1.png'},{kind:'image',url:'https://res.cloudinary.com/demo/image/upload/2.png'},{kind:'video',url:'https://res.cloudinary.com/demo/video/upload/3.mp4'}]},AbortSignal.timeout(5000));
 assert.deepEqual(result.mediaIds,['M1','M3']);assert.equal(result.manifest[1].reason,'budget');assert.equal(result.manifest[2].sent,true);assert(!result.warnings.some(x=>x.includes('M3')));assert.equal(f.counts.upload,1);
});
test('provider retries reuse the uploaded video URI; final 503 still removes the temporary file',async()=>{
 const f=fixture({failInteraction:true}),p=createGemini({config,fetchImpl:f.fetchImpl,wait:async()=>{}});
 await assert.rejects(p.analyze({media:[{kind:'video',url:'https://res.cloudinary.com/demo/video/upload/long.mp4'}]},AbortSignal.timeout(5000)),e=>{assert.equal(e.code,'AI_PROVIDER_UNAVAILABLE');assert.equal(e.aiContext.media[0].input_method,'files_api');return true;});
 assert.equal(f.counts.interactions,2);assert.equal(f.counts.upload,1);assert.equal(f.counts.remove,1);assert.deepEqual(f.payloads[0],f.payloads[1]);
});
test('FAILED video or oversize video is explicitly skipped without claiming it was analysed',async()=>{
 const f=fixture({state:'FAILED'}),p=createGemini({config,fetchImpl:f.fetchImpl,wait:async()=>{}}),row={media:[{kind:'video',url:'https://res.cloudinary.com/demo/video/upload/a.mp4'}]};
 const failed=await p.analyze(row,AbortSignal.timeout(5000));assert.equal(failed.manifest[0].sent,false);assert.equal(failed.manifest[0].reason,'video_failed');assert.equal(f.counts.remove,1);assert.equal(f.payloads[0].input.filter(x=>x.type==='video').length,0);
 const tooLarge=fixture();const limited=createGemini({config:{...config,videoMaxBytes:8},fetchImpl:tooLarge.fetchImpl});const skipped=await limited.analyze(row,AbortSignal.timeout(5000));assert.equal(skipped.manifest[0].reason,'video_size');assert.equal(tooLarge.counts.upload,0);
});
test('untrusted URLs and malicious upload redirects never receive a fetch, bytes or API key',async()=>{
 for(const startUrl of ['https://evil.test/upload','http://generativelanguage.googleapis.com/upload/v1beta/files','https://generativelanguage.googleapis.com@evil.test/upload/v1beta/files','https://generativelanguage.googleapis.com/other']){
  const f=fixture({startUrl}),p=createGemini({config,fetchImpl:f.fetchImpl});const r=await p.analyze({media:[{kind:'video',url:'https://res.cloudinary.com/demo/video/upload/a.mp4'}]},AbortSignal.timeout(5000));assert.equal(f.counts.upload,0);assert.equal(r.manifest[0].sent,false);
 }
 const f=fixture(),p=createGemini({config,fetchImpl:f.fetchImpl});const r=await p.analyze({media:[{kind:'video',url:'http://127.0.0.1/private'},{kind:'video',url:'https://www.youtube.com/watch?v=not-a-bound-file'}]},AbortSignal.timeout(5000));assert.equal(f.counts.start,0);assert(r.manifest.every(x=>x.reason==='untrusted'));
});
test('mismatched file identity or URI is never sent to the model; known upload name is still deleted',async()=>{
 for(const changedFile of [{uri:'https://evil.test/file'},{mimeType:'image/png'},{name:'files/../private'}]){
  const f=fixture({changedFile}),p=createGemini({config,fetchImpl:f.fetchImpl});const r=await p.analyze({media:[{kind:'video',url:'https://res.cloudinary.com/demo/video/upload/a.mp4'}]},AbortSignal.timeout(5000));assert.equal(r.mediaIds.length,0);assert.equal(f.payloads[0].input.filter(x=>x.type==='video').length,0);if(changedFile.name===undefined)assert.equal(f.counts.remove,1);
 }
});
test('polling timeout is bounded, does not block image-only analysis, and cleans known files; cancelled job also cleans',async()=>{
 let removals=0;const fetchImpl=async(url,options={})=>{if(options.method==='DELETE'){removals++;return new Response(null);}if(String(url).includes('res.cloudinary.com'))return new Response(header,{headers:{'content-type':'video/mp4'}});if(url.endsWith('/interactions'))return complete();if(url===root+'/upload/v1beta/files')return new Response(null,{headers:{'x-goog-upload-url':root+'/upload/v1beta/files?upload_id=fixture'}});return Response.json(url.includes('upload_id')?{file:file({state:'PROCESSING'})}:file({state:'PROCESSING'}));};
 const r=await createGemini({config:{...config,videoPrepareTimeout:30},fetchImpl}).analyze({media:[{kind:'video',url:'https://res.cloudinary.com/demo/video/upload/a.mp4'}]},AbortSignal.timeout(2000));assert.equal(r.manifest[0].reason,'video_timeout');assert.equal(removals,1);
 const controller=new AbortController();let waiting=false;const p=createGemini({config,fetchImpl,wait:async(ms,value,{signal})=>{waiting=true;controller.abort();await delay(1000,undefined,{signal});}});
 await assert.rejects(p.analyze({media:[{kind:'video',url:'https://res.cloudinary.com/demo/video/upload/a.mp4'}]},controller.signal),{code:'AI_JOB_TIMEOUT'});assert(waiting);assert.equal(removals,2);
});
test('separate budgets and progress messages cover five allowed videos, without a five-minute content cutoff',()=>{
 const c=parseAiConfig({MEDIA_MAX_VIDEOS:'5'});assert(c.jobTimeout>=c.mediaPrepareTimeout+c.videoPrepareTimeout*5+c.providerMaxTimeout*c.maxAttempts);assert.equal(aiRequestTimeout(c,4,1),196000);assert.equal(aiRequestTimeout(c,4,3),300000);
 assert.throws(()=>parseAiConfig({AI_VIDEO_MAX_MB:'101'}));assert.throws(()=>parseAiConfig({AI_VIDEO_PREPARE_TIMEOUT_MS:'600001'}));
 assert.match(aiProgressMessage({state:'running',progress:{phase:'video_processing',media_id:'M4'}}),/M4/);assert.match(aiProgressMessage({state:'running',progress:{phase:'video_upload',media_id:'M4'}}),/Files API/);
});

test('videos are downloaded/uploaded/activated sequentially; two unique files are deleted after one inference',async()=>{
 let started=0,active=0,deleted=0;const order=[];
 const fetchImpl=async(url,options={})=>{
  if(String(url).includes('res.cloudinary.com')){order.push('download');assert.equal(started,active,'next buffer must wait for previous ACTIVE');return new Response(header,{headers:{'content-type':'video/mp4'}});}
  if(options.method==='DELETE'){deleted++;return new Response(null);}
  if(url===root+'/upload/v1beta/files'){started++;return new Response(null,{headers:{'x-goog-upload-url':root+'/upload/v1beta/files?upload_id='+started}});}
  if(String(url).includes('upload_id='))return Response.json({file:file({name:'files/video-'+started,uri:root+'/v1beta/files/video-'+started,state:'PROCESSING'})});
  if(String(url).includes('/v1beta/files/')){active++;return Response.json(file({name:'files/video-'+active,uri:root+'/v1beta/files/video-'+active}));}
  return complete();
 };
 const p=createGemini({config,fetchImpl,wait:async()=>{}}),r=await p.analyze({media:[1,2].map(n=>({kind:'video',url:'https://res.cloudinary.com/demo/video/upload/'+n+'.mp4'}))},AbortSignal.timeout(2000));
 assert.equal(r.mediaIds.length,2);assert.equal(active,2);assert.equal(deleted,2);assert.equal(order.length,2);
});
test('a stalled Files status body is cancelled by its deadline, then the known temporary video is cleaned',async()=>{
 let cancelled=0,removed=0;
 const fetchImpl=async(url,options={})=>{
  if(String(url).includes('res.cloudinary.com'))return new Response(header,{headers:{'content-type':'video/mp4'}});
  if(options.method==='DELETE'){removed++;return new Response(null);}
  if(url===root+'/upload/v1beta/files')return new Response(null,{headers:{'x-goog-upload-url':root+'/upload/v1beta/files?upload_id=fixture'}});
  if(String(url).includes('upload_id='))return Response.json({file:file({state:'PROCESSING'})});
  if(url===root+'/v1beta/files/test-video')return new Response(new ReadableStream({cancel(){cancelled++;}}));
  return complete();
 };
 const r=await createGemini({config:{...config,videoPrepareTimeout:30},fetchImpl,wait:async()=>{}}).analyze({media:[{kind:'video',url:'https://res.cloudinary.com/demo/video/upload/a.mp4'}]},AbortSignal.timeout(2000));
 assert.equal(r.manifest[0].reason,'video_timeout');assert.equal(cancelled,1);assert.equal(removed,1);
});
