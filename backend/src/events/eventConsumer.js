/**
 * Đọc sự kiện kiểm tra từ Redis Streams.
 * Nhận lại thông điệp pending và xác nhận sau khi xử lý.
 */
import { INFRA } from '../constants/infrastructure.js';
import { validateProbe } from '../processors/systemProbe.processor.js';
export async function ensureGroup(client) {
  try { await client.xGroupCreate(INFRA.stream, INFRA.group, '0', { MKSTREAM: true }); }
  catch (error) { if (!String(error.message).includes('BUSYGROUP')) throw error; }
}
export async function consumeProbes({ client, reader, consumer, signal, handle, logger, logError }) {
  let cursor = '0-0'; let reclaimedAt = 0;
  const processMessage = async message => {
    let event;
    try { event = validateProbe(JSON.parse(message.message.event)); }
    catch {
      await client.multi().xAdd(INFRA.deadLetter, '*', { streamId: message.id, reason: 'INVALID_INFRA_EVENT' })
        .xAck(INFRA.stream, INFRA.group, message.id).exec();
      logger.warn({ streamId: message.id }, 'Đã cách ly thông điệp kiểm tra sai định dạng'); return;
    }
    try {
      await handle(event);
      await client.xAck(INFRA.stream, INFRA.group, message.id);
      logger.info({ requestId: event.eventId, streamId: message.id }, 'Đã hoàn tất kiểm tra SQL qua worker');
    } catch (error) { logError(error, { component: 'probe-consumer', requestId: event.eventId }); }
    // Failed messages remain pending and are eligible for XAUTOCLAIM.
  };
  while (!signal.aborted) {
    try {
      if (Date.now() - reclaimedAt > 5000) {
        const claim = await client.xAutoClaim(INFRA.stream, INFRA.group, consumer, INFRA.minIdleMs, cursor, { COUNT: 10 });
        cursor = claim.nextId; reclaimedAt = Date.now();
        for (const message of claim.messages) { if (!signal.aborted) await processMessage(message); }
      }
      const streams = await reader.xReadGroup(INFRA.group, consumer, { key: INFRA.stream, id: '>' }, { COUNT: 10, BLOCK: 2000 });
      for (const stream of streams || []) for (const message of stream.messages) {
        if (!signal.aborted) await processMessage(message);
      }
    } catch (error) {
      if (!signal.aborted) { logError(error, { component: 'stream-reader' }); await new Promise(resolve => setTimeout(resolve, 500)); }
    }
  }
}
