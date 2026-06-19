import { ctx } from '../canvas.js';
import { S } from '../state.js';
import { rr } from '../utils.js';

// ── Felt texture pattern ──────────────────────────────────────────────────────
let feltPat = null;
export function initFeltPat() {
  const fc = document.createElement('canvas'); fc.width = 4; fc.height = 4;
  const fx = fc.getContext('2d');
  fx.fillStyle = '#1a7040'; fx.fillRect(0, 0, 4, 4);
  fx.fillStyle = 'rgba(0,0,0,0.06)'; fx.fillRect(0, 0, 2, 2); fx.fillRect(2, 2, 2, 2);
  fx.fillStyle = 'rgba(255,255,255,0.03)'; fx.fillRect(2, 0, 2, 2); fx.fillRect(0, 2, 2, 2);
  feltPat = ctx.createPattern(fc, 'repeat');
}

export function drawTable() {
  _drawWoodFrame();
  _drawFelt();
  _drawCushions3D();
  _drawDiamondMarkers();
  _drawPockets3D();
  _drawMarkings();
}

// ── 1. Rich mahogany wood frame ───────────────────────────────────────────────
function _drawWoodFrame() {
  const { TX, TY, TW, TH } = S;
  const R = 14;

  // Outer glow / table shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
  rr(TX, TY, TW, TH, R); ctx.fillStyle = '#0a0400'; ctx.fill();
  ctx.restore();

  // Wood base gradient — dark mahogany
  const wg = ctx.createLinearGradient(TX, TY, TX, TY + TH);
  wg.addColorStop(0,    '#5a2a08');
  wg.addColorStop(0.04, '#3a1604');
  wg.addColorStop(0.5,  '#2a0e02');
  wg.addColorStop(0.96, '#3a1604');
  wg.addColorStop(1,    '#5a2a08');
  rr(TX, TY, TW, TH, R); ctx.fillStyle = wg; ctx.fill();

  // Wood grain lines
  ctx.save(); rr(TX, TY, TW, TH, R); ctx.clip();
  ctx.lineWidth = 1;
  for (let gy = -TH; gy < TH * 2; gy += 7) {
    const alpha = 0.04 + 0.03 * Math.sin(gy * 0.4);
    ctx.strokeStyle = `rgba(${gy % 14 < 7 ? '0,0,0' : '200,120,60'},${alpha})`;
    ctx.beginPath();
    ctx.moveTo(TX, TY + gy + Math.sin(gy * 0.3) * 3);
    ctx.lineTo(TX + TW, TY + gy + Math.sin(gy * 0.3 + 2) * 3);
    ctx.stroke();
  }
  // Top/bottom light highlight on wood edge
  const twh = ctx.createLinearGradient(0, TY, 0, TY + 22);
  twh.addColorStop(0, 'rgba(160,80,20,0.55)'); twh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = twh; ctx.fillRect(TX, TY, TW, 22);
  const bwh = ctx.createLinearGradient(0, TY + TH - 16, 0, TY + TH);
  bwh.addColorStop(0, 'rgba(0,0,0,0)'); bwh.addColorStop(1, 'rgba(100,40,10,0.45)');
  ctx.fillStyle = bwh; ctx.fillRect(TX, TY + TH - 16, TW, 16);
  ctx.restore();

  // Outer border — dark
  rr(TX, TY, TW, TH, R); ctx.strokeStyle = '#1a0800'; ctx.lineWidth = 3; ctx.stroke();

  // Gold inner trim ring
  const { IX, IY, IW, IH } = S;
  ctx.strokeStyle = '#8a6010'; ctx.lineWidth = 1.5;
  rr(IX - 2, IY - 2, IW + 4, IH + 4, 3); ctx.stroke();
  ctx.strokeStyle = 'rgba(220,160,30,0.4)';
  ctx.lineWidth = 0.8;
  rr(IX - 4, IY - 4, IW + 8, IH + 8, 4); ctx.stroke();

  // Corner decorative brass inlays
  _drawCornerOrnaments();
}

