<!-- Mục đích: Theo dõi tiến độ triển khai, nguồn xác nhận và công việc tiếp theo. -->

# Tiến độ triển khai hệ thống

## 1. Hiện trạng

Ngày 22/10/2026, chủ dự án xác nhận đã thiết lập thành công toàn bộ môi trường hạ tầng.
Repository đã được đưa lên GitHub tại nhánh `feat/Hai`.

Xác nhận trên máy của nhóm và kiểm tra trong môi trường rà soát là hai nguồn riêng.
Các kết quả chạy cục bộ được ghi tại [VALIDATION](../VALIDATION.md).

## 2. Tiến độ

| Nhóm việc | Trạng thái | Căn cứ |
|---|---|---|
| npm workspaces, cấu hình và cấu trúc Backend/Frontend | Đã có | Mã nguồn trong repository |
| SQL Server và Redis trên Docker | Đã thiết lập | Chủ dự án xác nhận |
| Khởi tạo database và schema | Đã thiết lập | Chủ dự án xác nhận; DDL gồm 19 bảng/142 trường |
| API, worker, React và kết nối hạ tầng | Đã thiết lập | Chủ dự án xác nhận |
| Kiểm thử tự động và build | Đã có công cụ | `check`, `test`, `build`; xem VALIDATION |
| Tài liệu AGENTS và docs | Đã có | Các file đã được đưa vào repository |
| Chuẩn hóa tên dự án, Docker và README | Đã chuẩn bị | Bản thay đổi cần được nhóm áp dụng |
| Chú thích đầu file và phạm vi `.gitignore` | Đã chuẩn bị | Bản thay đổi cần được nhóm áp dụng |
| Cấu trúc lưu báo cáo, slide và UML | Đã tạo thư mục | Chưa thêm tài liệu học thuật của nhóm |
| Chạy lại sau khi chuyển tên Docker | Cần thực hiện | Làm theo `docker-migration.md`, sau đó chạy smoke |
| Bằng chứng nghiệm thu | Cần bổ sung | Chưa có ảnh hoặc log nghiệm thu trong repository |

## 3. Checklist sau khi áp dụng bản chuẩn hóa

- [ ] Giữ nguyên `.env` và xác nhận đúng volume dữ liệu đang sử dụng.
- [ ] Dừng Docker project cũ trước khi chạy project tên mới.
- [ ] `npm.cmd ci` thành công với lockfile hiện tại.
- [ ] SQL Server và Redis healthy.
- [ ] API, worker và React chạy lại thành công.
- [ ] Giao diện đủ năm trạng thái sẵn sàng.
- [ ] Probe chuyển từ `queued` sang `completed`.
- [ ] `npm.cmd run smoke` PASS sau chuyển đổi.
- [ ] Đưa báo cáo DOCX, slide PPTX và mã UML vào `academic/`.
- [ ] Lưu bằng chứng đã loại thông tin nhạy cảm trong `academic/evidence/`.

## 4. Công việc nghiệp vụ tiếp theo

- [ ] Thống nhất cơ chế đăng nhập và quản lý phiên.
- [ ] Thống nhất kênh thông báo từ worker sang API và cách phục hồi sau COMMIT.
- [ ] Đăng ký, đăng nhập và phân quyền.
- [ ] Đăng sách, kiểm duyệt và phân tích AI.
- [ ] Kích hoạt phiên.
- [ ] Đặt giá, khóa theo phiên, cooldown và chống ghi trùng.
- [ ] Kết thúc phiên và xác định người thắng.
- [ ] Giao dịch, trò chuyện, đánh giá và khiếu nại.

Chỉ cập nhật hoàn thành khi có mã và kết quả kiểm tra phù hợp.
Không suy ra các chức năng nghiệp vụ đã có từ việc môi trường chạy thành công.
