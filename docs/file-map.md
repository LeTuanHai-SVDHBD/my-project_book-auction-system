<!-- Mục đích: Bản đồ mô-đun thực tế; chỉ liệt kê thành phần có trong repository. -->

# Bản đồ mã nguồn

Đọc [kiến trúc](architecture.md) trước nếu cần hiểu luồng giữa các mô-đun. Dự án dùng JavaScript ES Modules,
React JSX và npm workspaces; không phải source TypeScript/Vue. Cây dưới đây nhóm theo trách nhiệm,
không liệt kê từng tài nguyên font hoặc từng bài test.

## Gốc và môi trường

| Vị trí | Trách nhiệm |
|---|---|
| `package.json`, `package-lock.json` | Workspaces, scripts chung, Node 24.x và phiên bản dependency |
| `.env.example`, `frontend/.env.example` | Cấu hình mẫu; không là credentials thật |
| `compose.yaml` | SQL Server/Redis, healthcheck, loopback ports, named volumes |
| `.gitignore`, `AGENTS.md` | File không commit và quy tắc làm việc |
| `README.md`, `VALIDATION.md` | Điểm bắt đầu và trạng thái kiểm chứng |
| `academic/` | Khung lưu báo cáo/slide/UML/evidence; chưa có các bản học thuật trong source hiện tại |

## Backend

| Vị trí trong `backend/` | Trách nhiệm |
|---|---|
| `src/server.js`, `src/app.js` | Lắp các router/dependency, HTTP/Socket, subscriber, cleanup và shutdown |
| `src/worker.js` | Consumer probe/đấu giá/AI, job hết hạn và heartbeat; không có vòng tự enqueue AI |
| `src/config/` | Parse env, SQL/Redis, auth, media và AI; không chứa key cố định |
| `src/routes/`, `src/controllers/` | HTTP boundary: health, auth, posts, media, auctions, ai, community, notifications |
| `src/middlewares/` | Session theo tab, auth/role/CSRF/rate limit và lỗi tập trung |
| `src/services/auth.service.js`, `password.service.js`, `authRateLimit.service.js` | Tài khoản, kiểm tra/băm mật khẩu và giới hạn thử |
| `src/services/accountControl.service.js` | Owner phiên, thu hồi session cũ, Redis Lua/PubSub |
| `src/services/post.service.js`, `postValidation.js`, `postPolicy.js` | Claim/bind vé, hợp đồng sách/bài/giá, trạng thái/quyền |
| `src/services/moderationList.js`, `catalogSearch.js` | Bộ lọc/cursor kiểm duyệt, tìm kiếm/allowlist sắp xếp |
| `src/services/cloudinary.service.js`, `mediaLedger.service.js`, `mediaErrors.js` | Upload/recovery/metadata, lifecycle vé, cleanup bảo vệ SQL và lỗi provider an toàn |
| `src/services/auction.service.js`, `bidPolicy.js` | Admission/đọc quyết định và quy tắc giá/giờ/cooldown |
| `src/ai/quota.js` | Mốc tạm dừng Redis cho API và worker khi Gemini trả 429 |
| `src/services/ai.service.js`, `aiPresentation.js` | Xếp hàng khi lưu bài, Admin yêu cầu phân tích lại, đọc status/history và công bố đúng vòng cho người bán |
| `src/services/community.service.js`, `communityPolicy.js` | Khiếu nại/media và quyền/liên kết giao dịch/chat/đánh giá |
| `src/services/reviewExport.js` | Snapshot và lọc dữ liệu xuất kết quả |
| `src/services/infrastructure.service.js` | Probe/schema/readiness hạ tầng |
| `src/models/` | Truy vấn SQL tham số hóa và transaction: user, post, auction, ai, community, notification |
| `src/models/bookProfile.js` | Hồ sơ sách theo bài, OPENJSON và fallback legacy |
| `src/events/` | Publisher/consumer probe, đấu giá và tín hiệu cập nhật sau COMMIT |
| `src/processors/` | Quyết định đấu giá, probe; replay/khóa/SQL |
| `src/concurrency/auctionLock.js` | SET NX PX, token/lease, gia hạn và compare-delete |
| `src/jobs/auctionExpiry.js` | Đọc phiên hết hạn theo SQL, enqueue chốt |
| `src/realtime/` | Namespace `/account` xác thực và `/auctions` công khai |
| `src/utils/` | Logger an toàn, bounded provider JSON và rowversion |

