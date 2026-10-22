/** Cấu hình session; chỉ API cần secret, worker và db:init không phụ thuộc nó. */
export function parseAuthConfig(env) {
  const secret = env.SESSION_SECRET;
  if (!secret || secret.length < 32 || secret.includes('CHANGE_ME')) {
    throw new Error('SESSION_SECRET cần ít nhất 32 ký tự. Chạy npm run setup:auth ở thư mục gốc.');
  }
  const idleSeconds = Number(env.SESSION_IDLE_SECONDS || 7200);
  if (!Number.isInteger(idleSeconds) || idleSeconds < 60 || idleSeconds > 86400) {
    throw new Error('SESSION_IDLE_SECONDS phải từ 60 đến 86400 giây.');
  }
  return { secret, idleSeconds, cookieName: 'bookauction.sid',
    cookie: { httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production', path: '/' } };
}
