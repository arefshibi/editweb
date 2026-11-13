import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from '../db.js';
import { authRequired, requireRole, requirePerm, PERMISSIONS, staffMfa } from '../middleware/security.js';
import { parsePositiveInt, normalizePhone } from '../util.js';
import { validateUuidParam } from '../validation.js';

const router = Router();
router.param('id', validateUuidParam);
router.use(authRequired, requireRole('moderator','admin'), staffMfa);

router.get('/overview', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT
      (SELECT count(*)::int FROM users WHERE status='active') AS active_users,
      (SELECT count(*)::int FROM listings WHERE status='pending') AS pending_listings,
      (SELECT count(*)::int FROM showrooms WHERE status='pending') AS pending_showrooms,
      (SELECT count(*)::int FROM reports WHERE status IN ('new','reviewing')) AS open_reports,
      (SELECT count(*)::int FROM payment_orders WHERE status='paid' AND paid_at > now()-interval '30 days') AS paid_orders_30d`);
    res.json({ overview: rows[0] });
  } catch (error) { next(error); }
});

/* آمار داشبورد: سری‌های روزانه و تفکیک وضعیت (فقط خواندنی) */
router.get('/stats', async (req, res, next) => {
  try {
    const days = Math.min(90, Math.max(7, parsePositiveInt(req.query.days, 30, 90)));
    const series = await pool.query(`
      WITH d AS (SELECT generate_series((now() AT TIME ZONE 'Asia/Tehran')::date - ($1::int - 1), (now() AT TIME ZONE 'Asia/Tehran')::date, interval '1 day')::date AS day)
      SELECT to_char(d.day,'YYYY-MM-DD') AS day,
        (SELECT count(*)::int FROM listings l WHERE (l.created_at AT TIME ZONE 'Asia/Tehran')::date = d.day) AS listings,
        (SELECT count(*)::int FROM users u WHERE (u.created_at AT TIME ZONE 'Asia/Tehran')::date = d.day) AS users,
        (SELECT count(*)::int FROM reports r WHERE (r.created_at AT TIME ZONE 'Asia/Tehran')::date = d.day) AS reports,
        (SELECT COALESCE(sum(p.amount_toman),0)::bigint FROM payment_orders p WHERE p.status='paid' AND (p.paid_at AT TIME ZONE 'Asia/Tehran')::date = d.day) AS revenue
      FROM d ORDER BY d.day`, [days]);
    const byStatus = await pool.query(`SELECT status::text AS status, count(*)::int AS n FROM listings GROUP BY status`);
    const totals = await pool.query(`SELECT
      (SELECT count(*)::int FROM listings) AS listings,
      (SELECT count(*)::int FROM users WHERE deleted_at IS NULL) AS users,
      (SELECT count(*)::int FROM showrooms) AS showrooms,
      (SELECT COALESCE(sum(amount_toman),0)::bigint FROM payment_orders WHERE status='paid') AS revenue_all`);
    const makes = await pool.query(`SELECT make, count(*)::int AS n FROM listings WHERE status='published' GROUP BY make ORDER BY n DESC, make LIMIT 5`);
    res.json({ days, series: series.rows, listings_by_status: byStatus.rows, totals: totals.rows[0], top_makes: makes.rows });
  } catch (error) { next(error); }
});

router.get('/listings', requirePerm('listings'), async (req, res, next) => {
  try {
    const status = ['pending','published','rejected','archived'].includes(String(req.query.status)) ? String(req.query.status) : 'pending';
    const size = parsePositiveInt(req.query.limit, 50, 100);
    const { rows } = await pool.query(`SELECT l.id,l.title,l.make,l.model,l.year,l.city,l.price_toman,l.status,l.rejection_reason,l.created_at,l.updated_at,u.id AS owner_id,u.phone_e164,u.display_name,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'url',i.public_url) ORDER BY li.position) FROM listing_images li JOIN images i ON i.id=li.image_id WHERE li.listing_id=l.id),'[]'::jsonb) AS photos
      FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.status=$1 ORDER BY l.created_at ASC LIMIT $2`, [status,size]);
    res.json({ items:rows });
  } catch (error) { next(error); }
});

router.patch('/listings/:id/review', requirePerm('listings'), async (req, res, next) => {
  try {
    const parsed = z.object({ status:z.enum(['published','rejected','archived']), reason:z.string().trim().max(1000).optional().default('') }).strict().safeParse(req.body);
    if (!parsed.success || (parsed.data.status === 'rejected' && parsed.data.reason.length < 3)) return res.status(400).json({ error:{code:'INVALID_REVIEW',message:'وضعیت یا دلیل بررسی معتبر نیست.'} });
    const result = await transaction(async (client) => {
      const { rows } = await client.query('SELECT id,owner_id,title,status FROM listings WHERE id=$1 FOR UPDATE', [req.params.id]);
      const listing = rows[0];
      if (!listing) throw Object.assign(new Error('آگهی پیدا نشد.'),{status:404,code:'NOT_FOUND'});
      const changed = await client.query(
        `UPDATE listings SET status=$2::listing_status,rejection_reason=$3,published_at=CASE WHEN $2::listing_status='published' THEN COALESCE(published_at,now()) ELSE NULL END,
         archived_at=CASE WHEN $2::listing_status='archived' THEN now() ELSE NULL END,updated_at=now() WHERE id=$1 RETURNING id,status,rejection_reason,updated_at`,
        [req.params.id,parsed.data.status,parsed.data.status==='rejected'?parsed.data.reason:null]);
      await client.query('INSERT INTO notifications(user_id,type,title,body,data) VALUES($1,$2,$3,$4,$5)', [listing.owner_id,'listing_review', parsed.data.status==='published'?'آگهی شما تأیید شد':parsed.data.status==='rejected'?'آگهی نیاز به اصلاح دارد':'آگهی بایگانی شد', parsed.data.status==='rejected'?parsed.data.reason:parsed.data.status==='published'?'آگهی شما اکنون در سایت نمایش داده می‌شود.':'آگهی شما از دسترس عمومی خارج شد.', {listingId:listing.id,status:parsed.data.status}]);
      await client.query('INSERT INTO admin_audit_logs(actor_id,action,target_type,target_id,metadata,request_id) VALUES($1,$2,\'listing\',$3,$4,$5)', [req.auth.userId,`listing.${parsed.data.status}`,listing.id,{reason:parsed.data.reason},req.id||null]);
      return changed.rows[0];
    });
    res.json({ listing:result });
  } catch (error) { next(error); }
});

// ---- مدیریت همه‌ی آگهی‌ها: لیست کامل، ویرایش و حذف توسط ادمین ----
const adminListingEdit = z.object({
  adTitle: z.string().trim().max(80).optional(),
  make: z.string().trim().min(1).max(80).optional(),
  model: z.string().trim().min(1).max(100).optional(),
  year: z.number().int().min(1950).max(new Date().getFullYear() + 1).optional(),
  city: z.string().trim().min(2).max(80).optional(),
  priceToman: z.number().int().min(0).max(9_000_000_000_000_000).nullable().optional(),
  priceNegotiable: z.boolean().optional(),
  description: z.string().trim().max(5000).optional(),
}).strict();

router.get('/listings-all', requirePerm('listings'), async (req, res, next) => {
  try {
    const status = ['pending','published','rejected','archived','all'].includes(String(req.query.status)) ? String(req.query.status) : 'published';
    const size = parsePositiveInt(req.query.limit, 20, 50);
    const page = parsePositiveInt(req.query.page, 1, 5000);
    const values = [];
    const cond = ["l.status <> 'draft'"];
    if (status !== 'all') { values.push(status); cond.push(`l.status=$${values.length}`); }
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    if (q) {
      values.push(`%${q.replace(/[%_\\]/g, '\\$&')}%`); const p = `$${values.length}`;
      cond.push(`(l.title ILIKE ${p} OR l.make ILIKE ${p} OR l.model ILIKE ${p} OR l.city ILIKE ${p} OR (l.metadata->>'adTitle') ILIKE ${p} OR u.phone_e164 ILIKE ${p} OR u.display_name ILIKE ${p})`);
    }
    const where = `WHERE ${cond.join(' AND ')}`;
    const count = await pool.query(`SELECT count(*)::int AS n FROM listings l JOIN users u ON u.id=l.owner_id ${where}`, values);
    values.push(size, (page - 1) * size);
    const { rows } = await pool.query(`SELECT l.id,l.title,l.make,l.model,l.year,l.city,l.price_toman,l.price_negotiable,l.description,l.status,l.rejection_reason,l.created_at,l.updated_at,
      (l.metadata->>'adTitle') AS ad_title,u.id AS owner_id,u.phone_e164,u.display_name,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'url',i.public_url) ORDER BY li.position) FROM listing_images li JOIN images i ON i.id=li.image_id WHERE li.listing_id=l.id),'[]'::jsonb) AS photos
      FROM listings l JOIN users u ON u.id=l.owner_id ${where} ORDER BY l.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
    res.json({ items: rows, total: count.rows[0].n, page, pageSize: size });
  } catch (error) { next(error); }
});

