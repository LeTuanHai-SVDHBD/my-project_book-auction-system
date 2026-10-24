/** Gemini thật được thay bằng HTTP stub: contract REST, ảnh/video, giới hạn, lỗi và không gửi bí mật nghiệp vụ. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGemini} from '../src/ai/gemini.js';
import {parseAiConfig} from '../src/config/ai.js';
const config=parseAiConfig({AI_ENABLED:'true',GEMINI_API_KEY:'fixture-only-key-123',CLOUDINARY_CLOUD_NAME:'demo'});
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
test('quota, kết quả chưa hoàn tất và JSON hỏng đều thành lỗi phân tích, không lộ provider body',async()=>{
  for(const response of [new Response('secret-provider-body',{status:429}),Response.json({status:'incomplete'}),Response.json({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:'not json'}]}]})]){
    const provider=createGemini({config,fetchImpl:async()=>response});await assert.rejects(provider.analyze({},AbortSignal.timeout(1000)),error=>!error.message.includes('secret-provider-body')&&error.status===502);
  }
  assert.equal(parseAiConfig({}).configured,false);
});
