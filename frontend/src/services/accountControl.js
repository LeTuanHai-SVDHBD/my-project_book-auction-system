/** Kênh tài khoản riêng; HTTP bù tín hiệu lỡ; không reclaim khi mất/kết nối lại. */
import {useEffect,useState} from 'react';
import {io} from 'socket.io-client';
import {apiRequest} from './authApi.js';
import {getTabId} from './tabIdentity.js';
import {getControlId,isAccountReplaced,markAccountReplaced,markAccountExpired} from './controlIdentity.js';
const base=import.meta.env.VITE_API_URL||'http://127.0.0.1:5000';
export function useAccountControl(user){
  const [blocked,setBlocked]=useState(isAccountReplaced);
  useEffect(()=>{const stop=()=>setBlocked(true);window.addEventListener('account:replaced',stop);return()=>window.removeEventListener('account:replaced',stop);},[]);
  useEffect(()=>{
    if(!user||blocked)return;
    let disposed=false,timer;
    const socket=io(`${base}/account`,{forceNew:true,withCredentials:true,auth:{tabId:getTabId(),controlId:getControlId()},timeout:5000,reconnectionDelayMax:3000});
    socket.on('account:replaced',markAccountReplaced);socket.on('account:expired',markAccountExpired);
    socket.on('connect_error',error=>{if(error.data?.code==='ACCOUNT_REPLACED')markAccountReplaced();else if(error.data?.code==='UNAUTHENTICATED')markAccountExpired();});
    socket.on('disconnect',reason=>{if(reason==='io server disconnect'&&!isAccountReplaced()&&!disposed)socket.connect();});
    async function check(){try{await apiRequest('/auth/control-status');}catch(error){if(error.code==='ACCOUNT_REPLACED')markAccountReplaced();}if(!disposed&&!isAccountReplaced())timer=setTimeout(check,5000);}
    void check();
    return()=>{disposed=true;clearTimeout(timer);socket.removeAllListeners();socket.disconnect();};
  },[user?.nguoi_dung_id,blocked]);
  return blocked;
}
