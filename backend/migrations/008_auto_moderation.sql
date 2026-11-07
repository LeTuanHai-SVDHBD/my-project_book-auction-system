-- Decisions made by the worker link to their actual analysis, without an Admin account.
SET XACT_ABORT ON;
BEGIN TRY
BEGIN TRANSACTION;
IF EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.KiemDuyet') AND name='admin_id' AND is_nullable=0)
  ALTER TABLE dbo.KiemDuyet ALTER COLUMN admin_id INT NULL;
IF COL_LENGTH('dbo.KiemDuyet','phan_tich_id') IS NULL
  ALTER TABLE dbo.KiemDuyet ADD phan_tich_id INT NULL;
IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE parent_object_id=OBJECT_ID('dbo.KiemDuyet') AND name='FK_KiemDuyet_phan_tich_id')
  EXEC(N'ALTER TABLE dbo.KiemDuyet WITH CHECK ADD CONSTRAINT FK_KiemDuyet_phan_tich_id FOREIGN KEY (phan_tich_id) REFERENCES dbo.PhanTichAI(phan_tich_id)');
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.KiemDuyet') AND name='CK_KiemDuyet_actor')
  EXEC(N'ALTER TABLE dbo.KiemDuyet WITH CHECK ADD CONSTRAINT CK_KiemDuyet_actor CHECK ((admin_id IS NOT NULL AND phan_tich_id IS NULL) OR (admin_id IS NULL AND phan_tich_id IS NOT NULL))');
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.KiemDuyet') AND name='UX_KiemDuyet_phan_tich_id')
  EXEC(N'CREATE UNIQUE INDEX UX_KiemDuyet_phan_tich_id ON dbo.KiemDuyet(phan_tich_id) WHERE phan_tich_id IS NOT NULL');
COMMIT;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;
