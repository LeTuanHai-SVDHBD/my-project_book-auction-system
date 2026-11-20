/** Approved BookBid navigation; account and notification controls belong to Admin sidebar. */
import { useEffect, useRef, useState } from "react";
import { navigate } from "../services/navigation.js";
import { Dialog, Icon } from "./DesignUi.jsx";
import Notifications, { useNotifications } from "./Notifications.jsx";
const MOBILE_NAV_ID = "bookbid-mobile-nav";

export default function BookBidShell({ user, route, children }) {
  const [menu, setMenu] = useState(false),
    [notifications, setNotifications] = useState(false),
    [query, setQuery] = useState("");
  const menuButton = useRef(null);
  const admin = user?.vai_tro === "admin",
    inbox = useNotifications(user);
  useEffect(() => {
    setMenu(false);
  }, [route.page, route.id, route.query]);
  useEffect(() => {
    const desktop = matchMedia("(width > 1100px)"),
      close = () => {
        if (desktop.matches) setMenu(false);
      };
    desktop.addEventListener("change", close);
    return () => desktop.removeEventListener("change", close);
  }, []);
  useEffect(() => {
    if (!user) setNotifications(false);
  }, [user]);
  const initials = (user?.ho_ten || "Khách")
    .split(" ")
    .slice(-2)
    .map((s) => s[0])
    .join("");
  const go = (page) => navigate(page);
  const search = (event) => {
    event.preventDefault();
    setMenu(false);
    navigate("catalog", null, new URLSearchParams({ q: query }).toString());
  };
  const bell = (
    <button
      className={
        admin
          ? "admin-notification-trigger"
          : "notification-trigger icon-button"
      }
      aria-label="Thông báo"
      aria-haspopup="dialog"
      aria-expanded={notifications}
      title={
        inbox.data?.unread
          ? `${inbox.data.unread} thông báo chưa đọc`
          : "Thông báo"
      }
      onClick={() => setNotifications(true)}
    >
      <span className="notification-bell-icon">
        <Icon name="bell" size={25} />
      </span>
      {admin && (
        <span>
          Thông báo
          <small>
            {inbox.data ? `${inbox.data.unread} chưa đọc` : "Cập nhật của bạn"}
          </small>
        </span>
      )}
      {inbox.data?.unread > 0 && (
        <span className="notification-count">
          {inbox.data.unread > 99 ? "99+" : inbox.data.unread}
        </span>
      )}
    </button>
  );
  const adminNav = (
    <>
      <a className="brand" href="#/pending">
        <span className="brand-mark">B</span>
        <strong>BookBid</strong>
      </a>
      <span className="badge badge-gold">Quản trị viên</span>
      {bell}
      <nav aria-label="Điều hướng quản trị">
        {[
          ["pending", "file", "Kiểm duyệt bài đăng"],
          ["complaints", "shield", "Khiếu nại"],
          ["catalog", "book", "Phiên đấu giá"],
          ["infra", "grid", "Trạng thái hệ thống"],
        ].map(([page, icon, label]) => (
          <a
            key={page}
            href={`#/${page}`}
            aria-current={route.page === page ? "page" : undefined}
            onClick={() => setMenu(false)}
          >
            <Icon name={icon} />
            {label}
          </a>
        ))}
      </nav>
      <a
        href="#/account"
        className="admin-account"
        aria-label="Tài khoản Admin"
        onClick={() => setMenu(false)}
      >
        <span className="avatar">{initials}</span>
        <span>
          <b>{user?.ho_ten}</b>
          <small>Tài khoản quản trị</small>
        </span>
        <Icon name="chevron" />
      </a>
    </>
  );
  const repliesDue = user ? inbox.data?.complaintsToReply ?? 0 : 0;
  const complaintCount = repliesDue > 0 && (
    <span className="complaint-menu-count" aria-label={`${repliesDue} hồ sơ cần phản hồi`}>
      {repliesDue > 99 ? "99+" : repliesDue}
    </span>
  );
  const links = [
    ["home", "Trang chủ"],
    ["catalog", "Đấu giá"],
    ...(user
      ? [
          ["create", "Đăng sách"],
          ["mine", "Bài của tôi"],
          ["trades", "Giao dịch"],
          ["complaints", "Khiếu nại"],
        ]
      : [["account", "Đăng nhập"]]),
  ];
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Đến nội dung chính
      </a>
      {admin ? (
        <>
          <aside
            className="figma-admin-sidebar"
            aria-label="Thanh điều hướng quản trị"
          >
            {adminNav}
          </aside>
          <div className="admin-mobile-menu">
            <button
              className="admin-menu-toggle"
              aria-label="Mở điều hướng quản trị"
              onClick={() => setMenu(true)}
            >
              <Icon name="menu" /> Menu quản trị
            </button>
          </div>
          {menu && (
            <Dialog
              title="Điều hướng quản trị"
              className="admin-navigation-drawer"
              onClose={() => setMenu(false)}
            >
              <div className="figma-admin-sidebar">{adminNav}</div>
            </Dialog>
          )}
        </>
      ) : (
        <header className="site-header" onKeyDown={(event) => {
          if (event.key === "Escape" && menu) {
            setMenu(false);
            menuButton.current?.focus();
          }
        }}>
          <div className="header-inner">
            <a className="brand" href="#/home" onClick={() => setMenu(false)}>
              <span className="brand-mark">B</span>
              <strong>BookBid</strong>
            </a>
            <form className="nav-search" role="search" onSubmit={search}>
              <Icon name="search" size={25} />
              <input
                aria-label="Tìm kiếm toàn hệ thống"
                placeholder="Tìm sách, tác giả, ISBN…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button aria-label="Tìm kiếm" type="submit">
                <Icon name="arrow" />
              </button>
            </form>
            <nav className="desktop-nav" aria-label="Điều hướng chính">
              {links.map(([page, label]) => (
                <a
                  key={page}
                  href={`#/${page}`}
                  aria-current={route.page === page ? "page" : undefined}
                >
                  {label}{page === "complaints" && complaintCount}
                </a>
              ))}
            </nav>
            <div className="header-actions">
              {user && (
                <>
                  {bell}
                  <a href="#/account" className="avatar" aria-label="Tài khoản">
                    {initials}
                  </a>
                </>
              )}
              <button
                ref={menuButton}
                type="button"
                className="icon-button mobile-menu"
                aria-label={menu ? "Đóng điều hướng" : "Mở điều hướng"}
                aria-expanded={menu}
                aria-controls={MOBILE_NAV_ID}
                onClick={() => setMenu((v) => !v)}
              >
                <Icon name={menu ? "close" : "menu"} />
              </button>
            </div>
          </div>
          <nav id={MOBILE_NAV_ID} className="mobile-nav" aria-label="Điều hướng di động" hidden={!menu}>
            {links.map(([page, label]) => (
              <a key={page} href={`#/${page}`} aria-current={route.page === page ? "page" : undefined}
                onClick={() => setMenu(false)}>
                <span>{label}</span>{page === "complaints" && complaintCount}
              </a>
            ))}
          </nav>
        </header>
      )}
      <div className={admin ? "admin-content-wrap" : ""}>
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
        <footer className="site-footer">
          <div>
            <a href="#/home" className="brand">
              <span className="brand-mark">B</span>
              <strong>BookBid</strong>
            </a>
            <p>
              Kết nối những người cùng trân trọng giá trị của từng bản sách.
            </p>
          </div>
          <div>
            <strong>Khám phá</strong>
            <a href="#/catalog">Các phiên đấu giá</a>
          </div>
          <div>
            <strong>{admin ? "Quản trị" : "Không gian của bạn"}</strong>
            {(admin
              ? [
                  ["pending", "Kiểm duyệt"],
                  ["complaints", "Khiếu nại"],
                ]
              : [
                  ["mine", "Bài đăng của tôi"],
                  ["trades", "Giao dịch"],
                  ["complaints", "Khiếu nại"],
                ]
            ).map(([page, label]) => (
              <a key={page} href={`#/${page}`}>
                {label}
              </a>
            ))}
            <a href="#/account">Tài khoản</a>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} BookBid</span>
            <button onClick={() => go("home")}>Về trang chủ</button>
          </div>
        </footer>
      </div>
      {user && notifications && (
        <Notifications
          key={user?.nguoi_dung_id || "guest"}
          inbox={inbox}
          user={user}
          onClose={() => setNotifications(false)}
        />
      )}
    </>
  );
}
