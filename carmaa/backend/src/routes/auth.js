import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from '../db.js';
import { config } from '../config.js';
import { authRequired, createRateLimiter } from '../middleware/security.js';
import { err, normalizePhone, otpDigest, randomToken, safeUser, secureEqual, sessionDigest } from '../util.js';
import { sendOtpSms } from '../services/sms.js';
import { verifyTotp, decryptSecret } from '../totp.js';

const router = Router();
const requestIpLimit = createRateLimiter({ name: 'otp-ip', windowSeconds: 900, max: 10 });
const verifyIpLimit = createRateLimiter({ name: 'otp-verify-ip', windowSeconds: 900, max: 30 });
const verifyPhoneLimit = createRateLimiter({ name: 'otp-verify-phone', windowSeconds: 3600, max: 10, key: (req) => normalizePhone(req.body?.phone) || req.ip });
const profileWriteLimit = createRateLimiter({ name: 'profile-write', windowSeconds: 60, max: 10, key: (req) => req.auth?.userId || req.ip });
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const otpRequestSchema = z.object({ phone: z.string().min(6).max(32) }).strict();
const otpVerifySchema = z.object({ phone: z.string().min(6).max(32), code: z.string().regex(/^\d{6}$/) }).strict();

function setSessionCookie(res, token) {
  res.cookie(config.COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
}
function clearSessionCookie(res) {
  res.clearCookie(config.COOKIE_NAME, { httpOnly: true, secure: config.cookieSecure, sameSite: 'strict', path: '/' });
}
function ipDigest(ip) { return crypto.createHmac('sha256', config.SESSION_PEPPER).update(String(ip || 'unknown')).digest(); }

router.post('/otp/request', requestIpLimit, async (req, res, next) => {
  try {
    const parsed = otpRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_PHONE', message: 'شماره تلفن معتبر نیست.' } });
    const phone = normalizePhone(parsed.data.phone);
    if (!phone) return res.status(400).json({ error: { code: 'INVALID_PHONE', message: 'شماره تلفن معتبر نیست.' } });

    // Serialize OTP requests per phone inside PostgreSQL so parallel requests cannot
    // bypass the hourly/SMS cooldown checks across workers or app replicas.
    const challenge = await transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [phone]);
      const { rows: countRows } = await client.query(
        `SELECT count(*)::int AS requests, max(created_at) AS last_request
         FROM auth_otps WHERE phone_e164=$1 AND created_at > now() - interval '1 hour'`, [phone]);
      const usage = countRows[0];
      if (usage.requests >= 5 || (usage.last_request && Date.now() - new Date(usage.last_request).getTime() < 60_000)) {
        return { error: 'COOLDOWN' };
      }
      // Fixed OTP is allowed only when explicitly configured for local development.
      // config rejects this setting in production; verification still uses the same
      // one-time DB digest, expiry, attempt limit, and rate limits as real SMS OTP.
      const code = config.DEV_OTP_CODE || String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      const digest = otpDigest(phone, code);
      await client.query('UPDATE auth_otps SET consumed_at=COALESCE(consumed_at,now()) WHERE phone_e164=$1 AND consumed_at IS NULL', [phone]);
      await client.query(
        `INSERT INTO auth_otps(phone_e164,code_digest,expires_at,request_ip_hash)
         VALUES($1,$2,now()+interval '5 minutes',$3)`, [phone, digest, ipDigest(req.ip)]);
      return { code, digest };
    });
    if (challenge.error === 'COOLDOWN') {
      return res.status(429).json({ error: { code: 'OTP_COOLDOWN', message: 'برای ارسال مجدد کد کمی صبر کنید.' } });
    }
    const { code, digest } = challenge;
    try {
      if (!config.DEV_OTP_CODE) {
        const sent = await sendOtpSms(phone, code);
        // Melipayamak generates the code itself; store its digest instead of ours.
        if (sent?.code) {
          await pool.query('UPDATE auth_otps SET code_digest=$3 WHERE phone_e164=$1 AND code_digest=$2 AND consumed_at IS NULL', [phone, digest, otpDigest(phone, sent.code)]);
        }
      }
    } catch (error) {
      await pool.query('UPDATE auth_otps SET consumed_at=now() WHERE phone_e164=$1 AND code_digest=$2 AND consumed_at IS NULL', [phone, digest]).catch(() => {});
      if (error.code === 'SMS_NOT_CONFIGURED') {
        return res.status(503).json({ error: { code: 'SMS_NOT_CONFIGURED', message: 'ارسال پیامک هنوز پیکربندی نشده است.' } });
      }
      req.log?.warn({ event: 'otp_delivery_failed' }, 'OTP delivery failed'); console.error('OTP delivery failed:', error.message);
      return res.status(503).json({ error: { code: 'SMS_DELIVERY_FAILED', message: 'ارسال پیامک انجام نشد؛ بعداً دوباره تلاش کنید.' } });
    }
    return res.status(202).json({ message: config.DEV_OTP_CODE ? 'کد آزمایشی فعال است؛ کد ثابت توسعه را وارد کنید.' : 'اگر شماره قابل استفاده باشد، کد تأیید برای آن ارسال می‌شود.', expiresInSeconds: 300, resendAfterSeconds: 60, ...(config.DEV_OTP_CODE ? { developmentOtpEnabled: true } : {}) });
  } catch (error) { next(error); }
});

