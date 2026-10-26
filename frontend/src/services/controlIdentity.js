/** Đánh dấu phiên đã kết thúc để dừng thao tác cũ; đăng nhập lại bằng mật khẩu mới mở phiên mới. */
import {ACCOUNT_REPLACED_MESSAGE} from '../../../shared/accountControl.js';
let controlId,replaced=false,blockMessage=ACCOUNT_REPLACED_MESSAGE;
export const getControlId=()=>controlId||=(crypto.randomUUID().replaceAll('-',''));
export const isAccountReplaced=()=>replaced;
export function markAccountReplaced(){if(!replaced){replaced=true;window.dispatchEvent(new CustomEvent('account:signed-out',{detail:{message:blockMessage}}));}}
export function markAccountExpired(){if(!replaced){blockMessage='Phiên đăng nhập đã hết hạn hoặc không còn hợp lệ. Vui lòng đăng nhập lại.';markAccountReplaced();}}
export function resetAccountControl(){replaced=false;blockMessage=ACCOUNT_REPLACED_MESSAGE;}
export function replacedError(){return Object.assign(new Error(blockMessage),{status:401,code:'ACCOUNT_REPLACED'});}
