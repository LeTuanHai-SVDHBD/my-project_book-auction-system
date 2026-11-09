# Đóng gói và đưa BookBid lên mạng

GitHub giữ mã nguồn. Docker build mã nguồn thành image để chạy giống nhau trên máy Windows (Docker Desktop) và VM Linux. Docker Compose khởi động API, worker, SQL Server và Redis từ image. API phục vụ cả React đã build và Socket.IO qua cùng một địa chỉ, nên không phải build lại frontend khi đổi tên miền.

| Nhu cầu | Phương án |
|---|---|
| Demo từ máy Windows, không thuê máy chủ | Docker Desktop và [Cloudflare Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/). Link tạm thời; máy, Docker và tunnel phải còn chạy. |
| Chạy trên server riêng, tắt máy Windows vẫn truy cập được | [Azure for Students](https://learn.microsoft.com/vi-vn/azure/education-hub/about-azure-for-students) nếu xác minh được email trường. VM dùng tín dụng có hạn; đây không phải VM miễn phí 24/7. |
| Chỉ đưa giao diện lên để xem | Render Static Site làm được, nhưng không thay API, worker hay SQL Server. [Render Free](https://render.com/docs/free) có cơ chế ngủ và Redis tương thích không lưu bền; [background worker](https://render.com/docs/compute-plans#private-service--background-worker-plans) không có gói Free. |

## 1. Chuẩn bị trên máy chạy

Dùng máy **x86-64**, Node.js 24, Git và Docker Compose V2. Dành từ **4 GB RAM khả dụng** cho bản demo nhẹ và theo dõi khi thử video hoặc nhiều người; SQL Server Linux cần tối thiểu 2 GB để khởi động. Docker Desktop phải chạy Linux containers. Dùng bản **SQL Server Express** và volume riêng; không đưa `.env`, database, tài khoản hay phiên đấu giá từ môi trường phát triển sang bản demo.

Từ thư mục gốc, chạy trong PowerShell:

```powershell
node scripts/setupDeployment.mjs
function bb { docker compose --env-file .env.deploy -f compose.deploy.yaml @args }
bb build api
bb up -d --no-build
bb ps -a
Invoke-RestMethod http://127.0.0.1:8080/api/health/ready
```

Trên Bash, định nghĩa hàm `bb` bằng `bb() { docker compose --env-file .env.deploy -f compose.deploy.yaml "$@"; }`; dùng `curl -fsS http://127.0.0.1:8080/api/health/ready` thay `Invoke-RestMethod`.

`db-init` phải chạy xong với mã 0. Readiness chỉ trả `ok: true` khi SQL, Redis và worker đều sẵn sàng. Nếu chưa đạt, dùng `bb logs --tail=100 sqlserver db-init api worker`. API và worker dùng login SQL riêng với quyền đọc/ghi database demo. SQL và Redis không mở cổng ra máy chủ. API chỉ nghe trên cổng host `127.0.0.1:8080`; để công khai phải có proxy HTTPS ở phía trước.

Tạo tài khoản quản trị demo trong terminal và nhập mật khẩu kín:

```powershell
bb exec api node backend/scripts/createAdmin.js
```

Muốn kiểm thử tải ảnh/video và AI, điền các thông số **Cloudinary/Gemini dành riêng cho demo** trong `.env.deploy`, bật `AI_ENABLED=true` nếu đã có key và chạy lại `bb up -d --no-build`. Kiểm tra quota của hai dịch vụ riêng. Không gửi hoặc commit file này. Giữ một bản sao cấu hình riêng an toàn nếu muốn tái sử dụng volume; chạy lại script giữ nguyên khóa đang có.

## 2A. Mở link demo từ Windows

1. Cài [cloudflared](https://developers.cloudflare.com/tunnel/downloads/) và mở terminal thứ hai. Chạy `cloudflared tunnel --url http://127.0.0.1:8080`. Nếu chỉ cho giảng viên hoặc nhóm xem, xem tùy chọn `--allowed-mail` trong [hướng dẫn Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
2. Sao chép URL `https://…trycloudflare.com` hiện ra vào `BOOKBID_ORIGIN` trong `.env.deploy`, bỏ dấu `/` ở cuối. Chạy `bb up -d --no-build api` để áp dụng. Mỗi lần tunnel đổi URL, lặp lại bước này.
3. Từ điện thoại dùng 4G/5G hoặc máy khác, vào link HTTPS. Thử đăng nhập, mở danh sách, gửi giá thử bằng tài khoản không phải chủ sách và xem kết quả cập nhật. Dùng tệp nhỏ trong demo; upload lâu qua proxy có thể gặp [HTTP 524](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/).
4. Kết thúc: nhấn Ctrl+C ở terminal tunnel, sau đó chạy `bb stop` nếu muốn dừng Docker. Giữ volume để dùng lại.

## 2B. Chạy trên VM Linux của Azure

1. Xác minh email trường với Azure for Students. Kiểm tra còn tín dụng, xem giá của **VM Linux x64, từ 2 vCPU và 4 GB RAM** ở khu vực định dùng, đĩa và IP công khai. Giữ nguyên giới hạn chi tiêu và không nâng cấp sang Pay-As-You-Go. Chọn Ubuntu LTS, xác thực SSH bằng key và giới hạn cổng 22 về IP của bạn. Chỉ mở TCP 80/443 cho web.
2. Cài [Docker Engine/Compose](https://docs.docker.com/engine/install/ubuntu/), Node.js 24, Git và [Caddy](https://caddyserver.com/docs/install) trên VM. Clone repo và chạy bước 1 ở trên trong Bash. Dùng `bb ps -a` và `curl` kiểm tra từ ngay trên VM trước khi mở web.
3. Đặt [DNS name label cho Public IP](https://learn.microsoft.com/azure/virtual-machines/create-fqdn) hoặc trỏ tên miền bạn đã có. Điền `BOOKBID_ORIGIN=https://TEN-MIEN-THAT` và chạy `bb up -d --no-build api`. Trong `/etc/caddy/Caddyfile` thay tên miền bằng giá trị thật:

   ```caddyfile
   TEN-MIEN-THAT {
       reverse_proxy 127.0.0.1:8080
   }
   ```

4. Chạy `sudo caddy validate --config /etc/caddy/Caddyfile` và `sudo systemctl reload caddy`. [Caddy](https://caddyserver.com/docs/quick-starts/reverse-proxy) cấp HTTPS khi DNS và cổng đã thông. Giữ cổng 8080 nội bộ; cấu hình Express của bản đóng gói chỉ tin **một proxy** ở trước API để cookie Secure hoạt động qua HTTPS.
5. Kiểm tra lại đăng nhập, đặt giá, Socket.IO, worker và giới hạn upload từ mạng khác. Khi không dùng, [dừng ở trạng thái Deallocated](https://learn.microsoft.com/azure/virtual-machines/states-billing) để ngừng tính compute; đĩa và một số tài nguyên mạng vẫn có thể trừ tín dụng.

## Cập nhật bản đang chạy

Sao lưu SQL trước khi cập nhật; ghi lại commit đang chạy. Sau khi kéo mã mới, `bb build api`, `bb stop api worker`, rồi `bb up -d --no-build`. Kiểm tra `bb ps -a` và `/api/health/ready` trước khi mở cho người dùng. Compose dùng volume riêng có tên bắt đầu bằng `bookbid-deploy_`. Không chạy `down -v` nếu muốn giữ dữ liệu. Tránh chạy trong lúc có phiên đấu giá đang mở vì cập nhật làm API và worker tạm dừng.
