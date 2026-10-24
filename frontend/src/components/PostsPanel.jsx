/** Danh mục, bài của tôi, kiểm duyệt thủ công và luồng đặt giá/kết quả phiên. */
import {useCallback,useEffect,useRef,useState} from 'react';
import {postApi} from '../services/postApi.js';
import PostForm from './PostForm.jsx';
import AuctionPanel from './AuctionPanel.jsx';
import CommentsPanel from './CommentsPanel.jsx';
import AiPanel from './AiPanel.jsx';
import {useAuctionRealtime} from '../services/auctionRealtime.js';
const states={cho_kiem_duyet:'Chờ kiểm duyệt',khong_dat_kiem_duyet:'Bị từ chối',da_qua_kiem_duyet:'Đã duyệt · chờ đặt lịch',da_kich_hoat:'Đã kích hoạt',da_ket_thuc:'Đã kết thúc'};
const money=value=>value==null?'Chưa có':`${BigInt(value).toLocaleString('vi-VN')} đ`;
const date=value=>value?new Date(value).toLocaleString('vi-VN'):'Chưa đặt lịch';
function Gallery({items=[]}) {return <div className="media-grid">{items.map((item,index)=><figure key={`${item.url}-${index}`}>{item.kind==='image'?<a href={item.url} target="_blank" rel="noreferrer"><img src={item.url} alt={item.title||'Ảnh sách'} loading="lazy"/></a>:<video src={item.url} controls preload="metadata"/>}{item.title&&<figcaption>{item.title}</figcaption>}</figure>)}</div>;}
function Detail({post,mode,user,onRefresh,onForm,onClose,onAuctionChange}) {
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
  async function act(event,action) {
    event.preventDefault();setBusy(true);setError('');setMessage('');
    const data=Object.fromEntries(new FormData(event.currentTarget));
    try{
      if(action==='review')await postApi.review(post.bai_dang_id,{quyet_dinh:event.nativeEvent.submitter.value,ly_do:data.ly_do,xac_nhan_quy_hiem:data.xac_nhan_quy_hiem==='on',row_version:post.row_version});
      else await postApi.activate(post.bai_dang_id,{thoi_gian_bat_dau:new Date(data.start).toISOString(),thoi_gian_ket_thuc:new Date(data.end).toISOString(),row_version:post.row_version});
      setMessage(action==='review'?'Đã lưu quyết định kiểm duyệt.':'Đã đặt lịch và kích hoạt phiên.');await onRefresh();
    }catch(failure){setError(failure.message);}finally{setBusy(false);}
  }
  return <article className="post-sheet"><div className="sheet-heading"><span className="status-pill">{states[post.trang_thai_phien]||post.trang_thai_phien}</span><button onClick={onClose}>Đóng chi tiết</button></div>
    <h2>{post.tieu_de}</h2><p className="field-hint">Bài #{post.bai_dang_id} · Sách #{post.sach_id} · Phiên #{post.phien_dau_gia_id} · {post.ma_san_pham}</p>
    <dl className="post-info"><dt>Tên sách</dt><dd>{post.ten_sach}</dd><dt>Tác giả / thể loại</dt><dd>{post.tac_gia||'Chưa rõ'} / {post.the_loai||'Chưa rõ'}</dd><dt>Xuất bản / ISBN</dt><dd>{post.nha_xuat_ban||'Chưa rõ'} · {post.nam_xuat_ban||'Chưa rõ'} · {post.isbn||'Chưa rõ'}</dd><dt>Tình trạng sách</dt><dd>{post.tinh_trang_sach}</dd></dl>
    {post.mo_ta&&<p className="preserve-lines">{post.mo_ta}</p>}<h3>Tình trạng và bằng chứng</h3><p className="preserve-lines">{post.mo_ta_tinh_trang}</p><Gallery items={post.media}/>
    <dl className="post-info"><dt>Giá khởi điểm</dt><dd>{money(post.gia_khoi_diem)}</dd><dt>Giá hiện tại</dt><dd>{money(post.gia_hien_tai)}</dd><dt>Bước giá</dt><dd>{money(post.buoc_gia)}</dd>
    {mode!=='catalog'&&<><dt>Giá kết thúc sớm (riêng tư)</dt><dd>{money(post.gia_toi_thieu)}</dd></>}<dt>Chờ đặt lại</dt><dd>{post.thoi_gian_cho_dat_lai} giây</dd><dt>Bắt đầu / kết thúc</dt><dd>{date(post.thoi_gian_bat_dau)} / {date(post.thoi_gian_ket_thuc)}</dd></dl>
    {['da_kich_hoat','da_ket_thuc'].includes(post.trang_thai_phien)&&<AuctionPanel key={`${post.phien_dau_gia_id}-${user?.nguoi_dung_id||'guest'}`} auctionId={post.phien_dau_gia_id} user={user} onSnapshot={onAuctionChange}/>}
    {['da_kich_hoat','da_ket_thuc'].includes(post.trang_thai_phien)&&<CommentsPanel auctionId={post.phien_dau_gia_id} user={user}/>}
    {mode!=='catalog'&&<><h3>Kiểm duyệt và căn cứ</h3>
      <AiPanel post={post} user={user}/>
      {!post.kiem_duyet?.length&&<p>Chưa có quyết định kiểm duyệt.</p>}{post.kiem_duyet?.map(item=><blockquote key={item.kiem_duyet_id}><strong>{item.ket_qua}</strong> · {date(item.ngay_kiem_duyet)}<p className="preserve-lines">{item.phan_hoi_admin}</p></blockquote>)}
      {mode==='pending'&&post.trang_thai_phien==='cho_kiem_duyet'&&<form onSubmit={event=>act(event,'review')}><fieldset disabled={busy}><label>Căn cứ quý hiếm, kết quả đối chiếu và lý do quyết định<textarea name="ly_do" maxLength={8000} rows={5} required/></label><label className="check-label"><input name="xac_nhan_quy_hiem" type="checkbox"/>Tôi đã kiểm tra bằng chứng về yếu tố quý hiếm (bắt buộc khi phê duyệt)</label><p className="field-hint">Nếu chưa đủ bằng chứng, từ chối và ghi rõ nội dung cần bổ sung. Điểm AI không tự quyết định phê duyệt.</p><div className="actions"><button name="decision" value="phe_duyet" className="primary">Phê duyệt</button><button name="decision" value="tu_choi" className="secondary">Từ chối / yêu cầu bổ sung</button></div></fieldset></form>}
      {mode==='mine'&&post.trang_thai_phien==='da_qua_kiem_duyet'&&<form onSubmit={event=>act(event,'activate')}><fieldset disabled={busy}><h3>Đặt lịch phiên đã được duyệt</h3><div className="form-grid"><label>Bắt đầu (giờ trên máy bạn)<input type="datetime-local" name="start" required/></label><label>Kết thúc (giờ trên máy bạn)<input type="datetime-local" name="end" required/></label></div><p className="field-hint">Chọn giờ bắt đầu ở tương lai. Hệ thống lưu theo UTC và kiểm tra bằng đồng hồ SQL Server.</p><button className="primary">Đặt lịch và kích hoạt</button></fieldset></form>}
      {mode==='mine'&&post.trang_thai_phien==='khong_dat_kiem_duyet'&&<button className="primary" onClick={()=>onForm('resubmit')}>Bổ sung và gửi duyệt lại</button>}
      {mode==='mine'&&post.co_the_dang_lai&&<button className="primary" onClick={()=>onForm('relist')}>Đăng lại cùng bản sách</button>}
    </>}{message&&<p className="account-success" role="status">{message}</p>}{error&&<p role="alert" className="error">{error}</p>}<button className="text-button" disabled={busy} onClick={onRefresh}>Tải lại trạng thái</button>
  </article>;
}
export default function PostsPanel({mode,user}) {
  const [items,setItems]=useState([]);const [next,setNext]=useState(null);const [post,setPost]=useState(null);const [form,setForm]=useState(null);
  const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
  const listSequence=useRef(0);
  const auctionChanged=useCallback(snapshot=>{
    const update=row=>!row||row.phien_dau_gia_id!==snapshot.phien_dau_gia_id||
      row.trang_thai_phien===snapshot.trang_thai&&row.gia_hien_tai===snapshot.gia_hien_tai?row:
      {...row,trang_thai_phien:snapshot.trang_thai,gia_hien_tai:snapshot.gia_hien_tai};
    setPost(update);setItems(old=>old.map(update));
  },[]);
  const title=mode==='mine'?'Bài đăng của tôi':mode==='pending'?'Kiểm duyệt bài đăng':'Danh mục đấu giá';
  async function load(append=false){const sequence=++listSequence.current;setLoading(true);setError('');try{const result=await postApi.list(mode,append?next:null);if(sequence===listSequence.current){setError('');setItems(old=>append?[...old,...result.items]:result.items);setNext(result.nextBefore);}}catch(failure){if(sequence===listSequence.current)setError(failure.status?failure.message:'Chưa kết nối được máy chủ. Vui lòng kiểm tra mạng.');}finally{if(sequence===listSequence.current)setLoading(false);}}
  useEffect(()=>{void load();return()=>{++listSequence.current;};},[mode]);
  useAuctionRealtime({enabled:mode!=='pending',onChange:()=>load()});
  async function open(id){setLoading(true);setError('');try{setPost(await postApi.detail(id,mode==='catalog'));}catch(failure){setError(failure.message);}finally{setLoading(false);}}
  async function refresh(){await open(post.bai_dang_id);await load();}
  async function saved(id){setForm(null);setMessage('Đã gửi kiểm duyệt. Sau khi Admin duyệt, bạn có thể đặt lịch cho phiên.');await load();await open(id);}
  return <main className="posts-page"><header className="posts-heading"><div><span className="eyebrow">BOOKAUCTION · NHÓM 15</span><h1>{title}</h1><p>{mode==='pending'?'Kiểm tra sách, media và bằng chứng trước khi ghi quyết định.':mode==='mine'?'Theo dõi kiểm duyệt, bổ sung bằng chứng và đặt lịch đấu giá.':'Các phiên đã được phê duyệt và kích hoạt.'}</p></div><div className="actions">{mode==='mine'&&<button className="primary" disabled={loading||!!form} onClick={()=>{setPost(null);setForm('create');}}>Đăng sách mới</button>}<button className="secondary" disabled={loading} onClick={()=>load()}>Tải lại danh sách</button></div></header>
    {error&&<p className="error" role="alert">{error}</p>}{message&&<p className="account-success" role="status">{message}</p>}{loading&&<p role="status">Đang tải…</p>}
    {form?<PostForm key={`${form}-${post?.bai_dang_id||'new'}`} source={form==='create'?null:post} mode={form} onSaved={saved} onCancel={()=>setForm(null)}/>:post?<Detail key={post.bai_dang_id} post={post} mode={mode} user={user} onRefresh={refresh} onClose={()=>setPost(null)} onForm={setForm} onAuctionChange={auctionChanged}/>:<>
      {!items.length&&!loading&&<div className="empty-state"><h2>Chưa có bài đăng</h2><p>{mode==='mine'?'Bắt đầu bằng cách đăng bản sách bạn muốn đấu giá.':'Bài phù hợp sẽ xuất hiện tại đây.'}</p></div>}
      <div className="post-list">{items.map(item=><article className="post-card" key={item.bai_dang_id}><span className="status-pill">{states[item.trang_thai_phien]}</span><h2>{item.tieu_de}</h2><p>{item.ten_sach} · {item.tac_gia||'Chưa rõ tác giả'}</p><p>Khởi điểm <strong>{money(item.gia_khoi_diem)}</strong> · Bước {money(item.buoc_gia)}</p><p>Giá hiện tại: <strong>{money(item.gia_hien_tai)}</strong></p><p className="field-hint">Bài #{item.bai_dang_id} · Phiên #{item.phien_dau_gia_id}</p><button className="secondary" onClick={()=>open(item.bai_dang_id)}>Xem chi tiết</button></article>)}</div>{next&&<button disabled={loading} onClick={()=>load(true)}>Xem thêm</button>}
    </>}
  </main>;
}
