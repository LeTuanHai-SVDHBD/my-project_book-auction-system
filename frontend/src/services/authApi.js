/** HTTP tài khoản: gửi cookie bằng credentials; CSRF chỉ giữ trong bộ nhớ. */
import {getTabId} from './tabIdentity.js';
const base = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
let csrfToken;
let bootstrap;
export async function apiRequest(path, options = {}) {
  const headers=new Headers(options.headers);headers.set('x-tab-id',getTabId());
  const response = await fetch(`${base}/api${path}`, { signal:AbortSignal.timeout(12000), ...options,
    credentials:'include',headers });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    if (body?.error === 'INVALID_CSRF') csrfToken = undefined;
    const error = new Error(body?.message || 'Chưa thực hiện được yêu cầu.');
    error.status = response.status; error.code = body?.error; throw error;
  }
  return body;
}
export async function ensureCsrf() {
  if (csrfToken) return csrfToken;
  bootstrap ||= apiRequest('/auth/csrf').then(body => { csrfToken = body.csrfToken; return csrfToken; })
    .finally(() => { bootstrap = undefined; });
  return bootstrap;
}
export async function apiPost(path, body = {}) {
  const token = await ensureCsrf();
  return apiRequest(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': token }, body: JSON.stringify(body) });
}
export const authApi = {
  async current() {
    csrfToken = undefined;
    await ensureCsrf();
    try { return (await apiRequest('/auth/me')).user; }
    catch (error) { if (error.status === 401) return null; throw error; }
  },
  register: body => apiPost('/auth/register', body),
  async login(body) {
    const result = await apiPost('/auth/login', body); csrfToken = result.csrfToken; return result.user;
  },
  async logout() { await apiPost('/auth/logout'); csrfToken = undefined; },
  admin: () => apiRequest('/auth/admin-check'),
};
