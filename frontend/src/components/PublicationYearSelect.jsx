/** Ưu tiên năm gần đây khi mở; tìm được cả các năm cũ trong phạm vi API chấp nhận. */
import SearchSelect from './SearchSelect.jsx';

const years=Array.from({length:9999},(_,index)=>String(9999-index));
const currentYearIndex=9999-new Date().getFullYear();
const recentYears=years.slice(currentYearIndex,currentYearIndex+40);
function searchYears(query){
  const prefix=query.trim();
  if(!prefix)return [{items:recentYears}];
  const exact=/^[1-9][0-9]{0,3}$/.test(prefix)?[prefix]:[];
  const items=years.filter(year=>year!==prefix&&year.startsWith(prefix)).slice(0,40-exact.length);
  return [{items:[...exact,...items]}];
}

export default function PublicationYearSelect({initialValue,onValueChange}){
  return <SearchSelect name="nam_xuat_ban" label="Năm xuất bản" initialValue={String(initialValue??'')}
    placeholder="Tìm hoặc chọn năm" listLabel="Danh sách năm xuất bản" noResults="Không tìm thấy năm xuất bản."
    invalidMessage="Hãy chọn một năm trong danh sách hoặc xóa ô tìm kiếm."
    hint="Gõ năm để tìm, rồi chọn trong danh sách. Có thể để trống."
    search={searchYears} inputMode="numeric" onValueChange={onValueChange}/>;
}
