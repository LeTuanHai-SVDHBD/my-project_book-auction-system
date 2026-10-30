<!-- Mục đích: Hợp đồng AI, quy tắc hai điểm độc lập, cấu hình và nghiệm thu có đối chiếu. -->

# Phân tích AI và bộ chấm điểm

AI hỗ trợ Admin đọc sách/media và đối chiếu bằng chứng. Backend tính điểm theo quy tắc cố định;
Admin tiếp tục quyết định phê duyệt hoặc từ chối có lý do. Không có ngưỡng điểm tự động duyệt/từ chối.
Bộ quy tắc `book-review-2026-10-v1` bám phần tiêu chí trong báo cáo `TieuLuanDAMH-Tuan7-Nhom15(1).docx`.

## Cấu hình và khởi động

Dừng `dev:all`, cập nhật nhánh rồi chạy tại thư mục gốc:

```powershell
git switch feat/Hai
git pull --ff-only origin feat/Hai
npm.cmd run setup:ai
```

Script bổ sung biến còn thiếu vào `.env`, giữ giá trị đang có và tắt AI mặc định.
Với máy mới, hoàn thành cài đặt trong README trước. Bản AI không thêm dependency hoặc migration;
schema phần AI giữ nguyên; toàn hệ thống có 21 bảng/161 cột sau migration thông báo 004.

Mở `.env` ở thư mục gốc trên máy phát triển:

```dotenv
AI_ENABLED=true
GEMINI_API_KEY=YOUR_PRIVATE_KEY
GEMINI_MODEL=gemini-3.8-flash
AI_PROVIDER_TIMEOUT_MS=60000
AI_MEDIA_TOTAL_MB=12
```

Thay `YOUR_PRIVATE_KEY` bằng khóa của chính tài khoản Gemini. Không gửi khóa qua chat, không commit `.env`
và không đặt trong `VITE_*`. Có thể đổi model tương thích JSON/ảnh/video nếu tài khoản không được cấp model mặc định.
Cấu hình mẫu theo tài liệu Gemini kiểm tra ngày 24/10/2026; quyền truy cập/quota phụ thuộc tài khoản.
Khởi động lại API và worker sau khi đổi cấu hình:

```powershell
npm.cmd run dev:all
```

Bật AI cũng xử lý các bài đang chờ duyệt chưa có phân tích của phiên bản hiện tại; cân nhắc quota cho số bài tồn.
`AI_ENABLED=false` giữ toàn bộ luồng kiểm duyệt thủ công. Không có khóa hợp lệ thì không xếp phân tích tự động.

## Hai điểm độc lập

### Hỗ trợ đánh giá độ hiếm

| Tiêu chí | Trọng số gốc |
|---|---:|
| Ấn bản giới hạn | 25% |
| Ấn bản đặc biệt và lịch sử xuất bản | 25% |
| Niên đại và bối cảnh lịch sử | 25% |
| Lai lịch và dấu ấn riêng | 25% |

Khi đã có căn cứ quan sát phù hợp: đáp ứng → 100, không đáp ứng → 0.
Chưa xác minh/không đủ căn cứ → NULL, không tự suy thành 0.
Không khẳng định số bản còn lại toàn cầu; không suy từ vẻ cũ ra niên đại, hoặc từ nét ký ra chữ ký thật.
Các nguồn đầu vào chỉ giúp Admin đối chiếu; bản triển khai không tìm kiếm hay xác thực website bên ngoài.

### Tình trạng vật lý

| Tiêu chí | Trọng số gốc |
|---|---:|
| Bìa | 20% |
| Gáy và liên kết | 25% |
| Trang ruột | 30% |
| Mép giấy | 15% |
| Bìa áo | 10% |

| Phân loại quan sát | Điểm |
|---|---:|
| Nguyên vẹn | 100 |
| Hư hại nhẹ | 75 |
| Hư hại vừa | 50 |
| Hư hại nặng | 25 |
| Bị phá hủy/mất được xác định | 0 |

Một tiêu chí có nhiều dấu hiệu lấy mức hư hại nặng nhất (điểm thấp nhất).
Không thấy bìa/trang trong ảnh không đồng nghĩa đã mất. Chỉ loại bìa áo khi có căn cứ ấn bản vốn không có bìa áo.

### Tổng hợp, NULL và làm tròn

Với từng nhóm riêng: `Σ(điểm thành phần × trọng số gốc) / Σ(trọng số áp dụng)`, làm tròn hai chữ số thập phân.
Backend dùng phép chia số nguyên chính xác ở bước làm tròn. Không cộng/trung bình hai nhóm thành một điểm chung.

