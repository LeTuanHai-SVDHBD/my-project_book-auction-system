/**
 * Kiểm tra cú pháp các file JavaScript máy chủ và script, bỏ qua dependency và kết quả build.
 */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const files = [];
function visit(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist'].includes(item.name)) continue;
    const target = path.join(dir, item.name);
    if (item.isDirectory()) visit(target);
    else if (/\.(js|mjs)$/.test(item.name)) files.push(target);
  }
}
visit(path.join(root, 'backend')); visit(path.join(root, 'scripts')); visit(path.join(root,'shared'));
for (const file of files) {
  const r = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}
console.log(`Đã kiểm tra cú pháp ${files.length} tệp JavaScript phía máy chủ và dùng chung.`);
