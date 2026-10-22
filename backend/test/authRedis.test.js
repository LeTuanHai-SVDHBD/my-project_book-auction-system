/** Kiểm tra Redis thật theo opt-in; mỗi lần dùng prefix UUID riêng và tự dọn khóa đó. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import { createApp } from '../src/app.js';
import { createAuthRouter } from '../src/routes/auth.routes.js';
import { parseAuthConfig } from '../src/config/auth.js';
import { passwords } from '../src/services/password.service.js';
import { createAuthRateLimiter } from '../src/services/authRateLimit.service.js';
test('Redis thật: TTL 2 giờ, gia hạn, hết hạn, thu hồi session và giới hạn đồng thời',
  { skip: !process.env.AUTH_TEST_REDIS_URL, timeout: 20000 }, async t => {
    const redis = createClient({ url: process.env.AUTH_TEST_REDIS_URL, disableOfflineQueue: true,
      socket: { connectTimeout: 3000, reconnectStrategy: false } });
    redis.on('error', () => {});
    const prefix = `bookauction:test:auth:${randomUUID()}:`;
    await redis.connect();
    t.after(async () => {
      if (redis.isReady) {
        const keys = await redis.keys(prefix + '*'); if (keys.length) await redis.del(keys);
      }
      if (redis.isOpen) redis.destroy();
    });
    const user = { nguoi_dung_id: 1, ho_ten: 'Redis Test', email: 'redis@example.test',
      mat_khau: await passwords.hash('test-password-long-enough'), vai_tro: 'admin' };
    const users = { findById: async id => id === 1 ? user : null, findByEmail: async () => user };
    const authConfig = parseAuthConfig({ SESSION_SECRET: 'redis-test-only-'.repeat(4) });
    const limiter = createAuthRateLimiter({ getRedis: () => redis, secret: authConfig.secret, prefix: prefix + 'limit:' });
    const router = createAuthRouter({ authConfig, store: new RedisStore({ client: redis, prefix: prefix + 'session:' }),
      users, passwords, limiter, ready: () => redis.isReady });
    const server = createServer(createApp({ config: { mode: 'development', origins: ['http://127.0.0.1:5173'], probeToken: 'x'.repeat(48) },
      deps: {}, probes: {}, authRouter: router }));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const base = `http://127.0.0.1:${server.address().port}/api/auth`;
    let cookie = ''; let csrfToken;
    async function call(path, body) {
      const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: {
        ...(cookie ? { cookie } : {}), ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
      for (const value of response.headers.getSetCookie()) if (value.startsWith('bookauction.sid=')) cookie = value.split(';')[0];
      const data = response.status === 204 ? null : await response.json();
      if (data?.csrfToken) csrfToken = data.csrfToken;
      return { response, data };
    }
    await call('/csrf');
    assert.equal((await call('/login', { email: user.email, mat_khau: 'test-password-long-enough' })).response.status, 200);
    let keys = await redis.keys(prefix + 'session:*'); assert.equal(keys.length, 1);
    const key = keys[0]; assert((await redis.ttl(key)) >= 7198);
    await redis.expire(key, 10);
    assert.equal((await call('/me')).response.status, 200);
    assert((await redis.ttl(key)) >= 7198, 'Request đang hoạt động phải gia hạn TTL về 2 giờ');
    assert.equal((await call('/admin-check')).response.status, 200);
    const oldCookie = cookie;
    assert.equal((await call('/logout', {})).response.status, 204);
    assert.equal(await redis.exists(key), 0);
    cookie = oldCookie; assert.equal((await call('/me')).response.status, 401);
    await call('/csrf'); await call('/login', { email: user.email, mat_khau: 'test-password-long-enough' });
    keys = await redis.keys(prefix + 'session:*');
    for (const sessionKey of keys) await redis.pExpire(sessionKey, 1);
    await new Promise(resolve => setTimeout(resolve, 15));
    assert.equal((await call('/me')).response.status, 401);
    const attempts = await Promise.all(Array.from({ length: 20 }, () => limiter.consume('login', { ip: 'test-concurrency-ip', email: 'concurrent@example.test' })));
    assert.equal(attempts.filter(value => value === 0).length, 10);
    assert.equal(attempts.filter(value => value > 0).length, 10);
    const limitKeys = await redis.keys(prefix + 'limit:*');
    assert(limitKeys.every(limitKey => !limitKey.includes('@') && !limitKey.includes('test-concurrency-ip')));
  });
