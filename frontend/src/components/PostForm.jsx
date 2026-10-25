/** Biểu mẫu sách/bài đăng; tệp được tải trước, chỉ vé upload được gửi cùng nội dung. */
import {useEffect,useRef,useState} from 'react';
import {postApi} from '../services/postApi.js';
import MoneyInput from './MoneyInput.jsx';
import GenreSelect from './GenreSelect.jsx';
export default function PostForm({source,mode='create',onSaved,onCancel}) {
  const [config,setConfig]=useState(null); const [media,setMedia]=useState([]); const [busy,setBusy]=useState(false);
  const [error,setError]=useState(''); const [progress,setProgress]=useState('');
  const [cooldown,setCooldown]=useState(()=>String(source?.thoi_gian_cho_dat_lai??20));
  const [requestId]=useState(()=>crypto.randomUUID()); const tickets=useRef([]); const submitted=useRef(false);
  useEffect(()=>{let canceled=false;postApi.config().then(value=>{if(!canceled)setConfig(value);}).catch(failure=>{if(!canceled)setError(failure.message);});
    return()=>{canceled=true;if(!submitted.current)for(const item of tickets.current)void postApi.discard(item.upload_id).catch(()=>{});};},[]);
  async function upload(event) {
    const files=[...event.target.files]; event.target.value=''; setBusy(true);setError('');
    try {
      for(const [index,file] of files.entries()) {
        const image=config.imageTypes.includes(file.type);const video=config.videoTypes.includes(file.type);
        if(!image&&!video)throw new Error('Chỉ hỗ trợ JPEG, PNG, WebP, MP4 và WebM.');
        if(file.size>(image?config.imageMaxBytes:config.videoMaxBytes))throw new Error(`Tệp ${file.name} vượt giới hạn ${Math.round((image?config.imageMaxBytes:config.videoMaxBytes)/1048576)} MB.`);
        setProgress(`Đang tải ${index+1}/${files.length}: ${file.name}`);
        const result=await postApi.upload(file);const item={...result,tieu_de:file.name.slice(0,500)};
        tickets.current=[...tickets.current,item];setMedia(tickets.current);
      }
    } catch(failure){setError(failure.message);} finally {setBusy(false);setProgress('');}
  }
  async function remove(item) {
    setBusy(true);setError('');try{await postApi.discard(item.upload_id);tickets.current=tickets.current.filter(x=>x.upload_id!==item.upload_id);setMedia(tickets.current);}
    catch(failure){setError(failure.message);}finally{setBusy(false);}
  }
  async function submit(event) {
    event.preventDefault(); const data=Object.fromEntries(new FormData(event.currentTarget));setBusy(true);setError('');
    const body={ma_yeu_cau:requestId,bai_dang:{tieu_de:data.tieu_de,mo_ta_tinh_trang:data.mo_ta_tinh_trang},phien:{gia_khoi_diem:data.gia_khoi_diem,gia_toi_thieu:data.gia_toi_thieu,buoc_gia:data.buoc_gia,thoi_gian_cho_dat_lai:Number(data.thoi_gian_cho_dat_lai)},media:media.map(({upload_id,tieu_de})=>({upload_id,tieu_de}))};
    if(mode==='create')body.sach=Object.fromEntries(['ten_sach','tac_gia','the_loai','nha_xuat_ban','isbn','tinh_trang_sach','mo_ta'].map(key=>[key,data[key]||null]).concat([['nam_xuat_ban',data.nam_xuat_ban?Number(data.nam_xuat_ban):null]]));
    else {body.reuse_media=mode==='resubmit'||data.reuse_media==='on';if(mode==='resubmit'){delete body.ma_yeu_cau;body.row_version=source.row_version;}}
    try {const result=await postApi.save(body,source?.bai_dang_id,mode);submitted.current=true;onSaved(result.id);}
    catch(failure){setError(failure.message+(failure.status===409?' Đóng biểu mẫu và tải lại bài nếu trạng thái đã thay đổi.':''));}
    finally{setBusy(false);}
  }
  const input=(name,label,max,required=false,type='text',value=source?.[name]??'')=><label key={name}>{label}<input name={name} type={type} defaultValue={value} maxLength={max} required={required}/></label>;
  return <section className="post-sheet"><span className="eyebrow">CHỦ SÁCH</span><h2>{mode==='create'?'Đăng sách mới':mode==='resubmit'?'Bổ sung và gửi duyệt lại':'Đăng lại cùng bản sách'}</h2>
    <form onSubmit={submit}><fieldset disabled={busy}>
      {mode==='create'?<><h3>Thông tin bản sách</h3><div className="form-grid">{input('ten_sach','Tên sách',300,true)}{input('tac_gia','Tác giả',200)}<GenreSelect/>{input('nha_xuat_ban','Nhà xuất bản',200)}{input('nam_xuat_ban','Năm xuất bản',4,false,'number')}{input('isbn','ISBN (10 hoặc 13 ký tự)',13)}</div>
        <label>Tình trạng sách<textarea name="tinh_trang_sach" required maxLength={1000}/></label><label>Giới thiệu sách<textarea name="mo_ta" maxLength={12000}/></label></>:<p>Giữ sách #{source.sach_id}: <strong>{source.ten_sach}</strong>. {mode==='relist'?'Tạo bài và phiên mới, giữ nguyên lịch sử phiên cũ.':'Giữ bài, phiên, media và lịch sử kiểm duyệt; bổ sung bằng chứng còn thiếu.'}</p>}
      <h3>Nội dung gửi kiểm duyệt</h3>{input('tieu_de','Tiêu đề bài đăng',300,true)}
      <label>Tình trạng, yếu tố quý hiếm và bằng chứng<textarea name="mo_ta_tinh_trang" defaultValue={source?.mo_ta_tinh_trang||''} required maxLength={12000} rows={5}/></label>
      <p className="field-hint">Nêu ấn bản, chữ ký, số lượng phát hành hoặc nguồn đối chiếu nếu có; mô tả khuyết điểm và phần cần xác minh.</p>
      <h3>Ảnh và video</h3>
      {mode==='relist'&&<label className="check-label"><input type="checkbox" name="reuse_media" defaultChecked/>Dùng lại media của bài cũ</label>}
      <p className="field-hint">{config?`Tối đa ${config.maxImages} ảnh (${config.imageMaxBytes/1048576} MB/tệp), ${config.maxVideos} video (${config.videoMaxBytes/1048576} MB/tệp). JPEG, PNG, WebP, MP4, WebM.`:'Đang tải cấu hình…'}</p>
      {config&&!config.configured&&<p className="notice">Chức năng tải tệp chưa sẵn sàng. Vui lòng liên hệ quản trị viên.</p>}
      <label>Chọn tệp<input type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" disabled={!config?.configured||busy} onChange={upload}/></label>
      <div className="media-grid">{media.map(item=><figure key={item.upload_id}>{item.kind==='image'?<img src={item.url} alt={item.tieu_de}/>:<video src={item.url} controls preload="metadata"/>}<figcaption>{item.tieu_de}</figcaption><button type="button" onClick={()=>remove(item)}>Bỏ tệp</button></figure>)}</div>
      <h3>Thông số đấu giá</h3><div className="form-grid"><MoneyInput name="gia_khoi_diem" label="Giá khởi điểm (VND)" initialValue={source?.gia_khoi_diem}/><MoneyInput name="gia_toi_thieu" label="Giá kết thúc sớm — chỉ chủ sách/Admin thấy (VND)" initialValue={source?.gia_toi_thieu}/><MoneyInput name="buoc_gia" label="Bước giá (VND)" initialValue={source?.buoc_gia}/><label>Chờ đặt lại (10–30 giây)<input name="thoi_gian_cho_dat_lai" type="text" inputMode="numeric" pattern="(?:1[0-9]|2[0-9]|30)" title="Nhập số nguyên từ 10 đến 30 giây." required value={cooldown} onChange={event=>setCooldown(event.target.value.replace(/[^0-9]/g,'').slice(0,2))}/></label></div>
      <p className="field-hint">Nhập số tiền VND nguyên; dấu chấm phân cách hàng nghìn được thêm tự động. Chỉ đặt lịch sau khi được Admin phê duyệt.</p>
      <div className="actions"><button className="primary">{busy?'Đang xử lý…':'Gửi kiểm duyệt'}</button><button type="button" className="secondary" onClick={onCancel}>Đóng biểu mẫu</button></div>
    </fieldset></form>{progress&&<p role="status">{progress}</p>}{error&&<p className="error" role="alert">{error}</p>}
  </section>;
}