function _drawCornerOrnaments() {
  const { PX, PY, PW, PH, PCR } = S;
  const corners = [
    [PX, PY], [PX + PW, PY], [PX, PY + PH], [PX + PW, PY + PH],
  ];
  corners.forEach(([cx2, cy2]) => {
    const cg = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, PCR * 1.2);
    cg.addColorStop(0, 'rgba(180,120,20,0.22)');
    cg.addColorStop(0.6, 'rgba(100,60,0,0.08)');
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(cx2, cy2, PCR * 1.2, 0, Math.PI * 2);
    ctx.fillStyle = cg; ctx.fill();
  });
}

// ── 2. Felt playing surface ───────────────────────────────────────────────────
function _drawFelt() {
  const { IX, IY, IW, IH } = S;

  // Base felt color
  ctx.fillStyle = '#1a7040'; ctx.fillRect(IX, IY, IW, IH);

  // Texture pattern
  if (feltPat) { ctx.fillStyle = feltPat; ctx.fillRect(IX, IY, IW, IH); }

  // Radial lighting — center bright, edges dark (3D table light look)
  const rl = ctx.createRadialGradient(IX + IW / 2, IY + IH / 2, 20, IX + IW / 2, IY + IH / 2, IW * 0.7);
  rl.addColorStop(0,   'rgba(80,220,140,0.12)');
  rl.addColorStop(0.45,'rgba(0,0,0,0.02)');
  rl.addColorStop(0.8, 'rgba(0,0,0,0.12)');
  rl.addColorStop(1,   'rgba(0,0,0,0.28)');
  ctx.fillStyle = rl; ctx.fillRect(IX, IY, IW, IH);

  // Edge shadow insets
  const esh = 16;
  const leftS = ctx.createLinearGradient(IX, 0, IX + esh, 0);
  leftS.addColorStop(0,'rgba(0,0,0,0.35)'); leftS.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = leftS; ctx.fillRect(IX, IY, esh, IH);

  const rightS = ctx.createLinearGradient(IX + IW, 0, IX + IW - esh, 0);
  rightS.addColorStop(0,'rgba(0,0,0,0.35)'); rightS.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = rightS; ctx.fillRect(IX + IW - esh, IY, esh, IH);

  const topS = ctx.createLinearGradient(0, IY, 0, IY + esh);
  topS.addColorStop(0,'rgba(0,0,0,0.3)'); topS.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = topS; ctx.fillRect(IX, IY, IW, esh);

  const botS = ctx.createLinearGradient(0, IY + IH, 0, IY + IH - esh);
  botS.addColorStop(0,'rgba(0,0,0,0.3)'); botS.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = botS; ctx.fillRect(IX, IY + IH - esh, IW, esh);
}

