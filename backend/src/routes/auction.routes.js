/** Đọc phiên công khai; gửi giá cần user/CSRF; kết quả yêu cầu chỉ chủ yêu cầu đọc được. */
import {Router} from 'express';
import {requireUser,requireRole,requireCsrf} from '../middlewares/auth.js';
import {createAuctionController} from '../controllers/auction.controller.js';
export function createAuctionRouter({sessionMiddleware,users,model,service}) {
  const router=Router(),c=createAuctionController({model,service});
  router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
  router.get('/:id',c.detail);
  router.get('/:id/history',c.history);
  router.use(sessionMiddleware,requireUser(users));
  router.get('/:id/bid-status',c.bidStatus);
  router.post('/:id/bids',requireRole('nguoi_dung'),requireCsrf,c.submit);
  router.get('/:id/requests/:requestId',c.result);
  return router;
}
