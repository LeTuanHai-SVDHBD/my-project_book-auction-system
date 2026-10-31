<!-- Mục đích: Ghi bằng chứng kiểm tra, phụ thuộc thật/giả và giới hạn nghiệm thu. -->

# Kết quả kiểm tra

Cập nhật ngày 31/10/2026. Kết quả trong môi trường chuẩn bị được phân biệt với xác nhận trên máy nhóm.
Không coi việc Admin duyệt thành công hoặc probe completed là bằng chứng toàn bộ nghiệp vụ đã đạt.

## Khung ảnh sách đồng nhất Admin/người dùng — 31/10/2026

- Chỉ sửa stylesheet tích hợp: khung thẻ 4:3 trên Trang chủ/Đấu giá/Kiểm duyệt; bỏ giới hạn 72%, padding trên ảnh, xoay và bóng đổ bị kế thừa từ thiết kế cũ. Ảnh canh giữa, giữ tỷ lệ/đầy đủ nội dung, nền trung tính; nhãn trạng thái có khoảng riêng. Các selector phủ cả quy tắc riêng của Home/catalog và breakpoint mobile. Không thay Backend, schema, URL hoặc tệp ảnh/video.
- `npm run build`: PASS (89 modules); `git diff --check`: PASS. Chromium production build với HTTP/session/router/model fixture: dùng một ảnh sách thật từ Cloudinary do người dùng cung cấp, ảnh dọc/vuông SVG mẫu và placeholder; kiểm tra khung 4:3, object-fit contain, transform none, box-shadow none, kích thước nằm trong khung cả khi hover. Trang chủ/Đấu giá/người bán xem chi tiết/Admin từ chối; **1440/1100/768/390/320px** không tràn ngang/lỗi JavaScript trong lượt đạt. Đã xem ảnh chụp thẻ desktop/mobile/Admin; chọn ảnh và chuyển sang video ở chi tiết vẫn hoạt động.
- Không thêm test unit cho thay đổi CSS này và không chạy lại toàn bộ test Backend/dịch vụ thật; kiểm tra trình duyệt dùng API/model fixture, không xác nhận lưu SQL/Redis. Ảnh thật được tải để QA rồi phục vụ cục bộ, không đổi hoặc upload lại Cloudinary.

## Danh sách kiểm duyệt gồm chờ và từ chối — 31/10/2026

- API Admin `/posts/pending` mặc định trả bài/phiên chờ và bài/phiên bị từ chối; lọc `status=all|pending|rejected`. SQL xếp nhóm chờ trước, ID giảm dần trong nhóm; cursor chứa nhóm/ID để không bỏ nhóm chờ khi có nhiều bài từ chối ID cao. Thẻ từ chối lấy lý do/ngày xử lý mới nhất từ KiemDuyet. Không thêm schema/dependency, không đổi lịch sử, quyền hoặc điều kiện duyệt/gửi lại/kích hoạt.
- `npm run check`: **143 tệp PASS**; `npm test`: **152 PASS, 12 SKIP**, tổng 164; `npm run build`: PASS (89 modules); `git diff --check`: PASS. Test parser/cursor và HTTP/session/Admin với 75 bài qua ba trang: chờ trước từ chối, không lặp/thiếu, loại bài đã duyệt, bộ lọc, chuyển về chờ và trả 400 cho cursor sai; khách 401/người dùng 403. Đã mở rộng SQL opt-in để kiểm tra chờ → từ chối (lý do/ngày) → gửi lại → phê duyệt và ranh giới cursor.
- Chromium production build với HTTP/session/CSRF/router/controller thật, model SQL fixture: **74 bài** qua ba trang và ranh giới nhóm, lọc trạng thái, giữ bộ lọc khi quay lại từ chi tiết, đọc lý do/ngày từ chối, không có form duyệt lại bài đã từ chối. POST kiểm duyệt thật tới service fixture: từ chối còn trong danh sách; gửi lại về chờ; phê duyệt rời danh sách và ở trạng thái chờ đặt lịch. Khi hết bài chờ, Tất cả vẫn hiện từ chối. **1440/768/390/320px** không tràn ngang hoặc lỗi JavaScript; xem ảnh desktop/mobile.
- **Chưa chạy truy vấn/SQL opt-in trên SQL Server thật cho bản sửa này**; 12 kiểm thử dịch vụ thật vẫn SKIP. Fixture kiểm tra HTTP/giao diện không thay thế nghiệm thu dữ liệu SQL thực tế. Cập nhật API và frontend cùng bản, Ctrl+F5 sau pull để dùng cursor mới; không cần migration.

## AI_TIMEOUT với bài nhiều media — 31/10/2026

- Thay tải tuần tự bằng tối đa bốn tải media song song theo lô, deadline chuẩn bị riêng 45 giây, giữ thứ tự/mã bằng chứng và ngân sách 12 MiB. Dừng tải lô mới khi hết ngân sách/thời gian; không coi media chưa gửi là đã quan sát. Không đổi model, hash đầu vào, tiêu chí/hai điểm, schema hoặc dependency.
- Timeout Gemini cơ sở + 4 giây/media thực gửi, trần mặc định 300 giây/lượt; cấu hình 60 giây cũ gửi 32 ảnh có 188 giây/lượt. Body response cũng chịu timeout/hủy. Tối đa hai lượt với lỗi tạm thời, dùng lại payload; lỗi quota/key/quyền/DNS cố định/TLS không retry. Đặt thinking_level=low, giữ output 8192. `ai:check` tiếp tục đúng một lượt gọi văn bản; `smoke:ai` chờ theo deadline worker.
- Lease AI 60 giây được gia hạn mỗi 15 giây suốt tác vụ; mất lease/worker dừng hủy provider, để pending, không lưu điểm thất bại giả. Cache/receipt/version guard SQL giữ nguyên. Lỗi provider cuối vẫn lưu hai điểm NULL và metadata thời gian/media an toàn; không lưu raw body/secret.
- `npm run check`: **142 tệp PASS**; `npm test`: **150 PASS, 12 SKIP**, tổng 162; `npm run build`: PASS (89 modules). Test mới dùng HTTP/stream fixture, gồm **32 ảnh mẫu tổng 8 MiB**, bốn tải đồng thời, đúng ID/thứ tự, giữ nguyên payload khi 503 rồi thành công, không tải tiếp sau hết ngân sách, ngắt tải chậm, response body bị treo/quá lớn được hủy, timeout cuối, quota/key/mạng, gia hạn/mất lease và NULL. Sau khi mở rộng kiểm tra setup bảo toàn key/timeout cũ và bổ sung biến mới, chạy lại test setup PASS; `git diff --check` PASS.
- Chromium production build, HTTP/session/CSRF/router/service AI thật, model/queue/provider fixture: Admin thấy 4/32 media → chờ lượt 1/2 với 188 giây → thử lượt 2/2; kết quả cũ có nhãn rõ. Khi done, nút phân tích lại bật; POST CSRF thật trả 202 và enqueue một lần. Chủ bài pending không có panel hoặc request AI. Xem ảnh desktop/mobile; **1440/768/390/320px** không tràn ngang hoặc lỗi JavaScript trong lượt đạt.
- **Chưa gọi Gemini thật, tải bộ ảnh Cloudinary thật hoặc chạy SQL Server/Redis thật cho bản sửa này**; 12 test dịch vụ thật vẫn SKIP. Fixture 32 ảnh không xác nhận chất lượng thẩm định sách thật. Không cam kết loại bỏ mọi outage/quota/mạng Google. Máy nhóm cần pull, `npm.cmd run setup:ai`, khởi động lại API/worker, rồi Admin chọn **Phân tích lại bằng AI** ở bài đang chờ: lỗi SQL đã lưu thuộc lượt cũ và không tự đổi thành kết quả mới. Hướng dẫn đầy đủ: [Phân tích AI](docs/ai-analysis.md).

