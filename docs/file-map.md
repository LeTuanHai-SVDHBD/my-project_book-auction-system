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
| `shared/bookGenres.js`, `shared/accountControl.js` | Danh mục thể loại chung và thông báo thay cửa sổ |

## Quyền cửa sổ và đầu vào biểu mẫu

| File/nhóm | Trách nhiệm |
|---|---|
| `backend/src/services/accountControl.service.js` | Login đổi owner, xóa session cũ nguyên tử; assert/release và Pub/Sub |
| `backend/src/realtime/accountSockets.js` | Cookie/tab/control handshake, ngắt chủ cũ và heartbeat bù sự kiện |
| `frontend/src/services/controlIdentity.js`, `accountControl.js` | Socket/HTTP nhận thu hồi phiên, xóa tài khoản và CSRF, dừng thao tác cũ |
| `frontend/src/App.jsx` | Chuyển về màn hình đăng nhập khi session bị thu hồi |
| `frontend/src/components/GenreSelect.jsx`, `shared/bookGenres.js` | Combobox một lựa chọn, lọc không dấu và danh mục dùng chung API |
| `frontend/src/components/MoneyInput.jsx` | Nhập số thuần, không đổi định dạng khi focus/gõ; xem trước nhóm nghìn và xử lý composition |
| `backend/test/accountControl.test.js` | Hai API/Redis/Socket thật opt-in; takeover, reconnect, CSRF và heartbeat |
| `backend/test/bookGenres.test.js` | Danh mục, tìm không dấu và kiểm tra bài mới/giữ sách cũ |
| `docs/account-control.md` | Chính sách quyền, API, khôi phục và nghiệm thu |

## Giao dịch và tương tác sau phiên

| File/nhóm | Trách nhiệm |
|---|---|
| `backend/src/services/communityPolicy.js` | Quyền hai bên, liên kết kết quả, hai xác nhận, đánh giá, giờ bình luận và đầu vào chặt |
| `backend/src/models/community.model.js` | SQL giao dịch/chat/đã đọc, đánh giá, bình luận, khiếu nại và phân công Admin |
| `backend/src/services/community.service.js` | Claim ảnh, COMMIT/rollback và bind bằng chứng |
| `backend/src/controllers/community.controller.js`, `routes/community.routes.js` | Hợp đồng /api/community, phân quyền, CSRF và cursor |
| `frontend/src/components/TransactionsPanel.jsx` | Giao dịch riêng, trace, xác nhận và đánh giá |
| `frontend/src/components/CommunityFeed.jsx`, `CommentsPanel.jsx` | Poll/cursor, chat text, bình luận và uy tín công khai |
| `frontend/src/components/ComplaintForm.jsx`, `ComplaintsPanel.jsx` | Upload ảnh, hồ sơ của mình, tiếp nhận/phản hồi của Admin |
| `frontend/src/services/communityApi.js` | Client dùng cookie/tab/CSRF chung |
| `backend/test/community*.test.js`, `helpers/communityFixture.js` | Policy, HTTP/session, media service và SQL opt-in; fixture giả phân biệt rõ |
| `scripts/smokeM8.mjs`, `smokeAfterSales.mjs` | Nghiệm thu dịch vụ thật, dùng fixture và cleanup của smokeM5 |
| `docs/after-sales.md` | Quy tắc, API, quyền media/chat và nghiệm thu |

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
| Schema | `migrations/001_schema.sql`, `002_cloudinary_metadata.sql`, `003_auction_decisions.sql`, `004_notifications.sql`, `schema-manifest.json` | DDL nền, migration media/quyết định và cấu trúc dự kiến |
| CLI | `scripts/initDatabase.js`, `migrateDatabase.js`, `createAdmin.js` | Tạo/nâng schema và tạo Admin qua terminal |

`src/concurrency/`, `src/jobs/` và `src/ai/` có logic phối hợp, tác vụ và phân tích đang dùng.

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

## Phân tích AI

| File/nhóm | Trách nhiệm |
|---|---|
| `backend/src/ai/criteria.js`, `scoring.js` | Tiêu chí, trọng số, quy đổi, NULL và audit hai điểm độc lập |
| `backend/src/ai/errors.js`, `scripts/checkAi.mjs` | Phân loại lỗi an toàn, HTTP/provider/DNS/TLS và chẩn đoán mẫu không cần SQL/Redis |
| `backend/src/ai/input.js`, `gemini.js` | Whitelist/hash đầu vào, kiểm tra media, Gemini Interactions JSON |
| `backend/src/config/ai.js` | Cờ bật, khóa, model và giới hạn tài nguyên |
| `backend/src/ai/queue.js`, `consumer.js`, `processor.js`, `reconcile.js` | Admission, pending/reclaim, cache, SQL receipt và bù enqueue |
| `backend/src/models/ai.model.js` | Lưu nguyên tử, version, lịch sử và truy vấn kết quả |
| `backend/src/services/ai.service.js`, `routes/ai.routes.js` | Quyền chủ bài/Admin, yêu cầu phân tích và trạng thái |
| `frontend/src/components/AiPanel.jsx` | Hai điểm, bằng chứng, cảnh báo, lịch sử và nút Admin |
| `backend/test/ai*.test.js`, `fixtures/ai-observations.json` | Bộ quy tắc, hợp đồng provider, HTTP, pipeline, Redis/SQL opt-in và mẫu đối chiếu |
| `scripts/setupAi.mjs`, `aiScoreExample.mjs`, `smokeAi.mjs` | Cấu hình, tính mẫu không gọi AI và smoke Gemini thật |
| `docs/ai-analysis.md` | Cấu hình, tiêu chí, công thức, quyền và nghiệm thu |

## Tích hợp BookBid

- `frontend/src/components/BookBidShell.jsx`, `Home.jsx`, `BookCard.jsx`, `BookGallery.jsx`, `DesignUi.jsx`: layout, trang chủ, card và media theo thiết kế đã chốt.
- `frontend/src/design.css`, `integration.css`, `styles/fonts.css`, `public/assets/`: màu/font/style và tài nguyên có giấy phép; không có fixture sách giả trong ứng dụng.
- `frontend/src/services/navigation.js`: route hash; ID bài đăng tách biệt với ID phiên/giao dịch.
- `frontend/src/components/Notifications.jsx`: đọc hộp thông báo của session, cập nhật 10 giây, đọc lại khi focus/online; không dùng room công khai.
- `backend/src/services/catalogSearch.js`: giới hạn từ khóa/bộ lọc/sắp xếp; model bài đăng truy vấn SQL tham số hóa.
- `backend/src/models/notification.model.js`, `routes/notification.routes.js`: dựng hộp thông báo từ sự kiện SQL đã COMMIT, chống trùng theo người nhận/nguồn và API riêng có CSRF.
- `backend/migrations/004_notifications.sql`: bảng ThongBao và index, có thể chạy lại, giữ dữ liệu.
- `backend/test/catalogSearch.test.js`, `notificationHttp.test.js`, phần mở rộng `communitySql.test.js`/`scripts/smokeAfterSales.mjs`: quyền, tìm kiếm và nghiệm thu SQL thật khi môi trường sẵn sàng.
