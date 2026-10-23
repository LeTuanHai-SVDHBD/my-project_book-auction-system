<!-- Mục đích: Mô tả tiếp nhận, quyết định SQL, kết thúc và phục hồi yêu cầu đấu giá. -->

# Xử lý đặt giá và kết thúc phiên

## Phạm vi hiện tại

Đã triển khai API, Redis admission/Streams, processor có khóa phiên, transaction SQL,
job hết hạn và giao diện gửi giá/theo dõi quyết định qua HTTP.
Schema sau migration 003 có 20 bảng/152 cột. Không thay dependency hoặc cơ chế xác thực theo tab.
Socket.IO nghiệp vụ, AI và xác nhận hoàn tất giao dịch chưa triển khai.

## Hợp đồng HTTP

| Phương thức | Endpoint | Quyền và phản hồi |
|---|---|---|
| GET | `/api/auctions/:id` | Công khai với phiên đã duyệt và kích hoạt/kết thúc; snapshot và kết quả |
| POST | `/api/auctions/:id/bids` | Người dùng, cookie và CSRF; 202 đang chờ hoặc 200 quyết định đã có |
| GET | `/api/auctions/:id/requests/:requestId` | Chủ yêu cầu; SQL trước Redis, người khác nhận 404 |

Body gửi giá chỉ gồm:

```json
{
  "ma_yeu_cau": "4f5561ca-37d4-44ae-b91e-c9fbd3534052",
  "muc_gia": "1500000"
}
```

Mã là UUID v4 được chuẩn hóa chữ thường; giá nguyên dương dạng chuỗi tối đa 18 chữ số.
Không nhận người đặt, thời gian, rowversion hoặc trạng thái từ client. Người đặt lấy từ session,
vai trò đọc lại tại API và worker. Chủ sách không tự đặt; Admin chỉ xem.
Cùng mã phải gắn cùng người/phiên/giá; nội dung khác trả 409 mà không tiết lộ quyết định của người khác.
API không trả giá ngưỡng ẩn, email hay version nội bộ qua projection công khai.

| Trạng thái HTTP | Nguồn | Ý nghĩa |
|---|---|---|
| `dang_cho_xu_ly` | Redis admission | Đã tiếp nhận, chưa có quyết định cuối |
| `da_chap_nhan` | YeuCauDatGia | SQL đã COMMIT lượt hợp lệ |
| `bi_tu_choi` | YeuCauDatGia | SQL đã COMMIT quyết định từ chối với mã lý do |

HTTP 202 không đồng nghĩa đặt giá thành công. Giao diện poll yêu cầu của mình;
khi mất phản hồi, nút thử lại giữ nguyên UUID và mức giá. Sau kết quả cuối mới tạo yêu cầu mới.
Giá/trạng thái mới của phiên được phản ánh trong chi tiết sau khi lấy snapshot;
các tab khác bấm tải lại, chưa có đồng bộ giá qua Socket.IO.

## Quyết định trong SQL

1. Consumer lấy khóa Redis của phiên; chưa lấy được khóa thì để pending.
2. Mở transaction SERIALIZABLE, khóa/đọc YeuCauDatGia theo mã yêu cầu trước.
3. Nếu đã có quyết định, so nội dung và trả quyết định đó; không đánh giá lại.
4. Với yêu cầu mới, lấy khóa BaiDang rồi PhienDauGia bằng UPDLOCK/HOLDLOCK,
   đọc lại vai trò, lượt hợp lệ trước của cùng người/phiên và đồng hồ SQL.
5. Policy kiểm tra trạng thái/lịch, chủ sách, cooldown và mức giá. Lỗi dữ liệu nội bộ
   phải retry/đối soát, không biến thành từ chối nghiệp vụ giả.
6. Lượt hợp lệ ghi LuotDatGia, cập nhật giá bằng rowversion và điều kiện trạng thái, ghi lịch sử.
7. Nếu đạt/vượt ngưỡng, kết thúc ngay trong cùng transaction. Nếu yêu cầu đã muộn,
   từ chối giá và chốt hạn nếu phiên vẫn đang hoạt động.