## Ô ISBN không ép 10 hoặc 13 ký tự — 31/10/2026

- Bỏ pattern 10/13 và giới hạn 13 ở biểu mẫu/validator; dùng ngưỡng kỹ thuật chung **100 ký tự**. Giữ mã, dấu phân cách, Unicode, chữ hoa/thường và số 0 đầu; Backend chỉ trim hai đầu. Có ISBN vẫn bắt buộc nhập; Không có ISBN gửi NULL. Không tự xác minh chuẩn/checksum hoặc sửa ISBN của sách đã lưu.
- Migration 006 đổi cột `Sach.isbn` thành `NVARCHAR(100)`, bỏ check định dạng, giữ check không rỗng và chỉ mục tìm kiếm; không thêm bảng/cột. Migration chạy trong transaction, không cắt dữ liệu, chạy lại được; schema vẫn 21 bảng/162 cột, còn 98 check. Các script init/migrate và test SQL dùng bản nâng cấp mới.
- `npm run check`: **139 tệp PASS**; `npm test`: **140 PASS, 12 SKIP**, tổng 152; `npm run build`: PASS (88 modules); `git diff --check`: PASS. Test validator/HTTP/session/CSRF kiểm tra chuỗi dài, có dấu phân cách/Unicode/0 đầu, 100/101 ký tự, kiểu dữ liệu sai, control character, NULL và chặn đầu vào lỗi trước ghi.
- Chromium production build với HTTP/session/CSRF/router/validator thật, model SQL fixture: nhập mã dài hơn 13, dấu phân cách/Unicode, 100 ký tự; ký tự thứ 101 khi gõ bị chặn; đổi Có/Không có rồi đổi lại giữ draft, dữ liệu cuối gửi đúng nguyên chuỗi hoặc NULL. Bước xem lại không tràn ở **1440/768/390/320px**, không lỗi JavaScript trong lượt đạt.
- **Chưa chạy migration 006 trên SQL Server thật** tại môi trường này. Test `REVIEW_TEST_SQL` đã mở rộng kiểm tra giữ mã ISBN cũ qua migration chạy hai lần, lưu/đọc mã Unicode dài và đưa đúng mã vào bản kết quả; các test dịch vụ thật vẫn SKIP. Máy nhóm cần chạy `npm.cmd run db:migrate` sau pull rồi khởi động lại dev:all.

## Xuất kết quả kiểm duyệt cho người bán — 30/10/2026

- Thêm bản in A4 riêng sau phê duyệt/từ chối, dùng hộp thoại **Lưu dưới dạng PDF** của trình duyệt; không phải endpoint trả PDF nhị phân. Nội dung Backend đã lưu, hai điểm/NULL/bằng chứng/cảnh báo/phép tính, danh sách ảnh/video là link Cloudinary, không nhúng media hoặc gọi lại AI. Cập nhật tài liệu tại [docs/review-exports.md](docs/review-exports.md).
- Migration 005 thêm một cột JSON nullable và check trong KiemDuyet; schema **21 bảng/162 cột**. Ghi cùng transaction quyết định; giữ đúng lần khi gửi duyệt lại. Bản cũ chỉ dựng lần hiện tại còn phù hợp; không gán media mới vào lịch sử chưa có bản kết quả. Không thêm bảng, dependency hoặc đổi cấu hình cá nhân.
- `npm run check`: **138 tệp PASS**; `npm test`: **138 PASS, 12 SKIP**, tổng 150; `npm run build`: PASS (87 modules). Sau điều chỉnh bố cục in, chạy lại 10 test xuất kết quả/rowversion: PASS; build lại PASS; `git diff --check`: PASS. HTTP/session/CSRF thật, model SQL fixture kiểm tra chủ sở hữu, vai trò, ID bài/quyết định, no-store, rollback cả quyết định/cặp trạng thái khi lưu bản kết quả lỗi, NULL và bản cũ không bị dữ liệu mới ghi đè.
- Chromium production build với HTTP/session/CSRF/router thật, model/AI fixture: nút ở kết quả phê duyệt/từ chối, lịch sử đã lưu trong vòng đang chờ, ẩn khi chưa có quyết định, cảnh báo dữ liệu cũ, popup bị chặn không gọi API, lỗi API đóng cửa sổ đang tải, Admin không có nút người bán. Desktop/mobile **1440/1100/768/390/320px** không tràn ngang hoặc lỗi JavaScript trong lượt đạt. Lệnh print được theo dõi bằng stub trong trình duyệt headless, không coi đó là tương tác với hộp thoại in Windows thật.
- PDF thực sự được Chromium tạo từ chính bản in: mẫu 32 ảnh + một video, phê duyệt/lịch sử **7 trang, 46 link bấm được** (37 Cloudinary gồm manifest); từ chối + AI thất bại **4 trang, 33 link Cloudinary**. Poppler render và xem trang; pypdf kiểm tra dấu tiếng Việt, đủ ảnh 32/video 01, bỏ `.00`, NULL, không có toolbar/giá riêng/chẩn đoán hoặc media nhúng. Không có chữ chồng hoặc trang chỉ chứa footer trong bản đạt.
- **Chưa chạy migration 005 hoặc test SQL Server/Redis/Cloudinary/Gemini thật trong môi trường này**. Test `REVIEW_TEST_SQL` opt-in đã bổ sung; `smoke:m4` có thêm kiểm tra xuất đúng lần/quyền/CSRF nhưng chưa chạy lại. Máy nhóm cần migration trước `dev:all`, sau đó nghiệm thu nút/lưu PDF và liên kết media thật.

## Bố cục kiểm duyệt, chi tiết sách và định dạng điểm — 30/10/2026

