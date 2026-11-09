<!-- Mục đích: Điểm bắt đầu cho cài đặt, sử dụng và đọc tài liệu của nhánh feat/Hai. -->

# Hệ thống đấu giá sách trực tuyến — Nhóm 15

Ứng dụng BookBid quản lý một bản sách vật lý từ đăng bài, kiểm duyệt, kích hoạt phiên,
đặt giá đến kết quả và giao dịch. Kiến trúc hướng sự kiện tách việc tiếp nhận yêu cầu HTTP
khỏi xử lý đấu giá ở worker; **SQL Server là nguồn trạng thái có thẩm quyền**.

Tài liệu được rà soát ngày **06/11/2026**, theo mã nguồn nhánh **`feat/Hai`**.
Chức năng trong phạm vi các mốc 3–8 đã được triển khai. Mức kiểm chứng, báo cáo của nhóm
và phần chưa chạy với dịch vụ thật được ghi riêng tại [VALIDATION.md](VALIDATION.md).
Không coi việc hoàn thành mã nguồn là chứng nhận sẵn sàng vận hành production.

## Công nghệ và cách tổ chức

| Thành phần | Công nghệ / vai trò |
|---|---|
| Giao diện | React, Vite, JavaScript ES Modules; giao diện BookBid responsive |
| API | Node.js **24.x**, Express; xác thực HTTP, upload và Socket.IO |
| Worker | Redis Streams; xử lý giá, hết hạn và kiểm duyệt AI |
| CSDL | SQL Server 2022 Developer; migration 001–008 |
| Redis | Redis 8; session, hàng đợi, admission, khóa và Pub/Sub |
| Ảnh/video | Cloudinary; vé upload Redis, metadata và tham chiếu SQL |
| AI | Gemini Interactions + Files API; Backend tính hai điểm và hỗ trợ tự duyệt theo ngưỡng cấu hình |
| Quản lý gói | npm workspaces, một `package-lock.json` ở thư mục gốc |

Schema hiện tại: **21 bảng, 172 cột, 102 CHECK, 15 UNIQUE constraints**, theo
[manifest](backend/schema-manifest.json). Số UNIQUE này không bao gồm việc đếm mọi chỉ mục duy nhất.
Frontend không truy cập SQL/Redis trực tiếp. Chỉ SQL Server/Redis được Compose khởi động;
API, worker và web chạy bằng Node trên máy phát triển.

## Cài lần đầu

Cần Git, Node.js 24.x kèm npm, Docker Desktop với Linux containers và Compose V2.
Chạy PowerShell tại thư mục muốn lưu dự án:

```powershell
git clone --branch feat/Hai https://github.com/LeTuanHai-SVDHBD/my-project_book-auction-system.git
cd my-project_book-auction-system
npm.cmd ci
npm.cmd run setup
docker compose up -d
docker compose ps
```

Chờ `sqlserver` và `redis` **healthy**, sau đó:

```powershell
npm.cmd run db:init
npm.cmd run admin:create
npm.cmd run dev:all
```

`admin:create` hỏi thông tin/mật khẩu kín trong terminal; không có tài khoản Admin mặc định.
Mở **http://127.0.0.1:5173**. API mặc định ở **http://127.0.0.1:5000**.
`setup` tạo cấu hình riêng khi chưa có, không ghi đè `.env` đã tồn tại.
Điền Cloudinary để tải media; bật Gemini khi cần dùng AI. Hướng dẫn đầy đủ và bảng cấu hình:
[setup-guide.md](docs/setup-guide.md).

## Cập nhật máy đã có dữ liệu

Dừng `dev:all` bằng Ctrl+C, giữ Docker/volume và cấu hình riêng. Nếu có sửa local, xử lý chúng
trước khi chuyển nhánh/pull; không dùng reset để bỏ thay đổi chưa lưu.

```powershell
git switch feat/Hai
git pull --ff-only origin feat/Hai
npm.cmd ci
npm.cmd run setup
npm.cmd run setup:auth
npm.cmd run setup:media
npm.cmd run setup:ai
docker compose up -d
```

Sau khi Docker healthy:

```powershell
npm.cmd run db:migrate
npm.cmd run dev:all
```

