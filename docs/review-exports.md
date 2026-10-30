# Xuất kết quả kiểm duyệt cho người bán

## Cập nhật

Dừng `dev:all` bằng Ctrl+C, giữ SQL Server/Redis đang chạy. Tại thư mục gốc:

```powershell
git switch feat/Hai
git pull --ff-only origin feat/Hai
npm.cmd run db:migrate
npm.cmd run dev:all
```

Migration `005_review_exports.sql` thêm đúng một cột nullable `KiemDuyet.ket_qua_snapshot`
và ràng buộc JSON; không thêm bảng, dependency hoặc cấu hình. Có thể chạy lại, giữ dữ liệu cũ.
Schema hiện tại: **21 bảng, 162 cột**. `db:init` nhận diện bản 21/161 để nâng cấp;
readiness chưa đạt nếu chỉ pull mà chưa migration. Không tạo lại database/volume.

## Cách dùng

1. Người bán mở **Bài của tôi → bài đã phê duyệt hoặc từ chối → Kết quả kiểm duyệt**.
2. Nhấn **Xuất kết quả kiểm duyệt (PDF)**. Nếu trình duyệt chặn popup, cho phép cửa sổ bật lên cho trang này.
3. Bản in riêng mở và gọi hộp thoại in. Chọn **Lưu dưới dạng PDF / Save as PDF**, khổ A4, rồi lưu.
4. Nếu hủy hộp thoại, bản kết quả vẫn mở; dùng **Lưu PDF / In** để thử lại.

Đây là xuất qua chức năng lưu PDF của trình duyệt, không phải API trả tệp PDF nhị phân.
Không in toàn bộ giao diện, sidebar hoặc biểu mẫu. Bản in có dấu tiếng Việt,
quyết định/lý do/thời điểm của Admin (UTC+7), thông tin bản sách, mô tả bằng chứng,
hai điểm AI độc lập cùng bằng chứng/cảnh báo/nguồn/phép tính nếu có.
Điểm NULL vẫn là **Chưa đủ dữ liệu**; AI thất bại dùng thông báo thân thiện, không có chẩn đoán provider.
Không gọi lại Gemini khi xuất, không thay đổi điểm hoặc quyết định.

Ảnh/video được liệt kê theo tên và URL Cloudinary bấm mở được; không nhúng tệp.
Danh sách media đã gửi/chưa gửi AI được ghi riêng nếu có manifest.
Nguồn HTTPS của bằng chứng được dẫn để đối chiếu, không mặc nhiên đã được AI xác thực.
Không gửi giá kết thúc sớm, email, phiên đăng nhập hoặc cấu hình bí mật vào bản in.
Bản PDF để lưu/đối chiếu; chưa có chữ ký số. Người có tệp PDF có thể mở các URL public trong đó.

## Đúng lần kiểm duyệt và dữ liệu cũ

- Quyết định mới lưu sách/mô tả/media và AI đã công bố trong **cùng transaction SQL** với quyết định,
  cặp trạng thái bài/phiên và lịch sử. Lỗi lưu bản kết quả làm rollback quyết định; không trả thành công trước COMMIT.
- Gửi duyệt lại không ghi đè bản kết quả cũ. Mục **Lịch sử kiểm duyệt** xuất được từng bản đã lưu,
  kể cả khi vòng hiện tại đang chờ. Bài chờ chưa có quyết định không có nút xuất kết quả hiện tại.
- Với quyết định có trước migration: chỉ dựng/lưu một lần nếu đó vẫn là quyết định mới nhất phù hợp
  với trạng thái hiện tại (đã duyệt hoặc bị từ chối). Khi ấy metadata và danh sách media chưa được gửi duyệt lại.
- Vòng cũ không có bản dữ liệu, hoặc đã gửi duyệt lại trước khi lưu, không được tái tạo bằng dữ liệu mới.
  Giao diện báo không thể xuất chính xác; API trả 409. Không tự suy đoán bộ ảnh/video của quá khứ.
- AI chỉ được đưa vào khi hash nguồn phù hợp và thời gian thuộc đúng vòng theo bộ lọc công bố hiện có.
  Thiếu provenance hoặc thời gian thì ghi chưa có kết quả phù hợp, không gán AI vòng trước.
- Bản kết quả giữ URL, không sao lưu nội dung media. Media đã gắn bài không bị chức năng xuất xóa;
  nếu bị xóa/thay quyền trực tiếp trên Cloudinary thì PDF không khôi phục được tệp. Không cam kết URL tồn tại vĩnh viễn.

## API và kiểm tra

`POST /api/posts/:id/reviews/:reviewId/export` nhận body `{}`; dùng phiên người bán và CSRF.
Backend khóa bài/phiên, kiểm tra chủ sở hữu và quyết định thuộc đúng bài, rồi trả bản kết quả JSON đã lưu.
Không nhận snapshot, điểm hoặc URL do client cung cấp. Không có truy cập công khai; trả `Cache-Control: no-store`.
Người khác nhận 404; Admin không dùng endpoint dành riêng cho người bán này.
Với bản cũ chưa có snapshot, POST có thể lưu lần đầu nên vẫn yêu cầu CSRF; gọi lại không tạo thêm quyết định.

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build
```

`reviewExport.test.js` dùng model SQL fixture và HTTP/session/CSRF thật; `rowVersion.test.js`
kiểm tra rollback quyết định khi ghi snapshot lỗi. Đây không phải bằng chứng SQL Server thật.
`reviewExportSql.test.js` chỉ chạy khi `REVIEW_TEST_SQL=true` và database riêng có tên `BookAuctionTest_*`;
kiểm tra migration chạy lại, hai vòng từ chối/gửi lại/phê duyệt, xuất đồng thời, quyền và dữ liệu cũ.

Khi API/worker/SQL/Redis/Cloudinary đã sẵn sàng trên máy nhóm, `npm.cmd run smoke:m4`
kiểm tra thêm xuất quyết định từ chối, giữ nguyên sau gửi lại, phê duyệt có bản riêng và quyền/CSRF.
Lệnh vẫn upload/dọn media thử và chỉ thao tác fixture UUID; xem README trước khi chạy.
Nếu AI đang bật, các bài thử có thể phát sinh lượt Gemini theo luồng tự động hiện có.

Nghiệm thu giao diện: mở cả hai kết quả phê duyệt/từ chối, lưu PDF nhiều trang, bấm một link ảnh/video,
so hai điểm với màn hình, thử bài không có AI/AI thất bại, bài chờ, lịch sử sau gửi lại và chặn popup.
