<!-- Mục đích: Theo dõi chức năng, trạng thái kiểm chứng và công việc còn lại theo lĩnh vực nghiệp vụ. -->

# Trạng thái phát triển

## Quy ước

- **Đã triển khai:** có mã nguồn và tài liệu sử dụng.
- **Đã kiểm tra tự động:** nêu rõ phụ thuộc thật/giả tại [VALIDATION.md](../VALIDATION.md).
- **Chờ nghiệm thu:** cần chạy với dữ liệu và dịch vụ thật của nhóm.
- **Chưa triển khai:** thiết kế hoặc công việc phát triển tiếp theo.

## Chức năng hiện tại

| Nhóm | Phạm vi | Trạng thái |
|---|---|---|
| Hạ tầng | SQL, Redis, API, worker, Socket.IO và probe | Đã triển khai; nhóm xác nhận healthy/completed và smoke đạt |
| Tài khoản | Đăng ký/đăng nhập/đăng xuất, Argon2id, CSRF, phân quyền | Đã triển khai; smoke tài khoản được nhóm xác nhận đạt |
| Phiên tab | Hai tài khoản trong cùng trình duyệt; reload giữ phiên, tab mới đăng nhập lại | Đã kiểm tra HTTP/Redis và trình duyệt; chờ nghiệm thu máy nhóm |
| Nhập tiền | Chỉ chữ số, dấu chấm hàng nghìn, chuỗi nguyên tối đa 18 chữ số | Đã kiểm tra HTTP/Redis và trình duyệt; chờ nghiệm thu máy nhóm |
| Đăng sách | Tạo sách/bài/phiên pending và media trong transaction | Đã triển khai; có smoke tích hợp |
| Media | Cloudinary, vé Redis, ownership, cleanup | Đã triển khai; kiểm thử hợp đồng và Redis; media thật cần nghiệm thu |
| Kiểm duyệt | Phê duyệt/từ chối có lý do, bổ sung và gửi lại | Đã triển khai; Admin phê duyệt đã được nhóm xác nhận hoạt động |
| Kích hoạt | Chủ sách đặt lịch và cập nhật đúng phiên đã duyệt | Đã triển khai; chờ nghiệm thu SQL thật đầy đủ |
| Đăng lại | Phiên cuối kết thúc không người thắng, giữ sách và lịch sử | Đã triển khai; có test policy và fixture trong smoke |
| Danh mục | Chỉ bài đã duyệt/phiên kích hoạt, ẩn ngưỡng giá | Đã triển khai; có kiểm thử HTTP |
| Quy tắc đấu giá | Giá, lịch, cooldown, kết thúc sớm/hết hạn và tiền 18 chữ số | Đã có policy thuần và test; chưa nối vào API/SQL |
| Khóa phiên | Redis token, lease, gia hạn/xóa có điều kiện | Đã có module và test Redis; chưa nối vào worker |

## Công việc tiếp theo

| Lĩnh vực | Công việc |
|---|---|
| Đặt giá | Thống nhất [lưu kết quả yêu cầu](auction-processing.md), rồi nối API/Streams/SQL/worker; policy và khóa đã chuẩn bị |
| Kết thúc | Hết hạn/ngưỡng giá, kết quả duy nhất, giao dịch chỉ khi có người thắng |
| Realtime | Xác thực socket, room, worker → API, phục hồi sau COMMIT |
| AI | Tích hợp Gemini, trích xuất bằng chứng, bộ chấm điểm và trạng thái thiếu dữ liệu |
| Hồ sơ | Cập nhật thông tin cá nhân theo phạm vi được thống nhất |
| Sau phiên | Giao dịch, trò chuyện, bình luận, đánh giá uy tín, khiếu nại theo thiết kế |
| Thực nghiệm | Kiểm thử đồng thời, tải lớn, phục hồi tiến trình và tổng hợp báo cáo |

Chưa có chức năng xóa bài đăng hoặc kết thúc phiên thủ công.
Không triển khai thêm trạng thái nghiệp vụ, cổng thanh toán hay cơ chế xác thực khác khi chưa thống nhất.

## Checklist nghiệm thu môi trường nhóm

- [ ] Cập nhật mã, giữ cấu hình và volume hiện tại; khởi động lại API/worker/web.
- [ ] SQL readiness 19 bảng/144 cột; cấu hình Cloudinary đầy đủ.
- [ ] Hai tab cùng trình duyệt giữ Admin/người dùng riêng; F5, logout và mở tab mới đúng chính sách.
- [ ] Ba ô tiền lọc chữ, định dạng khi nhập/dán/xóa; API nhận chuỗi nguyên chính xác.
- [ ] Đăng sách với ảnh và video thật; Admin từ chối, bổ sung, duyệt và chủ sách kích hoạt đúng phiên.
- [ ] API danh mục không có `gia_toi_thieu`.
- [ ] `check`, `test`, `build`, `smoke`, `smoke:auth`, `smoke:m4` đạt sau cập nhật.
- [ ] Lưu log/ảnh nghiệm thu phù hợp, đã loại thông tin nhạy cảm.

Các xác nhận cũ không tự thay thế kiểm tra hồi quy cho bản cập nhật mới.
