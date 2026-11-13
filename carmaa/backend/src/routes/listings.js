import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from '../db.js';
import { authRequired, createRateLimiter } from '../middleware/security.js';
import { parsePositiveInt, uuid } from '../util.js';
import { validateUuidParam } from '../validation.js';

const router = Router();
router.param('id', validateUuidParam);
const writeLimit = createRateLimiter({ name: 'listing-write', windowSeconds: 60, max: 15, key: (req) => req.auth?.userId || req.ip });
const nullablePrice = z.number().int().min(0).max(9_000_000_000_000_000).nullable().optional();
const listingMetadata = z.object({
  adTitle: z.string().trim().max(80).optional().default(''),
  engineType: z.string().trim().max(80).optional().default(''),
  interiorColor: z.string().trim().max(50).optional().default(''),
  driveTrain: z.string().trim().max(80).optional().default(''),
  cylinders: z.string().trim().max(30).optional().default(''),
  engineVolume: z.string().trim().max(40).optional().default(''),
  mileageType: z.enum(['used','zero','presale']).optional().default('used'),
  deliveryTime: z.string().trim().max(100).optional().default(''),
  documentType: z.string().trim().max(100).optional().default(''),
  powerOfAttorneyStatus: z.string().trim().max(60).optional().default(''),
  insuranceStatus: z.string().trim().max(60).optional().default(''),
  region: z.string().trim().max(100).optional().default(''),
  bodyConditionRating: z.number().finite().min(0).max(10).nullable().optional(),
  paintedParts: z.array(z.object({ key: z.string().trim().min(1).max(60), status: z.string().trim().min(1).max(60) }).strict()).max(80).optional().default([]),
  tradeIn: z.boolean().optional().default(false),
  acceptsOffers: z.boolean().optional().default(false),
}).strict().optional().default({});
const listingInput = z.object({
  title: z.string().trim().min(5).max(160), make: z.string().trim().min(1).max(80), model: z.string().trim().min(1).max(100),
  trim: z.string().trim().max(100).optional().default(''), year: z.number().int().min(1950).max(new Date().getFullYear() + 1),
  mileageKm: z.number().int().min(0).max(3_000_000).nullable().optional(), bodyType: z.string().trim().max(40).optional().default(''),
  fuelType: z.string().trim().max(40).optional().default(''), transmission: z.string().trim().max(40).optional().default(''), color: z.string().trim().max(50).optional().default(''),
  conditionNote: z.string().trim().max(1000).optional().default(''), description: z.string().trim().max(5000).optional().default(''), city: z.string().trim().min(2).max(80),
  priceToman: nullablePrice, priceNegotiable: z.boolean().optional().default(false), showroomId: z.string().uuid().nullable().optional(),
  photoIds: z.array(z.string().uuid()).max(12).optional().default([]), minimumOfferToman: nullablePrice, metadata: listingMetadata,
}).strict();
const editable = {
  title: 'title', make: 'make', model: 'model', trim: 'trim', year: 'year', mileageKm: 'mileage_km', bodyType: 'body_type',
  fuelType: 'fuel_type', transmission: 'transmission', color: 'color', conditionNote: 'condition_note', description: 'description',
  city: 'city', priceToman: 'price_toman', priceNegotiable: 'price_negotiable', showroomId: 'showroom_id', metadata: 'metadata',
};

const listingSelect = `SELECT l.id,l.owner_id,l.showroom_id,(l.metadata - 'mapPos' - 'clientKey') AS metadata,l.title,l.make,l.model,l.trim,l.year,l.mileage_km,l.body_type,l.fuel_type,
 l.transmission,l.color,l.condition_note,l.description,l.city,l.price_toman,l.price_negotiable,l.status,l.urgent_until,l.bumped_at,
 l.expires_at,l.view_count,l.created_at,l.updated_at,l.published_at,COALESCE(NULLIF(u.nickname,''),u.display_name) AS seller_name,
 s.slug AS showroom_slug,s.name AS showroom_name,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'url',i.public_url) ORDER BY li.position) FROM listing_images li JOIN images i ON i.id=li.image_id WHERE li.listing_id=l.id),'[]'::jsonb) AS photos
 FROM listings l JOIN users u ON u.id=l.owner_id LEFT JOIN showrooms s ON s.id=l.showroom_id`;

