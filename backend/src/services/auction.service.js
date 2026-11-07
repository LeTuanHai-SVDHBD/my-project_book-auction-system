/** Ranh giới nhận giá: 202 là queued; kết quả cuối luôn đọc SQL trước Redis admission. */
import {HttpError} from '../middlewares/errorHandler.js';
import {assertSameBid,decisionView} from '../models/auction.model.js';
export function parseAuctionId(value) {
  if(!/^[1-9]\d{0,9}$/.test(String(value))||Number(value)>2147483647)throw new HttpError(400,'INVALID_AUCTION_ID','Mã phiên không hợp lệ.');
  return Number(value);
}
export function createAuctionService({model,publisher}) {
  const notFound=()=>{throw new HttpError(404,'BID_REQUEST_NOT_FOUND','Không tìm thấy yêu cầu đặt giá của bạn.');};
  const queued=event=>({ma_yeu_cau:event.requestId,phien_dau_gia_id:event.auctionId,muc_gia:event.amount,trang_thai:'dang_cho_xu_ly',ly_do:null,thoi_gian_xu_ly:null});
  const checkFailure=event=>{if(event.failure)throw new HttpError(410,'BID_REQUEST_UNPROCESSABLE','Yêu cầu không thể tiếp tục xử lý. Liên hệ quản trị viên với mã yêu cầu.');};
  return {
    async submit(input) {
      const prior=await model.findRequest(input.requestId);assertSameBid(prior,input);
      if(prior)return {status:200,body:decisionView(prior)};
      if(!await model.publicAuction(input.auctionId))throw new HttpError(404,'AUCTION_NOT_FOUND','Không tìm thấy phiên đã được công bố.');
      const pending=await publisher.bid(input);
      checkFailure(pending);
      return {status:202,body:queued(pending)};
    },
    async result(auctionId,userId,requestId) {
      const row=await model.findRequest(requestId);
      if(row){if(row.phien_dau_gia_id!==auctionId||row.nguoi_dung_id!==userId)notFound();return decisionView(row);}
      const pending=await publisher.pending(requestId);
      if(!pending||pending.auctionId!==auctionId||pending.userId!==userId)notFound();
      checkFailure(pending);
      return queued(pending);
    }
  };
}
