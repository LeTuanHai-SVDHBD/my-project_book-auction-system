<!-- Mục đích: Lưu bằng chứng kiểm tra, phân biệt phụ thuộc thật và giả. -->

# Kết quả kiểm tra

Ngày 22/10/2026. Bản Mốc 4 được xây trên nhánh `feat/Hai`, nền commit
`24447dba38445eac4221b980596f2ebf3fb08b02`.

## 1. Xác nhận của Hải trước Mốc 4

- SQL Server và Redis healthy, giao diện đủ năm trạng thái sẵn sàng, probe completed.
- Đăng ký/đăng nhập người dùng và tạo/đăng nhập Admin thành công.
- Hải xác nhận hai lệnh `npm.cmd run smoke` và `npm.cmd run smoke:auth` đều PASS.

Theo bằng chứng đó Mốc 3 đã hoàn thành trên máy phát triển của nhóm.
Không khẳng định đã nhận log/ảnh đầy đủ hoặc đã chạy trực tiếp SQL trên máy Hải.
Sau khi cập nhật M4 cần chạy lại hai smoke để kiểm tra hồi quy.

## 2. Kiểm tra bản Mốc 4 trong môi trường chuẩn bị

| Hạng mục | Kết quả | Giới hạn |
|---|---|---|
| Node/dependency | Node 24.19.0, giữ nguyên dependency và package-lock | Dùng bộ dependency đã cài bằng npm ci ở bản nền; không thêm thư viện |
| Cú pháp | Đạt, 51 file JavaScript qua `npm run check` | Không phải kiểm tra thực thi T-SQL |
| Test mặc định | 45 đạt, 2 SKIP | SQL/Cloudinary giả; bài Redis thật bật opt-in |
| Test có Redis thật | 47/47 đạt | Redis 7.0.15 riêng; SQL/provider vẫn giả |
| Build React | Đạt, Vite 8.3.5 | Không chứng minh kết nối SQL/Cloudinary thật |
| Browser desktop/mobile | Đạt luồng tạo → từ chối → bổ sung → duyệt → kích hoạt → danh mục | React/Express/Redis thật, SQL và Cloudinary giả; viewport 1440 và 390 px |
| Cookie/session | Giữ cơ chế M3, HTTP test hồi quy đạt | Production HTTPS chưa kiểm tra |
| SQL migration 002 | Đã kiểm tra mã: thêm hai cột nullable/index, 001 không đổi | Chưa chạy trên SQL Server thật trong môi trường này |
| Upload/destroy Cloudinary | Test REST contract, kiểm tra URL/kind/public_id và lỗi redacted | Không có credentials; chưa upload/destroy thật |
| Video thật | Chưa kiểm tra | Có test magic WebM và route dùng chung; nhóm cần thử MP4/WebM thật |
| smoke, smoke:auth, smoke:m4 sau M4 | Chưa chạy thật | Không có SQL Server/Docker và credentials Cloudinary ở đây |

Các ca M4 gồm tiền chuỗi 18 chữ số, trường không được phép, UUID/version, lịch có múi giờ,
quý hiếm/lý do duyệt, trạng thái đôi, điều kiện đăng lại latest/no-winner/winner/missing-result,
public projection, auth/role/CSRF, MIME/magic và Cloudinary response validation.
Service test phân biệt rollback chắc chắn, commit chưa rõ và acknowledgement Redis lỗi sau COMMIT.

Redis thật kiểm tra ownership, claim đồng thời chỉ một request thắng, release/retry,
cleanup không xóa file được SQL tham chiếu, giữ claim chưa rõ, SQL lỗi không destroy,
xóa tệp bỏ dở và vé hết hạn. Prefix UUID riêng được dọn; không xóa khóa ứng dụng.
Browser kiểm tra upload PNG nhị phân qua API, role riêng, giữ ID phiên khi kích hoạt,
không hiển thị ngưỡng giá trên trang công khai, không tràn ngang và không có pageerror.
Ảnh QA là đầu ra tạm của quá trình kiểm tra, không đưa vào repository.

## 3. Phần cần nghiệm thu trên Windows của nhóm

Làm theo README mục 11: `setup:media`, cấu hình Cloudinary local, `db:migrate`, khởi động API/worker/web,
rồi chạy check/test/build/smoke/smoke:auth/smoke:m4. Không xóa dữ liệu hay volume M3.

Smoke M4 dùng tài khoản/dữ liệu UUID riêng: kiểm tra rollback SQL khi gắn media lỗi,
retry tạo bài, quyền/CSRF, cặp trạng thái pending/reject/approve, kiểm duyệt đồng thời,
kích hoạt đúng phiên, ẩn giá và fixture kết quả không người thắng/có người thắng cho đăng lại.
Chỉ PASS nếu dọn cả SQL và Cloudinary thành công. Fixture không tạo API kết thúc thủ công.
Đây là script **chờ chạy**, không phải bằng chứng đã thực thi trong môi trường chuẩn bị.

Chưa có kiểm thử tải lớn, thời lượng video, distributed commit SQL–Cloudinary hoặc phục hồi hoàn toàn khi mất Redis.
Claim chưa rõ commit được giữ để đối soát thủ công; không đánh đổi an toàn media bằng xóa phỏng đoán.
Mốc 5 (đặt giá/kết thúc), Mốc 6 realtime nghiệp vụ và Mốc 7 AI chưa triển khai trong bản này.


## 4. Sửa lỗi phiên bản dữ liệu — 23/10/2026

Hải đã chạy smoke M4 trên máy Windows với dịch vụ thật. Log cho thấy lệnh đến bước
“quyền sở hữu, CSRF, không kích hoạt trước duyệt”, nhận HTTP 400 `INVALID_POST_INPUT` thay vì 409.
Script báo đã dọn dữ liệu/media thử. Hải đồng thời báo Admin không phê duyệt được vì “Thiếu phiên bản dữ liệu”.
Đây là kết quả **FAIL**, chưa phải bằng chứng hoàn tất smoke M4.

Bản sửa:
- Đọc BINARY(8), mã hóa bytes thành hex 16 ký tự ở model cho cả list/detail/locked.
- Giữ validator HTTP chặt chẽ, vẫn chặn dữ liệu cũ 409; không giả lập token khi thiếu.
- Thêm test model thật và HTTP, driver trả bytes thay cho model giả đã trả sẵn chuỗi hợp lệ.
- Smoke kiểm tra hình dạng row_version ngay sau GET detail và in thêm thông báo lỗi API.
- README giải thích rõ chưa có xóa bài và không tự xóa Cloudinary khi xóa SQL thủ công.

Kiểm tra bản sửa đã chạy: `npm run check` đạt 53 file; `npm test` mặc định 49 đạt/2 SKIP;
bật Redis thật đạt 51/51; `npm run build` thành công. Các test mới dùng model thật với driver SQL giả trả bytes,
không phải bằng chứng đã chạy T-SQL trên SQL Server thật.
SQL/Cloudinary thật không có sẵn trong môi trường sửa; cần chạy lại smoke trên máy Hải sau cập nhật và restart API.