- Chỉ sửa frontend và tài liệu. Danh sách Admin dùng lưới thẻ toàn chiều rộng, giữ mã bài, trạng thái, mở chi tiết/quay lại và cursor tải thêm. Bỏ cột hàng đợi/khung chọn hồ sơ; giữ nguyên API/quyền/SQL và thao tác quyết định.
- Ảnh/video và thông tin chính/giá nằm hai cột cân nhau; mô tả dài dùng toàn chiều rộng bên dưới. Bộ 32 ảnh không xếp thành nhiều hàng thu nhỏ; cuộn ngang bằng nút, touch hoặc bàn phím và vẫn chọn đầy đủ media. Điểm nguyên bỏ `.00`, phần lẻ có giá trị vẫn giữ, không chuyển NULL thành 0.
- `npm run build`: PASS (85 modules); `git diff --check`: PASS. Chromium production build với HTTP/session/CSRF/router thật, model/AI response fixture: sáu thẻ ban đầu, mở bài/quay lại, rỗng và cursor 30 → 36 bài; `100 / 100`, `75.5 / 100`, `76.39 / 100`, phép tính và NULL. Chọn được cả 32 ảnh và video trong cùng hàng; đo hai cột bằng nhau, mô tả không còn bị giới hạn trong cột trái.
- Kiểm tra và xem ảnh desktop/mobile; các chiều rộng **1440/1100/768/390/320px** không tràn ngang hoặc lỗi JavaScript trong các luồng trên. Trạng thái người bán chờ duyệt vẫn ẩn AI; nút đặt lịch của bài đã duyệt vẫn hiện. Không chạy lại smoke SQL/Redis/Gemini thật cho thay đổi trình bày này; không thêm dependency/migration hoặc sửa xử lý AI.

## Công bố kết quả AI cho người bán sau kiểm duyệt — 30/10/2026

- Người bán chờ duyệt chỉ thấy tiến độ; không mount/gọi panel AI. Sau quyết định, kết quả/lý do Admin hiện trước **Kết quả AI tham khảo** thu gọn. Gửi duyệt lại ẩn AI, quyết định cũ nằm trong lịch sử. Admin giữ chẩn đoán/lịch sử và nút yêu cầu/phân tích lại khi bài còn chờ duyệt.
- Chi tiết bài riêng và API AI đều lọc kết quả cho người bán: hash nguồn phải phù hợp, thời điểm phân tích nằm sau quyết định trước và không muộn hơn quyết định hiện tại. Không đủ thông tin thì không gán kết quả cũ vào lần mới. Người bán không nhận job/lịch sử AI hoặc mã lỗi provider; thất bại hiện thông báo dễ hiểu. Giữ hai điểm, dữ liệu lịch sử, schema, timeout và ngân sách media hiện có.
- `npm run check`: **135 tệp PASS**; `npm test`: **132 PASS, 11 SKIP**, tổng 143 bài; `npm run build`: PASS. Test model dùng SQL fixture, HTTP/session/CSRF thật: quyền xem, trạng thái pending/quyết định/gửi lại, lịch sử theo vai trò, 404 với ID chưa công bố và mốc thời gian dạng SQL Date có mili giây.
- Chromium production build với HTTP/session/CSRF/router/service thật, model/job fixture: pending không gọi AI; từ chối có lỗi thân thiện; phê duyệt hiển thị hai điểm; gửi lại ẩn AI; lần duyệt mới không nhận kết quả vòng trước. Admin xem mã lỗi/lịch sử, phân tích lại từ màn hình lịch sử quay về mới nhất và chờ job; duyệt thủ công vẫn hoạt động. Đã xem ảnh desktop/mobile, kiểm tra **1440/768/390/320px**, không tràn ngang hoặc lỗi JavaScript trong các luồng trên.
- Đã sửa `smoke:ai` theo chính sách mới: trước quyết định chủ bài không thấy AI; Admin từ chối fixture thiếu ảnh, sau đó chủ bài thấy cùng kết quả. Bổ sung cleanup quyết định/thông báo riêng của fixture. **Chưa chạy smoke với SQL/Redis/Gemini thật** trong môi trường này. Bản này không xác nhận đã xử lý lỗi timeout của bài 32 ảnh.

## Gộp mô tả tình trạng và bằng chứng — 30/10/2026

- Bỏ ô nhập riêng `tinh_trang_sach`; đăng mới/gửi duyệt lại dùng một ô bắt buộc **Tình trạng, yếu tố quý hiếm và bằng chứng** (12.000 ký tự). Giữ riêng **Giới thiệu sách**. Backend nhận được bài mới không có trường tình trạng cũ, giữ toàn văn và tự tạo bản xem trước tối đa 1.000 ký tự để đáp ứng cột SQL hiện có; không migration hoặc sửa dữ liệu lịch sử.
- Prompt Gemini và màn hình chi tiết không lặp bản xem trước trong mô tả. Thông tin tình trạng cũ khác biệt vẫn hiện với nhãn đã lưu trước đây; giữ hash các trường nguồn để phân tích cũ vẫn đối chiếu được. Không đổi tiêu chí, trọng số hoặc hai điểm độc lập.
- `npm run check`: **132 tệp PASS**; `npm test`: **128 PASS, 11 SKIP**, tổng 139 bài; `npm run build`: PASS. Test API/session/CSRF nhận bài không có `sach.tinh_trang_sach`; kiểm tra văn bản dài, dữ liệu thiếu/quá dài, tương thích client cũ, prompt Gemini qua HTTP stub và provenance.
- Chromium production build, HTTP/session/CSRF/validator thật với model fixture: mô tả trống chặn bước tiếp theo; một mô tả dài hơn 1.000 ký tự gửi đủ và hiển thị một lần; biểu mẫu không gửi trường cũ. Gửi duyệt lại bài bị từ chối bằng một ô, giữ tình trạng sách đã lưu; chi tiết giữ cả bằng chứng cũ khác biệt. Đã xem ảnh desktop/mobile; các chiều rộng **1440/768/390/320px** không tràn ngang và không lỗi JavaScript trong luồng kiểm tra.
- Không gọi Gemini thật hoặc chạy lại SQL Server/Redis/Cloudinary thật cho bản này. Các bài cần dịch vụ thật vẫn SKIP; kiểm tra model fixture không thay thế nghiệm thu lưu SQL trên máy nhóm.

## Đồng bộ thể loại và sửa trải nghiệm biểu mẫu — 30/10/2026

