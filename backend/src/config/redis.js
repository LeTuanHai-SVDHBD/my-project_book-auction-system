import { createClient } from 'redis';
import { config } from './env.js';
import { logError } from '../utils/logger.js';
export function makeRedisClient(label) {
  const client = createClient({ url: config.redisUrl, disableOfflineQueue: true,
    socket: { connectTimeout: 3000, reconnectStrategy: retries => retries >= 4 ? new Error('Redis chưa sẵn sàng; kiểm tra Docker rồi khởi động lại tiến trình.') : Math.min(250 * (retries + 1), 1000) } });
  client.on('error', error => logError(error, { component: label }));
  return client;
}
export const redis = makeRedisClient('redis-commands');
export async function connectRedis() { if (!redis.isOpen) await redis.connect(); return redis; }
export function requireRedis() {
  if (!redis.isReady) { const e = new Error('Redis chưa sẵn sàng.'); e.code = 'REDIS_NOT_READY'; throw e; }
  return redis;
}
