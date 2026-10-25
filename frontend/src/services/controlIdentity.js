/** Mã tài liệu chỉ ở bộ nhớ, F5 tạo mã mới; không thay cookie/CSRF và không tự reclaim khi reconnect. */
import {ACCOUNT_REPLACED_MESSAGE} from '../../../shared/accountControl.js';
let controlId,replaced=false,blockMessage=ACCOUNT_REPLACED_MESSAGE;
export const getControlId=()=>controlId||=(crypto.randomUUID().replaceAll('-',''));
export const isAccountReplaced=()=>replaced;
export function markAccountReplaced(){if(!replaced){replaced=true;window.dispatchEvent(new Event('account:replaced'));}}
export function markAccountExpired(){if(!replaced){blockMessage='Phiên đăng nhập đã hết hạn hoặc không còn hợp lệ. Vui lòng F5 (tải lại trang) và đăng nhập lại.';markAccountReplaced();}}
export const getAccountBlockMessage=()=>blockMessage;
export function replacedError(){return Object.assign(new Error(blockMessage),{status:409,code:'ACCOUNT_REPLACED'});}
