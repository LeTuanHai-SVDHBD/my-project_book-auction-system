/** Biên nghiệp vụ đặt giá/kết thúc: đồng hồ xử lý, tiền chính xác, cooldown và không tự đổi trạng thái SQL. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validateBidRequest,evaluateBid,deriveEndResult} from '../src/services/bidPolicy.js';

const date=value=>new Date(`2026-10-23T10:${value}Z`);
const now=date('01:00.000');
const auction=patch=>({trang_thai:'da_kich_hoat',nguoi_ban_id:1,gia_khoi_diem:'100000',buoc_gia:'10000',
  gia_toi_thieu:'500000',gia_hien_tai:null,thoi_gian_cho_dat_lai:20,
  thoi_gian_bat_dau:date('00:00.000'),thoi_gian_ket_thuc:date('05:00.000'),...patch});
const bid=(patch={},overrides={})=>evaluateBid({auction:auction(patch),bidderId:2,amount:'100000',now,...overrides});

test('hợp đồng nhận UUID v4 và chuỗi tiền; người đặt lấy từ session, không nhận dữ liệu tự chèn',()=>{
  const requestId=randomUUID();assert.deepEqual(validateBidRequest({ma_yeu_cau:requestId.toUpperCase(),muc_gia:'999999999999999999'}),{requestId,amount:'999999999999999999'});
  for(const amount of [1,'0','-1','01','1.5','1e5','1.000','1000000000000000000',null])assert.throws(()=>validateBidRequest({ma_yeu_cau:requestId,muc_gia:amount}),{status:400,code:'INVALID_BID_INPUT'});
  for(const body of [null,[],{}, {ma_yeu_cau:'a'.repeat(64),muc_gia:'1000'},...['nguoi_dung_id','row_version','thoi_gian_dat','gia_toi_thieu','trang_thai'].map(key=>({ma_yeu_cau:requestId,muc_gia:'1000',[key]:1}))])assert.throws(()=>validateBidRequest(body),{status:400});
});
test('lượt đầu bằng giá khởi điểm hoặc cộng nguyên bước; lượt sau bắt buộc tăng ít nhất một bước',()=>{
  for(const amount of ['100000','110000','140000'])assert.equal(bid({}, {amount}).accepted,true);
  assert.equal(bid({}, {amount:'90000'}).code,'BID_TOO_LOW');
  assert.equal(bid({}, {amount:'100001'}).code,'INVALID_BID_STEP');
  for(const amount of ['100000','110000'])assert.equal(bid({gia_hien_tai:'110000'},{amount}).code,'BID_TOO_LOW');
  assert.equal(bid({gia_hien_tai:'110000'},{amount:'120000'}).accepted,true);
  assert.equal(bid({gia_hien_tai:'110000'},{amount:'120001'}).code,'INVALID_BID_STEP');
});
test('tiền 18 chữ số vượt giới hạn Number vẫn tính bước và ngưỡng chính xác',()=>{
  const patch={gia_khoi_diem:'999999999999999991',gia_toi_thieu:'999999999999999999',buoc_gia:'2'};
  assert.equal(bid(patch,{amount:'999999999999999997'}).endsEarly,false);
  const result=bid(patch,{amount:'999999999999999999'});assert.equal(result.accepted,true);assert.equal(result.endsEarly,true);
  assert.equal(bid(patch,{amount:'999999999999999998'}).code,'INVALID_BID_STEP');
});
test('chỉ nhận giá trong khoảng [bắt đầu, kết thúc), dựa trên thời điểm xử lý',()=>{
  assert.equal(bid({}, {now:date('00:00.000')}).accepted,true);
  assert.equal(bid({}, {now:new Date(date('00:00.000').getTime()-1)}).code,'AUCTION_NOT_STARTED');
  assert.equal(bid({}, {now:date('04:59.999')}).accepted,true);
  assert.deepEqual(bid({}, {now:date('05:00.000')}),{accepted:false,code:'AUCTION_EXPIRED',closeExpired:true});
  for(const state of ['cho_kiem_duyet','khong_dat_kiem_duyet','da_qua_kiem_duyet','da_ket_thuc'])assert.equal(bid({trang_thai:state,thoi_gian_bat_dau:null,thoi_gian_ket_thuc:null}).code,'AUCTION_NOT_ACTIVE');
  assert.throws(()=>bid({}, {now:undefined}),/Date/);
});
test('chủ sách không được đặt; cooldown chỉ căn cứ lượt hợp lệ trước của cùng người/cùng phiên',()=>{
  assert.equal(bid({}, {bidderId:1}).code,'SELLER_CANNOT_BID');
  for(const cooldown of [10,20,30]) {
    const lastBidAt=new Date(now.getTime()-cooldown*1000+1);
    assert.deepEqual(bid({thoi_gian_cho_dat_lai:cooldown},{lastBidAt}),{accepted:false,code:'BID_COOLDOWN',retryAfterMs:1});
    assert.equal(bid({thoi_gian_cho_dat_lai:cooldown},{lastBidAt:new Date(lastBidAt.getTime()-1)}).accepted,true);
  }
  assert.equal(bid({}, {lastBidAt:null}).accepted,true);
});
test('ngưỡng bằng giá khởi điểm: lượt đầu kết thúc sớm; đạt/vượt ngưỡng đều kết thúc',()=>{
  assert.equal(bid({gia_toi_thieu:'100000'}).endsEarly,true);
  for(const amount of ['500000','510000'])assert.equal(bid({}, {amount}).endsEarly,true);
  assert.equal(bid({}, {amount:'490000'}).endsEarly,false);
});
test('hết hạn có giá hợp lệ dưới ngưỡng vẫn có người thắng; không có lượt thì không có giao dịch cần tạo',()=>{
  const a=auction({gia_hien_tai:'120000'}),topBid={nguoi_dung_id:2,muc_gia:'120000'};
  const result=deriveEndResult({auction:a,topBid,now:date('05:00.000'),reason:'het_thoi_gian'});
  assert.equal(result.trang_thai,'co_nguoi_thang');assert.equal(result.nguoi_thang_dau_id,2);assert.equal(result.muc_gia_thang,'120000');
  assert.equal(result.ly_do_ket_thuc,'het_thoi_gian');
  const empty=deriveEndResult({auction:auction(),topBid:null,now:date('05:00.000'),reason:'het_thoi_gian'});
  assert.equal(empty.trang_thai,'khong_co_nguoi_thang');assert.equal(empty.nguoi_thang_dau_id,null);assert.equal(empty.muc_gia_thang,null);
  assert.equal(deriveEndResult({auction:a,topBid,now,reason:'het_thoi_gian'}),null);
});
test('kết thúc sớm cần giá hợp lệ đạt ngưỡng trong thời gian; không có kết thúc thủ công',()=>{
  const a=auction({gia_hien_tai:'500000'}),topBid={nguoi_dung_id:2,muc_gia:'500000'};
  assert.equal(deriveEndResult({auction:a,topBid,now,reason:'dat_gia_toi_thieu'}).nguoi_thang_dau_id,2);
  assert.equal(deriveEndResult({auction:auction({gia_hien_tai:'100000'}),topBid:{nguoi_dung_id:2,muc_gia:'100000'},now,reason:'dat_gia_toi_thieu'}),null);
  assert.equal(deriveEndResult({auction:a,topBid,now:date('05:00.000'),reason:'dat_gia_toi_thieu'}),null);
  assert.throws(()=>deriveEndResult({auction:a,topBid,now,reason:'thu_cong'}),/hai lý do/);
  assert.equal(deriveEndResult({auction:{...a,trang_thai:'da_ket_thuc'},topBid,now,reason:'dat_gia_toi_thieu'}),null);
});
test('dữ liệu nội bộ sai phải báo lỗi để retry/đối soát, không gán thành kết quả thành công hoặc từ chối giả',()=>{
  for(const patch of [{buoc_gia:'0'},{gia_hien_tai:'1'},{gia_hien_tai:'100001'},{gia_toi_thieu:'1'},{thoi_gian_cho_dat_lai:31},{thoi_gian_ket_thuc:new Date('invalid')}])assert.throws(()=>bid(patch));
  assert.throws(()=>bid({}, {lastBidAt:new Date(now.getTime()+1)}));
  assert.throws(()=>bid({gia_hien_tai:'500000'}),/chưa kết thúc/);
  const a=auction({gia_hien_tai:'120000'});
  for(const topBid of [null,{nguoi_dung_id:2,muc_gia:'110000'},{nguoi_dung_id:1,muc_gia:'120000'}])assert.throws(()=>deriveEndResult({auction:a,topBid,now:date('05:00.000'),reason:'het_thoi_gian'}));
});
