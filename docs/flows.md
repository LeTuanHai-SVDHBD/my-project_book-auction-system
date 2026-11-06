<!-- Mục đích: Vòng đời và hợp đồng HTTP đã triển khai trên feat/Hai. -->

# Luồng nghiệp vụ và API

Mọi endpoint dưới đây có prefix `/api`. Chủ thể thao tác lấy từ session, không nhận ID người thực hiện
trong body để cấp quyền. POST/DELETE riêng yêu cầu CSRF; API đích và SQL vẫn kiểm tra quyền/trạng thái
khi người dùng đi vào từ một thông báo hoặc link đã lưu.

## 1. Tài khoản

Client cấp X-Tab-ID để chọn cookie HttpOnly của đúng tab, lấy CSRF bằng GET, đăng ký/đăng nhập qua HTTP.
Đăng nhập đúng mật khẩu regenerate session/CSRF, đổi owner và thu hồi session cũ nguyên tử ở Redis.
Tab cũ tự về đăng nhập; F5/Socket/GET không claim quyền. Khác tài khoản dùng đồng thời được.
Client terminal không có selector dùng cookie chung; xem [account-control.md](account-control.md).

| HTTP | Đường dẫn | Ý nghĩa / quyền |
|---|---|---|
| GET | `/auth/csrf` | Token CSRF gắn session, có giới hạn thử |
| POST | `/auth/register` | CSRF, họ tên/email/mật khẩu; chỉ tạo nguoi_dung |
| POST | `/auth/login` | CSRF + mật khẩu; đổi session và phiên hiện hành |
| POST | `/auth/logout` | CSRF; hủy phiên được chọn, không xóa owner của phiên mới |
| GET | `/auth/me` | Tài khoản/session hiện hành |
| POST | `/auth/control` | Body `{}`, session + CSRF; endpoint tương thích chỉ kiểm tra, không claim |
| GET | `/auth/control-status` | Kiểm tra phiên, không khôi phục phiên cũ |
| GET | `/auth/admin-check` | Admin |

## 2. Đăng sách và vòng đời phiên

1. Tải từng tệp qua API → vé Redis trước upload → Cloudinary → xác minh metadata → vé ready.
2. Gửi thông tin sách/bài/giá và vé. Claim vé nguyên tử theo owner/trạng thái/tuổi vé.
3. Transaction tạo Sach, BaiDang, hồ sơ theo bài, phiên pending, media và lịch sử. Chưa có lịch phiên.
4. COMMIT rồi bind/dọn vé. Retry cùng UUID trả bài đã tạo của đúng chủ; rollback chắc chắn mới release vé.
5. Khi bật tự duyệt, worker đọc bài chờ và dùng hai điểm để quyết định. Quyết định/lý do/snapshot được lưu cùng transaction. Khi tắt tự duyệt, Admin có thể duyệt thủ công.
6. Bị từ chối: chủ sách bổ sung hồ sơ/media rồi gửi duyệt lại. Phê duyệt: chủ sách mới đặt lịch/kích hoạt.
7. Phiên kết thúc do hết hạn hoặc đạt ngưỡng. Có người thắng mới tạo giao dịch/phòng chat.

| Thao tác | BaiDang.trang_thai | PhienDauGia.trang_thai |
|---|---|---|
| Đăng/gửi duyệt lại | `cho_kiem_duyet` | `cho_kiem_duyet` |
| Từ chối | `tu_choi` | `khong_dat_kiem_duyet` |
| Phê duyệt | `da_duyet` | `da_qua_kiem_duyet` |
| Chủ sách kích hoạt lịch | `da_duyet` | `da_kich_hoat` |
| Kết thúc | `da_duyet` | `da_ket_thuc` |

Đây là các chuyển trạng thái có chức năng thực tế, không phải mọi enum còn trong DDL đều có nút thao tác.
Không có API hủy giữa phiên, kết thúc thủ công hoặc xóa bài. Chỉ đăng lại cùng sach_id khi **phiên mới nhất**
đã kết thúc, có KetQuaDauGia xác nhận `khong_co_nguoi_thang` và người thắng NULL; thiếu kết quả không đủ điều kiện.

| HTTP | Đường dẫn | Quyền / chức năng |
|---|---|---|
| GET | `/posts/catalog` | Công khai; danh mục hoặc tìm kiếm, chỉ đã duyệt và kích hoạt/kết thúc |
| GET | `/posts/catalog/:id` | Chi tiết công khai, không giá ẩn hoặc AI riêng |
| GET | `/posts/mine` | Người dùng, bài của mình |
| GET | `/posts/pending` | Admin, chờ và từ chối theo bộ lọc/cursor |
| GET | `/posts/:id` | Chủ bài hoặc Admin |
| POST | `/posts` | Người dùng, tạo bài với UUID v4 |
| POST | `/posts/:id/resubmit` | Chủ bài bị từ chối, row_version và dữ liệu bổ sung |
| POST | `/posts/:id/relist` | Chủ sách đủ điều kiện đăng lại; tạo bài/phiên mới |
| POST | `/posts/:id/review` | Admin khi tắt tự duyệt, bài pending, version hiện tại, lý do; phê duyệt cần xác nhận bằng chứng |
| POST | `/posts/:id/activate` | Chủ bài đã duyệt, lịch ISO có timezone và version |
| POST | `/posts/:id/reviews/:reviewId/export` | Chủ bài + body `{}`; JSON snapshot để in/lưu PDF |
| GET | `/media/config` | Giới hạn/định dạng công khai, không credentials |
| POST | `/media/image`, `/media/video` | Người dùng; body nhị phân, Content-Type được hỗ trợ |
| DELETE | `/media/:id` | Chủ vé; chỉ vé upload chưa gắn bài |

