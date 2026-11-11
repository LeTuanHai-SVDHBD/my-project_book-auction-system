<!-- Mục đích: Hợp đồng AI, quy tắc hai điểm độc lập, cấu hình và nghiệm thu có đối chiếu. -->

# Phân tích AI và bộ chấm điểm

Gemini đọc hồ sơ và trả quan sát có cấu trúc. Backend tính hai điểm độc lập theo quy tắc cố định.
AI tự phân tích sau khi gửi hồ sơ; hai ngưỡng chỉ tạo khuyến nghị. Chỉ Admin phê duyệt/từ chối và xác nhận lý do. Admin vẫn có thể quyết định khi AI lỗi, thiếu bằng chứng hoặc điểm thấp.
Bộ quy tắc `book-review-2026-10-v1` được định nghĩa trong
[criteria.js](../backend/src/ai/criteria.js) và [scoring.js](../backend/src/ai/scoring.js).
Tài liệu đối chiếu source ngày 11/11/2026; không thay thế thử chất lượng thẩm định bằng sách thật.

## Cấu hình và khởi động

Cài mới/nâng schema theo [setup-guide.md](setup-guide.md). Tại gốc repository:

```powershell
npm.cmd run setup:ai
```

Script chỉ bổ sung biến thiếu, giữ key/cờ bật/timeout đang có; AI tắt mặc định.
Migration 010 cho Admin ghi quyết định kèm lần phân tích được tham khảo; chặn INSERT quyết định mới không có Admin, giữ lịch sử AI cũ. Không thêm bảng hoặc SDK.
Toàn hệ thống hiện có 21 bảng/172 cột sau migration 010; không dùng số schema của phiên bản trước.

Mở `.env` ở thư mục gốc trên máy phát triển:

```dotenv
AI_ENABLED=true
GEMINI_API_KEY=YOUR_PRIVATE_KEY
GEMINI_MODEL=gemini-3.8-flash
GEMINI_FALLBACK_MODEL=
AI_PROVIDER_TIMEOUT_MS=60000
AI_PROVIDER_MAX_TIMEOUT_MS=300000
AI_PROVIDER_MAX_ATTEMPTS=2
AI_MEDIA_PREPARE_TIMEOUT_MS=45000
AI_THINKING_LEVEL=low
AI_MEDIA_TOTAL_MB=12
AI_VIDEO_MAX_MB=100
AI_VIDEO_PREPARE_TIMEOUT_MS=300000
AI_VIDEO_DOWNLOAD_TIMEOUT_MS=120000
```

Thay `YOUR_PRIVATE_KEY` bằng khóa của chính tài khoản Gemini. Không gửi khóa qua chat, không commit `.env`
và không đặt trong `VITE_*`. Có thể đổi model tương thích JSON/ảnh/video nếu tài khoản không được cấp model mặc định.
Cấu hình mẫu theo tài liệu Gemini kiểm tra ngày 31/10/2026; quyền truy cập/quota phụ thuộc tài khoản.
Khởi động lại API và worker sau khi đổi cấu hình:

```powershell
npm.cmd run dev:all
```

`AI_ENABLED` bật Gemini. Nếu chưa bật hoặc thiếu key, bài vẫn chờ kiểm duyệt. Giá trị `AI_AUTO_MODERATION` cũ không còn điều khiển luồng bài đăng.

## Admin quyết định, AI hỗ trợ

Dừng API và worker, chạy `npm.cmd run db:migrate` để áp dụng đến migration 010 rồi khởi động lại cả hai.
Các biến `AI_MIN_RARITY_SCORE` và `AI_MIN_CONDITION_SCORE` vẫn là số nguyên 1–100, mặc định 70; chỉ dùng làm ngưỡng khuyến nghị.