8. Ghi quyết định cuối vào YeuCauDatGia, kiểm tra lease rồi COMMIT.
9. Chỉ sau COMMIT, consumer XACK/XDEL; client đọc quyết định SQL để biết kết quả.

Quyết định, giá, lịch sử, kết quả và giao dịch liên quan cùng rollback nếu chưa COMMIT.
Kết quả COMMIT chưa rõ được retry và đối chiếu receipt; không gửi thông báo từ chối giả.
Thứ tự xử lý do quyền ghi SQL dưới khóa quyết định, không lấy thứ tự bấm nút hoặc đồng hồ client làm căn cứ.

## Quy tắc giá và thời gian

- Chỉ nhận khi phiên `da_kich_hoat`, `bắt đầu <= now < kết thúc`.
- Thời gian là SYSUTCDATETIME sau khi worker lấy khóa SQL và dữ liệu mới nhất.
- Lượt đầu bằng `gia_khoi_diem + k × buoc_gia`, `k >= 0`.
- Lượt sau bằng `gia_hien_tai + k × buoc_gia`, `k >= 1`.
- Cooldown 10–30 giây theo phiên, mặc định 20 giây; đúng hạn chờ thì được đặt lại.
- Chỉ lượt hợp lệ trước của cùng người/cùng phiên ảnh hưởng cooldown.
- Giá BigInt trong policy, DECIMAL(18,0) trong SQL; driver/JSON dùng chuỗi, không Number.
- Không nhận thêm lượt sau kết thúc; không có kết thúc thủ công hoặc hủy giữa phiên.

## Dữ liệu và migration

Migration 003 thêm YeuCauDatGia:

| Cột | Kiểu/ràng buộc | Mục đích |
|---|---|---|
| `ma_yeu_cau` | VARCHAR(64), BIN2, PRIMARY KEY | Một quyết định cho một mã |
| `phien_dau_gia_id` | INT NOT NULL, FK | Phiên và kiểm tra nội dung retry |
| `nguoi_dung_id` | INT NOT NULL, FK | Chủ yêu cầu |
| `muc_gia` | DECIMAL(18,0) NOT NULL, CHECK > 0 | Giá nguyên gốc |
| `trang_thai` | VARCHAR(20), hai quyết định cuối | Chấp nhận hoặc từ chối |
| `ly_do` | VARCHAR(64) NULL | NULL khi chấp nhận; bắt buộc khi từ chối |
| `thoi_gian_xu_ly` | DATETIME2(3) NOT NULL | Đồng hồ quyết định SQL |

LuotDatGia tiếp tục chỉ lưu lượt hợp lệ với mã yêu cầu và cặp phiên/giá UNIQUE.
Migration backfill lượt hợp lệ cũ thành receipt chấp nhận; chạy lại không tạo trùng.
Nếu receipt cũ mâu thuẫn lượt giá, migration dừng để đối soát, không ghi đè.

KetQuaDauGia thêm `ly_do_ket_thuc VARCHAR(30) NULL`, chỉ nhận NULL,
`het_thoi_gian` hoặc `dat_gia_toi_thieu`. Dữ liệu cũ chưa rõ lý do giữ NULL, không đoán backfill;
code kết thúc mới luôn ghi lý do. Hai trạng thái có/không người thắng được giữ nguyên.
Không sửa DDL nền, không tạo lại database và không xóa volume. Dừng API/worker trước migration.

## Kết thúc và giao dịch

Job mỗi giây đọc tối đa 50 phiên đang kích hoạt đã hết hạn theo đồng hồ SQL, xếp sự kiện chốt.
Redis ngăn xếp lại cùng phiên trong 10 giây. Processor dùng cùng khóa/transaction với đặt giá.

