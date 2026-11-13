import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { authRequired, authOptional, createRateLimiter } from '../middleware/security.js';

/* Returns the cover image (og:image) of a news article so the site can show the same photo as the source.
   SSRF-safe: only https URLs on a fixed allowlist of news hosts are fetched, redirects are re-checked,
   the body is size-capped, and the result is cached in memory. */
const router = Router();
const limiter = createRateLimiter({ name: 'news-preview', windowSeconds: 60, max: 60 });
export const ALLOWED_HOSTS = new Set(['kbb.com', 'www.kbb.com', 'elektroquatsch.de', 'www.elektroquatsch.de']);
const OK_TTL = 6 * 60 * 60 * 1000;
const FAIL_TTL = 10 * 60 * 1000;
const MAX_BYTES = 400 * 1024;
const cache = new Map();

export function allowed(u) { return u.protocol === 'https:' && ALLOWED_HOSTS.has(u.hostname.toLowerCase()) && !u.username && !u.password; }

function metaImage(html, base) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const want = ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src'];
  const found = new Map();
  for (const tag of tags) {
    const key = (/(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag) || [])[1];
    const val = (/content\s*=\s*["']([^"']+)["']/i.exec(tag) || [])[1];
    if (key && val && !found.has(key.toLowerCase())) found.set(key.toLowerCase(), val.replace(/&amp;/g, '&').trim());
  }
  for (const k of want) {
    if (!found.has(k)) continue;
    try { const img = new URL(found.get(k), base); if (img.protocol === 'https:') return img.toString().slice(0, 600); } catch { /* try next */ }
  }
  return '';
}

async function readCapped(res) {
  const reader = res.body.getReader();
  const chunks = []; let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); total += value.length;
  }
  try { await reader.cancel(); } catch { /* ignore */ }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
}

export async function fetchArticle(start) {
  let url = start;
  for (let hop = 0; hop < 3; hop += 1) {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CarMaaBot/1.0)', Accept: 'text/html' },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      const next = new URL(res.headers.get('location'), url);
      if (!allowed(next)) return '';
      url = next; continue;
    }
    if (!res.ok || !String(res.headers.get('content-type') || '').includes('html')) return '';
    return metaImage(await readCapped(res), url);
  }
  return '';
}

router.get('/preview', limiter, async (req, res, next) => {
  try {
    let target;
    try { target = new URL(String(req.query.url || '')); } catch { return res.status(400).json({ error: { code: 'BAD_URL', message: 'آدرس معتبر نیست.' } }); }
    if (!allowed(target)) return res.status(400).json({ error: { code: 'HOST_NOT_ALLOWED', message: 'این منبع پشتیبانی نمی‌شود.' } });
    target.hash = '';
    const key = target.toString();
    const hit = cache.get(key);
    if (hit && hit.until > Date.now()) return res.set('Cache-Control', 'public, max-age=3600').json({ image: hit.image });
    let image = '';
    try { image = await fetchArticle(target); } catch { image = ''; }
    cache.set(key, { image, until: Date.now() + (image ? OK_TTL : FAIL_TTL) });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    res.set('Cache-Control', image ? 'public, max-age=3600' : 'no-store').json({ image });
  } catch (error) { next(error); }
});

/* Auto-ingested news (see services/news-ingest.js). Public, cached briefly. */
const itemsLimiter = createRateLimiter({ name: 'news-items', windowSeconds: 60, max: 60 });
router.get('/items', itemsLimiter, async (req, res, next) => {
  try {
    const limit = Math.min(60, Math.max(1, Number.parseInt(String(req.query.limit || '40'), 10) || 40));
    const { rows } = await pool.query(
      `SELECT id, source, url, category, title, summary, image, to_char(published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date
         FROM news_items ORDER BY published_at DESC, created_at DESC LIMIT $1`, [limit]);
    res.set('Cache-Control', 'public, max-age=120').json({ items: rows });
  } catch (error) { next(error); }
});

