import { ctx } from '../canvas.js';
import { S, BHEX } from '../state.js';
import { lighter, darker } from '../utils.js';

export function drawBall(b) {
  if (b.out) return;
  const { x, y, id } = b;
  const r = S.BR;
  const hex = BHEX[id] || '#888', stripe = id >= 9, cue = id === 0;

  // Ownership glow ring
  if (!cue && id !== 8 && S.tipos[0] !== null) {
    const isStripe = id >= 9;
    const humanHas = (S.tipos[0] === 'solid' && !isStripe) || (S.tipos[0] === 'stripe' && isStripe);
    ctx.save();
    const glowCol = humanHas ? '#ffd000' : '#4da6ff';
    ctx.shadowColor = glowCol; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(x, y, r + 3.5, 0, Math.PI * 2);
    ctx.strokeStyle = humanHas ? 'rgba(255,210,0,0.95)' : 'rgba(77,166,255,0.95)';
    ctx.lineWidth = 2.5; ctx.stroke();
    ctx.globalAlpha = 0.28; ctx.lineWidth = 7; ctx.stroke();
    ctx.restore();
  }

  ctx.save();

  // ── Drop shadow (deeper, offset more for 3D) ─────────────────────────────
  const sh = ctx.createRadialGradient(x + r * 0.25, y + r * 0.55, 0, x + r * 0.2, y + r * 0.5, r * 1.4);
  sh.addColorStop(0, 'rgba(0,0,0,0.65)');
  sh.addColorStop(0.5, 'rgba(0,0,0,0.25)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath(); ctx.arc(x + r * 0.22, y + r * 0.48, r * 1.35, 0, Math.PI * 2);
  ctx.fillStyle = sh; ctx.fill();

  // ── Ball base ─────────────────────────────────────────────────────────────
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (cue) {
    const cg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 0, x, y, r);
    cg.addColorStop(0, '#ffffff');
    cg.addColorStop(0.4, '#f0f0f0');
    cg.addColorStop(0.85, '#d8d8d8');
    cg.addColorStop(1, '#b8b8b8');
    ctx.fillStyle = cg;
  } else if (stripe) {
    ctx.fillStyle = '#f3f3f3';
  } else {
    const bg = ctx.createRadialGradient(x - r * 0.28, y - r * 0.32, 0, x, y, r);
    bg.addColorStop(0, lighter(hex, 58));
    bg.addColorStop(0.42, hex);
    bg.addColorStop(0.82, darker(hex, 38));
    bg.addColorStop(1, darker(hex, 62));
    ctx.fillStyle = bg;
  }
  ctx.fill();

  // Rolling rotation values
  const rollAng = b.roll || 0;
  const moveAng = (b.vx || b.vy) ? Math.atan2(b.vy, b.vx) : 0;

  // ── Stripe band ───────────────────────────────────────────────────────────
  if (stripe) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(moveAng + rollAng); ctx.translate(-x, -y);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    const sg = ctx.createRadialGradient(x - r * 0.28, y - r * 0.32, 0, x, y, r);
    sg.addColorStop(0, lighter(hex, 58));
    sg.addColorStop(0.42, hex);
    sg.addColorStop(0.82, darker(hex, 38));
    sg.addColorStop(1, darker(hex, 62));
    ctx.fillStyle = sg; ctx.fillRect(x - r, y - r * 0.46, r * 2, r * 0.92);
    ctx.restore();
  }

  // ── Number circle (white disc) ─────────────────────────────────────────────
  if (!cue) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(moveAng + rollAng); ctx.translate(-x, -y);
    ctx.beginPath(); ctx.arc(x, y, r * 0.44, 0, Math.PI * 2);
    // White disc with subtle 3D shading
    const dg = ctx.createRadialGradient(x - r * 0.12, y - r * 0.12, 0, x, y, r * 0.44);
    dg.addColorStop(0, 'rgba(255,255,255,0.98)');
    dg.addColorStop(0.7, 'rgba(248,248,248,0.97)');
    dg.addColorStop(1, 'rgba(235,235,235,0.96)');
    ctx.fillStyle = dg; ctx.fill();
    ctx.fillStyle = id === 8 ? '#f5f5f5' : '#111';
    ctx.font = `bold ${Math.round(r * 0.68)}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(id, x, y + 0.5);
    ctx.restore();
  }

  // ── Outline ───────────────────────────────────────────────────────────────
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.7; ctx.stroke();

  // ── Primary specular (top-left, strong) ───────────────────────────────────
  const hi = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, 0, x - r * 0.1, y - r * 0.12, r * 0.72);
  hi.addColorStop(0, 'rgba(255,255,255,0.92)');
  hi.addColorStop(0.32, 'rgba(255,255,255,0.38)');
  hi.addColorStop(0.65, 'rgba(255,255,255,0.08)');
  hi.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = hi; ctx.fill();

  // ── Secondary specular (bottom-right, subtle rim light) ───────────────────
  const hi2 = ctx.createRadialGradient(x + r * 0.32, y + r * 0.35, 0, x + r * 0.32, y + r * 0.35, r * 0.28);
  hi2.addColorStop(0, 'rgba(255,255,255,0.20)');
  hi2.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hi2; ctx.fill();

  ctx.restore();
}

export function drawMiniBall(x, y, r, id, dimmed) {
  const hex = BHEX[id] || '#888', stripe = id >= 9;
  ctx.save();
  if (dimmed) ctx.globalAlpha = 0.2;

  // Shadow
  ctx.beginPath(); ctx.arc(x + r * 0.2, y + r * 0.4, r * 1.1, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();

  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (stripe) {
    ctx.fillStyle = '#f3f3f3'; ctx.fill();
    ctx.save(); ctx.clip();
    const sg = ctx.createRadialGradient(x - r * 0.22, y - r * 0.24, 0, x, y, r);
    sg.addColorStop(0, lighter(hex, 50)); sg.addColorStop(0.5, hex); sg.addColorStop(1, darker(hex, 50));
    ctx.fillStyle = sg; ctx.fillRect(x - r, y - r * 0.45, r * 2, r * 0.9); ctx.restore();
  } else {
    const bg = ctx.createRadialGradient(x - r * 0.28, y - r * 0.32, 0, x, y, r);
    bg.addColorStop(0, lighter(hex, 55)); bg.addColorStop(0.5, hex); bg.addColorStop(1, darker(hex, 55));
    ctx.fillStyle = bg; ctx.fill();
  }
  // Highlight
  const hi = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 0, x, y, r);
  hi.addColorStop(0, 'rgba(255,255,255,0.8)'); hi.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hi; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.lineWidth = 0.6; ctx.stroke();
  ctx.restore();
}
