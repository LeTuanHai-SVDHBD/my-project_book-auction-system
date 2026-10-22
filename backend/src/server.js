/**
 * Khởi động HTTP API và Socket.IO.
 * Mở kết nối dịch vụ và xử lý đóng ứng dụng.
 * Không đặt logic nghiệp vụ đấu giá trong file này.
 */
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { config } from './config/env.js';
import { getPool, closeDatabase } from './config/database.js';
import { redis, connectRedis, requireRedis } from './config/redis.js';
import { databaseStatus, redisStatus, workerStatus } from './services/infrastructure.service.js';
import { enqueueProbe } from './events/eventPublisher.js';
import { INFRA } from './constants/infrastructure.js';
import { createApp } from './app.js';
import { logger, logError } from './utils/logger.js';
const app = createApp({ config, deps: { sqlserver: databaseStatus, redis: redisStatus, worker: workerStatus },
  probes: { enqueue: () => enqueueProbe(requireRedis()), get: async id => {
    const raw = await requireRedis().get(INFRA.resultPrefix + id); return raw ? JSON.parse(raw) : null;
  } }, log: logError });
const server = createServer(app);
const io = new Server(server, { cors: { origin: config.origins },
  allowRequest: (req, callback) => callback(null, !req.headers.origin || config.origins.includes(req.headers.origin)) });
io.on('connection', socket => socket.emit('system:hello', { message: 'Socket.IO sẵn sàng', serverTime: new Date().toISOString() }));
server.listen(config.port, config.host, () => logger.info({ host: config.host, port: config.port }, 'API đã chạy'));
server.on('error', error => { logError(error, { component: 'http-server' }); void shutdown(1); });
void Promise.allSettled([getPool(), connectRedis()]).then(results => {
  results.forEach((r, i) => { if (r.status === 'rejected') logError(r.reason, { component: i === 0 ? 'startup-sql' : 'startup-redis' }); });
});
let stopping = false;
async function shutdown(code = 0) {
  if (stopping) return; stopping = true;
  const force = setTimeout(() => process.exit(1), 10000); force.unref();
  await new Promise(resolve => io.close(resolve));
  if (redis.isOpen) redis.destroy();
  await closeDatabase().catch(logError); clearTimeout(force); process.exit(code);
}
process.on('SIGINT', () => void shutdown()); process.on('SIGTERM', () => void shutdown());
