<!-- Mục đích: Theo dõi lộ trình đã chốt và bằng chứng nghiệm thu từng mốc. -->

# Tiến độ dự án

## 1. Lộ trình theo file Hải đã gửi

| Mốc | Nội dung | Trạng thái |
|---|---|---|
| 1 | Chốt schema và hợp đồng dữ liệu | Schema nền đã có; M4 thêm metadata media tại migration riêng |
| 2 | Dựng môi trường chạy | Hải xác nhận đủ 5 trạng thái, probe completed và smoke PASS |
| 3 | Tài khoản và phân quyền | Hải xác nhận tạo/đăng nhập Admin và người dùng; smoke và smoke:auth đều PASS |
| 4 | Đăng sách, kiểm duyệt và kích hoạt phiên | Đã triển khai bản này; chờ nghiệm thu SQL/Cloudinary thật trên máy Hải |
| 5 | Hoàn thành lõi đặt giá và kết thúc phiên | Chưa triển khai |
| 6 | Đồng bộ thời gian thực | Chỉ có lời chào hạ tầng; realtime nghiệp vụ chưa triển khai |
| 7 | Tích hợp AI và bộ chấm điểm | Chưa triển khai; không chuyển vào M4 |
| 8 | Giao dịch và các chức năng hỗ trợ | Chưa triển khai |
| 9 | Kiểm thử, thực nghiệm và hoàn thiện báo cáo | Có kiểm thử từng mốc, thực nghiệm tổng thể chưa triển khai |

Không khẳng định log/ảnh nghiệm thu của nhóm đã được lưu trong repository.

## 2. Mốc 3 đã được Hải xác nhận

Phương án A: session Redis, cookie HttpOnly, CSRF và Argon2id.
Ngày 22/10/2026 Hải xác nhận tài khoản Admin/người dùng chạy thành công,
sau đó xác nhận **cả `npm.cmd run smoke` và `npm.cmd run smoke:auth` PASS**.
Đây là bằng chứng trên máy nhóm; khác với kết quả test giả SQL trong môi trường chuẩn bị.
Mốc 3 đủ điều kiện đi tiếp Mốc 4 theo xác nhận này.

## 3. Mốc 4 đã triển khai

| Mã | Chức năng | Trạng thái xác minh |
|---|---|---|
| M4-01 | Tạo Sach, BaiDang, PhienDauGia pending và media trong một transaction | Có model SQL; smoke thật kiểm tra rollback, chờ chạy trên máy Hải |
| M4-02 | Cloudinary ảnh/video, URL/public_id SQL, metadata migration | Provider REST và contract test; chưa có credentials để upload thật |
| M4-03 | Session/ownership/CSRF và vé Redis claim nguyên tử | HTTP test + Redis thật đạt |
| M4-04 | Admin duyệt/từ chối có lý do; cặp trạng thái nguyên tử | Policy/HTTP/browser đạt với SQL giả; smoke thật có kiểm duyệt đồng thời |
| M4-05 | Bổ sung bài từ chối, giữ ID và lịch sử kiểm duyệt | Browser đạt với SQL giả |
| M4-06 | Chủ sách đặt lịch/kích hoạt phiên cũ đã duyệt | Browser đạt; SQL kiểm tra tương lai, chờ smoke thật |
| M4-07 | Đăng lại phiên cuối không người thắng, giữ sach_id/lịch sử | Policy đạt; smoke thật có fixture no-winner/winner |
| M4-08 | Public projection không có gia_toi_thieu, tiền chuỗi 18 chữ số | HTTP/contract/browser đạt |
| M4-09 | Admin duyệt thủ công khi chưa có AI | Browser đạt, không tạo phân tích giả |
| M4-10 | Cleanup media hết hạn, bảo vệ reference SQL và claim chưa rõ | Redis thật đạt với SQL/provider giả; còn giới hạn đối soát thủ công sau crash |
| M4-11 | Giao diện desktop/mobile | Luồng chính đạt với SQL/Cloudinary giả, Redis thật |

## 4. Checklist nghiệm thu Mốc 4 trên máy nhóm

- [ ] Pull nhánh feat/Hai, giữ .env và volume cũ.
- [ ] setup:media, điền Cloudinary local, db:migrate thành công; SQL readiness 19 bảng/144 cột.
- [ ] check, test, build đạt.
- [ ] smoke và smoke:auth vẫn PASS sau cập nhật.
- [ ] Đăng sách với ảnh thật và video thật, xem được media.
- [ ] Bài/phiên cùng pending, chưa có lịch; người khác không sửa/kích hoạt được.
- [ ] Admin từ chối có lý do, chủ sách bổ sung và gửi lại.
- [ ] Admin duyệt khi chưa có AI; chủ sách kích hoạt đúng phiên đã duyệt.
- [ ] Danh mục không trả gia_toi_thieu trong Network response.
- [ ] smoke:m4 PASS và dọn xong dữ liệu/media UUID thử.

Hướng dẫn và API gộp tại README mục 11; không cần file hướng dẫn Mốc 3/Mốc 4 riêng.
Chỉ đánh dấu hoàn tất M4 sau khi nhóm chạy các kiểm tra thật còn lại.
