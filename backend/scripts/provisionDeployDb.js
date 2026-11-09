/** Tạo login chỉ đọc/ghi dữ liệu cho API và worker sau khi tạo schema trên VM. */
import sql from 'mssql';
import { config } from '../src/config/env.js';

const login = 'bookbid_app';
const password = process.env.SQL_APP_PASSWORD;
if (!password || !/^Bb1![0-9a-f]{64}$/.test(password) || password === config.sql.password) {
  throw new Error('SQL_APP_PASSWORD cần là mật khẩu riêng được tạo bởi setupDeployment.mjs.');
}
let master, app, check;
try {
  master = await new sql.ConnectionPool({ ...config.sql, database: 'master' }).connect();
  await master.request().input('password', sql.NVarChar(128), password).query(`
    IF SUSER_ID(N'${login}') IS NULL
    BEGIN
      DECLARE @statement nvarchar(4000) = N'CREATE LOGIN [${login}] WITH PASSWORD = ' + QUOTENAME(@password, '''');
      EXEC sys.sp_executesql @statement;
    END;`);
  app = await new sql.ConnectionPool(config.sql).connect();
  await app.request().batch(`
    IF DATABASE_PRINCIPAL_ID(N'${login}') IS NULL CREATE USER [${login}] FOR LOGIN [${login}];
    IF IS_ROLEMEMBER(N'db_datareader', N'${login}') = 0 ALTER ROLE [db_datareader] ADD MEMBER [${login}];
    IF IS_ROLEMEMBER(N'db_datawriter', N'${login}') = 0 ALTER ROLE [db_datawriter] ADD MEMBER [${login}];`);
  check = await new sql.ConnectionPool({ ...config.sql, user: login, password }).connect();
  await check.request().query('SELECT TOP (0) * FROM dbo.NguoiDung');
  console.log('Tài khoản SQL cho API/worker đã sẵn sàng.');
} catch (error) {
  console.error('Không thiết lập được tài khoản SQL của ứng dụng.', error.code || 'SQL_ERROR');
  process.exitCode = 1;
} finally {
  await Promise.allSettled([master, app, check].filter(Boolean).map(pool => pool.close()));
}
