/**
 * Khởi động tiến trình xử lý sự kiện độc lập với API.
 * Quản lý consumer Redis Streams, heartbeat và dừng worker.
 */
import { hostname } from 'node:os';
import { getPool, closeDatabase, sql } from './config/database.js';
import { redis, connectRedis, makeRedisClient } from './config/redis.js';
import { INFRA } from './constants/infrastructure.js';
import { ensureGroup, consumeProbes } from './events/eventConsumer.js';
import { processProbe } from './processors/systemProbe.processor.js';
import { logger, logError } from './utils/logger.js';
import {AUCTION} from './constants/auction.js';
import {createAuctionModel} from './models/auction.model.js';
import {createAuctionLock} from './concurrency/auctionLock.js';
import {createAuctionProcessor} from './processors/auction.processor.js';
import {createAuctionPublisher} from './events/auctionPublisher.js';
import {ensureAuctionGroup,consumeAuctions} from './events/auctionConsumer.js';
import {runAuctionExpiry} from './jobs/auctionExpiry.js';
import {createAuctionNotifier} from './events/auctionUpdates.js';
const consumer = `${hostname()}-${process.pid}`;
const reader = makeRedisClient('redis-blocking-reader');
const auctionReader=makeRedisClient('redis-auction-reader');
const auctionModel=createAuctionModel({getPool,sql});
const publisher=createAuctionPublisher({getRedis:()=>redis});
const processAuction=createAuctionProcessor({model:auctionModel,locks:createAuctionLock({getRedis:()=>redis,leaseMs:AUCTION.leaseMs}),notify:createAuctionNotifier({getRedis:()=>redis}),log:logError});
const controller = new AbortController();
let heartbeatTimer; let heartbeatTask; let loops=[]; let stopping = false;
async function pulse() {
  try {
    const pool = await getPool(); await pool.request().query('SELECT 1 AS ok');
    await redis.set(INFRA.heartbeat, JSON.stringify({ consumer, checkedAt: new Date().toISOString() }), { EX: INFRA.heartbeatTtl });
  } catch (error) { logError(error, { component: 'worker-heartbeat' }); }
  if (!stopping) heartbeatTimer = setTimeout(() => { heartbeatTask = pulse(); }, 3000);
}
async function start() {
  await Promise.all([getPool(), connectRedis(), reader.connect(),auctionReader.connect()]);
  await ensureGroup(redis);await ensureAuctionGroup(redis);heartbeatTask = pulse();
  logger.info({ consumer }, 'Worker hạ tầng và đấu giá đã chạy');
  loops=[consumeProbes({ client: redis, reader, consumer, signal: controller.signal, logger, logError,
    handle: event => processProbe({ event, client: redis, getPool, consumer }) }),
    consumeAuctions({client:redis,reader:auctionReader,consumer,signal:controller.signal,handle:processAuction,log:logError}),
    runAuctionExpiry({model:auctionModel,publisher,signal:controller.signal,log:logError})];
  await Promise.all(loops);
}
async function shutdown(code = 0) {
  if (stopping) return; stopping = true; controller.abort(); clearTimeout(heartbeatTimer);
  const force = setTimeout(() => process.exit(1), 10000); force.unref();
  if (reader.isOpen) reader.destroy();
  if(auctionReader.isOpen)auctionReader.destroy();
  await Promise.allSettled([...loops, heartbeatTask]);
  if (redis.isOpen) redis.destroy();
  await closeDatabase().catch(logError); clearTimeout(force); process.exit(code);
}
process.on('SIGINT', () => void shutdown()); process.on('SIGTERM', () => void shutdown());
start().catch(error => { logError(error, { component: 'worker-startup' }); void shutdown(1); });
