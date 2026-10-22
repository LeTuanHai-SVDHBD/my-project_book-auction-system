/** Điều phối session và phản hồi HTTP; không trả hash mật khẩu. */
import { randomBytes } from 'node:crypto';
const save = req => new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
export function createAuthController({ service, authConfig }) {
  return {
    async csrf(req, res) {
      req.session.csrfToken ||= randomBytes(32).toString('hex');
      await save(req);
      res.json({ csrfToken: req.session.csrfToken });
    },
    async register(req, res) {
      const user = await service.register(req.authInput);
      res.status(201).json({ user, message: 'Đăng ký thành công. Bạn có thể đăng nhập.' });
    },
    async login(req, res) {
      const user = await service.login(req.authInput);
      // Đổi session ID sau xác thực để chặn session fixation.
      await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
      req.session.userId = user.nguoi_dung_id;
      req.session.csrfToken = randomBytes(32).toString('hex');
      await save(req);
      res.json({ user, csrfToken: req.session.csrfToken });
    },
    async logout(req, res) {
      await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
      res.clearCookie(authConfig.cookieName, authConfig.cookie);
      res.status(204).end();
    },
    me(req, res) { res.json({ user: req.user }); },
    admin(req, res) { res.json({ ok: true, message: 'Bạn có quyền quản trị.', user: req.user }); },
  };
}
