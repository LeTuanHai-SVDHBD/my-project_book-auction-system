# BookBid: giao diện thật, tìm kiếm và hộp thông báo

## Cập nhật trên Windows

Tại thư mục gốc `my-project_book-auction-system`, dừng terminal `dev:all` bằng Ctrl+C. Giữ Docker SQL Server/Redis chạy. Sau khi lưu các thay đổi cục bộ cần thiết:

```powershell
git switch feat/Hai
git pull --ff-only origin feat/Hai
npm.cmd ci
npm.cmd run db:migrate
npm.cmd run dev:all
```

Mở `http://localhost:5173`. Không cần pnpm, không đổi `.env` và không tạo lại database. Migration 004 chỉ thêm `ThongBao`/index, chạy lại được; schema mới 21 bảng/161 cột. Bản cũ 20/152 được init nhận diện để nâng cấp giữ dữ liệu.

## Phiên biểu mẫu và giao diện khách

`services/apiBase.js` dùng chung cho HTTP, Socket tài khoản, Socket đấu giá và công cụ hạ tầng. Nếu web/API là hai tên loopback `localhost`/`127.0.0.1` cùng giao thức, lấy hostname đang mở ở web và giữ cổng/giao thức API. Không sửa `.env` cá nhân hoặc đổi URL API ở host khác. Ví dụ web `http://localhost:5173` + cấu hình API `http://127.0.0.1:5000` sẽ gọi `http://localhost:5000` để cookie không bị chặn vì khác site.

Khi POST bị Backend từ chối bằng HTTP 403/`INVALID_CSRF` trước khi xử lý nghiệp vụ, client lấy lại CSRF rồi gửi lại đúng một lần trong cùng phiên. Không tự thử lại lỗi mạng, sai mật khẩu, lỗi nghiệp vụ hoặc yêu cầu thuộc phiên cũ; không thay CSRF/token mới theo một phản hồi lỗi cũ. Cookie HttpOnly/SameSite=Lax và cơ chế thu hồi đăng nhập giữ nguyên.

Khách chỉ có các liên kết điều hướng/đăng nhập và tìm kiếm, không có avatar hoặc chuông. Đăng nhập thành công mới hiện hai phần đó; đăng xuất/thu hồi phiên gỡ chúng và đóng hộp thông báo.

## Giao diện và đường dẫn

