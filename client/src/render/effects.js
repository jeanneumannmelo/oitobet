import { ctx } from '../canvas.js';
import { S, BHEX } from '../state.js';
import { rr, lighter, darker } from '../utils.js';

// ── Celebration ───────────────────────────────────────────────────────────────

export function spawnCelebration(px, py) {
  S.celebFrames = S.CELEB_TOTAL;
  S.celebParticles = [];
  const colors = ['#ffe040','#ff8844','#44ff88','#44aaff','#ff44aa','#ffffff','#ffcc00'];
  for (let i = 0; i < 28; i++) {
    const ang = Math.random() * Math.PI * 2, spd = 2.5 + Math.random() * 6;
    S.celebParticles.push({
      x: px, y: py,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 1.5,
      r: 2 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
    });
  }
}

export function drawCelebration() {
  if (S.celebFrames <= 0) return;
  const t = S.celebFrames / S.CELEB_TOTAL;
  const alpha = t > 0.8 ? (1 - t) / 0.2 : t < 0.15 ? t / 0.15 : 1;
  S.celebParticles.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.22; p.vx *= 0.99;
    p.life = S.celebFrames / S.CELEB_TOTAL;
    ctx.save(); ctx.globalAlpha = p.life * alpha;
    ctx.shadowColor = p.color; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color; ctx.fill(); ctx.restore();
  });
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.shadowColor = 'rgba(255,220,0,0.9)'; ctx.shadowBlur = 32;
  ctx.fillStyle = '#ffe040'; ctx.font = `bold ${Math.round(S.PH * 0.1)}px Arial`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const bounce = Math.sin((1 - t) * Math.PI) * 14;
  ctx.fillText('INCRÍVEL! 🎱', S.PX + S.PW / 2, S.PY + S.PH / 2 - bounce);
  ctx.restore();
  S.celebFrames--;
}

// ── Net pocket animation ───────────────────────────────────────────────────────

