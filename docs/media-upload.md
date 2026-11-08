<!-- Mục đích: Hợp đồng upload Cloudinary, vé Redis, bảo toàn lịch sử và nháp cục bộ. -->

# Ảnh, video và nháp đăng sách

Cloudinary đã nhận tệp chưa có nghĩa web có vé upload hợp lệ. Chỉ tệp đã xác minh metadata và Redis
ready mới được gắn vào bài; không cho nhập link tùy ý hoặc tự ghép tệp từ Media Library theo tên.
Cài đặt/cấu hình và cách cập nhật tại [setup-guide.md](setup-guide.md).

## Giới hạn và nhận diện

| Phần | Mặc định / giới hạn cấu hình |
|---|---|
| Số ảnh/bài | Không đặt trần số ảnh; vẫn có giới hạn request/rate/dung lượng |
| `MEDIA_IMAGE_MAX_MB` | 10 MiB/ảnh, cấu hình nguyên 1–20 |
| `MEDIA_VIDEO_MAX_MB` | 50 MiB/video, cấu hình nguyên 1–100 |
| `MEDIA_MAX_VIDEOS` | 3 video/bài, cấu hình nguyên 1–5; tính cả video giữ lại |
| Rate upload | 60 lượt cấp vé upload/tài khoản/giờ; tệp bị chặn trước bước cấp vé chưa vào bộ đếm này |
| Đồng thời API | Tối đa 2 upload đang xử lý mỗi tiến trình API |
| Vé staging | 1 giờ từ lúc bắt đầu tải; riêng tệp chưa gửi/gắn SQL |
| JSON bài đăng | Parser API giới hạn 64 KiB; nhiều tệp/mô tả dài vẫn chịu giới hạn request |

Tên biến dùng MB nhưng phép nhân trong source là `1048576` bytes (MiB).
`MEDIA_MAX_IMAGES` cũ không còn được dùng. Không tự tăng giới hạn AI hoặc upload khi chỉ đổi chữ trên giao diện.

| Loại | Định dạng nhận diện |
|---|---|
| Ảnh | JPG/JPEG/JFIF, PNG, WebP, GIF, BMP, TIFF/TIF, AVIF, HEIC/HEIF |
| Video | MP4, M4V, MOV/QT, WebM, MKV, AVI |

Client đọc tối đa 64 KiB đầu để chọn loại/MIME thực; API kiểm tra bytes lại trước khi gọi provider.
`.jpg` và `.jpeg` cùng là JPEG, tên `1.jpg` không bị cấm. PNG/WebP/AVIF đặt sai đuôi có thể được chuẩn hóa;
tệp hỏng/không nhận diện hoặc codec Cloudinary từ chối vẫn báo lỗi. HTML, SVG, PDF, executable không được
chấp nhận chỉ vì đổi đuôi. ISO-BMFF phải có brand hợp lệ; EBML phải có DocType WebM/Matroska.
Đây là nhận diện container/chữ ký, không thay giải mã toàn bộ của provider.

Giữ URL gốc trong SQL/PDF/bằng chứng. Bản xem JPEG hoặc MP4/H.264/AAC dành cho định dạng khó hiển thị
không ghi đè gốc; GIF xem khung đầu, gallery vẫn cho mở gốc. Chuyển đổi có thể cần thời gian và hạn mức
Cloudinary. Test fixture không chứng minh mọi codec phát được trên mọi thiết bị.

## Luồng upload và gắn bài

1. Người dùng đã đăng nhập/quyền/CSRF gửi body nhị phân đến `/api/media/image` hoặc `/video`.
2. API kiểm tra cấu hình, MIME/size/bytes; Redis cấp UUID/public ID riêng trước upload.
3. Gọi Cloudinary với `overwrite=false`. Video trên 6 MiB được gửi theo từng phần 6 MiB với cùng mã upload
   và `Content-Range`; chỉ dùng phản hồi hoàn tất. Ảnh và video nhỏ gửi một POST.
   Xác minh public ID, resource type và HTTPS delivery URL đúng cloud/kind, không placeholder/private/credentials/port lạ.
4. Khi ready, trả `{upload_id,url,kind,expires_at}`. Frontend giữ vé và tên tệp, không giữ khóa provider.
5. Gửi bài bằng vé, service claim nguyên tử theo owner/trạng thái/tuổi; SQL ghi hồ sơ/media/lịch sử cùng transaction.
6. COMMIT rồi bind/dọn vé. Rollback chắc chắn mới release; commit chưa rõ giữ claim để đối soát.

Upload/destroy không chạy trong transaction SQL. Mất ACK Redis sau COMMIT không biến bài đã tạo thành thất bại giả.
`DELETE /api/media/:id` chỉ bỏ vé ready của chủ, không là chức năng xóa media đã gắn bài.
Cleanup kiểm tra tham chiếu SQL (kể cả media inactive/bằng chứng) trước destroy; claim chưa rõ COMMIT được giữ lại.
Không có distributed transaction SQL–Cloudinary và không cam kết upload đúng một lần qua crash/mất Redis/người dùng chọn lại.

## Thời gian chờ và phục hồi phản hồi

| Biến | Mặc định | Khoảng |
|---|---:|---:|
| `MEDIA_IMAGE_UPLOAD_TIMEOUT_MS` | 120000 | 1000–300000 ms |
| `MEDIA_VIDEO_UPLOAD_TIMEOUT_MS` | 300000 | 1000–300000 ms cho toàn bộ lượt gửi video |
| `MEDIA_RECOVERY_TIMEOUT_MS` | 15000 | 1000–30000 ms/lượt tra |

