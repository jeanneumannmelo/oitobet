// Shared physics — runs identically on server and client.
// No DOM, no audio. Returns an events object so callers can react.

export const FRIC = 0.989;
export const REST = 0.84;

// Layout constants for the canonical 900×580 coordinate space.
// The client scales these to screen; the server uses them as-is.
export const LAYOUT = {
  BW: 900, BH: 580,
  HH: 82, FW: 28, CW: 14, SB: 62, MG: 8,
};

export function computeLayout(BW, BH, HH, FW, CW, SB, MG) {
  const TX = SB, TY = HH + MG, TW = BW - SB * 2, TH = BH - TY - MG;
  const IX = TX + FW, IY = TY + FW, IW = TW - FW * 2, IH = TH - FW * 2;
  const PX = IX + CW, PY = IY + CW, PW = IW - CW * 2, PH = IH - CW * 2;
  const BR = Math.max(9, Math.min(13, Math.round(PH * 0.058)));
  const PCR = Math.round(BR * 1.6);
  const PMR = Math.round(BR * 1.32);
  const POCKETS = [
    { x: PX,        y: PY,       r: PCR, dr: PCR + BR },
    { x: PX+PW/2,   y: IY,       r: PMR, dr: PMR + CW + BR },
    { x: PX+PW,     y: PY,       r: PCR, dr: PCR + BR },
    { x: PX,        y: PY+PH,    r: PCR, dr: PCR + BR },
    { x: PX+PW/2,   y: IY+IH,    r: PMR, dr: PMR + CW + BR },
    { x: PX+PW,     y: PY+PH,    r: PCR, dr: PCR + BR },
  ];
  return { TX, TY, TW, TH, IX, IY, IW, IH, PX, PY, PW, PH, BR, PCR, PMR, POCKETS };
}

export function mkBall(id, x, y) {
  return { id, x, y, vx: 0, vy: 0, out: false, roll: 0 };
}

export function initBalls(PX, PY, PW, PH, BR) {
  const balls = [];
  balls.push(mkBall(0, PX + PW * 0.26, PY + PH / 2));
  const rx = PX + PW * 0.735, ry = PY + PH / 2;
  const sp = BR * 2 + 0.3, h = sp * Math.cos(Math.PI / 6);
  const rack = [[1],[9,2],[3,8,10],[4,14,11,7],[12,6,15,13,5]];
  for (let r = 0; r < rack.length; r++)
    for (let c = 0; c < rack[r].length; c++)
      balls.push(mkBall(rack[r][c], rx + r * h, ry + (c - r / 2) * sp));
  return balls;
}

export function ballMoving(balls) {
  return balls.some(b => !b.out && (Math.abs(b.vx) > 0.04 || Math.abs(b.vy) > 0.04));
}

/**
 * Advance physics by one sub-step.
 * Returns { pocketed: [{id, px, py}], wallHits: [speed], ballHits: [speed], firstHit: id|null }
 * `primeiroHit` is passed in and updated here so the caller can persist it.
 */
export function step(balls, pockets, layout, primeiroHit) {
  const { PX, PY, PW, PH, BR } = layout;
  const events = { pocketed: [], wallHits: [], ballHits: [], firstHit: primeiroHit };

  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (b.out) continue;
    b.x += b.vx;
    b.y += b.vy;
    const spd0 = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (spd0 > 0.05) b.roll = (b.roll || 0) + spd0 / BR;
    b.vx *= FRIC;
    b.vy *= FRIC;
    if (Math.abs(b.vx) < 0.012) b.vx = 0;
    if (Math.abs(b.vy) < 0.012) b.vy = 0;

    // Pocket check before wall bounce
    let pocketed = false;
    for (let j = 0; j < pockets.length; j++) {
      const p = pockets[j], ddx = b.x - p.x, ddy = b.y - p.y, dr = p.dr || p.r;
      if (ddx * ddx + ddy * ddy < dr * dr) {
        events.pocketed.push({ id: b.id, px: p.x, py: p.y });
        b.out = true; b.vx = 0; b.vy = 0; pocketed = true; break;
      }
    }
    if (pocketed) continue;

    // Wall bounces
    const wallSpd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (b.x - BR < PX) { b.x = PX + BR; b.vx = Math.abs(b.vx) * REST; events.wallHits.push(wallSpd); }
    if (b.x + BR > PX + PW) { b.x = PX + PW - BR; b.vx = -Math.abs(b.vx) * REST; events.wallHits.push(wallSpd); }
    if (b.y - BR < PY) { b.y = PY + BR; b.vy = Math.abs(b.vy) * REST; events.wallHits.push(wallSpd); }
    if (b.y + BR > PY + PH) { b.y = PY + PH - BR; b.vy = -Math.abs(b.vy) * REST; events.wallHits.push(wallSpd); }
  }

  // Ball-ball collisions
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], b2 = balls[j];
      if (a.out || b2.out) continue;
      const dx = b2.x - a.x, dy = b2.y - a.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < BR * 2 && d > 0) {
        if (events.firstHit === null) {
          if (a.id === 0) events.firstHit = b2.id;
          else if (b2.id === 0) events.firstHit = a.id;
        }
        const nx = dx / d, ny = dy / d;
        const spd = (a.vx - b2.vx) * nx + (a.vy - b2.vy) * ny;
        const ov = BR * 2 - d;
        if (spd > 0) {
          events.ballHits.push(spd);
          a.vx -= spd * nx; a.vy -= spd * ny;
          b2.vx += spd * nx; b2.vy += spd * ny;
        }
        a.x -= nx * ov / 2; a.y -= ny * ov / 2;
        b2.x += nx * ov / 2; b2.y += ny * ov / 2;
      }
    }
  }

  return events;
}

/**
 * Run physics until all balls stop or maxSteps is reached.
 * Returns array of all events, and the final balls array (mutated in place).
 */
export function runUntilStop(balls, pockets, layout, primeiroHit, maxSteps = 10000) {
  const allEvents = [];
  let fh = primeiroHit;
  for (let s = 0; s < maxSteps; s++) {
    if (!ballMoving(balls)) break;
    // 4 sub-steps per frame (matching client loop)
    for (let sub = 0; sub < 4; sub++) {
      const ev = step(balls, pockets, layout, fh);
      fh = ev.firstHit;
      if (ev.pocketed.length || ev.wallHits.length || ev.ballHits.length) {
        allEvents.push(ev);
      }
    }
  }
  return { events: allEvents, firstHit: fh };
}