| Tình huống | Hành vi |
|---|---|
| Hai nhóm đạt ngưỡng | Hiện khuyến nghị đạt; bài vẫn chờ Admin |
| Điểm thấp hoặc thiếu bằng chứng | AI gợi ý căn cứ cần xem lại; không tự từ chối |
| Lỗi Gemini/429/media hoặc chưa cấu hình | Admin thấy lỗi và có thể quyết định theo bằng chứng; không biến lỗi thành điểm 0 |
| Admin quyết định | Bắt buộc lý do; phê duyệt cần xác nhận đã đối chiếu bằng chứng |
| AI trả kết quả sau quyết định Admin | Không ghi phân tích trễ hoặc thay đổi quyết định |

Sau COMMIT bài mới/gửi lại/đăng lại, API xếp hàng phân tích. Worker quét để phục hồi job đầu của vòng mới.
Không tự chạy lượt mới sau khi đã lưu kết quả/lỗi cùng phiên bản; nút **Phân tích lại bằng AI** dành cho Admin, vẫn tuân thủ quota.
Ngưỡng không khóa quyền quyết định của Admin. Lý do AI là gợi ý có thể sửa; nội dung đang nhập không bị polling ghi đè.
Chỉ quyết định Admin mới công bố kết quả cho người bán. Hồ sơ được duyệt mới đặt lịch/kích hoạt theo luồng hiện hành.

`KiemDuyet.admin_id` xác định người quyết định; `phan_tich_id` có thể cùng tồn tại để giữ điểm/bằng chứng trong PDF và màn hình người mua.
Không gán Admin giả cho quyết định AI cũ. Hai điểm không chứng thực ấn bản hay chữ ký.

## Thời gian phân tích dành cho Admin

Metadata SQL lưu tải đầu vào và thời gian thực tế. Thống kê chọn tối đa 20 mẫu trong 200 lần thành công gần nhất,
cùng model/bộ quy tắc/phiên bản thống kê và nhóm độ dài văn bản, số ảnh, số video.
Khi chuẩn bị media đã xác định được thời lượng và bytes, thu hẹp nhóm theo các thông số này.
Cần tối thiểu 5 mẫu; ít hơn thì ghi rõ chưa đủ dữ liệu, không tự đặt con số ước lượng.
Không dùng giới hạn timeout làm thời gian trung bình. Tổng xử lý gồm chuẩn bị media và các lượt gọi Gemini,
không gồm chờ hàng đợi; đồng hồ chờ và đồng hồ xử lý được hiển thị riêng.
Thống kê không phải cam kết hoàn tất. Không công bố tiến độ/thống kê này cho người bán đang chờ duyệt.

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
Nhãn sở hữu đọc được là dấu hiệu quan sát được, không tự xác nhận chuỗi sở hữu hay tính xác thực.
URL do người đăng cung cấp được ghi là chưa đối chiếu độc lập; hệ thống không truy cập hay xác thực website bên ngoài.

**Lai lịch và dấu ấn riêng** vẫn chiếm 25%, không dùng **Không áp dụng**.
Nếu hồ sơ không khai dấu ấn hay lai lịch đặc biệt và ảnh chụp đủ rõ các vị trí liên quan nhưng không ghi nhận dấu ấn,
Gemini trả **Đã đánh giá / không đáp ứng** kèm mã ảnh; Backend chấm 0 riêng tiêu chí này.
Thiếu ảnh thì giữ **Chưa đủ dữ liệu**; có dấu hiệu hoặc lời khai chưa xác thực thì giữ **Cần xác minh**.
Ba tiêu chí độ hiếm đạt 100 và tiêu chí này được chấm 0 cho tổng độ hiếm 75/100.

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

Khi hồ sơ chưa đạt, lý do nêu tiêu chí còn thiếu hoặc cần xác minh, quan sát hiện có và ảnh/tài liệu nên bổ sung.
Chẳng hạn, tiêu chí mép giấy cần ảnh mép trên, mép dưới và mép ngoài khi đóng sách.
Admin đối chiếu các điểm cần xác minh, quyết định hoặc yêu cầu người bán bổ sung bằng lý do từ chối.

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

