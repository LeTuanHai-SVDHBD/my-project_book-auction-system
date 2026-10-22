<!-- Mục đích: Giới thiệu dự án và hướng dẫn cài đặt, chạy, kiểm tra trên máy phát triển. -->

# my-project_book-auction-system

**BookAuction — Hệ thống đấu giá sách trực tuyến · Nhóm 15**

Dự án ứng dụng kiến trúc hướng sự kiện để xử lý yêu cầu đặt giá đồng thời và đồng bộ diễn biến phiên đấu giá. Frontend sử dụng React, Backend sử dụng Express; SQL Server lưu trạng thái nghiệp vụ, Redis Streams chuyển yêu cầu đến worker và Socket.IO hỗ trợ cập nhật thời gian thực.

## 1. Phạm vi triển khai

| Thành phần | Hiện trạng |
|---|---|
| Môi trường phát triển | Chủ dự án xác nhận thiết lập thành công |
| Hạ tầng | Có API, worker riêng, SQL Server, Redis và màn hình kiểm tra |
| Cơ sở dữ liệu | Có script khởi tạo 19 bảng, 142 trường theo thiết kế |
| Luồng kiểm tra | Có probe qua Redis Streams → worker → SQL Server |
| Chức năng nghiệp vụ | Theo dõi trong [tiến độ triển khai](docs/tasks.md) |

Probe hiện tại chỉ kiểm tra kết nối bằng truy vấn SQL đọc. Socket.IO nhận sự kiện `system:hello`; kết quả probe được lấy qua HTTP API. Xác thực, đặt giá và xử lý người thắng chưa được triển khai trong mã hiện tại.

## 2. Công cụ và quản lý thư viện

- Windows 11 x64, VS Code và PowerShell.
- Node.js **24** kèm npm, theo `engines` của dự án.
- Docker Desktop đang chạy Linux containers.
- SSMS là tùy chọn để xem database.

```powershell
node --version
npm.cmd --version
docker --version
docker compose version
docker info
```

Dự án dùng npm workspaces và `package-lock.json` để quản lý phiên bản thư viện. Dùng `npm.cmd ci` để cài theo lockfile; ứng dụng không cần Python virtual environment. `.env` chứa cấu hình riêng, không phải môi trường ảo.

## 3. Mở thư mục dự án

Trong VS Code, chọn **File → Open Folder** và mở thư mục `my-project_book-auction-system` đã có trên máy.

Thư mục gốc phải chứa `package.json`, `package-lock.json`, `compose.yaml`, `backend/` và `frontend/`. Các lệnh bên dưới chạy tại thư mục này, trừ khi có ghi chú khác.

## 4. Cài thư viện và tạo cấu hình

```powershell
npm.cmd ci
npm.cmd run setup
```

Setup tạo `.env` ở gốc và `frontend/.env` nếu chưa tồn tại. Mật khẩu SQL và token chẩn đoán được sinh tự động; cấu hình đang có được giữ nguyên.

| Biến | Giá trị mặc định |
|---|---|
| `API_HOST` / `API_PORT` | `127.0.0.1` / `5000` |
| `DB_SERVER` / `DB_PORT` | `127.0.0.1` / `14330` |
| `DB_DATABASE` / `DB_USER` | `BookAuctionDB` / `sa` |
| `REDIS_URL` | `redis://127.0.0.1:63790` |
| `DB_PASSWORD` / `DEV_PROBE_TOKEN` | Sinh khi tạo `.env` mới |
| `SQLSERVER_VOLUME_NAME` / `REDIS_VOLUME_NAME` | Tên volume cho máy cài mới, lấy từ `.env.example` |

Máy đang dùng Docker project cũ cần đọc [hướng dẫn chuyển đổi](docs/docker-migration.md) trước khi chạy lại dịch vụ. Không thay `.env` đang có bằng file mẫu vì có thể đổi mật khẩu hoặc liên kết volume.

