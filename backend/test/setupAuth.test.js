/** Kiểm tra script cập nhật cấu hình giữ nguyên .env cũ và chạy lại không thay secret. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
function fixture(t, env) {
  const root = mkdtempSync(join(tmpdir(), 'bookauction-auth-'));
  mkdirSync(join(root, 'scripts'));
  copyFileSync(new URL('../../scripts/setupAuth.mjs', import.meta.url), join(root, 'scripts/setupAuth.mjs'));
  if (env !== undefined) writeFileSync(join(root, '.env'), env);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { read: () => readFileSync(join(root, '.env'), 'utf8'),
    run: () => spawnSync(process.execPath, [join(root, 'scripts/setupAuth.mjs')], { encoding: 'utf8' }) };
}
test('setup:auth bổ sung secret ngẫu nhiên, giữ cấu hình cũ và idempotent', t => {
  const original = '# cấu hình riêng\nDB_PASSWORD=fixture-not-a-real-secret\nREDIS_URL=redis://127.0.0.1:16379\n';
  const f = fixture(t, original);
  const first = f.run(); assert.equal(first.status, 0);
  const changed = f.read(); assert(changed.startsWith(original));
  const secret = changed.match(/^SESSION_SECRET=(.+)$/m)[1]; assert.equal(secret.length, 96);
  assert(!first.stdout.includes(secret)); assert(changed.includes('SESSION_IDLE_SECONDS=7200'));
  assert.equal(f.run().status, 0); assert.equal(f.read(), changed);
});
test('setup:auth giữ secret đã có, báo lỗi rõ khi secret còn là mẫu', t => {
  const secret = 'fixture-existing-secret-'.repeat(3);
  const f = fixture(t, `SESSION_SECRET=${secret}\nSESSION_IDLE_SECONDS=3600\n`);
  assert.equal(f.run().status, 0); assert.equal(f.read(), `SESSION_SECRET=${secret}\nSESSION_IDLE_SECONDS=3600\n`);
  const bad = fixture(t, 'SESSION_SECRET=CHANGE_ME_RUN_NPM_SETUP_AUTH\nSESSION_IDLE_SECONDS=7200\n');
  assert.equal(bad.run().status, 1); assert.equal(bad.read(), 'SESSION_SECRET=CHANGE_ME_RUN_NPM_SETUP_AUTH\nSESSION_IDLE_SECONDS=7200\n');
});
