import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../src/app.js';
import { parseConfig } from '../src/config/parseConfig.js';
import { validateProbe, processProbe } from '../src/processors/systemProbe.processor.js';
import { INFRA } from '../src/constants/infrastructure.js';
const id = '88e40575-cf9a-42ae-b4be-d8cb1dbd5f46';
const token = 'x'.repeat(48);
const cfg = { mode: 'development', origins: ['http://127.0.0.1:5173'], probeToken: token };
const healthy = { sqlserver: async () => ({ ok: true, tables: 19, columns: 142 }), redis: async () => ({ ok: true }), worker: async () => ({ ok: true }) };
async function serve(t, options = {}) {
  const app = createApp({ config: cfg, deps: healthy, probes: { enqueue: async () => ({ requestId: id, status: 'queued' }), get: async () => null }, ...options });
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}`;
}
test('readiness chỉ xanh khi SQL, Redis và worker cùng sẵn sàng', async t => {
  const url = await serve(t); const r = await fetch(url + '/api/health/ready');
  assert.equal(r.status, 200); assert.equal((await r.json()).ok, true);
});
test('SQL lỗi trả 503 và không lộ thông tin lỗi kết nối', async t => {
  const url = await serve(t, { deps: { ...healthy, sqlserver: async () => { throw new Error('secret-password'); } } });
  const r = await fetch(url + '/api/health/ready'); const body = await r.text();
  assert.equal(r.status, 503); assert(!body.includes('secret-password')); assert.equal(JSON.parse(body).services.sqlserver.ok, false);
});
test('thiếu worker không bị báo môi trường đã hoàn tất', async t => {
  const url = await serve(t, { deps: { ...healthy, worker: async () => ({ ok: false }) } });
  const r = await fetch(url + '/api/health/ready'); assert.equal(r.status, 503);
});
test('liveness vẫn chạy khi dịch vụ phụ thuộc hỏng', async t => {
  const fail = async () => { throw new Error('unavailable'); };
  const url = await serve(t, { deps: { sqlserver: fail, redis: fail, worker: fail } });
  assert.equal((await fetch(url + '/api/health/live')).status, 200);
});
test('không có token thì không được đưa thông điệp vào Streams', async t => {
  let sent = 0;
  const url = await serve(t, { probes: { enqueue: async () => { sent++; }, get: async () => null } });
  const r = await fetch(url + '/api/dev/probes', { method: 'POST' });
  assert.equal(r.status, 401); assert.equal(sent, 0);
});
test('POST thử nghiệm trả 202 queued, chưa thông báo xử lý thành công', async t => {
  const url = await serve(t);
  const r = await fetch(url + '/api/dev/probes', { method: 'POST', headers: { 'x-dev-token': token } });
  assert.equal(r.status, 202); assert.equal((await r.json()).status, 'queued');
});
test('mã yêu cầu sai định dạng bị chặn trước truy vấn Redis', async t => {
  const url = await serve(t, { probes: { get: () => { throw new Error('must-not-run'); } } });
  assert.equal((await fetch(url + '/api/dev/probes/not-a-uuid', { headers: { 'x-dev-token': token } })).status, 400);
});
test('API thử nghiệm bị tắt ngoài development', async t => {
  const url = await serve(t, { config: { ...cfg, mode: 'production' } });
  assert.equal((await fetch(url + '/api/dev/probes', { method: 'POST', headers: { 'x-dev-token': token } })).status, 404);
});
test('origin ngoài danh sách bị từ chối', async t => {
  const url = await serve(t);
  assert.equal((await fetch(url + '/api/health/live', { headers: { origin: 'https://unrelated.example' } })).status, 403);
});
test('JSON hỏng trả 400 và không lộ stack', async t => {
  const url = await serve(t);
  const r = await fetch(url + '/api/dev/probes', { method: 'POST', headers: { 'x-dev-token': token, 'Content-Type': 'application/json' }, body: '{' });
  const body = await r.json(); assert.equal(r.status, 400); assert(!('stack' in body));
});
test('parse false đúng nghĩa và từ chối database identifier nguy hiểm', () => {
  const env = { DB_PASSWORD: 'not-an-actual-secret', DEV_PROBE_TOKEN: token, DB_ENCRYPT: 'false' };
  assert.equal(parseConfig(env).sql.options.encrypt, false);
  assert.throws(() => parseConfig({ ...env, DB_DATABASE: 'x]; DROP DATABASE x;' }), /DB_DATABASE/);
  assert.throws(() => parseConfig({ ...env, API_PORT: '-1' }), /API_PORT/);
});
test('worker thử nghiệm không nhận sự kiện đấu giá', () => {
  assert.throws(() => validateProbe({ eventType: 'bid.placed', eventId: id }), /INVALID_INFRA_EVENT/);
});
test('lỗi SQL không ghi kết quả completed giả', async () => {
  let saved = false;
  await assert.rejects(processProbe({ event: { eventType: INFRA.eventType, eventId: id }, consumer: 'test',
    client: { get: async () => null, set: async () => { saved = true; } },
    getPool: async () => { throw new Error('SQL unavailable'); } }), /SQL unavailable/);
  assert.equal(saved, false);
});
test('xử lý lại probe đã hoàn tất không truy vấn SQL lần nữa', async () => {
  const prior = { requestId: id, status: 'completed' };
  const result = await processProbe({ event: { eventType: INFRA.eventType, eventId: id }, consumer: 'test',
    client: { get: async () => JSON.stringify(prior) }, getPool: async () => { throw new Error('must-not-run'); } });
  assert.deepEqual(result, prior);
});