Chỉ commit `.env.example`. Không đưa bí mật vào Git hoặc biến `VITE_*`. Tài khoản `sa` và chế độ tin cậy chứng chỉ hiện phục vụ phát triển cục bộ.

## 5. Khởi động SQL Server và Redis

Mở Docker Desktop, sau đó chạy:

```powershell
docker compose up -d
docker compose ps
```

Compose project có tên `my-project_book-auction-system`. Container được Compose đặt tên theo project, dịch vụ và số thứ tự; không cấu hình `container_name` cố định.

| Dịch vụ | Cổng container | Cổng trên Windows |
|---|---|---|
| SQL Server 2022 Developer | `1433` | `127.0.0.1:14330` |
| Redis 8 | `6379` | `127.0.0.1:63790` |

Chờ cả hai dịch vụ báo **healthy**. Xem log khi cần:

```powershell
docker compose logs --tail 50 sqlserver
docker compose logs --tail 50 redis
```

Dữ liệu được giữ bằng named volume. Redis bật AOF với `appendfsync everysec`; khả năng phục hồi cần được đánh giá thêm khi triển khai nghiệp vụ.

## 6. Khởi tạo database

Sau khi dịch vụ healthy:

```powershell
npm.cmd run db:init
```

Script tạo `BookAuctionDB` nếu chưa tồn tại và chạy `backend/migrations/001_schema.sql` khi chưa có bảng đích. Nếu nhận diện đủ 19 bảng/142 trường, script giữ nguyên và bỏ qua DDL; nếu cấu trúc chỉ khớp một phần, script dừng để kiểm tra.

Đếm bảng/cột chỉ nhận diện cấu trúc cơ bản, chưa xác minh đầy đủ kiểu, chỉ mục hoặc ràng buộc trong database đang tồn tại. Script chưa tạo dữ liệu mẫu hoặc tài khoản Admin.

Kết nối bằng SSMS:

| Trường | Giá trị |
|---|---|
| Server name | `127.0.0.1,14330` — dùng dấu phẩy |
| Authentication | SQL Server Authentication |
| Login | `sa` |
| Password | `DB_PASSWORD` trong `.env` |
| Trust server certificate | Bật trong môi trường cục bộ này |

Nếu dùng SQL Server đã cài sẵn, chỉ chạy Redis bằng `docker compose up -d redis` và điều chỉnh cấu hình database. SQL Server đó cần bật TCP và SQL Authentication.

## 7. Chạy API, worker và Frontend

Mở ba terminal tại thư mục gốc:

| Terminal | Lệnh | Kết quả |
|---|---|---|
| API | `npm.cmd run dev:api` | Log `API đã chạy`, cổng 5000 |
| Worker | `npm.cmd run dev:worker` | Log `Worker kiểm tra hạ tầng đã chạy` |
| Frontend | `npm.cmd run dev:web` | React tại `http://127.0.0.1:5173` |

Giao diện cần có năm trạng thái sẵn sàng: API, SQL Server, Redis, Event Worker và Socket.IO. Ô SQL hiển thị 19/19 bảng và 142/142 trường.

API có thể mở cổng khi SQL/Redis chưa sẵn sàng. Liveness HTTP 200 xác nhận tiến trình đang hoạt động; readiness mới kiểm tra các dịch vụ phụ thuộc.

## 8. Gửi sự kiện kiểm tra

1. Mở `.env` ở gốc và sao chép giá trị `DEV_PROBE_TOKEN`.
2. Dán vào ô **Khóa kiểm tra cục bộ** trên giao diện.
3. Chọn **Gửi sự kiện kiểm tra**.
4. Kiểm tra chuyển từ `queued` sang `completed` và hiện tên worker.

API chẩn đoán chỉ mở trong development và yêu cầu token. Token này không phải cơ chế đăng nhập người dùng.

