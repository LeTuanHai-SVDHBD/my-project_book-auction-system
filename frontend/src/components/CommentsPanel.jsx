/** Bình luận công khai theo giờ SQL và uy tín người bán từ đánh giá giao dịch hoàn tất. */
import {useState} from 'react';
import {communityPost} from '../services/communityApi.js';
import {FeedButtons,useCommunityPage,when} from './CommunityFeed.jsx';
export default function CommentsPanel({auctionId,user}){
  const feed=useCommunityPage(`/auctions/${auctionId}/comments`),reputation=useCommunityPage(`/auctions/${auctionId}/reputation`),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function send(event){event.preventDefault();const form=event.currentTarget;setBusy(true);setError('');try{await communityPost(`/auctions/${auctionId}/comments`,{noi_dung:new FormData(form).get('noi_dung')});form.reset();feed.latest();}catch(failure){setError(failure.message+' Kiểm tra danh sách trước khi gửi lại nếu mất phản hồi.');}finally{setBusy(false);}}
  return <><section aria-label="Uy tín người bán"><h3>Uy tín người bán</h3>{reputation.data&&<><p>{reputation.data.so_danh_gia?`${Number(reputation.data.trung_binh).toFixed(2)}/5 sao · ${reputation.data.so_danh_gia} đánh giá`:'Chưa có đánh giá từ giao dịch hoàn tất.'}</p><details><summary>Xem nhận xét người bán</summary>{reputation.data.items.map(row=><blockquote key={row.danh_gia_id}><strong>{row.so_sao}/5 sao</strong> · {when(row.ngay_danh_gia)}<p className="preserve-lines">{row.noi_dung||'Không có nhận xét.'}</p></blockquote>)}<FeedButtons feed={reputation}/></details></>}{reputation.error&&<p className="error">{reputation.error}</p>}</section>
    <section aria-label="Bình luận phiên"><h3>Bình luận phiên</h3><ol className="conversation-messages">{[...(feed.data?.items||[])].reverse().map(row=><li key={row.binh_luan_id}><strong>{row.ho_ten}</strong><p className="preserve-lines">{row.noi_dung}</p><small>{when(row.thoi_gian_binh_luan)}</small></li>)}</ol>{feed.data&&!feed.data.items.length&&<p>Chưa có bình luận ở trang này.</p>}<FeedButtons feed={feed}/>
      {user?.vai_tro==='nguoi_dung'&&feed.data?.duoc_binh_luan?<form onSubmit={send}><label>Nội dung bình luận<textarea name="noi_dung" required maxLength={2000} rows={3}/></label><button className="primary" disabled={busy}>{busy?'Đang gửi…':'Gửi bình luận'}</button></form>:<p className="field-hint">{!user?'Đăng nhập để bình luận trong thời gian phiên diễn ra.':feed.data&&!feed.data.duoc_binh_luan?'Bình luận đã khóa hoặc phiên chưa đến giờ bắt đầu.':'Tài khoản Admin chỉ xem bình luận.'}</p>}
      {(error||feed.error)&&<p className="error" role="alert">{error||feed.error}</p>}
    </section></>;
}
