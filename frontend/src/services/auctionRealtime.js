/** Socket chỉ nhận tín hiệu công khai; luôn lấy lại SQL qua HTTP sau join/reconnect và định kỳ để bù thông báo mất. */
import {useEffect,useRef,useState} from 'react';
import {io} from 'socket.io-client';
import {isAccountReplaced} from './controlIdentity.js';
const base=import.meta.env.VITE_API_URL||'http://127.0.0.1:5000';
export function useAuctionRealtime({auctionId=null,onChange,enabled=true}) {
  const latest=useRef(onChange);latest.current=onChange;
  const [state,setState]=useState('connecting');
  useEffect(()=>{
    if(!enabled||isAccountReplaced())return;
    let disposed=false,timer,running=false,dirty=false,watching=false,joining=false,watchRevision=0;
    async function flush(){
      if(disposed||running)return;running=true;dirty=false;
      try{await latest.current?.();}catch{if(!disposed)setState('reconnecting');}finally{running=false;if(dirty&&!disposed)sync();}
    }
    const sync=()=>{dirty=true;if(timer===undefined)timer=setTimeout(()=>{timer=undefined;void flush();},80);};
    const socket=io(`${base}/auctions`,{autoConnect:false,forceNew:true,timeout:5000,reconnectionDelayMax:3000});
    function watch(){
      if(!socket.connected||joining)return;joining=true;
      const revision=++watchRevision;
      setState('syncing');
      socket.timeout(5000).emit('auction:watch',auctionId===null?{catalog:true}:{auctionId},(error,reply)=>{
        if(disposed||revision!==watchRevision)return;
        joining=false;watching=!error&&reply?.ok===true;
        setState(watching?'live':'reconnecting');sync();
      });
    }
    socket.on('connect',watch);
    socket.on('auction:changed',value=>{if(auctionId===null||value?.auctionId===auctionId)sync();});
    socket.on('disconnect',reason=>{++watchRevision;watching=false;joining=false;if(!disposed){setState('reconnecting');if(reason==='io server disconnect')socket.connect();}});
    socket.on('connect_error',()=>{if(!disposed)setState('reconnecting');});
    const focus=()=>sync(),visible=()=>{if(!document.hidden)sync();};
    window.addEventListener('focus',focus);document.addEventListener('visibilitychange',visible);
    const fallback=setInterval(()=>{if(!watching)watch();sync();},5000);socket.connect();sync();
    const stop=()=>{disposed=true;clearTimeout(timer);clearInterval(fallback);socket.removeAllListeners();socket.disconnect();};
    window.addEventListener('account:replaced',stop);
    return()=>{stop();window.removeEventListener('account:replaced',stop);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',visible);};
  },[auctionId,enabled]);
  return state;
}
