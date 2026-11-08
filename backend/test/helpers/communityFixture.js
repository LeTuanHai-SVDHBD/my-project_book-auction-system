/** Model trong bộ kiểm thử HTTP/trình duyệt; tái dùng policy thật, không mô phỏng transaction SQL Server. */
import {randomUUID} from 'node:crypto';
import {HttpError} from '../../src/middlewares/errorHandler.js';
import {participant,assertTrade,assertConversation,assertReview,assertComment,complaintReader,assertComplaintResponse,responsePending,assignedAdmin,missing,conflict,tradeView} from '../../src/services/communityPolicy.js';
export function communityFixture(){
  const users=[1,2,3,4,5].map(id=>({nguoi_dung_id:id,ho_ten:['Người bán QA','Người mua QA','Người ngoài QA','Admin QA','Admin khác QA'][id-1],email:`m8-${id}@example.test`,vai_tro:id>=4?'admin':'nguoi_dung'}));
  const now=()=>new Date().toISOString(),trade={giao_dich_id:1,ma_giao_dich:'GD-QA',ket_qua_id:6,phien_dau_gia_id:8,bai_dang_id:9,sach_id:7,ten_sach:'Bản sách nghiệm thu',tieu_de:'Bản sách nghiệm thu',nguoi_mua_id:2,nguoi_ban_id:1,ten_nguoi_mua:users[1].ho_ten,ten_nguoi_ban:users[0].ho_ten,so_tien:'999999999999999999',gia_thang:'999999999999999999',nguoi_thang_dau_id:2,chu_bai_id:1,ket_qua_trang_thai:'co_nguoi_thang',trang_thai_phien:'da_ket_thuc',trang_thai:'cho_xac_nhan',ngay_tao:now(),ngay_hoan_tat:null,thoi_gian_xac_nhan_mua:null,thoi_gian_xac_nhan_ban:null};
  let room={cuoc_tro_chuyen_id:10,giao_dich_id:1,nguoi_mua_id:2,nguoi_ban_id:1,trang_thai:'dang_mo'},rating=null;
  const messages=[],complaints=[],comments=[],evidence=new Map(),auction={phien_dau_gia_id:8,trang_thai:'da_kich_hoat',thoi_gian_bat_dau:new Date(Date.now()-60000).toISOString(),thoi_gian_ket_thuc:new Date(Date.now()+3600000).toISOString()};
  const access=(id,user)=>{if(id!==1)missing();participant(trade,user);assertTrade(trade);};
  const caseAccess=(id,user)=>{const c=complaints.find(x=>x.khieu_nai_id===id);complaintReader(c,user,trade);return c;};
  const paged=(items,key,before,size=30)=>{const rows=items.filter(x=>x[key]<before).sort((a,b)=>b[key]-a[key]).slice(0,size);return {items:structuredClone(rows),nextBefore:rows.length===size?rows.at(-1)[key]:null};};
  const visible=(x,user)=>{try{complaintReader(x,user,trade);return true;}catch{return false;}};
  const canReply=(x,user)=>user.vai_tro==='nguoi_dung'&&x.nguoi_khieu_nai_id!==user.nguoi_dung_id&&responsePending(x,now());
  const publicCase=(x,user)=>{const {ghi_chu_noi_bo,...rest}=x;return {...rest,...(user.vai_tro==='admin'?{ghi_chu_noi_bo}:{}),can_toi_phan_hoi:canReply(x,user)};};
  const checkAuction=id=>{if(id!==8)missing();};
  const model={
    listTrades:async(user,before)=>{if(user.vai_tro!=='nguoi_dung')missing();return paged([trade].filter(x=>[x.nguoi_mua_id,x.nguoi_ban_id].includes(user.nguoi_dung_id)).map(tradeView),'giao_dich_id',before);},
    detail:async(id,user)=>{access(id,user);return {...structuredClone(tradeView(trade)),cuoc_tro_chuyen:structuredClone(room),danh_gia:structuredClone(rating),khieu_nai:complaints.filter(x=>visible(x,user)).map(x=>publicCase(x,user)),co_khieu_nai_dang_mo:complaints.some(x=>x.trang_thai!=='da_xu_ly')};},
    ensureChat:async(id,user)=>{access(id,user);room||={cuoc_tro_chuyen_id:10,giao_dich_id:1,nguoi_mua_id:2,nguoi_ban_id:1,trang_thai:'dang_mo'};assertConversation(room,trade);return room;},
    messages:async(id,user,before)=>{access(id,user);assertConversation(room,trade);return paged(messages,'tin_nhan_id',before,50);},
    send:async(id,user,content)=>{access(id,user);assertConversation(room,trade);if(room.trang_thai!=='dang_mo')conflict('Cuộc trò chuyện đã đóng.');const row={tin_nhan_id:messages.length+1,nguoi_gui_id:user.nguoi_dung_id,ho_ten:user.ho_ten,noi_dung:content,thoi_gian_gui:now(),da_doc:false};messages.push(row);return {tin_nhan_id:row.tin_nhan_id};},
    read:async(id,user,through)=>{access(id,user);for(const m of messages)if(m.nguoi_gui_id!==user.nguoi_dung_id&&m.tin_nhan_id<=through)m.da_doc=true;return {ok:true};},
    confirm:async(id,user)=>{access(id,user);const key=user.nguoi_dung_id===2?'thoi_gian_xac_nhan_mua':'thoi_gian_xac_nhan_ban';trade[key]||=now();if(trade.thoi_gian_xac_nhan_mua&&trade.thoi_gian_xac_nhan_ban){trade.trang_thai='hoan_tat';trade.ngay_hoan_tat||=now();}return tradeView(trade);},
    rate:async(id,user,input)=>{access(id,user);assertReview(trade,user);if(rating){if(rating.so_sao!==input.stars||rating.noi_dung!==input.content)conflict('Đã đánh giá.');return {...rating,replayed:true};}rating={danh_gia_id:1,so_sao:input.stars,noi_dung:input.content,ngay_danh_gia:now()};return rating;},
    createComplaint:async(id,user,input,items)=>{access(id,user);if(complaints.some(x=>x.trang_thai!=='da_xu_ly'))conflict('Hồ sơ đang mở.');const row={khieu_nai_id:complaints.length+1,cuoc_tro_chuyen_id:10,giao_dich_id:1,nguoi_khieu_nai_id:user.nguoi_dung_id,ly_do:input.reason,noi_dung:input.content,trang_thai:'cho_xu_ly',admin_id:null,phan_hoi_admin:null,ngay_khieu_nai:now(),ngay_xu_ly:null,han_giai_trinh:new Date(Date.now()+72*3600000).toISOString(),bang_chung:items.map((x,i)=>({bang_chung_id:i+1,duong_dan_anh_khieu_nai:x.url,mo_ta_anh_khieu_nai:x.title,thu_tu:i+1}))};complaints.push(row);return {khieu_nai_id:row.khieu_nai_id};},
    listComplaints:async(user,before,scope='all')=>paged(complaints.filter(x=>visible(x,user)&&(scope==='all'||(scope==='mine'?x.nguoi_khieu_nai_id===user.nguoi_dung_id:canReply(x,user)))).map(x=>publicCase(x,user)),'khieu_nai_id',before),
    complaintDetail:async(id,user)=>({...publicCase(caseAccess(id,user),user),giao_dich:tradeView(trade)}),
    checkComplaintResponse:async(id,user)=>assertComplaintResponse(caseAccess(id,user),user,trade,now()),
    respondComplaint:async(id,user,input,items)=>{
      const c=caseAccess(id,user);assertComplaintResponse(c,user,trade,now());
      c.giai_trinh=input.content;c.ngay_giai_trinh=now();c.bang_chung_giai_trinh=items.map(x=>({duong_dan_anh_khieu_nai:x.url}));
      return {khieu_nai_id:id};
    },
    claim:async(id,user)=>{const c=caseAccess(id,user);if(c.admin_id&&c.admin_id!==user.nguoi_dung_id)conflict('Admin khác đang xử lý.');if(c.trang_thai==='cho_xu_ly'){c.admin_id=user.nguoi_dung_id;c.trang_thai='dang_xu_ly';}return {khieu_nai_id:id};},
    resolve:async(id,user,{reply,outcome,note})=>{
      const c=caseAccess(id,user);assignedAdmin(c,user);
      if(c.trang_thai!=='dang_xu_ly'||responsePending(c,now()))conflict('Chưa thể kết luận.');
      c.trang_thai='da_xu_ly';c.phan_hoi_admin=reply;c.ket_luan=outcome;c.ghi_chu_noi_bo=note;c.ngay_xu_ly=now();return {khieu_nai_id:id};
    },
    complaintMessages:async(id,user,before)=>{const c=caseAccess(id,user);assignedAdmin(c,user);if(c.trang_thai!=='dang_xu_ly')conflict('Chỉ xem khi đang xử lý.');return paged(messages,'tin_nhan_id',before,50);},
    comments:async(id,before)=>{checkAuction(id);let allowed=true;try{assertComment({...auction,server_time:now()});}catch{allowed=false;}return {...paged(comments,'binh_luan_id',before,50),duoc_binh_luan:allowed,server_time:now()};},
    comment:async(id,user,content)=>{checkAuction(id);assertComment({...auction,server_time:now()});const row={binh_luan_id:comments.length+1,nguoi_dung_id:user.nguoi_dung_id,ho_ten:user.ho_ten,noi_dung:content,thoi_gian_binh_luan:now()};comments.push(row);return {binh_luan_id:row.binh_luan_id};},
    reputation:async(id,before)=>{checkAuction(id);return {so_danh_gia:rating?1:0,trung_binh:rating?.so_sao??null,...paged(rating?[rating]:[],'danh_gia_id',before)};}
  };
  const ledger={claim:async(owner,requested)=>{const rows=requested.map(x=>{const ticket=evidence.get(x.upload_id);if(!ticket||ticket.owner!==owner||ticket.status!=='ready')throw new HttpError(409,'UPLOAD_NOT_AVAILABLE','Ảnh không thuộc bạn.');return {...ticket,title:x.tieu_de};});for(const row of rows)evidence.get(row.uploadId).status='claimed';return {token:'fixture',items:rows};},bound:async claim=>{for(const row of claim.items)evidence.get(row.uploadId).status='bound';},release:async claim=>{for(const row of claim.items)evidence.get(row.uploadId).status='ready';}};
  function image(owner,kind='image'){const uploadId=randomUUID();const ticket={uploadId,owner,kind,status:'ready',url:`https://res.cloudinary.com/demo/image/upload/bookauction/${owner}/${uploadId}.png`};evidence.set(uploadId,ticket);return {upload_id:uploadId,tieu_de:'Ảnh bằng chứng mẫu'};}
  return {users,model,ledger,image,trade,messages,complaints,comments,auction,evidence};
}
