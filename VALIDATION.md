<!-- Mục đích: Ghi bằng chứng kiểm tra, phụ thuộc thật/giả và giới hạn nghiệm thu. -->

# Kết quả kiểm tra

Cập nhật ngày 24/10/2026. Kết quả trong môi trường chuẩn bị được phân biệt với xác nhận trên máy nhóm.
Không coi việc Admin duyệt thành công hoặc probe completed là bằng chứng toàn bộ nghiệp vụ đã đạt.

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
| Test mặc định | 97 PASS, 9 SKIP theo opt-in, không FAIL |
| Test bật Redis thật | 104 PASS, 2 SKIP dành cho SQL Server |
| Check cú pháp | PASS 101 file |
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
AI đã triển khai, chờ Gemini/SQL thật; xác nhận hoàn tất giao dịch chưa triển khai. Claim media chưa rõ COMMIT vẫn cần đối soát thủ công;
dead-letter đấu giá cũng cần đối soát riêng.
