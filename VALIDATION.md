<!-- Mục đích: Ghi kết quả kiểm tra thực tế và phân biệt phụ thuộc thật với giả lập. -->

# Kết quả kiểm tra

Ngày: 22/10/2026. Nền mã: nhánh `feat/Hai`, commit `bb3ba13eaa818486f572dcdf105ab92359ac48f3`.
Bản cập nhật bổ sung tài khoản, xác thực và phân quyền theo phương án A.

## 1. Kết quả trong môi trường chuẩn bị bản cập nhật

| Hạng mục | Kết quả | Phạm vi và giới hạn |
|---|---|---|
| Cài thư viện | Đạt | `npm ci --no-audit --no-fund`, Node 24.19.0 |
| Cú pháp | Đạt | `npm run check`: 34 file JS phía máy chủ và script |
| Kiểm thử mặc định | Đạt | `npm test`: 31 đạt, 1 SKIP; model/store giả, Argon2 thật |
| Kiểm thử có Redis thật | Đạt | 32/32 đạt; gồm TTL 2 giờ, gia hạn, hết hạn, thu hồi và bộ đếm đồng thời |
| Phiên bản Redis thử riêng | 7.0.15 | Chưa xác minh lại trên Redis 8 trong Docker của nhóm |
| Build React | Đạt | `npm run build`, Vite 8.3.5 |
| Trình duyệt desktop | Đạt | Chromium: đăng ký, đăng nhập, F5 giữ phiên, đăng xuất, Admin và điều hướng |
| Trình duyệt mobile | Đạt | Viewport 390 px; không tràn ngang; đã xem ảnh render |
| Bảo vệ cookie | Đạt trong QA trình duyệt | HttpOnly, SameSite=Lax; auth không lưu trong Local Storage/Session Storage |
| Dữ liệu trong QA trình duyệt | Model giả, Redis thật | Không phải bằng chứng SQL Server thật |
| Script setup:auth | Đạt | Giữ cấu hình cũ, tự sinh secret, chạy lại không thay secret, nhận diện secret mẫu |
| Không đổi schema | Đã đối chiếu file | DDL 19 bảng/142 trường giữ nguyên so với commit nền |
| Smoke SQL/Redis/worker thật sau cập nhật | Chưa chạy | Môi trường chuẩn bị không có SQL Server/Docker |
| Smoke auth với SQL Server thật | Chưa chạy | Chạy `npm.cmd run smoke:auth` trên máy Hải |
| Admin INSERT SQL thật | Chưa xác minh | Script đã có; cần chạy `admin:create` trên máy Hải |

Các bài test auth bao gồm: email trùng, đầu vào sai, từ chối tự truyền vai trò Admin,
CSRF thiếu/sai, đăng nhập sai/email lạ, đổi session ID/CSRF, phân quyền 401/403/200,
đổi quyền tại SQL model có hiệu lực ở request kế tiếp, xóa tài khoản làm phiên bị từ chối,
đăng xuất/thu hồi, TTL, lỗi store, lỗi SQL, Redis unavailable và CORS.

Các ca SQL model giả không kiểm chứng thực thi cú pháp truy vấn, UNIQUE hoặc kết nối
trên SQL Server thật. Cần chạy smoke trên máy nhóm trước khi xác nhận hoàn tất Mốc 3.

## 2. Bằng chứng Mốc 2 do Hải xác nhận

Hải đã xác nhận:
- SQL Server và Redis healthy.
- Giao diện đủ năm trạng thái sẵn sàng.
- Probe completed.
- `npm.cmd run smoke` PASS.

Đây là kết quả trên máy Hải trước bản cập nhật tài khoản.
Sau khi cập nhật cần chạy lại `smoke` để xác nhận không ảnh hưởng luồng cũ.

## 3. Kết quả trên máy Hải được xác nhận ngày 22/10/2026

Hải xác nhận đã chạy chức năng tài khoản thành công:

| Nội dung | Kết quả / nguồn |
|---|---|
| Tạo tài khoản | Thành công, theo xác nhận của Hải |
| Đăng nhập người dùng | Thành công, theo xác nhận của Hải |
| Tạo và đăng nhập tài khoản Admin | Thành công, theo xác nhận của Hải |

Đây là xác nhận sử dụng trên máy phát triển của nhóm, không phải kết quả SQL được chạy
trực tiếp trong môi trường chuẩn bị bản cập nhật ở mục 1. Chưa có log smoke hoặc ảnh
nghiệm thu bổ sung trong lần xác nhận này.

## 4. Rà soát mã nguồn và bản sửa tài liệu

Đã đối chiếu nhánh `feat/Hai` tại commit `3ad972ee6cfda4d084aff3f68070ae83a815c62b`
với bản cập nhật Mốc 3; các file chức năng tài khoản đã có đầy đủ.

Kết quả chạy lại trên mã nguồn commit đó:

- `npm ci --no-audit --no-fund`: thành công.
- `npm run check`: đạt, 34 file JavaScript.
- `npm test`: 31 đạt, 1 SKIP, không lỗi; bài Redis thật chưa bật biến opt-in.
- `npm run build`: thành công.

Bản sửa tiếp theo đồng bộ hướng dẫn tài khoản vào README, cập nhật xác nhận trên máy Hải
và thêm tên volume chuẩn cho máy cài mới vào `.env.example`. Fallback volume hiện hành
trong Compose được giữ nguyên; không sửa `.env` riêng hoặc dữ liệu.

Kiểm tra riêng cho bản sửa cấu hình và tài liệu:

- Đọc YAML thành công; hai fallback volume giống trước bản sửa.
- Chạy setup trong thư mục tạm: máy cài mới nhận đủ hai tên volume chuẩn.
- Chạy lại setup với `.env` đã có: nội dung file được giữ nguyên.
- Chạy setup:auth với cấu hình cũ: chỉ bổ sung session, không thêm hoặc đổi biến volume.
- Liên kết và anchor Markdown nội bộ hợp lệ; không còn tham chiếu hai file hướng dẫn riêng đã xóa.

Các kiểm tra này không khởi động Docker, không xác nhận mount thực tế trên máy Hải
và không thay thế `smoke` / `smoke:auth` với SQL Server thật.

## 5. Điều kiện nghiệm thu còn lại

Làm theo [README, mục 6–7](README.md#6-kiểm-tra-tài-khoản-trên-giao-diện),
kiểm tra giữ phiên sau F5, đăng xuất, quyền Admin và chạy `smoke` / `smoke:auth`
trên Windows với SQL Server/Redis thật. Chỉ đánh dấu PASS khi có kết quả tương ứng.

Chưa triển khai các nghiệp vụ đăng sách, AI, đặt giá hoặc kết thúc phiên.
Socket.IO hiện chỉ có lời chào kiểm tra hạ tầng công khai.
