/** Hợp đồng HTTP sau phiên; người thực hiện từ session, không nhận người bán/mua, trạng thái hoặc URL tự chèn. */
import {id,object} from '../services/postValidation.js';
import {validateText,validateRating,validateComplaint,text} from '../services/communityPolicy.js';
export function createCommunityController({model,service}){
  const before=req=>req.query.before===undefined?2147483647:id(req.query.before),key=req=>id(req.params.id),user=req=>req.user;
  return {
    trades:async(req,res)=>res.json(await model.listTrades(user(req),before(req))),
    trade:async(req,res)=>res.json(await model.detail(key(req),user(req))),
    chat:async(req,res)=>{object(req.body,[],'Mở trò chuyện');const room=await model.ensureChat(key(req),user(req));res.json({cuoc_tro_chuyen_id:room.cuoc_tro_chuyen_id,trang_thai:room.trang_thai});},
    messages:async(req,res)=>res.json(await model.messages(key(req),user(req),before(req))),
    send:async(req,res)=>res.status(201).json(await model.send(key(req),user(req),validateText(req.body,4000))),
    read:async(req,res)=>{object(req.body,['through'],'Đánh dấu đã đọc');res.json(await model.read(key(req),user(req),id(req.body.through)));},
    confirm:async(req,res)=>{object(req.body,[],'Xác nhận');res.json(await model.confirm(key(req),user(req)));},
    rate:async(req,res)=>res.json(await model.rate(key(req),user(req),validateRating(req.body))),
    complain:async(req,res)=>res.status(201).json(await service.complain(key(req),user(req),validateComplaint(req.body))),
    complaints:async(req,res)=>res.json(await model.listComplaints(user(req),before(req))),
    complaint:async(req,res)=>res.json(await model.complaintDetail(key(req),user(req))),
    claim:async(req,res)=>{object(req.body,[],'Tiếp nhận');res.json(await model.claim(key(req),user(req)));},
    resolve:async(req,res)=>{object(req.body,['phan_hoi_admin'],'Kết quả xử lý');res.json(await model.resolve(key(req),user(req),text(req.body.phan_hoi_admin,8000)));},
    complaintMessages:async(req,res)=>res.json(await model.complaintMessages(key(req),user(req),before(req))),
    comments:async(req,res)=>res.json(await model.comments(key(req),before(req))),
    comment:async(req,res)=>res.status(201).json(await model.comment(key(req),user(req),validateText(req.body,2000))),
    reputation:async(req,res)=>res.json(await model.reputation(key(req),before(req)))
  };
}
