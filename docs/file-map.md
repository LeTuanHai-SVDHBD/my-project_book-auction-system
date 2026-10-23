<!-- Mục đích: Tra cứu vị trí, trách nhiệm và trạng thái của các thành phần mã nguồn. -->

# Bản đồ mã nguồn

## 1. Nguyên tắc tổ chức

- Một repository chứa cả Backend và Frontend.
- Quản lý dependency bằng npm workspaces.
- Cài thư viện tại thư mục gốc bằng `npm.cmd ci`.
- Commit `package-lock.json` ở gốc.
- API và worker là hai tiến trình dùng chung Backend.
- Tài liệu thiết kế nằm trong `docs/`.
- Giữ tên thư mục nhất quán; không tạo thêm lớp khi chưa cần.

## 2. Thư mục gốc

| Đường dẫn | Trách nhiệm |
|---|---|
| `AGENTS.md` | Quy tắc dành cho AI Agent |
| `README.md` | Giới thiệu và hướng dẫn chạy dự án |
| `VALIDATION.md` | Kết quả kiểm tra và giới hạn xác minh |
| `package.json` | Khai báo workspaces và lệnh dùng chung |
| `package-lock.json` | Khóa phiên bản dependency |
| `compose.yaml` | Khởi động SQL Server và Redis |
| `.env.example` | Mẫu cấu hình Backend và Docker |
| `.env` | Cấu hình riêng trên máy; không commit |
| `.gitignore` | Loại cấu hình riêng và file sinh tự động khỏi Git |
| `backend/` | API, worker và truy cập dữ liệu |
| `frontend/` | Giao diện React |
| `scripts/` | Công cụ hỗ trợ toàn dự án |
| `docs/` | Tài liệu kiến trúc và tiến độ |

## 3. Backend

Các đường dẫn bên dưới nằm trong `backend/`.

| Đường dẫn | Trách nhiệm | Trạng thái |
|---|---|---|
| `package.json` | Dependency và lệnh Backend | Đã có |
| `schema-manifest.json` | Danh sách bảng và số lượng cấu trúc dự kiến | Đã có |
| `migrations/001_schema.sql` | DDL khởi tạo 19 bảng | Đã có |
| `scripts/initDatabase.js` | Tạo database và chạy DDL khi phù hợp | Đã có |
| `src/app.js` | Tạo Express app, gắn middleware và API hiện tại | Đã có |
| `src/server.js` | Khởi động HTTP, Socket.IO và kết nối dịch vụ | Đã có |
| `src/worker.js` | Khởi động worker và heartbeat | Đã có |
| `src/config/env.js` | Nạp cấu hình từ môi trường | Đã có |
| `src/config/parseConfig.js` | Kiểm tra và chuyển kiểu cấu hình | Đã có |
| `src/config/database.js` | Quản lý connection pool SQL Server | Đã có |
| `src/config/redis.js` | Tạo và quản lý Redis client | Đã có |
| `src/constants/infrastructure.js` | Hằng số luồng kiểm tra hạ tầng | Đã có |
| `src/controllers/health.controller.js` | Tổng hợp trạng thái dịch vụ | Đã có |
| `src/services/infrastructure.service.js` | Kiểm tra SQL, Redis và worker | Đã có |
| `src/events/eventPublisher.js` | Đưa probe vào Redis Streams | Đã có |
| `src/events/eventConsumer.js` | Đọc, nhận lại pending và xác nhận probe | Đã có |
| `src/processors/systemProbe.processor.js` | Xử lý sự kiện kiểm tra SQL | Đã có |
| `src/middlewares/errorHandler.js` | Chuẩn hóa lỗi HTTP | Đã có |
| `src/utils/logger.js` | Log có cấu trúc và che thông tin nhạy cảm | Đã có |
| `test/infrastructure.test.js` | Kiểm thử hạ tầng và API bằng giả lập | Đã có |
| `src/routes/` | Router nghiệp vụ | Đã có auth.routes.js, post.routes.js và media.routes.js |
| `src/models/` | Truy vấn dữ liệu nghiệp vụ | Đã có user.model.js và post.model.js |
| `src/concurrency/` | Khóa theo phiên và hỗ trợ xử lý đồng thời | Chờ triển khai |
| `src/jobs/` | Tác vụ kiểm tra hết hạn phiên | Chờ triển khai |
| `src/ai/` | Kết nối và kiểm tra kết quả phân tích AI | Chờ triển khai |

