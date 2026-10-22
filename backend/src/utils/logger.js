/**
 * Cung cấp log JSON có cấu trúc và che mật khẩu/token trong lỗi cấu hình.
 */
import pino from 'pino';
import { config } from '../config/env.js';
export const logger = pino({ level: config.logLevel, base: { service: process.env.PROCESS_ROLE || 'my-project_book-auction-system' },
  redact: ['password', 'token', 'DB_PASSWORD', 'DEV_PROBE_TOKEN', 'req.headers.authorization', 'req.headers.x-dev-token'] });
export function logError(error, context = {}) {
  let message = String(error?.message || error);
  for (const secret of [config.sql.password, config.probeToken]) message = message.replaceAll(secret, '[REDACTED]');
  logger.error({ ...context, code: error?.code, message }, 'Lỗi xử lý');
}
