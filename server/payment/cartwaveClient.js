import crypto from 'crypto';

const BASE_URL = process.env.CARTWAVE_BASE_URL || 'https://api.cartwavehub.com.br';
const EMAIL    = process.env.CARTWAVE_EMAIL;
const PASSWORD = process.env.CARTWAVE_PASSWORD;
const HMAC_SECRET = process.env.CARTWAVE_HMAC_SECRET;

let _token = null;
let _tokenExpiresAt = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpiresAt) return _token;

  const res = await fetch(`${BASE_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`CartWave auth failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  _token = data.access_token;
  // Cache for 55 min (token valid for 60 min)
  _tokenExpiresAt = Date.now() + 55 * 60 * 1000;
  return _token;
}

function hmacSign(payload) {
  return crypto
    .createHmac('sha512', HMAC_SECRET)
    .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
    .digest('hex');
}

export function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const expected = hmacSign(rawBody);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signatureHeader, 'hex'),
    );
  } catch {
    return false;
  }
}

async function cartwaveRequest(method, path, body) {
  const token = await getToken();
  const payload = body ? JSON.stringify(body) : '';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  if (payload) headers['X-Signature'] = hmacSign(payload);

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: payload || undefined,
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) throw new Error(`CartWave ${method} ${path} → ${res.status}: ${text}`);
  return data;
}

export async function createPixCharge({ amount, externalId, description }) {
  return cartwaveRequest('POST', '/pix/create-pix-copy-and-paste-simplified', {
    amount,
    external_id: externalId,
    description: description || 'Depósito OitoBet',
  });
}

export async function createCashout({ amount, pixKey, pixKeyType, externalId }) {
  return cartwaveRequest('POST', '/cashout/create-cashout-self-approve', {
    amount,
    pix_key: pixKey,
    pix_key_type: pixKeyType || 'cpf',
    external_id: externalId,
    description: 'Saque OitoBet',
  });
}

export async function getCashoutStatus(cashoutId) {
  return cartwaveRequest('GET', `/cashout/status-cashout?id=${cashoutId}`);
}

export async function getAccountBalance() {
  return cartwaveRequest('GET', '/account/balance');
}

export async function registerWebhook(url) {
  return cartwaveRequest('POST', '/webhook/webhooks', { url });
}
