-- Quyết định yêu cầu đặt giá và lý do kết thúc; nâng cấp tại chỗ, không xóa dữ liệu lịch sử.
SET XACT_ABORT ON;
BEGIN TRY
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.YeuCauDatGia',N'U') IS NULL
BEGIN
  CREATE TABLE dbo.YeuCauDatGia (
    ma_yeu_cau VARCHAR(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
    phien_dau_gia_id INT NOT NULL,
    nguoi_dung_id INT NOT NULL,
    muc_gia DECIMAL(18,0) NOT NULL,
    trang_thai VARCHAR(20) NOT NULL,
    ly_do VARCHAR(64) NULL,
    thoi_gian_xu_ly DATETIME2(3) NOT NULL,
    CONSTRAINT PK_YeuCauDatGia PRIMARY KEY (ma_yeu_cau),
    CONSTRAINT FK_YeuCauDatGia_phien FOREIGN KEY (phien_dau_gia_id) REFERENCES dbo.PhienDauGia(phien_dau_gia_id),
    CONSTRAINT FK_YeuCauDatGia_nguoi FOREIGN KEY (nguoi_dung_id) REFERENCES dbo.NguoiDung(nguoi_dung_id),
    CONSTRAINT CK_YeuCauDatGia_gia CHECK (muc_gia>0),
    CONSTRAINT CK_YeuCauDatGia_ma CHECK (LEN(LTRIM(RTRIM(ma_yeu_cau)))>0),
    CONSTRAINT CK_YeuCauDatGia_trang_thai CHECK (trang_thai IN ('da_chap_nhan','bi_tu_choi')),
    CONSTRAINT CK_YeuCauDatGia_ly_do CHECK (
      (trang_thai='da_chap_nhan' AND ly_do IS NULL) OR
      (trang_thai='bi_tu_choi' AND ly_do IS NOT NULL AND LEN(LTRIM(RTRIM(ly_do)))>0))
  );
END;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.YeuCauDatGia') AND name='IX_YeuCauDatGia_phien')
  CREATE INDEX IX_YeuCauDatGia_phien ON dbo.YeuCauDatGia(phien_dau_gia_id,thoi_gian_xu_ly);

IF COL_LENGTH('dbo.KetQuaDauGia','ly_do_ket_thuc') IS NULL
  ALTER TABLE dbo.KetQuaDauGia ADD ly_do_ket_thuc VARCHAR(30) NULL;
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.KetQuaDauGia') AND name='CK_KetQuaDauGia_ly_do_ket_thuc')
  EXEC('ALTER TABLE dbo.KetQuaDauGia ADD CONSTRAINT CK_KetQuaDauGia_ly_do_ket_thuc CHECK (ly_do_ket_thuc IS NULL OR ly_do_ket_thuc IN (''het_thoi_gian'',''dat_gia_toi_thieu''))');

-- Existing valid bids are authoritative receipts, not synthetic rejections or guessed ending reasons.
IF EXISTS(SELECT 1 FROM dbo.LuotDatGia l JOIN dbo.YeuCauDatGia q ON q.ma_yeu_cau=l.ma_yeu_cau
  WHERE q.trang_thai<>'da_chap_nhan' OR q.phien_dau_gia_id<>l.phien_dau_gia_id OR q.nguoi_dung_id<>l.nguoi_dung_id OR q.muc_gia<>l.muc_gia)
  THROW 50002, N'Quyet dinh yeu cau khong khop luot gia da luu. Dung nang cap de doi soat.', 1;
INSERT dbo.YeuCauDatGia(ma_yeu_cau,phien_dau_gia_id,nguoi_dung_id,muc_gia,trang_thai,ly_do,thoi_gian_xu_ly)
SELECT l.ma_yeu_cau,l.phien_dau_gia_id,l.nguoi_dung_id,l.muc_gia,'da_chap_nhan',NULL,l.thoi_gian_dat
FROM dbo.LuotDatGia l
WHERE NOT EXISTS(SELECT 1 FROM dbo.YeuCauDatGia q WITH (UPDLOCK,HOLDLOCK) WHERE q.ma_yeu_cau=l.ma_yeu_cau);

COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
