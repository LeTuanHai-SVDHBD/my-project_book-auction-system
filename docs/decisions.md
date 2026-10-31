<!-- Mục đích: Ghi quyết định kiến trúc, lý do áp dụng và giới hạn còn lại. -->

# Quyết định kỹ thuật

## ADR-001 — Repository và tiến trình

**Trạng thái:** áp dụng.

Một repository chứa React và Backend, quản lý dependency bằng npm workspaces.
API và worker là hai tiến trình dùng chung mã nguồn; không triển khai thành microservices.
Mục tiêu là giữ cấu hình và quy tắc dùng chung, tách xử lý nền khỏi vòng đời HTTP request.

## ADR-002 — Nguồn trạng thái có thẩm quyền

**Trạng thái:** áp dụng.

SQL Server quyết định trạng thái, lịch, giá và kết quả nghiệp vụ.
Redis phục vụ session, hàng đợi, giới hạn thử và phối hợp; Redis lock không thay transaction SQL.
Dữ liệu cần được đọc lại dưới khóa trước khi cập nhật, không dựa vào trạng thái client đang hiển thị.

## ADR-003 — Quan hệ và ràng buộc dữ liệu

**Trạng thái:** có trong schema.

FK bảo vệ tham chiếu; UNIQUE bảo vệ quan hệ tối đa một bản ghi; NOT NULL xác định thuộc tính bắt buộc.
Ví dụ KetQuaDauGia có FK/UNIQUE trên mã phiên, nên mỗi kết quả thuộc một phiên và mỗi phiên có tối đa một kết quả.
Các ràng buộc đó không tự buộc mọi phiên phải có kết quả; luồng chốt phiên phải tạo dữ liệu nhất quán trong transaction.

## ADR-004 — Người thực hiện tùy chọn

**Trạng thái:** có trong schema.

LichSuDauGia cho phép người thực hiện NULL để ghi hoạt động hệ thống.
KhieuNai cho phép Admin NULL trước khi tiếp nhận. Tính tùy chọn ở bản ghi con không làm quan hệ trở thành một–một.

## ADR-005 — Tiếp nhận bất đồng bộ và idempotency

**Trạng thái:** áp dụng cho probe và đấu giá.

HTTP 202 chỉ xác nhận tiếp nhận. Worker chỉ thông báo nghiệp vụ thành công sau SQL COMMIT.
UUID yêu cầu và UNIQUE là lớp bảo vệ khi sự kiện được giao lại; xử lý lại không tạo dữ liệu trùng.
Không khẳng định Redis Streams cung cấp cơ chế xử lý đúng một lần.

## ADR-006 — Giá và điều kiện kết thúc

**Trạng thái:** đã triển khai trong policy và transaction đấu giá.

- `gia_toi_thieu` là ngưỡng kết thúc sớm, ẩn đối với người mua.
- Lượt đầu bằng `gia_khoi_diem + k × buoc_gia`, `k >= 0`; lượt sau bằng `gia_hien_tai + k × buoc_gia`, `k >= 1`.
- Chỉ kết thúc khi hết thời gian hoặc giá hợp lệ đạt/vượt ngưỡng; không có hủy giữa phiên/kết thúc thủ công.
- Hết hạn có lượt hợp lệ thì giá cao nhất thắng dù chưa đạt ngưỡng.
- Cooldown theo cùng người/cùng phiên, mặc định 20 giây, cấu hình 10–30 giây.
- Chỉ tạo giao dịch nếu có người thắng.

## ADR-007 — Chẩn đoán tách khỏi nghiệp vụ

**Trạng thái:** áp dụng.

Probe có stream riêng, processor chỉ truy vấn đọc SQL.
Endpoint chẩn đoán chỉ bật trong development và cần token riêng; token đó không thay đăng nhập.
Probe không được ghi lượt đặt giá, kết quả hoặc giao dịch.

## ADR-008 — Dependency và cấu hình

**Trạng thái:** áp dụng.

Dùng Node.js 24, lockfile ở gốc và npm workspaces. Cài theo lockfile bằng `npm ci`.
Không commit `.env`, node_modules hoặc kết quả build. Cấu hình mẫu chỉ chứa placeholder.
Thêm dependency hoặc thay kiến trúc cần được thống nhất trước; tích hợp Cloudinary dùng native Node APIs hiện có.