- Trang chủ dùng đúng bốn nhóm trong `shared/bookGenres.js`; bộ lọc công khai nhận `group` đã kiểm tra danh mục và mở rộng thành các tham số SQL cho thể loại con. Thêm bài kiểm tra nhóm hợp lệ/không hợp lệ; bài SQL tìm theo nhóm đã thêm vào bộ opt-in, chưa chạy với SQL Server thật.
- Bỏ giới hạn số ảnh của bài đăng ở cấu hình, validator và model; giữ giới hạn dung lượng, số video và chính sách upload. Test 100 tham chiếu ảnh hợp lệ, ba video được chấp nhận và video thứ tư bị từ chối, kể cả video giữ lại. Biến cũ `MEDIA_MAX_IMAGES` không còn áp dụng. ISBN không có được gửi `null`, không sửa schema.
- `npm run check`: **130 tệp PASS**; `npm test`: **124 PASS, 11 SKIP**, tổng 135 bài, không lỗi; `npm run build`: PASS. Không thêm dependency hoặc migration.
- Chromium production build với HTTP/session/CSRF, route upload và kiểm tra MIME thật; model, vé media và provider dùng fixture: tải 13 ảnh PNG, bấm × xóa đúng vé rồi thay ảnh; tệp đã bỏ không có trong bài gửi. Chọn bốn WebM chỉ tải được ba; gửi bài có 13 ảnh/3 video và ISBN `null` qua validator API. Chọn có ISBN sai bị chặn, chuyển không có ISBN tiếp tục được.
- Kiểm tra bốn nhóm thể loại/gọi bộ lọc, ô tìm kiếm người dùng và Admin, một huy hiệu 13 thông báo, drawer lọc/chuyển trang đích và đánh dấu đọc. Kiểm tra thẻ khiếu nại, hộp chi tiết có phản hồi Admin, bằng chứng trống và gửi khiếu nại mới.
- Đã xem ảnh desktop/mobile và kiểm tra các chiều rộng **1440/1100/768/390/320px**; không tràn ngang hoặc lỗi JavaScript trong các luồng trên. Không coi fixture là nghiệm thu SQL/Redis/Cloudinary thật; các bài cần dịch vụ thật vẫn SKIP và cần kiểm tra trên môi trường nhóm.

## Sửa đăng nhập CSRF và header khách — 29/10/2026

- Đã tái hiện trên Chromium: web `localhost:4173`, cấu hình API `127.0.0.1:5000` → GET CSRF 200 nhưng cookie không được giữ, POST login 403/INVALID_CSRF.
- Dùng hostname loopback nhất quán cho HTTP/Socket, không đổi kiểm tra CSRF hoặc chính sách cookie phía Backend.
- Chromium production build, HTTP/session/CSRF thật với MemoryStore/model tài khoản fixture: trên cả localhost và 127.0.0.1, chủ động xóa phiên khách khỏi store → POST đầu bị từ chối CSRF → lấy token mới → lần thứ hai đăng nhập thành công. F5 giữ tài khoản; logout gỡ avatar/chuông; Cookie vẫn HttpOnly/SameSite=Lax.
- Kiểm tra lỗi CSRF liên tục chỉ gửi tối đa hai POST, lỗi mạng/sai mật khẩu không tự retry; Admin vẫn có chuông/tài khoản trong sidebar, không có header ngang. Khách desktop/mobile không có avatar hoặc chuông.
- `npm run check`: 130 tệp; `npm test`: **122 PASS, 11 SKIP**; `npm run build`: PASS. Thêm test chuẩn hóa URL API. Chưa chạy lại SQL/Redis thật cho bản này; Backend, migration và nghiệp vụ không đổi.

## Tích hợp giao diện BookBid, tìm kiếm và thông báo — 29/10/2026

- Giao diện nguồn: `frontend-book` commit `83add5905dc2b0ed1da23c46af7b1367d260c94d`; áp dụng vào frontend chính, dùng API thật, giữ cơ chế xác thực/đặt giá/media hiện có. Không thêm dependency hoặc đổi lockfile/phiên bản.
- `npm run check`: kiểm tra cú pháp 129 tệp JavaScript máy chủ/dùng chung.
- `npm test`: **121 PASS, 11 SKIP** (SQL/Redis opt-in), tổng 132 test. Có kiểm tra mới cho hợp đồng tìm kiếm, giới hạn đầu vào/wildcard, projection công khai, hộp thông báo riêng, quyền Admin/khách, CSRF và đọc lại.
- `npm run build`: PASS production build React/Vite.
- Chromium trên production build với HTTP/session/CSRF/Socket và model fixture: tìm kiếm và trạng thái rỗng; form bốn bước gửi API; gallery/video thật theo URL API; 202 và quyết định chấp nhận; chủ sách không có ô đặt giá; hai xác nhận và đánh giá chỉ phía người mua; thông báo đánh dấu đọc/mở đúng giao dịch; Admin không có header ngang/lời mời đăng sách; sidebar mobile/thông báo. Ma trận desktop 1440px và responsive 1100/768/390/320px.
- Chưa chạy migration 004, truy vấn tìm kiếm và đồng bộ hộp thông báo trên **SQL Server thật** trong môi trường chuẩn bị; chưa chạy SQL/Redis/provider thật hoặc nghiệm thu Windows/UniKey lại cho lần tích hợp này. Không coi model fixture là bằng chứng transaction SQL. Sau migration trên máy nhóm, chạy `npm.cmd run smoke:m8` (đã bổ sung tìm kiếm/thông báo) và nghiệm thu ảnh/video Cloudinary.
- Migration chỉ thêm bảng `ThongBao`/index, không thêm trigger và không sửa transaction nghiệp vụ; hộp được đồng bộ từ lịch sử SQL đã COMMIT khi người nhận đọc, lặp 10 giây/focus/online. Chi tiết, giới hạn và cách nâng cấp: [docs/ui-integration.md](docs/ui-integration.md).

## Thu hồi session cũ và nhập tiền không đổi định dạng

Bản sửa theo phản hồi của Hải: chính sách F5 lấy lại quyền của lượt trước đã bị bỏ. Chỉ login bằng mật khẩu mới đổi phiên.

- Redis/HTTP/Socket thật qua hai API: **126 PASS, 3 SKIP SQL**; session cũ thực sự bị DEL khỏi RedisStore khi login mới.
  Cookie cũ, GET me, gửi giá, POST control nhận 401; F5 đổi mã tài liệu không thu hồi phiên hợp lệ của tab mới.
  Sai mật khẩu không thay owner; login đúng mới thay phiên. Logout cũ không xóa owner mới; mất key buộc login lại.
  Kiểm tra heartbeat khi không nhận Pub/Sub và thông báo đến trễ không ngắt nhầm phiên hiện tại.
- Chromium với HTTP/session/Redis/Socket thật, SQL/provider giả: tab mới login thì tab cũ tự về biểu mẫu đăng nhập,
  không còn profile/logout hoặc lớp phủ. F5 xen kẽ hai tab ba vòng không hồi sinh tab cũ hoặc làm tab mới mất phiên.
  Nhập mật khẩu/login lại ở tab cũ mới thu hồi tab mới; thử thêm cookie context riêng và nối lại mạng.
- Đã tái hiện lặp giá trị khi input đổi mask lúc focus trong QA. Bỏ hẳn mask trong ô nhập, chỉ nhóm nghìn ở dòng Giá trị.
  Cả ba ô đã gõ từng phím số 0 liên tục, sửa đầu/giữa, xóa, fill/dán lẫn chữ, 18 chữ số và chặn số thứ 19.
  Mô phỏng compositionstart/input/compositionend không nhóm nghìn trong ô; hidden và payload HTTP vẫn đúng.
