/** Lịch sử lượt hợp lệ công khai, phân trang 50 lượt; cập nhật mới đưa về trang mới nhất. */
import {useEffect,useRef,useState} from 'react';
import {auctionApi} from '../services/auctionApi.js';
export default function BidHistory({auctionId,items=[],nextBefore=null}) {
  const [rows,setRows]=useState(items),[cursor,setCursor]=useState(nextBefore),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const generation=useRef(0),loading=useRef(false);
  useEffect(()=>{++generation.current;setRows(items);setCursor(nextBefore);setError('');},[items[0]?.luot_dat_gia_id,nextBefore]);
  useEffect(()=>()=>{++generation.current;},[]);
  async function older(){
    if(loading.current)return;loading.current=true;setBusy(true);setError('');const current=generation.current;
    try{const page=await auctionApi.history(auctionId,cursor);if(current===generation.current){setRows(old=>[...old,...page.items]);setCursor(page.nextBefore);}}
    catch(failure){if(current===generation.current)setError(failure.message);}
    finally{loading.current=false;setBusy(false);}
  }
  return <section className="bid-history" aria-label="Lịch sử đặt giá"><h3>Lịch sử đặt giá hợp lệ</h3>
    {!rows.length?<p>Chưa có lượt đặt giá hợp lệ.</p>:<ol>{rows.map(row=><li key={row.luot_dat_gia_id}><strong>{BigInt(row.muc_gia).toLocaleString('vi-VN')} đ</strong><span>Người tham gia #{row.nguoi_dung_id}</span><time dateTime={row.thoi_gian_dat}>{new Date(row.thoi_gian_dat).toLocaleString('vi-VN')}</time></li>)}</ol>}
    {cursor&&<button type="button" disabled={busy} onClick={older}>{busy?'Đang tải…':'Xem các lượt cũ hơn'}</button>}{error&&<p className="error" role="alert">{error}</p>}
  </section>;
}
