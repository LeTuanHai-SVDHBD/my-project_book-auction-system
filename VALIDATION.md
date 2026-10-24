<!-- Mục đích: Ghi bằng chứng kiểm tra, phụ thuộc thật/giả và giới hạn nghiệm thu. -->

# Kết quả kiểm tra

Cập nhật ngày 24/10/2026. Kết quả trong môi trường chuẩn bị được phân biệt với xác nhận trên máy nhóm.
Không coi việc Admin duyệt thành công hoặc probe completed là bằng chứng toàn bộ nghiệp vụ đã đạt.

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
| Full test bật SQL/Redis thật | 87/87 PASS, không SKIP |
| Test mặc định | 71 PASS, 6 SKIP theo opt-in, không FAIL |
| Check cú pháp | PASS 73 file |
| Build Frontend | Đã đạt; không thêm dependency |
| db:init và db:migrate | PASS trên database kiểm tra, có chạy migration lặp lại |
| smoke | PASS với SQL/Redis/API/worker thật, Socket.IO hello và probe |
| smoke:auth | PASS qua API và SQL/Redis thật, cleanup tài khoản thử hoàn tất |
| smoke:m5 | PASS toàn luồng thật, cleanup dữ liệu thử hoàn tất |
| Browser đấu giá | PASS nhiều tab cùng context, trạng thái chờ, lỗi mạng/retry, người thắng và mobile |
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
kiểm tra readiness 20 bảng/152 cột và chạy smoke:m5 trên SQL Server 2022/Redis Compose.
Chạy lại smoke:m4 để nghiệm thu media/đăng lại với Cloudinary thật.
Đối chiếu hai tab, nhập tiền, đặt giá và xem kết quả qua giao diện.

Chưa có thực nghiệm tải lớn hoặc production HTTPS. Realtime nghiệp vụ, AI và xác nhận hoàn tất giao dịch
chưa triển khai. Claim media chưa rõ COMMIT vẫn cần đối soát thủ công; dead-letter đấu giá cũng cần đối soát riêng.