- Giao diện desktop/mobile 390 px được kiểm tra cùng luồng thể loại và đánh giá; không page error trong lượt đạt.
  Chưa chạy bàn phím Windows/UniKey thật hoặc SQL Server/Cloudinary thật ở lượt sửa này.

## Bằng chứng bản a1cbd7f trước khi sửa chính sách phiên

Các kết quả bên dưới ghi lại lượt cũ. Chính sách F5 lấy lại quyền, lớp phủ giữ đăng nhập và định dạng tiền trong ô
đã được thay thế bằng hành vi thu hồi session/nhập số thuần ở mục trên.



- Đã xem video LoiNhapSo.mp4: chữ số đầu bị lặp khi gõ liên tục. Bỏ ghi trực tiếp DOM value trong onChange,
  chỉ để React cập nhật và phục hồi con trỏ sau render; giữ nguyên hợp đồng tiền chuỗi 18 chữ số.
- Đã đọc đầy đủ TheLoaiSach.docx, đưa nhóm văn học/phi hư cấu/độc giả vào danh mục, bổ sung sách cổ/tư liệu.
  Tìm có/không dấu; chuột hoặc mũi tên/Enter để chọn, chữ tìm kiếm không trở thành thể loại tự do.
  API bài mới chỉ nhận danh mục hoặc trống; dữ liệu sách cũ/đăng lại không bị sửa.
- Kiểm tra mặc định **118 PASS, 11 SKIP**; Redis thật **126 PASS, 3 SKIP SQL**, không lỗi.
  Check **124 tệp PASS**, build Frontend PASS (72 modules). Kiểm thử cũ không gắn control vẫn kiểm tra
  cookie riêng; bài accountControl mới gắn đúng service sản xuất để kiểm tra chính sách một chủ.
- Bài accountControl chạy hai HTTP API/Socket.IO dùng chung Redis/RedisStore/Lua thật, tài khoản/model đấu giá giả:
  login chủ mới ngắt chủ cũ, HTTP cũ không enqueue, CSRF sai bị chặn, không nhận user ID trong claim,
  reconnect cũ bị từ chối, F5 với cookie hợp lệ lấy lại quyền, logout cũ không xóa chủ mới, giả cookie/selector bị chặn.
  Bỏ đăng ký Pub/Sub ở một API vẫn ngắt qua heartbeat; mất khóa Redis chặn cho tới reclaim tường minh.
- Chromium/React/Express/Redis/Socket thật, SQL và Cloudinary fixture: hai tài khoản khác nhau không bị ảnh hưởng,
  cùng tài khoản ở hai tab và hai cookie context đổi chủ đúng; tab cũ có nền mờ/inert và thông báo yêu cầu F5.
  F5 lấy lại, cửa sổ nối mạng lại không tự lấy quyền. Không có page error trong lượt kiểm tra đạt.
- Ba ô tiền được gõ từng phím với số 0 liên tục, thêm ở đầu/giữa, Backspace sát dấu phân cách, dán lẫn chữ,
  18 chữ số và từ chối chữ số thứ 19; giá trị hidden/gửi API đúng, không nhân đôi chữ số đầu.
- Người bán không có mục đánh giá; người mua vẫn đánh giá sau đủ hai xác nhận. Thể loại tìm không dấu,
  chọn bằng chuột/bàn phím, mở lại danh sách đầy đủ và chặn chữ tự nhập; gửi được lựa chọn qua validator HTTP thật.
- Đã xem ảnh desktop/mobile 390 px, không tràn ngang. Chưa nghiệm thu trên Windows/UniKey của Hải,
  SQL Server thật và Cloudinary thật không được kiểm tra lại trong bản sửa này. Không thêm schema/dependency hoặc đổi Gemini.

## Giao dịch và tương tác sau đấu giá

Chẩn đoán smoke readiness được bổ sung sau khi Hải báo dừng trước luồng nghiệp vụ:
ba test riêng đạt; bộ test mặc định **116 PASS, 10 SKIP**, check **118 tệp PASS**. Chẩn đoán phân biệt
API không kết nối/timeout, HTTP sai/JSON sai và trạng thái SQL/Redis/worker;
không phản chiếu credentials/body lỗi. Script tách giai đoạn kết nối SQL/Redis, không đổi tiêu chí readiness hoặc tự bỏ qua lỗi.
CLI smoke:m8 với API không chạy dừng đúng exit 1 và hướng dẫn giữ dev:all, trước khi tạo fixture.
Kết quả từ máy Hải chưa đủ xác định dependency cụ thể. Chi tiết nghiệm thu chức năng bên dưới giữ nguyên phạm vi thật/giả.

Kiểm tra ngày 24/10/2026 trên mã giữ Gemini; không áp dụng thay đổi Groq đã hủy:

- `check`: **116 tệp PASS**; build Frontend PASS, 67 modules.
- Mặc định `npm test`: **113 PASS, 10 SKIP**, không có lỗi.
- Bật Redis 7.0.15 thật: **120 PASS, 3 SKIP** dành cho SQL; không xóa database hoặc FLUSH Redis.
- `test:community`: **12 PASS, 1 SKIP SQL**. Policy/HTTP/session/CSRF và service media chạy thật;
  SQL ở HTTP dùng fixture giả, không chứng minh transaction/khóa SQL Server đã đạt.
- Trình duyệt Chromium bốn tab người mua/người bán/người ngoài/Admin, React/Express/session Redis/vé media thật:
  chat riêng, cờ đọc phía người nhận, chuỗi tiền 18 chữ số, xác nhận từng bên rồi đánh giá 5 sao,
  công khai uy tín; người ngoài không thấy giao dịch; HTML trong tin nhắn hiển thị text, không thực thi.
- Khiếu nại upload ảnh qua API/vé Redis, claim/bind và phản hồi tự cập nhật; SQL/provider Cloudinary giả.
  Admin chưa tiếp nhận bị chặn chat, đang xử lý được đọc, xử lý xong mất quyền chat; người dùng không thấy nút Admin.
- Bình luận đang diễn ra được ghi, sau kết thúc khóa ô nhập và giữ lịch sử. Desktop và mobile 390 px
  không tràn ngang, không page error hoặc cảnh báo key React trong luồng đã chạy; đã xem ảnh giao diện.
- Đã thêm `COMMUNITY_TEST_SQL=true` trên database riêng `BookAuctionTest_*` để kiểm tra model SQL thật:
  phòng tạo cùng kết quả, xác nhận/đánh giá đồng thời, rollback bằng chứng, tranh tiếp nhận và biên bình luận.
  **Chưa chạy bài SQL này** vì môi trường hiện tại không có SQL Server.
- Đã thêm `smoke:m8` gồm smoke:m5 và luồng sau phiên; **chưa chạy với dịch vụ thật**.
  Smoke không kiểm tra Cloudinary/bằng chứng ảnh thật; cần nghiệm thu riêng theo [hướng dẫn](docs/after-sales.md).

