/** HTTP Mốc 4; dùng chung session và CSRF trong bộ nhớ với mô-đun tài khoản. */
import {detectMedia} from '../../../shared/mediaFormats.js';
import {apiRequest,apiPost,ensureCsrf,getSessionRevision} from './authApi.js';
export const postApi={
  search:filters=>apiRequest(`/posts/catalog?${new URLSearchParams(filters)}`),
  list:(mode,before,status)=>{const params=new URLSearchParams();if(before)params.set('before',before);if(mode==='pending')params.set('status',status||'all');return apiRequest(`/posts/${mode}${params.size?'?'+params:''}`);},
  detail:(id,publicOnly=false)=>apiRequest(`/posts/${publicOnly?'catalog/':''}${id}`),
  save:(body,id,mode)=>apiPost(id?`/posts/${id}/${mode}`:'/posts',body),
  exportReview:(id,reviewId)=>apiPost(`/posts/${id}/reviews/${reviewId}/export`),
  activate:(id,body)=>apiPost(`/posts/${id}/activate`,body),
  config:()=>apiRequest('/media/config'),
  async identify(file) {
    const actual=detectMedia(await file.slice(0,65536).arrayBuffer());
    if(!actual)throw new Error('Không nhận diện được nội dung ảnh/video hoặc tệp đã hỏng. Hãy xuất lại tệp từ ứng dụng gốc.');
    return actual;
  },
  async upload(file,config,actual,revision=getSessionRevision()) {
    actual ||= await this.identify(file);
    const {kind,mime}=actual;
    const configured=config?.uploadTimeoutMs?.[kind];
    const timeout=Number.isInteger(configured)&&configured>=1000&&configured<=1200000?configured:(kind==='video'?700000:500000);
    try { const csrf=await ensureCsrf();if(revision!==getSessionRevision())throw Object.assign(new Error('Phiên đăng nhập đã thay đổi; tệp chưa được gửi.'),{status:401});
      return await apiRequest(`/media/${kind}`,{method:'POST',headers:{'Content-Type':mime,'x-csrf-token':csrf},body:file,signal:AbortSignal.timeout(timeout)}); }
    catch(error){if(['TimeoutError','AbortError'].includes(error.name))throw new Error('Hết thời gian chờ xác nhận tệp. Tệp có thể đã lên Cloudinary; chưa thể đưa vào bài. Không tải lại liên tục.');if(error instanceof TypeError)throw new Error('Mất kết nối với API khi tải tệp. Chưa xác nhận được kết quả tải lên.');throw error;}
  },
  async discard(id) {return apiRequest(`/media/${id}`,{method:'DELETE',headers:{'x-csrf-token':await ensureCsrf()}});},
};