Lượt hợp lệ đạt/vượt ngưỡng kết thúc sớm; ngưỡng bằng khởi điểm thì lượt đầu đúng khởi điểm kết thúc.
Hết hạn có lượt hợp lệ thì lượt giá cao nhất thắng dù chưa đạt ngưỡng.
Hết hạn không có lượt hợp lệ thì không có người thắng và không tạo giao dịch.

UPDATE trạng thái dùng rowversion/điều kiện. UNIQUE kết quả theo phiên và giao dịch theo kết quả
bảo vệ xử lý lại. GiaoDich ghi người mua/bán và số tiền ở trạng thái `cho_xac_nhan`.
Bài đăng tiếp tục giữ `da_duyet`; trạng thái kết thúc thuộc PhienDauGia.
Job/bid cạnh tranh được quyết định bằng snapshot và đồng hồ SQL sau khóa.

## Redis lock và phục hồi

Khóa SET NX PX có lease 15 giây, token ngẫu nhiên, Lua so token khi gia hạn/xóa.
Processor gia hạn mỗi khoảng 5 giây và kiểm tra trước COMMIT. Chủ cũ không xóa/gia hạn khóa của chủ mới.
Redis lock chỉ phối hợp; SQL transaction/rowversion/UNIQUE bảo vệ khi lease mất hoặc lúc COMMIT kéo dài.

Stream nghiệp vụ `bookauction:auction:events` tách khỏi probe, có consumer group riêng.
Consumer dùng kết nối BLOCK riêng; mỗi khoảng 5 giây XAUTOCLAIM thông điệp idle từ 30 giây.
Tranh khóa, deadlock hoặc lỗi dịch vụ tạm thời giữ pending. Không ACK để bỏ lỗi SQL.
Sau COMMIT, ACK và xóa event cùng MULTI; không MAXLEN-trim làm mất pending.
Receipt SQL là lịch sử quyết định bền vững, không tuyên bố Streams xử lý đúng một lần.

Admission pending chưa có TTL; sau ACK giữ thêm tối đa một ngày để hỗ trợ truy vấn/retry.
SQL receipt được ưu tiên kể cả khi cache hết hạn. Mất dữ liệu Redis có thể mất yêu cầu chưa COMMIT;
gửi lại cùng UUID giúp khôi phục tiếp nhận, còn quyết định SQL đã lưu được giữ nguyên.

Sự kiện sai cấu trúc hoặc tham chiếu không còn tồn tại vào `bookauction:auction:dead` để đối soát.
Không chuyển lỗi kỹ thuật thành quyết định nghiệp vụ. Admission của tham chiếu mất được đánh dấu lỗi;
API chủ yêu cầu trả 410, không treo trạng thái đang chờ vô hạn. Không có công cụ tự động replay dead-letter.

## Kiểm chứng

`npm.cmd run smoke:m5` kiểm tra các dịch vụ thật, không cần Cloudinary; tạo tài khoản/phiên UUID riêng.
Script kiểm tra quyền/CSRF, tranh giá, cooldown, replay, tiền 18 chữ số, hai kiểu kết thúc,
kết quả/giao dịch duy nhất và gián đoạn sau COMMIT trước ACK bằng stream kiểm thử riêng.
Chỉ PASS khi dọn xong SQL/khóa thử; nếu còn pending, giữ fixture để worker/nhóm đối soát.

`AUCTION_TEST_SQL=true` cùng database tên `BookAuctionTest_*` và Redis kiểm thử bật test SQL riêng,
bao gồm rollback toàn transaction và lease hết hạn khi đang giữ quyền ghi SQL.
Môi trường và giới hạn bằng chứng thực tế ghi tại [VALIDATION.md](../VALIDATION.md).

Tham khảo: [Redis distributed locks](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/),
[XAUTOCLAIM](https://redis.io/docs/latest/commands/xautoclaim/),
[SQL Server locking](https://learn.microsoft.com/en-us/sql/relational-databases/sql-server-transaction-locking-and-row-versioning-guide),
[rowversion](https://learn.microsoft.com/en-us/sql/t-sql/data-types/rowversion-transact-sql).
