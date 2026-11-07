/** Tạo Admin bằng terminal; không nhận mật khẩu qua đối số hoặc lưu mật khẩu trong file. */
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { getPool, closeDatabase, sql } from '../src/config/database.js';
import { createUserModel } from '../src/models/user.model.js';
import { passwords } from '../src/services/password.service.js';
import { validateCredentials } from '../src/services/auth.service.js';
import { logError } from '../src/utils/logger.js';
async function askPassword(label) {
  process.stdout.write(label);
  const muted = new Writable({ write(chunk, encoding, callback) { callback(); } });
  const prompt = createInterface({ input: process.stdin, output: muted, terminal: true });
  try { return await prompt.question(''); }
  finally { prompt.close(); process.stdout.write('\n'); }
}
try {
  if (!process.stdin.isTTY) throw new Error('Chạy lệnh trực tiếp trong terminal để nhập mật khẩu kín.');
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  let name; let email;
  try { name = await prompt.question('Tên Admin: '); email = await prompt.question('Email Admin: '); }
  finally { prompt.close(); }
  const password = await askPassword('Mật khẩu (12–128 ký tự, không hiển thị khi gõ): ');
  const confirmation = await askPassword('Nhập lại mật khẩu: ');
  if (password !== confirmation) throw new Error('Hai mật khẩu không trùng nhau.');
  const input = validateCredentials({ ho_ten: name, email, mat_khau: password }, true);
  const users = createUserModel({ getPool, sql });
  const existing = await users.findByEmail(input.email);
  if (existing) {
    if (existing.vai_tro === 'admin') console.log('Email đã là Admin. Giữ nguyên tài khoản và mật khẩu.');
    else throw new Error('Email thuộc tài khoản người dùng. Chọn email Admin khác; script không tự nâng quyền.');
  } else {
    await users.create({ ho_ten: input.name, email: input.email, passwordHash: await passwords.hash(input.password), role: 'admin' });
    console.log('Đã tạo Admin. Đăng nhập bằng email và mật khẩu vừa nhập.');
  }
} catch (error) {
  if (error.status === 400 || error.code === 'ERR_USE_AFTER_CLOSE' ||
      /mật khẩu|Email|terminal/.test(error.message)) console.error(error.message);
  else { logError(error, { component: 'create-admin' }); console.error('Không tạo được Admin. Kiểm tra SQL Server và terminal.'); }
  process.exitCode = 1;
} finally { await closeDatabase(); }