Không thêm dependency/migration, giữ 20 bảng/152 cột và cơ chế xác thực. Không có thanh toán/vận chuyển tự động,
đính kèm ảnh vào chat hoặc receipt cho mọi POST. API hạn chế hồ sơ; URL delivery Cloudinary hiện tại chưa được bảo vệ riêng tại CDN.

## Xác nhận tích hợp AI từ máy nhóm

Hải xác nhận `smoke:ai` **PASS** sau chẩn đoán Gemini. Đây là kết quả do người dùng cung cấp,
phân biệt với các lượt chạy trong môi trường chuẩn bị bên dưới. Kiểm tra sách có ảnh/video thật,
đối chiếu bằng chứng và hai điểm được Hải chủ động để lại sau khi tìm được dữ liệu.
Không coi lượt mẫu thiếu ảnh, hai điểm NULL là chứng minh chất lượng thẩm định media.

## Chẩn đoán lỗi Gemini

Kiểm tra ngày 24/10/2026, giữ nguyên Gemini và không áp dụng thay đổi Groq đã hủy:

- Mặc định **101 PASS, 9 SKIP**; bật Redis thật **108 PASS, 2 SKIP** dành cho SQL.
- `test:ai`: **20 PASS, 2 SKIP** mặc định; `check`: **104 tệp PASS**; build PASS.
- HTTP giả kiểm tra 400/401/402/403/404/429/503, API_KEY_INVALID trong lỗi Google kiểu cũ,
  DNS/TLS code, timeout, JSON sai; không lưu body/message phản chiếu khóa hoặc dữ liệu sách vào metadata.
- `ai:check` dùng đúng client/request với một mẫu không ảnh, không cần SQL/Redis; stub kiểm tra một lần gọi,
  mã thoát PASS/FAIL, HTTP/provider code và thông báo đã che khóa. CLI thật không cấu hình dừng đúng
  `AI_NOT_CONFIGURED`, chưa truy cập provider. Import script kiểm thử không tự gọi mạng.
- Pipeline lưu chẩn đoán allowlist, hai điểm vẫn NULL khi thất bại. Smoke và UI hiện mã chi tiết/hướng kiểm tra.
- Chromium/HTTP/session/Redis/queue/consumer/processor/React thật, Gemini và SQL giả: điểm/historic/NULL vẫn đúng,
  lỗi quota hiện `AI_QUOTA_EXCEEDED · HTTP 429`, AI tắt vẫn duyệt thủ công; desktop/mobile không pageerror/tràn ngang.

Chưa xác định nguyên nhân thực tế của log `AI_PROVIDER_ERROR` trên máy nhóm vì phiên bản cũ đã bỏ chi tiết.
Chưa gọi API key Gemini thật hoặc chạy smoke SQL thật trong bản sửa. Cần kết quả `ai:check` trên máy nhóm
để phân biệt key/quyền/model/payload/quota/mạng; không coi stub PASS là Gemini thật đã hoạt động.

## Phân tích AI và bộ chấm điểm

Kiểm tra ngày 24/10/2026:

- `ai:example`: PASS, đầu vào JSON mẫu cho độ hiếm 100 và tình trạng 76,39; audit `6875 / 90`.
- Full test mặc định: **97 PASS, 9 SKIP** theo opt-in. Bật Redis thật: **104 PASS, 2 SKIP** dành cho SQL.
- `test:ai`: **16 PASS, 2 SKIP** mặc định (Redis/SQL). `check`: **101 tệp PASS**; `build`: PASS.
- Bộ quy tắc: tổng trọng số từng nhóm 100, hai điểm độc lập, quy đổi 100/75/50/25/0,
  chọn hư hại nặng nhất, NULL khi thiếu, N/A có căn cứ loại mẫu số và làm tròn chính xác.
- Gemini REST được giả lập: JSON Schema/Interactions, không gửi giá/tài khoản/ngưỡng, `store:false`,
  chặn media ngoài Cloudinary dự án, thiếu/vượt media có cảnh báo, quota/phản hồi hỏng/chưa hoàn tất bị chặn.
- Pipeline với SQL giả: replay receipt không gọi lại/ghi thêm, SQL lỗi dùng cache kết quả,
  source version cũ không lưu, tự động không lặp cùng version, Admin vẫn yêu cầu phân tích lại được.
- HTTP/session thật: chủ bài/Admin được xem, người khác không được xem; POST chỉ Admin + CSRF + version,
  chặn điểm tự chèn và lần phân tích của bài khác; Redis lỗi vẫn đọc SQL, tắt AI không tạo phân tích giả.
- Redis thật: admission đồng thời chỉ một job/version, xử lý lỗi giữ pending, reclaim/ACK và job version mới.
- Chromium desktop 1440 px/mobile 390 px, Redis/HTTP/session/queue/consumer/processor/React thật:
  tự phân tích sau enqueue; Admin/chủ bài cùng thấy 100/76,39 và phép tính; thiếu trang giữ riêng tình trạng NULL;
  chọn lại lịch sử; quota lỗi hai điểm NULL; tắt AI vẫn phê duyệt thủ công. Không pageerror hoặc tràn ngang;
  ảnh QA đã được xem. Gemini và SQL được giả lập trong kiểm tra trình duyệt.
- `setup:ai` được kiểm tra trong thư mục tạm: giữ cấu hình/khóa đã có, chạy lại không nhân đôi và không in khóa.

**Chưa gọi Gemini thật, chưa chạy SQL AI opt-in hoặc `smoke:ai` với SQL Server thật.**
Lệnh smoke đã thử dừng ở kiểm tra cấu hình do môi trường chưa có DB_PASSWORD, chưa truy cập dịch vụ.
Cần API key/quota của nhóm và môi trường SQL/Redis/API/worker thật để nghiệm thu.
Test SQL opt-in đã thêm rollback trước COMMIT, lưu điểm/chi tiết, replay và version cũ;
`smoke:ai` đã thêm cho một lượt provider thật với dữ liệu không ảnh, không thay nghiệm thu chất lượng ảnh/video.
Không coi provider/SQL giả là bằng chứng COMMIT SQL hoặc tính chính xác thẩm định sách thật.
Giữ nguyên 20 bảng/152 cột, lockfile/dependency, volume và xác thực theo tab.
Xem [Phân tích AI](docs/ai-analysis.md) để bật Gemini, kiểm tra quota và đối chiếu tiêu chí.

## Đồng bộ thời gian thực

Kiểm tra ngày 24/10/2026:

- Test mặc định: **81 PASS, 7 SKIP** theo opt-in; bật Redis thật: **87 PASS, 1 SKIP** (test SQL Server riêng).
- `check`: **79 tệp PASS**. `build`: PASS. Import bộ smoke dùng chung không tự khởi động hoặc truy cập SQL.
- HTTP/Socket thật và model giả: chỉ thông báo sau khi model COMMIT, không thông báo khi SQL lỗi;
  publish lỗi sau COMMIT được retry mà không ghi lại lượt; chặn room chưa công bố, ID/room tự chèn và sự kiện giả.
