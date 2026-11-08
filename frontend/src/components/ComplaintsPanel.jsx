/** Hồ sơ khiếu nại chung của hai bên; ghi chú xử lý nội bộ chỉ dành cho Admin. */
import {useState} from 'react';
import {COMPLAINT_OUTCOMES} from '../../../shared/complaints.js';
import {navigate} from '../services/navigation.js';
import {communityPost} from '../services/communityApi.js';
import {ChatFeed,FeedButtons,useCommunityPage,money,when} from './CommunityFeed.jsx';
import ComplaintForm from './ComplaintForm.jsx';
import StatusBadge from './StatusBadge.jsx';
import {useSuccessFeedback} from './SuccessFeedback.jsx';

function Evidence({items=[]}){
  if(!items.length)return <p className="field-hint">Không có ảnh đính kèm.</p>;
  return <div className="media-grid case-evidence">{items.map(item=><figure key={item.bang_chung_id}>
    <a href={item.duong_dan_anh_khieu_nai} target="_blank" rel="noreferrer">
      <img src={item.duong_dan_anh_khieu_nai} alt={item.mo_ta_anh_khieu_nai||'Ảnh bằng chứng'}/>
    </a>
    <figcaption>{item.mo_ta_anh_khieu_nai}</figcaption>
  </figure>)}</div>;
}

