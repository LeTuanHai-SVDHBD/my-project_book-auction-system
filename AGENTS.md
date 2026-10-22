<!-- Mục đích: Quy định cách AI Agent đọc, sửa và kiểm tra mã nguồn dự án. -->

# Quy tắc làm việc dành cho AI Agent

## 1. Phạm vi áp dụng

Áp dụng cho toàn bộ repository hệ thống đấu giá sách trực tuyến của Nhóm 15.

Công nghệ:
- Frontend: React và Vite.
- Backend: Node.js và Express, sử dụng JavaScript ES Modules.
- Cơ sở dữ liệu: SQL Server.
- Hàng đợi sự kiện và phối hợp xử lý: Redis Streams, Redis.
- Cập nhật thời gian thực: Socket.IO.
- Môi trường phát triển: Windows 11, VS Code và Docker Desktop.

## 2. Trước khi sửa mã

1. Đọc yêu cầu và các file liên quan.
2. Đọc tài liệu phù hợp trong `docs/`.
3. Kiểm tra `package.json` trước khi đề xuất hoặc chạy lệnh.
4. Kiểm tra thay đổi đang có bằng `git status` và `git diff`.
5. Giữ nguyên thay đổi của người dùng nằm ngoài nhiệm vụ.

Nếu yêu cầu chưa rõ hoặc mâu thuẫn với quy tắc nghiệp vụ, phải hỏi lại.
Không tự quyết định thay đổi nghiệp vụ, cấu trúc dữ liệu hoặc cơ chế xác thực.

## 3. Giới hạn thay đổi

- Chỉ sửa file cần thiết để hoàn thành nhiệm vụ.
- Không đổi tên hoặc di chuyển hàng loạt file ngoài phạm vi yêu cầu.
- Không định dạng lại toàn bộ dự án khi chỉ sửa một chức năng.
- Không tự thêm thư viện, đổi phiên bản hoặc thay đổi kiến trúc.
- Khi cần dependency mới, giải thích mục đích và hỏi trước.
- Không ghi đè cấu hình cá nhân hoặc file `.env`.
- Không xóa dữ liệu, volume hoặc chạy lệnh Git phá hủy thay đổi.
- Không tự commit, push, merge hoặc triển khai nếu chưa được yêu cầu.

## 4. Quy chuẩn mã nguồn

- Sử dụng `import`/`export` theo ES Modules.
- Đặt tên biến và hàm bằng tiếng Anh, thể hiện rõ mục đích.
- Dùng `camelCase` cho biến và hàm; `PascalCase` cho React component.
- Giữ tên bảng, cột và giá trị trạng thái theo schema đã thống nhất.
- Tuân theo cách định dạng của file đang sửa.
- Mỗi hàm có một trách nhiệm rõ ràng.
- Tách logic nghiệp vụ khỏi HTTP controller và React component.
- Tránh lặp logic, số cố định không giải thích và điều kiện lồng quá sâu.
- Dùng `async`/`await`; xử lý lỗi tại ranh giới phù hợp.
- Comment giải thích trách nhiệm, lý do hoặc điều kiện đặc biệt.
- Không thêm comment chỉ diễn đạt lại từng dòng lệnh.

## 5. Phân chia trách nhiệm

- `routes/`: khai báo endpoint và middleware.
- `controllers/`: nhận dữ liệu HTTP và trả phản hồi.
- `services/`: điều phối nghiệp vụ và giao dịch.
- `models/`: truy cập SQL Server bằng truy vấn tham số hóa.
- `events/`: xuất bản, đọc và xác nhận sự kiện.
- `processors/`: xử lý một loại sự kiện cụ thể.
- `concurrency/`: khóa và cơ chế phối hợp xử lý theo phiên.
- `jobs/`: tác vụ theo lịch.
- `middlewares/`: xác thực, phân quyền, kiểm tra đầu vào và lỗi chung.
- `config/`: đọc cấu hình và tạo kết nối dịch vụ.

Các thư mục chưa có chức năng được giữ bằng `.gitkeep`.
Chỉ tạo file nghiệp vụ khi bắt đầu triển khai chức năng tương ứng.

