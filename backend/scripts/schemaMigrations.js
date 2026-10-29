/** Danh sách migration nâng cấp dùng chung cho init/migrate; mỗi script giữ dữ liệu và chạy lại được. */
import {readFile} from 'node:fs/promises';
export async function applyMigrations(pool) {
  for(const filename of ['002_cloudinary_metadata.sql','003_auction_decisions.sql','004_notifications.sql']) {
    await pool.request().batch(await readFile(new URL(`../migrations/${filename}`,import.meta.url),'utf8'));
    console.log(`PASS migration ${filename}.`);
  }
}
