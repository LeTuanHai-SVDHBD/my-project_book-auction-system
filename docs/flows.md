<!-- Mục đích: Mô tả luồng nghiệp vụ và điều kiện cần bảo đảm khi triển khai. -->

# Luồng hoạt động hệ thống

## 1. Phạm vi

Hạ tầng, tài khoản, đăng sách, kiểm duyệt và kích hoạt phiên đã có trong mã nguồn.
Đặt giá/kết thúc, realtime nghiệp vụ, AI và chức năng sau phiên vẫn theo các mốc tiếp theo.

Tài khoản dùng session Redis, cookie HttpOnly và Argon2id theo ADR-010.
Chi tiết luồng HTTP hiện tại được ghi ở mục 10.

## 2. Đăng ký

| Bước | Xử lý |
|---|---|
| 1 | Người dùng nhập thông tin đăng ký |
| 2 | Backend kiểm tra dữ liệu bắt buộc và định dạng |
| 3 | Kiểm tra CSRF và giới hạn thử bằng Redis |
| 4 | Băm mật khẩu bằng thư viện chuyên dụng có salt |
| 5 | Lưu tài khoản vào `NguoiDung` |
| 6 | Trả kết quả đăng ký, không trả trường mật khẩu |

Điều kiện:
- UNIQUE email tại database là lớp bảo vệ cuối khi đăng ký đồng thời.
- Người dùng không được tự cấp quyền Admin qua dữ liệu đăng ký.
- Không ghi mật khẩu nguyên văn vào database hoặc log.

## 3. Đăng nhập và truy cập chức năng

| Bước | Xử lý |
|---|---|
| 1 | Người dùng gửi thông tin đăng nhập |
| 2 | Backend kiểm tra dữ liệu, CSRF, giới hạn thử và tài khoản trong SQL |
| 3 | So khớp mật khẩu với chuỗi băm |
| 4 | Đổi session ID, tạo phiên Redis và token CSRF mới |
| 5 | Các yêu cầu tiếp theo được kiểm tra xác thực và quyền |
| 6 | Khi đăng xuất hoặc hết hạn, xử lý theo chính sách phiên |

Điều kiện:
- Không trả mật khẩu hoặc chuỗi băm cho Frontend.
- Không tin vai trò hoặc mã người dùng do client tự khai báo.
- Kiểm tra quyền sở hữu tài nguyên tại Backend.
- Token chẩn đoán Mốc 2 không phải tài khoản đăng nhập.

## 4. Đăng sách và kích hoạt phiên

| Bước | Xử lý |
|---|---|
| 1 | Người bán nhập thông tin sách, media và thông số giá |
| 2 | Backend kiểm tra và lưu sách, bài đăng, phiên chờ kiểm duyệt |
| 3 | Mốc 4: chưa gọi AI, hiển thị chưa có phân tích; Mốc 7 mới tích hợp |
| 4 | Admin xem thông tin, bằng chứng và yếu tố quý hiếm |
| 5 | Admin phê duyệt hoặc từ chối kèm lý do |
| 6 | Sau khi được duyệt, người bán thiết lập lịch và kích hoạt |

Điều kiện:
- Mỗi bài đăng chào bán một cuốn sách vật lý.
- AI hỗ trợ, không tự quyết định phê duyệt.
- Lỗi AI không tự động làm bài đăng bị từ chối.
- Giá, bước giá, lịch và thời gian chờ được cố định sau kích hoạt.

## 5. Đặt giá trong phiên

### 5.1. Tiếp nhận

1. Người dùng gửi mã phiên, mức giá và mã yêu cầu.
2. API kiểm tra xác thực, quyền và cấu trúc đầu vào.
3. API đưa yêu cầu vào Redis Streams.
4. Trả HTTP 202: yêu cầu đã tiếp nhận, chưa xác nhận đặt giá thành công.

### 5.2. Xử lý tại worker

| Bước | Xử lý |
|---|---|
| 1 | Nhận sự kiện và lấy quyền xử lý theo mã phiên |
| 2 | Mở giao dịch SQL, khóa dòng phiên theo thiết kế |
| 3 | Kiểm tra mã yêu cầu đã được ghi nhận hay chưa |
| 4 | Đọc lại quyền, trạng thái, lịch, giá và cooldown |
| 5 | Nếu hợp lệ, thêm `LuotDatGia`, cập nhật giá và lịch sử |
| 6 | UPDATE đối chiếu `row_version`; phải cập nhật đúng một dòng |
| 7 | Nếu đạt ngưỡng kết thúc sớm, chốt phiên, kết quả và giao dịch |
| 8 | COMMIT; sau đó ghi nhận kết quả xử lý và thông báo |
| 9 | Xác nhận sự kiện; giải phóng khóa trong khối xử lý kết thúc |

