/** Nâng database hiện có, không tạo lại bảng hoặc xóa dữ liệu. */
import {applyMigrations} from './schemaMigrations.js';
import { getPool, closeDatabase } from '../src/config/database.js';
try {
  const pool=await getPool();
  await applyMigrations(pool);
} catch { console.error('Migration thất bại. Kiểm tra SQL Server, database và quyền ALTER; không xóa database/volume.');process.exitCode=1; }
finally {await closeDatabase();}
