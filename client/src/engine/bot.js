import { S } from '../state.js';
import { getBall } from '../utils.js';
import { sndCueStrike } from '../audio/sounds.js';

const BOT_AIM_FRAMES  = 45;
const BOT_THINK_MIN   = 2.5 * 60;
const BOT_THINK_MAX   = 5.0 * 60;

const BOT_THINK_MIN_HARD = 0.6 * 60;
const BOT_THINK_MAX_HARD = 1.2 * 60;

function botThinkDelay() {
  if (S.botDifficulty >= 5) {
    return Math.round(BOT_THINK_MIN_HARD + Math.random() * (BOT_THINK_MAX_HARD - BOT_THINK_MIN_HARD));
  }
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
    if (ptSegDist(b.x, b.y, x1, y1, x2, y2) < S.BR * 1.92) return false;
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

// Estimate scratch risk — reduced conservativeness vs old version
function scratchRisk(cbX, cbY, gx, gy, shotAng, cutAng) {
  const extDist = 180; // was 320 — more realistic cue ball travel after contact

  // Straight-through model (small cut angle)
  if (cutAng < 0.50) {
    const ex = gx + Math.cos(shotAng) * extDist;
    const ey = gy + Math.sin(shotAng) * extDist;
    for (const p of S.POCKETS) {
      if (ptSegDist(p.x, p.y, gx, gy, ex, ey) < S.BR * 1.6) return true; // was 2.2
    }
  }

  // Perpendicular deflection model (stun) — only check closest few pockets
  const nearPockets = S.POCKETS.slice().sort((a, b) =>
    Math.hypot(a.x - gx, a.y - gy) - Math.hypot(b.x - gx, b.y - gy)
  ).slice(0, 3);

  for (const sign of [1, -1]) {
    const perpAng = shotAng + sign * Math.PI / 2;
    const px2 = gx + Math.cos(perpAng) * extDist;
    const py2 = gy + Math.sin(perpAng) * extDist;
    for (const p of nearPockets) {
      if (ptSegDist(p.x, p.y, gx, gy, px2, py2) < S.BR * 1.6) return true;
    }
  }

  return false;
}

// Estimate cue ball end position after a stun shot.
function estimateCbEnd(gx, gy, shotAng, power) {
  const dist = power * 110;
  for (const sign of [1, -1]) {
    const ang = shotAng + sign * Math.PI / 2;
    const ex = gx + Math.cos(ang) * dist;
    const ey = gy + Math.sin(ang) * dist;
    if (ex > S.PX + S.BR * 3 && ex < S.PX + S.PW - S.BR * 3 &&
        ey > S.PY + S.BR * 3 && ey < S.PY + S.PH - S.BR * 3) {
      return { x: ex, y: ey };
    }
  }
  return { x: S.PX + S.PW / 2, y: S.PY + S.PH / 2 };
}

function evalShot(cb, tb, pocket, relaxed = false) {
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

  // Skip scratch check in relaxed mode (fallback search)
  if (!relaxed && scratchRisk(cb.x, cb.y, gx, gy, shotAng, cutAng)) return -Infinity;

  const cueDist = Math.hypot(gx - cb.x, gy - cb.y);
  const tbDist = Math.hypot(pocket.x - tb.x, pocket.y - tb.y);

  const maxPow = S.botDifficulty >= 5 ? 1.0 : 0.92;
  const power = Math.min(maxPow, Math.max(0.28, (cueDist + tbDist) / 360));
  const cbEnd = estimateCbEnd(gx, gy, shotAng, power);
  const cx = S.PX + S.PW / 2, cy = S.PY + S.PH / 2;
  const centerDist = Math.hypot(cbEnd.x - cx, cbEnd.y - cy);
  const posBonus = Math.max(0, 220 - centerDist * 0.45); // increased from 180

  // Difficulty 5: lower cut penalty — a pro can make any cut
  const cutPenalty = S.botDifficulty >= 5 ? 180 : 280;
  return 2000 - cueDist * 0.8 - tbDist * 0.6 - cutAng * cutPenalty + posBonus;
}

function lookAheadBonus(gx, gy, shotAng, power, targets) {
  if (S.botDifficulty < 4) return 0;
  const cbEnd = estimateCbEnd(gx, gy, shotAng, power);
  let bestNext = -Infinity;
  const mockCb = { x: cbEnd.x, y: cbEnd.y };
  for (const tb of targets) {
    for (const pocket of S.POCKETS) {
      const s = evalShot(mockCb, tb, pocket);
      if (s > bestNext) bestNext = s;
    }
  }
  // Difficulty 5: much higher lookahead weight — plan ahead aggressively
  const scale = S.botDifficulty >= 5 ? 0.40 : 0.12;
  const cap   = S.botDifficulty >= 5 ? 600  : 160;
  return bestNext > 0 ? Math.min(bestNext * scale, cap) : 0;
}

function botChooseShot() {
  const cb = S.balls[0];
  if (!cb || cb.out) return null;

  // Opening break: hit the closest racked ball at max power
  if (S.quebra) {
    const racked = S.balls.filter(b => !b.out && b.id !== 0);
    if (racked.length > 0) {
      const apex = racked.reduce((closest, b) =>
        Math.hypot(b.x - cb.x, b.y - cb.y) < Math.hypot(closest.x - cb.x, closest.y - cb.y) ? b : closest
      );
      const ang = Math.atan2(apex.y - cb.y, apex.x - cb.x);
      const err = S.botDifficulty >= 5 ? 0.003 : 0.06;
      return { ang: ang + (Math.random() - 0.5) * 2 * err, pow: 1.0, score: 9999 };
    }
  }

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
      const baseScore = evalShot(cb, tb, pocket);
      if (baseScore === -Infinity) return;

      const angTP = Math.atan2(pocket.y - tb.y, pocket.x - tb.x);
      const gx = tb.x - Math.cos(angTP) * S.BR * 2;
      const gy = tb.y - Math.sin(angTP) * S.BR * 2;
      const shotAng = Math.atan2(gy - cb.y, gx - cb.x);
      const cueDist = Math.hypot(gx - cb.x, gy - cb.y);
      const tbDist = Math.hypot(pocket.x - tb.x, pocket.y - tb.y);
      const maxPow = S.botDifficulty >= 5 ? 1.0 : 0.92;
      const power = Math.min(maxPow, Math.max(0.28, (cueDist + tbDist) / 360));

      const remaining = targets.filter(t => t.id !== tb.id);
      const score = baseScore + lookAheadBonus(gx, gy, shotAng, power, remaining);

      if (score > bestScore) {
        bestScore = score;
        best = { ang: shotAng, pow: power, score };
      }
    });
  });

  // Relaxed fallback: ignore scratch risk to find any valid shot
  if (!best && targets.length > 0) {
    targets.forEach(tb => {
      S.POCKETS.forEach(pocket => {
        const baseScore = evalShot(cb, tb, pocket, true); // relaxed=true
        if (baseScore === -Infinity) return;
        const angTP = Math.atan2(pocket.y - tb.y, pocket.x - tb.x);
        const gx = tb.x - Math.cos(angTP) * S.BR * 2;
        const gy = tb.y - Math.sin(angTP) * S.BR * 2;
        const shotAng = Math.atan2(gy - cb.y, gx - cb.x);
        const cueDist = Math.hypot(gx - cb.x, gy - cb.y);
        const tbDist = Math.hypot(pocket.x - tb.x, pocket.y - tb.y);
        const power = Math.min(0.92, Math.max(0.28, (cueDist + tbDist) / 360));
        const score = baseScore - 500; // penalize relaxed shots
        if (score > bestScore) {
          bestScore = score;
          best = { ang: shotAng, pow: power, score };
        }
      });
    });
  }

  // Last resort: aim at nearest ball
  if (!best && targets.length > 0) {
    const nearest = targets.reduce((a, b) =>
      Math.hypot(b.x - cb.x, b.y - cb.y) < Math.hypot(a.x - cb.x, a.y - cb.y) ? b : a
    );
    best = { ang: Math.atan2(nearest.y - cb.y, nearest.x - cb.x), pow: 0.7, score: -1 };
  }

  // Aim error — difficulty 5 is near-perfect
  const errByDiff = [0, 0.18, 0.10, 0.05, 0.018, 0.0003];
  const err = errByDiff[Math.min(5, Math.max(1, S.botDifficulty))] || 0.08;
  if (best) best.ang += (Math.random() - 0.5) * 2 * err;
  return best;
}