Nếu mã yêu cầu đã thành công, trả lại kết quả đã lưu.
Không kiểm tra nó như một lượt đặt mới.

### 5.3. Quy tắc hợp lệ

| Điều kiện | Quy tắc |
|---|---|
| Trạng thái | Phiên phải là `da_kich_hoat` |
| Thời gian | Đã đến giờ bắt đầu và chưa đến giờ kết thúc |
| Mốc kiểm tra | Giờ máy chủ khi worker có quyền xử lý và kiểm tra để ghi nhận |
| Lượt đầu | `gia_khoi_diem + k × buoc_gia`, `k >= 0` |
| Lượt tiếp theo | `gia_hien_tai + k × buoc_gia`, `k >= 1` |
| Chờ đặt lại | Theo cùng người trong cùng phiên; mặc định 20 giây, cho phép 10–30 giây |
| Người bán | Không được đặt giá vào phiên của chính mình |
| Xử lý lại | Không tạo thêm lượt giá từ cùng mã yêu cầu |

Yêu cầu vào hàng đợi trước hạn vẫn bị từ chối nếu khi kiểm tra đã hết hạn.

### 5.4. Phân loại kết quả

| Kết quả | Cách xử lý |
|---|---|
| Hợp lệ | Lưu thay đổi, COMMIT rồi thông báo |
| Sai nghiệp vụ | Lưu/trả lý do từ chối theo thiết kế; kết thúc xử lý yêu cầu |
| Lỗi kỹ thuật | ROLLBACK phần chưa hoàn tất; cho phép xử lý lại an toàn |

Redis Streams có thể giao lại thông điệp.
Không giả định mỗi sự kiện chỉ được xử lý đúng một lần.

## 6. Kết thúc phiên

Chỉ có hai nguyên nhân:
- Hết thời gian.
- Lượt đặt hợp lệ đạt hoặc vượt `gia_toi_thieu`.

Tác vụ hết hạn và worker đặt giá phải dùng cùng cơ chế bảo vệ phiên.

| Trường hợp | Kết quả |
|---|---|
| Hết hạn và có lượt hợp lệ | Người có giá hợp lệ cao nhất thắng |
| Hết hạn và không có lượt hợp lệ | Không có người thắng, không tạo giao dịch |
| Đạt/vượt `gia_toi_thieu` | Lượt hợp lệ đó thắng và phiên kết thúc ngay |

Trong cùng giao dịch SQL:
1. Chuyển phiên sang `da_ket_thuc`.
2. Tạo duy nhất một `KetQuaDauGia`.
3. Tạo `GiaoDich` nếu có người thắng.

Lưu ý:
- `gia_toi_thieu` là ngưỡng kết thúc sớm, được giữ ẩn với người mua.
- Khi hết hạn, không bắt buộc đạt ngưỡng này mới có người thắng.
- Không có thao tác hủy giữa phiên hoặc kết thúc thủ công.

## 7. Giao dịch và trò chuyện sau phiên

| Bước | Xử lý |
|---|---|
| 1 | Tạo giao dịch từ kết quả có người thắng |
| 2 | Xác định người mua, người bán và số tiền theo kết quả |
| 3 | Mở cuộc trò chuyện gắn với giao dịch |
| 4 | Hai bên trao đổi và thực hiện xác nhận theo quyền |
| 5 | Chỉ chuyển `hoan_tat` khi đủ xác nhận của hai bên |
| 6 | Người mua được đánh giá người bán sau khi hoàn tất |

Trạng thái giao dịch hiện có: `cho_xac_nhan`, `hoan_tat`.

Không tự bổ sung cổng thanh toán, hoàn tiền tự động hoặc trạng thái khác
nếu chưa cập nhật thiết kế và được nhóm thống nhất.

## 8. Khiếu nại