Các file `.gitkeep` chỉ giữ cấu trúc, không phải mô-đun chức năng chưa hoàn thiện.

### AI

| Vị trí trong `backend/src/ai/` | Trách nhiệm |
|---|---|
| `criteria.js`, `scoring.js` | Chín tiêu chí, bảng quy đổi, hai tổng độc lập và NULL |
| `input.js` | Projection/hash đầu vào và đọc metadata/đánh dấu kết quả cũ |
| `moderation.js`, `scheduler.js` | So hai ngưỡng, tạo lý do, xếp bài chờ theo phiên bản từ SQL |
| `gemini.js` | Interactions REST/schema, prompt, retry hữu hạn, chống gửi giá/tài khoản |
| `media.js` | Ảnh inline có ngân sách, video tuần tự riêng, manifest M1… |
| `files.js` | Gemini Files resumable, kiểm tra host/name/URI, poll ACTIVE, cleanup |
| `transport.js`, `errors.js` | Đọc stream có giới hạn/deadline, mã lỗi và chẩn đoán allowlist |
| `queue.js`, `consumer.js`, `processor.js` | Admission manual/Streams/reclaim, lease/cache/receipt và lưu SQL |

`reconcile.js` của cơ chế tự phân tích đã được bỏ; không mô tả file này như thành phần còn chạy.

### SQL và script Backend

| Vị trí | Vai trò |
|---|---|
| `backend/migrations/001_schema.sql` | DDL nền, dùng khi khởi tạo |
| `002_cloudinary_metadata.sql` | Metadata/index Cloudinary |
| `003_auction_decisions.sql` | Receipt YeuCauDatGia, lý do kết thúc/backfill |
| `004_notifications.sql` | ThongBao, nguồn chống trùng và chỉ mục |
| `005_review_exports.sql` | Snapshot JSON theo quyết định KiemDuyet |
| `006_isbn_input.sql` | ISBN NVARCHAR(100), không ép 10/13 ký tự |
| `007_resubmission_profiles.sql` | BaiDang.ho_so_sach, HinhAnh/Video.dang_su_dung |
| `008_auto_moderation.sql` | Liên kết KiemDuyet–PhanTichAI, phân biệt nguồn Admin/AI |
| `009_two_party_complaints.sql` | Khiếu nại hai bên, hạn giải trình, kết luận và giới hạn hồ sơ đang mở |
| `backend/schema-manifest.json` | Chữ ký đích: 21 bảng, 172 cột, 102 CHECK, 15 UNIQUE |
| `backend/scripts/` | Init/migrate, danh sách migration dùng chung và CLI tạo Admin |

Các dòng tên migration 002–010 ở bảng trên đều nằm trong `backend/migrations/`.

## Frontend

