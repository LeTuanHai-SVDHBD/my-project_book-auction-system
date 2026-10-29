/** BookBid presentation on existing authenticated APIs and auction control policy. */
import { useEffect, useState } from "react";
import AccountPanel from "./components/AccountPanel.jsx";
import InfrastructurePanel from "./components/InfrastructurePanel.jsx";
import TransactionsPanel from "./components/TransactionsPanel.jsx";
import ComplaintsPanel from "./components/ComplaintsPanel.jsx";
import PostsPanel from "./components/PostsPanel.jsx";
import BookBidShell from "./components/BookBidShell.jsx";
import Home from "./components/Home.jsx";
import { useAccountControl } from "./services/accountControl.js";
import { useNavigation, navigate } from "./services/navigation.js";
export default function App() {
  const route = useNavigation(),
    [user, setUser] = useState(null);
  useAccountControl(user);
  useEffect(() => {
    const signedOut = () => {
      setUser(null);
      navigate("account");
    };
    window.addEventListener("account:signed-out", signedOut);
    return () => window.removeEventListener("account:signed-out", signedOut);
  }, []);
  const protectedPage =
    (["mine", "create", "trades"].includes(route.page) &&
      user?.vai_tro !== "nguoi_dung") ||
    (route.page === "pending" && user?.vai_tro !== "admin") ||
    (route.page === "complaints" && !user);
  const page = protectedPage ? "account" : route.page;
  return (
    <BookBidShell user={user} route={route}>
      <div hidden={page !== "account"}>
        <AccountPanel onUserChange={setUser} />
      </div>
      {page === "home" && <Home />}
      {["catalog", "mine", "pending", "create"].includes(page) && (
        <PostsPanel
          key={`${page}-${user?.nguoi_dung_id || "guest"}-${route.query}`}
          mode={page === "create" ? "mine" : page}
          user={user}
          selectedId={route.id}
          initialCreate={page === "create"}
          query={route.query}
        />
      )}
      {page === "trades" && user && (
        <TransactionsPanel
          key={user.nguoi_dung_id}
          user={user}
          selectedId={route.id}
        />
      )}
      {page === "complaints" && user && (
        <ComplaintsPanel
          key={user.nguoi_dung_id}
          user={user}
          selectedId={route.id}
        />
      )}
      {page === "infra" && <InfrastructurePanel />}
      {![
        "home",
        "account",
        "catalog",
        "mine",
        "pending",
        "create",
        "trades",
        "complaints",
        "infra",
      ].includes(page) && (
        <div className="page-container empty-state">
          <h1>Không tìm thấy trang</h1>
          <a href="#/home">Về trang chủ</a>
        </div>
      )}
    </BookBidShell>
  );
}
