/** HTTP Mốc 4; dùng chung session và CSRF trong bộ nhớ với mô-đun tài khoản. */
import {apiRequest,apiPost,ensureCsrf} from './authApi.js';
export const postApi={
  search:filters=>apiRequest(`/posts/catalog?${new URLSearchParams(filters)}`),
  list:(mode,before)=>apiRequest(`/posts/${mode}${before?`?before=${before}`:''}`),
  detail:(id,publicOnly=false)=>apiRequest(`/posts/${publicOnly?'catalog/':''}${id}`),
  save:(body,id,mode)=>apiPost(id?`/posts/${id}/${mode}`:'/posts',body),
  review:(id,body)=>apiPost(`/posts/${id}/review`,body),
  exportReview:(id,reviewId)=>apiPost(`/posts/${id}/reviews/${reviewId}/export`),
  activate:(id,body)=>apiPost(`/posts/${id}/activate`,body),
  config:()=>apiRequest('/media/config'),
  async upload(file) {
    const kind=file.type.startsWith('image/')?'image':'video';
    return apiRequest(`/media/${kind}`,{method:'POST',headers:{'Content-Type':file.type,'x-csrf-token':await ensureCsrf()},body:file,signal:AbortSignal.timeout(150000)});
  },
  async discard(id) {return apiRequest(`/media/${id}`,{method:'DELETE',headers:{'x-csrf-token':await ensureCsrf()}});},
};
