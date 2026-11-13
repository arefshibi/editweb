import { Router } from 'express';
import { pool } from '../db.js';

// عمومی: بنرهای فعال صفحه اصلی (ترتیب‌دار)
const router = Router();
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT id,image_url,action,link_url,alt FROM home_banners WHERE active ORDER BY position,created_at LIMIT 12");
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json({ items: rows.map((r) => ({ id: r.id, imageUrl: r.image_url, action: r.action, linkUrl: r.link_url || '', alt: r.alt || '' })) });
  } catch (error) { next(error); }
});
export default router;
