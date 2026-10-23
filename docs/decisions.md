<!-- Mục đích: Lưu quyết định kỹ thuật, căn cứ và các lựa chọn chưa được thống nhất. -->

# Nhật ký quyết định kỹ thuật

## ADR-001 — Một repository, hai tiến trình Backend

Trạng thái: Đã áp dụng trong bộ khung.

Quyết định:
- Frontend và Backend nằm trong cùng repository.
- Quản lý dependency bằng npm workspaces.
- API và worker chạy riêng nhưng dùng chung mã nguồn Backend.

Lý do:
- Phù hợp quy mô đồ án.
- Dễ chia sẻ cấu hình, quy tắc và công cụ kiểm tra.
- Tách xử lý nền khỏi vòng đời HTTP request.

## ADR-002 — SQL Server là nguồn trạng thái có thẩm quyền

Trạng thái: Đã chốt trong thiết kế.

Quyết định:
- Giá hiện tại, lượt hợp lệ, trạng thái phiên và người thắng
  được xác định từ dữ liệu SQL Server.
- Redis hỗ trợ hàng đợi và phối hợp xử lý.
- Redis lock không thay thế giao dịch SQL và kiểm tra `row_version`.

Hệ quả:
- Worker phải đọc lại dữ liệu trước khi quyết định.
- Client không được quyết định kết quả từ dữ liệu đang hiển thị.

## ADR-003 — Dùng FK và UNIQUE cho quan hệ tối đa một bản ghi

Trạng thái: Đã có trong DDL; chờ xác nhận thực thi trên SQL Server.

Ví dụ:
`KetQuaDauGia.phien_dau_gia_id` có FK, UNIQUE và NOT NULL.

| Ràng buộc | Ý nghĩa |
|---|---|
| FK | Kết quả phải tham chiếu một phiên tồn tại |
| UNIQUE | Một phiên không được xuất hiện trong nhiều kết quả |
| NOT NULL | Mỗi kết quả phải thuộc một phiên |

Ký hiệu `FK, UNIQUE` trong bảng mô tả là cách liệt kê
hai ràng buộc cùng áp dụng lên cột.

Trong SQL, FOREIGN KEY và UNIQUE vẫn là hai ràng buộc riêng.

Phía phiên có thể chưa có kết quả:
- Mỗi phiên có `0..1` kết quả.
- Mỗi kết quả thuộc đúng `1` phiên.

FK và UNIQUE không tự buộc mọi phiên phải có kết quả.
Khi phiên kết thúc, nghiệp vụ phải tạo kết quả nhất quán
trong giao dịch chốt phiên.

## ADR-004 — Cho phép thiếu người thực hiện ở một số quan hệ

Trạng thái: Đã chốt trong thiết kế.

- `LichSuDauGia.nguoi_dung_id` được NULL để lưu hoạt động hệ thống.
- `KhieuNai.admin_id` được NULL khi chưa có Admin tiếp nhận.

Một người dùng vẫn có thể liên quan nhiều bản ghi lịch sử.
Một Admin vẫn có thể xử lý nhiều khiếu nại.

Tính tùy chọn `0..1` ở mỗi bản ghi con không làm quan hệ thành 1–1.

## ADR-005 — Tiếp nhận bất đồng bộ và chống ghi trùng

Trạng thái:
- Đã áp dụng cho probe Mốc 2.
- Luồng đặt giá chưa triển khai.

Quyết định:
- HTTP 202 xác nhận tiếp nhận, không xác nhận nghiệp vụ thành công.
- Mỗi yêu cầu đặt giá có mã định danh.
- `LuotDatGia.ma_yeu_cau` có UNIQUE.
- Xử lý lại yêu cầu đã thành công phải trả kết quả cũ.
- Không khẳng định Redis Streams cung cấp xử lý đúng một lần.

## ADR-006 — Quy tắc giá và kết thúc phiên

Trạng thái: Đã chốt trong thiết kế.

