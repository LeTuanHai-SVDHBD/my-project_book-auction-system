/** HTTP Mốc 4; dùng chung session và CSRF trong bộ nhớ với mô-đun tài khoản. */
import {apiRequest,apiPost,ensureCsrf} from './authApi.js';
export const postApi={
  search:filters=>apiRequest(`/posts/catalog?${new URLSearchParams(filters)}`),
  list:(mode,before,status)=>{const params=new URLSearchParams();if(before)params.set('before',before);if(mode==='pending')params.set('status',status||'all');return apiRequest(`/posts/${mode}${params.size?'?'+params:''}`);},
  detail:(id,publicOnly=false)=>apiRequest(`/posts/${publicOnly?'catalog/':''}${id}`),
  save:(body,id,mode)=>apiPost(id?`/posts/${id}/${mode}`:'/posts',body),
  review:(id,body)=>apiPost(`/posts/${id}/review`,body),
  exportReview:(id,reviewId)=>apiPost(`/posts/${id}/reviews/${reviewId}/export`),
  activate:(id,body)=>apiPost(`/posts/${id}/activate`,body),
  config:()=>apiRequest('/media/config'),
  async upload(file,config) {
    const kind=file.type.startsWith('image/')?'image':'video';
    const configured=config?.uploadTimeoutMs?.[kind];
    const timeout=Number.isInteger(configured)&&configured>=1000&&configured<=1200000?configured:(kind==='video'?700000:500000);
    try { return await apiRequest(`/media/${kind}`,{method:'POST',headers:{'Content-Type':file.type,'x-csrf-token':await ensureCsrf()},body:file,signal:AbortSignal.timeout(timeout)}); }
    catch(error){if(['TimeoutError','AbortError'].includes(error.name))throw new Error('Hết thời gian chờ xác nhận tệp. Tệp có thể đã lên Cloudinary; chưa thể đưa vào bài. Không tải lại liên tục.');if(error instanceof TypeError)throw new Error('Mất kết nối với API khi tải tệp. Chưa xác nhận được kết quả tải lên.');throw error;}
  },
  async discard(id) {return apiRequest(`/media/${id}`,{method:'DELETE',headers:{'x-csrf-token':await ensureCsrf()}});},
};
