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

**Máy đã hoàn thành phần môi trường:** cập nhật file, chạy `npm.cmd ci`,
`npm.cmd run setup:auth` và `npm.cmd run admin:create`.
Nếu Admin đã tồn tại, script giữ nguyên tài khoản và mật khẩu. Không cần tạo lại database.

Máy cài mới lấy hai tên volume chuẩn từ `.env.example` khi chạy `setup`:
`my-project_book-auction-system_sqlserver_data` và `my-project_book-auction-system_redis_data`.
Máy đang có dữ liệu giữ nguyên `.env` và volume đang dùng. Khi cần chuyển Docker project,
làm theo [hướng dẫn chuyển đổi](docs/docker-migration.md); kiểm tra tên volume trước khi đổi cấu hình.

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

## 6. Kiểm tra tài khoản trên giao diện

### 6.1. Người dùng

1. Chọn **Tài khoản → Đăng ký**.
2. Nhập họ tên, email và mật khẩu từ 12 đến 128 ký tự.
3. Bấm **Tạo tài khoản**; sau thông báo thành công, đăng nhập bằng tài khoản vừa tạo.
4. Kiểm tra họ tên, email và vai trò **Người dùng**.
5. Nhấn **F5** để kiểm tra giữ đăng nhập khi phiên còn hạn.
6. Bấm **Đăng xuất** để quay về form đăng nhập.

Đăng ký lại cùng email phải bị từ chối. Mật khẩu sai phải báo
“Email hoặc mật khẩu không đúng”. API đăng ký chỉ tạo vai trò `nguoi_dung`;
không cho client tự gửi vai trò Admin.

### 6.2. Admin

1. Tạo Admin bằng `npm.cmd run admin:create` nếu chưa có tài khoản.
2. Nhập tên, email và mật khẩu hai lần theo lời nhắc trong terminal.
   Khi gõ mật khẩu không thấy ký tự là bình thường; nhập xong nhấn Enter.
3. Đăng nhập bằng tài khoản Admin, kiểm tra vai trò **Quản trị viên**.
4. Bấm **Kiểm tra quyền quản trị**; cần nhận **Bạn có quyền quản trị.**

Nếu email đã là Admin, script giữ nguyên mật khẩu. Nếu email thuộc người dùng thường,
chọn email Admin khác; script không tự nâng quyền tài khoản đó.

Đăng nhập Admin và kiểm tra quyền là hai bước riêng.
Nút kiểm tra quyền gọi backend; đây chưa phải màn hình quản lý bài đăng hay kiểm duyệt sách.

## 7. Kiểm tra bằng lệnh

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
- Kiểm tra Admin thủ công theo mục 6.2.

`smoke:auth` chỉ tạo và dọn tài khoản thử riêng của lần chạy. Nếu dọn thất bại,
script báo email thử cần kiểm tra và trả exit code khác 0; không đánh dấu PASS.

Muốn bật thêm bài kiểm thử Redis thật trong PowerShell:

```powershell
$env:AUTH_TEST_REDIS_URL = "redis://127.0.0.1:63790"
npm.cmd test
Remove-Item Env:AUTH_TEST_REDIS_URL
```

Thay URL cho khớp Redis của máy nếu đã đổi cổng. Bài kiểm thử dùng prefix UUID riêng
và tự dọn khóa của nó; không xóa toàn bộ Redis.

## 8. Cấu hình session và giới hạn thử

| Mục | Giá trị / hành vi |
|---|---|
| `SESSION_SECRET` | Khóa ký cookie tự sinh trên máy; API yêu cầu ít nhất 32 ký tự |
| `SESSION_IDLE_SECONDS` | Mặc định `7200`, tương đương 2 giờ không hoạt động |
| Cookie | `bookauction.sid`, HttpOnly, SameSite=Lax; Secure khi production |
| Session | Lưu trong Redis, gia hạn khi có request dùng session; đăng xuất hủy session |
| Mật khẩu đăng ký | Từ 12 đến 128 ký tự, lưu hash Argon2id trong SQL Server |
| CSRF | Token gắn với session; React giữ trong bộ nhớ và gửi qua `x-csrf-token` |
| Giữ đăng nhập | Dùng cookie; không lưu thông tin xác thực trong Local Storage/Session Storage |

`setup:auth` chỉ bổ sung cấu hình session còn thiếu và giữ nguyên các giá trị đang có.
Không tự thay secret thật trong `.env`. Nếu secret vẫn là dòng mẫu `CHANGE_ME...`,
xóa riêng dòng mẫu đó rồi chạy lại `npm.cmd run setup:auth` và khởi động lại API.

| Hoạt động | Giới hạn mặc định | Cửa sổ |
|---|---|---|
| Đăng nhập theo email | 10 lần thử | 15 phút |
| Đăng nhập theo IP | 50 lần thử | 15 phút |
| Đăng ký theo IP | 10 lần thử | 15 phút |
| Cấp CSRF theo IP | 60 lần | 1 phút |

Bộ đếm tính tổng lần thử, kể cả lần thành công. Quá giới hạn trả HTTP 429 và header
`Retry-After`; chờ thời gian đó rồi thử lại. Khi Redis lỗi, API không bỏ qua kiểm tra
hoặc tự chuyển sang lưu session trong RAM.

Nếu gặp lỗi CSRF do hết phiên hoặc thao tác ở tab khác, tải lại trang rồi thử lại.
Với cấu hình mặc định, dùng `127.0.0.1` cho cả React và API để cookie hoạt động cùng site.
Ở production, cookie Secure yêu cầu HTTPS; cấu hình hiện tại phục vụ phát triển cục bộ.

## 9. API tài khoản

| Phương thức | Đường dẫn | Điều kiện / kết quả |
|---|---|---|
| GET | `/api/auth/csrf` | Cấp token CSRF gắn với session |
| POST | `/api/auth/register` | CSRF; tạo tài khoản `nguoi_dung`, HTTP 201 |
| POST | `/api/auth/login` | CSRF; đăng nhập, đổi session ID và CSRF, HTTP 200 |
| POST | `/api/auth/logout` | CSRF; hủy session, HTTP 204 |
| GET | `/api/auth/me` | Session hợp lệ; trả thông tin tài khoản |
| GET | `/api/auth/admin-check` | Session hợp lệ và vai trò `admin` |

Đăng ký nhận `ho_ten`, `email`, `mat_khau`; đăng nhập nhận `email`, `mat_khau`.
POST cần cookie và header `x-csrf-token`. React đã xử lý bằng `credentials: include`
trong `frontend/src/services/authApi.js`.

Thiếu đăng nhập trả 401; thiếu quyền hoặc CSRF sai trả 403; email đã có trả 409;
quá giới hạn trả 429. API đọc lại tài khoản và vai trò từ SQL cho các request cần đăng nhập,
không tin mã người dùng hoặc vai trò do client tự khai báo.

Không có API tự đăng ký Admin. `DEV_PROBE_TOKEN` chỉ bảo vệ chẩn đoán cục bộ,
không thay thế session đăng nhập.

Không đưa `.env`, mật khẩu, session secret hoặc API key vào Git.
Không xóa volume để xử lý lỗi cấu hình.

## 10. Tài liệu

- [Kiến trúc](docs/architecture.md)
- [Quyết định kỹ thuật](docs/decisions.md)
- [Luồng xử lý](docs/flows.md)
- [Vai trò file](docs/file-map.md)
- [Tiến độ](docs/tasks.md)
- [Kết quả kiểm tra](VALIDATION.md)
- [Chuyển Docker project và kiểm tra volume](docs/docker-migration.md)
