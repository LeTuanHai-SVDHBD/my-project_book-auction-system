/** Điều phối vé bằng chứng. Lỗi bind sau COMMIT không đảo kết quả đã lưu. */
import {HttpError} from '../middlewares/errorHandler.js';
export function createCommunityService({model,ledger,log=()=>{}}){
  async function withEvidence(user,input,save){
    const claim=await ledger.claim(user.nguoi_dung_id,input.media);
    try{
      if(claim.items.some(x=>x.kind!=='image'))throw Object.assign(new HttpError(400,'INVALID_EVIDENCE','Bằng chứng khiếu nại chỉ nhận ảnh.'),{sqlRolledBack:true});
      const saved=await save(claim.items);
      try{await ledger.bound(claim);}catch(error){log(error,{component:'complaint-media-bind'});}return saved;
    }catch(error){if(error.sqlRolledBack===true)try{await ledger.release(claim);}catch(failure){log(failure,{component:'complaint-media-release'});}throw error;}
  }
  return {
    async complain(id,user,input){
      await model.detail(id,user);
      return withEvidence(user,input,items=>model.createComplaint(id,user,input,items));
    },
    async respond(id,user,input){
      await model.checkComplaintResponse(id,user);
      return withEvidence(user,input,items=>model.respondComplaint(id,user,input,items));
    },
  };
}
