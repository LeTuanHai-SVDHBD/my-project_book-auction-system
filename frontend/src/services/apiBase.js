/** Keep local browser/API hostnames aligned so SameSite cookies remain in the same site. */
const loopback=new Set(['localhost','127.0.0.1']);
export function resolveApiBase(configured,pageUrl){
  const api=new URL(configured||'http://127.0.0.1:5000');
  if(pageUrl){
    const page=new URL(pageUrl);
    if(loopback.has(page.hostname)&&loopback.has(api.hostname)&&page.protocol===api.protocol)api.hostname=page.hostname;
  }
  return api.href.replace(/\/+$/,'');
}
export const browserApiBase=()=>resolveApiBase(import.meta.env?.VITE_API_URL,globalThis.location?.href);
