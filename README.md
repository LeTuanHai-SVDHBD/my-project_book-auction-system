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

Mốc 4 đã thêm đăng sách, media Cloudinary, kiểm duyệt thủ công, bổ sung bài từ chối,
đặt lịch/kích hoạt và đăng lại cùng bản sách. AI ở Mốc 7; đặt giá/kết thúc ở Mốc 5 chưa triển khai.
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
`db:init` tạo schema nền khi chưa có, rồi chạy migration 002 lên 19 bảng/144 cột.
Database Mốc 3 có 142 cột được nâng cấp bằng cách thêm hai cột nullable; dữ liệu giữ nguyên.
`admin:create` yêu cầu nhập tên, email và mật khẩu kín trong terminal.

**Máy đã hoàn thành phần môi trường:** cập nhật file, chạy `npm.cmd ci`,
`npm.cmd run setup:auth`, `npm.cmd run setup:media` và `npm.cmd run db:migrate`.
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
Nút kiểm tra quyền gọi backend. Màn hình duyệt bài nằm ở tab **Kiểm duyệt** sau khi đăng nhập Admin.

## 7. Kiểm tra bằng lệnh

Giữ các dịch vụ và ứng dụng đang chạy:

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build
npm.cmd run smoke
npm.cmd run smoke:auth
npm.cmd run smoke:m4
```

- `test` chạy hợp đồng HTTP, quy tắc Mốc 4, media và Argon2 thật với SQL/Cloudinary giả.
  Bài Redis thật mặc định SKIP, bật bằng `AUTH_TEST_REDIS_URL`.
- `smoke` kiểm tra hạ tầng thật, worker và probe.
- `smoke:auth` kiểm tra đăng ký, đăng nhập, cookie, CSRF, phân quyền và thu hồi phiên;
  tạo rồi dọn tài khoản thử riêng.
- `smoke:m4` cần Cloudinary thật; kiểm tra luồng Mốc 4, rollback SQL và kiểm duyệt đồng thời.
  Script chỉ chạy trong development, tạo ba tài khoản thử (có một Admin) và dọn đúng dữ liệu/media của lần chạy.
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


## 11. Bắt đầu Mốc 4 trên máy đã hoàn thành Mốc 3

Giữ nguyên `.env`, database, tài khoản và Docker volume hiện tại. Dừng terminal API bằng Ctrl+C trước khi cập nhật.

```powershell
git switch feat/Hai
git pull --ff-only origin feat/Hai
npm.cmd ci
npm.cmd run setup:media
npm.cmd run db:migrate
```

Nếu Git báo có thay đổi cục bộ, giữ/lưu các thay đổi đó trước khi pull; không dùng `reset --hard`.
`db:migrate` chạy `002_cloudinary_metadata.sql`, chỉ thêm `cloudinary_public_id` nullable vào `HinhAnh` và `Video`
cùng index tra cứu. Có thể chạy lại. `001_schema.sql` giữ nguyên; không cần xóa database hay chạy lại DDL nền.
Readiness SQL của Mốc 4 cần **19 bảng/144 cột** (Mốc 3 là 142 cột).

Mở `.env` ở **gốc dự án**, điền từ tài khoản Cloudinary của bạn:

```dotenv
CLOUDINARY_CLOUD_NAME=ten_cloud_cua_ban
CLOUDINARY_API_KEY=api_key_cua_ban
CLOUDINARY_API_SECRET=api_secret_cua_ban
```

Chỉ sửa ba giá trị trên máy; không gửi secret qua chat, không thêm vào `frontend/.env` hay biến `VITE_*`.
Lấy chúng trong phần API credentials của Cloudinary; không cần cấu hình unsigned upload preset.
API upload xác thực với Cloudinary từ server bằng REST; không thêm dependency.

Chạy lại API, worker và React theo mục 5. API vẫn khởi động được khi Cloudinary chưa cấu hình;
chức năng upload sẽ bị khóa và biểu mẫu hiển thị lý do. Lưu URL/provider ID ở SQL, tệp gốc ở Cloudinary;
không lưu tệp vào Redis, cột SQL nhị phân hay thư mục upload trong repository.

### 11.1. Đi qua luồng trên giao diện

1. Đăng nhập **người dùng** → **Bài của tôi → Đăng sách mới**.
2. Nhập thông tin sách, tình trạng, bằng chứng quý hiếm; chọn ảnh/video và chờ tải xong.
3. Nhập giá nguyên VND không dấu phân cách, bước giá, thời gian chờ 10–30 giây → **Gửi kiểm duyệt**.
4. Bài và phiên cùng chờ duyệt, chưa có lịch. Chủ sách xem trạng thái trong **Bài của tôi**.
5. Dùng trình duyệt khác hoặc cửa sổ riêng đăng nhập **Admin → Kiểm duyệt → Xem chi tiết**.
6. Kiểm tra thông tin, ảnh/video và nguồn đối chiếu. Ghi lý do; khi duyệt phải xác nhận đã kiểm tra bằng chứng quý hiếm.
   Có thể từ chối, chỉ rõ phần cần bổ sung. Chủ sách dùng **Bổ sung và gửi duyệt lại**; giữ bài/phiên và lịch sử,
   bổ sung mô tả, giá, media. Media đã lưu được giữ lại; không sửa bản ghi sách đang dùng trong lịch sử.
7. Sau khi được duyệt, chủ sách tải lại chi tiết, chọn giờ bắt đầu trong tương lai và giờ kết thúc sau đó → **Đặt lịch và kích hoạt**.
   Giờ nhập theo máy người dùng, gửi UTC và kiểm tra bằng đồng hồ SQL Server. ID phiên giữ nguyên.
8. Phiên đã kích hoạt xuất hiện trong **Danh mục**; người mua không nhận `gia_toi_thieu` từ API.
   Chức năng đặt giá và tự chốt phiên sẽ có ở Mốc 5.

AI chưa được gọi trong Mốc 4: hiển thị **Chưa có phân tích AI**, không tạo điểm 0 hoặc kết quả lỗi giả.
Admin vẫn duyệt thủ công. Nếu database đã có phân tích, giao diện hiển thị dữ liệu đó để tham khảo.
Thiếu bằng chứng phải được ghi rõ trong nhận xét; tình trạng đẹp không thay thế điều kiện quý hiếm.

**Đăng lại:** chỉ khi phiên **mới nhất** của bản sách đã `da_ket_thuc` và có `KetQuaDauGia`
`khong_co_nguoi_thang`. Tạo bài/phiên mới giữ `sach_id`, không ghi đè giá hoặc lịch sử cũ;
có thể dùng lại media của bài trước. Không có nút kết thúc thủ công để tạo điều kiện đăng lại.
Trước Mốc 5, kịch bản này được kiểm tra bằng fixture riêng trong `smoke:m4`.

### 11.2. Media và xử lý lỗi

| Cấu hình | Mặc định kỹ thuật |
|---|---|
| Ảnh | JPEG, PNG, WebP; `MEDIA_IMAGE_MAX_MB=10`, `MEDIA_MAX_IMAGES=12` |
| Video | MP4, WebM; `MEDIA_VIDEO_MAX_MB=50`, `MEDIA_MAX_VIDEOS=3` |
| Upload đang xử lý | Tối đa 2 request/API process; 60 lần/tài khoản/giờ |
| Vé upload chưa dùng | Có hiệu lực 1 giờ; phải thuộc đúng chủ sách |

Đây là giới hạn tài nguyên của bản triển khai, không phải bộ tiêu chí chấm điểm trong báo cáo.
Có thể cấu hình trong `.env` theo giới hạn gói Cloudinary; khởi động lại API sau khi đổi.
Backend kiểm tra MIME, kích thước và magic bytes; Cloudinary tiếp tục giải mã tệp. Chưa có kiểm tra thời lượng video.

Ảnh/video tải xong được cấp vé Redis, chỉ vé được gửi cùng bài. Không nhận URL hay `public_id` do client khai báo.
Claim vé nguyên tử trước khi vào SQL; không upload/gọi AI trong giao dịch SQL.
Nếu SQL rollback chắc chắn, vé được trả lại để thử lại. Nếu không rõ COMMIT đã thành công hay chưa,
hệ thống giữ vé claim để đối soát, không tự xóa file có thể đang được sử dụng.

API chạy cleanup mỗi phút: vé hết hạn chỉ bị xóa Cloudinary sau khi kiểm tra không có tham chiếu SQL.
SQL hoặc Cloudinary lỗi thì giữ lại để thử sau. File đã gắn bài (kể cả lịch sử cũ) được giữ lại.
Nếu tiến trình chết trước acknowledgement, SQL reference giúp cleanup nhận diện file đã lưu.
Claim chưa rõ và không có reference được giữ lại, ghi cảnh báo số lượng; cần đối soát thủ công sau khi dừng API,
đây là giới hạn phục hồi hiện tại. Redis mất dữ liệu có thể để lại media mồ côi; dùng AOF và không xóa Redis/volume.

Mất phản hồi khi tạo bài: dùng lại `ma_yeu_cau` để lấy kết quả cũ, không tạo thêm sách/phiên.
Cùng mã yêu cầu luôn trả bài đã tạo trước đó; không dùng lại mã đó cho nội dung mới.
HTTP 409 khi thao tác bằng `row_version` cũ: tải lại bài rồi thao tác lại.
Vé hết hạn hoặc đã claim chưa rõ: kiểm tra **Bài của tôi** trước khi tải lại tệp và tạo yêu cầu mới.

### Lưu ý khi xóa bài hoặc media

Hiện tại chưa có API/nút xóa bài đăng. Xóa bản ghi thủ công trong SQL không gọi Cloudinary;
media đã gắn bài không tự bị xóa theo. Cleanup định kỳ chỉ xử lý vé upload bỏ dở/hết hạn còn trong ledger,
không quét xóa mọi file Cloudinary không có bản ghi SQL.

- **Bỏ tệp trước khi gửi bài:** API xóa tệp chưa dùng trên Cloudinary sau khi kiểm tra không có tham chiếu SQL.
- **Media của bài đã gửi, bị từ chối hoặc lịch sử phiên cũ:** giữ lại; đăng lại có thể dùng chung tệp.
- **Media của smoke M4:** script có bước dọn SQL rồi gọi Cloudinary destroy riêng cho đúng tệp thử của lần chạy.

Khi bổ sung chức năng xóa bài trong tương lai, cần xử lý quyền/trạng thái phiên, giữ lịch sử cần thiết
và chỉ xóa file khi không còn bài nào tham chiếu. Đây chưa phải chức năng đã triển khai.

### 11.3. API Mốc 4

| Phương thức | Endpoint | Quyền |
|---|---|---|
| GET | `/api/posts/catalog`, `/api/posts/catalog/:id` | Công khai; chỉ bài duyệt + phiên kích hoạt, projection không có ngưỡng giá |
| GET | `/api/posts/mine` | Người dùng; bài của mình |
| GET | `/api/posts/pending` | Admin; hàng chờ kiểm duyệt |
| GET | `/api/posts/:id` | Chủ bài hoặc Admin; có giá riêng và lịch sử duyệt |
| POST | `/api/posts` | Người dùng + CSRF; tạo mới |
| POST | `/api/posts/:id/resubmit` | Chủ bài bị từ chối + CSRF |
| POST | `/api/posts/:id/relist` | Chủ bài đủ điều kiện đăng lại + CSRF |
| POST | `/api/posts/:id/review` | Admin + CSRF; lý do bắt buộc |
| POST | `/api/posts/:id/activate` | Chủ bài đã duyệt + CSRF; không tạo phiên mới |
| GET | `/api/media/config` | Cấu hình công khai, không bí mật |
| POST | `/api/media/image`, `/api/media/video` | Người dùng + CSRF; body nhị phân, Content-Type đúng MIME |
| DELETE | `/api/media/:upload_id` | Chủ vé + CSRF; chỉ bỏ tệp chưa gắn bài |

Danh sách tối đa 30 bài/trang, dùng `?before=<bai_dang_id>` theo `nextBefore` để xem tiếp.
Giá trong JSON là **chuỗi số nguyên**, giữ đủ chính xác DECIMAL(18,0).
Tạo bài gửi `ma_yeu_cau` UUID v4, `sach`, `bai_dang`, `phien`, `media: [{upload_id,tieu_de}]`.
Đăng lại bỏ `sach`, thêm `reuse_media`; gửi duyệt lại bỏ `sach`/`ma_yeu_cau`, gửi `row_version`.
Duyệt nhận `quyet_dinh: phe_duyet|tu_choi`, `ly_do`, `xac_nhan_quy_hiem`, `row_version`.
Kích hoạt nhận `thoi_gian_bat_dau`, `thoi_gian_ket_thuc` ISO có múi giờ và `row_version`.

### 11.4. Nghiệm thu

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build
npm.cmd run smoke
npm.cmd run smoke:auth
npm.cmd run smoke:m4
```

