import StatusBadge from "./StatusBadge.jsx";
/** Danh mục, bài của tôi, kiểm duyệt tự động và luồng đặt giá/kết quả phiên. */
import { useCallback, useEffect, useRef, useState } from "react";
import { BOOK_GENRE_GROUPS } from "../../../shared/bookGenres.js";
import { bookReviewDescription } from "../../../shared/bookCondition.js";
import { currentReview } from "../../../shared/aiVisibility.js";
import { useSuccessFeedback } from "./SuccessFeedback.jsx";
import { navigate } from "../services/navigation.js";
import BookCard from "./BookCard.jsx";
import BookGallery from "./BookGallery.jsx";
import { Icon } from "./DesignUi.jsx";
import { postApi } from "../services/postApi.js";
import PostForm from "./PostForm.jsx";
import AuctionPanel from "./AuctionPanel.jsx";
import CommentsPanel from "./CommentsPanel.jsx";
import AiPanel from "./AiPanel.jsx";
import ReviewExportButton from "./ReviewExportButton.jsx";
import { useAuctionRealtime } from "../services/auctionRealtime.js";
const money = (value) =>
  value == null ? "Chưa có" : `${BigInt(value).toLocaleString("vi-VN")} đ`;
const date = (value) =>
  value ? new Date(value).toLocaleString("vi-VN") : "Chưa đặt lịch";
