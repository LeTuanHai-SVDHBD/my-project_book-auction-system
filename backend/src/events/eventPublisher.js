/**
 * Ghi trạng thái queued và xuất bản sự kiện probe trong cùng một Redis MULTI.
 */
import { randomUUID } from 'node:crypto';
import { INFRA } from '../constants/infrastructure.js';
export async function enqueueProbe(client) {
  const requestId = randomUUID();
  const event = { eventId: requestId, eventType: INFRA.eventType, createdAt: new Date().toISOString() };
  const pending = { requestId, status: 'queued', createdAt: event.createdAt };
  const replies = await client.multi()
    .set(INFRA.resultPrefix + requestId, JSON.stringify(pending), { EX: INFRA.resultTtl })
    .xAdd(INFRA.stream, '*', { event: JSON.stringify(event) }).exec();
  return { ...pending, streamId: replies[1] };
}
