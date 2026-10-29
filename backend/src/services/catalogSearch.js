/** Bounded search values and server-owned sort expressions; SQL LIKE treats user punctuation literally. */
import { HttpError } from "../middlewares/errorHandler.js";
export function catalogSearch(query) {
  const fail = () => {
    throw new HttpError(
      400,
      "INVALID_SEARCH",
      "Từ khóa tối đa 120 ký tự; bộ lọc hoặc trang tìm kiếm không hợp lệ.",
    );
  };
  for (const key of Object.keys(query))
    if (!["q", "genre", "phase", "sort", "page"].includes(key)) fail();
  const text = (key, max) => {
    const v = query[key] ?? "";
    if (typeof v !== "string" || v.length > max || /[\x00-\x1f]/.test(v))
      fail();
    const normalized = v.normalize("NFKC").trim();
    if (normalized.length > max) fail();
    return normalized;
  };
  const q = text("q", 120),
    genre = text("genre", 100),
    phase = query.phase || "all",
    sort = query.sort || "newest";
  if (
    !["all", "live", "scheduled", "ended"].includes(phase) ||
    !["newest", "price", "ending"].includes(sort)
  )
    fail();
  const page =
    query.page === undefined
      ? 1
      : typeof query.page === "string" && /^[1-9]\d{0,3}$/.test(query.page)
        ? Number(query.page)
        : 0;
  if (!page) fail();
  return { q, genre, phase, sort, page };
}
export const searchPattern = (value) =>
  "%" +
  value
    .toLowerCase()
    .replaceAll("đ", "d")
    .replace(/[~%_\[]/g, (ch) => "~" + ch) +
  "%";
export const catalogOrders = {
  newest: "b.bai_dang_id DESC",
  price: "COALESCE(p.gia_hien_tai,p.gia_khoi_diem),b.bai_dang_id DESC",
  ending: "p.thoi_gian_ket_thuc,b.bai_dang_id DESC",
};
