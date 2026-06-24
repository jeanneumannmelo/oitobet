import { S } from './state.js';
import { resize } from './engine/layout.js';
import { initBalls } from './engine/balls.js';
import { step } from './engine/physics.js';
import { processTurn, restartGame } from './engine/logic.js';
import { botTick, botThinkDelay } from './engine/bot.js';
import { ballMoving } from './utils.js';
import { drawBg } from './render/screen.js';
import { drawTable } from './render/table.js';
import { drawBall } from './render/balls.js';
import { drawCue } from './render/cue.js';
import { drawHUD, initLogoImg } from './render/hud.js';
import { drawPowerBar, drawVitoria } from './render/screen.js';
import { drawNetAnims, drawCelebration, drawPocketedSidebars, drawTurnPopup } from './render/effects.js';
import { initInput } from './input/input.js';
import { initFeltPat } from './render/table.js';
import { initBgPat } from './render/screen.js';
import { auth, onAuth, getProfile, debitBalance, finalizeBotMatch, redirectResultPromise } from './firebase.js';
import { showAuth, hideAuth, awaitUserDocReady, resolveDocReady } from './ui/Auth.js';
import { showCompleteProfile, hideCompleteProfile } from './ui/CompleteProfile.js';
import { showHome, hideHome, refreshHome } from './ui/Home.js';
import { showPreGame } from './ui/PreGame.js';
import { setOnMatchStart } from './net/socket.js';
import { showLanding, hideLanding, showGuestBanner, hideGuestBanner } from './ui/Landing.js';

// ── Bootstrap ─────────────────────────────────────────────────────────────────
// Capture referral code from URL and persist for post-login registration
(function captureRef() {
  const ref = new URLSearchParams(window.location.search).get('ref');
  if (ref) localStorage.setItem('oitobet_ref', ref);
})();

if (screen.orientation?.lock) screen.orientation.lock('landscape').catch(() => {});
window.addEventListener('resize', resize);
resize();
initBalls();
initBgPat();
initFeltPat();
initLogoImg();
initInput();

// ── Flow ──────────────────────────────────────────────────────────────────────
let gameStarted = false;

function startGameWithBot(bot, betAmount = 0) {
  // Full game state reset — prevents previous vitoria state triggering instant win
  restartGame();
  S.botDifficulty = bot.difficulty || 1;
  S.betAmount = betAmount;
  S.mode = 'offline';
  S.BOT = 1;
  S.players[1] = {
    name: bot.nickname || bot.name || 'Bot',
    coins: (bot.wins || 0) * 100,
    level: Math.min(10, Math.ceil((bot.wins || 0) / 20)) || 1,
    xp: (bot.wins || 0) % 20 * 5,
    wins: bot.wins || 0,
    flag: '🇧🇷',
    photoURL: null,
  };
  if (!gameStarted) {
    gameStarted = true;
    loop();
  }
}

async function handleGameEnd(winnerIdx) {
  if (S.gameEndHandled) return;
  S.gameEndHandled = true;

  const user = auth.currentUser;
  if (!user) return;

  const isHumanWin = S.mode === 'online'
    ? (winnerIdx === S.myIdx)
    : (winnerIdx === 0);

  try {
    await finalizeBotMatch({ playerWon: isHumanWin, betAmount: S.betAmount });
    // Force fresh read from server — Admin SDK writes bypass local Firestore cache
    refreshHome({ fresh: true });
  } catch(e) {
    console.error('[handleGameEnd]', e);
  }
}

// ── Online match-start hook (called by socket.js) ─────────────────────────────
setOnMatchStart(async ({ betAmount }) => {
  const user = auth.currentUser;
  // Deduct bet for the online match (second player also deducted on join)
  if (betAmount > 0 && user) {
    try { await debitBalance(user.uid, betAmount); } catch(e) {}
  }
  hideHome();
  S.gameEndHandled = false;
  if (!gameStarted) { gameStarted = true; loop(); }
});

async function registerReferral(user) {
  const refCode = localStorage.getItem('oitobet_ref');
  if (!refCode || refCode === user.uid) return;
  try {
    const token = await user.getIdToken();
    const r = await fetch('/api/referral/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ refCode }),
    });
    if (r.ok) localStorage.removeItem('oitobet_ref');
  } catch {}
}

function hideSplash() {
  if (typeof window.hideSplash === 'function') window.hideSplash();
}