- Giữ tên cột `gia_toi_thieu`.
- Cột này là ngưỡng kết thúc sớm, ẩn với người mua.
- Phiên kết thúc khi hết thời gian hoặc đạt/vượt ngưỡng.
- Khi hết hạn, lượt hợp lệ cao nhất vẫn thắng dù chưa đạt ngưỡng.
- Không có kết thúc thủ công hoặc hủy giữa phiên.
- Thời gian chờ đặt lại mặc định 20 giây, cho phép 10–30 giây.
- Khoảng chờ áp dụng theo cùng người trong cùng phiên.

## ADR-007 — Tách luồng kiểm tra khỏi nghiệp vụ

Trạng thái: Đã áp dụng trong bộ khung.

- Probe sử dụng stream hạ tầng riêng.
- Processor probe chỉ kiểm tra SQL bằng truy vấn đọc.
- Không dùng probe để ghi lượt đặt giá hoặc xác định người thắng.
- API probe chỉ mở trong development và yêu cầu token chẩn đoán.
- Token chẩn đoán không thay thế xác thực người dùng.

## ADR-008 — Cấu hình và phiên bản thư viện

Trạng thái: Đã áp dụng trong bộ khung.

- Dùng Node.js 24 theo cấu hình `engines`.
- Commit `package-lock.json` ở gốc.
- Dùng `npm ci` khi cài theo bộ phiên bản đã khóa.
- Không commit `.env`, dependency đã cài hoặc kết quả build.
- Chỉ đưa `.env.example` chứa cấu hình mẫu vào repository.

## ADR-009 — Phát thông báo sau COMMIT

Trạng thái: Nguyên tắc đã chốt; cơ chế phục hồi chưa chốt.

Yêu cầu:
- Không phát thành công trước khi SQL COMMIT.
- Worker và API là hai tiến trình riêng.
- Cần cơ chế chuyển thông báo sang API và xử lý trường hợp
  tiến trình dừng sau COMMIT nhưng trước khi phát thông báo.

Chưa chọn:
- Kênh chuyển thông báo từ worker sang API.
- Có bổ sung transactional outbox hay cơ chế tương đương không.
- Quy tắc phát lại và loại thông báo trùng.

Phải thống nhất trước khi triển khai luồng đấu giá hoàn chỉnh.

## ADR-010 — Cơ chế đăng nhập

Trạng thái: Đã chọn phương án A và triển khai trong bản cập nhật Mốc 3.

Hải xác nhận chọn session Redis, cookie HttpOnly và Argon2.

- Dùng `express-session` và `connect-redis`; không dùng MemoryStore trong API thật.
- Cookie chỉ chứa mã session, có HttpOnly và SameSite=Lax; Secure khi production.
- Session hết hạn sau 2 giờ không hoạt động, gia hạn khi có request dùng session.
- Đổi session ID và token CSRF sau khi đăng nhập thành công.
- Đăng xuất xóa session ở Redis; không chỉ xóa thông tin trên React.
- Argon2id lưu hash vào cột `NguoiDung.mat_khau` hiện có.
- Đọc lại người dùng và vai trò từ SQL khi gọi API cần đăng nhập.
- Đăng ký công khai chỉ tạo `nguoi_dung`; Admin tạo bằng script terminal riêng.
- CSRF token gắn với session, gửi qua header; React chỉ giữ token trong bộ nhớ.
- Redis giới hạn tổng lần thử đăng nhập, đăng ký và cấp CSRF; không bỏ qua khi Redis lỗi.
- Không thêm bảng/cột session hoặc refresh token vào SQL Server.

Các giới hạn mặc định đã triển khai:

| Hoạt động | Giới hạn | Cửa sổ |
|---|---|---|
| Đăng nhập theo email | 10 lần thử | 15 phút |
| Đăng nhập theo IP | 50 lần thử | 15 phút |
| Đăng ký theo IP | 10 lần thử | 15 phút |
| Cấp CSRF theo IP | 60 lần | 1 phút |

