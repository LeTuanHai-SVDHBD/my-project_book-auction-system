/** HTTP tài khoản: gửi cookie bằng credentials; CSRF chỉ giữ trong bộ nhớ. */
const base = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
let csrfToken;
let bootstrap;
async function request(path, options = {}) {
  const response = await fetch(`${base}/api/auth${path}`, { credentials: 'include',
    signal: AbortSignal.timeout(12000), ...options });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    if (body?.error === 'INVALID_CSRF') csrfToken = undefined;
    const error = new Error(body?.message || 'Chưa thực hiện được yêu cầu.');
    error.status = response.status; error.code = body?.error; throw error;
  }
  return body;
}
async function ensureCsrf() {
  if (csrfToken) return csrfToken;
  bootstrap ||= request('/csrf').then(body => { csrfToken = body.csrfToken; return csrfToken; })
    .finally(() => { bootstrap = undefined; });
  return bootstrap;
}
async function post(path, body = {}) {
  const token = await ensureCsrf();
  return request(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': token }, body: JSON.stringify(body) });
}
export const authApi = {
  async current() {
    csrfToken = undefined;
    await ensureCsrf();
    try { return (await request('/me')).user; }
    catch (error) { if (error.status === 401) return null; throw error; }
  },
  register: body => post('/register', body),
  async login(body) {
    const result = await post('/login', body); csrfToken = result.csrfToken; return result.user;
  },
  async logout() { await post('/logout'); csrfToken = undefined; },
  admin: () => request('/admin-check'),
};
