/**
 * Kiểm tra API, SQL, Redis, worker, Socket.IO và probe bằng các dịch vụ đang chạy thật.
 */
import {config} from '../backend/src/config/env.js';
import { createRequire } from 'node:module';
const { io } = createRequire(new URL('../frontend/package.json', import.meta.url))('socket.io-client');
const base = `http://${config.host}:${config.port}`;
try {
  const live = await fetch(base + '/api/health/live', { signal: AbortSignal.timeout(10000) });
  if (!live.ok) throw new Error('API chưa chạy.');
  const r = await fetch(base + '/api/health/ready', { signal: AbortSignal.timeout(10000) });
  const health = await r.json();
  if (!r.ok || !health.ok) { console.log(JSON.stringify(health, null, 2)); throw new Error('SQL Server, Redis, schema hoặc worker chưa sẵn sàng.'); }
  const socket = io(base, { timeout: 5000, reconnection: false });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.disconnect(); reject(new Error('Không nhận được system:hello qua Socket.IO.')); }, 7000);
    socket.once('system:hello', () => { clearTimeout(timer); socket.disconnect(); resolve(); });
    socket.once('connect_error', error => { clearTimeout(timer); socket.disconnect(); reject(error); });
  });
  const headers = { 'x-dev-token': config.probeToken, 'Content-Type': 'application/json' };
  const queued = await fetch(base + '/api/dev/probes', { method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(10000) });
  const probe = await queued.json();
  if (queued.status !== 202 || probe.status !== 'queued') throw new Error('Không xếp hàng được sự kiện thử nghiệm.');
  let completed = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    const reply = await fetch(base + '/api/dev/probes/' + probe.requestId, { headers, signal: AbortSignal.timeout(10000) });
    const result = await reply.json();
    if (!reply.ok) throw new Error('Không đọc được kết quả probe.');
    if (result.status === 'completed' && result.sqlOk) { completed = true; break; }
  }
  if (!completed) throw new Error('Worker chưa hoàn tất yêu cầu thử nghiệm.');
  console.log(`PASS: API, SQL Server (20 bảng/152 trường), Redis, worker, Socket.IO và luồng Streams → worker → SQL đều hoạt động.`);
} catch (error) {
  console.error('FAIL:', String(error.message).replaceAll(config.probeToken, '[REDACTED]').replaceAll(config.sql.password, '[REDACTED]'));
  process.exitCode = 1;
}
