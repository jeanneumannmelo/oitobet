import { initializeApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, browserPopupRedirectResolver, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
const firebaseConfig = {
  apiKey: "AIzaSyAjiGVb3y4DXXM8gxElAf_SV1prykh3cD0",
  authDomain: "oitobet-brasil.firebaseapp.com",
  projectId: "oitobet-brasil",
  storageBucket: "oitobet-brasil.firebasestorage.app",
  messagingSenderId: "758991093577",
  appId: "1:758991093577:web:222189724906409e0ee498",
  measurementId: "G-Q0V243Q0Z9",
};

const app = initializeApp(firebaseConfig);
// browserLocalPersistence usa localStorage em vez de IndexedDB
// Necessário para Safari iOS (ITP bloqueia storage cross-origin com IndexedDB)
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});
export const db = getFirestore(app);

// Analytics only in production — loaded lazily to avoid module-level errors
export let analytics = null;
if (typeof window !== 'undefined') {
  import('firebase/analytics').then(({ getAnalytics, isSupported }) =>
    isSupported().then(ok => { if (ok) analytics = getAnalytics(app); })
  ).catch(() => {});
}

// ── Ensure Firestore user doc exists ─────────────────────────────────────────
export async function ensureUserDoc(user, extra = {}) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      displayName: user.displayName || extra.displayName || 'Jogador',
      email: user.email,
      cpf: extra.cpf || '',
      balance: 0, wins: 0, losses: 0,
      level: 1, xp: 0, createdAt: serverTimestamp(),
    });
  }
}

// ── Redirect result (Google login via redirect) ───────────────────────────────
// Called once at module load — must run before onAuthStateChanged fires.
let _redirectError = null;
export const getStoredRedirectError = () => _redirectError;

export const redirectResultPromise = getRedirectResult(auth)
  .then(async result => {
    if (result?.user) await ensureUserDoc(result.user);
    return result?.user || null;
  })
  .catch(e => {
    if (e.code !== 'auth/no-redirect-operation-pending') {
      _redirectError = e;
      console.error('[redirectResult]', e.code, e.message);
    }
    return null;
  });

// ── Auth helpers ─────────────────────────────────────────────────────────────

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function register(email, password, displayName) {
  return createUserWithEmailAndPassword(auth, email, password).then(async cred => {
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      displayName,
      email,
      balance: 0,        // saldo em fichas
      wins: 0,
      losses: 0,
      level: 1,
      xp: 0,
      createdAt: serverTimestamp(),
    });
    return cred;
  });
}

export function logout() {
  return signOut(auth);
}

export function onAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

// ── User profile ─────────────────────────────────────────────────────────────

export async function getProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

export function updateProfile(uid, data) {
  return updateDoc(doc(db, 'users', uid), data);
}

// ── Balance / wallet ─────────────────────────────────────────────────────────

export function creditBalance(uid, amount) {
  return updateDoc(doc(db, 'users', uid), { balance: increment(amount) });
}

export function debitBalance(uid, amount) {
  return updateDoc(doc(db, 'users', uid), { balance: increment(-amount) });
}

// Withdrawal request (reviewed manually or via webhook)
export function requestWithdrawal(uid, amount, pixKey) {
  return addDoc(collection(db, 'withdrawals'), {
    uid,
    amount,
    pixKey,
    status: 'pending',   // pending | approved | rejected
    createdAt: serverTimestamp(),
  });
}

// ── Match history ────────────────────────────────────────────────────────────

export function recordMatch({ player1Uid, player2Uid, winnerUid, duration, betAmount }) {
  return addDoc(collection(db, 'matches'), {
    player1Uid,
    player2Uid,
    winnerUid,
    duration,
    betAmount,
    createdAt: serverTimestamp(),
  });
}

// After a match, update wins/losses and XP for both players
export async function finalizeMatch({ player1Uid, player2Uid, winnerUid, xpGain }) {
  const loserUid = winnerUid === player1Uid ? player2Uid : player1Uid;
  await Promise.all([
    updateDoc(doc(db, 'users', winnerUid), { wins: increment(1), xp: increment(xpGain || 50) }),
    updateDoc(doc(db, 'users', loserUid),  { losses: increment(1), xp: increment(10) }),
  ]);
}

// Finalize a bot or online match: update balance + daily ranking stats
export async function finalizeBotMatch({ uid, playerWon, betAmount }) {
  if (!uid) return;
  const today = new Date().toISOString().split('T')[0];
  const ref = doc(db, 'users', uid);
  try {
    const snap = await getDoc(ref);
    const data = snap.data() || {};
    const isSameDay = data.dailyDate === today;
    const updates = {};

    if (playerWon) {
      updates.wins = increment(1);
      updates.xp = increment(50);
      if (betAmount > 0) {
        // Stake was already deducted on game start; credit prize (2× stake)
        updates.balance = increment(betAmount * 2);
        updates.totalEarned = increment(betAmount * 2);
      }
      if (isSameDay) {
        updates.dailyWins = increment(1);
        if (betAmount > 0) updates.dailyEarnings = increment(betAmount);
      } else {
        updates.dailyDate = today;
        updates.dailyWins = 1;
        updates.dailyEarnings = betAmount > 0 ? betAmount : 0;
      }
    } else {
      updates.losses = increment(1);
      updates.xp = increment(10);
      if (!isSameDay) {
        updates.dailyDate = today;
        updates.dailyWins = 0;
        updates.dailyEarnings = 0;
      }
    }
    await updateDoc(ref, updates);
  } catch(e) {
    console.error('[finalizeBotMatch]', e);
  }
}

// Top-10 daily earners for ranking (reads users ordered by dailyEarnings)
export async function getDailyRanking(maxCount = 10) {
  const today = new Date().toISOString().split('T')[0];
  try {
    const q = query(collection(db, 'users'), orderBy('dailyEarnings', 'desc'), limit(maxCount));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => u.dailyDate === today && (u.dailyEarnings || 0) > 0);
  } catch(_e) {
    return [];
  }
}
