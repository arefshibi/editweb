import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from '../db.js';
import { authRequired, createRateLimiter } from '../middleware/security.js';
import { validateUuidParam } from '../validation.js';
import { DEAL_TYPES, REVIEW_TAGS, REPORT_REASONS, SORTS, escapeLike, mapReputation, matchScore, normalizeDeals, cleanText, cleanInt, toGregorian } from '../services/partner-market.js';

// «بازار همکاران»: بازار B2B فقط برای نمایشگاه‌های تأییدشده — آگهی «دارم/مشتری دارم»، پیشنهاد همکاری،
// معامله با تأیید دوطرفه، امتیاز و اعتبار، ذخیره، هشدار جستجو، همکاران مورد اعتماد و تحلیل تقاضا.
const router = Router();
['id', 'oid', 'sid', 'aid'].forEach((n) => router.param(n, validateUuidParam));
const limiter = (name, max) => createRateLimiter({ name, windowSeconds: 60, max, key: (req) => req.auth?.userId || req.ip });
const readLimit = limiter('partners-read', 120);
const writeLimit = limiter('partners-write', 20);
const offerLimit = limiter('partners-offer', 10);
const MAX_ACTIVE = 20, MAX_URGENT = 3, MAX_RENEWS = 6, MAX_ALERTS = 10, MAX_OPEN_OFFERS = 30, TTL_DAYS = 14, MIN_DEMAND_SCORE = 10;
const REPORTS_TO_HIDE = 3;
const err = (status, code, message) => Object.assign(new Error(message), { status, code });
const bad = (res, code, message) => res.status(400).json({ error: { code, message } });
const notFound = (res, message = 'پیدا نشد.') => res.status(404).json({ error: { code: 'NOT_FOUND', message } });

router.use(authRequired);
router.use(async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT id,name,slug,city FROM showrooms WHERE owner_id=$1 AND status='approved'", [req.auth.userId]);
    if (!rows[0]) return res.status(403).json({ error: { code: 'SHOWROOM_REQUIRED', message: 'بازار همکاران فقط برای نمایشگاه‌های تأییدشده است.' } });
    req.showroom = rows[0];
    next();
  } catch (error) { next(error); }
});

// ── اعتبارسنجی ───────────────────────────────────────────────────────────────
const yr = z.number().int().min(1300).max(2100).nullable().optional().transform((y) => toGregorian(y));
const postFields = {
  make: z.string().trim().min(2).max(80),
  model: z.string().trim().max(100).optional().default(''),
  yearFrom: yr, yearTo: yr,
  city: z.string().trim().max(80).optional().default(''),
  priceToman: z.number().int().min(0).max(1e12).nullable().optional(),
  note: z.string().trim().max(300).optional().default(''),
  color: z.string().trim().max(50).optional().default(''),
  mileageKm: z.number().int().min(0).max(3000000).nullable().optional(),
  dealTypes: z.array(z.enum(DEAL_TYPES)).max(4).optional().default([]),
  commissionPercent: z.number().min(0).max(50).nullable().optional(),
  priceNegotiable: z.boolean().optional().default(false),
  urgent: z.boolean().optional().default(false),
};
const yearsOk = (v) => v.yearFrom == null || v.yearTo == null || v.yearFrom <= v.yearTo;
const createSchema = z.object({ kind: z.enum(['have', 'want']), listingId: z.string().min(1).max(64).nullable().optional(), ...postFields }).strict().refine(yearsOk, { message: 'بازهٔ سال معتبر نیست.' });
const editSchema = z.object(postFields).strict().refine(yearsOk, { message: 'بازهٔ سال معتبر نیست.' });
const offerSchema = z.object({
  amountToman: z.number().int().min(0).max(1e12).nullable().optional(),
  commissionPercent: z.number().min(0).max(50).nullable().optional(),
  message: z.string().trim().max(500).optional().default(''),
  myPostId: z.string().uuid().nullable().optional(),
}).strict();
const alertSchema = z.object({
  kind: z.enum(['have', 'want']).nullable().optional(),
  make: z.string().trim().min(2).max(80),
  model: z.string().trim().max(100).optional().default(''),
  yearFrom: yr, yearTo: yr,
  city: z.string().trim().max(80).optional().default(''),
  priceMax: z.number().int().min(0).max(1e12).nullable().optional(),
}).strict().refine(yearsOk, { message: 'بازهٔ سال معتبر نیست.' });
const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.enum(REVIEW_TAGS)).max(4).optional().default([]),
  comment: z.string().trim().max(300).optional().default(''),
}).strict();
const postIssue = (parsed) => {
  const m = parsed.error.issues?.[0]?.message;
  return m && /سال/.test(m) ? m : 'اطلاعات آگهی معتبر نیست.';
};

// ── ستون‌ها و نگاشت ────────────────────────────────────────────────────────────
// پارامترهای ثابت همهٔ کوئری‌های آگهی: $1 = userId ، $2 = showroomId
const POST_COLS = `p.id,p.kind,p.make,p.model,p.year_from,p.year_to,p.city,p.price_toman,p.note,p.status,p.created_at,p.expires_at,p.owner_id,
  p.color,p.mileage_km,p.deal_types,p.commission_percent,p.price_negotiable,p.urgent,p.closed_reason,p.hidden_at,
  (p.owner_id=$1) AS mine, s.id AS showroom_id,s.name AS showroom_name,s.slug AS showroom_slug,s.city AS showroom_city,img.public_url AS logo_url,
  ls.id AS linked_listing_id, ls.title AS listing_title, thumb.public_url AS listing_thumb,
  rep.deals,rep.partners,rep.rating_avg,rep.rating_count,rep.offers_received,rep.offers_answered,rep.avg_response_hours,
  EXISTS(SELECT 1 FROM partner_saved sv WHERE sv.post_id=p.id AND sv.showroom_id=$2) AS saved,
  EXISTS(SELECT 1 FROM partner_trusted t WHERE t.showroom_id=$2 AND t.trusted_showroom_id=p.showroom_id) AS trusted,
  (SELECT o.status FROM partner_offers o WHERE o.post_id=p.id AND o.from_showroom_id=$2 ORDER BY o.created_at DESC LIMIT 1) AS my_offer_status,
  (SELECT o.id FROM partner_offers o WHERE o.post_id=p.id AND o.from_showroom_id=$2 ORDER BY o.created_at DESC LIMIT 1) AS my_offer_id,
  CASE WHEN p.owner_id=$1 THEN (SELECT count(*)::int FROM partner_offers o WHERE o.post_id=p.id) END AS offer_count,
  CASE WHEN p.owner_id=$1 THEN (SELECT count(*)::int FROM partner_post_views v WHERE v.post_id=p.id) END AS view_count`;
