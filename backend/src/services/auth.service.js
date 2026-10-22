/** Xác thực tài khoản và đầu vào; API công khai luôn tạo vai trò nguoi_dung. */
import { HttpError } from '../middlewares/errorHandler.js';
export function normalizeEmail(value) {
  if (typeof value !== 'string') throw new HttpError(400, 'INVALID_INPUT', 'Email không hợp lệ.');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(email)) {
    throw new HttpError(400, 'INVALID_INPUT', 'Email không hợp lệ.');
  }
  return email;
}
export function validateCredentials(body, registering = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'INVALID_INPUT', 'Dữ liệu không hợp lệ.');
  const allowed = registering ? ['ho_ten', 'email', 'mat_khau'] : ['email', 'mat_khau'];
  if (Object.keys(body).some(key => !allowed.includes(key))) throw new HttpError(400, 'INVALID_INPUT', 'Có trường dữ liệu không được phép.');
  const email = normalizeEmail(body.email);
  const password = body.mat_khau;
  if (typeof password !== 'string' || password.length < (registering ? 12 : 1) || password.length > 128) {
    throw new HttpError(400, 'INVALID_INPUT', registering ? 'Mật khẩu cần từ 12 đến 128 ký tự.' : 'Mật khẩu không hợp lệ.');
  }
  let name;
  if (registering) {
    name = typeof body.ho_ten === 'string' ? body.ho_ten.trim() : '';
    if (!name || name.length > 100 || /[\x00-\x1f\x7f]/.test(name)) throw new HttpError(400, 'INVALID_INPUT', 'Họ tên cần từ 1 đến 100 ký tự.');
  }
  return { email, password, name };
}
export function publicUser(user) {
  // Danh sách cho phép: kể cả khi model trả thêm cột nhạy cảm, HTTP cũng không đưa ra ngoài.
  return Object.fromEntries(['nguoi_dung_id', 'ho_ten', 'email', 'so_dien_thoai', 'dia_chi',
    'anh_dai_dien', 'anh_bia', 'vai_tro', 'ngay_tao'].map(key => [key, user[key] ?? null]));
}
export function createAuthService({ users, passwords }) {
  return {
    async register(input) {
      const passwordHash = await passwords.hash(input.password);
      try {
        return publicUser(await users.create({ ho_ten: input.name, email: input.email, passwordHash, role: 'nguoi_dung' }));
      } catch (error) {
        if (error.code === 'EMAIL_EXISTS') throw new HttpError(409, 'EMAIL_EXISTS', 'Email đã được sử dụng.');
        throw error;
      }
    },
    async login(input) {
      const user = await users.findByEmail(input.email);
      if (!await passwords.verify(user?.mat_khau, input.password) || !user) {
        throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
      }
      return publicUser(user);
    },
  };
}
