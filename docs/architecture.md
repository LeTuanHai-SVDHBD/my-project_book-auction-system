<!-- Mục đích: Mô tả kiến trúc, kết nối và ranh giới trách nhiệm của hệ thống. -->

# Kiến trúc hệ thống

## 1. Tổng quan

Hệ thống sử dụng một repository chứa Frontend và Backend.

Backend được tổ chức theo các mô-đun, có hai tiến trình:
- API: tiếp nhận HTTP request và quản lý kết nối Socket.IO.
- Worker: đọc sự kiện từ Redis Streams và xử lý công việc nền.

SQL Server lưu dữ liệu nghiệp vụ có thẩm quyền.
Redis hỗ trợ truyền sự kiện, phối hợp xử lý và lưu session đăng nhập.

Đây chưa phải kiến trúc microservices; API và worker dùng chung mã nguồn Backend.

## 2. Thành phần

| Thành phần | Trách nhiệm |
|---|---|
| React | Hiển thị dữ liệu, gửi yêu cầu, nhận cập nhật |
| Express API | Xác thực, phân quyền, kiểm tra đầu vào và tiếp nhận yêu cầu |
| Redis Streams | Lưu và phân phối yêu cầu cho worker |
| Event Worker | Xử lý sự kiện và điều phối nghiệp vụ |
| Redis lock | Phối hợp xử lý các yêu cầu của cùng một phiên |
| SQL Server | Lưu tài khoản, bài đăng, phiên, lượt giá, kết quả và giao dịch |
| Socket.IO | Gửi cập nhật sau khi thay đổi đã được xác nhận |
| Gemini API | Dự kiến Mốc 7: hỗ trợ phân tích sách; Admin quyết định kiểm duyệt |
| Cloudinary | Mốc 4: lưu/phân phối ảnh và video; SQL giữ URL và public_id |

## 3. Mô hình kết nối

| Nguồn | Đích | Cách kết nối | Mục đích |
|---|---|---|---|
| Frontend | API | HTTP/JSON | Truy vấn dữ liệu và gửi thao tác |
| Frontend | Socket.IO trên API | Kết nối thời gian thực | Nhận cập nhật |
| API | SQL Server | Thư viện `mssql` | Đọc/ghi dữ liệu theo nghiệp vụ |
| API | Redis Streams | Redis client | Đưa yêu cầu bất đồng bộ vào hàng đợi |
| API | Redis | express-session / connect-redis | Lưu, gia hạn và hủy session đăng nhập |
| API | Cloudinary | HTTPS REST, native fetch/FormData | Upload/destroy tệp, bí mật chỉ ở server |
| API | Redis | Ledger vé media + Lua claim | Gắn media đúng chủ và cleanup sau lỗi |
| Worker | Redis Streams | Consumer group | Nhận và xác nhận sự kiện |
| Worker | SQL Server | Giao dịch SQL | Ghi nhận kết quả xử lý |
| Worker | Redis | Khóa theo phiên | Phối hợp xử lý đồng thời |

Frontend không truy cập trực tiếp SQL Server hoặc Redis.

## 4. Phân lớp Backend

Luồng HTTP nghiệp vụ dự kiến:

`Route → Middleware → Controller → Service → Model → SQL Server`

Luồng xử lý sự kiện:

`Redis Streams → Consumer → Processor → Service/Model → SQL Server`

- Controller không chứa toàn bộ nghiệp vụ.
- Model không phụ thuộc đối tượng HTTP request/response.
- Processor không tự quyết định quy tắc khác với service.
- API và worker dùng chung quy tắc nghiệp vụ khi cần.

## 5. Nhất quán dữ liệu

- Redis lock hỗ trợ phối hợp, không thay thế giao dịch SQL.
- Worker đọc lại dữ liệu phiên sau khi lấy quyền xử lý.
- Các thay đổi liên quan được ghi trong cùng giao dịch SQL.
- Cập nhật phiên đối chiếu `row_version` để phát hiện xung đột.
- Ràng buộc UNIQUE bảo vệ mã yêu cầu và các quan hệ cần duy nhất.
- Chỉ xác nhận xử lý sự kiện sau khi kết quả đã được ghi nhận.
- Yêu cầu được xử lý lại phải an toàn và không tạo dữ liệu trùng.

