<!-- Mục đích: Quy tắc, quyền, HTTP, cách sử dụng và nghiệm thu giao dịch cùng các tương tác hỗ trợ. -->

# Giao dịch và tương tác sau đấu giá

Mỗi kết quả có người thắng tạo một giao dịch và một phòng trò chuyện giữa đúng người thắng/người bán.
SQL Server giữ liên kết và trạng thái; xác nhận đủ hai bên mới hoàn tất. Người mua đánh giá sau hoàn tất.
Khiếu nại lưu hồ sơ và bằng chứng riêng, không tự đổi người thắng, giá thắng hoặc xác nhận giao dịch.
Không tích hợp cổng thanh toán, đối soát tài chính, vận chuyển, hoàn tiền hoặc xử phạt tự động.

## Cài đặt và phạm vi

Cài/nâng cấp và các lệnh chạy tại [setup-guide.md](setup-guide.md). Schema hiện tại sau migration 009:
**21 bảng/172 cột**, theo manifest. Các bảng giao dịch/chat/đánh giá/khiếu nại/bình luận có từ nền;
004 thêm thông báo, 005 snapshot kiểm duyệt, 006 mở ô ISBN, 007 hồ sơ theo bài/media active.
Không thay cơ chế xác thực; thông tin sách lấy theo hồ sơ của đúng bài, giữ lịch sử phiên khác.

Có người thắng mới tạo chat/giao dịch cùng transaction kết quả; replay không tạo thêm.
Giao dịch cũ thiếu phòng có nút **Mở cuộc trò chuyện**, kiểm tra quyền và UNIQUE khi tạo bổ sung.

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
Mục **Đánh giá người bán** trong giao dịch chỉ hiển thị phía người mua; phía người bán không hiện tiêu đề,
biểu mẫu hoặc hướng dẫn người mua đánh giá. Uy tín công khai của người bán vẫn nằm trong chi tiết phiên.
Chỉ tính các đánh giá khớp người mua/bán và giao dịch hoàn tất. Không công khai mã giao dịch, email,
ngưỡng kết thúc sớm, tin nhắn hoặc hồ sơ khiếu nại qua phần này.

## Khiếu nại và bằng chứng

Người mua hoặc người bán gửi lý do tối đa 300 ký tự, nội dung tối đa 12.000 ký tự và 0–5 ảnh.
Có thể gửi không ảnh khi cần trình bày vấn đề, nhưng cần bổ sung thông tin phù hợp để Admin đối chiếu.
Biểu mẫu bằng chứng hiện chọn JPEG/PNG/WebP (khác danh sách mở rộng ở Đăng sách), qua luồng Cloudinary/vé Redis; chỉ claim vé của người gửi, không nhận URL tự chèn hoặc vé video.
Lưu KhieuNai và các BangChungKhieuNai cùng transaction với phòng/giao dịch đã kiểm tra.

Sau COMMIT, lỗi bind Redis không làm thao tác thành thất bại giả. Chỉ release vé nếu rollback chắc chắn;
claim chưa rõ COMMIT giữ để đối soát. Cleanup kiểm tra cả URL BangChungKhieuNai chứa public_id trước khi xóa tệp.
Do bảng bằng chứng hiện chỉ có URL, kiểm tra tham chiếu dùng CHARINDEX bảo thủ, không thêm cột metadata.
Ảnh dùng cơ chế delivery Cloudinary hiện tại: API kiểm soát ai lấy hồ sơ, nhưng URL ảnh không phải URL xác thực riêng.
Đây chưa phải kho bằng chứng riêng tư được ký URL/kiểm soát truy cập tại CDN.

| Người xem | Quyền với hồ sơ mới |
|---|---|
| Người gửi | Xem nội dung đã gửi, giải trình và kết luận chung |
| Người mua hoặc người bán còn lại | Nhận thông báo, xem hồ sơ, gửi một giải trình kèm tối đa 5 ảnh trong 72 giờ |
| Admin | Xem hồ sơ, bằng chứng và ghi chú nội bộ |
| Admin đã tiếp nhận, hồ sơ đang xử lý | Xem chat giao dịch chỉ đọc và lưu kết luận |
| Người ngoài | Không có quyền xem hoặc phản hồi |

Mỗi giao dịch chỉ mở một hồ sơ tại một thời điểm. Khóa dòng giao dịch bảo vệ khi hai bên gửi đồng thời.
Hồ sơ cũ trước migration 009 vẫn chỉ hiển thị cho người gửi và Admin; không công khai lại ảnh cũ.
Nếu giao dịch có hồ sơ cũ đang mở thì cần xử lý xong trước khi tạo hồ sơ mới.

Tiếp nhận chuyển `cho_xu_ly` → `dang_xu_ly` và gán Admin. Bên còn lại được giải trình ngay từ lúc hồ sơ
được tạo, trước hạn tính theo giờ SQL. Hết hạn không tự kết luận hoặc xử phạt. Admin chỉ được kết luận
sau khi có giải trình hoặc hết hạn; chọn **Có căn cứ**, **Không có căn cứ** hoặc **Hai bên đã thỏa thuận**,
kèm lý do và hướng xử lý. Kết luận chuyển sang `da_xu_ly`, gửi thông báo cho hai bên và đóng quyền
đọc chat của Admin qua hồ sơ. Ghi chú nội bộ không trả trong API của người mua hoặc người bán.

Tạo hồ sơ từ **Giao dịch**; theo dõi và phản hồi ở **Khiếu nại** cạnh **Giao dịch**. Bộ lọc
**Tôi đã gửi** và **Cần tôi phản hồi** phân trang trên máy chủ. Số cạnh menu đếm hồ sơ còn hạn cần phản hồi.
Không thay đổi kết quả đấu giá, trạng thái giao dịch, xác nhận của hai bên hoặc tự thực hiện hoàn tiền.

