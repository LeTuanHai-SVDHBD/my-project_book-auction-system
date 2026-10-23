<!-- Mục đích: Mô tả quy tắc xử lý đấu giá và đề xuất lưu kết quả yêu cầu trước khi nối API/worker. -->

# Xử lý đặt giá và kết thúc phiên

## Trạng thái triển khai

Đã có bộ quy tắc thuần `bidPolicy.js` và khóa theo phiên `auctionLock.js`, kèm kiểm thử.
Hai thành phần này chưa được nối vào API/worker. Chưa có endpoint đặt giá, scheduler chốt hạn,
giao dịch ghi lượt giá hay kết quả SQL. Giao diện danh mục chưa nhận đặt giá.

Phần lưu kết quả yêu cầu dưới đây là đề xuất cần được thống nhất trước khi bổ sung migration.
Database hiện tại vẫn giữ 19 bảng và 144 cột; không cần chạy migration cho bản chuẩn bị này.

## Hợp đồng yêu cầu

Dự kiến `POST /api/auctions/:id/bids`, cần session, vai trò người dùng và CSRF.
Người đặt được xác định từ session; không nhận `nguoi_dung_id`, thời gian, trạng thái hay giá ẩn từ client.
Body chỉ gồm:

```json
{
  "ma_yeu_cau": "4f5561ca-37d4-44ae-b91e-c9fbd3534052",
  "muc_gia": "1500000"
}
```

Validator hiện có kiểm tra UUID v4 và chuỗi số nguyên dương tối đa 18 chữ số.
Cùng mã phải gắn cùng người, cùng phiên và cùng giá. Dùng lại mã cho nội dung khác dự kiến trả 409;
không trả kết quả riêng của người khác. Endpoint theo dõi kết quả cũng phải kiểm tra chủ yêu cầu.
HTTP 202 chỉ xác nhận đã tiếp nhận; không coi việc xếp hàng là đặt giá thành công.

## Quy tắc đã mã hóa

`evaluateBid` nhận snapshot nội bộ sau khóa: trạng thái, chủ sách, giá, lịch, cooldown,
lượt hợp lệ trước của cùng người trong cùng phiên và đồng hồ SQL tại lúc kiểm tra.

- Chỉ nhận khi `trang_thai = da_kich_hoat` và `bắt đầu <= now < kết thúc`.
- Chủ sách không đặt giá cho sách của mình.
- Lượt đầu bằng `gia_khoi_diem + k × buoc_gia`, `k >= 0`.
- Lượt sau bằng `gia_hien_tai + k × buoc_gia`, `k >= 1`.
- Cooldown 10–30 giây theo cấu hình phiên; đúng thời điểm hết chờ thì được đặt lại.
- Giá được tính bằng BigInt; chuỗi 18 chữ số giữ nguyên khi vào/ra.
- Lượt hợp lệ đạt/vượt ngưỡng yêu cầu kết thúc sớm trong cùng transaction ghi giá.
- Yêu cầu xử lý từ thời điểm hết hạn bị từ chối và yêu cầu kiểm tra chốt hạn.

`deriveEndResult` kiểm tra giá hiện tại khớp lượt hợp lệ cao nhất và xác định kết quả.
Hết hạn có lượt hợp lệ thì người giá cao nhất thắng dù chưa đạt ngưỡng; không có lượt thì không có người thắng.
Chỉ có hai lý do kết thúc: `het_thoi_gian` và `dat_gia_toi_thieu`.
Hàm trả giá trị dự kiến, không tự ghi kết quả/giao dịch và không bảo đảm idempotency SQL.
Snapshot sai phải báo lỗi để retry/đối soát; không đổi lỗi dữ liệu thành kết quả từ chối giả.

## Khóa và ranh giới nhất quán

`auctionLock.js` dùng `SET NX PX`, token ngẫu nhiên và Lua so token trước khi gia hạn/xóa.
Hai phiên dùng hai khóa độc lập. Chủ khóa cũ không được xóa hoặc gia hạn khóa đã thuộc worker khác.
Không tự đợi khóa, không tự gia hạn bằng timer; processor sẽ quyết định retry và quản lý thời hạn.

Redis lock là lớp phối hợp, không bảo đảm độc quyền sau khi hết lease, failover hoặc mất kết nối.
Luồng SQL dự kiến vẫn cần transaction, đọc lại bằng `UPDLOCK/HOLDLOCK`,
kiểm tra `row_version`, UPDATE có điều kiện và UNIQUE hiện có.
Đồng hồ phải được đọc sau khi transaction đã lấy được quyền xử lý phiên, không dùng thời gian gửi từ client.
Thứ tự khóa bài/phiên phải thống nhất với kiểm duyệt/kích hoạt để hạn chế deadlock; lỗi deadlock để retry.

## Đề xuất bổ sung dữ liệu

Schema hiện có `LuotDatGia` chỉ lưu lượt hợp lệ với `ma_yeu_cau` UNIQUE.
Nó bảo vệ lượt đã ghi nhưng chưa giữ được quyết định từ chối qua restart/mất Redis.
`LichSuDauGia.hanh_dong` là nhật ký nghiệp vụ, không nên dùng thay bảng kết quả có khóa duy nhất.

