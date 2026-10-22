/** Nâng database hiện có lên Mốc 4, không tạo lại bảng hoặc xóa dữ liệu. */
import { readFile } from 'node:fs/promises';
import { getPool, closeDatabase } from '../src/config/database.js';
try {
  const pool=await getPool();
  await pool.request().batch(await readFile(new URL('../migrations/002_cloudinary_metadata.sql',import.meta.url),'utf8'));
  console.log('PASS migration 002: metadata Cloudinary (có thể chạy lại).');
} catch { console.error('Migration thất bại. Kiểm tra SQL Server, database và quyền ALTER; không xóa database/volume.');process.exitCode=1; }
finally {await closeDatabase();}