router.patch('/listings/:id', requirePerm('listings'), async (req, res, next) => {
  try {
    const parsed = adminListingEdit.safeParse(req.body);
    if (!parsed.success || !Object.keys(parsed.data).length) return res.status(400).json({ error: { code: 'INVALID_LISTING', message: 'تغییرات آگهی معتبر نیست.' } });
    const input = parsed.data;
    const listing = await transaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM listings WHERE id=$1 FOR UPDATE', [req.params.id]);
      const before = rows[0];
      if (!before) throw Object.assign(new Error('آگهی پیدا نشد.'), { status: 404, code: 'NOT_FOUND' });
      const sets = [], values = [];
      const add = (column, value) => { values.push(value); sets.push(`${column}=$${values.length}`); };
      if (input.make !== undefined) add('make', input.make);
      if (input.model !== undefined) add('model', input.model);
      if (input.year !== undefined) add('year', input.year);
      if (input.city !== undefined) add('city', input.city);
      if (input.priceToman !== undefined) add('price_toman', input.priceToman);
      if (input.priceNegotiable !== undefined) add('price_negotiable', input.priceNegotiable);
      if (input.description !== undefined) add('description', input.description);
      if (input.make !== undefined || input.model !== undefined || input.year !== undefined) {
        add('title', `${input.year ?? before.year} ${input.make ?? before.make} ${input.model ?? before.model}`.slice(0, 160));
      }
      if (input.adTitle !== undefined) { values.push(JSON.stringify({ adTitle: input.adTitle })); sets.push(`metadata=COALESCE(metadata,'{}'::jsonb) || $${values.length}::jsonb`); }
      values.push(req.params.id);
      const updated = await client.query(`UPDATE listings SET ${sets.join(',')},updated_at=now() WHERE id=$${values.length} RETURNING id,status,title,updated_at`, values);
      if (Object.hasOwn(input, 'priceToman') && String(input.priceToman ?? '') !== String(before.price_toman ?? '')) {
        await client.query('INSERT INTO listing_price_history(listing_id,old_price_toman,new_price_toman) VALUES($1,$2,$3)', [req.params.id, before.price_toman, input.priceToman ?? null]);
      }
      await client.query('INSERT INTO admin_audit_logs(actor_id,action,target_type,target_id,metadata,request_id) VALUES($1,$2,\'listing\',$3,$4,$5)', [req.auth.userId, 'listing.admin_edit', before.id, { fields: Object.keys(input) }, req.id || null]);
      return updated.rows[0];
    });
    res.json({ listing });
  } catch (error) { next(error); }
});

