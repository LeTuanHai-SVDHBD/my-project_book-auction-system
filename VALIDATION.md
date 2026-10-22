<!-- Mục đích: Ghi kết quả kiểm tra theo nguồn xác nhận và giới hạn của lần rà soát. -->

# Kết quả kiểm tra hệ thống

## 1. Xác nhận môi trường của nhóm

Ngày 22/10/2026, chủ dự án xác nhận đã thiết lập thành công toàn bộ môi trường hạ tầng trên máy phát triển. Đây là xác nhận từ người vận hành; repository chưa chứa ảnh hoặc log nghiệm thu tương ứng.

Bằng chứng được nhóm bổ sung vào `academic/evidence/`. Sau khi áp dụng đổi tên Docker, chạy lại smoke để kiểm tra cấu hình mới.

## 2. Kiểm tra bản chuẩn hóa ngày 22/10/2026

| Hạng mục | Kết quả | Phạm vi |
|---|---|---|
| Cài dependency | Đạt | `npm ci --ignore-scripts`; bộ dependency giữ nguyên |
| Khóa phiên bản | Đạt | Chỉ đổi tên package/workspace trong lockfile; không đổi phiên bản hoặc integrity của dependency |
| Cú pháp JavaScript | Đạt | `npm run check`: 20 file máy chủ/script |
| Kiểm thử tự động | Đạt | `npm test`: 14 bài kiểm thử với dịch vụ giả lập |
| Build React | Đạt | `npm run build` |
| Setup | Đạt | Cấu hình mới có tên volume chuẩn; chạy lại không ghi đè `.env` |
| API và Socket.IO thật | Đạt | Liveness đúng tên mới; thiếu SQL/Redis trả readiness 503; client nhận `system:hello` |
| Docker Compose | Kiểm tra tĩnh đạt | YAML hợp lệ, tên project và volume fallback khớp tài liệu |
| Phạm vi Git ignore | Đạt | Bỏ qua cấu hình riêng, build, dữ liệu sinh và file khóa Office; giữ models, CSV fixture, DOCX/PPTX và UML |
| Comment đầu file | Đạt | Mã JS/MJS/JSX/CSS, HTML, SQL, cấu hình hỗ trợ comment và tài liệu có mô tả; JSON giữ đúng chuẩn |

## 3. Giới hạn xác minh

- Môi trường rà soát hiện không có Docker hoặc SQL Server, nên chưa chạy lại smoke và chuyển volume thật sau thay đổi.
- Việc giữ volume được kiểm tra ở cấu hình; mount và dữ liệu phải được nhóm kiểm tra khi áp dụng theo `docs/docker-migration.md`.
- Build Frontend thành công chưa thay thế kiểm tra trực quan trên trình duyệt.
- Các bài kiểm thử hiện tại tập trung hạ tầng; chưa chứng minh các chức năng tài khoản hoặc đấu giá đã được triển khai.

## 4. Cơ sở dữ liệu

DDL 19 bảng/142 trường đã được đối chiếu với thiết kế vật lý ở lần chuẩn bị ban đầu. Lần chuẩn hóa này không sửa DDL, tên database, bảng/cột, ràng buộc hoặc dữ liệu nghiệp vụ.

Script khởi tạo nhận diện schema đang có bằng tên 19 bảng và tổng 142 cột. Đây chưa phải phép so sánh đầy đủ kiểu, chỉ mục và ràng buộc của một database có sẵn.
