/** Kênh tài khoản riêng; mất phiên thì xóa tài khoản ở giao diện, HTTP bù thông báo lỡ, không tự đăng nhập lại. */
import {browserApiBase} from './apiBase.js';
import {useEffect} from 'react';
import {io} from 'socket.io-client';
import {apiRequest,invalidateSession} from './authApi.js';
import {getTabId} from './tabIdentity.js';
import {getControlId,isAccountReplaced} from './controlIdentity.js';
const base=browserApiBase();
export function useAccountControl(user){
  useEffect(()=>{
    if(!user||isAccountReplaced())return;
    let disposed=false,timer;
    const socket=io(`${base}/account`,{forceNew:true,withCredentials:true,auth:{tabId:getTabId(),controlId:getControlId()},timeout:5000,reconnectionDelayMax:3000});
    socket.on('account:replaced',()=>invalidateSession());socket.on('account:expired',()=>invalidateSession(false));
    socket.on('connect_error',error=>{if(error.data?.code==='ACCOUNT_REPLACED')invalidateSession();else if(error.data?.code==='UNAUTHENTICATED')invalidateSession(false);});
    socket.on('disconnect',reason=>{if(reason==='io server disconnect'&&!isAccountReplaced()&&!disposed)socket.connect();});
    async function check(){try{await apiRequest('/auth/control-status');}catch(error){if(error.code==='ACCOUNT_REPLACED')invalidateSession();}if(!disposed&&!isAccountReplaced())timer=setTimeout(check,5000);}
    void check();
    return()=>{disposed=true;clearTimeout(timer);socket.removeAllListeners();socket.disconnect();};
  },[user?.nguoi_dung_id]);
}
