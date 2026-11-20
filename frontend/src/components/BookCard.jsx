import StatusBadge from "./StatusBadge.jsx";
/** Public card uses a real cover only; no fabricated appraisal images or quantity selector. */
import { mediaDisplayUrl } from "../../../shared/mediaDelivery.js";
import { Icon } from "./DesignUi.jsx";
export const money = (value) =>
  value == null
    ? "Chưa có lượt giá"
    : `${BigInt(value).toLocaleString("vi-VN")} đ`;
export default function BookCard({ post, mode = "catalog", query = "" }) {
  const state = post.trang_thai_phien;
  const href = `#/${mode}/${post.bai_dang_id}${query ? `?${query}` : ""}`;
  return (
    <article className="book-card">
      <a
        className="book-art"
        href={href}
        aria-label={`Xem ${post.ten_sach}${mode === "pending" ? `, bài #${post.bai_dang_id}` : ""}`}
      >
        <span className="book-card-status">
          <StatusBadge post={post} />
        </span>
        {post.anh_bia ? (
          <img
            src={mediaDisplayUrl(post.anh_bia, "image")}
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
          <a href={href}>{post.ten_sach}</a>
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
        {mode === "pending" && state === "khong_dat_kiem_duyet" && (
          <div className="moderation-rejection">
            <strong>Đã từ chối</strong>
            {post.ngay_tu_choi && (
              <time dateTime={post.ngay_tu_choi}>
                {new Date(post.ngay_tu_choi).toLocaleString("vi-VN")}
              </time>
            )}
            <p>
              {post.ly_do_tu_choi || "Xem chi tiết để đọc kết quả kiểm duyệt."}
            </p>
          </div>
        )}
        <div className="book-card-footer">
          <span>
            <Icon name={mode === "pending" ? "file" : "clock"} size={18} />
            {mode === "pending"
              ? `Bài #${post.bai_dang_id}`
              : post.thoi_gian_ket_thuc
                ? new Date(post.thoi_gian_ket_thuc).toLocaleString("vi-VN")
                : "Chưa đặt lịch"}
          </span>
          <a className="text-link" href={href}>
            {mode === "pending" ? "Xem bài đăng" : "Xem chi tiết"}{" "}
            <Icon name="arrow" size={18} />
          </a>
        </div>
      </div>
    </article>
  );
}
