/** Private inbox: session ownership, no-store and CSRF for read receipts. */
import { Router } from "express";
import { requireUser, requireCsrf } from "../middlewares/auth.js";
import { id, object } from "../services/postValidation.js";
export function createNotificationRouter({ sessionMiddleware, users, model }) {
  const router = Router();
  router.use(
    (req, res, next) => {
      res.set("Cache-Control", "no-store");
      next();
    },
    sessionMiddleware,
    requireUser(users),
  );
  router.get("/", async (req, res) => {
    object(req.query, ["before"], "Thông báo");
    res.json(
      await model.list(
        req.user,
        req.query.before === undefined ? 2147483647 : id(req.query.before),
      ),
    );
  });
  router.post("/:id/read", requireCsrf, async (req, res) => {
    object(req.body, [], "Đọc thông báo");
    res.json(await model.read(req.user, id(req.params.id)));
  });
  return router;
}