Ctrl+F5 sau khi cập nhật frontend. Các script `setup:*` chỉ thêm khóa thiếu, giữ giá trị đang có;
`db:migrate` áp dụng 002–008 lên schema nền có sẵn. Không dùng `db:migrate` thay `db:init` trên database trống.
Không xóa database/Redis/volume để chữa readiness. Nếu đổi Docker project hoặc máy có volume cũ,
đọc [docker-migration.md](docs/docker-migration.md) trước khi khởi động.

Mỗi ngày chỉ cần giữ Docker chạy và dùng **một terminal**:

```powershell
npm.cmd run dev:all
```

Lệnh mở ba tiến trình có nhãn `[API]`, `[WORKER]`, `[WEB]`; một tiến trình dừng sẽ kéo các tiến trình
còn lại dừng theo `--kill-others`. Muốn chạy kiểm tra/smoke thì mở terminal thứ hai, không mở thêm một `dev:all`.

## Chức năng theo vai trò

| Vai trò | Chức năng |
|---|---|
| Khách | Xem/tìm phiên công khai, ảnh/video, giá, lịch sử, kết quả, bình luận và uy tín |
| Người dùng | Đăng sách, lưu nháp, bổ sung bài bị từ chối, kích hoạt/đăng lại đủ điều kiện; đặt giá sách của người khác |
| Hai bên giao dịch | Chat riêng, xác nhận hoàn tất phần giao dịch của mình, khiếu nại; người mua đánh giá sau hoàn tất |
| Admin | Theo dõi kiểm duyệt AI, yêu cầu phân tích lại khi bài còn chờ; xử lý khiếu nại |

Admin dùng sidebar riêng, không có chức năng đăng sách. Khách không thấy avatar tài khoản hoặc hộp thông báo.
Đăng nhập cùng tài khoản ở nơi mới thu hồi phiên cũ; F5 không khôi phục phiên đã bị thu hồi.
Khác tài khoản vẫn có thể dùng đồng thời ở các tab. Xem [account-control.md](docs/account-control.md).

## Luồng sử dụng chính

1. **Đăng sách:** điền bốn bước, gồm thông tin sách, ảnh/video, thông số đấu giá, kiểm tra và gửi.
   ISBN tùy chọn, tối đa 100 ký tự; thể loại chọn từ danh mục chung, gõ chỉ để lọc.
   Một ô **Tình trạng, yếu tố quý hiếm và bằng chứng** thay cho hai mô tả tình trạng trùng nhau.
