/** Cùng cơ chế session Redis cho tài khoản, bài đăng và upload; không áp vào health/probe. */
import session from 'express-session';
export function createSessionMiddleware(authConfig, store) {
  return session({ name: authConfig.cookieName, secret: authConfig.secret, store,
    resave: false, saveUninitialized: false, rolling: true,
    cookie: { ...authConfig.cookie, maxAge: authConfig.idleSeconds * 1000 } });
}
