import crypto from 'crypto';
import { ProxyAgent, fetch as undiciFetch } from 'undici';

const BASE_URL     = process.env.CARTWAVE_BASE_URL     || 'https://api.cartwavehub.com.br';
const CLIENT_ID    = process.env.CARTWAVE_EMAIL;
const CLIENT_SECRET= process.env.CARTWAVE_PASSWORD;
const HMAC_SECRET  = process.env.CARTWAVE_HMAC_SECRET;
const ACCOUNT_BRANCH = process.env.CARTWAVE_ACCOUNT_BRANCH || '0001';
const ACCOUNT_NUMBER = process.env.CARTWAVE_ACCOUNT_NUMBER || '7004635';

// Route CartWave calls through Fixie static IP proxy when available
const _proxyAgent = process.env.FIXIE_URL ? new ProxyAgent(process.env.FIXIE_URL) : null;
const proxiedFetch = (url, opts = {}) =>
  _proxyAgent ? undiciFetch(url, { ...opts, dispatcher: _proxyAgent }) : fetch(url, opts);

let _token = null;
let _tokenExpiresAt = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpiresAt) return _token;

  const res = await proxiedFetch(`${BASE_URL}/v2/finance/auth-token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`CartWave auth failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  _token = data.access_token;
  _tokenExpiresAt = Date.now() + 55 * 60 * 1000; // 55 min cache
  return _token;
}

// CartWave requires compact JSON (no spaces after : or ,) for HMAC
function compactJson(obj) {
  return JSON.stringify(obj);
}

function hmacSign(payload) {
  const input = typeof payload === 'string' ? payload : compactJson(payload);
  return crypto
    .createHmac('sha512', HMAC_SECRET)
    .update(input)
    .digest('hex');
}

export function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader || !HMAC_SECRET) return false;
  try {
    const expected = hmacSign(rawBody);
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
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  let bodyStr;
  if (body) {
    bodyStr = compactJson(body);
    headers['hmac'] = hmacSign(bodyStr);
  }

  const res = await proxiedFetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: bodyStr,
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) throw new Error(`CartWave ${method} ${path} → ${res.status}: ${text}`);
  return data;
}

// Expiry 30 min from now in CartWave format
function expirationDate() {
  const d = new Date(Date.now() + 30 * 60 * 1000);
  return d.toISOString().replace('T', 'T').slice(0, 19);
}

export async function createPixCharge({ amount, externalId, description }) {
  return cartwaveRequest('POST', '/v2/finance/create-pix-copy-and-paste-web-simplified', {
    source_account_branch_identifier: ACCOUNT_BRANCH,
    source_account_number: ACCOUNT_NUMBER,
    amount,
    type_fine: 'NONE',
    expiration_date: expirationDate(),
    debtor_name: description || 'Depósito OitoBet',
    tag: externalId, // our Firestore txId — echoed back in webhook
  });
}

export async function createCashout({ amount, pixKey, externalId }) {
  return cartwaveRequest('POST', '/v2/finance/create-cashout-self-approve', {
    source_account_branch_identifier: ACCOUNT_BRANCH,
    source_account_number: ACCOUNT_NUMBER,
    amount,
    key: pixKey,       // CartWave uses 'key', not 'pix_key'
    tag: externalId,   // echoed back in webhook for correlation
  });
}

export async function getPixStatus(id) {
  return cartwaveRequest('GET', `/v2/finance/status-pix-copy-and-paste?id=${id}`);
}

export async function getCashoutStatus(id) {
  return cartwaveRequest('GET', `/v2/finance/status-cashout?id=${id}`);
}

export async function getAccountBalance() {
  return cartwaveRequest('GET', `/v2/finance/get-balance?account_branch_identifier=${ACCOUNT_BRANCH}&account_number=${ACCOUNT_NUMBER}`);
}

export async function registerWebhook(url, typeWebhook) {
  return cartwaveRequest('POST', '/v2/webhook/webhooks', {
    source_account_branch_identifier: ACCOUNT_BRANCH,
    source_account_number: ACCOUNT_NUMBER,
    url,
    type_webhook: typeWebhook,
  });
}

// Diagnostic: probe multiple PIX endpoint candidates using existing proxy+auth
export async function diagPixEndpoints() {
  const token = await getToken();
  const expiry = new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 19);
  const postBody = JSON.stringify({
    source_account_branch_identifier: ACCOUNT_BRANCH,
    source_account_number: ACCOUNT_NUMBER,
    amount: 10,
    type_fine: 'NONE',
    expiration_date: expiry,
    debtor_name: 'Teste PIX',
    tag: 'test_pix_probe_' + Date.now(),
  });

  // Probe GET on API root paths to discover available routes
  const getProbes = ['/v2/', '/openapi.json', '/docs', '/swagger/index.html'];
  const getResults = {};
  for (const path of getProbes) {
    try {
      const r = await proxiedFetch(`${BASE_URL}${path}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const text = await r.text();
      getResults[path] = { status: r.status, body: text.slice(0, 200) };
    } catch (e) { getResults[path] = { error: e.message.slice(0, 80) }; }
  }

  const altBaseResults = {};

  const candidates = [
    '/v2/finance/create-pix-copy-and-paste-web-simplified',
    '/v2/finance/create-pix-copy-and-paste-simplified',
    '/v2/finance/create-pix-copy-paste-simplified',
    '/v2/finance/create-pix-qrcode',
    '/v2/finance/create-pix-qr-code',
    '/v2/finance/generate-pix',
    '/v2/finance/gerar-cobranca-pix',
    '/v2/finance/create-pix-cob',
    '/v2/finance/create-bill-pix',
    '/v2/finance/create-pix',
    '/v2/finance/create-cobranca',
    '/v2/payment/pix',
    '/v2/billing/pix',
    '/v2/charge/pix',
    '/v2/cobr/pix',
    '/v1/finance/create-pix-copy-and-paste-simplified',
    '/pix/create',
    '/pix/charge',
  ];

  const postResults = {};
  for (const path of candidates) {
    try {
      const r = await proxiedFetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: postBody,
      });
      const text = await r.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 400); }
      postResults[path] = { status: r.status, body: parsed };
      if (r.status !== 404) break; // stop at first non-404
    } catch (e) { postResults[path] = { error: e.message, cause: e.cause?.message || e.cause?.code || String(e.cause || '') }; }
  }

  return { token_ok: true, getProbes: getResults, altBases: altBaseResults, postResults };
}
