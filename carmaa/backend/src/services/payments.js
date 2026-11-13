import { config } from '../config.js';

const ZARINPAL_API = config.paymentSandbox
  ? 'https://sandbox.zarinpal.com/pg/v4/payment'
  : 'https://payment.zarinpal.com/pg/v4/payment';
const ZARINPAL_START = config.paymentSandbox
  ? 'https://sandbox.zarinpal.com/pg/StartPay/'
  : 'https://payment.zarinpal.com/pg/StartPay/';

async function zarinpalRequest(path, payload) {
  if (!config.ZARINPAL_MERCHANT_ID) {
    const error = new Error('Payment provider is not configured');
    error.code = 'PAYMENT_NOT_CONFIGURED';
    throw error;
  }
  const response = await fetch(`${ZARINPAL_API}/${path}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ merchant_id: config.ZARINPAL_MERCHANT_ID, ...payload }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || !data.data) throw new Error('Payment provider request failed');
  return data;
}

export async function createGatewayPayment(order, callbackUrl, description) {
  // Zarinpal accepts amounts in rial. Catalog + user-facing price is in toman.
  const amountRial = Number(order.amount_rial);
  if (!Number.isSafeInteger(amountRial) || amountRial < 1000) throw new Error('Invalid payment amount');
  const result = await zarinpalRequest('request', {
    amount: amountRial,
    callback_url: callbackUrl,
    description: String(description).slice(0, 250),
    metadata: { order_id: order.id },
  });
  if (result.data.code !== 100 && result.data.code !== 101) {
    const error = new Error('Payment provider did not issue an authority');
    error.code = 'PAYMENT_REQUEST_REJECTED';
    throw error;
  }
  if (!result.data.authority) throw new Error('Payment authority missing');
  return { authority: result.data.authority, redirectUrl: `${ZARINPAL_START}${encodeURIComponent(result.data.authority)}` };
}

export async function verifyGatewayPayment(order, authority) {
  const result = await zarinpalRequest('verify', {
    amount: Number(order.amount_rial),
    authority,
  });
  const code = Number(result.data.code);
  const refId = String(result.data.ref_id ?? '').trim();
  if ((code === 100 || code === 101) && refId) {
    return { paid: true, refId, code };
  }
  // ZarinPal documents 100/101 as success. -51 is the explicit not-paid
  // result; other codes can mean a transient/provider/configuration failure and
  // must not close the order as failed without reconciliation.
  if (code === -51) return { paid: false, code };
  const error = new Error('Payment verification result was inconclusive');
  error.code = 'PAYMENT_VERIFICATION_UNCERTAIN';
  throw error;
}