async function handleLoggedIn(user) {
  hideSplash();
  hideAuth();
  registerReferral(user);

  // For returning users (Firebase restores session without going through
  // login/register), the doc-ready promise is never resolved by Auth.js.
  // Resolve it now — the doc already exists for returning users.
  resolveDocReady();
  await awaitUserDocReady();

  let profile = null;
  try { profile = await getProfile(user.uid, { fresh: true }); } catch(e) {}

  S.players[0] = {
    name: user.displayName || user.email || 'Jogador',
    coins: profile?.balance || 0,
    level: profile?.level || 1,
    xp: profile?.xp || 0,
    wins: profile?.wins || 0,
    flag: '🇧🇷',
    photoURL: user.photoURL || null,
  };
  S.chips = profile?.chips || 0;
  S.equippedCue = profile?.equippedCue || 'basic';
  S.ownedCues = profile?.ownedCues || ['basic'];

  const hasCPF   = !!(profile?.cpf);
  const hasPhone = !!(profile?.phone);
  const profileComplete = profile?.profileComplete || (hasCPF && hasPhone);

  if (!profileComplete) {
    showCompleteProfile(hasCPF, () => { showHomeThenPlay(); });
  } else {
    showHomeThenPlay();
  }
}

// ── Guest / demo play (no account) ─────────────────────────────────────────
function guestPlay() {
  S._isGuest = true;
  S.players[0] = {
    name: 'Convidado',
    coins: 0, level: 1, xp: 0, wins: 0,
    flag: '🇧🇷', photoURL: null,
  };
  S.chips = 0;
  S.equippedCue = 'basic';
  S.ownedCues = ['basic'];

  const bot = { nickname: 'Bot Iniciante', difficulty: 2, wins: 18 };
  const p1  = { name: 'Convidado', photoURL: null };
  const p2  = { name: 'Bot Iniciante', photoURL: null };

  if (!gameStarted) { gameStarted = true; loop(); }

  showPreGame({ player1: p1, player2: p2, bet: 0, searching: false, onDone: () => {
    S.gameEndHandled = false;
    startGameWithBot(bot, 0);
    showGuestBanner(() => {
      S._isGuest = false;
      hideGuestBanner();
      showAuth();
    });
  }});
}

function showHomeThenPlay() {
  showHome(async ({ bot, free, bet, mode }) => {
    if (mode === 'online') {
      // Online game: matchStart handler above already deducted balance and hid Home
      // Nothing extra needed here
      return;
    }

    // Bot game
    const betAmount = free ? 0 : (bet || 0);
    const user = auth.currentUser;
    const p1 = { name: user?.displayName || 'Você', photoURL: user?.photoURL || null };
    const p2 = { name: bot.nickname || bot.name || 'Bot', photoURL: null };

    // Start debit in parallel with PreGame animation to avoid black screen
    let debitPromise = Promise.resolve();
    if (betAmount > 0 && user) {
      debitPromise = getProfile(user.uid)
        .catch(() => null)
        .then(profile => {
          if ((profile?.balance || 0) < betAmount) throw new Error('saldo_insuficiente');
          return debitBalance(user.uid, betAmount);
        })
        .then(() => refreshHome({ fresh: true }));
    }

    // Start loop early so canvas renders behind PreGame overlay (no black flash on fade-out)
    if (!gameStarted) { gameStarted = true; loop(); }

    showPreGame({ player1: p1, player2: p2, bet: betAmount, searching: true, onDone: async () => {
      try {
        await debitPromise;
      } catch (e) {
        console.error('[debitPromise]', e.message);
        return;
      }
      S.gameEndHandled = false;
      startGameWithBot(bot, betAmount);
    } });
  });
}

// Safety timeout so redirectResultPromise never blocks showAuth forever on mobile.
const _redirectTimeout = new Promise(resolve => setTimeout(resolve, 4000, null));

// ── Top-level safety net ──────────────────────────────────────────────────────
// If Firebase Auth never fires onAuthStateChanged (stuck redirect, network issue,
// broken storage), show the landing/login after 6 seconds regardless.
let _authResolved = false;
function _showFallback() {
  hideSplash();
  const noUI = !document.getElementById('auth-overlay')
    && !document.getElementById('home-overlay')
    && !document.getElementById('landing-overlay');
  if (noUI) {
    try {
      showLanding({
        onPlay: guestPlay,
        onLogin: () => showAuth(),
        onRegister: () => showAuth(),
      });
    } catch (_) {}
  }
}
setTimeout(() => { if (!_authResolved) _showFallback(); }, 6000);
window.addEventListener('error', () => _showFallback());

