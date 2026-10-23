<!-- Mục đích: Mô tả thành phần, kết nối, ranh giới trách nhiệm và phạm vi triển khai. -->

# Kiến trúc hệ thống

## Tổng quan

Một repository chứa React Frontend và Express Backend, quản lý dependency bằng npm workspaces.
Backend có hai tiến trình dùng chung mã nguồn: HTTP API và worker Redis Streams.
SQL Server giữ trạng thái nghiệp vụ có thẩm quyền; Redis hỗ trợ session, hàng đợi và phối hợp xử lý.

## Thành phần và kết nối

| Thành phần | Trách nhiệm | Kết nối |
|---|---|---|
| React | Tài khoản, bài đăng, kiểm duyệt, đặt lịch và danh mục | HTTP/JSON và upload nhị phân qua API |
| Express API | Xác thực, phân quyền, đầu vào, nghiệp vụ HTTP và Socket.IO | SQL Server, Redis, Cloudinary |
| SQL Server | Tài khoản, sách, bài, phiên, media và lịch sử | Thư viện `mssql`, truy vấn tham số hóa |
| Redis | Session, vé media, giới hạn thử, kết quả probe và heartbeat | Redis client; Lua khi cần thao tác nguyên tử |
| Redis Streams | Phân phối probe; nền tảng cho sự kiện đặt giá dự kiến | Consumer group tại worker |
| Worker | Đọc, nhận lại và xác nhận probe | Kết nối Redis BLOCK riêng, SQL đọc kiểm tra |
| Cloudinary | Lưu và phân phối ảnh/video | HTTPS REST từ Backend; SQL lưu URL/public_id |
| Socket.IO | Kiểm tra kết nối bằng `system:hello` | Cùng HTTP server; chưa có sự kiện nghiệp vụ riêng tư |
| Gemini API | Phân tích sách dự kiến | Chưa tích hợp; Admin hiện kiểm duyệt thủ công |

Frontend không truy cập SQL hoặc Redis trực tiếp. Bí mật Cloudinary chỉ có ở Backend.
API, worker và React chạy riêng; SQL Server và Redis chạy trong Docker theo [README](../README.md).

## Phân lớp Backend

Luồng HTTP: `Route → Middleware → Controller → Service → Model → SQL Server`.

- Route khai báo endpoint và middleware xác thực/CSRF/phân quyền.
- Controller chuyển đầu vào/đầu ra HTTP, áp dụng projection công khai.
- Service điều phối claim media, nghiệp vụ và kết quả commit/rollback.
- Model thực hiện truy vấn tham số hóa, lấy khóa và giao dịch SQL.
- Policy/utility chứa quy tắc trạng thái, chuẩn hóa phiên bản và các hàm dùng chung.

Luồng probe: `Redis Streams → Consumer → Processor → SQL SELECT → Redis result`.
Probe không ghi lượt giá, kết quả đấu giá hoặc giao dịch.

## Xác thực theo tab

Backend dùng một `express-session` middleware và RedisStore chung cho tiến trình.
Frontend gửi mã tab ngẫu nhiên qua `X-Tab-ID`; Backend chỉ chọn cookie HttpOnly tương ứng,
không lấy session từ cookie của tab khác hoặc cookie chung.
Mã tab nằm trong sessionStorage và không chứa thông tin xác thực. Cookie chứa mã session được ký,
CSRF token giữ trong bộ nhớ, vai trò và tài khoản luôn đọc lại từ SQL.

F5 giữ mã tab; một tài liệu mới xoay mã kể cả khi trình duyệt sao chép storage từ tab mở nó.
Vì vậy tab mới cần đăng nhập, đăng xuất chỉ thu hồi phiên được chọn.
Client terminal không gửi mã tab tiếp tục dùng hợp đồng cookie chung cho smoke và tích hợp HTTP.
Đây là cách phân tách thao tác theo tab, không phải ranh giới an toàn giữa các trang cùng origin.

## Nhất quán dữ liệu

- SQL Server là nguồn trạng thái quyết định quyền kích hoạt, lịch, giá và kết quả.
- Tạo sách/bài/phiên/media/lịch sử trong cùng transaction SERIALIZABLE.
- Duyệt và gửi lại cập nhật cặp trạng thái bài/phiên nguyên tử.
- Kiểm tra `row_version` sau khi lấy khóa; chuẩn hóa BINARY(8) thành hex 16 ký tự ở model.
- UUID yêu cầu và UNIQUE bảo vệ retry; chỉ trả thành công sau COMMIT.
- Giá DECIMAL(18,0) đi qua JSON dạng chuỗi, không chuyển thành JavaScript Number.
- Giờ lưu UTC, SQL kiểm tra lịch kích hoạt theo `SYSUTCDATETIME()`.

Tệp được upload ngoài transaction SQL. Vé Redis claim nguyên tử xác nhận chủ sở hữu trước khi gắn media.
Sau COMMIT, acknowledgement Redis lỗi không làm kết quả SQL biến thành rollback giả.
Cleanup chỉ destroy file bỏ dở sau khi SQL xác nhận không còn tham chiếu;
claim chưa rõ commit được giữ để đối soát thủ công. Không có distributed transaction SQL–Cloudinary.

## Cập nhật thời gian thực và phục hồi

Socket.IO mới cung cấp lời chào hạ tầng; giao diện đọc trạng thái bài/phiên qua HTTP.
Khi triển khai đặt giá, worker và tác vụ hết hạn phải dùng cùng cơ chế bảo vệ phiên;
chỉ phát thông báo sau COMMIT và kiểm tra quyền trước khi vào room riêng tư.
Kênh worker → API cùng cơ chế phát lại sau sự cố chưa được triển khai; xem ADR-009.

## Phạm vi phát triển tiếp theo

Lõi đặt giá/kết thúc, realtime nghiệp vụ, AI, giao dịch, trò chuyện, bình luận, đánh giá và khiếu nại
được theo dõi theo chức năng trong [tasks.md](tasks.md). Thiết kế tương lai được phân biệt với mã đã có tại [flows.md](flows.md).
