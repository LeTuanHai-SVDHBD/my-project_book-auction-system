/** Chạy client HTTP trong Node với transport giả: 429 giữ Retry-After, không tự gửi lại mật khẩu. */
import test from 'node:test';
import assert from 'node:assert/strict';
test('client chuyển Retry-After sang thời gian chờ và không tự retry đăng nhập 429',async t=>{
  const oldFetch=globalThis.fetch,oldWindow=globalThis.window;
  const storage=new Map(),calls=[];
  globalThis.window={sessionStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)}};
  globalThis.fetch=async(url,options)=>{
    calls.push({url,method:options.method});
    if(url.endsWith('/auth/csrf'))return Response.json({csrfToken:'fixture-token'});
    return Response.json({error:'RATE_LIMITED',message:'Bạn đã thử quá nhiều lần.'},{status:429,headers:{'Retry-After':'37'}});
  };
  t.after(()=>{globalThis.fetch=oldFetch;globalThis.window=oldWindow;});
  const {apiPost}=await import('../../frontend/src/services/authApi.js');
  await assert.rejects(apiPost('/auth/login',{email:'fixture@example.test',mat_khau:'fixture-password'}),error=>{
    assert.equal(error.status,429);assert.equal(error.code,'RATE_LIMITED');assert.equal(error.retryAfterSeconds,37);return true;
  });
  assert.equal(calls.length,2);assert.equal(calls.filter(x=>x.url.endsWith('/auth/login')).length,1);
});