const POST_FROM = `FROM partner_posts p
  JOIN showrooms s ON s.id=p.showroom_id AND s.status='approved'
  JOIN users u ON u.id=p.owner_id AND u.status='active' AND u.deleted_at IS NULL
  JOIN partner_reputation rep ON rep.showroom_id=s.id
  LEFT JOIN images img ON img.id=s.logo_image_id
  LEFT JOIN listings ls ON ls.id=p.listing_id AND ls.status='published' AND ls.expires_at>now()
  LEFT JOIN LATERAL (SELECT i.public_url FROM listing_images li JOIN images i ON i.id=li.image_id WHERE li.listing_id=ls.id ORDER BY li.position LIMIT 1) thumb ON true`;
const NOT_BLOCKED = `NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=p.owner_id) OR (b.blocker_id=p.owner_id AND b.blocked_id=$1))`;
const VISIBLE = `p.status='active' AND p.expires_at>now() AND p.hidden_at IS NULL`;
const num = (v) => (v == null ? null : Number(v));
const mapPost = (r) => ({
  id: r.id, kind: r.kind, make: r.make, model: r.model, yearFrom: r.year_from, yearTo: r.year_to, city: r.city,
  priceToman: num(r.price_toman), note: r.note, status: r.status, createdAt: r.created_at, expiresAt: r.expires_at,
  mine: !!r.mine, ownerId: r.owner_id, color: r.color, mileageKm: r.mileage_km, dealTypes: r.deal_types || [],
  commissionPercent: num(r.commission_percent), priceNegotiable: !!r.price_negotiable, urgent: !!r.urgent,
  closedReason: r.closed_reason, hidden: !!r.hidden_at, saved: !!r.saved, trusted: !!r.trusted,
  myOffer: r.my_offer_status ? { id: r.my_offer_id, status: r.my_offer_status } : null,
  offerCount: r.offer_count ?? null, viewCount: r.view_count ?? null,
  listing: r.linked_listing_id ? { id: r.linked_listing_id, title: r.listing_title, thumb: r.listing_thumb || null } : null,
  showroom: { id: r.showroom_id, name: r.showroom_name, slug: r.showroom_slug, city: r.showroom_city, logoUrl: r.logo_url || null, reputation: mapReputation(r) },
});
const matchKey = (a) => ({ kind: a.kind, make: a.make, model: a.model, yearFrom: a.yearFrom, yearTo: a.yearTo, city: a.city, priceToman: a.priceToman, priceNegotiable: a.priceNegotiable });
const money = (t) => (t == null ? '' : t >= 1e9 ? `${Math.round(t / 1e8) / 10} میلیارد تومان` : `${Math.round(t / 1e6)} میلیون تومان`);
const carName = (p) => `${p.make}${p.model ? ' ' + p.model : ''}`;

async function notifyMany(db, userIds, type, title, body, data) {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length) return;
  await db.query("INSERT INTO notifications(user_id,type,title,body,data) SELECT unnest($1::uuid[]),$2,$3,$4,$5::jsonb", [ids, type, title.slice(0, 160), body.slice(0, 500), JSON.stringify(data || {})]);
}

// ── فید، فیلترها، آمار بازار ──────────────────────────────────────────────────────
router.get('/feed', readLimit, async (req, res, next) => {
  try {
    const q = req.query;
    const kind = ['have', 'want'].includes(q.kind) ? q.kind : null;
    const sort = SORTS[q.sort] || SORTS.new;
    const limit = Math.min(Math.max(cleanInt(q.limit) || 20, 1), 40);
    const offset = Math.min(Math.max(cleanInt(q.offset) || 0, 0), 2000);
    const search = cleanText(q.q, 60);
    const { rows } = await pool.query(
      `SELECT ${POST_COLS} ${POST_FROM}
       WHERE ${VISIBLE} AND ${NOT_BLOCKED}
         AND ($3::text IS NULL OR p.kind=$3) AND ($4::text IS NULL OR lower(p.make)=lower($4)) AND ($5::text IS NULL OR p.city=$5)
         AND ($6::int IS NULL OR COALESCE(p.year_to,9999)>=$6) AND ($7::int IS NULL OR COALESCE(p.year_from,0)<=$7)
         AND ($8::bigint IS NULL OR p.price_toman IS NULL OR p.price_toman>=$8) AND ($9::bigint IS NULL OR p.price_toman IS NULL OR p.price_toman<=$9)
         AND ($10::text IS NULL OR $10=ANY(p.deal_types))
         AND ($11::text IS NULL OR (p.make||' '||p.model||' '||p.note||' '||p.city||' '||p.color) ILIKE $11 ESCAPE '\\')
         AND (NOT $12::boolean OR EXISTS(SELECT 1 FROM partner_trusted t WHERE t.showroom_id=$2 AND t.trusted_showroom_id=p.showroom_id))
         AND (NOT $13::boolean OR EXISTS(SELECT 1 FROM partner_saved sv WHERE sv.post_id=p.id AND sv.showroom_id=$2))
         AND (NOT $14::boolean OR p.urgent)
       ORDER BY ${sort} LIMIT $15 OFFSET $16`,
      [req.auth.userId, req.showroom.id, kind, cleanText(q.make, 80), cleanText(q.city, 80), toGregorian(cleanInt(q.yearFrom)), toGregorian(cleanInt(q.yearTo)),
        cleanInt(q.priceMin), cleanInt(q.priceMax), DEAL_TYPES.includes(q.deal) ? q.deal : null, search ? `%${escapeLike(search)}%` : null,
        q.trusted === '1', q.saved === '1', q.urgent === '1', limit + 1, offset]);
    res.json({ items: rows.slice(0, limit).map(mapPost), hasMore: rows.length > limit, nextOffset: offset + limit });
  } catch (error) { next(error); }
});

router.get('/facets', readLimit, async (req, res, next) => {
  try {
    const base = `FROM partner_posts p JOIN showrooms s ON s.id=p.showroom_id AND s.status='approved' WHERE ${VISIBLE}`;
    const [makes, cities, stats] = await Promise.all([
      pool.query(`SELECT min(p.make) AS name, count(*)::int AS n ${base} GROUP BY lower(p.make) ORDER BY n DESC, name LIMIT 40`),
      pool.query(`SELECT p.city AS name, count(*)::int AS n ${base} AND p.city<>'' GROUP BY p.city ORDER BY n DESC, name LIMIT 40`),
      pool.query(`SELECT count(*) FILTER (WHERE p.kind='have')::int AS have, count(*) FILTER (WHERE p.kind='want')::int AS want,
                         count(DISTINCT p.showroom_id)::int AS showrooms, count(*) FILTER (WHERE p.urgent)::int AS urgent,
                         (SELECT count(*)::int FROM partner_offers o WHERE o.status='completed' AND o.completed_at > now() - interval '30 days') AS deals30
                  ${base}`)]);
    const st = stats.rows[0];
    res.json({ makes: makes.rows, cities: cities.rows, stats: { have: st.have, want: st.want, showrooms: st.showrooms, urgent: st.urgent, deals30: st.deals30 } });
  } catch (error) { next(error); }
});

