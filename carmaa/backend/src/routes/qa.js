import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from '../db.js';
import { authRequired, createRateLimiter } from '../middleware/security.js';
import { parsePositiveInt } from '../util.js';
import { validateUuidParam } from '../validation.js';
const router = Router();
router.param('id', validateUuidParam);
router.param('questionId', validateUuidParam);
router.param('answerId', validateUuidParam);
const writeLimit = createRateLimiter({ name: 'qa-write', windowSeconds: 60, max: 12, key: (req) => req.auth?.userId || req.ip });
const viewLimit = createRateLimiter({ name: 'qa-view', windowSeconds: 3600, max: 120 });
router.get('/questions', async (req, res, next) => {
  try {
    const page = parsePositiveInt(req.query.page,1,2_000), size = parsePositiveInt(req.query.page_size,20,50), off=(page-1)*size;
    const qText = typeof req.query.q === 'string' ? req.query.q.trim().slice(0,120) : '';
    const category = typeof req.query.category === 'string' && req.query.category !== 'all' ? req.query.category.slice(0,40) : '';
    const values = []; let where = "q.status='published' AND EXISTS (SELECT 1 FROM users au WHERE au.id=q.author_id AND au.status='active' AND au.deleted_at IS NULL)";
    if (qText) { values.push(`%${qText.replace(/[%_\\]/g, '\\$&')}%`); where += ` AND (q.title ILIKE $${values.length} OR q.body ILIKE $${values.length} OR COALESCE(q.brand,'') ILIKE $${values.length} OR COALESCE(q.model,'') ILIKE $${values.length})`; }
    if (category) { values.push(category); where += ` AND q.category=$${values.length}`; }
    const { rows } = await pool.query(
      `SELECT q.id,q.title,q.body,q.tags,q.category,q.brand,q.model,q.vehicle_year,q.view_count,q.image_id,i.public_url AS image_url,q.created_at,q.updated_at,u.id AS author_id,COALESCE(NULLIF(u.nickname,''),u.display_name) AS author_name,
       (SELECT count(*)::int FROM qa_answers a WHERE a.question_id=q.id AND a.status='published') AS answer_count
       FROM qa_questions q JOIN users u ON u.id=q.author_id LEFT JOIN images i ON i.id=q.image_id WHERE ${where} ORDER BY q.created_at DESC LIMIT ${size} OFFSET ${off}`, values);
    const totalResult = await pool.query(`SELECT count(*)::int AS total FROM qa_questions q WHERE ${where}`, values);
    res.json({ items: rows,page,pageSize:size,total:totalResult.rows[0].total });
  } catch (error) { next(error); }
});
router.get('/questions/mine', authRequired, async (req,res,next)=>{
  try { const { rows } = await pool.query(`SELECT q.id,q.title,q.body,q.tags,q.category,q.brand,q.model,q.vehicle_year,q.view_count,q.image_id,i.public_url AS image_url,q.created_at,q.updated_at,COALESCE(NULLIF(u.nickname,''),u.display_name) AS author_name,(SELECT count(*)::int FROM qa_answers a WHERE a.question_id=q.id AND a.status='published') AS answer_count FROM qa_questions q JOIN users u ON u.id=q.author_id LEFT JOIN images i ON i.id=q.image_id WHERE q.author_id=$1 ORDER BY q.created_at DESC LIMIT 100`,[req.auth.userId]); res.json({items:rows}); } catch(error){next(error);} });
router.post('/questions', authRequired, writeLimit, async (req, res, next) => {
  try {
    const parsed = z.object({ title:z.string().trim().min(8).max(180), body:z.string().trim().min(10).max(5000), tags:z.array(z.string().trim().min(1).max(30)).max(8).optional().default([]), category:z.string().trim().min(1).max(40).optional().default('other'), brand:z.string().trim().max(80).optional().default(''), model:z.string().trim().max(80).optional().default(''), year:z.string().trim().max(8).optional().default(''), imageId:z.string().uuid().nullable().optional() }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error:{ code:'INVALID_QUESTION',message:'عنوان یا متن سوال معتبر نیست.' } });
    if (parsed.data.imageId) { const image = await pool.query('SELECT id FROM images WHERE id=$1 AND owner_id=$2',[parsed.data.imageId,req.auth.userId]); if(!image.rows[0]) return res.status(400).json({error:{code:'INVALID_IMAGE',message:'تصویر سوال معتبر نیست.'}}); }
    const { rows } = await pool.query('INSERT INTO qa_questions(author_id,title,body,tags,category,brand,model,vehicle_year,image_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [req.auth.userId,parsed.data.title,parsed.data.body,parsed.data.tags,parsed.data.category,parsed.data.brand || null,parsed.data.model || null,parsed.data.year || null,parsed.data.imageId || null]);
    res.status(201).json({ question:rows[0] });
  } catch (error) { next(error); }
});
router.get('/questions/stats', async (_req,res,next)=>{ try { const { rows } = await pool.query("SELECT count(*)::int AS count,category FROM qa_questions WHERE status='published' GROUP BY category"); const byCategory={}; let total=0; for(const r of rows){byCategory[r.category]=r.count;total+=r.count;} res.json({total,byCategory}); } catch(error){next(error);} });
router.get('/questions/:id', async (req, res, next) => {
  try {
    const q = await pool.query(`SELECT q.id,q.title,q.body,q.tags,q.category,q.brand,q.model,q.vehicle_year,q.view_count,q.image_id,i.public_url AS image_url,q.created_at,q.updated_at,u.id AS author_id,COALESCE(NULLIF(u.nickname,''),u.display_name) AS author_name
      FROM qa_questions q JOIN users u ON u.id=q.author_id LEFT JOIN images i ON i.id=q.image_id WHERE q.id=$1 AND q.status='published' AND u.status='active' AND u.deleted_at IS NULL`, [req.params.id]);
    if (!q.rows[0]) return res.status(404).json({ error:{code:'NOT_FOUND',message:'سوال پیدا نشد.'} });
    const answers = await pool.query(`SELECT a.id,a.body,a.is_accepted,a.helpful_count,a.created_at,a.updated_at,u.id AS author_id,COALESCE(NULLIF(u.nickname,''),u.display_name) AS author_name
      FROM qa_answers a JOIN users u ON u.id=a.author_id WHERE a.question_id=$1 AND a.status='published' AND u.status='active' AND u.deleted_at IS NULL ORDER BY a.is_accepted DESC,a.created_at ASC LIMIT 200`, [req.params.id]);
    res.json({ question:q.rows[0],answers:answers.rows });
  } catch (error) { next(error); }
});
router.post('/questions/:id/view', viewLimit, async (req,res,next)=>{
  try { const { rows } = await pool.query("UPDATE qa_questions SET view_count=LEAST(view_count+1,2147483647) WHERE id=$1 AND status='published' RETURNING view_count",[req.params.id]); if(!rows[0]) return res.status(404).json({error:{code:'NOT_FOUND',message:'سوال پیدا نشد.'}}); res.json({views:rows[0].view_count}); } catch(error){next(error);} });
