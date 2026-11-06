<!-- Mục đích: Màn hình BookBid và hành vi frontend gắn API thực tế. -->

# Giao diện BookBid, tìm kiếm và thông báo

Đây là frontend đang tích hợp trong repository chính, dùng React/JavaScript/Vite và API thật.
`frontend-book`/Figma là nguồn phong cách đã chốt, không phải dependency chạy ứng dụng hoặc một bộ mock
đang thay dữ liệu nghiệp vụ. Khi chưa có sách hoặc media, giao diện hiển thị trạng thái rỗng.
Cài đặt/cập nhật tại [setup-guide.md](setup-guide.md); tài nguyên font/ảnh trang trí nằm trong source.

## Màn hình và điều hướng

| Hash route | Nội dung / quyền |
|---|---|
| `#/home` | Trang chủ, phiên công khai và bốn nhóm thể loại chung |
| `#/catalog`, `#/catalog/:postId` | Danh mục/tìm kiếm, chi tiết bản sách/ảnh/video, phiên/giá/kết quả |
| `#/create` | Người dùng: đăng sách bốn bước, có nháp |
| `#/mine`, `#/mine/:postId` | Bài của mình, bổ sung/kích hoạt/đăng lại, quyết định và PDF |
| `#/pending`, `#/pending/:postId` | Admin: bài chờ/từ chối, bằng chứng/AI và quyết định |
| `#/trades`, `#/trades/:tradeId` | Hai bên giao dịch/chat/xác nhận/đánh giá/khiếu nại |
| `#/complaints`, `#/complaints/:complaintId` | Người gửi hoặc Admin; chat chỉ đọc theo quyền phân công |
| `#/account` | Đăng ký/đăng nhập/tài khoản/đăng xuất |
| `#/infra` | Công cụ health/probe của môi trường phát triển |

`postId`, `auctionId`, `tradeId` là các ID khác nhau. API phiên lấy `phien_dau_gia_id` từ chi tiết bài,
không giả định bằng mã bài. Hash route giữ được Back/F5; Backend vẫn quyết định quyền mỗi request.

Admin chỉ có sidebar, chứa avatar/tài khoản và thông báo, không có header ngang hoặc nút đăng sách.
Người dùng dùng header/menu responsive. Khách không thấy avatar/hộp thông báo của người dùng.
Login mới cùng tài khoản thu hồi phiên cũ, tab cũ về đăng nhập, không dùng lớp phủ F5 để giành quyền.
CSRF chỉ giữ trong bộ nhớ; lỗi INVALID_CSRF được lấy token mới/thử lại tối đa một lần, không tự retry lỗi mạng.

## Danh mục và tìm kiếm

Form tìm kiếm điều hướng sang catalog; Backend tìm tên sách, tiêu đề, tác giả, ISBN, thể loại với SQL
tham số hóa, collation không phân biệt hoa/thường/dấu và escape ký tự LIKE. Không thêm bảng tìm kiếm,
không có Elasticsearch/full-text index hoặc tự truy cập Google.

| Query | Giá trị |
|---|---|
| `q` | Tối đa 120 ký tự, trim/NFKC |
| `genre`, `group` | Thể loại cụ thể/nhóm thuộc danh mục chung |
| `phase` | `all`, `live`, `scheduled`, `ended` |
| `sort` | `newest`, `price` tăng dần, `ending` |
| `page` | Từ 1; 30 mục, `nextPage` |

Chỉ bài đã duyệt và phiên kích hoạt/kết thúc được công khai; ẩn ngưỡng giá, email và AI nội bộ.
Bốn nhóm lấy từ `shared/bookGenres.js`: **Văn học và hư cấu**, **Kiến thức và phi hư cấu**,
**Tư liệu và sách cổ**, **Đối tượng độc giả**. Chọn nhóm lọc tập thể loại con, không thay bằng nhóm tên tự đặt.

## Đăng sách và nháp

Bốn bước: **Thông tin sách → Ảnh và video → Thông số đấu giá → Kiểm tra và gửi**.
Chọn thể loại bằng combobox; gõ để tìm, phải chọn mục hợp lệ. ISBN có/không, tối đa 100 ký tự nếu nhập,
không ép 10/13. Một ô bắt buộc tình trạng/quý hiếm/bằng chứng; Giới thiệu sách vẫn riêng.
Backend giữ tương thích trường tình trạng cũ, lấy preview tối đa 1000 ký tự khi không gửi trường đó.

