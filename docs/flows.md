<!-- Mục đích: Mô tả luồng đã triển khai, hợp đồng API và quy tắc nghiệp vụ dự kiến. -->

# Luồng nghiệp vụ và API

## Tài khoản

1. React tạo mã chọn tab; gửi `X-Tab-ID` và cookie tương ứng khi gọi API.
2. `GET /api/auth/csrf` tạo session ẩn danh và CSRF token gắn với session Redis.
3. Đăng ký kiểm tra dữ liệu, CSRF và giới hạn thử, băm Argon2id rồi ghi NguoiDung.
4. API công khai chỉ tạo `nguoi_dung`; UNIQUE email bảo vệ yêu cầu đăng ký đồng thời.
5. Đăng nhập kiểm tra SQL/hash, đổi session ID và CSRF; lưu Redis trước khi trả thành công.
6. Yêu cầu bảo vệ đọc lại tài khoản/vai trò từ SQL. Không tin mã người dùng do client khai báo.
7. Đăng xuất hủy session được chọn và xóa đúng cookie của tab; không thu hồi tab khác.

F5 giữ phiên tab; tài liệu mới tạo mã tab mới để không kế thừa tài khoản từ storage sao chép.
Cookie session ký/HttpOnly và CSRF mới là thông tin xác thực, mã tab chỉ chọn phiên.
Client HTTP không gửi `X-Tab-ID` dùng cookie chung độc lập với các cookie tab.

## Đăng sách và media

1. Sau xác thực/quyền/CSRF, API kiểm tra MIME, magic bytes và kích thước của từng tệp.
2. Tạo vé Redis trước khi gọi Cloudinary để theo dõi cả upload bị ngắt.
3. Cloudinary trả URL/public_id; API trả vé UUID và URL xem trước cho đúng chủ sách.
4. React gửi nội dung sách/bài/giá cùng vé; các ô tiền hiển thị dấu chấm nhưng gửi chuỗi nguyên.
5. Service claim tất cả vé nguyên tử, xác nhận owner/trạng thái/tuổi vé; không tin URL do client khai báo.
6. Transaction SQL tạo Sach, BaiDang, PhienDauGia pending, media và lịch sử; chưa có lịch đấu giá.
7. Sau COMMIT, acknowledgement dọn vé. Cùng UUID yêu cầu trả lại bài đã tạo, không tạo trùng.
8. Rollback chắc chắn release vé để retry; kết quả commit chưa rõ giữ claim để đối soát.

Không upload, gọi AI hay destroy Cloudinary trong transaction SQL.
Cleanup chỉ xóa vé bỏ dở/hết hạn sau kiểm tra SQL reference. File lịch sử và file đang dùng được giữ lại.
Hiện không có luồng xóa bài; xóa bản ghi SQL thủ công không kích hoạt xóa Cloudinary.

## Kiểm duyệt, bổ sung và kích hoạt

| Thao tác | Điều kiện | Kết quả nguyên tử |
|---|---|---|
| Duyệt | Admin, bài/phiên pending, version hiện tại, lý do và xác nhận bằng chứng quý hiếm | Bài `da_duyet`, phiên `da_qua_kiem_duyet`, lưu quyết định/lịch sử |
| Từ chối | Admin, cặp pending, version hiện tại và lý do | Bài `tu_choi`, phiên `khong_dat_kiem_duyet`, lưu quyết định/lịch sử |
| Gửi lại | Chủ bài, cặp bị từ chối và version hiện tại | Cập nhật nội dung/giá, thêm media, cặp về pending; giữ ID và lịch sử |
| Kích hoạt | Chủ bài, cặp đã duyệt, version hiện tại, lịch tương lai hợp lệ | Cập nhật cùng phiên thành `da_kich_hoat`; không tạo phiên khác |

Model lấy khóa rồi đối chiếu rowversion. SQL xuất BINARY(8), utility mã hóa hex 16 ký tự cho JSON;
HTTP 409 yêu cầu client đọc lại dữ liệu. Không cấp version mặc định khi thiếu.

