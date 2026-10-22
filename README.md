# Mốc 2 Dựng môi trường hệ thống đấu giá sách

Bộ khung này dùng bản Word `TieuLuanDAMH-Tuan6-Nhom15(3).docx` làm căn cứ. Hai quan hệ nullable và quan hệ Phiên–Kết quả đã được đối chiếu. Phần trích dẫn trong Word được giữ theo lựa chọn của nhóm.

Mục tiêu của Mốc 2 là chạy được React, Express, SQL Server, Redis và một tiến trình worker riêng. Khi gửi một sự kiện kiểm tra, API đưa vào Redis Streams; worker đọc sự kiện, thực hiện `SELECT 1` trong SQL Server, lưu kết quả kiểm tra vào Redis; giao diện đọc kết quả để hiển thị.

Đây là bộ khung phát triển mới, có thể giải nén ra thư mục riêng để chạy thử. Chưa có mã nguồn dự án hiện tại được cung cấp trong phiên này nên bộ khung chưa được ghép vào một repository có sẵn.

## 1 Kết quả cần đạt

| Thành phần | Kết quả kiểm tra |
|---|---|
| React | Mở được màn hình kiểm tra tại `http://127.0.0.1:5173` |
| API Express | `GET /api/health/live` trả HTTP 200 |
| SQL Server | Kết nối được `BookAuctionDB`, nhận diện 19 bảng và 142 trường |
| Redis | Trả `PONG`, có consumer group cho luồng thử nghiệm |
| Worker | Chạy bằng tiến trình Node.js riêng, cập nhật heartbeat |
| Socket.IO | Trình duyệt nhận được `system:hello` |
| Luồng sự kiện | Gửi probe nhận HTTP 202 `queued`, sau đó nhận `completed` do worker xử lý |

Các bước tạo tài khoản, kiểm duyệt, đặt giá và kết thúc phiên sẽ được xây ở các mốc sau. Luồng thử nghiệm hiện tại không thêm/sửa dữ liệu đấu giá và không xác định người thắng. Socket.IO trong mốc này mới kiểm tra kết nối; kết quả probe được lấy lại qua API.

## 2 Công cụ cần có trên Windows

- Windows 11 x64 và VS Code.
- Node.js **24 LTS** kèm npm. Tải tại <https://nodejs.org/en/download>.
- Docker Desktop chạy Linux containers; mở ứng dụng và chờ Docker Engine hoạt động. Hướng dẫn chính thức: <https://docs.docker.com/desktop/setup/install/windows-install/>.
- SSMS là tùy chọn để xem bảng và dữ liệu: <https://learn.microsoft.com/en-us/ssms/install/install>.

Trong VS Code, mở **Terminal → New Terminal**, chọn **PowerShell** và kiểm tra:

```powershell
node --version
npm.cmd --version
docker --version
docker compose version
docker info
```

`node --version` cần ra `v24.x.x`. Các gói được cài theo `package-lock.json`; Vite 8 và Express 5 đã được chọn cho bộ khung này. `npm.cmd` chạy được trong PowerShell mà không cần thay Execution Policy.

## 3 Mở đúng thư mục dự án

Giải nén `DauGiaSach_Moc2.zip`. Ví dụ thư mục sau khi giải nén là:

```text
D:\Projects\dau-gia-sach-moc2
```

Trong VS Code chọn **File → Open Folder**, mở thư mục có cùng lúc các tệp `package.json`, `package-lock.json`, `compose.yaml` và hai thư mục `backend`, `frontend`.

Mọi lệnh bên dưới chạy tại thư mục gốc này, trừ khi có chỉ dẫn khác.

## 4 Cài thư viện và tạo cấu hình

Chạy lần lượt:

```powershell
npm.cmd ci
npm.cmd run setup
```

Lệnh `setup` tạo:

| Tệp | Nội dung |
|---|---|
| `.env` ở thư mục gốc | Cổng, cấu hình SQL/Redis, mật khẩu SQL và token kiểm tra tự sinh |
| `frontend/.env` | Địa chỉ API dành cho React |

Nếu `.env` đã có, script giữ nguyên tệp đó. Thông tin kết nối SQL không nằm trong biến `VITE_*` hoặc mã phía trình duyệt. `.env` và `node_modules` đã được loại khỏi Git và tệp ZIP cung cấp.

Mở `.env` trong VS Code để kiểm tra tên biến. Không cần sửa mật khẩu tự sinh. Các giá trị mặc định:

