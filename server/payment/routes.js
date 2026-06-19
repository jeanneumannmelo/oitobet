import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin.js';
import { verifyFirebaseToken, paymentRateLimiter } from './middleware.js';
import {
  createPixCharge,
  createCashout,
  verifyWebhookSignature,
} from './cartwaveClient.js';

const router = Router();

// ── POST /api/payment/deposit ─────────────────────────────────────────────────
router.post('/payment/deposit', paymentRateLimiter, verifyFirebaseToken, async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    if (!amount || amount < 10 || amount > 500) {
      return res.status(400).json({ error: 'Valor inválido. Mín R$10, máx R$500.' });
    }

    // Create pending transaction doc first to get the ID as externalId
    const txRef = await adminDb.collection('transactions').add({
      uid: req.uid,
      type: 'deposit',
      amount,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });

    const pix = await createPixCharge({
      amount,
      externalId: txRef.id,
      description: `Depósito OitoBet R$${amount}`,
    });

    // Persist CartWave transaction id and pix code
    await txRef.update({
      cartwaveTxId: pix.id || pix.txid || pix.transaction_id || '',
      pixCode: pix.copy_and_paste || pix.qr_code || pix.pix_code || '',
      expiresAt: pix.expires_at || pix.expiration || null,
    });

    res.json({
      txId: txRef.id,
      pixCode: pix.copy_and_paste || pix.qr_code || pix.pix_code || '',
      qrCodeUrl: pix.qr_code_url || pix.image_url || null,
      expiresAt: pix.expires_at || pix.expiration || null,
    });
  } catch (e) {
    console.error('[deposit]', e.message);
    res.status(502).json({ error: 'Erro ao gerar PIX. Tente novamente.' });
  }
});

// ── POST /api/payment/withdraw ────────────────────────────────────────────────
router.post('/payment/withdraw', paymentRateLimiter, verifyFirebaseToken, async (req, res) => {
  try {
    const amount  = Number(req.body?.amount);
    const pixKey  = String(req.body?.pixKey || '').trim();
    const pixKeyType = String(req.body?.pixKeyType || 'cpf').toLowerCase();

    if (!amount || amount < 10) {
      return res.status(400).json({ error: 'Valor mínimo de saque é R$10.' });
    }
    if (!pixKey) {
      return res.status(400).json({ error: 'Chave PIX obrigatória.' });
    }

    // Server-side balance check via Admin SDK (never trust client)
    const userRef = adminDb.collection('users').doc(req.uid);
    let balance;
    await adminDb.runTransaction(async t => {
      const snap = await t.get(userRef);
      if (!snap.exists) throw new Error('Usuário não encontrado');
      balance = snap.data().balance || 0;
      if (balance < amount) throw new Error('INSUFFICIENT_BALANCE');

      // Atomic debit
      t.update(userRef, {
        balance: FieldValue.increment(-amount),
        totalWithdrawn: FieldValue.increment(amount),
      });
    });

    // Create transaction doc
    const txRef = await adminDb.collection('transactions').add({
      uid: req.uid,
      type: 'withdrawal',
      amount,
      pixKey,
      pixKeyType,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });

    let cashout;
    try {
      cashout = await createCashout({ amount, pixKey, pixKeyType, externalId: txRef.id });
    } catch (e) {
      // If CartWave fails, refund balance
      await userRef.update({
        balance: FieldValue.increment(amount),
        totalWithdrawn: FieldValue.increment(-amount),
      });
      await txRef.update({ status: 'failed', error: e.message });
      console.error('[withdraw cashout]', e.message);
      return res.status(502).json({ error: 'Erro ao processar saque. Saldo estornado.' });
    }

    await txRef.update({
      cartwaveTxId: cashout.id || cashout.transaction_id || '',
      status: cashout.status || 'processing',
    });

    res.json({ success: true, txId: txRef.id });
  } catch (e) {
    if (e.message === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ error: 'Saldo insuficiente.' });
    }
    console.error('[withdraw]', e.message);
    res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  }
});

// ── POST /api/webhooks/cartwave ───────────────────────────────────────────────
router.post('/webhooks/cartwave', async (req, res) => {
  // Signature verification using raw body
  const signature = req.headers['x-signature'] || '';
  const rawBody = req.rawBody;

  if (!rawBody || !verifyWebhookSignature(rawBody, signature)) {
    console.warn('[webhook] invalid signature');
    return res.status(401).json({ error: 'Assinatura inválida' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Body inválido' });
  }

  const cartwaveTxId = event.id || event.transaction_id;
  const eventType = event.event || event.type || '';
  const amount = Number(event.amount || 0);

  try {
    // Idempotency: find transaction by cartwaveTxId
    const q = await adminDb.collection('transactions')
      .where('cartwaveTxId', '==', cartwaveTxId)
      .limit(1)
      .get();

    if (q.empty) {
      console.warn('[webhook] unknown cartwaveTxId:', cartwaveTxId);
      return res.status(200).json({ ok: true }); // Don't error — CartWave may retry
    }

    const txDoc = q.docs[0];
    const tx = txDoc.data();

    // Idempotency guard
    if (tx.status === 'completed') {
      return res.status(200).json({ ok: true, skipped: true });
    }

    const userRef = adminDb.collection('users').doc(tx.uid);

    if (eventType === 'pix.received' || eventType === 'payment.received') {
      await adminDb.runTransaction(async t => {
        t.update(userRef, {
          balance: FieldValue.increment(amount),
          totalDeposited: FieldValue.increment(amount),
        });
        t.update(txDoc.ref, { status: 'completed', completedAt: FieldValue.serverTimestamp() });
      });
      console.log(`[webhook] pix.received uid=${tx.uid} amount=${amount}`);

    } else if (eventType === 'cashout.completed' || eventType === 'withdrawal.completed') {
      await txDoc.ref.update({ status: 'completed', completedAt: FieldValue.serverTimestamp() });
      console.log(`[webhook] cashout.completed uid=${tx.uid} amount=${amount}`);

    } else if (eventType === 'cashout.failed' || eventType === 'withdrawal.failed') {
      // Estorno: refund balance
      await adminDb.runTransaction(async t => {
        t.update(userRef, {
          balance: FieldValue.increment(amount),
          totalWithdrawn: FieldValue.increment(-amount),
        });
        t.update(txDoc.ref, { status: 'failed', failedAt: FieldValue.serverTimestamp() });
      });
      console.log(`[webhook] cashout.failed — refund uid=${tx.uid} amount=${amount}`);
    } else {
      console.log(`[webhook] unhandled event: ${eventType}`);
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[webhook] processing error', e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
