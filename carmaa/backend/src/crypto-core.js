import crypto from 'node:crypto';
export const secureEqual = (a, b) => {
  const aa = Buffer.isBuffer(a) ? a : Buffer.from(String(a));
  const bb = Buffer.isBuffer(b) ? b : Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
};
export const otpDigestWithPepper = (pepper, phone, code) => crypto.createHmac('sha256', pepper).update(`${phone}:${code}`).digest();
export const sessionDigestWithPepper = (pepper, token) => crypto.createHmac('sha256', pepper).update(token).digest();
