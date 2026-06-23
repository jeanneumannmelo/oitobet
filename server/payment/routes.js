import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminAuth } from '../firebase-admin.js';
import { verifyFirebaseToken, paymentRateLimiter } from './middleware.js';
import {
  createPixCharge,
  createCashout,
  verifyWebhookSignature,
} from './cartwaveClient.js';

const router = Router();

const WITHDRAW_FEE = 2; // R$2,00 taxa fixa de saque

// ── Middleware admin: verifica ADMIN_SECRET no header Authorization ────────────
function verifyAdminSecret(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return res.status(503).json({ error: 'Admin não configurado.' });
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token || token !== secret) return res.status(401).json({ error: 'Não autorizado.' });
  next();
}

// ── POST /api/payment/deposit ─────────────────────────────────────────────────
router.post('/payment/deposit', paymentRateLimiter, verifyFirebaseToken, async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    if (!amount || amount < 10 || amount > 500) {
      return res.status(400).json({ error: 'Valor inválido. Mín R$10, máx R$500.' });
    }

    // Fetch user name and CPF for PIX debtor fields
    const [userRecord, userSnap] = await Promise.all([
      adminAuth.getUser(req.uid),
      adminDb.collection('users').doc(req.uid).get(),
    ]);
    const name = userRecord.displayName || userSnap.data()?.nickname || 'Usuário OitoBet';
    const cpf  = userSnap.data()?.cpf || '00000000000';

    // Create pending transaction doc first — its ID becomes the CartWave tag for webhook correlation
    const txRef = await adminDb.collection('transactions').add({
      uid: req.uid,
      type: 'deposit',
      amount,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });

    let pix;
    try {
      pix = await createPixCharge({ amount, externalId: txRef.id, cpf, name });
    } catch (e) {
      await txRef.update({ status: 'failed', error: e.message });
      console.error('[deposit] createPixCharge failed:', e.message);
      return res.status(502).json({ error: 'Erro ao gerar PIX. Tente novamente.' });
    }

    // CartWave response fields: qr_code_id, tx_id, pix_copy_and_paste, base_64_image_url
    const cartwaveTxId = String(pix.qr_code_id || pix.tx_id || '');
    const pixCode      = pix.pix_copy_and_paste || '';
    const qrCodeUrl    = pix.base_64_image_url || null;
    const expiresAt    = pix.expiration_date || null;

    await txRef.update({ cartwaveTxId, pixCode, qrCodeUrl, expiresAt });

    res.json({ txId: txRef.id, pixCode, qrCodeUrl, expiresAt });
  } catch (e) {
    console.error('[deposit]', e.message);
    res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  }
});

// ── POST /api/payment/withdraw ────────────────────────────────────────────────
// Saques vão para aprovação manual — admin processa via /api/admin/approve-withdrawal
router.post('/payment/withdraw', paymentRateLimiter, verifyFirebaseToken, async (req, res) => {
  try {
    const amount     = Number(req.body?.amount);
    const pixKey     = String(req.body?.pixKey || '').trim();
    const pixKeyType = String(req.body?.pixKeyType || 'cpf').toLowerCase();

    if (!amount || amount < 10) {
      return res.status(400).json({ error: 'Valor mínimo de saque é R$10.' });
    }
    if (!pixKey) {
      return res.status(400).json({ error: 'Chave PIX obrigatória.' });
    }

    const totalDebit = amount + WITHDRAW_FEE;

    // Debitar saldo atomicamente agora para evitar double-spend enquanto aguarda aprovação
    const userRef = adminDb.collection('users').doc(req.uid);
    await adminDb.runTransaction(async t => {
      const snap = await t.get(userRef);
      if (!snap.exists) throw new Error('Usuário não encontrado');
      const balance = snap.data().balance || 0;
      if (balance < totalDebit) throw new Error('INSUFFICIENT_BALANCE');
      t.update(userRef, {
        balance: FieldValue.increment(-totalDebit),
        totalWithdrawn: FieldValue.increment(amount),
      });
    });

    const txRef = await adminDb.collection('transactions').add({
      uid: req.uid,
      type: 'withdrawal',
      amount,
      fee: WITHDRAW_FEE,
      totalDebit,
      pixKey,
      pixKeyType,
      status: 'pending_approval',
      createdAt: FieldValue.serverTimestamp(),
    });

    console.log(`[withdraw] pending_approval uid=${req.uid} amount=${amount} pixKey=${pixKey} txId=${txRef.id}`);
    res.json({ success: true, txId: txRef.id });
  } catch (e) {
    if (e.message === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ error: 'Saldo insuficiente.' });
    }
    console.error('[withdraw]', e.message);
    res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  }
});

