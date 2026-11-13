#!/bin/bash
set -e
B="${1:-$PWD}"
[ -f "$B/src/server.js" ] && [ -d "$B/migrations" ] || { echo "❌ داخل پوشه backend نیستی"; exit 1; }

cat > "$B/migrations/019_notification_sms.sql" <<'SQL'
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sms_processed_at timestamptz;
-- Existing notifications must never trigger SMS: mark everything that exists now as processed.
UPDATE notifications SET sms_processed_at = now() WHERE sms_processed_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_sms_pending_idx ON notifications(created_at) WHERE sms_processed_at IS NULL;
SQL

cat > "$B/src/services/notification-sms.js" <<'JSFILE'
import { pool } from '../db.js';
import { config } from '../config.js';

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : d; };
const enabled = () => process.env.NOTIFY_SMS_ENABLED === 'true';
const delaySeconds = () => num(process.env.NOTIFY_SMS_DELAY_SECONDS, 90);
const cooldownMinutes = () => Math.max(1, Math.floor(num(process.env.NOTIFY_SMS_COOLDOWN_MINUTES, 30)));
const excludedTypes = () => (process.env.NOTIFY_SMS_EXCLUDE_TYPES ?? 'message').split(',').map((s) => s.trim()).filter(Boolean);

export async function sendSms(to, text) {
  const simple = config.MELIPAYAMAK_ADV_URL.includes('/send/simple/');
  const res = await fetch(config.MELIPAYAMAK_ADV_URL, {
    method: 'POST', signal: AbortSignal.timeout(10000), redirect: 'error',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(simple ? { from: config.MELIPAYAMAK_FROM, to, text } : { from: config.MELIPAYAMAK_FROM, to: [to], text, udh: '' }),
  });
  const body = await res.json().catch(() => null);
  const sent = simple ? Number(body?.recId) > 0 : (Array.isArray(body?.recIds) && body.recIds.some((x) => Number(x) > 0));
  if (!res.ok || !sent) throw new Error(`HTTP ${res.status} ${JSON.stringify(body)}`);
}

export async function runOnce(db = pool, send = sendSms) {
  if (!enabled() || !config.MELIPAYAMAK_ADV_URL || !config.MELIPAYAMAK_FROM || config.DEV_OTP_CODE) return 0;
  const exclude = excludedTypes();
  await db.query(
    `UPDATE notifications SET sms_processed_at=now()
     WHERE sms_processed_at IS NULL AND (read_at IS NOT NULL OR type = ANY($1::text[]) OR created_at < now() - interval '6 hours')`, [exclude]);
  const { rows } = await db.query(
    `WITH picked AS (
       SELECT id FROM notifications
       WHERE sms_processed_at IS NULL AND read_at IS NULL
         AND created_at <= now() - make_interval(secs => $1::int)
       ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED)
     UPDATE notifications n SET sms_processed_at=now() FROM picked WHERE n.id=picked.id
     RETURNING n.id, n.user_id, n.title`, [delaySeconds()]);
  if (!rows.length) return 0;
  const byUser = new Map();
  for (const r of rows) { if (!byUser.has(r.user_id)) byUser.set(r.user_id, []); byUser.get(r.user_id).push(r); }
  const site = process.env.SITE_ADDRESS || 'carma-app.ir';
  let sentCount = 0;
  for (const [userId, items] of byUser) {
    const ids = items.map((i) => i.id);
    try {
      const u = await db.query("SELECT phone_e164 FROM users WHERE id=$1 AND status='active' AND deleted_at IS NULL AND sms_notify", [userId]);
      if (!u.rows[0]) continue;
      const slot = await db.query(
        `INSERT INTO sms_notifications(user_id,kind)
         SELECT $1,'notify' WHERE NOT EXISTS (
           SELECT 1 FROM sms_notifications WHERE user_id=$1 AND kind='notify'
             AND created_at > now() - make_interval(mins => $2::int))
         RETURNING id`, [userId, cooldownMinutes()]);
      if (!slot.rows[0]) {
        await db.query('UPDATE notifications SET sms_processed_at=NULL WHERE id=ANY($1::uuid[])', [ids]);
        continue;
      }
      const phone = u.rows[0].phone_e164;
      const to = phone.startsWith('+98') ? `0${phone.slice(3)}` : phone;
      const text = items.length === 1 ? `کارما: ${String(items[0].title || 'اعلان جدید').slice(0, 60)}\n${site}` : `کارما: ${items.length} اعلان جدید دارید.\n${site}`;
      try { await send(to, text); sentCount += 1; }
      catch (error) { await db.query('DELETE FROM sms_notifications WHERE id=$1', [slot.rows[0].id]).catch(() => {}); console.warn('notification SMS failed:', error.message); }
    } catch (error) { console.warn('notification SMS error:', error.message); }
  }
  return sentCount;
}

let timer = null;
export function startNotificationSms() {
  if (!enabled() || timer) return;
  timer = setInterval(() => { runOnce().catch((e) => console.warn('notification SMS tick:', e.message)); }, 20_000);
  timer.unref?.();
  console.log(JSON.stringify({ level: 'info', event: 'notification_sms_started', delaySeconds: delaySeconds(), cooldownMinutes: cooldownMinutes() }));
}
export function stopNotificationSms() { if (timer) { clearInterval(timer); timer = null; } }
JSFILE

node - "$B" <<'JS'
var fs = require('fs'), path = require('path'), B = process.argv[2];
var f = path.join(B, 'src/server.js'), s = fs.readFileSync(f, 'utf8');
if (s.indexOf('notification-sms') !== -1) { console.log('• server.js از قبل پچ شده'); }
else {
  var pairs = [
    ["import { startNewsIngest, stopNewsIngest } from './services/news-ingest.js';\n",
     "import { startNewsIngest, stopNewsIngest } from './services/news-ingest.js';\nimport { startNotificationSms, stopNotificationSms } from './services/notification-sms.js';\n"],
    ["  startNewsIngest();\n", "  startNewsIngest();\n  startNotificationSms();\n"],
    ["  stopNewsIngest();\n", "  stopNewsIngest();\n  stopNotificationSms();\n"]
  ];
  pairs.forEach(function (p, i) {
    if (s.split(p[0]).length !== 2) { console.error('❌ server.js: بخش ' + (i + 1) + ' دقیقاً یک‌بار پیدا نشد'); process.exit(1); }
    s = s.replace(p[0], function () { return p[1]; });
  });
  fs.copyFileSync(f, f + '.bak-notifysms'); fs.writeFileSync(f, s); console.log('✔ server.js');
}
var e = path.join(B, '.env'), t = fs.existsSync(e) ? fs.readFileSync(e, 'utf8') : '';
if (!/^NOTIFY_SMS_ENABLED=/m.test(t)) {
  fs.copyFileSync(e, e + '.bak-notifysms');
  fs.writeFileSync(e, t + (t && !t.endsWith('\n') ? '\n' : '') + 'NOTIFY_SMS_ENABLED=true\nNOTIFY_SMS_DELAY_SECONDS=90\nNOTIFY_SMS_COOLDOWN_MINUTES=30\n');
  console.log('✔ .env (NOTIFY_SMS_ENABLED=true)');
} else console.log('• .env از قبل تنظیم شده');
JS
echo "✅ فایل‌ها آماده شد. حالا api را بازسازی کن."
