import { ctx } from '../canvas.js';
import { S } from '../state.js';
import { rr } from '../utils.js';

// ── Background ────────────────────────────────────────────────────────────────

let bgPat = null;
export function initBgPat() {
  const fc = document.createElement('canvas'); fc.width = 32; fc.height = 32;
  const fx = fc.getContext('2d');
  fx.fillStyle = '#05070c'; fx.fillRect(0, 0, 32, 32);
  // Subtle hexagonal grid feel
  fx.strokeStyle = 'rgba(255,255,255,0.018)'; fx.lineWidth = 1;
  fx.beginPath(); fx.moveTo(0, 16); fx.lineTo(32, 16); fx.stroke();
  fx.beginPath(); fx.moveTo(16, 0); fx.lineTo(16, 32); fx.stroke();
  fx.strokeStyle = 'rgba(255,255,255,0.012)'; fx.lineWidth = 0.5;
  fx.beginPath(); fx.moveTo(0, 32); fx.lineTo(32, 0); fx.stroke();
  bgPat = ctx.createPattern(fc, 'repeat');
}

export function drawBg() {
  ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, S.BW, S.BH);
  if (bgPat) { ctx.fillStyle = bgPat; ctx.fillRect(0, 0, S.BW, S.BH); }

  // Soft spotlight from top center (room lighting over table)
  const sg = ctx.createRadialGradient(S.BW / 2, 0, 0, S.BW / 2, S.BH * 0.6, S.BW * 0.55);
  sg.addColorStop(0, 'rgba(50,80,160,0.14)');
  sg.addColorStop(0.4, 'rgba(20,40,90,0.06)');
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, S.BW, S.BH);

  // Floor reflection glow at bottom
  const fg = ctx.createLinearGradient(0, S.BH - 30, 0, S.BH);
  fg.addColorStop(0, 'rgba(0,0,0,0)');
  fg.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = fg; ctx.fillRect(0, S.BH - 30, S.BW, 30);
}

// ── Power bar ─────────────────────────────────────────────────────────────────

