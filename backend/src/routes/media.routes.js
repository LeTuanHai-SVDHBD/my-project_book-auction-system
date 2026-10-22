/** Upload nhị phân từng tệp qua API sau xác thực/CSRF; không dùng multipart parser hay dependency mới. */
import express from 'express';
import { requireUser, requireCsrf, requireRole } from '../middlewares/auth.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { createMediaController } from '../controllers/media.controller.js';
export function createMediaRouter({ sessionMiddleware, users, config, provider, ledger }) {
  const router=express.Router(); let active=0;
  const controller=createMediaController({config,provider,ledger});
  router.get('/config',controller.config);
  router.use(sessionMiddleware,requireUser(users),requireRole('nguoi_dung'),requireCsrf);
  for (const kind of ['image','video']) {
    const limit=kind==='image'?config.imageMaxBytes:config.videoMaxBytes;
    const types=kind==='image'?['image/jpeg','image/png','image/webp']:['video/mp4','video/webm'];
    router.post(`/${kind}`,(req,res,next)=>{
      if (!config.configured) return next(new HttpError(503,'MEDIA_NOT_CONFIGURED','Chưa cấu hình Cloudinary trên API.'));
      if (!types.includes(req.get('content-type'))) return next(new HttpError(415,'UNSUPPORTED_MEDIA','Định dạng tệp không được hỗ trợ.'));
      if (active>=2) return next(new HttpError(429,'UPLOAD_BUSY','API đang tải tệp. Hãy thử lại sau.'));
      active++; let released=false;
      req.releaseUpload=()=>{if(!released){released=true;active--;}};
      // A disconnected client must not free the slot while its provider call still holds a buffer.
      res.once('close',()=>{if(!req.uploadProcessing)req.releaseUpload();});next();
    },express.raw({type:()=>true,limit,inflate:false}),controller.upload(kind));
  }
  router.delete('/:id',controller.discard);
  return router;
}
