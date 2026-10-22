-- Mốc 4: metadata quản lý Cloudinary, giữ URL cũ và toàn bộ dữ liệu hiện có.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.HinhAnh','cloudinary_public_id') IS NULL
    ALTER TABLE dbo.HinhAnh ADD cloudinary_public_id VARCHAR(255) NULL;
IF COL_LENGTH('dbo.Video','cloudinary_public_id') IS NULL
    ALTER TABLE dbo.Video ADD cloudinary_public_id VARCHAR(255) NULL;
-- Dynamic batches avoid name resolution before newly added columns are visible.
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.HinhAnh') AND name='IX_HinhAnh_cloudinary')
    EXEC('CREATE INDEX IX_HinhAnh_cloudinary ON dbo.HinhAnh(cloudinary_public_id) WHERE cloudinary_public_id IS NOT NULL');
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.Video') AND name='IX_Video_cloudinary')
    EXEC('CREATE INDEX IX_Video_cloudinary ON dbo.Video(cloudinary_public_id) WHERE cloudinary_public_id IS NOT NULL');
COMMIT TRANSACTION;
