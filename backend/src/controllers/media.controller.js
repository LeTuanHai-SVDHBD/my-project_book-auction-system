/** HTTP media: kiểm tra bytes, chuyển tệp cho provider và trả vé thuộc chủ sách. */
import {HttpError} from '../middlewares/errorHandler.js';
import {publicMediaConfig} from '../config/media.js';
import {verifyMedia} from '../services/cloudinary.service.js';
import {uuid} from '../services/postValidation.js';
export function createMediaController({config,provider,ledger}) {
  return {
    config:(req,res)=>res.json(publicMediaConfig(config)),
    upload:kind=>async(req,res)=>{
      req.uploadProcessing=true;
      try {
        if(res.destroyed||!Buffer.isBuffer(req.body)||!req.body.length)throw new HttpError(400,'EMPTY_MEDIA','Tệp trống hoặc kết nối đã đóng.');
        const actual=verifyMedia(req.body,undefined,kind);
        const ticket=await ledger.begin(req.user.nguoi_dung_id,kind);
        const result=await provider.upload({kind,publicId:ticket.publicId,bytes:req.body,mime:actual.mime});
        res.status(201).json(await ledger.ready(ticket,result.url));
      } finally {req.releaseUpload?.();}
    },
    discard:async(req,res)=>{await ledger.discard(req.user.nguoi_dung_id,uuid(req.params.id));res.sendStatus(204);},
  };
}
