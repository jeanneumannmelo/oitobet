import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { getFirestore, doc, getDoc, getDocFromServer, setDoc, updateDoc, increment, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, onSnapshot } from 'firebase/firestore';
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
export const auth = getAuth(app);
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
      chips: 200, ownedCues: ['basic'], equippedCue: 'basic',
    });
  } else {
    if (!snap.data().chips) await updateDoc(ref, { chips: 200 });
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
      chips: 200, ownedCues: ['basic'], equippedCue: 'basic',
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

export async function getProfile(uid, { fresh = false } = {}) {
  const ref = doc(db, 'users', uid);
  const snap = await (fresh ? getDocFromServer(ref) : getDoc(ref));
  return snap.exists() ? snap.data() : null;
}

export function updateProfile(uid, data) {
  return updateDoc(doc(db, 'users', uid), data);
}

// ── Balance / wallet (server-side via Admin SDK) ──────────────────────────────

async function _gameApiCall(path, body) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Não autenticado');
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro');
  return data;
}

// Deducts bet before a game — server validates balance atomically
export function debitBalance(_uid, betAmount) {
  return _gameApiCall('/api/game/debit-bet', { betAmount });
}

// Finalizes a bot/solo match — server credits prize, updates stats
export function finalizeBotMatch({ playerWon, betAmount }) {
  return _gameApiCall('/api/game/finalize', { playerWon, betAmount });
}

// Legacy: kept for compatibility but no longer used for real writes
export function creditBalance(uid, amount) {
  return updateDoc(doc(db, 'users', uid), { balance: increment(amount) });
}

// Withdrawal request (reviewed manually or via webhook)
export function requestWithdrawal(uid, amount, pixKey) {
  return addDoc(collection(db, 'withdrawals'), {
    uid,
    amount,
    pixKey,
    status: 'pending',
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


// Subscribe to a transaction doc — calls callback(data) on every change.
// Returns unsubscribe function.
export function subscribeTransaction(txId, callback) {
  const ref = doc(db, 'transactions', txId);
  return onSnapshot(
    ref,
    snap => { if (snap.exists()) callback(snap.data()); },
    err => { console.error('[subscribeTransaction] listener error:', err.code, err.message); },
  );
}

export async function getTransactionOnce(txId) {
  const snap = await getDoc(doc(db, 'transactions', txId));
  return snap.exists() ? snap.data() : null;
}

export async function purchaseCue(uid, cueId, cost) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Usuário não encontrado');
  const data = snap.data();
  if ((data.chips || 0) < cost) throw new Error('Fichas insuficientes');
  const owned = data.ownedCues || ['basic'];
  if (owned.includes(cueId)) throw new Error('Já possui este taco');
  await updateDoc(ref, {
    chips: increment(-cost),
    ownedCues: [...owned, cueId],
  });
}

export async function equipCue(uid, cueId) {
  await updateDoc(doc(db, 'users', uid), { equippedCue: cueId });
}

export async function addChips(uid, amount) {
  await updateDoc(doc(db, 'users', uid), { chips: increment(amount) });
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
