import crypto from 'node:crypto';
import { config } from './config.js';
import { normalizePhoneValue } from './phone.js';
import { otpDigestWithPepper, sessionDigestWithPepper, secureEqual } from './crypto-core.js';

export const uuid = () => crypto.randomUUID();
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (value) => crypto.createHash('sha256').update(value).digest();
export const otpDigest = (phone, code) => otpDigestWithPepper(config.OTP_PEPPER, phone, code);
export const sessionDigest = (token) => sessionDigestWithPepper(config.SESSION_PEPPER, token);
export function normalizePhone(input) { return normalizePhoneValue(input, config.DEFAULT_PHONE_COUNTRY_CODE); }
export function safeUser(row) {
  if (!row) return null;
  return { id: row.id, phone: row.phone_e164, displayName: row.display_name || '', nickname: row.nickname || '', email: row.email || '', username: row.username || '', usernameAuto: !!row.username_auto, usernameChangesLeft: row.username ? (row.username_auto ? 2 : Math.max(0, 2 - Number(row.username_changes || 0))) : null, avatarUrl: row.avatar_url || null, bannerUrl: row.banner_url || null, role: row.role, permissions: Array.isArray(row.permissions) ? row.permissions : [], status: row.status, createdAt: row.created_at };
}
export function escapeLike(value) { return value.replace(/[\\%_]/g, '\\$&'); }
export function parsePositiveInt(value, fallback, max) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
}
export function err(status, code, message, details) {
  const e = new Error(message);
  e.status = status; e.code = code;
  if (details !== undefined) e.details = details;
  return e;
}
export { secureEqual };
