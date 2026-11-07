/** Bình luận/uy tín công khai; giao dịch riêng hai bên và chat Admin chỉ qua khiếu nại được phân công. */
import {Router} from 'express';
import {requireUser,requireRole,requireCsrf} from '../middlewares/auth.js';
import {createCommunityController} from '../controllers/community.controller.js';
export function createCommunityRouter({sessionMiddleware,users,model,service}){
  const router=Router(),c=createCommunityController({model,service});
  router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
  router.get('/auctions/:id/comments',c.comments);router.get('/auctions/:id/reputation',c.reputation);
  router.use(sessionMiddleware,requireUser(users));
  router.post('/auctions/:id/comments',requireRole('nguoi_dung'),requireCsrf,c.comment);
  router.get('/trades',requireRole('nguoi_dung'),c.trades);router.get('/trades/:id',requireRole('nguoi_dung'),c.trade);
  router.get('/trades/:id/messages',requireRole('nguoi_dung'),c.messages);
  for(const [path,handler]of [['conversation',c.chat],['messages',c.send],['read',c.read],['confirm',c.confirm],['review',c.rate],['complaints',c.complain]])router.post(`/trades/:id/${path}`,requireRole('nguoi_dung'),requireCsrf,handler);
  router.get('/complaints',c.complaints);router.get('/complaints/:id',c.complaint);
  router.get('/complaints/:id/messages',requireRole('admin'),c.complaintMessages);
  router.post('/complaints/:id/claim',requireRole('admin'),requireCsrf,c.claim);
  router.post('/complaints/:id/resolve',requireRole('admin'),requireCsrf,c.resolve);
  return router;
}
