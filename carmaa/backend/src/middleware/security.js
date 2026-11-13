import crypto from 'node:crypto';
import Redis from 'ioredis';
import { config } from '../config.js';
import { pool } from '../db.js';
import { sessionDigest, safeUser } from '../util.js';

export const redis = new Redis(config.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  connectTimeout: 2000,
  retryStrategy: (times) => times < 5 ? Math.min(times * 250, 1500) : null,
});
redis.on('error', () => { /* connection details/secrets must not be logged */ });

// SEC-PATCH (A9): idle + absolute session timeouts; staff get shorter limits
const SESSION_SQL = `SELECT s.id AS session_id, u.* FROM sessions s JOIN users u ON u.id=s.user_id
  WHERE s.token_digest=$1 AND s.revoked_at IS NULL AND s.expires_at > now()
    AND s.last_seen_at > now() - (CASE WHEN u.role IN ('admin','moderator') THEN $2::int ELSE $3::int END) * interval '1 minute'
    AND (u.role NOT IN ('admin','moderator') OR s.created_at > now() - $4::int * interval '1 hour')
  LIMIT 1`;
const sessionParams = (digest) => [digest, config.SESSION_IDLE_MINUTES_STAFF, config.SESSION_IDLE_MINUTES_USER, config.SESSION_ABSOLUTE_HOURS_STAFF];
const touched = new Map();
function touchSession(id) {
  const now = Date.now();
  if (now - (touched.get(id) || 0) < 120_000) return;
  if (touched.size > 5000) touched.clear();
  touched.set(id, now);
  pool.query('UPDATE sessions SET last_seen_at=now() WHERE id=$1', [id]).catch(() => {});
}

export async function connectRedis() {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Redis connection timeout')), 2500);
    timer.unref?.();
  });
  const connect = (async () => { if (redis.status === 'wait') await redis.connect(); await redis.ping(); })();
  try { await Promise.race([connect, timeout]); }
  finally { if (timer) clearTimeout(timer); }
}

export function createRateLimiter({ name, windowSeconds, max, key = (req) => req.ip || 'unknown' }) {
  const prefix = `carmaa:rl:${name}:`;
  const fallback = new Map();
  let lastCleanup = 0;
  return async function rateLimit(req, res, next) {
    const rawKey = String(key(req) || 'unknown').slice(0, 160);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex').slice(0, 40);
    try {
      if (redis.status === 'ready') {
        const redisKey = `${prefix}${keyHash}`;
        // Increment and establish/repair the expiry atomically. Separate INCR/EXPIRE
        // calls could leave an immortal key if the process stopped between commands.
        const result = await redis.eval(
          `local count = redis.call('INCR', KEYS[1])
           local ttl = redis.call('TTL', KEYS[1])
           if count == 1 or ttl < 0 then
             redis.call('EXPIRE', KEYS[1], ARGV[1])
             ttl = tonumber(ARGV[1])
           end
           return {count, ttl}`,
          1, redisKey, String(windowSeconds),
        );
        const count = Number(result?.[0]);
        const ttl = Number(result?.[1]);
        if (!Number.isFinite(count) || !Number.isFinite(ttl)) throw new Error('Invalid Redis rate-limit response');
        res.setHeader('RateLimit-Limit', String(max));
        res.setHeader('RateLimit-Remaining', String(Math.max(0, max - count)));
        if (count > max) {
          res.setHeader('Retry-After', String(Math.max(ttl, 1))); req.log?.warn({ event: 'rate_limited', limiter: name }, 'Rate limit hit');
          return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.' } });
        }
        return next();
      }
      if (config.isProduction) return res.status(503).json({ error: { code: 'RATE_LIMIT_UNAVAILABLE', message: 'سرویس موقتاً در دسترس نیست.' } });
      const now = Date.now();
      if (now - lastCleanup > 60_000) { for (const [k, v] of fallback) if (v.until < now) fallback.delete(k); lastCleanup = now; }
      const entry = fallback.get(keyHash);
      if (!entry || entry.until < now) fallback.set(keyHash, { count: 1, until: now + windowSeconds * 1000 });
      else entry.count += 1;
      const count = fallback.get(keyHash).count;
      if (count > max) return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.' } });
      return next();
    } catch {
      if (config.isProduction) return res.status(503).json({ error: { code: 'RATE_LIMIT_UNAVAILABLE', message: 'سرویس موقتاً در دسترس نیست.' } });
      return next();
    }
  };
}