export function drawPowerBar() {
  if (S.estado === 'vitoria') return;
  const pbX = S.TX + S.TW - S.FW + 5, pbY = S.TY + 18, pbW = 18, pbH = S.TH - 36;

  ctx.save();
  // Outer panel
  rr(pbX - 3, pbY - 3, pbW + 6, pbH + 6, 14);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.stroke();

  // Bar track
  rr(pbX, pbY, pbW, pbH, pbW / 2); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 0.8; ctx.stroke();

  // Fill
  const fh = pbH * S.power, fy = pbY + pbH - fh;
  ctx.save(); rr(pbX, pbY, pbW, pbH, pbW / 2); ctx.clip();
  const pg = ctx.createLinearGradient(0, fy, 0, fy + fh);
  pg.addColorStop(0, '#ff2828');
  pg.addColorStop(0.3, '#ff9900');
  pg.addColorStop(0.65, '#ffe000');
  pg.addColorStop(1, '#00e060');
  ctx.fillStyle = pg; ctx.fillRect(pbX, fy, pbW, fh);

  // Sheen
  const fs = ctx.createLinearGradient(pbX, 0, pbX + pbW, 0);
  fs.addColorStop(0, 'rgba(255,255,255,0)');
  fs.addColorStop(0.4, 'rgba(255,255,255,0.16)');
  fs.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fs; ctx.fillRect(pbX, fy, pbW, fh);
  ctx.restore();

  // Tick marks
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.2;
  for (let t = 1; t < 4; t++) {
    const ty2 = pbY + pbH * t / 4;
    ctx.beginPath(); ctx.moveTo(pbX + 3, ty2); ctx.lineTo(pbX + pbW - 3, ty2); ctx.stroke();
  }

  // Glow when high power
  if (S.power > 0.7) {
    ctx.save();
    ctx.shadowColor = S.power > 0.9 ? '#ff4040' : '#ffaa00'; ctx.shadowBlur = 14;
    rr(pbX, pbY + pbH - fh, pbW, fh, pbW / 2);
    ctx.strokeStyle = S.power > 0.9 ? 'rgba(255,80,80,0.5)' : 'rgba(255,180,0,0.4)';
    ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = 'rgba(200,200,220,0.5)'; ctx.font = 'bold 8px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('FORCE', pbX + pbW / 2, pbY - 4);
  ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = 'bold 8px Arial';
  ctx.textBaseline = 'top';
  ctx.fillText(Math.round(S.power * 100) + '%', pbX + pbW / 2, pbY + pbH + 3);
  ctx.restore();
}

// ── Victory screen ────────────────────────────────────────────────────────────

export function drawVitoria() {
  // Dark overlay with vignette
  const ov = ctx.createRadialGradient(S.BW / 2, S.BH / 2, 60, S.BW / 2, S.BH / 2, S.BW * 0.7);
  ov.addColorStop(0, 'rgba(0,0,0,0.65)');
  ov.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = ov; ctx.fillRect(0, 0, S.BW, S.BH);

  const pw = 400, ph = 240;
  const px2 = (S.BW - pw) / 2, py2 = (S.BH - ph) / 2;

  // Panel shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 16;
  rr(px2, py2, pw, ph, 20); ctx.fillStyle = 'rgba(0,0,0,0.001)'; ctx.fill();
  ctx.restore();

  // Panel background
  const pg2 = ctx.createLinearGradient(px2, py2, px2, py2 + ph);
  pg2.addColorStop(0, '#1e1430'); pg2.addColorStop(0.5, '#130e22'); pg2.addColorStop(1, '#0c0a18');
  rr(px2, py2, pw, ph, 20); ctx.fillStyle = pg2; ctx.fill();

  // Gold border
  ctx.save();
  ctx.shadowColor = 'rgba(240,180,0,0.6)'; ctx.shadowBlur = 20;
  rr(px2, py2, pw, ph, 20);
  ctx.strokeStyle = 'rgba(240,180,0,0.8)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();

  // Inner gold shimmer line
  const shl = ctx.createLinearGradient(px2, py2, px2 + pw, py2);
  shl.addColorStop(0, 'rgba(240,180,0,0)');
  shl.addColorStop(0.3, 'rgba(240,180,0,0.25)');
  shl.addColorStop(0.7, 'rgba(240,180,0,0.25)');
  shl.addColorStop(1, 'rgba(240,180,0,0)');
  ctx.fillStyle = shl; ctx.fillRect(px2 + 2, py2 + 2, pw - 4, 1);

  // Top bar label
  const tbH = 36;
  const isWin = S.vencedor === 0;
  rr(px2, py2, pw, tbH, 20);
  ctx.beginPath();
  ctx.moveTo(px2 + 20, py2);
  ctx.lineTo(px2 + pw - 20, py2);
  ctx.arcTo(px2 + pw, py2, px2 + pw, py2 + 20, 20);
  ctx.lineTo(px2 + pw, py2 + tbH);
  ctx.lineTo(px2, py2 + tbH);
  ctx.arcTo(px2, py2, px2 + 20, py2, 20);
  ctx.closePath();
  const tbg = ctx.createLinearGradient(px2, py2, px2 + pw, py2);
  if (isWin) {
    tbg.addColorStop(0, '#c47800'); tbg.addColorStop(0.5, '#f0b800'); tbg.addColorStop(1, '#c47800');
  } else {
    tbg.addColorStop(0, '#3a0808'); tbg.addColorStop(0.5, '#6a1010'); tbg.addColorStop(1, '#3a0808');
  }
  ctx.fillStyle = tbg; ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(ph * 0.11)}px Arial`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4;
  ctx.fillText(isWin ? '🏆  VITÓRIA!' : '💀  DERROTA', S.BW / 2, py2 + tbH / 2);
  ctx.shadowBlur = 0;

  // Trophy / skull icon large
  ctx.font = `${Math.round(ph * 0.22)}px Arial`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(isWin ? '🏆' : '💀', S.BW / 2 - 80, py2 + tbH + (ph - tbH) * 0.42);

  // Winner name
  ctx.fillStyle = isWin ? '#f0c040' : '#cc6060';
  ctx.font = `bold ${Math.round(ph * 0.1)}px Arial`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const nameX = S.BW / 2 - 30;
  ctx.fillText(S.players[S.vencedor].name, nameX, py2 + tbH + (ph - tbH) * 0.35);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `${Math.round(ph * 0.082)}px Arial`;
  ctx.fillText('venceu a partida!', nameX, py2 + tbH + (ph - tbH) * 0.55);

  // Prize amount (if bet)
  if (S.betAmount > 0) {
    const prize = `R$ ${(S.betAmount * 2).toFixed(2).replace('.', ',')}`;
    ctx.fillStyle = isWin ? '#00ee88' : 'rgba(255,255,255,0.3)';
    ctx.font = `bold ${Math.round(ph * 0.09)}px Arial`;
    ctx.fillText(isWin ? `Prêmio: ${prize}` : `Perdeu: R$ ${S.betAmount.toFixed(2).replace('.', ',')}`, nameX, py2 + tbH + (ph - tbH) * 0.74);
  }

  // Play again button
  const bw = 200, bh = 44, bx2 = (S.BW - bw) / 2, by2 = py2 + ph - bh - 14;
  ctx.save();
  ctx.shadowColor = 'rgba(240,180,0,0.5)'; ctx.shadowBlur = 16;
  rr(bx2, by2, bw, bh, 22);
  const btg = ctx.createLinearGradient(bx2, by2, bx2, by2 + bh);
  btg.addColorStop(0, '#f0c040'); btg.addColorStop(1, '#c89020');
  ctx.fillStyle = btg; ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#0a0a0c'; ctx.font = `bold ${Math.round(ph * 0.095)}px Arial`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Jogar novamente', S.BW / 2, by2 + bh / 2);

  drawVitoria._bx = bx2; drawVitoria._by = by2; drawVitoria._bw = bw; drawVitoria._bh = bh;
}