Khi thêm chức năng, tạo controller, service và model tương ứng.
Các file tài khoản đã có được liệt kê tại mục 9.

## 4. Frontend

Các đường dẫn bên dưới nằm trong `frontend/`.

| Đường dẫn | Trách nhiệm | Trạng thái |
|---|---|---|
| `package.json` | Dependency và lệnh Frontend | Đã có |
| `index.html` | Trang HTML khởi đầu | Đã có |
| `vite.config.js` | Cấu hình Vite và cổng phát triển | Đã có |
| `.env.example` | Mẫu địa chỉ API | Đã có |
| `.env` | Cấu hình riêng; không commit | Tạo bằng setup |
| `src/main.jsx` | Gắn React vào trang HTML | Đã có |
| `src/App.jsx` | Điều hướng tài khoản, bài đăng, kiểm duyệt, danh mục và hạ tầng | Đã có |
| `src/style.css` | Giao diện tài khoản và kiểm tra hệ thống | Đã có |
| `src/pages/` | Trang nghiệp vụ | Tạo khi cần |
| `src/components/` | Màn hình tài khoản và hạ tầng | Đã có |
| `src/services/` | Hàm gọi HTTP API tài khoản | Đã có |
| `src/hooks/` | React hook dùng lại | Tạo khi cần |

Không đưa truy vấn SQL, mật khẩu database hoặc Redis client vào Frontend.

## 5. Script dùng chung

| Đường dẫn | Trách nhiệm |
|---|---|
| `scripts/setup.mjs` | Tạo cấu hình riêng nếu chưa tồn tại |
| `scripts/check.mjs` | Kiểm tra cú pháp JavaScript phía máy chủ |
| `scripts/smoke.mjs` | Kiểm tra tích hợp với dịch vụ thật |

Script chỉ phục vụ Backend nằm trong `backend/scripts/`.
Script điều phối nhiều thành phần nằm trong `scripts/` ở gốc.

## 6. Tài liệu

| Đường dẫn | Trách nhiệm |
|---|---|
| `docs/architecture.md` | Kiến trúc và mô hình kết nối |
| `docs/flows.md` | Luồng nghiệp vụ và quy tắc xử lý |
| `docs/file-map.md` | Bản đồ mã nguồn |
| `docs/decisions.md` | Quyết định kỹ thuật và nội dung chưa chốt |
| `docs/tasks.md` | Công việc, tiến độ và điều kiện nghiệm thu |

## 7. File sinh tự động

Không chỉnh sửa thủ công:
- `node_modules/`: thư viện cài bằng npm.
- `frontend/dist/`: kết quả build Frontend.
- `package-lock.json`: cập nhật thông qua npm khi thay đổi dependency.

Thư mục rỗng cần lưu trong Git được giữ bằng `.gitkeep`.

## 8. Quy ước chú thích

Mỗi file mã nguồn viết tay có comment đầu file mô tả trách nhiệm chính.
Các hàm chỉ cần comment thêm khi có quy tắc hoặc lý do khó thấy từ mã.

Không chèn comment vào `package.json`, `package-lock.json`
hoặc `schema-manifest.json` vì các file này sử dụng JSON chuẩn.

## 9. Các file bổ sung cho tài khoản

