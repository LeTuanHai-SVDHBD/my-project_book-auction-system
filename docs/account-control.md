<!-- Mục đích: Một phiên đăng nhập/tài khoản, thu hồi session cũ và đồng bộ đăng xuất qua Socket/HTTP. -->

# Phiên đăng nhập duy nhất cho mỗi tài khoản

Đăng nhập thành công ở tab hoặc thiết bị mới thu hồi phiên đăng nhập cũ. Tab cũ tự chuyển về biểu mẫu đăng nhập,
không giữ tài khoản sau một lớp phủ và không dùng F5 để lấy lại quyền. Các tài khoản khác nhau vẫn hoạt động độc lập.
Cookie HttpOnly riêng theo tab, CSRF, kiểm tra mật khẩu và vai trò SQL được giữ nguyên. Không thêm migration/dependency.

## Hành vi

1. Tab 1 đăng nhập tài khoản A và hoạt động bình thường.
2. Tab 2 đăng nhập A bằng mật khẩu hợp lệ: Redis ghi phiên mới, xóa session cũ và phát tín hiệu trong cùng Lua.
3. Server ngắt Socket tài khoản của Tab 1. Frontend xóa tài khoản đang hiển thị, về màn hình đăng nhập và thông báo:

> Tài khoản đã được đăng nhập ở cửa sổ/thiết bị khác. Bạn đã được đăng xuất khỏi cửa sổ này.

4. F5 ở Tab 1 vẫn là chưa đăng nhập; không ảnh hưởng Tab 2. F5 ở Tab 2 giữ phiên hợp lệ của Tab 2.
5. Chỉ khi Tab 1 nhập đúng mật khẩu và đăng nhập lại thì Tab 2 mới bị đăng xuất. Sai mật khẩu không đổi phiên đang hoạt động.

Không còn thao tác nạp trang/F5 tự claim hoặc lớp phủ yêu cầu F5 để tiếp tục. Session hết hạn cũng đưa người dùng về
biểu mẫu đăng nhập với thông báo riêng. Tab mới vẫn dùng selector mới, không tự chọn cookie của tab khác.

## Backend và Redis

Khóa `bookauction:auth:control:<user-id>` lưu JSON chứa SHA-256 của session ID và tên khóa RedisStore của session đó.
TTL theo session idle. Login regenerate/save session rồi Lua kiểm tra bản ghi cũ, xóa khóa session cũ trong đúng prefix,
SET phiên mới và PUBLISH. Session ID chỉ tồn tại ở cookie HttpOnly và dữ liệu nội bộ server/Redis, không gửi qua Socket auth.
Owner dựa trên session ID, không phụ thuộc mã tài liệu thay đổi khi F5. Mã X-Control-ID vẫn được kiểm tra định dạng để tương thích,
không cấp quyền đăng nhập hoặc làm căn cứ để đổi phiên.

Các API riêng, kể cả GET me, kiểm tra cookie, tài khoản và phiên hiện tại. Session cũ bị xóa trả 401 UNAUTHENTICATED;
cookie còn tồn tại nhưng không khớp owner trả 401 ACCOUNT_REPLACED. Không đi tới controller nghiệp vụ hoặc enqueue giá.
Yêu cầu đã qua kiểm tra và đang xử lý trước lần login mới có thể hoàn tất; không hủy lượt đã tiếp nhận/ghi SQL.
Logout chỉ xóa owner nếu khớp phiên; một yêu cầu cũ không được xóa owner của phiên mới.

| HTTP | Hành vi |
|---|---|
| POST `/api/auth/login` | CSRF + mật khẩu hợp lệ; regenerate/save rồi đổi phiên, thu hồi phiên cũ |
| GET `/api/auth/me` | Chỉ trả tài khoản khi session còn tồn tại và là phiên hiện tại; không tạo owner |
| POST `/api/auth/control` | Endpoint tương thích, body `{}` và CSRF; chỉ kiểm tra phiên hiện tại, không claim |
| GET `/api/auth/control-status` | Kiểm tra phiên hiện tại để bù tín hiệu lỡ; không claim |
| POST `/api/auth/logout` | CSRF, compare-delete owner của chính phiên rồi destroy session |

Không có endpoint khôi phục quyền bằng cookie cũ hoặc ID người dùng trong body. Nếu mất owner ở Redis,
phải đăng nhập lại bằng mật khẩu; không tự tái tạo owner qua F5/control-status/control.
Session/control từ bản trước có thể yêu cầu đăng nhập lại sau cập nhật; không cần xóa Redis, database hoặc volume.

## Socket và giao diện

Namespace `/account` xác thực cookie/tab và session hiện tại khi handshake. Subscriber ở mỗi API nhận Pub/Sub,
đọc lại Redis rồi ngắt session không còn hợp lệ, tránh thông báo đến trễ ngắt nhầm phiên mới.
Heartbeat tải lại session/kiểm tra owner và HTTP control-status mỗi 5 giây bù Pub/Sub bị lỡ.
Reconnect/F5/focus không thay owner. Namespace `/auctions` vẫn chỉ chứa dữ liệu công khai.

Khi nhận sự kiện thu hồi hoặc HTTP 401 từ API riêng, Frontend xóa user/CSRF, dừng Socket của tài khoản/đấu giá cũ
và chuyển về đăng nhập. Không gọi logout từ tab cũ để tránh tác động lên phiên mới. Đăng nhập mới trong tab này
mở lại các thao tác sau khi server xác thực mật khẩu. Phản hồi 401 cũ đến sau lần đăng nhập mới không xóa trạng thái mới.

Client terminal dùng cookie chung vẫn theo chính sách một phiên; smoke dùng tài khoản UUID riêng.

## Kiểm tra

`accountControl.test.js` bật qua AUTH_TEST_REDIS_URL: hai API/Socket.IO/RedisStore/Lua thật,
model tài khoản/đấu giá giả. Kiểm tra session cũ thực sự bị xóa, replay cookie và /me/bids/control nhận 401,
F5 không hồi sinh, login sai mật khẩu không thay phiên mới, login đúng mới thu hồi phiên hiện tại,
logout cũ không xóa owner mới, mất key buộc login, heartbeat bù Pub/Sub và thông báo trễ không ngắt sai.

Nghiệm thu trên máy nhóm: restart dev:all, F5 và đăng nhập lại tab muốn dùng. Login cùng tài khoản ở tab khác,
xác nhận tab đầu về màn hình đăng nhập. F5 xen kẽ hai tab nhiều lần: tab cũ vẫn chưa đăng nhập, tab mới vẫn dùng được.
Chỉ đăng nhập lại bằng mật khẩu ở tab cũ mới thay phiên. Tài khoản khác phải không bị ảnh hưởng.
