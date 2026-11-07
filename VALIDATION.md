<!-- Mục đích: Bằng chứng, giới hạn kiểm chứng và cách nghiệm thu; không trộn triển khai với PASS dịch vụ thật. -->

# Kiểm chứng và nghiệm thu

## Giữ trạng thái ổn định sau lần phân tích AI thất bại

- `npm run check`, `npm test` và `npm run build` đều đạt: 212 PASS, 12 SKIP (dịch vụ thật), tổng 224 test.
- Mô phỏng timeout xác nhận worker bỏ job tự động cũ, chỉ chạy lại theo yêu cầu gắn với kết quả mới nhất và vẫn tự chạy lần đầu cho vòng mới. HTTP fixture xác nhận job cũ không làm giao diện hiện lại tiến độ.
- Không có migration mới; chưa chạy Gemini, Redis hoặc SQL thật trong lần sửa này.

## Tạm dừng khi Gemini báo 429

- `npm run check`, `npm test` và `npm run build` đều đạt. Bộ test có 211 PASS, 12 SKIP (dịch vụ thật), 223 bài.
- Fixture xác nhận 429 dừng lượt phân tích, không gọi model dự phòng; 429 khi upload video dừng các lượt gửi tiếp theo. Worker giữ bài chờ và không chạy lượt tự động cũ của cùng phiên bản.
- HTTP test kiểm tra chặn nút thử lại qua API trong thời gian tạm dừng, header `Retry-After`, cho phép Admin thử lại sau thời hạn và không lộ chẩn đoán riêng cho người bán.
- Chưa chạy Gemini, Redis hoặc SQL thật trong lần sửa này; không có migration mới.

## Tự xếp hàng kiểm duyệt và phục hồi Gemini 503

- `npm run check`, `npm test` và `npm run build` đều đạt. Bộ test có 207 PASS, 12 SKIP (dịch vụ thật), 219 bài.
- HTTP fixture kiểm tra Admin chỉ yêu cầu phân tích lại sau khi có lượt phân tích cùng phiên bản; chủ bài không nhận chẩn đoán riêng của Gemini.
- Kiểm thử mô phỏng 503 có `Retry-After`, model dự phòng, giữ media và giới hạn lượt. Kiểm thử xếp hàng sau COMMIT, không xếp trùng khi replay và giữ kết quả lưu bài khi Redis lỗi.
- Không có migration mới. Chưa chạy `smoke:ai` với API key Gemini, SQL và Redis thật trong lần sửa này.

## Cập nhật BookBid và tự duyệt — 06/11/2026

| Kiểm tra | Kết quả |
|---|---|
| `npm run check` | PASS, 159 tệp JavaScript phía máy chủ, script và dùng chung |
| `npm test` | 204 PASS, 12 SKIP, 216 bài; không có bài thất bại |
| `npm run build` | PASS, 97 modules |
| Chromium và API dữ liệu mẫu | Kiểm tra trang khách, tài khoản, danh mục/chi tiết phiên, đăng sách/bài của tôi, giao dịch, khiếu nại, danh sách/chi tiết Admin, AI, thông báo và hạ tầng |
| Kích thước giao diện | Đo khung 320/390/768/1440 px; các trang được đo không tràn ngang toàn trang |
| Tương tác UI | Tìm kiếm rỗng/lỗi, Home/End gallery, trạng thái lượt giá mô phỏng, bốn bước gửi lại, gỡ ảnh cũ và khôi phục nháp, thông báo/Escape, menu Admin di động |
| Quyết định tự duyệt | Test hai ngưỡng độc lập, biên bằng ngưỡng, NULL và lỗi kỹ thuật, chống replay/version cũ, chặn thao tác Admin khi bật tự duyệt. UI fixture xác nhận lý do và nguồn AI hiển thị đúng. |

