import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { authRequired, createRateLimiter } from '../middleware/security.js';
import { validateUuidParam } from '../validation.js';
const router=Router();
router.param('id', validateUuidParam);
const reportLimit=createRateLimiter({name:'report-create',windowSeconds:3600,max:10,key:(req)=>req.auth?.userId||req.ip});
router.post('/',authRequired,reportLimit,async(req,res,next)=>{
 try{
  const parsed=z.object({listingId:z.string().uuid().optional(),reportedUserId:z.string().uuid().optional(),messageId:z.string().uuid().optional(),reason:z.string().trim().min(2).max(80),details:z.string().trim().max(1500).optional().default('')}).strict().safeParse(req.body);
  if(!parsed.success||[parsed.data?.listingId,parsed.data?.reportedUserId,parsed.data?.messageId].filter(Boolean).length!==1)return res.status(400).json({error:{code:'INVALID_REPORT',message:'گزارش معتبر نیست.'}});
  const x=parsed.data;
  if(x.messageId){const m=await pool.query(`SELECT m.id FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.id=$1 AND (c.buyer_id=$2 OR c.seller_id=$2)`,[x.messageId,req.auth.userId]);if(!m.rows[0])return res.status(404).json({error:{code:'NOT_FOUND',message:'پیام پیدا نشد.'}});}
  if(x.listingId){const l=await pool.query('SELECT id FROM listings WHERE id=$1',[x.listingId]);if(!l.rows[0])return res.status(404).json({error:{code:'NOT_FOUND',message:'آگهی پیدا نشد.'}});}
  if(x.reportedUserId===req.auth.userId)return res.status(400).json({error:{code:'INVALID_REPORT',message:'گزارش معتبر نیست.'}});
  if(x.reportedUserId){const u=await pool.query("SELECT id FROM users WHERE id=$1 AND deleted_at IS NULL",[x.reportedUserId]);if(!u.rows[0])return res.status(404).json({error:{code:'NOT_FOUND',message:'کاربر پیدا نشد.'}});}
  if(x.listingId){const owner=await pool.query('SELECT owner_id FROM listings WHERE id=$1',[x.listingId]);if(owner.rows[0]?.owner_id===req.auth.userId)return res.status(400).json({error:{code:'INVALID_REPORT',message:'نمی‌توانید آگهی خودتان را گزارش کنید.'}});}
  const {rows}=await pool.query('INSERT INTO reports(reporter_id,listing_id,reported_user_id,message_id,reason,details) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,status,created_at',[req.auth.userId,x.listingId||null,x.reportedUserId||null,x.messageId||null,x.reason,x.details]);
  res.status(201).json({report:rows[0]});
 }catch(error){next(error);}
});
export default router;