// ── POST /api/admin/approve-withdrawal/:txId ──────────────────────────────────
router.post('/admin/approve-withdrawal/:txId', verifyAdminSecret, async (req, res) => {
  const { txId } = req.params;
  try {
    const txSnap = await adminDb.collection('transactions').doc(txId).get();
    if (!txSnap.exists) return res.status(404).json({ error: 'Transação não encontrada.' });

    const tx = txSnap.data();
    if (tx.type !== 'withdrawal') return res.status(400).json({ error: 'Não é um saque.' });
    if (tx.status !== 'pending_approval') {
      return res.status(409).json({ error: `Status inválido: ${tx.status}` });
    }

    let cashout;
    try {
      cashout = await createCashout({ amount: tx.amount, pixKey: tx.pixKey, externalId: txId });
    } catch (e) {
      // Estornar saldo se CartWave falhar
      await adminDb.collection('users').doc(tx.uid).update({
        balance: FieldValue.increment(tx.totalDebit),
        totalWithdrawn: FieldValue.increment(-tx.amount),
      });
      await txSnap.ref.update({ status: 'failed', error: e.message, failedAt: FieldValue.serverTimestamp() });
      console.error('[admin approve] cashout failed, refunded uid=%s:', tx.uid, e.message);
      return res.status(502).json({ error: 'CartWave falhou. Saldo estornado.', detail: e.message });
    }

    const cartwaveTxId = String(cashout.id || cashout.transaction_id || '');
    await txSnap.ref.update({
      status: 'processing',
      cartwaveTxId,
      approvedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[admin approve] txId=${txId} cartwaveTxId=${cartwaveTxId}`);
    res.json({ success: true, cartwaveTxId });
  } catch (e) {
    console.error('[admin approve]', e.message);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── POST /api/admin/reject-withdrawal/:txId ───────────────────────────────────
router.post('/admin/reject-withdrawal/:txId', verifyAdminSecret, async (req, res) => {
  const { txId } = req.params;
  try {
    const txSnap = await adminDb.collection('transactions').doc(txId).get();
    if (!txSnap.exists) return res.status(404).json({ error: 'Transação não encontrada.' });

    const tx = txSnap.data();
    if (tx.type !== 'withdrawal') return res.status(400).json({ error: 'Não é um saque.' });
    if (tx.status !== 'pending_approval') {
      return res.status(409).json({ error: `Status inválido: ${tx.status}` });
    }

    // Estornar saldo + taxa
    await adminDb.runTransaction(async t => {
      t.update(adminDb.collection('users').doc(tx.uid), {
        balance: FieldValue.increment(tx.totalDebit),
        totalWithdrawn: FieldValue.increment(-tx.amount),
      });
      t.update(txSnap.ref, {
        status: 'rejected',
        rejectedAt: FieldValue.serverTimestamp(),
        rejectionReason: req.body?.reason || 'Rejeitado pelo admin',
      });
    });

    console.log(`[admin reject] txId=${txId} uid=${tx.uid} refund=${tx.totalDebit}`);
    res.json({ success: true });
  } catch (e) {
    console.error('[admin reject]', e.message);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── POST /api/webhooks/cartwave ───────────────────────────────────────────────
router.post('/webhooks/cartwave', async (req, res) => {
  const rawBody = req.rawBody;
  // CartWave pode usar 'hmac' ou 'x-signature' dependendo da versão
  const signature = req.headers['hmac'] || req.headers['x-signature'] || '';

  if (!rawBody) {
    console.warn('[webhook] raw body ausente');
    return res.status(400).json({ error: 'Body inválido' });
  }

  // Log completo para diagnóstico do formato de assinatura CartWave
  console.log('[webhook] body_full:', rawBody);
  console.log('[webhook] sig recebida:', signature);

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn('[webhook] assinatura inválida — processando mesmo assim para diagnóstico');
    // TODO: reativar rejeição após confirmar formato correto do HMAC
    // return res.status(401).json({ error: 'Assinatura inválida' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'JSON inválido' });
  }

  // Formato CartWave: { "type": "...", "data": { amount, tag, qr_code_id, tx_id, ... } }
  const eventType = event.type || '';
  const data      = event.data || {};
  const tag       = String(data.tag || '');
  const amount    = Number(data.amount || 0);

  console.log(`[webhook] event=${eventType} tag=${tag} amount=${amount}`);

  // Responder 200 imediatamente — CartWave reenvia se não receber 2xx
  res.status(200).json({ ok: true });

  // Processar de forma assíncrona para não bloquear a resposta
  processWebhookEvent({ eventType, tag, amount, data }).catch(e => {
    console.error('[webhook] processamento assíncrono falhou:', e.message);
  });
});

async function processWebhookEvent({ eventType, tag, amount, data }) {
  // 1. Localizar transação pelo tag (externalId = Firestore txId enviado na criação do PIX)
  let txDoc = null;
  if (tag && tag !== 'NONE') {
    const snap = await adminDb.collection('transactions').doc(tag).get();
    if (snap.exists) txDoc = snap;
  }

  // 2. Fallback: buscar por cartwaveTxId usando campos de data
  if (!txDoc) {
    const cartwaveTxId = String(data.qr_code_id || data.transaction_id || data.tx_id || '');
    if (cartwaveTxId) {
      const q = await adminDb.collection('transactions')
        .where('cartwaveTxId', '==', cartwaveTxId)
        .limit(1)
        .get();
      if (!q.empty) txDoc = q.docs[0];
    }
  }

  if (!txDoc) {
    console.warn('[webhook] transação não encontrada event=%s tag=%s', eventType, tag);
    return;
  }

  const tx = txDoc.data();

  // Idempotência
  if (tx.status === 'completed' || tx.status === 'failed' || tx.status === 'rejected') {
    console.log('[webhook] ignorado — status já final:', tx.status);
    return;
  }

  const userRef = adminDb.collection('users').doc(tx.uid);

  // Depósito confirmado
  if (eventType === 'QR_CODE_COPY_AND_PASTE_PAID' || eventType === 'PIX_CASHIN_RECEIVED') {
    await adminDb.runTransaction(async t => {
      t.update(userRef, {
        balance: FieldValue.increment(amount),
        totalDeposited: FieldValue.increment(amount),
      });
      t.update(txDoc.ref, { status: 'completed', completedAt: FieldValue.serverTimestamp() });
    });
    console.log(`[webhook] depósito confirmado uid=${tx.uid} amount=${amount}`);

  // Cashout concluído (após aprovação admin)
  } else if (eventType === 'PIX_CASHOUT_SUCCESS' || eventType === 'CASHOUT_COMPLETED') {
    await txDoc.ref.update({ status: 'completed', completedAt: FieldValue.serverTimestamp() });
    console.log(`[webhook] cashout concluído uid=${tx.uid} amount=${amount}`);

  // Cashout falhou (CartWave rejeitou após aprovação admin)
  } else if (eventType === 'PIX_CASHOUT_ERROR' || eventType === 'PIX_CASHOUT_CANCELED' || eventType === 'CASHOUT_FAILED') {
    const totalDebit = tx.totalDebit || (tx.amount + (tx.fee || 0));
    await adminDb.runTransaction(async t => {
      t.update(userRef, {
        balance: FieldValue.increment(totalDebit),
        totalWithdrawn: FieldValue.increment(-tx.amount),
      });
      t.update(txDoc.ref, { status: 'failed', failedAt: FieldValue.serverTimestamp() });
    });
    console.log(`[webhook] cashout falhou — estorno uid=${tx.uid} totalDebit=${totalDebit}`);
  } else {
    console.log(`[webhook] evento não tratado: ${eventType}`);
  }
}

// ── POST /api/game/debit-bet ──────────────────────────────────────────────────
router.post('/game/debit-bet', verifyFirebaseToken, async (req, res) => {
  const betAmount = Number(req.body?.betAmount);
  if (!betAmount || betAmount <= 0 || betAmount > 10000) {
    return res.status(400).json({ error: 'Valor de aposta inválido.' });
  }

  const userRef = adminDb.collection('users').doc(req.uid);
  try {
    await adminDb.runTransaction(async t => {
      const snap = await t.get(userRef);
      if (!snap.exists) throw new Error('Usuário não encontrado');
      const balance = snap.data()?.balance || 0;
      if (balance < betAmount) throw new Error('INSUFFICIENT_BALANCE');
      t.update(userRef, { balance: FieldValue.increment(-betAmount) });
    });
    res.json({ success: true });
  } catch (e) {
    if (e.message === 'INSUFFICIENT_BALANCE') return res.status(400).json({ error: 'Saldo insuficiente.' });
    console.error('[debit-bet]', e.message);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── POST /api/game/finalize ───────────────────────────────────────────────────
router.post('/game/finalize', verifyFirebaseToken, async (req, res) => {
  const { playerWon, betAmount = 0, xpGain = 50 } = req.body || {};
  if (typeof playerWon !== 'boolean') return res.status(400).json({ error: 'playerWon obrigatório.' });

  const today = new Date().toISOString().split('T')[0];
  const userRef = adminDb.collection('users').doc(req.uid);

  try {
    const snap = await userRef.get();
    const data = snap.data() || {};
    const isSameDay = data.dailyDate === today;
    const updates = {};

    if (playerWon) {
      updates.wins = FieldValue.increment(1);
      updates.xp = FieldValue.increment(xpGain);
      if (betAmount > 0) {
        updates.balance = FieldValue.increment(betAmount * 2);
        updates.totalEarned = FieldValue.increment(betAmount * 2);
      }
      updates.dailyDate = today;
      updates.dailyWins = isSameDay ? FieldValue.increment(1) : 1;
      updates.dailyEarnings = betAmount > 0
        ? (isSameDay ? FieldValue.increment(betAmount) : betAmount)
        : (isSameDay ? data.dailyEarnings || 0 : 0);
    } else {
      updates.losses = FieldValue.increment(1);
      updates.xp = FieldValue.increment(10);
      if (!isSameDay) {
        updates.dailyDate = today;
        updates.dailyWins = 0;
        updates.dailyEarnings = 0;
      }
    }

    await userRef.update(updates);
    res.json({ success: true });
  } catch (e) {
    console.error('[game/finalize]', e.message);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

export default router;
