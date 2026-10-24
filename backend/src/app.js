/** HTTP API chung: kiểm tra hạ tầng, mô-đun tài khoản và xử lý lỗi tập trung. */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { readiness } from './controllers/health.controller.js';
import { HttpError, errorHandler } from './middlewares/errorHandler.js';
import { isProbeId } from './constants/infrastructure.js';
function sameToken(received, expected) {
  const a = Buffer.from(received || ''); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function createApp({ config, deps, probes, authRouter, postRouter, mediaRouter, auctionRouter, aiRouter, communityRouter, log = () => {} }) {
  const app = express();
  app.disable('x-powered-by'); app.use(helmet());
  app.use((req, res, next) => { req.requestId = randomUUID(); res.setHeader('X-Request-ID', req.requestId); next(); });
  app.use(cors({ origin(origin, done) {
    if (!origin || config.origins.includes(origin)) done(null, true);
    else done(new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'Origin không được phép.'));
  }, credentials: true }));
  app.use(express.json({ limit: '64kb' }));
  app.get('/api/health/live', (req, res) => res.json({ ok: true, service: 'book-auction-api', milestone: 8, uptimeSeconds: Math.floor(process.uptime()) }));
  app.get('/api/health/ready', async (req, res) => {
    const report = await readiness(deps); res.status(report.ok ? 200 : 503).json(report);
  });
  // Development-only diagnostics: these endpoints never accept bids or update auction data.
  const diagnostic = express.Router();
  diagnostic.use((req, res, next) => {
    if (config.mode !== 'development') return next(new HttpError(404, 'NOT_FOUND', 'Không tìm thấy API.'));
    if (!sameToken(req.get('x-dev-token'), config.probeToken)) return next(new HttpError(401, 'INVALID_DEV_TOKEN', 'Khóa kiểm tra cục bộ không đúng.'));
    next();
  });
  diagnostic.post('/probes', async (req, res) => res.status(202).json(await probes.enqueue()));
  diagnostic.get('/probes/:id', async (req, res) => {
    if (!isProbeId(req.params.id)) throw new HttpError(400, 'INVALID_ID', 'Mã yêu cầu không hợp lệ.');
    const result = await probes.get(req.params.id);
    if (!result) throw new HttpError(404, 'PROBE_EXPIRED', 'Không tìm thấy hoặc yêu cầu đã hết hạn.');
    res.json(result);
  });
  app.use('/api/dev', diagnostic);
  if (authRouter) app.use('/api/auth', authRouter);
  if (postRouter) app.use('/api/posts', postRouter);
  if (mediaRouter) app.use('/api/media', mediaRouter);
  if (auctionRouter) app.use('/api/auctions', auctionRouter);
  if (aiRouter) app.use('/api/ai', aiRouter);
  if (communityRouter) app.use('/api/community',communityRouter);
  app.use((req, res, next) => next(new HttpError(404, 'NOT_FOUND', 'Không tìm thấy API.')));
  app.use(errorHandler(log));
  return app;
}
