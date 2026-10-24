/** Gửi giá và theo dõi quyết định; khi chưa rõ kết quả chỉ retry cùng mã, không báo thành công từ 202. */
import {useCallback,useEffect,useRef,useState} from 'react';
import MoneyInput from './MoneyInput.jsx';
import {auctionApi} from '../services/auctionApi.js';
import {observeBidStatus,remainingBidSeconds} from '../utils/bidAvailability.js';

const money=value=>value===null?'Chưa có lượt hợp lệ':`${BigInt(value).toLocaleString('vi-VN')} đ`;
const reasons={AUCTION_NOT_ACTIVE:'Phiên không còn nhận giá.',AUCTION_NOT_STARTED:'Phiên chưa đến giờ bắt đầu.',AUCTION_EXPIRED:'Phiên đã hết thời gian.',
  BID_TOO_LOW:'Mức giá chưa đủ cao so với giá hiện tại.',INVALID_BID_STEP:'Mức giá không đúng bước giá.',BIDDER_NOT_ALLOWED:'Tài khoản không còn quyền đặt giá.'};
const terminal=receipt=>['da_chap_nhan','bi_tu_choi'].includes(receipt?.trang_thai);
function suggested(snapshot) {
  if(!snapshot)return '';
  const value=snapshot.gia_hien_tai===null?BigInt(snapshot.gia_khoi_diem):BigInt(snapshot.gia_hien_tai)+BigInt(snapshot.buoc_gia);
  return value.toString().length<=18?value.toString():'';
}
export default function AuctionPanel({auctionId,user,onSnapshot}) {
  const [snapshot,setSnapshot]=useState(null),[attempt,setAttempt]=useState(null),[receipt,setReceipt]=useState(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[checking,setChecking]=useState(false);
  const [availability,setAvailability]=useState(null),[remaining,setRemaining]=useState(0),[loadError,setLoadError]=useState('');
  const [refreshing,setRefreshing]=useState(true);
  const sending=useRef(false),latestReceipt=useRef(null),refreshSequence=useRef(0);
  const isBidder=user?.vai_tro==='nguoi_dung';
  const showBidForm=isBidder&&availability&&!availability.la_chu_sach&&remaining===0&&snapshot?.trang_thai==='da_kich_hoat';
  const canBid=showBidForm&&!refreshing;
  function acceptReceipt(result){
    // A slow/lost POST response must not downgrade a final decision already read by the poll.
    if(terminal(latestReceipt.current)&&latestReceipt.current.ma_yeu_cau===result.ma_yeu_cau)return latestReceipt.current;
    latestReceipt.current=result;setReceipt(result);return result;
  }
  const refresh=useCallback(async()=>{
    const sequence=++refreshSequence.current;
    setRefreshing(true);setLoadError('');
    const [detail,status]=await Promise.allSettled([auctionApi.detail(auctionId),
      isBidder?auctionApi.bidStatus(auctionId).then(row=>observeBidStatus(row,performance.now())):Promise.resolve(null)]);
    if(sequence!==refreshSequence.current)return;
    if(detail.status==='fulfilled'){setSnapshot(detail.value);onSnapshot?.(detail.value);}
    if(detail.status==='rejected'||status.status==='rejected') {
      setAvailability(null);setRemaining(0);setRefreshing(false);
      setLoadError((detail.status==='rejected'?detail.reason:status.reason).message);return;
    }
    setAvailability(status.value);setRemaining(remainingBidSeconds(status.value,performance.now()));
    setRefreshing(false);
  },[auctionId,isBidder,onSnapshot]);
  useEffect(()=>{
    void refresh();
    const onFocus=()=>void refresh(),onVisible=()=>{if(!document.hidden)void refresh();};
    window.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onVisible);
    return()=>{++refreshSequence.current;window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisible);};
  },[refresh]);
  useEffect(()=>{
    if(!availability||availability.waitMs===0)return;
    function tick(){
      const seconds=remainingBidSeconds(availability,performance.now());setRemaining(seconds);
      if(seconds===0){clearInterval(timer);void refresh();}
    }
    const timer=setInterval(tick,250);tick();
    return()=>clearInterval(timer);
  },[availability,refresh]);
  useEffect(()=>{
    if(!attempt||terminal(receipt))return;
    let disposed=false,timer;let controller;
    async function poll(){
      setChecking(true);controller=new AbortController();
      try {
        const result=await auctionApi.result(auctionId,attempt.ma_yeu_cau,AbortSignal.any([controller.signal,AbortSignal.timeout(12000)]));
        if(disposed)return;acceptReceipt(result);setError('');
        if(terminal(result))await refresh();else timer=setTimeout(poll,1000);
      }catch(failure){if(!disposed&&!terminal(latestReceipt.current))setError(`${failure.message} Chưa xác nhận được kết quả; hãy thử lại cùng yêu cầu.`);}
      finally{if(!disposed)setChecking(false);}
    }
    timer=setTimeout(poll,500);
    return()=>{disposed=true;clearTimeout(timer);controller?.abort();};
  },[auctionId,attempt?.ma_yeu_cau,receipt?.trang_thai,refresh]);
  async function send(input) {
    if(sending.current)return;sending.current=true;setBusy(true);setError('');setAttempt(input);
    ++refreshSequence.current;setAvailability(null);setRemaining(0);
    try{const result=acceptReceipt(await auctionApi.bid(auctionId,input));if(terminal(result))await refresh();}
    catch(failure){if(!terminal(latestReceipt.current))setError(`${failure.message} Yêu cầu chưa được xác nhận; thử lại sẽ giữ nguyên mã và mức giá.`);}
    finally{sending.current=false;setBusy(false);}
  }
  function submit(event){event.preventDefault();if(!canBid)return;const data=new FormData(event.currentTarget);void send({ma_yeu_cau:crypto.randomUUID(),muc_gia:data.get('muc_gia')});}
  return <section className="auction-panel" aria-label="Đặt giá và kết quả phiên"><h3>Phiên đấu giá và kết quả</h3>
    {snapshot&&<><dl className="post-info"><dt>Giá mới nhất</dt><dd>{money(snapshot.gia_hien_tai)}</dd><dt>Trạng thái phiên</dt><dd>{snapshot.trang_thai==='da_ket_thuc'?'Đã kết thúc':'Đã kích hoạt'}</dd></dl>
      {snapshot.ket_qua&&<div className="notice" role="status"><strong>{snapshot.ket_qua.trang_thai==='co_nguoi_thang'?'Phiên có người thắng':'Phiên kết thúc không có người thắng'}</strong>
        {snapshot.ket_qua.muc_gia_thang!==null&&<p>Giá thắng: {money(snapshot.ket_qua.muc_gia_thang)}{snapshot.ket_qua.nguoi_thang_dau_id===user?.nguoi_dung_id?' · Bạn là người thắng.':''}</p>}
        <p>{snapshot.ket_qua.ly_do_ket_thuc==='dat_gia_toi_thieu'?'Đã đạt điều kiện kết thúc sớm.':snapshot.ket_qua.ly_do_ket_thuc==='het_thoi_gian'?'Đã hết thời gian đấu giá.':'Kết quả lịch sử.'}</p></div>}
      {isBidder&&snapshot.trang_thai==='da_kich_hoat'&&<>
        {!availability&&!loadError&&(!attempt||terminal(receipt))&&<p role="status">Đang kiểm tra điều kiện đặt giá…</p>}
        {availability&&!availability.la_chu_sach&&remaining>0&&<p className="notice" role="status">Bạn có thể đặt giá tiếp sau {remaining} giây.</p>}
        {canBid&&availability.duoc_dat_lai_luc!==null&&<p className="account-success" role="status">Đã hết thời gian chờ. Bạn có thể nhập mức giá tiếp theo.</p>}
      </>}
      {!attempt&&showBidForm&&<form onSubmit={submit}><fieldset disabled={busy||refreshing}>
        <MoneyInput key={suggested(snapshot)} name="muc_gia" label="Mức giá đặt (VND)" initialValue={suggested(snapshot)}/>
        <p className="field-hint">Đặt đúng bước {money(snapshot.buoc_gia)}. Thời gian chờ đặt lại: {snapshot.thoi_gian_cho_dat_lai} giây. Kết quả được xác nhận sau khi xử lý.</p>
        <button className="primary">Gửi mức giá</button></fieldset></form>}
      {!isBidder&&snapshot.trang_thai==='da_kich_hoat'&&<p className="notice">{user?'Tài khoản Admin xem phiên và kết quả.':'Đăng nhập tài khoản người dùng để đặt giá.'}</p>}</>}
    {attempt&&!availability?.la_chu_sach&&receipt?.ly_do!=='SELLER_CANNOT_BID'&&<div aria-live="polite"><p>Mức giá đã gửi: <strong>{money(attempt.muc_gia)}</strong></p>
      {receipt?.trang_thai==='da_chap_nhan'?<p className="account-success" role="status">Mức giá đã được chấp nhận.</p>:
        receipt?.trang_thai==='bi_tu_choi'?(receipt.ly_do==='BID_COOLDOWN'?null:<p className="error" role="status">Mức giá bị từ chối: {reasons[receipt.ly_do]||receipt.ly_do}</p>):
        <p role="status">{busy?'Đang gửi yêu cầu…':checking?'Đang kiểm tra kết quả…':'Đang chờ xác nhận kết quả.'}</p>}
      {!terminal(receipt)&&!busy&&<button type="button" disabled={checking} onClick={()=>send(attempt)}>Thử lại cùng yêu cầu</button>}
      {terminal(receipt)&&canBid&&!busy&&<button type="button" onClick={()=>{setAttempt(null);setReceipt(null);latestReceipt.current=null;setError('');}}>Nhập mức giá tiếp theo</button>}
    </div>}
    {loadError&&<p className="error" role="alert">{loadError}</p>}{error&&<p className="error" role="alert">{error}</p>}<button type="button" className="text-button" disabled={busy} onClick={refresh}>Tải lại phiên và kết quả</button>
  </section>;
}