## ADR-009 — Phát thông báo sau COMMIT

**Trạng thái:** áp dụng cho cập nhật trực tiếp.

API và worker là tiến trình riêng; Redis Pub/Sub chuyển tín hiệu ID phiên sau COMMIT tới các API.
Processor phát lỗi thì giữ pending để đọc quyết định SQL và phát lại trước ACK; tín hiệu trùng chỉ gây đọc lại.
Socket chỉ có room phiên/danh mục công khai được server kiểm tra, không thay cơ chế xác thực HTTP theo tab.
Client lấy lại snapshot sau join/reconnect và mỗi 5 giây để bù thông báo lỡ, kể cả Pub/Sub lỡ khi không có subscriber.
Chọn phục hồi trạng thái hiện tại từ SQL; không cam kết giao mọi sự kiện, không bổ sung outbox/bảng hoặc Redis Adapter.
Chi tiết quyền, đồng hồ và giới hạn tại [realtime.md](realtime.md).

## ADR-010 — Session Redis và phân tách theo tab

**Trạng thái:** cookie riêng theo tab tiếp tục áp dụng; cùng tài khoản chỉ một cửa sổ điều khiển theo ADR-019.

- Argon2id lưu hash tại NguoiDung; API đăng ký công khai chỉ tạo người dùng thường.
- `express-session`/RedisStore lưu session; API thật không chuyển sang MemoryStore khi Redis lỗi.
- Cookie HttpOnly, SameSite=Lax, Secure khi production; thời hạn không hoạt động mặc định hai giờ.
- Đăng nhập đổi session ID/CSRF, đăng xuất thu hồi ở Redis; tài khoản và vai trò được đọc lại từ SQL.
- CSRF token chỉ giữ trong bộ nhớ. Không lưu mật khẩu, session ID hoặc bearer token vào Web Storage.

Frontend tạo mã chọn tab ngẫu nhiên 32 ký tự hex trong sessionStorage và gửi `X-Tab-ID` cho mọi request tài khoản,
bài đăng và media. Cookie của mỗi tab có tên `bookauction.sid.<tab-id>`. Backend chỉ đưa cookie được chọn
vào middleware session; khi trả cookie hoặc clearCookie, ánh xạ về đúng tên của tab.

Dùng một middleware/store chung, không tạo middleware theo từng request/tab để tránh tăng listener và bộ nhớ.
Mã tab không cấp quyền, không thay cookie ký hoặc CSRF. Header sai bị từ chối; tab có mã nhưng không có cookie vẫn chưa đăng nhập.
Cookie chung không được dùng làm fallback cho request có mã tab. Client terminal không gửi header tiếp tục dùng
`bookauction.sid` để giữ hợp đồng HTTP và smoke hiện có.

**Vòng đời đã thống nhất:** F5/Reload giữ đăng nhập; tài liệu mới tạo mã mới, kể cả khi sessionStorage được sao chép
qua opener/nhân bản tab. Tab mới yêu cầu đăng nhập, logout chỉ ảnh hưởng tab hiện tại. Điều hướng nội bộ của ứng dụng
là React state; nạp trang thành một tài liệu mới cũng tạo mã mới. Session cũ không còn được chọn vẫn hết hạn theo TTL;
đóng tab không bảo đảm trình duyệt gửi được yêu cầu logout tới server.

Đây là phân tách trải nghiệm theo tab, không phải ranh giới bảo mật giữa các script cùng origin.
Trình duyệt vẫn quản lý cookie chung cho origin; client cần gửi đúng selector trên mọi API được bảo vệ.

| Hoạt động | Giới hạn | Cửa sổ |
|---|---|---|
| Đăng nhập theo email | 10 lần | 15 phút |
| Đăng nhập theo IP | 50 lần | 15 phút |
| Đăng ký theo IP | 10 lần | 15 phút |
| Cấp CSRF theo IP | 60 lần | 1 phút |

