/** Đọc JSON provider có giới hạn byte/deadline; hủy body bị treo hoặc vượt kích thước. */
export async function providerJson(response,signal,limit=1048576) {
 if(!response.body||Number(response.headers.get('content-length'))>limit){void response.body?.cancel().catch(()=>{});throw Error('INVALID_PROVIDER_JSON');}
 const reader=response.body.getReader(),parts=[];let size=0,complete=false;
 const abort=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});
 try{
  signal.throwIfAborted();
  while(true){const {done,value}=await reader.read();signal.throwIfAborted();if(done){complete=true;break;}size+=value.length;if(size>limit)throw Error('INVALID_PROVIDER_JSON');parts.push(value);}
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
 }finally{signal.removeEventListener('abort',abort);if(!complete)void reader.cancel().catch(()=>{});reader.releaseLock();}
}
