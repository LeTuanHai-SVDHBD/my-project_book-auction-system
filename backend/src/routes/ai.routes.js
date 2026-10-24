/** Chủ bài/Admin đọc phân tích; Admin và CSRF mới được yêu cầu phân tích lại. */
import {Router} from 'express';
import {requireUser,requireRole,requireCsrf} from '../middlewares/auth.js';
import {id,version,object} from '../services/postValidation.js';
export function createAiRouter({sessionMiddleware,users,service}){
  const router=Router();router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();},sessionMiddleware,requireUser(users));
  router.get('/:id',async(req,res)=>res.json(await service.status(id(req.params.id),req.user,req.query.analysis===undefined?null:id(req.query.analysis))));
  router.post('/:id',requireRole('admin'),requireCsrf,async(req,res)=>{object(req.body,['row_version'],'Yêu cầu AI');const job=await service.request(id(req.params.id),req.user,version(req.body.row_version));res.status(202).json({request_id:job.requestId,state:job.state});});
  return router;
}