- **Đã đánh giá:** có quan sát đúng bảng quy đổi, bằng chứng và mã media thực sự đã gửi.
- **Chưa đủ dữ liệu / Cần xác minh:** điểm thành phần NULL. Nếu tiêu chí áp dụng chưa được đánh giá, tổng nhóm NULL.
- **Không áp dụng:** phải có bằng chứng/media; loại trọng số khỏi mẫu số. Không dùng thay cho thiếu ảnh.
- Không còn tiêu chí áp dụng thì tổng NULL. Không chuyển NULL thành 0 và không bỏ tiêu chí thiếu để làm tăng điểm.

Đầu ra có trường ngoài hợp đồng, điểm/trọng số do mô hình tự chèn, mã media hoặc nguồn lạ được chặn/hạ về cần xác minh.
Độ tin cậy chỉ là mô hình tự báo cáo, không dùng làm trọng số hoặc bằng chứng xác thực.

Chạy ví dụ không cần Gemini, SQL hoặc Redis:

```powershell
npm.cmd run ai:example
```

Mẫu `backend/test/fixtures/ai-observations.json` là dữ liệu giả, không phải thẩm định một cuốn sách thật.
Bốn tiêu chí độ hiếm đều đáp ứng → `10000 / 100 = 100`.
Tình trạng: bìa 75, gáy 50, trang 100, mép 75, bìa áo không áp dụng có căn cứ:
`(75×20 + 50×25 + 100×30 + 75×15) / 90 = 6875 / 90 = 76,39`.
Chuyển riêng trang ruột thành thiếu dữ liệu giữ độ hiếm 100 và tình trạng NULL.

## Hợp đồng Gemini và dữ liệu đầu vào

Worker dùng native `fetch` gọi Gemini Interactions REST, `store:false`, JSON Schema với enum:
`criteria[{id,status,findings,evidence,media_refs,sources,confidence,warning}]` và `warnings`.
Gemini trả quan sát, không trả quyết định hoặc điểm tổng. Backend kiểm tra lại toàn bộ trước khi chấm.
`completed` mới được đọc; lỗi quota/HTTP, phản hồi chưa hoàn tất hoặc JSON hỏng không sinh điểm giả.

Chỉ gửi thông tin sách, mô tả bằng chứng và media của bài. Không gửi tài khoản/email, giá, lịch đấu giá,
`gia_toi_thieu` hay nội dung kiểm duyệt. Văn bản bài đăng/media là dữ liệu không tin cậy, không phải chỉ dẫn cho mô hình.

Prompt chỉ gửi một trường `mo_ta_tinh_trang` cho tình trạng, yếu tố quý hiếm và bằng chứng. Phần xem trước `tinh_trang_sach` trùng trong toàn văn không gửi lặp; tình trạng khác biệt của dữ liệu cũ vẫn được kèm với nhãn đã lưu trước đây. Hai điểm và các tiêu chí vẫn tính độc lập như trên. Hash nguồn tiếp tục dùng các trường gốc đầy đủ để giữ khả năng đối chiếu, phát hiện dữ liệu đổi và đọc kết quả phân tích cũ; không sửa hoặc tự gọi lại phân tích đã lưu chỉ vì đổi cách trình bày prompt.

Worker chỉ tải HTTPS từ đúng `res.cloudinary.com/<cloud-name>/...` của dự án, không theo redirect.
Kiểm tra loại media, MIME, magic bytes, kích thước và deadline trước khi gửi.
Tổng bytes thô mặc định tối đa 12 MiB, ảnh/video nhỏ được gửi inline; base64 làm tăng kích thước khoảng một phần ba.
Đây là ngân sách AI riêng, không thay giới hạn upload 10 MB/ảnh và 50 MB/video.
Video lớn hoặc tệp vượt ngân sách không được gửi; lưu manifest/cảnh báo và giữ thiếu dữ liệu cho phần không quan sát được.
Chưa có nén, cắt video, trích frame hoặc Files API. Thời lượng video chưa được kiểm tra.

Nguồn URL chỉ được chấp nhận nếu đã xuất hiện trong văn bản đầu vào và dùng HTTPS.
Worker không truy cập URL nguồn, không tuyên bố đã xác minh nội dung nguồn.
Admin cần tự kiểm tra xuất xứ/giấy tờ với dữ liệu thực tế, đặc biệt chữ ký, con dấu và lai lịch.

## Vòng đời, lưu trữ và phục hồi

Sau COMMIT đăng mới, đăng lại hoặc gửi duyệt lại, API xếp job vào stream AI riêng.
Một vòng worker riêng xử lý một job tại một thời điểm, dùng kết nối BLOCK khác với đặt giá/chốt hạn.
Mỗi 15 giây đối soát bài pending chưa có phân tích của `row_version` hiện tại để bù enqueue lỗi.