export async function authOptional(req, _res, next) {
  try {
    const cookieToken = req.cookies?.[config.COOKIE_NAME];
    const authHeader = req.get('authorization') || '';
    const bearer = /^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(authHeader)?.[1];
    const token = cookieToken || bearer;
    if (!token || token.length < 32 || token.length > 128) return next();
    const { rows } = await pool.query(
      SESSION_SQL, sessionParams(sessionDigest(token)));
    const row = rows[0];
    if (row && row.status === 'active' && !row.deleted_at) req.auth = { sessionId: row.session_id, userId: row.id, user: safeUser(row), role: row.role };
    return next();
  } catch (error) { return next(error); }
}

export async function authRequired(req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const cookieToken = req.cookies?.[config.COOKIE_NAME];
    const authHeader = req.get('authorization') || '';
    const bearer = /^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(authHeader)?.[1];
    const token = cookieToken || bearer;
    if (!token || token.length < 32 || token.length > 128) return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'برای ادامه وارد حساب کاربری شوید.' } });
    const digest = sessionDigest(token);
    const { rows } = await pool.query(
      SESSION_SQL, sessionParams(digest));
    const row = rows[0];
    if (!row || row.status !== 'active' || row.deleted_at) {
      res.clearCookie(config.COOKIE_NAME, { httpOnly: true, secure: config.cookieSecure, sameSite: 'strict', path: '/' });
      return res.status(401).json({ error: { code: 'INVALID_SESSION', message: 'نشست معتبر نیست؛ دوباره وارد شوید.' } });
    }
    req.auth = { sessionId: row.session_id, userId: row.id, user: safeUser(row), role: row.role };
    // Avoid a DB write on every poll but keep the last-seen time reasonably fresh.
    touchSession(row.session_id);
    next();
  } catch (error) { next(error); }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) req.log?.warn({ event: 'access_denied', userId: req.auth?.userId || null, role: req.auth?.role || null, path: req.path }, 'Role check failed');
    if (!req.auth || !roles.includes(req.auth.role)) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'دسترسی لازم را ندارید.' } });
    next();
  };
}

// دسترسی جزئی: مدیر اصلی (admin) همه‌چیز را دارد؛ ناظر فقط مجوزهای تیک‌خورده را.
export const PERMISSIONS = ['listings','showrooms','reports','banners','users','audit'];
export function requirePerm(...perms) {
  return (req, res, next) => {
    const a = req.auth;
    if (a && (a.role === 'admin' || (a.role === 'moderator' && perms.some((p) => (a.user?.permissions || []).includes(p))))) return next();
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'دسترسی لازم را ندارید.' } });
  };
}

export function csrfOriginGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // SameSite=Strict is the default; Origin validation is defense in depth.
  const origin = req.get('origin');
  if (origin && !config.allowedOrigins.includes(origin)) req.log?.warn({ event: 'bad_origin' }, 'Untrusted origin rejected');
  if (origin && !config.allowedOrigins.includes(origin)) return res.status(403).json({ error: { code: 'BAD_ORIGIN', message: 'مبدأ درخواست مجاز نیست.' } });
  if (config.isProduction && req.cookies?.[config.COOKIE_NAME] && !origin && !req.get('authorization')) {
    return res.status(403).json({ error: { code: 'ORIGIN_REQUIRED', message: 'درخواست معتبر نیست.' } });
  }
  next();
}

export function auditAdmin({ actorId, action, targetType, targetId, metadata = {}, requestId }) {
  return pool.query(
    `INSERT INTO admin_audit_logs(actor_id,action,target_type,target_id,metadata,request_id)
     VALUES($1,$2,$3,$4,$5,$6)`,
    [actorId, action, targetType, String(targetId), metadata, requestId || null]);
}

// SEC2-PATCH (A15): staff must pass TOTP once per session when ADMIN_MFA=on
export async function staffMfa(req, res, next) {
  try {
    if (process.env.ADMIN_MFA !== 'on' || !['admin', 'moderator'].includes(req.auth?.role)) return next();
    const { rows } = await pool.query('SELECT s.mfa_verified_at, u.totp_enabled_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1', [req.auth.sessionId]);
    const r = rows[0];
    if (!r?.totp_enabled_at) return res.status(403).json({ error: { code: 'MFA_SETUP_REQUIRED', message: 'احراز هویت دومرحله‌ای برای حساب مدیریتی فعال نشده است؛ از مدیر سرور بخواهید.' } });
    if (!r.mfa_verified_at) return res.status(403).json({ error: { code: 'MFA_REQUIRED', message: 'کد ۶ رقمی برنامه احراز هویت را وارد کنید.' } });
    return next();
  } catch (error) { return next(error); }
}
