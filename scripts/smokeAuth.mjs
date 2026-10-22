/** Kiểm tra auth qua API thật; chỉ dọn tài khoản thử do chính lần chạy này tạo. */
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { config } from '../backend/src/config/env.js';
import { getPool, closeDatabase, sql } from '../backend/src/config/database.js';
const base = `http://${config.host}:${config.port}`;
const email = `smoke-${randomUUID()}@example.test`;
const password = randomBytes(24).toString('base64url');
let createdId;
let passed = false;
class Client {
  cookie = '';
  csrfToken = '';
  async call(path, method = 'GET', body, csrf = this.csrfToken) {
    const response = await fetch(`${base}/api/auth${path}`, { method,
      headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(csrf ? { 'x-csrf-token': csrf } : {}) },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
    for (const value of response.headers.getSetCookie()) if (value.startsWith('bookauction.sid=')) this.cookie = value.split(';')[0];
    const data = response.status === 204 ? null : await response.json();
    if (data?.csrfToken) this.csrfToken = data.csrfToken;
    return { response, data };
  }
}
try {
  const client = new Client();
  let result = await client.call('/me'); assert.equal(result.response.status, 401);
  result = await client.call('/csrf'); assert.equal(result.response.status, 200);
  assert(result.response.headers.getSetCookie().some(value => /HttpOnly/i.test(value)));
  const initialCookie = client.cookie;
  const credentials = { email, mat_khau: password };
  result = await client.call('/register', 'POST', { ...credentials, ho_ten: 'Kiểm tra mốc 3', vai_tro: 'admin' });
  assert.equal(result.response.status, 400);
  result = await client.call('/register', 'POST', { ...credentials, ho_ten: 'Kiểm tra mốc 3' }, '');
  assert.equal(result.response.status, 403);
  result = await client.call('/register', 'POST', { ...credentials, ho_ten: 'Kiểm tra mốc 3' });
  // Ghi lại ID ngay khi tạo để finally có thể dọn dù kiểm tra tiếp theo thất bại.
  createdId = result.data?.user?.nguoi_dung_id;
  assert.equal(result.response.status, 201); assert.equal(result.data.user.vai_tro, 'nguoi_dung');
  assert(!JSON.stringify(result.data).includes('mat_khau'));
  result = await client.call('/register', 'POST', { ...credentials, ho_ten: 'Trùng email' });
  assert.equal(result.response.status, 409);
  result = await client.call('/login', 'POST', { ...credentials, mat_khau: 'sai-mat-khau' });
  assert.equal(result.response.status, 401);
  result = await client.call('/login', 'POST', credentials);
  assert.equal(result.response.status, 200); assert.notEqual(client.cookie, initialCookie);
  result = await client.call('/me'); assert.equal(result.response.status, 200);
  assert.equal(result.data.user.email, email); assert.equal(result.response.headers.get('cache-control'), 'no-store');
  result = await client.call('/admin-check'); assert.equal(result.response.status, 403);
  const oldCookie = client.cookie;
  result = await client.call('/logout', 'POST', {}); assert.equal(result.response.status, 204);
  result = await client.call('/me'); assert.equal(result.response.status, 401);
  const replay = new Client(); replay.cookie = oldCookie;
  result = await replay.call('/me'); assert.equal(result.response.status, 401);
  passed = true;
} catch (error) {
  console.error('FAIL: kiểm tra tài khoản chưa đạt.', error.code || error.name);
  process.exitCode = 1;
} finally {
  try {
    // Email UUID riêng; không dọn tài khoản thật hoặc dữ liệu đấu giá.
    const pool = await getPool();
    await pool.request().input('email', sql.VarChar(254), email)
      .query("DELETE FROM dbo.NguoiDung WHERE email = @email AND vai_tro = 'nguoi_dung'");
    console.log('Đã dọn tài khoản thử của lần chạy này.');
  } catch {
    console.error(`Chưa dọn được tài khoản thử ${email}${createdId ? ` (ID ${createdId})` : ''}. Kiểm tra SQL Server rồi xóa riêng tài khoản này nếu có.`);
    process.exitCode = 1;
  } finally { await closeDatabase(); }
}
if (passed && !process.exitCode) {
  console.log('PASS: đăng ký, trùng email, chống tự nâng quyền, CSRF, đăng nhập, cookie HttpOnly, đổi mã phiên, phân quyền và đăng xuất/thu hồi phiên.');
}