Đọc JSON provider tối đa 1 MiB, có deadline cả headers/body. Nếu timeout/mất mạng/HTTP 408/5xx hoặc
phản hồi upload chưa dùng được, tra metadata đúng public ID đã cấp tối đa 3 lần. Ảnh nghỉ 1 giây giữa lượt;
video nghỉ lần lượt 2 và 8 giây để Cloudinary có thời gian cập nhật metadata sau khi nhận phần cuối.
không POST lại bytes/đổi UUID/đoán delivery URL. `existing=true` cũng cần đối soát. Lỗi upload 4xx/quyền/quota
không tự đối soát; lookup bị từ chối/hết quota thì dừng. Destroy không dùng cơ chế này.

Web lấy ngân sách từ `/api/media/config`: mặc định 477 giây cho ảnh, 665 giây cho video, gồm nhận body,
provider, recovery và dự phòng. Đây là trần chờ, không là thời gian tải dự đoán; proxy/provider có thể ngắt sớm.
Lookup cần quyền Cloudinary Admin API và chịu quota. Chưa xác minh được thì không trả vé thành công giả.

| Mã | Cần kiểm tra |
|---|---|
| `MEDIA_NOT_CONFIGURED` | Ba biến Cloudinary và restart API |
| `MEDIA_PROVIDER_TIMEOUT`, `MEDIA_PROVIDER_NETWORK` | Deadline/kết nối DNS/TLS/proxy; kết quả có thể chưa rõ |
| `MEDIA_PROVIDER_AUTH`, `MEDIA_PROVIDER_LIMIT` | Quyền/key/cloud name hoặc quota/size/rate |
| `MEDIA_PROVIDER_REJECTED` | Nội dung/codec hoặc cấu hình upload bị từ chối |
| `MEDIA_PROVIDER_ERROR`, `INVALID_MEDIA_RESPONSE` | Lỗi provider hoặc metadata không khớp/chưa sẵn sàng |

Log chỉ giữ thông tin chẩn đoán an toàn, không có Authorization/key/body thô. Lỗi upload ghi
`part/parts`, dung lượng, thời gian và giai đoạn: `awaiting_headers` là chưa có phản hồi HTTP (có thể còn đang gửi);
`response_body` là đã có header nhưng chưa đọc xong nội dung. `deadline_reached` cho biết deadline cục bộ đã hết.
Nếu đối soát trả `404`, Cloudinary chưa tìm thấy asset theo đúng public ID tại lúc kiểm tra; không kết luận video hỏng.
Web nêu tên tệp lỗi; lỗi một tệp không bỏ các tệp tốt trong batch, đổi phiên đăng nhập dừng các tệp chưa gửi.
Không tự tải lặp liên tục khi kết quả còn chưa rõ. Nếu SQL bị xóa thủ công thì không có trigger tự destroy Cloudinary.

## Bổ sung media và nháp

Bài bị từ chối cho sửa đầy đủ hồ sơ, gỡ media cũ bằng × và hoàn tác bằng **Giữ lại**.
Đây mới là thay đổi nháp; chỉ gửi thành công mới cập nhật SQL. Gỡ media cũ đặt dang_su_dung=0,
không xóa hàng/file lịch sử. Backend chỉ nhận ID/kind của đúng media active thuộc bài;
giới hạn video tính sau khi gỡ và cộng vé mới. Snapshot quyết định trước được giữ để xuất PDF.

Nháp lưu trên trình duyệt, tách tài khoản/chế độ tạo–bổ sung–đăng lại/bài nguồn. Giữ trường sách, tiền chuỗi,
ISBN, thể loại, bước đang nhập, vé media và dự kiến gỡ. Không lưu password/cookie/CSRF; không có bảng nháp SQL,
không đồng bộ sang thiết bị khác. Tách khóa theo tài khoản không biến localStorage thành kho mã hóa riêng tư.

- Đóng biểu mẫu hoặc đổi route SPA giữ nháp và tác vụ upload, không discard khi component unmount.
- Reload/đóng trình duyệt có thể ngắt upload; chỉ phục hồi nội dung và vé đã xác nhận, báo lượt chưa rõ,
  không tự gửi POST lại. Xóa dữ liệu web/ẩn danh/bộ nhớ bị chặn có thể mất nháp; web báo lỗi ghi khi phát hiện.
- Vé chưa gửi hết hạn sau một giờ. Khi khôi phục/kiểm tra trước gửi, bỏ vé hết hạn có thông báo, cần chọn lại tệp.
- Giữ UUID yêu cầu qua retry; xóa nháp sau API xác nhận gửi thành công hoặc xác nhận **Bỏ bản nháp**.
  Kết quả upload tới muộn sau bỏ nháp được discard nếu còn quyền; fallback cleanup bảo vệ SQL.
- Source row_version đã đổi thì không áp dụng nháp bổ sung cũ. Checkbox xác nhận một bản sách phải đánh dấu lại.

## Phân biệt upload với AI

Upload 50 MiB/video không có nghĩa ảnh/video được nhét chung trong payload AI 50 MiB.
Ảnh AI inline tối đa tổng 12 MiB; video AI dùng Gemini Files API riêng, mặc định tối đa 100 MiB/tệp ở bước chuẩn bị,
không cắt ở phút thứ 5. Mã M4 là tệp thứ tư, không là phút thứ tư; xem manifest/lý do thay vì suy theo tên tệp.
Các giới hạn này và cleanup Google được mô tả tại [ai-analysis.md](ai-analysis.md).

Nguồn provider: [Upload](https://cloudinary.com/documentation/upload_images),
[Admin API](https://cloudinary.com/documentation/admin_api),
[ảnh](https://cloudinary.com/documentation/image_format_support),
[video](https://cloudinary.com/documentation/video_transcoding).
Kiểm chứng thực tế/fixture và smoke:m4: [VALIDATION.md](../VALIDATION.md).
