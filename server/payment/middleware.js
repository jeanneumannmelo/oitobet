import { adminAuth } from '../firebase-admin.js';
import rateLimit from 'express-rate-limit';

export async function verifyFirebaseToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TOKEN_TIMEOUT')), 8000)
    );
    const decoded = await Promise.race([adminAuth.verifyIdToken(token), timeout]);
    req.uid = decoded.uid;
    next();
  } catch (e) {
    console.error('[verifyFirebaseToken]', e.code || e.message);
    const status = e.message === 'TOKEN_TIMEOUT' ? 504 : 401;
    res.status(status).json({ error: 'Token inválido ou expirado' });
  }
}

export const paymentRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em 1 hora.' },
  keyGenerator: (req) => req.uid || req.ip,
});