Job mang request UUID, ID bài, version và hash đầu vào. Redis giữ trạng thái queued/running/done/skipped,
cache kết quả đã kiểm tra trước khi ghi SQL; lease theo bài bảo vệ xử lý đồng thời.
Con trỏ job theo bài và dữ liệu job có TTL 24 giờ, tránh hết con trỏ khi nhiều bài đang xếp hàng.
SQL khóa bài/phiên, kiểm tra lại pending/version rồi lưu một PhanTichAI và các ChiTietPhanTichAI trong cùng transaction.
Không sửa trạng thái bài/phiên. Nếu Admin đã duyệt/từ chối hoặc chủ sách gửi lại dữ liệu mới, bỏ kết quả đến muộn.

Dùng hai bảng đã có, không thêm cột. Một chi tiết nhóm `khac` chứa metadata có phiên bản:
request UUID, hash đầu vào, source version, model, bộ quy tắc, media đã gửi/bỏ qua, cảnh báo/mã lỗi.
UI tách metadata khỏi chín tiêu chí. Mỗi lần phân tích là một bản ghi mới, giữ lịch sử; API trả 20 lần gần nhất.
Hash/version giúp đánh dấu kết quả thuộc dữ liệu cũ; dữ liệu lịch sử chưa có metadata vẫn xem được, có cảnh báo.

Lỗi provider được lưu trạng thái `that_bai`, cả hai điểm NULL; thiếu dữ liệu là `chua_day_du`.
Không tự gọi lại vô hạn cho cùng version đã có kết quả (kể cả thất bại); Admin chủ động **Phân tích lại bằng AI**.
Lỗi SQL giữ stream pending, reclaim sau ba phút. Replay sau SQL COMMIT tìm receipt trước và không ghi/gọi lại.
Cache kết quả giúp retry SQL không tốn thêm lượt Gemini khi cache còn tồn tại.
Crash trước khi cache hoặc mất Redis có thể gọi provider lại; không cam kết gọi Gemini đúng một lần.
Redis mất dữ liệu được bù bài pending từ SQL; không tự khôi phục lịch sử trạng thái job Redis đã mất.

## Quyền và giao diện

- `GET /api/ai/:id?analysis=<id>`: chủ bài hoặc Admin; lần phân tích phải thuộc đúng bài.
- `POST /api/ai/:id`: chỉ Admin, đăng nhập + CSRF, body chỉ có `row_version` hiện tại; trả 202 khi xếp hàng.
- Chủ bài xem phân tích trong **Bài của tôi**; Admin xem trong **Kiểm duyệt**. Người mua/khách không có API phân tích riêng.
- Hiển thị chờ xử lý, đang phân tích, thành công/chưa đầy đủ/thất bại; tự đọc lại sau mỗi lần tải xong và chờ ba giây.
- Hai điểm, lý do NULL, trọng số, bằng chứng, nguồn, cảnh báo, manifest, model/quy tắc, phép tính và lịch sử có thể đối chiếu.
- Nút duyệt/từ chối hiện tại tiếp tục hoạt động khi AI tắt, thiếu dữ liệu hoặc lỗi. Phê duyệt vẫn cần xác nhận bằng chứng quý hiếm.

## Chẩn đoán khi smoke báo AI_PROVIDER_ERROR

`Đang kiểm tra Gemini thật; dữ liệu mẫu thiếu ảnh nên điểm phải giữ NULL` là mô tả dữ liệu thử,
không phải lỗi. Smoke cố ý gửi bài không ảnh để kiểm tra NULL. Nếu đã nhận bản ghi `that_bai`,
worker đã lưu lần phân tích thất bại; mã chung cũ chưa phân biệt lỗi HTTP, mạng hoặc phản hồi JSON.
Dòng dọn dữ liệu chỉ xác nhận đã dọn fixture SQL của lần smoke, không biến smoke thành PASS.

Sau khi cập nhật mã, chạy tại thư mục gốc:

```powershell
npm.cmd run ai:check
```

Lệnh đọc `.env` gốc, dùng đúng model/client của worker, gọi Gemini **một lần** với văn bản mẫu không ảnh.
Không cần API/worker/SQL/Redis đang chạy, không tạo tài khoản/bài thử và không đọc cache lỗi cũ.
Lệnh dùng quota thật nếu đã bật AI/có khóa. Chỉ PASS xác nhận JSON dùng được và quy tắc NULL của mẫu;
chưa xác nhận tích hợp SQL/hàng đợi hoặc chất lượng phân tích ảnh sách.

