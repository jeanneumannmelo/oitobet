import { S } from './state.js';
import { resize } from './engine/layout.js';
import { initBalls } from './engine/balls.js';
import { step } from './engine/physics.js';
import { processTurn } from './engine/logic.js';
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
import { showAuth, hideAuth } from './ui/Auth.js';
import { showCompleteProfile, hideCompleteProfile } from './ui/CompleteProfile.js';
import { showHome, hideHome, refreshHome } from './ui/Home.js';
import { showPreGame } from './ui/PreGame.js';
import { setOnMatchStart } from './net/socket.js';

// ── Bootstrap ─────────────────────────────────────────────────────────────────
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
  S.botDifficulty = bot.difficulty || 1;
  S.betAmount = betAmount;
  S.mode = 'offline';
  S.BOT = 1;
  S.gameEndHandled = false;
  const _botId = bot.id || '';
  const _botN = Math.abs(String(_botId).split('').reduce((a,c) => a + c.charCodeAt(0), 0));
  S.players[1] = {
    name: bot.nickname || bot.name || 'Bot',
    coins: (bot.wins || 0) * 100,
    level: Math.min(10, Math.ceil((bot.wins || 0) / 20)) || 1,
    xp: (bot.wins || 0) % 20 * 5,
    wins: bot.wins || 0,
    flag: '🇧🇷',
    photoURL: 'https://randomuser.me/api/portraits/men/' + ((_botN % 99) + 1) + '.jpg',
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
    refreshHome();
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

async function handleLoggedIn(user) {
  hideAuth();

  let profile = null;
  try { profile = await getProfile(user.uid); } catch(e) {}

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

function showHomeThenPlay() {
  showHome(async ({ bot, free, bet, mode }) => {
    if (mode === 'online') {
      // Online game: matchStart handler above already deducted balance and hid Home
      // Nothing extra needed here
      return;
    }

    // Bot game
    const betAmount = free ? 0 : (bet || 0);

    if (betAmount > 0) {
      const user = auth.currentUser;
      if (user) {
        const profile = await getProfile(user.uid).catch(() => null);
        const balance = profile?.balance || 0;
        if (balance < betAmount) {
          // Home.js already validated; this is a safety net
          return;
        }
        await debitBalance(user.uid, betAmount);
        refreshHome();
      }
    }

    const user = auth.currentUser;
    const p1 = { name: user?.displayName || 'Você', photoURL: user?.photoURL || null };
    const p2 = { name: bot.nickname || bot.name || 'Bot', photoURL: null };
    showPreGame({ player1: p1, player2: p2, bet: betAmount, searching: true, onDone: () => {
      S.gameEndHandled = false;
      startGameWithBot(bot, betAmount);
    } });
  });
}

onAuth(async user => {
  if (user) {
    handleLoggedIn(user);
  } else {
    // Wait for any pending Google redirect to finish before showing the login UI.
    // If the redirect succeeded, onAuthStateChanged will fire again with the user.
    await redirectResultPromise;
    if (auth.currentUser) return;
    hideHome();
    hideCompleteProfile();
    if (!gameStarted) showAuth();
    else location.reload();
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
