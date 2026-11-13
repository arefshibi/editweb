import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from '../db.js';
import { authRequired, createRateLimiter } from '../middleware/security.js';
import { validateUuidParam } from '../validation.js';
import { err } from '../util.js';

const router = Router();
router.param('id', validateUuidParam);
const writeLimit = createRateLimiter({ name: 'showroom-write', windowSeconds: 60, max: 10, key: (req) => req.auth?.userId || req.ip });
const showroomSchema = z.object({
  slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().trim().min(2).max(120), city: z.string().trim().min(2).max(80), ownerName: z.string().trim().max(80).optional().default(''),
  address: z.string().trim().max(300).optional().default(''), description: z.string().trim().max(2000).optional().default(''),
  logoImageId: z.string().uuid().nullable().optional(), bannerImageId: z.string().uuid().nullable().optional(), phonePublic: z.boolean().optional().default(false),
  tags: z.array(z.string().trim().min(1).max(24).regex(/^[\p{L}\p{N}_]+$/u)).max(10).optional().default([]).transform((a) => [...new Set(a)]),
}).strict();
const MAX_HANDLE_CHANGES = 2;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,79}$/;
const RESERVED_SLUGS = new Set(['admin','support','carmaa','carma','api','mine','system','official','slug-available']);
const slugCheckLimit = createRateLimiter({ name: 'showroom-slug-check', windowSeconds: 60, max: 40, key: (req) => req.auth?.userId || req.ip });
const slugTaken = (error) => error?.code === '23505' && String(error.constraint || '').includes('slug');
const SLUG_TAKEN_RESPONSE = { error: { code: 'SLUG_TAKEN', message: 'این نام کاربری نمایشگاه قبلاً ثبت شده است.' } };
const publicShowroomColumns = `s.id,s.slug,s.slug_changes,s.name,s.city,s.address,s.description,s.tags,s.logo_image_id,s.banner_image_id,logo.public_url AS logo_url,banner.public_url AS banner_url,s.status,s.verified_at,s.founding_number,s.created_at,s.updated_at,
 COALESCE(NULLIF(u.nickname,''),u.display_name) AS owner_name,COALESCE((SELECT count(*)::int FROM listings l WHERE l.showroom_id=s.id AND l.status='published' AND l.expires_at>now()),0) AS published_listing_count,
 COALESCE((SELECT round(avg(r.stars)::numeric,2) FROM showroom_reviews r WHERE r.showroom_id=s.id),0) AS rating,
 COALESCE((SELECT count(*)::int FROM showroom_reviews r WHERE r.showroom_id=s.id),0) AS review_count,
 COALESCE((SELECT count(*)::int FROM follows f WHERE f.followed_showroom_id=s.id),0) AS follower_count`;

router.get('/', async (req, res, next) => {
  try {
    const city = typeof req.query.city === 'string' ? req.query.city.trim().slice(0,80) : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0,100) : '';
    const values = [];
    let filter = "s.status='approved' AND u.status='active' AND u.deleted_at IS NULL";
    if (city) { values.push(city); filter += ` AND s.city=$${values.length}`; }
    if (q) { values.push(`%${q.replace(/[%_\\]/g, '\\$&')}%`); filter += ` AND (s.name ILIKE $${values.length} OR s.city ILIKE $${values.length} OR s.description ILIKE $${values.length})`; }
    const { rows } = await pool.query(`SELECT ${publicShowroomColumns} FROM showrooms s JOIN users u ON u.id=s.owner_id LEFT JOIN images logo ON logo.id=s.logo_image_id LEFT JOIN images banner ON banner.id=s.banner_image_id WHERE ${filter} ORDER BY published_listing_count DESC,rating DESC,s.created_at DESC LIMIT 100`, values);
    res.json({ items: rows });
  } catch (error) { next(error); }
});

