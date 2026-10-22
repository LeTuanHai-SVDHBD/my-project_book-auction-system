/** Bộ đếm Redis nguyên tử, dùng HMAC để không lưu email/IP rõ trong tên khóa. */
import { createHmac } from 'node:crypto';
const consumeScript = `
local retry = 0
for i, key in ipairs(KEYS) do
  local count = redis.call('INCR', key)
  if count == 1 then redis.call('EXPIRE', key, ARGV[1]) end
  if count > tonumber(ARGV[i + 1]) then
    retry = math.max(retry, redis.call('TTL', key))
  end
end
return retry`;
export function createAuthRateLimiter({ getRedis, secret, prefix = 'bookauction:auth:limit:' }) {
  const digest = value => createHmac('sha256', secret).update(value).digest('hex');
  return {
    async consume(action, { ip, email = '' }) {
      const policies = {
        login: { seconds: 900, entries: [[`ip:${ip}`, 50], [`email:${email}`, 10]] },
        register: { seconds: 900, entries: [[`ip:${ip}`, 10]] },
        csrf: { seconds: 60, entries: [[`ip:${ip}`, 60]] },
      };
      const policy = policies[action];
      if (!policy) throw new Error('Unknown authentication rate policy.');
      const keys = policy.entries.map(([value]) => `${prefix}${action}:${digest(value)}`);
      return Number(await getRedis().eval(consumeScript, { keys,
        arguments: [String(policy.seconds), ...policy.entries.map(([, limit]) => String(limit))] }));
    },
  };
}
