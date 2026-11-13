import { config } from '../config.js';

export async function sendOtpSms(phone, code) {
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
  // Explicitly fail closed: no local/demo OTP and no code in the API response.
  if (config.SMS_PROVIDER !== 'kavenegar' || !config.KAVENEGAR_API_KEY) {
    const error = new Error('SMS provider is not configured');
    error.code = 'SMS_NOT_CONFIGURED';
    throw error;
  }
  const text = `کد ورود کارما: ${code}\nاین کد را در اختیار هیچ‌کس قرار ندهید.`;
  const url = new URL(`https://api.kavenegar.com/v1/${encodeURIComponent(config.KAVENEGAR_API_KEY)}/sms/send.json`);
  // Kavenegar's common domestic receptor format is the Iranian local number (09...).
  // Keep the account's canonical E.164 phone in storage; only adapt at the provider edge.
  const receptor = phone.startsWith('+98') ? `0${phone.slice(3)}` : phone;
  const form = new URLSearchParams({ receptor, message: text });
  if (config.KAVENEGAR_SENDER) form.set('sender', config.KAVENEGAR_SENDER);
  // POST keeps the one-time code out of query strings and common proxy access logs.
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: form,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`SMS provider returned HTTP ${response.status}`);
  const body = await response.json().catch(() => null);
  if (body?.return?.status !== 200) throw new Error('SMS provider rejected the request');
}