Luồng dùng stream `bookauction:infra:requests`, consumer group `infrastructure-workers` và kết nối Redis riêng cho lệnh BLOCK. Kết quả có TTL 10 phút; heartbeat hết hạn sau 10 giây; pending có thể được nhận lại sau tối thiểu 30 giây idle.

## 9. Kiểm tra hệ thống

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build
npm.cmd run smoke
```

| Lệnh | Phạm vi |
|---|---|
| `check` | Cú pháp JavaScript máy chủ và script |
| `test` | Kiểm thử với dịch vụ giả lập |
| `build` | Build Frontend vào `frontend/dist/` |
| `smoke` | Kiểm tra API, SQL, Redis, worker, Socket.IO và probe bằng dịch vụ thật |

Giữ API, worker, SQL Server và Redis hoạt động khi chạy smoke. Xem [kết quả kiểm tra](VALIDATION.md); bằng chứng của nhóm lưu trong `academic/evidence/`.

## 10. Tài liệu và cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| [AGENTS.md](AGENTS.md) | Quy tắc dành cho AI Agent |
| [docs/architecture.md](docs/architecture.md) | Kiến trúc và kết nối |
| [docs/flows.md](docs/flows.md) | Luồng nghiệp vụ |
| [docs/file-map.md](docs/file-map.md) | Trách nhiệm từng thư mục/file |
| [docs/decisions.md](docs/decisions.md) | Quyết định kỹ thuật |
| [docs/tasks.md](docs/tasks.md) | Tiến độ triển khai |
| [docs/docker-migration.md](docs/docker-migration.md) | Chuyển cấu hình Docker đang có |
| [academic/README.md](academic/README.md) | Báo cáo, slide, mã UML và bằng chứng |

## 11. Xử lý lỗi thường gặp

| Hiện tượng | Hướng xử lý |
|---|---|
| `npm.ps1 cannot be loaded` | Dùng `npm.cmd` trong PowerShell |
| Docker không kết nối được | Mở Docker Desktop, chờ Engine và kiểm tra Linux containers |
| Cổng SQL/Redis bị chiếm sau đổi tên | Dừng project cũ theo hướng dẫn chuyển đổi |
| SQL báo login failed hoặc dữ liệu trống | Kiểm tra mật khẩu và volume; đổi `.env` không tự đổi mật khẩu SQL đã lưu |
| SQL kết nối nhưng chưa có bảng | Chạy `npm.cmd run db:init` vào đúng database |
| Redis chưa sẵn sàng | Kiểm tra Docker/log; khởi động lại API/worker nếu kết nối đã ngừng thử lại |
| Worker chưa sẵn sàng | Kiểm tra terminal worker và database |
| Token chẩn đoán sai | Lấy giá trị trong `.env` ở gốc, không lấy từ `frontend/.env` |
| Probe vẫn queued | Kiểm tra worker và SQL; pending có thể cần hơn 30 giây để nhận lại |
| CORS error | Mở đúng địa chỉ Frontend và kiểm tra `CLIENT_ORIGINS` |

## 12. Dừng và chạy lại

Nhấn **Ctrl+C** ở các terminal ứng dụng. Dừng dịch vụ và giữ dữ liệu:

```powershell
docker compose stop
```

Lần sau chạy `docker compose start`, chờ healthy rồi mở lại ba tiến trình ứng dụng. Không cần tạo lại `.env` hoặc database mỗi lần chạy.

## 13. Tài liệu công nghệ

- [Node.js](https://nodejs.org/en/download)
- [Vite](https://vite.dev/guide/)
- [Express](https://expressjs.com/en/starter/installing.html)
- [SQL Server Docker](https://learn.microsoft.com/en-us/sql/linux/quickstart-install-connect-docker?view=sql-server-ver16)
- [node-mssql](https://github.com/tediousjs/node-mssql)
- [Redis Streams](https://redis.io/docs/latest/develop/use-cases/streaming/nodejs/)
- [Socket.IO](https://socket.io/docs/v4/server-initialization/)
