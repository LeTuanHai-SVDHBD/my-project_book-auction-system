/** Điều phối session và phản hồi HTTP; không trả hash mật khẩu. */
import { randomBytes } from 'node:crypto';
import {HttpError} from '../middlewares/errorHandler.js';
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
      await req.accountControl?.claim(req);
      res.json({ user, csrfToken: req.session.csrfToken });
    },
    async logout(req, res) {
      await req.accountControl?.release(req);
      await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
      res.clearCookie(authConfig.cookieName, authConfig.cookie);
      res.status(204).end();
    },
    me(req, res) { res.json({ user: req.user }); },
    async control(req,res){
      if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)||Object.keys(req.body).length)throw new HttpError(400,'INVALID_CONTROL_INPUT','Thao tác điều khiển chỉ nhận body rỗng.');
      await req.accountControl?.assert(req);res.json({ok:true});
    },
    admin(req, res) { res.json({ ok: true, message: 'Bạn có quyền quản trị.', user: req.user }); },
  };
}
