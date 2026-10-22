<!-- Mục đích: Hướng dẫn lưu tài liệu học thuật cùng mã nguồn dự án. -->

# Báo cáo, slide và sơ đồ

## 1. Cấu trúc lưu trữ

| Thư mục | Nội dung | Ví dụ tên file |
|---|---|---|
| `reports/` | Báo cáo Word và PDF | `bao-cao-nhom15.docx` |
| `slides/` | PowerPoint và PDF thuyết trình | `thuyet-trinh-nhom15.pptx` |
| `uml/use-case/` | Use case tổng quát/chi tiết | `uc-dang-sach.puml` |
| `uml/activity/` | Sơ đồ hoạt động | `activity-dat-gia.puml` |
| `uml/sequence/` | Sơ đồ tuần tự | `sequence-ket-thuc-phien.puml` |
| `uml/erd/` | Mô hình dữ liệu | `erd-dau-gia.puml` |
| `uml/exports/` | SVG/PNG đưa vào báo cáo | `sequence-ket-thuc-phien.svg` |
| `evidence/` | Bằng chứng kiểm thử được chọn | `smoke-test-2026-10-22.txt` |

Hiện mới có cấu trúc và hướng dẫn; nhóm tự thêm DOCX, PPTX và mã UML đang dùng. Các tên trên là ví dụ, không phải tài liệu đã tạo.

## 2. Thêm tài liệu hiện có

1. Sao chép báo cáo đang dùng vào `reports/` và slide vào `slides/`.
2. Lưu mã PlantUML thành file `.puml`, mỗi sơ đồ một file trong nhóm tương ứng.
3. Đưa hình đã xuất vào `uml/exports/`, giữ cùng tên gốc với mã sơ đồ.
4. Thêm bằng chứng vào `evidence/` sau khi loại mật khẩu, token và dữ liệu cá nhân không cần thiết.
5. Kiểm tra `git status` và chỉ commit tài liệu cần chia sẻ.

`docs/` tiếp tục chứa kiến trúc, quyết định kỹ thuật và hướng dẫn vận hành.

## 3. Tên file và phiên bản

- Dùng chữ thường không dấu, ngăn cách bằng dấu gạch ngang.
- Giữ tên ổn định cho bản nguồn đang làm; dùng lịch sử Git để xem thay đổi.
- Bản nộp chính thức có thể thêm ngày `YYYY-MM-DD`.
- Tránh nhiều bản tên `final`, `final-moi`, `final-chot`.
- Khi sửa sơ đồ, cập nhật cả mã và hình được dùng trong báo cáo.
- DOCX/PPTX là file nhị phân; phân công người sửa để hạn chế xung đột.

## 4. Phạm vi commit

Commit DOCX, PPTX, PDF cần chia sẻ, mã PlantUML và hình sơ đồ được chọn. `.gitignore` không bỏ qua toàn bộ các định dạng này.

Không commit file khóa Office bắt đầu bằng `~$`, bản tạm, log thô, database hoặc bí mật cấu hình. Named volume Docker được quản lý trên máy, không chép vào repository.

Ví dụ tại thư mục gốc:

```powershell
git add academic/reports/ academic/slides/ academic/uml/
git diff --cached --stat
git commit -m "docs: cập nhật báo cáo, slide và sơ đồ UML"
```

Chỉ commit khi danh sách staged đúng nội dung muốn chia sẻ.