router.delete('/listings/:id', requirePerm('listings'), async (req, res, next) => {
  try {
    await transaction(async (client) => {
      const { rows } = await client.query('SELECT id,owner_id,title,status FROM listings WHERE id=$1 FOR UPDATE', [req.params.id]);
      const listing = rows[0];
      if (!listing) throw Object.assign(new Error('آگهی پیدا نشد.'), { status: 404, code: 'NOT_FOUND' });
      await client.query("UPDATE listings SET status='archived',archived_at=now(),updated_at=now() WHERE id=$1", [listing.id]);
      await client.query('INSERT INTO notifications(user_id,type,title,body,data) VALUES($1,$2,$3,$4,$5)', [listing.owner_id, 'listing_review', 'آگهی شما حذف شد', 'آگهی شما توسط مدیریت از سایت برداشته شد.', { listingId: listing.id, status: 'archived' }]);
      await client.query('INSERT INTO admin_audit_logs(actor_id,action,target_type,target_id,metadata,request_id) VALUES($1,$2,\'listing\',$3,$4,$5)', [req.auth.userId, 'listing.admin_delete', listing.id, { title: listing.title, previousStatus: listing.status }, req.id || null]);
    });
    res.status(204).end();
  } catch (error) { next(error); }
});

router.get('/showrooms', requirePerm('showrooms'), async (req, res, next) => {
  try {
    const status = ['pending','approved','rejected','suspended'].includes(String(req.query.status)) ? String(req.query.status) : 'pending';
    const { rows } = await pool.query('SELECT s.*,u.phone_e164,u.display_name AS owner_name FROM showrooms s JOIN users u ON u.id=s.owner_id WHERE s.status=$1 ORDER BY s.created_at ASC LIMIT 100', [status]);
    res.json({ items:rows });
  } catch (error) { next(error); }
});
router.patch('/showrooms/:id/review', requirePerm('showrooms'), async (req,res,next) => {
  try {
    const parsed = z.object({status:z.enum(['approved','rejected','suspended']),reason:z.string().trim().max(1000).optional().default('')}).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error:{code:'INVALID_REVIEW',message:'وضعیت بررسی معتبر نیست.'}});
    const result = await transaction(async (client) => {
      const {rows}=await client.query('SELECT id,owner_id,name FROM showrooms WHERE id=$1 FOR UPDATE',[req.params.id]);
      if(!rows[0]) throw Object.assign(new Error('نمایشگاه پیدا نشد.'),{status:404,code:'NOT_FOUND'});
      const {rows:updated}=await client.query('UPDATE showrooms SET status=$2::text,verified_at=CASE WHEN $2::text=\'approved\' THEN now() ELSE NULL END,updated_at=now() WHERE id=$1 RETURNING id,status,verified_at',[req.params.id,parsed.data.status]);
      if (parsed.data.status === 'approved') {
        await client.query('SELECT pg_advisory_xact_lock(724190261)');
        await client.query('UPDATE showrooms SET founding_number=(SELECT COALESCE(max(founding_number),0)+1 FROM showrooms) WHERE id=$1 AND founding_number IS NULL AND (SELECT count(*) FROM showrooms WHERE founding_number IS NOT NULL)<15',[req.params.id]);
      }
      await client.query('INSERT INTO notifications(user_id,type,title,body,data) VALUES($1,\'showroom_review\',$2,$3,$4)',[rows[0].owner_id,parsed.data.status==='approved'?'نمایشگاه تأیید شد':'وضعیت نمایشگاه تغییر کرد',parsed.data.reason||`وضعیت نمایشگاه شما: ${parsed.data.status}`,{showroomId:req.params.id,status:parsed.data.status}]);
      await client.query('INSERT INTO admin_audit_logs(actor_id,action,target_type,target_id,metadata,request_id) VALUES($1,$2,\'showroom\',$3,$4,$5)',[req.auth.userId,`showroom.${parsed.data.status}`,req.params.id,{reason:parsed.data.reason},req.id||null]);
      return updated[0];
    });
    res.json({showroom:result});
  } catch(error){next(error);}
});

