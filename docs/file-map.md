<!-- Mục đích: Tra cứu thư mục, trách nhiệm và trạng thái thành phần mã nguồn. -->

# Bản đồ mã nguồn

## Thành phần xử lý đấu giá

| File/nhóm | Trách nhiệm |
|---|---|
| `backend/migrations/003_auction_decisions.sql` | Receipt quyết định, backfill lượt hợp lệ cũ và lý do kết thúc |
| `backend/scripts/schemaMigrations.js` | Chạy cùng danh sách migration cho init/migrate |
| `backend/src/services/bidPolicy.js` | Validator, giá/lịch/cooldown và suy ra kết quả |
| `backend/src/models/auction.model.js` | Transaction quyết định, lượt giá, kết quả/giao dịch; snapshot công khai |
| `backend/src/services/auction.service.js` | Admission và kết quả, SQL trước Redis |
| `backend/src/routes/auction.routes.js`, `backend/src/controllers/auction.controller.js` | Quyền/CSRF, hợp đồng HTTP và projection |
| `backend/src/constants/auction.js` | Stream/group/prefix và thời hạn phối hợp |
| `backend/src/events/auctionPublisher.js`, `backend/src/events/auctionConsumer.js` | Lua admission, xếp hạn, pending/reclaim, ACK và dead-letter |
| `backend/src/concurrency/auctionLock.js`, `backend/src/processors/auction.processor.js` | Token/lease, gia hạn, bảo vệ trước COMMIT |
| `backend/src/jobs/auctionExpiry.js` | Tìm hạn SQL và xếp sự kiện chốt |
| `backend/test/auctionHttp.test.js`, `auctionStream.test.js`, `auctionSql.test.js` | HTTP, Redis thật, SQL thật opt-in và phục hồi |
| `backend/test/bidPolicy.test.js`, `auctionLock.test.js` | Biên nghiệp vụ/tiền và quyền sở hữu khóa |
| `frontend/src/components/AuctionPanel.jsx`, `frontend/src/services/auctionApi.js` | Gửi giá, theo dõi quyết định, retry cùng mã và snapshot |
| `frontend/src/utils/bidAvailability.js`, `backend/test/bidAvailability.test.js` | Đếm chờ từ giờ SQL, xử lý biên thời gian và dữ liệu thiếu/sai |
| `scripts/smokeM5.mjs` | Smoke API/worker/SQL/Redis thật và cleanup fixture riêng |
| `docs/auction-processing.md` | Hợp đồng, lưu quyết định, kết thúc và phục hồi |
| `backend/src/events/auctionUpdates.js` | Pub/Sub chỉ ID phiên, sau COMMIT; subscriber riêng tại API |
| `backend/src/realtime/auctionSockets.js` | Kiểm tra quyền xem công khai, room phiên/danh mục và tín hiệu thay đổi |
| `frontend/src/services/auctionRealtime.js` | Join/rejoin, gộp tín hiệu và đọc lại định kỳ |
| `frontend/src/components/BidHistory.jsx`, `frontend/src/utils/auctionClock.js` | Lịch sử phân trang và đồng hồ dựa trên SQL |
| `backend/test/auctionRealtime.test.js`, `auctionClock.test.js` | Ranh giới COMMIT, room, Pub/Sub/Streams thật theo opt-in và biên thời gian |
| `scripts/smokeM6.mjs`, `docs/realtime.md` | Nghiệm thu và hợp đồng thời gian thực; dùng chung fixture với smokeM5 |

## Cấu trúc chung

| Đường dẫn | Trách nhiệm |
|---|---|
| `README.md` | Cài đặt, cấu hình, sử dụng và kiểm tra |
| `VALIDATION.md` | Bằng chứng chạy và giới hạn xác minh |
| `AGENTS.md` | Quy tắc thay đổi repository |
| `package.json`, `package-lock.json` | npm workspaces, lệnh và dependency khóa phiên bản |
| `compose.yaml` | SQL Server, Redis và volume phát triển |
| `.env.example`, `frontend/.env.example` | Cấu hình mẫu; không chứa credentials thật |
| `backend/` | HTTP API, worker và nghiệp vụ |
| `frontend/` | React và client HTTP |
| `scripts/` | Công cụ điều phối/cài đặt/kiểm thử |
| `docs/` | Tài liệu kỹ thuật theo chủ đề |
| `academic/` | Hướng dẫn lưu báo cáo, slide, UML và bằng chứng được chọn |

Cài dependency từ gốc bằng `npm.cmd ci`. Không chỉnh thủ công node_modules, frontend/dist hoặc lockfile;
lockfile được cập nhật bằng npm khi dependency thay đổi.

`npm.cmd run dev:all` dùng devDependency `concurrently` ở gốc để chạy API, worker và React cùng lúc,
gắn nhãn màu cho log và dừng cả nhóm bằng `Ctrl+C`. Các lệnh `dev:api`, `dev:worker`, `dev:web`
vẫn dùng được khi cần kiểm tra riêng. SQL Server và Redis được khởi động bằng Docker Compose trước đó.

## Backend

Các đường dẫn bên dưới tương đối với `backend/`.