router.get('/my-listings', readLimit, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT l.id,l.title,l.make,l.model,l.year,l.city,l.price_toman,l.price_negotiable,l.mileage_km,l.color,
              (SELECT i.public_url FROM listing_images li JOIN images i ON i.id=li.image_id WHERE li.listing_id=l.id ORDER BY li.position LIMIT 1) AS thumb,
              EXISTS(SELECT 1 FROM partner_posts x WHERE x.listing_id=l.id AND x.status='active' AND x.expires_at>now()) AS in_market
       FROM listings l WHERE l.showroom_id=$1 AND l.status='published' AND l.expires_at>now() ORDER BY l.created_at DESC LIMIT 60`, [req.showroom.id]);
    res.json({ items: rows.map((r) => ({ id: r.id, title: r.title, make: r.make, model: r.model, year: r.year, city: r.city, priceToman: num(r.price_toman), priceNegotiable: !!r.price_negotiable, mileageKm: r.mileage_km, color: r.color, thumb: r.thumb || null, inMarket: !!r.in_market })) });
  } catch (error) { next(error); }
});

// ── آگهی‌های من، هم‌خوانی‌ها، داشبورد ──────────────────────────────────────────────
router.get('/mine', readLimit, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${POST_COLS} ${POST_FROM} WHERE p.showroom_id=$2 AND (p.status='active' OR p.closed_at > now() - interval '7 days')
       ORDER BY (p.status='active') DESC, p.created_at DESC LIMIT 60`, [req.auth.userId, req.showroom.id]);
    res.json({ items: rows.map(mapPost) });
  } catch (error) { next(error); }
});