Ba ô tiền nhận chữ số, không chèn dấu khi đang gõ/IME/focus/blur, giữ chuỗi tối đa 18 chữ số;
dòng Giá trị có nhóm nghìn. Cooldown chọn 10/15/20/25/30 giây; API chấp nhận nguyên 10–30.
Không tự thêm lịch khi đăng, chỉ đặt lịch sau phê duyệt.

Nháp theo tài khoản/chế độ/bài, nằm trên trình duyệt hiện tại, giữ trường/bước/vé media và dự kiến gỡ media cũ.
Đổi trang trong SPA giữ upload đang chạy; reload/đóng trình duyệt có thể ngắt lượt chưa xong.
Vé chưa gửi bài hết hạn sau một giờ; file đã gắn SQL có vòng đời khác. Gửi thành công mới xóa nháp hoặc
người dùng xác nhận **Bỏ bản nháp**; đóng biểu mẫu giữ nháp, không gửi sửa đổi lên hồ sơ SQL.

Bổ sung bài bị từ chối cho sửa đủ trường sách. Nút × media cũ đánh dấu gỡ, có **Giữ lại**;
chỉ áp dụng khi gửi thành công. Media cũ/URL/snapshot lịch sử không bị xóa. Giới hạn video tính cả
video giữ lại sau khi gỡ và cộng video mới. Chi tiết tại [media-upload.md](media-upload.md).

## Danh sách kiểm duyệt và AI

Danh sách Admin dùng lưới thẻ toàn chiều rộng, không còn cột Hàng đợi/khung Chọn hồ sơ.
Mặc định chờ trước, từ chối sau; lọc Tất cả/Chờ/Đã từ chối, cursor nhóm-ID và nút xem thêm.
Bài từ chối có lý do/ngày gần nhất, mở để xem chi tiết; muốn duyệt lượt mới phải do chủ sách gửi lại.
Bài đã phê duyệt rời danh sách này, quyết định/lịch sử vẫn giữ. Nút Về danh sách đưa về lưới thẻ.

Bài mới tự phân tích sau khi lưu. Admin thấy tiến độ, kết quả hoặc lỗi; nút **Phân tích lại bằng AI** chỉ xuất hiện khi bài còn chờ, đã có lượt phân tích cùng phiên bản và không có job đang chạy.
Khi Gemini trả 429, Admin thấy **Tạm dừng vì hạn mức** và giờ có thể thử lại. Trong thời gian chờ, giao diện ẩn nút thử lại và thông báo chuẩn bị media; bài vẫn ở danh sách chờ kiểm duyệt.
Bài chờ ở màn hình chi tiết tự lấy lại kết quả mỗi 5 giây. AI tự ghi quyết định và điền ô chỉ đọc **Căn cứ và lý do kiểm duyệt** nếu từ chối. Chỉ kết quả phân tích không thất bại
mới có hai ô điểm; NULL là thiếu bằng chứng, lỗi provider là thất bại/chẩn đoán riêng. Điểm `100.00` hiển thị `100/100`.
Video có tiến độ lấy Cloudinary/chuyển Files/chờ ACTIVE; manifest giữ link gốc, cách gửi toàn tệp
(Gemini lấy mẫu), bytes/thời lượng nếu có. Không coi “đã gửi” là xác minh mọi frame/trang sách.

Người bán chờ duyệt không có panel AI nội bộ. Sau quyết định chỉ công bố kết quả đúng vòng;
AI lỗi không lộ mã provider cho người bán. Nút PDF nằm trong kết quả/lịch sử có snapshot hợp lệ,
không gọi lại AI; xem [ai-analysis.md](ai-analysis.md) và [review-exports.md](review-exports.md).

## Màu trạng thái và bố cục

| Nhóm | Nhãn và màu |
|---|---|
| Bài và phiên | Chờ duyệt vàng hổ phách; đã duyệt xanh lá; từ chối đỏ; sắp bắt đầu tím; đang đấu giá xanh dương; chờ chốt cam; kết thúc xám xanh |
| Lượt giá | Chờ vàng hổ phách; chấp nhận xanh lá; từ chối đỏ |
| Giao dịch | Chờ xác nhận xanh lam ngọc; hoàn tất xanh ngọc |
| Khiếu nại | Chờ xử lý cam; đang xử lý chàm; đã xử lý xanh ngọc |
| AI | Chưa phân tích xám; chờ vàng; đang phân tích xanh dương; xong xanh lá; thiếu dữ liệu cam; lỗi đỏ |