| Biến | Giá trị |
|---|---|
| `API_HOST` / `API_PORT` | `127.0.0.1` / `5000` |
| `DB_SERVER` / `DB_PORT` | `127.0.0.1` / `14330` |
| `DB_DATABASE` / `DB_USER` | `BookAuctionDB` / `sa` |
| `DB_PASSWORD` | Được tạo khi chạy setup |
| `REDIS_URL` | `redis://127.0.0.1:63790` |
| `DEV_PROBE_TOKEN` | Được tạo khi chạy setup |

Mật khẩu SQL và chứng chỉ tin cậy cục bộ phục vụ môi trường phát triển. Tài khoản `sa` trong bộ khung này dùng cho khởi tạo và kiểm tra ban đầu; phân quyền tài khoản ứng dụng sẽ được cấu hình khi triển khai các chức năng nghiệp vụ.

## 5 Chạy SQL Server và Redis

Mở Docker Desktop trước, sau đó chạy:

```powershell
docker compose up -d
docker compose ps
```

Lần đầu Docker tải hai image. Chờ cả `sqlserver` và `redis` chuyển sang trạng thái **healthy**; SQL Server có thể cần vài phút. Kiểm tra lại bằng `docker compose ps`.

| Dịch vụ | Bên trong container | Cổng trên Windows |
|---|---|---|
| SQL Server 2022 Developer | `1433` | `14330` |
| Redis 8 | `6379` | `63790` |

Cổng riêng giúp hạn chế trùng với các dịch vụ SQL/Redis đã cài trên máy. Cả hai cổng chỉ được công bố ở địa chỉ loopback của máy phát triển.

Nếu cần xem quá trình khởi động:

```powershell
docker compose logs --tail 50 sqlserver
docker compose logs --tail 50 redis
```

SQL Server và Redis dùng volume để giữ dữ liệu. Redis đang bật AOF với `appendfsync everysec`; đây là cấu hình phát triển ban đầu cần được ghi lại và đánh giá trong thực nghiệm phục hồi sau này.

## 6 Tạo database và 19 bảng

Sau khi Docker đã healthy:

```powershell
npm.cmd run db:init
```

Script sẽ:

1. Kết nối SQL Server qua TCP `127.0.0.1:14330`.
2. Tạo `BookAuctionDB` nếu database chưa tồn tại.
3. Chạy `backend/migrations/001_schema.sql` để tạo 19 bảng theo thiết kế đã chốt.
4. Nếu đã nhận diện đủ 19 bảng và 142 trường, giữ nguyên dữ liệu và không chạy lại DDL.
5. Nếu chỉ tồn tại một phần các bảng/cột dự kiến, dừng và thông báo để kiểm tra.

Kết quả lần đầu cần có:

```text
Đã tạo BookAuctionDB.
Đã tạo schema 19 bảng theo bản Word (3).
```

Việc kiểm tra 19 bảng/142 trường chỉ nhận diện cấu trúc cơ bản, không thay thế kiểm tra toàn bộ ràng buộc hoặc kiểm thử nghiệp vụ. Script SQL tạo cấu trúc và chưa có dữ liệu mẫu, người dùng hoặc Admin.

Muốn xem bằng SSMS:

| Ô đăng nhập SSMS | Giá trị |
|---|---|
| Server name | `127.0.0.1,14330` — dùng dấu phẩy |
| Authentication | SQL Server Authentication |
| Login | `sa` |
| Password | Giá trị `DB_PASSWORD` trong `.env` |
| Trust server certificate | Bật cho môi trường cục bộ này |

Sau khi kết nối, mở **Databases → BookAuctionDB → Tables**. Trong một cửa sổ truy vấn chọn đúng `BookAuctionDB`, chạy:

```sql
SELECT name FROM sys.tables WHERE schema_id = SCHEMA_ID('dbo') ORDER BY name;
```

