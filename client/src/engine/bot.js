import { S } from '../state.js';
import { getBall } from '../utils.js';
import { sndCueStrike } from '../audio/sounds.js';

// ── Bot Profiles ───────────────────────────────────────────────────────────────
// S.betAmount === 0 → FREE (razoável, humano imperfeito)
// S.betAmount  > 0 → PAID (quase profissional, ainda humano)

const PROFILE_FREE = {
  aimErr:           0.052,
  wobbleScale:      0.13,
  thinkMinSec:      2.2,
  thinkMaxSec:      5.8,
  cutPenalty:       340,
  lookahead:        false,
  safetyChance:     0.18,
  suboptimalChance: 0.22,
  extraCutErr:      0.065,
  powerVariance:    0.08,
  placePrecision:   5,
  surveyChance:     0.22,
  commitBase:       0.016,
  commitProg:       0.042,
};

const PROFILE_PAID = {
  aimErr:           0.004,
  wobbleScale:      0.022,
  thinkMinSec:      1.6,
  thinkMaxSec:      3.8,
  cutPenalty:       160,
  lookahead:        true,
  safetyChance:     0.04,
  suboptimalChance: 0.0,
  extraCutErr:      0.0,
  powerVariance:    0.012,
  placePrecision:   9,
  surveyChance:     0.06,
  commitBase:       0.07,
  commitProg:       0.15,
};

function getBotProfile() {
  return S.betAmount > 0 ? PROFILE_PAID : PROFILE_FREE;
}

// ── Estado interno do bot para o turno atual ───────────────────────────────────
let _profile      = null;
let _targetAng    = 0;
let _targetPow    = 0;
let _thinkTotal   = 0;
let _decoyAng     = null;
let _shotChosen   = false;
let _cutAngle     = 0;

// ── Helpers geométricos ────────────────────────────────────────────────────────
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

