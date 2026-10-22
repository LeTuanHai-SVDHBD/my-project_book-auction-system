<!-- Mục đích: Theo dõi Mốc 2 và điều kiện xác nhận hoàn thành. -->

# Công việc Mốc 2

## 1. Mục tiêu

Chạy được Frontend, API, SQL Server, Redis và worker riêng.
Kiểm tra được một sự kiện đi qua Redis Streams đến worker và SQL Server.

Không đưa toàn bộ chức năng nghiệp vụ vào phạm vi nghiệm thu Mốc 2.

## 2. Quy ước trạng thái

| Trạng thái | Ý nghĩa |
|---|---|
| Đã có | Mã hoặc cấu hình đã được chuẩn bị |
| Đã kiểm tra | Có kết quả kiểm tra cụ thể |
| Chờ xác nhận | Cần chạy với môi trường thật của nhóm |
| Chưa làm | Chưa triển khai |

Chỉ đánh dấu hoàn thành khi có bằng chứng phù hợp.

## 3. Danh sách công việc

| Mã | Công việc | Trạng thái | Bằng chứng/điều kiện |
|---|---|---|---|
| M2-01 | Tạo cấu trúc Backend và Frontend | Đã có | npm workspaces |
| M2-02 | Tạo cấu hình mẫu và script setup | Đã kiểm tra | Tạo cấu hình, giữ file đã tồn tại |
| M2-03 | Khai báo SQL Server và Redis trong Docker | Đã có | Có `compose.yaml`; chưa chạy tích hợp |
| M2-04 | Chuẩn bị DDL 19 bảng | Đã kiểm tra đối chiếu | 142 trường khớp thiết kế; chưa thực thi SQL Server |
| M2-05 | Tạo script khởi tạo database | Đã có | Chờ chạy trên SQL Server thật |
| M2-06 | Tách API và worker | Đã có | Hai lệnh khởi động riêng |
| M2-07 | Kiểm tra liveness/readiness | Đã kiểm tra | API thật; thiếu phụ thuộc trả 503 |
| M2-08 | Kiểm tra Socket.IO | Đã kiểm tra | Nhận `system:hello` |
| M2-09 | Chuẩn bị probe qua Redis Streams | Đã có | Chờ kiểm tra tích hợp |
| M2-10 | Kiểm tra cú pháp | Đã kiểm tra | 20 file JavaScript máy chủ |
| M2-11 | Chạy kiểm thử tự động | Đã kiểm tra | 14 bài kiểm thử đạt bằng giả lập |
| M2-12 | Build Frontend | Đã kiểm tra | Build thành công |
| M2-13 | Kiểm tra hiển thị trên trình duyệt của nhóm | Chờ xác nhận | Kiểm tra bố cục và thao tác |
| M2-14 | Chạy đầy đủ trên máy Windows | Chờ xác nhận | SQL/Redis healthy, API và worker hoạt động |
| M2-15 | Chạy smoke test tích hợp | Chờ xác nhận | `npm.cmd run smoke` PASS |
| M2-16 | Bổ sung AGENTS và tài liệu docs | Đã soạn | Chờ sao chép vào repository |
| M2-17 | Đưa dự án lên GitHub | Chưa xác nhận | Có repository và commit hợp lệ |
| M2-18 | Lưu bằng chứng nghiệm thu | Chưa làm | Ảnh trạng thái và kết quả kiểm tra |

## 4. Checklist trên máy của nhóm

- [ ] Node.js đúng phiên bản được yêu cầu.
- [ ] Docker Desktop đang chạy Linux containers.
- [ ] `npm.cmd ci` thành công.
- [ ] `npm.cmd run setup` tạo cấu hình.
- [ ] SQL Server và Redis đều healthy.
- [ ] `npm.cmd run db:init` thành công.
- [ ] Có đủ 19 bảng và 142 trường dự kiến.
- [ ] API và worker chạy ở hai tiến trình riêng.
- [ ] Frontend mở được.
- [ ] Cả năm ô trạng thái đều sẵn sàng.
- [ ] Probe chuyển từ `queued` sang `completed`.
- [ ] `npm.cmd run smoke` PASS.
- [ ] Repository không chứa `.env` hoặc bí mật.
- [ ] README và tài liệu khớp với mã nguồn.

## 5. Điều kiện hoàn tất Mốc 2

Mốc 2 hoàn tất khi checklist môi trường và kiểm tra tích hợp
đã đạt trên máy phát triển của nhóm.

API mở cổng, unit test đạt hoặc Frontend build thành công
chưa đủ để xác nhận toàn bộ hệ thống hoạt động.

## 6. Công việc ngoài Mốc 2

Các nội dung sau thuộc các mốc triển khai nghiệp vụ:
- Đăng ký, đăng nhập và phân quyền.
- Đăng sách, kiểm duyệt và phân tích AI.
- Kích hoạt phiên.
- Đặt giá, khóa theo phiên và chống ghi trùng.
- Kết thúc phiên và xác định người thắng.
- Giao dịch, trò chuyện, đánh giá và khiếu nại.

Cơ chế xác thực và phát thông báo từ worker cần được thống nhất
trước khi triển khai các phần liên quan.