// Live availability check for the showroom username (slug) while typing.
router.get('/slug-available', authRequired, slugCheckLimit, async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const slug = typeof req.query.slug === 'string' ? req.query.slug.trim().toLowerCase() : '';
    const mine = (await pool.query('SELECT slug, slug_changes FROM showrooms WHERE owner_id=$1', [req.auth.userId])).rows[0];
    const changesLeft = mine ? Math.max(0, MAX_HANDLE_CHANGES - Number(mine.slug_changes || 0)) : null;
    if (!SLUG_RE.test(slug)) return res.json({ available: false, reason: 'INVALID', changesLeft });
    if (mine && mine.slug === slug) return res.json({ available: true, own: true, changesLeft });
    if (RESERVED_SLUGS.has(slug)) return res.json({ available: false, reason: 'TAKEN', changesLeft });
    const taken = await pool.query('SELECT 1 FROM showrooms WHERE slug=$1 AND owner_id<>$2 LIMIT 1', [slug, req.auth.userId]);
    res.json({ available: !taken.rows[0], reason: taken.rows[0] ? 'TAKEN' : null, changesLeft });
  } catch (error) { next(error); }
});

// ---- Ranking history (replaces the per-browser localStorage copy) ---------------------------------
// The ranking is computed here from public data, compared with the last stored snapshot, and every rank
// change is remembered (prev_rank / moved_at) so the directory can show the up/down arrows.
const RANK_SORTS = ['activity', 'listings', 'recent', 'popular', 'rating'];
const rankLimit = createRateLimiter({ name: 'showroom-rank', windowSeconds: 60, max: 60, key: (req) => req.ip });
function activityScore(count, latestMs, followers) {
  const age = latestMs ? Math.max(0, Date.now() - latestMs) : Infinity;
  const fresh = age < 86400000 ? 25 : age < 7 * 86400000 ? 19 : age < 30 * 86400000 ? 12 : count ? 5 : 0;
  return Math.min(100, 12 + Math.min(52, count * 14) + fresh + Math.min(14, Math.max(0, followers || 0) * 2));
}
function compareRank(a, b, sort) {
  let r;
  if (sort === 'listings') r = (b.count - a.count) || (b.score - a.score);
  else if (sort === 'recent') r = (b.latest - a.latest) || (b.score - a.score);
  else if (sort === 'popular') r = (b.followers - a.followers) || (b.score - a.score);
  else if (sort === 'rating') r = (b.avg - a.avg) || (b.reviews - a.reviews) || (b.score - a.score);
  else r = (b.score - a.score) || (b.count - a.count) || (b.latest - a.latest);
  return r || String(a.id).localeCompare(String(b.id));
}
let rankCache = { at: 0, value: null, inflight: null };
async function computeRankMovements() {
  const { rows } = await pool.query(`SELECT s.id,
      COALESCE((SELECT count(*)::int FROM listings l WHERE l.showroom_id=s.id AND l.status='published' AND l.expires_at>now()),0) AS cnt,
      (SELECT max(l.created_at) FROM listings l WHERE l.showroom_id=s.id AND l.status='published' AND l.expires_at>now()) AS latest,
      COALESCE((SELECT count(*)::int FROM follows f WHERE f.followed_showroom_id=s.id),0) AS followers,
      COALESCE((SELECT avg(r.stars)::float FROM showroom_reviews r WHERE r.showroom_id=s.id),0) AS avg,
      COALESCE((SELECT count(*)::int FROM showroom_reviews r WHERE r.showroom_id=s.id),0) AS reviews
    FROM showrooms s JOIN users u ON u.id=s.owner_id
    WHERE s.status='approved' AND u.status='active' AND u.deleted_at IS NULL`);
  const items = rows.map((r) => {
    const count = Number(r.cnt) || 0, followers = Number(r.followers) || 0, latest = r.latest ? new Date(r.latest).getTime() : 0;
    return { id: String(r.id), count, followers, latest, avg: Number(r.avg) || 0, reviews: Number(r.reviews) || 0, score: activityScore(count, latest, followers) };
  });
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('showroom-rank-snapshot',0))");
    const old = await client.query('SELECT sort_key,showroom_id,rank,prev_rank,moved_at FROM showroom_rank_snapshots');
    const oldMap = new Map(old.rows.map((r) => [`${r.sort_key}:${r.showroom_id}`, r]));
    const ids = items.map((i) => i.id);
    const out = {};
    for (const sort of RANK_SORTS) {
      const sorted = items.slice().sort((a, b) => compareRank(a, b, sort));
      const movements = {};
      const insertIds = [], insertRanks = [];
      const updateIds = [], updateRanks = [], updatePrevRanks = [], updateMovedAt = [];
      const now = new Date();

      for (let i = 0; i < sorted.length; i++) {
        const id = sorted[i].id, rank = i + 1, prev = oldMap.get(`${sort}:${id}`);
        let prevRank = prev ? prev.prev_rank : null, movedAt = prev ? prev.moved_at : null;
        if (!prev) {
          insertIds.push(id); insertRanks.push(rank);
        } else if (Number(prev.rank) !== rank) {
          prevRank = Number(prev.rank); movedAt = now;
          updateIds.push(id); updateRanks.push(rank); updatePrevRanks.push(prevRank); updateMovedAt.push(now);
        }
        if (prevRank && Number(prevRank) !== rank) movements[id] = { from: Number(prevRank), to: rank, delta: Number(prevRank) - rank, changedAt: movedAt ? new Date(movedAt).getTime() : Date.now() };
      }

      // Bulk statements avoid up to 5 × N individual round-trips on a cold/stale rank cache.
      if (insertIds.length) {
        await client.query(
          `INSERT INTO showroom_rank_snapshots(sort_key,showroom_id,rank)
           SELECT $1, v.showroom_id, v.rank
           FROM unnest($2::uuid[], $3::int[]) AS v(showroom_id, rank)
           ON CONFLICT (sort_key, showroom_id) DO NOTHING`,
          [sort, insertIds, insertRanks],
        );
      }
      if (updateIds.length) {
        await client.query(
          `UPDATE showroom_rank_snapshots AS s
           SET rank=v.rank, prev_rank=v.prev_rank, moved_at=v.moved_at, updated_at=now()
           FROM unnest($1::uuid[], $2::int[], $3::int[], $4::timestamptz[]) AS v(showroom_id, rank, prev_rank, moved_at)
           WHERE s.sort_key=$5 AND s.showroom_id=v.showroom_id`,
          [updateIds, updateRanks, updatePrevRanks, updateMovedAt, sort],
        );
      }
      out[sort] = movements;
    }
    // showrooms that are no longer listed: forget their history
    await client.query('DELETE FROM showroom_rank_snapshots WHERE NOT (showroom_id = ANY($1::uuid[]))', [ids]);
    return out;
  });
}
router.get('/rank-movements', rankLimit, async (req, res, next) => {
  try {
    if (rankCache.value && Date.now() - rankCache.at < 60_000) return res.json({ movementsBySort: rankCache.value });
    if (!rankCache.inflight) rankCache.inflight = computeRankMovements().then((v) => { rankCache.value = v; rankCache.at = Date.now(); return v; }).finally(() => { rankCache.inflight = null; });
    res.json({ movementsBySort: await rankCache.inflight });
  } catch (error) { next(error); }
});

