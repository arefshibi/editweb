#!/data/data/com.termux/files/usr/bin/bash
set -e
B="${1:-$PWD}"
[ -f "$B/src/services/sms.js" ] && [ -f "$B/src/config.js" ] || { echo "❌ داخل پوشه backend نیستی"; exit 1; }
command -v node >/dev/null || { echo "❌ node نصب نیست: pkg install nodejs"; exit 1; }

cat > "$B/.sms_block.tmp" <<'BLK'
  if (config.SMS_PROVIDER === 'melipayamak') {
    const to = phone.startsWith('+98') ? `0${phone.slice(3)}` : phone;
    // Pattern mode (الگو): we generate the code, Melipayamak only fills {0} in the approved template.
    if (config.MELIPAYAMAK_OTP_BODY_ID) {
      const sharedUrl = config.MELIPAYAMAK_SHARED_URL
        || config.MELIPAYAMAK_OTP_URL.replace('/api/send/otp/', '/api/send/shared/');
      if (!sharedUrl || !sharedUrl.includes('/api/send/shared/')) {
        const error = new Error('SMS provider is not configured');
        error.code = 'SMS_NOT_CONFIGURED';
        throw error;
      }
      const response = await fetch(sharedUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ bodyId: config.MELIPAYAMAK_OTP_BODY_ID, to, args: [String(code)] }),
        signal: AbortSignal.timeout(10000),
        redirect: 'error',
      });
      const body = await response.json().catch(() => null);
      // HTTP 200 alone is not success: Melipayamak returns a positive recId when queued.
      if (!response.ok || !(Number(body?.recId) > 0)) {
        throw new Error(`Melipayamak pattern send failed: HTTP ${response.status} status=${String(body?.status ?? '')}`);
      }
      return {}; // keep our own code digest
    }
    if (!config.MELIPAYAMAK_OTP_URL) {
      const error = new Error('SMS provider is not configured');
      error.code = 'SMS_NOT_CONFIGURED';
      throw error;
    }
    const response = await fetch(config.MELIPAYAMAK_OTP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ to }),
      signal: AbortSignal.timeout(10000),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.code) throw new Error(`Melipayamak rejected the request: ${JSON.stringify(body)}`);
    const providerCode = String(body.code);
    if (!/^\d{6}$/.test(providerCode)) throw new Error(`Melipayamak code length is ${providerCode.length}, site expects 6 digits`);
    return { code: providerCode };
  }
BLK

node - "$B" <<'JS'
const fs = require('fs'), path = require('path');
const B = process.argv[2];
const rd = p => fs.readFileSync(path.join(B, p), 'utf8');
const wr = (p, s) => { const f = path.join(B, p); if (fs.existsSync(f) && !fs.existsSync(f + '.bak-pattern')) fs.copyFileSync(f, f + '.bak-pattern'); fs.writeFileSync(f, s); };
const block = rd('.sms_block.tmp'); fs.unlinkSync(path.join(B, '.sms_block.tmp'));

let c = rd('src/config.js');
if (!c.includes('MELIPAYAMAK_OTP_BODY_ID')) {
  const a = "  MELIPAYAMAK_OTP_URL: z.string().optional().default(''),\n";
  if (!c.includes(a)) throw new Error('config.js: خط MELIPAYAMAK_OTP_URL پیدا نشد');
  c = c.replace(a, a + "  MELIPAYAMAK_SHARED_URL: z.string().optional().default(''),\n  MELIPAYAMAK_OTP_BODY_ID: z.coerce.number().int().positive().optional(),\n");
  const o = "config.SMS_PROVIDER === 'melipayamak' ? !config.MELIPAYAMAK_OTP_URL :";
  if (c.includes(o)) c = c.replace(o, "config.SMS_PROVIDER === 'melipayamak' ? !(config.MELIPAYAMAK_OTP_URL || (config.MELIPAYAMAK_SHARED_URL && config.MELIPAYAMAK_OTP_BODY_ID)) :");
  wr('src/config.js', c); console.log('✔ config.js');
} else console.log('• config.js از قبل پچ شده');

let s = rd('src/services/sms.js');
if (!s.includes('MELIPAYAMAK_OTP_BODY_ID')) {
  const i = s.indexOf("  if (config.SMS_PROVIDER === 'melipayamak') {");
  const j = s.indexOf('  // Explicitly fail closed');
  if (i < 0 || j < i) throw new Error('sms.js: ساختار فایل با انتظار نمی‌خواند');
  wr('src/services/sms.js', s.slice(0, i) + block + s.slice(j)); console.log('✔ sms.js');
} else console.log('• sms.js از قبل پچ شده');

const envp = path.join(B, '.env');
let e = fs.existsSync(envp) ? fs.readFileSync(envp, 'utf8') : '';
const has = k => new RegExp('^' + k + '=', 'm').test(e);
const otp = (e.match(/^MELIPAYAMAK_OTP_URL=(.*)$/m) || [])[1] || '';
let add = '';
if (!has('MELIPAYAMAK_SHARED_URL') && otp.includes('/api/send/otp/')) add += 'MELIPAYAMAK_SHARED_URL=' + otp.trim().replace('/api/send/otp/', '/api/send/shared/') + '\n';
if (!has('MELIPAYAMAK_OTP_BODY_ID')) add += 'MELIPAYAMAK_OTP_BODY_ID=568323\n';
if (add) { wr('.env', e + (e && !e.endsWith('\n') ? '\n' : '') + add); console.log('✔ .env'); }
else console.log('• .env از قبل تنظیم شده');
JS

node --check "$B/src/services/sms.js" && node --check "$B/src/config.js" && echo "✅ تمام. حالا سرور را ری‌استارت کن. بکاپ‌ها: *.bak-pattern"
