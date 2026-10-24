/** Tín hiệu vô hiệu hóa sau COMMIT; không đưa giá, người đặt, quyết định hoặc ngưỡng ẩn vào Pub/Sub. */
import {parseAuctionId} from '../services/auction.service.js';
export const AUCTION_UPDATES='bookauction:auction:updates';
export function createAuctionNotifier({getRedis,channel=AUCTION_UPDATES}) {
  return async auctionId=>{await getRedis().publish(channel,JSON.stringify({auctionId:parseAuctionId(auctionId)}));};
}
export async function subscribeAuctionUpdates({subscriber,onChange,channel=AUCTION_UPDATES,log=()=>{}}) {
  await subscriber.subscribe(channel,raw=>{
    try {
      const input=JSON.parse(raw);
      if(!input||Object.keys(input).length!==1||typeof input.auctionId!=='number')return;
      const auctionId=parseAuctionId(input.auctionId);
      onChange(auctionId);
    } catch(error){log(error,{component:'auction-updates'});}
  });
}
