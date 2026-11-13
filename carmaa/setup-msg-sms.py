#!/usr/bin/env python3
import os, re, sys
root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
B = os.path.join(root, 'backend')
def rd(p): return open(os.path.join(B, p), encoding='utf-8').read()
def wr(p, s): open(os.path.join(B, p), 'w', encoding='utf-8').write(s)
if not os.path.isdir(B): sys.exit('پوشه‌ی backend پیدا نشد: ' + B)

wr('migrations/017_sms_notify.sql', """ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_notify boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS sms_notifications (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sms_notifications_user_kind_idx ON sms_notifications(user_id, kind, created_at DESC);
""")

c = rd('src/config.js')
if 'MSG_SMS_COOLDOWN_MINUTES' not in c:
    a = "  MELIPAYAMAK_OTP_URL: z.string().optional().default(''),\n"
    assert a in c, 'config.js: MELIPAYAMAK_OTP_URL پیدا نشد'
    c = c.replace(a, a +
      "  MELIPAYAMAK_ADV_URL: z.string().optional().default(''),\n"
      "  MELIPAYAMAK_FROM: z.string().optional().default(''),\n"
      "  MSG_SMS_COOLDOWN_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),\n", 1)
    wr('src/config.js', c)

wr('src/services/message-sms.js', """import { pool } from '../db.js';
import { config } from '../config.js';

export async function notifyNewMessageBySms(userId) {
  try {
    if (!config.MELIPAYAMAK_ADV_URL || !config.MELIPAYAMAK_FROM) return;
    if (config.DEV_OTP_CODE) return;
    const u = await pool.query(
      "SELECT phone_e164 FROM users WHERE id=$1 AND status='active' AND deleted_at IS NULL AND sms_notify", [userId]);
    if (!u.rows[0]) return;
    const slot = await pool.query(
      `INSERT INTO sms_notifications(user_id,kind)
       SELECT $1,'message' WHERE NOT EXISTS (
         SELECT 1 FROM sms_notifications WHERE user_id=$1 AND kind='message'
           AND created_at > now() - make_interval(mins => $2::int))
       RETURNING id`, [userId, config.MSG_SMS_COOLDOWN_MINUTES]);
    if (!slot.rows[0]) return;
    const phone = u.rows[0].phone_e164;
    const to = phone.startsWith('+98') ? `0${phone.slice(3)}` : phone;
    const site = process.env.SITE_ADDRESS || 'carma-app.ir';
    const simple = config.MELIPAYAMAK_ADV_URL.includes('/send/simple/');
    const text = `کارما: شما یک پیام جدید دارید.\\n${site}`;
    try {
      const res = await fetch(config.MELIPAYAMAK_ADV_URL, {
        method: 'POST', signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(simple ? { from: config.MELIPAYAMAK_FROM, to, text } : { from: config.MELIPAYAMAK_FROM, to: [to], text, udh: '' }),
      });
      const body = await res.json().catch(() => null);
      const sent = simple ? Number(body?.recId) > 0 : (Array.isArray(body?.recIds) && body.recIds.some((x) => Number(x) > 0));
      if (!res.ok || !sent) throw new Error(`HTTP ${res.status} ${JSON.stringify(body)}`);
    } catch (error) {
      await pool.query('DELETE FROM sms_notifications WHERE id=$1', [slot.rows[0].id]).catch(() => {});
      console.warn('message SMS failed:', error.message);
    }
  } catch (error) { console.warn('message SMS error:', error.message); }
}
""")

m = rd('src/routes/messages.js')
if 'notifyNewMessageBySms' not in m:
    a = "import { saveMedia, removeMedia, mediaUrl } from '../services/media.js';"
    assert a in m, 'messages.js: import پیدا نشد'
    m = m.replace(a, a + "\nimport { notifyNewMessageBySms } from '../services/message-sms.js';", 1)
    a = "async function insertMessage(req, conversationId, { body, kind = 'text', media = null, storyId = null }) {\n  return transaction(async (client) => {"
    assert a in m, 'messages.js: insertMessage پیدا نشد'
    m = m.replace(a, "async function insertMessage(req, conversationId, { body, kind = 'text', media = null, storyId = null }) {\n  let notifyTo = null;\n  const result = await transaction(async (client) => {", 1)
    b = "    return shapeMessage(created[0]);\n  });\n}"
    assert b in m, 'messages.js: انتهای insertMessage پیدا نشد'
    m = m.replace(b, "    notifyTo = other;\n    return shapeMessage(created[0]);\n  });\n  if (notifyTo) notifyNewMessageBySms(notifyTo);\n  return result;\n}", 1)
    wr('src/routes/messages.js', m)

def setenv(path, key, val):
    t = open(path, encoding='utf-8').read() if os.path.exists(path) else ''
    if re.search(rf'^{key}=', t, re.M): t = re.sub(rf'^{key}=.*$', lambda _: f'{key}={val}', t, flags=re.M)
    else: t += ('' if t.endswith('\n') or not t else '\n') + f'{key}={val}\n'
    open(path, 'w', encoding='utf-8').write(t)
env = os.path.join(B, '.env'); ex = os.path.join(B, '.env.example')
url = os.environ.get('SMS_URL', '').strip()
setenv(env, 'MELIPAYAMAK_FROM', os.environ.get('SMS_FROM', '50004001926283').strip())
setenv(env, 'MELIPAYAMAK_ADV_URL', url)
setenv(env, 'MSG_SMS_COOLDOWN_MINUTES', '15')
if os.path.exists(ex):
    for k in ('MELIPAYAMAK_ADV_URL', 'MELIPAYAMAK_FROM'):
        if not re.search(rf'^{k}=', open(ex, encoding='utf-8').read(), re.M): setenv(ex, k, '')
print('OK. خط ارسال: 50004001926283' + ('' if url else '  |  هشدار: SMS_URL خالی است؛ MELIPAYAMAK_ADV_URL را در backend/.env پر کن.'))
