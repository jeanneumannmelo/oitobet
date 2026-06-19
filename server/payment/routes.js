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
    // Response fields per CartWave docs: id, pix_copy_and_paste, image_base64, image_url, status
    await txRef.update({
      cartwaveTxId: String(pix.id || ''),
      pixCode: pix.pix_copy_and_paste || pix.copy_and_paste || '',
      expiresAt: pix.expiration_date || null,
    });

    res.json({
      txId: txRef.id,
      pixCode: pix.pix_copy_and_paste || pix.copy_and_paste || '',
      qrCodeUrl: pix.image_url || null,
      expiresAt: pix.expiration_date || null,
    });
  } catch (e) {
    console.error('[deposit]', e.message);
    res.status(502).json({ error: 'Erro ao gerar PIX. Tente novamente.' });
  }
});

const WITHDRAW_FEE = 2; // R$2,00 taxa fixa de saque

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

    const totalDebit = amount + WITHDRAW_FEE; // amount the user receives + fee

    // Server-side balance check via Admin SDK (never trust client)
    const userRef = adminDb.collection('users').doc(req.uid);
    await adminDb.runTransaction(async t => {
      const snap = await t.get(userRef);
      if (!snap.exists) throw new Error('Usuário não encontrado');
      const balance = snap.data().balance || 0;
      if (balance < totalDebit) throw new Error('INSUFFICIENT_BALANCE');

      // Atomic debit: amount received by user + R$2 fee
      t.update(userRef, {
        balance: FieldValue.increment(-totalDebit),
        totalWithdrawn: FieldValue.increment(amount),
      });
    });

    // Create transaction doc
    const txRef = await adminDb.collection('transactions').add({
      uid: req.uid,
      type: 'withdrawal',
      amount,       // net amount sent to user
      fee: WITHDRAW_FEE,
      totalDebit,   // amount deducted from balance
      pixKey,
      pixKeyType,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });

    let cashout;
    try {
      cashout = await createCashout({ amount, pixKey, externalId: txRef.id });
    } catch (e) {
      // If CartWave fails, refund full debit (amount + fee)
      await userRef.update({
        balance: FieldValue.increment(totalDebit),
        totalWithdrawn: FieldValue.increment(-amount),
      });
      await txRef.update({ status: 'failed', error: e.message });
      console.error('[withdraw cashout]', e.message);
      return res.status(502).json({ error: 'Erro ao processar saque. Saldo estornado.' });
    }

    await txRef.update({
      cartwaveTxId: String(cashout.id || cashout.uuid || ''),
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

  // CartWave event names per docs:
  // deposit confirmed: QR_CODE_COPY_AND_PASTE_PAID or PIX_CASHIN_RECEIVED
  // cashout success:  PIX_CASHOUT_SUCCESS
  // cashout failed:   PIX_CASHOUT_ERROR
  const eventType = event.type || event.event || '';
  const tag = event.tag || event.data?.tag || '';           // our Firestore txId
  const amount = Number(event.amount || event.data?.amount || 0);

  console.log(`[webhook] event=${eventType} tag=${tag} amount=${amount}`);

  try {
    // Locate our transaction by tag (externalId we sent during creation)
    let txDoc = null;
    if (tag) {
      const snap = await adminDb.collection('transactions').doc(tag).get();
      if (snap.exists) txDoc = snap;
    }

    // Fallback: search by cartwaveTxId if tag not present
    if (!txDoc) {
      const cartwaveTxId = String(event.id || event.transaction_id || '');
      if (cartwaveTxId) {
        const q = await adminDb.collection('transactions')
          .where('cartwaveTxId', '==', cartwaveTxId)
          .limit(1)
          .get();
        if (!q.empty) txDoc = q.docs[0];
      }
    }

    if (!txDoc) {
      console.warn('[webhook] transaction not found for event:', eventType, tag);
      return res.status(200).json({ ok: true }); // Return 200 so CartWave doesn't retry forever
    }

    const tx = txDoc.data();

    // Idempotency guard
    if (tx.status === 'completed') {
      return res.status(200).json({ ok: true, skipped: true });
    }

    const userRef = adminDb.collection('users').doc(tx.uid);

    if (eventType === 'QR_CODE_COPY_AND_PASTE_PAID' || eventType === 'PIX_CASHIN_RECEIVED') {
      await adminDb.runTransaction(async t => {
        t.update(userRef, {
          balance: FieldValue.increment(amount),
          totalDeposited: FieldValue.increment(amount),
        });
        t.update(txDoc.ref, { status: 'completed', completedAt: FieldValue.serverTimestamp() });
      });
      console.log(`[webhook] deposit confirmed uid=${tx.uid} amount=${amount}`);

    } else if (eventType === 'PIX_CASHOUT_SUCCESS') {
      await txDoc.ref.update({ status: 'completed', completedAt: FieldValue.serverTimestamp() });
      console.log(`[webhook] cashout success uid=${tx.uid} amount=${amount}`);

    } else if (eventType === 'PIX_CASHOUT_ERROR' || eventType === 'PIX_CASHOUT_CANCELED') {
      // Estorno: refund amount + fee (totalDebit)
      const totalDebit = tx.totalDebit || (tx.amount + (tx.fee || 0));
      await adminDb.runTransaction(async t => {
        t.update(userRef, {
          balance: FieldValue.increment(totalDebit),
          totalWithdrawn: FieldValue.increment(-tx.amount),
        });
        t.update(txDoc.ref, { status: 'failed', failedAt: FieldValue.serverTimestamp() });
      });
      console.log(`[webhook] cashout failed — refund uid=${tx.uid} amount=${totalDebit}`);
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