Bộ đếm tính cả lần thành công; quá giới hạn trả 429/Retry-After. Khóa giới hạn dùng HMAC thay email/IP nguyên văn.
Tham khảo: [express-session](https://expressjs.com/en/resources/middleware/session/),
[sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage).

## ADR-011 — Bảo toàn volume Docker

**Trạng thái:** áp dụng.

Compose project mang tên `my-project_book-auction-system`. Tên volume được cấu hình độc lập với project.
Máy cài mới dùng hai tên chuẩn trong `.env.example`; cấu hình cũ thiếu biến giữ fallback hiện hành.
Khi chuyển project phải lấy tên volume từ mount thực tế, không suy đoán theo tên repository.
Không tự đổi tên, sao chép hoặc xóa volume đang có dữ liệu. Xem [docker-migration.md](docker-migration.md).

## ADR-012 — Cloudinary và ledger media

**Trạng thái:** áp dụng; còn giới hạn phục hồi cần đối soát thủ công.

React gửi tệp nhị phân qua API xác thực/CSRF; server dùng fetch/FormData/Blob của Node 24 và credentials riêng
để gọi Cloudinary REST. SQL lưu URL/public_id; migration 002 thêm hai cột nullable và index, giữ nguyên DDL nền.
Migration 002 nâng schema nền lên 19 bảng/144 cột; migration 003 nâng tiếp lên 20 bảng/152 cột.
URL cũ có thể chưa có public_id.

Redis lưu vé và lịch cleanup, không lưu bytes. Tạo vé trước upload, thời hạn sử dụng một giờ;
không TTL-xóa ledger. Lua claim kiểm tra chủ sở hữu và trạng thái nguyên tử.
Không gọi provider khi giữ transaction SQL; sau COMMIT mới acknowledgement.
SQL rollback chắc chắn trả vé về ready; kết quả commit chưa rõ giữ claim.

Cleanup mỗi phút kiểm tra tham chiếu SQL trước khi destroy. SQL/provider lỗi giữ lại để retry.
Claim chưa rõ và không có reference được giữ/cảnh báo để đối soát sau khi dừng API.
Mất Redis có thể để lại orphan; không có distributed transaction SQL–Cloudinary.
Chưa có chức năng xóa bài; xóa SQL thủ công không tự xóa tệp. File dùng chung giữa các lần đăng cần được bảo vệ theo reference.

Cập nhật 30/10/2026: bỏ giới hạn số ảnh mỗi bài theo yêu cầu. Giữ mặc định 3 video/bài (tính cả media giữ lại), 10 MB/ảnh, 50 MB/video, hai upload đồng thời/API process,
60 lần thử/tài khoản/giờ. Đây là giới hạn kỹ thuật, không thay bộ tiêu chí thẩm định sách.
Tham khảo: [Cloudinary Upload API](https://cloudinary.com/documentation/image_upload_api_reference).

## ADR-013 — Vòng đời bài đăng và kiểm duyệt

**Trạng thái:** áp dụng; AI hỗ trợ theo ADR-017.

Tạo sách/bài/phiên/media/lịch sử trong transaction SERIALIZABLE; cặp pending và chưa có lịch.
UUID ánh xạ `BK` + 32 ký tự hex thành mã sản phẩm UNIQUE; cùng mã trả bài đã tạo của đúng chủ,
không dùng lại mã cho nội dung mới. Không thêm cột idempotency khác.

Kiểm duyệt khóa cặp bài/phiên, kiểm tra version, ghi lý do và cập nhật nguyên tử.
Duyệt cần xác nhận bằng chứng quý hiếm; điểm AI không tự quyết định duyệt.
Bài từ chối có thể bổ sung nội dung/giá/media rồi gửi lại, giữ ID và lịch sử; không sửa Sach dùng trong lịch sử.
Kích hoạt chỉ cập nhật đúng phiên đã duyệt của chủ sách, lịch hợp lệ theo đồng hồ SQL và UTC.

Đăng lại khóa Sach, kiểm tra phiên cuối đã kết thúc và kết quả rõ không người thắng; tạo bài/phiên mới cùng Sach,
không ghi đè lần trước. Thiếu kết quả không đủ điều kiện đăng lại.
Public projection không có ngưỡng giá, owner/email, version hoặc nhận xét nội bộ.
Chưa có lần gọi Gemini thì trả `ai: null`, không tạo điểm/kết quả lỗi giả; kiểm duyệt thủ công vẫn hoạt động.

## ADR-014 — Hợp đồng phiên bản dữ liệu

**Trạng thái:** áp dụng.

Đọc `CONVERT(BINARY(8), p.row_version)`, mã hóa bytes thành hex 16 ký tự viết hoa tại model.
Dùng chung encoder cho list/detail và dòng đang khóa, giữ byte 0 đầu và không qua Number.
Dữ liệu không đúng tám byte phải báo lỗi thay vì sinh token giả. HTTP vẫn yêu cầu đúng chuỗi hex;
version cũ bị chặn 409 sau khi lấy khóa. Không thay đổi schema hoặc quy tắc trạng thái.
Có test qua model thật/HTTP với driver giả trả binary; SQL thật cần smoke riêng.
Tham khảo: [Microsoft rowversion](https://learn.microsoft.com/en-us/sql/t-sql/data-types/rowversion-transact-sql).

## ADR-015 — Nhập tiền và độ chính xác

**Trạng thái:** áp dụng.

Ba ô giá khởi điểm/ngưỡng kết thúc sớm/bước giá nhập số thuần; dòng Giá trị bên dưới hiển thị nhóm nghìn.
Không đổi định dạng trong ô khi gõ/focus/blur để tránh can thiệp IME hoặc làm lặp chữ số.
Input hiển thị tách khỏi hidden input mang chuỗi nguyên gửi API. Không chuyển tiền sang Number,
không làm tròn và không âm thầm cắt bớt khi vượt 18 chữ số. Chỉnh sửa/xóa chuỗi số dùng hành vi bàn phím thông thường; chỉ hiệu chỉnh khi lọc ký tự không phải số.
Giá hiện tại thuộc nghiệp vụ đặt giá, không cho chủ sách tự nhập.
Backend tiếp tục kiểm tra chuỗi nguyên dương, ngưỡng không nhỏ hơn giá khởi điểm và các ràng buộc SQL.


## ADR-016 — Quyết định đặt giá và phục hồi consumer

**Trạng thái:** áp dụng; việc bổ sung schema đã được chủ dự án thống nhất.

Migration 003 thêm YeuCauDatGia với mã yêu cầu PRIMARY KEY, dữ liệu người/phiên/giá, quyết định cuối,
lý do từ chối và thời điểm xử lý. LuotDatGia chỉ chứa lượt hợp lệ. Cùng mã được chuẩn hóa UUID v4;
dùng lại cho nội dung khác trả 409. Migration giữ dữ liệu cũ, backfill lượt hợp lệ thành quyết định chấp nhận,
giữ lý do kết thúc lịch sử NULL nếu chưa biết; không sửa DDL nền hoặc tự xóa database.

Redis admission ngăn xếp lặp cùng payload khi pending. Worker dùng stream nghiệp vụ riêng,
Redis lock SET NX PX và token/Lua gia hạn/xóa. SQL vẫn quyết định bằng transaction SERIALIZABLE,
khóa bài rồi phiên, rowversion, UPDATE có điều kiện và UNIQUE.
Đọc đồng hồ SQL sau khi lấy khóa và dữ liệu mới nhất. Mất lease trước COMMIT thì rollback/retry;
SQL bảo vệ tính nhất quán ngay cả khi lease hết hạn lúc COMMIT.

Quyết định, lượt giá, cập nhật giá/lịch sử và kết quả/giao dịch khi cần cùng COMMIT.
Lỗi COMMIT chưa rõ không báo từ chối giả; giữ thông điệp để xử lý lại và đọc quyết định SQL.
Consumer ACK rồi xóa thông điệp đã xử lý trong cùng Redis MULTI sau COMMIT;
pending nhận lại bằng XAUTOCLAIM, không tuyên bố xử lý đúng một lần.
Không tự cắt stream theo MAXLEN để tránh xóa mất pending. Dead-letter cần đối soát riêng.

Job mỗi giây tìm tối đa 50 phiên hết hạn theo SQL và xếp yêu cầu chốt, chống xếp lặp trong 10 giây.
Kết thúc có hai lý do đã chốt, lưu tại KetQuaDauGia.ly_do_ket_thuc; chỉ tạo GiaoDich khi có người thắng.
Giao diện poll quyết định của mình; snapshot công khai đồng bộ qua tín hiệu Socket và HTTP theo ADR-009.
Chi tiết: [Xử lý đấu giá](auction-processing.md).

## ADR-017 — AI quan sát, Backend tính điểm, Admin quyết định

**Trạng thái:** áp dụng; Hải xác nhận smoke:ai PASS; đối chiếu ảnh/video thật còn chờ dữ liệu.

Theo báo cáo tuần 7 và yêu cầu hiện tại, độ hiếm gồm bốn nhóm 25%; tình trạng gồm 20/25/30/15/10%.
Giữ hai tổng độc lập; thiếu tiêu chí áp dụng giữ NULL, không áp dụng có căn cứ mới loại trọng số.
Gemini chỉ trả quan sát có cấu trúc; Backend giữ bảng quy đổi/trọng số, không dùng điểm do mô hình tự chọn.
Ảnh không thấy không chứng minh bộ phận bị mất; chữ ký quan sát được không có nghĩa chữ ký thật.
Không dùng điểm cao hoặc sự cố AI để tự duyệt/từ chối bài.

Hàng đợi AI và kết nối BLOCK riêng không chặn vòng đặt giá/chốt hạn. Đối soát SQL bù enqueue bị mất;
lưu kết quả và chi tiết trong transaction kiểm tra lại version/pending. Receipt request trong metadata
chống ghi trùng, cache kết quả đã kiểm tra hạn chế gọi lại Gemini khi SQL lỗi. Không cam kết gọi provider đúng một lần:
crash trước cache có thể tốn thêm lượt gọi. Không thêm bảng/cột hoặc dependency.
Metadata có phiên bản quy tắc, hash đầu vào, model, nguồn và cảnh báo; lịch sử cũ được giữ.
Xem [Phân tích AI](ai-analysis.md) để tra công thức, hợp đồng, cấu hình và giới hạn media.

## ADR-018 — Giao dịch hai xác nhận và quyền chat theo hồ sơ

**Trạng thái:** áp dụng; chờ SQL Server/Cloudinary thật và smoke:m8.

Dùng các bảng sẵn có, không thêm schema/dependency. Kết quả có người thắng tạo GiaoDich và CuocTroChuyen
cùng transaction; hai bên được suy từ kết quả/chủ bài, số tiền giữ nguyên chuỗi DECIMAL(18,0).
Khóa giao dịch trong SERIALIZABLE khi xác nhận, tạo phòng, gửi tin, đánh giá hoặc xử lý khiếu nại.
Mỗi bên chỉ ghi dấu xác nhận của mình; đủ hai dấu mới hoàn tất. UNIQUE giữ một phòng/một đánh giá.
Chỉ người mua hoàn tất được đánh giá; cùng nội dung trả bản cũ, không cho ghi đè lịch sử.

Chat riêng chỉ có hai bên. Admin xem hồ sơ/bằng chứng để tiếp nhận; chỉ người được phân công và đang xử lý
mới đọc chat liên quan, không gửi tin hoặc đánh dấu đọc. Sau xử lý không tiếp tục quyền đọc chat qua hồ sơ.
Khiếu nại không tự đổi giao dịch/kết quả. Ảnh dùng vé upload của người gửi; bind lỗi sau COMMIT không đảo kết quả.
URL delivery Cloudinary hiện tại chưa có bảo vệ riêng tại CDN; quyền API không đồng nghĩa ảnh chỉ truy cập bằng session.

Không mở room Socket riêng; trang mới nhất poll HTTP ba giây, lịch sử cursor không tự thay trang.
POST tin/bình luận/hồ sơ không có receipt UUID, không tự retry khi mất phản hồi; đọc lại trước khi gửi.
Chỉ retry deadlock 1205 đã rollback tối đa một lần. Bình luận khóa phiên và kiểm tra giờ SQL trước INSERT.
Xem [Giao dịch và tương tác sau đấu giá](after-sales.md).

## ADR-019 — Chủ mới điều khiển tài khoản và đầu vào thể loại có danh mục

**Trạng thái:** áp dụng theo yêu cầu ngày 25/10/2026; không đổi schema hoặc dependency.

Cùng tài khoản chỉ một phiên đăng nhập. Theo yêu cầu xác nhận lại, chỉ login bằng mật khẩu mới đổi owner,
xóa session cũ và publish trong Lua; owner theo session ID giữ ổn định khi F5. GET me/control-status và POST control
chỉ kiểm tra, không được khôi phục quyền từ cookie cũ. Namespace /account ngắt phiên cũ; giao diện xóa user/CSRF,
trở về đăng nhập. Không còn lớp phủ yêu cầu F5 để tiếp tục. Khác tài khoản vẫn độc lập.
Hợp đồng và giới hạn tại [account-control.md](account-control.md).

Ô tiền luôn nhập số thuần, kể cả khi focus hoặc rời ô; định dạng có dấu chấm chỉ hiện ở dòng Giá trị riêng.
Không ghi DOM value hoặc đổi mask trong khi gõ. Trong composition giữ draft, chốt và kiểm tra số sau compositionend;
giữ chuỗi nguyên/18 chữ số, không chuyển Number hoặc tự cắt phần vượt giới hạn.

Thể loại là một lựa chọn từ danh mục dùng chung ở shared/bookGenres.js, căn cứ tài liệu thể loại người dùng gửi,
bổ sung nhóm sách cổ/tư liệu. Gõ có/không dấu chỉ lọc danh sách; API sách mới chặn tên ngoài danh mục.
Giữ tùy chọn để trống và dữ liệu sách cũ, không migration hoặc tự ánh xạ lại lịch sử.

## Bản kết quả kiểm duyệt cho người bán

Người bán xuất PDF của lần đã được Admin phê duyệt/từ chối. Migration 005 thêm một cột `ket_qua_snapshot` vào bảng KiemDuyet hiện có, không thêm bảng hoặc dependency. Ghi bản kết quả trong cùng transaction với quyết định để không lẫn thông tin/media/AI khi gửi duyệt lại. Với dữ liệu cũ, chỉ dựng và lưu lại quyết định hiện tại còn phù hợp; vòng cũ không có snapshot không được tái tạo bằng dữ liệu mới. PDF dùng bản in A4 riêng và chức năng lưu PDF của trình duyệt, các media giữ dạng link Cloudinary.

## Ô ISBN nhận chuỗi do người bán cung cấp

Theo yêu cầu ngày 31/10/2026, bỏ ràng buộc chính xác 10/13 ký tự ở frontend, Backend và SQL. Dùng chung ISBN_MAX_LENGTH=100; giữ nội dung và dấu phân cách, không ép uppercase hoặc chuyển Number. Migration 006 mở rộng cột hiện có thành NVARCHAR(100), bỏ check định dạng cũ, giữ check không rỗng và chỉ mục. Không tự xác nhận mã người đăng nhập là ISBN chuẩn; Admin tiếp tục đối chiếu. Không sửa dữ liệu hay hash nguồn của phân tích AI cũ.


## AI nhiều media: chuẩn bị riêng, timeout thích ứng và lease được gia hạn

Theo lỗi lặp lại ngày 31/10/2026, thay bước tải tuần tự bằng tối đa bốn tải song song theo lô,
giữ thứ tự/mã bằng chứng và ngân sách 12 MiB. Bước chuẩn bị có deadline riêng; tệp bỏ qua vẫn nằm trong manifest.
Thời gian từng lượt Gemini = cơ sở + 4 giây/media thực gửi, có trần 300 giây mặc định; tối đa hai lượt
chỉ với lỗi tạm thời, dùng lại payload. Đọc body cũng nằm trong deadline. Dùng thinking_level=low,
giữ output 8192 để tránh cắt JSON; Admin vẫn quyết định và hai điểm giữ NULL khi không đủ dữ liệu.

Lease AI 60 giây được gia hạn mỗi 15 giây suốt tác vụ; mất lease/worker dừng thì hủy và để pending,
không lưu kết quả giả. Replay SQL dùng cache/receipt cũ. Có thể gọi provider lại sau crash trước cache;
không cam kết đúng một lượt hay hết mọi sự cố Gemini/mạng. Admin thấy tiến độ và thống kê an toàn;
kết quả cũ được đánh dấu khi phân tích lại. Không đổi schema/dependency/hash nguồn, nhà cung cấp hoặc cấu hình riêng.
