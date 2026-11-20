/** Tìm thể loại có hoặc không dấu trong danh mục chung. */
import {searchBookGenres} from '../../../shared/bookGenres.js';
import SearchSelect from './SearchSelect.jsx';

export default function GenreSelect(props){
  return <SearchSelect {...props} name="the_loai" label="Thể loại" placeholder="Tìm hoặc chọn thể loại"
    listLabel="Danh sách thể loại" noResults="Không tìm thấy thể loại. Thử từ khóa khác."
    invalidMessage="Hãy chọn một thể loại trong danh sách hoặc xóa ô tìm kiếm."
    hint="Gõ để tìm, rồi chọn trong danh sách. Có thể để trống." search={searchBookGenres}/>;
}
