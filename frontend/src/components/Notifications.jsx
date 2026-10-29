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
export default function Notifications({ inbox, user, onClose }) {
  const [expanded, setExpanded] = useState(false),
    [older, setOlder] = useState([]),
    [next, setNext] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const items = [
    ...new Map(
      [...(inbox.data?.items || []), ...older].map((x) => [x.thong_bao_id, x]),
    ).values(),
  ];
  async function more() {
    setBusy(true);
    setError("");
    try {
      const value = await apiRequest(
        `/notifications?before=${next || inbox.data.nextBefore}`,
      );
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
      const page =
        item.loai === "pending"
          ? "pending"
          : item.loai === "mine"
            ? "mine"
            : item.loai;
      navigate(page, item.doi_tuong_id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Thông báo"
      className="admin-notifications live-notifications"
      onClose={onClose}
    >
      {!user ? (
        <p>Đăng nhập để xem thông báo của bạn.</p>
      ) : (
        <>
          <p className="notification-note">
            {inbox.data
              ? `${inbox.data.unread} thông báo chưa đọc`
              : "Đang tải thông báo…"}
          </p>
          {!items.length && inbox.data && (
            <div className="empty-state">
              <Icon name="bell" size={36} />
              <h3>Chưa có thông báo</h3>
              <p>Các cập nhật liên quan đến bạn sẽ xuất hiện tại đây.</p>
            </div>
          )}
          {(expanded ? items : items.slice(0, 5)).map((item) => (
            <button
              type="button"
              disabled={busy}
              className={`notification-item notification-link ${item.ngay_doc ? "" : "unread"}`}
              key={item.thong_bao_id}
              onClick={() => open(item)}
            >
              <span>
                <Icon
                  name={
                    item.loai === "trades"
                      ? "chat"
                      : item.loai === "complaints"
                        ? "shield"
                        : "file"
                  }
                />
              </span>
              <div>
                <b>{item.tieu_de}</b>
                <p>{item.noi_dung}</p>
                <small>
                  {new Date(item.ngay_tao).toLocaleString("vi-VN")} ·{" "}
                  {item.ngay_doc ? "Đã đọc" : "Chưa đọc"}
                </small>
              </div>
            </button>
          ))}
          {!expanded && items.length > 0 && (
            <button
              type="button"
              className="notification-all"
              onClick={() => setExpanded(true)}
            >
              Xem tất cả thông báo
            </button>
          )}
          {expanded && (older.length ? next : inbox.data?.nextBefore) && (
            <button
              type="button"
              className="notification-all"
              disabled={busy}
              onClick={more}
            >
              {busy ? "Đang tải…" : "Xem thêm thông báo"}
            </button>
          )}
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => {
              setOlder([]);
              setNext(null);
              void inbox.refresh();
            }}
          >
            Tải lại thông báo
          </button>
        </>
      )}
      {(error || inbox.error) && (
        <p className="error" role="alert">
          {error || inbox.error}
        </p>
      )}
    </Dialog>
  );
}
