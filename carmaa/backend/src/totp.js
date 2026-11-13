// SEC2-PATCH (A15): RFC 6238 TOTP (SHA-1, 6 digits, 30 s) with no extra dependency
import crypto from 'node:crypto';
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32Encode(buf) {
  let bits = 0, val = 0, out = '';
  for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
export function base32Decode(str) {
  let bits = 0, val = 0; const out = [];
  for (const c of String(str).toUpperCase().replace(/=+$/, '')) { const i = B32.indexOf(c); if (i < 0) continue; val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
export function totpAt(secret, counter) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', secret).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}
// returns the matched counter (for replay protection) or null
export function verifyTotp(secret, code, now = Date.now()) {
  const c0 = Math.floor(now / 30000);
  for (const d of [0, -1, 1]) {
    const expected = Buffer.from(totpAt(secret, c0 + d)); const given = Buffer.from(String(code));
    if (expected.length === given.length && crypto.timingSafeEqual(expected, given)) return c0 + d;
  }
  return null;
}
function key() {
  const k = process.env.TOTP_ENC_KEY || '';
  if (k.length < 32) throw new Error('TOTP_ENC_KEY is not configured');
  return crypto.createHash('sha256').update(k).digest();
}
export function encryptSecret(buf) {
  const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(buf), c.final()]);
  return 'v1:' + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}
export function decryptSecret(s) {
  const raw = Buffer.from(String(s).replace(/^v1:/, ''), 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12)); d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]);
}
