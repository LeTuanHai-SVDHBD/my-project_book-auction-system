/** Display/provider compatibility: preserve old evidence without duplicating a derived preview. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {bookReviewDescription,conditionPreview} from '../../shared/bookCondition.js';
import {analysisInput,inputHash,analysisView} from '../src/ai/input.js';
import {META_CRITERION,RULE_VERSION} from '../src/ai/criteria.js';

test('one description keeps legacy-only and distinct legacy evidence, without repeating previews',()=>{
  const full='Mô tả đủ tình trạng, nguồn và bằng chứng. '.repeat(100);
  assert.equal(bookReviewDescription({mo_ta_tinh_trang:full,tinh_trang_sach:conditionPreview(full)}),full.trim());
  const legacy={mo_ta_tinh_trang:'Bản in đầu, nguồn chưa kiểm chứng.',tinh_trang_sach:'Bìa rách, thiếu hai trang.'};
  const merged=bookReviewDescription(legacy);
  assert(merged.includes(legacy.mo_ta_tinh_trang));assert(merged.includes(legacy.tinh_trang_sach));
  assert.equal(bookReviewDescription({tinh_trang_sach:'Chỉ có thông tin cũ'}),'Chỉ có thông tin cũ');
  assert.equal(bookReviewDescription({}),'');
  const boundary='x'.repeat(999)+'📚';
  assert.equal(conditionPreview(boundary),'x'.repeat(999));
});

test('display merge keeps raw provenance and detects a changed legacy observation',()=>{
  const row={tinh_trang_sach:'Thiếu trang 5',mo_ta_tinh_trang:'Bản in đầu',media:[]};
  const hash=inputHash(row);
  const raw={trang_thai:'chua_day_du',chi_tiet:[{tieu_chi:META_CRITERION,bang_chung:JSON.stringify({input_hash:hash,rule_version:RULE_VERSION})}]};
  bookReviewDescription(row);
  assert.equal(analysisInput(row).book.tinh_trang_sach,'Thiếu trang 5');
  assert.equal(analysisView(raw,row).loi_thoi,false);
  assert.equal(analysisView(raw,{...row,tinh_trang_sach:'Đủ trang'}).loi_thoi,true);
});
