<!-- Mục đích: Đổi tên Docker project và tiếp tục dùng dữ liệu SQL/Redis đang có. -->

# Chuyển tên Docker project

## 1. Thay đổi

| Thành phần | Trước | Sau |
|---|---|---|
| Compose project | `book-auction-moc2` | `my-project_book-auction-system` |
| Dịch vụ | `sqlserver`, `redis` | Giữ nguyên |
| Database | `BookAuctionDB` | Giữ nguyên |
| Volume | Tên cấu hình cũ tạo | Chọn bằng biến môi trường |

Đổi project không tự di chuyển dữ liệu sang volume mới. Tên volume chứa dữ liệu cũ có thể được giữ; container và network mang tên project mới.

Máy đang chạy healthy và truy cập đúng dữ liệu không cần thực hiện lại việc chuyển đổi.
Giữ nguyên `.env` và các volume đang gắn. Chỉ làm các bước bên dưới khi thực sự chuyển project.

## 2. Máy đã chạy cấu hình cũ

Thực hiện một lần khi chuyển đổi. Dừng API, worker và React bằng Ctrl+C trước khi chuyển.

### Bước 1 — Kiểm tra volume đang gắn

```powershell
docker ps -a --filter "label=com.docker.compose.project=book-auction-moc2" --format "{{.Names}}"
```

Với từng tên nhận được, thay `TEN_CONTAINER` và kiểm tra:

```powershell
docker inspect TEN_CONTAINER --format '{{range .Mounts}}{{println .Name .Destination}}{{end}}'
```

Ghi tên volume gắn vào `/var/opt/mssql` và `/data`. Không suy đoán tên nếu trước đó đã dùng `docker compose -p` hoặc sửa cấu hình.

### Bước 2 — Chỉ định volume hiện có

Giữ nguyên `.env`, đặc biệt `DB_PASSWORD`. Thêm hoặc sửa hai biến theo kết quả kiểm tra. Với cấu hình cũ mặc định:

```dotenv
SQLSERVER_VOLUME_NAME=book-auction-moc2_sqlserver_data
REDIS_VOLUME_NAME=book-auction-moc2_redis_data
```

Ví dụ trên chỉ đúng nếu `docker inspect` xác nhận dữ liệu nằm trong hai volume `book-auction-moc2_*` đó.
Nếu tên quan sát khác, dùng đúng tên quan sát; không sao chép ví dụ một cách mặc định.

Fallback hiện hành trong `compose.yaml` khi biến tương ứng bị thiếu hoặc rỗng là:

```dotenv
SQLSERVER_VOLUME_NAME=book-auction_sqlserver_data
REDIS_VOLUME_NAME=book-auction_redis_data
```

Đây là giá trị dự phòng của Compose, không phải các dòng được setup tự thêm vào `.env` đã có.
Fallback không tự dò volume mang tên `book-auction-moc2_*`. Nếu dữ liệu ở volume đó,
phải chỉ định tên đã kiểm tra trước khi khởi động project mới. Fallback hiện hành được giữ để bảo toàn liên kết trên máy đã có dữ liệu.

Không chép tên volume mới từ `.env.example` vào môi trường có dữ liệu cũ. Chọn tên chưa tồn tại sẽ tạo volume rỗng, không tự chuyển dữ liệu.

### Bước 3 — Gỡ container/network cũ

Tại thư mục gốc:

```powershell
docker compose -p book-auction-moc2 down
```

Lệnh không kèm `-v`, nên không yêu cầu xóa named volume. Nếu project cũ mang tên khác, dùng đúng tên đã quan sát. Không chạy đồng thời hai SQL Server trên cùng volume hoặc cùng cổng máy chủ.

### Bước 4 — Chạy project mới

```powershell
npm.cmd ci
docker compose up -d
docker compose ps
```

Compose có thể cảnh báo volume được tạo bởi project cũ. Kiểm tra mount trước khi tiếp tục; không xóa volume để làm mất cảnh báo.

Sau khi healthy, chạy lại API, worker và React theo README. Kiểm tra database cùng dữ liệu trước đó, sau đó chạy:

```powershell
npm.cmd run smoke
```

Không cần khởi tạo lại schema chỉ vì đổi project.

## 3. Máy cài mới

Chạy `npm.cmd run setup` khi chưa có `.env`. Script đọc `.env.example` và tạo cấu hình với tên chuẩn:

```dotenv
SQLSERVER_VOLUME_NAME=my-project_book-auction-system_sqlserver_data
REDIS_VOLUME_NAME=my-project_book-auction-system_redis_data
```

Hai volume mới được tạo khi chạy `docker compose up -d`.

Nếu `.env` đã tồn tại, `setup` giữ nguyên file và không tự thêm hay đổi hai biến volume.
`setup:auth` chỉ bổ sung cấu hình session còn thiếu, không đổi cấu hình volume.

## 4. Consumer group

Nhóm probe đổi từ `moc2-workers` sang `infrastructure-workers`. Worker mới có thể đọc lại probe cũ từ đầu stream; probe chỉ đọc SQL, không ghi dữ liệu đấu giá. Dừng worker bản cũ trước khi chạy bản mới. Không cần xóa stream, Redis hoặc volume.

## 5. Kiểm tra sau chuyển đổi

- Docker project hiển thị `my-project_book-auction-system`.
- SQL Server và Redis healthy, mount đúng volume đã chọn.
- Database và dữ liệu cũ truy cập được bằng cấu hình hiện có.
- Giao diện sẵn sàng; probe completed và smoke PASS.

Chuyển Compose project không tự đổi tên vật lý hoặc sao chép dữ liệu volume. Nếu cần đổi cả tên volume đang có dữ liệu, chuẩn bị đợt sao lưu và chuyển dữ liệu riêng.

Tham khảo: [project name](https://docs.docker.com/reference/compose-file/version-and-name/), [volume name](https://docs.docker.com/reference/compose-file/volumes/), [compose down](https://docs.docker.com/reference/cli/docker/compose/down/).
