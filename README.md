<!-- Mục đích: Giới thiệu dự án, hướng dẫn cài đặt, sử dụng và kiểm tra môi trường phát triển. -->

# Hệ thống đấu giá sách trực tuyến

Dự án của Nhóm 15, sử dụng React, Express, SQL Server, Redis Streams và Socket.IO.
Hệ thống hướng tới xử lý tranh chấp đặt giá đồng thời và đồng bộ dữ liệu đấu giá theo kiến trúc hướng sự kiện.

## Chức năng hiện có

- Đăng ký, đăng nhập, đăng xuất; phân quyền người dùng và Admin.
- Phiên đăng nhập riêng cho từng tab trình duyệt, lưu tại Redis và xác thực bằng cookie HttpOnly.
- Đăng sách kèm ảnh/video Cloudinary; tạo bài đăng và phiên chờ kiểm duyệt trong cùng giao dịch SQL.
- Admin phê duyệt hoặc từ chối có lý do; chủ sách bổ sung bài bị từ chối và gửi duyệt lại.
- Chủ sách đặt lịch, kích hoạt phiên đã duyệt và đăng lại bản sách đủ điều kiện.
- Danh mục công khai; giữ ẩn giá kết thúc sớm đối với người mua.
- Đặt giá qua Redis Streams; kiểm tra bước giá/cooldown, chống xử lý trùng và theo dõi quyết định.
- Tự kết thúc khi hết giờ hoặc đạt ngưỡng; một kết quả mỗi phiên, tạo giao dịch khi có người thắng.
- Kiểm tra hạ tầng, heartbeat của worker và probe qua Redis Streams.

Cập nhật nghiệp vụ qua Socket.IO, tích hợp Gemini và các chức năng sau phiên đang chờ triển khai.
Socket.IO hiện phục vụ kiểm tra kết nối; giao diện theo dõi quyết định đặt giá qua HTTP,
các phiên ở tab khác cần bấm tải lại để xem giá/trạng thái mới nhất.

## Yêu cầu môi trường

- Windows 11, VS Code và Docker Desktop chạy Linux containers.
- Node.js 24.x, npm và Git.
- SQL Server 2022 Developer và Redis theo `compose.yaml`.
- Tài khoản Cloudinary để tải ảnh/video thật; SSMS tùy chọn để xem dữ liệu.

```powershell
node --version
npm.cmd --version
docker compose version
```

Mở thư mục `my-project_book-auction-system` trong VS Code. Các lệnh dưới đây chạy tại thư mục gốc,
nơi có `package.json`, `package-lock.json`, `compose.yaml`, `backend/` và `frontend/`.

## Cài đặt

### Môi trường mới

```powershell
npm.cmd ci
npm.cmd run setup
npm.cmd run setup:auth
npm.cmd run setup:media
docker compose up -d
docker compose ps
```

Khi SQL Server và Redis đều healthy:

```powershell
npm.cmd run db:init
npm.cmd run admin:create
```

`setup` tạo `.env` và cấu hình Frontend khi chưa có; các script setup giữ nguyên giá trị đã tồn tại.
`db:init` tạo schema nền rồi áp dụng các migration media và quyết định đấu giá. Schema hiện tại có **20 bảng, 152 cột**.
`admin:create` yêu cầu tên, email và mật khẩu kín trong terminal. Admin đã tồn tại được giữ nguyên mật khẩu;
script không tự nâng quyền tài khoản người dùng thường.

### Môi trường đã có dữ liệu

Dừng API, worker và React trước khi cập nhật. Giữ các thay đổi cục bộ cần thiết trước khi pull.

```powershell
git switch feat/Hai
git pull --ff-only origin feat/Hai
npm.cmd ci
npm.cmd run setup:auth
npm.cmd run setup:media
npm.cmd run db:migrate
```

