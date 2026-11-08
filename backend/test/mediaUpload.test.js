/** Cloudinary/HTTP stream fixtures, không gọi provider thật; phục hồi chỉ đọc đúng UUID đã cấp. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudinary} from '../src/services/cloudinary.service.js';
import {parseMediaConfig,publicMediaConfig} from '../src/config/media.js';
import {mediaFailure} from '../src/services/mediaErrors.js';
import {errorHandler} from '../src/middlewares/errorHandler.js';
const config=parseMediaConfig({CLOUDINARY_CLOUD_NAME:'demo',CLOUDINARY_API_KEY:'private-fixture-key',CLOUDINARY_API_SECRET:'private-fixture-secret'});
const publicId='bookauction/4/672ed37c-0258-42c7-b512-640310b79cb2';
const input={kind:'video',publicId,bytes:Buffer.from('000000186674797069736f6d0000000069736f6d6d703432','hex'),mime:'video/mp4'};
const asset=(patch={})=>({public_id:publicId,resource_type:'video',type:'upload',secure_url:`https://res.cloudinary.com/demo/video/upload/v1/${publicId}.mp4`,...patch});
const chunkSize=6*1024*1024;
test('video lớn được gửi theo các byte range nối tiếp, chỉ xác nhận từ phần cuối',async()=>{
 const bytes=Buffer.alloc(2*chunkSize+7);bytes[0]=11;bytes[chunkSize]=22;bytes[2*chunkSize]=33;
 const requests=[];const p=createCloudinary({config,fetchImpl:async(url,options)=>{
  const {method,headers,body,signal}=options;
  assert.equal(method,'POST');assert(url.endsWith('/video/upload'));
  assert.equal(body.get('public_id'),publicId);assert.equal(body.get('overwrite'),'false');
  const file=body.get('file');
  requests.push({range:headers['Content-Range'],id:headers['X-Unique-Upload-Id'],size:file.size,
    first:new Uint8Array(await file.slice(0,1).arrayBuffer())[0],signal});
  return Response.json(requests.length<3?{done:false}:asset({done:true}));
 }});
 assert.equal((await p.upload({...input,bytes})).url,asset().secure_url);
 assert.deepEqual(requests.map(({range,size,first})=>[range,size,first]),[
  [`bytes 0-${chunkSize-1}/${bytes.length}`,chunkSize,11],
  [`bytes ${chunkSize}-${2*chunkSize-1}/${bytes.length}`,chunkSize,22],
  [`bytes ${2*chunkSize}-${bytes.length-1}/${bytes.length}`,7,33]
 ]);
 assert(requests[0].id);
 assert(requests.every(x=>x.id===requests[0].id&&x.signal===requests[0].signal));
});
test('timeout ở phần cuối tra metadata sau khoảng chờ, không gửi lại phần nào',async()=>{
 const sequence=[];let posts=0,gets=0;
 const p=createCloudinary({config,wait:async ms=>sequence.push(ms),fetchImpl:async(url,options)=>{
  if(options.method==='POST'){
   sequence.push('POST');
   if(++posts===1)return Response.json({done:false});
   throw new DOMException('last chunk reply timed out','TimeoutError');
  }
  assert(url.endsWith('/resources/video/upload/'+encodeURIComponent(publicId)));
  sequence.push('GET');return ++gets<3?new Response('',{status:404}):Response.json(asset());
 }});
 assert.equal((await p.upload({...input,bytes:Buffer.alloc(chunkSize+1)})).publicId,publicId);
 assert.deepEqual(sequence,['POST','POST','GET',2000,'GET',8000,'GET']);
});
test('không gửi phần tiếp khi Cloudinary chưa xác nhận phần trước',async()=>{
 let posts=0;const p=createCloudinary({config,wait:async()=>{},fetchImpl:async(_url,options)=>{
  if(options.method==='GET')return new Response('',{status:404});
  posts++;return Response.json(asset({done:true}));
 }});
 await assert.rejects(p.upload({...input,bytes:Buffer.alloc(chunkSize+1)}),{code:'MEDIA_PROVIDER_ERROR'});
 assert.equal(posts,1);
});
test('video đã lên nhưng upload timeout: một POST, tra đúng public ID, xác minh rồi trả URL thật',async()=>{
 const calls=[];const p=createCloudinary({config,wait:async()=>{},fetchImpl:async(url,options)=>{
  calls.push({url,method:options.method});assert(!url.includes(config.apiSecret));assert(options.headers.Authorization.startsWith('Basic '));
  if(options.method==='POST'){assert.equal(options.body.get('public_id'),publicId);assert.equal(options.body.get('overwrite'),'false');assert.equal(options.body.get('file').type,'video/mp4');throw new DOMException('raw private body','TimeoutError');}
  assert(url.endsWith('/resources/video/upload/'+encodeURIComponent(publicId)));assert.equal(options.body,undefined);return Response.json(asset());
 }});
 const result=await p.upload(input);assert.equal(result.url,asset().secure_url);assert.deepEqual(calls.map(x=>x.method),['POST','GET']);
});
test('lookup chậm hoặc 404 rồi sẵn sàng được đối soát hữu hạn, không gửi lại bytes',async()=>{
 let uploads=0,lookups=0,pauses=0;
 const p=createCloudinary({config,wait:async()=>{pauses++;},fetchImpl:async(url,options)=>{
  if(options.method==='POST'){uploads++;return Response.json({error:{message:'secret'}},{status:503});}
  lookups++;return lookups<3?new Response('',{status:404}):Response.json(asset());
 }});
 assert.equal((await p.upload(input)).kind,'video');assert.equal(uploads,1);assert.equal(lookups,3);assert.equal(pauses,2);
});
test('body response treo bị hủy đúng deadline, sau đó phục hồi từ metadata',async()=>{
 let calls=0,cancelled=0;
 const p=createCloudinary({config:{...config,videoUploadTimeoutMs:20},wait:async()=>{},fetchImpl:async(url,options)=>{
  calls++;if(options.method==='GET')return Response.json(asset());let timer;return new Response(new ReadableStream({start(c){timer=setTimeout(()=>c.enqueue(new Uint8Array([1])),200);},cancel(){clearTimeout(timer);cancelled++;}}));
 }});
 const value=await p.upload(input);assert.equal(value.publicId,publicId);assert.equal(calls,2);assert.equal(cancelled,1);
});
test('HTTP auth/quota/tệp bị từ chối không tự tra hoặc upload lại; body không được phản chiếu',async()=>{
 for(const [status,code] of [[400,'MEDIA_PROVIDER_REJECTED'],[401,'MEDIA_PROVIDER_AUTH'],[403,'MEDIA_PROVIDER_AUTH'],[413,'MEDIA_PROVIDER_LIMIT'],[420,'MEDIA_PROVIDER_LIMIT'],[429,'MEDIA_PROVIDER_LIMIT']]){
  let calls=0;const p=createCloudinary({config,fetchImpl:async()=>{calls++;return Response.json({error:{message:'private-fixture-secret'}},{status});}});
  await assert.rejects(p.upload(input),e=>e.code===code&&e.mediaDiagnostics.http_status===status&&!JSON.stringify(e).includes('private-fixture-secret'));assert.equal(calls,1);
 }
});
test('phục hồi không nhận URL đoán, asset khác, placeholder hoặc asset private',async()=>{
 for(const patch of [{public_id:'another-user-file'},{resource_type:'image'},{secure_url:'https://evil.test/video.mp4'},{secure_url:'https://res.cloudinary.com/another/video/upload/a.mp4'},{secure_url:'https://res.cloudinary.com/demo/image/upload/a.jpg'},{placeholder:true},{type:'private'}]){
  let calls=0;const p=createCloudinary({config,wait:async()=>{},fetchImpl:async(url,options)=>{calls++;if(options.method==='POST')throw new TypeError('private socket',{cause:{code:'ECONNRESET'}});return Response.json(asset(patch));}});
  await assert.rejects(p.upload(input),{code:'INVALID_MEDIA_RESPONSE'});assert.equal(calls,2);
 }
});
test('chưa có metadata sau ba lần hoặc lookup bị từ chối không báo upload thành công',async()=>{
 for(const status of [404,403,429]){
  let uploads=0,lookups=0;const p=createCloudinary({config,wait:async()=>{},fetchImpl:async(url,options)=>{if(options.method==='POST'){uploads++;throw new DOMException('private','TimeoutError');}lookups++;return new Response('',{status});}});
  await assert.rejects(p.upload(input),e=>e.code==='MEDIA_PROVIDER_TIMEOUT'&&e.recoveryDiagnostics.http_status===status);assert.equal(uploads,1);assert.equal(lookups,status===404?3:1);
 }
});
test('overwrite:false existing cần metadata xác minh; URL đúng thì nhận, không giả tệp sẵn sàng',async()=>{
 let calls=0;const p=createCloudinary({config,wait:async()=>{},fetchImpl:async(url,options)=>{calls++;return Response.json(options.method==='POST'?{existing:true}:asset());}});
 assert.equal((await p.upload(input)).url,asset().secure_url);assert.equal(calls,2);
});
test('cấu hình phân biệt ảnh/video, frontend đợi đủ upload và đối soát, không lộ khóa',()=>{
 assert.equal(config.uploadTimeoutMs,120000);assert.equal(config.videoUploadTimeoutMs,300000);
 const publicConfig=publicMediaConfig(config);assert.equal(publicConfig.uploadTimeoutMs.video,config.videoUploadTimeoutMs+45000+10000+310000);assert(publicConfig.uploadTimeoutMs.image<publicConfig.uploadTimeoutMs.video);assert(!JSON.stringify(publicConfig).includes('private-fixture'));
 for(const patch of [{MEDIA_VIDEO_UPLOAD_TIMEOUT_MS:'1'},{MEDIA_VIDEO_UPLOAD_TIMEOUT_MS:'300001'},{MEDIA_IMAGE_UPLOAD_TIMEOUT_MS:'no'},{MEDIA_RECOVERY_TIMEOUT_MS:'30001'}])assert.throws(()=>parseMediaConfig(patch));
});
test('lỗi media chỉ lộ thông báo tĩnh; lỗi nội bộ SQL vẫn được che',()=>{
 const run=error=>{let value,status;errorHandler(()=>{})(error,{requestId:'fixture'},{headersSent:false,status(n){status=n;return this;},json(v){value=v;}},()=>{});return {value,status};};
 const media=run(mediaFailure('MEDIA_PROVIDER_TIMEOUT',{http_status:504,operation:'upload'}));assert.equal(media.status,502);assert.equal(media.value.error,'MEDIA_PROVIDER_TIMEOUT');assert(!media.value.message.includes('Docker'));
 const privateError=Error('private DB password');privateError.publicMediaError=true;const unknown=run(privateError);assert.equal(unknown.value.error,'DEPENDENCY_UNAVAILABLE');assert(!JSON.stringify(unknown).includes('private DB password'));
});

test('JSON upload hỏng hoặc body vượt 1 MiB không được nhận trực tiếp; phải tra lại đúng asset',async()=>{
 for(const mode of ['invalid-json','oversize']){
  let uploads=0,lookups=0,cancelled=false;
  const p=createCloudinary({config,wait:async()=>{},fetchImpl:async(url,options)=>{
   if(options.method==='GET'){lookups++;return Response.json(asset());}
   uploads++;return mode==='invalid-json'?new Response('{broken'):
    new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(1048577));},cancel(){cancelled=true;}}));
  }});
  assert.equal((await p.upload(input)).publicId,publicId);assert.equal(uploads,1);assert.equal(lookups,1);if(mode==='oversize')assert(cancelled);
 }
});