Ghi SQL và phát thông báo là hai thao tác khác nhau.
Cơ chế bảo đảm phát lại thông báo khi tiến trình dừng sau COMMIT
cần được quyết định trước khi triển khai luồng đấu giá hoàn chỉnh.

## 6. Cập nhật thời gian thực

Trong Mốc 2:
- Socket.IO chạy cùng tiến trình API.
- Client nhận `system:hello`.
- Kết quả probe được giao diện lấy qua HTTP API.

Trong các mốc nghiệp vụ:
- Chỉ phát thay đổi sau khi SQL COMMIT.
- Khi kết nối lại, client lấy trạng thái mới nhất từ API.
- Room theo phiên/giao dịch phải được kiểm tra quyền.
- Cơ chế chuyển thông báo từ worker sang API chưa được triển khai.

## 7. Cấu hình phát triển mặc định

| Dịch vụ | Địa chỉ/cổng |
|---|---|
| React | `127.0.0.1:5173` |
| API và Socket.IO | `127.0.0.1:5000` |
| SQL Server trên máy chủ | `127.0.0.1:14330` |
| Redis trên máy chủ | `127.0.0.1:63790` |

SQL Server và Redis chạy trong Docker.
API, worker và React chạy bằng các terminal riêng.

Cấu hình riêng nằm trong `.env` ở gốc và `frontend/.env`.
Chi tiết khởi động được trình bày tại `../README.md`.

## 8. Phạm vi hiện tại

Đã có bộ khung:
- Kiểm tra liveness và readiness.
- Kết nối SQL Server và Redis.
- Worker nhận sự kiện kiểm tra.
- Socket.IO kiểm tra kết nối.
- Script khởi tạo schema 19 bảng.

Chưa triển khai:
- Đặt giá và kết thúc phiên (Mốc 5).
- Giao dịch, trò chuyện, đánh giá và khiếu nại.
- Phân tích sách bằng Gemini API.

Trong bản cập nhật Mốc 3 đã bổ sung:
- Đăng ký, đăng nhập, đăng xuất và thông tin tài khoản.
- Session Redis, cookie HttpOnly và CSRF.
- Middleware xác thực và kiểm tra quyền Admin ở backend.
- Script tạo Admin, kiểm thử auth và smoke tài khoản.

Luồng tài khoản chạy trực tiếp qua HTTP và SQL Server; không đưa đăng nhập vào Redis Streams.
Socket.IO hiện chỉ phát lời chào hạ tầng công khai, chưa có room hoặc sự kiện nghiệp vụ riêng tư.
Khi thêm các sự kiện nghiệp vụ, phải gắn xác thực session và kiểm tra quyền tại ranh giới Socket.IO.


Mốc 4 đã bổ sung:
- React: danh mục, bài của tôi, đăng sách, bổ sung media, kiểm duyệt và đặt lịch.
- API: model SQL giao dịch, policy trạng thái, service claim media, router phân quyền.
- Migration 002: hai cột metadata Cloudinary nullable, tổng 144 cột; 001 không đổi.
- Native Cloudinary REST, vé Redis và cleanup sau lỗi. Không thêm dependency.
- Public projection ẩn giá kết thúc sớm; optimistic version được kiểm tra sau khóa SQL.
- Manual review hoạt động độc lập AI. AI chưa gọi, không ghi phân tích giả.

Upload ngoài transaction SQL; ledger và kiểm tra SQL reference giảm orphan, nhưng không là distributed transaction.
Claim chưa rõ kết quả commit cần đối soát thủ công; mất Redis có thể để lại orphan.
Chi tiết phục hồi và giới hạn: ADR-012 và README mục 11.