`db:migrate` chạy migration có thể lặp lại: metadata Cloudinary, bảng `YeuCauDatGia` và
cột `KetQuaDauGia.ly_do_ket_thuc`. Lượt giá cũ được backfill thành quyết định chấp nhận;
lý do kết thúc chưa biết của dữ liệu cũ giữ NULL. Dừng API/worker trước khi nâng cấp.
DDL nền, tài khoản, dữ liệu và volume hiện có được giữ lại. Không cần khởi tạo lại database.
Khi đổi Docker project hoặc tên volume, thực hiện theo [hướng dẫn bảo toàn dữ liệu](docs/docker-migration.md).

## Cấu hình

### Backend và Docker

Cấu hình riêng nằm ở `.env` tại thư mục gốc; tham khảo `.env.example`.

| Nhóm | Biến chính | Ý nghĩa |
|---|---|---|
| HTTP | `API_HOST`, `API_PORT`, `CLIENT_ORIGINS` | Địa chỉ API và danh sách origin được phép |
| SQL | `DB_SERVER`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` | Kết nối database |
| Redis | `REDIS_URL` | Kết nối session, Streams và ledger media |
| Xác thực | `SESSION_SECRET`, `SESSION_IDLE_SECONDS` | Khóa ký cookie và thời hạn không hoạt động; mặc định 7.200 giây |
| Chẩn đoán | `DEV_PROBE_TOKEN` | Khóa probe development, độc lập với đăng nhập |
| Volume | `SQLSERVER_VOLUME_NAME`, `REDIS_VOLUME_NAME` | Tên volume cần tiếp tục sử dụng |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Credentials chỉ được Backend sử dụng |

Điền credentials từ phần API Keys của tài khoản Cloudinary trên máy phát triển.
Không cần unsigned upload preset. Không đặt secret vào biến `VITE_*` hoặc commit `.env`.
Nếu Cloudinary chưa cấu hình, API tài khoản vẫn hoạt động; giao diện khóa phần tải tệp.

Máy cài mới dùng tên volume chuẩn `my-project_book-auction-system_sqlserver_data` và
`my-project_book-auction-system_redis_data`. Khi biến volume thiếu/rỗng, Compose giữ fallback
`book-auction_sqlserver_data` và `book-auction_redis_data`; không tự dò hoặc chuyển dữ liệu từ volume khác.

### Frontend

`frontend/.env` chứa `VITE_API_URL`, mặc định `http://127.0.0.1:5000`.
Dùng `127.0.0.1` nhất quán cho Frontend và API để cookie hoạt động cùng site.

### Giới hạn media

| Loại | Định dạng | Giới hạn mặc định |
|---|---|---|
| Ảnh | JPEG, PNG, WebP | 12 tệp/bài; 10 MB/tệp |
| Video | MP4, WebM | 3 tệp/bài; 50 MB/tệp |

Điều chỉnh bằng `MEDIA_MAX_IMAGES`, `MEDIA_MAX_VIDEOS`, `MEDIA_IMAGE_MAX_MB`, `MEDIA_VIDEO_MAX_MB`.
API kiểm tra MIME, magic bytes và kích thước; tối đa hai upload đang xử lý mỗi tiến trình và 60 lần thử/tài khoản/giờ.
Đây là giới hạn tài nguyên của bản triển khai. Chưa có kiểm tra thời lượng video.

## Khởi động

Khi SQL Server và Redis đã healthy, chạy API, worker và React trong một terminal tại thư mục gốc:

```powershell
npm.cmd run dev:all
```

Log được gắn nhãn màu `[API]`, `[WORKER]` và `[WEB]`. Nhấn `Ctrl+C` để dừng cả ba.
Nếu một lệnh kết thúc, `concurrently` gửi lệnh dừng các lệnh còn lại.
Lệnh này không khởi động Docker hoặc chạy migration; hoàn thành các bước cài đặt trước khi sử dụng.

Sau khi pull bản có dependency mới, chạy `npm.cmd ci` một lần trước khi khởi động.
`concurrently` được cài trong dự án, không cần cài toàn cục.

Khi cần kiểm tra riêng từng tiến trình, có thể dùng các lệnh sau ở terminal riêng:

| Tiến trình | Lệnh |
|---|---|
| HTTP API | `npm.cmd run dev:api` |
| Worker | `npm.cmd run dev:worker` |
| React | `npm.cmd run dev:web` |