- Redis thật: hai subscriber cùng nhận ID phiên; payload có trường riêng bị bỏ qua.
  Lỗi publish sau COMMIT giữ thông điệp pending; reclaim phát lại, ACK thành công và chỉ một lần ghi trong model giả.
- Chromium hai tiến trình trình duyệt độc lập, session Redis/HTTP/Socket/React thật: đang chờ không báo chấp nhận;
  từ chối không tạo lịch sử; người mua, chủ sách và danh mục tự cập nhật giá/lịch sử/kết quả.
- Browser đang chờ bị ngắt mạng vẫn đọc lại đúng quyết định khi nối mạng. Browser lỡ lượt giá lúc offline tự bắt kịp,
  không cần bấm tải lại. Bỏ tín hiệu Pub/Sub khi Socket vẫn kết nối cũng được bù bằng đọc snapshot định kỳ.
- Dồn 100 tín hiệu không làm mất giá đang nhập. Đồng hồ có test biên bắt đầu/hết hạn, không tự chọn người thắng.
  Public HTTP/Socket không có trường ngưỡng ẩn; desktop/mobile đã xem ảnh, không có pageerror hoặc tràn ngang.

SQL và worker model trong kiểm tra trình duyệt được giả lập; không dùng các kiểm tra đó làm bằng chứng COMMIT SQL thật.
Đã mở rộng test SQL opt-in cho snapshot/lịch sử, thêm `smoke:m6` dùng SQL/Redis/API/worker thật,
nhưng **chưa chạy smoke mới hoặc test SQL mới với SQL Server thật** trong bản cập nhật này.
Schema vẫn 20 bảng/152 cột; dependency, volume và xác thực theo tab giữ nguyên.
Các kết quả SQL Server thật ở phần dưới là bằng chứng của lần triển khai lõi trước đó.

## Giao diện đặt giá và thời gian chờ (lần kiểm tra trước)

Kiểm tra ngày 24/10/2026 cho giao diện chủ sách/người mua:

- Test mặc định: **75 PASS, 6 SKIP** theo opt-in SQL/Redis; không FAIL. Check cú pháp: **74 tệp PASS**; build PASS.
- HTTP thật kiểm tra `bid-status` cần đăng nhập, lấy ID từ session, bỏ qua ID tự chèn trong query;
  chỉ trả trạng thái chủ sách, mốc đặt lại của chính người xem và giờ máy chủ. Snapshot công khai không có dữ liệu này.
- Unit test kiểm tra đếm chờ dựa trên giờ SQL, làm tròn lên, biên hết hạn và phản hồi không hợp lệ.
- Chromium cùng browser context: chủ sách không có ô/nút đặt giá; người mua đang chờ không có ô/nút đặt tiếp;
  hết chờ tự kiểm tra lại rồi hiện thông báo và nút. F5/mở lại chi tiết giữ chờ; người mua khác vẫn đặt được.
- Trạng thái tab cũ dẫn tới `BID_COOLDOWN` được thay bằng đếm chờ, không hiển thị cảnh báo từ chối cũ.
  Không tải được điều kiện đặt giá thì không mở thao tác; phiên kết thúc không cho đặt tiếp.
- Gõ/dán chữ vào ô chờ được lọc; số ngoài 10–30 không gửi được, giá trị hợp lệ gửi API dạng số.
  Đã xem ảnh desktop/mobile, không tràn ngang hoặc có pageerror.

Trình duyệt dùng React, HTTP và session thật; SQL, hàng đợi xử lý giá và media được giả lập.
Đã bổ sung kiểm tra mốc cooldown vào test SQL opt-in và `smoke:m5`, chưa chạy hai phần này với dịch vụ thật
cho bản sửa hiện tại. Không thay schema, dependency hoặc quy tắc cooldown 10–30 giây.
Các bằng chứng SQL/Redis thật bên dưới thuộc lần triển khai lõi trước đó.

## Chạy chung các tiến trình phát triển

Kiểm tra ngày 24/10/2026 cho `npm.cmd run dev:all` dùng `concurrently` 10.0.6:

- `npm ci` thành công với lockfile mới; phiên bản dependency đã có được giữ nguyên.
- `npm run check`: PASS 73 tệp; `npm run build`: PASS.
- Lệnh thực khởi chạy API, worker và Vite, log có nhãn `[API]`, `[WORKER]`, `[WEB]` và mã màu ANSI.
- API và giao diện nhận HTTP; gửi SIGINT cho nhóm tiến trình để mô phỏng `Ctrl+C` dừng nhóm thành công.
- SQL/Redis được cố ý cấu hình không khả dụng trong kiểm tra launcher; không kiểm tra readiness hoặc nghiệp vụ.

Kiểm tra tự dừng khi cổng web bị chiếm chưa đạt trong môi trường Linux có PID namespace:
`tree-kill` không tra cứu được cây PID của lệnh con qua `ps`. Đây là giới hạn kiểm chứng của môi trường này;
không coi đó là bằng chứng tự dừng thành công. Cần thử `Ctrl+C` và lỗi cổng trên Windows của nhóm.
Không chạy lại bộ kiểm thử nghiệp vụ hoặc smoke SQL/Cloudinary cho thay đổi lệnh khởi động này.
Các kết quả nghiệp vụ bên dưới là bằng chứng của lần kiểm tra trước.

## Môi trường

| Thành phần | Kiểm tra đã thực hiện |
|---|---|
| Node.js | 24.19.0, dependency giữ theo lockfile |
| HTTP | Express, session, CSRF và quyền qua HTTP thật |
| SQL chuyên biệt đấu giá | SQL Server 2025 Developer 17.0.5035.5 trên Ubuntu 24.04, database riêng `BookAuctionTest_*` |
| SQL trong các unit test cũ | Driver/model giả để kiểm tra hợp đồng và lỗi |
| Redis | Redis 7.0.15 riêng, prefix UUID, cleanup đúng khóa test |
| API/worker | Tiến trình thực từ server.js/worker.js với SQL/Redis thật |
| Frontend | React/Vite 8.3.5, Chromium desktop/mobile trong cùng browser context |
| Cloudinary | Provider/REST giả ở unit test; không dùng trong smoke đấu giá |

Compose của nhóm dùng SQL Server 2022 và Redis 8. Hai cấu hình này không bị thay đổi.
Bằng chứng SQL Server 2025/Redis 7 không thay nghiệm thu với đúng phiên bản Compose và Cloudinary của nhóm.

## Kết quả gần nhất

