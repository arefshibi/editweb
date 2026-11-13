import { config } from '../config.js';

function patternSendUrl() {
  const url = config.MELIPAYAMAK_SHARED_URL
    || String(config.MELIPAYAMAK_OTP_URL || '').replace('/api/send/otp/', '/api/send/shared/');
  return url.includes('/api/send/shared/') ? url : '';
}

// Melipayamak pattern (الگو) sender: the provider fills {0},{1},... of the approved template with `args`.
export async function sendPatternSms(phone, bodyId, args = []) {
  const url = patternSendUrl();
  if (!url || !bodyId) {
    const error = new Error('SMS pattern is not configured');
    error.code = 'SMS_NOT_CONFIGURED';
    throw error;
  }
  const to = phone.startsWith('+98') ? `0${phone.slice(3)}` : phone;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ bodyId: Number(bodyId), to, args: args.map((a) => String(a)) }),
    signal: AbortSignal.timeout(10000),
    redirect: 'error',
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !(Number(body?.recId) > 0)) {
    throw new Error(`Melipayamak pattern send failed: HTTP ${response.status} status=${String(body?.status ?? '')}`);
  }
  return { recId: Number(body.recId) };
}