Nếu nhóm dùng SQL Server đang có sẵn thay cho container, chỉ khởi động Redis bằng `docker compose up -d redis`; sửa `DB_SERVER`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` theo SQL Server đã bật TCP và SQL Authentication. Cấu trúc schema và các lệnh Node.js giữ nguyên.

## 7 Mở ba terminal để chạy ứng dụng

Trong VS Code, dùng dấu **+** ở bảng Terminal để mở ba terminal. Cả ba đều đứng tại thư mục gốc dự án.

**Terminal 1 — API:**

```powershell
npm.cmd run dev:api
```

Cần thấy log `API đã chạy`, cổng `5000`.

**Terminal 2 — worker:**

```powershell
npm.cmd run dev:worker
```

Cần thấy log `Worker kiểm tra hạ tầng đã chạy`. Đây là tiến trình riêng, không chạy bên trong request HTTP của API.

**Terminal 3 — React:**

```powershell
npm.cmd run dev:web
```

Mở <http://127.0.0.1:5173>. Sau vài giây, cần thấy năm ô **Sẵn sàng**: API, SQL Server, Redis, Event Worker và Socket.IO. Ô SQL cần hiện **19/19 bảng, 142/142 trường**.

API có thể vẫn mở cổng khi database hoặc Redis chưa chạy. Đó là lý do kiểm tra readiness riêng; liveness HTTP 200 chưa đủ để kết luận toàn hệ thống sẵn sàng.

## 8 Gửi sự kiện kiểm tra

1. Mở `.env` ở thư mục gốc.
2. Sao chép phần giá trị của `DEV_PROBE_TOKEN`, không sao chép `DEV_PROBE_TOKEN=`.
3. Dán vào ô **Khóa kiểm tra cục bộ** trên màn hình React.
4. Bấm **Gửi sự kiện kiểm tra**.
5. Ban đầu hiển thị **Yêu cầu đã xếp hàng**.
6. Khi worker xử lý xong, hiển thị **Worker đã đọc được SQL Server**, mã yêu cầu và tên worker.

Token này bảo vệ API chẩn đoán cục bộ. Đây không phải chức năng đăng nhập người dùng của Mốc 3; token không được lưu trong Local Storage hoặc đưa vào biến `VITE_*`.

Đường đi thực tế:

| Thứ tự | Thành phần | Thao tác |
|---|---|---|
| 1 | React | Gửi `POST /api/dev/probes` |
| 2 | Express | Ghi trạng thái `queued` và đưa sự kiện vào Redis Streams trong một MULTI |
| 3 | Worker | Đọc qua consumer group, kiểm tra định dạng |
| 4 | SQL Server | Thực hiện truy vấn kiểm tra chỉ đọc |
| 5 | Worker | Lưu `completed` vào Redis rồi XACK thông điệp |
| 6 | React | Lấy lại kết quả qua API |

Luồng hạ tầng dùng stream `bookauction:infra:requests`, không dùng chung với luồng đặt giá tương lai. Kết quả kiểm tra có TTL 10 phút. Worker dùng kết nối Redis riêng cho lệnh BLOCK, nhận lại thông điệp pending bằng XAUTOCLAIM khi idle ít nhất 30 giây. Heartbeat hết hạn sau 10 giây nếu worker không tiếp tục cập nhật.

## 9 Kiểm tra Mốc 2 bằng lệnh

Giữ ba terminal đang chạy. Mở terminal thứ tư tại thư mục gốc:

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build
npm.cmd run smoke
```

| Lệnh | Nội dung kiểm tra |
|---|---|
| `check` | Cú pháp JavaScript phía máy chủ và script |
| `test` | Kiểm tra API và cấu hình bằng dữ liệu giả lập; không cần Docker |
| `build` | Biên dịch React thành `frontend/dist` |
| `smoke` | Gọi API thật, kiểm tra SQL/Redis/worker, nhận Socket.IO và gửi probe qua Streams |

`smoke` chỉ PASS khi các dịch vụ thật đã chạy. API trả 503 khi thiếu SQL, Redis hoặc worker; không gán trạng thái xanh để bỏ qua lỗi kết nối.

