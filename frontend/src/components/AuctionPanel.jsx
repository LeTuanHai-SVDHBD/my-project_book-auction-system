/** Gửi giá và theo dõi quyết định; khi chưa rõ kết quả chỉ retry cùng mã, không báo thành công từ 202. */
import {useEffect,useRef,useState} from 'react';
import MoneyInput from './MoneyInput.jsx';
import {auctionApi} from '../services/auctionApi.js';

const money=value=>value===null?'Chưa có lượt hợp lệ':`${BigInt(value).toLocaleString('vi-VN')} đ`;
const reasons={AUCTION_NOT_ACTIVE:'Phiên không còn nhận giá.',AUCTION_NOT_STARTED:'Phiên chưa đến giờ bắt đầu.',AUCTION_EXPIRED:'Phiên đã hết thời gian.',
  SELLER_CANNOT_BID:'Bạn không thể đặt giá cho sách của mình.',BID_COOLDOWN:'Bạn cần chờ đủ thời gian trước khi đặt lại.',
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
  const sending=useRef(false),latestReceipt=useRef(null);
  function acceptReceipt(result){
    // A slow/lost POST response must not downgrade a final decision already read by the poll.
    if(terminal(latestReceipt.current)&&latestReceipt.current.ma_yeu_cau===result.ma_yeu_cau)return latestReceipt.current;
    latestReceipt.current=result;setReceipt(result);return result;
  }
  function acceptSnapshot(row){setSnapshot(row);onSnapshot?.(row);}
  async function refresh(){try{acceptSnapshot(await auctionApi.detail(auctionId));}catch(failure){setError(failure.message);}}
  useEffect(()=>{let disposed=false;auctionApi.detail(auctionId).then(row=>{if(!disposed)acceptSnapshot(row);}).catch(failure=>{if(!disposed)setError(failure.message);});return()=>{disposed=true;};},[auctionId,onSnapshot]);
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
  },[auctionId,attempt?.ma_yeu_cau,receipt?.trang_thai]);
  async function send(input) {
    if(sending.current)return;sending.current=true;setBusy(true);setError('');setAttempt(input);
    try{const result=acceptReceipt(await auctionApi.bid(auctionId,input));if(terminal(result))await refresh();}
    catch(failure){if(!terminal(latestReceipt.current))setError(`${failure.message} Yêu cầu chưa được xác nhận; thử lại sẽ giữ nguyên mã và mức giá.`);}
    finally{sending.current=false;setBusy(false);}
  }
  function submit(event){event.preventDefault();const data=new FormData(event.currentTarget);void send({ma_yeu_cau:crypto.randomUUID(),muc_gia:data.get('muc_gia')});}
  return <section className="auction-panel" aria-label="Đặt giá và kết quả phiên"><h3>Đặt giá và kết quả</h3>
    {snapshot&&<><dl className="post-info"><dt>Giá mới nhất</dt><dd>{money(snapshot.gia_hien_tai)}</dd><dt>Trạng thái phiên</dt><dd>{snapshot.trang_thai==='da_ket_thuc'?'Đã kết thúc':'Đã kích hoạt'}</dd></dl>
      {snapshot.ket_qua&&<div className="notice" role="status"><strong>{snapshot.ket_qua.trang_thai==='co_nguoi_thang'?'Phiên có người thắng':'Phiên kết thúc không có người thắng'}</strong>
        {snapshot.ket_qua.muc_gia_thang!==null&&<p>Giá thắng: {money(snapshot.ket_qua.muc_gia_thang)}{snapshot.ket_qua.nguoi_thang_dau_id===user?.nguoi_dung_id?' · Bạn là người thắng.':''}</p>}
        <p>{snapshot.ket_qua.ly_do_ket_thuc==='dat_gia_toi_thieu'?'Đã đạt điều kiện kết thúc sớm.':snapshot.ket_qua.ly_do_ket_thuc==='het_thoi_gian'?'Đã hết thời gian đấu giá.':'Kết quả lịch sử.'}</p></div>}
      {!attempt&&snapshot.trang_thai==='da_kich_hoat'&&(user?.vai_tro==='nguoi_dung'?<form onSubmit={submit}><fieldset disabled={busy}>
        <MoneyInput key={suggested(snapshot)} name="muc_gia" label="Mức giá đặt (VND)" initialValue={suggested(snapshot)}/>
        <p className="field-hint">Đặt đúng bước {money(snapshot.buoc_gia)}. Thời gian chờ đặt lại: {snapshot.thoi_gian_cho_dat_lai} giây. Kết quả được xác nhận sau khi xử lý.</p>
        <button className="primary">Gửi mức giá</button></fieldset></form>:<p className="notice">{user?'Tài khoản Admin xem phiên và kết quả.':'Đăng nhập tài khoản người dùng để đặt giá.'}</p>)}</>}
    {attempt&&<div aria-live="polite"><p>Mức giá đã gửi: <strong>{money(attempt.muc_gia)}</strong></p>
      {receipt?.trang_thai==='da_chap_nhan'?<p className="account-success" role="status">Mức giá đã được chấp nhận.</p>:
        receipt?.trang_thai==='bi_tu_choi'?<p className="error" role="status">Mức giá bị từ chối: {reasons[receipt.ly_do]||receipt.ly_do}</p>:
        <p role="status">{busy?'Đang gửi yêu cầu…':checking?'Đang kiểm tra kết quả…':'Đang chờ xác nhận kết quả.'}</p>}
      {!terminal(receipt)&&!busy&&<button type="button" disabled={checking} onClick={()=>send(attempt)}>Thử lại cùng yêu cầu</button>}
      {terminal(receipt)&&snapshot?.trang_thai==='da_kich_hoat'&&<button type="button" onClick={()=>{setAttempt(null);setReceipt(null);latestReceipt.current=null;setError('');}}>Nhập mức giá tiếp theo</button>}
    </div>}
    {error&&<p className="error" role="alert">{error}</p>}<button type="button" className="text-button" disabled={busy} onClick={refresh}>Tải lại phiên và kết quả</button>
  </section>;
}
