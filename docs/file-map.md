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
| `academic/` | Báo cáo, slide, mã UML và bằng chứng nghiệm thu |

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
| `src/routes/` | Router nghiệp vụ | Chờ triển khai |
| `src/models/` | Truy vấn dữ liệu nghiệp vụ; giữ chỗ bằng `.gitkeep` | Chờ triển khai |
| `src/concurrency/` | Khóa theo phiên và hỗ trợ xử lý đồng thời | Chờ triển khai |
| `src/jobs/` | Tác vụ kiểm tra hết hạn phiên | Chờ triển khai |
| `src/ai/` | Kết nối và kiểm tra kết quả phân tích AI | Chờ triển khai |

Khi thêm chức năng, tạo controller, service và model tương ứng.
Ví dụ tên file dự kiến: `auth.controller.js`, `auth.service.js`,
`user.model.js`. Các file này chưa có trong bộ khung.

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
| `src/App.jsx` | Màn hình kiểm tra hạ tầng | Đã có |
| `src/style.css` | Giao diện màn hình kiểm tra | Đã có |
| `src/pages/` | Trang nghiệp vụ | Tạo khi cần |
| `src/components/` | Component dùng lại | Tạo khi cần |
| `src/services/` | Hàm gọi HTTP API | Tạo khi cần |
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
| `docs/docker-migration.md` | Chuyển tên Docker project và giữ liên kết dữ liệu cũ |
| `academic/README.md` | Quy ước lưu báo cáo, slide, UML và bằng chứng |
| `academic/reports/` | DOCX và PDF báo cáo |
| `academic/slides/` | PPTX và PDF thuyết trình |
| `academic/uml/` | PlantUML và hình sơ đồ |
| `academic/evidence/` | Bằng chứng kiểm thử đã chọn |

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
