/** Cấu hình Gemini phía backend; tắt mặc định, không làm hỏng luồng kiểm duyệt thủ công. */
export function parseAiConfig(env) {
  if(env.AI_ENABLED!==undefined&&!['true','false',''].includes(env.AI_ENABLED))throw Error('AI_ENABLED chỉ nhận true hoặc false.');
  const integer=(name,fallback,min,max)=>{const n=Number(env[name]||fallback);if(!Number.isInteger(n)||n<min||n>max)throw Error(`${name} không hợp lệ.`);return n;};
  const key=env.GEMINI_API_KEY||'',model=env.GEMINI_MODEL||'gemini-3.8-flash';
  if(!/^[a-z0-9][a-z0-9._-]{0,100}$/.test(model))throw Error('GEMINI_MODEL không hợp lệ.');
  return {enabled:env.AI_ENABLED==='true',configured:env.AI_ENABLED==='true'&&key.length>10&&!key.includes('CHANGE_ME'),key,model,
    cloudName:env.CLOUDINARY_CLOUD_NAME||'',providerTimeout:integer('AI_PROVIDER_TIMEOUT_MS',60000,1000,90000),
    jobTimeout:120000,mediaMaxBytes:integer('AI_MEDIA_TOTAL_MB',12,1,12)*1048576};
}