Admin ghi căn cứ quý hiếm và nguồn đối chiếu. Tình trạng vật lý tốt không thay điều kiện quý hiếm;
thiếu bằng chứng phải được ghi rõ. Chưa tích hợp AI thì kiểm tra thủ công, không sinh phân tích giả.
Kết quả AI đã có chỉ để tham khảo, không tự phê duyệt/từ chối.

## Đăng lại

1. Xác định sách vật lý và lấy khóa Sach ổn định qua các lần đăng.
2. Đọc bài/phiên mới nhất của sách và kết quả dưới transaction.
3. Chỉ chấp nhận khi phiên đã `da_ket_thuc`, kết quả `khong_co_nguoi_thang`, người thắng NULL.
4. Tạo bài/phiên mới cùng `sach_id`, giá mới và trạng thái pending. Có thể dùng lại media.
5. Giữ nguyên giá, lịch sử, kết quả và các quyết định của lần cũ.

Không suy ra không có người thắng từ việc thiếu KetQuaDauGia. Phiên gần nhất chưa kết thúc
hoặc đã có người thắng không được đăng lại, kể cả giao dịch chưa hoàn tất.

## Hợp đồng HTTP hiện tại

### Tài khoản

| Phương thức | Endpoint | Điều kiện |
|---|---|---|
| GET | `/api/auth/csrf` | Cấp CSRF token gắn với session |
| POST | `/api/auth/register` | CSRF; họ tên, email, mật khẩu |
| POST | `/api/auth/login` | CSRF; email, mật khẩu; đổi session/CSRF |
| POST | `/api/auth/logout` | CSRF; hủy session được chọn |
| GET | `/api/auth/me` | Tài khoản hợp lệ |
| GET | `/api/auth/admin-check` | Admin hợp lệ |

### Bài đăng và media

| Phương thức | Endpoint | Quyền |
|---|---|---|
| GET | `/api/posts/catalog`, `/api/posts/catalog/:id` | Công khai; projection không có giá ẩn hoặc dữ liệu nội bộ |
| GET | `/api/posts/mine` | Người dùng, chỉ bài của mình |
| GET | `/api/posts/pending` | Admin |
| GET | `/api/posts/:id` | Chủ bài hoặc Admin |
| POST | `/api/posts` | Người dùng + CSRF |
| POST | `/api/posts/:id/resubmit` | Chủ bài bị từ chối + CSRF |
| POST | `/api/posts/:id/relist` | Chủ bài đủ điều kiện + CSRF |
| POST | `/api/posts/:id/review` | Admin + CSRF |
| POST | `/api/posts/:id/activate` | Chủ bài đã duyệt + CSRF |
| GET | `/api/media/config` | Cấu hình công khai không chứa credentials |
| POST | `/api/media/image`, `/api/media/video` | Người dùng + CSRF; body nhị phân, MIME tương ứng |
| DELETE | `/api/media/:upload_id` | Chủ vé + CSRF; tệp chưa gắn bài |

Danh sách tối đa 30 bài, phân trang bằng `?before=<id>` theo `nextBefore`.
Giá trong JSON là chuỗi nguyên dương tối đa 18 chữ số, không có dấu phân cách.

- Tạo bài: `ma_yeu_cau` UUID v4, `sach`, `bai_dang`, `phien`, `media: [{upload_id,tieu_de}]`.
- Đăng lại: bỏ `sach`, thêm `reuse_media`; tạo UUID mới cho lần đăng mới.
- Gửi lại: bỏ `sach`/`ma_yeu_cau`, gửi `row_version`; giữ media đã lưu và thêm tệp mới.
- Duyệt: `quyet_dinh: phe_duyet|tu_choi`, `ly_do`, `xac_nhan_quy_hiem`, `row_version`.
- Kích hoạt: lịch ISO có múi giờ và `row_version`; SQL kiểm tra tương lai bằng đồng hồ server.

Thiếu đăng nhập trả 401; thiếu quyền/CSRF sai trả 403; xung đột trả 409; quá giới hạn trả 429.
Header chọn tab phải có 32 ký tự hex viết thường; header này không thay cookie hoặc CSRF.

## Probe hạ tầng