// ── 3. 3D cushions ────────────────────────────────────────────────────────────
function _drawCushions3D() {
  const { PX, PY, PW, PH, PCR, PMR, CW, IX, IY, IW, IH } = S;

  // Each cushion is a trapezoid with 3D bevel effect
  const segs = [
    { x0: PX + PCR * 0.72, y0: IY,       x1: PX + PW / 2 - PMR - CW * 0.4, y1: IY + CW, side: 'T' },
    { x0: PX + PW / 2 + PMR + CW * 0.4,  y0: IY,  x1: PX + PW - PCR * 0.72, y1: IY + CW, side: 'T' },
    { x0: PX + PCR * 0.72, y0: IY + IH - CW, x1: PX + PW / 2 - PMR - CW * 0.4, y1: IY + IH, side: 'B' },
    { x0: PX + PW / 2 + PMR + CW * 0.4,  y0: IY + IH - CW, x1: PX + PW - PCR * 0.72, y1: IY + IH, side: 'B' },
    { x0: IX,       y0: PY + PCR * 0.72, x1: IX + CW,       y1: PY + PH - PCR * 0.72, side: 'L' },
    { x0: IX + IW - CW, y0: PY + PCR * 0.72, x1: IX + IW, y1: PY + PH - PCR * 0.72, side: 'R' },
  ];

  segs.forEach(({ x0, y0, x1, y1, side }) => {
    if (x1 <= x0 || y1 <= y0) return;
    const w = x1 - x0, h = y1 - y0;

    // Base cushion color — dark forest green
    let baseG;
    if (side === 'T') {
      baseG = ctx.createLinearGradient(0, y0, 0, y1);
      baseG.addColorStop(0, '#0d3a1a'); baseG.addColorStop(0.35, '#1a5a2c'); baseG.addColorStop(1, '#0f4820');
    } else if (side === 'B') {
      baseG = ctx.createLinearGradient(0, y0, 0, y1);
      baseG.addColorStop(0, '#0f4820'); baseG.addColorStop(0.65, '#1a5a2c'); baseG.addColorStop(1, '#0d3a1a');
    } else if (side === 'L') {
      baseG = ctx.createLinearGradient(x0, 0, x1, 0);
      baseG.addColorStop(0, '#0d3a1a'); baseG.addColorStop(0.4, '#1a5a2c'); baseG.addColorStop(1, '#0f4820');
    } else {
      baseG = ctx.createLinearGradient(x0, 0, x1, 0);
      baseG.addColorStop(0, '#0f4820'); baseG.addColorStop(0.6, '#1a5a2c'); baseG.addColorStop(1, '#0d3a1a');
    }
    ctx.fillStyle = baseG; ctx.fillRect(x0, y0, w, h);

    // Inner highlight edge (facing the felt)
    ctx.save();
    const HL = 3;
    if (side === 'T') {
      const hg = ctx.createLinearGradient(0, y1 - HL, 0, y1);
      hg.addColorStop(0, 'rgba(80,200,120,0.4)'); hg.addColorStop(1, 'rgba(40,160,80,0.15)');
      ctx.fillStyle = hg; ctx.fillRect(x0, y1 - HL, w, HL);
    } else if (side === 'B') {
      const hg = ctx.createLinearGradient(0, y0, 0, y0 + HL);
      hg.addColorStop(0, 'rgba(80,200,120,0.4)'); hg.addColorStop(1, 'rgba(40,160,80,0.15)');
      ctx.fillStyle = hg; ctx.fillRect(x0, y0, w, HL);
    } else if (side === 'L') {
      const hg = ctx.createLinearGradient(x1 - HL, 0, x1, 0);
      hg.addColorStop(0, 'rgba(80,200,120,0.4)'); hg.addColorStop(1, 'rgba(40,160,80,0.15)');
      ctx.fillStyle = hg; ctx.fillRect(x1 - HL, y0, HL, h);
    } else {
      const hg = ctx.createLinearGradient(x0, 0, x0 + HL, 0);
      hg.addColorStop(0, 'rgba(80,200,120,0.4)'); hg.addColorStop(1, 'rgba(40,160,80,0.15)');
      ctx.fillStyle = hg; ctx.fillRect(x0, y0, HL, h);
    }

    // Outer edge (wood side) — dark line
    ctx.strokeStyle = '#0a2010'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (side === 'T')      { ctx.moveTo(x0, y0 + 0.75); ctx.lineTo(x1, y0 + 0.75); }
    else if (side === 'B') { ctx.moveTo(x0, y1 - 0.75); ctx.lineTo(x1, y1 - 0.75); }
    else if (side === 'L') { ctx.moveTo(x0 + 0.75, y0); ctx.lineTo(x0 + 0.75, y1); }
    else                   { ctx.moveTo(x1 - 0.75, y0); ctx.lineTo(x1 - 0.75, y1); }
    ctx.stroke();
    ctx.restore();
  });
}

// ── 4. Diamond markers on rails ───────────────────────────────────────────────
function _drawDiamondMarkers() {
  const { PX, PY, PW, PH, CW, IX, IY, IW, IH } = S;

  // Horizontal rail markers (top & bottom cushion)
  // Standard: 7 diamonds per long rail = positions at 1/8, 2/8, 3/8, 4/8, 5/8, 6/8, 7/8
  const hPositions = [1/8, 2/8, 3/8, 4/8, 5/8, 6/8, 7/8];
  hPositions.forEach(t => {
    const mx = PX + PW * t;
    // Top rail
    _drawDot(mx, IY + CW * 0.5);
    // Bottom rail
    _drawDot(mx, IY + IH - CW * 0.5);
  });

  // Vertical rail markers (left & right)
  const vPositions = [1/4, 2/4, 3/4];
  vPositions.forEach(t => {
    const my = PY + PH * t;
    _drawDot(IX + CW * 0.5, my);
    _drawDot(IX + IW - CW * 0.5, my);
  });
}