| Vị trí trong `frontend/src/` | Trách nhiệm |
|---|---|
| `main.jsx`, `App.jsx` | Khởi tạo React, hash routes và điều phối trang theo tài khoản |
| `components/BookBidShell.jsx`, `DesignUi.jsx`, `Home.jsx` | Shell, sidebar Admin, header người dùng, icon và trang chủ |
| `components/AccountPanel.jsx`, `InfrastructurePanel.jsx` | Tài khoản và công cụ hạ tầng |
| `components/PostsPanel.jsx`, `PostForm.jsx` | Danh mục/mine/pending/chi tiết, bốn bước tạo/bổ sung/đăng lại |
| `components/GenreSelect.jsx`, `MoneyInput.jsx` | Combobox tìm/chọn thể loại, tiền chuỗi/IME/caret |
| `components/BookCard.jsx`, `BookGallery.jsx`, `ImageZoom.jsx`, `ImageLightbox.jsx`, `UploadMediaCard.jsx` | Ảnh/video một bản sách, kính lúp, xem ảnh lớn tại chỗ, ảnh thu nhỏ và gỡ media |
| `components/AuctionPanel.jsx`, `BidHistory.jsx` | Giá, quyết định riêng, lịch sử/kết quả, trạng thái chờ |
| `components/AiPanel.jsx`, `ReviewExportButton.jsx` | AI theo yêu cầu, lịch sử/manifest/điểm và xuất snapshot |
| `components/TransactionsPanel.jsx`, `CommentsPanel.jsx`, `CommunityFeed.jsx`, `ComplaintForm.jsx`, `ComplaintsPanel.jsx` | Giao dịch, chat, bình luận/uy tín và khiếu nại |
| `components/Notifications.jsx` | Hộp thông báo riêng, chưa đọc/đã đọc và điều hướng |
| `services/authApi.js`, `tabIdentity.js`, `controlIdentity.js`, `accountControl.js` | Cookie/CSRF/selector, thu hồi và tránh phản hồi cũ xóa phiên mới |
| `services/postApi.js`, `postDrafts.js` | HTTP bài/media, nhận diện tệp và nháp/upload qua điều hướng SPA |
| `services/auctionApi.js`, `auctionRealtime.js`, `communityApi.js` | Đọc/ghi nghiệp vụ, Socket và lấy lại snapshot |
| `services/apiBase.js`, `navigation.js`, `reviewDocument.js` | API base/hash routes và bản in snapshot |
| `utils/` | Đồng hồ SQL, điều kiện đặt tiếp, số tiền, geometry kính lúp và tiến độ AI |
| `style.css`, `design.css`, `integration.css`, `styles/fonts.css` | Style nền, phong cách BookBid, kết nối component và font local |

`frontend/public/assets/` chứa ảnh trang trí thư viện và font/OFL. Ảnh/video sách lấy từ Backend/Cloudinary,
không tráo ảnh minh họa thành bằng chứng của người bán.

## Shared, kiểm tra và tài liệu

| Vị trí | Trách nhiệm |
|---|---|
| `shared/accountControl.js`, `aiVisibility.js` | Thông báo phiên và điều kiện công bố kết quả AI |
| `shared/bookGenres.js`, `bookIdentifiers.js`, `bookCondition.js` | Danh mục chung, ISBN và gộp mô tả |
| `shared/mediaFormats.js`, `mediaDelivery.js` | Nhận diện nhị phân/allowlist và URL xem/chấm phù hợp, giữ link gốc |
| `scripts/setup*.mjs` | Tạo/bổ sung cấu hình, bảo toàn giá trị riêng |
| `scripts/check.mjs` | Cú pháp server/scripts/shared |
| `scripts/checkAi.mjs`, `aiScoreExample.mjs` | Gemini văn bản một lượt và ví dụ tính điểm |
| `scripts/smoke*.mjs` | Nghiệm thu dịch vụ thật, readiness và fixture/cleanup; chỉ lệnh khai báo ở package.json là entrypoint npm |
| `backend/test/` | Test policy, HTTP/fixture và Redis/SQL opt-in; không phải mọi bài đều dùng dịch vụ thật |
| `docs/` | Hướng dẫn/chức năng/kiến trúc hiện hành; mục lục ở README |
| `docs/archive/` | Bằng chứng kiểm thử cũ, không dùng thay hướng dẫn chạy hiện tại |

Không có script `lint`, `smoke:m3`, `smoke:m7` hoặc `smoke:media` trong package.json hiện tại.
Các tệp `smokeAfterSales.mjs`, `smokeReadiness.mjs` là mô-đun dùng chung, không có npm script riêng.

Migration 010 chỉnh ràng buộc và trigger trên KiemDuyet: chỉ Admin tạo quyết định mới, giữ lịch sử AI. `ai/timing.js` tính thống kê theo các mẫu thực tương tự, chỉ trả cho Admin.
