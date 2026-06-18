import { ctx } from '../canvas.js';
import { S } from '../state.js';
import { rr } from '../utils.js';

let logoImg = null;
export function initLogoImg() {
  logoImg = new Image();
  logoImg.src = '/oitobet.png';
}

export function drawHUD() {
  const cx = S.BW / 2;

  // Solid dark bar
  ctx.fillStyle = '#08090f';
  ctx.fillRect(0, 0, S.BW, S.HH);

  // Thin active-side accent line at top
  const accentCol = S.turn === 0 ? '#00d470' : '#4da6ff';
  const accentW = S.BW * 0.38;
  const accentX = S.turn === 0 ? 0 : S.BW - accentW;
  const ag = ctx.createLinearGradient(accentX, 0, accentX + accentW, 0);
  ag.addColorStop(0, S.turn === 0 ? accentCol + '88' : 'rgba(0,0,0,0)');
  ag.addColorStop(S.turn === 0 ? 1 : 0, S.turn === 1 ? accentCol + '88' : 'rgba(0,0,0,0)');
  ctx.fillStyle = ag;
  ctx.fillRect(accentX, 0, accentW, 2);

  // Bottom separator
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, S.HH - 1, S.BW, 1);

  // ── CENTER ────────────────────────────────────────────────────────────────
  const tr = 19, timerX = cx, timerY = S.HH / 2;

  // Prize label above timer (if real bet)
  if (S.betAmount > 0) {
    const prize = `R$ ${(S.betAmount * 2).toFixed(2).replace('.', ',')}`;
    const pbW = 80, pbH = 16, pbX = cx - pbW / 2, pbY = 3;
    rr(pbX, pbY, pbW, pbH, 8);
    ctx.fillStyle = 'rgba(0,212,112,0.15)'; ctx.fill();
    rr(pbX, pbY, pbW, pbH, 8);
    ctx.strokeStyle = 'rgba(0,212,112,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#00d470'; ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🏆 ' + prize, cx, pbY + pbH / 2);
  }

  // Timer ring
  ctx.beginPath(); ctx.arc(timerX, timerY, tr + 2, 0, Math.PI * 2);
  ctx.fillStyle = '#04050c'; ctx.fill();

  ctx.beginPath(); ctx.arc(timerX, timerY, tr, -Math.PI * .5, Math.PI * 1.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();

  const tPct = S.timerFrames / S.TIMER_MAX;
  const tc = tPct > .55 ? '#00d470' : tPct > .28 ? '#ffaa00' : '#ff4040';
  ctx.beginPath(); ctx.arc(timerX, timerY, tr, -Math.PI * .5, -Math.PI * .5 + Math.PI * 2 * tPct);
  ctx.save(); ctx.shadowColor = tc; ctx.shadowBlur = 8;
  ctx.strokeStyle = tc; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(Math.ceil(S.timerFrames / 60), timerX, timerY + 1);

  // Message flash (below timer)
  if (S.msgFlash > 0 && S.msgTxt) {
    const alpha = Math.min(1, S.msgFlash / 20);
    const mc = S.msgTxt.includes('Falta') ? '#ff6060' : S.msgTxt.includes('venceu') ? '#00ee66' : '#ffd040';
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = mc; ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(S.msgTxt, cx, S.HH - 2);
    ctx.restore();
  }

  // ── PLAYER SIDES ──────────────────────────────────────────────────────────
  const centerGap = (tr + 2) * 2 + 16;
  const sideW = (S.BW - centerGap) / 2 - 8;
  drawPlayerSide(8, sideW, 0);
  drawPlayerSide(S.BW - 8 - sideW, sideW, 1);

  if (S.resignConfirm) drawResignConfirm();
}

