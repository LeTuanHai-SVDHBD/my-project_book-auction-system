-- Keep pre-existing case contents private under their original visibility rules.
SET XACT_ABORT ON;
BEGIN TRY
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.KhieuNai','han_giai_trinh') IS NULL
  ALTER TABLE dbo.KhieuNai ADD han_giai_trinh DATETIME2(3) NULL,
    giai_trinh NVARCHAR(MAX) NULL, ngay_giai_trinh DATETIME2(3) NULL,
    ket_luan VARCHAR(30) NULL, ghi_chu_noi_bo NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.BangChungKhieuNai','la_giai_trinh') IS NULL
  ALTER TABLE dbo.BangChungKhieuNai ADD la_giai_trinh BIT NOT NULL CONSTRAINT DF_BangChungKhieuNai_la_giai_trinh DEFAULT (0);
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.KhieuNai') AND name='CK_KhieuNai_giai_trinh')
  EXEC(N'ALTER TABLE dbo.KhieuNai WITH CHECK ADD CONSTRAINT CK_KhieuNai_giai_trinh CHECK (
    (giai_trinh IS NULL AND ngay_giai_trinh IS NULL) OR
    (giai_trinh IS NOT NULL AND ngay_giai_trinh IS NOT NULL AND han_giai_trinh IS NOT NULL
      AND ngay_giai_trinh>=ngay_khieu_nai AND ngay_giai_trinh<han_giai_trinh AND LEN(LTRIM(RTRIM(giai_trinh)))>0)
  )');
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.KhieuNai') AND name='CK_KhieuNai_ket_luan')
  EXEC(N'ALTER TABLE dbo.KhieuNai WITH CHECK ADD CONSTRAINT CK_KhieuNai_ket_luan CHECK (
    (ket_luan IS NULL AND (han_giai_trinh IS NULL OR trang_thai<>''da_xu_ly'')) OR
    (ket_luan IS NOT NULL AND trang_thai=''da_xu_ly'' AND ket_luan IN (''co_can_cu'',''khong_co_can_cu'',''da_thoa_thuan''))
  )');
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.KhieuNai') AND name='UX_KhieuNai_giao_dich_dang_mo')
  EXEC(N'CREATE UNIQUE INDEX UX_KhieuNai_giao_dich_dang_mo ON dbo.KhieuNai(giao_dich_id) WHERE han_giai_trinh IS NOT NULL AND trang_thai<>''da_xu_ly''');
COMMIT;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;