| Thành phần | Địa chỉ mặc định |
|---|---|
| Giao diện | `http://127.0.0.1:5173` |
| API / Socket.IO | `http://127.0.0.1:5000` |
| SQL Server | `127.0.0.1:14330` |
| Redis | `127.0.0.1:63790` |

Trong **Kiểm tra hệ thống**, nhập `DEV_PROBE_TOKEN` từ `.env` để gửi probe.
Trạng thái completed chỉ xác nhận đường đi hạ tầng đã hoạt động, không thay thế kiểm thử nghiệp vụ.

## Sử dụng

### Tài khoản và đăng nhập nhiều tab

1. Vào **Tài khoản → Đăng ký**, nhập họ tên, email và mật khẩu từ 12 đến 128 ký tự.
2. Sau khi đăng ký thành công, đăng nhập bằng tài khoản vừa tạo.
3. Admin được tạo bằng `npm.cmd run admin:create`, không qua API đăng ký công khai.
4. Có thể đăng nhập Admin ở tab thứ nhất và người dùng ở tab thứ hai trong cùng trình duyệt.
5. F5 giữ phiên của tab hiện tại. Tab mới yêu cầu đăng nhập lại; đăng xuất chỉ thu hồi phiên của tab đó.

Mật khẩu lưu bằng Argon2id; cookie HttpOnly, SameSite=Lax và Secure khi production.
Session hết hạn sau hai giờ không hoạt động và được gia hạn khi sử dụng. CSRF token chỉ giữ trong bộ nhớ.
`sessionStorage` chỉ chứa mã chọn tab ngẫu nhiên, không chứa mật khẩu, session ID hoặc token xác thực.
Thông tin kỹ thuật và giới hạn vòng đời tab nằm trong [quyết định xác thực](docs/decisions.md).

Giới hạn thử: đăng nhập 10 lần/email và 50 lần/IP trong 15 phút; đăng ký 10 lần/IP trong 15 phút;
cấp CSRF 60 lần/IP/phút. Bộ đếm tính cả lần thành công. Khi bị giới hạn, chờ theo header `Retry-After`.

### Đăng sách, kiểm duyệt và kích hoạt

1. Người dùng mở **Bài của tôi → Đăng sách mới**, nhập thông tin sách, tình trạng và bằng chứng quý hiếm.
2. Chọn ảnh/video, chờ upload hoàn tất; nhập giá khởi điểm, giá kết thúc sớm và bước giá.
3. Các ô tiền chỉ nhận chữ số, thêm dấu chấm hàng nghìn tự động, ví dụ `1.500.000`.
   API nhận chuỗi nguyên `1500000`, giữ chính xác đến 18 chữ số. Giá hiện tại là dữ liệu từ lượt đặt giá, không phải ô chủ sách tự nhập.
4. Gửi kiểm duyệt: bài và phiên cùng chờ duyệt, chưa có lịch.
5. Admin mở **Kiểm duyệt**, xem thông tin/media và nguồn đối chiếu. Ghi lý do;
   phê duyệt yêu cầu xác nhận đã kiểm tra bằng chứng quý hiếm. Có thể từ chối và chỉ rõ phần cần bổ sung.
6. Chủ sách bổ sung bài bị từ chối rồi gửi lại; giữ ID bài/phiên, media đã lưu và lịch sử kiểm duyệt.
7. Sau khi được duyệt, chủ sách đặt giờ bắt đầu trong tương lai và giờ kết thúc sau đó, rồi kích hoạt đúng phiên hiện có.
8. Phiên đã kích hoạt xuất hiện trong **Danh mục**. API công khai không trả `gia_toi_thieu`.

Chưa có phân tích AI thì Admin kiểm tra thủ công; không tạo điểm 0 hoặc bản phân tích lỗi giả.
Tình trạng đẹp không thay thế điều kiện quý hiếm. Nếu đã có kết quả AI trong database, giao diện hiển thị để tham khảo.
Giờ được lưu theo UTC và kiểm tra bằng đồng hồ SQL Server.

