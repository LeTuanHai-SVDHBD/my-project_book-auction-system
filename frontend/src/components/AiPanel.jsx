/** Kết quả hỗ trợ Admin: hai điểm độc lập, NULL có lý do, bằng chứng theo tiêu chí và lịch sử lần phân tích. */
import {useCallback,useEffect,useRef,useState} from 'react';
import {apiRequest,apiPost} from '../services/authApi.js';
const states={thanh_cong:'Đã phân tích',chua_day_du:'Chưa đầy đủ',that_bai:'Phân tích thất bại'};
const score=value=>value===null||value===undefined?'Chưa đủ dữ liệu':`${Number(value).toFixed(2)} / 100`;
function Sources({value}){let refs;try{refs=JSON.parse(value);}catch{return value?<p>Nguồn: {value}</p>:null;}
  return <>{refs?.media?.length>0&&<p>Media đối chiếu: {refs.media.join(', ')}</p>}{refs?.urls?.filter(url=>typeof url==='string'&&url.startsWith('https://')).map(url=><p key={url}><a href={url} target="_blank" rel="noreferrer">{url}</a></p>)}</>;}
export default function AiPanel({post,user}){
  const [data,setData]=useState(null),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');const sequence=useRef(0);
  const load=useCallback(async()=>{const id=++sequence.current;try{const result=await apiRequest(`/ai/${post.bai_dang_id}${selected?`?analysis=${selected}`:''}`);if(id===sequence.current){setData(result);setError('');}}catch(failure){if(id===sequence.current)setError(failure.message);}},[post.bai_dang_id,selected]);
  useEffect(()=>{let stopped=false,timer;async function poll(){await load();if(!stopped)timer=setTimeout(poll,3000);}void poll();return()=>{stopped=true;++sequence.current;clearTimeout(timer);};},[load]);
  async function request(){setBusy(true);setError('');try{await apiPost(`/ai/${post.bai_dang_id}`,{row_version:post.row_version});setSelected('');await load();}catch(failure){setError(failure.message);}finally{setBusy(false);}}
  const analysis=data?.analysis,pending=['queued','running'].includes(data?.job?.state);
  return <section className="ai-review" aria-label="Phân tích AI"><h3>AI hỗ trợ kiểm duyệt</h3>
    <p className="field-hint">Hai điểm phục vụ tham khảo. Admin đối chiếu bằng chứng và quyết định điều kiện quý hiếm; tình trạng tốt không thay thế độ hiếm.</p>
    {data&&!data.configured&&<p className="notice">Gemini chưa sẵn sàng. Kiểm duyệt thủ công vẫn hoạt động.</p>}
    {pending&&<p className="notice" role="status">{data.job.state==='running'?'Đang phân tích sách…':'Đang chờ AI xử lý…'}</p>}
    {user?.vai_tro==='admin'&&post.trang_thai_phien==='cho_kiem_duyet'&&<button type="button" disabled={!data?.configured||pending||busy} onClick={request}>{busy?'Đang gửi…':analysis?'Phân tích lại bằng AI':'Yêu cầu phân tích AI'}</button>}
    {data?.history?.length>0&&<label className="ai-history-select">Lần phân tích<select aria-label="Lần phân tích" value={selected} onChange={event=>setSelected(event.target.value)}><option value="">Mới nhất</option>{data.history.map(row=><option key={row.phan_tich_id} value={row.phan_tich_id}>#{row.phan_tich_id} · {states[row.trang_thai]} · {new Date(row.ngay_phan_tich).toLocaleString('vi-VN')}</option>)}</select></label>}
    {!analysis&&!pending&&<p>Chưa có phân tích AI cho bài này. Admin có thể kiểm duyệt thủ công.</p>}
    {analysis&&<><p><strong>{states[analysis.trang_thai]}</strong> · {new Date(analysis.ngay_phan_tich).toLocaleString('vi-VN')}</p>
      {analysis.loi_thoi&&<p className="notice">Đây là phân tích của dữ liệu cũ hoặc chưa xác định được phiên bản đầu vào. Cần đối chiếu lại trước khi sử dụng.</p>}
      <div className="ai-score-grid"><div><h4>Hỗ trợ đánh giá độ hiếm</h4><strong>{score(analysis.diem_do_hiem)}</strong><p>{analysis.tinh_diem?.do_hiem?.ly_do_null}</p></div><div><h4>Tình trạng vật lý</h4><strong>{score(analysis.diem_tinh_trang)}</strong><p>{analysis.tinh_diem?.tinh_trang?.ly_do_null}</p></div></div>
      {analysis.thong_tin&&<p className="field-hint">Mô hình: {analysis.thong_tin.model} · Bộ quy tắc: {analysis.thong_tin.rule_version}</p>}
      {analysis.thong_tin?.error_code&&<p className="field-hint">Mã lỗi: {analysis.thong_tin.error_code}{analysis.thong_tin.provider_error?.http_status?` · HTTP ${analysis.thong_tin.provider_error.http_status}`:''}{analysis.thong_tin.provider_error?.provider_code?` · ${analysis.thong_tin.provider_error.provider_code}`:''}{analysis.thong_tin.provider_error?.transport_code?` · ${analysis.thong_tin.provider_error.transport_code}`:''}</p>}
      {analysis.thong_tin?.warnings?.map((text,index)=><p className="notice" key={index}>{text}</p>)}
      {analysis.chi_tiet?.map((row,index)=><details key={index} className="ai-criterion"><summary>{row.tieu_chi} · {row.trang_thai_danh_gia} · {row.diem===null?'Chưa chấm':`${row.diem} điểm`} · Trọng số {row.trong_so}%</summary><p className="preserve-lines">{row.bang_chung||'Chưa có bằng chứng đủ để đánh giá.'}</p><Sources value={row.nguon_doi_chieu}/>{row.canh_bao&&<p className="notice">{row.canh_bao}</p>}{row.do_tin_cay!==null&&<p className="field-hint">Độ tin cậy do AI báo cáo: {row.do_tin_cay}% — không dùng để xác thực nguồn.</p>}</details>)}
      {analysis.tinh_diem&&<details><summary>Đối chiếu phép tính</summary><p>Điểm tổng = Σ(điểm thành phần × trọng số) / Σtrọng số áp dụng. Thiếu một tiêu chí áp dụng thì giữ NULL.</p>{Object.entries(analysis.tinh_diem).map(([key,item])=><p key={key}>{key==='do_hiem'?'Độ hiếm':'Tình trạng'}: {item.diem===null?item.ly_do_null:`${item.tong_diem_co_trong_so} / ${item.tong_trong_so_ap_dung} = ${item.diem.toFixed(2)}`}</p>)}</details>}
      {analysis.thong_tin?.media?.length>0&&<details><summary>Dữ liệu media đã dùng</summary>{analysis.thong_tin.media.map(row=><p key={row.id}><a href={row.url} target="_blank" rel="noreferrer">{row.id}</a> · {row.sent?'Đã gửi phân tích':'Chưa phân tích'}</p>)}</details>}
    </>}{error&&<p className="error" role="alert">{error}</p>}
  </section>;
}
