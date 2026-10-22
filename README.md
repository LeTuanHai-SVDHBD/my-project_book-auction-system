<!-- Mục đích: Giới thiệu dự án và hướng dẫn khởi động môi trường phát triển. -->

# Hệ thống đấu giá sách trực tuyến

Dự án `my-project_book-auction-system` của Nhóm 15 sử dụng React, Express,
SQL Server, Redis Streams và Socket.IO.

Ứng dụng kiến trúc hướng sự kiện để xây dựng các chức năng đấu giá sách,
hướng tới xử lý tranh chấp đồng thời và đồng bộ thời gian thực.

## 1. Phạm vi mã nguồn hiện tại

- Hạ tầng: API, SQL Server, Redis, worker riêng, Socket.IO và probe qua Redis Streams.
- Tài khoản: đăng ký, đăng nhập, đăng xuất và lấy thông tin tài khoản.
- Xác thực: session Redis, cookie HttpOnly, CSRF và Argon2id.
- Phân quyền: người dùng / Admin; script tạo Admin và kiểm thử API bảo vệ.

Đăng sách, phân tích AI, kích hoạt phiên, đặt giá và kết thúc phiên chưa được triển khai.
Màn hình kiểm tra hệ thống vẫn có trong thanh điều hướng.

## 2. Môi trường

- Windows 11, VS Code và Docker Desktop chạy Linux containers.
- Node.js 24.x và npm.
- SQL Server 2022 Developer và Redis chạy theo `compose.yaml`.
- SSMS tùy chọn để xem dữ liệu.

Kiểm tra:

```powershell
node --version
npm.cmd --version
docker compose version
```

## 3. Mở thư mục dự án

Trong VS Code, chọn **File → Open Folder** và mở `my-project_book-auction-system`.
Đúng thư mục gốc phải có `package.json`, `package-lock.json`, `compose.yaml`,
`backend` và `frontend`.

Các lệnh dưới đây chạy tại thư mục gốc.

## 4. Cài mới môi trường

```powershell
npm.cmd ci
npm.cmd run setup
docker compose up -d
docker compose ps
```

Chờ SQL Server và Redis đều **healthy**, rồi chạy:

```powershell
npm.cmd run db:init
npm.cmd run setup:auth
npm.cmd run admin:create
```

`setup` tạo cấu hình riêng trên máy; không ghi đè `.env` đã có.
`db:init` tạo database/schema khi chưa có và giữ nguyên database đã nhận diện đủ 19 bảng/142 trường.
`admin:create` yêu cầu nhập tên, email và mật khẩu kín trong terminal.

**Máy đã hoàn thành phần môi trường: cập nhật file, chạy `npm.cmd ci`,
`npm.cmd run setup:auth` và `npm.cmd run admin:create`.
Không cần tạo lại database.

## 5. Khởi động

Mở ba terminal riêng:

| Terminal | Lệnh |
|---|---|
| API | `npm.cmd run dev:api` |
| Worker | `npm.cmd run dev:worker` |
| React | `npm.cmd run dev:web` |

Mở <http://127.0.0.1:5173>. Dùng `127.0.0.1` nhất quán cho React và API khi sử dụng cookie.

| Thành phần | Địa chỉ mặc định |
|---|---|
| React | `127.0.0.1:5173` |
| API / Socket.IO | `127.0.0.1:5000` |
| SQL Server | `127.0.0.1:14330` |
| Redis | `127.0.0.1:63790` |

Trong tab **Kiểm tra hệ thống**, dán giá trị `DEV_PROBE_TOKEN` từ `.env`
vào ô khóa kiểm tra để gửi probe. Token probe phục vụ chẩn đoán, độc lập với tài khoản đăng nhập.

## 6. Kiểm tra

Giữ các dịch vụ và ứng dụng đang chạy:

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build
npm.cmd run smoke
npm.cmd run smoke:auth
```

- `test` chạy HTTP test với phụ thuộc giả và Argon2 thật.
  Bài Redis thật mặc định SKIP, bật bằng `AUTH_TEST_REDIS_URL`.
- `smoke` kiểm tra hạ tầng thật, worker và probe.
- `smoke:auth` kiểm tra đăng ký, đăng nhập, cookie, CSRF, phân quyền và thu hồi phiên;
  tạo rồi dọn tài khoản thử riêng.
- Kiểm tra Admin thủ công theo hướng dẫn Mốc 3.

Không đưa `.env`, mật khẩu, session secret hoặc API key vào Git.
Không xóa volume để xử lý lỗi cấu hình.

## 7. Tài liệu

- [Kiến trúc](docs/architecture.md)
- [Quyết định kỹ thuật](docs/decisions.md)
- [Luồng xử lý](docs/flows.md)
- [Vai trò file](docs/file-map.md)
- [Tiến độ](docs/tasks.md)
- [Kết quả kiểm tra](VALIDATION.md)
