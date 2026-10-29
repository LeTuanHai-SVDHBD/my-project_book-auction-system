import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import session from "express-session";
import { createApp } from "../src/app.js";
import { createAuthRouter } from "../src/routes/auth.routes.js";
import { createNotificationRouter } from "../src/routes/notification.routes.js";
import { createSessionMiddleware } from "../src/middlewares/session.js";
import { parseAuthConfig } from "../src/config/auth.js";
import { HttpError } from "../src/middlewares/errorHandler.js";
test("inbox requires session, isolates recipient including Admin, validates CSRF/body/cursor", async (t) => {
  const authConfig = parseAuthConfig({
      SESSION_SECRET: "notification-http-test-".repeat(4),
    }),
    sessionMiddleware = createSessionMiddleware(
      authConfig,
      new session.MemoryStore(),
    );
  const list = [1, 2, 3].map((id) => ({
    nguoi_dung_id: id,
    email: `n${id}@example.test`,
    ho_ten: `User ${id}`,
    vai_tro: id === 3 ? "admin" : "nguoi_dung",
    mat_khau: "hash",
  }));
  const users = {
    findById: async (id) => list.find((u) => u.nguoi_dung_id === id),
    findByEmail: async (email) => list.find((u) => u.email === email),
  };
  const rows = [
    { thong_bao_id: 1, owner: 1, ngay_doc: null },
    { thong_bao_id: 2, owner: 2, ngay_doc: null },
  ];
  let before;
  const model = {
    list: async (user, cursor) => {
      before = cursor;
      return {
        items: rows
          .filter((r) => r.owner === user.nguoi_dung_id)
          .map(({ owner, ...r }) => r),
      };
    },
    read: async (user, id) => {
      const row = rows.find(
        (r) => r.thong_bao_id === id && r.owner === user.nguoi_dung_id,
      );
      if (!row)
        throw new HttpError(
          404,
          "NOTIFICATION_NOT_FOUND",
          "Không tìm thấy thông báo.",
        );
      row.ngay_doc ||= new Date().toISOString();
      return { ok: true };
    },
  };
  const authRouter = createAuthRouter({
      authConfig,
      sessionMiddleware,
      users,
      passwords: { verify: async () => true },
      limiter: { consume: async () => 0 },
    }),
    notificationRouter = createNotificationRouter({
      sessionMiddleware,
      users,
      model,
    });
  const server = createServer(
    createApp({
      config: { mode: "test", origins: [] },
      deps: {},
      probes: {},
      authRouter,
      notificationRouter,
    }),
  );
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  function client() {
    return {
      cookie: "",
      token: "",
      async call(path, method = "GET", body, csrf = true) {
        const r = await fetch(base + path, {
          method,
          headers: {
            cookie: this.cookie,
            ...(body ? { "content-type": "application/json" } : {}),
            ...(csrf ? { "x-csrf-token": this.token } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        for (const v of r.headers.getSetCookie()) this.cookie = v.split(";")[0];
        const data = await r.json();
        if (data.csrfToken) this.token = data.csrfToken;
        return { status: r.status, data };
      },
      async login(id) {
        await this.call("/auth/csrf");
        await this.call("/auth/login", "POST", {
          email: `n${id}@example.test`,
          mat_khau: "fixture-password",
        });
      },
    };
  }
  const a = client(),
    b = client(),
    admin = client(),
    guest = client();
  await a.login(1);
  await b.login(2);
  await admin.login(3);
  assert.equal((await guest.call("/notifications")).status, 401);
  assert.equal((await a.call("/notifications")).data.items[0].thong_bao_id, 1);
  assert.equal((await admin.call("/notifications")).data.items.length, 0);
  assert.equal((await b.call("/notifications/1/read", "POST", {})).status, 404);
  assert.equal(
    (await admin.call("/notifications/1/read", "POST", {})).status,
    404,
  );
  assert.equal(
    (await a.call("/notifications/1/read", "POST", {}, false)).status,
    403,
  );
  assert.equal(
    (await a.call("/notifications/1/read", "POST", { nguoi_dung_id: 2 }))
      .status,
    400,
  );
  assert.equal((await a.call("/notifications?before=-1")).status, 400);
  assert.equal((await a.call("/notifications?userId=2")).status, 400);
  assert.equal((await a.call("/notifications/1/read", "POST", {})).status, 200);
  const stamp = rows[0].ngay_doc;
  await a.call("/notifications/1/read", "POST", {});
  assert.equal(rows[0].ngay_doc, stamp);
  await a.call("/notifications?before=2");
  assert.equal(before, 2);
});
