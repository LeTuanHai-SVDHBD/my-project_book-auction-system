import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createApp } from "../src/app.js";
import { createPostRouter } from "../src/routes/post.routes.js";
import { catalogSearch, searchPattern } from "../src/services/catalogSearch.js";
test("search bounds, literal wildcards, normalization and sort whitelist", () => {
  assert.deepEqual(
    catalogSearch({ q: "  Đắc nhân tâm  ", phase: "live", page: "2" }),
    { q: "Đắc nhân tâm", genre: "", phase: "live", sort: "newest", page: 2 },
  );
  assert.equal(searchPattern("Đ%_[~"), "%d~%~_~[~~%");
  for (const q of [
    { q: "x".repeat(121) },
    { q: ["a", "b"] },
    { sort: "price;DROP" },
    { phase: "private" },
    { page: "-1" },
    { page: "10000" },
    { before: "1" },
    { q: "\u0000" },
  ])
    assert.throws(() => catalogSearch(q), { status: 400 });
});
test("HTTP search remains public, bounded and strips internal data", async (t) => {
  let seen;
  const model = {
    search: async (q) => {
      seen = q;
      return {
        items: [
          {
            bai_dang_id: 9,
            ten_sach: "Sách",
            anh_bia: "https://example.test/book.jpg",
            gia_toi_thieu: "123",
            email: "private",
            ai: { secret: 1 },
          },
        ],
        nextPage: 2,
      };
    },
    list: async () => [],
  };
  const postRouter = createPostRouter({
    model,
    service: {},
    limits: {},
    sessionMiddleware: (req, res, next) => next(),
    users: {},
  });
  const server = createServer(
    createApp({
      config: { origins: [], mode: "test" },
      deps: {},
      probes: {},
      postRouter,
    }),
  );
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const base = `http://127.0.0.1:${server.address().port}/api/posts/catalog`;
  const response = await fetch(base + "?q=sach&phase=live&sort=price&page=2"),
    data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(seen.page, 2);
  assert.equal(data.nextPage, 2);
  assert.equal(data.items[0].anh_bia, "https://example.test/book.jpg");
  assert(!JSON.stringify(data).includes("gia_toi_thieu"));
  assert(!JSON.stringify(data).includes("private"));
  assert(!JSON.stringify(data).includes("secret"));
  assert.equal((await fetch(base + "?sort=invalid")).status, 400);
  assert.equal((await fetch(base + "?q=a&q=b")).status, 400);
  assert.equal((await fetch(base + "?q=a&before=1")).status, 400);
});
