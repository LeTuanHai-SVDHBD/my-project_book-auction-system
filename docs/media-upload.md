# Tải ảnh/video và phục hồi phản hồi Cloudinary

Cloudinary có tệp chưa có nghĩa API đã trả vé `upload_id` cho web. Tệp chỉ đưa vào bài khi
API xác minh URL/public ID/loại media và Redis ghi vé ready. Không tạo URL giả hoặc cho nhập URL
Cloudinary tùy ý để bỏ qua quyền của vé.

## Cập nhật trên Windows

Dừng dev:all, giữ Docker chạy, rồi chạy tại thư mục gốc:

```powershell
git switch feat/Hai
git pull --ff-only origin feat/Hai
npm.cmd run setup:media
npm.cmd run dev:all
```

Ctrl+F5 trước khi thử một video. Bản sửa tải video không thêm dependency/schema hoặc sửa `.env` đã có;
setup:media chỉ bổ sung khóa còn thiếu. Nếu đã có cấu hình thời gian riêng, giá trị đó tiếp tục được giữ.
Không cần xóa database, volume hoặc file Cloudinary để áp dụng bản sửa tải lên.

## Thời gian chờ

| Biến Backend | Mặc định | Giới hạn cấu hình |
|---|---:|---:|
| `MEDIA_IMAGE_UPLOAD_TIMEOUT_MS` | 120000 | 1000–300000 ms |
| `MEDIA_VIDEO_UPLOAD_TIMEOUT_MS` | 300000 | 1000–300000 ms |
| `MEDIA_RECOVERY_TIMEOUT_MS` | 15000 | 1000–30000 ms/lượt tra |

Ảnh/video có thời gian provider riêng. Cửa sổ này tính cả nhận headers và đọc body JSON.
Đọc tối đa 1 MiB JSON; hủy stream treo/quá lớn thay vì đọc không giới hạn.
Giữ nguyên giới hạn số/dung lượng tệp, kiểm tra MIME/magic bytes và hai upload đồng thời của API.

`GET /api/media/config` bổ sung `uploadTimeoutMs: {image,video}` cho client, không chứa khóa riêng.
Client chờ đủ thời gian nhận body (tối đa 300 giây theo request timeout mặc định Node), gọi provider,
đối soát tối đa ba lần, hai khoảng nghỉ một giây và 10 giây dự phòng. Mặc định tổng ngân sách
477 giây cho ảnh / 657 giây cho video; đó là giới hạn, không phải thời gian tải dự đoán.
Proxy/mạng/giới hạn Cloudinary vẫn có thể ngắt sớm hơn. Không tự retry POST ở client.

## Đối soát khi không nhận được phản hồi tải lên

1. Redis cấp public ID UUID riêng trước upload; chỉ gửi một POST với `overwrite=false`.
2. Nếu timeout, mất mạng, HTTP 408/5xx hoặc phản hồi upload hỏng, API tra metadata đúng public ID đó.
   Phản hồi `existing=true` cũng cần metadata đầy đủ trước khi trả vé.
3. Dùng GET Admin API theo resource_type và public ID, tối đa ba lần, nghỉ một giây giữa các lượt.
   Không upload lại bytes, không đổi public ID và không tìm theo tên tệp hoặc thư viện của người khác.
4. Chỉ nhận HTTPS `res.cloudinary.com/<cloud>/<kind>/upload/...`, public ID và resource_type khớp,
   không có user/password/port khác hoặc placeholder/private asset. Sau đó ghi Redis ready như upload thường.
5. Chưa xác nhận được thì trả lỗi, không tạo vé/preview thành công giả. Upload 4xx/auth/quota không tự đối soát;
   lookup bị từ chối/hết quota thì dừng. Destroy không dùng cơ chế upload recovery.

Tra metadata cần quyền đọc Admin API và chịu hạn mức của Cloudinary. Nếu lookup bị 403/420/429,
log mới có `cloudinaryRecovery.http_status`; không tự thay quyền/key hoặc cam kết phục hồi mọi lần.
Tài liệu gốc: [Upload và chống trùng](https://cloudinary.com/documentation/upload_images#avoiding_duplicate_uploads),
[Admin resource by public ID](https://cloudinary.com/documentation/admin_api#get_details_of_a_single_resource_by_public_id).

## Chẩn đoán an toàn

Lỗi media được trả bằng mã và thông báo tĩnh, không bị đổi thành lỗi Docker:

| Mã | Cần kiểm tra |
|---|---|
| `MEDIA_NOT_CONFIGURED` | Ba biến Cloudinary và khởi động lại API |
| `MEDIA_PROVIDER_TIMEOUT` | Thời gian provider đã hết, kết quả chưa xác nhận được |
| `MEDIA_PROVIDER_NETWORK` | DNS/TLS/proxy/kết nối từ máy chạy API tới Cloudinary |
| `MEDIA_PROVIDER_AUTH` | Key/project/cloud name và quyền API |
| `MEDIA_PROVIDER_LIMIT` | Giới hạn dung lượng, quota/rate của tài khoản và tệp |
| `MEDIA_PROVIDER_REJECTED` | Tệp/codec/định dạng hoặc cấu hình upload bị Cloudinary từ chối |
| `MEDIA_PROVIDER_ERROR` | Lỗi tạm thời/phản hồi Cloudinary không dùng được |
| `INVALID_MEDIA_RESPONSE` | Metadata/URL/loại tệp không khớp hoặc chưa dùng được |

Log chỉ thêm operation, HTTP status và mã transport thuộc allowlist; không log body/error message thô,
Authorization, khóa hoặc đường dẫn tệp người dùng. Các lỗi SQL/Redis khác tiếp tục dùng lỗi nội bộ chung.
Web ghi tên tệp thất bại, giữ các vé đã tải thành công trước đó, mở lại thao tác chọn tệp khi lỗi và hiện
rằng video có thể mất vài phút. Đừng tải lại liên tục khi kết quả còn chưa rõ.

Vé uploading/ready chưa gắn SQL tiếp tục được cleanup sau hạn staging một giờ, có kiểm tra tham chiếu SQL.
Bản sửa không tự gắn video của lần lỗi cũ vào bài và không liệt kê/ghép file trong Media Library theo tên.
Mất phản hồi API sau khi ghi ready, mất Redis hoặc API chết vẫn có thể để lại tệp tạm;
không cam kết upload đúng một lần qua mọi lần người dùng chọn lại tệp. Cloudinary có thể nhận được nhiều UUID
nếu người dùng chủ động tải lại nhiều lần. Không tự động xóa file Cloudinary thủ công để xử lý lỗi.

Kiểm tra sau cập nhật: tải một MP4 nằm trong dung lượng cho phép, chờ có preview/vé, gửi bài rồi mở lại
để xác nhận video đã gắn SQL. Unit/browser fixture không thay nghiệm thu codec và phát video thật.
