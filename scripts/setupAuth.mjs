/** Bổ sung cấu hình auth còn thiếu; không đổi các giá trị .env đang có. */
import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const target = new URL('../.env', import.meta.url);
if (!existsSync(target)) {
  console.error('Chưa có .env. Chạy npm run setup trước.'); process.exitCode = 1;
} else {
  const content = readFileSync(target, 'utf8');
  const has = name => new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`, 'm').test(content);
  const additions = [];
  if (!has('SESSION_SECRET')) additions.push(`SESSION_SECRET=${randomBytes(48).toString('hex')}`);
  if (!has('SESSION_IDLE_SECONDS')) additions.push('SESSION_IDLE_SECONDS=7200');
  if (additions.length) {
    appendFileSync(target, '\n# Session đăng nhập\n' + additions.join('\n') + '\n');
    console.log('Đã bổ sung cấu hình session còn thiếu; giữ nguyên cấu hình đã có.');
  } else console.log('Cấu hình session đã có. Giữ nguyên.');
  if (/^\s*SESSION_SECRET\s*=\s*(?:["']?)CHANGE_ME/m.test(content)) {
    console.error('SESSION_SECRET đang là giá trị mẫu. Xóa riêng dòng mẫu này rồi chạy lại npm run setup:auth.');
    process.exitCode = 1;
  }
}
