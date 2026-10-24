<!-- Mục đích: Quy tắc, quyền, HTTP, cách sử dụng và nghiệm thu giao dịch cùng các tương tác hỗ trợ. -->

# Giao dịch và tương tác sau đấu giá

Mỗi kết quả có người thắng tạo một giao dịch và một phòng trò chuyện giữa đúng người thắng/người bán.
SQL Server giữ liên kết và trạng thái; xác nhận đủ hai bên mới hoàn tất. Người mua đánh giá sau hoàn tất.
Khiếu nại lưu hồ sơ và bằng chứng riêng, không tự đổi người thắng, giá thắng hoặc xác nhận giao dịch.
Không tích hợp cổng thanh toán, đối soát tài chính, vận chuyển, hoàn tiền hoặc xử phạt tự động.

## Cập nhật và chạy

Tại thư mục gốc, dừng dev:all trước khi pull:

```powershell
git switch feat/Hai
git pull --ff-only origin feat/Hai
npm.cmd run check
npm.cmd run test:community
npm.cmd run build
npm.cmd run dev:all
```

Không thêm dependency hoặc migration. Giữ schema 20 bảng/152 cột, cấu hình, volume và xác thực theo tab.
Các bảng GiaoDich, CuocTroChuyen, TinNhan, DanhGia, KhieuNai, BangChungKhieuNai và BinhLuan đã có từ schema nền.
Phiên có người thắng mới tạo chat trong cùng transaction kết quả/giao dịch; replay không tạo thêm.
Giao dịch cũ chưa có phòng có nút **Mở cuộc trò chuyện**, kiểm tra quyền và UNIQUE khi tạo bổ sung.

## Liên kết và xác nhận

Backend đối chiếu sách → bài → phiên đã kết thúc → kết quả có người thắng → giao dịch.
Người mua phải là người thắng, người bán là chủ bài, số tiền đúng giá thắng; tiền đi qua JSON dạng chuỗi nguyên,
giữ đủ 18 chữ số. Không nhận đối tác, số tiền, trạng thái hoặc thời gian xác nhận từ client.

Mỗi bên chỉ được ghi thời điểm xác nhận của mình bằng giờ SQL UTC. COALESCE giữ lần xác nhận đầu;
khóa GiaoDich bằng UPDLOCK/HOLDLOCK trong SERIALIZABLE bảo vệ xác nhận đồng thời.
Khi đủ hai trường xác nhận, đổi trạng thái hoan_tat và ghi ngày hoàn tất trong cùng transaction.
Chỉ trả thành công sau COMMIT; gọi lại xác nhận không đổi thời điểm đã ghi.
Lỗi deadlock 1205 đã rollback được thử lại tối đa một lần. Kết quả COMMIT chưa rõ không tự gửi lại thao tác.

Trang **Giao dịch** chỉ có các giao dịch người dùng là bên mua/bán. Chi tiết hiển thị liên kết ID,
giá thắng, hai thời điểm xác nhận và trạng thái. Admin không có danh sách/chat giao dịch tùy ý.

## Trò chuyện và đã đọc

- Chỉ hai thành viên đúng của giao dịch được đọc/gửi; phòng phải đang mở để nhận tin.
- Tin nhắn hiện chỉ có văn bản tối đa 4.000 ký tự, hiển thị dạng text để không thực thi HTML.
- Chỉ người nhận cập nhật da_doc cho tin của bên còn lại trong đúng phòng, tới ID đã tải; Admin không đánh dấu đọc.
- Hoàn tất giao dịch không tự đóng phòng. Không thêm thao tác đóng/mở lại phòng thủ công; dữ liệu phòng đã đóng vẫn đọc được.
- Chat riêng không dùng room Socket công khai. Trang mới nhất đọc HTTP mỗi ba giây sau khi lần trước hoàn tất;
  lịch sử 50 tin/trang theo ID, trang cũ giữ nguyên tới khi chọn về mới nhất.

POST tin nhắn, bình luận và tạo khiếu nại không có receipt UUID trong schema hiện tại.
Giao diện chặn bấm khi đang gửi và không tự retry POST. Nếu mất phản hồi, đọc lại danh sách trước khi gửi lại;
không tuyên bố các thao tác này được giao đúng một lần. Xác nhận, tạo phòng và đánh giá có điều kiện/ràng buộc riêng chống trùng.

## Đánh giá và uy tín

Chỉ người mua của giao dịch hoàn tất, đủ hai xác nhận, được đánh giá đúng người bán, một lần/giao dịch.
Số sao nguyên 1–5, nhận xét tùy chọn tối đa 2.000 ký tự. Gửi lại cùng nội dung trả bản đã lưu;
nội dung khác bị chặn, không có API sửa/xóa đánh giá.