router.get('/reports', requirePerm('reports'), async (req,res,next) => {
  try {
    const status = ['new','reviewing','resolved','dismissed'].includes(String(req.query.status)) ? String(req.query.status) : 'new';
    const size = parsePositiveInt(req.query.limit,50,100);
    const {rows}=await pool.query(`SELECT r.id,r.reason,r.details,r.status,r.created_at,r.listing_id,r.reported_user_id,r.message_id,
      reporter.display_name AS reporter_name,reporter.phone_e164 AS reporter_phone,subject.display_name AS reported_name,
      l.title AS listing_title FROM reports r JOIN users reporter ON reporter.id=r.reporter_id
      LEFT JOIN users subject ON subject.id=r.reported_user_id LEFT JOIN listings l ON l.id=r.listing_id
      WHERE r.status=$1 ORDER BY r.created_at DESC LIMIT $2`,[status,size]);
    res.json({items:rows});
  } catch(error){next(error);}
});
router.patch('/reports/:id', requirePerm('reports'), async (req,res,next) => {
  try {
    const parsed=z.object({status:z.enum(['reviewing','resolved','dismissed']),resolutionNote:z.string().trim().max(1000).optional().default('')}).strict().safeParse(req.body);
    if(!parsed.success)return res.status(400).json({error:{code:'INVALID_REPORT_STATUS',message:'وضعیت گزارش معتبر نیست.'}});
    const {rows}=await pool.query(`UPDATE reports SET status=$2::report_status,resolution_note=$3,resolved_by=$4,resolved_at=CASE WHEN $2::report_status IN ('resolved','dismissed') THEN now() ELSE NULL END
      WHERE id=$1 RETURNING id,status,resolution_note,resolved_at`,[req.params.id,parsed.data.status,parsed.data.resolutionNote,req.auth.userId]);
    if(!rows[0])return res.status(404).json({error:{code:'NOT_FOUND',message:'گزارش پیدا نشد.'}});
    await pool.query('INSERT INTO admin_audit_logs(actor_id,action,target_type,target_id,metadata,request_id) VALUES($1,$2,\'report\',$3,$4,$5)',[req.auth.userId,`report.${parsed.data.status}`,req.params.id,{note:parsed.data.resolutionNote},req.id||null]);
    res.json({report:rows[0]});
  } catch(error){next(error);}
});

router.patch('/users/:id/status', requirePerm('users'), async (req,res,next) => {
  try {
    const parsed=z.object({status:z.enum(['active','suspended','deleted'])}).strict().safeParse(req.body);
    if(!parsed.success)return res.status(400).json({error:{code:'INVALID_STATUS',message:'وضعیت حساب معتبر نیست.'}});
    if(req.params.id===req.auth.userId)return res.status(400).json({error:{code:'SELF_STATUS',message:'وضعیت حساب خودتان را نمی‌توانید تغییر دهید.'}});
    const result=await transaction(async(client)=>{
      const target=await client.query('SELECT role FROM users WHERE id=$1 FOR UPDATE',[req.params.id]);
      if(target.rows[0]?.role && target.rows[0].role!=='user' && req.auth.role!=='admin')throw Object.assign(new Error('فقط مدیر اصلی می‌تواند وضعیت حساب مدیران را تغییر دهد.'),{status:403,code:'ADMIN_REQUIRED'});
      if(target.rows[0]?.role==='admin')throw Object.assign(new Error('وضعیت حساب مدیر از این مسیر قابل تغییر نیست.'),{status:403,code:'ADMIN_PROTECTED'});
      const {rows}=await client.query('UPDATE users SET status=$2::user_status,deleted_at=CASE WHEN $2::user_status=\'deleted\' THEN now() ELSE NULL END,updated_at=now() WHERE id=$1 RETURNING id,phone_e164,status,role',[req.params.id,parsed.data.status]);
      if(!rows[0])throw Object.assign(new Error('کاربر پیدا نشد.'),{status:404,code:'NOT_FOUND'});
      if(parsed.data.status!=='active')await client.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[req.params.id]);
      await client.query('INSERT INTO admin_audit_logs(actor_id,action,target_type,target_id,metadata,request_id) VALUES($1,$2,\'user\',$3,$4,$5)',[req.auth.userId,`user.${parsed.data.status}`,req.params.id,{},req.id||null]);
      return rows[0];
    });
    res.json({user:result});
  } catch(error){next(error);}
});

