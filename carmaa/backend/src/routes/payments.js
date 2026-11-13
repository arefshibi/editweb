import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from '../db.js';
import { authRequired, createRateLimiter } from '../middleware/security.js';
import { createGatewayPayment, verifyGatewayPayment } from '../services/payments.js';
import { randomToken } from '../util.js';
import { config } from '../config.js';
import { validateUuidParam } from '../validation.js';

const router = Router();
router.param('id', validateUuidParam);
const checkoutLimit = createRateLimiter({ name: 'payment-checkout', windowSeconds: 60, max: 8, key: (req) => req.auth?.userId || req.ip });
const CATALOG = Object.freeze({
  ladder: { title: 'نردبان آگهی', toman: 50_000, allowed: 'active' },
  urgent: { title: 'برچسب فوری آگهی', toman: 150_000, allowed: 'active' },
  renew: { title: 'تمدید آگهی', toman: 100_000, allowed: 'expired' },
});
const checkoutSchema = z.object({ listingId: z.string().uuid(), serviceKey: z.enum(['ladder','urgent','renew']), idempotencyKey: z.string().min(8).max(120).optional() }).strict();

router.post('/checkout', authRequired, checkoutLimit, async (req, res, next) => {
  try {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_CHECKOUT', message: 'درخواست پرداخت معتبر نیست.' } });
    const { listingId, serviceKey } = parsed.data;
    const idempotencyKey = parsed.data.idempotencyKey || req.get('idempotency-key') || randomToken(18);
    if (idempotencyKey.length < 8 || idempotencyKey.length > 120) return res.status(400).json({ error: { code: 'INVALID_IDEMPOTENCY_KEY', message: 'شناسه درخواست معتبر نیست.' } });
    const item = CATALOG[serviceKey];
    const order = await transaction(async (client) => {
      const { rows } = await client.query('SELECT id,owner_id,status,expires_at FROM listings WHERE id=$1 FOR UPDATE', [listingId]);
      const listing = rows[0];
      if (!listing || listing.owner_id !== req.auth.userId || listing.status !== 'published') throw Object.assign(new Error('آگهی قابل پرداخت نیست یا متعلق به شما نیست.'), { status: 404, code: 'LISTING_NOT_PAYABLE' });
      const isExpired = new Date(listing.expires_at).getTime() <= Date.now();
      if ((item.allowed === 'expired') !== isExpired) throw Object.assign(new Error(item.allowed === 'expired' ? 'تمدید فقط برای آگهی منقضی‌شده فعال است.' : 'این خدمت فقط برای آگهی فعال قابل خرید است.'), { status: 409, code: 'SERVICE_NOT_AVAILABLE' });
      const exists = await client.query('SELECT * FROM payment_orders WHERE user_id=$1 AND idempotency_key=$2 FOR UPDATE', [req.auth.userId,idempotencyKey]);
      if (exists.rows[0]) {
        const prior = exists.rows[0];
        if (prior.listing_id !== listingId || prior.service_key !== serviceKey) throw Object.assign(new Error('کلید idempotency برای درخواست دیگری استفاده شده است.'), { status: 409, code: 'IDEMPOTENCY_CONFLICT' });
        if (prior.status === 'paid') return { prior, alreadyPaid: true };
        if (prior.status !== 'pending' || new Date(prior.expires_at).getTime() <= Date.now()) throw Object.assign(new Error('این سفارش دیگر قابل استفاده نیست.'), { status: 409, code: 'ORDER_NOT_ACTIVE' });
        if (prior.provider_authority) return { prior, existingAuthority: true };
        throw Object.assign(new Error('درخواست پرداخت در حال آماده‌سازی است؛ چند لحظه دیگر تلاش کنید.'), { status: 409, code: 'ORDER_PREPARING' });
      }
      const { rows: inserted } = await client.query(
        `INSERT INTO payment_orders(user_id,listing_id,service_key,amount_toman,amount_rial,status,provider,idempotency_key)
         VALUES($1,$2,$3,$4,$5,'pending','zarinpal',$6) RETURNING *`,
        [req.auth.userId,listingId,serviceKey,item.toman,item.toman*10,idempotencyKey]);
      return { prior: inserted[0], created: true };
    });
    if (order.alreadyPaid) return res.json({ orderId: order.prior.id, status: 'paid' });
    if (order.existingAuthority) return res.json({ orderId: order.prior.id, status: 'pending', redirectUrl: `${config.paymentSandbox ? 'https://sandbox.zarinpal.com/pg/StartPay/' : 'https://payment.zarinpal.com/pg/StartPay/'}${encodeURIComponent(order.prior.provider_authority)}` });
    let gateway;
    try {
      gateway = await createGatewayPayment(order.prior, `${config.PAYMENT_CALLBACK_BASE_URL}?order=${encodeURIComponent(order.prior.id)}`, `CarMaa - ${item.title}`);
    } catch (error) {
      await pool.query("UPDATE payment_orders SET status='failed' WHERE id=$1 AND status='pending'", [order.prior.id]);
      if (error.code === 'PAYMENT_NOT_CONFIGURED') return res.status(503).json({ error: { code: 'PAYMENT_NOT_CONFIGURED', message: 'درگاه پرداخت هنوز پیکربندی نشده است.' } });
      req.log?.warn({ event: 'payment_creation_failed', orderId: order.prior.id }, 'Payment provider request failed');
      return res.status(502).json({ error: { code: 'PAYMENT_PROVIDER_ERROR', message: 'ساخت درخواست پرداخت ناموفق بود.' } });
    }
    const { rows: saved } = await pool.query("UPDATE payment_orders SET provider_authority=$2 WHERE id=$1 AND status='pending' AND provider_authority IS NULL RETURNING id", [order.prior.id,gateway.authority]);
    if (!saved[0]) return res.status(409).json({ error: { code: 'ORDER_RACE', message: 'وضعیت پرداخت تغییر کرده است؛ سفارش را دوباره بررسی کنید.' } });
    res.status(201).json({ orderId: order.prior.id, status: 'pending', redirectUrl: gateway.redirectUrl });
  } catch (error) { next(error); }
});

