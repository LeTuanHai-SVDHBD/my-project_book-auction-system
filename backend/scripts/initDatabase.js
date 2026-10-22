import sql from 'mssql';
import { readFile } from 'node:fs/promises';
import { config } from '../src/config/env.js';
import manifest from '../schema-manifest.json' with { type: 'json' };
let master; let app;
try {
  master = await new sql.ConnectionPool({ ...config.sql, database: 'master' }).connect();
  const database = config.sql.database; // parseConfig restricts the identifier to letters, digits, underscore.
  const exists = await master.request().input('name', sql.NVarChar(128), database).query('SELECT DB_ID(@name) AS id');
  if (!exists.recordset[0].id) { await master.request().query(`CREATE DATABASE [${database}]`); console.log(`Đã tạo ${database}.`); }
  app = await new sql.ConnectionPool(config.sql).connect();
  const names = manifest.tables.map(t => `'${t}'`).join(',');
  const found = await app.request().query(`SELECT COUNT(*) AS n FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name='dbo' AND t.name IN (${names})`);
  if (found.recordset[0].n > 0) {
    const columns = await app.request().query(`SELECT COUNT(*) AS n FROM sys.columns c JOIN sys.tables t ON c.object_id=t.object_id JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name='dbo' AND t.name IN (${names})`);
    if (found.recordset[0].n !== 19 || columns.recordset[0].n !== manifest.columns) throw new Error('Schema đang có chưa khớp 19 bảng/142 trường. Dừng để bảo vệ dữ liệu; không tự sửa hay xóa.');
    console.log('Database đã có 19 bảng và 142 trường. Giữ nguyên; không chạy lại DDL.');
  } else {
    const contents = await readFile(new URL('../migrations/001_schema.sql', import.meta.url), 'utf8');
    const batches = contents.replace(/^\uFEFF/, '').split(/^\s*GO\s*(?:--[^\n]*)?$/gim).filter(x => x.trim());
    for (const batch of batches) await app.request().batch(batch);
    console.log('Đã tạo schema 19 bảng theo bản Word (3).');
  }
} catch (error) {
  console.error('Khởi tạo thất bại:', String(error.message).replaceAll(config.sql.password, '[REDACTED]'));
  process.exitCode = 1;
} finally { if (app) await app.close(); if (master) await master.close(); }
