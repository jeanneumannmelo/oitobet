import { ctx } from '../canvas.js';
import { S } from '../state.js';
import { rr } from '../utils.js';
import { drawMiniBall } from './balls.js';

let logoImg = null;
export function initLogoImg() {
  logoImg = new Image();
  logoImg.src = '/oitobet.png';
}

function getPhoto(url) {
  if (!url) return null;
  if (S._photoCache[url]) return S._photoCache[url];
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  S._photoCache[url] = img;
  return img;
}

function drawCircularPhoto(img, cx, cy, r, isActive, playerIdx) {
  ctx.save();
  // Outer glow for active player
  if (isActive) {
    ctx.shadowColor = '#f0c030'; ctx.shadowBlur = 14;
  }
  // Gold or grey ring
  ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
  ctx.strokeStyle = isActive ? '#f0c030' : '#404050';
  ctx.lineWidth = isActive ? 2.5 : 1.5;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // Clip and draw photo or fallback
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = isActive ? '#1a3020' : '#1a1a2a'; ctx.fill();
    ctx.fillStyle = isActive ? '#00d470' : '#6060a0';
    ctx.font = `bold ${Math.round(r * 0.7)}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const name = S.players[playerIdx]?.name || '?';
    ctx.fillText(name[0].toUpperCase(), cx, cy + 1);
  }
  ctx.restore();
}

function drawLevelBadge(x, y, level, isRight) {
  const r = 10;
  // Star background badge
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1420'; ctx.fill();
  ctx.strokeStyle = '#f0c030'; ctx.lineWidth = 1.2; ctx.stroke();
  // Star emoji + level
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f0c030'; ctx.font = 'bold 8px Arial';
  ctx.fillText('★' + level, x, y + 0.5);
  ctx.restore();
}

export function drawHUD() {
  const cx = S.BW / 2;
  const HH = S.HH; // 96

  // Dark gradient bar
  const barGrad = ctx.createLinearGradient(0, 0, 0, HH);
  barGrad.addColorStop(0, '#0a0c14');
  barGrad.addColorStop(1, '#08090f');
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, 0, S.BW, HH);

  // Bottom separator
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, HH - 1, S.BW, 1);

  // Thin active-side accent line at top
  const accentCol = '#f0c030';
  const accentW = S.BW * 0.4;
  const accentX = S.turn === 0 ? 0 : S.BW - accentW;
  const ag = ctx.createLinearGradient(accentX, 0, accentX + accentW, 0);
  ag.addColorStop(0, S.turn === 0 ? accentCol + 'aa' : 'rgba(0,0,0,0)');
  ag.addColorStop(S.turn === 0 ? 1 : 0, S.turn === 1 ? accentCol + 'aa' : 'rgba(0,0,0,0)');
  ctx.fillStyle = ag;
  ctx.fillRect(accentX, 0, accentW, 2);

  // ── CENTER ────────────────────────────────────────────────────────────────
  const tr = 19, timerX = cx, timerY = HH / 2 + 4;

  // Prize badge above timer
  const pbW = 86, pbH = 18, pbX = cx - pbW / 2, pbY = 3;
  rr(pbX, pbY, pbW, pbH, 9);
  if (S.betAmount > 0) {
    const prize = `R$ ${(S.betAmount * 2).toFixed(2).replace('.', ',')}`;
    ctx.fillStyle = 'rgba(240,192,48,0.15)'; ctx.fill();
    rr(pbX, pbY, pbW, pbH, 9);
    ctx.strokeStyle = 'rgba(240,192,48,0.4)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#f0c030'; ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🏆 ' + prize, cx, pbY + pbH / 2);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill();
    rr(pbX, pbY, pbW, pbH, 9);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('FREE', cx, pbY + pbH / 2);
  }

  // Timer ring background
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

  // Message flash below timer
  if (S.msgFlash > 0 && S.msgTxt) {
    const alpha = Math.min(1, S.msgFlash / 20);
    const mc = S.msgTxt.includes('Falta') ? '#ff6060' : S.msgTxt.includes('venceu') ? '#00ee66' : '#ffd040';
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = mc; ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(S.msgTxt, cx, HH - 2);
    ctx.restore();
  }

  // ── LEFT PLAYER (idx=0) ───────────────────────────────────────────────────
  drawPlayerBlock(0);

  // ── RIGHT PLAYER (idx=1) ──────────────────────────────────────────────────
  drawPlayerBlock(1);

  if (S.resignConfirm) drawResignConfirm();
}

function drawPlayerBlock(idx) {
  const HH = S.HH;
  const isRight = idx === 1;
  const act = S.turn === idx;
  const pl = S.players[idx];

  // Layout constants
  const photoR = 26;
  const blockW = (S.BW / 2) - 55; // each side leaves room for center timer

  // Photo center positions
  // Left block: photo at x=50, Right block: photo at x=BW-50
  const photoCX = isRight ? (S.BW - 50) : 50;
  const photoCY = HH / 2 + 2;

  // Load & draw photo
  const photoURL = pl.photoURL || null;
  const img = getPhoto(photoURL);
  drawCircularPhoto(img, photoCX, photoCY, photoR, act, idx);

  // Level badge (outer corner)
  const lvlX = isRight ? (S.BW - 8) : 8;
  const lvlY = HH / 2;
  drawLevelBadge(lvlX, lvlY, pl.level || 1, isRight);

  // Player name above photo
  ctx.save();
  ctx.fillStyle = act ? '#ffffff' : '#808090';
  ctx.font = `bold 10px Arial`;
  ctx.textAlign = isRight ? 'right' : 'left';
  ctx.textBaseline = 'top';
  const nameX = isRight ? photoCX - photoR - 6 : photoCX + photoR + 6;
  // Clip to safe area
  const clipL = isRight ? (S.BW / 2 + 10) : 20;
  const clipW = isRight ? (S.BW - 20 - (S.BW / 2 + 10)) : (S.BW / 2 - 10 - 20);
  ctx.beginPath(); ctx.rect(clipL, 0, clipW, HH); ctx.clip();
  ctx.fillText(pl.name || (idx === 0 ? 'Jogador 1' : 'Jogador 2'), nameX, 6);
  ctx.restore();

  // Pocketed balls row
  const myType = S.tipos[idx];
  const potList = myType === 'solid' ? [1,2,3,4,5,6,7] : myType === 'stripe' ? [9,10,11,12,13,14,15] : [];
  if (potList.length > 0) {
    const ballR = 7;
    const ballSpacing = ballR * 2 + 3;
    const totalBallW = potList.length * ballSpacing - 3;
    // Position: between photo and center, or between level badge and photo
    const rowY = HH - ballR - 6;
    let startX;
    if (isRight) {
      startX = photoCX - photoR - 8 - totalBallW;
    } else {
      startX = photoCX + photoR + 8;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(isRight ? (S.BW / 2 + 10) : 20, 0, isRight ? (S.BW - 20 - (S.BW / 2 + 10)) : (S.BW / 2 - 10 - 20), HH);
    ctx.clip();
    potList.forEach((bid, di) => {
      const dx = startX + di * ballSpacing + ballR;
      const done = S.potJogador[idx].includes(bid);
      drawMiniBall(dx, rowY, ballR, bid, !done);
    });
    ctx.restore();
  }

  // "Sua vez" / bot thinking indicator — small pill above balls row
  if (act && S.estado !== 'rolando') {
    const isBotThink = idx === S.BOT && S.botDelay > 0 && S.botAimPhase === 0;
    const pillW = 72, pillH = 13;
    let pillX, pillY;
    pillY = 5;
    if (isRight) {
      pillX = photoCX - photoR - 8 - pillW;
    } else {
      pillX = photoCX + photoR + 8;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(isRight ? (S.BW / 2 + 10) : 20, 0, isRight ? (S.BW - 20 - (S.BW / 2 + 10)) : (S.BW / 2 - 10 - 20), HH);
    ctx.clip();
    rr(pillX, pillY, pillW, pillH, 6);
    if (isBotThink) {
      ctx.fillStyle = 'rgba(30,30,180,0.8)'; ctx.fill();
      ctx.fillStyle = '#a0b8ff'; ctx.font = 'bold 7px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Pensando' + '.'.repeat(Math.floor(S.tick / 20) % 4), pillX + pillW / 2, pillY + pillH / 2);
    } else if (idx !== S.BOT) {
      const pg = ctx.createLinearGradient(pillX, 0, pillX + pillW, 0);
      pg.addColorStop(0, 'rgba(0,170,70,0.9)'); pg.addColorStop(1, 'rgba(0,210,90,0.95)');
      ctx.fillStyle = pg; ctx.fill();
      ctx.fillStyle = '#c8ffd4'; ctx.font = 'bold 7px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('▶ Sua vez!', pillX + pillW / 2, pillY + pillH / 2);
    }
    ctx.restore();
  }

  // Resign button for player 0 (small, bottom-left)
  if (idx === 0) {
    const canRes = act && (S.estado === 'mira' || S.estado === 'ballInHand');
    const rbW = 44, rbH = 12, rbX = 4, rbY = HH - rbH - 4;
    S.resignBtn.x = rbX; S.resignBtn.y = rbY; S.resignBtn.w = rbW; S.resignBtn.h = rbH;
    rr(rbX, rbY, rbW, rbH, 5);
    ctx.fillStyle = canRes ? 'rgba(160,20,20,0.85)' : 'rgba(50,20,20,0.5)'; ctx.fill();
    ctx.fillStyle = canRes ? '#ffbbbb' : '#664444';
    ctx.font = 'bold 7px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Desistir', rbX + rbW / 2, rbY + rbH / 2);
  }
}

export function drawResignConfirm() {
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