router.get('/audit-logs', requirePerm('audit'), async (req,res,next)=>{
  try {
    const limit=parsePositiveInt(req.query.limit,100,200);
    const {rows}=await pool.query('SELECT id,actor_id,action,target_type,target_id,metadata,request_id,created_at FROM admin_audit_logs ORDER BY created_at DESC LIMIT $1',[limit]);
    res.json({items:rows});
  }catch(error){next(error);}
});

/* ============ مدیریت مدیران و دسترسی‌ها (فقط مدیر اصلی) ============ */
const adminOnly = (req, res, next) => req.auth.role === 'admin' ? next() : res.status(403).json({ error:{code:'ADMIN_REQUIRED',message:'فقط مدیر اصلی به این بخش دسترسی دارد.'} });
const staffSchema = z.object({
  role: z.enum(['admin','moderator']),
  permissions: z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length).default([]),
}).strict();
const audit = (client, req, action, targetType, targetId, metadata) =>
  client.query('INSERT INTO admin_audit_logs(actor_id,action,target_type,target_id,metadata,request_id) VALUES($1,$2,$3,$4,$5,$6)', [req.auth.userId, action, targetType, String(targetId), metadata || {}, req.id || null]);
const uniq = (a) => [...new Set(a)];

router.get('/staff', adminOnly, async (_req,res,next) => {
  try {
    const [staff, invites] = await Promise.all([
      pool.query("SELECT id,phone_e164,display_name,role,permissions,status,created_at FROM users WHERE role IN ('admin','moderator') AND deleted_at IS NULL ORDER BY (role='admin') DESC, created_at ASC"),
      pool.query('SELECT phone_e164,role,permissions,created_at FROM admin_invites ORDER BY created_at DESC'),
    ]);
    res.json({ items:staff.rows, invites:invites.rows, permissions:PERMISSIONS });
  } catch(error){next(error);}
});

// افزودن مدیر/ناظر با شماره: اگر کاربر ثبت‌نام کرده فوراً فعال می‌شود، وگرنه با اولین ورود
router.post('/staff', adminOnly, async (req,res,next) => {
  try {
    const parsed = staffSchema.extend({ phone:z.string().trim().min(8).max(32) }).safeParse(req.body);
    const phone = parsed.success ? normalizePhone(parsed.data.phone) : null;
    if (!parsed.success || !phone) return res.status(400).json({ error:{code:'INVALID_STAFF',message:'شماره یا دسترسی‌ها معتبر نیست.'} });
    const perms = parsed.data.role === 'admin' ? [] : uniq(parsed.data.permissions);
    const result = await transaction(async (client) => {
      const { rows } = await client.query('SELECT id,role FROM users WHERE phone_e164=$1 AND deleted_at IS NULL FOR UPDATE', [phone]);
      if (rows[0]) {
        const u = await client.query('UPDATE users SET role=$2::user_role,permissions=$3,updated_at=now() WHERE id=$1 RETURNING id,phone_e164,display_name,role,permissions,status', [rows[0].id, parsed.data.role, perms]);
        await audit(client, req, 'staff.set', 'user', rows[0].id, { role:parsed.data.role, permissions:perms, phone });
        return { user:u.rows[0] };
      }
      await client.query(`INSERT INTO admin_invites(phone_e164,role,permissions,created_by) VALUES($1,$2::user_role,$3,$4)
        ON CONFLICT(phone_e164) DO UPDATE SET role=EXCLUDED.role,permissions=EXCLUDED.permissions,created_by=EXCLUDED.created_by,created_at=now()`, [phone, parsed.data.role, perms, req.auth.userId]);
      await audit(client, req, 'staff.invite', 'phone', phone, { role:parsed.data.role, permissions:perms });
      return { invited:{ phone_e164:phone, role:parsed.data.role, permissions:perms } };
    });
    res.status(201).json(result);
  } catch(error){next(error);}
});

