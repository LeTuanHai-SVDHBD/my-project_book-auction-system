/** Bản in độc lập: chỉ nhận bản kết quả Backend đã chốt; không lấy dữ liệu từ DOM bài đăng. */
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const text = (value) =>
  escape(value == null || value === "" ? "Chưa có thông tin" : value);
const date = (value) =>
  value
    ? new Date(value).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour12: false,
      }) + " (UTC+7)"
    : "Chưa có thông tin";
const score = (value) =>
  value == null ? "Chưa đủ dữ liệu" : `${Number(value)} / 100`;
function safeUrl(value, cloudinary = false) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (!cloudinary ||
        (url.hostname === "res.cloudinary.com" &&
          !url.port &&
          /^\/[\w-]+\/(image|video)\/upload\//.test(url.pathname)))
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function link(value, label, cloudinary = false) {
  const url = safeUrl(value, cloudinary);
  return url
    ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${text(label || url)}</a>`
    : "Liên kết không hợp lệ hoặc không còn được hỗ trợ";
}
function sources(value) {
  let items;
  try {
    items = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return "";
  }
  if (!Array.isArray(items)) return "";
  return items
    .map((item) => (typeof item === "string" ? item : item?.url))
    .filter((item) => safeUrl(item))
    .map((url) => `<p class="source">Nguồn đối chiếu: ${link(url)}</p>`)
    .join("");
}
function calculation(value, label) {
  if (!value) return "";
  return `<p><b>${label}:</b> ${value.diem == null ? text(value.ly_do_null) : `${text(value.tong_diem_co_trong_so)} / ${text(value.tong_trong_so_ap_dung)} = ${text(Number(value.diem))}`}</p>`;
}
function aiContent(ai) {
  if (!ai) return "<p>Chưa có kết quả AI phù hợp cho lần kiểm duyệt này.</p>";
  if (ai.trang_thai === "that_bai")
    return "<p>AI chưa phân tích thành công. Vui lòng xem quyết định và lý do kiểm duyệt của Admin.</p>";
  return `<p>Phân tích #${text(ai.phan_tich_id)} · ${text(date(ai.ngay_phan_tich))}</p>
    <div class="scores"><div><span>Hỗ trợ đánh giá độ hiếm</span><strong>${score(ai.diem_do_hiem)}</strong><p>${escape(ai.tinh_diem?.do_hiem?.ly_do_null)}</p></div>
    <div><span>Tình trạng vật lý</span><strong>${score(ai.diem_tinh_trang)}</strong><p>${escape(ai.tinh_diem?.tinh_trang?.ly_do_null)}</p></div></div>
    ${ai.thong_tin?.rule_version ? `<p class="muted">Bộ quy tắc: ${text(ai.thong_tin.rule_version)}</p>` : ""}
    ${(ai.thong_tin?.warnings || []).map((value) => `<p class="notice">${text(value)}</p>`).join("")}
    ${(ai.chi_tiet || [])
      .map(
        (row) => `<article class="criterion"><h3>${text(row.tieu_chi)}</h3>
      <p class="muted">${text(row.trang_thai_danh_gia)} · ${row.diem == null ? "Chưa chấm" : `${Number(row.diem)} điểm`} · Trọng số ${text(row.trong_so)}%</p>
      <p class="lines">${text(row.bang_chung)}</p>${sources(row.nguon_doi_chieu)}
      ${row.canh_bao ? `<p class="notice">${text(row.canh_bao)}</p>` : ""}
      ${row.do_tin_cay != null ? `<p class="muted">Độ tin cậy do AI báo cáo: ${text(row.do_tin_cay)}% - không dùng để xác thực nguồn.</p>` : ""}</article>`,
      )
      .join("")}
    ${ai.tinh_diem ? `<h3>Đối chiếu phép tính</h3><p>Σ(điểm thành phần × trọng số) / Σtrọng số áp dụng. Thiếu tiêu chí áp dụng thì giữ NULL.</p>${calculation(ai.tinh_diem.do_hiem, "Độ hiếm")}${calculation(ai.tinh_diem.tinh_trang, "Tình trạng")}` : ""}
    ${ai.thong_tin?.media?.length ? `<h3>Media đã dùng cho AI</h3><ul>${ai.thong_tin.media.map((item) => `<li>${text(item.id)} · ${item.sent ? "Đã gửi phân tích" : "Chưa phân tích"} · ${link(item.url, item.url, true)}</li>`).join("")}</ul>` : ""}`;
}
const style = `
  @page{size:A4;margin:16mm 16mm 24mm}*{box-sizing:border-box}body{margin:0;background:#f6f5f0;color:#1b304a;font:14px/1.65 Arial,sans-serif}
  .toolbar{padding:16px 24px;background:#142c49;color:white;position:sticky;top:0;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
  .toolbar p{margin:0;flex:1;min-width:200px}.toolbar button{font:inherit;background:#e5b751;color:#142c49;border:0;padding:10px 20px;border-radius:8px;cursor:pointer}
  main{max-width:860px;margin:28px auto;background:white;padding:40px 44px;box-shadow:0 4px 24px #142c4910}
  header{border-bottom:2px solid #c39028;padding-bottom:20px;margin-bottom:24px}.brand{font-weight:700;letter-spacing:2px;font-size:18px;color:#916b20}
  h1{font:700 30px/1.2 Georgia,serif;margin:12px 0}h2{font-size:20px;margin:28px 0 12px;border-bottom:1px solid #dbe1e7;padding-bottom:8px}
  h3{font-size:15px;margin:16px 0 6px}h1,h2,h3{break-after:avoid}p{margin:8px 0;orphans:3;widows:3;overflow-wrap:anywhere}
  .muted{color:#586575}.status{display:inline-block;padding:4px 12px;border:1px solid #d7dfe8;border-radius:6px;font-weight:bold}
  dl{display:grid;grid-template-columns:145px minmax(0,1fr);gap:7px 18px}dt{color:#586575}dd{margin:0;overflow-wrap:anywhere}
  .lines{white-space:pre-wrap;overflow-wrap:anywhere}.notice{background:#faf5e9;border-left:3px solid #c39028;padding:10px 14px}
  .scores{display:grid;grid-template-columns:1fr 1fr;gap:16px;break-inside:avoid}.scores>div{border:1px solid #d7dfe8;padding:16px;border-radius:8px}
  .scores span,.scores strong{display:block}.scores strong{font-size:24px;margin-top:8px}.criterion{break-inside:avoid;border-bottom:1px solid #e4e7eb;padding:6px 0 14px}
  a{color:#1c4e82;overflow-wrap:anywhere;text-decoration:underline}.source,li{overflow-wrap:anywhere}li{padding:4px 0;break-inside:avoid}
  .media-label{display:block;font-weight:bold}.media-list{padding-left:0;list-style:none}.media-list li{padding:8px 0;border-bottom:1px solid #e4e7eb}
  @media(max-width:600px){main{margin:0;padding:24px 18px}h1{font-size:26px}dl{grid-template-columns:110px minmax(0,1fr)}.scores{grid-template-columns:1fr}}
  @media print{body{background:white;font-size:10.5pt;color:#172b44}.toolbar{display:none}main{max-width:none;margin:0;padding:0;box-shadow:none}a{font-size:9pt}h1{font-size:25pt}h2{font-size:15pt}.scores strong{font-size:20pt}.notice{background:transparent}.scores{grid-template-columns:1fr 1fr}}
`;

export function renderReviewDocument(report) {
  const { post, book, review, media, ai } = report;
  const facts = [
    ["Tác giả", book.tac_gia],
    ["Thể loại", book.the_loai],
    ["Nhà xuất bản", book.nha_xuat_ban],
    ["Năm xuất bản", book.nam_xuat_ban],
    ["ISBN", book.isbn || "Không có ISBN"],
  ];
  const counts = { image: 0, video: 0 };
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="referrer" content="no-referrer"><title>BookBid-Ket-qua-bai-${text(post.bai_dang_id)}-lan-${text(review.kiem_duyet_id)}</title><style>${style}</style></head>
    <body><div class="toolbar"><p>Chọn “Lưu dưới dạng PDF / Save as PDF” trong hộp thoại in. Đây là kết quả của một lần kiểm duyệt đã lưu.</p><button type="button" id="print-review">Lưu PDF / In</button></div>
    <main><header><div class="brand">BOOKBID</div><h1>Kết quả kiểm duyệt bài đăng</h1><p>Bài #${text(post.bai_dang_id)} · Lần kiểm duyệt #${text(review.kiem_duyet_id)}</p>
    <span class="status">${text(review.ket_qua)}</span><p class="muted">${text(date(review.ngay_kiem_duyet))}</p><p class="muted">Bản kết quả để lưu và đối chiếu trong hệ thống; chưa có chữ ký số.</p></header>
    <section><h2>1. Quyết định của Admin</h2><p class="lines notice">${text(review.phan_hoi_admin)}</p></section>
    <section><h2>2. Thông tin bản sách</h2><h3>${text(book.ten_sach)}</h3><p class="lines">${text(post.tieu_de)}</p>
    <p class="muted">Mã bài: ${text(post.ma_san_pham)} · Một bản sách vật lý</p><dl>${facts.map(([label, value]) => `<dt>${label}</dt><dd>${text(value)}</dd>`).join("")}</dl>
    ${book.mo_ta ? `<h3>Giới thiệu</h3><p class="lines">${text(book.mo_ta)}</p>` : ""}
    <h3>Tình trạng, yếu tố quý hiếm và bằng chứng</h3><p class="lines">${text(book.tinh_trang_va_bang_chung)}</p></section>
    <section><h2>3. Kết quả AI tham khảo</h2><p class="muted">AI chỉ hỗ trợ kiểm duyệt; quyết định phê duyệt hoặc từ chối do Admin thực hiện. Nguồn dẫn cần được kiểm tra, không mặc nhiên đã được AI xác thực.</p>${aiContent(ai)}</section>
    <section><h2>4. Ảnh và video của lần kiểm duyệt</h2><p class="muted">Media được xuất dưới dạng liên kết Cloudinary, không nhúng vào PDF. Liên kết mở được khi tệp còn tồn tại và được phép truy cập.</p>
    ${media?.length ? `<ol class="media-list">${media.map((item) => `<li><span class="media-label">${item.kind === "video" ? "Video" : "Ảnh"} ${String(++counts[item.kind]).padStart(2, "0")}${item.title ? ` · ${text(item.title)}` : ""}</span>${link(item.url, item.url, true)}</li>`).join("")}</ol>` : "<p>Không có ảnh/video được lưu cho lần kiểm duyệt này.</p>"}</section>
    </main></body></html>`;
}

export function openReviewWindow() {
  const popup = window.open("", "_blank");
  if (!popup)
    throw new Error(
      "Trình duyệt đang chặn cửa sổ xuất PDF. Hãy cho phép cửa sổ bật lên cho trang này rồi thử lại.",
    );
  popup.opener = null;
  popup.document.title = "Đang chuẩn bị kết quả kiểm duyệt";
  popup.document.body.textContent = "Đang lấy kết quả kiểm duyệt đã lưu…";
  return popup;
}
export async function printReviewDocument(popup, report) {
  if (popup.closed) return;
  popup.document.open();
  popup.document.write(renderReviewDocument(report));
  popup.document.close();
  popup.document
    .getElementById("print-review")
    .addEventListener("click", () => popup.print());
  await popup.document.fonts.ready;
  if (!popup.closed) {
    popup.focus();
    popup.print();
  }
}