function _drawDot(x, y) {
  const r = 3;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 3;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(240,220,160,0.65)'; ctx.fill();
  ctx.strokeStyle = 'rgba(180,140,60,0.5)'; ctx.lineWidth = 0.5; ctx.stroke();
  // Tiny specular
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
  ctx.restore();
}

// ── 5. 3D pockets ────────────────────────────────────────────────────────────
function _drawPockets3D() {
  S.POCKETS.forEach(p => {
    const r = p.r;

    // Shadow underneath
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
    ctx.beginPath(); ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.001)'; ctx.fill();
    ctx.restore();

    // Outer brass/gold ring
    const og = ctx.createRadialGradient(p.x - r * 0.2, p.y - r * 0.25, 0, p.x, p.y, r + 7);
    og.addColorStop(0, '#7a5010');
    og.addColorStop(0.35, '#5a3808');
    og.addColorStop(0.7, '#3a2004');
    og.addColorStop(1, '#1a0c02');
    ctx.beginPath(); ctx.arc(p.x, p.y, r + 7, 0, Math.PI * 2);
    ctx.fillStyle = og; ctx.fill();

    // Brass highlight ring
    ctx.beginPath(); ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(160,110,20,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();

    // Leather inner rim
    const lg = ctx.createRadialGradient(p.x - r * 0.15, p.y - r * 0.18, 0, p.x, p.y, r + 1);
    lg.addColorStop(0, '#2a1a08');
    lg.addColorStop(0.5, '#180c04');
    lg.addColorStop(1, '#080402');
    ctx.beginPath(); ctx.arc(p.x, p.y, r + 1, 0, Math.PI * 2);
    ctx.fillStyle = lg; ctx.fill();

    // Void — deep black hole with subtle depth gradient
    const vg = ctx.createRadialGradient(p.x - r * 0.1, p.y - r * 0.12, 0, p.x, p.y, r);
    vg.addColorStop(0, '#0a0806');
    vg.addColorStop(0.6, '#050302');
    vg.addColorStop(1, '#000000');
    ctx.beginPath(); ctx.arc(p.x, p.y, r - 1, 0, Math.PI * 2);
    ctx.fillStyle = vg; ctx.fill();

    // Tiny brass specular at top
    ctx.beginPath();
    ctx.arc(p.x - r * 0.3, p.y - r * 0.55, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(220,170,60,0.25)'; ctx.fill();
  });
}

// ── 6. Table markings & ball-in-hand ─────────────────────────────────────────
function _drawMarkings() {
  const { PX, PY, PW, PH } = S;
  const bx = PX + PW * 0.25;
  const cy2 = PY + PH / 2;

  // Head string (break line)
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1; ctx.setLineDash([4, 7]);
  ctx.beginPath(); ctx.moveTo(bx, PY + 5); ctx.lineTo(bx, PY + PH - 5); ctx.stroke();
  ctx.setLineDash([]);

  // D-semicircle
  ctx.beginPath();
  ctx.arc(bx, cy2, PH * 0.15, -Math.PI / 2, Math.PI / 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.stroke();

  // Foot spot
  ctx.beginPath(); ctx.arc(PX + PW * 0.735, cy2, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 0.8; ctx.stroke();

  // Center spot
  ctx.beginPath(); ctx.arc(PX + PW / 2, cy2, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill();

  // Ball-in-hand zone highlight
  if (S.estado === 'ballInHand') {
    ctx.fillStyle = 'rgba(60,220,120,0.07)';
    ctx.fillRect(PX, PY, PW, PH);
    ctx.strokeStyle = 'rgba(60,220,120,0.3)'; ctx.lineWidth = 1.5; ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.rect(PX + 1, PY + 1, PW - 2, PH - 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(60,220,120,0.85)';
    ctx.font = `bold ${Math.round(PH * 0.055)}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Toque para posicionar a bola branca', PX + PW / 2, PY + PH / 2);
  }
}