router.get('/', async (req, res, next) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 2_000);
    const pageSize = parsePositiveInt(req.query.page_size, 20, 50);
    const conditions = ["l.status='published'", 'l.expires_at > now()', "u.status='active'", 'u.deleted_at IS NULL'];
    const values = [];
    const add = (clause, value) => { values.push(value); conditions.push(clause.replace('?', `$${values.length}`)); };
    if (typeof req.query.city === 'string' && req.query.city.length <= 80) add('l.city = ?', req.query.city.trim());
    if (typeof req.query.make === 'string' && req.query.make.length <= 80) add('l.make ILIKE ?', req.query.make.trim());
    if (typeof req.query.model === 'string' && req.query.model.length <= 100) add('l.model ILIKE ?', `%${req.query.model.trim().replace(/[%_\\]/g, '\\$&')}%`);
    if (req.query.year_min && /^\d{4}$/.test(String(req.query.year_min))) add('l.year >= ?', Number(req.query.year_min));
    if (req.query.year_max && /^\d{4}$/.test(String(req.query.year_max))) add('l.year <= ?', Number(req.query.year_max));
    if (req.query.price_min && /^\d+$/.test(String(req.query.price_min))) add('l.price_toman >= ?', String(req.query.price_min));
    if (req.query.price_max && /^\d+$/.test(String(req.query.price_max))) add('l.price_toman <= ?', String(req.query.price_max));
    if (typeof req.query.q === 'string' && req.query.q.trim().length && req.query.q.length <= 100) {
      values.push(`%${req.query.q.trim().replace(/[%_\\]/g, '\\$&')}%`); const p = `$${values.length}`;
      conditions.push(`(l.title ILIKE ${p} OR l.make ILIKE ${p} OR l.model ILIKE ${p} OR l.city ILIKE ${p})`);
    }
    const offset = (page - 1) * pageSize;
    const { rows } = await pool.query(`${listingSelect} WHERE ${conditions.join(' AND ')} ORDER BY l.bumped_at DESC NULLS LAST, l.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`, values);
    res.json({ items: rows, page, pageSize });
  } catch (error) { next(error); }
});

