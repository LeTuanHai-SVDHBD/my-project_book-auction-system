/** Phân trang theo ID, tự đọc lại trang mới nhất; giữ nguyên form và trang lịch sử đang xem. */
import {useCallback,useEffect,useRef,useState} from 'react';
import {communityGet,communityPost} from '../services/communityApi.js';
export const when=value=>value?new Date(value).toLocaleString('vi-VN'):'Chưa có';
export const money=value=>`${BigInt(value).toLocaleString('vi-VN')} đ`;
export function useCommunityPage(path){
  const [before,setBefore]=useState(null),[data,setData]=useState(null),[error,setError]=useState('');const sequence=useRef(0);
  const refresh=useCallback(async()=>{const current=++sequence.current;try{const result=await communityGet(path+(before?`?before=${before}`:''));if(current===sequence.current){setData(result);setError('');}}catch(failure){if(current===sequence.current)setError(failure.message);}},[path,before]);
  useEffect(()=>{let active=true,timer;async function poll(){await refresh();if(active&&!before)timer=setTimeout(poll,3000);}setData(null);void poll();return()=>{active=false;++sequence.current;clearTimeout(timer);};},[refresh,before]);
  return {data,error,refresh,older:()=>setBefore(data?.nextBefore),latest:()=>before?setBefore(null):void refresh(),historical:before!==null};
}
export function FeedButtons({feed}){return <div className="actions feed-actions">{feed.data?.nextBefore&&<button type="button" onClick={feed.older}>Xem trang cũ hơn</button>}{feed.historical&&<button type="button" onClick={feed.latest}>Về trang mới nhất</button>}<button type="button" className="text-button" onClick={feed.refresh}>Tải lại nội dung</button></div>;}
export function ChatFeed({tradeId,complaintId,user,readOnly=false}){
  const path=complaintId?`/complaints/${complaintId}/messages`:`/trades/${tradeId}/messages`,feed=useCommunityPage(path),[error,setError]=useState(''),[busy,setBusy]=useState(false),marking=useRef(false);
  useEffect(()=>{const items=feed.data?.items||[];if(readOnly||!items.some(x=>x.nguoi_gui_id!==user.nguoi_dung_id&&!x.da_doc)||marking.current)return;marking.current=true;
    void communityPost(`/trades/${tradeId}/read`,{through:Math.max(...items.map(x=>x.tin_nhan_id))}).catch(()=>{}).finally(()=>{marking.current=false;});
  },[feed.data,readOnly,tradeId,user.nguoi_dung_id]);
  async function send(event){event.preventDefault();const form=event.currentTarget;setBusy(true);setError('');try{await communityPost(`/trades/${tradeId}/messages`,{noi_dung:new FormData(form).get('noi_dung')});form.reset();feed.latest();}catch(failure){setError(failure.message+' Hãy tải lại tin nhắn để kiểm tra trước khi gửi lại.');}finally{setBusy(false);}}
  return <section className="private-chat" aria-label={readOnly?'Trao đổi phục vụ khiếu nại':'Trò chuyện giao dịch'}><h3>{readOnly?'Trao đổi phục vụ khiếu nại':'Trò chuyện riêng'}</h3>
    {feed.historical&&<p className="field-hint">Đang xem trang lịch sử; chọn về trang mới nhất để nhận cập nhật.</p>}
    <ol className="conversation-messages">{[...(feed.data?.items||[])].reverse().map(row=><li className={row.nguoi_gui_id===user.nguoi_dung_id?'message-mine':''} key={row.tin_nhan_id}><strong>{row.ho_ten}</strong><p className="preserve-lines">{row.noi_dung}</p><small>{when(row.thoi_gian_gui)}{!readOnly&&row.nguoi_gui_id===user.nguoi_dung_id?row.da_doc?' · Đã đọc':' · Đã gửi':''}</small></li>)}</ol>
    {feed.data&&!feed.data.items.length&&<p>Chưa có tin nhắn.</p>}<FeedButtons feed={feed}/>
    {!readOnly&&<form onSubmit={send}><label>Tin nhắn<textarea name="noi_dung" required maxLength={4000} rows={3}/></label><button className="primary" disabled={busy}>{busy?'Đang gửi…':'Gửi tin nhắn'}</button></form>}
    {(error||feed.error)&&<p className="error" role="alert">{error||feed.error}</p>}
  </section>;
}