router.get('/orders/:id', authRequired, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id,listing_id,service_key,amount_toman,status,provider_ref_id,created_at,paid_at FROM payment_orders WHERE id=$1 AND user_id=$2', [req.params.id,req.auth.userId]);
    if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'سفارش پرداخت پیدا نشد.' } });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ order: rows[0] });
  } catch (error) { next(error); }
});

// The browser callback parameters are only hints. The backend verifies the amount and authority with the provider.
router.get('/zarinpal/callback', async (req, res, next) => {
  try {
    const orderId = typeof req.query.order === 'string' ? req.query.order : '';
    const authority = typeof req.query.Authority === 'string' ? req.query.Authority : '';
    const status = typeof req.query.Status === 'string' ? req.query.Status : '';
    if (!/^[0-9a-f-]{36}$/i.test(orderId) || authority.length < 5 || authority.length > 100) {
      return res.redirect(303, `${config.FRONTEND_URL.replace(/\/$/,'')}/payment-return.html?status=invalid`);
    }
    const { rows } = await pool.query('SELECT * FROM payment_orders WHERE id=$1 AND provider_authority=$2 LIMIT 1', [orderId,authority]);
    const order = rows[0];
    if (!order) return res.redirect(303, `${config.FRONTEND_URL.replace(/\/$/,'')}/payment-return.html?status=invalid`);
    const returnBase = `${config.FRONTEND_URL.replace(/\/$/,'')}/payment-return.html`;
    if (order.status === 'paid') return res.redirect(303, `${returnBase}?order_id=${encodeURIComponent(order.id)}&status=success`);
    if (order.status !== 'pending') {
      const terminalStatus = order.status === 'expired' ? 'expired' : 'failed';
      return res.redirect(303, `${returnBase}?order_id=${encodeURIComponent(order.id)}&status=${terminalStatus}`);
    }
    if (new Date(order.expires_at).getTime() <= Date.now()) {
      await pool.query("UPDATE payment_orders SET status='expired' WHERE id=$1 AND status='pending'", [order.id]);
      return res.redirect(303, `${returnBase}?order_id=${encodeURIComponent(order.id)}&status=expired`);
    }
    // The callback query is controlled by the browser. A non-OK Status is not
    // proof that the provider cancelled/failed the payment; do not mutate state.
    // Keep the order pending so a later authentic provider callback can be verified.
    if (status.toUpperCase() !== 'OK') {
      return res.redirect(303, `${returnBase}?order_id=${encodeURIComponent(order.id)}&status=cancelled`);
    }
    let verification;
    try { verification = await verifyGatewayPayment(order, authority); }
    catch (error) {
      req.log?.warn({ event: 'payment_verification_unavailable', orderId: order.id }, 'Payment verification unavailable');
      return res.redirect(303, `${returnBase}?order_id=${encodeURIComponent(order.id)}&status=pending`);
    }
    if (!verification.paid) {
      await pool.query("UPDATE payment_orders SET status='failed' WHERE id=$1 AND status='pending'", [order.id]);
      return res.redirect(303, `${returnBase}?order_id=${encodeURIComponent(order.id)}&status=failed`);
    }
    await transaction(async (client) => {
      const { rows: locked } = await client.query('SELECT * FROM payment_orders WHERE id=$1 FOR UPDATE', [order.id]);
      const current = locked[0];
      if (!current || current.status === 'paid') return;
      if (current.status !== 'pending' || current.provider_authority !== authority || String(current.amount_rial) !== String(order.amount_rial)) throw Object.assign(new Error('Order state changed'), { status: 409, code: 'PAYMENT_STATE_CHANGED' });
      await client.query("UPDATE payment_orders SET status='paid',provider_ref_id=$2,paid_at=now() WHERE id=$1", [order.id,verification.refId]);
      if (current.service_key === 'ladder') await client.query("UPDATE listings SET bumped_at=now(),updated_at=now() WHERE id=$1 AND owner_id=$2", [current.listing_id,current.user_id]);
      else if (current.service_key === 'urgent') await client.query("UPDATE listings SET urgent_until=GREATEST(COALESCE(urgent_until,now()),now())+interval '3 days',updated_at=now() WHERE id=$1 AND owner_id=$2", [current.listing_id,current.user_id]);
      else if (current.service_key === 'renew') await client.query("UPDATE listings SET expires_at=GREATEST(expires_at,now())+interval '30 days',updated_at=now() WHERE id=$1 AND owner_id=$2", [current.listing_id,current.user_id]);
      await client.query('INSERT INTO notifications(user_id,type,title,body,data) VALUES($1,\'payment\',\'پرداخت موفق\',\'خدمت خریداری‌شده برای آگهی شما فعال شد.\',$2)', [current.user_id,{ orderId: current.id, listingId: current.listing_id, serviceKey: current.service_key }]);
    });
    return res.redirect(303, `${returnBase}?order_id=${encodeURIComponent(order.id)}&status=success`);
  } catch (error) { next(error); }
});

export default router;
