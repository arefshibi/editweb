import { pool } from '../db.js';
import { config } from '../config.js';
import { sendPatternSms } from './sms-pattern.js';

// Rules: active user + sms_notify; wait MSG_SMS_DELAY_SECONDS and send only if still unread;
// one SMS per user per MSG_SMS_COOLDOWN_MINUTES; {0} = sanitized display name.
const SAFE_NAME = /[^\p{L}\p{N} _.\-\u200c]/gu;

function patternName(row) {
  const raw = row.nickname || row.display_name || row.username || '';
  const clean = String(raw).replace(SAFE_NAME, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  return clean || 'گرامی';
}

async function deliver(userId, meta) {
  const usingPattern = Boolean(config.MELIPAYAMAK_UNREAD_BODY_ID);
  const u = await pool.query(
    `SELECT phone_e164, nickname, display_name, username FROM users
     WHERE id=$1 AND status='active' AND deleted_at IS NULL AND sms_notify`, [userId]);
  if (!u.rows[0]) return;
  if (meta?.messageId) {
    const unread = await pool.query(
      `SELECT 1 FROM messages m
       LEFT JOIN conversation_reads cr ON cr.conversation_id=m.conversation_id AND cr.user_id=$2
       WHERE m.id=$1 AND m.deleted_at IS NULL AND m.created_at > COALESCE(cr.last_read_at,'epoch'::timestamptz)`,
      [meta.messageId, userId]);
    if (!unread.rows[0]) return;
  }
  const slot = await pool.query(
    `INSERT INTO sms_notifications(user_id,kind)
     SELECT $1,'message' WHERE NOT EXISTS (
       SELECT 1 FROM sms_notifications WHERE user_id=$1 AND kind='message'
         AND created_at > now() - make_interval(mins => $2::int))
     RETURNING id`, [userId, config.MSG_SMS_COOLDOWN_MINUTES]);
  if (!slot.rows[0]) return;
  try {
    const phone = u.rows[0].phone_e164;
    if (usingPattern) await sendPatternSms(phone, config.MELIPAYAMAK_UNREAD_BODY_ID, [patternName(u.rows[0])]);
    else await sendLegacyText(phone);
  } catch (error) {
    await pool.query('DELETE FROM sms_notifications WHERE id=$1', [slot.rows[0].id]).catch(() => {});
    console.warn('message SMS failed:', error.message);
  }
}

async function sendLegacyText(phone) {
  const to = phone.startsWith('+98') ? `0${phone.slice(3)}` : phone;
  const site = process.env.SITE_ADDRESS || 'carma-app.ir';
  const simple = config.MELIPAYAMAK_ADV_URL.includes('/send/simple/');
  const text = `کارما: شما یک پیام جدید دارید.\n${site}`;
  const res = await fetch(config.MELIPAYAMAK_ADV_URL, {
    method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(simple ? { from: config.MELIPAYAMAK_FROM, to, text } : { from: config.MELIPAYAMAK_FROM, to: [to], text, udh: '' }),
  });
  const body = await res.json().catch(() => null);
  const sent = simple ? Number(body?.recId) > 0 : (Array.isArray(body?.recIds) && body.recIds.some((x) => Number(x) > 0));
  if (!res.ok || !sent) throw new Error(`HTTP ${res.status} ${JSON.stringify(body)}`);
}

export function notifyNewMessageBySms(userId, meta = null) {
  try {
    if (config.DEV_OTP_CODE) return;
    const canPattern = Boolean(config.MELIPAYAMAK_UNREAD_BODY_ID);
    const canLegacy = Boolean(config.MELIPAYAMAK_ADV_URL && config.MELIPAYAMAK_FROM);
    if (!canPattern && !canLegacy) return;
    const timer = setTimeout(() => {
      deliver(userId, meta).catch((error) => console.warn('message SMS error:', error.message));
    }, config.MSG_SMS_DELAY_SECONDS * 1000);
    timer.unref?.();
  } catch (error) { console.warn('message SMS error:', error.message); }
}
