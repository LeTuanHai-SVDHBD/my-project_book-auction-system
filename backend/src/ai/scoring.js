/** Hai điểm độc lập; thiếu dữ liệu giữ NULL, không áp dụng có căn cứ loại khỏi mẫu số. */
import {CRITERIA,STATUSES,CONDITION_POINTS} from './criteria.js';
const boundedText=(value,max=6000)=>typeof value==='string'&&value.trim()&&value.trim().length<=max?value.trim():null;
export function aggregate(rows,group) {
  const applicable=rows.filter(row=>row.nhom_tieu_chi===group&&row.trang_thai_danh_gia!==STATUSES.not_applicable);
  const weight=applicable.reduce((n,row)=>n+row.trong_so,0);
  const missing=applicable.filter(row=>row.trang_thai_danh_gia!==STATUSES.assessed||row.diem===null);
  const reason=!applicable.length||!weight?'Không có tiêu chí áp dụng.':missing.length?'Chưa đủ dữ liệu để tính điểm tổng hợp.':null;
  const weighted=reason?null:applicable.reduce((n,row)=>n+row.diem*row.trong_so,0);
  const score=reason?null:Number((BigInt(weighted)*200n+BigInt(weight))/(2n*BigInt(weight)))/100;
  return {diem:score,tong_trong_so_ap_dung:weight,tong_diem_co_trong_so:weighted,ly_do_null:reason};
}
export function scoreObservations(input,{mediaIds=[],sourceUrls=[]}={}) {
  if(!input||!Array.isArray(input.criteria)||input.criteria.length>CRITERIA.length||input.warnings!==undefined&&!Array.isArray(input.warnings)||Object.keys(input).some(key=>!['criteria','warnings'].includes(key)))throw Error('AI_INVALID_RESPONSE');
  const seen=new Set();
  for(const row of input.criteria){if(!row||!CRITERIA.some(c=>c.id===row.id)||seen.has(row.id))throw Error('AI_INVALID_RESPONSE');seen.add(row.id);}
  const warnings=(Array.isArray(input.warnings)?input.warnings:[]).map(x=>boundedText(x,2000)).filter(Boolean).slice(0,20);
  const rows=CRITERIA.map(criterion=>{
    const raw=input.criteria.find(x=>x.id===criterion.id)||{};
    let state=Object.hasOwn(STATUSES,raw.status)?raw.status:'missing',point=null;
    const evidence=boundedText(raw.evidence),warning=boundedText(raw.warning);
    const refs=Array.isArray(raw.media_refs)?raw.media_refs:[];
    const sources=Array.isArray(raw.sources)?raw.sources:[];
    const validRefs=refs.every(x=>typeof x==='string'&&mediaIds.includes(x));
    const validSources=sources.every(x=>typeof x==='string'&&sourceUrls.includes(x));
    const flags=[];
    if(Object.keys(raw).some(key=>!['id','status','findings','evidence','media_refs','sources','confidence','warning'].includes(key)))flags.push('Đầu ra có trường ngoài hợp đồng.');
    if(!validRefs||!validSources)flags.push('Nguồn hoặc mã media không có trong dữ liệu đã cung cấp.');
    if(state==='assessed'){
      const findings=raw.findings;
      if(!evidence||!refs.length||!validRefs||!Array.isArray(findings)||!findings.length||findings.length>5)flags.push('Chưa đủ căn cứ quan sát để chấm điểm.');
      else if(criterion.group==='do_hiem'){
        if(findings.length===1&&['meets','does_not_meet'].includes(findings[0]))point=findings[0]==='meets'?100:0;
        else flags.push('Kết quả độ hiếm không thuộc bảng quy đổi.');
      }else if(findings.every(x=>Object.hasOwn(CONDITION_POINTS,x)))point=Math.min(...findings.map(x=>CONDITION_POINTS[x]));
      else flags.push('Kết quả tình trạng không thuộc bảng quy đổi.');
    }
    if(state==='not_applicable'&&(!evidence||!refs.length))flags.push('Không áp dụng cần có bằng chứng, không dùng thay cho ảnh bị thiếu.');
    if(flags.length){state='verify';point=null;}
    if(state!=='assessed')point=null;
    const confidence=Number.isFinite(raw.confidence)&&raw.confidence>=0&&raw.confidence<=100?Math.round(raw.confidence*100)/100:null;
    return {tieu_chi:criterion.name,nhom_tieu_chi:criterion.group,trong_so:criterion.weight,diem:point,
      trang_thai_danh_gia:STATUSES[state],bang_chung:evidence,do_tin_cay:confidence,
      canh_bao:[warning,...flags,...(sources.length?['Nguồn đối chiếu do đầu vào cung cấp; Admin cần kiểm tra nội dung và tính xác thực.']:[])].filter(Boolean).join(' ')||null,
      nguon_doi_chieu:JSON.stringify({media:validRefs?refs:[],urls:validSources?sources:[]})};
  });
  const rarity=aggregate(rows,'do_hiem'),condition=aggregate(rows,'tinh_trang');
  return {diem_do_hiem:rarity.diem,diem_tinh_trang:condition.diem,trang_thai:rarity.diem!==null&&condition.diem!==null&&!warnings.length?'thanh_cong':'chua_day_du',
    chi_tiet:rows,tinh_diem:{do_hiem:rarity,tinh_trang:condition},canh_bao:warnings};
}
