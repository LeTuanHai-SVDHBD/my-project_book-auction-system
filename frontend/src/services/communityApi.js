/** HTTP sau phiên dùng chung cookie theo tab và CSRF; không gửi danh tính hoặc URL bằng chứng từ client. */
import {apiRequest,apiPost} from './authApi.js';
export const communityGet=path=>apiRequest('/community'+path);
export const communityPost=(path,body={})=>apiPost('/community'+path,body);
