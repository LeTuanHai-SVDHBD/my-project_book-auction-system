-- Bản kết quả gắn với từng quyết định, không ghi đè khi gửi duyệt lại.
SET XACT_ABORT ON;
BEGIN TRY
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.KiemDuyet','ket_qua_snapshot') IS NULL
  ALTER TABLE dbo.KiemDuyet ADD ket_qua_snapshot NVARCHAR(MAX) NULL;
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.KiemDuyet') AND name='CK_KiemDuyet_snapshot_json')
  EXEC(N'ALTER TABLE dbo.KiemDuyet ADD CONSTRAINT CK_KiemDuyet_snapshot_json CHECK (ket_qua_snapshot IS NULL OR ISJSON(ket_qua_snapshot)=1)');
COMMIT;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;
