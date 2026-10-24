/** Khóa Redis theo phiên; quyền sở hữu bằng token, SQL vẫn phải bảo vệ bằng transaction và rowversion. */
import {randomUUID} from 'node:crypto';

const releaseScript="if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end";
const renewScript="if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE',KEYS[1],ARGV[2]) else return 0 end";

export function createAuctionLock({getRedis,keyPrefix='bookauction:auction:lock:',leaseMs=15000}) {
  if(!Number.isInteger(leaseMs)||leaseMs<100)throw new TypeError('Thời hạn khóa phải là số nguyên từ 100 ms.');
  return {
    async acquire(auctionId) {
      if(!Number.isInteger(auctionId)||auctionId<1||auctionId>2147483647)throw new TypeError('Mã phiên không hợp lệ.');
      const client=getRedis(),key=keyPrefix+auctionId,token=randomUUID();
      if(await client.set(key,token,{NX:true,PX:leaseMs})!=='OK')return null;
      return {
        // Gia hạn chỉ thành công khi token còn sở hữu khóa, không lấy lại khóa đã mất.
        async renew(){return Number(await client.eval(renewScript,{keys:[key],arguments:[token,String(leaseMs)]}))===1;},
        async release(){return Number(await client.eval(releaseScript,{keys:[key],arguments:[token]}))===1;}
      };
    }
  };
}
