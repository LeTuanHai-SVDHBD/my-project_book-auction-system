import { INFRA, isProbeId } from '../constants/infrastructure.js';
// Infrastructure probe only. No auction table is INSERTed or UPDATEd here.
export function validateProbe(event) {
  if (!event || event.eventType !== INFRA.eventType || !isProbeId(event.eventId)) throw new Error('INVALID_INFRA_EVENT');
  return event;
}
export async function processProbe({ event, client, getPool, consumer }) {
  validateProbe(event);
  const key = INFRA.resultPrefix + event.eventId;
  const prior = await client.get(key);
  if (prior && JSON.parse(prior).status === 'completed') return JSON.parse(prior);
  const pool = await getPool();
  const query = await pool.request().query('SELECT 1 AS ok, DB_NAME() AS databaseName, SYSUTCDATETIME() AS serverTime');
  const row = query.recordset[0];
  const result = { requestId: event.eventId, status: 'completed', consumer,
    sqlOk: row.ok === 1, databaseName: row.databaseName, processedAt: new Date().toISOString() };
  await client.set(key, JSON.stringify(result), { EX: INFRA.resultTtl });
  return result;
}
