/** Private durable inbox; serialized polling + focus/online refresh repair missed updates. */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, apiPost } from "../services/authApi.js";
import { navigate } from "../services/navigation.js";
import { Dialog, Icon } from "./DesignUi.jsx";
export function useNotifications(user) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const sequence = useRef(0),
    flight = useRef(null);
  const refresh = useCallback(() => {
    if (!user) return Promise.resolve();
    if (flight.current) return flight.current;
    const revision = sequence.current;
    const task = apiRequest("/notifications")
      .then((value) => {
        if (revision === sequence.current) {
          setData(value);
          setError("");
        }
      })
      .catch((e) => {
        if (revision === sequence.current)
          setError(e.message || "Chưa tải được thông báo.");
      })
      .finally(() => {
        if (flight.current === task) flight.current = null;
      });
    flight.current = task;
    return task;
  }, [user?.nguoi_dung_id]);
  useEffect(() => {
    ++sequence.current;
    flight.current = null;
    setData(null);
    setError("");
    if (!user) return;
    let stopped = false,
      timer;
    async function poll() {
      await refresh();
      if (!stopped) timer = setTimeout(poll, 10000);
    }
    void poll();
    const reconnect = () => void refresh();
    window.addEventListener("online", reconnect);
    window.addEventListener("focus", reconnect);
    return () => {
      stopped = true;
      ++sequence.current;
      clearTimeout(timer);
      window.removeEventListener("online", reconnect);
      window.removeEventListener("focus", reconnect);
    };
  }, [refresh, user?.nguoi_dung_id]);
  return { data, error, refresh };
}
function timeAgo(value) {
  const stamp = Date.parse(value);
  if (!Number.isFinite(stamp)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - stamp) / 60000));
  return minutes < 1
    ? "Vừa xong"
    : minutes < 60
      ? `${minutes} phút trước`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)} giờ trước`
        : new Date(stamp).toLocaleDateString("vi-VN");
}
export default function Notifications({ inbox, user, onClose }) {
  const [filter, setFilter] = useState("all"),
    [older, setOlder] = useState([]),
    [next, setNext] = useState(undefined),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const items = [
    ...new Map(
      [...older, ...(inbox.data?.items || [])].map((item) => [
        item.thong_bao_id,
        item,
      ]),
    ).values(),
  ].sort((a, b) => b.thong_bao_id - a.thong_bao_id);
  const visible =
    filter === "unread" ? items.filter((item) => !item.ngay_doc) : items;
  const cursor = next === undefined ? inbox.data?.nextBefore : next;
  async function more() {
    if (!cursor) return;
    setBusy(true);
    setError("");
    try {
      const value = await apiRequest(`/notifications?before=${cursor}`);
      setOlder((old) => [...old, ...value.items]);
      setNext(value.nextBefore);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function open(item) {
    setBusy(true);
    setError("");
    try {
      await apiPost(`/notifications/${item.thong_bao_id}/read`);
      await inbox.refresh();
      onClose();
      navigate(item.loai, item.doi_tuong_id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Thông báo" className="inbox-dialog" onClose={onClose}>
      <div className="inbox-toolbar">
        <p>
          {inbox.data ? (
            <>
              <strong>{inbox.data.unread}</strong> thông báo chưa đọc
            </>
          ) : (
            "Cập nhật dành riêng cho bạn"
          )}
        </p>
        <button
          type="button"
          className="inbox-refresh"
          aria-label="Tải lại thông báo"
          title="Tải lại thông báo"
          disabled={busy}
          onClick={() => {
            setOlder([]);
            setNext(undefined);
            void inbox.refresh();
          }}
        >
          <Icon name="clock" size={20} />
        </button>
      </div>
      <div className="inbox-filters" role="group" aria-label="Lọc thông báo">
        <button
          type="button"
          aria-pressed={filter === "all"}
          onClick={() => setFilter("all")}
        >
          Tất cả
        </button>
        <button
          type="button"
          aria-pressed={filter === "unread"}
          onClick={() => setFilter("unread")}
        >
          Chưa đọc
        </button>
      </div>
      {(error || inbox.error) && (
        <p className="error" role="alert">
          {error || inbox.error}
        </p>
      )}
      {!inbox.data && !inbox.error && (
        <p className="inbox-loading" role="status">
          Đang tải thông báo…
        </p>
      )}
      <div className="inbox-scroll">
        {inbox.data && !visible.length && (
          <div className="inbox-empty">
            <Icon name="bell" size={46} />
            <h3>
              {filter === "unread"
                ? "Không có mục chưa đọc"
                : "Bạn chưa có thông báo"}
            </h3>
            <p>
              {filter === "unread"
                ? "Các thông báo đã tải đều được đọc."
                : "Quyết định kiểm duyệt, giao dịch và phản hồi liên quan sẽ xuất hiện ở đây."}
            </p>
            {cursor && <p>Còn thông báo cũ hơn bên dưới.</p>}
          </div>
        )}
        <ul className="inbox-list">
          {visible.map((item) => (
            <li key={item.thong_bao_id}>
              <button
                type="button"
                disabled={busy}
                className={`inbox-entry ${item.ngay_doc ? "" : "is-unread"}`}
                onClick={() => open(item)}
              >
                <span className={`inbox-entry-icon kind-${item.loai}`}>
                  <Icon
                    name={
                      item.loai === "trades"
                        ? "chat"
                        : item.loai === "complaints"
                          ? "shield"
                          : item.loai === "catalog"
                            ? "gavel"
                            : "file"
                    }
                    size={22}
                  />
                </span>
                <span className="inbox-entry-copy">
                  <span className="inbox-entry-title">
                    {item.tieu_de}
                    {!item.ngay_doc && <i aria-label="Chưa đọc" />}
                  </span>
                  <span className="inbox-entry-body">{item.noi_dung}</span>
                  <span
                    className="inbox-entry-time"
                    title={new Date(item.ngay_tao).toLocaleString("vi-VN")}
                  >
                    {timeAgo(item.ngay_tao)} ·{" "}
                    {item.ngay_doc ? "Đã đọc" : "Chưa đọc"}
                  </span>
                </span>
                <Icon name="chevron" size={17} />
              </button>
            </li>
          ))}
        </ul>
        {cursor && (
          <button
            type="button"
            className="inbox-more"
            disabled={busy}
            onClick={more}
          >
            {busy ? "Đang tải…" : "Xem thêm thông báo"}
          </button>
        )}
      </div>
      <p className="inbox-footnote">
        Chọn một thông báo để mở nội dung và đánh dấu đã đọc.
      </p>
    </Dialog>
  );
}