router.get('/mine', authRequired, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT ${publicShowroomColumns} FROM showrooms s JOIN users u ON u.id=s.owner_id LEFT JOIN images logo ON logo.id=s.logo_image_id LEFT JOIN images banner ON banner.id=s.banner_image_id WHERE s.owner_id=$1`, [req.auth.userId]);
    res.json({ showroom: rows[0] || null });
  } catch (error) { next(error); }
});

router.post('/', authRequired, writeLimit, async (req, res, next) => {
  try {
    const parsed = showroomSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_SHOWROOM', message: 'اطلاعات نمایشگاه معتبر نیست.' } });
    const x = parsed.data;
    if (RESERVED_SLUGS.has(x.slug)) return res.status(409).json(SLUG_TAKEN_RESPONSE);
    const showroom = await transaction(async (client) => {
      for (const imageId of [x.logoImageId, x.bannerImageId].filter(Boolean)) {
        const image = await client.query('SELECT id FROM images WHERE id=$1 AND owner_id=$2', [imageId, req.auth.userId]);
        if (!image.rows[0]) throw Object.assign(new Error('تصویر نمایشگاه معتبر نیست.'), { status: 400, code: 'INVALID_IMAGE' });
      }
      const { rows } = await client.query(
        `INSERT INTO showrooms(owner_id,slug,name,city,owner_name,address,description,logo_image_id,banner_image_id,phone_public,tags,status)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending') RETURNING *`,
        [req.auth.userId,x.slug,x.name,x.city,x.ownerName,x.address,x.description,x.logoImageId || null,x.bannerImageId || null,x.phonePublic,x.tags]);
      return rows[0];
    });
    res.status(201).json({ showroom });
  } catch (error) { if (slugTaken(error)) return res.status(409).json(SLUG_TAKEN_RESPONSE); next(error); }
});

