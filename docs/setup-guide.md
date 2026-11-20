<!-- Mục đích: Hướng dẫn chạy và cập nhật hệ thống trên Windows, bảo toàn cấu hình và dữ liệu. -->

# Cài đặt và vận hành phát triển

Hướng dẫn dành cho **nhánh feat/Hai**, Windows/PowerShell, Node.js **24.x** và Docker Desktop
(Linux containers, Compose V2). Các lệnh npm dùng hậu tố `.cmd` để tránh lỗi Execution Policy của PowerShell.
Chạy lệnh ở thư mục có `package.json` và `compose.yaml`, không chạy riêng trong `frontend`/`backend` trừ khi ghi rõ.

## 1. Cài mới

```powershell
git clone --branch feat/Hai https://github.com/LeTuanHai-SVDHBD/my-project_book-auction-system.git
cd my-project_book-auction-system
node --version
npm.cmd --version
docker compose version
npm.cmd ci
npm.cmd run setup
docker compose up -d
docker compose ps
```

Chờ cả `sqlserver` và `redis` healthy. `setup` tạo `.env` gốc và `frontend/.env` nếu chưa có,
sinh mật khẩu SQL, token probe và session secret; không in các bí mật đó ra tài liệu.
Không sao chép `.env` hoặc khóa thật vào Git/chat. Sau đó:

```powershell
npm.cmd run db:init
npm.cmd run admin:create
npm.cmd run dev:all
```

`db:init` tạo database nếu cần, chạy schema nền 001 và migration 002–010. Nó không phải lệnh reset dữ liệu;
schema có sẵn chỉ được nâng cấp nếu thuộc chữ ký đã biết. `admin:create` nhập tên/email/mật khẩu kín
(12–128 ký tự) trong terminal, không tự nâng quyền tài khoản thường có email trùng.
Người dùng thường đăng ký trên web; không có mật khẩu Admin mặc định trong source.

## 2. Địa chỉ và tiến trình

| Dịch vụ | Địa chỉ trên máy phát triển | Cách chạy |
|---|---|---|
| Web Vite | http://127.0.0.1:5173 | `dev:all` hoặc `dev:web` |
| HTTP API | http://127.0.0.1:5000 | `dev:all` hoặc `dev:api` |
| SQL Server | `127.0.0.1,14330` | Docker; cổng container 1433 |
| Redis | `redis://127.0.0.1:63790` | Docker; cổng container 6379 |
| Worker | Không có cổng HTTP riêng | `dev:all` hoặc `dev:worker`; Redis heartbeat |

Compose chỉ chạy SQL/Redis và chỉ bind cổng database vào loopback. API/web cũng mặc định loopback;
đây chưa phải cấu hình truy cập LAN hoặc triển khai production HTTPS.

`npm.cmd run dev:all` dùng concurrently, có ba nhãn API/WORKER/WEB, `--kill-others` dừng các tiến trình
còn lại nếu một tiến trình thoát. Ctrl+C để dừng; giữ Docker nếu còn dùng dữ liệu.
Chỉ chạy một bộ `dev:all`. Các lệnh riêng đã có: `dev:api`, `dev:worker`, `dev:web`.
Dùng cùng hostname `127.0.0.1` khi mở web/API để dễ kiểm tra cookie; client có chuẩn hóa hai tên loopback
`localhost`/`127.0.0.1`, nhưng không tự sửa origin/cấu hình mạng tùy ý.

## 3. Cấu hình gốc

Đối chiếu giá trị mẫu tại [../.env.example](../.env.example). File thật được ignore bởi Git.