### Đặt giá và xem kết quả

1. Đăng nhập bằng tài khoản người dùng, mở **Danh mục → Xem chi tiết**.
2. Nhập mức giá; giao diện tự thêm dấu chấm. Lượt đầu từ giá khởi điểm, lượt sau tăng ít nhất một bước.
3. Bấm **Gửi mức giá**; “đang chờ” chỉ xác nhận đã tiếp nhận. Chỉ thông báo chấp nhận sau khi SQL COMMIT.
4. Nếu mất phản hồi mạng, **Thử lại cùng yêu cầu** giữ nguyên mã và mức giá, không tạo lượt trùng.
5. Sau mỗi lượt hợp lệ của cùng người trong cùng phiên, chờ đủ thời gian cấu hình (10–30 giây).
6. Phiên tự kết thúc khi hết giờ hoặc một giá hợp lệ đạt/vượt ngưỡng ẩn. Không có nút kết thúc thủ công.
7. **Tải lại phiên và kết quả** lấy trạng thái SQL mới nhất. Danh mục giữ phiên đã kết thúc để xem kết quả.

Hết giờ có lượt hợp lệ thì người có giá cao nhất thắng dù chưa đạt ngưỡng. Không có lượt hợp lệ thì
không có người thắng và không tạo giao dịch. Người bán không tự đặt giá vào sách của mình; Admin chỉ xem.
Giao dịch được tạo ở trạng thái chờ xác nhận; trao đổi/xác nhận hoàn tất chưa được triển khai.
Chi tiết xử lý và phục hồi tại [Xử lý đấu giá](docs/auction-processing.md).

### Đăng lại và quản lý media

Chỉ đăng lại khi phiên mới nhất của bản sách đã kết thúc và có kết quả rõ **không có người thắng**.
Tạo bài/phiên mới, giữ `sach_id`, giá và lịch sử trước đó. Có thể dùng lại media của bài cũ.
Thiếu kết quả không đủ điều kiện đăng lại; không có chức năng kết thúc thủ công.

Tệp nằm ở Cloudinary, SQL lưu URL/public_id; Redis chỉ lưu vé upload và lịch cleanup.
Vé chưa dùng có hiệu lực một giờ. Cleanup kiểm tra tham chiếu SQL trước khi xóa tệp bỏ dở.
File đã gắn bài hoặc lịch sử được giữ; claim chưa rõ kết quả COMMIT được giữ để đối soát thủ công.
Mất Redis có thể để lại media mồ côi; cơ chế hiện tại không phải distributed transaction.

Hiện chưa có API/nút xóa bài. Xóa SQL thủ công không tự xóa media Cloudinary.
**Bỏ tệp** trước khi gửi bài xóa tệp chưa dùng nếu không có tham chiếu SQL.
Script smoke bài đăng có quy trình dọn riêng cả SQL và Cloudinary cho dữ liệu thử của lần chạy.

## Kiểm tra