async function ensureAnotherAdmin(client, exceptId) {
  const { rows } = await client.query("SELECT count(*)::int n FROM users WHERE role='admin' AND status='active' AND deleted_at IS NULL AND id<>$1", [exceptId]);
  if (!rows[0].n) throw Object.assign(new Error('حداقل یک مدیر اصلی فعال باید باقی بماند.'),{status:400,code:'LAST_ADMIN'});
}
router.patch('/staff/:id', adminOnly, async (req,res,next) => {
  try {
    const parsed = staffSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error:{code:'INVALID_STAFF',message:'نقش یا دسترسی‌ها معتبر نیست.'} });
    const perms = parsed.data.role === 'admin' ? [] : uniq(parsed.data.permissions);
    const user = await transaction(async (client) => {
      const cur = await client.query("SELECT id,role FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE", [req.params.id]);
      if (!cur.rows[0]) throw Object.assign(new Error('کاربر پیدا نشد.'),{status:404,code:'NOT_FOUND'});
      if (cur.rows[0].role === 'admin' && parsed.data.role !== 'admin') await ensureAnotherAdmin(client, req.params.id);
      const u = await client.query('UPDATE users SET role=$2::user_role,permissions=$3,updated_at=now() WHERE id=$1 RETURNING id,phone_e164,display_name,role,permissions,status', [req.params.id, parsed.data.role, perms]);
      if (parsed.data.role !== cur.rows[0].role) await client.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL AND id<>$2', [req.params.id, req.auth.sessionId]);
      await audit(client, req, 'staff.update', 'user', req.params.id, { role:parsed.data.role, permissions:perms });
      return u.rows[0];
    });
    res.json({ user });
  } catch(error){next(error);}
});
router.delete('/staff/:id', adminOnly, async (req,res,next) => {
  try {
    await transaction(async (client) => {
      const cur = await client.query("SELECT id,role FROM users WHERE id=$1 FOR UPDATE", [req.params.id]);
      if (!cur.rows[0]) throw Object.assign(new Error('کاربر پیدا نشد.'),{status:404,code:'NOT_FOUND'});
      if (cur.rows[0].role === 'admin') await ensureAnotherAdmin(client, req.params.id);
      await client.query("UPDATE users SET role='user',permissions='{}',updated_at=now() WHERE id=$1", [req.params.id]);
      await audit(client, req, 'staff.remove', 'user', req.params.id, {});
    });
    res.json({ ok:true });
  } catch(error){next(error);}
});
router.delete('/staff-invites/:phone', adminOnly, async (req,res,next) => {
  try {
    const phone = normalizePhone(String(req.params.phone || ''));
    if (!phone) return res.status(400).json({ error:{code:'INVALID_PHONE',message:'شماره معتبر نیست.'} });
    await transaction(async (client) => {
      await client.query('DELETE FROM admin_invites WHERE phone_e164=$1', [phone]);
      await audit(client, req, 'staff.invite_cancel', 'phone', phone, {});
    });
    res.json({ ok:true });
  } catch(error){next(error);}
});