function botPlaceBall() {
  const cb = S.balls[0];
  if (!cb) return;
  cb.out = false; cb.vx = 0; cb.vy = 0;
  let bestScore = -Infinity, bestX = S.PX + S.PW * 0.26, bestY = S.PY + S.PH / 2;
  // Finer grid for difficulty 5
  const step2 = S.botDifficulty >= 5 ? S.PH / 8 : S.PH / 5;
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

      if (S.botFakeTarget === 0) {
        const shot = botChooseShot();
        if (shot) { S.botTargetAng = shot.ang; S.botTargetPow = shot.pow; }
        S.botFakeTarget = 1;
        S.botFakeLinger = S.botDelay + 1;
      }

      if (S.botFakeLinger > 0) {
        const progress = 1 - S.botDelay / S.botFakeLinger;

        const wobbleScale = S.botDifficulty >= 5 ? 0.008 : 0.10; // near-zero wobble at diff 5
        const amp = wobbleScale * (1 - progress * 0.85);
        const wobble = Math.sin(S.botAimTick * 0.11) * amp
                     + Math.cos(S.botAimTick * 0.065) * amp * 0.45;

        const targetAngle = S.botTargetAng + wobble;
        const diff = angDiff(S.aimAng, targetAngle);

        const commitSpeed = S.botDifficulty >= 5 ? 0.08 + progress * 0.12 : 0.014 + progress * 0.038;
        S.aimAng += diff * commitSpeed;

        S.power    = S.botTargetPow * Math.min(progress * 1.8, 1) * 0.60;
        S.pullBack = S.power * 42;
      }
      S.botAimTick++;
      return;
    }

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
    if (Math.abs(diff) < 0.006) {
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
