/** Public card uses a real cover only; no fabricated appraisal images or quantity selector. */
import { Icon } from "./DesignUi.jsx";
export const money = (value) =>
  value == null
    ? "Chưa có lượt giá"
    : `${BigInt(value).toLocaleString("vi-VN")} đ`;
export default function BookCard({ post, mode = "catalog" }) {
  const state = post.trang_thai_phien,
    phase =
      state === "da_ket_thuc"
        ? "Đã kết thúc"
        : state === "da_kich_hoat"
          ? new Date(post.thoi_gian_bat_dau) > new Date()
            ? "Sắp bắt đầu"
            : "Đang đấu giá"
          : state === "khong_dat_kiem_duyet"
            ? "Bị từ chối"
            : state === "da_qua_kiem_duyet"
              ? "Đã duyệt · Chờ kích hoạt"
              : "Chờ kiểm duyệt";
  return (
    <article className="book-card">
      <a
        className="book-art"
        href={`#/${mode}/${post.bai_dang_id}`}
        aria-label={`Xem ${post.ten_sach}${mode === "pending" ? `, bài #${post.bai_dang_id}` : ""}`}
      >
        <span className="book-card-status">
          <span className="badge badge-gold">{phase}</span>
        </span>
        {post.anh_bia ? (
          <img
            src={post.anh_bia}
            alt={`Bản sách ${post.ten_sach}`}
            loading="lazy"
          />
        ) : (
          <div className="book-cover-placeholder">
            <Icon name="book" size={70} />
            <span>Chưa có ảnh bìa</span>
          </div>
        )}
      </a>
      <div className="book-card-body">
        <span className="eyebrow">{post.the_loai || "Bản sách sưu tầm"}</span>
        <h2>
          <a href={`#/${mode}/${post.bai_dang_id}`}>{post.ten_sach}</a>
        </h2>
        <p>
          {post.tac_gia || "Chưa rõ tác giả"}
          {post.nam_xuat_ban ? ` · ${post.nam_xuat_ban}` : ""}
        </p>
        <span className="card-price-label">
          {post.gia_hien_tai == null ? "Giá khởi điểm" : "Giá hiện tại"}
        </span>
        <strong className="card-price">
          {money(post.gia_hien_tai ?? post.gia_khoi_diem)}
        </strong>
        <div className="book-card-footer">
          <span>
            <Icon name={mode === "pending" ? "file" : "clock"} size={18} />
            {mode === "pending"
              ? `Bài #${post.bai_dang_id}`
              : post.thoi_gian_ket_thuc
                ? new Date(post.thoi_gian_ket_thuc).toLocaleString("vi-VN")
                : "Chưa đặt lịch"}
          </span>
          <a className="text-link" href={`#/${mode}/${post.bai_dang_id}`}>
            {mode === "pending" ? "Xem bài đăng" : "Xem chi tiết"}{" "}
            <Icon name="arrow" size={18} />
          </a>
        </div>
      </div>
    </article>
  );
}