router.get('/matches', readLimit, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.id AS my_post_id, m.kind AS m_kind, m.make AS m_make, m.model AS m_model, m.year_from AS m_yf, m.year_to AS m_yt,
              m.city AS m_city, m.price_toman AS m_price, m.price_negotiable AS m_neg, ${POST_COLS} ${POST_FROM}
       JOIN partner_posts m ON m.showroom_id=$2 AND m.status='active' AND m.expires_at>now() AND m.kind<>p.kind
         AND lower(m.make)=lower(p.make) AND (m.model='' OR p.model='' OR lower(m.model)=lower(p.model))
         AND COALESCE(m.year_from,0)<=COALESCE(p.year_to,9999) AND COALESCE(p.year_from,0)<=COALESCE(m.year_to,9999)
       WHERE ${VISIBLE} AND ${NOT_BLOCKED} AND p.showroom_id<>$2
       ORDER BY p.created_at DESC LIMIT 100`, [req.auth.userId, req.showroom.id]);
    const best = new Map();
    for (const r of rows) {
      const post = mapPost(r);
      const mine = { kind: r.m_kind, make: r.m_make, model: r.m_model, yearFrom: r.m_yf, yearTo: r.m_yt, city: r.m_city, priceToman: num(r.m_price), priceNegotiable: !!r.m_neg };
      const score = matchScore(matchKey(mine), matchKey(post));
      if (!score) continue;
      const prev = best.get(post.id);
      if (!prev || prev.score < score) best.set(post.id, { myPostId: r.my_post_id, myPost: { id: r.my_post_id, kind: mine.kind, make: mine.make, model: mine.model }, score, post });
    }
    res.json({ items: [...best.values()].sort((a, b) => b.score - a.score).slice(0, 40) });
  } catch (error) { next(error); }
});

router.get('/dashboard', readLimit, async (req, res, next) => {
  try {
    const sid = req.showroom.id;
    const [d, rep] = await Promise.all([
      pool.query(
        `SELECT
           (SELECT count(*)::int FROM partner_posts WHERE showroom_id=$1 AND status='active' AND expires_at>now()) AS active_posts,
           (SELECT count(*)::int FROM partner_posts WHERE showroom_id=$1 AND status='active' AND expires_at>now() AND expires_at<now()+interval '2 days') AS expiring,
           (SELECT count(*)::int FROM partner_post_views v JOIN partner_posts p ON p.id=v.post_id WHERE p.showroom_id=$1 AND v.first_seen_at>now()-interval '14 days') AS views14,
           (SELECT count(*)::int FROM partner_offers WHERE to_showroom_id=$1 AND status='pending') AS offers_in,
           (SELECT count(*)::int FROM partner_offers WHERE from_showroom_id=$1 AND status='pending') AS offers_out,
           (SELECT count(*)::int FROM partner_offers WHERE (from_showroom_id=$1 OR to_showroom_id=$1) AND status='accepted'
              AND CASE WHEN from_showroom_id=$1 THEN from_confirmed_at ELSE to_confirmed_at END IS NULL) AS to_confirm,
           (SELECT count(*)::int FROM partner_offers o WHERE (o.from_showroom_id=$1 OR o.to_showroom_id=$1) AND o.status='completed'
              AND NOT EXISTS(SELECT 1 FROM partner_reviews r WHERE r.offer_id=o.id AND r.reviewer_showroom_id=$1)) AS to_review,
           (SELECT count(*)::int FROM partner_alerts WHERE showroom_id=$1) AS alerts,
           (SELECT count(*)::int FROM partner_trusted WHERE showroom_id=$1) AS trusted`, [sid]),
      pool.query('SELECT * FROM partner_reputation WHERE showroom_id=$1', [sid])]);
    const r = d.rows[0];
    res.json({
      showroom: { id: sid, name: req.showroom.name, slug: req.showroom.slug, city: req.showroom.city },
      reputation: mapReputation(rep.rows[0] || {}),
      activePosts: r.active_posts, maxActive: MAX_ACTIVE, expiring: r.expiring, views14: r.views14,
      offersIn: r.offers_in, offersOut: r.offers_out, toConfirm: r.to_confirm, toReview: r.to_review, alerts: r.alerts, trusted: r.trusted,
    });
  } catch (error) { next(error); }
});

// ── تقاضا: از رویدادهای واقعی سایت، تجمیعی و بدون هویت ───────────────────────────────
router.get('/demand', readLimit, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `WITH ev AS (
         SELECT l.make, l.model,
           COALESCE(sum(CASE WHEN e.created_at>now()-interval '14 days' AND e.event_type='view' THEN 1 END),0)::int AS views,
           COALESCE(sum(CASE WHEN e.created_at>now()-interval '14 days' AND e.event_type='contact_click' THEN 1 END),0)::int AS contacts,
           COALESCE(sum(CASE WHEN e.created_at>now()-interval '14 days' AND e.event_type='favorite' THEN 1 END),0)::int AS favorites,
           COALESCE(sum(CASE WHEN e.created_at<=now()-interval '14 days' THEN CASE e.event_type WHEN 'view' THEN 1 WHEN 'contact_click' THEN 5 WHEN 'favorite' THEN 3 ELSE 0 END END),0)::int AS prev_score
         FROM listing_interaction_events e JOIN listings l ON l.id=e.listing_id AND l.status='published' AND l.expires_at>now()
         WHERE e.created_at > now() - interval '28 days' GROUP BY l.make, l.model),
       a AS (SELECT ev.*, (views + contacts*5 + favorites*3) AS score FROM ev)
       SELECT a.*,
         (SELECT count(*)::int FROM listings x WHERE x.status='published' AND x.expires_at>now() AND x.make=a.make AND x.model=a.model) AS supply,
         EXISTS(SELECT 1 FROM listings x WHERE x.showroom_id=$1 AND x.status='published' AND x.expires_at>now() AND x.make=a.make AND x.model=a.model) AS i_have,
         (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY x.price_toman) FROM listings x WHERE x.status='published' AND x.expires_at>now() AND x.make=a.make AND x.model=a.model AND x.price_toman>0) AS median_price,
         (SELECT count(*)::int FROM partner_posts p WHERE p.status='active' AND p.expires_at>now() AND p.hidden_at IS NULL AND p.kind='want' AND lower(p.make)=lower(a.make) AND (p.model='' OR lower(p.model)=lower(a.model))) AS partner_want,
         (SELECT count(*)::int FROM partner_posts p WHERE p.status='active' AND p.expires_at>now() AND p.hidden_at IS NULL AND p.kind='have' AND lower(p.make)=lower(a.make) AND (p.model='' OR lower(p.model)=lower(a.model))) AS partner_have
       FROM a WHERE a.score >= $2 ORDER BY a.score DESC LIMIT 40`, [req.showroom.id, MIN_DEMAND_SCORE]);
    res.json({
      items: rows.map((r) => ({
        make: r.make, model: r.model, views: r.views, contacts: r.contacts, favorites: r.favorites, score: r.score,
        trend: r.prev_score > 0 ? Math.round(((r.score - r.prev_score) / r.prev_score) * 100) : null,
        supply: r.supply, iHave: !!r.i_have, medianPrice: r.median_price == null ? null : Math.round(Number(r.median_price)),
        partnerWant: r.partner_want, partnerHave: r.partner_have, gap: Math.round((r.score / (r.supply + 1)) * 10) / 10,
      })),
    });
  } catch (error) { next(error); }
});

// ── ثبت / ویرایش / بستن آگهی ───────────────────────────────────────────────────────
router.post('/', writeLimit, async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return bad(res, 'INVALID_POST', postIssue(parsed));
    const v = parsed.data;
    const sid = req.showroom.id;
    const result = await transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`partner-post:${sid}`]);
      const c = await client.query("SELECT count(*)::int AS n, count(*) FILTER (WHERE urgent)::int AS urgent FROM partner_posts WHERE showroom_id=$1 AND status='active' AND expires_at>now()", [sid]);
      if (c.rows[0].n >= MAX_ACTIVE) throw err(409, 'POST_LIMIT', `حداکثر ${MAX_ACTIVE} آگهی فعال مجاز است. چند مورد را ببندید.`);
      if (v.urgent && c.rows[0].urgent >= MAX_URGENT) throw err(409, 'URGENT_LIMIT', `حداکثر ${MAX_URGENT} آگهی «فوری» همزمان مجاز است.`);
      let f = { make: v.make, model: v.model, yearFrom: v.yearFrom ?? null, yearTo: v.yearTo ?? null, city: v.city, price: v.priceToman ?? null, mileage: v.mileageKm ?? null, color: v.color, negotiable: v.priceNegotiable, listingId: null };
      if (v.listingId) {
        if (v.kind !== 'have') throw err(400, 'INVALID_POST', 'اتصال به موجودی فقط برای «ماشین دارم» ممکن است.');
        const l = await client.query("SELECT id,make,model,year,city,price_toman,price_negotiable,mileage_km,color FROM listings WHERE id=$1 AND showroom_id=$2 AND status='published' AND expires_at>now()", [v.listingId, sid]);
        if (!l.rows[0]) throw err(404, 'LISTING_NOT_FOUND', 'آگهی انتخاب‌شده در موجودی شما پیدا نشد.');
        const x = l.rows[0];
        f = { make: x.make, model: x.model, yearFrom: x.year, yearTo: x.year, city: x.city || v.city, price: v.priceToman ?? num(x.price_toman), mileage: v.mileageKm ?? x.mileage_km, color: v.color || x.color || '', negotiable: v.priceNegotiable || !!x.price_negotiable, listingId: x.id };
      }
      const ins = await client.query(
        `INSERT INTO partner_posts(showroom_id,owner_id,kind,make,model,year_from,year_to,city,price_toman,note,color,mileage_km,deal_types,commission_percent,price_negotiable,urgent,listing_id,expires_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, now() + make_interval(days => $18::int)) RETURNING id`,
        [sid, req.auth.userId, v.kind, f.make, f.model, f.yearFrom, f.yearTo, f.city, f.price, v.note, f.color, f.mileage, normalizeDeals(v.dealTypes),
          v.kind === 'have' ? v.commissionPercent ?? null : null, f.negotiable, v.urgent, f.listingId, TTL_DAYS]);
      const postId = ins.rows[0].id;
      // 1) آگهی‌های مقابل هم‌خوان
      const m = await client.query(
        `SELECT DISTINCT p.owner_id FROM partner_posts p JOIN showrooms s ON s.id=p.showroom_id AND s.status='approved'
         WHERE p.status='active' AND p.expires_at>now() AND p.hidden_at IS NULL AND p.showroom_id<>$1 AND p.kind<>$2 AND lower(p.make)=lower($3)
           AND ($4::text='' OR p.model='' OR lower(p.model)=lower($4::text))
           AND COALESCE(p.year_from,0)<=COALESCE($6::int,9999) AND COALESCE($5::int,0)<=COALESCE(p.year_to,9999) LIMIT 30`,
        [sid, v.kind, f.make, f.model, f.yearFrom, f.yearTo]);
      // 2) هشدارهای جستجوی ذخیره‌شده
      const a = await client.query(
        `SELECT DISTINCT s.owner_id FROM partner_alerts al JOIN showrooms s ON s.id=al.showroom_id AND s.status='approved'
         WHERE al.showroom_id<>$1 AND lower(al.make)=lower($2) AND (al.kind IS NULL OR al.kind=$3) AND (al.model='' OR lower(al.model)=lower($4::text))
           AND COALESCE(al.year_from,0)<=COALESCE($6::int,9999) AND COALESCE($5::int,0)<=COALESCE(al.year_to,9999)
           AND (al.city='' OR al.city=$7::text) AND (al.price_max IS NULL OR $8::bigint IS NULL OR $8::bigint<=al.price_max) LIMIT 50`,
        [sid, f.make, v.kind, f.model, f.yearFrom, f.yearTo, f.city, f.price]);
      const what = carName(f);
      const matchIds = m.rows.map((r) => r.owner_id);
      const alertIds = a.rows.map((r) => r.owner_id).filter((id) => !matchIds.includes(id));
      const data = { postId, kind: v.kind };
      await notifyMany(client, matchIds, 'partner_match', v.kind === 'have' ? `همکار مناسب: ${what} موجود شد` : `مشتری آماده برای ${what}`,
        v.kind === 'have' ? `«${req.showroom.name}» این خودرو را دارد؛ با درخواست شما در بازار همکاران هم‌خوان است.` : `«${req.showroom.name}» برای این خودرو مشتری دارد؛ با آگهی شما در بازار همکاران هم‌خوان است.`, data);
      await notifyMany(client, alertIds, 'partner_alert', `هشدار شما: ${what}`,
        `«${req.showroom.name}» ${v.kind === 'have' ? 'این خودرو را دارد' : 'برای این خودرو مشتری دارد'}${f.price != null ? ' — ' + money(f.price) : ''}.`, data);
      return { id: postId, notified: matchIds.length + alertIds.length };
    });
    res.status(201).json({ post: result });
  } catch (error) { next(error); }
});

router.put('/:id', writeLimit, async (req, res, next) => {
  try {
    const parsed = editSchema.safeParse(req.body);
    if (!parsed.success) return bad(res, 'INVALID_POST', postIssue(parsed));
    const v = parsed.data;
    const out = await transaction(async (client) => {
      const cur = await client.query("SELECT kind,urgent,listing_id FROM partner_posts WHERE id=$1 AND owner_id=$2 AND status='active' FOR UPDATE", [req.params.id, req.auth.userId]);
      if (!cur.rows[0]) return null;
      if (v.urgent && !cur.rows[0].urgent) {
        const c = await client.query("SELECT count(*)::int AS n FROM partner_posts WHERE showroom_id=$1 AND status='active' AND expires_at>now() AND urgent AND id<>$2", [req.showroom.id, req.params.id]);
        if (c.rows[0].n >= MAX_URGENT) throw err(409, 'URGENT_LIMIT', `حداکثر ${MAX_URGENT} آگهی «فوری» همزمان مجاز است.`);
      }
      const lockedToListing = !!cur.rows[0].listing_id;
      await client.query(
        `UPDATE partner_posts SET make=CASE WHEN $12 THEN make ELSE $2 END, model=CASE WHEN $12 THEN model ELSE $3 END,
           year_from=CASE WHEN $12 THEN year_from ELSE $4 END, year_to=CASE WHEN $12 THEN year_to ELSE $5 END,
           city=$6, price_toman=$7, note=$8, color=$9, mileage_km=$10, deal_types=$11, commission_percent=$13, price_negotiable=$14, urgent=$15, updated_at=now()
         WHERE id=$1`,
        [req.params.id, v.make, v.model, v.yearFrom ?? null, v.yearTo ?? null, v.city, v.priceToman ?? null, v.note, v.color, v.mileageKm ?? null,
          normalizeDeals(v.dealTypes), lockedToListing, cur.rows[0].kind === 'have' ? v.commissionPercent ?? null : null, v.priceNegotiable, v.urgent]);
      return true;
    });
    if (!out) return notFound(res, 'آگهی فعال پیدا نشد.');
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.post('/:id/close', writeLimit, async (req, res, next) => {
  try {
    const reason = z.object({ reason: z.enum(['sold_elsewhere', 'found', 'cancelled']).optional().default('cancelled') }).safeParse(req.body || {});
    const { rowCount } = await pool.query("UPDATE partner_posts SET status='closed',closed_at=now(),closed_reason=$3,updated_at=now() WHERE id=$1 AND owner_id=$2 AND status='active'",
      [req.params.id, req.auth.userId, reason.success ? reason.data.reason : 'cancelled']);
    if (!rowCount) return notFound(res, 'آگهی پیدا نشد.');
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.post('/:id/renew', writeLimit, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "UPDATE partner_posts SET expires_at=now() + make_interval(days => $3::int), renew_count=renew_count+1, updated_at=now() WHERE id=$1 AND owner_id=$2 AND status='active' AND renew_count<$4 RETURNING id",
      [req.params.id, req.auth.userId, TTL_DAYS, MAX_RENEWS]);
    if (!rows[0]) {
      const ex = await pool.query("SELECT 1 FROM partner_posts WHERE id=$1 AND owner_id=$2 AND status='active'", [req.params.id, req.auth.userId]);
      return ex.rowCount ? res.status(409).json({ error: { code: 'RENEW_LIMIT', message: `هر آگهی حداکثر ${MAX_RENEWS} بار قابل تمدید است. آگهی تازه ثبت کنید.` } }) : notFound(res, 'آگهی پیدا نشد.');
    }
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.delete('/:id', writeLimit, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM partner_posts WHERE id=$1 AND owner_id=$2 AND (status='closed' OR NOT EXISTS(SELECT 1 FROM partner_offers o WHERE o.post_id=partner_posts.id AND o.status IN ('pending','accepted')))", [req.params.id, req.auth.userId]);
    if (!rowCount) return res.status(409).json({ error: { code: 'CANNOT_DELETE', message: 'آگهی پیدا نشد یا پیشنهاد در جریان دارد؛ ابتدا آن را ببندید.' } });
    res.status(204).end();
  } catch (error) { next(error); }
});

// ── ذخیره، گزارش ─────────────────────────────────────────────────────────────────
router.post('/:id/save', writeLimit, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      `INSERT INTO partner_saved(showroom_id,post_id) SELECT $1,p.id FROM partner_posts p WHERE p.id=$2 AND p.hidden_at IS NULL ON CONFLICT DO NOTHING`, [req.showroom.id, req.params.id]);
    res.json({ ok: true, saved: true, created: rowCount > 0 });
  } catch (error) { next(error); }
});
router.delete('/:id/save', writeLimit, async (req, res, next) => {
  try { await pool.query('DELETE FROM partner_saved WHERE showroom_id=$1 AND post_id=$2', [req.showroom.id, req.params.id]); res.json({ ok: true, saved: false }); } catch (error) { next(error); }
});

router.post('/:id/report', writeLimit, async (req, res, next) => {
  try {
    const parsed = z.object({ reason: z.enum(REPORT_REASONS) }).strict().safeParse(req.body);
    if (!parsed.success) return bad(res, 'INVALID_REASON', 'دلیل گزارش معتبر نیست.');
    const hidden = await transaction(async (client) => {
      const p = await client.query('SELECT owner_id,showroom_id,make,model FROM partner_posts WHERE id=$1', [req.params.id]);
      if (!p.rows[0] || p.rows[0].showroom_id === req.showroom.id) return null;
      await client.query('INSERT INTO partner_post_reports(post_id,reporter_showroom_id,reason) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [req.params.id, req.showroom.id, parsed.data.reason]);
      const c = await client.query('SELECT count(*)::int AS n FROM partner_post_reports WHERE post_id=$1', [req.params.id]);
      if (c.rows[0].n >= REPORTS_TO_HIDE) {
        const u = await client.query('UPDATE partner_posts SET hidden_at=now() WHERE id=$1 AND hidden_at IS NULL', [req.params.id]);
        if (u.rowCount) await notifyMany(client, [p.rows[0].owner_id], 'partner_hidden', 'آگهی بازار همکاران مخفی شد', `آگهی «${carName(p.rows[0])}» پس از گزارش چند همکار مخفی شد. برای بررسی با پشتیبانی تماس بگیرید.`, { postId: req.params.id });
        return u.rowCount > 0;
      }
      return false;
    });
    if (hidden === null) return notFound(res, 'آگهی پیدا نشد.');
    res.json({ ok: true });
  } catch (error) { next(error); }
});

// ── پیشنهاد همکاری ───────────────────────────────────────────────────────────────
const OFFER_COLS = `o.id,o.status,o.amount_toman,o.commission_percent,o.message,o.created_at,o.responded_at,o.completed_at,o.updated_at,
  (o.from_showroom_id=$2) AS outgoing,
  CASE WHEN o.from_showroom_id=$2 THEN o.from_confirmed_at ELSE o.to_confirmed_at END AS my_confirmed_at,
  CASE WHEN o.from_showroom_id=$2 THEN o.to_confirmed_at ELSE o.from_confirmed_at END AS other_confirmed_at,
  p.id AS post_id,p.kind AS post_kind,p.make,p.model,p.year_from,p.year_to,p.price_toman,p.status AS post_status,
  cs.id AS other_showroom_id,cs.name AS other_name,cs.slug AS other_slug,cs.city AS other_city,cs.owner_id AS other_owner_id,img.public_url AS other_logo,
  rep.deals,rep.partners,rep.rating_avg,rep.rating_count,rep.offers_received,rep.offers_answered,rep.avg_response_hours,
  EXISTS(SELECT 1 FROM partner_reviews r WHERE r.offer_id=o.id AND r.reviewer_showroom_id=$2) AS reviewed`;
const OFFER_FROM = `FROM partner_offers o JOIN partner_posts p ON p.id=o.post_id
  JOIN showrooms cs ON cs.id=CASE WHEN o.from_showroom_id=$2 THEN o.to_showroom_id ELSE o.from_showroom_id END
  JOIN partner_reputation rep ON rep.showroom_id=cs.id LEFT JOIN images img ON img.id=cs.logo_image_id`;
const mapOffer = (r) => ({
  id: r.id, status: r.status, outgoing: !!r.outgoing, amountToman: num(r.amount_toman), commissionPercent: num(r.commission_percent), message: r.message,
  createdAt: r.created_at, respondedAt: r.responded_at, completedAt: r.completed_at, updatedAt: r.updated_at,
  myConfirmed: !!r.my_confirmed_at, otherConfirmed: !!r.other_confirmed_at, reviewed: !!r.reviewed,
  post: { id: r.post_id, kind: r.post_kind, make: r.make, model: r.model, yearFrom: r.year_from, yearTo: r.year_to, priceToman: num(r.price_toman), status: r.post_status },
  other: { id: r.other_showroom_id, name: r.other_name, slug: r.other_slug, city: r.other_city, ownerId: r.other_owner_id, logoUrl: r.other_logo || null, reputation: mapReputation(r) },
});

router.get('/offers', readLimit, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${OFFER_COLS} ${OFFER_FROM} WHERE $1::uuid IS NOT NULL AND (o.from_showroom_id=$2 OR o.to_showroom_id=$2)
       ORDER BY (o.status IN ('pending','accepted')) DESC, o.updated_at DESC LIMIT 100`, [req.auth.userId, req.showroom.id]);
    res.json({ items: rows.map(mapOffer) });
  } catch (error) { next(error); }
});