| File | Trách nhiệm |
|---|---|
| `backend/src/config/auth.js` | Kiểm tra secret, cookie và thời hạn session |
| `backend/src/models/user.model.js` | Đọc/ghi NguoiDung bằng tham số SQL |
| `backend/src/services/password.service.js` | Băm và kiểm tra Argon2id |
| `backend/src/services/auth.service.js` | Kiểm tra đầu vào, đăng ký và đăng nhập |
| `backend/src/services/authRateLimit.service.js` | Bộ đếm giới hạn thử dùng Redis Lua |
| `backend/src/middlewares/auth.js` | CSRF, xác thực và phân quyền HTTP |
| `backend/src/controllers/auth.controller.js` | Phản hồi HTTP và vòng đời session |
| `backend/src/routes/auth.routes.js` | Endpoint tài khoản và cấu hình middleware session |
| `backend/scripts/createAdmin.js` | Tạo Admin qua terminal, nhập mật khẩu kín |
| `frontend/src/components/AccountPanel.jsx` | Form và thông tin tài khoản |
| `frontend/src/components/InfrastructurePanel.jsx` | Màn hình hạ tầng được tách từ App cũ |
| `frontend/src/services/authApi.js` | Fetch kèm cookie và CSRF trong bộ nhớ |
| `scripts/setupAuth.mjs` | Bổ sung cấu hình auth còn thiếu |
| `scripts/smokeAuth.mjs` | Kiểm tra API/SQL/Redis thật và dọn tài khoản thử |
| `backend/test/auth.test.js` | HTTP auth, model/store giả và Argon2 thật |
| `backend/test/authRedis.test.js` | Kiểm tra Redis thật theo opt-in |
| `backend/test/setupAuth.test.js` | Kiểm tra giữ nguyên cấu hình và chạy lại an toàn |


## 10. Các file Mốc 4

| File | Trách nhiệm |
|---|---|
| `backend/migrations/002_cloudinary_metadata.sql` | Thêm hai cột public_id nullable và index, không xóa dữ liệu |
| `backend/scripts/migrateDatabase.js` | Chạy migration hiện có, có thể chạy lại |
| `backend/src/config/media.js` | Cấu hình bí mật Cloudinary và projection giới hạn công khai |
| `backend/src/middlewares/session.js` | Factory session dùng chung auth/posts/media |
| `backend/src/services/cloudinary.service.js` | Native REST upload/destroy, kiểm tra magic và phản hồi provider |
| `backend/src/services/mediaLedger.service.js` | Vé Redis, claim/release nguyên tử, cleanup kiểm tra SQL reference |
| `backend/src/services/postValidation.js` | Kiểm tra payload, tiền dạng chuỗi, version và lịch ISO |
| `backend/src/services/postPolicy.js` | Quy tắc trạng thái, version và điều kiện đăng lại |
| `backend/src/services/post.service.js` | Điều phối claim, SQL commit/rollback và acknowledgement |
| `backend/src/models/post.model.js` | SQL tham số hóa; tạo/duyệt/bổ sung/kích hoạt/đăng lại trong transaction |
| `backend/src/controllers/post.controller.js` | HTTP, phân trang và projection công khai không chứa giá ẩn |
| `backend/src/routes/post.routes.js` | Quyền công khai/chủ sách/Admin và CSRF |
| `backend/src/controllers/media.controller.js` | HTTP upload/discard, kiểm tra bytes và trả vé |
| `backend/src/routes/media.routes.js` | Raw upload giới hạn bộ nhớ sau xác thực và CSRF |
| `frontend/src/components/PostForm.jsx` | Form sách/bài, upload trước, vé đính kèm, bỏ tệp chưa dùng |
| `frontend/src/components/PostsPanel.jsx` | Danh sách/chi tiết, kiểm duyệt, bổ sung và lịch kích hoạt |
| `frontend/src/services/postApi.js` | HTTP M4 dùng chung session/CSRF trong bộ nhớ |
| `scripts/setupMedia.mjs` | Chỉ bổ sung cấu hình mẫu còn thiếu, không đổi giá trị đã có |
| `scripts/smokeM4.mjs` | Smoke thật với dữ liệu UUID, cleanup SQL/Cloudinary riêng |
| `backend/test/posts.test.js` | Hợp đồng, policy, privacy, HTTP và provider giả |
| `backend/test/mediaRedis.test.js` | Redis thật theo opt-in: claim đồng thời, ownership, cleanup và commit chưa rõ |


Bản sửa 23/10/2026:

| File | Trách nhiệm |
|---|---|
| `backend/src/utils/rowVersion.js` | Mã hóa bytes SQL thành hex 16 ký tự, giữ byte 0 đầu, dùng chung cho model |
| `backend/test/rowVersion.test.js` | Hồi quy model/HTTP dùng driver giả trả binary, giữ kiểm tra xung đột |

`smokeM4.mjs` kiểm tra token phiên bản ngay sau khi đọc chi tiết và in thêm thông báo lỗi API khi sai HTTP status.
