-- Thiet ke CSDL vat ly he thong dau gia sach

-- Chay trong database rong da chon bang SSMS. Khong xoa/sua du lieu cu.

-- Tien VND nguyen; thoi gian UTC. Khong phai migration cho database dang co du lieu.

-- Quyen ghi qua backend phai thuc hien cac giao dich nghiep vu mo ta trong tai lieu.

SET NOCOUNT ON;

SET XACT_ABORT ON;

SET ANSI_NULLS ON;

SET ANSI_PADDING ON;

SET ANSI_WARNINGS ON;

SET ARITHABORT ON;

SET CONCAT_NULL_YIELDS_NULL ON;

SET QUOTED_IDENTIFIER ON;

SET NUMERIC_ROUNDABORT OFF;

GO

IF OBJECT_ID(N'dbo.NguoiDung', N'U') IS NOT NULL OR OBJECT_ID(N'dbo.Sach', N'U') IS NOT NULL OR OBJECT_ID(N'dbo.BaiDang', N'U') IS NOT NULL OR OBJECT_ID(N'dbo.HinhAnh', N'U') IS NOT NULL OR OBJECT_ID(N'dbo.Video', N'U') IS NOT NULL OR OBJECT_ID(N'dbo.KiemDuyet', N'U') IS NOT NULL OR OBJECT_ID(N'dbo.PhienDauGia', N'U') IS NOT NULL OR OBJECT_ID(N'dbo.BinhLuan', N'U') IS NOT NULL OR OBJECT_ID(N'dbo.LuotDatGia', N'U') IS NOT NULL OR OBJECT_ID(N'dbo.LichSuDauGia', N'U') IS NOT NULL OR OBJECT_ID(N'dbo.KetQuaDauGia', N'U') IS NOT NULL OR OBJECT_ID(N'dbo.GiaoDich', N'U') IS NOT NULL OR OBJECT_ID(N'dbo.CuocTroChuyen', N'U') IS NOT NULL OR OBJECT_ID(N'dbo.TinNhan', N'U') IS NOT NULL OR OBJECT_ID(N'dbo.KhieuNai', N'U') IS NOT NULL OR OBJECT_ID(N'dbo.BangChungKhieuNai', N'U') IS NOT NULL OR OBJECT_ID(N'dbo.DanhGia', N'U') IS NOT NULL OR OBJECT_ID(N'dbo.PhanTichAI', N'U') IS NOT NULL OR OBJECT_ID(N'dbo.ChiTietPhanTichAI', N'U') IS NOT NULL

    THROW 50001, N'Database da co bang dich. Hay chon database rong; script khong ghi de.', 1;

BEGIN TRY

BEGIN TRANSACTION;

CREATE TABLE [dbo].[NguoiDung] (
    [nguoi_dung_id] INT IDENTITY(1,1) NOT NULL,
    [ho_ten] NVARCHAR(100) NOT NULL,
    [email] VARCHAR(254) COLLATE Latin1_General_100_CI_AS NOT NULL,
    [mat_khau] VARCHAR(255) NOT NULL,
    [so_dien_thoai] VARCHAR(20) NULL,
    [dia_chi] NVARCHAR(500) NULL,
    [anh_dai_dien] VARCHAR(2048) NULL,
    [anh_bia] VARCHAR(2048) NULL,
    [vai_tro] VARCHAR(20) NOT NULL CONSTRAINT [DF_NguoiDung_vai_tro] DEFAULT ('nguoi_dung'),
    [ngay_tao] DATETIME2(3) NOT NULL CONSTRAINT [DF_NguoiDung_ngay_tao] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_NguoiDung] PRIMARY KEY CLUSTERED ([nguoi_dung_id]),
    CONSTRAINT [UQ_NguoiDung_email] UNIQUE ([email]),
    CONSTRAINT [CK_NguoiDung_vai_tro] CHECK ([vai_tro] IN ('nguoi_dung', 'admin')),
    CONSTRAINT [CK_NguoiDung_text_ho_ten] CHECK (LEN(LTRIM(RTRIM([ho_ten])))>0),
    CONSTRAINT [CK_NguoiDung_text_email] CHECK (LEN(LTRIM(RTRIM([email])))>0),
    CONSTRAINT [CK_NguoiDung_text_mat_khau] CHECK (LEN(LTRIM(RTRIM([mat_khau])))>0),
    CONSTRAINT [CK_NguoiDung_text_so_dien_thoai] CHECK ([so_dien_thoai] IS NULL OR (LEN(LTRIM(RTRIM([so_dien_thoai])))>0)),
    CONSTRAINT [CK_NguoiDung_text_dia_chi] CHECK ([dia_chi] IS NULL OR (LEN(LTRIM(RTRIM([dia_chi])))>0)),
    CONSTRAINT [CK_NguoiDung_text_anh_dai_dien] CHECK ([anh_dai_dien] IS NULL OR (LEN(LTRIM(RTRIM([anh_dai_dien])))>0)),
    CONSTRAINT [CK_NguoiDung_text_anh_bia] CHECK ([anh_bia] IS NULL OR (LEN(LTRIM(RTRIM([anh_bia])))>0)),
    CONSTRAINT [CK_NguoiDung_text_vai_tro] CHECK (LEN(LTRIM(RTRIM([vai_tro])))>0)
);