Bộ đếm tính tổng lần thử, kể cả lần thành công. Quá giới hạn trả HTTP 429 và `Retry-After`.
Tên khóa dùng HMAC để không chứa email hoặc IP nguyên văn.

Hướng dẫn chạy, API và kiểm tra Admin: [README, mục 6–8](../README.md#6-kiểm-tra-tài-khoản-trên-giao-diện).
Kết quả kiểm thử và xác nhận của nhóm: [VALIDATION.md](../VALIDATION.md).

## ADR-011 — Tên volume Docker và bảo toàn liên kết dữ liệu

Trạng thái: Đã đồng bộ cấu hình mẫu và tài liệu; giữ nguyên fallback hiện hành.

- Project dùng tên `my-project_book-auction-system`.
- Máy cài mới lấy `SQLSERVER_VOLUME_NAME` và `REDIS_VOLUME_NAME` từ `.env.example` qua `npm run setup`.
- Tên volume mới lần lượt là `my-project_book-auction-system_sqlserver_data` và `my-project_book-auction-system_redis_data`.
- `setup` không ghi đè hoặc bổ sung biến volume vào `.env` đã tồn tại.
- Khi biến volume thiếu hoặc rỗng, Compose vẫn dùng `book-auction_sqlserver_data` / `book-auction_redis_data` như trước bản sửa này.
- Khi chuyển từ volume mang tên khác, gán đúng tên đã quan sát bằng `docker inspect`; không suy đoán từ tên project.
- Không tự đổi tên, sao chép hoặc xóa volume đã có dữ liệu.

Các bước chuyển đổi: [docker-migration.md](docker-migration.md).


## ADR-012 — Cloudinary và ranh giới giao dịch media

Trạng thái: Hải chọn Cloudinary; triển khai cho Mốc 4.

- React gửi tệp nhị phân qua API đã kiểm tra session, vai trò và CSRF. API dùng native fetch/FormData/Blob của Node 24,
  gọi Cloudinary REST với credentials ở backend; không thêm dependency hoặc unsigned upload preset.
- Cloudinary lưu tệp; SQL lưu URL và `cloudinary_public_id` để quản lý tài nguyên. Migration 002 thêm đúng hai cột nullable
  cùng index, schema nền 001 không đổi. Tổng 19 bảng/144 cột sau migration; URL cũ vẫn sử dụng được, ID cũ có thể NULL.
- Giới hạn tài nguyên cấu hình trong `.env`: mặc định 12 ảnh, 3 video, 10 MB/ảnh, 50 MB/video;
  2 upload đồng thời/API process, 60 lần thử/tài khoản/giờ. Đây không phải tiêu chí nghiệp vụ của báo cáo.
- Redis lưu vé upload và lịch cleanup, không lưu bytes. Tạo vé trước khi gọi provider để theo dõi cả upload bị ngắt.
  Vé có thời hạn sử dụng 1 giờ, không TTL-xóa ledger; Lua claim kiểm tra chủ sở hữu và trạng thái nguyên tử.
- Chỉ metadata từ vé đã claim được ghi vào SQL. COMMIT thành công mới trả kết quả nghiệp vụ.
  Redis acknowledgement lỗi sau COMMIT không biến kết quả SQL thành rollback giả.
- Cleanup mỗi phút kiểm tra SQL reference trước khi gọi destroy; không xóa file đã gắn bài hoặc đang claim chưa rõ.
  Claim không rõ commit và không có reference được giữ lại/cảnh báo để đối soát thủ công; mất dữ liệu Redis có thể để lại orphan.
  Không có distributed transaction SQL–Cloudinary; không khẳng định cleanup bảo đảm tuyệt đối sau mọi sự cố.

Tài liệu REST chính thức: [Cloudinary Upload API](https://cloudinary.com/documentation/image_upload_api_reference).

## ADR-013 — Vòng đời bài đăng Mốc 4 và AI ở Mốc 7

Trạng thái: triển khai theo lộ trình đã gửi.

- Tạo `Sach`, `BaiDang`, `PhienDauGia`, media và lịch sử trong cùng transaction SQL SERIALIZABLE.
  Bài/phiên chờ duyệt, chưa có lịch. Không gọi provider/AI khi đang giữ transaction.
- Mã yêu cầu UUID ánh xạ thành `BaiDang.ma_san_pham` (`BK` + 32 ký tự hex); UNIQUE hiện có bảo vệ retry.
  Cùng mã trả bài đã tạo của đúng chủ, không cập nhật bằng nội dung mới. Không thêm cột idempotency khác.
- Kiểm duyệt khóa cặp bài/phiên, đối chiếu `row_version`, lưu lý do và cập nhật hai trạng thái nguyên tử.
  Duyệt yêu cầu xác nhận kiểm tra bằng chứng quý hiếm; dữ liệu/điểm AI không tự quyết định duyệt.
- Bài bị từ chối được bổ sung mô tả bài, thông số giá và media rồi gửi lại, giữ ID bài/phiên và mọi quyết định cũ.
  Bản ghi sách và media đã lưu không bị sửa/xóa; khác với đăng lại sau phiên không có người thắng.
- Kích hoạt chỉ cập nhật phiên đã qua kiểm duyệt của chủ sách. SQL kiểm tra giờ bắt đầu tương lai,
  giờ kết thúc sau bắt đầu; lưu datetime UTC. Không có kết thúc thủ công hoặc sửa giá/lịch sau kích hoạt.
- Đăng lại lấy sách làm điểm khóa ổn định, kiểm tra bài/phiên mới nhất đã kết thúc và kết quả rõ không người thắng.
  Tạo bài/phiên mới giữ `sach_id`; thông số giá và lịch sử trước giữ nguyên. Không suy ra không người thắng từ việc thiếu kết quả.
- Public API dùng projection cho phép riêng, không trả `gia_toi_thieu`, owner/email, row_version hay nhận xét nội bộ.
  Tiền 18 chữ số dùng chuỗi JSON và VARCHAR→DECIMAL trong SQL để tránh làm tròn bằng JavaScript Number.
- Mốc 4 chưa gọi Gemini. Không có phân tích thì trả `ai: null`, hiển thị chưa tích hợp; không ghi điểm/kết quả lỗi giả.
  Đọc được kết quả AI đã có để Admin tham khảo, nhưng tích hợp và chấm điểm thực hiện ở Mốc 7.


### Bổ sung ADR-013 ngày 23/10/2026 — row_version qua ranh giới SQL/JSON

Hải báo smoke M4 trả 400 thay vì 409 khi thử kích hoạt trước duyệt và Admin không duyệt được do token phiên bản không hợp lệ.
Sửa model đọc `CONVERT(BINARY(8), p.row_version)`, mã hóa bằng Buffer thành chuỗi hex 16 ký tự viết hoa trong Node.
Dùng chung encoder cho list/detail và truy vấn khóa; không phụ thuộc CONVERT sang VARCHAR để định dạng token HTTP.
Giữ đủ byte 0 đầu, không qua Number; dữ liệu SQL không đúng 8 byte phải báo lỗi thay vì sinh token giả.
HTTP vẫn yêu cầu đúng chuỗi hex 16 ký tự, bản cũ tiếp tục bị chặn 409 sau khi lấy khóa.
Không thay đổi schema hoặc quy tắc duyệt/kích hoạt.

Thêm hồi quy qua model thật và HTTP với driver giả trả bytes, gồm gửi lại token chi tiết,
duyệt, kích hoạt trước duyệt, bản cũ và bản mới. SQL Server thật vẫn cần smoke trên máy nhóm.
Tài liệu kiểu dữ liệu: [Microsoft rowversion](https://learn.microsoft.com/en-us/sql/t-sql/data-types/rowversion-transact-sql).