onAuth(async user => {
  _authResolved = true;
  if (user) {
    hideLanding();
    handleLoggedIn(user);
  } else {
    // Wait for Google redirect to complete (or 4 s timeout, whichever first).
    // If redirect succeeded, onAuthStateChanged fires again with the user.
    await Promise.race([redirectResultPromise, _redirectTimeout]);
    if (auth.currentUser) return;
    hideHome();
    hideCompleteProfile();
    hideSplash();
    if (!gameStarted) {
      showLanding({
        onPlay: guestPlay,
        onLogin: () => showAuth('login'),
        onRegister: () => showAuth('register'),
      });
    } else {
      location.reload();
    }
  }
});

// ── Game loop ─────────────────────────────────────────────────────────────────
function loop() {
  requestAnimationFrame(loop);
  S.tick++;

  if (S.mode === 'offline') {
    for (let s = 0; s < 4; s++) step();
  }

  if (S.estado === 'rolando' && !ballMoving()) {
    processTurn();
    if (S.turn === S.BOT && S.mode === 'offline') {
      S.botDelay = botThinkDelay(); S.botFakeTarget = 0; S.botAimPhase = 0;
    }
  }

  if (S.turn !== S.BOT && (S.estado === 'mira' || S.estado === 'ballInHand')) {
    S.timerFrames = Math.max(0, S.timerFrames - 1);
    if (S.timerFrames <= 0) {
      S.timerFrames = S.TIMER_MAX; S.msgTxt = 'Tempo esgotado!'; S.msgFlash = 120;
      S.faltou = false; S.turn = 1 - S.turn; S.estado = 'mira';
      if (S.turn === S.BOT && S.mode === 'offline') {
        S.botDelay = botThinkDelay(); S.botFakeTarget = 0; S.botAimPhase = 0;
      }
    }
  } else if (S.turn === S.BOT) {
    S.timerFrames = S.TIMER_MAX;
  }

  if (S.msgFlash > 0) S.msgFlash--;

  if (S.mode === 'offline' && S.turn === S.BOT && S.estado !== 'rolando' && S.estado !== 'vitoria') {
    botTick();
  }

  const isMyTurn = S.mode === 'online' ? S.turn === S.myIdx : S.turn !== S.BOT;
  if (isMyTurn && S.estado === 'mira' && !S.isDragging) {
    S.aimAng += Math.sin(S.tick * 0.004) * 0.0025;
  }

  // Detect game end and finalize balance
  if (S.estado === 'vitoria' && !S.gameEndHandled) {
    handleGameEnd(S.vencedor);
  }

  // Rematch countdown tick
  if (S.rematchState === 'waiting') {
    S.rematchCountdown = Math.max(0, S.rematchCountdown - 1);
    const timeUp = S.rematchCountdown <= 0;
    const decidedNow = S.tick >= S.rematchDecideAt;
    if (timeUp || decidedNow) {
      // 65% chance bot accepts, 35% rejects
      S.rematchState = Math.random() < 0.65 ? 'accepted' : 'rejected';
    }
  }
  if (S.rematchState === 'accepted') {
    S.rematchState = null;
    restartGame();
  }

  // Return to home screen (Voltar ao Menu clicked)
  if (S._goHome) {
    S._goHome = false;
    S.rematchState = null;
    if (S._isGuest) {
      hideGuestBanner();
      S._isGuest = false;
      showLanding({
        onPlay: guestPlay,
        onLogin: () => showAuth('login'),
        onRegister: () => showAuth('register'),
      });
    } else {
      showHomeThenPlay();
    }
  }

  // Detect turn change → trigger "Sua Vez" popup for human player
  if (S.turn !== S._prevTurn) {
    S._prevTurn = S.turn;
    const isHumanTurn = S.mode === 'online' ? S.turn === S.myIdx : S.turn !== S.BOT;
    if (isHumanTurn && (S.estado === 'mira' || S.estado === 'ballInHand') && S.estado !== 'vitoria') {
      S.turnPopup = 120;
    }
  }

  try {
    drawBg();
    drawPocketedSidebars();
    drawTable();
    drawCue();
    S.balls.forEach(b => drawBall(b));
    drawNetAnims();
    drawHUD();
    drawPowerBar();
    drawTurnPopup();
    drawCelebration();
    if (S.estado === 'vitoria') drawVitoria();
  } catch(e) {
    console.error('[loop render]', e);
  }
}
