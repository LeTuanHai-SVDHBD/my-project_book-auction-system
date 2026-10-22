/**
 * Khởi động tiến trình xử lý sự kiện độc lập với API.
 * Quản lý consumer Redis Streams, heartbeat và dừng worker.
 */
import { hostname } from 'node:os';
import { getPool, closeDatabase } from './config/database.js';
import { redis, connectRedis, makeRedisClient } from './config/redis.js';
import { INFRA } from './constants/infrastructure.js';
import { ensureGroup, consumeProbes } from './events/eventConsumer.js';
import { processProbe } from './processors/systemProbe.processor.js';
import { logger, logError } from './utils/logger.js';
const consumer = `${hostname()}-${process.pid}`;
const reader = makeRedisClient('redis-blocking-reader');
const controller = new AbortController();
let heartbeatTimer; let heartbeatTask; let loop; let stopping = false;
async function pulse() {
  try {
    const pool = await getPool(); await pool.request().query('SELECT 1 AS ok');
    await redis.set(INFRA.heartbeat, JSON.stringify({ consumer, checkedAt: new Date().toISOString() }), { EX: INFRA.heartbeatTtl });
  } catch (error) { logError(error, { component: 'worker-heartbeat' }); }
  if (!stopping) heartbeatTimer = setTimeout(() => { heartbeatTask = pulse(); }, 3000);
}
async function start() {
  await Promise.all([getPool(), connectRedis(), reader.connect()]);
  await ensureGroup(redis); heartbeatTask = pulse();
  logger.info({ consumer }, 'Worker kiểm tra hạ tầng đã chạy');
  loop = consumeProbes({ client: redis, reader, consumer, signal: controller.signal, logger, logError,
    handle: event => processProbe({ event, client: redis, getPool, consumer }) });
  await loop;
}
async function shutdown(code = 0) {
  if (stopping) return; stopping = true; controller.abort(); clearTimeout(heartbeatTimer);
  const force = setTimeout(() => process.exit(1), 10000); force.unref();
  if (reader.isOpen) reader.destroy();
  await Promise.allSettled([loop, heartbeatTask]);
  if (redis.isOpen) redis.destroy();
  await closeDatabase().catch(logError); clearTimeout(force); process.exit(code);
}
process.on('SIGINT', () => void shutdown()); process.on('SIGTERM', () => void shutdown());
start().catch(error => { logError(error, { component: 'worker-startup' }); void shutdown(1); });