/* ---------------- likes & comments (server-side; replaces the old per-browser localStorage copy) ---------------- */
const NEWS_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_COMMENTS_PER_NEWS = 100;
const socialWrite = createRateLimiter({ name: 'news-social-write', windowSeconds: 60, max: 20, key: (req) => req.auth?.userId || req.ip });
const socialRead = createRateLimiter({ name: 'news-social-read', windowSeconds: 60, max: 120 });
const commentSchema = z.object({
  text: z.string().trim().min(1).max(500),
  parentId: z.string().regex(UUID_RE).nullable().optional(),
}).strict();
const bad = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const commentJson = (r) => ({
  id: r.id, newsId: r.news_id, parentId: r.parent_id || null, userId: r.user_id,
  name: r.name || 'کاربر', avatarUrl: r.avatar_url || '', text: r.body,
  createdAt: new Date(r.created_at).getTime(), likes: Number(r.likes || 0), liked: !!r.liked,
});

// GET /news/social?ids=n1,n2  -> { items: { n1: { likes, liked, comments: [...] } } }  (public; "liked" only when signed in)
router.get('/social', socialRead, authOptional, async (req, res, next) => {
  try {
    const ids = [...new Set(String(req.query.ids || '').split(',').map((x) => x.trim()).filter((x) => NEWS_ID_RE.test(x)))].slice(0, 50);
    const me = req.auth?.userId || null;
    const items = Object.fromEntries(ids.map((id) => [id, { likes: 0, liked: false, comments: [] }]));
    if (ids.length) {
      const likes = await pool.query(
        `SELECT news_id, count(*)::int AS n, bool_or(user_id = $2::uuid) AS mine FROM news_likes WHERE news_id = ANY($1::text[]) GROUP BY news_id`, [ids, me]);
      for (const r of likes.rows) { items[r.news_id].likes = r.n; items[r.news_id].liked = !!r.mine; }
      const comments = await pool.query(
        `SELECT * FROM (
           SELECT c.id, c.news_id, c.parent_id, c.user_id, c.body, c.created_at,
                  COALESCE(NULLIF(u.nickname,''), u.display_name) AS name, u.avatar_url,
                  (SELECT count(*)::int FROM news_comment_likes l WHERE l.comment_id = c.id) AS likes,
                  EXISTS(SELECT 1 FROM news_comment_likes l WHERE l.comment_id = c.id AND l.user_id = $2::uuid) AS liked,
                  row_number() OVER (PARTITION BY c.news_id ORDER BY c.created_at DESC) AS rn
             FROM news_comments c JOIN users u ON u.id = c.user_id
            WHERE c.news_id = ANY($1::text[]) AND c.status = 'published' AND u.status = 'active' AND u.deleted_at IS NULL
         ) t WHERE rn <= $3 ORDER BY created_at ASC`, [ids, me, MAX_COMMENTS_PER_NEWS]);
      for (const r of comments.rows) items[r.news_id].comments.push(commentJson(r));
    }
    res.set('Cache-Control', 'no-store').json({ items });
  } catch (error) { next(error); }
});

