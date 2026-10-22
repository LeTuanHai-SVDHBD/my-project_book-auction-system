<!-- Mục đích: Lưu quyết định kỹ thuật, căn cứ và các lựa chọn chưa được thống nhất. -->

# Nhật ký quyết định kỹ thuật

## ADR-001 — Một repository, hai tiến trình Backend

Trạng thái: Đã áp dụng trong bộ khung.

Quyết định:
- Frontend và Backend nằm trong cùng repository.
- Quản lý dependency bằng npm workspaces.
- API và worker chạy riêng nhưng dùng chung mã nguồn Backend.

Lý do:
- Phù hợp quy mô đồ án.
- Dễ chia sẻ cấu hình, quy tắc và công cụ kiểm tra.
- Tách xử lý nền khỏi vòng đời HTTP request.

## ADR-002 — SQL Server là nguồn trạng thái có thẩm quyền

Trạng thái: Đã chốt trong thiết kế.

Quyết định:
- Giá hiện tại, lượt hợp lệ, trạng thái phiên và người thắng
  được xác định từ dữ liệu SQL Server.
- Redis hỗ trợ hàng đợi và phối hợp xử lý.
- Redis lock không thay thế giao dịch SQL và kiểm tra `row_version`.

Hệ quả:
- Worker phải đọc lại dữ liệu trước khi quyết định.
- Client không được quyết định kết quả từ dữ liệu đang hiển thị.

## ADR-003 — Dùng FK và UNIQUE cho quan hệ tối đa một bản ghi

Trạng thái: Đã có trong DDL. Chủ dự án xác nhận môi trường đã chạy thành công; bằng chứng thực thi được lưu khi nghiệm thu.

Ví dụ:
`KetQuaDauGia.phien_dau_gia_id` có FK, UNIQUE và NOT NULL.

| Ràng buộc | Ý nghĩa |
|---|---|
| FK | Kết quả phải tham chiếu một phiên tồn tại |
| UNIQUE | Một phiên không được xuất hiện trong nhiều kết quả |
| NOT NULL | Mỗi kết quả phải thuộc một phiên |

Ký hiệu `FK, UNIQUE` trong bảng mô tả là cách liệt kê
hai ràng buộc cùng áp dụng lên cột.

Trong SQL, FOREIGN KEY và UNIQUE vẫn là hai ràng buộc riêng.

Phía phiên có thể chưa có kết quả:
- Mỗi phiên có `0..1` kết quả.
- Mỗi kết quả thuộc đúng `1` phiên.

FK và UNIQUE không tự buộc mọi phiên phải có kết quả.
Khi phiên kết thúc, nghiệp vụ phải tạo kết quả nhất quán
trong giao dịch chốt phiên.

## ADR-004 — Cho phép thiếu người thực hiện ở một số quan hệ

Trạng thái: Đã chốt trong thiết kế.

- `LichSuDauGia.nguoi_dung_id` được NULL để lưu hoạt động hệ thống.
- `KhieuNai.admin_id` được NULL khi chưa có Admin tiếp nhận.

Một người dùng vẫn có thể liên quan nhiều bản ghi lịch sử.
Một Admin vẫn có thể xử lý nhiều khiếu nại.

Tính tùy chọn `0..1` ở mỗi bản ghi con không làm quan hệ thành 1–1.

## ADR-005 — Tiếp nhận bất đồng bộ và chống ghi trùng

Trạng thái:
- Đã áp dụng cho probe hạ tầng.
- Luồng đặt giá chưa triển khai.

Quyết định:
- HTTP 202 xác nhận tiếp nhận, không xác nhận nghiệp vụ thành công.
- Mỗi yêu cầu đặt giá có mã định danh.
- `LuotDatGia.ma_yeu_cau` có UNIQUE.
- Xử lý lại yêu cầu đã thành công phải trả kết quả cũ.
- Không khẳng định Redis Streams cung cấp xử lý đúng một lần.

## ADR-006 — Quy tắc giá và kết thúc phiên

Trạng thái: Đã chốt trong thiết kế.

- Giữ tên cột `gia_toi_thieu`.
- Cột này là ngưỡng kết thúc sớm, ẩn với người mua.
- Phiên kết thúc khi hết thời gian hoặc đạt/vượt ngưỡng.
- Khi hết hạn, lượt hợp lệ cao nhất vẫn thắng dù chưa đạt ngưỡng.
- Không có kết thúc thủ công hoặc hủy giữa phiên.
- Thời gian chờ đặt lại mặc định 20 giây, cho phép 10–30 giây.
- Khoảng chờ áp dụng theo cùng người trong cùng phiên.