function scratchRisk(cbX, cbY, gx, gy, shotAng, cutAng) {
  const extDist = 180;
  if (cutAng < 0.50) {
    const ex = gx + Math.cos(shotAng) * extDist;
    const ey = gy + Math.sin(shotAng) * extDist;
    for (const p of S.POCKETS) {
      if (ptSegDist(p.x, p.y, gx, gy, ex, ey) < S.BR * 1.6) return true;
    }
  }
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

// ── Avaliação de tacada ────────────────────────────────────────────────────────
function evalShot(cb, tb, pocket, relaxed = false) {
  const prof = _profile || getBotProfile();
  const angTP = Math.atan2(pocket.y - tb.y, pocket.x - tb.x);
  const gx = tb.x - Math.cos(angTP) * S.BR * 2;
  const gy = tb.y - Math.sin(angTP) * S.BR * 2;
  if (gx < S.PX + S.BR || gx > S.PX + S.PW - S.BR) return -Infinity;
  if (gy < S.PY + S.BR || gy > S.PY + S.PH - S.BR) return -Infinity;
  if (!ghostClear(gx, gy, tb.id)) return -Infinity;
  if (!pathClear(tb.x, tb.y, pocket.x, pocket.y, [tb.id])) return -Infinity;
  if (!pathClear(cb.x, cb.y, gx, gy, [0, tb.id])) return -Infinity;
  const shotAng = Math.atan2(gy - cb.y, gx - cb.x);
  const cutAng  = Math.abs(angDiff(angTP, shotAng));
  if (cutAng > Math.PI / 2) return -Infinity;
  if (!relaxed && scratchRisk(cb.x, cb.y, gx, gy, shotAng, cutAng)) return -Infinity;

  const cueDist = Math.hypot(gx - cb.x, gy - cb.y);
  const tbDist  = Math.hypot(pocket.x - tb.x, pocket.y - tb.y);
  const power   = Math.min(0.98, Math.max(0.28, (cueDist + tbDist) / 360));
  const cbEnd   = estimateCbEnd(gx, gy, shotAng, power);
  const cx = S.PX + S.PW / 2, cy = S.PY + S.PH / 2;
  const posBonus = Math.max(0, 220 - Math.hypot(cbEnd.x - cx, cbEnd.y - cy) * 0.45);

  return 2000 - cueDist * 0.8 - tbDist * 0.6 - cutAng * prof.cutPenalty + posBonus;
}

// ── Lookahead (só PAID) ────────────────────────────────────────────────────────
function lookAheadBonus(gx, gy, shotAng, power, targets) {
  const prof = _profile || getBotProfile();
  if (!prof.lookahead) return 0;
  const cbEnd = estimateCbEnd(gx, gy, shotAng, power);
  let bestNext = -Infinity;
  const mockCb = { x: cbEnd.x, y: cbEnd.y };
  for (const tb of targets) {
    for (const pocket of S.POCKETS) {
      const s = evalShot(mockCb, tb, pocket);
      if (s > bestNext) bestNext = s;
    }
  }
  return bestNext > 0 ? Math.min(bestNext * 0.38, 580) : 0;
}

// ── Safety shot ────────────────────────────────────────────────────────────────
function buildSafetyShot(cb) {
  const walls = [
    { x: S.PX + S.PW / 2, y: S.PY },
    { x: S.PX + S.PW / 2, y: S.PY + S.PH },
    { x: S.PX,             y: S.PY + S.PH / 2 },
    { x: S.PX + S.PW,     y: S.PY + S.PH / 2 },
  ];
  const wall = walls[Math.floor(Math.random() * walls.length)];
  const ang  = Math.atan2(wall.y - cb.y, wall.x - cb.x);
  const pow  = 0.35 + Math.random() * 0.22;
  return { ang, pow, score: -9000, isSafety: true, cutAngle: 0, cueDist: 200 };
}

// ── Decoy angle para survey ────────────────────────────────────────────────────
function pickDecoyAngle(cb, realAng) {
  const others = S.balls.filter(b => !b.out && b.id !== 0);
  if (others.length === 0) return null;
  const candidates = others.filter(b => {
    const a = Math.atan2(b.y - cb.y, b.x - cb.x);
    return Math.abs(angDiff(a, realAng)) > 0.35;
  });
  if (candidates.length === 0) return null;
  const decoy = candidates[Math.floor(Math.random() * candidates.length)];
  return Math.atan2(decoy.y - cb.y, decoy.x - cb.x);
}

// ── Seleção de tacada ──────────────────────────────────────────────────────────
function botChooseShot() {
  const prof = _profile || getBotProfile();
  const cb = S.balls[0];
  if (!cb || cb.out) return null;

  // Abertura: quebra
  if (S.quebra) {
    const racked = S.balls.filter(b => !b.out && b.id !== 0);
    if (racked.length > 0) {
      const apex = racked.reduce((c, b) =>
        Math.hypot(b.x - cb.x, b.y - cb.y) < Math.hypot(c.x - cb.x, c.y - cb.y) ? b : c
      );
      const ang = Math.atan2(apex.y - cb.y, apex.x - cb.x);
      return { ang: ang + (Math.random() - 0.5) * 2 * prof.aimErr * 0.06, pow: 1.0, score: 9999, cutAngle: 0, cueDist: 150 };
    }
  }

  // Determinar bolas alvo
  const botType = S.tipos[S.BOT];
  let targets;
  if (botType === null) {
    targets = S.balls.filter(b => !b.out && b.id !== 0 && b.id !== 8);
  } else {
    const myIds = botType === 'solid' ? [1,2,3,4,5,6,7] : [9,10,11,12,13,14,15];
    const rem   = myIds.filter(id => !S.potJogador[S.BOT].includes(id) && getBall(id) && !getBall(id).out);
    if (rem.length === 0) {
      const b8 = getBall(8);
      targets = b8 && !b8.out ? [b8] : [];
    } else {
      targets = rem.map(id => getBall(id)).filter(b => b && !b.out);
    }
  }

  // Safety play antes de avaliar shots
  if (Math.random() < prof.safetyChance) return buildSafetyShot(cb);

  // Avaliar todos os shots
  const candidates = [];
  targets.forEach(tb => {
    S.POCKETS.forEach(pocket => {
      const baseScore = evalShot(cb, tb, pocket);
      if (baseScore === -Infinity) return;

      const angTP   = Math.atan2(pocket.y - tb.y, pocket.x - tb.x);
      const gx      = tb.x - Math.cos(angTP) * S.BR * 2;
      const gy      = tb.y - Math.sin(angTP) * S.BR * 2;
      const shotAng = Math.atan2(gy - cb.y, gx - cb.x);
      const cueDist = Math.hypot(gx - cb.x, gy - cb.y);
      const tbDist  = Math.hypot(pocket.x - tb.x, pocket.y - tb.y);
      const power   = Math.min(0.98, Math.max(0.28, (cueDist + tbDist) / 360));
      const cutAng  = Math.abs(angDiff(angTP, shotAng));
      const rem     = targets.filter(t => t.id !== tb.id);
      const score   = baseScore + lookAheadBonus(gx, gy, shotAng, power, rem);
      candidates.push({ ang: shotAng, pow: power, score, cutAngle: cutAng, cueDist });
    });
  });

  // Fallback relaxado (ignora risco de encaçapar branca)
  if (candidates.length === 0 && targets.length > 0) {
    targets.forEach(tb => {
      S.POCKETS.forEach(pocket => {
        const baseScore = evalShot(cb, tb, pocket, true);
        if (baseScore === -Infinity) return;
        const angTP   = Math.atan2(pocket.y - tb.y, pocket.x - tb.x);
        const gx      = tb.x - Math.cos(angTP) * S.BR * 2;
        const gy      = tb.y - Math.sin(angTP) * S.BR * 2;
        const shotAng = Math.atan2(gy - cb.y, gx - cb.x);
        const cueDist = Math.hypot(gx - cb.x, gy - cb.y);
        const tbDist  = Math.hypot(pocket.x - tb.x, pocket.y - tb.y);
        const power   = Math.min(0.92, Math.max(0.28, (cueDist + tbDist) / 360));
        const cutAng  = Math.abs(angDiff(angTP, shotAng));
        candidates.push({ ang: shotAng, pow: power, score: baseScore - 500, cutAngle: cutAng, cueDist });
      });
    });
  }

  // Último recurso: bola mais próxima
  if (candidates.length === 0 && targets.length > 0) {
    const nearest = targets.reduce((a, b) =>
      Math.hypot(b.x - cb.x, b.y - cb.y) < Math.hypot(a.x - cb.x, a.y - cb.y) ? b : a
    );
    return { ang: Math.atan2(nearest.y - cb.y, nearest.x - cb.x), pow: 0.7, score: -1, cutAngle: 0.5, cueDist: 200 };
  }
  if (candidates.length === 0) return null;

  // Ordenar por score
  candidates.sort((a, b) => b.score - a.score);

  // Escolha sub-ótima (só FREE)
  let chosen = candidates[0];
  if (prof.suboptimalChance > 0 && candidates.length > 1 && Math.random() < prof.suboptimalChance) {
    const idx = Math.min(candidates.length - 1, 1 + Math.floor(Math.random() * 2));
    chosen = candidates[idx];
  }
  return chosen;
}

// ── Think time adaptativo ──────────────────────────────────────────────────────
function calcThinkFrames(prof, cutAngle, cueDist) {
  const base  = (prof.thinkMinSec + Math.random() * (prof.thinkMaxSec - prof.thinkMinSec)) * 60;
  const extra = cutAngle * 55 + (cueDist || 150) * 0.08;
  return Math.round(Math.min(base + extra, prof.thinkMaxSec * 1.4 * 60));
}

// ── Wobble multi-frequência ────────────────────────────────────────────────────
function calcWobble(t, amp) {
  return (
    Math.sin(t * 0.028) * amp * 0.55 +
    Math.sin(t * 0.072) * amp * 0.32 +
    Math.sin(t * 0.19 ) * amp * 0.13
  );
}

// ── Posicionamento de bola (ball in hand) ──────────────────────────────────────
function botPlaceBall() {
  const prof = getBotProfile();
  const cb   = S.balls[0];
  if (!cb) return;
  cb.out = false; cb.vx = 0; cb.vy = 0;
  let bestScore = -Infinity;
  let bestX = S.PX + S.PW * 0.26, bestY = S.PY + S.PH / 2;
  const step2 = S.PH / prof.placePrecision;
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

// ── botTick principal ──────────────────────────────────────────────────────────
export function botTick() {

  // Ball in hand: posicionar e depois pensar
  if (S.estado === 'ballInHand') {
    if (S.botDelay > 0) { S.botDelay--; return; }
    _profile = getBotProfile();
    botPlaceBall();
    _shotChosen = false; _decoyAng = null;
    S.botDelay  = calcThinkFrames(_profile, 0.3, 200);
    _thinkTotal = S.botDelay;
    S.botAimPhase = 0; S.botAimTick = 0; S.botFakeTarget = 0;
    return;
  }

  if (S.estado !== 'mira') return;

  // ── FASE 0: THINKING ──────────────────────────────────────────────────────
  if (S.botAimPhase === 0) {

    if (!_shotChosen) {
      _profile   = getBotProfile();
      const shot = botChooseShot();
      if (!shot) { S.turn = 1 - S.turn; return; }

      _targetAng = shot.ang;
      _targetPow = shot.pow;
      _cutAngle  = shot.cutAngle || 0;
      _shotChosen = true;

      S.botDelay  = calcThinkFrames(_profile, _cutAngle, shot.cueDist || 150);
      _thinkTotal = S.botDelay;

      _decoyAng = (Math.random() < _profile.surveyChance)
        ? pickDecoyAngle(S.balls[0], _targetAng)
        : null;

      S.botAimTick = 0;
      S.botFakeTarget = 1;
      S.power    = 0;
      S.pullBack = 0;
    }

    if (S.botDelay > 0) {
      S.botDelay--;
      const progress = 1 - S.botDelay / _thinkTotal;

      // Survey: primeiros 38% apontam para decoy
      let visualTarget;
      if (_decoyAng !== null && progress < 0.38) {
        const fade = progress / 0.38;
        visualTarget = _decoyAng + angDiff(_decoyAng, _targetAng) * fade * 0.4;
      } else {
        visualTarget = _targetAng;
      }

      const decayedAmp = _profile.wobbleScale * Math.max(0, 1 - progress * 1.1);
      const wobble     = calcWobble(S.botAimTick, decayedAmp);
      const aimTarget  = visualTarget + wobble;
      const diff       = angDiff(S.aimAng, aimTarget);
      const spd        = _profile.commitBase + progress * _profile.commitProg;
      S.aimAng        += diff * spd;

      S.power    = _targetPow * Math.min(progress * 1.6, 1) * 0.55;
      S.pullBack = S.power * 42;
      S.botAimTick++;
      return;
    }

    // Think acabou → fase de assentamento
    S.botAimPhase = 1;
    S.botAimTick  = 0;
    S.botDelay    = 42;
    return;
  }

  // ── FASE 1: SETTLING ──────────────────────────────────────────────────────
  if (S.botAimPhase === 1) {
    if (S.botDelay > 0) {
      S.botDelay--;
      const progress = 1 - S.botDelay / 42;
      const residualAmp = _profile.wobbleScale * 0.04 * (1 - progress);
      const wobble      = calcWobble(S.botAimTick, residualAmp);
      const diff        = angDiff(S.aimAng, _targetAng + wobble);
      const spd         = _profile.commitBase * 4 + progress * _profile.commitProg * 3;
      S.aimAng         += diff * spd;
      S.power    = _targetPow;
      S.pullBack = S.power * 42;
      S.botAimTick++;
      return;
    }
    S.aimAng   = _targetAng;
    S.power    = _targetPow;
    S.pullBack = S.power * 42;
    S.botAimPhase = 2;
    return;
  }

  // ── FASE 2: STRIKE ────────────────────────────────────────────────────────
  if (S.botAimPhase === 2) {
    const cb = S.balls[0];
    if (!cb || cb.out) {
      _shotChosen = false; _decoyAng = null;
      S.botAimPhase = 0; S.botDelay = 40;
      return;
    }

    let finalAng = S.aimAng;
    if (_profile.extraCutErr > 0 && _cutAngle > 0.66) {
      finalAng += (Math.random() - 0.5) * 2 * _profile.extraCutErr;
    }
    finalAng += (Math.random() - 0.5) * 2 * _profile.aimErr;

    const noise    = (Math.random() - 0.5) * 2 * _profile.powerVariance;
    const finalPow = Math.max(0.18, Math.min(1.0, _targetPow * (1 + noise)));

    cb.vx = Math.cos(finalAng) * finalPow * 20;
    cb.vy = Math.sin(finalAng) * finalPow * 20;
    sndCueStrike(finalPow);

    S.estado      = 'rolando';
    S.primeiroHit = null;
    S.faltou      = false;
    S.potTurno    = [];
    S.timerFrames = S.TIMER_MAX;
    S.power       = 0;
    S.pullBack    = 0;

    S.botAimPhase = 0;
    S.botDelay    = 60;
    _shotChosen   = false;
    _decoyAng     = null;
    _profile      = null;
  }
}

// Mantido por compatibilidade — main.js importa este mas o delay real é
// calculado internamente por botTick via calcThinkFrames.
export function botThinkDelay() {
  const prof = getBotProfile();
  return calcThinkFrames(prof, 0.3, 150);
}
