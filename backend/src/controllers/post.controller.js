/** HTTP bài đăng: đầu vào hợp đồng chặt chẽ, dữ liệu công khai dùng danh sách trường cho phép. */
import {moderationQuery,moderationPage} from '../services/moderationList.js';
import {catalogSearch} from '../services/catalogSearch.js';
import { id, validatePost, validateReview, validateActivation } from '../services/postValidation.js';
const publicFields=['bai_dang_id','sach_id','ma_san_pham','tieu_de','mo_ta_tinh_trang','ten_sach','tac_gia','the_loai','nha_xuat_ban','nam_xuat_ban','isbn','tinh_trang_sach','mo_ta','phien_dau_gia_id','trang_thai_phien','thoi_gian_bat_dau','thoi_gian_ket_thuc','gia_khoi_diem','gia_hien_tai','buoc_gia','thoi_gian_cho_dat_lai','media','anh_bia'];
export function publicPost(row) { return Object.fromEntries(publicFields.filter(key=>key in row).map(key=>[key,row[key]])); }
export function createPostController({model,service,limits}) {
  const options=req=>({owner:req.user.nguoi_dung_id,admin:req.user.vai_tro==='admin'});
  const page=req=>req.query.before===undefined?2147483647:id(req.query.before);
  const listResponse=(res,items)=>res.json({items,nextBefore:items.length===30?items.at(-1).bai_dang_id:null});
  return {
    catalog:async(req,res)=>{if(Object.keys(req.query).some(key=>key!=='before')){const result=await model.search(catalogSearch(req.query));return res.json({...result,items:result.items.map(publicPost)});}return listResponse(res,(await model.list({publicOnly:true,after:page(req)})).map(publicPost));},
    publicDetail:async(req,res)=>res.json(publicPost(await model.detail(id(req.params.id),{publicOnly:true}))),
    mine:async(req,res)=>listResponse(res,await model.list({owner:req.user.nguoi_dung_id,after:page(req)})),
    pending:async(req,res)=>res.json(moderationPage(await model.list(moderationQuery(req.query)))),
    detail:async(req,res)=>res.json(await model.detail(id(req.params.id),options(req))),
    exportReview:async(req,res)=>res.json(await model.exportReview(req.user.nguoi_dung_id,id(req.params.id),id(req.params.reviewId))),
    create:async(req,res)=>{ const result=await service.create(req.user.nguoi_dung_id,validatePost(req.body,limits));res.status(result.replayed?200:201).json(result); },
    relist:async(req,res)=>{const result=await service.create(req.user.nguoi_dung_id,validatePost(req.body,{...limits,mode:'relist'}),id(req.params.id));res.status(result.replayed?200:201).json(result);},
    resubmit:async(req,res)=>res.json(await service.resubmit(req.user.nguoi_dung_id,id(req.params.id),validatePost(req.body,{...limits,mode:'resubmit'}))),
    review:async(req,res)=>res.json(await service.review(req.user.nguoi_dung_id,id(req.params.id),validateReview(req.body))),
    activate:async(req,res)=>res.json(await service.activate(req.user.nguoi_dung_id,id(req.params.id),validateActivation(req.body))),
  };
}