router.post('/:id/offers', offerLimit, async (req, res, next) => {
  try {
    const parsed = offerSchema.safeParse(req.body || {});
    if (!parsed.success) return bad(res, 'INVALID_OFFER', 'اطلاعات پیشنهاد معتبر نیست.');
    const v = parsed.data;
    const offer = await transaction(async (client) => {
      const p = await client.query(
        `SELECT p.id,p.kind,p.make,p.model,p.owner_id,p.showroom_id FROM partner_posts p
         JOIN showrooms s ON s.id=p.showroom_id AND s.status='approved' JOIN users u ON u.id=p.owner_id AND u.status='active' AND u.deleted_at IS NULL
         WHERE p.id=$1 AND p.status='active' AND p.expires_at>now() AND p.hidden_at IS NULL FOR SHARE OF p`, [req.params.id]);
      const post = p.rows[0];
      if (!post) throw err(404, 'NOT_FOUND', 'آگهی پیدا نشد یا بسته شده است.');
      if (post.showroom_id === req.showroom.id) throw err(400, 'SELF_OFFER', 'برای آگهی خودتان نمی‌توانید پیشنهاد بدهید.');
      const blocked = await client.query('SELECT 1 FROM user_blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1) LIMIT 1', [req.auth.userId, post.owner_id]);
      if (blocked.rows[0]) throw err(403, 'BLOCKED', 'امکان ارسال پیشنهاد وجود ندارد.');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`partner-offer:${req.showroom.id}`]);
      const open = await client.query("SELECT count(*)::int AS n FROM partner_offers WHERE from_showroom_id=$1 AND status='pending'", [req.showroom.id]);
      if (open.rows[0].n >= MAX_OPEN_OFFERS) throw err(409, 'OFFER_LIMIT', `حداکثر ${MAX_OPEN_OFFERS} پیشنهاد در انتظار پاسخ مجاز است.`);
      if (v.myPostId) {
        const mp = await client.query("SELECT 1 FROM partner_posts WHERE id=$1 AND showroom_id=$2 AND status='active' AND kind<>$3", [v.myPostId, req.showroom.id, post.kind]);
        if (!mp.rows[0]) throw err(400, 'INVALID_OFFER', 'آگهی انتخاب‌شده معتبر نیست.');
      }
      let ins;
      try {
        ins = await client.query(
          `INSERT INTO partner_offers(post_id,my_post_id,from_showroom_id,to_showroom_id,from_owner_id,to_owner_id,amount_toman,commission_percent,message)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [post.id, v.myPostId ?? null, req.showroom.id, post.showroom_id, req.auth.userId, post.owner_id, v.amountToman ?? null, v.commissionPercent ?? null, v.message]);
      } catch (e) {
        if (e.code === '23505') throw err(409, 'ALREADY_OFFERED', 'قبلاً برای این آگهی پیشنهاد فعال دارید.');
        throw e;
      }
      await notifyMany(client, [post.owner_id], 'partner_offer', `پیشنهاد همکاری برای ${carName(post)}`,
        `«${req.showroom.name}» ${v.amountToman != null ? 'با مبلغ ' + money(v.amountToman) + ' ' : ''}پیشنهاد همکاری داده است.`, { postId: post.id, offerId: ins.rows[0].id });
      return ins.rows[0];
    });
    res.status(201).json({ offer: { id: offer.id } });
  } catch (error) { next(error); }
});

async function transition(req, res, next, { from, to, who, notify }) {
  try {
    const row = await transaction(async (client) => {
      const o = await client.query(
        `UPDATE partner_offers SET status=$3, responded_at=CASE WHEN $3 IN ('accepted','declined') THEN now() ELSE responded_at END, updated_at=now()
         WHERE id=$1 AND ${who}=$2 AND status=$4 RETURNING id,post_id,from_owner_id,to_owner_id`, [req.params.oid, req.auth.userId, to, from]);
      if (!o.rows[0]) return null;
      const p = await client.query('SELECT make,model FROM partner_posts WHERE id=$1', [o.rows[0].post_id]);
      if (notify) await notifyMany(client, [o.rows[0][notify.to]], notify.type, notify.title(p.rows[0]), notify.body(p.rows[0], req.showroom.name), { postId: o.rows[0].post_id, offerId: o.rows[0].id });
      return o.rows[0];
    });
    if (!row) return notFound(res, 'پیشنهاد پیدا نشد یا وضعیت آن تغییر کرده است.');
    res.json({ ok: true });
  } catch (error) { next(error); }
}
router.post('/offers/:oid/accept', writeLimit, (req, res, next) => transition(req, res, next, { from: 'pending', to: 'accepted', who: 'to_owner_id',
  notify: { to: 'from_owner_id', type: 'partner_offer_update', title: (p) => `پیشنهاد شما پذیرفته شد: ${carName(p)}`, body: (_p, n) => `«${n}» پیشنهاد همکاری شما را پذیرفت. گفت‌وگو کنید و بعد از انجام معامله آن را تأیید کنید.` } }));
router.post('/offers/:oid/decline', writeLimit, (req, res, next) => transition(req, res, next, { from: 'pending', to: 'declined', who: 'to_owner_id',
  notify: { to: 'from_owner_id', type: 'partner_offer_update', title: (p) => `پیشنهاد شما رد شد: ${carName(p)}`, body: (_p, n) => `«${n}» این بار پیشنهاد شما را نپذیرفت.` } }));
router.post('/offers/:oid/withdraw', writeLimit, (req, res, next) => transition(req, res, next, { from: 'pending', to: 'withdrawn', who: 'from_owner_id' }));

// معامله فقط وقتی «تکمیل‌شده» حساب می‌شود که هر دو طرف تأیید کنند؛ اعتبار فقط از همین معاملات ساخته می‌شود.
router.post('/offers/:oid/complete', writeLimit, async (req, res, next) => {
  try {
    const out = await transaction(async (client) => {
      const q = await client.query(
        `SELECT o.*, p.make, p.model FROM partner_offers o JOIN partner_posts p ON p.id=o.post_id
         WHERE o.id=$1 AND (o.from_owner_id=$2 OR o.to_owner_id=$2) AND o.status='accepted' FOR UPDATE OF o`, [req.params.oid, req.auth.userId]);
      const o = q.rows[0];
      if (!o) return null;
      const isFrom = o.from_owner_id === req.auth.userId;
      const otherDone = isFrom ? o.to_confirmed_at : o.from_confirmed_at;
      const other = isFrom ? o.to_owner_id : o.from_owner_id;
      await client.query(`UPDATE partner_offers SET ${isFrom ? 'from_confirmed_at' : 'to_confirmed_at'}=COALESCE(${isFrom ? 'from_confirmed_at' : 'to_confirmed_at'},now()), updated_at=now() WHERE id=$1`, [o.id]);
      if (otherDone) {
        await client.query("UPDATE partner_offers SET status='completed', completed_at=now(), updated_at=now() WHERE id=$1", [o.id]);
        await client.query("UPDATE partner_posts SET status='closed', closed_at=now(), closed_reason='deal', updated_at=now() WHERE id=$1 AND status='active'", [o.post_id]);
        await client.query("UPDATE partner_offers SET status='declined', responded_at=now(), updated_at=now() WHERE post_id=$1 AND status='pending'", [o.post_id]);
        await notifyMany(client, [other], 'partner_deal', `معامله ثبت شد: ${carName(o)}`, `معامله با «${req.showroom.name}» نهایی شد. به همکارتان امتیاز بدهید.`, { postId: o.post_id, offerId: o.id });
        return { completed: true };
      }
      await notifyMany(client, [other], 'partner_deal', `تأیید معامله: ${carName(o)}`, `«${req.showroom.name}» انجام معامله را تأیید کرد. اگر معامله انجام شده، شما هم تأیید کنید.`, { postId: o.post_id, offerId: o.id });
      return { completed: false };
    });
    if (!out) return notFound(res, 'پیشنهاد پذیرفته‌شده‌ای پیدا نشد.');
    res.json({ ok: true, ...out });
  } catch (error) { next(error); }
});

router.post('/offers/:oid/review', writeLimit, async (req, res, next) => {
  try {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) return bad(res, 'INVALID_REVIEW', 'امتیاز معتبر نیست.');
    const v = parsed.data;
    const ok = await transaction(async (client) => {
      const q = await client.query(
        `SELECT o.id,o.from_showroom_id,o.to_showroom_id,o.from_owner_id,o.to_owner_id FROM partner_offers o
         WHERE o.id=$1 AND o.status='completed' AND (o.from_owner_id=$2 OR o.to_owner_id=$2)`, [req.params.oid, req.auth.userId]);
      const o = q.rows[0];
      if (!o) return null;
      const reviewee = o.from_showroom_id === req.showroom.id ? o.to_showroom_id : o.from_showroom_id;
      const revieweeOwner = o.from_showroom_id === req.showroom.id ? o.to_owner_id : o.from_owner_id;
      const ins = await client.query('INSERT INTO partner_reviews(offer_id,reviewer_showroom_id,reviewee_showroom_id,rating,tags,comment) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id',
        [o.id, req.showroom.id, reviewee, v.rating, v.tags, v.comment]);
      if (!ins.rows[0]) throw err(409, 'ALREADY_REVIEWED', 'قبلاً به این همکار امتیاز داده‌اید.');
      await notifyMany(client, [revieweeOwner], 'partner_review', 'امتیاز تازه از یک همکار', `«${req.showroom.name}» به شما ${v.rating} از ۵ امتیاز داد.`, { offerId: o.id });
      return true;
    });
    if (!ok) return notFound(res, 'معامله‌ی تکمیل‌شده‌ای پیدا نشد.');
    res.status(201).json({ ok: true });
  } catch (error) { next(error); }
});

// ── همکاران: پروفایل، مورد اعتماد ──────────────────────────────────────────────────
router.get('/showroom/:sid', readLimit, async (req, res, next) => {
  try {
    const s = await pool.query(
      `SELECT s.id,s.name,s.slug,s.city,s.description,s.owner_id,s.verified_at,s.created_at,img.public_url AS logo_url, rep.*,
              EXISTS(SELECT 1 FROM partner_trusted t WHERE t.showroom_id=$2 AND t.trusted_showroom_id=s.id) AS trusted
       FROM showrooms s JOIN partner_reputation rep ON rep.showroom_id=s.id LEFT JOIN images img ON img.id=s.logo_image_id
       WHERE s.id=$1 AND s.status='approved'`, [req.params.sid, req.showroom.id]);
    const r = s.rows[0];
    if (!r) return notFound(res, 'نمایشگاه پیدا نشد.');
    const [posts, reviews] = await Promise.all([
      pool.query(`SELECT ${POST_COLS} ${POST_FROM} WHERE p.showroom_id=$3 AND ${VISIBLE} AND ${NOT_BLOCKED} ORDER BY p.created_at DESC LIMIT 20`, [req.auth.userId, req.showroom.id, r.id]),
      pool.query(`SELECT rv.rating,rv.tags,rv.comment,rv.created_at,rs.name AS reviewer FROM partner_reviews rv JOIN showrooms rs ON rs.id=rv.reviewer_showroom_id
                  WHERE rv.reviewee_showroom_id=$1 ORDER BY rv.created_at DESC LIMIT 10`, [r.id])]);
    res.json({
      showroom: { id: r.id, name: r.name, slug: r.slug, city: r.city, description: r.description, ownerId: r.owner_id, logoUrl: r.logo_url || null, verified: !!r.verified_at, since: r.created_at, trusted: !!r.trusted, mine: r.id === req.showroom.id, reputation: mapReputation(r) },
      posts: posts.rows.map(mapPost),
      reviews: reviews.rows.map((x) => ({ rating: x.rating, tags: x.tags, comment: x.comment, createdAt: x.created_at, reviewer: x.reviewer })),
    });
  } catch (error) { next(error); }
});

router.get('/trusted', readLimit, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id,s.name,s.slug,s.city,s.owner_id,img.public_url AS logo_url, rep.deals,rep.partners,rep.rating_avg,rep.rating_count,rep.offers_received,rep.offers_answered,rep.avg_response_hours,
              (SELECT count(*)::int FROM partner_posts p WHERE p.showroom_id=s.id AND p.status='active' AND p.expires_at>now() AND p.hidden_at IS NULL) AS active_posts
       FROM partner_trusted t JOIN showrooms s ON s.id=t.trusted_showroom_id AND s.status='approved' JOIN partner_reputation rep ON rep.showroom_id=s.id
       LEFT JOIN images img ON img.id=s.logo_image_id WHERE t.showroom_id=$1 ORDER BY t.created_at DESC LIMIT 100`, [req.showroom.id]);
    res.json({ items: rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, city: r.city, ownerId: r.owner_id, logoUrl: r.logo_url || null, activePosts: r.active_posts, reputation: mapReputation(r) })) });
  } catch (error) { next(error); }
});
router.post('/trusted/:sid', writeLimit, async (req, res, next) => {
  try {
    if (req.params.sid === req.showroom.id) return bad(res, 'SELF', 'نمی‌توانید خودتان را اضافه کنید.');
    const { rowCount } = await pool.query("INSERT INTO partner_trusted(showroom_id,trusted_showroom_id) SELECT $1,s.id FROM showrooms s WHERE s.id=$2 AND s.status='approved' ON CONFLICT DO NOTHING", [req.showroom.id, req.params.sid]);
    if (!rowCount) {
      const ex = await pool.query('SELECT 1 FROM partner_trusted WHERE showroom_id=$1 AND trusted_showroom_id=$2', [req.showroom.id, req.params.sid]);
      if (!ex.rowCount) return notFound(res, 'نمایشگاه پیدا نشد.');
    }
    res.json({ ok: true, trusted: true });
  } catch (error) { next(error); }
});
router.delete('/trusted/:sid', writeLimit, async (req, res, next) => {
  try { await pool.query('DELETE FROM partner_trusted WHERE showroom_id=$1 AND trusted_showroom_id=$2', [req.showroom.id, req.params.sid]); res.json({ ok: true, trusted: false }); } catch (error) { next(error); }
});

