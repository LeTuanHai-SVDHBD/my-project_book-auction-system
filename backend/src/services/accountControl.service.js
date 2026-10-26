/** Chỉ lần đăng nhập bằng mật khẩu mới đổi chủ; thu hồi session cũ nguyên tử, tải lại chỉ kiểm tra session hiện tại. */
import {createHash} from 'node:crypto';
import {HttpError} from '../middlewares/errorHandler.js';
import {ACCOUNT_REPLACED_MESSAGE} from '../../../shared/accountControl.js';
export const ACCOUNT_CONTROL_CHANNEL='bookauction:auth:control-updates';
const claimScript=`
local prior=redis.call('GET',KEYS[1])
if prior then
  local ok,old=pcall(cjson.decode,prior)
  if ok and type(old)=='table' and type(old.sessionKey)=='string' and old.sessionKey~=ARGV[3]
     and string.sub(old.sessionKey,1,string.len(ARGV[5]))==ARGV[5] then
    redis.call('DEL',old.sessionKey)
  end
end
redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2])
redis.call('PUBLISH',ARGV[4],ARGV[6])
return 1`;
const checkScript=`local prior=redis.call('GET',KEYS[1]);if not prior then return 0 end;local ok,record=pcall(cjson.decode,prior);if not ok or type(record)~='table' or record.owner~=ARGV[1] then return 0 end;redis.call('EXPIRE',KEYS[1],ARGV[2]);return 1`;
const releaseScript=`local prior=redis.call('GET',KEYS[1]);if not prior then return 0 end;local ok,record=pcall(cjson.decode,prior);if ok and type(record)=='table' and record.owner==ARGV[1] then return redis.call('DEL',KEYS[1]) end;return 0`;
export function createAccountControl({getRedis,idleSeconds,keyPrefix='bookauction:auth:control:',sessionPrefix='bookauction:auth:session:',channel=ACCOUNT_CONTROL_CHANNEL}){
  const key=req=>keyPrefix+req.session.userId;
  function owner(req){const id=req.get('x-control-id');if(id!==undefined&&!/^[0-9a-f]{32}$/.test(id))throw new HttpError(400,'INVALID_CONTROL_ID','Mã cửa sổ không hợp lệ. Vui lòng tải lại trang.');return createHash('sha256').update(req.sessionID).digest('hex');}
  return {
    owner,
    async claim(req){const value=owner(req),sessionKey=sessionPrefix+req.sessionID;await getRedis().eval(claimScript,{keys:[key(req)],arguments:[JSON.stringify({owner:value,sessionKey}),String(idleSeconds),sessionKey,channel,sessionPrefix,JSON.stringify({userId:req.session.userId,owner:value})]});},
    async assert(req){if(Number(await getRedis().eval(checkScript,{keys:[key(req)],arguments:[owner(req),String(idleSeconds)]}))!==1)throw new HttpError(401,'ACCOUNT_REPLACED',ACCOUNT_REPLACED_MESSAGE);},
    async release(req){if(Number.isInteger(req.session?.userId))await getRedis().eval(releaseScript,{keys:[key(req)],arguments:[owner(req)]});}
  };
}
