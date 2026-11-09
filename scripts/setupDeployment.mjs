/** Tạo cấu hình riêng cho bản chạy thử hoặc VM, không đụng cấu hình phát triển. */
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const sample = await readFile(new URL('../deploy/.env.example', import.meta.url), 'utf8');
const hex = () => randomBytes(32).toString('hex');
const values = { SQL_SA_PASSWORD: `Bb1!${hex()}`, SQL_APP_PASSWORD: `Bb1!${hex()}`,
  SESSION_SECRET: hex(), DEV_PROBE_TOKEN: hex() };
const contents = sample.replace(/^([A-Z_]+)=CHANGE_ME$/gm, (line, name) =>
  values[name] ? `${name}=${values[name]}` : line);
try {
  await writeFile(new URL('../.env.deploy', import.meta.url), contents, { flag: 'wx', mode: 0o600 });
  console.log('Đã tạo .env.deploy. Điền BOOKBID_ORIGIN trước khi mở link cho người dùng.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('.env.deploy đã tồn tại; giữ nguyên cấu hình và khóa hiện có.');
}
