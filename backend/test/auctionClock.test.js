/** Biên đồng hồ UI và chờ kết quả SQL; đồng hồ máy người dùng không quyết định phiên kết thúc. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {observeAuctionClock,auctionTime} from '../../frontend/src/utils/auctionClock.js';
const row={server_time:'2026-10-24T01:00:00Z',thoi_gian_bat_dau:'2026-10-24T01:00:10Z',thoi_gian_ket_thuc:'2026-10-24T01:01:10Z'};
test('đếm theo mốc SQL, qua giờ bắt đầu và hết giờ chỉ chờ xác nhận',()=>{
  const clock=observeAuctionClock(row,100);
  assert.deepEqual(auctionTime(clock,'da_kich_hoat',100),{phase:'scheduled',seconds:10});
  assert.deepEqual(auctionTime(clock,'da_kich_hoat',10100),{phase:'open',seconds:60});
  assert.deepEqual(auctionTime(clock,'da_kich_hoat',70099),{phase:'open',seconds:1});
  assert.deepEqual(auctionTime(clock,'da_kich_hoat',70100),{phase:'closing',seconds:0});
  assert.deepEqual(auctionTime(clock,'da_ket_thuc',11000),{phase:'closed',seconds:0});
  assert.equal(auctionTime(null,'da_kich_hoat',100).phase,'unknown');
  assert.throws(()=>observeAuctionClock({...row,server_time:'invalid'},100));
});
