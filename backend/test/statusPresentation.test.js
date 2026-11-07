/** Guard visual status semantics and readable contrast without changing auction decisions. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS, postStatus } from '../../frontend/src/utils/statusPresentation.js';
const now=Date.parse('2026-11-03T12:00:00Z');
const active={trang_thai_phien:'da_kich_hoat',thoi_gian_bat_dau:'2026-11-03T11:00:00Z',thoi_gian_ket_thuc:'2026-11-03T13:00:00Z'};
test('visible auction phases respect boundaries and never invent a saved result',()=>{
  assert.equal(postStatus(active,now),'live');
  assert.equal(postStatus(active,now-3600001),'scheduled');
  assert.equal(postStatus(active,now-3600000),'live');
  assert.equal(postStatus(active,now+3600000),'closing');
  assert.equal(postStatus({...active,trang_thai_phien:'da_ket_thuc'},now),'ended');
  assert.equal(postStatus({...active,thoi_gian_bat_dau:null},now),'syncing');
  assert.equal(postStatus({trang_thai_phien:'new_server_state'},now),'unknown');
});
test('moderation states have stable distinct colors across card and detail presentations',()=>{
  assert.equal(postStatus({trang_thai_phien:'cho_kiem_duyet'},now),'pending');
  assert.equal(postStatus({trang_thai_phien:'da_qua_kiem_duyet'},now),'approved');
  assert.equal(postStatus({trang_thai_phien:'khong_dat_kiem_duyet'},now),'rejected');
  const states=['pending','approved','rejected','scheduled','live','closing','ended'];
  assert.equal(new Set(states.map(key=>STATUS[key].colors[0])).size,states.length);
  for(const group of [['cho_xac_nhan','hoan_tat'],['cho_xu_ly','dang_xu_ly','da_xu_ly'],['not_analyzed','queued','running','thanh_cong','chua_day_du','that_bai']])
    assert.equal(new Set(group.map(key=>STATUS[key].colors[0])).size,group.length);
});
function luminance(hex){const rgb=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
test('all badge text has WCAG AA contrast and a visible label plus symbol',()=>{
  for(const [key,value] of Object.entries(STATUS)){
    const [ink,bg]=value.colors, a=luminance(ink), b=luminance(bg);
    assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`Contrast: ${key}`);
    assert.ok(value.label.length>0&&value.icon.length>0,key);
  }
});