`React → API → Redis Streams → Worker → SQL SELECT → Redis result → React`.
API trả 202 queued; worker chỉ xác nhận completed sau truy vấn kiểm tra thành công.
Kết quả probe được lấy qua HTTP; Socket.IO chỉ gửi lời chào kết nối.
Endpoint development cần `DEV_PROBE_TOKEN`, không dùng khóa này thay tài khoản.

## Đặt giá và kết thúc phiên

API tiếp nhận yêu cầu hợp lệ về cấu trúc, đưa vào Streams và trả 202; đây chưa phải đặt giá thành công.
Các endpoint đã triển khai:

| Phương thức | Endpoint | Điều kiện |
|---|---|---|
| GET | `/api/auctions/:id` | Công khai, chỉ phiên đã công bố; không có ngưỡng giá ẩn |
| GET | `/api/auctions/:id/bid-status` | Đăng nhập; trạng thái chủ sách, thời điểm đặt lại của chính session và giờ SQL |
| POST | `/api/auctions/:id/bids` | Người dùng + CSRF; body chỉ `ma_yeu_cau` UUID v4 và `muc_gia` chuỗi nguyên |
| GET | `/api/auctions/:id/requests/:requestId` | Chỉ chủ yêu cầu; đọc SQL trước admission Redis |

Trạng thái HTTP kết quả gồm `dang_cho_xu_ly`, `da_chap_nhan`, `bi_tu_choi`.
YeuCauDatGia chỉ lưu hai quyết định cuối; hàng chờ ở Redis. Mã đã có quyết định trả 200;
mã cùng người/phiên/giá chưa xử lý trả 202, không xếp lại. Dùng lại mã cho nội dung khác trả 409.

Worker lấy quyền xử lý phiên, mở transaction SQL, kiểm tra mã yêu cầu rồi đọc lại quyền, lịch, trạng thái,
giá và cooldown. Quyết định chấp nhận/từ chối được lưu cùng thay đổi nghiệp vụ trong SQL.
Chỉ thông báo thành công sau COMMIT; sự kiện giao lại đọc quyết định đã lưu, không đánh giá lại hoặc tạo trùng.
XACK/XDEL chỉ sau xử lý thành công; lỗi tạm giữ pending, XAUTOCLAIM nhận lại.
Chi tiết retention, dead-letter và lease nằm tại [Xử lý đấu giá](auction-processing.md).

| Quy tắc | Điều kiện |
|---|---|
| Trạng thái/thời gian | Phiên đã kích hoạt, đến giờ bắt đầu và chưa hết hạn tại thời điểm worker kiểm tra |
| Lượt đầu | `gia_khoi_diem + k × buoc_gia`, `k >= 0` |
| Lượt sau | `gia_hien_tai + k × buoc_gia`, `k >= 1` |
| Cooldown | Cùng người/cùng phiên; mặc định 20 giây, cấu hình 10–30 giây |
| Chủ sách | Không tự đặt giá vào phiên của mình |
| Kết thúc | Chỉ hết hạn hoặc lượt hợp lệ đạt/vượt ngưỡng giá ẩn |

Tác vụ hết hạn và worker đặt giá dùng cùng cơ chế bảo vệ phiên.
Trong một transaction, chuyển phiên kết thúc, tạo một KetQuaDauGia và tạo GiaoDich chỉ nếu có người thắng.
Hết hạn có lượt hợp lệ thì lượt cao nhất thắng dù chưa đạt ngưỡng. Không có kết thúc thủ công hoặc hủy giữa phiên.

## Thiết kế sau phiên — chưa triển khai

Giao dịch đã được tạo từ kết quả có người thắng, xác định người mua/bán và số tiền.
Các chức năng mở trao đổi gắn giao dịch, xác nhận hoàn tất và phản hồi chưa triển khai.
Hoàn tất cần đủ xác nhận hai bên; đánh giá uy tín theo quyền và điều kiện hoàn tất.
Khiếu nại kiểm tra quan hệ người gửi–giao dịch–cuộc trò chuyện, lưu bằng chứng và xử lý theo quyền Admin.
Không tự thay đổi người thắng hoặc trạng thái giao dịch chỉ vì có khiếu nại.
Các chức năng này phải được đối chiếu thiết kế đã thống nhất trước khi triển khai.