// ── هشدار جستجو ─────────────────────────────────────────────────────────────────
router.get('/alerts', readLimit, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id,kind,make,model,year_from,year_to,city,price_max,created_at FROM partner_alerts WHERE showroom_id=$1 ORDER BY created_at DESC', [req.showroom.id]);
    res.json({ items: rows.map((r) => ({ id: r.id, kind: r.kind, make: r.make, model: r.model, yearFrom: r.year_from, yearTo: r.year_to, city: r.city, priceMax: num(r.price_max), createdAt: r.created_at })) });
  } catch (error) { next(error); }
});
router.post('/alerts', writeLimit, async (req, res, next) => {
  try {
    const parsed = alertSchema.safeParse(req.body);
    if (!parsed.success) return bad(res, 'INVALID_ALERT', postIssue(parsed).replace('آگهی', 'هشدار'));
    const v = parsed.data;
    const row = await transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`partner-alert:${req.showroom.id}`]);
      const c = await client.query('SELECT count(*)::int AS n FROM partner_alerts WHERE showroom_id=$1', [req.showroom.id]);
      if (c.rows[0].n >= MAX_ALERTS) throw err(409, 'ALERT_LIMIT', `حداکثر ${MAX_ALERTS} هشدار مجاز است.`);
      return (await client.query('INSERT INTO partner_alerts(showroom_id,kind,make,model,year_from,year_to,city,price_max) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
        [req.showroom.id, v.kind ?? null, v.make, v.model, v.yearFrom ?? null, v.yearTo ?? null, v.city, v.priceMax ?? null])).rows[0];
    });
    res.status(201).json({ alert: { id: row.id } });
  } catch (error) { next(error); }
});
router.delete('/alerts/:aid', writeLimit, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM partner_alerts WHERE id=$1 AND showroom_id=$2', [req.params.aid, req.showroom.id]);
    if (!rowCount) return notFound(res, 'هشدار پیدا نشد.');
    res.status(204).end();
  } catch (error) { next(error); }
});

// ── جزئیات آگهی (باید بعد از مسیرهای ثابت بیاید) ──────────────────────────────────────
router.get('/:id', readLimit, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT ${POST_COLS} ${POST_FROM} WHERE p.id=$3 AND (p.owner_id=$1 OR (${VISIBLE} AND ${NOT_BLOCKED}))`, [req.auth.userId, req.showroom.id, req.params.id]);
    if (!rows[0]) return notFound(res, 'آگهی پیدا نشد.');
    const post = mapPost(rows[0]);
    if (!post.mine) {
      pool.query('INSERT INTO partner_post_views(post_id,showroom_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [post.id, req.showroom.id]).catch(() => {});
      return res.json({ post });
    }
    const offers = await pool.query(`SELECT ${OFFER_COLS} ${OFFER_FROM} WHERE o.post_id=$3 AND o.to_showroom_id=$2 ORDER BY o.created_at DESC LIMIT 30`, [req.auth.userId, req.showroom.id, post.id]);
    res.json({ post, offers: offers.rows.map(mapOffer) });
  } catch (error) { next(error); }
});

export default router;