2. **Kiểm duyệt:** Bài được đưa vào hàng đợi AI sau khi lưu; worker đối chiếu hai điểm độc lập với hai ngưỡng.
   Đạt cả hai thì phê duyệt; điểm thấp hoặc thiếu bằng chứng sau khi phân tích thì từ chối kèm lý do.
   Sự cố dịch vụ giữ bài chờ. Admin có thể yêu cầu AI phân tích lại, còn quyết định luôn do hệ thống lưu.
   Bật Gemini và xem hai ngưỡng theo [hướng dẫn cấu hình](docs/ai-analysis.md#kiểm-duyệt-tự-động).
3. **Bổ sung:** chủ bài bị từ chối sửa hồ sơ, đánh dấu gỡ media cũ, thêm media và gửi duyệt lại.
   Lưu hồ sơ theo bài, giữ media/quyết định/PDF của vòng trước. Bài đã duyệt rời danh sách kiểm duyệt.
4. **Kích hoạt:** chủ sách đặt lịch tương lai cho đúng phiên đã duyệt. Phê duyệt chưa tự mở đấu giá.
5. **Đặt giá:** HTTP 202 chỉ là **đang chờ xử lý**. Worker kiểm tra và ghi quyết định SQL;
   giao diện mới chuyển sang **được chấp nhận/bị từ chối**. Giá/trạng thái được đồng bộ giữa các trình duyệt.
6. **Kết thúc:** hết hạn hoặc lượt hợp lệ đạt/vượt giá kết thúc sớm. Có người thắng mới tạo giao dịch/chat.
   Hai bên xác nhận độc lập; sau hoàn tất, người mua được đánh giá một lần.
7. **Kết quả kiểm duyệt:** người bán xem sau quyết định; nút xuất mở bản in để lưu PDF.
   Ảnh/video trong bản kết quả là link Cloudinary, không nhúng tệp.

### Quy tắc giá

- Mỗi bài là **một bản sách vật lý**. Chủ sách không tự đặt giá; Admin không đặt giá.
- Lượt đầu: `gia_khoi_diem + k × buoc_gia`, `k ≥ 0`.
- Lượt sau: `gia_hien_tai + k × buoc_gia`, `k ≥ 1`.
- Cooldown cùng người/cùng phiên mặc định 20 giây, Backend nhận 10–30 giây;
  giao diện chọn 10/15/20/25/30 giây. Trong thời gian chờ, ẩn thao tác đặt tiếp.
- `gia_toi_thieu` là **ngưỡng kết thúc sớm**, chỉ chủ sách/Admin thấy; không phải điều kiện bắt buộc
  để có người thắng khi hết hạn. Hết hạn có lượt hợp lệ thì giá cao nhất thắng dù chưa đạt ngưỡng.
- Tiền VND nguyên là chuỗi tối đa 18 chữ số; dấu chấm phân cách hàng nghìn hiện ngay trong ô nhập.
- Chỉ cho đăng lại khi phiên mới nhất đã kết thúc và có kết quả xác nhận không có người thắng.
  Không có chức năng kết thúc thủ công, hủy giữa phiên hoặc xóa bài đăng.

### Media, nháp và AI

| Phần | Hành vi hiện tại |
|---|---|
| Upload | Không đặt trần số ảnh/bài; mặc định 10 MiB/ảnh, 3 video, 50 MiB/video; vẫn có giới hạn rate/request |
| Định dạng | JPG/JPEG/JFIF, PNG, WebP, GIF, BMP, TIFF, AVIF, HEIC/HEIF; MP4, M4V, MOV/QT, WebM, MKV, AVI |
| Nhận diện | Dựa trên nội dung tệp ở client và API, không chỉ đuôi `.jpg`; provider vẫn kiểm tra codec/tệp |
| Nháp | Lưu trên trình duyệt theo tài khoản/chế độ/bài; chuyển trang trong SPA giữ lượt upload |
| Giới hạn nháp | Reload/đóng trình duyệt có thể ngắt upload chưa xong; vé chưa gửi bài hết hạn sau 1 giờ |
| Ảnh gửi AI | Inline, tổng mặc định/tối đa 12 MiB, tách khỏi giới hạn upload |
| Video gửi AI | Gemini Files API; gửi toàn bộ tệp, không cắt ở phút thứ 5; Gemini lấy mẫu theo cơ chế của mô hình |
| Kết quả AI | Hai điểm độc lập, thiếu bằng chứng giữ NULL; lỗi provider hiện thất bại, không thay bằng điểm 0 |

Thời lượng hơn 5 phút không tự bị loại, nhưng dung lượng/deadline/quota/model vẫn giới hạn việc xử lý.
Hệ thống dùng video Cloudinary đã tải lên; chưa có ô nhập YouTube để phân tích video.
Chi tiết: [media-upload.md](docs/media-upload.md), [ai-analysis.md](docs/ai-analysis.md).

## Tìm kiếm và thông báo

Tìm kiếm chạy SQL tham số hóa trên tên sách, tiêu đề, tác giả, ISBN và thể loại, có/không dấu;
lọc nhóm/thể loại, trạng thái phiên và sắp xếp/phân trang. **Không thêm bảng tìm kiếm**.
Bốn nhóm trang chủ lấy từ [bookGenres.js](shared/bookGenres.js).

Hộp thông báo riêng dùng bảng **ThongBao** (migration 004), lưu đã đọc và chống trùng nguồn.
Khi đọc hộp, Backend đồng bộ từ dữ liệu nghiệp vụ đã COMMIT; frontend cập nhật mỗi 10 giây/focus/online.
Đây là hộp tin trong web, không phải push/email tức thời. Xem [ui-integration.md](docs/ui-integration.md).

## Kiểm tra

Tất cả lệnh dưới chạy ở gốc repository; danh sách lấy từ [package.json](package.json).

| Lệnh Windows | Phạm vi / yêu cầu |
|---|---|
| `npm.cmd run check` | Cú pháp JS phía server, scripts và shared; không thay kiểm tra JSX |
| `npm.cmd test` | Toàn bộ test Backend; bài cần dịch vụ thật có thể SKIP nếu chưa bật |
| `npm.cmd run build` | Build frontend, kiểm tra import/JSX |
| `npm.cmd run test:ai` | Bộ AI, có bài Redis/SQL opt-in |
| `npm.cmd run test:community` | Policy/HTTP sau phiên và SQL opt-in |
| `npm.cmd run ai:example` | Dữ liệu mẫu, quy đổi điểm; không gọi API |
| `npm.cmd run ai:check` | Một yêu cầu Gemini văn bản thật; không kiểm tra SQL/Redis/video |
| `npm.cmd run smoke` | API/SQL/Redis/worker và probe thật |
| `npm.cmd run smoke:auth` | Tài khoản/session trên dịch vụ thật |
| `npm.cmd run smoke:m4` | Bài đăng, Cloudinary thật, kiểm duyệt và xuất bản kết quả |
| `npm.cmd run smoke:m5` | Quy tắc giá, tranh chấp và chốt phiên thật; không cần Cloudinary |
| `npm.cmd run smoke:m6` | Thêm đồng bộ Socket và snapshot trên fixture đấu giá |
| `npm.cmd run smoke:ai` | Gemini qua worker, lưu SQL; hồ sơ thử thiếu ảnh giữ NULL và kiểm tra chế độ đang bật |
| `npm.cmd run smoke:m8` | Kết thúc và luồng sau phiên, tìm kiếm/thông báo; ảnh khiếu nại thật kiểm tra riêng |

Smoke cần giữ `dev:all` ở terminal thứ nhất, chạy lệnh ở terminal thứ hai. Các smoke tạo/dọn fixture
UUID riêng; FAIL hoặc pending chưa rõ có thể giữ fixture để đối soát. Không chạy song song các smoke.
M4/M5/M6/M8 cần [môi trường fixture riêng](docs/ai-analysis.md#kiểm-tra-và-nghiệm-thu).
Cách bật test SQL/Redis riêng và checklist nghiệm thu: [VALIDATION.md](VALIDATION.md).

## Tài liệu

| Tệp | Nội dung |
|---|---|
| [setup-guide.md](docs/setup-guide.md) | Cài mới, cập nhật, cấu hình, địa chỉ và chẩn đoán trên Windows |
| [architecture.md](docs/architecture.md) | Thành phần, ranh giới trách nhiệm, SQL và các luồng sự kiện |
| [flows.md](docs/flows.md) | Vòng đời, trạng thái và danh mục HTTP API |
| [auction-processing.md](docs/auction-processing.md) | Giá, khóa, transaction, retry/reclaim và kết thúc |
| [realtime.md](docs/realtime.md) | Socket, snapshot, reconnect và giới hạn giao nhận |
| [account-control.md](docs/account-control.md) | Một phiên/tài khoản và thu hồi phiên cũ |
| [media-upload.md](docs/media-upload.md) | Upload, đối soát Cloudinary, định dạng và lưu nháp |
| [ai-analysis.md](docs/ai-analysis.md) | Chín tiêu chí, NULL, Gemini/Files, thời gian chờ và quyền xem |
| [after-sales.md](docs/after-sales.md) | Giao dịch, chat, đánh giá, khiếu nại và bình luận |
| [review-exports.md](docs/review-exports.md) | Snapshot theo quyết định và lưu PDF |
| [ui-integration.md](docs/ui-integration.md) | Màn hình, tìm kiếm, thông báo và hành vi frontend |
| [decisions.md](docs/decisions.md) | Quyết định kỹ thuật và lý do lựa chọn |
| [file-map.md](docs/file-map.md) | Bản đồ thư mục/mô-đun thực tế |
| [tasks.md](docs/tasks.md) | Phạm vi hoàn thành và checklist bàn giao |
| [VALIDATION.md](VALIDATION.md) | Bằng chứng kiểm thử và giới hạn xác nhận |
| [docker-migration.md](docs/docker-migration.md) | Giữ volume khi chuyển Docker project |
| [academic/README.md](academic/README.md) | Quy ước báo cáo, slide và UML; các tệp học thuật chưa nằm trong repo |
| [AGENTS.md](AGENTS.md) | Quy tắc làm việc với mã nguồn |

Chưa tích hợp thanh toán/vận chuyển/hoàn tiền tự động, CDN bằng chứng riêng tư, email/push,
chữ ký số PDF hoặc công cụ tự động replay dead-letter. Những phần này không nằm trong phạm vi hoàn thành hiện tại.