function ComplaintDetail({id,user}){
  const feed=useCommunityPage(`/complaints/${id}`),row=feed.data;
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[respond,setRespond]=useState(false);
  const notify=useSuccessFeedback();
  const admin=user.vai_tro==='admin';
  async function act(action,body={}){
    setBusy(true);setError('');
    try{
      await communityPost(`/complaints/${id}/${action}`,body);
      notify({message:action==='claim'?'Đã tiếp nhận khiếu nại.':'Đã lưu kết quả xử lý khiếu nại.'});
      await feed.refresh();
    }catch(failure){setError(failure.message);}finally{setBusy(false);}
  }
  return <article className="post-sheet complaint-detail">
    <a href="#/complaints">Về danh sách khiếu nại</a>
    {row&&<header className="case-overview">
      <h2>Khiếu nại #{id}</h2><StatusBadge state={row.trang_thai}/>
      {row.can_toi_phan_hoi&&<span className="status-pill">Cần bạn phản hồi</span>}
    </header>}
    {!row&&!feed.error&&<p role="status">Đang tải hồ sơ…</p>}
    {row&&<>
      <section className="case-section">
        <h3>{row.giao_dich.ten_sach}</h3>
        <p>{row.giao_dich.ma_giao_dich} · {money(row.giao_dich.so_tien)}</p>
        {admin&&<p className="field-hint">Sách #{row.giao_dich.sach_id} · Bài #{row.giao_dich.bai_dang_id} · Phiên #{row.giao_dich.phien_dau_gia_id} · Giao dịch #{row.giao_dich.giao_dich_id}</p>}
        {!admin&&<a href={`#/trades/${row.giao_dich.giao_dich_id}`}>Mở giao dịch liên quan</a>}
      </section>
      <section className="case-section">
        <h3>Nội dung khiếu nại</h3>
        <p className="field-hint">Người gửi: {row.nguoi_khieu_nai_id===row.giao_dich.nguoi_mua_id?'Người mua':'Người bán'} · {when(row.ngay_khieu_nai)}</p>
        <h4>{row.ly_do}</h4><p className="preserve-lines">{row.noi_dung}</p>
        <Evidence items={row.bang_chung}/>
      </section>
      {row.han_giai_trinh&&<section className="case-section">
        <h3>Giải trình của bên còn lại</h3>
        <p className="field-hint">Hạn giải trình: {when(row.han_giai_trinh)}</p>
        {row.ngay_giai_trinh?<><p>Đã gửi lúc {when(row.ngay_giai_trinh)}</p>
          <p className="preserve-lines">{row.giai_trinh}</p><Evidence items={row.bang_chung_giai_trinh}/>
        </>:<p>{row.dang_cho_giai_trinh?'Đang chờ giải trình.':'Hết thời hạn giải trình; chưa có phản hồi.'}</p>}
        {row.can_toi_phan_hoi&&!respond&&<button type="button" className="secondary" onClick={()=>setRespond(true)}>Gửi giải trình</button>}
        {row.can_toi_phan_hoi&&respond&&<ComplaintForm complaintId={id} onCancel={()=>setRespond(false)} onSaved={()=>{
          setRespond(false);notify({message:'Đã gửi giải trình.'});void feed.refresh();
        }}/>}
      </section>}
      {admin&&row.trang_thai==='cho_xu_ly'&&<button type="button" className="primary" disabled={busy} onClick={()=>act('claim')}>Tiếp nhận khiếu nại</button>}
      {admin&&row.trang_thai==='dang_xu_ly'&&row.admin_id!==user.nguoi_dung_id&&<p className="notice">Admin #{row.admin_id} đang phụ trách khiếu nại này.</p>}
      {admin&&row.trang_thai==='dang_xu_ly'&&row.admin_id===user.nguoi_dung_id&&<section className="case-section">
        <ChatFeed key={id} complaintId={id} user={user} readOnly/>
        {row.dang_cho_giai_trinh?<p className="notice">Có thể đối chiếu hồ sơ ngay. Hãy đợi bên còn lại giải trình hoặc hết hạn trước khi kết luận.</p>:
          <form onSubmit={event=>{event.preventDefault();void act('resolve',Object.fromEntries(new FormData(event.currentTarget)));}}>
            <label>Kết luận<select name="ket_luan" required defaultValue="">
              <option value="" disabled>Chọn kết luận</option>
              {Object.entries(COMPLAINT_OUTCOMES).map(([key,label])=><option key={key} value={key}>{label}</option>)}
            </select></label>
            <label>Lý do và hướng xử lý ({row.han_giai_trinh?'hai bên được xem':'người gửi được xem'})<textarea name="phan_hoi_admin" required maxLength={8000} rows={5}/></label>
            <label>Ghi chú nội bộ (chỉ Admin)<textarea name="ghi_chu_noi_bo" maxLength={8000} rows={3}/></label>
            <p className="field-hint">Kết luận không tự thay đổi giao dịch hay thực hiện hoàn tiền.</p>
            <button className="primary" disabled={busy}>Lưu kết quả xử lý</button>
          </form>}
      </section>}
      {row.phan_hoi_admin&&<section className="case-admin-response has-response">
        <h3>Kết quả xử lý</h3>
        {row.ket_luan&&<strong>{COMPLAINT_OUTCOMES[row.ket_luan]}</strong>}
        <p className="preserve-lines">{row.phan_hoi_admin}</p><small>{when(row.ngay_xu_ly)}</small>
      </section>}
      {admin&&row.ghi_chu_noi_bo&&<section className="case-section">
        <h3>Ghi chú nội bộ</h3><p className="preserve-lines">{row.ghi_chu_noi_bo}</p>
      </section>}
    </>}
    {(error||feed.error)&&<p className="error" role="alert">{error||feed.error}</p>}
  </article>;
}

function ComplaintList({user,scope}){
  const feed=useCommunityPage(`/complaints?scope=${scope}`);
  return <>
    <div className="post-list">{feed.data?.items.map(row=><article className="post-card" key={row.khieu_nai_id}>
      <StatusBadge state={row.trang_thai}/>
      {user.vai_tro!=='admin'&&<p className="field-hint">{row.nguoi_khieu_nai_id===user.nguoi_dung_id?'Tôi đã gửi':row.can_toi_phan_hoi?'Cần tôi phản hồi':'Bên còn lại đã gửi'}</p>}
      <h2>{row.ly_do}</h2>
      <p>Khiếu nại #{row.khieu_nai_id} · Giao dịch #{row.giao_dich_id}</p><p>{when(row.ngay_khieu_nai)}</p>
      <button className="secondary" onClick={()=>navigate('complaints',row.khieu_nai_id)}>Xem khiếu nại</button>
    </article>)}</div>
    {!feed.data&&!feed.error&&<p role="status">Đang tải khiếu nại…</p>}
    {feed.data&&!feed.data.items.length&&<p className="empty-state">{scope==='reply'?'Không có hồ sơ cần bạn phản hồi.':'Chưa có khiếu nại ở trang này.'}</p>}
    <FeedButtons feed={feed}/>
    {feed.error&&<p className="error" role="alert">{feed.error}</p>}
  </>;
}

export default function ComplaintsPanel({user,selectedId}){
  const [scope,setScope]=useState('all'),admin=user.vai_tro==='admin';
  return <main className="posts-page">
    <header className="posts-heading"><div><span className="eyebrow">BOOKBID</span>
      <h1>{admin?'Xử lý khiếu nại':'Khiếu nại'}</h1>
      <p>{admin?'Tiếp nhận, đối chiếu giải trình và kết luận hồ sơ.':'Theo dõi khiếu nại liên quan đến giao dịch của bạn.'}</p>
    </div></header>
    {selectedId?<ComplaintDetail key={selectedId} id={selectedId} user={user}/>:<>
      {!admin&&<div className="complaint-filters actions" role="group" aria-label="Lọc khiếu nại">
        {[['all','Tất cả'],['mine','Tôi đã gửi'],['reply','Cần tôi phản hồi']].map(([key,label])=>
          <button key={key} type="button" className="secondary" aria-pressed={scope===key} onClick={()=>setScope(key)}>{label}</button>)}
      </div>}
      <ComplaintList key={scope} user={user} scope={scope}/>
    </>}
  </main>;
}