`smoke:m4` tạo dữ liệu UUID riêng và tải một PNG thật lên Cloudinary; có sử dụng tài nguyên gói của bạn.
Kiểm tra tạo/retry, rollback SQL khi gắn media lỗi, quyền/CSRF, từ chối/bổ sung, duyệt đồng thời,
lịch kích hoạt, ẩn ngưỡng giá và điều kiện đăng lại. Fixture kết thúc phiên chỉ thay đổi phiên của tài khoản smoke,
không phải API kết thúc thủ công. Cuối cùng dọn dữ liệu SQL và media riêng; dọn lỗi trả FAIL và in ID để đối soát.
Video thật và chất lượng bằng chứng cần thử thủ công bằng tệp của nhóm.
Chỉ xác nhận Mốc 4 hoàn tất trên máy nhóm khi các lệnh và luồng giao diện này đạt.


### 11.5. Cập nhật sửa lỗi phiên bản dữ liệu ngày 23/10/2026

Nếu smoke dừng ở bước kích hoạt trước duyệt với HTTP 400 `INVALID_POST_INPUT`, hoặc Admin nhận
“Thiếu phiên bản dữ liệu”, cập nhật mã sửa `row_version`:

```powershell
git pull --ff-only origin feat/Hai
```

Dừng rồi chạy lại terminal API (`npm.cmd run dev:api`), F5 trang React, mở lại chi tiết bài và thử kiểm duyệt.
Chạy lại `npm.cmd run smoke:m4` trong terminal khác khi API/worker đang chạy.
Bản sửa dùng database và cấu hình hiện tại, không có migration mới.

Backend đọc phiên bản SQL dưới dạng BINARY(8), mã hóa bytes thành hex 16 ký tự tại model,
dùng cùng encoder cho danh sách, chi tiết và dòng đang khóa. Client tiếp tục gửi `row_version` nhận từ API;
không tự tạo mã mặc định hay bỏ kiểm tra version. Smoke kiểm tra hình dạng token ngay sau khi đọc bài,
để phân biệt lỗi dữ liệu phiên bản với lỗi trạng thái nghiệp vụ.