function ReviewDecision({ review, postId, canExport }) {
  return (
    <blockquote className="review-decision">
      <div className="review-decision-heading">
        <StatusBadge state={review.ket_qua === "Phê duyệt" ? "approved" : "rejected"}>
          {review.ket_qua === "Phê duyệt" ? "Đã phê duyệt" : "Bị từ chối"}
        </StatusBadge>
        <small>{review.phan_tich_id ? "Kiểm duyệt tự động" : "Admin kiểm duyệt"} · {date(review.ngay_kiem_duyet)}</small>
      </div>
      <h3>{review.ket_qua === "Từ chối" ? "Lý do từ chối bài đăng" : "Căn cứ phê duyệt"}</h3>
      {review.ket_qua === "Từ chối" ? (
        <label>
          Căn cứ và lý do kiểm duyệt
          <textarea readOnly rows={6} value={review.phan_hoi_admin || ""} />
        </label>
      ) : (
        <p className="preserve-lines">{review.phan_hoi_admin}</p>
      )}
      {canExport && review.co_the_xuat && (
        <ReviewExportButton postId={postId} review={review} />
      )}
      {canExport && !review.co_the_xuat && (
        <p className="field-hint">
          Lần kiểm duyệt cũ chưa lưu bản kết quả đầy đủ nên không thể xuất chính
          xác.
        </p>
      )}
    </blockquote>
  );
}
function Detail({
  post,
  mode,
  user,
  onRefresh,
  onForm,
  onClose,
  onAuctionChange,
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const notify = useSuccessFeedback();
  async function activate(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await postApi.activate(post.bai_dang_id, {
        thoi_gian_bat_dau: new Date(data.start).toISOString(),
        thoi_gian_ket_thuc: new Date(data.end).toISOString(),
        row_version: post.row_version,
      });
      notify({ message: "Đã đặt lịch và kích hoạt phiên." });
      await onRefresh();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  const published = ["da_kich_hoat", "da_ket_thuc"].includes(
    post.trang_thai_phien,
  );
  const admin = user?.vai_tro === "admin",
    decision = currentReview(post);
  const waiting = post.trang_thai_phien === "cho_kiem_duyet";
  const ai = (
    <AiPanel
      key={`${post.bai_dang_id}-${post.row_version}`}
      post={post}
      user={user}
    />
  );
  return (
    <article className="live-detail">
      <div className="breadcrumb">
        <button className="text-button" onClick={onClose}>
          ← Về danh sách
        </button>
        <span>/</span>
        <span>{post.ten_sach}</span>
      </div>
      <div className="live-detail-grid">
        <div>
          <BookGallery items={post.media} />
        </div>
        <div>
          <section className="panel live-auction-summary">
            <StatusBadge post={post} />
            <h1>{post.ten_sach}</h1>
            <p>{post.tieu_de}</p>
            <p className="field-hint">
              Bài #{post.bai_dang_id} · Một bản sách vật lý
            </p>
            <dl className="post-info book-facts">
              <dt>Tác giả</dt>
              <dd>{post.tac_gia || "Chưa rõ"}</dd>
              <dt>Thể loại</dt>
              <dd>{post.the_loai || "Chưa rõ"}</dd>
              <dt>Nhà xuất bản</dt>
              <dd>{post.nha_xuat_ban || "Chưa rõ"}</dd>
              <dt>Năm xuất bản</dt>
              <dd>{post.nam_xuat_ban || "Chưa rõ"}</dd>
              <dt>ISBN</dt>
              <dd>{post.isbn || "Không có ISBN"}</dd>
            </dl>
            <h2 className="auction-facts-heading">Thông số đấu giá</h2>
            <dl className="post-info">
              <dt>Giá khởi điểm</dt>
              <dd>{money(post.gia_khoi_diem)}</dd>
              <dt>Bước giá</dt>
              <dd>{money(post.buoc_gia)}</dd>
              <dt>Chờ đặt lại</dt>
              <dd>{post.thoi_gian_cho_dat_lai} giây</dd>
              <dt>Bắt đầu</dt>
              <dd>{date(post.thoi_gian_bat_dau)}</dd>
              <dt>Kết thúc</dt>
              <dd>{date(post.thoi_gian_ket_thuc)}</dd>
              {mode !== "catalog" && (
                <>
                  <dt>Kết thúc sớm (riêng tư)</dt>
                  <dd>{money(post.gia_toi_thieu)}</dd>
                </>
              )}
            </dl>
            {published && (
              <AuctionPanel
                key={`${post.phien_dau_gia_id}-${user?.nguoi_dung_id || "guest"}`}
                auctionId={post.phien_dau_gia_id}
                user={user}
                onSnapshot={onAuctionChange}
              />
            )}
            {post.trang_thai_phien === "da_ket_thuc" &&
              user?.vai_tro === "nguoi_dung" && (
                <a href="#/trades" className="btn btn-outline">
                  Giao dịch của tôi
                </a>
              )}
            {mode === "mine" &&
              post.trang_thai_phien === "da_qua_kiem_duyet" && (
                <form onSubmit={activate}>
                  <fieldset disabled={busy}>
                    <h3>Đặt lịch phiên đã được duyệt</h3>
                    <label>
                      Bắt đầu (giờ địa phương)
                      <input type="datetime-local" name="start" required />
                    </label>
                    <label>
                      Kết thúc (giờ địa phương)
                      <input type="datetime-local" name="end" required />
                    </label>
                    <p className="field-hint">
                      Giờ bắt đầu phải ở tương lai theo đồng hồ SQL Server.
                    </p>
                    <button className="primary">Đặt lịch và kích hoạt</button>
                  </fieldset>
                </form>
              )}
            {mode === "mine" &&
              post.trang_thai_phien === "khong_dat_kiem_duyet" && (
                <button className="primary" onClick={() => onForm("resubmit")}>
                  Bổ sung và gửi duyệt lại
                </button>
              )}
            {mode === "mine" && post.co_the_dang_lai && (
              <button className="primary" onClick={() => onForm("relist")}>
                Đăng lại cùng bản sách
              </button>
            )}
          </section>
        </div>
      </div>
      <section className="panel live-book-description">
        <div className="book-description-copy">
          <span className="eyebrow">Thông tin bản sách</span>
          <h2>Giới thiệu và tình trạng</h2>
          {post.mo_ta && <p className="preserve-lines">{post.mo_ta}</p>}
          <h3>Tình trạng, yếu tố quý hiếm và bằng chứng</h3>
          <p className="preserve-lines">{bookReviewDescription(post)}</p>
        </div>
      </section>
      {mode === "catalog" && published && (
        <section className="panel live-review">
          <h2>Điểm và bằng chứng AI</h2>
          <AiPanel post={post} publicView />
        </section>
      )}
      {mode !== "catalog" && (
        <section className="panel live-review">
          {admin && ai}
          <h2>{waiting ? "Tiến độ kiểm duyệt" : "Kết quả kiểm duyệt"}</h2>
          {waiting && !admin && (
            <p className="notice" role="status">
              {post.ai_san_sang
                ? "Bài đăng đang chờ kiểm duyệt tự động. Quyết định và lý do sẽ xuất hiện tại đây."
                : "Bài đăng đã được lưu và sẽ tiếp tục chờ dịch vụ AI."}
            </p>
          )}
          {decision && (
            <ReviewDecision
              review={decision}
              postId={post.bai_dang_id}
              canExport={mode === "mine" && !admin}
            />
          )}
          {!waiting && !decision && (
            <p>
              Chưa có quyết định kiểm duyệt phù hợp với trạng thái hiện tại.
            </p>
          )}
          {post.kiem_duyet?.length > (decision ? 1 : 0) && (
            <details className="review-history">
              <summary>Lịch sử kiểm duyệt</summary>
              {post.kiem_duyet.slice(decision ? 1 : 0).map((item) => (
                <ReviewDecision
                  key={item.kiem_duyet_id}
                  review={item}
                  postId={post.bai_dang_id}
                  canExport={mode === "mine" && !admin}
                />
              ))}
            </details>
          )}
          {!admin && decision && (
            <details className="seller-ai-results">
              <summary>{decision.phan_tich_id ? "Điểm và bằng chứng AI" : "Kết quả AI tham khảo"}</summary>
              {ai}
            </details>
          )}
        </section>
      )}
      {published && (
        <section className="panel live-community">
          <CommentsPanel auctionId={post.phien_dau_gia_id} user={user} />
        </section>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button className="text-button" disabled={busy} onClick={onRefresh}>
        Tải lại trạng thái
      </button>
    </article>
  );
}
export default function PostsPanel({
  mode,
  user,
  selectedId,
  initialCreate = false,
  query = "",
}) {
  const filters = new URLSearchParams(query);
  const [items, setItems] = useState([]),
    [next, setNext] = useState(null),
    [post, setPost] = useState(null),
    [form, setForm] = useState(initialCreate ? "create" : null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [q, setQ] = useState(filters.get("q") || "");
  const notify = useSuccessFeedback();
  const listSequence = useRef(0),
    detailSequence = useRef(0);
  const auctionChanged = useCallback((snapshot) => {
    const update = (row) =>
      !row ||
      row.phien_dau_gia_id !== snapshot.phien_dau_gia_id ||
      (row.trang_thai_phien === snapshot.trang_thai &&
        row.gia_hien_tai === snapshot.gia_hien_tai)
        ? row
        : {
            ...row,
            trang_thai_phien: snapshot.trang_thai,
            gia_hien_tai: snapshot.gia_hien_tai,
          };
    setPost(update);
    setItems((old) => old.map(update));
  }, []);
  async function load(append = false) {
    const seq = ++listSequence.current;
    setLoading(true);
    setError("");
    try {
      const result =
        mode === "catalog"
          ? await postApi.search({
              q: filters.get("q") || "",
              genre: filters.get("genre") || "",
              group: filters.get("group") || "",
              phase: filters.get("phase") || "all",
              sort: filters.get("sort") || "newest",
              page: append ? next : 1,
            })
          : await postApi.list(
              mode,
              append ? next : null,
              filters.get("status") || "all",
            );
      if (seq === listSequence.current) {
        setItems((old) =>
          append
            ? [
                ...new Map(
                  [...old, ...result.items].map((row) => [
                    row.bai_dang_id,
                    row,
                  ]),
                ).values(),
              ]
            : result.items,
        );
        setNext(mode === "catalog" ? result.nextPage : result.nextBefore);
      }
    } catch (e) {
      if (seq === listSequence.current)
        setError(e.message || "Chưa kết nối được máy chủ.");
    } finally {
      if (seq === listSequence.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      ++listSequence.current;
    };
  }, [mode, query]);
  useAuctionRealtime({
    enabled: !form && mode === "catalog",
    onChange: () => load(),
  });
  async function open(id, background = false) {
    const seq = ++detailSequence.current;
    if (!background) setLoading(true);
    setError("");
    try {
      const value = await postApi.detail(id, mode === "catalog");
      if (seq === detailSequence.current) setPost(value);
    } catch (e) {
      if (seq === detailSequence.current) setError(e.message);
    } finally {
      if (seq === detailSequence.current) setLoading(false);
    }
  }
  useEffect(() => {
    setForm(initialCreate ? "create" : null);
    setPost(null);
    if (selectedId) void open(selectedId);
    return () => {
      ++detailSequence.current;
    };
  }, [selectedId, mode, initialCreate]);
  const watchDecision = Boolean(!form && post?.kiem_duyet_tu_dong && post.trang_thai_phien === "cho_kiem_duyet");
  useEffect(() => {
    if (!watchDecision || !selectedId) return;
    let active = true, timer;
    async function poll() {
      await open(selectedId, true);
      if (active) timer = setTimeout(poll, 5000);
    }
    timer = setTimeout(poll, 5000);
    return () => { active = false; clearTimeout(timer); };
  }, [watchDecision, selectedId, mode]);
  async function refresh() {
    if (post) await open(post.bai_dang_id);
    await load();
  }
  async function saved(id) {
    setForm(null);
    notify({ message: "Đã gửi kiểm duyệt. Bạn có thể đặt lịch cho phiên khi bài được duyệt." });
    navigate("mine", id);
    await load();
    await open(id);
  }
  function filter(key, value) {
    const params = new URLSearchParams(query);
    params.set(key, value);
    if (key === "group") params.delete("genre");
    if (key === "genre") params.delete("group");
    navigate("catalog", null, params.toString());
  }
  const title =
    mode === "mine"
      ? "Bài đăng của tôi"
      : mode === "pending"
        ? "Kiểm duyệt bài đăng"
        : "Tìm một ấn bản thuộc về bạn";
  const detail = post && (
    <Detail
      key={post.bai_dang_id}
      post={post}
      mode={mode}
      user={user}
      onRefresh={refresh}
      onClose={() => {
        setPost(null);
        navigate(mode, null, query);
      }}
      onForm={setForm}
      onAuctionChange={auctionChanged}
    />
  );
  return (
    <main className="posts-page page-container">
      {!post && (
        <header className="posts-heading">
          <div>
            <span className="eyebrow">
              {mode === "pending"
                ? "KHÔNG GIAN QUẢN TRỊ"
                : mode === "mine"
                  ? "KHÔNG GIAN CHỦ SÁCH"
                  : "DÀNH CHO NGƯỜI YÊU SÁCH"}
            </span>
            <h1>
              {form
                ? "Đưa bản sách của bạn đến với người biết trân trọng"
                : title}
            </h1>
            <p>
              {mode === "pending"
                ? "Theo dõi bài đang chờ, bằng chứng và căn cứ kiểm duyệt."
                : mode === "mine"
                  ? "Theo dõi kiểm duyệt, bổ sung bằng chứng và đặt lịch đấu giá."
                  : "Theo dõi phiên đấu giá, đọc thông tin bản sách và lựa chọn bằng sự hiểu biết."}
            </p>
          </div>
          {mode === "mine" && !form && (
            <a className="btn btn-gold" href="#/create">
              <Icon name="plus" /> Đăng sách mới
            </a>
          )}
        </header>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading && <p role="status">Đang tải…</p>}
      {form ? (
        <PostForm
          key={`${form}-${post?.bai_dang_id || "new"}`}
          owner={user.nguoi_dung_id}
          source={form === "create" ? null : post}
          mode={form}
          onSaved={saved}
          onCancel={() => {
            setForm(null);
            navigate("mine", post?.bai_dang_id);
          }}
        />
      ) : mode === "pending" ? (
        post ? (
          detail
        ) : (
          <section className="pending-posts" aria-label="Danh sách kiểm duyệt">
            <div className="pending-posts-heading">
              <h2>Bài đăng cần theo dõi</h2>
              <span>{items.length} bài đang hiển thị</span>
            </div>
            <div
              className="moderation-filters"
              role="group"
              aria-label="Lọc trạng thái kiểm duyệt"
            >
              {[
                ["all", "Tất cả"],
                ["pending", "Chờ kiểm duyệt"],
                ["rejected", "Đã từ chối"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className="secondary"
                  aria-pressed={(filters.get("status") || "all") === value}
                  onClick={() =>
                    navigate(
                      "pending",
                      null,
                      value === "all" ? "" : `status=${value}`,
                    )
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="field-hint">
              Bài chờ kiểm duyệt được ưu tiên trước. Bài đã từ chối giữ lại để
              xem kết quả; khi người bán gửi lại sẽ chuyển về chờ kiểm duyệt.
            </p>
            <div className="pending-post-grid">
              {items.map((item) => (
                <BookCard
                  key={item.bai_dang_id}
                  post={item}
                  mode="pending"
                  query={query}
                />
              ))}
            </div>
            {!items.length && !loading && (
              <p className="notice">Không có bài đăng phù hợp với bộ lọc.</p>
            )}
            {next && (
              <button
                className="secondary"
                onClick={() => load(true)}
                disabled={loading}
              >
                Xem thêm bài đăng
              </button>
            )}
          </section>
        )
      ) : post ? (
        detail
      ) : (
        <>
          {mode === "catalog" && (
            <>
              <form
                className="catalog-search"
                role="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  filter("q", q);
                }}
              >
                <Icon name="search" size={25} />
                <input
                  aria-label="Tìm sách, tác giả hoặc ISBN"
                  placeholder="Tên sách, tác giả, ISBN hoặc thể loại…"
                  value={q}
                  maxLength={120}
                  onChange={(e) => setQ(e.target.value)}
                />
                <button className="primary">Tìm kiếm</button>
              </form>
              <div className="catalog-toolbar">
                <div className="filter-tabs">
                  {[
                    ["all", "Tất cả"],
                    ["live", "Đang đấu giá"],
                    ["scheduled", "Sắp diễn ra"],
                    ["ended", "Đã kết thúc"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={
                        (filters.get("phase") || "all") === value
                          ? "active"
                          : ""
                      }
                      aria-pressed={(filters.get("phase") || "all") === value}
                      onClick={() => filter("phase", value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="select-filters">
                  <select
                    aria-label="Lọc thể loại"
                    value={
                      filters.get("group")
                        ? `group:${filters.get("group")}`
                        : filters.get("genre") || ""
                    }
                    onChange={(e) =>
                      e.target.value.startsWith("group:")
                        ? filter("group", e.target.value.slice(6))
                        : filter("genre", e.target.value)
                    }
                  >
                    <option value="">Tất cả thể loại</option>
                    <optgroup label="Nhóm chính">
                      {BOOK_GENRE_GROUPS.map((group) => (
                        <option key={group.name} value={`group:${group.name}`}>
                          {group.name}
                        </option>
                      ))}
                    </optgroup>
                    {BOOK_GENRE_GROUPS.map((group) => (
                      <optgroup key={group.name} label={group.name}>
                        {group.items.map((genre) => (
                          <option key={genre} value={genre}>
                            {genre}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <select
                    aria-label="Sắp xếp phiên"
                    value={filters.get("sort") || "newest"}
                    onChange={(e) => filter("sort", e.target.value)}
                  >
                    <option value="newest">Mới nhất</option>
                    <option value="price">Giá tăng dần</option>
                    <option value="ending">Kết thúc sớm nhất</option>
                  </select>
                </div>
              </div>
            </>
          )}
          {!items.length && !loading && !error && (
            <div className="empty-state panel">
              <Icon name="book" size={48} />
              <h2>
                {mode === "catalog"
                  ? "Chưa tìm thấy ấn bản phù hợp"
                  : "Chưa có bài đăng"}
              </h2>
              <p>
                {mode === "catalog"
                  ? "Thử từ khóa khác hoặc bỏ bớt bộ lọc."
                  : "Các bài đăng của bạn sẽ xuất hiện tại đây."}
              </p>
              {mode === "catalog" && (
                <a href="#/catalog" className="btn btn-outline">
                  Xóa bộ lọc
                </a>
              )}
            </div>
          )}
          {mode === "mine" && items.length > 0 ? (
            <div className="panel table-scroll my-posts-table">
              <table>
                <thead>
                  <tr>
                    <th>Bản sách</th>
                    <th>Giá khởi điểm</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.bai_dang_id}>
                      <td>
                        <a href={`#/mine/${item.bai_dang_id}`}>
                          <b>{item.ten_sach}</b>
                          <small>
                            {item.tac_gia} · Bài #{item.bai_dang_id}
                          </small>
                        </a>
                      </td>
                      <td data-label="Giá khởi điểm">{money(item.gia_khoi_diem)}</td>
                      <td data-label="Trạng thái">
                        <StatusBadge post={item} />
                      </td>
                      <td>
                        <a
                          className="text-link"
                          href={`#/mine/${item.bai_dang_id}`}
                        >
                          {item.trang_thai_phien === "khong_dat_kiem_duyet"
                            ? "Bổ sung và gửi duyệt lại"
                            : item.trang_thai_phien === "da_qua_kiem_duyet"
                              ? "Đặt lịch & kích hoạt"
                              : "Xem chi tiết"}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="book-grid">
              {items.map((item) => (
                <BookCard key={item.bai_dang_id} post={item} mode={mode} />
              ))}
            </div>
          )}
          {next && (
            <button
              className="btn btn-outline"
              disabled={loading}
              onClick={() => load(true)}
            >
              Xem thêm
            </button>
          )}
          {mode === "catalog" && user?.vai_tro !== "admin" && (
            <section className="catalog-bottom">
              <Icon name="book" size={32} />
              <div>
                <h2>Bạn cũng có một câu chuyện để chia sẻ?</h2>
                <p>Đưa bản sách của bạn đến với người biết trân trọng.</p>
              </div>
              <a
                className="btn btn-outline"
                href={user ? "#/create" : "#/account"}
              >
                Đăng sách của bạn
              </a>
            </section>
          )}
        </>
      )}
    </main>
  );
}
