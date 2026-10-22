<!-- Mục đích: Ghi kết quả kiểm tra thực tế và phân biệt phụ thuộc thật với giả lập. -->

# Kết quả kiểm tra

Ngày: 22/10/2026. Nền mã: nhánh `feat/Hai`, commit `bb3ba13eaa818486f572dcdf105ab92359ac48f3`.
Bản cập nhật bổ sung tài khoản, xác thực và phân quyền theo phương án A.

## 1. Kết quả trong môi trường chuẩn bị bản cập nhật

| Hạng mục | Kết quả | Phạm vi và giới hạn |
|---|---|---|
| Cài thư viện | Đạt | `npm ci --no-audit --no-fund`, Node 24.19.0 |
| Cú pháp | Đạt | `npm run check`: 34 file JS phía máy chủ và script |
| Kiểm thử mặc định | Đạt | `npm test`: 31 đạt, 1 SKIP; model/store giả, Argon2 thật |
| Kiểm thử có Redis thật | Đạt | 32/32 đạt; gồm TTL 2 giờ, gia hạn, hết hạn, thu hồi và bộ đếm đồng thời |
| Phiên bản Redis thử riêng | 7.0.15 | Chưa xác minh lại trên Redis 8 trong Docker của nhóm |
| Build React | Đạt | `npm run build`, Vite 8.3.5 |
| Trình duyệt desktop | Đạt | Chromium: đăng ký, đăng nhập, F5 giữ phiên, đăng xuất, Admin và điều hướng |
| Trình duyệt mobile | Đạt | Viewport 390 px; không tràn ngang; đã xem ảnh render |
| Bảo vệ cookie | Đạt trong QA trình duyệt | HttpOnly, SameSite=Lax; auth không lưu trong Local Storage/Session Storage |
| Dữ liệu trong QA trình duyệt | Model giả, Redis thật | Không phải bằng chứng SQL Server thật |
| Script setup:auth | Đạt | Giữ cấu hình cũ, tự sinh secret, chạy lại không thay secret, nhận diện secret mẫu |
| Không đổi schema | Đã đối chiếu file | DDL 19 bảng/142 trường giữ nguyên so với commit nền |
| Smoke SQL/Redis/worker thật sau cập nhật | Chưa chạy | Môi trường chuẩn bị không có SQL Server/Docker |
| Smoke auth với SQL Server thật | Chưa chạy | Chạy `npm.cmd run smoke:auth` trên máy Hải |
| Admin INSERT SQL thật | Chưa xác minh | Script đã có; cần chạy `admin:create` trên máy Hải |

Các bài test auth bao gồm: email trùng, đầu vào sai, từ chối tự truyền vai trò Admin,
CSRF thiếu/sai, đăng nhập sai/email lạ, đổi session ID/CSRF, phân quyền 401/403/200,
đổi quyền tại SQL model có hiệu lực ở request kế tiếp, xóa tài khoản làm phiên bị từ chối,
đăng xuất/thu hồi, TTL, lỗi store, lỗi SQL, Redis unavailable và CORS.

Các ca SQL model giả không kiểm chứng thực thi cú pháp truy vấn, UNIQUE hoặc kết nối
trên SQL Server thật. Cần chạy smoke trên máy nhóm trước khi xác nhận hoàn tất Mốc 3.

## 2. Bằng chứng Mốc 2 do Hải xác nhận

Hải đã xác nhận:
- SQL Server và Redis healthy.
- Giao diện đủ năm trạng thái sẵn sàng.
- Probe completed.
- `npm.cmd run smoke` PASS.

Đây là kết quả trên máy Hải trước bản cập nhật tài khoản.
Sau khi cập nhật cần chạy lại `smoke` để xác nhận không ảnh hưởng luồng cũ.

## 3. Điều kiện nghiệm thu tiếp theo

Làm theo `README.md`, kiểm tra Admin bằng giao diện,
chạy `check`, `test`, `build`, `smoke` và `smoke:auth` trên Windows với SQL Server/Redis thật.

Chưa triển khai các nghiệp vụ đăng sách, AI, đặt giá hoặc kết thúc phiên.
Socket.IO hiện chỉ có lời chào kiểm tra hạ tầng công khai.
