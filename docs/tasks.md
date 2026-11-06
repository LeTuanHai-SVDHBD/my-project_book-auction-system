<!-- Mục đích: Phạm vi chức năng đã hoàn thành và checklist bàn giao, không thay bằng chứng kiểm thử. -->

# Trạng thái hoàn thành và bàn giao

Rà soát theo nhánh `feat/Hai` ngày **03/11/2026**. Dự án đã hoàn thành triển khai phạm vi chức năng
được chốt; nhóm đã xác nhận các mốc đến **Mốc 8**. Bảng này không xác nhận lại mọi dịch vụ thật hoặc
mọi bản sửa mới nhất; bằng chứng cụ thể và giới hạn xem [VALIDATION.md](../VALIDATION.md).

## Phạm vi hiện có

| Nhóm | Chức năng đã có trong source |
|---|---|
| Hạ tầng | Docker SQL/Redis, API/worker/web, health/probe/heartbeat, dev:all |
| Tài khoản | Đăng ký/đăng nhập/đăng xuất, Argon2id, session/CSRF/quyền; login mới thu hồi phiên cũ |
| Bản sách | Bốn bước, thể loại có danh mục, ISBN tùy chọn, mô tả chung, tiền nguyên, nháp theo tài khoản |
| Media | Nhiều định dạng, nhận diện nội dung, vé Redis/Cloudinary, gỡ media mới/cũ đúng vòng, recovery và cleanup |
| Kiểm duyệt | Chờ và từ chối trong danh sách Admin, quyết định có lý do, bổ sung đủ hồ sơ, snapshot/PDF |
| AI | Tự duyệt theo hai ngưỡng cấu hình, lý do từ chối, JSON/hai điểm/NULL, lịch sử, Files API cho video dài |
| Phiên | Chủ sách kích hoạt lịch; một bản vật lý, đăng lại có điều kiện, giữ lịch sử |
| Giá/kết thúc | Admission/Streams, khóa/transaction/receipt, bước giá/cooldown, ngưỡng hoặc hết hạn, kết quả duy nhất |
| Thời gian thực | Tín hiệu sau COMMIT, snapshot/reconnect/polling, đồng hồ SQL, trạng thái yêu cầu riêng |
| Sau phiên | Giao dịch/chat, hai xác nhận, người mua đánh giá, uy tín/bình luận công khai |
| Khiếu nại | Hồ sơ/bằng chứng, tiếp nhận/phân công Admin, chat đọc đúng phạm vi, phản hồi xử lý |
| BookBid | Responsive, sidebar Admin, gallery/kính lúp/đổi ảnh bàn phím, tìm kiếm SQL, hộp ThongBao riêng |

Không còn đặt mục “tích hợp AI”, “bổ sung frontend” hoặc “Mốc 8” là công việc chưa triển khai.
Nghiệm thu bằng dữ liệu thật, đánh giá chất lượng AI và thử tải vẫn là các hoạt động kiểm chứng riêng.

## Checklist bàn giao trên máy nhóm

Các ô trống là **chưa ghi nhận bằng chứng mới cho lượt bàn giao này**, không phủ nhận xác nhận mốc trước đó.

- [ ] Đúng nhánh; giữ `.env`/volume, Node 24.x; đã cập nhật dependency theo lockfile và migration 002–008.
- [ ] SQL readiness **21 bảng/166 cột**; Docker healthy, API/worker chạy; probe hoàn tất.
- [ ] Khách không có avatar/hộp tin; hai tài khoản khác nhau dùng hai tab được.
- [ ] Login cùng tài khoản nơi mới thu hồi tab cũ; F5 không hồi sinh phiên cũ hoặc làm mất phiên mới.
- [ ] Nhập tiền không lặp/chèn số, giữ 18 chữ số; thể loại, ISBN và mô tả lưu đúng.
- [ ] Nháp giữ trường/bước/media khi chuyển route; upload tiếp tục; reload và hết hạn vé báo đúng.
- [ ] Đăng sách với ảnh/video thật, mở lại sau gửi để đối chiếu tệp đã gắn SQL.
- [ ] Bật tự duyệt trên môi trường test: bài mới/gửi lại → tự phân tích → duyệt hoặc từ chối có căn cứ; lỗi dịch vụ giữ chờ.
- [ ] Video >5 phút được gửi Files API; đối chiếu manifest/timestamp với nội dung thật, không coi “đã gửi” là chất lượng thẩm định đạt.
- [ ] Từ chối → bổ sung đủ hồ sơ/gỡ-thay media → gửi lại → phê duyệt; lịch sử/PDF cũ giữ đúng dữ liệu.
- [ ] Chủ sách kích hoạt lịch; người mua không nhận `gia_toi_thieu` qua API/snapshot/thông báo.
- [ ] Tranh giá/cooldown/retry cùng mã, hai kiểu kết thúc, kết quả và giao dịch không trùng.
- [ ] Nhiều trình duyệt cùng snapshot; mất mạng/reconnect bắt kịp; hết giờ chờ xác nhận SQL rồi mới hiện người thắng.
- [ ] Chat đúng hai bên, đánh dấu đọc đúng người nhận, hai xác nhận và đánh giá đúng người mua/một lần.
- [ ] Khiếu nại có ảnh thật, hai Admin tranh tiếp nhận, quyền chat mất khi xử lý xong; không lộ hồ sơ cho bên còn lại.
- [ ] Tìm kiếm không dấu/lọc/phân trang, thông báo riêng/đọc bền/không trùng, PDF và gallery trên desktop/mobile.
- [ ] Lưu log/ảnh phiên bản và kết quả smoke/test opt-in đã che bí mật; không đánh dấu SKIP là PASS.

Hướng dẫn lệnh và điều kiện chạy: [setup-guide.md](setup-guide.md), [VALIDATION.md](../VALIDATION.md).

## Phần ngoài phạm vi

Chưa có thanh toán/vận chuyển/hoàn tiền tự động, hồ sơ cá nhân mở rộng, theo dõi phiên/nhắc hết hạn,
email/push hệ điều hành, CDN bằng chứng riêng tư, chữ ký số PDF, công cụ replay dead-letter hoặc benchmark production.
Những phần này cần yêu cầu/thiết kế riêng; không được mô tả như chức năng đang hoạt động.