## ADR-007 — Tách luồng kiểm tra khỏi nghiệp vụ

Trạng thái: Đã áp dụng trong bộ khung.

- Probe sử dụng stream hạ tầng riêng.
- Processor probe chỉ kiểm tra SQL bằng truy vấn đọc.
- Không dùng probe để ghi lượt đặt giá hoặc xác định người thắng.
- API probe chỉ mở trong development và yêu cầu token chẩn đoán.
- Token chẩn đoán không thay thế xác thực người dùng.

## ADR-008 — Cấu hình và phiên bản thư viện

Trạng thái: Đã áp dụng trong bộ khung.

- Dùng Node.js 24 theo cấu hình `engines`.
- Commit `package-lock.json` ở gốc.
- Dùng `npm ci` khi cài theo bộ phiên bản đã khóa.
- Không commit `.env`, dependency đã cài hoặc kết quả build.
- Chỉ đưa `.env.example` chứa cấu hình mẫu vào repository.

## ADR-009 — Phát thông báo sau COMMIT

Trạng thái: Nguyên tắc đã chốt; cơ chế phục hồi chưa chốt.

Yêu cầu:
- Không phát thành công trước khi SQL COMMIT.
- Worker và API là hai tiến trình riêng.
- Cần cơ chế chuyển thông báo sang API và xử lý trường hợp
  tiến trình dừng sau COMMIT nhưng trước khi phát thông báo.

Chưa chọn:
- Kênh chuyển thông báo từ worker sang API.
- Có bổ sung transactional outbox hay cơ chế tương đương không.
- Quy tắc phát lại và loại thông báo trùng.

Phải thống nhất trước khi triển khai luồng đấu giá hoàn chỉnh.

## ADR-010 — Cơ chế đăng nhập

Trạng thái: Chưa chốt.

Cần thống nhất trước khi triển khai:
- Dùng session hay token.
- Cách lưu thông tin xác thực phía trình duyệt.
- Thời hạn, đăng xuất và thu hồi phiên.
- Thư viện băm mật khẩu.
- Chính sách giới hạn thử đăng nhập.

Không tự bổ sung cột refresh token hoặc đổi schema khi chưa thống nhất.


## ADR-011 — Chuẩn hóa tên dự án và tài nguyên Docker

Trạng thái: Áp dụng trong lần chuẩn hóa repository.

| Thành phần | Tên |
|---|---|
| Repository, thư mục gốc, npm package gốc | `my-project_book-auction-system` |
| npm Backend | `my-project_book-auction-system-backend` |
| npm Frontend | `my-project_book-auction-system-frontend` |
| Docker Compose project | `my-project_book-auction-system` |
| Database | `BookAuctionDB` |
| Consumer group chẩn đoán | `infrastructure-workers` |

Tên stream/key Redis giữ namespace `bookauction:infra:*`.
Giữ nguyên database, bảng/cột và phiên bản thư viện.

Volume được đặt tên qua `SQLSERVER_VOLUME_NAME` và `REDIS_VOLUME_NAME`.
Máy cài mới dùng tên theo dự án trong `.env.example`.
Máy đã có `.env` chưa khai báo hai biến này được giữ tên volume cũ bằng fallback.
Tên cũ chỉ là định danh dữ liệu đã tồn tại, không còn là tên Docker project.
Đọc [hướng dẫn chuyển đổi](docker-migration.md) trước khi đổi môi trường đang chạy.

Consumer group mới có thể đọc lại probe hạ tầng cũ từ đầu stream.
Probe chỉ truy vấn SQL đọc và không tạo dữ liệu đấu giá.
Không chạy đồng thời worker bản cũ và bản mới trong quá trình chuyển đổi.

## ADR-012 — Tách tài liệu kỹ thuật và tài liệu học thuật

Trạng thái: Đã tạo cấu trúc lưu trữ.

- `docs/`: kiến trúc, luồng nghiệp vụ, quyết định kỹ thuật và tiến độ.
- `academic/reports/`: báo cáo DOCX và bản PDF đã xuất.
- `academic/slides/`: slide PPTX và bản PDF đã xuất.
- `academic/uml/`: mã PlantUML và hình sơ đồ đã xuất.
- `academic/evidence/`: bằng chứng kiểm thử được chọn để đưa vào báo cáo.

Commit tài liệu nguồn và bản được nhóm thống nhất.
File khóa Office, log thô và dữ liệu sinh tự động không đưa vào Git.
