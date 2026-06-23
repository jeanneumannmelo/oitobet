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
  if (isActive) { ctx.shadowColor = '#f0c030'; ctx.shadowBlur = 16; }
  ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
  ctx.strokeStyle = isActive ? '#f0c030' : '#303040';
  ctx.lineWidth = isActive ? 2.5 : 1.5;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = isActive ? '#1a2a20' : '#161620'; ctx.fill();
    ctx.fillStyle = isActive ? '#f0c030' : '#5050a0';
    ctx.font = `bold ${Math.round(r * 0.72)}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((S.players[playerIdx]?.name || '?')[0].toUpperCase(), cx, cy + 1);
  }
  ctx.restore();
}

export function drawHUD() {
  const cx = S.BW / 2;
  const HH = S.HH; // 96

  // Background
  const barGrad = ctx.createLinearGradient(0, 0, 0, HH);
  barGrad.addColorStop(0, '#0c0e18');
  barGrad.addColorStop(1, '#080910');
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, 0, S.BW, HH);

  // Active side background wash
  if (S.estado !== 'vitoria') {
    const side = S.turn;
    const wash = ctx.createLinearGradient(side === 0 ? 0 : S.BW, 0, side === 0 ? S.BW * 0.55 : S.BW * 0.45, 0);
    wash.addColorStop(0, 'rgba(240,180,0,0.07)');
    wash.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, S.BW, HH);
  }

  // Bottom separator
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(0, HH - 1, S.BW, 1);

  // Thin accent line at top for active side
  const accentW = S.BW * 0.42;
  const accentX = S.turn === 0 ? 0 : S.BW - accentW;
  const pulse = 0.7 + 0.3 * Math.sin(S.tick * 0.07);
  const ag = ctx.createLinearGradient(accentX, 0, accentX + accentW, 0);
  if (S.turn === 0) {
    ag.addColorStop(0, `rgba(240,180,0,${pulse})`);
    ag.addColorStop(1, 'rgba(0,0,0,0)');
  } else {
    ag.addColorStop(0, 'rgba(0,0,0,0)');
    ag.addColorStop(1, `rgba(240,180,0,${pulse})`);
  }
  ctx.fillStyle = ag;
  ctx.fillRect(accentX, 0, accentW, 2);

  // ── CENTER ────────────────────────────────────────────────────────────────
  const centerW = 110;
  const centerX = cx - centerW / 2;

  // Prize / mode badge (top center)
  const pbW = 118, pbH = 20, pbX = cx - pbW / 2, pbY = 3;
  if (S.betAmount > 0) {
    const prize = `🏆  R$ ${(S.betAmount * 2).toFixed(2).replace('.', ',')}`;
    rr(pbX, pbY, pbW, pbH, 10);
    const pg = ctx.createLinearGradient(pbX, pbY, pbX + pbW, pbY);
    pg.addColorStop(0, 'rgba(160,100,0,0.25)');
    pg.addColorStop(0.5, 'rgba(240,180,0,0.3)');
    pg.addColorStop(1, 'rgba(160,100,0,0.25)');
    ctx.fillStyle = pg; ctx.fill();
    rr(pbX, pbY, pbW, pbH, 10);
    ctx.strokeStyle = 'rgba(240,180,0,0.55)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#f0c030'; ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(prize, cx, pbY + pbH / 2);
  } else {
    rr(pbX, pbY, pbW, pbH, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fill();
    rr(pbX, pbY, pbW, pbH, 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('MODO LIVRE', cx, pbY + pbH / 2);
  }

  // Timer ring
  const tr = 21, timerX = cx, timerY = HH / 2 + 10;

  ctx.beginPath(); ctx.arc(timerX, timerY, tr + 3, 0, Math.PI * 2);
  ctx.fillStyle = '#050609'; ctx.fill();

  ctx.beginPath(); ctx.arc(timerX, timerY, tr, -Math.PI * 0.5, Math.PI * 1.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();

  const tPct = S.timerFrames / S.TIMER_MAX;
  const tc = tPct > 0.55 ? '#00d470' : tPct > 0.28 ? '#ffaa00' : '#ff4040';
  ctx.beginPath();
  ctx.arc(timerX, timerY, tr, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * tPct);
  ctx.save(); ctx.shadowColor = tc; ctx.shadowBlur = 10;
  ctx.strokeStyle = tc; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(Math.ceil(S.timerFrames / 60), timerX, timerY + 1);

  // Message flash
  if (S.msgFlash > 0 && S.msgTxt) {
    const alpha = Math.min(1, S.msgFlash / 20);
    const mc = S.msgTxt.includes('Falta') ? '#ff6060' : S.msgTxt.includes('venceu') ? '#00ee66' : '#ffd040';
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = mc; ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(S.msgTxt, cx, HH - 2);
    ctx.restore();
  }

  // ── PLAYERS ───────────────────────────────────────────────────────────────
  drawPlayerBlock(0);
  drawPlayerBlock(1);

  if (S.resignConfirm) drawResignConfirm();
}

function drawPlayerBlock(idx) {
  const HH = S.HH;
  const isRight = idx === 1;
  const act = S.turn === idx;
  const pl = S.players[idx] || {};

  const photoR = 30;
  const photoCX = isRight ? S.BW - 46 : 46;
  const photoCY = Math.round(HH / 2) + 2;

  const img = getPhoto(pl.photoURL || null);
  drawCircularPhoto(img, photoCX, photoCY, photoR, act, idx);

  // Level badge pinned to bottom corner of photo
  const lvlBR = 11;
  const lvlX = isRight ? photoCX - photoR + lvlBR - 2 : photoCX + photoR - lvlBR + 2;
  const lvlY = photoCY + photoR - lvlBR + 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(lvlX, lvlY, lvlBR, 0, Math.PI * 2);
  ctx.fillStyle = '#0e0c1a'; ctx.fill();
  ctx.strokeStyle = act ? '#f0c030' : '#404055'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = act ? '#f0c030' : '#808090'; ctx.font = 'bold 8px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(pl.level || 1, lvlX, lvlY + 0.5);
  ctx.restore();

  // Text area clipped to player's half
  const textX   = isRight ? photoCX - photoR - 10 : photoCX + photoR + 10;
  const tAlign  = isRight ? 'right' : 'left';
  const clipX   = isRight ? S.BW / 2 + 6 : 2;
  const clipW   = isRight ? S.BW - 6 - (S.BW / 2 + 6) : S.BW / 2 - 6 - 2;

  ctx.save();
  ctx.beginPath(); ctx.rect(clipX, 0, clipW, HH); ctx.clip();

  // Name
  ctx.fillStyle = act ? '#ffffff' : '#808098';
  ctx.font = `bold 11px Arial`;
  ctx.textAlign = tAlign; ctx.textBaseline = 'top';
  ctx.fillText(pl.name || (idx === 0 ? 'Jogador' : 'Bot'), textX, 7);

  // Level label + wins
  const statsText = `Nv.${pl.level || 1}  ·  ${pl.wins || 0} vitórias`;
  ctx.fillStyle = act ? '#c8a020' : '#50505f';
  ctx.font = '8.5px Arial';
  ctx.textAlign = tAlign; ctx.textBaseline = 'top';
  ctx.fillText(statsText, textX, 22);

  // Ball type indicator (once assigned)
  const myType = S.tipos[idx];
  if (myType) {
    const label = myType === 'solid' ? '● Sólidas' : '◑ Listradas';
    const color = myType === 'solid' ? '#ffcc44' : '#ff7055';
    ctx.fillStyle = act ? color : 'rgba(200,150,60,0.45)';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = tAlign; ctx.textBaseline = 'top';
    ctx.fillText(label, textX, 37);
  }

  // XP bar
  const barMaxW = Math.min(148, clipW - 10);
  const barW = barMaxW;
  const barH  = 5;
  const barY  = 50;
  const barX  = isRight ? textX - barW : textX;
  const xpPct = Math.min(1, (pl.xp || 0) / 100);

  rr(barX, barY, barW, barH, 2.5);
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill();
  if (xpPct > 0) {
    rr(barX, barY, barW * xpPct, barH, 2.5);
    const bfg = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    bfg.addColorStop(0, act ? '#c87000' : '#303040');
    bfg.addColorStop(1, act ? '#f0c030' : '#484858');
    ctx.fillStyle = bfg; ctx.fill();
  }
  ctx.fillStyle = act ? 'rgba(240,180,0,0.4)' : 'rgba(100,100,120,0.35)';
  ctx.font = '7px Arial';
  ctx.textAlign = isRight ? 'right' : 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`XP ${pl.xp || 0}/100`, isRight ? barX : barX + barW, barY + 7);

  // Pocketed balls row
  const potList = myType === 'solid'  ? [1,2,3,4,5,6,7]
                : myType === 'stripe' ? [9,10,11,12,13,14,15]
                : [];
  if (potList.length > 0) {
    const ballR = 6;
    const spc   = ballR * 2 + 2;
    const rowY  = HH - ballR - 5;
    const startX = isRight ? textX - potList.length * spc : textX;
    potList.forEach((bid, di) => {
      const done = S.potJogador[idx].includes(bid);
      drawMiniBall(startX + di * spc + ballR, rowY, ballR, bid, !done);
    });
  }

  // Turn indicator — animated glowing line at top of block
  if (act && S.estado !== 'rolando' && S.estado !== 'vitoria') {
    const isBotThink = idx === S.BOT && S.botDelay > 0 && S.botAimPhase === 0;
    const lineX = isRight ? S.BW / 2 : 0;
    const lineW = S.BW / 2;
    const glow  = 0.7 + 0.3 * Math.sin(S.tick * 0.1);
    const lg = ctx.createLinearGradient(lineX, 0, lineX + lineW, 0);
    const col = isBotThink ? `rgba(100,130,255,${glow})` : `rgba(0,220,100,${glow})`;
    if (isRight) { lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(1, col); }
    else         { lg.addColorStop(0, col);              lg.addColorStop(1, 'rgba(0,0,0,0)'); }
    ctx.fillStyle = lg;
    ctx.fillRect(lineX, 0, lineW, 2);

    // "Sua vez" / "Pensando" pill
    const pillW = 76, pillH = 14;
    const pillX = isRight ? textX - pillW : textX;
    const pillY2 = HH - pillH - 20;
    rr(pillX, pillY2, pillW, pillH, 7);
    if (isBotThink) {
      ctx.fillStyle = 'rgba(40,50,200,0.85)'; ctx.fill();
      ctx.fillStyle = '#a8c0ff'; ctx.font = 'bold 7.5px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Pensando' + '.'.repeat(Math.floor(S.tick / 18) % 4), pillX + pillW / 2, pillY2 + pillH / 2);
    } else if (idx !== S.BOT) {
      const pg2 = ctx.createLinearGradient(pillX, 0, pillX + pillW, 0);
      pg2.addColorStop(0, 'rgba(0,180,70,0.9)');
      pg2.addColorStop(1, 'rgba(0,220,90,0.95)');
      ctx.fillStyle = pg2; ctx.fill();
      ctx.fillStyle = '#c8ffd8'; ctx.font = 'bold 7.5px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('▶ Sua vez!', pillX + pillW / 2, pillY2 + pillH / 2);
    }
  }

  ctx.restore();

  // Resign button (player 0 only)
  if (idx === 0) {
    const canRes = act && (S.estado === 'mira' || S.estado === 'ballInHand');
    const rbW = 50, rbH = 13, rbX = photoCX + photoR + 10, rbY = HH - rbH - 3;
    S.resignBtn.x = rbX; S.resignBtn.y = rbY; S.resignBtn.w = rbW; S.resignBtn.h = rbH;
    rr(rbX, rbY, rbW, rbH, 5);
    ctx.fillStyle = canRes ? 'rgba(170,20,20,0.8)' : 'rgba(40,15,15,0.4)'; ctx.fill();
    ctx.fillStyle = canRes ? '#ffbbbb' : '#443333';
    ctx.font = 'bold 7.5px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Desistir', rbX + rbW / 2, rbY + rbH / 2);
  }
}

export function drawResignConfirm() {
  ctx.fillStyle = 'rgba(0,0,10,0.87)'; ctx.fillRect(0, 0, S.BW, S.BH);
  const bw = 280, bh = 68, bx = Math.round(S.BW / 2 - bw / 2), by = Math.round(S.BH / 2 - bh / 2);
  rr(bx, by, bw, bh, 16);
  ctx.fillStyle = '#111122'; ctx.fill();
  rr(bx, by, bw, bh, 16); ctx.strokeStyle = 'rgba(200,40,40,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Desistir da partida?', bx + bw / 2, by + 20);
  const sW = 112, sH = 26, sY = by + bh - sH - 10, gap = 12;
  const simX = bx + bw / 2 - sW - gap / 2, naoX = bx + bw / 2 + gap / 2;
  S.resignBtn.simX = simX; S.resignBtn.simY = sY; S.resignBtn.simW = sW; S.resignBtn.simH = sH;
  rr(simX, sY, sW, sH, 13); ctx.fillStyle = 'rgba(190,25,25,0.95)'; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Sim, desistir', simX + sW / 2, sY + sH / 2);
  S.resignBtn.naoX = naoX; S.resignBtn.naoY = sY; S.resignBtn.naoW = sW; S.resignBtn.naoH = sH;
  rr(naoX, sY, sW, sH, 13); ctx.fillStyle = 'rgba(22,110,22,0.95)'; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Cancelar', naoX + sW / 2, sY + sH / 2);
}