| Bước | Xử lý |
|---|---|
| 1 | Người tham gia giao dịch gửi nội dung và bằng chứng |
| 2 | Backend kiểm tra quyền và quan hệ giao dịch–cuộc trò chuyện |
| 3 | Lưu `KhieuNai`, `BangChungKhieuNai`; trạng thái `cho_xu_ly` |
| 4 | Admin tiếp nhận; gán người xử lý và chuyển `dang_xu_ly` |
| 5 | Admin xem bằng chứng và trao đổi liên quan theo quyền |
| 6 | Ghi phản hồi, thời điểm xử lý; chuyển `da_xu_ly` |
| 7 | Người gửi xem tiến độ và kết quả |

Điều kiện:
- Không cho gửi khiếu nại đối với giao dịch không thuộc quyền.
- Cuộc trò chuyện phải thuộc đúng giao dịch khiếu nại.
- Quyền Admin xem trao đổi gắn với khiếu nại liên quan.
- Không tự động thay đổi người thắng hoặc trạng thái giao dịch
  chỉ vì có khiếu nại.

## 9. Luồng kiểm tra Mốc 2 đã có

`React → API → Redis Streams → Worker → SELECT kiểm tra SQL → Redis → React`

- API trả trạng thái `queued`.
- Worker chỉ truy vấn kiểm tra, không ghi dữ liệu đấu giá.
- Worker lưu `completed`; giao diện lấy kết quả qua API.
- Socket.IO trong Mốc 2 mới kiểm tra kết nối bằng `system:hello`.

## 10. Luồng tài khoản — đã triển khai trong bản cập nhật Mốc 3

1. React gọi `GET /api/auth/csrf` với `credentials: include`.
2. API tạo session ẩn danh trong Redis và trả token CSRF; cookie mang mã session.
3. React đăng ký với họ tên, email, mật khẩu và header CSRF.
4. Backend kiểm tra dữ liệu và giới hạn thử, băm Argon2id, INSERT tham số hóa vào NguoiDung.
5. UNIQUE email bảo vệ đăng ký trùng; API công khai chỉ ghi vai trò `nguoi_dung`.
6. Khi đăng nhập, backend đọc SQL và so hash, rồi đổi session ID và token CSRF.
7. Trước khi trả thành công, session mới được lưu vào Redis.
8. API `/me` và `/admin-check` đọc lại SQL để xác minh tài khoản và vai trò hiện tại.
9. Đăng xuất hủy session trong Redis và xóa cookie; phát lại cookie cũ nhận 401.

Luồng này không qua worker. HTTP 201 là đã tạo tài khoản; HTTP 200 đăng nhập chỉ trả
sau khi session được lưu. Lỗi sau INSERT nhưng trước phản hồi có thể khiến client cần
đăng nhập hoặc kiểm tra email thay vì gửi lại đăng ký nhiều lần.



## 11. Chi tiết giao dịch Mốc 4 đã triển khai

1. API xác thực chủ sách/CSRF, kiểm tra MIME/magic/kích thước, tạo vé Redis rồi upload Cloudinary.
2. Client gửi nội dung và vé UUID; service claim toàn bộ vé nguyên tử, không tin URL/public_id từ client.
3. Model mở transaction SQL, kiểm tra mã yêu cầu đã có; tạo sách, bài, phiên pending, media và lịch sử rồi COMMIT.
4. Sau COMMIT, xóa ledger của vé đã gắn; acknowledgement lỗi được cleanup đối soát bằng reference SQL.
5. Rollback chắc chắn trả vé về ready; kết quả commit không rõ giữ claim để tránh xóa nhầm file.
6. Admin duyệt/từ chối trong transaction có khóa và đối chiếu row_version, ghi KiemDuyet và cập nhật cặp trạng thái.
7. Chủ sách bị từ chối có thể bổ sung/gửi lại; giữ bài/phiên, media và lịch sử duyệt.
8. Chủ sách đã duyệt đặt lịch/kích hoạt đúng phiên, SQL kiểm tra thời điểm UTC và trạng thái mới nhất.
9. Đăng lại sau kết thúc không người thắng: khóa Sach, kiểm tra phiên cuối và kết quả,
   tạo bài/phiên mới cùng Sach; giữ dữ liệu cũ. Thiếu KetQuaDauGia không đủ điều kiện đăng lại.
10. Cleanup tệp hết hạn thực hiện ngoài transaction và chỉ destroy khi SQL xác nhận không được dùng.
    Claim chưa rõ được giữ để đối soát, không tự chuyển thành orphan rồi xóa.

Các thao tác Mốc 4 đi trực tiếp HTTP → SQL, không lẫn vào probe hoặc queue đặt giá dự kiến.
AI lỗi/không có dữ liệu không khóa luồng duyệt thủ công.