### Bảng kết quả yêu cầu

Đề xuất thêm `dbo.YeuCauDatGia`, chỉ lưu quyết định cuối sau khi xử lý SQL; hàng chờ vẫn ở Redis Streams.

| Cột | Kiểu và ràng buộc đề xuất | Mục đích |
|---|---|---|
| `ma_yeu_cau` | VARCHAR(64), collation BIN2, PRIMARY KEY | Chặn quyết định trùng trên toàn hệ thống |
| `phien_dau_gia_id` | INT NOT NULL, FK PhienDauGia | Xác định phiên và kiểm tra nội dung khi retry |
| `nguoi_dung_id` | INT NOT NULL, FK NguoiDung | Quyền đọc kết quả và kiểm tra cùng người gửi |
| `muc_gia` | DECIMAL(18,0) NOT NULL, CHECK > 0 | Giá nguyên gốc của yêu cầu |
| `trang_thai` | VARCHAR(20) NOT NULL | Chỉ `da_chap_nhan` hoặc `bi_tu_choi` |
| `ly_do` | VARCHAR(64) NULL | Mã lý do ổn định; NULL khi chấp nhận, bắt buộc khi từ chối |
| `thoi_gian_xu_ly` | DATETIME2(3) NOT NULL | Đồng hồ SQL tại quyết định |

Không sửa hoặc bỏ bảng/cột hiện có. Lượt hợp lệ tiếp tục lưu tại `LuotDatGia`.
Quyết định, lượt giá, cập nhật giá, lịch sử và kết quả/giao dịch nếu kết thúc phải cùng COMMIT.
Khi xử lý lại, đọc quyết định đã lưu và so nội dung trước; không đánh giá lại một quyết định từ chối đã chốt.

### Lý do kết thúc

Đề xuất thêm `KetQuaDauGia.ly_do_ket_thuc VARCHAR(30) NULL`,
CHECK chỉ nhận NULL, `het_thoi_gian` hoặc `dat_gia_toi_thieu`.
NULL bảo toàn dữ liệu cũ không rõ căn cứ; code mới luôn ghi một trong hai lý do.
Không suy đoán để backfill dữ liệu lịch sử. Hai trạng thái có/không người thắng hiện tại được giữ nguyên.

Đây chưa phải migration đã được áp dụng. Khi thống nhất sẽ bổ sung migration có thể chạy lại,
cập nhật init/migrate/schema manifest/readiness và tài liệu cùng lúc; không tạo lại database hoặc volume.

## Luồng tích hợp dự kiến

1. API kiểm tra session/CSRF/body, xếp sự kiện vào stream nghiệp vụ riêng, trả 202.
2. Consumer lấy khóa theo phiên; tranh khóa hoặc lỗi dịch vụ thì để pending, không XACK sớm.
3. Transaction SQL kiểm tra mã yêu cầu, đọc dữ liệu mới nhất, đồng hồ và lượt trước; chạy policy.
4. SQL lưu quyết định và mọi thay đổi liên quan. Có người thắng mới tạo GiaoDich;
   UNIQUE kết quả theo phiên và giao dịch theo kết quả bảo vệ xử lý lại.
5. Sau COMMIT mới công bố kết quả xử lý và XACK. Crash sau COMMIT/trước XACK phải phát lại quyết định SQL.
6. Consumer dùng XAUTOCLAIM để nhận lại pending. Lỗi cấu trúc sự kiện vào dead-letter;
   lỗi SQL/Redis tạm thời không được đổi thành từ chối hoặc ACK bỏ.
7. Job tìm phiên hết hạn, đưa yêu cầu chốt vào luồng dùng chung khóa/transaction/idempotency.
   Race giữa yêu cầu giá và chốt hạn quyết định bằng dữ liệu và đồng hồ SQL dưới khóa.

Realtime nghiệp vụ và tích hợp AI thuộc phần phát triển tiếp theo, chưa nằm trong bản chuẩn bị này.

## Kiểm chứng và công việc còn lại

Kiểm thử hiện có bao phủ các biên giá/thời gian/cooldown, kết thúc sớm/hết hạn, không người thắng,
tiền 18 chữ số, snapshot sai và quyền sở hữu khóa Redis thật.
Không dùng kết quả này để khẳng định đã kiểm tra SQL đồng thời hoặc phục hồi toàn luồng.

Trước khi nghiệm thu lõi cần kiểm tra với SQL Server/Redis thật: hai yêu cầu cùng giá,
cùng mã xử lý lặp, retry sau SQL COMMIT, lock hết hạn giữa chừng, kết quả/giao dịch duy nhất,
hết giờ không người thắng và thông điệp pending được worker khác tiếp nhận lại.

Tham khảo: [Redis distributed locks](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/),
[XAUTOCLAIM](https://redis.io/docs/latest/commands/xautoclaim/),
[SQL Server locking](https://learn.microsoft.com/en-us/sql/relational-databases/sql-server-transaction-locking-and-row-versioning-guide),
[rowversion](https://learn.microsoft.com/en-us/sql/t-sql/data-types/rowversion-transact-sql).
