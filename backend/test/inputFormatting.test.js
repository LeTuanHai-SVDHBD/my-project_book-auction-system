/** Hợp đồng đầu vào giao diện: chọn phiên tab và tiền 18 chữ số không làm tròn. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTabIdentity,TAB_STORAGE_KEY} from '../../frontend/src/services/tabIdentity.js';
import {editMoneyInput,moneyDigits,formatMoneyInput,positionAfterDigits} from '../../frontend/src/utils/moneyInput.js';
test('tab mới xoay selector cả khi storage được sao chép, F5 dùng lại selector, không lưu thông tin xác thực',()=>{
  const map=new Map();const storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};
  const first=createTabIdentity({storage,navigationType:'navigate',randomUUID:()=> '11111111-1111-4111-8111-111111111111'});
  assert.equal(createTabIdentity({storage,navigationType:'reload',randomUUID:()=>{throw Error('Must reuse');}}),first);
  const second=createTabIdentity({storage,navigationType:'navigate',randomUUID:()=> '22222222-2222-4222-8222-222222222222'});
  assert.notEqual(first,second);assert.deepEqual([...map.keys()],[TAB_STORAGE_KEY]);
  map.set(TAB_STORAGE_KEY,'broken');assert.equal(createTabIdentity({storage,navigationType:'reload',randomUUID:()=> '33333333-3333-4333-8333-333333333333'}).length,32);
});
test('lọc chữ, nhóm nghìn, giữ nguyên giá trị vượt giới hạn Number an toàn và chuỗi rỗng',()=>{
  assert.equal(formatMoneyInput(moneyDigits('a1b500c000')),'1.500.000');
  assert.equal(moneyDigits('001.500.000'),'1500000');
  assert.equal(formatMoneyInput('999999999999999999'),'999.999.999.999.999.999');
  assert.equal(moneyDigits(''),'');assert.equal(formatMoneyInput(''),'');assert.equal(moneyDigits('000'),'0');
});
test('chèn/xóa ở giữa tiền giữ vị trí con trỏ theo chữ số thay vì dấu phân cách',()=>{
  assert.deepEqual(editMoneyInput('1.5200.000',4),{digits:'15200000',caret:4});
  assert.equal(positionAfterDigits('1.500.000',1),1);assert.equal(positionAfterDigits('1.500.000',4),5);
  assert.equal(positionAfterDigits('1.500.000',0),0);assert.equal(editMoneyInput('000123',6).digits,'123');
});
