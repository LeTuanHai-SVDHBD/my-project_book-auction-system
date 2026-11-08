<!-- Mục đích: Kiến trúc thực tế, ranh giới dữ liệu và trách nhiệm của từng tiến trình. -->

# Kiến trúc hệ thống

## Thành phần

Một repository dùng npm workspaces, Node.js 24.x và JavaScript ES Modules. API, worker và web là ba
­tiến trình phát triển; không phải ba microservice độc lập. Compose chạy SQL Server 2022 Developer/Redis 8.

| Thành phần | Trách nhiệm và kết nối |
|---|---|
| React/Vite | BookBid, biểu mẫu/nháp cục bộ, HTTP có cookie, Socket.IO công khai và namespace tài khoản |
| Express API | Session/CSRF/quyền, validate HTTP, upload Cloudinary, admission đặt giá và đọc kết quả AI |
| SQL Server | Tài khoản, sách/hồ sơ bài, phiên/receipt giá, kết quả/giao dịch, kiểm duyệt/AI, tương tác và thông báo |
| Redis | Session, quyền phiên, rate limit, vé media, Streams, lease, Pub/Sub, probe và heartbeat |
| Worker | Ba consumer probe/đấu giá/AI với kết nối BLOCK riêng; job chốt hạn độc lập |
| Cloudinary | Lưu ảnh/video gốc; Backend xác minh URL/public ID, SQL giữ tham chiếu |
| Gemini | Quan sát theo JSON Schema; ảnh inline, video qua Files API; không quyết định duyệt |

Frontend không đọc SQL/Redis hoặc nắm credentials provider. API có Redis subscriber để chuyển tín hiệu
sau COMMIT tới các socket đang nối với chính API đó. Chưa có outbox hoặc Redis Socket.IO Adapter.

## Phân lớp và luồng sự kiện

HTTP: `Route → Middleware → Controller → Service → Model → SQL`.
Routes khai báo quyền; controller chuẩn hóa đầu vào/projection; service điều phối; model truy vấn tham số hóa,
transaction và khóa. Các policy/utility tách quy tắc giá, quyền, tiền, rowversion và trạng thái.

| Luồng | Trình tự | Trạng thái bền vững |
|---|---|---|
| Probe | HTTP development → stream probe → worker → SQL SELECT → Redis result | Không ghi nghiệp vụ |
| Đặt giá | HTTP → admission/stream → consumer → lease phiên → transaction SQL → publish → ACK | YeuCauDatGia và các thay đổi hợp lệ trong SQL |
| Hết hạn | Job đọc giờ SQL → stream đấu giá → cùng processor/khóa phiên | Kết quả, giao dịch/chat nếu có người thắng |
| AI | API xếp hàng sau khi lưu, worker quét hồ sơ chờ để phục hồi → stream AI → worker chuẩn bị media/Gemini → kiểm tra/tính điểm → SQL | PhanTichAI, ChiTietPhanTichAI; KiemDuyet khi tự duyệt |
| Hộp tin | GET hộp → đồng bộ nguồn đã COMMIT dưới khóa SQL → đọc ThongBao | Nội dung ngắn, nguồn UNIQUE và thời điểm đọc |

HTTP 202 là tiếp nhận, chưa phải nghiệp vụ thành công. SQL receipt và UNIQUE bảo vệ replay;
không khẳng định transport xử lý/giao nhận đúng một lần.

## Mô hình dữ liệu

[Manifest](../backend/schema-manifest.json) sau migration 009: **21 bảng/172 cột, 102 CHECK, 15 UNIQUE constraints**.

| Nhóm | Bảng chính |
|---|---|
| Tài khoản và bản sách | NguoiDung, Sach, BaiDang, HinhAnh, Video |
| Kiểm duyệt và AI | KiemDuyet, PhanTichAI, ChiTietPhanTichAI |
| Đấu giá | PhienDauGia, YeuCauDatGia, LuotDatGia, LichSuDauGia, KetQuaDauGia |
| Sau phiên | GiaoDich, CuocTroChuyen, TinNhan, DanhGia, BinhLuan |
| Khiếu nại/hộp tin | KhieuNai, BangChungKhieuNai, ThongBao |

Sach là bản vật lý/khóa ổn định để đăng lại. BaiDang.ho_so_sach giữ hồ sơ của lần đăng;
chi tiết/tìm kiếm/giao dịch/AI dùng cùng phép gộp hồ sơ, fallback về Sach cho dữ liệu cũ.
Gửi duyệt lại không ghi đè Sach/lịch sử phiên khác. HinhAnh/Video.dang_su_dung phân biệt tệp active
với tệp đã gỡ khỏi hồ sơ mới, không DELETE hàng/file lịch sử.
KiemDuyet.ket_qua_snapshot giữ sách/media/AI của đúng quyết định; migration 008 thêm `phan_tich_id` cho quyết định tự duyệt.