Worker chỉ tải HTTPS từ đúng `res.cloudinary.com/<cloud-name>/<image|video>/upload/...` của dự án,
không theo redirect; kiểm tra MIME/magic bytes, dung lượng và deadline trước khi gửi.
Ảnh tải tối đa bốn luồng/lô, mỗi tải 15 giây, cả bước ảnh mặc định 45 giây.
`AI_MEDIA_TOTAL_MB` (tên cũ giữ tương thích) nay chỉ là ngân sách **ảnh inline**, mặc định/tối đa 12 MiB.
Base64 ảnh làm tăng payload khoảng một phần ba; hết ngân sách ảnh vẫn tiếp tục chuẩn bị video.
Giữ thứ tự và mã M1… theo dữ liệu gốc để đối chiếu.

Video được xử lý **từng tệp một**: tải bản Cloudinary phù hợp → upload resumable lên Gemini Files API
→ poll tới `ACTIVE` → gửi `uri` vào video content của Interactions API. Không đặt offset cắt clip,
không có giới hạn nội dung 5 phút; tệp trên 12 MiB không dùng chung ngân sách ảnh.
Mặc định tối đa 100 MiB/video ở nhánh AI, 120 giây tải Cloudinary và 300 giây/tệp cho toàn quá trình
lấy tệp/upload/poll, kể cả đọc body. Có thể cấu hình lần lượt bằng `AI_VIDEO_MAX_MB` (1–100),
`AI_VIDEO_DOWNLOAD_TIMEOUT_MS` (1000–300000), `AI_VIDEO_PREPARE_TIMEOUT_MS` (1000–600000).
Đây là giới hạn tài nguyên, không phải giới hạn thời lượng nội dung. Upload gốc vẫn 50 MB/video,
tối đa 3 video/bài theo mặc định; giới hạn này chưa thay đổi. Bản MOV/AVI… dùng bản chuyển MP4 của
Cloudinary có thể khác dung lượng gốc và chịu hạn mức chuyển đổi của tài khoản.

Files API dùng khóa Backend hiện có, không thêm SDK/ffmpeg/dependency. Upload URL phải thuộc đúng
Google origin/path, không redirect/không chuyển API key sang host khác. File ID/MIME/URI phải khớp;
`FAILED`, quá hạn, quá lớn hoặc thiếu quyền/quota đều được ghi là chưa gửi và có cảnh báo.
Không upload lại bytes khi một HTTP bị mất; các lượt retry Interactions dùng lại cùng file URI.
Sau xử lý, thử xóa các tệp Google đã nhận diện (deadline riêng 10 giây); link Cloudinary gốc được giữ.
Nếu worker chết trước cleanup, upload mất phản hồi chưa biết File ID hoặc DELETE lỗi, tệp Google có
thể còn tới khi hết thời hạn Files API (Google công bố 48 giờ); không cam kết xóa tức thì trong các sự cố đó.
URI tệp tạm không lưu vào SQL/manifest/PDF, chỉ lưu link gốc, cách gửi, số bytes và thời lượng nếu Google trả.

Manifest ghi tệp đã gửi/bỏ qua và lý do. UI ghi **Files API · Toàn bộ tệp video (Gemini lấy mẫu)**:
gửi toàn tệp không có nghĩa mô hình kiểm tra mọi frame hoặc mọi trang. Prompt yêu cầu dẫn mốc thời gian
khi quan sát được; không tự sinh timestamp hay gán điểm 0 khi không quan sát được. Không đặt FPS thấp,
không lặng lẽ trích vài frame thay thế video. Quota/token/context/model vẫn do tài khoản Gemini quyết định;
Files API không làm video dài miễn phí. Luồng này dùng video đã upload, chưa thêm ô YouTube;
link YouTube trong mô tả vẫn chỉ là nguồn văn bản do người đăng cung cấp, chưa được đối chiếu độc lập.

