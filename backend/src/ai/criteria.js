/** Bộ tiêu chí theo báo cáo tuần 7; Gemini phân loại quan sát, Backend giữ trọng số và phép quy đổi. */
export const RULE_VERSION='book-review-2026-10-v1';
export const META_CRITERION='Thông tin lần phân tích';
export const STATUSES=Object.freeze({assessed:'Đã đánh giá',missing:'Chưa đủ dữ liệu',verify:'Cần xác minh',not_applicable:'Không áp dụng'});
export const CRITERIA=Object.freeze([
  {id:'limited_edition',group:'do_hiem',name:'Ấn bản giới hạn',weight:25,guide:'Thông tin giới hạn phát hành khớp đúng ấn bản; không suy ra số bản hiện còn toàn cầu.'},
  {id:'special_edition',group:'do_hiem',name:'Ấn bản đặc biệt và lịch sử xuất bản',weight:25,guide:'Đặc điểm bản in thử/ấn bản có ý nghĩa lịch sử có căn cứ; không coi mọi lần in đầu hoặc lỗi in là hiếm.'},
  {id:'historical_context',group:'do_hiem',name:'Niên đại và bối cảnh lịch sử',weight:25,guide:'Năm xuất bản đọc được và bối cảnh phù hợp; không suy từ vẻ cũ, không bắt buộc trước 1945.'},
  {id:'provenance',group:'do_hiem',name:'Lai lịch và dấu ấn riêng',weight:25,guide:'Dấu hiệu chữ ký/con dấu không chứng minh chữ ký thật hoặc danh tính; chưa xác minh thì cần xác minh.'},
  {id:'cover',group:'tinh_trang',name:'Bìa',weight:20,guide:'Nguyên vẹn; sờn nhẹ; rách nhỏ/bong cục bộ; rách lớn/mất một phần; xác định mất bìa.'},
  {id:'spine',group:'tinh_trang',name:'Gáy và liên kết',weight:25,guide:'Liên kết chắc; sờn nhẹ; lỏng cục bộ; bung đáng kể/tách một phần; cấu trúc bị phá hủy.'},
  {id:'pages',group:'tinh_trang',name:'Trang ruột',weight:30,guide:'Đủ căn cứ nguyên vẹn/đọc được; ngả màu nhẹ; bẩn/gấp/rách nhỏ; che/mất một phần nội dung; thiếu trang/không đọc được.'},
  {id:'edges',group:'tinh_trang',name:'Mép giấy',weight:15,guide:'Không hư hỏng; sờn/ngả nhẹ; hư cục bộ; hư lan rộng; mất đáng kể phần trang/nội dung.'},
  {id:'dust_jacket',group:'tinh_trang',name:'Bìa áo',weight:10,guide:'Nguyên vẹn; sờn/nếp nhẹ; rách nhỏ; rách lớn/mất một phần; xác định bị mất ở ấn bản vốn có bìa áo. Chỉ không áp dụng khi có căn cứ ấn bản vốn không có.'}
]);
export const CONDITION_POINTS=Object.freeze({intact:100,light:75,moderate:50,severe:25,destroyed:0});
