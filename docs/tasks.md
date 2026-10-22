<!-- Mục đích: Theo dõi phạm vi triển khai và bằng chứng nghiệm thu từng mốc. -->

# Tiến độ dự án

## 1. Quy ước

- **Đã triển khai:** đã có mã nguồn/cấu hình.
- **Đã kiểm tra:** đã chạy và có kết quả cụ thể, nêu rõ phụ thuộc thật hay giả.
- **Chờ nghiệm thu:** cần xác minh trên môi trường thật của nhóm.
- **Chưa triển khai:** thuộc phần việc tiếp theo.

## 2. Mốc 2 — Hạ tầng

Hải xác nhận ngày 22/10/2026:

- SQL Server và Redis đều healthy.
- Giao diện có đủ năm trạng thái sẵn sàng.
- Probe đã completed.
- `npm.cmd run smoke` PASS.

Theo xác nhận trên, mốc 2 đã đạt điều kiện chạy thành công trên máy phát triển.
Ảnh chụp và log báo cáo do nhóm lưu trên máy của mình; không khẳng định đã có trong repository.

## 3. Mốc 3 — Tài khoản, xác thực và phân quyền

Phương án A đã được Hải chọn: session Redis, cookie HttpOnly và Argon2.

Ngày 22/10/2026, Hải xác nhận đã tạo tài khoản và đăng nhập thành công
bằng tài khoản Admin và người dùng trên máy phát triển.
Xác nhận này được ghi riêng với kết quả kiểm thử tự động; chưa suy ra các lệnh smoke đã PASS.

| Mã | Công việc | Trạng thái |
|---|---|---|
| M3-01 | Đọc/ghi NguoiDung bằng SQL tham số hóa | Đã triển khai; Hải xác nhận tạo tài khoản và đăng nhập thành công trên máy phát triển |
| M3-02 | Đăng ký, đăng nhập, đăng xuất, thông tin tài khoản | Đăng ký/đăng nhập được Hải xác nhận; đăng xuất và thông tin tài khoản có kiểm thử tự động |
| M3-03 | Băm Argon2id, không trả hash về client | Đã kiểm tra với Argon2 thật |
| M3-04 | Session Redis, TTL 2 giờ, gia hạn, hết hạn và thu hồi | Đã kiểm tra với Redis thật riêng |
| M3-05 | CSRF, chống tự nâng quyền và kiểm tra Admin | Đã triển khai và kiểm tra tự động |
| M3-06 | Giới hạn thử nguyên tử qua Redis | Đã kiểm tra đồng thời trên Redis thật |
| M3-07 | Tạo Admin qua terminal, mật khẩu không hiển thị | Đã có script; Hải xác nhận tài khoản Admin đã tạo và đăng nhập được |
| M3-08 | Form React và điều hướng kiểm tra hạ tầng | Đã triển khai và build; Hải xác nhận tạo tài khoản, đăng nhập thành công |
| M3-09 | Script setup:auth bổ sung cấu hình còn thiếu | Đã triển khai; không ghi đè giá trị đang có |
| M3-10 | Smoke tài khoản qua API/SQL/Redis thật | Đã có script; chưa ghi nhận kết quả PASS trên máy Hải |
| M3-11 | Nghiệm thu đầy đủ Windows + SQL Server + Redis 8 | Đã xác nhận tạo tài khoản/đăng nhập; các bước nghiệm thu còn lại cần ghi kết quả |

## 4. Checklist nghiệm thu Mốc 3

- [x] Cài thư viện và cấu hình auth đủ để chạy trên máy nhóm, theo xác nhận của Hải.
- [x] Tạo tài khoản và đăng nhập Admin thành công trên máy nhóm.
- [x] Tạo tài khoản và đăng nhập người dùng thành công trên máy nhóm.
- [ ] Refresh vẫn giữ đăng nhập khi session còn hạn.
- [ ] Đăng xuất và không dùng lại được cookie cũ.
- [ ] Người dùng thường bị chặn quyền Admin.
- [ ] Admin kiểm tra quyền thành công.
- [ ] `check`, `test`, `build` đạt.
- [ ] `smoke` mốc 2 vẫn PASS sau cập nhật.
- [ ] `smoke:auth` PASS trên máy nhóm.

## 5. Phần chưa triển khai

- Đăng sách, kiểm duyệt và phân tích AI.
- Kích hoạt phiên.
- Đặt giá, khóa theo phiên và chống ghi trùng.
- Kết thúc phiên và xác định người thắng.
- Các nghiệp vụ giao dịch, trò chuyện, đánh giá và khiếu nại theo phạm vi đã chốt.

Cơ chế chuyển thông báo từ worker sang API và phục hồi sau COMMIT còn cần thống nhất
trước khi triển khai luồng đấu giá hoàn chỉnh; xem ADR-009.