Tham chiếu protocol Google đã dùng khi triển khai ngày 01/11/2026 (quyền/quota/giới hạn dịch vụ do nhà cung cấp quản lý):
[Video/Files với Interactions](https://ai.google.dev/gemini-api/docs/video-understanding),
[REST File resource](https://ai.google.dev/api/files),
[File input methods](https://ai.google.dev/gemini-api/docs/file-input-methods).

Nguồn URL chỉ được chấp nhận nếu đã xuất hiện trong văn bản đầu vào và dùng HTTPS.
Worker không truy cập URL nguồn, không tuyên bố đã xác minh nội dung nguồn.
Admin cần tự kiểm tra xuất xứ/giấy tờ với dữ liệu thực tế, đặc biệt chữ ký, con dấu và lai lịch.

## Thời gian chờ và thử lại hữu hạn

`AI_PROVIDER_TIMEOUT_MS` là thời gian cơ sở (mặc định 60.000 ms). Mỗi media **thực sự gửi**
được cộng 4.000 ms; mỗi video đã chuẩn bị cộng thêm 120.000 ms, mỗi lượt không vượt `AI_PROVIDER_MAX_TIMEOUT_MS` (mặc định 300.000 ms).
Đây là ngân sách chờ của ứng dụng, không phải dự đoán thời gian Google trả kết quả.
Ví dụ gửi đủ 32 ảnh, cấu hình cơ sở 60 giây cũ vẫn cho phép 188 giây mỗi lượt.
Giới hạn bao gồm cả đọc response body, nên phản hồi có headers rồi bị treo cũng bị ngắt.

Tối đa `AI_PROVIDER_MAX_ATTEMPTS` lượt cho mỗi lần worker xử lý (1–2, mặc định 2),
chỉ thử lại khi timeout, HTTP 408/500/502/503/504 hoặc lỗi mạng tạm thời thuộc allowlist.
HTTP 503 chờ khoảng 3–4 giây; các lỗi tạm thời khác chờ khoảng 1–2 giây. Nếu có `Retry-After`,
đợi ít nhất theo header trong ngân sách tối đa 15 giây. Nếu yêu cầu đợi lâu hơn, kết thúc lượt phân tích
thay vì gửi lại quá sớm trong cùng tác vụ. Dùng lại media đã chuẩn bị.
Sau 503 có thể dùng `GEMINI_FALLBACK_MODEL` cho lượt còn lại nếu đã cấu hình một model Gemini
khác có quyền sử dụng và hỗ trợ cùng media, schema và tham số. Không thêm lượt gọi ngoài giới hạn.
Không thử lại lỗi khóa/quyền/billing/model, HTTP 400/401/402/403/404/429, DNS `ENOTFOUND`, TLS,
JSON sai hoặc phản hồi chưa hoàn tất. Lượt lỗi cũng có thể tốn quota/chi phí; không retry vô hạn.

Deadline toàn job = giới hạn chuẩn bị ảnh + giới hạn chuẩn bị/video × giới hạn số video
+ giới hạn mỗi lượt provider × số lượt + 15 giây cho mỗi khoảng đợi thử lại + 10 giây dự phòng
(mặc định 1570 giây, là trần cho ba video).
Số video đọc theo MEDIA_MAX_VIDEOS, tối đa 5; deadline job hoặc worker dừng sẽ hủy yêu cầu đang chạy.
`AI_THINKING_LEVEL=low` giảm mức suy luận cho tác vụ trích xuất; có thể đặt `default` để bỏ tham số
nếu model khác không hỗ trợ. Giữ `max_output_tokens=8192`, vì hạ giới hạn output có thể cắt cả phần suy luận
và JSON. Không đổi model, tiêu chí hoặc cơ chế NULL để che lỗi timeout.

Tài liệu Google: [Thinking levels](https://ai.google.dev/gemini-api/docs/thinking/),
[API errors](https://ai.google.dev/gemini-api/docs/api-errors),
[Troubleshooting](https://ai.google.dev/gemini-api/docs/troubleshooting).

## Vòng đời, lưu trữ và phục hồi

Sau COMMIT đăng mới, đăng lại hoặc gửi duyệt lại, hồ sơ chờ Admin; API không xếp job AI.
Chỉ `POST /api/ai/:id` của Admin có CSRF và row_version hợp lệ mới xếp job manual vào stream AI riêng.
Một vòng worker riêng xử lý một job tại một thời điểm, dùng kết nối BLOCK khác với đặt giá/chốt hạn.
Không còn vòng đối soát tự quét bài pending. GET chi tiết/trạng thái, tải lại trang và khởi động worker không tạo yêu cầu AI.
Khi nâng cấp, worker bỏ qua/ACK job `auto` tồn từ bản cũ trước khi đọc SQL/gọi provider; yêu cầu manual mới không bị admission gộp vào job auto cũ.
Dừng và khởi động lại cả API lẫn worker để chính sách này có hiệu lực. Giữ các phân tích đã lưu SQL cùng lịch sử, không xóa/giả thành chưa chạy.

Job mang request UUID, ID bài, version và hash đầu vào. Redis giữ trạng thái queued/running/done/skipped,
cache kết quả đã kiểm tra trước khi ghi SQL; lease theo bài bảo vệ xử lý đồng thời.
Lease AI sống 60 giây và được gia hạn mỗi 15 giây trong suốt lúc chuẩn bị/chờ Gemini.
Mất lease hoặc worker dừng thì hủy provider, để stream pending cho phục hồi, không ghi thất bại giả.
Kiểm tra quyền sở hữu lại trước khi cache và ngay trước COMMIT SQL.
Con trỏ job theo bài và dữ liệu job có TTL 24 giờ, tránh hết con trỏ khi nhiều bài đang xếp hàng.
SQL khóa bài/phiên, kiểm tra lại pending/version rồi lưu một PhanTichAI và các ChiTietPhanTichAI trong cùng transaction.
Nếu đủ căn cứ, cùng transaction đó lưu quyết định và cập nhật bài/phiên. Nếu bài đã có quyết định
hoặc chủ sách gửi lại dữ liệu mới, bỏ kết quả đến muộn.

Dùng hai bảng đã có, không thêm cột. Một chi tiết nhóm `khac` chứa metadata có phiên bản:
request UUID, hash đầu vào, source version, model, bộ quy tắc, media đã gửi/bỏ qua, cảnh báo/mã lỗi.
Thêm số lượt gọi, số media gửi/tổng, thời gian chuẩn bị/provider/tổng và giới hạn mỗi lượt
vào metadata JSON hiện có; không thêm bảng/cột hoặc lưu body lỗi provider.
UI tách metadata khỏi chín tiêu chí. Mỗi lần phân tích là một bản ghi mới, giữ lịch sử; API trả 20 lần gần nhất.
Hash/version giúp đánh dấu kết quả thuộc dữ liệu cũ; dữ liệu lịch sử chưa có metadata vẫn xem được, có cảnh báo.

Lỗi provider được lưu trạng thái `that_bai`, cả hai điểm NULL; thiếu dữ liệu là `chua_day_du`.
Worker thử lại lỗi kỹ thuật theo lịch hữu hạn trong mỗi cửa sổ 24 giờ. Admin có thể yêu cầu phân tích lại
phiên bản hiện tại đang chờ; Redis gom trùng yêu cầu khi đã có job chạy.
Lỗi SQL giữ stream pending, có thể reclaim sau ba phút; lease còn sống vẫn chặn xử lý trùng.
Khi worker chết, chờ lease hết hạn và lượt reclaim tiếp theo để xử lý lại. Replay sau SQL COMMIT tìm receipt trước và không ghi/gọi lại.
Cache kết quả giúp retry SQL không tốn thêm lượt Gemini khi cache còn tồn tại.
Crash trước khi cache hoặc mất Redis có thể gọi provider lại; không cam kết gọi Gemini đúng một lần.
Kết quả đã lưu SQL vẫn đọc được khi Redis mất dữ liệu. Worker sẽ xếp lại bài còn chờ.

### Tạm dừng khi Gemini trả HTTP 429

429 báo Gemini đang giới hạn yêu cầu. `TOO_MANY_REQUESTS` một mình không xác định giới hạn theo phút, token hay quota dài hơn. Worker dừng lượt hiện tại, không chuyển model để thử tiếp và không ghi quyết định duyệt/từ chối vì lỗi này. 429 từ Gemini Files API cũng dừng lượt trước khi gửi thêm video hoặc gọi phân tích.

API và worker dùng một mốc tạm dừng trong Redis theo key Gemini, không lưu key thô. Nếu Gemini cung cấp `Retry-After` hoặc `RetryInfo`, lấy mốc dài hơn (tối thiểu 1 phút, tối đa 24 giờ); nếu không có, mặc định đợi 5 phút. Worker tạm dừng lấy việc AI; SQL vẫn nhận bài mới và lịch quét sẽ xếp lại sau khi hết thời gian chờ. Đấu giá và các luồng khác tiếp tục.

Phiên bản bài có lần phân tích mới nhất lỗi 429 vẫn chờ kiểm duyệt và không được lịch nền tự chạy lại. Sau mốc tạm dừng, Admin kiểm tra hạn mức của project trong Google AI Studio rồi có thể bấm **Phân tích lại bằng AI**. Trong thời gian chờ, POST trả 429 `AI_QUOTA_PAUSED` và header `Retry-After`. Thời điểm này là mốc thử lại của ứng dụng; Gemini có thể vẫn chưa cấp lại quota. Không cần đăng lại bài hoặc đổi key chỉ để làm mới giao diện.

## Quyền và giao diện

| Trạng thái | Hiển thị |
|---|---|
| Bài mới hoặc đang chạy | Hệ thống tự xếp hàng, Admin thấy tiến độ. |
| Đã phân tích, còn chờ vì lỗi kỹ thuật | Có nút **Phân tích lại bằng AI** cho Admin khi không còn job đang chạy và đã qua thời gian tạm dừng nếu gặp 429. |
| Đã có quyết định | Hiện điểm và kết quả đã lưu. Nếu bị từ chối, ô chỉ đọc **Căn cứ và lý do kiểm duyệt** được điền từ kết quả của AI. |

- `GET /api/ai/:id?analysis=<id>`: chủ bài hoặc Admin; lần phân tích phải thuộc đúng bài. Admin nhận `can_retry` theo phiên bản bài hiện tại.
- `POST /api/ai/:id`: Admin + CSRF gửi `row_version` của bài đang chờ và đã có lần phân tích hợp lệ cho phiên bản này; trả 202 khi xếp hàng.
- Admin xem tiến độ, lịch sử, chẩn đoán và kết quả tại **Kiểm duyệt**; không có nút từ chối hoặc phê duyệt tay.
- Chủ bài đang chờ duyệt chỉ thấy tiến độ và lịch sử quyết định trước đó (nếu có), không hiện/gọi panel AI. Sau phê duyệt hoặc từ chối, quyết định/lý do hiện trước, phần **Kết quả AI tham khảo** thu gọn bên dưới. Gửi duyệt lại sẽ ẩn AI cho tới quyết định mới.
- Người mua và khách xem **Điểm và bằng chứng AI** trên chi tiết bài đã công bố (`GET /api/posts/catalog/:id`). Dữ liệu công khai chỉ lấy lần phân tích đúng đầu vào và được liên kết với quyết định phê duyệt; không đưa lịch sử, chẩn đoán, đường dẫn đối chiếu hoặc ghi chú kiểm duyệt riêng vào phản hồi công khai.
- Backend cũng lọc `ai` trong chi tiết riêng và `GET /api/ai/:id`: người bán không nhận job/lịch sử phân tích chưa công bố hoặc mã lỗi provider. Chỉ công bố kết quả có hash đầu vào hiện tại và đúng `phan_tich_id` của quyết định. Quyết định thủ công cũ đối chiếu theo thời gian. Không đủ metadata/mốc thời gian thì báo chưa có kết quả phù hợp, không gán kết quả cũ vào lần mới. Query `analysis` của người bán chỉ nhận ID đã công bố hiện tại; Admin vẫn xem lịch sử riêng.
- Người bán thấy hai điểm, lý do NULL, tiêu chí, bằng chứng, nguồn và phép tính của kết quả phù hợp. Nếu phân tích thất bại, hiện **AI chưa phân tích thành công. Vui lòng xem quyết định và lý do kiểm duyệt của Admin.**, không hiện `AI_TIMEOUT` hoặc hướng dẫn cấu hình. Không đổi cách tính điểm hay dữ liệu phân tích đã lưu.

Khi đang chạy lại, kết quả cũ có nhãn rõ là lần trước, không nhầm với tiến độ mới.
Admin xem được số media đã gửi và thời gian chờ; người bán không nhận các chẩn đoán này.
`ai:check` PASS với văn bản không chứng minh phân tích đầy đủ ảnh đã đạt.

## Chẩn đoán lỗi provider và media

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
| `AI_TIMEOUT` | Hết thời gian từng lượt dù đã thử lại hữu hạn; xem số media/thời gian ở Admin và kiểm tra mạng/dịch vụ Google |
| `AI_JOB_TIMEOUT` | Hết deadline tổng, gồm chuẩn bị media và gọi provider |
| `AI_INVALID_RESPONSE` / `AI_INCOMPLETE_RESPONSE` | JSON không hợp đồng hoặc chưa hoàn tất |
| `AI_FILE_INVALID_RESPONSE`, `AI_FILE_PROCESSING_FAILED`, `AI_FILE_PROCESSING_TIMEOUT` | Files API sai metadata/URI, codec không xử lý được hoặc quá thời gian chuẩn bị |

Không kết luận key sai hoặc tự đổi model chỉ từ `AI_PROVIDER_ERROR` cũ.
Sau khi sửa nguyên nhân/cấu hình, khởi động lại `dev:all`, chạy lại `smoke:ai` để nghiệm thu toàn luồng.
Nhà cung cấp/model và schema/bộ điểm giữ nguyên; cấu hình thời gian, mức suy luận và điều phối media được cập nhật như trên.
Sau pull chạy `npm.cmd run setup:ai` rồi khởi động lại API/worker để nhận cấu hình. Script giữ key và giá trị `.env` cũ.
Bản ghi `AI_TIMEOUT` đã lưu vẫn thuộc lần trước. Bài còn chờ sẽ thử lại theo lịch; Admin có thể dùng **Phân tích lại bằng AI**. Không tự thay kết quả cũ hoặc chạy lại AI cho bài đã có quyết định.

## Kiểm tra và nghiệm thu

Bài M4 báo “vượt ngân sách media” từ lần chạy trước vẫn là dữ liệu lịch sử. Sau cập nhật Files API,
Kết quả cũ giữ nguyên; vòng kiểm duyệt mới dùng cấu hình hiện tại.
`sent` trong manifest là đã đưa media vào yêu cầu, không chứng minh mô hình đã xem mọi frame hoặc kết luận đúng.
Chuẩn bị schema test hiện tại 010 và bật từng SQL opt-in riêng theo [VALIDATION](../VALIDATION.md).

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

Smoke dùng provider thật cho bài mẫu không có ảnh: xác nhận hai điểm NULL, bài vẫn chờ và người bán chưa nhận AI.
Sau đó Admin từ chối fixture và người bán mới thấy kết quả liên kết đúng vòng. Không dùng smoke để kết luận chất lượng thẩm định.
Bằng chứng đã chạy và giới hạn còn lại tại [VALIDATION.md](../VALIDATION.md).

## Tài liệu nhà cung cấp

Kiểm tra ngày 24/10/2026:

- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Interactions REST API](https://ai.google.dev/api/interactions-api)
- [Gemini models](https://ai.google.dev/gemini-api/docs/models)
- [Image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Video understanding](https://ai.google.dev/gemini-api/docs/video-understanding)
- [Gemini API errors](https://ai.google.dev/gemini-api/docs/api-errors)


Khi gửi duyệt lại, AI đọc hồ sơ sách riêng của bài và media còn active sau gỡ/thay; không đọc lại Sach gốc
để bỏ qua bản sửa. ID media dùng cho thao tác gỡ không được thêm vào hash/Gemini: hash cũ vẫn giữ hợp lệ
nếu sách/media chưa đổi. Snapshot quyết định trước vẫn giữ đầu vào/AI đã công bố. Schema cần migration 007.
