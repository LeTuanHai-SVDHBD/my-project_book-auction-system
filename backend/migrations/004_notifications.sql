-- Hộp thư riêng, lưu bền và chống trùng theo sự kiện nguồn đã COMMIT.
SET XACT_ABORT ON;
BEGIN TRY
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.ThongBao',N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ThongBao (
    thong_bao_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ThongBao PRIMARY KEY,
    nguoi_dung_id INT NOT NULL,
    nguon VARCHAR(100) NOT NULL,
    loai VARCHAR(30) NOT NULL,
    doi_tuong_id INT NOT NULL,
    tieu_de NVARCHAR(200) NOT NULL,
    noi_dung NVARCHAR(500) NOT NULL,
    ngay_tao DATETIME2(3) NOT NULL,
    ngay_doc DATETIME2(3) NULL,
    CONSTRAINT FK_ThongBao_nguoi FOREIGN KEY (nguoi_dung_id) REFERENCES dbo.NguoiDung(nguoi_dung_id) ON DELETE CASCADE,
    CONSTRAINT UQ_ThongBao_nguon UNIQUE(nguoi_dung_id,nguon),
    CONSTRAINT CK_ThongBao_loai CHECK (loai IN ('pending','mine','catalog','trades','complaints')),
    CONSTRAINT CK_ThongBao_doi_tuong CHECK (doi_tuong_id>0)
  );
END;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.ThongBao') AND name='IX_ThongBao_hop_thu')
 CREATE INDEX IX_ThongBao_hop_thu ON dbo.ThongBao(nguoi_dung_id,thong_bao_id DESC) INCLUDE(ngay_doc);
COMMIT;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;
