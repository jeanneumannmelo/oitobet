import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  let credentialConfig = {};
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credentialConfig = { credential: cert(serviceAccount) };
    } catch (e) {
      console.warn('[Firebase Admin] Aviso: FIREBASE_SERVICE_ACCOUNT JSON inválido.');
    }
  }
  initializeApp(credentialConfig);
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();