router.post('/otp/verify', verifyIpLimit, verifyPhoneLimit, async (req, res, next) => {
  try {
    const parsed = otpVerifySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_OTP', message: 'شماره یا کد واردشده معتبر نیست.' } });
    const phone = normalizePhone(parsed.data.phone);
    if (!phone) return res.status(400).json({ error: { code: 'INVALID_OTP', message: 'شماره یا کد واردشده معتبر نیست.' } });
    const result = await transaction(async (client) => {
      const { rows } = await client.query(
        `SELECT id,code_digest,attempts,expires_at,consumed_at FROM auth_otps
         WHERE phone_e164=$1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [phone]);
      const otp = rows[0];
      if (!otp || otp.consumed_at || new Date(otp.expires_at).getTime() <= Date.now() || otp.attempts >= 5) return { error: 'INVALID' };
      const candidate = otpDigest(phone, parsed.data.code);
      if (!secureEqual(otp.code_digest, candidate)) {
        await client.query('UPDATE auth_otps SET attempts=attempts+1, consumed_at=CASE WHEN attempts+1 >= 5 THEN now() ELSE consumed_at END WHERE id=$1', [otp.id]);
        return { error: 'INVALID' };
      }
      await client.query('UPDATE auth_otps SET consumed_at=now() WHERE id=$1', [otp.id]);
      const { rows: userRows } = await client.query(
        `INSERT INTO users(phone_e164,phone_verified_at) VALUES($1,now())
         ON CONFLICT(phone_e164) DO UPDATE SET phone_verified_at=COALESCE(users.phone_verified_at,now()), updated_at=now()
         RETURNING *`, [phone]);
      let user = userRows[0];
      if (user.status !== 'active' || user.deleted_at) return { error: 'BLOCKED' };
      user = await ensureDefaultUsername(client, user);
      if (config.adminBootstrapPhones.includes(phone) && user.role !== 'admin') {
        const { rows: promoted } = await client.query("UPDATE users SET role='admin',updated_at=now() WHERE id=$1 RETURNING *", [user.id]);
        user = promoted[0];
        await client.query("INSERT INTO admin_audit_logs(actor_id,action,target_type,target_id,metadata) VALUES($1::uuid,'bootstrap.admin_promote','user',$1::text,$2)", [user.id, { method: 'env_bootstrap_on_login' }]);
      }
      // دعوت مدیر: اگر این شماره قبلاً به‌عنوان مدیر/ناظر ثبت شده، با اولین ورود فعال می‌شود
      const { rows: inv } = await client.query('DELETE FROM admin_invites WHERE phone_e164=$1 RETURNING role,permissions,created_by', [phone]);
      if (inv[0] && user.role !== 'admin') {
        const { rows: invited } = await client.query('UPDATE users SET role=$2::user_role,permissions=$3,updated_at=now() WHERE id=$1 RETURNING *', [user.id, inv[0].role, inv[0].permissions]);
        user = invited[0];
        await client.query("INSERT INTO admin_audit_logs(actor_id,action,target_type,target_id,metadata) VALUES($1,'staff.invite_claimed','user',$2,$3)", [inv[0].created_by, user.id, { role: inv[0].role, permissions: inv[0].permissions }]);
      }
      const token = randomToken(32);
      await client.query(
        `INSERT INTO sessions(user_id,token_digest,expires_at,user_agent_hash)
         VALUES($1,$2,now()+interval '7 days',$3)`, [user.id, sessionDigest(token), crypto.createHash('sha256').update(String(req.get('user-agent') || '')).digest()]);
      return { user, token };
    });
    if (result.error) req.log?.warn({ event: result.error === 'BLOCKED' ? 'login_blocked_account' : 'otp_verify_failed', ip: req.ip }, 'Login failed');
    if (result.error === 'BLOCKED') return res.status(403).json({ error: { code: 'ACCOUNT_DISABLED', message: 'این حساب امکان ورود ندارد.' } });
    if (result.error) return res.status(401).json({ error: { code: 'INVALID_OTP', message: 'کد تأیید نادرست یا منقضی شده است.' } });
    setSessionCookie(res, result.token);
    req.log?.info({ event: 'login_success', userId: result.user.id }, 'Login ok');
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ user: safeUser(result.user), authenticated: true });
  } catch (error) { next(error); }
});

router.get('/me', authRequired, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ user: req.auth.user, authenticated: true });
});

router.post('/logout', authRequired, async (req, res, next) => {
  try {
    await pool.query('UPDATE sessions SET revoked_at=now() WHERE id=$1 AND revoked_at IS NULL', [req.auth.sessionId]);
    clearSessionCookie(res);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true });
  } catch (error) { next(error); }
});

// SEC-PATCH (A12): خروج از همهی دستگاهها
router.post('/logout-all', authRequired, async (req, res, next) => {
  try {
    await pool.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [req.auth.userId]);
    clearSessionCookie(res);
    res.setHeader('Cache-Control', 'no-store');
    req.log?.info({ event: 'logout_all', userId: req.auth.userId }, 'All sessions revoked');
    res.json({ ok: true });
  } catch (error) { next(error); }
});

// SEC2-PATCH (A15): تأیید کد TOTP برای نشست ادمین/ناظر
const totpLimit = createRateLimiter({ name: 'totp-verify', windowSeconds: 900, max: 10, key: (req) => req.auth?.userId || req.ip });
router.post('/totp/verify', authRequired, totpLimit, async (req, res, next) => {
  try {
    const parsed = z.object({ code: z.string().regex(/^\d{6}$/) }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_TOTP', message: 'کد ۶ رقمی معتبر نیست.' } });
    const { rows } = await pool.query('SELECT totp_secret_enc, totp_last_counter FROM users WHERE id=$1 AND totp_enabled_at IS NOT NULL', [req.auth.userId]);
    if (!rows[0]) return res.status(403).json({ error: { code: 'MFA_SETUP_REQUIRED', message: 'احراز هویت دومرحله‌ای برای این حساب فعال نیست.' } });
    const counter = verifyTotp(decryptSecret(rows[0].totp_secret_enc), parsed.data.code);
    const fresh = counter !== null && (rows[0].totp_last_counter === null || BigInt(rows[0].totp_last_counter) < BigInt(counter));
    if (!fresh) { req.log?.warn({ event: 'totp_failed', userId: req.auth.userId }, 'TOTP rejected'); return res.status(401).json({ error: { code: 'INVALID_TOTP', message: 'کد نادرست یا استفاده‌شده است.' } }); }
    await pool.query('UPDATE users SET totp_last_counter=$2 WHERE id=$1', [req.auth.userId, counter]);
    await pool.query('UPDATE sessions SET mfa_verified_at=now() WHERE id=$1', [req.auth.sessionId]);
    req.log?.info({ event: 'totp_ok', userId: req.auth.userId }, 'TOTP verified');
    res.setHeader('Cache-Control', 'no-store'); res.json({ ok: true });
  } catch (error) { next(error); }
});

export const MAX_HANDLE_CHANGES = 2;
const RESERVED_HANDLES = new Set(['admin','administrator','root','support','carmaa','carma','system','api','null','undefined','moderator','official',
  // site paths (see the address scheme in js/04-state-core.js) — a handle must never shadow a page
  'account','accounts','edit','showroom','showrooms','seller','sellers','cars','car','brands','brand','sell','saved','messages','message','news','qa','media','assets','login','logout','register','settings','search','help','about','terms','privacy','user','users','profile']);
const AUTO_HANDLE_RE = /^user-\d+$/;   // reserved for system-assigned ids
const isReservedHandle = (name) => RESERVED_HANDLES.has(name) || AUTO_HANDLE_RE.test(name);

/* Default public id: user-<random 1..99999> (widens to 7 digits if the small range is crowded).
   Must run inside a transaction on `client`; a SAVEPOINT keeps a rare unique-index race from aborting it. */
export async function ensureDefaultUsername(client, user) {
  if (!user || user.username) return user;
  for (let i = 0; i < 60; i += 1) {
    const n = 1 + crypto.randomInt(i < 30 ? 99999 : 9999999);
    const name = `user-${String(n).padStart(2, '0')}`;
    await client.query('SAVEPOINT default_username');
    try {
      const { rows } = await client.query(
        `UPDATE users SET username=$1, username_auto=true, updated_at=now()
          WHERE id=$2 AND username IS NULL AND NOT EXISTS (SELECT 1 FROM users WHERE lower(username)=$1)
          RETURNING *`, [name, user.id]);
      await client.query('RELEASE SAVEPOINT default_username');
      if (rows[0]) return rows[0];
      const cur = await client.query('SELECT * FROM users WHERE id=$1', [user.id]);
      if (cur.rows[0]?.username) return cur.rows[0];
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT default_username');
      if (error.code !== '23505') throw error;
    }
  }
  throw err(500, 'USERNAME_ASSIGN_FAILED', 'ساخت شناسه‌ی کاربری انجام نشد.');
}
const USERNAME_RE = /^[a-z][a-z0-9_.]{2,19}$/;
const usernameCheckLimit = createRateLimiter({ name: 'username-check', windowSeconds: 60, max: 40, key: (req) => req.auth?.userId || req.ip });

// Live availability check used while the user types a username.
router.get('/username-available', authRequired, usernameCheckLimit, async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const name = typeof req.query.username === 'string' ? req.query.username.trim().toLowerCase().replace(/^@/, '') : '';
    const me = await pool.query('SELECT username, username_changes, username_auto FROM users WHERE id=$1', [req.auth.userId]);
    const cur = me.rows[0] || {};
    const changesLeft = cur.username && !cur.username_auto ? Math.max(0, MAX_HANDLE_CHANGES - Number(cur.username_changes || 0)) : (cur.username ? MAX_HANDLE_CHANGES : null);
    if (!USERNAME_RE.test(name)) return res.json({ available: false, reason: 'INVALID', changesLeft });
    if (cur.username && cur.username === name) return res.json({ available: true, own: true, changesLeft });
    if (isReservedHandle(name)) return res.json({ available: false, reason: 'TAKEN', changesLeft });
    const taken = await pool.query('SELECT 1 FROM users WHERE lower(username)=$1 AND id<>$2 LIMIT 1', [name, req.auth.userId]);
    res.json({ available: !taken.rows[0], reason: taken.rows[0] ? 'TAKEN' : null, changesLeft });
  } catch (error) { next(error); }
});

router.patch('/profile', authRequired, profileWriteLimit, async (req, res, next) => {
  try {
    const schema = z.object({ displayName: z.string().trim().min(2).max(80).optional(), nickname: z.string().trim().min(2).max(40).nullable().optional(), email: z.string().trim().email().max(254).nullable().optional(), username: z.string().trim().toLowerCase().regex(USERNAME_RE).nullable().optional(), avatarUrl: z.string().url().max(1000).nullable().optional(), bannerUrl: z.string().url().max(1000).nullable().optional() }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data || {}).length === 0) return res.status(400).json({ error: { code: 'INVALID_PROFILE', message: 'اطلاعات پروفایل معتبر نیست.' } });
    // An avatar must reference an image actually uploaded by this account, not merely share our media URL prefix.
    for (const [field, label] of [['avatarUrl','تصویر پروفایل'],['bannerUrl','بنر حساب']]) {
      if (parsed.data[field]) { const ownedImage = await pool.query('SELECT id FROM images WHERE owner_id=$1 AND public_url=$2 LIMIT 1', [req.auth.userId, parsed.data[field]]); if (!ownedImage.rows[0]) return res.status(400).json({ error: { code: 'INVALID_PROFILE_IMAGE', message: `${label} باید از تصاویر آپلودشدهٔ همین حساب انتخاب شود.` } }); }
    }
    const row = await transaction(async (client) => {
      // Lock the row so two concurrent requests cannot bypass the change limit.
      const cur = (await client.query('SELECT username, username_changes, username_auto FROM users WHERE id=$1 FOR UPDATE', [req.auth.userId])).rows[0];
      const updates = [], values = [];
      if (parsed.data.displayName !== undefined) { values.push(parsed.data.displayName); updates.push(`display_name=$${values.length}`); }
      if (parsed.data.nickname !== undefined) { values.push(parsed.data.nickname || null); updates.push(`nickname=$${values.length}`); }
      if (parsed.data.email !== undefined) { values.push(parsed.data.email || null); updates.push(`email=$${values.length}`); }
      const wanted = parsed.data.username;
      // A username can be changed but never removed; same value / null = no change.
      if (wanted && wanted !== cur.username) {
        if (isReservedHandle(wanted)) throw err(409, 'USERNAME_TAKEN', 'این نام کاربری قبلاً ثبت شده است.');
        // The auto-assigned id (user-12345) may be replaced once for free; only self-chosen names count against the limit.
        if (cur.username && !cur.username_auto) {
          if (Number(cur.username_changes || 0) >= MAX_HANDLE_CHANGES) throw err(403, 'USERNAME_CHANGE_LIMIT', 'شما حداکثر ۲ بار می‌توانید نام کاربری را تغییر دهید و این سهمیه تمام شده است.');
          updates.push('username_changes=username_changes+1');
        }
        updates.push('username_auto=false');
        values.push(wanted); updates.push(`username=$${values.length}`);
      }
      if (parsed.data.avatarUrl !== undefined) { values.push(parsed.data.avatarUrl); updates.push(`avatar_url=$${values.length}`); }
      if (parsed.data.bannerUrl !== undefined) { values.push(parsed.data.bannerUrl); updates.push(`banner_url=$${values.length}`); }
      values.push(req.auth.userId);
      return (await client.query(`UPDATE users SET ${[...updates, 'updated_at=now()'].join(',')} WHERE id=$${values.length} RETURNING *`, values)).rows[0];
    });
    res.json({ user: safeUser(row) });
  } catch (error) { if (error.code === '23505' && String(error.constraint || '').includes('username')) return res.status(409).json({error:{code:'USERNAME_TAKEN',message:'این نام کاربری قبلاً ثبت شده است.'}}); next(error); }
});

export default router;
