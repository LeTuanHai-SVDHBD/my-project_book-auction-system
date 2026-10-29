/** Giao dịch của hai bên: truy vết kết quả, chat riêng, xác nhận độc lập, đánh giá và khiếu nại. */
import { useCallback, useEffect, useRef, useState } from "react";
import { navigate } from "../services/navigation.js";
import { communityGet, communityPost } from "../services/communityApi.js";
import {
  ChatFeed,
  FeedButtons,
  useCommunityPage,
  money,
  when,
} from "./CommunityFeed.jsx";
import ComplaintForm from "./ComplaintForm.jsx";
const complaintStates = {
  cho_xu_ly: "Chờ xử lý",
  dang_xu_ly: "Đang xử lý",
  da_xu_ly: "Đã xử lý",
};
function OwnComplaint({ id, user, onClose }) {
  const { data: row, error } = useCommunityPage(`/complaints/${id}`);
  return (
    <section aria-label="Chi tiết khiếu nại">
      <h3>Khiếu nại #{id}</h3>
      <button type="button" onClick={onClose}>
        Đóng khiếu nại
      </button>
      {row && (
        <>
          <p>
            {complaintStates[row.trang_thai]} · {when(row.ngay_khieu_nai)}
          </p>
          <strong>{row.ly_do}</strong>
          <p className="preserve-lines">{row.noi_dung}</p>
          {row.phan_hoi_admin && (
            <blockquote className="preserve-lines">
              {row.phan_hoi_admin}
            </blockquote>
          )}
          <div className="media-grid">
            {row.bang_chung.map((item) => (
              <figure key={item.bang_chung_id}>
                <a
                  href={item.duong_dan_anh_khieu_nai}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    src={item.duong_dan_anh_khieu_nai}
                    alt={item.mo_ta_anh_khieu_nai || "Bằng chứng khiếu nại"}
                  />
                </a>
                <figcaption>{item.mo_ta_anh_khieu_nai}</figcaption>
              </figure>
            ))}
          </div>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
function TradeDetail({ id, user, onClose }) {
  const [row, setRow] = useState(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState(false),
    [complaint, setComplaint] = useState(null);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const value = await communityGet(`/trades/${id}`);
      if (current === sequence.current) {
        setRow(value);
      }
    } catch (failure) {
      if (current === sequence.current) setError(failure.message);
    }
  }, [id]);
  useEffect(() => {
    let active = true,
      timer;
    async function poll() {
      await load();
      if (active) timer = setTimeout(poll, 3000);
    }
    void poll();
    return () => {
      active = false;
      ++sequence.current;
      clearTimeout(timer);
    };
  }, [load]);
  async function act(action, body = {}, success = "Đã lưu thao tác.") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await communityPost(`/trades/${id}/${action}`, body);
      setMessage(success);
      await load();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  if (!row)
    return (
      <article className="post-sheet">
        <button onClick={onClose}>Về danh sách giao dịch</button>
        <p>{error || "Đang tải giao dịch…"}</p>
      </article>
    );
  const buyer = row.nguoi_mua_id === user.nguoi_dung_id,
    confirmed = buyer ? row.thoi_gian_xac_nhan_mua : row.thoi_gian_xac_nhan_ban;
  return (
    <article className="post-sheet live-trade-detail">
      <div className="sheet-heading">
        <span className="status-pill">
          {row.trang_thai === "hoan_tat" ? "Hoàn tất" : "Chờ hai bên xác nhận"}
        </span>
        <button onClick={onClose}>Về danh sách giao dịch</button>
      </div>
      <h2>{row.ten_sach}</h2>
      <p>
        Mã giao dịch: <strong>{row.ma_giao_dich}</strong> · Bạn là{" "}
        {buyer ? "người mua" : "người bán"}
      </p>
      <p className="field-hint">
        Sách #{row.sach_id} → Bài #{row.bai_dang_id} → Phiên #
        {row.phien_dau_gia_id} → Kết quả #{row.ket_qua_id} → Giao dịch #
        {row.giao_dich_id}
      </p>
      <div className="live-trade-grid">
        <aside className="panel">
          {" "}
          <dl className="post-info">
            <dt>Người mua</dt>
            <dd>{row.ten_nguoi_mua}</dd>
            <dt>Người bán</dt>
            <dd>{row.ten_nguoi_ban}</dd>
            <dt>Giá thắng / số tiền</dt>
            <dd>{money(row.so_tien)}</dd>
            <dt>Người mua xác nhận</dt>
            <dd>{when(row.thoi_gian_xac_nhan_mua)}</dd>
            <dt>Người bán xác nhận</dt>
            <dd>{when(row.thoi_gian_xac_nhan_ban)}</dd>
            <dt>Hoàn tất</dt>
            <dd>{when(row.ngay_hoan_tat)}</dd>
          </dl>
          {row.trang_thai === "cho_xac_nhan" && !confirmed && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void act(
                  "confirm",
                  {},
                  "Đã ghi nhận xác nhận của bạn. Giao dịch chỉ hoàn tất khi đủ hai bên.",
                );
              }}
            >
              <label className="check-label">
                <input type="checkbox" required />
                Tôi xác nhận đã hoàn tất phần giao dịch của mình.
              </label>
              <button className="primary" disabled={busy}>
                Xác nhận hoàn tất của tôi
              </button>
            </form>
          )}
          {confirmed && row.trang_thai !== "hoan_tat" && (
            <p className="notice">Bạn đã xác nhận. Đang chờ bên còn lại.</p>
          )}
          {buyer && (
            <section aria-label="Đánh giá người bán">
              <h3>Đánh giá người bán</h3>
              {row.danh_gia ? (
                <blockquote>
                  <strong>{row.danh_gia.so_sao}/5 sao</strong>
                  <p className="preserve-lines">
                    {row.danh_gia.noi_dung || "Không có nhận xét."}
                  </p>
                </blockquote>
              ) : buyer && row.trang_thai === "hoan_tat" ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const values = new FormData(event.currentTarget);
                    void act(
                      "review",
                      {
                        so_sao: Number(values.get("so_sao")),
                        noi_dung: values.get("noi_dung") || null,
                      },
                      "Đã lưu đánh giá người bán.",
                    );
                  }}
                >
                  <label>
                    Số sao
                    <select name="so_sao" aria-label="Số sao" defaultValue="5">
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} sao
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Nhận xét người bán
                    <textarea name="noi_dung" maxLength={2000} />
                  </label>
                  <p className="field-hint">
                    Số sao và nhận xét được hiển thị công khai ở uy tín người
                    bán.
                  </p>
                  <button className="primary" disabled={busy}>
                    Gửi đánh giá
                  </button>
                </form>
              ) : (
                <p className="field-hint">
                  Người mua đánh giá một lần sau khi giao dịch hoàn tất.
                </p>
              )}
            </section>
          )}
        </aside>
        <div>
          {" "}
          {row.cuoc_tro_chuyen ? (
            row.cuoc_tro_chuyen.trang_thai === "dang_mo" ? (
              <ChatFeed key={`chat-${id}`} tradeId={id} user={user} />
            ) : (
              <ChatFeed key={`chat-${id}`} tradeId={id} user={user} readOnly />
            )
          ) : (
            <button disabled={busy} onClick={() => act("conversation")}>
              Mở cuộc trò chuyện
            </button>
          )}
          <section className="panel">
            {" "}
            <h3>Khiếu nại của tôi trong giao dịch</h3>
            {row.khieu_nai.map((item) => (
              <p key={item.khieu_nai_id}>
                <button onClick={() => setComplaint(item.khieu_nai_id)}>
                  Khiếu nại #{item.khieu_nai_id}: {item.ly_do}
                </button>{" "}
                · {complaintStates[item.trang_thai]}
              </p>
            ))}
            {complaint && (
              <OwnComplaint
                key={`complaint-${complaint}`}
                id={complaint}
                user={user}
                onClose={() => setComplaint(null)}
              />
            )}
            {form ? (
              <ComplaintForm
                tradeId={id}
                onCancel={() => setForm(false)}
                onSaved={(caseId) => {
                  setForm(false);
                  setComplaint(caseId);
                  setMessage("Đã gửi khiếu nại.");
                  void load();
                }}
              />
            ) : (
              <button
                type="button"
                className="secondary"
                onClick={() => setForm(true)}
              >
                Tạo khiếu nại
              </button>
            )}
          </section>
        </div>
      </div>
      {message && (
        <p className="account-success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
export default function TransactionsPanel({ user, selectedId }) {
  const feed = useCommunityPage("/trades"),
    [selected, setSelected] = [
      selectedId,
      (value) => navigate("trades", value),
    ];
  return (
    <main className="posts-page">
      <header className="posts-heading">
        <div>
          <span className="eyebrow">BOOKAUCTION · NHÓM 15</span>
          <h1>Giao dịch của tôi</h1>
          <p>
            Trao đổi với bên còn lại và theo dõi xác nhận, đánh giá, khiếu nại.
          </p>
        </div>
      </header>
      {selected ? (
        <TradeDetail
          key={selected}
          id={selected}
          user={user}
          onClose={() => {
            setSelected(null);
            feed.latest();
          }}
        />
      ) : (
        <>
          <div className="post-list">
            {feed.data?.items.map((row) => (
              <article className="post-card" key={row.giao_dich_id}>
                <span className="status-pill">
                  {row.trang_thai === "hoan_tat" ? "Hoàn tất" : "Chờ xác nhận"}
                </span>
                <h2>{row.ten_sach}</h2>
                <p>{row.ma_giao_dich}</p>
                <p>
                  Bạn là{" "}
                  {row.nguoi_mua_id === user.nguoi_dung_id
                    ? "người mua"
                    : "người bán"}{" "}
                  · {money(row.so_tien)}
                </p>
                <button
                  className="secondary"
                  onClick={() => setSelected(row.giao_dich_id)}
                >
                  Xem giao dịch
                </button>
              </article>
            ))}
          </div>
          {feed.data && !feed.data.items.length && (
            <p className="empty-state">
              Chưa có giao dịch ở trang này. Giao dịch được tạo sau phiên có
              người thắng.
            </p>
          )}
          <FeedButtons feed={feed} />
          {feed.error && (
            <p className="error" role="alert">
              {feed.error}
            </p>
          )}
        </>
      )}
    </main>
  );
}