CREATE TABLE [dbo].[Sach] (
    [sach_id] INT IDENTITY(1,1) NOT NULL,
    [ten_sach] NVARCHAR(300) NOT NULL,
    [tac_gia] NVARCHAR(200) NULL,
    [the_loai] NVARCHAR(100) NULL,
    [nha_xuat_ban] NVARCHAR(200) NULL,
    [nam_xuat_ban] SMALLINT NULL,
    [isbn] VARCHAR(13) NULL,
    [tinh_trang_sach] NVARCHAR(1000) NOT NULL,
    [mo_ta] NVARCHAR(MAX) NULL,
    CONSTRAINT [PK_Sach] PRIMARY KEY CLUSTERED ([sach_id]),
    CONSTRAINT [CK_Sach_nam] CHECK ([nam_xuat_ban] IS NULL OR [nam_xuat_ban] BETWEEN 1 AND 9999),
    CONSTRAINT [CK_Sach_isbn] CHECK ([isbn] IS NULL OR (DATALENGTH([isbn])=13 AND [isbn] COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^0-9]%') OR (DATALENGTH([isbn])=10 AND LEFT([isbn],9) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^0-9]%' AND RIGHT([isbn],1) COLLATE Latin1_General_100_BIN2 LIKE '[0-9X]')),
    CONSTRAINT [CK_Sach_text_ten_sach] CHECK (LEN(LTRIM(RTRIM([ten_sach])))>0),
    CONSTRAINT [CK_Sach_text_tac_gia] CHECK ([tac_gia] IS NULL OR (LEN(LTRIM(RTRIM([tac_gia])))>0)),
    CONSTRAINT [CK_Sach_text_the_loai] CHECK ([the_loai] IS NULL OR (LEN(LTRIM(RTRIM([the_loai])))>0)),
    CONSTRAINT [CK_Sach_text_nha_xuat_ban] CHECK ([nha_xuat_ban] IS NULL OR (LEN(LTRIM(RTRIM([nha_xuat_ban])))>0)),
    CONSTRAINT [CK_Sach_text_isbn] CHECK ([isbn] IS NULL OR (LEN(LTRIM(RTRIM([isbn])))>0)),
    CONSTRAINT [CK_Sach_text_tinh_trang_sach] CHECK (LEN(LTRIM(RTRIM([tinh_trang_sach])))>0),
    CONSTRAINT [CK_Sach_text_mo_ta] CHECK ([mo_ta] IS NULL OR (LEN(LTRIM(RTRIM([mo_ta])))>0))
);

