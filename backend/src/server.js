/**
 * Khởi động HTTP API và Socket.IO.
 * Mở kết nối dịch vụ và xử lý đóng ứng dụng.
 * Không đặt logic nghiệp vụ đấu giá trong file này.
 */
import {createNotificationModel} from './models/notification.model.js';
import {createNotificationRouter} from './routes/notification.routes.js';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { config } from './config/env.js';
import { getPool, closeDatabase, sql } from './config/database.js';
import { RedisStore } from 'connect-redis';
import { parseAuthConfig } from './config/auth.js';
import { createUserModel } from './models/user.model.js';
import { passwords } from './services/password.service.js';
import { createAuthRateLimiter } from './services/authRateLimit.service.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { redis, connectRedis, requireRedis, makeRedisClient } from './config/redis.js';
import { databaseStatus, redisStatus, workerStatus } from './services/infrastructure.service.js';
import { enqueueProbe } from './events/eventPublisher.js';
import { INFRA } from './constants/infrastructure.js';
import { createApp } from './app.js';
import { logger, logError } from './utils/logger.js';
import { parseMediaConfig } from './config/media.js';
import { createSessionMiddleware } from './middlewares/session.js';
import { createCloudinary } from './services/cloudinary.service.js';
import { createMediaLedger } from './services/mediaLedger.service.js';
import { createPostModel } from './models/post.model.js';
import { createPostService } from './services/post.service.js';
import { createPostRouter } from './routes/post.routes.js';
import { createMediaRouter } from './routes/media.routes.js';
import {createAuctionModel} from './models/auction.model.js';
import {createAuctionPublisher} from './events/auctionPublisher.js';
import {createAuctionService} from './services/auction.service.js';
import {createAuctionRouter} from './routes/auction.routes.js';
import {createAuctionNotifier,subscribeAuctionUpdates} from './events/auctionUpdates.js';
import {attachAuctionSockets} from './realtime/auctionSockets.js';
import {createAccountControl,ACCOUNT_CONTROL_CHANNEL} from './services/accountControl.service.js';
import {attachAccountSockets} from './realtime/accountSockets.js';
import {createCommunityModel} from './models/community.model.js';
import {createCommunityService} from './services/community.service.js';
import {createCommunityRouter} from './routes/community.routes.js';
import {parseAiConfig} from './config/ai.js';
import {createAiModel} from './models/ai.model.js';
import {createAiQueue} from './ai/queue.js';
import {createAiService} from './services/ai.service.js';
import {createAiRouter} from './routes/ai.routes.js';
const authConfig = parseAuthConfig(process.env);
const users = createUserModel({ getPool, sql });
const accountControl=createAccountControl({getRedis:requireRedis,idleSeconds:authConfig.idleSeconds});
const sessionMiddleware = createSessionMiddleware(authConfig, new RedisStore({ client: redis, prefix: 'bookauction:auth:session:' }),{control:accountControl});
const mediaConfig = parseMediaConfig(process.env);
const model = createPostModel({getPool,sql});
const aiService=createAiService({posts:model,model:createAiModel({getPool,sql}),queue:createAiQueue({getRedis:requireRedis}),config:parseAiConfig(process.env)});
const aiRouter=createAiRouter({sessionMiddleware,users,service:aiService});
const provider = createCloudinary({config:mediaConfig});
const ledger = createMediaLedger({getRedis:requireRedis,provider,isReferenced:id=>model.isMediaReferenced(id),config:mediaConfig});
const communityModel=createCommunityModel({getPool,sql});
const communityRouter=createCommunityRouter({sessionMiddleware,users,model:communityModel,service:createCommunityService({model:communityModel,ledger,log:logError})});
const service = createPostService({model,ledger,limits:mediaConfig,notify:createAuctionNotifier({getRedis:requireRedis}),enqueueAi:aiService.enqueue,log:logError});
const postRouter = createPostRouter({sessionMiddleware,users,model,service,limits:mediaConfig});
const mediaRouter = createMediaRouter({sessionMiddleware,users,config:mediaConfig,provider,ledger});
const auctionModel=createAuctionModel({getPool,sql});
const auctionService=createAuctionService({model:auctionModel,publisher:createAuctionPublisher({getRedis:requireRedis})});
const auctionRouter=createAuctionRouter({sessionMiddleware,users,model:auctionModel,service:auctionService});
const authRouter = createAuthRouter({ authConfig, sessionMiddleware, users, passwords,
  limiter: createAuthRateLimiter({ getRedis: requireRedis, secret: authConfig.secret }),
  ready: () => redis.isReady });
const notificationRouter=createNotificationRouter({sessionMiddleware,users,model:createNotificationModel({getPool,sql})});
const app = createApp({ config, notificationRouter, authRouter, postRouter, mediaRouter, auctionRouter, aiRouter, communityRouter, deps: { sqlserver: databaseStatus, redis: redisStatus, worker: workerStatus },
  probes: { enqueue: () => enqueueProbe(requireRedis()), get: async id => {
    const raw = await requireRedis().get(INFRA.resultPrefix + id); return raw ? JSON.parse(raw) : null;
  } }, log: logError });
const server = createServer(app);
const io = new Server(server, { cors: { origin: config.origins, credentials:true },
  allowRequest: (req, callback) => callback(null, !req.headers.origin || config.origins.includes(req.headers.origin)) });
io.on('connection', socket => socket.emit('system:hello', { message: 'Socket.IO sẵn sàng', serverTime: new Date().toISOString() }));
const updates=attachAuctionSockets({io,model:auctionModel,log:logError});
const accounts=attachAccountSockets({io,sessionMiddleware,users,control:accountControl,log:logError});
const subscriber=makeRedisClient('redis-auction-updates');
void subscriber.connect().then(async()=>{await subscribeAuctionUpdates({subscriber,onChange:updates.changed,log:logError});await subscriber.subscribe(ACCOUNT_CONTROL_CHANNEL,accounts.changed);})
  .catch(error=>logError(error,{component:'auction-updates-startup'}));
server.listen(config.port, config.host, () => logger.info({ host: config.host, port: config.port }, 'API đã chạy'));
server.on('error', error => { logError(error, { component: 'http-server' }); void shutdown(1); });
void Promise.allSettled([getPool(), connectRedis()]).then(results => {
  results.forEach((r, i) => { if (r.status === 'rejected') logError(r.reason, { component: i === 0 ? 'startup-sql' : 'startup-redis' }); });
});
let cleaning = false;
const cleanupTimer = setInterval(async () => {
  if (cleaning || !redis.isReady || !mediaConfig.configured) return;
  cleaning = true;
  try { const result = await ledger.cleanup(); if (result.retainedClaims) logger.warn({count:result.retainedClaims}, 'Có vé media chưa rõ kết quả SQL; giữ lại để đối soát'); }
  catch(error) { logError(error,{component:'media-cleanup'}); }
  finally { cleaning = false; }
}, 60000);
cleanupTimer.unref();
let stopping = false;
async function shutdown(code = 0) {
  if (stopping) return; stopping = true; clearInterval(cleanupTimer);
  const force = setTimeout(() => process.exit(1), 10000); force.unref();
  await new Promise(resolve => io.close(resolve));
  if(subscriber.isOpen)subscriber.destroy();
  if (redis.isOpen) redis.destroy();
  await closeDatabase().catch(logError); clearTimeout(force); process.exit(code);
}
process.on('SIGINT', () => void shutdown()); process.on('SIGTERM', () => void shutdown());