router.get('/mine', authRequired, async (req, res, next) => {
  try {
    // Seller-only threshold is deliberately added to this authenticated query, never the public DTO.
    const mineSelect = listingSelect.replace(' l.expires_at,l.view_count,l.created_at,l.updated_at,l.published_at,', ' l.expires_at,l.view_count,l.created_at,l.updated_at,l.published_at,l.rejection_reason,').replace(' FROM listings l', ',(SELECT p.minimum_offer_toman FROM listing_private_details p WHERE p.listing_id=l.id AND p.owner_id=l.owner_id) AS minimum_offer_toman FROM listings l');
    const { rows } = await pool.query(`${mineSelect} WHERE l.owner_id=$1 AND l.status <> 'archived' ORDER BY l.created_at DESC LIMIT 100`, [req.auth.userId]);
    res.json({ items: rows });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id).slice(0, 100);
    const { rows } = await pool.query(`${listingSelect} WHERE l.id=$1 AND l.status='published' AND l.expires_at > now() LIMIT 1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'آگهی پیدا نشد.' } });
    pool.query('UPDATE listings SET view_count=view_count+1 WHERE id=$1', [id]).catch(() => {});
    // Event history is retained separately from the aggregate counter for daily seller analytics.
    pool.query("INSERT INTO listing_interaction_events(listing_id,event_type) VALUES($1,'view')", [id]).catch(() => {});
    res.json({ listing: rows[0] });
  } catch (error) { next(error); }
});

router.post('/', authRequired, writeLimit, async (req, res, next) => {
  try {
    const parsed = listingInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_LISTING', message: 'اطلاعات آگهی معتبر نیست.', issues: parsed.error.issues.map((i) => ({ field: i.path.join('.'), code: i.code })) } });
    const input = parsed.data;
    if (!input.metadata.acceptsOffers && input.minimumOfferToman != null) return res.status(400).json({ error: { code: 'OFFERS_DISABLED', message: 'حداقل پیشنهاد فقط زمانی قابل ثبت است که دریافت پیشنهاد فعال باشد.' } });
    const id = uuid();
    // Same click sent twice (double tap, retry after a slow response) must not create two ads.
    const rawKey = String(req.get('Idempotency-Key') || '').trim();
    const clientKey = /^[A-Za-z0-9_.:-]{8,100}$/.test(rawKey) ? rawKey : '';
    let duplicate = false;
    const listing = await transaction(async (client) => {
      // One create at a time per user: concurrent duplicates wait here and then see the first ad.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`listing-create:${req.auth.userId}`]);
      if (clientKey) {
        const same = await client.query("SELECT * FROM listings WHERE owner_id=$1 AND metadata->>'clientKey'=$2 AND status <> 'archived' LIMIT 1", [req.auth.userId, clientKey]);
        if (same.rows[0]) { duplicate = true; return same.rows[0]; }
      }
      const twin = await client.query(
        `SELECT * FROM listings WHERE owner_id=$1 AND status <> 'archived' AND created_at > now() - interval '2 minutes'
           AND title=$2 AND make=$3 AND model=$4 AND year=$5 AND city=$6 AND description=$7
           AND price_toman IS NOT DISTINCT FROM $8::bigint AND mileage_km IS NOT DISTINCT FROM $9::int ORDER BY created_at DESC LIMIT 1`,
        [req.auth.userId, input.title, input.make, input.model, input.year, input.city, input.description, input.priceToman ?? null, input.mileageKm ?? null]);
      if (twin.rows[0]) { duplicate = true; return twin.rows[0]; }
      if (input.showroomId) {
        const r = await client.query("SELECT id FROM showrooms WHERE id=$1 AND owner_id=$2 AND status='approved'", [input.showroomId, req.auth.userId]);
        if (!r.rows[0]) throw Object.assign(new Error('نمایشگاه تاییدشده متعلق به شما نیست.'), { status: 400, code: 'INVALID_SHOWROOM' });
      }
      if (input.photoIds.length) {
        const owned = await client.query('SELECT id FROM images WHERE owner_id=$1 AND id = ANY($2::uuid[])', [req.auth.userId, input.photoIds]);
        if (owned.rowCount !== new Set(input.photoIds).size || new Set(input.photoIds).size !== input.photoIds.length) throw Object.assign(new Error('یک یا چند تصویر نامعتبر است.'), { status: 400, code: 'INVALID_IMAGES' });
      }
      const { rows } = await client.query(
        `INSERT INTO listings(id,owner_id,showroom_id,title,make,model,trim,year,mileage_km,body_type,fuel_type,transmission,color,condition_note,description,city,price_toman,price_negotiable,metadata,status)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,'pending') RETURNING *`,
        [id, req.auth.userId, input.showroomId || null, input.title, input.make, input.model, input.trim, input.year, input.mileageKm ?? null,
          input.bodyType, input.fuelType, input.transmission, input.color, input.conditionNote, input.description, input.city, input.priceToman ?? null, input.priceNegotiable, JSON.stringify(clientKey ? { ...input.metadata, clientKey } : input.metadata)]);
      for (let index = 0; index < input.photoIds.length; index++) await client.query('INSERT INTO listing_images(listing_id,image_id,position) VALUES($1,$2,$3)', [id, input.photoIds[index], index]);
      await client.query('INSERT INTO listing_private_details(listing_id,owner_id,minimum_offer_toman) VALUES($1,$2,$3)', [id, req.auth.userId, input.minimumOfferToman ?? null]);
      if (input.priceToman != null) await client.query('INSERT INTO listing_price_history(listing_id,old_price_toman,new_price_toman) VALUES($1,NULL,$2)', [id, input.priceToman]);
      return rows[0];
    });
    res.status(duplicate ? 200 : 201).json({ listing, duplicate });
  } catch (error) { next(error); }
});

router.patch('/:id', authRequired, writeLimit, async (req, res, next) => {
  try {
    const schema = listingInput.partial().strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data || {}).length === 0) return res.status(400).json({ error: { code: 'INVALID_LISTING', message: 'تغییرات آگهی معتبر نیست.' } });
    const input = parsed.data;
    if (input.metadata && input.metadata.acceptsOffers === false && input.minimumOfferToman != null) return res.status(400).json({ error: { code: 'OFFERS_DISABLED', message: 'حداقل پیشنهاد فقط زمانی قابل ثبت است که دریافت پیشنهاد فعال باشد.' } });
    const updated = await transaction(async (client) => {
      const existing = await client.query('SELECT * FROM listings WHERE id=$1 AND owner_id=$2 FOR UPDATE', [req.params.id, req.auth.userId]);
      const before = existing.rows[0];
      if (!before || before.status === 'archived') throw Object.assign(new Error('آگهی پیدا نشد.'), { status: 404, code: 'NOT_FOUND' });
      if (input.showroomId) {
        const show = await client.query("SELECT id FROM showrooms WHERE id=$1 AND owner_id=$2 AND status='approved'", [input.showroomId, req.auth.userId]);
        if (!show.rows[0]) throw Object.assign(new Error('نمایشگاه تاییدشده متعلق به شما نیست.'), { status: 400, code: 'INVALID_SHOWROOM' });
      }
      if (input.photoIds) {
        const ids = [...new Set(input.photoIds)];
        const owned = ids.length ? await client.query('SELECT id FROM images WHERE owner_id=$1 AND id = ANY($2::uuid[])', [req.auth.userId, ids]) : { rowCount: 0 };
        if (owned.rowCount !== ids.length || ids.length !== input.photoIds.length) throw Object.assign(new Error('یک یا چند تصویر نامعتبر است.'), { status: 400, code: 'INVALID_IMAGES' });
        await client.query('DELETE FROM listing_images WHERE listing_id=$1', [req.params.id]);
        for (let i = 0; i < input.photoIds.length; i++) await client.query('INSERT INTO listing_images(listing_id,image_id,position) VALUES($1,$2,$3)', [req.params.id, input.photoIds[i], i]);
      }
      const sets = [], values = [];
      for (const [key, column] of Object.entries(editable)) if (Object.hasOwn(input, key)) { values.push(input[key] === undefined ? null : input[key]); sets.push(`${column}=$${values.length}`); }
      const touchesListing = Object.keys(input).some((key) => key !== 'minimumOfferToman');
      if (touchesListing && ['published', 'rejected'].includes(before.status)) { values.push('pending'); sets.push(`status=$${values.length}`); sets.push('published_at=NULL'); sets.push('rejection_reason=NULL'); }
      if (sets.length) {
        values.push(req.params.id); const idPos = values.length;
        values.push(req.auth.userId); const ownerPos = values.length;
        await client.query(`UPDATE listings SET ${sets.join(',')},updated_at=now() WHERE id=$${idPos} AND owner_id=$${ownerPos}`, values);
      }
      if (Object.hasOwn(input, 'priceToman') && String(input.priceToman ?? '') !== String(before.price_toman ?? '')) {
        await client.query('INSERT INTO listing_price_history(listing_id,old_price_toman,new_price_toman) VALUES($1,$2,$3)', [req.params.id, before.price_toman, input.priceToman ?? null]);
      }
      if (Object.hasOwn(input, 'minimumOfferToman') || input.metadata?.acceptsOffers === false) await client.query(
        `INSERT INTO listing_private_details(listing_id,owner_id,minimum_offer_toman) VALUES($1,$2,$3)
         ON CONFLICT(listing_id) DO UPDATE SET minimum_offer_toman=EXCLUDED.minimum_offer_toman,updated_at=now()
         WHERE listing_private_details.owner_id=EXCLUDED.owner_id`, [req.params.id, req.auth.userId, input.metadata?.acceptsOffers === false ? null : (input.minimumOfferToman ?? null)]);
      const { rows } = await client.query('SELECT * FROM listings WHERE id=$1', [req.params.id]);
      return rows[0];
    });
    res.json({ listing: updated });
  } catch (error) { next(error); }
});

router.delete('/:id', authRequired, writeLimit, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query("UPDATE listings SET status='archived',archived_at=now(),updated_at=now() WHERE id=$1 AND owner_id=$2 AND status <> 'archived'", [req.params.id, req.auth.userId]);
    if (!rowCount) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'آگهی پیدا نشد.' } });
    res.status(204).end();
  } catch (error) { next(error); }
});

router.post('/:id/favorite', authRequired, writeLimit, async (req, res, next) => {
  try {
    const { rows: listing } = await pool.query("SELECT id FROM listings WHERE id=$1 AND status='published'", [req.params.id]);
    if (!listing[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'آگهی پیدا نشد.' } });
    const exists = await pool.query('DELETE FROM listing_favorites WHERE user_id=$1 AND listing_id=$2 RETURNING listing_id', [req.auth.userId, req.params.id]);
    if (exists.rowCount) return res.json({ favorite: false });
    await pool.query('INSERT INTO listing_favorites(user_id,listing_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [req.auth.userId, req.params.id]);
    res.json({ favorite: true });
  } catch (error) { next(error); }
});

router.post('/:id/offers', authRequired, writeLimit, async (req, res, next) => {
  try {
    const parsed = z.object({ amountToman: z.number().int().min(1).max(9_000_000_000_000_000), message: z.string().trim().max(1000).optional().default('') }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_OFFER', message: 'مبلغ یا متن پیشنهاد معتبر نیست.' } });
    const offer = await transaction(async (client) => {
      const { rows } = await client.query("SELECT l.id,l.owner_id,l.status,l.metadata,p.minimum_offer_toman FROM listings l LEFT JOIN listing_private_details p ON p.listing_id=l.id WHERE l.id=$1 FOR UPDATE OF l", [req.params.id]);
      const listing = rows[0];
      if (!listing || listing.status !== 'published') throw Object.assign(new Error('آگهی پیدا نشد.'), { status: 404, code: 'NOT_FOUND' });
      if (listing.owner_id === req.auth.userId) throw Object.assign(new Error('نمی‌توانید برای آگهی خودتان پیشنهاد ارسال کنید.'), { status: 400, code: 'SELF_OFFER' });
      if (listing.metadata?.acceptsOffers !== true) throw Object.assign(new Error('فروشنده برای این آگهی دریافت پیشنهاد قیمت را فعال نکرده است.'), { status: 409, code: 'OFFERS_DISABLED' });
      const open = await client.query("SELECT 1 FROM listing_offers WHERE listing_id=$1 AND buyer_id=$2 AND status='pending' LIMIT 1", [req.params.id, req.auth.userId]);
      if (open.rows[0]) throw Object.assign(new Error('شما یک پیشنهاد در انتظار بررسی برای این آگهی دارید؛ ابتدا آن را پس بگیرید.'), { status: 409, code: 'OFFER_PENDING' });
      const { rows: offerRows } = await client.query('INSERT INTO listing_offers(listing_id,buyer_id,amount_toman,message) VALUES($1,$2,$3,$4) RETURNING id,listing_id,buyer_id,amount_toman,message,status,created_at', [req.params.id, req.auth.userId, parsed.data.amountToman, parsed.data.message]);
      // Compare with minimum only on the server. Do not return the threshold to the buyer.
      await client.query('INSERT INTO notifications(user_id,type,title,body,data) VALUES($1,\'offer\',\'پیشنهاد جدید\',\'برای آگهی شما پیشنهاد جدیدی ثبت شده است.\',$2)', [listing.owner_id, { listingId: req.params.id, offerId: offerRows[0].id, buyerId: req.auth.userId, meetsMinimum: listing.minimum_offer_toman == null ? null : parsed.data.amountToman >= Number(listing.minimum_offer_toman) }]);
      return offerRows[0];
    });
    res.status(201).json({ offer });
  } catch (error) { next(error); }
});

router.get('/:id/price-history', async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT h.old_price_toman,h.new_price_toman,h.changed_at FROM listing_price_history h JOIN listings l ON l.id=h.listing_id WHERE h.listing_id=$1 AND l.status='published' ORDER BY h.changed_at DESC LIMIT 100", [req.params.id]);
    res.json({ items: rows });
  } catch (error) { next(error); }
});

export default router;
