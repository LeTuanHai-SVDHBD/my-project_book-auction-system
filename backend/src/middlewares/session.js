/** Session Redis/HttpOnly: chọn cookie riêng theo tab, giữ cùng một middleware/store cho toàn tiến trình. */
import session from 'express-session';
import {HttpError} from './errorHandler.js';
const tabPattern=/^[0-9a-f]{32}$/;
function selectedCookie(header,name) {
  return (header||'').split(';').map(part=>part.trim()).find(part=>part.startsWith(name+'='));
}
export function createSessionMiddleware(authConfig, store, {control}={}) {
  const middleware=session({ name:authConfig.cookieName, secret:authConfig.secret, store,
    resave:false, saveUninitialized:false, rolling:true,
    cookie:{...authConfig.cookie,maxAge:authConfig.idleSeconds*1000} });
  return (req,res,next)=>{
    req.accountControl=control;
    const tabId=req.get('x-tab-id');
    // Terminal/API clients without a tab selector retain the documented single-cookie contract.
    if(tabId===undefined)return middleware(req,res,next);
    if(!tabPattern.test(tabId))return next(new HttpError(400,'INVALID_TAB_ID','Mã tab không hợp lệ. Vui lòng tải lại trang.'));
    const cookieName=`${authConfig.cookieName}.${tabId}`;
    const originalCookie=req.headers.cookie;
    const originalCookies=req.cookies,originalSignedCookies=req.signedCookies;
    const selected=selectedCookie(originalCookie,cookieName);
    if(selected)req.headers.cookie=authConfig.cookieName+selected.slice(cookieName.length);
    else delete req.headers.cookie;
    // Do not let cookie-parser fallback select an unrelated browser-wide session.
    req.cookies=undefined;req.signedCookies=undefined;
    const setHeader=res.setHeader;
    res.setHeader=function(name,value){
      if(name.toLowerCase()==='set-cookie'){
        const rename=cookie=>typeof cookie==='string'&&cookie.startsWith(authConfig.cookieName+'=')
          ?cookieName+cookie.slice(authConfig.cookieName.length):cookie;
        value=Array.isArray(value)?value.map(rename):rename(value);
      }
      return setHeader.call(this,name,value);
    };
    // Reuse one express-session instance: creating one per tab would accumulate store event listeners.
    middleware(req,res,error=>{
      if(originalCookie===undefined)delete req.headers.cookie;else req.headers.cookie=originalCookie;
      req.cookies=originalCookies;req.signedCookies=originalSignedCookies;
      next(error);
    });
  };
}
