/**
 * Kiểm tra kết nối SQL, số bảng/cột dự kiến, Redis PING và heartbeat của worker.
 */
import manifest from '../../schema-manifest.json' with { type: 'json' };
import { getPool } from '../config/database.js';
import { requireRedis } from '../config/redis.js';
import { INFRA } from '../constants/infrastructure.js';
const quoted = manifest.tables.map(t => `'${t}'`).join(',');
export async function databaseStatus() {
  const pool = await getPool();
  const result = await pool.request().query(`SELECT DB_NAME() AS databaseName,
    (SELECT COUNT(*) FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name='dbo' AND t.name IN (${quoted})) AS tables,
    (SELECT COUNT(*) FROM sys.columns c JOIN sys.tables t ON c.object_id=t.object_id JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name='dbo' AND t.name IN (${quoted})) AS columns`);
  const row = result.recordset[0];
  return { ok: row.tables === manifest.tables.length && row.columns === manifest.columns,
    connected: true, ...row, expectedTables: manifest.tables.length, expectedColumns: manifest.columns };
}
export async function redisStatus() { return { ok: (await requireRedis().ping()) === 'PONG' }; }
export async function workerStatus() {
  const raw = await requireRedis().get(INFRA.heartbeat);
  if (!raw) return { ok: false, reason: 'WORKER_NOT_RUNNING' };
  const heartbeat = JSON.parse(raw);
  return { ok: true, ...heartbeat };
}
