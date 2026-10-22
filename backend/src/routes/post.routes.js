/** Ranh giới công khai, chủ sách và Admin của Mốc 4. */
import { Router } from 'express';
import { requireUser,requireRole,requireCsrf } from '../middlewares/auth.js';
import { createPostController } from '../controllers/post.controller.js';
export function createPostRouter({sessionMiddleware,users,model,service,limits}) {
  const router=Router(); const c=createPostController({model,service,limits});
  router.get('/catalog',c.catalog); router.get('/catalog/:id',c.publicDetail);
  router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();},sessionMiddleware,requireUser(users));
  router.get('/mine',requireRole('nguoi_dung'),c.mine);
  router.get('/pending',requireRole('admin'),c.pending);
  router.get('/:id',c.detail);
  router.post('/',requireRole('nguoi_dung'),requireCsrf,c.create);
  router.post('/:id/relist',requireRole('nguoi_dung'),requireCsrf,c.relist);
  router.post('/:id/resubmit',requireRole('nguoi_dung'),requireCsrf,c.resubmit);
  router.post('/:id/activate',requireRole('nguoi_dung'),requireCsrf,c.activate);
  router.post('/:id/review',requireRole('admin'),requireCsrf,c.review);
  return router;
}
