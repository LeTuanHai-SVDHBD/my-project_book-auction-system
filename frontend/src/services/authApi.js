/** HTTP tài khoản: gửi cookie bằng credentials; CSRF chỉ giữ trong bộ nhớ. */
import {browserApiBase} from './apiBase.js';
import {getTabId} from './tabIdentity.js';
import {getControlId,isAccountReplaced,markAccountReplaced,markAccountExpired,resetAccountControl,replacedError} from './controlIdentity.js';
const base=browserApiBase();
let csrfToken;
let bootstrap;
let authenticated=false,sessionRevision=0;
export function invalidateSession(replaced=true){csrfToken=undefined;authenticated=false;++sessionRevision;if(replaced)markAccountReplaced();else markAccountExpired();}
export async function apiRequest(path, options = {}) {
  if(isAccountReplaced()&&!['/auth/csrf','/auth/login','/auth/register','/auth/me'].includes(path))throw replacedError();
  const revision=sessionRevision;
  const headers=new Headers(options.headers);headers.set('x-tab-id',getTabId());
  headers.set('x-control-id',getControlId());
  const response = await fetch(`${base}/api${path}`, { signal:AbortSignal.timeout(12000), ...options,
    credentials:'include',headers });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    if(revision===sessionRevision&&(body?.error==='ACCOUNT_REPLACED'||response.status===401&&authenticated&&body?.error==='UNAUTHENTICATED'))invalidateSession(body?.error==='ACCOUNT_REPLACED');
    if (revision===sessionRevision&&body?.error === 'INVALID_CSRF') csrfToken = undefined;
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
  const revision=sessionRevision;
  const send=async()=>apiRequest(path,{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':await ensureCsrf()},body:JSON.stringify(body)});
  try{return await send();}
  catch(error){
    // INVALID_CSRF is returned before the route mutates data. Retry exactly once;
    // never retry a lost response, business error or request from an older session.
    if(error.status!==403||error.code!=='INVALID_CSRF'||revision!==sessionRevision)throw error;
    csrfToken=undefined;
    return send();
  }
}

export const authApi = {
  async current() {
    csrfToken = undefined;
    await ensureCsrf();
    try {
      const user=(await apiRequest('/auth/me')).user;
      authenticated=true;return user;
    }
    catch (error) { if (error.status === 401) return null; throw error; }
  },
  register: body => apiPost('/auth/register', body),
  async login(body) {
    const result = await apiPost('/auth/login', body); csrfToken = result.csrfToken;authenticated=true;++sessionRevision;resetAccountControl();return result.user;
  },
  async logout() { await apiPost('/auth/logout'); csrfToken = undefined;authenticated=false;++sessionRevision; },
  admin: () => apiRequest('/auth/admin-check'),
};
