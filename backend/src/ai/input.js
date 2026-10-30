/** Chỉ gửi dữ liệu sách cần phân tích; không gửi tài khoản, mức giá hoặc ngưỡng kết thúc sớm cho Gemini. */
import {createHash} from 'node:crypto';
import {aggregate} from './scoring.js';
import {META_CRITERION,RULE_VERSION} from './criteria.js';
export function analysisInput(row) {
  // Keep raw source fields in the provenance hash; Gemini merges their display text separately.
  const names=['ten_sach','tac_gia','the_loai','nha_xuat_ban','nam_xuat_ban','isbn','tinh_trang_sach','mo_ta','tieu_de','mo_ta_tinh_trang'];
  return {book:Object.fromEntries(names.map(key=>[key,row[key]??null])),media:(row.media||[]).map((x,index)=>({id:`M${index+1}`,kind:x.kind,url:x.url,title:x.title||''}))};
}
export const inputHash=row=>createHash('sha256').update(JSON.stringify(analysisInput(row))).digest('hex');
export function analysisView(raw,row) {
  if(!raw)return null;
  const details=raw.chi_tiet||[],metadata=details.find(x=>x.tieu_chi===META_CRITERION);
  let info=null;try{info=JSON.parse(metadata?.bang_chung||'null');}catch{/* Legacy analysis remains readable without inventing provenance. */}
  const view={...raw,chi_tiet:details.filter(x=>x.tieu_chi!==META_CRITERION),thong_tin:info,loi_thoi:!info||info.input_hash!==inputHash(row)};
  view.tinh_diem=raw.trang_thai!=='that_bai'&&info?.rule_version===RULE_VERSION?{do_hiem:aggregate(view.chi_tiet,'do_hiem'),tinh_trang:aggregate(view.chi_tiet,'tinh_trang')}:null;
  return view;
}