## 6. Quy tắc dữ liệu và bảo mật

- Không đưa mật khẩu, token, API key hoặc thông tin kết nối riêng vào Git.
- `.env.example` chỉ chứa cấu hình mẫu và giá trị thay thế.
- Frontend không kết nối trực tiếp SQL Server hoặc Redis.
- Không đặt bí mật vào biến `VITE_*`.
- Không lưu mật khẩu người dùng dưới dạng nguyên văn.
- Sử dụng truy vấn SQL tham số hóa cho dữ liệu đầu vào.
- Kiểm tra quyền phía Backend cho HTTP API và Socket.IO.
- Không trả stack trace hoặc lỗi SQL nội bộ cho người dùng.
- Không ghi mật khẩu, token hoặc toàn bộ nội dung nhạy cảm vào log.
- Không trả `gia_toi_thieu` trong dữ liệu dành cho người mua.

## 7. Quy tắc đấu giá phải giữ nguyên

- SQL Server là nguồn trạng thái có thẩm quyền.
- Chỉ nhận giá khi phiên đã kích hoạt và đang trong thời gian hoạt động.
- Thời gian hợp lệ do máy chủ xác định khi worker kiểm tra để ghi nhận.
- HTTP 202 chỉ xác nhận đã tiếp nhận yêu cầu.
- Kiểm tra lại trạng thái, giá, thời gian và cooldown sau khi lấy quyền xử lý phiên.
- Lượt đầu: `gia_khoi_diem + k × buoc_gia`, với `k >= 0`.
- Lượt tiếp theo: `gia_hien_tai + k × buoc_gia`, với `k >= 1`.
- Chờ đặt lại tính theo từng người trong cùng phiên:
  mặc định 20 giây, cấu hình 10–30 giây.
- Chỉ kết thúc khi hết thời gian hoặc giá hợp lệ đạt/vượt `gia_toi_thieu`.
- Không thêm kết thúc thủ công hoặc hủy giữa phiên.
- Chỉ tạo giao dịch khi có người thắng.
- Không tạo thêm lượt giá, kết quả hoặc giao dịch khi xử lý lại cùng yêu cầu.
- Chỉ thông báo đặt giá thành công sau khi SQL COMMIT thành công.

## 8. Lệnh kiểm tra

Chạy tại thư mục gốc dự án:

| Lệnh trên Windows | Mục đích |
|---|---|
| `npm.cmd run check` | Kiểm tra cú pháp JavaScript máy chủ và script |
| `npm.cmd test` | Chạy kiểm thử tự động hiện có |
| `npm.cmd run build` | Kiểm tra build Frontend |
| `npm.cmd run smoke` | Kiểm tra tích hợp với các dịch vụ thật |

`smoke` cần API, worker, SQL Server và Redis đang hoạt động.

Thay đổi chỉ liên quan tài liệu:
- Kiểm tra đường dẫn, lệnh và nội dung có khớp mã nguồn.
- Không cần chạy lại toàn bộ kiểm thử nếu không ảnh hưởng mã.

Thay đổi logic:
- Chạy kiểm tra phù hợp với phần thay đổi.
- Bổ sung kiểm thử khi sửa lỗi hoặc thêm quy tắc nghiệp vụ.
- Không tạo kiểm thử chỉ lặp lại cách triển khai.

Không báo PASS cho lệnh chưa chạy.
Không sử dụng lệnh chưa được khai báo, ví dụ `npm run lint`.

## 9. Tiêu chuẩn hoàn thành

- Thay đổi đúng yêu cầu và giới hạn phạm vi.
- Không làm hỏng hành vi đang có.
- Không để mã thử nghiệm, log thừa hoặc bí mật trong bản sửa.
- Cập nhật tài liệu nếu thay đổi cách chạy, cấu hình hoặc hành vi.
- Nêu rõ file đã sửa, kết quả kiểm tra và phần chưa xác minh.
- Phân biệt rõ chức năng đã triển khai với thiết kế dự kiến.