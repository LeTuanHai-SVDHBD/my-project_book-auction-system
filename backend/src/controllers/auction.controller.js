/** HTTP đấu giá: danh sách trường công khai do model chọn, đầu vào không nhận người đặt/thời gian từ client. */
import {HttpError} from '../middlewares/errorHandler.js';
import {validateBidRequest} from '../services/bidPolicy.js';
import {parseAuctionId} from '../services/auction.service.js';
const requestId=value=>validateBidRequest({ma_yeu_cau:value,muc_gia:'1'}).requestId;
export function publicAuctionView(row) {
  const fields=['phien_dau_gia_id','bai_dang_id','trang_thai','thoi_gian_bat_dau','thoi_gian_ket_thuc','thoi_gian_cho_dat_lai','gia_khoi_diem','gia_hien_tai','buoc_gia','server_time'];
  const view=Object.fromEntries(fields.filter(key=>key in row).map(key=>[key,row[key]]));
  view.ket_qua=row.ket_qua?Object.fromEntries(['trang_thai','nguoi_thang_dau_id','muc_gia_thang','ly_do_ket_thuc','thoi_gian_ket_thuc'].map(key=>[key,row.ket_qua[key]])):null;
  return view;
}
export function createAuctionController({model,service}) {
  return {
    async detail(req,res) {
      const row=await model.publicAuction(parseAuctionId(req.params.id));
      if(!row)throw new HttpError(404,'AUCTION_NOT_FOUND','Không tìm thấy phiên đã được công bố.');
      res.json(publicAuctionView(row));
    },
    async submit(req,res) {
      const result=await service.submit({auctionId:parseAuctionId(req.params.id),userId:req.user.nguoi_dung_id,...validateBidRequest(req.body)});
      res.status(result.status).json(result.body);
    },
    async result(req,res) {
      res.json(await service.result(parseAuctionId(req.params.id),req.user.nguoi_dung_id,requestId(req.params.requestId)));
    }
  };
}
