import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired, createRateLimiter } from '../middleware/security.js';
import { collectStats } from '../services/weekly-report.js';

const router = Router();
const limit = createRateLimiter({ name: 'showroom-report', windowSeconds: 60, max: 20, key: (req) => req.auth?.userId || req.ip });

// GET /api/v1/showrooms/mine/report — live last-7-days numbers + the latest stored weekly report.
router.get('/', authRequired, limit, async (req, res, next) => {
  try {
    const sr = await pool.query('SELECT id, slug, name, status FROM showrooms WHERE owner_id=$1', [req.auth.userId]);
    const showroom = sr.rows[0];
    if (!showroom) return res.status(404).json({ error: { code: 'NO_SHOWROOM', message: 'نمایشگاهی برای شما ثبت نشده است.' } });
    const now = new Date();
    const last7 = await collectStats(pool, { ownerId: req.auth.userId, showroomId: showroom.id }, new Date(now.getTime() - 7 * 86_400_000), now);
    const latest = await pool.query('SELECT week_key, stats, created_at FROM showroom_weekly_reports WHERE showroom_id=$1 ORDER BY week_key DESC LIMIT 1', [showroom.id]);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ showroom, last7, latest: latest.rows[0] || null });
  } catch (error) { next(error); }
});

export default router;
