/** Socket tài khoản xác thực cookie/tab và quyền Redis; đóng chủ cũ, heartbeat bù Pub/Sub bị mất. */
import {ServerResponse} from 'node:http';
import {requireUser} from '../middlewares/auth.js';
import {ACCOUNT_REPLACED_MESSAGE} from '../../../shared/accountControl.js';
export function attachAccountSockets({io,sessionMiddleware,users,control,log=()=>{},heartbeatMs=5000}){
  const namespace=io.of('/account');
  namespace.use(async(socket,next)=>{
    try{
      const auth=socket.handshake.auth||{};
      if(!/^[0-9a-f]{32}$/.test(auth.tabId||'')||!/^[0-9a-f]{32}$/.test(auth.controlId||''))throw Object.assign(Error('INVALID_CONTROL_ID'),{code:'INVALID_CONTROL_ID'});
      const req=socket.request;req.get=name=>req.headers[name.toLowerCase()];req.headers['x-tab-id']=auth.tabId;req.headers['x-control-id']=auth.controlId;
      const res=new ServerResponse(req);
      await new Promise((resolve,reject)=>sessionMiddleware(req,res,error=>error?reject(error):resolve()));
      await requireUser(users)(req,res,()=>{});
      socket.data.userId=req.user.nguoi_dung_id;socket.data.owner=control.owner(req);next();
    }catch(error){const failure=Error('Không xác minh được phiên tài khoản.');failure.data={code:['INVALID_CONTROL_ID','INVALID_TAB_ID','UNAUTHENTICATED','ACCOUNT_REPLACED'].includes(error.code)?error.code:'ACCOUNT_UNAVAILABLE'};next(failure);}
  });
  function stop(socket,code){socket.emit(code==='ACCOUNT_REPLACED'?'account:replaced':'account:expired',{message:code==='ACCOUNT_REPLACED'?ACCOUNT_REPLACED_MESSAGE:'Phiên tài khoản cần được xác minh lại. Vui lòng F5.'});socket.disconnect(true);}
  namespace.on('connection',socket=>{
    let timer,ended=false;
    async function pulse(){
      try{await new Promise((resolve,reject)=>socket.request.session.reload(error=>error?reject(error):resolve()));await requireUser(users)(socket.request,{},()=>{});}
      catch(error){if(error.code==='ACCOUNT_REPLACED'||error.status===401||error.message==='failed to load session'){stop(socket,error.code);return;}log(error,{component:'account-heartbeat'});}
      if(!ended)timer=setTimeout(pulse,heartbeatMs);
    }
    timer=setTimeout(pulse,heartbeatMs);socket.on('disconnect',()=>{ended=true;clearTimeout(timer);});
    // Recheck after connection closes the handshake/claim race; it never claims ownership.
    void control.assert(socket.request).catch(error=>{if(error.code==='ACCOUNT_REPLACED')stop(socket,error.code);else log(error,{component:'account-connect'});});
  });
  return {async changed(raw){try{
    const data=JSON.parse(raw);if(!Number.isInteger(data.userId)||!/^[0-9a-f]{64}$/.test(data.owner))return;
    // A delayed notification may describe an older claim. Redis, not that payload, decides who is current.
    await Promise.all([...namespace.sockets.values()].filter(socket=>socket.data.userId===data.userId).map(async socket=>{
      try{await control.assert(socket.request);}catch(error){if(error.code==='ACCOUNT_REPLACED')stop(socket,error.code);else log(error,{component:'account-invalidate'});}
    }));
  }catch(error){log(error,{component:'account-updates'});}}};
}