| Nhóm | File | Trách nhiệm |
|---|---|---|
| Khởi động | `src/app.js`, `src/server.js`, `src/worker.js` | Ghép HTTP middleware/router, Socket.IO, dịch vụ và worker |
| Cấu hình | `src/config/env.js`, `parseConfig.js`, `database.js`, `redis.js` | Nạp/kiểm tra môi trường, pool SQL, Redis |
| Xác thực | `src/config/auth.js`, `src/middlewares/session.js`, `auth.js` | Cookie/session, chọn phiên tab, CSRF, quyền và rate limit |
| Tài khoản | `src/routes/auth.routes.js`, `src/controllers/auth.controller.js` | HTTP tài khoản và vòng đời phiên |
| Tài khoản | `src/services/auth.service.js`, `password.service.js`, `authRateLimit.service.js` | Đầu vào, đăng ký/đăng nhập, Argon2id và Redis Lua |
| Tài khoản | `src/models/user.model.js` | NguoiDung qua SQL tham số hóa |
| Bài đăng | `src/routes/post.routes.js`, `src/controllers/post.controller.js` | Endpoint, quyền, phân trang và projection công khai |
| Bài đăng | `src/services/post.service.js`, `postValidation.js`, `postPolicy.js` | Điều phối claim/commit, hợp đồng và quy tắc chuyển trạng thái |
| Bài đăng | `src/models/post.model.js` | Transaction SQL tạo/duyệt/bổ sung/kích hoạt/đăng lại |
| Media | `src/config/media.js`, `src/routes/media.routes.js`, `src/controllers/media.controller.js` | Giới hạn, raw upload sau xác thực và HTTP vé media |
| Media | `src/services/cloudinary.service.js`, `mediaLedger.service.js` | REST provider, kiểm tra bytes, vé Redis và cleanup |
| Hạ tầng | `src/constants/infrastructure.js`, `src/controllers/health.controller.js`, `src/services/infrastructure.service.js` | Readiness, heartbeat và hằng số probe |
| Sự kiện | `src/events/eventPublisher.js`, `eventConsumer.js`, `src/processors/systemProbe.processor.js` | Xuất bản, đọc/nhận lại/xác nhận và xử lý probe |
| Utility | `src/utils/rowVersion.js`, `logger.js`, `src/middlewares/errorHandler.js` | Mã hóa version, log che bí mật và lỗi HTTP |
| Schema | `migrations/001_schema.sql`, `002_cloudinary_metadata.sql`, `003_auction_decisions.sql`, `schema-manifest.json` | DDL nền, migration media/quyết định và cấu trúc dự kiến |
| CLI | `scripts/initDatabase.js`, `migrateDatabase.js`, `createAdmin.js` | Tạo/nâng schema và tạo Admin qua terminal |

`src/concurrency/`, `src/jobs/`, `src/ai/` được giữ cho chức năng tương ứng; không coi thư mục placeholder là nghiệp vụ đã có.

## Frontend

Các đường dẫn bên dưới tương đối với `frontend/`.

| File | Trách nhiệm |
|---|---|
| `src/main.jsx`, `src/App.jsx` | Khởi tạo React và điều hướng theo tài khoản/vai trò |
| `src/components/AccountPanel.jsx` | Đăng ký/đăng nhập/đăng xuất và thông tin tài khoản |
| `src/components/InfrastructurePanel.jsx` | Kiểm tra hạ tầng/probe |
| `src/components/PostsPanel.jsx` | Danh sách/chi tiết, duyệt, bổ sung và lịch kích hoạt |
| `src/components/PostForm.jsx` | Thông tin sách/bài/giá và upload trước khi gửi |
| `src/components/MoneyInput.jsx` | Input tiền có phân cách, lọc chữ và giá trị nguyên gửi API |
| `src/services/authApi.js` | HTTP dùng cookie, CSRF trong bộ nhớ và selector tab |
| `src/services/tabIdentity.js` | Mã tab trong sessionStorage, giữ khi reload, xoay khi tài liệu mới |
| `src/services/postApi.js` | HTTP bài đăng/media qua client xác thực chung |
| `src/utils/moneyInput.js` | Định dạng tiền/caret không dùng Number |
| `src/style.css` | Giao diện và responsive |
| `vite.config.js`, `index.html` | Cấu hình dev/build và HTML khởi đầu |

## Script và kiểm thử

| File | Trách nhiệm |
|---|---|
| `scripts/setup.mjs`, `setupAuth.mjs`, `setupMedia.mjs` | Tạo/bổ sung cấu hình còn thiếu |
| `scripts/check.mjs` | Kiểm tra cú pháp Backend/script |
| `scripts/smoke.mjs` | Hạ tầng thật |
| `scripts/smokeAuth.mjs` | Tài khoản qua API/SQL/Redis thật |
| `scripts/smokeM4.mjs` | Bài đăng/Cloudinary/duyệt/kích hoạt/đăng lại với dữ liệu UUID riêng |
| `backend/test/infrastructure.test.js` | Hợp đồng hạ tầng và probe |
| `backend/test/auth.test.js`, `authRedis.test.js` | Auth HTTP/Argon2 và Redis thật theo opt-in |
| `backend/test/posts.test.js`, `mediaRedis.test.js` | Policy/HTTP/provider và claim/cleanup Redis |
| `backend/test/rowVersion.test.js` | Binary SQL → JSON → HTTP và optimistic version |
| `backend/test/tabSession.test.js` | Cookie jar chung, quyền/CSRF, rotate/logout độc lập và Redis opt-in |
| `backend/test/inputFormatting.test.js` | Vòng đời selector tab, tiền nguyên và caret |
| `backend/test/setupAuth.test.js` | Setup giữ cấu hình cũ, idempotency và secret mẫu |

## Tài liệu và quy ước

- `architecture.md`: thành phần, kết nối và tính nhất quán.
- `flows.md`: luồng thực thi, API và quy tắc dự kiến.
- `decisions.md`: các ADR còn hiệu lực và quyết định chưa hoàn tất.
- `tasks.md`: trạng thái chức năng và backlog.
- `docker-migration.md`: chuyển project, kiểm tra volume và dữ liệu.

File mã nguồn viết tay có comment đầu file mô tả trách nhiệm. JSON chuẩn không chèn comment.
Thư mục rỗng được giữ bằng `.gitkeep`; file này không chứng minh chức năng đã triển khai.