Khi FAIL, in mã ứng dụng, HTTP, mã provider/transport thuộc allowlist nếu có.
Riêng lệnh mẫu còn in tối đa 600 ký tự thông báo Google đã che khóa cấu hình/query key và bỏ control characters;
không in toàn bộ response/headers. Worker không lưu thông báo/body provider vào SQL vì có thể phản chiếu dữ liệu bài.
Giao diện và smoke lấy mã/hướng xử lý an toàn từ metadata; dữ liệu lỗi cũ vẫn thiếu thông tin HTTP đã bị bỏ.
Có thể gửi kết quả lệnh để đối soát, không gửi `.env`, khóa hoặc headers riêng.

| Mã ứng dụng mới | Hướng kiểm tra |
|---|---|
| `AI_KEY_INVALID` | Key thiếu/sai/hết hạn hoặc Google trả xác thực lỗi; sửa `.env`, khởi động lại API/worker |
| `AI_ACCESS_DENIED` | Quyền key, API/project, hạn chế IP/referrer và quyền truy cập model |
| `AI_BILLING_REQUIRED` | Billing/số dư project; không tự thử lại liên tục |
| `AI_MODEL_NOT_FOUND` | Tên model hoặc tài nguyên/endpoint không khả dụng với tài khoản |
| `AI_REQUEST_REJECTED` | Cấu trúc/giới hạn tham số hoặc điều kiện project; đọc thông báo lệnh mẫu để xác định |
| `AI_QUOTA_EXCEEDED` | Quota hoặc giới hạn lượt/token |
| `AI_NETWORK_ERROR` | DNS/proxy/TLS/kết nối máy chạy worker; có thể có `ENOTFOUND` hoặc mã TLS |
| `AI_TIMEOUT` | Kết nối hoặc thời gian chờ provider |
| `AI_INVALID_RESPONSE` / `AI_INCOMPLETE_RESPONSE` | JSON không hợp đồng hoặc chưa hoàn tất |

Không kết luận key sai hoặc tự đổi model chỉ từ `AI_PROVIDER_ERROR` cũ.
Sau khi sửa nguyên nhân/cấu hình, khởi động lại `dev:all`, chạy lại `smoke:ai` để nghiệm thu toàn luồng.
Model mặc định, payload, schema, bộ điểm và nhà cung cấp vẫn là Gemini; bản sửa này bổ sung chẩn đoán.

## Kiểm tra và nghiệm thu

```powershell
npm.cmd run test:ai
npm.cmd run check
npm.cmd run build
```

Mặc định provider/SQL được giả ở unit test, test dịch vụ thật chỉ chạy khi opt-in.
Bật `AUTH_TEST_REDIS_URL=redis://127.0.0.1:63790` để chạy Redis thật theo README.
Test SQL AI riêng cần database `BookAuctionTest_*` và `AI_TEST_SQL=true`, tự tạo/nâng schema và dọn fixture UUID;
không đặt tên database làm việc của nhóm vào cấu hình test.

Khi API/worker/SQL/Redis thật đang chạy, Gemini đã bật và có quota:

```powershell
npm.cmd run smoke:ai
```

Smoke dùng một lượt Gemini thật cho bài mẫu không có ảnh: kiểm tra JSON/SQL, giữ hai điểm NULL,
chủ bài/Admin thấy cùng bản ghi và bài vẫn chờ quyết định. Dọn đúng tài khoản/bài SQL của lần chạy;
job chưa rõ hoàn tất giữ fixture và báo FAIL để đối soát. Redis job hết TTL, không FLUSHDB.
Smoke này không thay nghiệm thu chất lượng thẩm định ảnh/video thật hoặc xác thực nguồn.
Nếu chỉ nghiệm thu đấu giá/media mà không muốn phát sinh lượt Gemini cho fixture, tắt AI rồi khởi động lại API/worker.

Nghiệm thu thủ công: dùng sách có bộ ảnh đủ/thiếu, mở bằng chứng từng tiêu chí, tự tính lại hai tổng;
thử quota lỗi, gửi duyệt lại, phân tích lại, chọn lịch sử và quyết định Admin. Không dùng điểm AI đơn lẻ để kết luận sách thật/hiếm.
Bằng chứng đã chạy và giới hạn còn lại tại [VALIDATION.md](../VALIDATION.md).

## Tài liệu nhà cung cấp

Kiểm tra ngày 24/10/2026:

- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Interactions REST API](https://ai.google.dev/api/interactions-api)
- [Gemini models](https://ai.google.dev/gemini-api/docs/models)
- [Image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Video understanding](https://ai.google.dev/gemini-api/docs/video-understanding)
- [Gemini API errors](https://ai.google.dev/gemini-api/docs/api-errors)
