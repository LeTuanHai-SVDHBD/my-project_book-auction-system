/** Role, moderation-round and provenance boundaries; SQL access is a fixture, not a real server. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {currentReview} from '../../shared/aiVisibility.js';
import {ownerAiResult} from '../src/services/aiPresentation.js';
import {analysisView,inputHash} from '../src/ai/input.js';
import {META_CRITERION,RULE_VERSION} from '../src/ai/criteria.js';
import {createPostModel} from '../src/models/post.model.js';

function fixture() {
  const post={bai_dang_id:7,nguoi_dung_id:1,trang_thai_bai:'da_duyet',trang_thai_phien:'da_qua_kiem_duyet',row_version:'0000000000000003',mo_ta_tinh_trang:'Bìa sờn',media:[],
    kiem_duyet:[{kiem_duyet_id:2,ket_qua:'Phê duyệt',ngay_kiem_duyet:'2026-10-30T03:00:00Z'}, {kiem_duyet_id:1,ket_qua:'Từ chối',ngay_kiem_duyet:'2026-10-30T01:00:00Z'}]};
  const raw={phan_tich_id:10,trang_thai:'that_bai',diem_do_hiem:null,diem_tinh_trang:null,ngay_phan_tich:'2026-10-30T02:00:00Z',
    chi_tiet:[{tieu_chi:META_CRITERION,bang_chung:JSON.stringify({input_hash:inputHash(post),source_version:'0000000000000002',rule_version:RULE_VERSION,model:'fixture',error_code:'AI_TIMEOUT',provider_error:{http_status:504},warnings:['AI_TIMEOUT diagnostic']})}]};
  return {post,raw,analysis:analysisView(raw,post)};
}
test('seller gets current-round result only after a matching Admin decision; failure is friendly',()=>{
  const {post,analysis}=fixture();
  assert.equal(currentReview(post).kiem_duyet_id,2);
  const result=ownerAiResult(analysis,post);
  assert.equal(result.phan_tich_id,10);assert.equal(result.diem_do_hiem,null);
  assert(!JSON.stringify(result).includes('AI_TIMEOUT'));assert(!JSON.stringify(result).includes('http_status'));
  assert.match(result.thong_tin.warnings[0],/AI chưa phân tích thành công/);
  assert.deepEqual(ownerAiResult(result,post),result);
  assert.equal(ownerAiResult(analysis,{...post,trang_thai_bai:'cho_kiem_duyet',trang_thai_phien:'cho_kiem_duyet'}),null);
  assert.equal(ownerAiResult(analysis,{...post,kiem_duyet:[]}),null);
  const rejected={...post,trang_thai_bai:'tu_choi',trang_thai_phien:'khong_dat_kiem_duyet',kiem_duyet:[{...post.kiem_duyet[0],ket_qua:'Từ chối'},post.kiem_duyet[1]]};
  assert.equal(ownerAiResult(analysis,rejected).phan_tich_id,10);
});
test('old/unknown provenance, previous-round result and post-decision result are not published as current',()=>{
  const {post,analysis}=fixture();
  for(const patch of [{loi_thoi:true},{loi_thoi:undefined},{ngay_phan_tich:'2026-10-30T00:30:00Z'},{ngay_phan_tich:'2026-10-30T03:30:00Z'},{ngay_phan_tich:null}])assert.equal(ownerAiResult({...analysis,...patch},post),null);
  assert.equal(ownerAiResult(analysis,{...post,kiem_duyet:[{...post.kiem_duyet[0],ngay_kiem_duyet:null}]}),null);
  assert.equal(currentReview({...post,trang_thai_bai:'tu_choi',trang_thai_phien:'khong_dat_kiem_duyet'}),null);
  const success=ownerAiResult({...analysis,trang_thai:'thanh_cong',diem_do_hiem:75,diem_tinh_trang:50,chi_tiet:[{tieu_chi:'Bìa',diem:50,bang_chung:'M1'}],tinh_diem:{do_hiem:{diem:75},tinh_trang:{diem:50}}},post);
  assert.equal(success.diem_do_hiem,75);assert.equal(success.diem_tinh_trang,50);assert.equal(success.chi_tiet[0].bang_chung,'M1');
});
test('SQL Date objects preserve millisecond boundaries across two review rounds',()=>{
  const {post,analysis}=fixture();
  post.kiem_duyet[0].ngay_kiem_duyet=new Date('2026-10-30T03:00:00.999Z');
  post.kiem_duyet[1].ngay_kiem_duyet=new Date('2026-10-30T03:00:00.800Z');
  assert.equal(ownerAiResult({...analysis,ngay_phan_tich:new Date('2026-10-30T03:00:00.900Z')},post).phan_tich_id,10);
  assert.equal(ownerAiResult({...analysis,ngay_phan_tich:new Date('2026-10-30T03:00:00.799Z')},post),null);
});
test('private post detail also removes pending AI and seller diagnostics; Admin keeps original result',async()=>{
  const {post,raw}=fixture();
  const query=async text=>{
    if(text.includes('JOIN dbo.Sach s'))return {recordset:[{...post,row_version:Buffer.from('0000000000000003','hex')}]};
    if(text.includes('FROM dbo.HinhAnh')||text.includes('FROM dbo.Video'))return {recordset:[]};
    if(text.includes('FROM dbo.KiemDuyet'))return {recordset:post.kiem_duyet};
    if(text.includes('FROM dbo.PhanTichAI')){const {chi_tiet,...summary}=raw;return {recordset:[summary]};}
    if(text.includes('FROM dbo.ChiTietPhanTichAI'))return {recordset:raw.chi_tiet};
    if(text.includes('AS allowed'))return {recordset:[{allowed:0}]};
    assert.fail('Unexpected fixture query');
  };
  const pool={request:()=>({input(){return this;},query})};
  const model=createPostModel({getPool:async()=>pool,sql:{Int:'Int'}});
  assert(!JSON.stringify((await model.detail(7,{owner:1})).ai).includes('AI_TIMEOUT'));
  assert.equal((await model.detail(7,{admin:true})).ai.thong_tin.error_code,'AI_TIMEOUT');
  post.trang_thai_bai='cho_kiem_duyet';post.trang_thai_phien='cho_kiem_duyet';
  assert.equal((await model.detail(7,{owner:1})).ai,null);
  assert.equal((await model.detail(7,{admin:true})).ai.thong_tin.error_code,'AI_TIMEOUT');
});
