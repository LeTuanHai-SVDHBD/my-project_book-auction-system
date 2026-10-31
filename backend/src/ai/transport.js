/** Đọc cả response body trong deadline; luôn hủy stream khi quá giới hạn hoặc bị ngắt. */
export async function boundedBytes(response,limit,signal) {
  if(!response.body||Number(response.headers.get('content-length'))>limit){void response.body?.cancel().catch(()=>{});throw Error('AI_RESPONSE_TOO_LARGE');}
  const reader=response.body.getReader(),parts=[];let size=0,complete=false;
  const abort=()=>{void reader.cancel(signal.reason).catch(()=>{});};
  signal?.addEventListener('abort',abort,{once:true});
  try {
    signal?.throwIfAborted();
    while(true) {
      const {done,value}=await reader.read();signal?.throwIfAborted();
      if(done){complete=true;break;}
      size+=value.length;if(size>limit)throw Error('AI_RESPONSE_TOO_LARGE');parts.push(value);
    }
    return Buffer.concat(parts);
  }finally {
    signal?.removeEventListener('abort',abort);
    if(!complete)void reader.cancel().catch(()=>{});
    reader.releaseLock();
  }
}
