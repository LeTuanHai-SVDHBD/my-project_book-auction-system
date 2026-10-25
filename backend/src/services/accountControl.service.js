/** Một quyền điều khiển/tài khoản trong Redis; chỉ login hoặc reclaim tường minh được thay chủ, reconnect chỉ kiểm tra. */
import {createHash} from 'node:crypto';
import {HttpError} from '../middlewares/errorHandler.js';
import {ACCOUNT_REPLACED_MESSAGE} from '../../../shared/accountControl.js';
export const ACCOUNT_CONTROL_CHANNEL='bookauction:auth:control-updates';
const claimScript=`local old=redis.call('GET',KEYS[1]);redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2]);if old~=ARGV[1] then redis.call('PUBLISH',ARGV[3],ARGV[4]) end;return 1`;
const checkScript=`if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end;redis.call('EXPIRE',KEYS[1],ARGV[2]);return 1`;
const releaseScript=`if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end;return 0`;
export function createAccountControl({getRedis,idleSeconds,keyPrefix='bookauction:auth:control:',channel=ACCOUNT_CONTROL_CHANNEL}){
  const key=req=>keyPrefix+req.session.userId;
  function owner(req){const id=req.get('x-control-id');if(id!==undefined&&!/^[0-9a-f]{32}$/.test(id))throw new HttpError(400,'INVALID_CONTROL_ID','Mã cửa sổ không hợp lệ. Vui lòng tải lại trang.');return createHash('sha256').update(req.sessionID+':'+(id||'legacy')).digest('hex');}
  return {
    owner,
    async claim(req){const value=owner(req);await getRedis().eval(claimScript,{keys:[key(req)],arguments:[value,String(idleSeconds),channel,JSON.stringify({userId:req.session.userId,owner:value})]});},
    async assert(req){if(Number(await getRedis().eval(checkScript,{keys:[key(req)],arguments:[owner(req),String(idleSeconds)]}))!==1)throw new HttpError(409,'ACCOUNT_REPLACED',ACCOUNT_REPLACED_MESSAGE);},
    async release(req){if(Number.isInteger(req.session?.userId))await getRedis().eval(releaseScript,{keys:[key(req)],arguments:[owner(req)]});}
  };
}
