<!-- Mục đích: Chính sách một cửa sổ điều khiển/tài khoản, xác thực Socket và phục hồi sau đổi cửa sổ. -->

# Cửa sổ điều khiển tài khoản

Mỗi tài khoản chỉ có một tài liệu trình duyệt hoặc phiên client đang điều khiển. Đăng nhập ở cửa sổ mới
lấy quyền từ cửa sổ cũ; hai tài khoản khác nhau vẫn dùng độc lập trong cùng trình duyệt.
Cookie HttpOnly riêng theo tab, CSRF và kiểm tra vai trò SQL tiếp tục được giữ.
Không thêm dependency, biến cấu hình hoặc migration.

## Hành vi người dùng

1. Tab 1 đăng nhập, xem hoặc đặt giá bình thường.
2. Tab 2 đăng nhập cùng tài khoản: server chuyển quyền, phát thông báo và chủ động ngắt Socket tài khoản ở Tab 1.
3. Tab 1 mờ màn hình, phần nền inert không nhận phím/click, hiện thông báo:

> Tài khoản đang được dùng ở cửa sổ/thiết bị khác. Vui lòng F5 (tải lại trang) nếu muốn tiếp tục đấu giá tại đây.

4. Tab 2 tiếp tục hoạt động. Tab 1 bấm F5 hoặc nút tải lại sẽ lấy lại quyền nếu cookie còn hợp lệ;
   khi đó Tab 2 cũng bị ngắt. Không tự giành quyền khi kết nối mạng hoặc Socket nối lại.

Tab mới vẫn cần đăng nhập; không kế thừa cookie của một selector tab khác. F5 giữ selector/cookie hiện tại,
nhưng tạo mã tài liệu mới trong bộ nhớ. Hai tab không tự đẩy nhau qua lại bằng vòng reconnect.
Phiên hết hạn có thông báo tải lại/đăng nhập lại riêng, không coi hết hạn là bằng chứng có người khác sử dụng.

## Quyền Backend và Socket

Redis giữ một khóa `bookauction:auth:control:<user-id>` có TTL bằng session idle. Giá trị là SHA-256
của session ID và mã tài liệu; không gửi session ID tới JavaScript hoặc Socket auth.
Claim SET/EX và PUBLISH chạy trong cùng Lua. Kiểm tra quyền dùng Lua compare/EXPIRE;
logout chỉ xóa khi đúng chủ hiện tại, nên logout của phiên cũ không xóa quyền mới.

HTTP gửi `X-Tab-ID` chọn cookie và `X-Control-ID` nhận diện tài liệu; cả hai không thay xác thực cookie/CSRF.
Các API riêng kiểm tra quyền điều khiển sau khi kiểm tra session/tài khoản. Chủ cũ nhận HTTP 409 ACCOUNT_REPLACED
trước khi đi vào controller nghiệp vụ, kể cả gọi API trực tiếp để gửi giá. Đầu vào người dùng không chọn user ID điều khiển.
Yêu cầu đã qua kiểm tra quyền và đang xử lý trước lúc chuyển chủ có thể hoàn tất; không hủy lượt đã tiếp nhận hoặc ghi SQL.

| HTTP | Mục đích |
|---|---|
| POST `/api/auth/login` | Mật khẩu hợp lệ, regenerate/save session rồi claim quyền |
| GET `/api/auth/me` | Nhận diện cookie còn hợp lệ khi bootstrap, kể cả phiên không điều khiển; không tự claim |
| POST `/api/auth/control` | Cookie hợp lệ + CSRF, body `{}`; claim tường minh một lần khi nạp/F5 trang |
| GET `/api/auth/control-status` | Kiểm tra chủ hiện tại, không claim; Frontend đọc mỗi 5 giây |
| POST `/api/auth/logout` | CSRF; compare-delete quyền của chính phiên rồi destroy session |

Namespace `/account` yêu cầu cookie hợp lệ, selector tab, mã tài liệu và đúng quyền Redis khi handshake.
Socket cũ bị ngắt bằng server disconnect; handshake/reconnect chỉ assert, không claim. Subscriber riêng trên mỗi API
nhận Pub/Sub để ngắt đúng chủ cũ dù hai client tới hai tiến trình API khác nhau.
Heartbeat Socket tải lại session/kiểm tra quyền mỗi 5 giây; HTTP định kỳ bù thông báo bị lỡ.
Không cam kết Pub/Sub giao mọi thông báo. Mất quyền Redis hoặc session thì chặn và yêu cầu F5, không tự giành lại.

Namespace `/auctions` vẫn chỉ có dữ liệu phiên công khai. Khi bị thay, Frontend dừng Socket công khai,
chặn request tiếp theo và khóa thao tác; quyền gửi giá luôn ở HTTP Backend, không dựa riêng vào lớp phủ.
Client terminal không có hai header giữ cookie chung, login claim theo session; dùng cùng tài khoản với trình duyệt
cũng tuân theo quy tắc chủ mới. Smoke tạo tài khoản UUID riêng nên không lấy quyền tài khoản thật.

## Kiểm tra

`backend/test/accountControl.test.js` chạy khi có `AUTH_TEST_REDIS_URL`: hai HTTP API/Socket thật,
Redis/RedisStore/Lua thật, model tài khoản/đấu giá giả. Kiểm tra ngắt chủ cũ, không enqueue qua HTTP cũ,
CSRF, giả cookie/selector, F5, reconnect không reclaim, logout cũ, mất khóa và heartbeat khi bỏ lỡ Pub/Sub.
Không thay bài này bằng MemoryStore hoặc mock Lua rồi gọi là tích hợp Redis.

Nghiệm thu: cập nhật mã, dừng/khởi động lại `dev:all`, F5 các tab. Đăng nhập cùng một tài khoản ở hai tab
và hai trình duyệt; tab mới dùng được, tab cũ mờ và chỉ F5 mới lấy lại. Thử mất mạng ở tab cũ rồi nối lại,
xác nhận không tự giành quyền. Admin/người mua khác tài khoản phải giữ phiên độc lập.
