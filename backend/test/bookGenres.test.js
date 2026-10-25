/** Danh mục thể loại: đủ nhóm từ tài liệu, tìm không dấu và chỉ chấp nhận lựa chọn có sẵn cho sách mới. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {BOOK_GENRES,searchBookGenres} from '../../shared/bookGenres.js';
import {validatePost} from '../src/services/postValidation.js';
test('thể loại không trùng, vừa cột 100 ký tự, tìm không dấu và có nhóm tư liệu/độc giả',()=>{
  assert.equal(new Set(BOOK_GENRES).size,BOOK_GENRES.length);assert(BOOK_GENRES.every(x=>x.length<=100));
  for(const value of ['Văn học cổ điển','Khoa học viễn tưởng','Tiểu thuyết lịch sử','Tiểu sử và hồi ký','Hán Nôm và cổ văn','Sách thiếu nhi'])assert(BOOK_GENRES.includes(value));
  assert(searchBookGenres('  dien dai ').flatMap(x=>x.items).length===0);assert(searchBookGenres('co dien').flatMap(x=>x.items).includes('Văn học cổ điển'));assert(searchBookGenres('ĐỊA CHÍ').flatMap(x=>x.items).includes('Địa chí và văn hóa'));
});
test('API chỉ nhận thể loại được chọn hoặc trống, không sửa sách cũ trong luồng đăng lại',()=>{
  const body=()=>({ma_yeu_cau:randomUUID(),sach:{ten_sach:'Fixture',tinh_trang_sach:'Fixture'},bai_dang:{tieu_de:'Fixture',mo_ta_tinh_trang:'Fixture'},phien:{gia_khoi_diem:'100000',gia_toi_thieu:'100000',buoc_gia:'1000'},media:[]});
  for(const genre of [...BOOK_GENRES,null,'']){const input=body();input.sach.the_loai=genre;assert.equal(validatePost(input).book.the_loai,genre||null);}
  const invalid=body();invalid.sach.the_loai='the loai tu go';assert.throws(()=>validatePost(invalid),/danh mục/);
  const relist=body();delete relist.sach;assert.equal(validatePost(relist,{mode:'relist'}).book,undefined);
});