/* ============ بنرهای صفحه اصلی ============ */
const bannerFields = {
  action: z.enum(['none','goSell','browseDealers','goListings','goNews','url']),
  linkUrl: z.string().trim().max(500).regex(/^(https:\/\/[^\s]+|\/(?!\/)[^\s]*)$/).nullish(),
  alt: z.string().trim().max(160).optional().default(''),
};
const bannerRow = 'id,image_url,action,link_url,alt,position,active,created_at';
router.get('/banners', requirePerm('banners'), async (_req,res,next) => {
  try { res.json({ items:(await pool.query(`SELECT ${bannerRow} FROM home_banners ORDER BY position,created_at`)).rows }); }
  catch(error){next(error);}
});
router.post('/banners', requirePerm('banners'), async (req,res,next) => {
  try {
    const parsed = z.object({ imageId:z.string().uuid(), ...bannerFields }).strict().safeParse(req.body);
    if (!parsed.success || (parsed.data.action === 'url' && !parsed.data.linkUrl)) return res.status(400).json({ error:{code:'INVALID_BANNER',message:'اطلاعات بنر معتبر نیست (برای لینک، آدرس https لازم است).'} });
    const banner = await transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(724190261)');
      const img = await client.query('SELECT id,public_url FROM images WHERE id=$1', [parsed.data.imageId]);
      if (!img.rows[0]) throw Object.assign(new Error('تصویر پیدا نشد؛ دوباره آپلود کنید.'),{status:400,code:'IMAGE_NOT_FOUND'});
      const cnt = await client.query('SELECT count(*)::int n, COALESCE(max(position),-1)+1 AS next FROM home_banners');
      if (cnt.rows[0].n >= 12) throw Object.assign(new Error('حداکثر ۱۲ بنر مجاز است.'),{status:400,code:'BANNER_LIMIT'});
      const ins = await client.query(`INSERT INTO home_banners(image_id,image_url,action,link_url,alt,position,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING ${bannerRow}`,
        [img.rows[0].id, img.rows[0].public_url, parsed.data.action, parsed.data.action==='url'?parsed.data.linkUrl:null, parsed.data.alt, cnt.rows[0].next, req.auth.userId]);
      await audit(client, req, 'banner.create', 'banner', ins.rows[0].id, { action:parsed.data.action });
      return ins.rows[0];
    });
    res.status(201).json({ banner });
  } catch(error){next(error);}
});
router.patch('/banners/:id', requirePerm('banners'), async (req,res,next) => {
  try {
    const parsed = z.object({ active:z.boolean().optional(), ...Object.fromEntries(Object.entries(bannerFields).map(([k,v])=>[k,v.optional()])) }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error:{code:'INVALID_BANNER',message:'اطلاعات بنر معتبر نیست.'} });
    const d = parsed.data;
    const banner = await transaction(async (client) => {
      const cur = await client.query('SELECT action,link_url FROM home_banners WHERE id=$1 FOR UPDATE', [req.params.id]);
      if (!cur.rows[0]) throw Object.assign(new Error('بنر پیدا نشد.'),{status:404,code:'NOT_FOUND'});
      const action = d.action ?? cur.rows[0].action;
      const link = action === 'url' ? (d.linkUrl ?? cur.rows[0].link_url) : null;
      if (action === 'url' && !link) throw Object.assign(new Error('برای لینک، آدرس https لازم است.'),{status:400,code:'INVALID_BANNER'});
      const up = await client.query(`UPDATE home_banners SET action=$2,link_url=$3,alt=COALESCE($4,alt),active=COALESCE($5,active),updated_at=now() WHERE id=$1 RETURNING ${bannerRow}`,
        [req.params.id, action, link, d.alt ?? null, d.active ?? null]);
      await audit(client, req, 'banner.update', 'banner', req.params.id, d);
      return up.rows[0];
    });
    res.json({ banner });
  } catch(error){next(error);}
});
router.post('/banners/:id/move', requirePerm('banners'), async (req,res,next) => {
  try {
    const parsed = z.object({ dir:z.enum(['up','down']) }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error:{code:'INVALID_MOVE',message:'جهت نامعتبر است.'} });
    await transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(724190261)');
      const { rows } = await client.query('SELECT id FROM home_banners ORDER BY position,created_at');
      const i = rows.findIndex((r) => r.id === req.params.id);
      if (i < 0) throw Object.assign(new Error('بنر پیدا نشد.'),{status:404,code:'NOT_FOUND'});
      const j = parsed.data.dir === 'up' ? i - 1 : i + 1;
      if (j >= 0 && j < rows.length) [rows[i], rows[j]] = [rows[j], rows[i]];
      for (let k = 0; k < rows.length; k++) await client.query('UPDATE home_banners SET position=$2,updated_at=now() WHERE id=$1', [rows[k].id, k]);
      await audit(client, req, 'banner.move', 'banner', req.params.id, { dir:parsed.data.dir });
    });
    res.json({ items:(await pool.query(`SELECT ${bannerRow} FROM home_banners ORDER BY position,created_at`)).rows });
  } catch(error){next(error);}
});
router.delete('/banners/:id', requirePerm('banners'), async (req,res,next) => {
  try {
    await transaction(async (client) => {
      const del = await client.query('DELETE FROM home_banners WHERE id=$1 RETURNING id', [req.params.id]);
      if (!del.rows[0]) throw Object.assign(new Error('بنر پیدا نشد.'),{status:404,code:'NOT_FOUND'});
      await audit(client, req, 'banner.delete', 'banner', req.params.id, {});
    });
    res.json({ ok:true });
  } catch(error){next(error);}
});