function drawPlayerSide(x, w, idx) {
  const pl = S.players[idx], act = S.turn === idx, isRight = idx === 1;
  const myType = S.tipos[idx];
  const cy = S.HH / 2;

  // Avatar
  const avR = 16;
  const avX = isRight ? x + w - avR - 2 : x + avR + 2;
  const avY = cy;

  // Glow ring when active
  if (act) {
    ctx.save();
    ctx.shadowColor = idx === 0 ? '#00d470' : '#4da6ff'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(avX, avY, avR + 2, 0, Math.PI * 2);
    ctx.strokeStyle = idx === 0 ? '#00d470' : '#4da6ff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }

  // Avatar circle
  ctx.beginPath(); ctx.arc(avX, avY, avR, 0, Math.PI * 2);
  ctx.fillStyle = act ? (idx === 0 ? '#0d2e1c' : '#0d1a30') : '#111122'; ctx.fill();

  // Person silhouette
  ctx.save(); ctx.beginPath(); ctx.arc(avX, avY, avR, 0, Math.PI * 2); ctx.clip();
  const silCol = act ? (idx === 0 ? 'rgba(0,200,100,0.65)' : 'rgba(80,160,255,0.65)') : 'rgba(120,110,180,0.4)';
  ctx.beginPath(); ctx.arc(avX, avY - avR * .16, avR * .28, 0, Math.PI * 2); ctx.fillStyle = silCol; ctx.fill();
  ctx.beginPath(); ctx.arc(avX, avY + avR * .82, avR * .52, Math.PI, 0); ctx.fillStyle = silCol; ctx.fill();
  ctx.restore();

  // Text bounds
  const gap = 8;
  const tX  = isRight ? avX - avR - gap : avX + avR + gap;
  const tDir = isRight ? 'right' : 'left';
  const clipL = isRight ? x : tX;
  const clipW = isRight ? tX - x : x + w - tX;

  // Resign button (player 0 only, compact)
  if (idx === 0) {
    const canRes = act && (S.estado === 'mira' || S.estado === 'ballInHand');
    const rbW = 46, rbH = 13, rbX = isRight ? x : x + w - rbW, rbY = 5;
    S.resignBtn.x = rbX; S.resignBtn.y = rbY; S.resignBtn.w = rbW; S.resignBtn.h = rbH;
    rr(rbX, rbY, rbW, rbH, 6);
    ctx.fillStyle = canRes ? 'rgba(160,20,20,0.85)' : 'rgba(50,20,20,0.5)'; ctx.fill();
    ctx.fillStyle = canRes ? '#ffbbbb' : '#664444';
    ctx.font = 'bold 7px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Desistir', rbX + rbW / 2, rbY + rbH / 2);
  }

  // Player name
  ctx.save();
  ctx.beginPath(); ctx.rect(clipL, 0, clipW, S.HH); ctx.clip();
  ctx.fillStyle = act ? '#ffffff' : '#707090';
  ctx.font = `bold 11px Arial`; ctx.textAlign = tDir; ctx.textBaseline = 'top';
  ctx.fillText(pl.flag + ' ' + pl.name, tX, 7);
  ctx.restore();

  // Ball type + turn indicator row
  const rowY = 26, rowH = 13;

  if (act && S.estado !== 'rolando') {
    const isBotThink = idx === S.BOT && S.botDelay > 0 && S.botAimPhase === 0;
    const pillW = 76;
    const pillX = isRight ? tX - pillW : tX;
    rr(pillX, rowY, pillW, rowH, 6);
    if (isBotThink) {
      ctx.fillStyle = 'rgba(30,30,180,0.75)'; ctx.fill();
      ctx.fillStyle = '#a0b8ff'; ctx.font = 'bold 7px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Pensando' + '.'.repeat(Math.floor(S.tick / 20) % 4), pillX + pillW / 2, rowY + rowH / 2);
    } else if (idx !== S.BOT) {
      const pg = ctx.createLinearGradient(pillX, 0, pillX + pillW, 0);
      pg.addColorStop(0, 'rgba(0,170,70,0.9)'); pg.addColorStop(1, 'rgba(0,210,90,0.95)');
      ctx.fillStyle = pg; ctx.fill();
      ctx.fillStyle = '#c8ffd4'; ctx.font = 'bold 7px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('▶ Sua vez!', pillX + pillW / 2, rowY + rowH / 2);
    }
  } else {
    // Ball type badge
    const myTxt = myType === 'solid' ? 'Sólidas' : myType === 'stripe' ? 'Listradas' : 'Mesa livre';
    const myCol = myType === 'solid' ? 'rgba(160,90,0,0.75)' : myType === 'stripe' ? 'rgba(50,35,130,0.75)' : 'rgba(20,35,60,0.65)';
    const btW = 60, btH = rowH;
    const btX = isRight ? tX - btW : tX;
    rr(btX, rowY, btW, btH, 6); ctx.fillStyle = myCol; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = 'bold 7px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(myTxt, btX + btW / 2, rowY + btH / 2);
  }

  // Progress dots (compact row at bottom)
  const potList = myType === 'solid' ? [1,2,3,4,5,6,7] : myType === 'stripe' ? [9,10,11,12,13,14,15] : [];
  if (potList.length > 0) {
    const dr = 4, dg = 3, dotW = 7 * (dr * 2) + 6 * dg;
    const dotY = S.HH - 10;
    const dotX0 = isRight ? tX - dotW : tX;
    potList.forEach((bid, di) => {
      const dx = dotX0 + di * (dr * 2 + dg) + dr;
      const done = S.potJogador[idx].includes(bid);
      ctx.beginPath(); ctx.arc(dx, dotY, dr, 0, Math.PI * 2);
      if (done) {
        ctx.fillStyle = idx === 0 ? '#00d470' : '#4da6ff'; ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
      }
    });
  }
}

function drawResignConfirm() {
  ctx.fillStyle = 'rgba(0,0,10,0.85)'; ctx.fillRect(0, 0, S.BW, S.BH);
  const bw = 260, bh = 62, bx = Math.round(S.BW / 2 - bw / 2), by = Math.round(S.BH / 2 - bh / 2);
  rr(bx, by, bw, bh, 14);
  ctx.fillStyle = '#111120'; ctx.fill();
  rr(bx, by, bw, bh, 14); ctx.strokeStyle = 'rgba(200,40,40,0.65)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Desistir da partida?', bx + bw / 2, by + 18);
  const sW = 108, sH = 24, sY = by + bh - sH - 10, gap = 12;
  const simX = bx + bw / 2 - sW - gap / 2, naoX = bx + bw / 2 + gap / 2;
  S.resignBtn.simX = simX; S.resignBtn.simY = sY; S.resignBtn.simW = sW; S.resignBtn.simH = sH;
  rr(simX, sY, sW, sH, 12); ctx.fillStyle = 'rgba(190,25,25,0.94)'; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Sim, desistir', simX + sW / 2, sY + sH / 2);
  S.resignBtn.naoX = naoX; S.resignBtn.naoY = sY; S.resignBtn.naoW = sW; S.resignBtn.naoH = sH;
  rr(naoX, sY, sW, sH, 12); ctx.fillStyle = 'rgba(22,108,22,0.9)'; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Cancelar', naoX + sW / 2, sY + sH / 2);
}
