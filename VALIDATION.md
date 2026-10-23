<!-- Mục đích: Ghi bằng chứng kiểm tra theo chức năng, môi trường và giới hạn xác minh. -->

# Kết quả kiểm tra

Cập nhật ngày 23/10/2026. Các kết quả dưới đây phân biệt rõ kiểm thử trong môi trường chuẩn bị
và xác nhận sử dụng trên Windows của nhóm.

## Môi trường kiểm thử tự động

| Thành phần | Môi trường |
|---|---|
| Node.js | 24.19.0; dependency giữ theo package-lock.json |
| HTTP | Express thật; cookie jar/CSRF qua HTTP |
| SQL | Driver/model giả trong test; chưa có SQL Server/Docker trong môi trường chuẩn bị |
| Redis opt-in | Redis 7.0.15 riêng, prefix UUID và cleanup đúng khóa test |
| Cloudinary | REST/provider giả; upload/destroy thật cần credentials của nhóm |
| Frontend | React, Vite 8.3.5; Chromium desktop/mobile khi chạy QA |

Redis trong Compose của nhóm là Redis 8. Kết quả Redis 7 riêng không thay xác minh trên môi trường đó.

## Kết quả bản cập nhật hiện tại

| Hạng mục | Trạng thái |
|---|---|
| Cú pháp Backend/script | Đạt: 55 file qua `npm run check` |
| Test mặc định | Đạt: 56 ca, 3 SKIP theo opt-in |
| Test bật Redis thật | Đạt: 59/59 ca với Redis riêng |
| Build Frontend | Đạt: Vite 8.3.5, không thêm dependency |
| Hai tab cùng một browser context | Đạt: Admin/người dùng, F5, opener sao chép storage, tab mới và logout riêng |
| Nhập tiền và payload | Đạt cả ba ô: gõ/dán/lọc chữ, caret, giới hạn 18 chữ số và POST nguyên chính xác |
| Liên kết Markdown và bố cục README | Đạt kiểm tra đường dẫn, fence, thuật ngữ và mục Tài liệu cuối README |

## Phạm vi hồi quy

### Xác thực và phiên tab

Argon2id, email trùng, không tự cấp Admin, session rotation, TTL/gia hạn/thu hồi, CSRF thiếu/sai,
phân quyền và vai trò đọc lại, CORS và lỗi phụ thuộc không lộ bí mật.
Kiểm tra hai tài khoản trong **một cookie jar chung**, cookie HttpOnly, CSRF theo tab,
đăng nhập/đăng xuất không ảnh hưởng tab khác, selector thiếu cookie không cấp quyền,
không fallback sang cookie chung, header sai bị chặn và listener không tăng theo số tab.
Redis opt-in kiểm tra session/TTL riêng và thu hồi độc lập.

### Dữ liệu bài đăng và media

Giá chuỗi 18 chữ số, input không được phép, UUID/version, lịch có múi giờ, lý do/quý hiếm,
cặp trạng thái, điều kiện đăng lại latest/no-winner/winner/missing-result, public projection,
quyền/CSRF, MIME/magic, giới hạn upload và phản hồi provider.
Claim/cleanup được kiểm tra với Redis thật nhưng SQL/provider giả, gồm ownership, đồng thời,
rollback/retry, SQL reference, SQL lỗi và commit chưa rõ.

### Phiên bản và nhập tiền

Model thật cùng driver giả trả binary kiểm tra bytes → hex → JSON → HTTP → khóa dòng,
duyệt thành công, kích hoạt pending 409 và chặn version cũ. Không nới validator để bỏ qua xung đột.
Tiền kiểm tra lọc chữ, dấu chấm nhóm nghìn, giá trị chính xác qua chuỗi, 18 chữ số và vị trí caret.
QA Chromium đã xác nhận nhập/dán/xóa, payload không có dấu chấm và gửi đúng dữ liệu;
đồng thời kiểm tra luồng từ chối/bổ sung/duyệt/kích hoạt, không tràn ngang ở 390 px, desktop 1440 px và không có pageerror.
Ảnh render đã được xem để kiểm tra bố cục. Redis thật, SQL/Cloudinary giả; harness và ảnh QA là đầu ra tạm ngoài repository.

## Xác nhận trên máy nhóm

| Chức năng | Bằng chứng đã nhận |
|---|---|
| Hạ tầng | Nhóm xác nhận SQL/Redis healthy, đủ trạng thái, probe completed và smoke PASS |
| Tài khoản | Nhóm xác nhận tạo/đăng nhập Admin và người dùng, smoke:auth PASS |
| Kiểm duyệt | Ngày 23/10/2026, nhóm xác nhận Admin phê duyệt hoạt động sau sửa row_version |
| Smoke toàn luồng bài đăng | Trước sửa version đã FAIL 400 thay vì 409; cleanup báo hoàn tất. Chưa có xác nhận PASS toàn luồng sau cập nhật |
| Tách phiên tab/định dạng tiền | Cần nghiệm thu bản cập nhật này trên Windows và dịch vụ thật |

Xác nhận Admin duyệt thành công không tự chứng minh toàn bộ smoke bài đăng đã đạt.
Không khẳng định ảnh/log nghiệm thu riêng của nhóm đã được lưu trong repository.

## Nghiệm thu còn lại

Theo [README](README.md), cập nhật cả API và Frontend, đăng nhập lại trong từng tab,
chạy các lệnh check/test/build/smoke/smoke:auth/smoke:m4 và thử ảnh/video thật.
Smoke bài đăng chỉ PASS khi dọn xong cả SQL và Cloudinary của dữ liệu UUID thử.

Chưa có bằng chứng tải lớn, thời lượng video, production HTTPS, distributed commit hoặc phục hồi hoàn toàn khi mất Redis.
Claim chưa rõ commit vẫn cần đối soát thủ công. Lõi đặt giá/kết thúc, realtime nghiệp vụ và AI chưa triển khai.