router.patch('/mine', authRequired, writeLimit, async (req, res, next) => {
  try {
    const parsed = showroomSchema.partial().strict().safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data || {}).length === 0) return res.status(400).json({ error: { code: 'INVALID_SHOWROOM', message: 'تغییرات نمایشگاه معتبر نیست.' } });
    const x = parsed.data;
    for (const imageId of [x.logoImageId, x.bannerImageId].filter(Boolean)) {
      const image = await pool.query('SELECT id FROM images WHERE id=$1 AND owner_id=$2', [imageId, req.auth.userId]);
      if (!image.rows[0]) return res.status(400).json({ error: { code: 'INVALID_IMAGE', message: 'تصویر نمایشگاه معتبر نیست.' } });
    }
    const mapping = { slug:'slug', name:'name', city:'city', ownerName:'owner_name', address:'address', description:'description', logoImageId:'logo_image_id', bannerImageId:'banner_image_id', phonePublic:'phone_public', tags:'tags' };
    const row = await transaction(async (client) => {
      // Lock the row so concurrent requests cannot bypass the change limit.
      const cur = (await client.query('SELECT slug, slug_changes FROM showrooms WHERE owner_id=$1 FOR UPDATE', [req.auth.userId])).rows[0];
      if (!cur) throw err(404, 'NOT_FOUND', 'نمایشگاهی پیدا نشد.');
      const sets = [], values = [];
      for (const [key,col] of Object.entries(mapping)) {
        if (!Object.hasOwn(x,key)) continue;
        if (key === 'slug') {
          if (x.slug === cur.slug) continue; // unchanged: no quota used
          if (RESERVED_SLUGS.has(x.slug)) throw err(409, 'SLUG_TAKEN', SLUG_TAKEN_RESPONSE.error.message);
          if (Number(cur.slug_changes || 0) >= MAX_HANDLE_CHANGES) throw err(403, 'SLUG_CHANGE_LIMIT', 'شما حداکثر ۲ بار می‌توانید نام کاربری نمایشگاه را تغییر دهید و این سهمیه تمام شده است.');
          sets.push('slug_changes=slug_changes+1');
        }
        values.push(x[key] ?? null); sets.push(`${col}=$${values.length}`);
      }
      // Changes to a previously approved showroom require moderator review again.
      // (hashtags are restricted to letters/digits/_ and max 10x24 chars, so a tags-only edit keeps the approval)
      if (Object.keys(x).some((key) => key !== 'tags')) sets.push("status=CASE WHEN status='approved' THEN 'pending' ELSE status END");
      values.push(req.auth.userId);
      return (await client.query(`UPDATE showrooms SET ${sets.join(',')},updated_at=now() WHERE owner_id=$${values.length} RETURNING *`, values)).rows[0];
    });
    res.json({ showroom: row });
  } catch (error) { if (slugTaken(error)) return res.status(409).json(SLUG_TAKEN_RESPONSE); next(error); }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT ${publicShowroomColumns} FROM showrooms s JOIN users u ON u.id=s.owner_id LEFT JOIN images logo ON logo.id=s.logo_image_id LEFT JOIN images banner ON banner.id=s.banner_image_id WHERE s.slug=$1 AND s.status='approved' AND u.status='active' AND u.deleted_at IS NULL LIMIT 1`, [req.params.slug]);
    if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'نمایشگاه پیدا نشد.' } });
    res.json({ showroom: rows[0] });
  } catch (error) { next(error); }
});

router.get('/:id/follow-status', authRequired, async (req, res, next) => {
  try {
    const showroom = await pool.query(
      `SELECT s.owner_id, EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$1 AND f.followed_showroom_id=s.id) AS following,
       (SELECT count(*)::int FROM follows f WHERE f.followed_showroom_id=s.id) AS follower_count
       FROM showrooms s WHERE s.id=$2 AND s.status='approved'`, [req.auth.userId, req.params.id]);
    if (!showroom.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'نمایشگاه پیدا نشد.' } });
    res.json({ following: !!showroom.rows[0].following, followerCount: Number(showroom.rows[0].follower_count || 0), isOwn: showroom.rows[0].owner_id === req.auth.userId });
  } catch (error) { next(error); }
});

router.post('/:id/follow', authRequired, writeLimit, async (req, res, next) => {
  try {
    const showroom = await pool.query("SELECT id,owner_id FROM showrooms WHERE id=$1 AND status='approved'", [req.params.id]);
    if (!showroom.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'نمایشگاه پیدا نشد.' } });
    if (showroom.rows[0].owner_id === req.auth.userId) return res.status(400).json({error:{code:'SELF_FOLLOW',message:'نمی‌توانید نمایشگاه خودتان را دنبال کنید.'}});
    const removed = await pool.query('DELETE FROM follows WHERE follower_id=$1 AND followed_showroom_id=$2 RETURNING follower_id', [req.auth.userId, req.params.id]);
    let following = false;
    if (!removed.rowCount) {
      await pool.query('INSERT INTO follows(follower_id,followed_showroom_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [req.auth.userId, req.params.id]);
      following = true;
      await pool.query("INSERT INTO notifications(user_id,type,title,body,data) VALUES($1,'follow','دنبال‌کنندهٔ جدید','یک کاربر نمایشگاه شما را دنبال کرد.',$2)", [showroom.rows[0].owner_id,{showroomId:req.params.id}]);
    }
    const count = await pool.query('SELECT count(*)::int AS count FROM follows WHERE followed_showroom_id=$1', [req.params.id]);
    res.json({ following, followerCount: Number(count.rows[0]?.count || 0) });
  } catch (error) { next(error); }
});

router.post('/:id/reviews', authRequired, writeLimit, async (req, res, next) => {
  try {
    const parsed = z.object({ stars: z.number().int().min(1).max(5), body: z.string().trim().max(1000).optional().default('') }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_REVIEW', message: 'امتیاز معتبر نیست.' } });
    const result = await pool.query(
      `INSERT INTO showroom_reviews(showroom_id,reviewer_id,stars,body) SELECT id,$2,$3,$4 FROM showrooms WHERE id=$1 AND status='approved' AND owner_id<>$2
       ON CONFLICT(showroom_id,reviewer_id) DO UPDATE SET stars=EXCLUDED.stars,body=EXCLUDED.body,updated_at=now() RETURNING *`,
      [req.params.id, req.auth.userId, parsed.data.stars, parsed.data.body]);
    if (!result.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'نمایشگاه پیدا نشد.' } });
    const owner = await pool.query('SELECT owner_id FROM showrooms WHERE id=$1',[req.params.id]);
    if(owner.rows[0] && owner.rows[0].owner_id !== req.auth.userId) await pool.query("INSERT INTO notifications(user_id,type,title,body,data) VALUES($1,'showroom_review','امتیاز جدید نمایشگاه','برای نمایشگاه شما امتیاز جدیدی ثبت شد.',$2)",[owner.rows[0].owner_id,{showroomId:req.params.id,reviewId:result.rows[0].id}]);
    res.status(200).json({ review: result.rows[0] });
  } catch (error) { next(error); }
});

export default router;