export function drawNetAnims() {
  const NET = 36;
  const { PCR } = S;
  for (let ni = S.netAnims.length - 1; ni >= 0; ni--) {
    const na = S.netAnims[ni];
    na.t++;
    if (na.t > NET) { S.netAnims.splice(ni, 1); continue; }
    const np = na.t / NET;
    const nfade = np < 0.25 ? 1 : (1 - np) / 0.75;
    ctx.save();
    if (na.t <= 10) {
      const flashP = na.t / 10;
      const nfg = ctx.createRadialGradient(na.x, na.y, 0, na.x, na.y, PCR * 2.2);
      nfg.addColorStop(0, `rgba(255,255,200,${0.9 * (1 - flashP * 0.5)})`);
      nfg.addColorStop(0.4, 'rgba(255,220,80,0.4)'); nfg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(na.x, na.y, PCR * 2.2, 0, Math.PI * 2); ctx.fillStyle = nfg; ctx.fill();
    }
    ctx.globalAlpha = nfade;
    for (let nr = 0; nr < 3; nr++) {
      const ringP = Math.min(1, (np + nr * 0.12) * 1.3);
      ctx.beginPath(); ctx.arc(na.x, na.y, PCR * 2 * ringP, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(160,255,160,0.75)'; ctx.lineWidth = 1.5 - nr * 0.4; ctx.stroke();
    }
    ctx.save();
    ctx.beginPath(); ctx.arc(na.x, na.y, PCR * Math.min(1, np * 2.5), 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = 'rgba(180,255,180,0.5)'; ctx.lineWidth = 0.8;
    const ngs = 6;
    for (let ng = -PCR * 2; ng <= PCR * 2; ng += ngs) {
      ctx.beginPath(); ctx.moveTo(na.x - PCR * 2, na.y + ng - PCR * 2 * np); ctx.lineTo(na.x + PCR * 2, na.y + ng + PCR * 2 * np); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(na.x + ng - PCR * 2 * np, na.y - PCR * 2); ctx.lineTo(na.x + ng + PCR * 2 * np, na.y + PCR * 2); ctx.stroke();
    }
    ctx.restore(); ctx.restore();
  }
}

// ── Pocketed ball sidebars ─────────────────────────────────────────────────────

export function drawPocketedSidebars() {
  const sbR = 14, sbGap = 7, sbSpacing = sbR * 2 + sbGap;
  const sbTotalH = 6 * sbSpacing;
  const sbStartY = Math.round(S.PY + (S.PH - sbTotalH) / 2);

  for (let sp = 0; sp < 2; sp++) {
    const isHuman = sp === 0;
    const myType = S.tipos[sp];
    const ids = myType === 'solid' ? [1,2,3,4,5,6,7] : myType === 'stripe' ? [9,10,11,12,13,14,15] : [];
    const potted = S.potJogador[sp];
    const scx = isHuman ? S.IX + S.CW / 2 : S.IX + S.IW - S.CW / 2;

    ctx.save();
    ctx.fillStyle = isHuman ? 'rgba(255,208,0,0.06)' : 'rgba(128,170,255,0.06)';
    ctx.fillRect(isHuman ? S.IX : S.IX + S.IW - S.CW, S.IY, S.CW, S.IH);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = isHuman ? '#ffd040' : '#80aaff';
    ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(isHuman ? 'EU' : 'ADV', scx, S.TY + 8);
    if (myType) {
      const typeTxt = myType === 'solid' ? '●●' : '◑◑';
      const typeCol = isHuman ? 'rgba(220,155,0,0.85)' : 'rgba(80,100,210,0.85)';
      rr(scx - 20, S.TY + 23, 40, 14, 7); ctx.fillStyle = typeCol; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 8px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(myType === 'solid' ? 'SÓLIDA' : 'LISTRADA', scx, S.TY + 30);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '9px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText('Mesa aberta', scx, S.TY + 23);
    }
    ctx.restore();

    if (ids.length > 0) {
      for (let si = 0; si < 7; si++) {
        const sid = ids[si];
        const sby = sbStartY + si * sbSpacing + sbR;
        const isPot = potted.includes(sid);
        const shex = BHEX[sid] || '#888', sstripe = sid >= 9;
        if (isPot) {
          ctx.save();
          const sglow = ctx.createRadialGradient(scx, sby, 0, scx, sby, sbR + 10);
          sglow.addColorStop(0, shex + 'cc'); sglow.addColorStop(0.5, shex + '55'); sglow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.beginPath(); ctx.arc(scx, sby, sbR + 10, 0, Math.PI * 2); ctx.fillStyle = sglow; ctx.fill();
          ctx.beginPath(); ctx.arc(scx, sby, sbR, 0, Math.PI * 2);
          if (sstripe) {
            ctx.fillStyle = '#f3f3f3'; ctx.fill(); ctx.save(); ctx.clip();
            const sbg2 = ctx.createLinearGradient(scx - sbR, sby - sbR * 0.45, scx - sbR, sby + sbR * 0.45);
            sbg2.addColorStop(0, lighter(shex, 30)); sbg2.addColorStop(1, darker(shex, 20));
            ctx.fillStyle = sbg2; ctx.fillRect(scx - sbR, sby - sbR * 0.45, sbR * 2, sbR * 0.9); ctx.restore();
          } else {
            const sbg = ctx.createRadialGradient(scx - sbR * .22, sby - sbR * .24, 0, scx, sby, sbR);
            sbg.addColorStop(0, lighter(shex, 45)); sbg.addColorStop(0.55, shex); sbg.addColorStop(1, darker(shex, 50));
            ctx.fillStyle = sbg; ctx.fill();
          }
          ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.font = `bold ${Math.round(sbR * .92)}px Arial`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sid, scx, sby + 0.5);
          const shi2 = ctx.createRadialGradient(scx - sbR * .3, sby - sbR * .35, 0, scx, sby, sbR);
          shi2.addColorStop(0, 'rgba(255,255,255,0.7)'); shi2.addColorStop(0.5, 'rgba(255,255,255,0.12)'); shi2.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.beginPath(); ctx.arc(scx, sby, sbR, 0, Math.PI * 2); ctx.fillStyle = shi2; ctx.fill();
          ctx.restore();
        } else {
          ctx.save();
          ctx.beginPath(); ctx.arc(scx, sby, sbR, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 1.2; ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.font = `bold ${Math.round(sbR * .75)}px Arial`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sid, scx, sby);
          ctx.restore();
        }
      }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.font = '28px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', scx, S.PY + S.PH / 2);
    }
  }
}

// ── Turn popup mini card ───────────────────────────────────────────────────────

const POPUP_TOTAL = 120; // frames: 20 in + 60 hold + 40 out

