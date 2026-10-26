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
import {parseAiConfig} from './config/ai.js';
import {createAiModel} from './models/ai.model.js';
import {createPostModel} from './models/post.model.js';
import {createAiQueue} from './ai/queue.js';
import {createGemini} from './ai/gemini.js';
import {createAiProcessor} from './ai/processor.js';
import {ensureAiGroup,consumeAi} from './ai/consumer.js';
import {createAiService} from './services/ai.service.js';
import {reconcileAi} from './ai/reconcile.js';
const consumer = `${hostname()}-${process.pid}`;
const reader = makeRedisClient('redis-blocking-reader');
const auctionReader=makeRedisClient('redis-auction-reader');
const auctionModel=createAuctionModel({getPool,sql});
const publisher=createAuctionPublisher({getRedis:()=>redis});
const processAuction=createAuctionProcessor({model:auctionModel,locks:createAuctionLock({getRedis:()=>redis,leaseMs:AUCTION.leaseMs}),notify:createAuctionNotifier({getRedis:()=>redis}),log:logError});
const controller = new AbortController();
const aiReader=makeRedisClient('redis-ai-reader'),aiConfig=parseAiConfig(process.env),aiModel=createAiModel({getPool,sql}),posts=createPostModel({getPool,sql}),aiQueue=createAiQueue({getRedis:()=>redis});
const aiService=createAiService({posts,model:aiModel,queue:aiQueue,config:aiConfig});
const processAi=createAiProcessor({posts,model:aiModel,queue:aiQueue,provider:createGemini({config:aiConfig}),locks:createAuctionLock({getRedis:()=>redis,keyPrefix:'bookauction:ai:lock:',leaseMs:180000}),config:aiConfig,signal:controller.signal});
let heartbeatTimer; let heartbeatTask; let loops=[]; let stopping = false;
async function pulse() {
  try {
    const pool = await getPool(); await pool.request().query('SELECT 1 AS ok');
    await redis.set(INFRA.heartbeat, JSON.stringify({ consumer, checkedAt: new Date().toISOString() }), { EX: INFRA.heartbeatTtl });
  } catch (error) { logError(error, { component: 'worker-heartbeat' }); }
  if (!stopping) heartbeatTimer = setTimeout(() => { heartbeatTask = pulse(); }, 3000);
}
async function start() {
  await Promise.all([getPool(), connectRedis(), reader.connect(),auctionReader.connect(),aiReader.connect()]);
  await ensureGroup(redis);await ensureAuctionGroup(redis);await ensureAiGroup(redis);heartbeatTask = pulse();
  logger.info({ consumer }, 'Worker hạ tầng và đấu giá đã chạy');
  loops=[consumeProbes({ client: redis, reader, consumer, signal: controller.signal, logger, logError,
    handle: event => processProbe({ event, client: redis, getPool, consumer }) }),
    consumeAuctions({client:redis,reader:auctionReader,consumer,signal:controller.signal,handle:processAuction,log:logError}),
    runAuctionExpiry({model:auctionModel,publisher,signal:controller.signal,log:logError}),
    consumeAi({client:redis,reader:aiReader,consumer,signal:controller.signal,handle:processAi,log:logError}),
    reconcileAi({model:aiModel,service:aiService,config:aiConfig,signal:controller.signal,log:logError})];
  await Promise.all(loops);
}
async function shutdown(code = 0) {
  if (stopping) return; stopping = true; controller.abort(); clearTimeout(heartbeatTimer);
  const force = setTimeout(() => process.exit(1), 10000); force.unref();
  if (reader.isOpen) reader.destroy();
  if(auctionReader.isOpen)auctionReader.destroy();
  if(aiReader.isOpen)aiReader.destroy();
  await Promise.allSettled([...loops, heartbeatTask]);
  if (redis.isOpen) redis.destroy();
  await closeDatabase().catch(logError); clearTimeout(force); process.exit(code);
}
process.on('SIGINT', () => void shutdown()); process.on('SIGTERM', () => void shutdown());
start().catch(error => { logError(error, { component: 'worker-startup' }); void shutdown(1); });
