/** Log ứng dụng; che bí mật cấu hình và dữ liệu xác thực. */
import pino from 'pino';
import { config } from '../config/env.js';
export const logger = pino({ level: config.logLevel, base: { service: process.env.PROCESS_ROLE || 'book-auction' },
  redact: ['password', 'mat_khau', 'passwordHash', 'token', 'csrfToken', 'SESSION_SECRET',
    'DB_PASSWORD', 'DEV_PROBE_TOKEN', 'req.headers.authorization', 'req.headers.cookie',
    'req.headers.x-csrf-token', 'req.headers.x-dev-token'] });
export function logError(error, context = {}) {
  let message = String(error?.message || error);
  for (const secret of [config.sql.password, config.probeToken, process.env.SESSION_SECRET].filter(Boolean)) message = message.replaceAll(secret, '[REDACTED]');
  logger.error({ ...context, code: error?.code, message }, 'Lỗi xử lý');
}
