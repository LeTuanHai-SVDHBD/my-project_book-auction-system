/** Lệnh chẩn đoán dùng đúng Gemini client, không cần SQL/Redis, không in khóa và giữ exit code. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {checkAi} from '../../scripts/checkAi.mjs';
const env={AI_ENABLED:'true',GEMINI_API_KEY:'private-fixture-ai-key'};
test('ai:check dùng một lượt gọi, PASS JSON/NULL và không lộ khóa',async()=>{
  const lines=[];let calls=0;
  const code=await checkAi({env,write:x=>lines.push(x),fetchImpl:async()=>{calls++;return Response.json({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:'{"criteria":[],"warnings":[]}'}]}]});}});
  assert.equal(code,0);assert.equal(calls,1);assert(lines.some(x=>x.startsWith('PASS')));assert(!lines.join('\n').includes(env.GEMINI_API_KEY));
});
test('ai:check không gọi khi chưa cấu hình; HTTP 400 có mã rõ, exit 1 và chỉ in thông báo đã che khóa',async()=>{
  let calls=0;const lines=[];
  assert.equal(await checkAi({env:{},write:x=>lines.push(x),fetchImpl:async()=>{calls++;}}),1);assert.equal(calls,0);
  const code=await checkAi({env,write:x=>lines.push(x),fetchImpl:async()=>{calls++;return Response.json({error:{code:'invalid_request',message:`API key not valid: ${env.GEMINI_API_KEY}. Check project.`}},{status:400});}});
  assert.equal(code,1);assert.equal(calls,1);assert(lines.some(x=>x.includes('Google trả lời')&&x.includes('[REDACTED]')));assert(lines.some(x=>x.includes('HTTP 400')&&x.includes('INVALID_REQUEST')));assert(!lines.join('\n').includes(env.GEMINI_API_KEY));
});