### Dữ liệu gửi bài

- Tạo: `ma_yeu_cau` UUID v4, `sach`, `bai_dang`, `phien`, `media:[{upload_id,tieu_de}]`.
- Đăng lại: không gửi `sach`, có thể gửi `reuse_media`; dùng UUID mới cho lần đăng mới.
- Gửi duyệt lại: gửi `row_version`, không dùng `ma_yeu_cau`; được gửi `sach` để sửa toàn bộ hồ sơ
  cùng `remove_media:[{kind:"image"|"video",id}]`. Client cũ bỏ hai trường này thì giữ hồ sơ/media cũ.
- `bai_dang`: tiêu đề và `mo_ta_tinh_trang` (tình trạng, yếu tố quý hiếm, bằng chứng).
  Không bắt người dùng nhập thêm ô tình trạng riêng. Backend giữ tương thích `sach.tinh_trang_sach` cũ.
- `phien`: ba chuỗi tiền nguyên dương tối đa 18 chữ số, cooldown nguyên 10–30 giây, mặc định 20.
  Ngưỡng kết thúc sớm phải lớn hơn hoặc bằng giá khởi điểm; không gửi lịch trong bước đăng mới.
- ISBN có thể NULL, nếu nhập tối đa 100 ký tự. Năm xuất bản nếu có là số nguyên 1–9999.
  Thể loại mới thuộc danh mục; giá trị legacy ngoài danh mục chỉ được giữ khi không đổi.
- Duyệt: `quyet_dinh:phe_duyet|tu_choi`, `ly_do`, `row_version`; phê duyệt cần `xac_nhan_quy_hiem:true`.
- Kích hoạt: `thoi_gian_bat_dau`, `thoi_gian_ket_thuc` có timezone, `row_version`; giờ SQL kiểm tra lịch tương lai.

Hồ sơ sửa nằm ở BaiDang.ho_so_sach; Sach giữ bản vật lý. Gỡ media cũ chỉ tắt dang_su_dung của đúng bài;
không destroy tệp lịch sử. Trước gửi lại, lưu snapshot của quyết định legacy hiện tại nếu còn thiếu.
Chỉ sau COMMIT hồ sơ SQL mới thay đổi; đóng biểu mẫu giữ nháp cục bộ, không gửi các sửa đổi này.
Xem [media/nháp](media-upload.md) và [snapshot](review-exports.md).

### Phân trang và tìm kiếm

| Danh sách | Đầu vào / đầu ra |
|---|---|
| Mine/catalog kiểu cũ | `before=<id>`, tối đa 30; `nextBefore` hoặc NULL |
| Tìm catalog | `q` tối đa 120 ký tự, `genre`, `group`, `phase=all|live|scheduled|ended`, `sort=newest|price|ending`, `page` từ 1; 30 mục, `nextPage` |
| Pending Admin | `status=all|pending|rejected`; chờ trước/từ chối sau, mỗi nhóm ID giảm dần; 30 mục |
| Cursor pending | `nextBefore` dạng `pending:123` hoặc `rejected:123`; gửi nguyên cursor URL-encode vào `before` cùng bộ lọc |

Không trộn pagination page và before. Bộ lọc/cursor sai trả 400. Danh sách thay đổi giữa hai lượt tải
không là snapshot cố định; tải lại trang để xem hiện tại. Bài đã duyệt rời danh sách kiểm duyệt, lịch sử vẫn giữ.

## 3. Phân tích và kiểm duyệt AI

| HTTP | Đường dẫn | Quyền / chức năng |
|---|---|---|
| GET | `/ai/:id` | Admin xem tiến độ/lịch sử; chủ bài chỉ nhận kết quả được công bố sau quyết định |
| GET | `/ai/:id?analysis=:analysisId` | Admin chọn lịch sử đúng bài; người bán chỉ ID đã công bố hiện tại |
| POST | `/ai/:id` | Admin khi tắt tự duyệt + CSRF, body `{row_version}`; pending/version hiện tại; trả 202 |

