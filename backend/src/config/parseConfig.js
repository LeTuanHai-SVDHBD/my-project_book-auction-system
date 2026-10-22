function integer(value, fallback, min, max, name) {
  const n = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} không hợp lệ.`);
  return n;
}
function boolean(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  if (value !== 'true' && value !== 'false') throw new Error(`${name} chỉ nhận true hoặc false.`);
  return value === 'true';
}
export function parseConfig(e) {
  for (const name of ['DB_PASSWORD', 'DEV_PROBE_TOKEN']) {
    if (!e[name] || e[name].includes('CHANGE_ME')) throw new Error(`Thiếu ${name}. Hãy chạy npm run setup tại thư mục gốc.`);
  }
  if (e.DEV_PROBE_TOKEN.length < 32) throw new Error('DEV_PROBE_TOKEN phải có ít nhất 32 ký tự.');
  const database = e.DB_DATABASE || 'BookAuctionDB';
  if (!/^[A-Za-z][A-Za-z0-9_]{0,127}$/.test(database)) throw new Error('DB_DATABASE chỉ dùng chữ, số và dấu gạch dưới.');
  const origins = (e.CLIENT_ORIGINS || 'http://127.0.0.1:5173').split(',').map(x => x.trim()).filter(Boolean);
  for (const origin of origins) new URL(origin);
  const redisUrl = e.REDIS_URL || 'redis://127.0.0.1:63790';
  if (!['redis:', 'rediss:'].includes(new URL(redisUrl).protocol)) throw new Error('REDIS_URL phải dùng redis:// hoặc rediss://.');
  return {
    mode: e.NODE_ENV || 'development', host: e.API_HOST || '127.0.0.1',
    port: integer(e.API_PORT, 5000, 1, 65535, 'API_PORT'), origins,
    sql: { server: e.DB_SERVER || '127.0.0.1', port: integer(e.DB_PORT, 14330, 1, 65535, 'DB_PORT'),
      database, user: e.DB_USER || 'sa', password: e.DB_PASSWORD,
      connectionTimeout: integer(e.DB_TIMEOUT_MS, 5000, 500, 60000, 'DB_TIMEOUT_MS'),
      requestTimeout: integer(e.DB_TIMEOUT_MS, 5000, 500, 60000, 'DB_TIMEOUT_MS'),
      options: { encrypt: boolean(e.DB_ENCRYPT, false, 'DB_ENCRYPT'),
        trustServerCertificate: boolean(e.DB_TRUST_SERVER_CERTIFICATE, true, 'DB_TRUST_SERVER_CERTIFICATE'), useUTC: true },
      pool: { min: 0, max: 5, idleTimeoutMillis: 30000 } },
    redisUrl, probeToken: e.DEV_PROBE_TOKEN, logLevel: e.LOG_LEVEL || 'info',
  };
}