CREATE TABLE [dbo].[BaiDang] (
    [bai_dang_id] INT IDENTITY(1,1) NOT NULL,
    [nguoi_dung_id] INT NOT NULL,
    [sach_id] INT NOT NULL,
    [ma_san_pham] VARCHAR(40) NOT NULL,
    [tieu_de] NVARCHAR(300) NOT NULL,
    [mo_ta_tinh_trang] NVARCHAR(MAX) NOT NULL,
    [trang_thai] VARCHAR(30) NOT NULL CONSTRAINT [DF_BaiDang_trang_thai] DEFAULT ('cho_kiem_duyet'),
    [ngay_dang] DATETIME2(3) NOT NULL CONSTRAINT [DF_BaiDang_ngay_dang] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_BaiDang] PRIMARY KEY CLUSTERED ([bai_dang_id]),
    CONSTRAINT [UQ_BaiDang_ma_san_pham] UNIQUE ([ma_san_pham]),
    CONSTRAINT [FK_BaiDang_nguoi_dung_id] FOREIGN KEY ([nguoi_dung_id]) REFERENCES [dbo].[NguoiDung] ([nguoi_dung_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_BaiDang_sach_id] FOREIGN KEY ([sach_id]) REFERENCES [dbo].[Sach] ([sach_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [CK_BaiDang_trang_thai] CHECK ([trang_thai] IN ('cho_kiem_duyet', 'da_duyet', 'tu_choi')),
    CONSTRAINT [CK_BaiDang_text_ma_san_pham] CHECK (LEN(LTRIM(RTRIM([ma_san_pham])))>0),
    CONSTRAINT [CK_BaiDang_text_tieu_de] CHECK (LEN(LTRIM(RTRIM([tieu_de])))>0),
    CONSTRAINT [CK_BaiDang_text_mo_ta_tinh_trang] CHECK (LEN(LTRIM(RTRIM([mo_ta_tinh_trang])))>0),
    CONSTRAINT [CK_BaiDang_text_trang_thai] CHECK (LEN(LTRIM(RTRIM([trang_thai])))>0)
);

CREATE TABLE [dbo].[HinhAnh] (
    [hinh_anh_id] INT IDENTITY(1,1) NOT NULL,
    [bai_dang_id] INT NOT NULL,
    [duong_dan_img] VARCHAR(2048) NOT NULL,
    [tieu_de_img] NVARCHAR(500) NULL,
    [thu_tu_img] SMALLINT NOT NULL,
    CONSTRAINT [PK_HinhAnh] PRIMARY KEY CLUSTERED ([hinh_anh_id]),
    CONSTRAINT [UQ_HinhAnh_bai_dang_id_thu_tu_img] UNIQUE ([bai_dang_id], [thu_tu_img]),
    CONSTRAINT [FK_HinhAnh_bai_dang_id] FOREIGN KEY ([bai_dang_id]) REFERENCES [dbo].[BaiDang] ([bai_dang_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [CK_HinhAnh_thu_tu_img] CHECK ([thu_tu_img] > 0),
    CONSTRAINT [CK_HinhAnh_text_duong_dan_img] CHECK (LEN(LTRIM(RTRIM([duong_dan_img])))>0),
    CONSTRAINT [CK_HinhAnh_text_tieu_de_img] CHECK ([tieu_de_img] IS NULL OR (LEN(LTRIM(RTRIM([tieu_de_img])))>0))
);

CREATE TABLE [dbo].[Video] (
    [video_id] INT IDENTITY(1,1) NOT NULL,
    [bai_dang_id] INT NOT NULL,
    [duong_dan_video] VARCHAR(2048) NOT NULL,
    [tieu_de_video] NVARCHAR(500) NULL,
    [thu_tu_video] SMALLINT NOT NULL,
    CONSTRAINT [PK_Video] PRIMARY KEY CLUSTERED ([video_id]),
    CONSTRAINT [UQ_Video_bai_dang_id_thu_tu_video] UNIQUE ([bai_dang_id], [thu_tu_video]),
    CONSTRAINT [FK_Video_bai_dang_id] FOREIGN KEY ([bai_dang_id]) REFERENCES [dbo].[BaiDang] ([bai_dang_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [CK_Video_thu_tu_video] CHECK ([thu_tu_video] > 0),
    CONSTRAINT [CK_Video_text_duong_dan_video] CHECK (LEN(LTRIM(RTRIM([duong_dan_video])))>0),
    CONSTRAINT [CK_Video_text_tieu_de_video] CHECK ([tieu_de_video] IS NULL OR (LEN(LTRIM(RTRIM([tieu_de_video])))>0))
);

CREATE TABLE [dbo].[KiemDuyet] (
    [kiem_duyet_id] INT IDENTITY(1,1) NOT NULL,
    [bai_dang_id] INT NOT NULL,
    [admin_id] INT NOT NULL,
    [ket_qua] NVARCHAR(20) NOT NULL,
    [phan_hoi_admin] NVARCHAR(MAX) NOT NULL,
    [ai_canh_bao] NVARCHAR(MAX) NULL,
    [do_tuong_dong_anh] DECIMAL(5,2) NULL,
    [ngay_kiem_duyet] DATETIME2(3) NOT NULL CONSTRAINT [DF_KiemDuyet_ngay_kiem_duyet] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_KiemDuyet] PRIMARY KEY CLUSTERED ([kiem_duyet_id]),
    CONSTRAINT [FK_KiemDuyet_bai_dang_id] FOREIGN KEY ([bai_dang_id]) REFERENCES [dbo].[BaiDang] ([bai_dang_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_KiemDuyet_admin_id] FOREIGN KEY ([admin_id]) REFERENCES [dbo].[NguoiDung] ([nguoi_dung_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [CK_KiemDuyet_ket_qua] CHECK ([ket_qua] IN (N'Phê duyệt', N'Từ chối')),
    CONSTRAINT [CK_KiemDuyet_do_tuong_dong_anh] CHECK ([do_tuong_dong_anh] IS NULL OR [do_tuong_dong_anh] BETWEEN 0 AND 100),
    CONSTRAINT [CK_KiemDuyet_text_ket_qua] CHECK (LEN(LTRIM(RTRIM([ket_qua])))>0),
    CONSTRAINT [CK_KiemDuyet_text_phan_hoi_admin] CHECK (LEN(LTRIM(RTRIM([phan_hoi_admin])))>0),
    CONSTRAINT [CK_KiemDuyet_text_ai_canh_bao] CHECK ([ai_canh_bao] IS NULL OR (LEN(LTRIM(RTRIM([ai_canh_bao])))>0))
);

CREATE TABLE [dbo].[PhienDauGia] (
    [phien_dau_gia_id] INT IDENTITY(1,1) NOT NULL,
    [bai_dang_id] INT NOT NULL,
    [thoi_gian_bat_dau] DATETIME2(3) NULL,
    [thoi_gian_ket_thuc] DATETIME2(3) NULL,
    [gia_khoi_diem] DECIMAL(18,0) NOT NULL,
    [gia_hien_tai] DECIMAL(18,0) NULL,
    [gia_toi_thieu] DECIMAL(18,0) NOT NULL,
    [buoc_gia] DECIMAL(18,0) NOT NULL,
    [thoi_gian_cho_dat_lai] INT NOT NULL CONSTRAINT [DF_PhienDauGia_thoi_gian_cho_dat_lai] DEFAULT (20),
    [trang_thai] VARCHAR(30) NOT NULL CONSTRAINT [DF_PhienDauGia_trang_thai] DEFAULT ('cho_kiem_duyet'),
    [row_version] ROWVERSION NOT NULL,
    CONSTRAINT [PK_PhienDauGia] PRIMARY KEY CLUSTERED ([phien_dau_gia_id]),
    CONSTRAINT [UQ_PhienDauGia_bai_dang_id] UNIQUE ([bai_dang_id]),
    CONSTRAINT [FK_PhienDauGia_bai_dang_id] FOREIGN KEY ([bai_dang_id]) REFERENCES [dbo].[BaiDang] ([bai_dang_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [CK_PhienDauGia_trang_thai] CHECK ([trang_thai] IN ('cho_kiem_duyet', 'khong_dat_kiem_duyet', 'da_qua_kiem_duyet', 'da_kich_hoat', 'da_ket_thuc')),
    CONSTRAINT [CK_PhienDauGia_gia] CHECK ([gia_khoi_diem] > 0 AND [buoc_gia] > 0 AND [gia_toi_thieu] >= [gia_khoi_diem] AND ([gia_hien_tai] IS NULL OR [gia_hien_tai] >= [gia_khoi_diem])),
    CONSTRAINT [CK_PhienDauGia_cho] CHECK ([thoi_gian_cho_dat_lai] BETWEEN 10 AND 30),
    CONSTRAINT [CK_PhienDauGia_lich] CHECK (([thoi_gian_bat_dau] IS NULL AND [thoi_gian_ket_thuc] IS NULL) OR ([thoi_gian_bat_dau] IS NOT NULL AND [thoi_gian_ket_thuc] IS NOT NULL AND [thoi_gian_ket_thuc] > [thoi_gian_bat_dau])),
    CONSTRAINT [CK_PhienDauGia_lich_trang_thai] CHECK (([trang_thai] IN ('cho_kiem_duyet','khong_dat_kiem_duyet') AND [thoi_gian_bat_dau] IS NULL AND [thoi_gian_ket_thuc] IS NULL) OR [trang_thai]='da_qua_kiem_duyet' OR ([trang_thai] IN ('da_kich_hoat','da_ket_thuc') AND [thoi_gian_bat_dau] IS NOT NULL AND [thoi_gian_ket_thuc] IS NOT NULL)),
    CONSTRAINT [CK_PhienDauGia_text_trang_thai] CHECK (LEN(LTRIM(RTRIM([trang_thai])))>0)
);

CREATE TABLE [dbo].[BinhLuan] (
    [binh_luan_id] INT IDENTITY(1,1) NOT NULL,
    [phien_dau_gia_id] INT NOT NULL,
    [nguoi_dung_id] INT NOT NULL,
    [noi_dung] NVARCHAR(2000) NOT NULL,
    [thoi_gian_binh_luan] DATETIME2(3) NOT NULL CONSTRAINT [DF_BinhLuan_thoi_gian_binh_luan] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_BinhLuan] PRIMARY KEY CLUSTERED ([binh_luan_id]),
    CONSTRAINT [FK_BinhLuan_phien_dau_gia_id] FOREIGN KEY ([phien_dau_gia_id]) REFERENCES [dbo].[PhienDauGia] ([phien_dau_gia_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_BinhLuan_nguoi_dung_id] FOREIGN KEY ([nguoi_dung_id]) REFERENCES [dbo].[NguoiDung] ([nguoi_dung_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [CK_BinhLuan_text_noi_dung] CHECK (LEN(LTRIM(RTRIM([noi_dung])))>0)
);

CREATE TABLE [dbo].[LuotDatGia] (
    [luot_dat_gia_id] INT IDENTITY(1,1) NOT NULL,
    [phien_dau_gia_id] INT NOT NULL,
    [nguoi_dung_id] INT NOT NULL,
    [muc_gia] DECIMAL(18,0) NOT NULL,
    [thoi_gian_dat] DATETIME2(3) NOT NULL,
    [ma_yeu_cau] VARCHAR(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
    CONSTRAINT [PK_LuotDatGia] PRIMARY KEY CLUSTERED ([luot_dat_gia_id]),
    CONSTRAINT [UQ_LuotDatGia_ma_yeu_cau] UNIQUE ([ma_yeu_cau]),
    CONSTRAINT [UQ_LuotDatGia_phien_dau_gia_id_muc_gia] UNIQUE ([phien_dau_gia_id], [muc_gia]),
    CONSTRAINT [FK_LuotDatGia_phien_dau_gia_id] FOREIGN KEY ([phien_dau_gia_id]) REFERENCES [dbo].[PhienDauGia] ([phien_dau_gia_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_LuotDatGia_nguoi_dung_id] FOREIGN KEY ([nguoi_dung_id]) REFERENCES [dbo].[NguoiDung] ([nguoi_dung_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [CK_LuotDatGia_gia] CHECK ([muc_gia] > 0),
    CONSTRAINT [CK_LuotDatGia_text_ma_yeu_cau] CHECK (LEN(LTRIM(RTRIM([ma_yeu_cau])))>0)
);

CREATE TABLE [dbo].[LichSuDauGia] (
    [lich_su_id] INT IDENTITY(1,1) NOT NULL,
    [phien_dau_gia_id] INT NOT NULL,
    [nguoi_dung_id] INT NULL,
    [hanh_dong] NVARCHAR(2000) NOT NULL,
    [muc_gia] DECIMAL(18,0) NULL,
    [thoi_gian] DATETIME2(3) NOT NULL CONSTRAINT [DF_LichSuDauGia_thoi_gian] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_LichSuDauGia] PRIMARY KEY CLUSTERED ([lich_su_id]),
    CONSTRAINT [FK_LichSuDauGia_phien_dau_gia_id] FOREIGN KEY ([phien_dau_gia_id]) REFERENCES [dbo].[PhienDauGia] ([phien_dau_gia_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_LichSuDauGia_nguoi_dung_id] FOREIGN KEY ([nguoi_dung_id]) REFERENCES [dbo].[NguoiDung] ([nguoi_dung_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [CK_LichSuDauGia_gia] CHECK ([muc_gia] IS NULL OR [muc_gia] > 0),
    CONSTRAINT [CK_LichSuDauGia_text_hanh_dong] CHECK (LEN(LTRIM(RTRIM([hanh_dong])))>0)
);

CREATE TABLE [dbo].[KetQuaDauGia] (
    [ket_qua_id] INT IDENTITY(1,1) NOT NULL,
    [phien_dau_gia_id] INT NOT NULL,
    [nguoi_thang_dau_id] INT NULL,
    [muc_gia_thang] DECIMAL(18,0) NULL,
    [thoi_gian_ket_thuc] DATETIME2(3) NOT NULL,
    [trang_thai] VARCHAR(30) NOT NULL,
    CONSTRAINT [PK_KetQuaDauGia] PRIMARY KEY CLUSTERED ([ket_qua_id]),
    CONSTRAINT [UQ_KetQuaDauGia_phien_dau_gia_id] UNIQUE ([phien_dau_gia_id]),
    CONSTRAINT [FK_KetQuaDauGia_phien_dau_gia_id] FOREIGN KEY ([phien_dau_gia_id]) REFERENCES [dbo].[PhienDauGia] ([phien_dau_gia_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_KetQuaDauGia_nguoi_thang_dau_id] FOREIGN KEY ([nguoi_thang_dau_id]) REFERENCES [dbo].[NguoiDung] ([nguoi_dung_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [CK_KetQuaDauGia_trang_thai] CHECK ([trang_thai] IN ('co_nguoi_thang', 'khong_co_nguoi_thang')),
    CONSTRAINT [CK_KetQuaDauGia_nguoi_thang] CHECK (([trang_thai]='khong_co_nguoi_thang' AND [nguoi_thang_dau_id] IS NULL AND [muc_gia_thang] IS NULL) OR ([trang_thai]='co_nguoi_thang' AND [nguoi_thang_dau_id] IS NOT NULL AND [muc_gia_thang] IS NOT NULL AND [muc_gia_thang]>0)),
    CONSTRAINT [CK_KetQuaDauGia_text_trang_thai] CHECK (LEN(LTRIM(RTRIM([trang_thai])))>0)
);

CREATE TABLE [dbo].[GiaoDich] (
    [giao_dich_id] INT IDENTITY(1,1) NOT NULL,
    [ma_giao_dich] VARCHAR(40) NOT NULL,
    [ket_qua_id] INT NOT NULL,
    [nguoi_mua_id] INT NOT NULL,
    [nguoi_ban_id] INT NOT NULL,
    [so_tien] DECIMAL(18,0) NOT NULL,
    [trang_thai] VARCHAR(30) NOT NULL CONSTRAINT [DF_GiaoDich_trang_thai] DEFAULT ('cho_xac_nhan'),
    [ngay_tao] DATETIME2(3) NOT NULL CONSTRAINT [DF_GiaoDich_ngay_tao] DEFAULT (SYSUTCDATETIME()),
    [ngay_hoan_tat] DATETIME2(3) NULL,
    [thoi_gian_xac_nhan_mua] DATETIME2(3) NULL,
    [thoi_gian_xac_nhan_ban] DATETIME2(3) NULL,
    CONSTRAINT [PK_GiaoDich] PRIMARY KEY CLUSTERED ([giao_dich_id]),
    CONSTRAINT [UQ_GiaoDich_ma_giao_dich] UNIQUE ([ma_giao_dich]),
    CONSTRAINT [UQ_GiaoDich_ket_qua_id] UNIQUE ([ket_qua_id]),
    CONSTRAINT [FK_GiaoDich_ket_qua_id] FOREIGN KEY ([ket_qua_id]) REFERENCES [dbo].[KetQuaDauGia] ([ket_qua_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_GiaoDich_nguoi_mua_id] FOREIGN KEY ([nguoi_mua_id]) REFERENCES [dbo].[NguoiDung] ([nguoi_dung_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_GiaoDich_nguoi_ban_id] FOREIGN KEY ([nguoi_ban_id]) REFERENCES [dbo].[NguoiDung] ([nguoi_dung_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [CK_GiaoDich_trang_thai] CHECK ([trang_thai] IN ('cho_xac_nhan', 'hoan_tat')),
    CONSTRAINT [CK_GiaoDich_gia] CHECK ([so_tien]>0),
    CONSTRAINT [CK_GiaoDich_hai_ben] CHECK ([nguoi_mua_id] <> [nguoi_ban_id]),
    CONSTRAINT [CK_GiaoDich_hoan_tat] CHECK (([trang_thai]='cho_xac_nhan' AND [ngay_hoan_tat] IS NULL) OR ([trang_thai]='hoan_tat' AND [ngay_hoan_tat] IS NOT NULL AND [ngay_hoan_tat] >= [ngay_tao])),
    CONSTRAINT [CK_GiaoDich_thoi_gian_xac_nhan_mua] CHECK ([thoi_gian_xac_nhan_mua] IS NULL OR [thoi_gian_xac_nhan_mua] >= [ngay_tao]),
    CONSTRAINT [CK_GiaoDich_thoi_gian_xac_nhan_ban] CHECK ([thoi_gian_xac_nhan_ban] IS NULL OR [thoi_gian_xac_nhan_ban] >= [ngay_tao]),
    CONSTRAINT [CK_GiaoDich_du_xac_nhan] CHECK ([trang_thai]<>'hoan_tat' OR ([thoi_gian_xac_nhan_mua] IS NOT NULL AND [thoi_gian_xac_nhan_ban] IS NOT NULL AND [ngay_hoan_tat] >= [thoi_gian_xac_nhan_mua] AND [ngay_hoan_tat] >= [thoi_gian_xac_nhan_ban])),
    CONSTRAINT [CK_GiaoDich_text_ma_giao_dich] CHECK (LEN(LTRIM(RTRIM([ma_giao_dich])))>0),
    CONSTRAINT [CK_GiaoDich_text_trang_thai] CHECK (LEN(LTRIM(RTRIM([trang_thai])))>0)
);

CREATE TABLE [dbo].[CuocTroChuyen] (
    [cuoc_tro_chuyen_id] INT IDENTITY(1,1) NOT NULL,
    [giao_dich_id] INT NOT NULL,
    [nguoi_mua_id] INT NOT NULL,
    [nguoi_ban_id] INT NOT NULL,
    [ngay_tao] DATETIME2(3) NOT NULL CONSTRAINT [DF_CuocTroChuyen_ngay_tao] DEFAULT (SYSUTCDATETIME()),
    [trang_thai] VARCHAR(20) NOT NULL CONSTRAINT [DF_CuocTroChuyen_trang_thai] DEFAULT ('dang_mo'),
    CONSTRAINT [PK_CuocTroChuyen] PRIMARY KEY CLUSTERED ([cuoc_tro_chuyen_id]),
    CONSTRAINT [UQ_CuocTroChuyen_giao_dich_id] UNIQUE ([giao_dich_id]),
    CONSTRAINT [FK_CuocTroChuyen_giao_dich_id] FOREIGN KEY ([giao_dich_id]) REFERENCES [dbo].[GiaoDich] ([giao_dich_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_CuocTroChuyen_nguoi_mua_id] FOREIGN KEY ([nguoi_mua_id]) REFERENCES [dbo].[NguoiDung] ([nguoi_dung_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_CuocTroChuyen_nguoi_ban_id] FOREIGN KEY ([nguoi_ban_id]) REFERENCES [dbo].[NguoiDung] ([nguoi_dung_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [CK_CuocTroChuyen_trang_thai] CHECK ([trang_thai] IN ('dang_mo', 'da_dong')),
    CONSTRAINT [CK_CuocTroChuyen_hai_ben] CHECK ([nguoi_mua_id] <> [nguoi_ban_id]),
    CONSTRAINT [CK_CuocTroChuyen_text_trang_thai] CHECK (LEN(LTRIM(RTRIM([trang_thai])))>0)
);

CREATE TABLE [dbo].[TinNhan] (
    [tin_nhan_id] INT IDENTITY(1,1) NOT NULL,
    [cuoc_tro_chuyen_id] INT NOT NULL,
    [nguoi_gui_id] INT NOT NULL,
    [noi_dung] NVARCHAR(4000) NOT NULL,
    [thoi_gian_gui] DATETIME2(3) NOT NULL CONSTRAINT [DF_TinNhan_thoi_gian_gui] DEFAULT (SYSUTCDATETIME()),
    [da_doc] BIT NOT NULL CONSTRAINT [DF_TinNhan_da_doc] DEFAULT (0),
    CONSTRAINT [PK_TinNhan] PRIMARY KEY CLUSTERED ([tin_nhan_id]),
    CONSTRAINT [FK_TinNhan_cuoc_tro_chuyen_id] FOREIGN KEY ([cuoc_tro_chuyen_id]) REFERENCES [dbo].[CuocTroChuyen] ([cuoc_tro_chuyen_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_TinNhan_nguoi_gui_id] FOREIGN KEY ([nguoi_gui_id]) REFERENCES [dbo].[NguoiDung] ([nguoi_dung_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [CK_TinNhan_text_noi_dung] CHECK (LEN(LTRIM(RTRIM([noi_dung])))>0)
);

CREATE TABLE [dbo].[KhieuNai] (
    [khieu_nai_id] INT IDENTITY(1,1) NOT NULL,
    [cuoc_tro_chuyen_id] INT NOT NULL,
    [giao_dich_id] INT NOT NULL,
    [nguoi_khieu_nai_id] INT NOT NULL,
    [ly_do] NVARCHAR(300) NOT NULL,
    [noi_dung] NVARCHAR(MAX) NOT NULL,
    [trang_thai] VARCHAR(30) NOT NULL CONSTRAINT [DF_KhieuNai_trang_thai] DEFAULT ('cho_xu_ly'),
    [phan_hoi_admin] NVARCHAR(MAX) NULL,
    [admin_id] INT NULL,
    [ngay_khieu_nai] DATETIME2(3) NOT NULL CONSTRAINT [DF_KhieuNai_ngay_khieu_nai] DEFAULT (SYSUTCDATETIME()),
    [ngay_xu_ly] DATETIME2(3) NULL,
    CONSTRAINT [PK_KhieuNai] PRIMARY KEY CLUSTERED ([khieu_nai_id]),
    CONSTRAINT [FK_KhieuNai_cuoc_tro_chuyen_id] FOREIGN KEY ([cuoc_tro_chuyen_id]) REFERENCES [dbo].[CuocTroChuyen] ([cuoc_tro_chuyen_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_KhieuNai_giao_dich_id] FOREIGN KEY ([giao_dich_id]) REFERENCES [dbo].[GiaoDich] ([giao_dich_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_KhieuNai_nguoi_khieu_nai_id] FOREIGN KEY ([nguoi_khieu_nai_id]) REFERENCES [dbo].[NguoiDung] ([nguoi_dung_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_KhieuNai_admin_id] FOREIGN KEY ([admin_id]) REFERENCES [dbo].[NguoiDung] ([nguoi_dung_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [CK_KhieuNai_trang_thai] CHECK ([trang_thai] IN ('cho_xu_ly', 'dang_xu_ly', 'da_xu_ly')),
    CONSTRAINT [CK_KhieuNai_xu_ly] CHECK (([trang_thai]='cho_xu_ly' AND [admin_id] IS NULL AND [ngay_xu_ly] IS NULL) OR ([trang_thai]='dang_xu_ly' AND [admin_id] IS NOT NULL AND [ngay_xu_ly] IS NULL) OR ([trang_thai]='da_xu_ly' AND [admin_id] IS NOT NULL AND [ngay_xu_ly] IS NOT NULL AND [ngay_xu_ly] >= [ngay_khieu_nai] AND [phan_hoi_admin] IS NOT NULL AND LEN(LTRIM(RTRIM([phan_hoi_admin])))>0)),
    CONSTRAINT [CK_KhieuNai_text_ly_do] CHECK (LEN(LTRIM(RTRIM([ly_do])))>0),
    CONSTRAINT [CK_KhieuNai_text_noi_dung] CHECK (LEN(LTRIM(RTRIM([noi_dung])))>0),
    CONSTRAINT [CK_KhieuNai_text_trang_thai] CHECK (LEN(LTRIM(RTRIM([trang_thai])))>0),
    CONSTRAINT [CK_KhieuNai_text_phan_hoi_admin] CHECK ([phan_hoi_admin] IS NULL OR (LEN(LTRIM(RTRIM([phan_hoi_admin])))>0))
);

CREATE TABLE [dbo].[BangChungKhieuNai] (
    [bang_chung_id] INT IDENTITY(1,1) NOT NULL,
    [khieu_nai_id] INT NOT NULL,
    [duong_dan_anh_khieu_nai] VARCHAR(2048) NOT NULL,
    [mo_ta_anh_khieu_nai] NVARCHAR(500) NULL,
    [thu_tu] SMALLINT NOT NULL,
    CONSTRAINT [PK_BangChungKhieuNai] PRIMARY KEY CLUSTERED ([bang_chung_id]),
    CONSTRAINT [UQ_BangChungKhieuNai_khieu_nai_id_thu_tu] UNIQUE ([khieu_nai_id], [thu_tu]),
    CONSTRAINT [FK_BangChungKhieuNai_khieu_nai_id] FOREIGN KEY ([khieu_nai_id]) REFERENCES [dbo].[KhieuNai] ([khieu_nai_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [CK_BangChungKhieuNai_thu_tu] CHECK ([thu_tu] > 0),
    CONSTRAINT [CK_BangChungKhieuNai_text_duong_dan_anh_khieu_nai] CHECK (LEN(LTRIM(RTRIM([duong_dan_anh_khieu_nai])))>0),
    CONSTRAINT [CK_BangChungKhieuNai_text_mo_ta_anh_khieu_nai] CHECK ([mo_ta_anh_khieu_nai] IS NULL OR (LEN(LTRIM(RTRIM([mo_ta_anh_khieu_nai])))>0))
);

CREATE TABLE [dbo].[DanhGia] (
    [danh_gia_id] INT IDENTITY(1,1) NOT NULL,
    [giao_dich_id] INT NOT NULL,
    [nguoi_danh_gia_id] INT NOT NULL,
    [nguoi_ban_id] INT NOT NULL,
    [so_sao] TINYINT NOT NULL,
    [noi_dung] NVARCHAR(2000) NULL,
    [ngay_danh_gia] DATETIME2(3) NOT NULL CONSTRAINT [DF_DanhGia_ngay_danh_gia] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_DanhGia] PRIMARY KEY CLUSTERED ([danh_gia_id]),
    CONSTRAINT [UQ_DanhGia_giao_dich_id] UNIQUE ([giao_dich_id]),
    CONSTRAINT [FK_DanhGia_giao_dich_id] FOREIGN KEY ([giao_dich_id]) REFERENCES [dbo].[GiaoDich] ([giao_dich_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_DanhGia_nguoi_danh_gia_id] FOREIGN KEY ([nguoi_danh_gia_id]) REFERENCES [dbo].[NguoiDung] ([nguoi_dung_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_DanhGia_nguoi_ban_id] FOREIGN KEY ([nguoi_ban_id]) REFERENCES [dbo].[NguoiDung] ([nguoi_dung_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [CK_DanhGia_sao] CHECK ([so_sao] BETWEEN 1 AND 5),
    CONSTRAINT [CK_DanhGia_hai_ben] CHECK ([nguoi_danh_gia_id] <> [nguoi_ban_id]),
    CONSTRAINT [CK_DanhGia_text_noi_dung] CHECK ([noi_dung] IS NULL OR (LEN(LTRIM(RTRIM([noi_dung])))>0))
);

CREATE TABLE [dbo].[PhanTichAI] (
    [phan_tich_id] INT IDENTITY(1,1) NOT NULL,
    [bai_dang_id] INT NOT NULL,
    [diem_do_hiem] DECIMAL(5,2) NULL,
    [diem_tinh_trang] DECIMAL(5,2) NULL,
    [trang_thai] VARCHAR(30) NOT NULL,
    [ngay_phan_tich] DATETIME2(3) NOT NULL CONSTRAINT [DF_PhanTichAI_ngay_phan_tich] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_PhanTichAI] PRIMARY KEY CLUSTERED ([phan_tich_id]),
    CONSTRAINT [FK_PhanTichAI_bai_dang_id] FOREIGN KEY ([bai_dang_id]) REFERENCES [dbo].[BaiDang] ([bai_dang_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [CK_PhanTichAI_trang_thai] CHECK ([trang_thai] IN ('thanh_cong', 'chua_day_du', 'that_bai')),
    CONSTRAINT [CK_PhanTichAI_diem_do_hiem] CHECK ([diem_do_hiem] IS NULL OR [diem_do_hiem] BETWEEN 0 AND 100),
    CONSTRAINT [CK_PhanTichAI_diem_tinh_trang] CHECK ([diem_tinh_trang] IS NULL OR [diem_tinh_trang] BETWEEN 0 AND 100),
    CONSTRAINT [CK_PhanTichAI_that_bai] CHECK ([trang_thai]<>'that_bai' OR ([diem_do_hiem] IS NULL AND [diem_tinh_trang] IS NULL)),
    CONSTRAINT [CK_PhanTichAI_text_trang_thai] CHECK (LEN(LTRIM(RTRIM([trang_thai])))>0)
);

CREATE TABLE [dbo].[ChiTietPhanTichAI] (
    [chi_tiet_id] INT IDENTITY(1,1) NOT NULL,
    [phan_tich_id] INT NOT NULL,
    [tieu_chi] NVARCHAR(200) NOT NULL,
    [diem] DECIMAL(5,2) NULL,
    [bang_chung] NVARCHAR(MAX) NULL,
    [do_tin_cay] DECIMAL(5,2) NULL,
    [canh_bao] NVARCHAR(MAX) NULL,
    [nhom_tieu_chi] VARCHAR(20) NOT NULL,
    [trang_thai_danh_gia] NVARCHAR(30) NOT NULL,
    [trong_so] DECIMAL(5,2) NULL,
    [nguon_doi_chieu] NVARCHAR(MAX) NULL,
    CONSTRAINT [PK_ChiTietPhanTichAI] PRIMARY KEY CLUSTERED ([chi_tiet_id]),
    CONSTRAINT [UQ_ChiTietPhanTichAI_phan_tich_id_nhom_tieu_chi_tieu_chi] UNIQUE ([phan_tich_id], [nhom_tieu_chi], [tieu_chi]),
    CONSTRAINT [FK_ChiTietPhanTichAI_phan_tich_id] FOREIGN KEY ([phan_tich_id]) REFERENCES [dbo].[PhanTichAI] ([phan_tich_id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [CK_ChiTietPhanTichAI_nhom_tieu_chi] CHECK ([nhom_tieu_chi] IN ('do_hiem', 'tinh_trang', 'khac')),
    CONSTRAINT [CK_ChiTietPhanTichAI_diem] CHECK ([diem] IS NULL OR [diem] BETWEEN 0 AND 100),
    CONSTRAINT [CK_ChiTietPhanTichAI_do_tin_cay] CHECK ([do_tin_cay] IS NULL OR [do_tin_cay] BETWEEN 0 AND 100),
    CONSTRAINT [CK_ChiTietPhanTichAI_trong_so] CHECK ([trong_so] IS NULL OR [trong_so] BETWEEN 0 AND 100),
    CONSTRAINT [CK_ChiTietPhanTichAI_danh_gia] CHECK ([trang_thai_danh_gia] IN (N'Đã đánh giá',N'Chưa đủ dữ liệu',N'Cần xác minh',N'Không áp dụng')),
    CONSTRAINT [CK_ChiTietPhanTichAI_quy_doi] CHECK (([nhom_tieu_chi]='khac' AND [diem] IS NULL AND [trong_so] IS NULL) OR ([nhom_tieu_chi] IN ('do_hiem','tinh_trang') AND [trong_so] IS NOT NULL AND [trong_so]>0 AND (([trang_thai_danh_gia]<>N'Đã đánh giá' AND [diem] IS NULL) OR ([trang_thai_danh_gia]=N'Đã đánh giá' AND [diem] IS NOT NULL AND (([nhom_tieu_chi]='do_hiem' AND [diem] IN (0,100)) OR ([nhom_tieu_chi]='tinh_trang' AND [diem] IN (0,25,50,75,100))))))),
    CONSTRAINT [CK_ChiTietPhanTichAI_can_cu] CHECK ([trang_thai_danh_gia] NOT IN (N'Đã đánh giá',N'Không áp dụng') OR ([bang_chung] IS NOT NULL AND LEN(LTRIM(RTRIM([bang_chung])))>0)),
    CONSTRAINT [CK_ChiTietPhanTichAI_text_tieu_chi] CHECK (LEN(LTRIM(RTRIM([tieu_chi])))>0),
    CONSTRAINT [CK_ChiTietPhanTichAI_text_bang_chung] CHECK ([bang_chung] IS NULL OR (LEN(LTRIM(RTRIM([bang_chung])))>0)),
    CONSTRAINT [CK_ChiTietPhanTichAI_text_canh_bao] CHECK ([canh_bao] IS NULL OR (LEN(LTRIM(RTRIM([canh_bao])))>0)),
    CONSTRAINT [CK_ChiTietPhanTichAI_text_nhom_tieu_chi] CHECK (LEN(LTRIM(RTRIM([nhom_tieu_chi])))>0),
    CONSTRAINT [CK_ChiTietPhanTichAI_text_trang_thai_danh_gia] CHECK (LEN(LTRIM(RTRIM([trang_thai_danh_gia])))>0),
    CONSTRAINT [CK_ChiTietPhanTichAI_text_nguon_doi_chieu] CHECK ([nguon_doi_chieu] IS NULL OR (LEN(LTRIM(RTRIM([nguon_doi_chieu])))>0))
);

CREATE INDEX [IX_BaiDang_nguoi_dang] ON [dbo].[BaiDang] (nguoi_dung_id, ngay_dang DESC);

CREATE INDEX [IX_BaiDang_sach] ON [dbo].[BaiDang] (sach_id, bai_dang_id DESC);

CREATE INDEX [IX_BaiDang_kiem_duyet] ON [dbo].[BaiDang] (trang_thai, ngay_dang);

CREATE INDEX [IX_Sach_isbn] ON [dbo].[Sach] (isbn);

CREATE INDEX [IX_KiemDuyet_bai] ON [dbo].[KiemDuyet] (bai_dang_id, ngay_kiem_duyet DESC);

CREATE INDEX [IX_PhienDauGia_het_han] ON [dbo].[PhienDauGia] (trang_thai, thoi_gian_ket_thuc);

CREATE INDEX [IX_LuotDatGia_gia] ON [dbo].[LuotDatGia] (phien_dau_gia_id, muc_gia DESC, luot_dat_gia_id);

CREATE INDEX [IX_LuotDatGia_cooldown] ON [dbo].[LuotDatGia] (phien_dau_gia_id, nguoi_dung_id, thoi_gian_dat DESC);

CREATE INDEX [IX_BinhLuan_phien] ON [dbo].[BinhLuan] (phien_dau_gia_id, thoi_gian_binh_luan, binh_luan_id);

CREATE INDEX [IX_LichSuDauGia_phien] ON [dbo].[LichSuDauGia] (phien_dau_gia_id, thoi_gian, lich_su_id);

CREATE INDEX [IX_GiaoDich_mua] ON [dbo].[GiaoDich] (nguoi_mua_id, ngay_tao DESC);

CREATE INDEX [IX_GiaoDich_ban] ON [dbo].[GiaoDich] (nguoi_ban_id, ngay_tao DESC);

CREATE INDEX [IX_TinNhan_phong] ON [dbo].[TinNhan] (cuoc_tro_chuyen_id, thoi_gian_gui, tin_nhan_id);

CREATE INDEX [IX_KhieuNai_giao_dich] ON [dbo].[KhieuNai] (giao_dich_id, ngay_khieu_nai DESC);

CREATE INDEX [IX_KhieuNai_xu_ly] ON [dbo].[KhieuNai] (trang_thai, ngay_khieu_nai);

CREATE INDEX [IX_DanhGia_nguoi_ban] ON [dbo].[DanhGia] (nguoi_ban_id, ngay_danh_gia DESC);

CREATE INDEX [IX_PhanTichAI_bai] ON [dbo].[PhanTichAI] (bai_dang_id, ngay_phan_tich DESC, phan_tich_id DESC);

COMMIT TRANSACTION;

END TRY

BEGIN CATCH

    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;

    THROW;

END CATCH;

GO
