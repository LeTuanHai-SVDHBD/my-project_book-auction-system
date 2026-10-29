/** Nghiệm thu HTTP/SQL sau phiên trên fixture của smoke đấu giá; không gọi Cloudinary cho bằng chứng ảnh. */
import assert from 'node:assert/strict';
export async function runAfterSalesChecks({createAuction,submit,moneyInput,seller,buyer,other,admin,check,progress,pool,sql}){
  progress('bình luận trong phiên và khóa sau kết thúc');const auctionId=await createAuction({threshold:'100000'}),base='/community';
  check(await buyer.call(`${base}/auctions/${auctionId}/comments`,'POST',{noi_dung:'Bình luận smoke sau phiên'}),201);
  await submit(buyer,auctionId,moneyInput());check(await buyer.call(`${base}/auctions/${auctionId}/comments`,'POST',{noi_dung:'Hết giờ'}),409);
  const trades=check(await buyer.call(base+'/trades'),200).items,trade=trades.find(x=>x.phien_dau_gia_id===auctionId);assert(trade,'Thiếu giao dịch liên kết kết quả.');const id=trade.giao_dich_id,path=`${base}/trades/${id}`;
  assert(!JSON.stringify(trade).includes('gia_toi_thieu'));assert.equal(trade.so_tien,'100000');assert.equal(check(await buyer.call(path),200).cuoc_tro_chuyen.trang_thai,'dang_mo');
  progress('phòng riêng đúng hai bên và cờ đã đọc');check(await other.call(path),404);check(await admin.call(path+'/messages'),403);check(await buyer.call(path+'/messages','POST',{noi_dung:'Tin riêng'},false),403);
  const sent=check(await buyer.call(path+'/messages','POST',{noi_dung:'Tin riêng smoke, chỉ hai bên'}),201);check(await buyer.call(path+'/read','POST',{through:sent.tin_nhan_id}),200);assert.equal(check(await buyer.call(path+'/messages'),200).items[0].da_doc,false);
  check(await seller.call(path+'/read','POST',{through:sent.tin_nhan_id}),200);assert.equal(check(await buyer.call(path+'/messages'),200).items[0].da_doc,true);
  const rooms=await Promise.all([buyer.call(path+'/conversation','POST',{}),seller.call(path+'/conversation','POST',{})]);assert.equal(check(rooms[0],200).cuoc_tro_chuyen_id,check(rooms[1],200).cuoc_tro_chuyen_id);
  progress('hai xác nhận độc lập và đánh giá một lần');check(await buyer.call(path+'/review','POST',{so_sao:5}),403);const first=check(await buyer.call(path+'/confirm','POST',{}),200);assert.equal(first.trang_thai,'cho_xac_nhan');assert.equal(first.thoi_gian_xac_nhan_ban,null);assert.equal(check(await buyer.call(path+'/confirm','POST',{}),200).thoi_gian_xac_nhan_mua,first.thoi_gian_xac_nhan_mua);
  assert.equal(check(await seller.call(path+'/confirm','POST',{}),200).trang_thai,'hoan_tat');check(await seller.call(path+'/review','POST',{so_sao:5}),403);const review={so_sao:5,noi_dung:'Nhận xét fixture smoke'};const rating=check(await buyer.call(path+'/review','POST',review),200);assert.equal(check(await buyer.call(path+'/review','POST',review),200).danh_gia_id,rating.danh_gia_id);check(await buyer.call(path+'/review','POST',{so_sao:1}),409);
  assert.equal(check(await other.call(`${base}/auctions/${auctionId}/reputation`),200).so_danh_gia,1);
  progress('khiếu nại, phân công Admin và giới hạn xem chat');const complaint=check(await buyer.call(path+'/complaints','POST',{ly_do:'Fixture đối chiếu',noi_dung:'Chỉ kiểm thử quyền và xử lý',media:[]}),201),casePath=`${base}/complaints/${complaint.khieu_nai_id}`;
  check(await other.call(casePath),404);check(await seller.call(casePath),404);check(await admin.call(casePath+'/messages'),403);check(await admin.call(casePath+'/claim','POST',{}),200);assert.equal(check(await admin.call(casePath+'/messages'),200).items[0].noi_dung,'Tin riêng smoke, chỉ hai bên');
  check(await admin.call(casePath+'/resolve','POST',{phan_hoi_admin:'Đã đối chiếu dữ liệu fixture.'}),200);check(await admin.call(casePath+'/messages'),409);assert.equal(check(await buyer.call(casePath),200).trang_thai,'da_xu_ly');assert.equal(check(await buyer.call(path),200).trang_thai,'hoan_tat');
  progress('tìm kiếm công khai và hộp thông báo lưu SQL');
  const found=check(await other.call('/posts/catalog?'+new URLSearchParams({q:trade.ten_sach,phase:'ended',sort:'newest',page:'1'})),200);
  assert(found.items.some(row=>row.bai_dang_id===trade.bai_dang_id));assert(!JSON.stringify(found).includes('gia_toi_thieu'));
  const inbox=check(await seller.call('/notifications'),200),notice=inbox.items.find(row=>row.loai==='trades'&&row.doi_tuong_id===id&&row.tieu_de==='Tin nhắn giao dịch mới');assert(notice,'Thiếu thông báo tin nhắn đã COMMIT.');
  assert(!JSON.stringify(inbox).includes('Tin riêng smoke, chỉ hai bên'));check(await buyer.call(`/notifications/${notice.thong_bao_id}/read`,'POST',{}),404);
  check(await seller.call(`/notifications/${notice.thong_bao_id}/read`,'POST',{},false),403);check(await seller.call(`/notifications/${notice.thong_bao_id}/read`,'POST',{}),200);
  const again=check(await seller.call('/notifications'),200);assert.equal(again.items.filter(row=>row.thong_bao_id===notice.thong_bao_id).length,1);assert(again.items.find(row=>row.thong_bao_id===notice.thong_bao_id).ngay_doc);
  const nextInbox=check(await seller.call('/notifications'),200);assert.deepEqual(nextInbox.items.map(row=>row.thong_bao_id),again.items.map(row=>row.thong_bao_id));
  assert(check(await buyer.call('/notifications'),200).items.some(row=>row.loai==='complaints'&&row.doi_tuong_id===complaint.khieu_nai_id&&row.tieu_de==='Khiếu nại đã có phản hồi'));
  const count=(await pool.request().input('id',sql.Int,id).query(`SELECT (SELECT COUNT(*) FROM dbo.CuocTroChuyen WHERE giao_dich_id=@id) AS chats,(SELECT COUNT(*) FROM dbo.DanhGia WHERE giao_dich_id=@id) AS ratings`)).recordset[0];assert.equal(count.chats,1);assert.equal(count.ratings,1);
  console.log('PASS tìm kiếm và thông báo: dữ liệu công khai không lộ ngưỡng; hộp riêng, CSRF, đọc bền, không nhân đôi và phản hồi khiếu nại.');
  console.log('PASS sau phiên: liên kết kết quả/giao dịch, chat riêng, đọc, xác nhận hai bên, đánh giá, khiếu nại/Admin và bình luận. Ảnh bằng chứng Cloudinary cần nghiệm thu riêng.');
}
