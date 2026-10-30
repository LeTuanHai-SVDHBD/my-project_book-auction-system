/** Approved home layout backed by the public catalog, never fixture auction data. */
import { BOOK_GENRE_GROUPS } from "../../../shared/bookGenres.js";
import { useEffect, useState } from "react";
import { postApi } from "../services/postApi.js";
import { navigate } from "../services/navigation.js";
import { useAuctionRealtime } from "../services/auctionRealtime.js";
import BookCard from "./BookCard.jsx";
import { Icon } from "./DesignUi.jsx";
export default function Home() {
  const [q, setQ] = useState(""),
    [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    postApi
      .search({ phase: "live", sort: "ending", page: 1 })
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useAuctionRealtime({
    onChange: async () => {
      try {
        const v = await postApi.search({
          phase: "live",
          sort: "ending",
          page: 1,
        });
        setData(v);
        setError("");
      } catch (e) {
        setError(e.message);
      }
    },
  });
  return (
    <>
      <section className="figma-hero">
        <div className="figma-hero-copy">
          <span className="badge badge-gold">
            Không gian dành cho người yêu sách
          </span>
          <h1>
            Mỗi cuốn sách quý,
            <br />
            <em>một câu chuyện vô giá.</em>
          </h1>
          <p>
            Khám phá những bản sách mang dấu ấn thời gian. Đấu giá công khai,
            kết nối cùng những người trân trọng sách.
          </p>
          <form
            className="figma-hero-search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate("catalog", null, new URLSearchParams({ q }).toString());
            }}
          >
            <Icon name="search" size={30} />
            <input
              value={q}
              maxLength={120}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Tìm cuốn sách bạn yêu thích"
              placeholder="Bạn đang tìm cuốn sách nào?"
            />
            <button className="btn btn-gold">Tìm kiếm</button>
          </form>
          <div className="figma-trust-row">
            <b>
              01<span>Bản sách / phiên</span>
            </b>
            <b>
              <Icon name="image" size={32} />
              <span>Ảnh chi tiết bản sách</span>
            </b>
            <b>
              <Icon name="play" size={32} />
              <span>Video giới thiệu</span>
            </b>
          </div>
        </div>
        <div className="figma-hero-image">
          <img src="/assets/library.jpg" alt="Không gian thư viện" />
          <div className="panel">
            <Icon name="shield" size={32} />
            <div>
              <b>Kiểm duyệt trước đấu giá</b>
              <span>Thông tin rõ ràng, bằng chứng đầy đủ</span>
            </div>
          </div>
        </div>
      </section>
      <section className="figma-section">
        <h2>Khám phá theo thể loại</h2>
        <div className="figma-chips">
          {BOOK_GENRE_GROUPS.map((group) => (
            <a
              key={group.name}
              href={`#/catalog?${new URLSearchParams({ group: group.name })}`}
            >
              {group.name}
            </a>
          ))}
        </div>
      </section>
      <section className="figma-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Phiên đấu giá trực tiếp</span>
            <h2>Đang đấu giá</h2>
          </div>
          <a className="btn btn-outline" href="#/catalog">
            Xem tất cả
          </a>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {!data && !error && <p role="status">Đang tải phiên đấu giá…</p>}
        {data && !data.items.length && (
          <div className="empty-state">
            <Icon name="book" size={48} />
            <h3>Chưa có phiên đang diễn ra</h3>
            <p>
              Khám phá danh mục để xem các phiên sắp bắt đầu và kết quả đã lưu.
            </p>
            <a href="#/catalog" className="btn btn-outline">
              Khám phá danh mục
            </a>
          </div>
        )}
        <div className="home-book-grid">
          {data?.items.slice(0, 4).map((post) => (
            <BookCard post={post} key={post.bai_dang_id} />
          ))}
        </div>
      </section>
      <section className="figma-section figma-feature-band">
        <div>
          <span className="eyebrow">Từng bản sách, từng câu chuyện</span>
          <h2>Xem kỹ trước khi đặt giá</h2>
          <p>
            Ảnh bìa, gáy, trang xuất bản và video thuộc cùng một bản sách giúp
            bạn đối chiếu mô tả.
          </p>
          <a className="btn btn-gold" href="#/catalog">
            Khám phá các phiên
          </a>
        </div>
        <Icon name="book" size={120} />
        <div>
          <Icon name="shield" size={42} />
          <h2>Thông tin có căn cứ</h2>
          <p>
            AI hỗ trợ phân tích. Admin đối chiếu bằng chứng và đưa ra quyết định
            kiểm duyệt.
          </p>
        </div>
      </section>
    </>
  );
}
