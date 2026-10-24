/** Readiness smoke phải chẩn đoán đúng ranh giới lỗi mà không phản chiếu credentials hoặc body lạ. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {checkSmokeReadiness,smokeConnectionCode} from '../../scripts/smokeReadiness.mjs';
const base='http://127.0.0.1:5000/api';
const services={sqlserver:{ok:true},redis:{ok:true},worker:{ok:true}};
test('smoke readiness chỉ đi tiếp khi HTTP và cả ba dependency đạt',async()=>{
  let url;
  await checkSmokeReadiness({base,fetchImpl:async value=>{url=value;return Response.json({ok:true,services});}});
  assert.equal(url,base+'/health/ready');
  await assert.rejects(checkSmokeReadiness({base,fetchImpl:async()=>Response.json({ok:true,services:{}})}),/sqlserver: CHƯA SẴN SÀNG/);
});
test('API mất kết nối/timeout có hướng dẫn dev:all, không in message chứa bí mật',async()=>{
  const secret='private-fixture-password';
  for(const error of [new TypeError(secret,{cause:{code:'ECONNREFUSED',message:secret}}),Object.assign(new Error(secret),{name:'TimeoutError'})]){
    await assert.rejects(checkSmokeReadiness({base,fetchImpl:async()=>{throw error;}}),failure=>{
      assert(failure.smokeDiagnostic);assert.match(failure.message,/dev:all/);assert(!failure.message.includes(secret));return true;
    });
  }
  assert.equal(smokeConnectionCode({cause:{errors:[{code:'ECONNREFUSED'}]}}),'ECONNREFUSED');
});
test('HTTP 503 nêu schema và heartbeat; JSON/HTML ngoài hợp đồng không phản chiếu dữ liệu',async()=>{
  const secret='private-fixture-password';
  await assert.rejects(checkSmokeReadiness({base,fetchImpl:async()=>Response.json({ok:false,secret,services:{sqlserver:{ok:false,tables:19,expectedTables:20,columns:140,expectedColumns:152},redis:{ok:true},worker:{ok:false,reason:'WORKER_NOT_RUNNING'}}},{status:503})}),error=>{
    assert.match(error.message,/HTTP 503/);assert.match(error.message,/bảng 19\/20, cột 140\/152/);assert.match(error.message,/redis: OK/);assert.match(error.message,/WORKER_NOT_RUNNING/);assert(!error.message.includes(secret));return true;
  });
  await assert.rejects(checkSmokeReadiness({base,fetchImpl:async()=>new Response(secret,{status:502})}),/HTTP 502, nội dung không phải JSON/);
  await assert.rejects(checkSmokeReadiness({base,fetchImpl:async()=>Response.json(null,{status:404})}),/HTTP 404/);
});
