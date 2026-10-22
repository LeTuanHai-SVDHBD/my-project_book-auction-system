/** Khai báo API tài khoản, session Redis và ranh giới xác thực/phân quyền. */
import { Router } from 'express';
import session from 'express-session';
import { HttpError } from '../middlewares/errorHandler.js';
import { requireCsrf, requireUser, requireRole, rateLimit } from '../middlewares/auth.js';
import { createAuthService, validateCredentials } from '../services/auth.service.js';
import { createAuthController } from '../controllers/auth.controller.js';
export function createAuthRouter({ authConfig, store, users, passwords, limiter, ready = () => true }) {
  const router = Router();
  const controller = createAuthController({ service: createAuthService({ users, passwords }), authConfig });
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!ready()) return next(new HttpError(503, 'AUTH_UNAVAILABLE', 'Dịch vụ đăng nhập chưa sẵn sàng.'));
    next();
  });
  router.use(session({ name: authConfig.cookieName, secret: authConfig.secret, store,
    resave: false, saveUninitialized: false, rolling: true,
    cookie: { ...authConfig.cookie, maxAge: authConfig.idleSeconds * 1000 } }));
  const validate = registering => (req, res, next) => {
    req.authInput = validateCredentials(req.body, registering); next();
  };
  router.get('/csrf', rateLimit(limiter, 'csrf'), controller.csrf);
  router.post('/register', requireCsrf, validate(true), rateLimit(limiter, 'register'), controller.register);
  router.post('/login', requireCsrf, validate(false), rateLimit(limiter, 'login'), controller.login);
  router.post('/logout', requireCsrf, controller.logout);
  router.get('/me', requireUser(users), controller.me);
  router.get('/admin-check', requireUser(users), requireRole('admin'), controller.admin);
  // Redis store callbacks đôi khi chỉ trả Error, chuẩn hóa thành 503 thay vì lộ lỗi nội bộ.
  router.use((error, req, res, next) => {
    if (!error.status) error.status = 503;
    next(error);
  });
  return router;
}