/* ---------- Ad cards (shown between listing cards) — needs the 'banners' permission ---------- */
const adUrl = z.string().trim().max(500).refine((v) => v === '' || /^https:\/\/[^\s]+$/i.test(v) || /^\/(?!\/)[^\s]*$/.test(v), 'invalid url');
const adDate = z.string().trim().max(40).nullable().optional().refine((v) => v == null || v === '' || !Number.isNaN(Date.parse(v)), 'invalid date');
const adCardBase = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).optional(),
  imageUrl: adUrl.optional(),
  linkUrl: adUrl.optional(),
  ctaText: z.string().trim().max(24).optional(),
  badgeText: z.string().trim().max(16).optional(),
  position: z.coerce.number().int().min(1).max(50).optional(),
  repeatEvery: z.coerce.number().int().min(0).max(50).optional(),
  isActive: z.boolean().optional(),
  startsAt: adDate,
  endsAt: adDate,
  sortOrder: z.coerce.number().int().min(-1000).max(1000).optional(),
}).strict();
// No schema-level defaults on purpose: with .partial() they would silently reset
// untouched fields on PATCH. Defaults for a new card are applied in the POST handler.
const adCardCreate = adCardBase;
const adCardPatch = adCardBase.partial().strict();
const AD_DEFAULTS = { description:'', imageUrl:'', linkUrl:'', ctaText:'مشاهده', badgeText:'تبلیغ', position:4, repeatEvery:0, isActive:true, startsAt:null, endsAt:null, sortOrder:0 };
const AD_COLUMNS = { title:'title', description:'description', imageUrl:'image_url', linkUrl:'link_url', ctaText:'cta_text', badgeText:'badge_text', position:'position', repeatEvery:'repeat_every', isActive:'is_active', startsAt:'starts_at', endsAt:'ends_at', sortOrder:'sort_order' };
const adOut = (r) => ({ id:r.id, title:r.title, description:r.description, imageUrl:r.image_url, linkUrl:r.link_url, ctaText:r.cta_text, badgeText:r.badge_text, position:r.position, repeatEvery:r.repeat_every, isActive:r.is_active, startsAt:r.starts_at, endsAt:r.ends_at, sortOrder:r.sort_order, views:Number(r.views), clicks:Number(r.clicks), createdAt:r.created_at, updatedAt:r.updated_at });
const adDateValue = (v) => (v ? new Date(v).toISOString() : null);

router.get('/ad-cards', requirePerm('banners'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM ad_cards ORDER BY sort_order ASC, created_at DESC LIMIT 200');
    res.json({ items: rows.map(adOut) });
  } catch (error) { next(error); }
});

router.post('/ad-cards', requirePerm('banners'), async (req, res, next) => {
  try {
    const parsed = adCardCreate.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error:{ code:'INVALID_AD_CARD', message:'اطلاعات کارت تبلیغاتی معتبر نیست؛ عنوان و آدرس‌ها را بررسی کنید.' } });
    const d = { ...AD_DEFAULTS, ...Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined)) };
    const { rows } = await pool.query(
      `INSERT INTO ad_cards(title,description,image_url,link_url,cta_text,badge_text,position,repeat_every,is_active,starts_at,ends_at,sort_order,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [d.title, d.description, d.imageUrl, d.linkUrl, d.ctaText, d.badgeText, d.position, d.repeatEvery, d.isActive, adDateValue(d.startsAt), adDateValue(d.endsAt), d.sortOrder, req.auth.userId]);
    await pool.query('INSERT INTO admin_audit_logs(actor_id,action,target_type,target_id,metadata,request_id) VALUES($1,\'ad_card.create\',\'ad_card\',$2,$3,$4)', [req.auth.userId, rows[0].id, { title: d.title }, req.id || null]);
    res.status(201).json({ item: adOut(rows[0]) });
  } catch (error) { next(error); }
});

router.patch('/ad-cards/:id', requirePerm('banners'), async (req, res, next) => {
  try {
    const parsed = adCardPatch.safeParse(req.body);
    const keys = parsed.success ? Object.keys(parsed.data).filter((k) => parsed.data[k] !== undefined) : [];
    if (!parsed.success || !keys.length) return res.status(400).json({ error:{ code:'INVALID_AD_CARD', message:'اطلاعات کارت تبلیغاتی معتبر نیست.' } });
    const sets = []; const values = [req.params.id];
    for (const k of keys) {
      values.push(k === 'startsAt' || k === 'endsAt' ? adDateValue(parsed.data[k]) : parsed.data[k]);
      sets.push(`${AD_COLUMNS[k]}=$${values.length}`);
    }
    const { rows } = await pool.query(`UPDATE ad_cards SET ${sets.join(',')},updated_at=now() WHERE id=$1 RETURNING *`, values);
    if (!rows[0]) return res.status(404).json({ error:{ code:'NOT_FOUND', message:'کارت تبلیغاتی پیدا نشد.' } });
    await pool.query('INSERT INTO admin_audit_logs(actor_id,action,target_type,target_id,metadata,request_id) VALUES($1,\'ad_card.update\',\'ad_card\',$2,$3,$4)', [req.auth.userId, req.params.id, { fields: keys }, req.id || null]);
    res.json({ item: adOut(rows[0]) });
  } catch (error) { next(error); }
});

router.delete('/ad-cards/:id', requirePerm('banners'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('DELETE FROM ad_cards WHERE id=$1 RETURNING id,title', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error:{ code:'NOT_FOUND', message:'کارت تبلیغاتی پیدا نشد.' } });
    await pool.query('INSERT INTO admin_audit_logs(actor_id,action,target_type,target_id,metadata,request_id) VALUES($1,\'ad_card.delete\',\'ad_card\',$2,$3,$4)', [req.auth.userId, req.params.id, { title: rows[0].title }, req.id || null]);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

export default router;
