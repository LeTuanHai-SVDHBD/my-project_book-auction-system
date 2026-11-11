-- Giữ quyết định AI cũ; quyết định mới phải do Admin, có thể tham khảo một phân tích AI.
SET XACT_ABORT ON;
BEGIN TRY
BEGIN TRANSACTION;
IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_KiemDuyet_actor' AND parent_object_id=OBJECT_ID('dbo.KiemDuyet'))
  ALTER TABLE dbo.KiemDuyet DROP CONSTRAINT CK_KiemDuyet_actor;
ALTER TABLE dbo.KiemDuyet WITH CHECK ADD CONSTRAINT CK_KiemDuyet_actor
  CHECK (admin_id IS NOT NULL OR phan_tich_id IS NOT NULL);
EXEC(N'CREATE OR ALTER TRIGGER dbo.TR_KiemDuyet_admin_insert ON dbo.KiemDuyet AFTER INSERT AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS(SELECT 1 FROM inserted WHERE admin_id IS NULL)
    THROW 51010, N''Quyết định kiểm duyệt mới phải do Admin thực hiện.'', 1;
END');
COMMIT;
END TRY
BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK;
  THROW;
END CATCH;
