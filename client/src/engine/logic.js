import { S } from '../state.js';
import { initBalls } from './balls.js';
import { sndAssign, sndCelebration, sndFoul, sndWin } from '../audio/sounds.js';
import { spawnCelebration } from '../render/effects.js';

export function processTurn() {
  const cb = S.balls[0];
  if (cb.out) S.faltou = true;

  if (!S.quebra && !S.faltou) {
    if (S.primeiroHit === null) {
      S.faltou = true; S.msgTxt = 'Falta: nenhuma bola tocada!';
    } else if (S.tipos[S.turn] !== null) {
      const ht = S.primeiroHit <= 7 ? 'solid' : 'stripe';
      if (ht !== S.tipos[S.turn]) { S.faltou = true; S.msgTxt = 'Falta: bola adversária primeiro!'; }
    }
  }

  const pot8 = S.potTurno.includes(8);
  if (pot8) {
    const myList = S.tipos[S.turn] === 'solid' ? [1,2,3,4,5,6,7] : [9,10,11,12,13,14,15];
    const allDone = myList.every(id => S.potJogador[S.turn].includes(id));
    S.vencedor = (!allDone || S.faltou) ? 1 - S.turn : S.turn;
    S.estado = 'vitoria';
    S.msgTxt = S.players[S.vencedor].name + ' venceu!'; S.msgFlash = 300;
    sndWin();
    return;
  }

  if (S.tipos[S.turn] === null && !S.quebra) {
    const firstNon8 = S.potTurno.find(id => id !== 8);
    if (firstNon8 != null && !S.faltou) {
      const myType = firstNon8 <= 7 ? 'solid' : 'stripe';
      S.tipos[S.turn] = myType; S.tipos[1 - S.turn] = myType === 'solid' ? 'stripe' : 'solid';
      S.msgTxt = (myType === 'solid' ? 'Sólidas' : 'Listradas') + ' para ' + (S.turn === 0 ? 'J1' : 'J2') + '!';
      S.msgFlash = 120;
      sndAssign();
    }
  }

  let potouMinha = false;
  S.potTurno.forEach(id => {
    if (id === 8) return;
    const t = id <= 7 ? 'solid' : 'stripe';
    if (S.tipos[S.turn] === null || t === S.tipos[S.turn]) {
      if (!S.potJogador[S.turn].includes(id)) S.potJogador[S.turn].push(id);
      potouMinha = true;
    } else {
      if (!S.potJogador[1 - S.turn].includes(id)) S.potJogador[1 - S.turn].push(id);
    }
  });

  if (S.turn !== S.BOT && potouMinha && !S.faltou && S.celebFrames <= 0) {
    spawnCelebration(S.PX + S.PW / 2, S.PY + S.PH / 2);
    sndCelebration();
  }

  if (S.quebra) S.quebra = false;
  const continua = !S.faltou && potouMinha;

  if (S.faltou) {
    sndFoul();
    if (!S.msgFlash) S.msgTxt = 'Falta! Bola na mão';
    S.msgFlash = Math.max(S.msgFlash, 120);
  } else if (S.potTurno.length > 0 && !S.faltou) {
    if (!S.msgFlash) { S.msgTxt = S.potTurno.length === 1 ? 'Bola dentro!' : S.potTurno.length + ' bolas!'; S.msgFlash = 90; }
  } else {
    S.msgTxt = '';
  }

  if (!continua) S.turn = 1 - S.turn;
  S.primeiroHit = null; S.potTurno = []; S.timerFrames = S.TIMER_MAX;

  if (S.faltou) {
    S.faltou = false;
    cb.out = false; cb.vx = 0; cb.vy = 0;
    cb.x = S.PX + S.PW * 0.26; cb.y = S.PY + S.PH / 2;
    S.estado = 'ballInHand';
  } else {
    S.faltou = false; S.estado = 'mira';
  }
}

export function restartGame() {
  initBalls();
  S.estado = 'mira'; S.turn = 0; S.quebra = true;
  S.tipos = [null, null]; S.potJogador = [[], []]; S.potTurno = [];
  S.primeiroHit = null; S.faltou = false; S.vencedor = -1;
  S.timerFrames = S.TIMER_MAX; S.msgTxt = 'Arraste para atirar'; S.msgFlash = 120;
  S.power = 0; S.pullBack = 0; S.isDragging = false;
  S.botDelay = 0; S.botAimPhase = 0; S.botAimTick = 0; S.botFakeTarget = 0; S.botFakeLinger = 0;
  S.celebFrames = 0; S.celebParticles = []; S.netAnims = []; S.resignConfirm = false;
  S.gameEndHandled = false;
}