FK bảo vệ tham chiếu, UNIQUE bảo vệ tối đa một kết quả/phiên, một giao dịch/kết quả, một phòng/giao dịch
và một đánh giá/giao dịch. Chúng không tự tạo bản ghi bắt buộc; transaction nghiệp vụ thực hiện việc đó.
Schema nền 001 được giữ; nâng cấp chạy 002–008, không reset database.

## Xác thực và quyền

Cookie HttpOnly riêng được chọn theo X-Tab-ID; selector nằm trong sessionStorage, không thay cookie/CSRF.
Một tài khoản chỉ có một phiên đăng nhập hiện hành: login đúng mật khẩu đổi session/CSRF, Lua đổi owner,
xóa session cũ và phát tín hiệu. F5/GET/control/Socket không claim phiên; tab cũ về đăng nhập.
Khác tài khoản vẫn độc lập. Vai trò/tài khoản được đọc lại từ SQL; owner/session kiểm tra Redis.
Cookie SameSite=Lax, Secure khi production; CSRF giữ ở bộ nhớ frontend.

Namespace `/account` có xác thực và heartbeat để ngắt phiên bị thu hồi. `/auctions` chỉ công khai;
không chứa cookie dùng làm quyền đấu giá, chat hoặc gia_toi_thieu. Quyền ghi nghiệp vụ luôn kiểm tra HTTP/worker/SQL.
Chi tiết tại [account-control.md](account-control.md).

## Nhất quán và phục hồi

- SQL dùng transaction SERIALIZABLE và UPDLOCK/HOLDLOCK tại các thao tác cần tuần tự hóa.
- Redis lease/token phối hợp; rowversion và UNIQUE tiếp tục bảo vệ khi lease mất/COMMIT kéo dài.
- Rowversion được mã hóa từ BINARY(8) thành hex 16 ký tự, không chuyển qua Number.
- Tiền DECIMAL(18,0) đi qua JSON dạng chuỗi; giờ nghiệp vụ lưu UTC và kiểm tra bằng giờ SQL.
- Tệp được upload trước, ngoài transaction SQL; vé Redis claim nguyên tử xác nhận chủ sở hữu.
  ACK Redis lỗi sau COMMIT không biến kết quả SQL thành rollback giả; claim chưa rõ giữ để đối soát.
- Cleanup media phải kiểm tra tham chiếu SQL, kể cả hàng lịch sử/bằng chứng, trước khi destroy Cloudinary.
- Giá/trạng thái phát tín hiệu sau COMMIT. Snapshot SQL sau join/reconnect và mỗi 5 giây bù sự kiện lỡ;
  Socket/Pub/Sub không là nhật ký bền vững. Quyết định đặt giá của riêng người dùng đọc qua HTTP riêng.
- Chat/bình luận/khiếu nại dùng HTTP/polling, không phát nội dung riêng vào room công khai.

## AI, video và nháp

API xếp hàng sau khi lưu bài. Worker quét SQL để phục hồi bài chờ theo phiên bản, kể cả sau restart.
Các lần đọc không tạo job. Yêu cầu phân tích lại của Admin dùng cùng hàng đợi và khóa chống trùng.
Ảnh có ngân sách inline 12 MiB; video tải tuần tự, upload Files API, chờ ACTIVE rồi tham chiếu URI.
Không cắt ở phút thứ 5; Gemini vẫn lấy mẫu và chịu quota/model/deadline. Thử xóa file Google khi xong,
không lưu URI tạm vào SQL. Backend tính hai điểm độc lập, NULL khi thiếu chứng cứ. Ở chế độ tự duyệt, điểm và quyết định cập nhật cặp trạng thái bài/phiên trong một transaction.

Nháp nằm trong localStorage theo tài khoản/chế độ/bài. Tác vụ upload sống ngoài component để tiếp tục qua
điều hướng SPA; reload có thể ngắt lượt chưa xong. Vé chưa gửi bài hết hạn một giờ, không phải lưu nháp SQL.
Xem [AI](ai-analysis.md), [media/nháp](media-upload.md), [đấu giá](auction-processing.md),
[realtime](realtime.md), [sau phiên](after-sales.md) và [xuất kết quả](review-exports.md).