Ở chế độ tự duyệt, worker lấy bài chờ từ SQL; GET chỉ đọc. Khi tắt tự duyệt, chỉ yêu cầu Admin tạo job manual;
job auto tồn từ bản cũ được bỏ qua. Worker chuẩn bị ảnh/video, gọi Gemini, kiểm tra JSON, Backend tính hai điểm
và lưu SQL. Không đổi trạng thái bài/phiên. Thiếu bằng chứng giữ NULL; lỗi provider khác thiếu bằng chứng.
Ở chế độ thủ công, nút đầu tiên là **Phân tích bằng AI**, đang chạy bị khóa, sau một lần chạy là **Phân tích lại bằng AI**.
Chi tiết Files API/video dài, deadline, replay và quyền công bố: [ai-analysis.md](ai-analysis.md).

## 4. Đặt giá và kết thúc

| HTTP | Đường dẫn | Quyền / dữ liệu |
|---|---|---|
| GET | `/auctions/:id` | Snapshot công khai, giờ SQL, lịch sử mới nhất/kết quả |
| GET | `/auctions/:id/history` | Công khai, 50 lượt/trang, `before` lấy cũ hơn |
| GET | `/auctions/:id/bid-status` | Đăng nhập; chủ sách, thời điểm đặt lại của chính tài khoản, giờ SQL |
| POST | `/auctions/:id/bids` | Người dùng + CSRF; chỉ `{ma_yeu_cau,muc_gia}` |
| GET | `/auctions/:id/requests/:requestId` | Chỉ chủ yêu cầu; SQL receipt trước Redis admission |

Giá đi qua JSON là chuỗi VND nguyên, UUID v4 được chuẩn hóa chữ thường.
HTTP 202/`dang_cho_xu_ly` chưa thành công; `da_chap_nhan`/`bi_tu_choi` là quyết định đã lưu SQL.
Cùng mã/cùng người/phiên/giá đọc lại kết quả, không xếp lại; nội dung khác trả 409. Chỉ retry cùng mã khi
chưa rõ phản hồi, không tạo UUID mới cho cùng ý định đang chờ.

Worker khóa phiên, đọc receipt và kiểm tra lại quyền/lịch/giá/cooldown bằng giờ SQL dưới khóa.
Lượt đầu khởi điểm + k×bước (k≥0), lượt sau giá hiện tại + k×bước (k≥1). Chủ sách/Admin không đặt giá.
Hết hạn hoặc đạt ngưỡng mới kết thúc; hết hạn có lượt hợp lệ thì lượt cao nhất thắng dù chưa đạt ngưỡng.
Một transaction ghi quyết định, lượt hợp lệ, giá/lịch sử và kết quả/giao dịch/chat nếu kết thúc có người thắng.
Xem [auction-processing.md](auction-processing.md) và [realtime.md](realtime.md).

## 5. Giao dịch và tương tác

Các endpoint có prefix `/community`. Chi tiết quyền, đầu vào, giới hạn và phân trang nằm tại
[after-sales.md](after-sales.md). Phòng riêng gắn đúng người thắng/chủ sách; hoàn tất cần hai xác nhận.
Chỉ người mua đánh giá một lần sau hoàn tất. Khiếu nại chỉ mở chat đọc cho Admin được phân công khi đang xử lý;
không đổi người thắng/giá hoặc tự hoàn tiền. Bình luận sau giờ phiên chỉ đọc.

## 6. Hộp thông báo

| HTTP | Đường dẫn | Quyền / dữ liệu |
|---|---|---|
| GET | `/notifications?before=:id` | Hộp của session hiện tại, 30 mục/trang và số chưa đọc |
| POST | `/notifications/:id/read` | Chủ thông báo + CSRF, body `{}`, giữ thời điểm đọc đầu |

Đồng bộ từ các bản ghi nguồn SQL đã COMMIT khi đọc hộp; UNIQUE người nhận/nguồn chống trùng.
Không phải trigger, outbox hoặc Socket push riêng. Xem [ui-integration.md](ui-integration.md).

## 7. Hạ tầng và lỗi HTTP

| HTTP | Đường dẫn | Điều kiện |
|---|---|---|
| GET | `/health/live` | API chạy; không chứng minh dịch vụ phụ thuộc healthy |
| GET | `/health/ready` | SQL/schema, Redis, worker heartbeat cùng đạt |
| POST | `/dev/probes` | development + `X-Dev-Token`; 202, chỉ enqueue probe đọc SQL |
| GET | `/dev/probes/:id` | Cùng điều kiện, đọc kết quả probe |

401: chưa có phiên hợp lệ; 403: sai vai trò/CSRF; 404: không tìm thấy hoặc không được thấy dữ liệu riêng;
409: xung đột trạng thái/version/nội dung; 410: yêu cầu giá không thể tiếp tục, cần đối soát;
413/415: dung lượng/định dạng; 429: giới hạn thử; 503: dịch vụ chưa sẵn sàng. Lỗi provider có mã riêng,
không phản chiếu khóa, stack hoặc body thô. Các nghĩa cụ thể phụ thuộc endpoint, không suy kết quả nghiệp vụ từ HTTP 202.