Giữ `npm.cmd run dev:all`, SQL Server và Redis chạy; mở terminal thứ hai để thực hiện các lệnh kiểm tra.
Kiểm thử bài đăng cần Cloudinary thật.

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build
npm.cmd run smoke
npm.cmd run smoke:auth
npm.cmd run smoke:m4
npm.cmd run smoke:m5
```

| Lệnh | Phạm vi |
|---|---|
| `check` | Kiểm tra cú pháp JavaScript máy chủ và script |
| `test` | HTTP, xác thực, media, phiên tab, giá/cooldown; Redis/SQL thật bật bằng opt-in |
| `build` | Build Frontend production |
| `smoke` | Hạ tầng thật, Socket.IO và probe qua Streams |
| `smoke:auth` | Đăng ký/đăng nhập, CSRF, cookie, quyền và thu hồi phiên |
| `smoke:m4` | Cloudinary, tạo/duyệt/kích hoạt bài, rollback SQL, retry và điều kiện đăng lại |
| `smoke:m5` | API/worker thật, tranh giá, replay, hai kiểu kết thúc, kết quả/giao dịch và phục hồi sau COMMIT trước ACK; không cần Cloudinary |

Smoke tạo dữ liệu UUID riêng, dọn đúng dữ liệu thử và trả FAIL nếu không dọn hoàn tất.
Kiểm thử đăng lại dùng fixture chỉ thay đổi phiên của tài khoản smoke trong development.
Ảnh/video thật, bằng chứng sách và các kiểm tra tải lớn vẫn cần nghiệm thu riêng.
Kết quả đã chạy và giới hạn xác minh được ghi tại [VALIDATION.md](VALIDATION.md).

Bật thêm các bài Redis thật trong PowerShell:

```powershell
$env:AUTH_TEST_REDIS_URL = "redis://127.0.0.1:63790"
npm.cmd test
Remove-Item Env:AUTH_TEST_REDIS_URL
```

Các bài này dùng prefix UUID riêng và tự dọn khóa của chúng, không xóa toàn bộ Redis.

Kiểm thử SQL tự động yêu cầu database riêng có tên bắt đầu bằng `BookAuctionTest_` và Redis kiểm thử:

```powershell
$env:DB_DATABASE = "BookAuctionTest_Local"
$env:AUTH_TEST_REDIS_URL = "redis://127.0.0.1:63790"
$env:AUCTION_TEST_SQL = "true"
npm.cmd test
Remove-Item Env:AUCTION_TEST_SQL
Remove-Item Env:AUTH_TEST_REDIS_URL
Remove-Item Env:DB_DATABASE
```

Lệnh này có thể tạo database kiểm thử nếu chưa có, nâng schema và chỉ dọn fixture UUID của lần chạy.
Không đặt tên database làm việc của nhóm vào biến kiểm thử. Với database đang dùng, chạy `smoke:m5`
sau migration và khi API/worker đã khởi động; script tự tạo/dọn tài khoản và phiên thử riêng.

## Xử lý sự cố

| Hiện tượng | Kiểm tra |
|---|---|
| SQL readiness chưa đạt 20 bảng/152 cột | Kiểm tra đúng database, kết nối và chạy `npm.cmd run db:migrate` |
| Không upload được | Kiểm tra ba biến Cloudinary, giới hạn tệp và khởi động lại API |
| Lỗi CSRF hoặc phiên hết hạn | F5 tab hiện tại và đăng nhập lại nếu cần |
| HTTP 409 khi duyệt/kích hoạt | Tải lại chi tiết trước khi thao tác; không dùng `row_version` cũ |
| Hai tab vẫn đổi tài khoản cùng nhau | Cập nhật cả Backend/Frontend, khởi động lại API/web và F5 từng tab |
| Báo thiếu phiên bản dữ liệu | Khởi động API bản mới, F5 và mở lại chi tiết bài; token API phải có 16 ký tự hex |
| Chưa có kết quả AI | Sử dụng kiểm duyệt thủ công; dịch vụ phân tích chưa được tích hợp |
| Tưởng mất dữ liệu sau đổi Docker project | Kiểm tra mount thực tế và biến tên volume; xem hướng dẫn chuyển đổi |

Cấu hình hiện tại phục vụ phát triển cục bộ. Triển khai production cần HTTPS, cấu hình origin/proxy phù hợp
và kiểm tra lại cookie Secure. Không commit thông tin kết nối hoặc dữ liệu xác thực riêng.

## Tài liệu

- [Kiến trúc hệ thống](docs/architecture.md)
- [Luồng nghiệp vụ và hợp đồng API](docs/flows.md)
- [Xử lý đặt giá và phục hồi](docs/auction-processing.md)
- [Quyết định kỹ thuật](docs/decisions.md)
- [Bản đồ mã nguồn](docs/file-map.md)
- [Trạng thái chức năng và công việc](docs/tasks.md)
- [Bằng chứng kiểm thử](VALIDATION.md)
- [Chuyển Docker project và bảo toàn dữ liệu](docs/docker-migration.md)
- [Quản lý báo cáo, slide và sơ đồ](academic/README.md)
