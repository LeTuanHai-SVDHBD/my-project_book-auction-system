/** HTTP tài khoản: gửi cookie bằng credentials; CSRF chỉ giữ trong bộ nhớ. */
import {getTabId} from './tabIdentity.js';
import {getControlId,isAccountReplaced,markAccountReplaced,replacedError} from './controlIdentity.js';
const base = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
let csrfToken;
let bootstrap;
let claimedUserId,claiming;
export async function apiRequest(path, options = {}) {
  if(isAccountReplaced())throw replacedError();
  const headers=new Headers(options.headers);headers.set('x-tab-id',getTabId());
  headers.set('x-control-id',getControlId());
  const response = await fetch(`${base}/api${path}`, { signal:AbortSignal.timeout(12000), ...options,
    credentials:'include',headers });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    if(body?.error==='ACCOUNT_REPLACED')markAccountReplaced();
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
    try {
      const user=(await apiRequest('/auth/me')).user;
      if(claimedUserId!==user.nguoi_dung_id){claiming||=apiPost('/auth/control').then(()=>{claimedUserId=user.nguoi_dung_id;}).finally(()=>{claiming=undefined;});await claiming;}
      return user;
    }
    catch (error) { if (error.status === 401) return null; throw error; }
  },
  register: body => apiPost('/auth/register', body),
  async login(body) {
    const result = await apiPost('/auth/login', body); csrfToken = result.csrfToken;claimedUserId=result.user.nguoi_dung_id;return result.user;
  },
  async logout() { await apiPost('/auth/logout'); csrfToken = undefined;claimedUserId=undefined; },
  admin: () => apiRequest('/auth/admin-check'),
};
