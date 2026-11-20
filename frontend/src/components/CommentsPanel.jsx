/** Bình luận phiên và nhận xét từ giao dịch đã hoàn tất. */
import {useLayoutEffect,useRef,useState} from 'react';
import {communityPost} from '../services/communityApi.js';
import {FeedButtons,useCommunityPage,when} from './CommunityFeed.jsx';

export default function CommentsPanel({auctionId,user}){
  const feed=useCommunityPage(`/auctions/${auctionId}/comments`);
  const reputation=useCommunityPage(`/auctions/${auctionId}/reputation`);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const scrollBox=useRef(null),page=useRef(null),followLatest=useRef(true),sent=useRef(false);
  const pageKey=`${auctionId}:${feed.cursor??'latest'}`;
  const canComment=user?.vai_tro==='nguoi_dung'&&feed.data?.duoc_binh_luan;

  useLayoutEffect(()=>{
    const box=scrollBox.current;
    if(!box||!feed.data)return;
    const changedPage=page.current!==pageKey;
    if(changedPage)page.current=pageKey;
    if(feed.historical){
      if(changedPage)box.scrollTop=0;
      return;
    }
    if(changedPage||sent.current||followLatest.current){
      box.scrollTop=box.scrollHeight;
      followLatest.current=true;
      sent.current=false;
    }
  },[feed.data,feed.historical,pageKey]);

  async function send(event){
    event.preventDefault();
    if(!canComment||busy)return;
    const form=event.currentTarget;
    setBusy(true);setError('');
    try{
      await communityPost(`/auctions/${auctionId}/comments`,{noi_dung:new FormData(form).get('noi_dung')});
      form.reset();
      sent.current=true;
      feed.latest();
    }catch(failure){
      setError(failure.message+' Kiểm tra danh sách trước khi gửi lại nếu mất phản hồi.');
    }finally{setBusy(false);}
  }

  const comments=feed.data?.items||[],reviews=reputation.data?.items||[];
  return <>
    <section className="seller-reputation" aria-label="Uy tín người bán">
      <h3>Uy tín người bán</h3>
      {reputation.data&&<>
        <p className="seller-reputation-summary">
          {reputation.data.so_danh_gia
            ? <><strong>{Number(reputation.data.trung_binh).toLocaleString('vi-VN',{maximumFractionDigits:2})}/5 sao</strong> · {reputation.data.so_danh_gia} đánh giá</>
            : 'Chưa có đánh giá từ giao dịch hoàn tất.'}
        </p>
        {reputation.data.so_danh_gia>0&&<details>
          <summary>Xem nhận xét người bán</summary>
          {reviews.length>0&&<div className="seller-reviews-scroll" tabIndex={0} role="region" aria-label="Danh sách nhận xét người bán">
            {reviews.map(row=><blockquote key={row.danh_gia_id}>
              <strong>{row.so_sao}/5 sao</strong> · <small>{when(row.ngay_danh_gia)}</small>
              <p className="preserve-lines">{row.noi_dung||'Không có nhận xét.'}</p>
            </blockquote>)}
          </div>}
          <FeedButtons feed={reputation}/>
        </details>}
      </>}
      {!reputation.data&&!reputation.error&&<p className="field-hint">Đang tải đánh giá…</p>}
      {reputation.error&&<p className="error" role="alert">{reputation.error}</p>}
    </section>

    <section className="auction-comments" aria-label="Bình luận phiên">
      <h3>Bình luận phiên</h3>
      {feed.historical&&<p className="field-hint">Đang xem bình luận cũ. Về trang mới nhất để nhận cập nhật.</p>}
      <div className="auction-comments-scroll" ref={scrollBox} role="region" aria-label="Danh sách bình luận"
        tabIndex={comments.length?0:undefined}
        onScroll={event=>{
          const box=event.currentTarget;
          followLatest.current=box.scrollHeight-box.clientHeight-box.scrollTop<=48;
        }}>
        {comments.length>0?<ol className="auction-comment-list">
          {[...comments].reverse().map(row=><li key={row.binh_luan_id}>
            <div className="auction-comment-meta"><strong>{row.ho_ten}</strong><small>{when(row.thoi_gian_binh_luan)}</small></div>
            <p className="preserve-lines">{row.noi_dung}</p>
          </li>)}
        </ol>:<p className="field-hint">{feed.data?'Chưa có bình luận ở trang này.':feed.error?'Chưa tải được bình luận.':'Đang tải bình luận…'}</p>}
      </div>
      <FeedButtons feed={feed}/>
      {canComment?<form className="auction-comment-form" onSubmit={send}>
        <label>Nội dung bình luận<textarea name="noi_dung" required maxLength={2000} rows={3}/></label>
        <button className="primary" disabled={busy}>{busy?'Đang gửi…':'Gửi bình luận'}</button>
      </form>:feed.data&&<p className="field-hint">{!feed.data.duoc_binh_luan
        ? 'Bình luận đã khóa hoặc phiên chưa đến giờ bắt đầu.'
        : !user?'Đăng nhập để bình luận trong thời gian phiên diễn ra.':'Tài khoản Admin chỉ xem bình luận.'}</p>}
      {(error||feed.error)&&<p className="error" role="alert">{error||feed.error}</p>}
    </section>
  </>;
}