export function drawTurnPopup() {
  if (S.turnPopup <= 0) return;
  S.turnPopup--;

  const t = S.turnPopup / POPUP_TOTAL;
  // Fade in during first 20 frames, hold, fade out during last 40 frames
  let alpha;
  if (S.turnPopup > POPUP_TOTAL - 20) {
    alpha = (POPUP_TOTAL - S.turnPopup) / 20;
  } else if (S.turnPopup < 40) {
    alpha = S.turnPopup / 40;
  } else {
    alpha = 1;
  }

  const cx = S.PX + S.PW / 2;
  const cy = S.PY + S.PH / 2;
  const pW = 220, pH = 90;
  const px = cx - pW / 2, py = cy - pH / 2;

  // Scale bounce: small → big → normal
  const scaleT = Math.min(1, (POPUP_TOTAL - S.turnPopup) / 20);
  const scale = 0.72 + 0.28 * (1 - Math.pow(1 - scaleT, 3));

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);

  // Drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
  rr(px, py, pW, pH, 18); ctx.fillStyle = 'rgba(0,0,0,0.001)'; ctx.fill();
  ctx.restore();

  // Background gradient
  const bg = ctx.createLinearGradient(px, py, px, py + pH);
  bg.addColorStop(0, '#0c2a18'); bg.addColorStop(1, '#071810');
  rr(px, py, pW, pH, 18); ctx.fillStyle = bg; ctx.fill();

  // Animated green border glow
  const pulse = 0.7 + 0.3 * Math.sin(S.tick * 0.15);
  ctx.strokeStyle = `rgba(0,212,112,${pulse * 0.9})`; ctx.lineWidth = 2;
  ctx.shadowColor = `rgba(0,212,112,${pulse * 0.6})`; ctx.shadowBlur = 12;
  rr(px, py, pW, pH, 18); ctx.stroke();
  ctx.shadowBlur = 0;

  // Inner top bar — "SUA VEZ"
  const barH = 38;
  rr(px, py, pW, barH, 18);
  ctx.beginPath();
  ctx.moveTo(px + 18, py);
  ctx.lineTo(px + pW - 18, py);
  ctx.arcTo(px + pW, py, px + pW, py + 18, 18);
  ctx.lineTo(px + pW, py + barH);
  ctx.lineTo(px, py + barH);
  ctx.arcTo(px, py, px + 18, py, 18);
  ctx.closePath();
  const hg = ctx.createLinearGradient(px, py, px + pW, py);
  hg.addColorStop(0, 'rgba(0,180,90,0.85)'); hg.addColorStop(1, 'rgba(0,220,110,0.85)');
  ctx.fillStyle = hg; ctx.fill();

  // "SUA VEZ!" text
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(pH * 0.28)}px Arial`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4;
  ctx.fillText('SUA VEZ!', cx, py + barH / 2);
  ctx.shadowBlur = 0;

  // Pool ball icon in lower section
  const ballR = 14;
  const ballX = cx - 20, ballY = py + barH + (pH - barH) / 2;

  // Ball 8 mini
  const bbg = ctx.createRadialGradient(ballX - 4, ballY - 5, 0, ballX, ballY, ballR);
  bbg.addColorStop(0, '#555'); bbg.addColorStop(0.5, '#222'); bbg.addColorStop(1, '#111');
  ctx.beginPath(); ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2);
  ctx.fillStyle = bbg; ctx.fill();
  ctx.beginPath(); ctx.arc(ballX, ballY, ballR * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
  ctx.fillStyle = '#111'; ctx.font = `bold ${Math.round(ballR * 0.7)}px Arial`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('8', ballX, ballY + 0.5);
  // Ball highlight
  const bhi = ctx.createRadialGradient(ballX - ballR * 0.38, ballY - ballR * 0.42, 0, ballX, ballY, ballR);
  bhi.addColorStop(0, 'rgba(255,255,255,0.75)'); bhi.addColorStop(0.4, 'rgba(255,255,255,0.15)'); bhi.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath(); ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2);
  ctx.fillStyle = bhi; ctx.fill();

  // "Atire!" text
  ctx.fillStyle = 'rgba(180,240,200,0.9)';
  ctx.font = `bold ${Math.round(pH * 0.2)}px Arial`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('Atire!', ballX + ballR + 8, ballY);

  ctx.restore();
}
