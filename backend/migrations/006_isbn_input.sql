-- Giữ nguyên mã đã lưu, bỏ ép ISBN-10/13 và nhận chuỗi có dấu phân cách.
SET XACT_ABORT ON;
BEGIN TRY
BEGIN TRANSACTION;
IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.Sach') AND name='CK_Sach_isbn')
  ALTER TABLE dbo.Sach DROP CONSTRAINT CK_Sach_isbn;
IF NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.Sach') AND name='isbn' AND system_type_id=231 AND max_length=200)
BEGIN
  IF EXISTS(SELECT 1 FROM dbo.Sach WHERE DATALENGTH(CONVERT(NVARCHAR(MAX),isbn))>200)
    THROW 50006,N'Có mã ISBN vượt 100 ký tự. Dừng để bảo vệ dữ liệu; không cắt mã.',1;
  IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.Sach') AND name='CK_Sach_text_isbn')
    ALTER TABLE dbo.Sach DROP CONSTRAINT CK_Sach_text_isbn;
  IF EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.Sach') AND name='IX_Sach_isbn')
    DROP INDEX IX_Sach_isbn ON dbo.Sach;
  ALTER TABLE dbo.Sach ALTER COLUMN isbn NVARCHAR(100) NULL;
END;
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.Sach') AND name='CK_Sach_text_isbn')
  ALTER TABLE dbo.Sach ADD CONSTRAINT CK_Sach_text_isbn CHECK (isbn IS NULL OR LEN(LTRIM(RTRIM(isbn)))>0);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.Sach') AND name='IX_Sach_isbn')
  CREATE INDEX IX_Sach_isbn ON dbo.Sach(isbn);
COMMIT;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;
