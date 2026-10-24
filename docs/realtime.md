<!-- Mục đích: Hợp đồng cập nhật trực tiếp, đồng hồ SQL và phục hồi trạng thái giữa các trình duyệt. -->

# Cập nhật thời gian thực

## Luồng cập nhật

1. Worker kiểm tra và ghi quyết định/lượt giá/kết quả trong transaction SQL như trước.
2. Sau khi model trả về từ COMMIT, processor publish `{ "auctionId": 7 }` lên kênh Redis `bookauction:auction:updates`.
3. API dùng Redis subscriber riêng và phát `auction:changed` vào room phiên và room danh mục trên namespace `/auctions`.
4. React nhận tín hiệu rồi lấy snapshot từ HTTP. Snapshot chứa giá, lịch, thời gian SQL, kết quả và 50 lượt hợp lệ mới nhất.
5. Yêu cầu đặt giá của từng tài khoản vẫn lấy quyết định riêng qua API có cookie/CSRF và selector tab hiện hành.

HTTP 202 chỉ là đang chờ. Không phát giá hoặc công bố người thắng trước khi SQL COMMIT.
Kích hoạt phiên cũng phát tín hiệu sau COMMIT; lỗi thông báo không đổi kết quả kích hoạt thành thất bại giả.

## Hợp đồng công khai và quyền truy cập

| Kênh | Đầu vào/đầu ra | Kiểm tra |
|---|---|---|
| Socket `/auctions`, `auction:watch` | `{ "auctionId": 7 }`, ACK `{ "ok": true }` | Server kiểm tra phiên đã duyệt và đã công bố; chỉ một room phiên/socket |
| Socket `/auctions`, `auction:watch` | `{ "catalog": true }` | Danh mục công khai; không nhận ID người dùng hoặc tên room tùy ý |
| Socket `auction:changed` | `{ "auctionId": 7 }` | Chỉ server phát; không phải kết quả đặt giá |
| GET `/api/auctions/:id` | Snapshot và `lich_su`, `lich_su_truoc` | Chỉ phiên đã công bố; projection loại ngưỡng và dữ liệu nội bộ |
| GET `/api/auctions/:id/history?before=51` | `items`, `nextBefore` | Cùng quyền công khai, tối đa 50 lượt/trang, chỉ lượt hợp lệ |
| GET `/api/auctions/:id/bid-status` | Trạng thái chủ sách, mốc đặt lại và giờ SQL | Đăng nhập; chỉ dữ liệu của tài khoản trong session |
| GET `/api/auctions/:id/requests/:requestId` | Quyết định đã lưu hoặc trạng thái chờ | Chỉ chủ yêu cầu; không đọc theo ID người dùng do client gửi |

Namespace này chỉ phục vụ dữ liệu mà khách chưa đăng nhập cũng được xem. Không có room người dùng,
thao tác đặt giá hoặc dữ liệu riêng tư trên Socket. Xác thực theo tab giữ nguyên cho HTTP;
chủ sách và Admin không được cấp thêm quyền đặt giá bởi kết nối Socket.
Origin được kiểm tra tại Socket.IO server; yêu cầu theo dõi bị giới hạn 10 lần/giây/socket.
Lịch sử công khai chỉ gồm mã lượt, mã người tham gia, giá dạng chuỗi và thời điểm đặt; không có email, UUID yêu cầu hoặc `gia_toi_thieu`.

## Phục hồi và giới hạn bảo đảm

- Client đăng ký lại room sau mỗi lần kết nối và lấy snapshot sau ACK; thay đổi xảy ra trước khi vào room được bù bằng snapshot này.
- Nhận thông báo chỉ kích hoạt đọc lại, không cộng giá hoặc nối lịch sử theo số lần nhận. Thông báo trùng không tạo lượt giá trùng.
- Client lấy lại snapshot/danh mục mỗi 5 giây và khi trở lại tab để bù thông báo bị mất trong lúc Socket còn kết nối.
  Các lần đọc nền được gộp, không để thông báo dồn dập liên tục hủy phản hồi đang chờ.
