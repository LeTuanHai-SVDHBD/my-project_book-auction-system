/** Tìm hạn theo đồng hồ SQL và xếp sự kiện chốt; không kết thúc phiên trực tiếp trong job. */
import {setTimeout as delay} from 'node:timers/promises';
export async function scanExpired({model,publisher}) {
  const rows=await model.expired(50);
  for(const row of rows)await publisher.expiry(row.phien_dau_gia_id);
  return rows.length;
}
export async function runAuctionExpiry({model,publisher,signal,intervalMs=1000,log=()=>{}}) {
  while(!signal.aborted) {
    try{await scanExpired({model,publisher});}catch(error){log(error,{component:'auction-expiry'});}
    await delay(intervalMs,undefined,{signal}).catch(()=>{});
  }
}