| Kiểm tra | Kết quả |
|---|---|
| Full test bật SQL/Redis thật | 87/87 PASS trước bản sửa giao diện; chưa chạy lại cho endpoint mới |
| Test mặc định | 101 PASS, 9 SKIP theo opt-in, không FAIL |
| Test bật Redis thật | 108 PASS, 2 SKIP dành cho SQL Server |
| Check cú pháp | PASS 104 file |
| Build Frontend | Đã đạt; không thêm dependency |
| db:init và db:migrate | PASS trên database kiểm tra, có chạy migration lặp lại |
| smoke | PASS với SQL/Redis/API/worker thật, Socket.IO hello và probe |
| smoke:auth | PASS qua API và SQL/Redis thật, cleanup tài khoản thử hoàn tất |
| smoke:m5 | PASS toàn luồng thật, cleanup dữ liệu thử hoàn tất |
| smoke:m6 | Đã thêm; chờ chạy SQL Server/Redis/API/worker thật trên máy nhóm |
| Browser đấu giá | PASS nhiều tab cùng context, trạng thái chờ, lỗi mạng/retry, người thắng và mobile |
| AI tự động và giao diện | PASS với Gemini/SQL giả và Redis thật; chờ `smoke:ai`/SQL AI thật |
| Browser tài khoản/media trước đó | PASS tách tab và ba ô tiền; Redis thật, SQL/Cloudinary giả |

## SQL và phục hồi đấu giá

Test SQL riêng đã xác minh:

- Migration 003 chạy lại giữ dữ liệu, backfill lượt cũ thành quyết định chấp nhận, giữ lý do lịch sử NULL.
- Schema hiện tại có 20 bảng/152 cột.
- Hai yêu cầu cùng giá chỉ một lượt được ghi; cùng mã xử lý đồng thời chỉ có một quyết định/lượt.
- Nội dung khác dùng cùng mã bị chặn; quyết định từ chối cũ không đổi dù lịch phiên đã thay đổi.
- SQL kiểm tra chủ sách, vai trò, bước giá và cooldown, không chỉ tin kết quả API.
- Tiền 18 chữ số đi qua driver, DECIMAL, giá thắng và giao dịch nguyên vẹn.
- Ngưỡng bằng khởi điểm hoặc giá hợp lệ vượt ngưỡng đều kết thúc đúng.
- Hết hạn có lượt dưới ngưỡng vẫn có người thắng; không có lượt thì không tạo giao dịch.
- Lỗi trước COMMIT rollback cả quyết định/lượt/giá/kết quả/giao dịch; retry ghi đúng một lần.
- Lease hết hạn trong transaction: chủ cũ rollback, worker mới ghi một lượt.
- Crash sau COMMIT/trước ACK: XAUTOCLAIM nhận lại và đọc receipt, không thêm lượt/lịch sử.
- Job chốt hạn và xử lý lại không tạo thêm kết quả/giao dịch.

Redis test riêng xác minh admission 12 request đồng thời chỉ xếp một event, kiểm tra payload trùng,
pending khi lỗi SQL, reclaim, ACK/xóa sau xử lý và dead-letter cho sự kiện sai loại.
Không dùng fake SQL của test consumer làm bằng chứng cho tính nguyên tử SQL; test SQL riêng ở trên kiểm tra phần đó.

## Smoke dịch vụ thật

Chạy init/migrate, API và worker thực, sau đó các lệnh smoke, smoke:auth và smoke:m5.
Smoke đấu giá tạo sách/bài qua API, duyệt/kích hoạt, gửi giá qua stream thực, kiểm tra kết quả SQL.
Kiểm tra chủ sách/CSRF/Admin, bước giá/cooldown, hai người cùng giá, replay cùng mã,
giá 18 chữ số, hai kiểu kết thúc và kết quả/giao dịch duy nhất.
Phục hồi sau COMMIT trước ACK dùng stream UUID riêng, không dừng worker của hệ thống.
Không cần upload/credentials Cloudinary cho các bước này. Chỉ PASS khi dọn xong fixture riêng.

## Trình duyệt

Chromium dùng một browser context với Admin và ba người mua, chung cookie jar.
Đăng nhập/đăng xuất từng tab không đổi tài khoản Admin ở tab còn lại.
Tạm dừng worker kiểm tra phản hồi 202 vẫn là đang chờ, không báo mức giá được chấp nhận.
Khôi phục worker thì giao diện lấy đúng quyết định SQL.

Chặn phản hồi HTTP sau khi request đã tới API và chặn lần poll đầu để mô phỏng mất kết nối.
Nút thử lại gửi đúng UUID/mức giá cũ; chỉ thêm một lượt hợp lệ.
Phản hồi POST chậm không hạ quyết định cuối về đang chờ; card và chi tiết giữ cùng giá/trạng thái.
Giá nhập có dấu chấm nhưng JSON nguyên, ngưỡng không xuất hiện trong public snapshot.
Kết thúc sớm hiển thị người thắng; nút tải lại lấy đúng trạng thái/giá.
Desktop 1440 px, mobile 390 px không tràn ngang; không có pageerror.
Ảnh QA đã được xem để kiểm tra bố cục; harness/ảnh tạm nằm ngoài repository.

## Hồi quy hiện có

Full suite giữ các kiểm tra Argon2id, không tự nâng quyền, đổi/thu hồi session, TTL,
CSRF, CORS, giới hạn thử, header tab và listener. SQL/HTTP rowversion kiểm tra bytes → hex và xung đột.
Media test kiểm tra MIME/magic/giới hạn, ownership, claim/cleanup Redis, rollback và commit chưa rõ;
provider Cloudinary giả. Các ô tiền kiểm tra lọc chữ, caret, giới hạn và độ chính xác 18 chữ số.

## Xác nhận của nhóm và nghiệm thu còn lại

Nhóm đã xác nhận hạ tầng healthy/probe completed, smoke tài khoản và Admin phê duyệt sau sửa row_version.
Chưa có xác nhận smoke bài đăng toàn luồng sau bản sửa mới nhất; không tự coi đó là PASS Cloudinary thật.

Trên Windows của nhóm: dừng các tiến trình, pull, chạy db:migrate, khởi động lại API/worker/web,
kiểm tra readiness 20 bảng/152 cột và chạy smoke:m5, smoke:m6 trên SQL Server 2022/Redis Compose.
Chạy lại smoke:m4 để nghiệm thu media/đăng lại với Cloudinary thật.
Đối chiếu hai tab, nhập tiền, đặt giá và xem kết quả qua giao diện.

Chưa có thực nghiệm tải lớn hoặc production HTTPS. Realtime đã triển khai, chờ smoke SQL thật cho bản mới;
AI đã triển khai, Hải xác nhận smoke:ai PASS; đối chiếu media thật còn chờ dữ liệu. Xác nhận hai bên đã triển khai,
chờ nghiệm thu SQL thật theo mục giao dịch ở đầu tài liệu. Claim media chưa rõ COMMIT vẫn cần đối soát thủ công;
dead-letter đấu giá cũng cần đối soát riêng.