Có thể xem riêng hai API:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/health/live
Invoke-RestMethod http://127.0.0.1:5000/api/health/ready | ConvertTo-Json -Depth 6
```

## 10 Vị trí các tệp chính

| Tệp/thư mục | Vai trò |
|---|---|
| `compose.yaml` | Chạy SQL Server và Redis |
| `.env.example` / `scripts/setup.mjs` | Mẫu cấu hình và tạo cấu hình riêng trên máy |
| `backend/migrations/001_schema.sql` | DDL của 19 bảng |
| `backend/scripts/initDatabase.js` | Tạo database, chạy DDL khi chưa có bảng |
| `backend/src/config` | Nạp biến môi trường, kết nối SQL/Redis |
| `backend/src/server.js` | Điểm khởi động API và Socket.IO |
| `backend/src/worker.js` | Điểm khởi động worker riêng |
| `backend/src/events` | Xuất bản, đọc và xác nhận thông điệp thử nghiệm |
| `backend/src/processors/systemProbe.processor.js` | Truy vấn kiểm tra SQL cho probe |
| `backend/src/controllers` | Tổng hợp trạng thái sẵn sàng |
| `backend/src/middlewares` | Lỗi chung và mã lỗi trả về |
| `backend/src/utils/logger.js` | Log JSON và che thông tin cấu hình nhạy cảm |
| `frontend/src/App.jsx` | Màn hình kiểm tra Mốc 2 |
| `scripts/smoke.mjs` | Kiểm tra luồng tích hợp trên máy đang chạy |

Các thư mục `ai`, `concurrency`, `jobs`, `models`, `routes` được giữ sẵn để triển khai theo cấu trúc đã thống nhất. Mốc 2 chưa triển khai Redis lock theo phiên, quy tắc giá, kết thúc phiên hoặc gọi Gemini. Các phần đó sẽ được thêm khi xây chức năng tương ứng.

## 11 Khi gặp lỗi

| Hiện tượng | Kiểm tra và xử lý |
|---|---|
| `npm.ps1 cannot be loaded` | Dùng `npm.cmd` như các lệnh trong hướng dẫn |
| `node` hoặc `docker` không nhận lệnh | Cài công cụ, đóng/mở VS Code rồi kiểm tra lại PATH |
| Docker không kết nối được daemon | Mở Docker Desktop, chờ Engine chạy; chọn Linux containers |
| SQL Server chưa healthy | Đợi thêm và xem `docker compose logs --tail 50 sqlserver` |
| API đỏ hoặc không mở cổng 5000 | Xem terminal API; kiểm tra `npm run setup` đã tạo `.env` |
| SQL đỏ, báo login failed | Kiểm tra `DB_PASSWORD`. Đổi biến môi trường không tự đổi mật khẩu của SQL Server đã có dữ liệu trong volume |
| SQL kết nối nhưng số bảng bằng 0 | Chạy `npm.cmd run db:init` vào đúng database |
| Redis đỏ | Chạy `docker compose ps` và `docker compose exec redis redis-cli ping`; sau khi Redis chạy ổn, khởi động lại API/worker nếu trước đó kết nối đã dừng thử lại |
| Worker đỏ | Chạy terminal worker; xem log; kiểm tra database đã được tạo. Sau khi worker dừng, mất tối đa khoảng 10 giây để trạng thái hết hạn |
| Token không đúng | Sao chép lại giá trị `DEV_PROBE_TOKEN` trong `.env` ở gốc, không lấy từ `frontend/.env` |
| Yêu cầu cứ queued | Kiểm tra worker, SQL và log xử lý; yêu cầu pending có thể cần hơn 30 giây để được nhận lại |
| Cổng bị chiếm | Đổi đồng thời cổng trong `compose.yaml` và `.env` cho DB/Redis. Nếu đổi cổng API, sửa thêm `VITE_API_URL` trong `frontend/.env` rồi khởi động lại React |
| Frontend hiện CORS error | Mở đúng `127.0.0.1:5173`; nếu đổi địa chỉ frontend, cập nhật `CLIENT_ORIGINS` rồi khởi động lại API |

## 12 Dừng và chạy lại

Nhấn **Ctrl+C** ở ba terminal ứng dụng. Dừng dịch vụ mà giữ dữ liệu:

```powershell
docker compose stop
```

Lần sau chạy:

```powershell
docker compose start
```

Chờ healthy, rồi chạy lại ba lệnh `dev:api`, `dev:worker`, `dev:web`. Không cần cài lại thư viện hoặc tạo lại cấu hình mỗi lần mở dự án.

## 13 Bằng chứng hoàn thành để lưu cho báo cáo

- Ảnh Docker có hai dịch vụ healthy.
- Ảnh ba terminal API, worker và React đang chạy.
- Ảnh trang kiểm tra có đủ trạng thái xanh và đúng 19 bảng/142 trường.
- Ảnh probe đã `completed` cùng log worker có cùng mã yêu cầu.
- Kết quả `npm.cmd run smoke` PASS trên máy của nhóm.

Khi đủ các kết quả trên, có thể xác nhận Mốc 2 chạy thành công trên máy phát triển và chuyển sang Mốc 3 — tài khoản, xác thực và phân quyền.

## Tài liệu công nghệ

- Node.js: <https://nodejs.org/en/download>
- Vite: <https://vite.dev/guide/>
- Express: <https://expressjs.com/en/starter/installing.html>
- SQL Server Docker: <https://learn.microsoft.com/en-us/sql/linux/quickstart-install-connect-docker?view=sql-server-ver16>
- node-mssql: <https://github.com/tediousjs/node-mssql>
- Redis và kết nối đọc BLOCK riêng: <https://redis.io/docs/latest/develop/use-cases/streaming/nodejs/>
- Socket.IO: <https://socket.io/docs/v4/server-initialization/>

Các nguồn này hỗ trợ cách dùng công nghệ. Cấu trúc nghiệp vụ, tên bảng, trạng thái và quy tắc đấu giá của dự án được lấy từ bản Word (3).
