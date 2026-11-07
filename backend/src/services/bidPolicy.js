/** Quy tắc thuần cho worker: tiền BigInt và thời điểm SQL đọc sau khi khóa; không tự ghi dữ liệu. */
import {HttpError} from '../middlewares/errorHandler.js';

const moneyPattern=/^[1-9]\d{0,17}$/;
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateBidRequest(body) {
  if(!body||typeof body!=='object'||Array.isArray(body)||
    Object.keys(body).some(key=>!['ma_yeu_cau','muc_gia'].includes(key))||
    typeof body.ma_yeu_cau!=='string'||!uuidPattern.test(body.ma_yeu_cau)||
    typeof body.muc_gia!=='string'||!moneyPattern.test(body.muc_gia)) {
    throw new HttpError(400,'INVALID_BID_INPUT','Cần UUID v4 và mức giá nguyên VND dạng chuỗi, tối đa 18 chữ số.');
  }
  return {requestId:body.ma_yeu_cau.toLowerCase(),amount:body.muc_gia};
}

function money(value) {
  if(typeof value!=='string'||!moneyPattern.test(value))throw new TypeError('Giá nội bộ phải là chuỗi nguyên dương tối đa 18 chữ số.');
  return BigInt(value);
}
function timestamp(value) {
  if(!(value instanceof Date)||!Number.isFinite(value.getTime()))throw new TypeError('Cần thời điểm Date từ đồng hồ SQL.');
  return value.getTime();
}
function userId(value) {
  if(!Number.isInteger(value)||value<1||value>2147483647)throw new TypeError('Mã người dùng nội bộ không hợp lệ.');
  return value;
}
function auctionRules(auction) {
  const startPrice=money(auction.gia_khoi_diem),step=money(auction.buoc_gia),threshold=money(auction.gia_toi_thieu);
  const current=auction.gia_hien_tai===null?null:money(auction.gia_hien_tai);
  if(threshold<startPrice||(current!==null&&(current<startPrice||(current-startPrice)%step!==0n)))throw new Error('Dữ liệu giá phiên không nhất quán.');
  const cooldown=auction.thoi_gian_cho_dat_lai;
  if(!Number.isInteger(cooldown)||cooldown<10||cooldown>30)throw new Error('Cooldown phiên không hợp lệ.');
  userId(auction.nguoi_ban_id);
  return {startPrice,step,threshold,current,cooldown};
}
function schedule(auction) {
  const start=timestamp(auction.thoi_gian_bat_dau),end=timestamp(auction.thoi_gian_ket_thuc);
  if(end<=start)throw new Error('Lịch phiên không nhất quán.');
  return {start,end};
}
const rejected=(code,extra={})=>({accepted:false,code,...extra});

// auction, lastBidAt và now phải được model đọc lại trong cùng transaction đã khóa phiên.
export function evaluateBid({auction,bidderId,amount,now,lastBidAt=null}) {
  const price=money(amount),checkedAt=timestamp(now);userId(bidderId);
  const {startPrice,step,threshold,current,cooldown}=auctionRules(auction);
  if(auction.trang_thai!=='da_kich_hoat')return rejected('AUCTION_NOT_ACTIVE');
  const {start,end}=schedule(auction);
  if(checkedAt<start)return rejected('AUCTION_NOT_STARTED');
  if(checkedAt>=end)return rejected('AUCTION_EXPIRED',{closeExpired:true});
  if(bidderId===auction.nguoi_ban_id)return rejected('SELLER_CANNOT_BID');
  if(current!==null&&current>=threshold)throw new Error('Phiên đã đạt ngưỡng nhưng chưa kết thúc.');
  if(lastBidAt!==null) {
    const previous=timestamp(lastBidAt);
    if(previous>checkedAt)throw new Error('Lượt trước nằm sau đồng hồ xử lý.');
    const retryAfterMs=cooldown*1000-(checkedAt-previous);
    if(retryAfterMs>0)return rejected('BID_COOLDOWN',{retryAfterMs});
  }
  const base=current??startPrice;
  if(price<base||(current!==null&&price===base))return rejected('BID_TOO_LOW');
  if((price-base)%step!==0n)return rejected('INVALID_BID_STEP');
  return {accepted:true,amount,endsEarly:price>=threshold,checkedAt:new Date(checkedAt)};
}

// topBid là lượt hợp lệ cao nhất đọc từ SQL; không dùng giá hoặc người thắng do client cung cấp.
export function deriveEndResult({auction,topBid,now,reason}) {
  const checkedAt=timestamp(now),{current,threshold}=auctionRules(auction);
  if(auction.trang_thai!=='da_kich_hoat')return null;
  const {start,end}=schedule(auction);
  if(!['het_thoi_gian','dat_gia_toi_thieu'].includes(reason))throw new Error('Chỉ có hai lý do kết thúc phiên.');
  if((current===null)!==(topBid===null))throw new Error('Giá hiện tại và lượt cao nhất không nhất quán.');
  if(topBid!==null) {
    if(money(topBid.muc_gia)!==current)throw new Error('Lượt cao nhất không khớp giá hiện tại.');
    if(userId(topBid.nguoi_dung_id)===auction.nguoi_ban_id)throw new Error('Người bán không thể là người thắng.');
  }
  if(reason==='het_thoi_gian'&&checkedAt<end)return null;
  if(reason==='dat_gia_toi_thieu'&&(checkedAt<start||checkedAt>=end||current===null||current<threshold))return null;
  return {trang_thai:topBid===null?'khong_co_nguoi_thang':'co_nguoi_thang',
    nguoi_thang_dau_id:topBid?.nguoi_dung_id??null,muc_gia_thang:topBid?.muc_gia??null,
    ly_do_ket_thuc:reason,thoi_gian_ket_thuc:new Date(checkedAt)};
}