// POST /news/:newsId/like  -> toggles; { liked, count }
router.post('/:newsId/like', authRequired, socialWrite, async (req, res, next) => {
  try {
    const newsId = req.params.newsId;
    if (!NEWS_ID_RE.test(newsId)) return bad(res, 400, 'INVALID_ID', 'شناسهٔ خبر معتبر نیست.');
    const removed = await pool.query('DELETE FROM news_likes WHERE news_id=$1 AND user_id=$2 RETURNING 1', [newsId, req.auth.userId]);
    let liked = false;
    if (!removed.rowCount) { await pool.query('INSERT INTO news_likes(news_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [newsId, req.auth.userId]); liked = true; }
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM news_likes WHERE news_id=$1', [newsId]);
    res.json({ liked, count: rows[0].n });
  } catch (error) { next(error); }
});

// POST /news/:newsId/comments { text, parentId? }  -> { comment }
router.post('/:newsId/comments', authRequired, socialWrite, async (req, res, next) => {
  try {
    const newsId = req.params.newsId;
    if (!NEWS_ID_RE.test(newsId)) return bad(res, 400, 'INVALID_ID', 'شناسهٔ خبر معتبر نیست.');
    const parsed = commentSchema.safeParse(req.body);
    if (!parsed.success) return bad(res, 400, 'INVALID_COMMENT', 'متن نظر معتبر نیست (۱ تا ۵۰۰ نویسه).');
    let parentId = null;
    if (parsed.data.parentId) {
      const parent = await pool.query("SELECT id, parent_id FROM news_comments WHERE id=$1 AND news_id=$2 AND status='published'", [parsed.data.parentId, newsId]);
      if (!parent.rows[0]) return bad(res, 404, 'NOT_FOUND', 'نظر مورد نظر پیدا نشد.');
      parentId = parent.rows[0].parent_id || parent.rows[0].id; // replies stay one level deep
    }
    const dup = await pool.query("SELECT 1 FROM news_comments WHERE news_id=$1 AND user_id=$2 AND body=$3 AND created_at > now() - interval '2 minutes' LIMIT 1", [newsId, req.auth.userId, parsed.data.text]);
    if (dup.rows[0]) return bad(res, 429, 'DUPLICATE_COMMENT', 'این نظر هم‌اکنون ثبت شده است.');
    const ins = await pool.query('INSERT INTO news_comments(news_id,user_id,parent_id,body) VALUES($1,$2,$3,$4) RETURNING id, news_id, parent_id, user_id, body, created_at', [newsId, req.auth.userId, parentId, parsed.data.text]);
    const u = await pool.query("SELECT COALESCE(NULLIF(nickname,''), display_name) AS name, avatar_url FROM users WHERE id=$1", [req.auth.userId]);
    res.status(201).json({ comment: commentJson({ ...ins.rows[0], ...u.rows[0], likes: 0, liked: false }) });
  } catch (error) { next(error); }
});

// DELETE /news/comments/:commentId  (owner, or moderator/admin) -> soft delete
router.delete('/comments/:commentId', authRequired, socialWrite, async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.commentId)) return bad(res, 400, 'INVALID_ID', 'شناسهٔ نظر معتبر نیست.');
    const staff = ['moderator', 'admin'].includes(req.auth.role);
    const r = await pool.query("UPDATE news_comments SET status='deleted' WHERE id=$1 AND status='published' AND ($3::boolean OR user_id=$2) RETURNING id", [req.params.commentId, req.auth.userId, staff]);
    if (!r.rowCount) return bad(res, 404, 'NOT_FOUND', 'نظر پیدا نشد یا اجازهٔ حذف ندارید.');
    res.json({ deleted: true });
  } catch (error) { next(error); }
});

// POST /news/comments/:commentId/like -> toggles; { liked, count }
router.post('/comments/:commentId/like', authRequired, socialWrite, async (req, res, next) => {
  try {
    const id = req.params.commentId;
    if (!UUID_RE.test(id)) return bad(res, 400, 'INVALID_ID', 'شناسهٔ نظر معتبر نیست.');
    const exists = await pool.query("SELECT 1 FROM news_comments WHERE id=$1 AND status='published'", [id]);
    if (!exists.rows[0]) return bad(res, 404, 'NOT_FOUND', 'نظر پیدا نشد.');
    const removed = await pool.query('DELETE FROM news_comment_likes WHERE comment_id=$1 AND user_id=$2 RETURNING 1', [id, req.auth.userId]);
    let liked = false;
    if (!removed.rowCount) { await pool.query('INSERT INTO news_comment_likes(comment_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [id, req.auth.userId]); liked = true; }
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM news_comment_likes WHERE comment_id=$1', [id]);
    res.json({ liked, count: rows[0].n });
  } catch (error) { next(error); }
});

export default router;
