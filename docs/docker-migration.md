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

Đây là tên dữ liệu đã có, không phải tên project mới. Nếu `.env` cũ chưa có hai biến, Compose dùng hai tên cũ trên làm fallback để giữ liên kết mặc định.

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

Setup tạo `.env` mới với tên chuẩn:

```dotenv
SQLSERVER_VOLUME_NAME=my-project_book-auction-system_sqlserver_data
REDIS_VOLUME_NAME=my-project_book-auction-system_redis_data
```

Hai volume mới được tạo khi chạy `docker compose up -d`.

## 4. Consumer group

Nhóm probe đổi từ `moc2-workers` sang `infrastructure-workers`. Worker mới có thể đọc lại probe cũ từ đầu stream; probe chỉ đọc SQL, không ghi dữ liệu đấu giá. Dừng worker bản cũ trước khi chạy bản mới. Không cần xóa stream, Redis hoặc volume.

## 5. Kiểm tra sau chuyển đổi

- Docker project hiển thị `my-project_book-auction-system`.
- SQL Server và Redis healthy, mount đúng volume đã chọn.
- Database và dữ liệu cũ truy cập được bằng cấu hình hiện có.
- Giao diện sẵn sàng; probe completed và smoke PASS.

Lần chuẩn hóa này không tự đổi tên vật lý hoặc sao chép dữ liệu volume. Nếu cần đổi cả tên volume đang có dữ liệu, chuẩn bị đợt sao lưu và chuyển dữ liệu riêng.

Tham khảo: [project name](https://docs.docker.com/reference/compose-file/version-and-name/), [volume name](https://docs.docker.com/reference/compose-file/volumes/), [compose down](https://docs.docker.com/reference/cli/docker/compose/down/).
