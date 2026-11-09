/** Quy tắc của báo cáo: kiểm tra trọng số, điểm độc lập, NULL, loại N/A và nguồn sai. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {CRITERIA,STATUSES} from '../src/ai/criteria.js';
import {scoreObservations} from '../src/ai/scoring.js';
import {moderationDecision} from '../src/ai/moderation.js';
import {analysisInput,inputHash} from '../src/ai/input.js';
import fixture from './fixtures/ai-observations.json' with {type:'json'};
const complete=()=>({criteria:CRITERIA.map(c=>({id:c.id,status:'assessed',findings:[c.group==='do_hiem'?'meets':'intact'],evidence:'Bằng chứng mẫu cho bộ tính điểm, không phải giám định thật.',media_refs:['M1'],sources:[],confidence:75,warning:null})),warnings:[]});
const score=data=>scoreObservations(data,{mediaIds:['M1']});
test('mỗi nhóm có tổng trọng số 100; hai điểm không cộng hoặc lấy trung bình',()=>{
  assert.equal(CRITERIA.filter(c=>c.group==='do_hiem').reduce((n,c)=>n+c.weight,0),100);
  assert.equal(CRITERIA.filter(c=>c.group==='tinh_trang').reduce((n,c)=>n+c.weight,0),100);
  const data=complete();data.criteria.filter(c=>['cover','spine','pages','edges','dust_jacket'].includes(c.id)).forEach(c=>c.findings=['destroyed']);
  const result=score(data);assert.equal(result.diem_do_hiem,100);assert.equal(result.diem_tinh_trang,0);
});
test('thiếu một tiêu chí áp dụng giữ riêng điểm tổng NULL; thành phần hợp lệ và nhóm kia được giữ',()=>{
  const data=complete();data.criteria[0]={id:'limited_edition',status:'missing'};
  const result=score(data);assert.equal(result.diem_do_hiem,null);assert.equal(result.diem_tinh_trang,100);
  assert.equal(result.chi_tiet[0].diem,null);assert.equal(result.chi_tiet[1].diem,100);
});
test('chuẩn hóa khi N/A có căn cứ, chọn tình trạng thấp nhất và làm tròn hai chữ số',()=>{
  const data=complete();data.criteria.find(c=>c.id==='cover').findings=['intact','light'];data.criteria.find(c=>c.id==='spine').findings=['moderate'];data.criteria.find(c=>c.id==='edges').findings=['light'];
  data.criteria.find(c=>c.id==='dust_jacket').status='not_applicable';
  const result=score(data);assert.equal(result.diem_tinh_trang,76.39);assert.equal(result.tinh_diem.tinh_trang.tong_trong_so_ap_dung,90);
  data.criteria.filter(c=>CRITERIA.find(x=>x.id===c.id).group==='do_hiem').forEach(c=>c.status='not_applicable');assert.equal(score(data).diem_do_hiem,null);
});
test('không dùng N/A thiếu bằng chứng, nguồn/media tự chế hoặc điểm model tự cho',()=>{
  for(const patch of [{status:'not_applicable',evidence:null},{media_refs:['M999']},{sources:['https://invented.example']},{diem:100},{findings:['unknown']}]){
    const data=complete();Object.assign(data.criteria[0],patch);assert.equal(score(data).diem_do_hiem,null);
  }
  const data=complete();data.criteria.push(data.criteria[0]);assert.throws(()=>score(data));
});
test('URL do người đăng cung cấp có cảnh báo trung tính; không thay bằng chứng hoặc tự làm mất điểm',()=>{
  const data=complete(),url='https://example.test/catalog';
  data.criteria[0].sources=[url];
  data.criteria[3]={...data.criteria[3],status:'verify',evidence:'M1 thấy nhãn sở hữu, chưa đối chiếu được đúng bản.',sources:[url]};
  const result=scoreObservations(data,{mediaIds:['M1'],sourceUrls:[url]});
  assert.equal(result.chi_tiet[0].diem,100);
  assert.equal(result.chi_tiet[0].canh_bao,'Nguồn do người đăng cung cấp; hệ thống chưa đối chiếu độc lập.');
  assert.equal(result.chi_tiet[3].diem,null);
  assert.equal(result.diem_do_hiem,null);
  assert.equal(result.diem_tinh_trang,100);
});
test('phân biệt không ghi nhận dấu ấn với thiếu ảnh, chưa xác minh và N/A không hợp lệ',()=>{
  const noMark={status:'assessed',findings:['does_not_meet'],evidence:'M1 cho thấy giấy lót và trang nhan đề rõ, không ghi nhận dấu ấn riêng ở các vị trí này.',media_refs:['M1']};
  for(const [patch,expectedState,expectedRarity,approve] of [
    [noMark,STATUSES.assessed,75,true],
    [{...noMark,media_refs:[]},STATUSES.verify,null,false],
    [{status:'missing',evidence:'Thiếu ảnh giấy lót và trang nhan đề.'},STATUSES.missing,null,false],
    [{status:'verify',evidence:'M1 thấy nhãn sở hữu, chưa đối chiếu được lai lịch đúng bản.'},STATUSES.verify,null,false],
    [{status:'not_applicable',evidence:noMark.evidence},STATUSES.verify,null,false],
  ]){
    const data=complete(),provenance=data.criteria.find(item=>item.id==='provenance');
    Object.assign(provenance,patch);
    const result=score(data),detail=result.chi_tiet.find(item=>item.tieu_chi==='Lai lịch và dấu ấn riêng');
    assert.equal(detail.trang_thai_danh_gia,expectedState);
    assert.equal(detail.diem,expectedRarity===75?0:null);
    assert.equal(result.diem_do_hiem,expectedRarity);
    assert.equal(result.tinh_diem.do_hiem.tong_trong_so_ap_dung,100);
    assert.equal(result.diem_tinh_trang,100);
    assert.equal(moderationDecision(result,{}, {rarity:70,condition:70}).approve,approve);
  }
});
test('dữ liệu gửi AI không có giá/tài khoản; fingerprint đổi khi sách/media đổi',()=>{
  const row={ten_sach:'Mẫu',gia_toi_thieu:'secret',email:'secret@example.test',media:[{kind:'image',url:'https://res.cloudinary.com/demo/image/upload/a.jpg'}]};
  assert(!JSON.stringify(analysisInput(row)).includes('secret'));assert.notEqual(inputHash(row),inputHash({...row,tieu_de:'Thay đổi'}));
});
test('file đầu vào mẫu cho đúng hai điểm mong đợi, kiểm tra được qua ai:example',()=>{const result=scoreObservations(fixture.observations,{mediaIds:fixture.mediaIds});assert.equal(result.diem_do_hiem,fixture.expected.diem_do_hiem);assert.equal(result.diem_tinh_trang,fixture.expected.diem_tinh_trang);});
