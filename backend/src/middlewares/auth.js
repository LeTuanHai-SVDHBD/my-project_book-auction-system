/** CSRF và phân quyền HTTP; vai trò luôn được đọc lại từ SQL Server. */
import { timingSafeEqual } from 'node:crypto';
import { HttpError } from './errorHandler.js';
import { publicUser } from '../services/auth.service.js';
export function requireCsrf(req, res, next) {
  const expected = req.session?.csrfToken;
  const received = req.get('x-csrf-token');
  const a = Buffer.from(typeof expected === 'string' ? expected : '');
  const b = Buffer.from(typeof received === 'string' ? received : '');
  if (!a.length || a.length !== b.length || !timingSafeEqual(a, b)) {
    return next(new HttpError(403, 'INVALID_CSRF', 'Phiên biểu mẫu đã hết hạn. Vui lòng tải lại rồi thử lại.'));
  }
  next();
}
export function requireUser(users) {
  return async (req, res, next) => {
    if (!Number.isInteger(req.session?.userId)) throw new HttpError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập.');
    const user = await users.findById(req.session.userId);
    if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Tài khoản không còn tồn tại.');
    req.user = publicUser(user); next();
  };
}
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new HttpError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập.'));
    if (!roles.includes(req.user.vai_tro)) return next(new HttpError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.'));
    next();
  };
}
export function rateLimit(limiter, action) {
  return async (req, res, next) => {
    const retryAfter = await limiter.consume(action, { ip: req.ip, email: req.authInput?.email });
    if (retryAfter > 0) {
      res.set('Retry-After', String(retryAfter));
      throw new HttpError(429, 'RATE_LIMITED', 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.');
    }
    next();
  };
}
