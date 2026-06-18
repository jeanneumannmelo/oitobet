import { S } from '../state.js';
import { getBall } from '../utils.js';
import { sndCueStrike } from '../audio/sounds.js';

const BOT_AIM_FRAMES  = 45;
const BOT_THINK_MIN   = 2.5 * 60;  // 2.5s at 60fps
const BOT_THINK_MAX   = 5.0 * 60;  // 5s at 60fps

function botThinkDelay() {
  return Math.round(BOT_THINK_MIN + Math.random() * (BOT_THINK_MAX - BOT_THINK_MIN));
}

function angDiff(a, b) {
  return ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

function ptSegDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  if (len2 < 0.001) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.sqrt((px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2);
}

function pathClear(x1, y1, x2, y2, exc) {
  for (const b of S.balls) {
    if (b.out) continue;
    if (exc && exc.includes(b.id)) continue;
    if (ptSegDist(b.x, b.y, x1, y1, x2, y2) < S.BR * 1.95) return false;
  }
  return true;
}

function ghostClear(gx, gy, excludeId) {
  for (const b of S.balls) {
    if (b.out || b.id === 0 || b.id === excludeId) continue;
    const dx = b.x - gx, dy = b.y - gy;
    if (dx * dx + dy * dy < (S.BR * 2 - 1) ** 2) return false;
  }
  return true;
}

function evalShot(cb, tb, pocket) {
  const angTP = Math.atan2(pocket.y - tb.y, pocket.x - tb.x);
  const gx = tb.x - Math.cos(angTP) * S.BR * 2;
  const gy = tb.y - Math.sin(angTP) * S.BR * 2;
  if (gx < S.PX + S.BR || gx > S.PX + S.PW - S.BR) return -Infinity;
  if (gy < S.PY + S.BR || gy > S.PY + S.PH - S.BR) return -Infinity;
  if (!ghostClear(gx, gy, tb.id)) return -Infinity;
  if (!pathClear(tb.x, tb.y, pocket.x, pocket.y, [tb.id])) return -Infinity;
  if (!pathClear(cb.x, cb.y, gx, gy, [0, tb.id])) return -Infinity;
  const shotAng = Math.atan2(gy - cb.y, gx - cb.x);
  const cutAng = Math.abs(angDiff(angTP, shotAng));
  if (cutAng > Math.PI / 2) return -Infinity;
  const cueDist = Math.hypot(gx - cb.x, gy - cb.y);
  const tbDist = Math.hypot(pocket.x - tb.x, pocket.y - tb.y);
  return 2000 - cueDist * 0.8 - tbDist * 0.6 - cutAng * 280;
}

function botChooseShot() {
  const cb = S.balls[0];
  if (!cb || cb.out) return null;
  const botType = S.tipos[S.BOT];
  let targets;
  if (botType === null) {
    targets = S.balls.filter(b => !b.out && b.id !== 0 && b.id !== 8);
  } else {
    const myIds = botType === 'solid' ? [1,2,3,4,5,6,7] : [9,10,11,12,13,14,15];
    const rem = myIds.filter(id => !S.potJogador[S.BOT].includes(id) && getBall(id) && !getBall(id).out);
    if (rem.length === 0) {
      const b8 = getBall(8);
      targets = b8 && !b8.out ? [b8] : [];
    } else {
      targets = rem.map(id => getBall(id)).filter(b => b && !b.out);
    }
  }

  let best = null, bestScore = -Infinity;
  targets.forEach(tb => {
    S.POCKETS.forEach(pocket => {
      const score = evalShot(cb, tb, pocket);
      if (score > bestScore) {
        bestScore = score;
        const angTP = Math.atan2(pocket.y - tb.y, pocket.x - tb.x);
        const gx = tb.x - Math.cos(angTP) * S.BR * 2;
        const gy = tb.y - Math.sin(angTP) * S.BR * 2;
        const shotAng = Math.atan2(gy - cb.y, gx - cb.x);
        const cueDist = Math.hypot(gx - cb.x, gy - cb.y);
        const tbDist = Math.hypot(pocket.x - tb.x, pocket.y - tb.y);
        best = { ang: shotAng, pow: Math.min(0.92, Math.max(0.28, (cueDist + tbDist) / 360)), score };
      }
    });
  });

  if (!best && targets.length > 0) {
    const tb = targets[0];
    best = { ang: Math.atan2(tb.y - cb.y, tb.x - cb.x), pow: 0.55, score: -1 };
  }
  const errByDiff = [0, 0.15, 0.08, 0.04, 0.015, 0.003];
  const err = errByDiff[Math.min(5, Math.max(1, S.botDifficulty))] || 0.08;
  if (best) best.ang += (Math.random() - 0.5) * 2 * err;
  return best;
}

function botPlaceBall() {
  const cb = S.balls[0];
  if (!cb) return;
  cb.out = false; cb.vx = 0; cb.vy = 0;
  let bestScore = -Infinity, bestX = S.PX + S.PW * 0.26, bestY = S.PY + S.PH / 2;
  const step2 = S.PH / 5;
  for (let tx = S.PX + S.BR * 2; tx < S.PX + S.PW - S.BR * 2; tx += step2) {
    for (let ty = S.PY + S.BR * 2; ty < S.PY + S.PH - S.BR * 2; ty += step2) {
      let ok = true;
      for (let k = 1; k < S.balls.length; k++) {
        if (S.balls[k].out) continue;
        const ddx = S.balls[k].x - tx, ddy = S.balls[k].y - ty;
        if (ddx * ddx + ddy * ddy < (S.BR * 2.2) ** 2) { ok = false; break; }
      }
      if (!ok) continue;
      cb.x = tx; cb.y = ty;
      const shot = botChooseShot();
      if (shot && shot.score > bestScore) { bestScore = shot.score; bestX = tx; bestY = ty; }
    }
  }
  cb.x = bestX; cb.y = bestY;
  S.estado = 'mira'; S.msgTxt = ''; S.msgFlash = 0;
}

export function botTick() {
  if (S.estado === 'ballInHand') {
    if (S.botDelay > 0) { S.botDelay--; return; }
    botPlaceBall();
    S.botDelay = botThinkDelay(); S.botAimPhase = 0; S.botAimTick = 0; S.botFakeTarget = 0;
    return;
  }
  if (S.estado !== 'mira') return;

  if (S.botAimPhase === 0) {
    if (S.botDelay > 0) {
      S.botDelay--;

      // Pre-compute the real shot on the very first tick of this think phase
      if (S.botFakeTarget === 0) {
        const shot = botChooseShot();
        if (shot) { S.botTargetAng = shot.ang; S.botTargetPow = shot.pow; }
        S.botFakeTarget = 1;
        // Save the initial delay so we can compute progress fraction
        S.botFakeLinger = S.botDelay + 1;
      }

      // Hover naturally near the real target: slow drift + oscillations that fade as we commit
      if (S.botFakeLinger > 0) {
        const progress = 1 - S.botDelay / S.botFakeLinger;   // 0 → 1 over think phase

        // Two overlapping sine waves give a natural "micro-correction" look
        const amp = 0.10 * (1 - progress * 0.8);
        const wobble = Math.sin(S.botAimTick * 0.11) * amp
                     + Math.cos(S.botAimTick * 0.065) * amp * 0.45;

        const targetAngle = S.botTargetAng + wobble;
        const diff = angDiff(S.aimAng, targetAngle);

        // Aim speed ramps up as the bot commits
        S.aimAng += diff * (0.014 + progress * 0.038);

        // Power bar gradually builds up (capped at 60% during think phase)
        S.power    = S.botTargetPow * Math.min(progress * 1.8, 1) * 0.60;
        S.pullBack = S.power * 42;
      }
      S.botAimTick++;
      return;
    }

    // Delay expired — commit to final precise aim
    if (S.botFakeTarget === 0) {
      const shot = botChooseShot();
      if (!shot) { S.turn = 1 - S.turn; return; }
      S.botTargetAng = shot.ang; S.botTargetPow = shot.pow;
    }
    S.botAimPhase = 1; S.botAimTick = 0; S.botDelay = BOT_AIM_FRAMES;
    S.msgTxt = ''; S.msgFlash = 0;

  } else if (S.botAimPhase === 1) {
    const diff = angDiff(S.aimAng, S.botTargetAng);
    const spd = 0.06 + Math.abs(diff) * 0.3;
    if (Math.abs(diff) < 0.008) {
      S.aimAng = S.botTargetAng; S.power = S.botTargetPow; S.pullBack = S.power * 42;
      S.botAimPhase = 2;
    } else {
      S.aimAng += diff * spd;
      S.power = Math.min(S.botTargetPow, S.power + 0.025); S.pullBack = S.power * 42;
    }
    S.botAimTick++;
    if (S.botAimTick > BOT_AIM_FRAMES * 2) { S.aimAng = S.botTargetAng; S.botAimPhase = 2; }

  } else if (S.botAimPhase === 2) {
    const cb = S.balls[0];
    if (!cb || cb.out) { S.botAimPhase = 0; S.botDelay = 40; return; }
    const spd2 = S.botTargetPow * 20;
    cb.vx = Math.cos(S.aimAng) * spd2; cb.vy = Math.sin(S.aimAng) * spd2;
    sndCueStrike(S.botTargetPow);
    S.estado = 'rolando'; S.primeiroHit = null; S.faltou = false; S.potTurno = [];
    S.timerFrames = S.TIMER_MAX; S.power = 0; S.pullBack = 0;
    S.botAimPhase = 0; S.botDelay = 60;
  }
}

export { botThinkDelay };