Chi tiết phiên công khai có mục **Uy tín người bán** gồm số đánh giá, trung bình sao và nhận xét phân trang 30 dòng.
Chỉ tính các đánh giá khớp người mua/bán và giao dịch hoàn tất. Không công khai mã giao dịch, email,
ngưỡng kết thúc sớm, tin nhắn hoặc hồ sơ khiếu nại qua phần này.

## Khiếu nại và bằng chứng

Người mua hoặc người bán gửi lý do tối đa 300 ký tự, nội dung tối đa 12.000 ký tự và 0–5 ảnh.
Có thể gửi không ảnh khi cần trình bày vấn đề, nhưng cần bổ sung thông tin phù hợp để Admin đối chiếu.
Ảnh JPEG/PNG/WebP upload qua luồng Cloudinary/vé Redis hiện có; chỉ claim vé của người gửi, không nhận URL tự chèn hoặc vé video.
Lưu KhieuNai và các BangChungKhieuNai cùng transaction với phòng/giao dịch đã kiểm tra.

Sau COMMIT, lỗi bind Redis không làm thao tác thành thất bại giả. Chỉ release vé nếu rollback chắc chắn;
claim chưa rõ COMMIT giữ để đối soát. Cleanup kiểm tra cả URL BangChungKhieuNai chứa public_id trước khi xóa tệp.
Do bảng bằng chứng hiện chỉ có URL, kiểm tra tham chiếu dùng CHARINDEX bảo thủ, không thêm cột metadata.
Ảnh dùng cơ chế delivery Cloudinary hiện tại: API kiểm soát ai lấy hồ sơ, nhưng URL ảnh không phải URL xác thực riêng.
Đây chưa phải kho bằng chứng riêng tư được ký URL/kiểm soát truy cập tại CDN.

| Người xem | Quyền |
|---|---|
| Người gửi khiếu nại | Xem hồ sơ, ảnh, trạng thái và phản hồi của mình |
| Bên còn lại | Không tự được xem hồ sơ của người gửi; vẫn có chat của giao dịch mình tham gia |
| Admin | Xem danh sách/nội dung/bằng chứng để tiếp nhận |
| Admin được phân công, hồ sơ đang xử lý | Xem chat liên quan ở chế độ chỉ đọc, ghi phản hồi xử lý |
| Admin khác hoặc hồ sơ đã xử lý | Không được đọc chat qua quyền xử lý khiếu nại này |

Tiếp nhận chuyển cho_xu_ly → dang_xu_ly và gán Admin. Hai Admin cùng tiếp nhận chỉ một người thành công.
Admin đã được gán mới ghi phản hồi tối đa 8.000 ký tự, chuyển da_xu_ly và ghi giờ SQL.
Gửi lại cùng phản hồi không ghi đè ngày xử lý; phản hồi khác bị chặn. Không có chuyển hồ sơ ngược hoặc phân công lại.
Kết thúc xử lý chấm dứt quyền xem chat qua hồ sơ; tin nhắn của hai bên vẫn giữ nguyên.
Khiếu nại không thêm trạng thái mới cho giao dịch, không hủy hoặc thay đổi kết quả đấu giá.

Người dùng theo dõi **Khiếu nại của tôi** hoặc mở hồ sơ trong chi tiết giao dịch; Admin dùng **Khiếu nại**.
Danh sách 30 hồ sơ/trang, tự cập nhật trang mới nhất. Lịch sử cũ không bị xóa khi có hồ sơ mới.

## Bình luận phiên

Người dùng thường, gồm chủ sách, có thể bình luận khi phiên đã công bố và đang trong [bắt đầu, kết thúc)
theo đồng hồ SQL. Model khóa dòng phiên trước khi kiểm tra và ghi; không chờ giao diện hay worker chốt mới khóa bình luận.
Khách/Admin được đọc; Admin không gửi bình luận. Nội dung tối đa 2.000 ký tự, hiển thị công khai với tên tác giả và thời gian.
Sau kết thúc giữ lịch sử chỉ đọc, 50 bình luận/trang; chưa có sửa/xóa bình luận hoặc xử lý kiểm duyệt nội dung tự động.

## Hợp đồng HTTP

Prefix `/api/community`. GET công khai chỉ có bình luận/uy tín của phiên đã công bố.
Các endpoint riêng yêu cầu cookie/session theo tab, POST thêm CSRF; chủ thể lấy từ session.

