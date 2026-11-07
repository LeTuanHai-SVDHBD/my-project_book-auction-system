-- Hồ sơ sách theo bài; gỡ media khỏi lần gửi mới nhưng giữ file và bằng chứng lịch sử.
SET XACT_ABORT ON;
BEGIN TRY
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.BaiDang','ho_so_sach') IS NULL
  ALTER TABLE dbo.BaiDang ADD ho_so_sach NVARCHAR(MAX) NULL;
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.BaiDang') AND name='CK_BaiDang_ho_so_sach')
  EXEC(N'ALTER TABLE dbo.BaiDang ADD CONSTRAINT CK_BaiDang_ho_so_sach CHECK (ho_so_sach IS NULL OR ISJSON(ho_so_sach)=1)');
IF COL_LENGTH('dbo.HinhAnh','dang_su_dung') IS NULL
  ALTER TABLE dbo.HinhAnh ADD dang_su_dung BIT NOT NULL CONSTRAINT DF_HinhAnh_dang_su_dung DEFAULT(1) WITH VALUES;
IF COL_LENGTH('dbo.Video','dang_su_dung') IS NULL
  ALTER TABLE dbo.Video ADD dang_su_dung BIT NOT NULL CONSTRAINT DF_Video_dang_su_dung DEFAULT(1) WITH VALUES;
COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
