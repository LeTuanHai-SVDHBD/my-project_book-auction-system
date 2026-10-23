/** HTTP đấu giá dùng cùng cookie/CSRF và selector riêng của tab. */
import {apiRequest,apiPost} from './authApi.js';
export const auctionApi={
  detail:id=>apiRequest(`/auctions/${id}`),
  bid:(id,body)=>apiPost(`/auctions/${id}/bids`,body),
  result:(id,requestId,signal)=>apiRequest(`/auctions/${id}/requests/${requestId}`,{...(signal?{signal}:{})})
};