Nhãn luôn có chữ và biểu tượng; không dùng màu làm tín hiệu duy nhất. Bài của tôi chuyển từ bảng sang thẻ
ở màn hình hẹp. Chi tiết, nút tìm kiếm, bộ lọc, ngăn thông báo, hộp thoại, bảng điểm và media co theo chiều rộng.
Giao diện dùng thương hiệu BookBid. Xem [kiểm chứng](../VALIDATION.md) để biết phạm vi QA thực tế.

## Gallery và đấu giá

Ảnh/video thuộc cùng một bản sách, giữ tỷ lệ/contain, không giả lập bìa nghiêng. Thumbnails có nút trước/sau,
Home/End chọn đầu/cuối; trong dải thumbnails, ←/→ đổi mục và đưa mục chọn vào vùng nhìn.
Phím điều khiển video native được giữ. Kính lúp desktop phóng đúng vùng ảnh, không phóng nền trống;
chạm/Enter mở ảnh gốc. Bản chuyển JPEG/MP4 để xem không ghi đè URL Cloudinary gốc trong hồ sơ.

Chủ sách không có thao tác đặt giá. Người mua chờ cooldown chỉ thấy thời gian còn lại;
đang chờ xử lý không được báo thành công trước quyết định SQL. Giá đang gõ không bị snapshot nền thay.
Đồng hồ dựa giờ SQL; hết giờ chờ kết quả từ server. Snapshot sau tín hiệu/reconnect và mỗi 5 giây
bù thông báo lỡ, xem [realtime.md](realtime.md).

## Hộp thông báo

Migration 004 thêm **ThongBao**, không thêm bảng tìm kiếm. Mỗi tài khoản chỉ đọc hộp của mình;
30 mục/trang, số chưa đọc, đánh dấu từng thông báo bằng POST có CSRF và giữ thời điểm đọc đầu.
Nguồn gồm gửi duyệt → Admin; quyết định → chủ bài; kết quả → chủ/người thắng; tin nhắn → người nhận;
xác nhận → bên còn lại; khiếu nại mới → Admin; phản hồi → người gửi.

Hộp được **đồng bộ khi đọc** từ các bản ghi nguồn đã COMMIT, trong transaction riêng với khóa người nhận
và UNIQUE `(nguoi_dung_id,nguon)`. Lỗi đồng bộ không rollback nghiệp vụ đã xong; lần đọc sau bổ sung nguồn còn lưu.
Không có trigger/outbox; đừng xóa nguồn trước khi hộp đồng bộ. Lưu nội dung ngắn cố định/ID đích,
không chép chat, bằng chứng, phản hồi riêng hoặc giá ẩn vào thông báo.
Frontend lấy lại mỗi 10 giây/focus/online; không cam kết push tức thời, email hay thông báo hệ điều hành.
Backend đích luôn kiểm tra quyền lại, kể cả thông báo cũ vẫn hiện.

## Giao dịch và kiểm tra giao diện

Giao dịch hiển thị hai xác nhận riêng; đánh giá chỉ phía người mua sau hoàn tất, không hiện lời mời
đánh giá người bán ở phía người bán. Khiếu nại tách lý do/nội dung, trạng thái, bằng chứng và phản hồi Admin.
Chỉ Admin được phân công/hồ sơ đang xử lý mới mở chat chỉ đọc. Chi tiết tại [after-sales.md](after-sales.md).

Checklist bàn giao: khách/role, tìm kiếm rỗng/lọc/phân trang, nhập tiền/IME, nháp/upload,
M4 video dài, pending/rejected/approved, PDF, nhiều trình duyệt/reconnect và màn hình nhỏ.
Nguồn kiểm chứng và thành phần thật/fixture: [VALIDATION.md](../VALIDATION.md).

## Tài nguyên và giấy phép

Ảnh thư viện trang chủ theo mã thiết kế gốc: [nguồn Unsplash](https://images.unsplash.com/photo-1600181982553-ce7d36051c01),
lưu tại `frontend/public/assets/library.jpg`. Đây là ảnh trang trí, không thay cho ảnh/video hoặc bằng chứng của sách.
Font local Inter và Playfair Display có các tệp giấy phép [Inter OFL](../frontend/public/assets/fonts/inter-OFL.txt)
và [Playfair Display OFL](../frontend/public/assets/fonts/playfairdisplay-OFL.txt); giữ chúng khi phân phối tài nguyên.
