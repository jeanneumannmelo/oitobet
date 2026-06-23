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

// CartWave requires ISO 8601 with milliseconds + Z: "2026-06-25T00:00:00.000Z"
function cartDate(date) {
  return date.toISOString().replace(/(\.\d{3})Z$/, '.000Z');
}

export async function createPixCharge({ amount, externalId, cpf, name }) {
  const expiry = cartDate(new Date(Date.now() + 30 * 60 * 1000));
  return cartwaveRequest('POST', '/v2/finance/create-pix-copy-and-paste', {
    source_account_branch_identifier: ACCOUNT_BRANCH,
    source_account_number: ACCOUNT_NUMBER,
    amount,
    type_fine: 'NONE',
    expiration_date: expiry,
    debtor_document: cpf,
    debtor_name: name || 'Depósito OitoBet',
    type_document: 'CPF',
    tag: externalId,
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

// Diagnostic: attempt PIX charge using module-level proxy and return step-by-step result
export async function diagPix() {
  const steps = {};
  steps.env = { hmac_set: !!HMAC_SECRET, account_number: ACCOUNT_NUMBER, account_branch: ACCOUNT_BRANCH };

  let token;
  try { token = await getToken(); steps.auth = { ok: true }; }
  catch(e) { steps.auth = { ok: false, error: e.message }; return steps; }

  try {
    const result = await cartwaveRequest('POST', '/v2/finance/create-pix-copy-and-paste', {
      source_account_branch_identifier: ACCOUNT_BRANCH,
      source_account_number: ACCOUNT_NUMBER,
      amount: 1,
      type_fine: 'NONE',
      expiration_date: cartDate(new Date(Date.now() + 30 * 60 * 1000)),
      debtor_document: '06381851902',
      debtor_name: 'Teste PIX',
      type_document: 'CPF',
      tag: 'diag_' + Date.now(),
    });
    steps.pix = { ok: true, qr_code_id: result.qr_code_id, tx_id: result.tx_id, status: result.status };
  } catch(e) {
    steps.pix = { ok: false, error: e.message };
  }

  return steps;
}
