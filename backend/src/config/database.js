import sql from 'mssql';
import { config } from './env.js';
import { logError } from '../utils/logger.js';
let pool;
let pending;
export async function getPool() {
  if (pool?.connected) return pool;
  if (pending) return pending;
  const candidate = new sql.ConnectionPool(config.sql);
  candidate.on('error', error => logError(error, { component: 'sql-pool' }));
  pending = candidate.connect().then(connected => { pool = connected; return connected; })
    .catch(async error => { await candidate.close().catch(() => {}); throw error; })
    .finally(() => { pending = undefined; });
  return pending;
}
export async function closeDatabase() {
  if (pending) await pending.catch(() => {});
  if (pool) await pool.close();
  pool = undefined;
}
export { sql };
