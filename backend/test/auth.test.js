/** Kiểm tra hợp đồng auth bằng HTTP thật, session store/model giả và Argon2 thật. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createAuthRateLimiter } from '../src/services/authRateLimit.service.js';
import session from 'express-session';
import { createApp } from '../src/app.js';
import { createAuthRouter } from '../src/routes/auth.routes.js';
import { parseAuthConfig } from '../src/config/auth.js';
import { passwords } from '../src/services/password.service.js';
import { validateCredentials } from '../src/services/auth.service.js';
const origin = 'http://127.0.0.1:5173';
const authConfig = parseAuthConfig({ SESSION_SECRET: 'test-only-session-secret-'.repeat(3) });
const validPassword = 'Một cụm mật khẩu đủ dài';
function fakeUsers() {
  const rows = new Map();
  return { rows,
    async findByEmail(email) { return [...rows.values()].find(row => row.email === email) || null; },
    async findById(id) { return rows.get(id) || null; },
    async create({ ho_ten, email, passwordHash, role }) {
      if (await this.findByEmail(email)) { const error = new Error(); error.code = 'EMAIL_EXISTS'; throw error; }
      const row = { nguoi_dung_id: rows.size + 1, ho_ten, email, mat_khau: passwordHash,
        vai_tro: role, ngay_tao: new Date().toISOString() };
      rows.set(row.nguoi_dung_id, row); return row;
    },
  };
}
async function serve(t, overrides = {}) {
  const users = overrides.users || fakeUsers();
  // MemoryStore chỉ dùng trong test. server.js luôn truyền RedisStore.
  const store = overrides.store || new session.MemoryStore();
  const router = createAuthRouter({ authConfig, store, users, passwords,
    limiter: { consume: async () => 0 }, ...overrides });
  const app = createApp({ config: { mode: 'development', origins: [origin], probeToken: 'x'.repeat(48) },
    deps: {}, probes: {}, authRouter: router });
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  function client() {
    return { cookie: '', csrfToken: '',
      async call(path, { method = 'GET', body, token = this.csrfToken, requestOrigin = origin } = {}) {
        const response = await fetch(base + '/api/auth' + path, { method,
          headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(token ? { 'x-csrf-token': token } : {}),
            origin: requestOrigin, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
        for (const value of response.headers.getSetCookie()) if (value.startsWith('bookauction.sid=')) this.cookie = value.split(';')[0];
        const data = response.status === 204 ? null : await response.json();
        if (data?.csrfToken) this.csrfToken = data.csrfToken;
        return { response, data };
      },
      async bootstrap() { return this.call('/csrf'); },
      async register(email = 'hai@example.test') {
        return this.call('/register', { method: 'POST', body: { ho_ten: 'Hải', email, mat_khau: validPassword } });
      },
      async login(email = 'hai@example.test', password = validPassword) {
        return this.call('/login', { method: 'POST', body: { email, mat_khau: password } });
      },
    };
  }
  return { client, users, store, base };
}
test('cấu hình session 2 giờ, HttpOnly, SameSite Lax và Secure khi production', () => {
  assert.equal(authConfig.idleSeconds, 7200); assert.equal(authConfig.cookie.httpOnly, true);
  assert.equal(authConfig.cookie.sameSite, 'lax');
  assert.equal(parseAuthConfig({ SESSION_SECRET: authConfig.secret, NODE_ENV: 'production' }).cookie.secure, true);
  assert.throws(() => parseAuthConfig({ SESSION_SECRET: 'short' }), /SESSION_SECRET/);
  assert.throws(() => parseAuthConfig({ SESSION_SECRET: authConfig.secret, SESSION_IDLE_SECONDS: 'bad' }), /SESSION_IDLE_SECONDS/);
});
test('đăng ký lưu Argon2id, chuẩn hóa email, không trả mật khẩu và không tự đăng nhập', async t => {
  const { client, users } = await serve(t); const c = client(); await c.bootstrap();
  const { response, data } = await c.register(' HAI@Example.test ');
  assert.equal(response.status, 201); assert.equal(data.user.email, 'hai@example.test');
  assert.equal(data.user.vai_tro, 'nguoi_dung'); assert(!('mat_khau' in data.user));
  assert(users.rows.get(1).mat_khau.startsWith('$argon2id$'));
  assert(await passwords.verify(users.rows.get(1).mat_khau, validPassword));
  assert.equal((await c.call('/me')).response.status, 401);
});
test('email trùng trả 409, không thay mật khẩu hoặc vai trò', async t => {
  const { client, users } = await serve(t); const c = client(); await c.bootstrap(); await c.register();
  const hash = users.rows.get(1).mat_khau;
  assert.equal((await c.register('HAI@example.test')).response.status, 409);
  assert.equal(users.rows.size, 1); assert.equal(users.rows.get(1).mat_khau, hash);
});
test('không cho truyền vai_tro admin, thiếu CSRF hoặc CSRF sai', async t => {
  const { client, users } = await serve(t); const c = client(); await c.bootstrap();
  const body = { ho_ten: 'Hải', email: 'hai@example.test', mat_khau: validPassword };
  assert.equal((await c.call('/register', { method: 'POST', body, token: '' })).response.status, 403);
  assert.equal((await c.call('/register', { method: 'POST', body, token: 'é'.repeat(64) })).response.status, 403);
  assert.equal((await c.call('/register', { method: 'POST', body: { ...body, vai_tro: 'admin' } })).response.status, 400);
  assert.equal(users.rows.size, 0);
});
test('mật khẩu sai và email lạ trả cùng thông báo, không tạo phiên đăng nhập', async t => {
  const { client } = await serve(t); const c = client(); await c.bootstrap(); await c.register();
  const wrong = await c.login('hai@example.test', 'sai'); const missing = await c.login('unknown@example.test', 'sai');
  assert.equal(wrong.response.status, 401); assert.equal(missing.response.status, 401);
  assert.equal(wrong.data.message, missing.data.message); assert.equal((await c.call('/me')).response.status, 401);
});
test('đăng nhập đổi session ID/CSRF, không hồi sinh session cũ và cấp cookie HttpOnly', async t => {
  const { client } = await serve(t); const c = client(); await c.bootstrap(); await c.register();
  const oldCookie = c.cookie; const oldCsrf = c.csrfToken;
  const login = await c.login(); assert.equal(login.response.status, 200);
  assert.notEqual(c.cookie, oldCookie); assert.notEqual(c.csrfToken, oldCsrf);
  assert(login.response.headers.getSetCookie()[0].includes('HttpOnly'));
  assert(login.response.headers.getSetCookie()[0].includes('SameSite=Lax'));
  const replay = client(); replay.cookie = oldCookie;
  assert.equal((await replay.call('/me')).response.status, 401);
  const me = await c.call('/me'); assert.equal(me.response.status, 200);
  assert.equal(me.response.headers.get('cache-control'), 'no-store'); assert(!('mat_khau' in me.data.user));
});
test('người chưa đăng nhập nhận 401, người dùng 403, Admin 200; đổi quyền có hiệu lực ngay', async t => {
  const { client, users } = await serve(t); const c = client(); await c.bootstrap();
  assert.equal((await c.call('/admin-check')).response.status, 401);
  await c.register(); await c.login(); assert.equal((await c.call('/admin-check')).response.status, 403);
  users.rows.get(1).vai_tro = 'admin'; assert.equal((await c.call('/admin-check')).response.status, 200);
  users.rows.get(1).vai_tro = 'nguoi_dung'; assert.equal((await c.call('/admin-check')).response.status, 403);
  users.rows.delete(1); assert.equal((await c.call('/me')).response.status, 401);
});
test('đăng xuất hủy session phía store; phát lại cookie cũ nhận 401', async t => {
  const { client } = await serve(t); const c = client(); await c.bootstrap(); await c.register(); await c.login();
  const oldCookie = c.cookie;
  assert.equal((await c.call('/logout', { method: 'POST', body: {} })).response.status, 204);
  const replay = client(); replay.cookie = oldCookie;
  assert.equal((await replay.call('/me')).response.status, 401);
});
test('session hết hạn trong store không được truy cập API bảo vệ', async t => {
  const { client, store } = await serve(t); const c = client(); await c.bootstrap(); await c.register(); await c.login();
  const sessions = await new Promise((resolve, reject) => store.all((error, rows) => error ? reject(error) : resolve(rows)));
  for (const [id, value] of Object.entries(sessions)) {
    value.cookie.expires = new Date(Date.now() - 1000).toISOString();
    await new Promise((resolve, reject) => store.set(id, value, error => error ? reject(error) : resolve()));
  }
  assert.equal((await c.call('/me')).response.status, 401);
});
test('giới hạn thử trả 429 và Retry-After trước khi đọc mật khẩu từ SQL', async t => {
  let calls = 0;
  const users = fakeUsers(); users.findByEmail = async () => { calls++; return null; };
  const { client } = await serve(t, { users, limiter: { consume: async action => action === 'login' ? 300 : 0 } });
  const c = client(); await c.bootstrap(); const r = await c.login();
  assert.equal(r.response.status, 429); assert.equal(r.response.headers.get('retry-after'), '300'); assert.equal(calls, 0);
});
test('đăng nhập thành công nhiều lần không tích lũy khóa email; sai vẫn chặn và hết TTL mới mở', async t => {
  let now=0,ipCount=0,emailCount=0,expires=900;
  const limiter={
    async consume(action){
      if(action!=='login')return 0;
      if(now>=expires){ipCount=0;emailCount=0;expires=now+900;}
      ipCount++;emailCount++;return ipCount>50||emailCount>10?expires-now:0;
    },
    async resetLogin(email){assert.equal(email,'hai@example.test');emailCount=0;},
  };
  const {client}=await serve(t,{limiter});const c=client();await c.bootstrap();await c.register();
  for(let i=0;i<12;i++)assert.equal((await c.login(' HAI@Example.test ')).response.status,200);
  assert.equal(emailCount,0);assert.equal(ipCount,12);
  for(let i=0;i<9;i++)assert.equal((await c.login('hai@example.test','sai')).response.status,401);
  assert.equal((await c.login()).response.status,200);assert.equal(emailCount,0);
  for(let i=0;i<10;i++)assert.equal((await c.login('hai@example.test','sai')).response.status,401);
  const limited=await c.login();assert.equal(limited.response.status,429);
  assert.equal(limited.response.headers.get('retry-after'),'900');
  now=901;assert.equal((await c.login()).response.status,200);
});
test('xóa bộ đếm chỉ đúng email đã đăng nhập, giữ bộ đếm IP và email khác',async()=>{
  const counters=new Map();let keys;
  const redis={eval:async(_script,options)=>{keys=options.keys;for(const key of keys)counters.set(key,8);return 0;},
    del:async key=>counters.delete(key)};
  const limiter=createAuthRateLimiter({getRedis:()=>redis,secret:authConfig.secret,prefix:'fixture:limit:'});
  await limiter.consume('login',{ip:'127.0.0.1',email:'other@example.test'});const other=keys[1];
  await limiter.consume('login',{ip:'127.0.0.1',email:'hai@example.test'});const [ip,email]=keys;
  await limiter.resetLogin('hai@example.test');
  assert.equal(counters.has(email),false);assert.equal(counters.get(ip),8);assert.equal(counters.get(other),8);
  assert([...counters.keys()].every(key=>!key.includes('@')&&!key.includes('127.0.0.1')));
});
test('lượt đăng nhập đúng không xóa giới hạn IP đã chạm trần',async t=>{
  let reset=0,reads=0;
  const users=fakeUsers();users.findByEmail=async()=>{reads++;return null;};
  const limiter={consume:async action=>action==='login'?180:0,resetLogin:async()=>{reset++;}};
  const {client}=await serve(t,{users,limiter});const c=client();await c.bootstrap();
  assert.equal((await c.login()).response.status,429);assert.equal(reset,0);assert.equal(reads,0);
});
test('Redis chưa sẵn sàng trả 503, không cấp cookie hoặc bỏ qua giới hạn thử', async t => {
  const { client } = await serve(t, { ready: () => false }); const c = client();
  const r = await c.bootstrap(); assert.equal(r.response.status, 503); assert.equal(c.cookie, '');
});
test('lỗi store hoặc SQL trả lỗi chung, không lộ bí mật', async t => {
  const users = fakeUsers(); users.findByEmail = async () => { throw new Error('sql-secret-connection'); };
  const { client } = await serve(t, { users }); const c = client(); await c.bootstrap();
  const r = await c.login(); assert.equal(r.response.status, 503); assert(!JSON.stringify(r.data).includes('sql-secret'));
});
test('CORS chỉ cấp credentials cho origin trong danh sách', async t => {
  const { client } = await serve(t); const c = client(); const r = await c.bootstrap();
  assert.equal(r.response.headers.get('access-control-allow-credentials'), 'true');
  assert.equal(r.response.headers.get('access-control-allow-origin'), origin);
  assert.equal(r.response.headers.get('access-control-expose-headers'),'Retry-After');
  assert.equal((await c.call('/csrf', { requestOrigin: 'https://evil.example' })).response.status, 403);
});
test('lỗi đọc RedisStore không tạo phiên đăng nhập và không lộ chi tiết', async t => {
  const store = new session.MemoryStore();
  const { client } = await serve(t, { store }); const c = client(); await c.bootstrap();
  store.get = (id, callback) => callback(new Error('redis-private-host-secret'));
  const result = await c.call('/me'); assert.equal(result.response.status, 503);
  assert(!JSON.stringify(result.data).includes('redis-private-host-secret'));
});
test('đầu vào quá dài, mật khẩu ngắn và trường lạ bị từ chối', () => {
  const body = { ho_ten: 'Hải', email: 'hai@example.test', mat_khau: validPassword };
  assert.throws(() => validateCredentials({ ...body, mat_khau: 'ngắn' }, true), /12/);
  assert.throws(() => validateCredentials({ ...body, ho_ten: 'x'.repeat(101) }, true), /Họ tên/);
  assert.throws(() => validateCredentials({ ...body, email: 'x'.repeat(255) }, true), /Email/);
  assert.throws(() => validateCredentials({ ...body, vai_tro: 'admin' }, true), /trường/);
});
