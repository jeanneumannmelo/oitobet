import { ctx } from '../canvas.js';
import { S } from '../state.js';
import { CUE_CATALOG } from '../cues.js';

export function drawCue() {
  if (S.estado === 'rolando' || S.estado === 'vitoria') return;
  const b = S.balls[0]; if (!b || b.out) return;

  const cue = CUE_CATALOG.find(c => c.id === S.equippedCue) || CUE_CATALOG[0];

  const bx = b.x, by = b.y;
  const dx = Math.cos(S.aimAng), dy = Math.sin(S.aimAng);
  const { BR, PX, PY, PW, PH } = S;

  // ── Aim guide ───────────────────────────────────────────────────────────────
  if (S.estado === 'mira') {
    ctx.save();
    ctx.beginPath(); ctx.rect(PX, PY, PW, PH); ctx.clip();

    // Ghost ball at aim preview point
    const gd = Math.min(PW * 0.45, PH * 0.7);
    let gx = bx + dx * gd, gy = by + dy * gd;
    gx = Math.max(PX + BR + 2, Math.min(PX + PW - BR - 2, gx));
    gy = Math.max(PY + BR + 2, Math.min(PY + PH - BR - 2, gy));

    // Dashed trajectory line — fades out
    const SEGMENTS = 12;
    for (let i = 0; i < SEGMENTS; i++) {
      const t0 = i / SEGMENTS, t1 = (i + 0.55) / SEGMENTS;
      const fadeAlpha = 0.55 * (1 - i / SEGMENTS);
      ctx.beginPath();
      ctx.moveTo(bx + dx * BR + dx * gd * t0, by + dy * BR + dy * gd * t0);
      ctx.lineTo(bx + dx * BR + dx * gd * t1, by + dy * BR + dy * gd * t1);
      ctx.strokeStyle = `rgba(255,255,255,${fadeAlpha})`;
      ctx.lineWidth = 1.2; ctx.lineCap = 'round'; ctx.stroke();
    }

    // Ghost ball — semi-transparent cue-tip colored ball
    const ghg = ctx.createRadialGradient(gx - BR * 0.3, gy - BR * 0.35, 0, gx, gy, BR);
    ghg.addColorStop(0, 'rgba(255,255,255,0.32)');
    ghg.addColorStop(0.5, 'rgba(255,255,255,0.15)');
    ghg.addColorStop(1, 'rgba(255,255,255,0.05)');
    ctx.beginPath(); ctx.arc(gx, gy, BR, 0, Math.PI * 2);
    ctx.fillStyle = ghg; ctx.fill();
    ctx.strokeStyle = cue.colors.tip + '60'; ctx.lineWidth = 1.2; ctx.stroke();

    // Ghost ball highlight
    const ghi = ctx.createRadialGradient(gx - BR * 0.35, gy - BR * 0.4, 0, gx, gy, BR * 0.65);
    ghi.addColorStop(0, 'rgba(255,255,255,0.45)'); ghi.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = ghi; ctx.fill();

    // Second trajectory from ghost ball (continuation line, dimmer)
    const gd2 = Math.min(PW * 0.3, PH * 0.5);
    for (let i = 0; i < 7; i++) {
      const t0 = (i + 1) / 8, t1 = (i + 1.4) / 8;
      ctx.beginPath();
      ctx.moveTo(gx + dx * BR + dx * gd2 * t0, gy + dy * BR + dy * gd2 * t0);
      ctx.lineTo(gx + dx * BR + dx * gd2 * t1, gy + dy * BR + dy * gd2 * t1);
      ctx.strokeStyle = `rgba(255,255,255,${0.18 * (1 - i / 7)})`;
      ctx.lineWidth = 1; ctx.stroke();
    }

    ctx.restore();
  }

  // ── Cue stick ───────────────────────────────────────────────────────────────
  const tipGap  = BR + 3.5 + S.pullBack;
  const cueLen  = 320;
  const tipW    = 2.8;   // half-width at tip (ferrule)
  const buttW   = 10.5;  // half-width at butt

  // Tip position (near ball) and butt position (far)
  const tx = bx - dx * tipGap,       ty = by - dy * tipGap;
  const bux = bx - dx * (tipGap + cueLen), buy = by - dy * (tipGap + cueLen);

  // Perpendicular direction
  const px = -dy, py = dx;

  // Ferrule end (slightly wider band near tip)
  const ferruleLen = 10;
  const fx = tx + dx * ferruleLen, fy = ty + dy * ferruleLen;

  ctx.save();

  // ── Drop shadow ────────────────────────────────────────────────────────────
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 12; ctx.shadowOffsetX = dx * 3 + 2; ctx.shadowOffsetY = dy * 3 + 4;
  ctx.beginPath();
  ctx.moveTo(bux + px * buttW, buy + py * buttW);
  ctx.lineTo(tx  + px * tipW,  ty  + py * tipW);
  ctx.lineTo(tx  - px * tipW,  ty  - py * tipW);
  ctx.lineTo(bux - px * buttW, buy - py * buttW);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.001)'; ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

  // ── Main shaft — clipped trapezoid ─────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(bux + px * buttW, buy + py * buttW);
  ctx.lineTo(fx  + px * tipW,  fy  + py * tipW);
  ctx.lineTo(fx  - px * tipW,  fy  - py * tipW);
  ctx.lineTo(bux - px * buttW, buy - py * buttW);
  ctx.closePath();

  // Wood gradient using cue colors
  const cg = ctx.createLinearGradient(bux, buy, fx, fy);
  cg.addColorStop(0,    cue.colors.butt);
  cg.addColorStop(0.18, cue.colors.mid);
  cg.addColorStop(0.5,  cue.colors.mid);
  cg.addColorStop(0.75, cue.colors.midLight);
  cg.addColorStop(0.97, '#fffaf0');
  ctx.fillStyle = cg; ctx.fill();

  // Cylindrical sheen overlay (perpendicular gradient)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(bux + px * buttW, buy + py * buttW);
  ctx.lineTo(fx  + px * tipW,  fy  + py * tipW);
  ctx.lineTo(fx  - px * tipW,  fy  - py * tipW);
  ctx.lineTo(bux - px * buttW, buy - py * buttW);
  ctx.closePath(); ctx.clip();

  const mx = (bux + fx) / 2, my = (buy + fy) / 2;
  const cyl = ctx.createLinearGradient(
    mx - px * buttW * 1.1, my - py * buttW * 1.1,
    mx + px * buttW * 1.1, my + py * buttW * 1.1
  );
  cyl.addColorStop(0,    'rgba(0,0,0,0.55)');
  cyl.addColorStop(0.22, 'rgba(0,0,0,0.15)');
  cyl.addColorStop(0.42, 'rgba(255,255,255,0.32)');
  cyl.addColorStop(0.58, 'rgba(255,255,255,0.12)');
  cyl.addColorStop(0.78, 'rgba(0,0,0,0.22)');
  cyl.addColorStop(1,    'rgba(0,0,0,0.58)');
  ctx.fillStyle = cyl; ctx.fillRect(-9999, -9999, 19999, 19999);
  ctx.restore();

  // ── Dark edge outline ──────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(bux + px * buttW, buy + py * buttW);
  ctx.lineTo(fx  + px * tipW,  fy  + py * tipW);
  ctx.lineTo(fx  - px * tipW,  fy  - py * tipW);
  ctx.lineTo(bux - px * buttW, buy - py * buttW);
  ctx.closePath();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 0.8; ctx.stroke();

  // ── Decorative inlay panel (mid-section) ──────────────────────────────────
  const inlayT0 = 0.32, inlayT1 = 0.52;
  const inlayFn = t => ({
    x: bux + (fx - bux) * t,
    y: buy + (fy - buy) * t,
    w: buttW + (tipW - buttW) * t,
  });
  const il0 = inlayFn(inlayT0), il1 = inlayFn(inlayT1);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(bux + px * buttW, buy + py * buttW);
  ctx.lineTo(fx  + px * tipW,  fy  + py * tipW);
  ctx.lineTo(fx  - px * tipW,  fy  - py * tipW);
  ctx.lineTo(bux - px * buttW, buy - py * buttW);
  ctx.closePath(); ctx.clip();
  ctx.beginPath();
  ctx.moveTo(il0.x + px * il0.w, il0.y + py * il0.w);
  ctx.lineTo(il1.x + px * il1.w, il1.y + py * il1.w);
  ctx.lineTo(il1.x - px * il1.w, il1.y - py * il1.w);
  ctx.lineTo(il0.x - px * il0.w, il0.y - py * il0.w);
  ctx.closePath();
  const ig = ctx.createLinearGradient(il0.x - px * il0.w, il0.y - py * il0.w, il0.x + px * il0.w, il0.y + py * il0.w);
  ig.addColorStop(0,   'rgba(0,0,0,0.5)');
  ig.addColorStop(0.2, cue.colors.rings[0] + 'aa');
  ig.addColorStop(0.5, cue.colors.rings[1] + 'cc');
  ig.addColorStop(0.8, cue.colors.rings[0] + 'aa');
  ig.addColorStop(1,   'rgba(0,0,0,0.5)');
  ctx.fillStyle = ig; ctx.fill();
  ctx.restore();

  // ── Wrap rings near butt end ───────────────────────────────────────────────
  const ringPositions = [0.055, 0.095, 0.14, 0.185, 0.225, 0.265, 0.305];
  ringPositions.forEach((t, i) => {
    const w = buttW + (tipW - buttW) * t;
    const rX = bux + (fx - bux) * t;
    const rY = buy + (fy - buy) * t;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(rX + px * (w + 3), rY + py * (w + 3));
    ctx.lineTo(rX - px * (w + 3), rY - py * (w + 3));
    ctx.strokeStyle = i % 2 === 0 ? cue.colors.rings[0] : cue.colors.rings[1];
    ctx.lineWidth = i < 2 ? 5 : 3.5 - i * 0.3;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  });

  // ── Grip texture (hatched lines on lower butt) ─────────────────────────────
  const gripT0 = 0.54, gripT1 = 0.80;
  const gp0 = inlayFn(gripT0), gp1 = inlayFn(gripT1);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(bux + px * buttW, buy + py * buttW);
  ctx.lineTo(fx  + px * tipW,  fy  + py * tipW);
  ctx.lineTo(fx  - px * tipW,  fy  - py * tipW);
  ctx.lineTo(bux - px * buttW, buy - py * buttW);
  ctx.closePath(); ctx.clip();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 1.2;
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = gripT0 + (gripT1 - gripT0) * (i / steps);
    const {x: rx, y: ry, w: rw} = inlayFn(t);
    ctx.beginPath();
    ctx.moveTo(rx + px * rw, ry + py * rw);
    ctx.lineTo(rx - px * rw, ry - py * rw);
    ctx.stroke();
  }
  ctx.restore();

  // ── Ferrule (white band near tip) ─────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(fx  + px * tipW * 1.1, fy  + py * tipW * 1.1);
  ctx.lineTo(tx  + px * tipW * 1.1, ty  + py * tipW * 1.1);
  ctx.lineTo(tx  - px * tipW * 1.1, ty  - py * tipW * 1.1);
  ctx.lineTo(fx  - px * tipW * 1.1, fy  - py * tipW * 1.1);
  ctx.closePath();
  const fg = ctx.createLinearGradient(
    tx - px * tipW, ty - py * tipW,
    tx + px * tipW, ty + py * tipW
  );
  fg.addColorStop(0, '#b8b8b0'); fg.addColorStop(0.3, '#ffffff'); fg.addColorStop(0.7, '#f0f0e8'); fg.addColorStop(1, '#888880');
  ctx.fillStyle = fg; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.6; ctx.stroke();

  // ── Leather tip (colored chalk) ───────────────────────────────────────────
  const tipRadius = tipW * 1.05;
  const tipCenter = { x: tx, y: ty };
  ctx.beginPath(); ctx.arc(tipCenter.x, tipCenter.y, tipRadius, 0, Math.PI * 2);
  const tg = ctx.createRadialGradient(
    tipCenter.x - tipRadius * 0.3, tipCenter.y - tipRadius * 0.3, 0,
    tipCenter.x, tipCenter.y, tipRadius
  );
  // Lighten tip color for highlight
  tg.addColorStop(0, cue.colors.tip + 'ee');
  tg.addColorStop(0.5, cue.colors.tip);
  tg.addColorStop(1, cue.colors.tip + '88');
  ctx.fillStyle = tg; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.7; ctx.stroke();

  // Chalk dust highlight on tip
  ctx.beginPath(); ctx.arc(tipCenter.x - tipRadius * 0.25, tipCenter.y - tipRadius * 0.3, tipRadius * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();

  // ── Butt end cap ──────────────────────────────────────────────────────────
  ctx.beginPath(); ctx.arc(bux, buy, buttW, 0, Math.PI * 2);
  const bg = ctx.createRadialGradient(bux - buttW * 0.3, buy - buttW * 0.3, 0, bux, buy, buttW);
  bg.addColorStop(0, cue.colors.mid); bg.addColorStop(0.6, cue.colors.butt); bg.addColorStop(1, '#100800');
  ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = 'rgba(200,140,60,0.4)'; ctx.lineWidth = 1; ctx.stroke();
  // Butt cap shine
  ctx.beginPath(); ctx.arc(bux - buttW * 0.28, buy - buttW * 0.3, buttW * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,200,120,0.28)'; ctx.fill();

  ctx.restore();
}