| Biến | Mặc định / vai trò |
|---|---|
| `NODE_ENV` | `development`; endpoint probe chỉ bật ở chế độ này |
| `API_HOST`, `API_PORT` | `127.0.0.1`, `5000` |
| `CLIENT_ORIGINS` | Hai origin loopback cổng 5173, phân cách dấu phẩy; CORS cho cookie |
| `DB_SERVER`, `DB_PORT`, `DB_DATABASE`, `DB_USER` | `127.0.0.1`, `14330`, `BookAuctionDB`, `sa` |
| `DB_PASSWORD` | Setup sinh cho môi trường mới; phải khớp SQL đang dùng |
| `DB_ENCRYPT`, `DB_TRUST_SERVER_CERTIFICATE` | `false`, `true` cho SQL phát triển |
| `DB_TIMEOUT_MS` | `5000`; cho kết nối và request SQL |
| `REDIS_URL` | `redis://127.0.0.1:63790` |
| `DEV_PROBE_TOKEN` | Bí mật riêng cho công cụ hạ tầng; không thay đăng nhập |
| `SESSION_SECRET`, `SESSION_IDLE_SECONDS` | Secret ít nhất 32 ký tự; idle mặc định 7200 giây |
| `LOG_LEVEL` | `info` |
| `SQLSERVER_VOLUME_NAME`, `REDIS_VOLUME_NAME` | Chọn named volume; máy có dữ liệu dùng đúng tên đã inspect |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Ba giá trị Backend để upload media |
| `AI_ENABLED`, `GEMINI_API_KEY`, `GEMINI_MODEL` | Bật Gemini; khóa chỉ ở Backend |
| `AI_MIN_RARITY_SCORE`, `AI_MIN_CONDITION_SCORE` | Hai ngưỡng khuyến nghị tham khảo 1–100 (mặc định 70 mỗi nhóm); xem [cấu hình](ai-analysis.md#admin-quyết-định-ai-hỗ-trợ) |
| `GEMINI_FALLBACK_MODEL` | Tuỳ chọn: model Gemini tương thích dùng cho lượt thử lại khi model chính trả 503 |

Các biến giới hạn/thời gian chờ media và AI nằm ở [media-upload.md](media-upload.md) và
[ai-analysis.md](ai-analysis.md). Không đặt Cloudinary secret, Gemini key hoặc session secret trong `VITE_*`.
`frontend/.env` chỉ có `VITE_API_URL=http://127.0.0.1:5000`; đổi cổng API thì đổi cấu hình này và khởi động lại web.

### Bật Cloudinary và Gemini

```powershell
npm.cmd run setup:media
npm.cmd run setup:ai
```

Mở `.env` gốc, điền Cloudinary. Muốn AI hoạt động thì điền `GEMINI_API_KEY` và đặt `AI_ENABLED=true`.
Khởi động lại cả API/worker sau khi đổi cấu hình. Các script chỉ bổ sung khóa còn thiếu, không sửa giá trị đã có.
Nếu `SESSION_SECRET` còn placeholder, xóa **riêng dòng mẫu** rồi chạy `npm.cmd run setup:auth` theo thông báo
của script; không xóa cả `.env` và không đổi mật khẩu SQL để tạo lại cấu hình.

Cloudinary/Gemini không cần thiết cho kiểm duyệt thủ công hoặc smoke đấu giá thuần dữ liệu.
Tải ảnh/video cần Cloudinary; `ai:check`/`smoke:ai` cần Gemini; bài mới không tự gọi Gemini sau khi bật.

## 4. Nâng cấp trên máy có dữ liệu

Dừng API/worker/web trước, giữ `.env` và volume. Kiểm tra thay đổi local bằng `git status`:

```powershell
git switch feat/Hai
git pull --ff-only origin feat/Hai
npm.cmd ci
npm.cmd run setup
npm.cmd run setup:auth
npm.cmd run setup:media
npm.cmd run setup:ai
docker compose up -d
docker compose ps
```

Sau khi healthy:

```powershell
npm.cmd run db:migrate
npm.cmd run dev:all
```

`db:migrate` áp dụng 002–010, giữ dữ liệu và có thể chạy lại. Không tự chạy 001 lên database đang có dữ liệu.
Nếu schema lạ, dừng và đối chiếu; không xóa database/volume để ép lệnh chạy.
Schema đích đối chiếu [manifest](../backend/schema-manifest.json): 21 bảng, 172 cột, 102 CHECK, 15 UNIQUE.
Migration 007 giữ hồ sơ theo bài và media lịch sử. Migration 008 liên kết quyết định tự duyệt với đúng lần phân tích; giữ các quyết định Admin đã lưu. Migration 009 thêm hạn phản hồi, giải trình, kết luận và ghi chú nội bộ cho khiếu nại; hồ sơ cũ giữ quyền xem ban đầu.
Ctrl+F5 để lấy frontend mới. Khi Gemini đã bật, bài mới và hồ sơ gửi lại tự được xếp hàng.
Với bài vẫn chờ vì lỗi kỹ thuật, Admin có thể yêu cầu phân tích lại.

Nếu đang dùng tên Docker project/volume cũ, đọc [docker-migration.md](docker-migration.md).
Không chạy `docker compose down -v`, không FLUSHDB, không đổi tên volume theo ví dụ khi chưa inspect mount thực tế.

## 5. Kiểm tra dịch vụ và chạy smoke

Giữ `dev:all` ở terminal thứ nhất; mở terminal thứ hai:

```powershell
docker compose ps
Invoke-RestMethod http://127.0.0.1:5000/api/health/live
Invoke-RestMethod http://127.0.0.1:5000/api/health/ready | ConvertTo-Json -Depth 8
npm.cmd run smoke
```

`live` chỉ xác nhận HTTP API đang chạy. `ready` cần SQL/schema, Redis và worker heartbeat cùng đạt;
chưa kiểm tra khóa Cloudinary/Gemini, quyền provider hoặc chất lượng media.
Các smoke nghiệp vụ và điều kiện chạy được liệt kê tại [README](../README.md#kiểm-tra) và
[VALIDATION](../VALIDATION.md). Không chạy smoke trên database production hoặc đồng thời nhiều smoke.

## 6. Chẩn đoán thường gặp

| Hiện tượng | Kiểm tra / xử lý |
|---|---|
| Port 5173 already in use | Dừng terminal Vite/dev:all cũ; Vite strictPort không tự nhảy cổng |
| Redis/event worker chưa sẵn sàng | Xem Docker, log WORKER, kết nối Redis/SQL và heartbeat; giữ dev:all chạy |
| SQL sai số bảng/cột | Kiểm tra `DB_DATABASE`/đúng volume, chạy migration sau khi dịch vụ healthy |
| Từ chối/phê duyệt lỗi `KiemDuyet` có trigger và `OUTPUT` không có `INTO` | Cập nhật code `feat/Hai`, khởi động lại API. Câu INSERT phải dùng `OUTPUT … INTO` rồi SELECT mã kiểm duyệt; giữ trigger của migration 010. Bản sửa này không có migration mới |
| Không đăng nhập, lỗi CSRF | Kiểm tra session/Redis/origin; Ctrl+F5, đăng nhập lại; web tự làm mới token và thử lại tối đa một lần với lỗi INVALID_CSRF |
| `429` khi đăng nhập, “Bạn đã thử quá nhiều lần” | Cập nhật code, restart API/web, chờ đếm ngược theo TTL (login tối đa 15 phút). Đăng nhập thành công đặt lại bộ đếm email, giữ trần IP. Restart không tự xóa khóa cũ; không FLUSHDB hoặc xóa volume |
| `401 INVALID_CREDENTIALS` sau khi hết khóa | Kiểm tra đúng email/tài khoản và database đang kết nối; đây là lỗi riêng với 429. Không gửi mật khẩu/hash vào log hoặc chat |
| Tab cũ bị đăng xuất | Đúng chính sách khi tài khoản vừa đăng nhập nơi khác; F5 không giành lại phiên |
| Cloudinary có tệp nhưng web báo lỗi | Đối soát theo public ID, chưa có vé thì không gắn vào bài; không upload lặp liên tục |
| `1.jpg` bị từ chối | Tên không bị cấm; kiểm tra nội dung thực/codec/tệp hỏng, xem lỗi theo tên tệp |
| AI chưa có kết quả | Kiểm tra worker và `AI_ENABLED`/key; kiểm tra trạng thái lần phân tích; Admin vẫn quyết định được |
| AI HTTP 503 | Lỗi dịch vụ provider; xem chẩn đoán, thử lại hữu hạn; không tự kết luận khóa sai |
| Video M4 chưa gửi AI | Xem manifest/lý do, dung lượng video, Files API/deadline/quota; không tăng ngân sách ảnh để chữa video |
| Nháp không còn media | Vé chưa gửi hết hạn sau 1 giờ; nội dung nháp và file đã gắn SQL có vòng đời khác |
| PDF không mở | Cho phép popup, mở bản kết quả và chọn Lưu PDF/In của trình duyệt |

Nếu cần xác định tiến trình giữ cổng, xem trước bằng:

```powershell
Get-NetTCPConnection -LocalPort 5173 -State Listen | Select-Object LocalAddress, LocalPort, OwningProcess
```

Chỉ dừng tiến trình sau khi nhận diện đúng ứng dụng; không kill hàng loạt mọi tiến trình Node.
Không sửa lỗi bằng cách xóa dữ liệu SQL/Redis hoặc đưa API key vào log/ảnh chụp.

Migration 010 giữ dữ liệu và lịch sử; cho Admin ghi quyết định kèm AI tham khảo, chặn quyết định mới không có Admin. Dừng và khởi động lại cả API/worker khi nâng cấp. Không chạy worker phiên bản cũ sau migration.
