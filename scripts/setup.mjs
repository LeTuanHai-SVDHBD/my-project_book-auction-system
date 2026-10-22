/** Tạo cấu hình phát triển mới; không ghi đè cấu hình riêng đang có. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const target = new URL('.env', root);
if (existsSync(target)) {
  console.log('Giữ nguyên .env đang có. Không thay mật khẩu của database.');
} else {
  const contents = readFileSync(new URL('.env.example', root), 'utf8')
    .replace('DB_PASSWORD=CHANGE_ME_RUN_NPM_SETUP', `DB_PASSWORD=Aa1!${randomBytes(18).toString('hex')}`)
    .replace('DEV_PROBE_TOKEN=CHANGE_ME_RUN_NPM_SETUP', `DEV_PROBE_TOKEN=${randomBytes(24).toString('hex')}`)
    .replace('SESSION_SECRET=CHANGE_ME_RUN_NPM_SETUP_AUTH', `SESSION_SECRET=${randomBytes(48).toString('hex')}`);
  writeFileSync(target, contents, { flag: 'wx', mode: 0o600 });
  console.log(`Đã tạo ${fileURLToPath(target)} với mật khẩu và token tự sinh.`);
}
const frontend = new URL('frontend/.env', root);
if (!existsSync(frontend)) {
  writeFileSync(frontend, readFileSync(new URL('frontend/.env.example', root), 'utf8'), { flag: 'wx' });
  console.log('Đã tạo frontend/.env.');
}
console.log('Bước tiếp theo: docker compose up -d');