Schema đích sau [migration 008](backend/migrations/008_auto_moderation.sql): **21 bảng, 166 cột, 100 CHECK, 15 UNIQUE constraints**.
Lượt này chưa chạy migration/SQL opt-in, Redis thật, Gemini thật hoặc smoke. Kiểm tra trên dịch vụ thật bằng `npm.cmd run db:migrate`, `npm.cmd run smoke:ai` và hồ sơ có ảnh/video sau khi cấu hình [hai ngưỡng](docs/ai-analysis.md#kiểm-duyệt-tự-động). Các bài test SQL mới kiểm tra cùng COMMIT, rollback và đúng snapshot khi có database test.

## Lượt rà soát tài liệu trước đó

Rà soát tài liệu ngày **03/11/2026** trên mã nguồn `feat/Hai`, commit
[c546219](https://github.com/LeTuanHai-SVDHBD/my-project_book-auction-system/commit/c546219532bccdce858dde4863274087e6448446).
Lượt này chỉ sửa Markdown, không sửa runtime, dependency, schema hoặc cấu hình riêng.

## Cách đọc bằng chứng

| Nhãn | Ý nghĩa |
|---|---|
| Đã triển khai | Có mã nguồn thực hiện; không tự đồng nghĩa dịch vụ thật đã đạt |
| Test/HTTP fixture | Dùng policy/router/service thật nhưng thay một số SQL/Redis/provider bằng fixture |
| Opt-in / SKIP | Chưa thực thi nếu chưa có cờ và dịch vụ yêu cầu; không được tính PASS |
| Smoke dịch vụ thật | Cần API/worker/SQL/Redis và provider tương ứng đang chạy |
| Nhóm xác nhận | Báo cáo từ máy của nhóm, không phải lượt chạy lại ở môi trường rà soát này |

Các mục lịch sử đầy đủ, gồm điều kiện chạy và các kết quả cũ, đã được giữ tại
[nhật ký đến 01/11/2026](docs/archive/validation-2026-11-01.md). Mô tả AI tự chạy, schema 20/152 hoặc 21/162
trong nhật ký là trạng thái phiên bản cũ; hợp đồng hiện tại nằm trong README/docs chuyên đề.

## Baseline mã nguồn gần nhất đã được báo cáo

Nguồn: mục Video AI dài của nhật ký và commit c546219; **không phải bộ test vừa chạy lại ngày 03/11**.

| Kiểm tra | Kết quả đã báo cáo | Giới hạn |
|---|---|---|
| `npm.cmd run check` | PASS 155 tệp JS server/scripts/shared | Không biên dịch JSX |
| `npm.cmd test` | **195 PASS, 12 SKIP**, tổng 207 | 12 bài dịch vụ thật chưa được chạy trong lượt đó |
| `npm.cmd run build` | PASS 94 modules | Không chứng minh provider/DB hoạt động |
| Chromium + HTTP/session/CSRF | PASS ở 1440/768/390/320 px | Model/queue/provider có fixture; không phải toàn bộ SQL/Redis/Gemini thật |
| Video mẫu | MP4 tổng hợp hợp lệ 366 giây, qua Files client/processor/UI | Google HTTP giả lập; không nghiệm thu chất lượng thẩm định sách |
| Ranh giới video | Test 13 MiB/metadata >6 phút, ảnh hết ngân sách vẫn gửi video | Không phải video của người dùng đã được Google phân tích thật |

Các bài mới bao phủ: nháp/tệp đổi đuôi, gửi lại hồ sơ và media lịch sử, AI manual/legacy auto bị bỏ qua,
video tuần tự/ACTIVE/URI/cleanup, lỗi/timeouts, retry payload và quyền/session/CSRF.
Snapshot/PDF, thuật toán giá, quyền tương tác và định dạng tiền có các test riêng trong `backend/test/`.

## Xác nhận đã nhận từ nhóm

Nhóm đã báo hoàn thành các mốc đến **Mốc 8**, có xác nhận smoke tài khoản, nghiệp vụ đấu giá/realtime
và `smoke:ai` PASS ở các thời điểm trước. Xác nhận này ghi nhận tiến độ dự án, không tự chứng minh những
thay đổi sau đó về nháp, hồ sơ, PDF, Cloudinary recovery hoặc Gemini Files API đều đã được smoke trên máy nhóm.
Chất lượng hai điểm/bằng chứng cần đối chiếu bằng bản sách, ảnh và video thực tế. Các lần xác nhận trước đây dùng chế độ Admin duyệt.

Chưa có bằng chứng mới xác nhận: Google Files/Interactions với video thật của người dùng, mọi bộ SQL opt-in
trên revision hiện tại, CDN bằng chứng riêng tư, tải lớn hoặc triển khai production HTTPS.
Không có bảng benchmark tải/P95 cho dự án này để suy ra khả năng chịu tải production.

## Kiểm tra tài liệu ngày 03/11/2026

Lượt rà soát này đối chiếu Markdown với source đã clone đúng commit nêu trên:

- Lệnh npm và workspace từ package.json; Node 24.x và lockfile.
- Compose/cổng/volume, setup bảo toàn cấu hình, init/migrate và manifest schema 21/165/99/15.
- Router/controller/service/model, trạng thái bài/phiên, body/version, cursor/page và quyền.
- AI manual, ảnh inline/video Files, timeout/cleanup, công bố kết quả và snapshot PDF.
- Biểu mẫu/nháp, gallery, thông báo và cách lấy lại trạng thái khi reconnect.
- Kiểm tra link tương đối, anchor, ví dụ JSON, block Markdown, lệnh tham chiếu và diff chỉ có `.md`.

Chỉ kiểm tra liên kết tương đối/anchor trong repository, không xác minh lại mọi URL ngoài hoặc giới hạn nhà cung cấp.
Không chạy lại `npm test`, build hoặc smoke vì không đổi mã chức năng; không nâng kết quả lịch sử thành PASS mới.
Chi tiết tổng số file/link kiểm tra của lượt tài liệu được ghi trong commit bàn giao.

## Tự kiểm tra mã nguồn

Tại gốc repository, sau cài dependency:

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build
npm.cmd run test:ai
npm.cmd run test:community
npm.cmd run ai:example
```

Hai lệnh `test:*` là tập con; chạy toàn bộ test rồi không cần chạy lại chúng nếu không có lý do.
`ai:example` không gọi provider. `ai:check` dùng Gemini thật với văn bản, không kiểm tra SQL/Redis/video.
Không có npm script `lint`, `smoke:m3`, `smoke:m7` hoặc `smoke:media`.

### Redis opt-in

Chuẩn bị Redis **kiểm thử riêng**, ví dụ ở cổng 63800; các lệnh sau không tự tạo dịch vụ đó.
Không dùng FLUSHDB hoặc thay REDIS_URL của ứng dụng để chạy test.

```powershell
$env:AUTH_TEST_REDIS_URL = "redis://127.0.0.1:63800"
try {
  npm.cmd test
} finally {
  Remove-Item Env:AUTH_TEST_REDIS_URL -ErrorAction SilentlyContinue
}
```

Cờ này bật session/owner, khóa, Streams/realtime và ledger media/AI có Redis thật;
model/provider có thể vẫn là fixture. Chỉ gọi một bài “tích hợp thật” cho đúng thành phần thực sự dùng.

### SQL opt-in

Dùng database riêng có tên **BookAuctionTest_***, giữ thông tin kết nối SQL hợp lệ trong cấu hình.
Khởi tạo/nâng schema test hiện tại trước; một số bài test tự áp dụng một phần migration lịch sử,
không nên dựa vào chúng để thay bước chuẩn bị toàn bộ schema 008.
Bật **một cờ SQL mỗi lần** để tránh các bộ test đồng thời sửa migration trên cùng database:

```powershell
$env:DB_DATABASE = "BookAuctionTest_Verify"
$env:AUTH_TEST_REDIS_URL = "redis://127.0.0.1:63800"
try {
  npm.cmd run db:init
  $env:AUCTION_TEST_SQL = "true"
  npm.cmd test
} finally {
  Remove-Item Env:AUCTION_TEST_SQL -ErrorAction SilentlyContinue
  Remove-Item Env:AUTH_TEST_REDIS_URL -ErrorAction SilentlyContinue
  Remove-Item Env:DB_DATABASE -ErrorAction SilentlyContinue
}
```

| Cờ | Phạm vi |
|---|---|
| `AUCTION_TEST_SQL=true` | Transaction đấu giá, receipt/replay/chốt hạn; còn cần AUTH_TEST_REDIS_URL |
| `AI_TEST_SQL=true` | Lưu hai điểm/chi tiết, rollback/replay và source version; không gọi Gemini thật |
| `COMMUNITY_TEST_SQL=true` | Giao dịch/chat/xác nhận/đánh giá/khiếu nại/bình luận |
| `REVIEW_TEST_SQL=true` | Snapshot theo vòng, migration chạy lại, quyền và dữ liệu legacy |

Để kiểm tra nhóm khác, thay cờ trong ví dụ và xóa đúng cờ đó trong finally. Không bật đồng thời cả bốn cờ.
Các test dùng fixture UUID và guard tên database, nhưng vẫn phải kiểm tra đúng server/database trước khi chạy.
Ví dụ trên giả định terminal chưa có các biến test; nếu đã có cấu hình riêng, lưu/khôi phục giá trị thay vì xóa.

## Smoke trên môi trường phát triển

Cài/nâng cấp theo [setup-guide.md](docs/setup-guide.md), giữ `dev:all` ở terminal thứ nhất.
Terminal thứ hai kiểm tra readiness rồi chạy từng lệnh:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/health/ready | ConvertTo-Json -Depth 8
npm.cmd run smoke
npm.cmd run smoke:auth
npm.cmd run smoke:m4
npm.cmd run smoke:m5
npm.cmd run smoke:m6
npm.cmd run smoke:ai
npm.cmd run smoke:m8
```

Không chạy nguyên danh sách khi provider còn chưa cấu hình: m4 cần Cloudinary, smoke:ai cần Gemini bật/key/quota.
M5/m6/m8 không cần Cloudinary; m8 chưa nghiệm thu ảnh khiếu nại thật. Smoke tạo/dọn fixture riêng,
chỉ PASS khi hoàn tất cleanup; job chưa rõ kết quả có thể giữ fixture, ghi ID/run để đối soát.
Readiness đạt không chứng minh khóa/quyền/quota Cloudinary/Gemini hoặc codec phát được.

`smoke:ai` hiện xác nhận bài mới **chưa có job**, Admin yêu cầu rồi mới đợi Gemini/worker/SQL;
fixture không ảnh phải giữ NULL. PASS lệnh này chưa chứng minh video Files API thật hay chất lượng thẩm định.
Đăng bài có video thật, Admin bấm phân tích, so manifest/timestamp/hai điểm với bằng chứng là kiểm tra riêng.

## Lưu bằng chứng bàn giao

Ghi commit, ngày, môi trường, lệnh, exit code, PASS/SKIP/FAIL và thành phần thật/fixture.
Che mật khẩu, cookie, API key, Authorization, dữ liệu cá nhân/chat không cần thiết.
Đặt log/ảnh được chọn ở `academic/evidence/` theo [quy ước](academic/README.md);
checklist chức năng hiện tại ở [tasks.md](docs/tasks.md). Không xóa dữ liệu ứng dụng để làm test chuyển sang PASS.