router.post('/answers/:id/vote', authRequired, writeLimit, async (req,res,next)=>{
  try { const result = await transaction(async(client)=>{ const answer=await client.query("SELECT id,helpful_count FROM qa_answers WHERE id=$1 AND status='published' FOR UPDATE",[req.params.id]); if(!answer.rows[0]) return null; const inserted=await client.query('INSERT INTO qa_answer_votes(answer_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING answer_id',[req.params.id,req.auth.userId]); if(inserted.rowCount) { const updated=await client.query('UPDATE qa_answers SET helpful_count=helpful_count+1,updated_at=now() WHERE id=$1 RETURNING helpful_count',[req.params.id]); return {changed:true,helpful:updated.rows[0].helpful_count}; } const current=await client.query('SELECT helpful_count FROM qa_answers WHERE id=$1',[req.params.id]); return {changed:false,helpful:current.rows[0].helpful_count}; }); if(!result) return res.status(404).json({error:{code:'NOT_FOUND',message:'پاسخ پیدا نشد.'}}); res.json(result); } catch(error){next(error);} });
router.post('/questions/:id/answers', authRequired, writeLimit, async (req, res, next) => {
  try {
    const parsed = z.object({ body:z.string().trim().min(2).max(5000) }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error:{code:'INVALID_ANSWER',message:'متن پاسخ معتبر نیست.'} });
    const q = await pool.query("SELECT id,author_id FROM qa_questions WHERE id=$1 AND status='published'", [req.params.id]);
    if (!q.rows[0]) return res.status(404).json({ error:{code:'NOT_FOUND',message:'سوال پیدا نشد.'} });
    const { rows } = await pool.query('INSERT INTO qa_answers(question_id,author_id,body) VALUES($1,$2,$3) RETURNING *', [req.params.id,req.auth.userId,parsed.data.body]);
    if (q.rows[0].author_id !== req.auth.userId) await pool.query("INSERT INTO notifications(user_id,type,title,body,data) VALUES($1,'qa','پاسخ جدید','به سوال شما پاسخ داده شد.',$2)", [q.rows[0].author_id,{ questionId:req.params.id,answerId:rows[0].id }]);
    res.status(201).json({ answer:rows[0] });
  } catch (error) { next(error); }
});
router.post('/questions/:questionId/answers/:answerId/accept', authRequired, writeLimit, async (req, res, next) => {
  try {
    const result = await transaction(async (client) => {
      const question = await client.query("SELECT id FROM qa_questions WHERE id=$1 AND author_id=$2 AND status='published' FOR UPDATE", [req.params.questionId,req.auth.userId]);
      if (!question.rows[0]) return null;
      const answer = await client.query("SELECT id FROM qa_answers WHERE id=$1 AND question_id=$2 AND status='published' FOR UPDATE", [req.params.answerId,req.params.questionId]);
      if (!answer.rows[0]) return null;
      await client.query('UPDATE qa_answers SET is_accepted=false,updated_at=now() WHERE question_id=$1 AND id<>$2 AND is_accepted=true', [req.params.questionId,req.params.answerId]);
      const accepted = await client.query('UPDATE qa_answers SET is_accepted=true,updated_at=now() WHERE id=$1 RETURNING id,is_accepted', [req.params.answerId]);
      return accepted.rows[0] || null;
    });
    if (!result) return res.status(404).json({ error:{code:'NOT_FOUND',message:'پاسخ پیدا نشد یا دسترسی ندارید.'} });
    res.json({ answer:result });
  } catch (error) { next(error); }
});
export default router;
