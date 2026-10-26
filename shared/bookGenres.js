/** Danh mục theo TheLoaiSach.docx; bổ sung nhóm tư liệu/sách cổ, dùng chung giao diện và kiểm tra bài mới. */
export const BOOK_GENRE_GROUPS = [
  {name:'Văn học và hư cấu',items:['Văn học cổ điển','Văn học đương đại','Kịch nghệ','Thơ ca','Kỳ ảo','Khoa học viễn tưởng','Tận thế và hậu tận thế','Trinh thám','Giật gân và ly kỳ','Kinh dị','Lãng mạn','Đời thường','Tiểu thuyết lịch sử','Manga','Manhua','Manhwa','Tiểu thuyết đồ họa','Truyện ngắn và tản văn','Văn học dân gian']},
  {name:'Kiến thức và phi hư cấu',items:['Phát triển bản thân','Tâm lý học','Tiểu sử và hồi ký','Lịch sử','Quản trị và lãnh đạo','Tài chính cá nhân và đầu tư','Marketing và bán hàng','Kinh tế và khởi nghiệp','Khoa học phổ thông','Công nghệ thông tin','Sách giáo khoa và giáo trình','Ẩm thực','Du lịch và khám phá','Nghệ thuật và nhiếp ảnh','Sức khỏe và thể hình','Triết học','Tôn giáo và tâm linh','Ngoại ngữ và ngôn ngữ học','Từ điển và bách khoa','Chính trị và pháp luật','Nông nghiệp và môi trường']},
  {name:'Tư liệu và sách cổ',items:['Hán Nôm và cổ văn','Địa chí và văn hóa','Khảo cổ và di sản','Bản đồ và địa lý','Báo chí và tạp chí','Thư mục và nghiên cứu sách']},
  {name:'Đối tượng độc giả',items:['Sách thiếu nhi','Tuổi mới lớn (8–12 tuổi)','Thanh thiếu niên (12–18 tuổi)','Sách dành cho người lớn']}
];
export const BOOK_GENRES=BOOK_GENRE_GROUPS.flatMap(group=>group.items);
export const normalizeGenreSearch=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().trim();
export function searchBookGenres(query){const key=normalizeGenreSearch(query);return BOOK_GENRE_GROUPS.map(group=>({...group,items:group.items.filter(value=>normalizeGenreSearch(value).includes(key))})).filter(group=>group.items.length);}
