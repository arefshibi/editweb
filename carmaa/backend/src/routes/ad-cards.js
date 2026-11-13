import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { createRateLimiter } from '../middleware/security.js';
import { validateUuidParam } from '../validation.js';

// Public side of the admin-managed ad cards: the listings page reads the active
// cards and reports views/clicks. Management lives in routes/admin.js.
const router = Router();
router.param('id', validateUuidParam);
const eventLimit = createRateLimiter({ name: 'ad-card-event', windowSeconds: 60, max: 90 });

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id,title,description,image_url,link_url,cta_text,badge_text,position,repeat_every
       FROM ad_cards
       WHERE is_active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())
       ORDER BY sort_order ASC, created_at DESC LIMIT 20`);
    res.setHeader('Cache-Control', 'private, max-age=30');
    res.json({ items: rows.map((r) => ({
      id: r.id, title: r.title, description: r.description, imageUrl: r.image_url, linkUrl: r.link_url,
      ctaText: r.cta_text, badgeText: r.badge_text, position: r.position, repeatEvery: r.repeat_every,
    })) });
  } catch (error) { next(error); }
});

router.post('/:id/event', eventLimit, async (req, res, next) => {
  try {
    const parsed = z.object({ type: z.enum(['view', 'click']) }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_EVENT', message: 'رویداد معتبر نیست.' } });
    const column = parsed.data.type === 'click' ? 'clicks' : 'views';
    await pool.query(`UPDATE ad_cards SET ${column}=${column}+1 WHERE id=$1 AND is_active`, [req.params.id]);
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
