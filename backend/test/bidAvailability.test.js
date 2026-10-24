/** Biên đếm chờ giao diện: mốc SQL, trôi thời gian và phản hồi thiếu/sai dữ liệu. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {observeBidStatus,remainingBidSeconds} from '../../frontend/src/utils/bidAvailability.js';

const row={la_chu_sach:false,server_time:'2026-10-24T01:00:05.000Z',duoc_dat_lai_luc:'2026-10-24T01:00:20.000Z'};
test('đếm từ đồng hồ SQL, làm tròn lên và chỉ hết chờ khi đủ thời gian',()=>{
  const status=observeBidStatus(row,1000);
  assert.equal(remainingBidSeconds(status,1000),15);
  assert.equal(remainingBidSeconds(status,1500),15);
  assert.equal(remainingBidSeconds(status,15999),1);
  assert.equal(remainingBidSeconds(status,16000),0);
  assert.equal(remainingBidSeconds(status,99999),0);
  assert.equal(remainingBidSeconds(status,0),15);
});
test('chưa có lượt hợp lệ hoặc đã hết chờ thì không tạo khoảng chờ mới khi tải lại',()=>{
  assert.equal(remainingBidSeconds(observeBidStatus({...row,duoc_dat_lai_luc:null},100),100),0);
  assert.equal(remainingBidSeconds(observeBidStatus({...row,server_time:'2026-10-24T01:00:21.000Z'},100),100),0);
  assert.equal(remainingBidSeconds(null,100),0);
});
test('không cho dữ liệu thiếu/sai làm mở nhầm thao tác đặt giá',()=>{
  for(const patch of [{la_chu_sach:undefined},{server_time:'invalid'},{duoc_dat_lai_luc:'invalid'}])assert.throws(()=>observeBidStatus({...row,...patch},100));
  assert.throws(()=>observeBidStatus(row,NaN));
});
