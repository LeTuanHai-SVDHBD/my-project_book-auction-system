/** Sach là bản vật lý/khóa ổn định; mỗi bài có hồ sơ riêng, NULL ở bài cũ dùng Sach nguyên bản. */
export const BOOK_FIELDS=['ten_sach','tac_gia','the_loai','nha_xuat_ban','nam_xuat_ban','isbn','tinh_trang_sach','mo_ta'];
export const bookProfile=row=>Object.fromEntries(BOOK_FIELDS.map(key=>[key,row[key]??null]));
// OPENJSON WITH preserves explicit NULL (e.g. ISBN cleared) and descriptions beyond 4,000 chars.
export const bookProfileSql=`CROSS APPLY OPENJSON(COALESCE(b.ho_so_sach,
 (SELECT s.ten_sach,s.tac_gia,s.the_loai,s.nha_xuat_ban,s.nam_xuat_ban,s.isbn,s.tinh_trang_sach,s.mo_ta FOR JSON PATH,INCLUDE_NULL_VALUES,WITHOUT_ARRAY_WRAPPER)))
 WITH (ten_sach NVARCHAR(300),tac_gia NVARCHAR(200),the_loai NVARCHAR(100),nha_xuat_ban NVARCHAR(200),nam_xuat_ban SMALLINT,isbn NVARCHAR(100),tinh_trang_sach NVARCHAR(1000),mo_ta NVARCHAR(MAX)) bs`;
