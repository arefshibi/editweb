import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from '../db.js';
import { authRequired, createRateLimiter } from '../middleware/security.js';

const router = Router();
const writeLimit = createRateLimiter({ name: 'support-ticket', windowSeconds: 3600, max: 5, key: (req) => req.auth?.userId || req.ip });
router.use(authRequired);

router.post('/tickets', writeLimit, async (req, res, next) => {
  try {
    const parsed = z.object({
      category: z.enum(['general','account','listing','payment','security','other']),
      subject: z.string().trim().min(4).max(120),
      body: z.string().trim().min(10).max(4000),
    }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_SUPPORT_TICKET', message: 'موضوع، دسته‌بندی یا متن درخواست معتبر نیست.' } });
    const ticket = await transaction(async (client) => {
      const { rows } = await client.query(
        'INSERT INTO support_tickets(user_id,category,subject,body) VALUES($1,$2,$3,$4) RETURNING id,category,subject,body,status,created_at',
        [req.auth.userId, parsed.data.category, parsed.data.subject, parsed.data.body]);
      await client.query(
        `INSERT INTO notifications(user_id,type,title,body,data)
         SELECT id,'support_ticket','درخواست پشتیبانی جدید','درخواست پشتیبانی جدیدی ثبت شده است.',$1
         FROM users WHERE role='admin' AND status='active' AND deleted_at IS NULL`,
        [{ ticketId: rows[0].id, category: rows[0].category }]);
      return rows[0];
    });
    res.status(201).json({ ticket });
  } catch (error) { next(error); }
});

router.get('/tickets/mine', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id,category,subject,body,status,created_at,updated_at FROM support_tickets WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',
      [req.auth.userId]);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ items: rows });
  } catch (error) { next(error); }
});

export default router;
