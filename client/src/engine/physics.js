// Client-side physics — same logic as shared/physics.js but reads from S and triggers audio.
import { S } from '../state.js';
import { throttledBall, throttledWall, sndPocket } from '../audio/sounds.js';

const FRIC = 0.9940;
const REST = 0.84;

export function step() {
  const { balls, POCKETS, PX, PY, PW, PH, BR } = S;

  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (b.out) continue;
    b.x += b.vx; b.y += b.vy;
    const spd0 = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (spd0 > 0.05) b.roll = (b.roll || 0) + spd0 / BR;
    b.vx *= FRIC; b.vy *= FRIC;
    if (Math.abs(b.vx) < 0.012) b.vx = 0;
    if (Math.abs(b.vy) < 0.012) b.vy = 0;

    // Pocket check before wall bounce
    let pocketed = false;
    for (let j = 0; j < POCKETS.length; j++) {
      const p = POCKETS[j], ddx = b.x - p.x, ddy = b.y - p.y, dr = p.dr || p.r;
      if (ddx * ddx + ddy * ddy < dr * dr) {
        if (S.estado === 'rolando') S.potTurno.push(b.id);
        sndPocket();
        S.netAnims.push({ x: p.x, y: p.y, t: 0 });
        b.out = true; b.vx = 0; b.vy = 0; pocketed = true; break;
      }
    }
    if (pocketed) continue;

    // Wall bounces
    const wallSpd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (b.x - BR < PX) { b.x = PX + BR; b.vx = Math.abs(b.vx) * REST; if (wallSpd > 0.5) throttledWall(wallSpd); }
    if (b.x + BR > PX + PW) { b.x = PX + PW - BR; b.vx = -Math.abs(b.vx) * REST; if (wallSpd > 0.5) throttledWall(wallSpd); }
    if (b.y - BR < PY) { b.y = PY + BR; b.vy = Math.abs(b.vy) * REST; if (wallSpd > 0.5) throttledWall(wallSpd); }
    if (b.y + BR > PY + PH) { b.y = PY + PH - BR; b.vy = -Math.abs(b.vy) * REST; if (wallSpd > 0.5) throttledWall(wallSpd); }
  }

  // Ball-ball collisions
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], b2 = balls[j];
      if (a.out || b2.out) continue;
      const dx = b2.x - a.x, dy = b2.y - a.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < BR * 2 && d > 0) {
        if (S.estado === 'rolando' && S.primeiroHit === null) {
          if (a.id === 0) S.primeiroHit = b2.id;
          else if (b2.id === 0) S.primeiroHit = a.id;
        }
        const nx = dx / d, ny = dy / d;
        const spd = (a.vx - b2.vx) * nx + (a.vy - b2.vy) * ny;
        const ov = BR * 2 - d;
        if (spd > 0) {
          throttledBall(spd);
          a.vx -= spd * nx; a.vy -= spd * ny;
          b2.vx += spd * nx; b2.vy += spd * ny;
        }
        a.x -= nx * ov / 2; a.y -= ny * ov / 2;
        b2.x += nx * ov / 2; b2.y += ny * ov / 2;
      }
    }
  }
}
