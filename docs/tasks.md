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
| Phiên tab | Khác tài khoản độc lập; login mới thu hồi session cũ, F5 không khôi phục | Đã kiểm tra hai API/Redis/Socket thật và trình duyệt; chờ máy nhóm |
| Nhập tiền | Ô nhập số thuần; xem trước có dấu chấm, chuỗi nguyên tối đa 18 chữ số | Đã kiểm tra HTTP/Redis và trình duyệt; chờ nghiệm thu máy nhóm |
| Thể loại | Danh mục chung, tìm không dấu, chỉ lưu lựa chọn; bổ sung nhóm sách cổ/tư liệu | Đã kiểm tra API và bàn phím/chuột trên desktop/mobile |
| Đăng sách | Tạo sách/bài/phiên pending và media trong transaction | Đã triển khai; có smoke tích hợp |
| Media | Cloudinary, vé Redis, ownership, cleanup | Đã triển khai; kiểm thử hợp đồng và Redis; media thật cần nghiệm thu |
| Kiểm duyệt | Phê duyệt/từ chối có lý do, bổ sung và gửi lại | Đã triển khai; Admin phê duyệt đã được nhóm xác nhận hoạt động |
| Kích hoạt | Chủ sách đặt lịch và cập nhật đúng phiên đã duyệt | Đã triển khai; chờ nghiệm thu SQL thật đầy đủ |
| Đăng lại | Phiên cuối kết thúc không người thắng, giữ sách và lịch sử | Đã triển khai; có test policy và fixture trong smoke |
| Danh mục | Chỉ bài đã duyệt/phiên kích hoạt, ẩn ngưỡng giá | Đã triển khai; có kiểm thử HTTP |
| Đặt giá | API/Streams/worker/SQL, giá/lịch/cooldown, quyết định cuối và tiền 18 chữ số | Đã kiểm tra SQL/Redis thật và smoke tích hợp; chờ môi trường nhóm |
| Khóa và phục hồi | Lease/token, rowversion, UNIQUE, pending/XAUTOCLAIM | Đã kiểm tra mất lease và crash sau COMMIT/trước ACK |
| Kết thúc | Hết hạn/ngưỡng, một kết quả, giao dịch chỉ khi có người thắng | Đã kiểm tra SQL/Redis thật và smoke tích hợp |
| Giao diện đấu giá | Gửi giá, chờ/chấp nhận/từ chối, retry cùng mã và kết quả | Đã kiểm tra nhiều tab, mất phản hồi mạng và desktop/mobile |
| Thời gian thực | Worker → Pub/Sub → Socket, room công khai, lịch sử, đồng hồ SQL và lấy lại snapshot | Đã kiểm tra HTTP/Redis/Socket và hai browser độc lập; chờ smoke dịch vụ SQL thật của nhóm |
| AI hỗ trợ kiểm duyệt | Gemini JSON, hai điểm độc lập, bằng chứng/NULL/cảnh báo, lịch sử và phân tích lại | Hải xác nhận smoke:ai PASS; đối chiếu sách có ảnh/video thật để test sau khi có dữ liệu |
| Giao dịch | Đối chiếu chuỗi kết quả/người mua/bán/giá; đủ hai xác nhận mới hoàn tất | Đã triển khai; HTTP/trình duyệt đạt, chờ SQL thật và smoke:m8 |
| Chat riêng | Một phòng/giao dịch, văn bản, chỉ người nhận đánh dấu đọc, phân trang | Đã kiểm tra quyền/CSRF và nhiều tab; SQL thật opt-in chưa chạy |
| Uy tín và bình luận | Người mua đánh giá sau hoàn tất; bình luận trong giờ phiên, giữ lịch sử | Đã kiểm tra policy/HTTP/trình duyệt; chờ SQL thật ở biên giờ/đồng thời |
| Khiếu nại | Ảnh có vé sở hữu, phân công Admin, chat chỉ đọc khi đang xử lý | Đã kiểm tra HTTP/Redis/trình duyệt với SQL và Cloudinary giả; chờ dịch vụ thật |

## Công việc tiếp theo

| Lĩnh vực | Công việc |
|---|---|
| Hồ sơ | Cập nhật thông tin cá nhân theo phạm vi được thống nhất |
| Nghiệm thu sau phiên | Chạy SQL opt-in, smoke:m8 và ảnh bằng chứng Cloudinary thật theo after-sales.md |
| Thực nghiệm | Kiểm thử đồng thời, tải lớn, phục hồi tiến trình và tổng hợp báo cáo |

Chưa có chức năng xóa bài đăng hoặc kết thúc phiên thủ công.
Không triển khai thêm trạng thái nghiệp vụ, cổng thanh toán hay cơ chế xác thực khác khi chưa thống nhất.

## Checklist nghiệm thu môi trường nhóm

- [ ] Cập nhật mã, giữ cấu hình và volume hiện tại; khởi động lại API/worker/web.
- [ ] SQL readiness 21 bảng/161 cột; cấu hình Cloudinary đầy đủ.
- [ ] Hai tab cùng trình duyệt giữ Admin/người dùng riêng; F5, logout và mở tab mới đúng chính sách.
- [ ] Cùng tài khoản ở hai cửa sổ: phiên mới hoạt động, tab cũ tự về đăng nhập; F5 không hồi sinh hoặc đăng xuất phiên mới.
- [ ] Ba ô tiền không lặp số khi gõ/IME, focus/blur, dán/xóa; dòng Giá trị nhóm nghìn, API nhận chuỗi nguyên chính xác.
- [ ] Đăng sách với ảnh và video thật; Admin từ chối, bổ sung, duyệt và chủ sách kích hoạt đúng phiên.
- [ ] API danh mục/đấu giá không có `gia_toi_thieu`.
- [ ] Gửi giá đúng bước/cooldown; theo dõi quyết định và hai kiểu kết thúc trên SQL Server 2022/Redis Compose của nhóm.
- [ ] Hai trình duyệt tự đồng bộ giá/lịch sử/kết quả; mất mạng rồi nối lại tự lấy đúng trạng thái.
- [ ] `check`, `test`, `build`, `smoke`, `smoke:auth`, `smoke:m4`, `smoke:m5`, `smoke:m6` đạt sau cập nhật.
- [x] Hải xác nhận `smoke:ai` PASS; chỉ xác nhận tích hợp, chưa thay thế đánh giá chất lượng ảnh/video.
- [ ] Đối chiếu hai điểm và bằng chứng bằng sách có ảnh/video thật khi Hải có dữ liệu; Admin quyết định.
- [ ] Chạy `test:community` với SQL test riêng và `smoke:m8` trên API/worker/SQL/Redis thật.
- [ ] Người mua/bán chat, xác nhận riêng, đánh giá một lần; người ngoài không xem được giao dịch/chat.
- [ ] Khiếu nại ảnh thật, tranh tiếp nhận giữa hai Admin, quyền chat chỉ trong lúc xử lý; lịch sử sau kết thúc còn nguyên.
- [ ] Lưu log/ảnh nghiệm thu phù hợp, đã loại thông tin nhạy cảm.

Các xác nhận cũ không tự thay thế kiểm tra hồi quy cho bản cập nhật mới.
