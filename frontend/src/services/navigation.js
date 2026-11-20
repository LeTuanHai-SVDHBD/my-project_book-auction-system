/** Hash routes preserve back/refresh and keep post/auction/trade IDs distinct. */
import { useEffect, useState } from "react";
export function navigate(page, id, query = "") {
  window.location.hash = `/${page}${id ? "/" + id : ""}${query ? "?" + query : ""}`;
}
export function useNavigation() {
  const read = () => {
    const [path, query = ""] = window.location.hash
      .replace(/^#\/?/, "")
      .split("?");
    const [page = "home", raw] = path.split("/");
    return {
      page: page || "home",
      id: /^[1-9]\d*$/.test(raw || "") ? Number(raw) : null,
      query,
    };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const change = () => {
      setRoute(read());
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  return route;
}
