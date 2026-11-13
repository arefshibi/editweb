import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/security.js';
import { parsePositiveInt } from '../util.js';
import { validateUuidParam } from '../validation.js';
const router = Router();
router.param('id', validateUuidParam);
router.use(authRequired);
router.get('/', async (req, res, next) => {
  try {
    const limit = parsePositiveInt(req.query.limit, 50, 100);
    const type = typeof req.query.type === 'string' && /^[a-z_]{1,30}$/.test(req.query.type) ? req.query.type : null;
    const { rows } = await pool.query('SELECT id,type,title,body,data,read_at,created_at FROM notifications WHERE user_id=$1 AND ($3::text IS NULL OR type=$3) ORDER BY created_at DESC LIMIT $2', [req.auth.userId, limit, type]);
    const unread = await pool.query('SELECT count(*)::int AS count FROM notifications WHERE user_id=$1 AND read_at IS NULL AND ($2::text IS NULL OR type=$2)', [req.auth.userId, type]);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ items: rows, unreadCount: unread.rows[0].count });
  } catch (error) { next(error); }
});
router.delete('/', async (req,res,next)=>{ try { const type = typeof req.query.type === 'string' && /^[a-z_]{1,30}$/.test(req.query.type) ? req.query.type : null; await pool.query('DELETE FROM notifications WHERE user_id=$1 AND ($2::text IS NULL OR type=$2)',[req.auth.userId,type]); res.status(204).end(); } catch(error){next(error);} });
router.post('/read-all', async (req, res, next) => {
  try { const parsed = req.body && typeof req.body.type === 'string' && /^[a-z_]{1,30}$/.test(req.body.type) ? req.body.type : null; await pool.query('UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE user_id=$1 AND ($2::text IS NULL OR type=$2)', [req.auth.userId,parsed]); res.json({ ok: true }); }
  catch (error) { next(error); }
});
router.post('/:id/read', async (req, res, next) => {
  try {
    const { rows } = await pool.query('UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2 RETURNING id,read_at', [req.params.id,req.auth.userId]);
    if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'اعلان پیدا نشد.' } });
    res.json({ notification: rows[0] });
  } catch (error) { next(error); }
});
export default router;