| Phương thức | Đường dẫn | Quyền / đầu vào |
|---|---|---|
| GET | `/trades` | Người dùng, chỉ hai bên; `before` phân trang |
| GET | `/trades/:id` | Hai bên; chi tiết, chat, đánh giá và 30 hồ sơ của mình gần nhất |
| POST | `/trades/:id/conversation` | Hai bên; body `{}`; tạo bổ sung phòng thiếu |
| GET | `/trades/:id/messages` | Hai bên; `before`, 50 tin/trang |
| POST | `/trades/:id/messages` | Hai bên; `{noi_dung}` |
| POST | `/trades/:id/read` | Hai bên; `{through}` ID tin cuối đã tải |
| POST | `/trades/:id/confirm` | Hai bên; `{}`; ghi xác nhận của mình |
| POST | `/trades/:id/review` | Người mua đã hoàn tất; `{so_sao,noi_dung}` |
| POST | `/trades/:id/complaints` | Hai bên; `{ly_do,noi_dung,media:[{upload_id,tieu_de}]}` |
| GET | `/complaints` | Người dùng chỉ hồ sơ mình; Admin mọi hồ sơ; `before` |
| GET | `/complaints/:id` | Người gửi hoặc Admin; hồ sơ/bằng chứng/liên kết giao dịch |
| POST | `/complaints/:id/claim` | Admin; `{}` |
| POST | `/complaints/:id/resolve` | Admin được gán; `{phan_hoi_admin}` |
| GET | `/complaints/:id/messages` | Admin được gán và đang xử lý; `before` |
| GET | `/auctions/:id/comments` | Công khai, `before`; trả cờ duoc_binh_luan và giờ SQL |
| POST | `/auctions/:id/comments` | Người dùng thường; `{noi_dung}` |
| GET | `/auctions/:id/reputation` | Công khai, `before`; trung bình/số lượng/nhận xét |

Không tìm thấy hoặc truy cập chéo dữ liệu riêng trả 404; sai vai trò/CSRF trả 403; xung đột trạng thái/quyền phân công trả 409.
Không dùng body/query ID người dùng để quyết định quyền; các trường đầu vào ngoài hợp đồng bị chặn.

## Kiểm tra và nghiệm thu

`npm.cmd run test:community` kiểm tra policy, HTTP/session/CSRF với model SQL giả và claim/bind media.
SQL opt-in yêu cầu database riêng `BookAuctionTest_*`, không dùng database làm việc:

```powershell
$env:DB_DATABASE = "BookAuctionTest_Local"
$env:COMMUNITY_TEST_SQL = "true"
npm.cmd run test:community
Remove-Item Env:COMMUNITY_TEST_SQL
Remove-Item Env:DB_DATABASE
```

Có thể tạo/nâng schema trên database test, chỉ dọn fixture UUID của lần chạy. Bài này không cần Redis vì dùng model SQL trực tiếp;
claim/bind Redis được kiểm tra riêng và qua giao diện. Không coi HTTP/model giả là bằng chứng SQL nguyên tử.

Giữ SQL/Redis/API/worker đang chạy, mở terminal khác tại gốc:

```powershell
npm.cmd run smoke:m8
```

Smoke dùng chung kiểm tra/fixture với smoke:m5, thêm bình luận trước/sau kết thúc, liên kết giao dịch/phòng,
quyền chat, cờ đọc, hai xác nhận, đánh giá/replay, khiếu nại/phân công/phản hồi và Admin mất quyền chat khi đóng hồ sơ.
SQL kiểm tra phòng/đánh giá chỉ có một dòng. Dọn đúng dữ liệu thử theo thứ tự FK; FAIL khi chưa dọn xong.
Không dùng Cloudinary trong smoke này, ảnh bằng chứng thật cần nghiệm thu riêng trên giao diện.

Nếu Gemini đang bật, các bài fixture tạo qua API cũng có thể được phân tích tự động, dùng quota thật.
Để chỉ nghiệm thu giao dịch, có thể tạm đặt AI_ENABLED=false và khởi động lại API/worker trước smoke; bật lại sau khi kiểm tra.
Không cần đổi/xóa khóa Gemini hoặc dữ liệu AI đã lưu.

Nghiệm thu giao diện: người mua/người bán ở hai tab, một người ngoài và Admin; thử giao dịch của người khác,
chat riêng, xác nhận từng bên, nhận xét công khai, gửi ảnh khiếu nại, hai Admin tranh tiếp nhận và kết thúc xử lý.
Chạy bình luận ở biên giờ bắt đầu/hết hạn và đọc lại lịch sử. Xem [VALIDATION.md](../VALIDATION.md) để biết phần thật/giả đã chạy.