Phong cách tham chiếu: [frontend-book tại 83add59](https://github.com/LeTuanHai-SVDHBD/frontend-book/tree/83add5905dc2b0ed1da23c46af7b1367d260c94d). Navy/vàng/kem, Inter/Playfair tự phục vụ, chữ 20px desktop/18px mobile, trang chủ có ảnh thư viện, card, sidebar Admin với chuông/tài khoản. Màn hình nhỏ mở sidebar qua Menu quản trị. Không dùng bộ chọn vai trò/trạng thái mẫu, ảnh sách tạo bởi AI, giá hoặc đồng hồ mẫu trong ứng dụng chính. Khi không có sách/media, hiển thị trạng thái rỗng.

| Hash | Nội dung |
|---|---|
| `#/home` | Trang chủ, phiên công khai lấy từ Backend |
| `#/catalog?q=…&phase=live&sort=price` | Tìm kiếm/bộ lọc |
| `#/catalog/:postId` | Chi tiết công khai, ảnh/video thật cùng bản sách, đặt giá/lịch sử/kết quả |
| `#/create` | Đăng sách bốn bước, upload Cloudinary, gửi kiểm duyệt |
| `#/mine`, `#/mine/:postId` | Bài của mình, AI riêng, bổ sung, kích hoạt/đăng lại |
| `#/pending`, `#/pending/:postId` | Admin: hàng đợi, bằng chứng, AI, quyết định |
| `#/trades`, `#/trades/:tradeId` | Hai bên giao dịch/chat/xác nhận/đánh giá/khiếu nại |
| `#/complaints`, `#/complaints/:complaintId` | Hồ sơ người gửi/Admin, chat chỉ đọc đúng người xử lý |
| `#/account` | Đăng ký/đăng nhập/tài khoản/đăng xuất thật |
| `#/infra` | Công cụ hạ tầng hiện có |

`postId` khác `auctionId`; API phiên vẫn nhận `phien_dau_gia_id` từ chi tiết bài, không suy đoán hai ID bằng nhau. Điều hướng hash giữ được F5 và Back. Thông báo chỉ điều hướng; Backend đích kiểm tra quyền như cũ.

## Tìm kiếm

`GET /api/posts/catalog?q=&genre=&group=&phase=all&sort=newest&page=1`. Từ khóa tối đa 120 ký tự; thể loại/nhóm tối đa 100; phase `all|live|scheduled|ended`; sort `newest|price|ending`; page 1–9999, 30 kết quả/trang. Phản hồi `{items,nextPage}`. Endpoint cũ không có bộ lọc vẫn hỗ trợ `before`/`nextBefore`; không trộn hai cơ chế phân trang.

Trang chủ lấy đúng bốn nhóm chính từ `BOOK_GENRE_GROUPS` trong `shared/bookGenres.js`. `group` phải là tên nhóm có trong danh mục; Backend mở rộng nhóm thành các thể loại con và truyền từng giá trị bằng tham số SQL. Bộ lọc giao diện chọn nhóm hoặc một thể loại cụ thể; chọn lại một loại sẽ bỏ điều kiện nhóm cũ.

SQL dùng tham số, collation `Vietnamese_100_CI_AI` và quy đổi đ/d cho từ khóa; `%`, `_`, `[`, `~` trong từ khóa là ký tự thường. Tìm trong tên sách, tiêu đề, tác giả, ISBN và thể loại. Bộ lọc áp dụng trước phân trang. Sort là biểu thức máy chủ cố định; có ID phụ để thứ tự ổn định. Danh mục thay đổi trực tiếp có thể dịch vị trí giữa các trang; UI chống lặp ID và đọc lại trang đầu khi đồng bộ. Không tạo chỉ mục full-text hay dependency mới. Khi dữ liệu lớn cần đo truy vấn và cân nhắc full-text riêng.

Danh sách công khai chỉ trả bài đã duyệt/đã công bố, thêm `anh_bia` thật từ HinhAnh; không có giá kết thúc sớm, rowversion, AI hay thông tin tài khoản. Không có ảnh thì hiển thị placeholder trung tính.

## Media, ISBN và trình bày hồ sơ

Bài đăng không còn giới hạn 12 ảnh. `GET /api/media/config` trả `maxImages: null`; cấu hình cũ `MEDIA_MAX_IMAGES` bị bỏ qua. Giữ giới hạn dung lượng mỗi ảnh (mặc định 10 MB), 3 video/50 MB mỗi video theo cấu hình, hạn vé và kiểm soát tài nguyên upload hiện có. Cả Backend và frontend đều kiểm tra số video gồm media giữ lại. JSON body và khả năng lưu trữ vẫn tuân giới hạn kỹ thuật của hạ tầng; không đổi schema hoặc thông số tải AI.

Mỗi media vừa tải có nút × với tên truy cập theo tệp. Nút gọi DELETE vé của chính người dùng và chỉ gỡ khỏi danh sách sau thành công; vé đã bỏ không được gửi cùng bài. Media đã lưu trong lịch sử bài không bị xóa qua giao diện này. Thay đổi này chỉ áp dụng ảnh sách, không đổi quy tắc tối đa 5 ảnh bằng chứng khiếu nại.

Chọn **Có ISBN** sẽ hiện ô bắt buộc kiểm tra định dạng 10/13 ký tự. Chọn **Không có ISBN** sẽ không gửi giá trị ISBN cũ đang gõ và Backend lưu NULL. ISBN của bản sách đã lưu vẫn bất biến khi gửi duyệt lại/đăng lại.

Biểu mẫu chỉ có một ô **Tình trạng, yếu tố quý hiếm và bằng chứng**, bắt buộc và tối đa 12.000 ký tự, lưu đầy đủ vào `BaiDang.mo_ta_tinh_trang`. Không còn ô nhập `tinh_trang_sach` riêng; **Giới thiệu sách** dành cho nội dung tác phẩm.

API tạo sách chấp nhận bỏ `sach.tinh_trang_sach`. Để tương thích cột SQL `Sach.tinh_trang_sach NVARCHAR(1000) NOT NULL`, Backend tự lấy phần đầu tối đa 1.000 ký tự làm bản xem trước, không cắt toàn văn của bài. Client cũ vẫn có thể gửi trường riêng với giới hạn cũ. Không migration, không sửa dữ liệu sách đã lưu hoặc lịch sử khi gửi duyệt lại/đăng lại. Chi tiết bài và prompt Gemini dùng cùng hàm gộp: bỏ phần xem trước đã có trong mô tả, giữ tình trạng cũ khác biệt dưới nhãn **Tình trạng đã lưu trước đây**. Không biến thông tin thiếu thành một đánh giá tình trạng tự động.

Nút Tìm kiếm có chiều rộng gọn trên desktop, dành chỗ cho ô nhập; màn hình nhỏ xếp nút ở hàng riêng. Chuông chỉ có một huy hiệu chưa đọc, không chồng chấm đỏ; khách không có chuông. Hộp thông báo mở thành bảng bên phải, có vùng cuộn riêng, bộ lọc Tất cả/Chưa đọc, tải thêm, trạng thái rỗng/lỗi và thời gian; không thay quyền hay cách ghi nhận thông báo.

Trong giao dịch, khiếu nại hiển thị dạng thẻ có mã, lý do, trạng thái và giờ gửi. **Xem hồ sơ và phản hồi** mở dialog tách rõ nội dung, ảnh bằng chứng và phản hồi Admin. **Gửi khiếu nại mới** mở biểu mẫu riêng; quyền xem hồ sơ và chat giữ nguyên.

Trong **Bài của tôi**, chủ sách đang chờ duyệt không thấy phần AI. Sau quyết định, lý do Admin hiện trước **Kết quả AI tham khảo** dạng thu gọn; gửi duyệt lại ẩn AI và giữ quyết định cũ dưới lịch sử. Khi tải lại trạng thái/F5 sau quyết định, lấy kết quả phù hợp của lần hiện tại; dữ liệu cũ/không xác định không hiện như kết quả mới. Admin vẫn có AI, lịch sử, mã lỗi và nút yêu cầu/phân tích lại khi bài chờ duyệt. Chi tiết hợp đồng công bố: [ai-analysis.md](ai-analysis.md).

## Thông báo

- `GET /api/notifications?before=id`: session hiện hành, tối đa 30 mục, `{items,unread,nextBefore}`; `Cache-Control: no-store`.
- `POST /api/notifications/:id/read`, body `{}` và CSRF: chỉ chủ thông báo, gọi lại giữ thời điểm đọc đầu. Admin cũng không được đọc/đánh dấu hộ thông báo người khác.
- Nguồn: lịch sử tạo/gửi duyệt lại → Admin; KiemDuyet → chủ sách; KetQuaDauGia → chủ/người thắng; TinNhan → bên nhận; hai thời điểm xác nhận GiaoDich → bên còn lại; KhieuNai mới → Admin, đã phản hồi → người gửi.
- Chỉ lưu tiêu đề/nội dung ngắn cố định và ID đích. Không chép nội dung chat, ngưỡng giá, bằng chứng hoặc phản hồi riêng vào thông báo.

Hộp thư **được dựng khi tài khoản đọc thông báo**, từ các bản ghi nguồn bền vững đã COMMIT, bao gồm lịch sử đã có. Khóa ứng dụng SQL theo người nhận phối hợp hai lần đồng bộ; UNIQUE `(nguoi_dung_id,nguon)` chống nhân đôi. Việc đồng bộ và ghi thông báo nằm trong transaction riêng. Rollback nghiệp vụ không tạo bản ghi nguồn nên không có thông báo; lỗi đồng bộ không làm nghiệp vụ đã hoàn thành bị báo thất bại. Khi lỗi được khắc phục, lần đọc tiếp lấy lại nguồn còn lưu và bổ sung mục thiếu. Không thêm trigger, không đổi transaction đặt giá hay luồng SQL OUTPUT đang dùng.

Frontend lấy lại hộp mỗi 10 giây, khi focus và khi online; dùng cùng xác thực theo tab. Không cam kết thông báo xuất hiện tức thời; không dùng room đấu giá công khai để phát thông tin riêng. Tắt trang/mất mạng không mất lịch sử đã lưu. Chưa có push hệ điều hành, email, tùy chọn nhận tin, nhắc phiên sắp kết thúc hoặc theo dõi phiên. API đích tiếp tục kiểm tra quyền dù thông báo đã tồn tại.

Lưu ý vận hành: dựng hộp từ lịch sử là phương án cho quy mô hiện tại; không xóa nguồn nghiệp vụ trước khi hộp được đồng bộ. Với lượng sự kiện lớn cần đo tải, bổ sung watermark/outbox theo quyết định kiến trúc riêng. Chưa tự xóa/lưu trữ thông báo cũ.

## Kiểm chứng

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build
```

Khi API/worker/SQL/Redis đã chạy và migration thành công:

```powershell
npm.cmd run smoke:m8
```

Smoke M8 đã mở rộng kiểm tra tìm kiếm, thông báo của đúng người nhận, CSRF, đọc bền và gọi lại không nhân đôi. Chỉ tạo/dọn fixture của lần chạy; không xóa database hoặc volume. SQL opt-in `backend/test/communitySql.test.js` cũng kiểm tra inbox đồng thời và tìm kiếm, chỉ được bật với database kiểm thử `BookAuctionTest_*` theo điều kiện của test.

Kiểm tra thủ công: người bán gửi sách → Admin nhận thông báo/duyệt → chủ nhận quyết định → kích hoạt → người mua đặt giá → đối chiếu kết quả → nhắn tin/xác nhận → đánh giá → gửi và xử lý khiếu nại. F5/mất mạng rồi mở lại chuông, kiểm tra số chưa đọc và liên kết; kiểm tra tài khoản khác không đọc được hộp của mình.

Nghiệm thu SQL Server/Redis/Cloudinary thật chưa được thay bằng kiểm tra trình duyệt với model HTTP fixture. Xem VALIDATION.md để phân biệt bằng chứng đã chạy và phần cần chạy trên máy triển khai.

## Tài nguyên

Ảnh thư viện lấy từ mã thiết kế gốc: [Unsplash](https://images.unsplash.com/photo-1600181982553-ce7d36051c01), lưu tại `frontend/public/assets/library.jpg`, dùng trang trí trang chủ. Inter và Playfair Display có giấy phép OFL trong `frontend/public/assets/fonts`. Ảnh/video của sách và bằng chứng chỉ lấy từ media thật của bài đăng, không thay bằng ảnh thư viện hoặc ảnh sinh cho bản thiết kế.
