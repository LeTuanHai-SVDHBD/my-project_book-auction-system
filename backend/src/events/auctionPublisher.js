/** Admission Lua: cùng mã/cùng nội dung không xếp hàng lại; SQL quyết định kết quả nghiệp vụ. */
import {randomUUID} from 'node:crypto';
import {HttpError} from '../middlewares/errorHandler.js';
import {AUCTION} from '../constants/auction.js';

const enqueueBidScript=`
local prior=redis.call('GET',KEYS[1])
if prior then
  local old=cjson.decode(prior)
  local new=cjson.decode(ARGV[1])
  if old.auctionId~=new.auctionId or old.userId~=new.userId or old.amount~=new.amount then return {-1,prior} end
  return {0,prior}
end
local id=redis.call('XADD',KEYS[2],'*','event',ARGV[1])
redis.call('SET',KEYS[1],ARGV[1])
return {1,ARGV[1]}`;
const enqueueExpiryScript=`
if redis.call('EXISTS',KEYS[1])==1 then return 0 end
redis.call('XADD',KEYS[2],'*','event',ARGV[1])
redis.call('SET',KEYS[1],'queued','EX',ARGV[2])
return 1`;

export function createAuctionPublisher({getRedis,settings=AUCTION}) {
  return {
    async bid(input) {
      const event={eventId:input.requestId,eventType:settings.bidType,...input,createdAt:new Date().toISOString()};
      const reply=await getRedis().eval(enqueueBidScript,{keys:[settings.admissionPrefix+input.requestId,settings.stream],arguments:[JSON.stringify(event)]});
      if(Number(reply[0])===-1)throw new HttpError(409,'REQUEST_ID_CONFLICT','Mã yêu cầu đã được dùng cho nội dung khác.');
      return JSON.parse(reply[1]);
    },
    async pending(requestId) {
      const value=await getRedis().get(settings.admissionPrefix+requestId);return value?JSON.parse(value):null;
    },
    async expiry(auctionId) {
      const event={eventId:randomUUID(),eventType:settings.closeType,auctionId,createdAt:new Date().toISOString()};
      return Number(await getRedis().eval(enqueueExpiryScript,{keys:[settings.closePrefix+auctionId,settings.stream],arguments:[JSON.stringify(event),String(settings.closeRetrySeconds)]}))===1;
    }
  };
}