- Yêu cầu đang chờ tiếp tục đọc quyết định riêng khi mạng phục hồi. Lỗi mạng không trở thành quyết định từ chối.
- Worker publish lỗi sau COMMIT thì thông điệp giữ pending; XAUTOCLAIM xử lý lại, đọc quyết định đã lưu rồi phát lại trước ACK.
- API vắng mặt hoặc subscriber bị ngắt có thể lỡ Pub/Sub sau khi worker đã ACK. Socket/Pub/Sub không phải nhật ký bền vững.
  Việc lấy lại SQL bù trạng thái hiện tại; không cam kết giao mọi thông báo hoặc replay toàn bộ sự kiện Socket.
- Không bổ sung transactional outbox, Redis Adapter hoặc bảng mới. Mỗi API subscribe cùng kênh và phát cho client đang kết nối với chính API đó.

Nếu SQL/HTTP vẫn lỗi, giao diện báo lỗi và không tuyên bố đã có trạng thái mới. Dữ liệu chỉ cập nhật khi đọc lại thành công.

## Đồng hồ và lịch sử trên giao diện

Đồng hồ dựa vào `server_time`, lịch bắt đầu/kết thúc từ SQL và `performance.now()` của trình duyệt.
Giờ trên máy người dùng không quyết định việc nhận giá hoặc người thắng. Thời gian hiển thị có độ trễ mạng và được hiệu chỉnh ở lần đồng bộ tiếp theo.
Trước giờ bắt đầu hoặc khi đã hết giờ, giao diện ẩn thao tác đặt giá. Hết giờ chỉ hiện đang chờ máy chủ xác nhận;
chỉ snapshot có kết quả SQL mới hiển thị người thắng.

Lịch sử mới nhất nằm cùng transaction đọc snapshot để giá và danh sách lượt hợp lệ nhất quán.
Nút xem lượt cũ đọc trang kế tiếp; khi có lượt mới, lịch sử trở lại trang mới nhất.
Số tiền giữ dạng chuỗi 18 chữ số. Giá gợi ý được cập nhật nếu chưa nhập; dữ liệu đang gõ được giữ khi giá nền đổi.

## Nghiệm thu

Giữ SQL Server/Redis và `npm.cmd run dev:all` đang chạy, mở terminal khác:

```powershell
npm.cmd run smoke:m6
```

Script dùng chung fixture/cleanup với `smoke:m5`, kiểm tra tín hiệu kích hoạt, hai kết nối,
snapshot/lịch sử/kết quả SQL giống nhau và đăng ký lại room sau mất kết nối; không cần Cloudinary.
Script dọn đúng tài khoản, phiên và khóa UUID của lần chạy, không xóa database hoặc volume.

Trên giao diện, mở hai trình duyệt hoặc các tab tài khoản riêng:

1. Cùng xem một phiên đang hoạt động. Một người gửi giá: ban đầu đang chờ, sau xử lý mới chấp nhận/từ chối.
2. So giá, lịch sử và kết quả giữa người mua, chủ sách và danh mục; không bấm tải lại.
3. Ngắt mạng một trình duyệt, tiếp tục đặt giá ở trình duyệt kia rồi nối mạng lại; trạng thái tự bắt kịp.
4. Kiểm tra hết giờ/ngưỡng, không có nút đặt tiếp sau kết thúc và dữ liệu người mua không có trường `gia_toi_thieu`.

Bằng chứng đã chạy và phần còn cần xác minh nằm tại [VALIDATION.md](../VALIDATION.md).
Tham khảo: [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/),
[rooms](https://socket.io/docs/v4/rooms/), [Redis Pub/Sub](https://redis.io/docs/latest/develop/pubsub/).
