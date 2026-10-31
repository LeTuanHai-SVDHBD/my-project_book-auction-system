/** Gemini thật được thay bằng HTTP stub: contract REST, ảnh/video, giới hạn, lỗi và không gửi bí mật nghiệp vụ. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGemini} from '../src/ai/gemini.js';
import {parseAiConfig} from '../src/config/ai.js';
import {conditionPreview} from '../../shared/bookCondition.js';
const config=parseAiConfig({AI_ENABLED:'true',GEMINI_API_KEY:'fixture-only-key-123',CLOUDINARY_CLOUD_NAME:'demo',AI_PROVIDER_MAX_ATTEMPTS:'1'});
const png=Buffer.from('89504e470d0a1a0a','hex');
test('REST structured output, store=false, media bytes có nhãn và dữ liệu gửi không chứa giá/tài khoản',async()=>{
  let body;
  const provider=createGemini({config,fetchImpl:async(url,options)=>{
    if(String(url).startsWith('https://res.cloudinary.com/'))return new Response(png,{headers:{'content-type':'image/png'}});
    assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/interactions');assert.equal(options.headers['x-goog-api-key'],config.key);body=JSON.parse(options.body);
    return Response.json({status:'completed',model:config.model,steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify({criteria:[],warnings:[]})}]}]});
  }});
  const result=await provider.analyze({ten_sach:'Mẫu',gia_toi_thieu:'hidden-secret',email:'hidden-secret',media:[{kind:'image',url:'https://res.cloudinary.com/demo/image/upload/a.png'}]},AbortSignal.timeout(1000));
  assert.equal(body.store,false);assert.equal(body.response_format.mime_type,'application/json');assert.equal(body.input[2].type,'image');assert(!JSON.stringify(body).includes('hidden-secret'));assert.deepEqual(result.mediaIds,['M1']);
});
test('URL tùy ý không được fetch; thiếu media được ghi cảnh báo, không bịa ảnh đã quan sát',async()=>{
  let calls=0;
  const provider=createGemini({config,fetchImpl:async url=>{calls++;if(String(url).startsWith('https://res.cloudinary.com/'))return new Response(png,{headers:{'content-type':'image/png','content-length':String(config.mediaMaxBytes+1)}});assert(String(url).startsWith('https://generativelanguage.googleapis.com/'));return Response.json({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:'{"criteria":[],"warnings":[]}'}]}]});}});
  const result=await provider.analyze({media:[{kind:'image',url:'http://127.0.0.1/private'},{kind:'image',url:'https://res.cloudinary.com/demo/image/upload/oversize.png'}]},AbortSignal.timeout(1000));assert.equal(calls,2);assert.equal(result.warnings.length,2);assert.deepEqual(result.mediaIds,[]);assert(result.manifest.every(x=>x.sent===false));
});
test('Gemini nhận một mô tả đầy đủ; vẫn thấy bằng chứng riêng của sách cũ',async()=>{
  let sent;
  const provider=createGemini({config,fetchImpl:async(url,options)=>{
    sent=JSON.parse(JSON.parse(options.body).input[0].text);
    return Response.json({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:'{"criteria":[],"warnings":[]}'}]}]});
  }});
  const full='Bìa sờn, trang 10 rách; chưa xác minh ấn bản. '.repeat(100);
  await provider.analyze({mo_ta_tinh_trang:full,tinh_trang_sach:conditionPreview(full)},AbortSignal.timeout(1000));
  assert.equal(sent.book.mo_ta_tinh_trang,full.trim());
  assert(!Object.hasOwn(sent.book,'tinh_trang_sach'));
  await provider.analyze({mo_ta_tinh_trang:'Ấn bản cần đối chiếu.',tinh_trang_sach:'Thiếu trang; nguồn https://example.test/evidence'},AbortSignal.timeout(1000));
  assert(sent.book.mo_ta_tinh_trang.includes('Thiếu trang; nguồn https://example.test/evidence'));
  assert(sent.sourceUrls.includes('https://example.test/evidence'));
});
test('quota, kết quả chưa hoàn tất và JSON hỏng đều thành lỗi phân tích, không lộ provider body',async()=>{
  for(const response of [new Response('secret-provider-body',{status:429}),Response.json({status:'incomplete'}),Response.json({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:'not json'}]}]})]){
    const provider=createGemini({config,fetchImpl:async()=>response});await assert.rejects(provider.analyze({},AbortSignal.timeout(1000)),error=>!error.message.includes('secret-provider-body')&&error.status===502);
  }
  assert.equal(parseAiConfig({}).configured,false);
});

test('Giữ HTTP/provider code có ích, không giữ body hoặc phản chiếu khóa và dữ liệu sách',async()=>{
  for(const [status,body,code,providerCode] of [
    [400,{error:{code:'invalid_request',message:'fixture-only-key-123 private-book',param:'response_format.schema'}},'AI_REQUEST_REJECTED','INVALID_REQUEST'],
    [400,{error:{code:400,status:'INVALID_ARGUMENT',details:[{reason:'API_KEY_INVALID'}]}},'AI_KEY_INVALID','API_KEY_INVALID'],
    [401,{error:{code:'authentication'}},'AI_KEY_INVALID','AUTHENTICATION'],
    [402,{error:{code:'payment_required'}},'AI_BILLING_REQUIRED','PAYMENT_REQUIRED'],
    [403,{error:{code:'permission_denied'}},'AI_ACCESS_DENIED','PERMISSION_DENIED'],
    [404,{error:{code:'model_not_found'}},'AI_MODEL_NOT_FOUND','MODEL_NOT_FOUND'],
    [429,{error:{code:'quota_exceeded'}},'AI_QUOTA_EXCEEDED','QUOTA_EXCEEDED'],
    [503,{error:{code:'service_unavailable'}},'AI_PROVIDER_UNAVAILABLE','SERVICE_UNAVAILABLE']
  ]){
    const provider=createGemini({config,fetchImpl:async()=>Response.json(body,{status})});
    await assert.rejects(provider.analyze({},AbortSignal.timeout(1000)),error=>{assert.equal(error.code,code);assert.equal(error.aiDiagnostics.http_status,status);assert.equal(error.aiDiagnostics.provider_code,providerCode);assert(!JSON.stringify(error).includes('fixture-only-key-123'));assert(!JSON.stringify(error).includes('private-book'));return true;});
  }
  const invalid=createGemini({config,fetchImpl:async()=>Response.json({error:{code:'fixture-only-key-123',param:'fixture-only-key-123'}},{status:400})});
  await assert.rejects(invalid.analyze({},AbortSignal.timeout(1000)),error=>{assert.deepEqual(error.aiDiagnostics,{http_status:400});return true;});
});
test('Tách DNS/TLS, timeout và JSON lỗi, không ghi raw fetch message',async()=>{
  const network=createGemini({config,fetchImpl:async()=>{throw new TypeError('fixture-only-key-123',{cause:{code:'ENOTFOUND'}});}});
  await assert.rejects(network.analyze({},AbortSignal.timeout(1000)),error=>error.code==='AI_NETWORK_ERROR'&&error.aiDiagnostics.transport_code==='ENOTFOUND'&&!error.message.includes(config.key));
  const timeout=createGemini({config,fetchImpl:async()=>{throw new DOMException('secret','TimeoutError');}});
  await assert.rejects(timeout.analyze({},AbortSignal.timeout(1000)),{code:'AI_TIMEOUT'});
  const malformed=createGemini({config,fetchImpl:async()=>new Response('not json')});
  await assert.rejects(malformed.analyze({},AbortSignal.timeout(1000)),{code:'AI_INVALID_RESPONSE'});
});
