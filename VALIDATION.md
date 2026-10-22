# Kết quả kiểm tra bộ khung Mốc 2

Ngày kiểm tra: 22/10/2026. Căn cứ thiết kế: `TieuLuanDAMH-Tuan6-Nhom15(3).docx`.

| Hạng mục | Kết quả | Phạm vi |
|---|---|---|
| Đối chiếu thiết kế | Đạt | 142 tên trường, kiểu dữ liệu và quy tắc NULL của 19 bảng khớp phần thiết kế vật lý trong bản Word (3) |
| Cú pháp máy chủ | Đạt | `npm run check`: 20 tệp JavaScript |
| Kiểm thử tự động | Đạt | `npm test`: 14 bài kiểm thử API, cấu hình và bộ xử lý probe; dịch vụ phụ thuộc được giả lập |
| Biên dịch React | Đạt | `npm run build` |
| Khởi động API thật | Đạt | Tiến trình Express khởi động và liveness trả HTTP 200 |
| Báo thiếu dịch vụ thật | Đạt | Khi SQL/Redis không chạy, readiness trả HTTP 503 và `ok: false` |
| Kết nối Socket.IO thật | Đạt | Client nhận `system:hello` từ tiến trình API |
| Docker Compose | Kiểm tra tĩnh | YAML đọc được; chưa khởi động container |
| SQL Server thực thi DDL | Chưa chạy | Môi trường kiểm tra không có Docker hoặc SQL Server |
| Luồng Redis Streams → worker → SQL | Chưa chạy tích hợp | Cần SQL Server và Redis thật; chạy `npm.cmd run smoke` trên máy phát triển |
| Hiển thị trình duyệt | Chưa kiểm tra trực quan | Build đã đạt; runtime không có trình duyệt chạy được |

Kết quả kiểm thử giả lập không chứng minh toàn bộ luồng tích hợp đã hoạt động. Chỉ xác nhận Mốc 2 hoàn tất trên máy của nhóm sau khi SQL/Redis healthy, giao diện đủ năm trạng thái sẵn sàng, probe completed và lệnh smoke PASS theo README.

Script khởi tạo không xóa dữ liệu. Cấu trúc đã có được nhận diện qua tên 19 bảng và tổng 142 cột; kiểm tra này chưa xác nhận đầy đủ kiểu, chỉ mục và ràng buộc trong database đang tồn tại.

Phạm vi hiện tại là môi trường phát triển và sự kiện chẩn đoán chỉ đọc. Chưa có đăng nhập, đặt giá, khóa đồng thời, kết thúc phiên hoặc xử lý thanh toán.