## Bình luận phiên

Người dùng thường, gồm chủ sách, có thể bình luận khi phiên đã công bố và đang trong [bắt đầu, kết thúc)
theo đồng hồ SQL. Model khóa dòng phiên trước khi kiểm tra và ghi; không chờ giao diện hay worker chốt mới khóa bình luận.
Khách/Admin được đọc; Admin không gửi bình luận. Nội dung tối đa 2.000 ký tự, hiển thị công khai với tên tác giả và thời gian.
Sau kết thúc giữ lịch sử chỉ đọc, 50 bình luận/trang; chưa có sửa/xóa bình luận hoặc xử lý kiểm duyệt nội dung tự động.

Chi tiết phiên tách uy tín và nhận xét người bán ở cột trái, bình luận và ô gửi ở cột phải; trên màn hình hẹp hai khung xếp dọc.
Danh sách bình luận có vùng cuộn riêng. Trang mới nhất đi theo nội dung mới khi đang ở gần cuối; người đang đọc phía trên không bị kéo xuống khi có cập nhật.

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
| GET | `/complaints` | Hai bên xem hồ sơ liên quan; Admin xem mọi hồ sơ; `before`, `scope=all/mine/reply` |
| GET | `/complaints/:id` | Hai bên (hồ sơ mới) hoặc Admin; hồ sơ/bằng chứng/liên kết giao dịch |
| POST | `/complaints/:id/response` | Bên còn lại, còn hạn; `{noi_dung,media:[{upload_id,tieu_de}]}` |
| POST | `/complaints/:id/claim` | Admin; `{}` |
| POST | `/complaints/:id/resolve` | Admin được gán; `{ket_luan,phan_hoi_admin,ghi_chu_noi_bo?}` |
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
try {
  npm.cmd run db:init
  $env:COMMUNITY_TEST_SQL = "true"
  npm.cmd run test:community
} finally {
  Remove-Item Env:COMMUNITY_TEST_SQL -ErrorAction SilentlyContinue
  Remove-Item Env:DB_DATABASE -ErrorAction SilentlyContinue
}
```

Khởi tạo đủ schema hiện tại trên database test trước khi bật cờ; chỉ dọn fixture UUID của lần chạy.
Bật một bộ SQL mỗi lần theo [VALIDATION](../VALIDATION.md). Bài này không cần Redis vì dùng model SQL trực tiếp;
claim/bind Redis được kiểm tra riêng và qua giao diện. Không coi HTTP/model giả là bằng chứng SQL nguyên tử.

Giữ SQL/Redis/API/worker đang chạy, mở terminal khác tại gốc:

```powershell
npm.cmd run smoke:m8
```

Smoke dùng chung kiểm tra/fixture với smoke:m5, thêm bình luận trước/sau kết thúc, liên kết giao dịch/phòng,
quyền chat, cờ đọc, hai xác nhận, đánh giá/replay, khiếu nại/phân công/phản hồi và Admin mất quyền chat khi đóng hồ sơ.
SQL kiểm tra phòng/đánh giá chỉ có một dòng. Dọn đúng dữ liệu thử theo thứ tự FK; FAIL khi chưa dọn xong.
Không dùng Cloudinary trong smoke này, ảnh bằng chứng thật cần nghiệm thu riêng trên giao diện.

### Dừng tại readiness

Smoke không tự khởi động API, worker hoặc Docker. Giữ `npm.cmd run dev:all` ở terminal thứ nhất,
chờ log API/worker sẵn sàng rồi chạy smoke ở terminal thứ hai. Kiểm tra mà không tạo dữ liệu thử:

```powershell
docker compose ps
Invoke-RestMethod http://127.0.0.1:5000/api/health/ready | ConvertTo-Json -Depth 6
```

Địa chỉ trên dùng cấu hình mặc định; nếu đổi API_HOST/API_PORT thì thay cho khớp.
Không kết nối được HTTP thường do API chưa chạy, sai cổng hoặc tiến trình đã dừng; xem log [API].
HTTP 503 trả từng thành phần: sqlserver/redis/worker. WORKER_NOT_RUNNING là chưa có heartbeat;
schema thiếu bảng/cột cần kiểm tra đúng database và migration. DEPENDENCY_UNAVAILABLE là kiểm tra dịch vụ bị lỗi,
cần xem log API và trạng thái container, không suy ra ngay là phải chạy lại migration.

Script phân biệt readiness HTTP, kết nối SQL trực tiếp của script và kết nối Redis trực tiếp của script.
API healthy chưa chứng minh cấu hình/kết nối ở terminal smoke giống tiến trình API đang chạy; khởi động lại dev:all
sau khi cập nhật cấu hình. Chẩn đoán chỉ in mã kết nối cho phép, số bảng/cột và trạng thái; không in mật khẩu/URL Redis/body lỗi.

Nếu Gemini đang bật, các bài fixture tạo qua API cũng có thể được phân tích tự động, dùng quota thật.
Để chỉ nghiệm thu giao dịch, có thể tạm đặt AI_ENABLED=false và khởi động lại API/worker trước smoke; bật lại sau khi kiểm tra.
Không cần đổi/xóa khóa Gemini hoặc dữ liệu AI đã lưu.

Nghiệm thu giao diện: người mua/người bán ở hai tab, một người ngoài và Admin; thử giao dịch của người khác,
chat riêng, xác nhận từng bên, nhận xét công khai, gửi ảnh khiếu nại, hai Admin tranh tiếp nhận và kết thúc xử lý.
Chạy bình luận ở biên giờ bắt đầu/hết hạn và đọc lại lịch sử. Xem [VALIDATION.md](../VALIDATION.md) để biết phần thật/giả đã chạy.
