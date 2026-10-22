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

Chi tiết lệnh và giới hạn được ghi trong `README.md`.
Kết quả xác minh và phần chưa chạy thật: `../VALIDATION.md`.
