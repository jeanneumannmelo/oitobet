import { C } from '../canvas.js';
import { S } from '../state.js';
import { toGame } from '../utils.js';
import { initAudio, sndCueStrike } from '../audio/sounds.js';
import { restartGame } from '../engine/logic.js';
import { drawVitoria } from '../render/screen.js';
import { netSendShoot, netSendPlaceBall } from '../net/socket.js';

export function startDrag(cx, cy) {
  initAudio();
  if (S.estado === 'vitoria') {
    const g = toGame(cx, cy);
    const revan = drawVitoria._revanBtn;
    const menu  = drawVitoria._menuBtn;
    const hit = (btn) => btn && g.x >= btn.x && g.x <= btn.x + btn.w && g.y >= btn.y && g.y <= btn.y + btn.h;

    if (hit(revan) && S.rematchState === null) {
      // Start bot thinking countdown — random decision between 3s and 25s
      S.rematchState = 'waiting';
      S.rematchCountdown = 30 * 60;
      S.rematchDecideAt = S.tick + (3 + Math.random() * 22) * 60;
    } else if (hit(menu)) {
      S.rematchState = null;
      S.rematchCountdown = 0;
      // Signal main.js to return to home screen
      S._goHome = true;
    }
    return;
  }
  if (S.resignConfirm) {
    const grc = toGame(cx, cy);
    const rb2 = S.resignBtn;
    if (grc.x >= rb2.simX && grc.x <= rb2.simX + rb2.simW && grc.y >= rb2.simY && grc.y <= rb2.simY + rb2.simH) {
      S.resignConfirm = false; S.vencedor = 1; S.estado = 'vitoria';
      import('../audio/sounds.js').then(m => m.sndWin());
    } else {
      S.resignConfirm = false;
    }
    return;
  }
  // Resign button is always clickable for player 0 (checked before turn guard)
  const g2 = toGame(cx, cy);
  const rb = S.resignBtn;
  if (g2.x >= rb.x && g2.x <= rb.x + rb.w && g2.y >= rb.y && g2.y <= rb.y + rb.h) {
    if (S.estado === 'mira' || S.estado === 'ballInHand') { S.resignConfirm = true; return; }
  }

  // In online mode, only act on our turn
  if (S.mode === 'online' && S.turn !== S.myIdx) return;
  if (S.mode === 'offline' && S.turn === S.BOT) return;

  S.isDragging = true;
  updateDrag(cx, cy);
}

export function updateDrag(cx, cy) {
  if (!S.isDragging) return;
  if (S.mode === 'online' && S.turn !== S.myIdx) return;
  if (S.mode === 'offline' && S.turn === S.BOT) return;
  const g = toGame(cx, cy);
  if (S.estado === 'mira') {
    const b = S.balls[0]; if (!b || b.out) return;
    const dx = b.x - g.x, dy = b.y - g.y, dist = Math.sqrt(dx * dx + dy * dy);
    S.aimAng = Math.atan2(dy, dx);
    S.power = Math.min(dist, S.MAX_PULL) / S.MAX_PULL;
    S.pullBack = S.power * 42;
  } else if (S.estado === 'ballInHand') {
    const b = S.balls[0]; if (!b) return;
    b.x = Math.max(S.PX + S.BR + 2, Math.min(S.PX + S.PW - S.BR - 2, g.x));
    b.y = Math.max(S.PY + S.BR + 2, Math.min(S.PY + S.PH - S.BR - 2, g.y));
    b.out = false;
  }
}

export function endDrag() {
  if (!S.isDragging) return;
  S.isDragging = false;
  if (S.estado === 'mira') {
    if (S.power < 0.04) { S.power = 0; S.pullBack = 0; return; }
    const b = S.balls[0]; if (!b || b.out) return;
    if (S.mode === 'online') {
      // Send to server; server will run physics and reply with state
      netSendShoot(S.aimAng, S.power);
    } else {
      const spd = S.power * 20;
      b.vx = Math.cos(S.aimAng) * spd; b.vy = Math.sin(S.aimAng) * spd;
      sndCueStrike(S.power);
      S.estado = 'rolando'; S.primeiroHit = null; S.faltou = false; S.potTurno = [];
      S.timerFrames = S.TIMER_MAX; S.power = 0; S.pullBack = 0;
    }
  } else if (S.estado === 'ballInHand') {
    const b = S.balls[0]; if (!b || b.out) return;
    const ok = !S.balls.slice(1).some(ob => {
      if (ob.out) return false;
      const dx = ob.x - b.x, dy = ob.y - b.y;
      return dx * dx + dy * dy < (S.BR * 2.1) ** 2;
    });
    if (S.mode === 'online') {
      if (ok) netSendPlaceBall(b.x, b.y);
      else { S.msgTxt = 'Posição bloqueada!'; S.msgFlash = 60; }
    } else {
      if (ok) { S.estado = 'mira'; S.msgTxt = 'Atire!'; S.msgFlash = 90; }
      else { S.msgTxt = 'Posição bloqueada!'; S.msgFlash = 60; }
    }
  }
}

export function initInput() {
  C.addEventListener('mousedown', e => startDrag(e.clientX, e.clientY));
  C.addEventListener('mousemove', e => updateDrag(e.clientX, e.clientY));
  C.addEventListener('mouseup', () => endDrag());
  C.addEventListener('mouseleave', () => endDrag());
  C.addEventListener('touchstart', e => { e.preventDefault(); startDrag(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
  C.addEventListener('touchmove', e => { e.preventDefault(); updateDrag(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
  C.addEventListener('touchend', e => { e.preventDefault(); endDrag(); }, { passive: false });
}
