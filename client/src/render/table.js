import { ctx } from '../canvas.js';
import { S } from '../state.js';
import { rr } from '../utils.js';

// ── Table color themes ────────────────────────────────────────────────────────
export const TABLE_THEMES = [
  // 0: Classic tournament green
  {
    felt: '#1a7040', feltCenter: 'rgba(60,200,130,0.13)', feltEdge: 'rgba(0,0,0,0.30)',
    cushMid: '#145230', cushLight: 'rgba(70,180,110,0.40)', cushDark: '#082010',
    woodTop: '#5a2a08', woodMid: '#2a0e02',
    diamond: 'rgba(240,220,140,0.70)',
  },
  // 1: Royal blue
  {
    felt: '#1a3880', feltCenter: 'rgba(60,110,255,0.12)', feltEdge: 'rgba(0,0,0,0.32)',
    cushMid: '#102060', cushLight: 'rgba(60,120,255,0.40)', cushDark: '#060e2a',
    woodTop: '#4a3010', woodMid: '#200e04',
    diamond: 'rgba(180,210,255,0.75)',
  },
  // 2: Burgundy red
  {
    felt: '#72101e', feltCenter: 'rgba(220,50,70,0.12)', feltEdge: 'rgba(0,0,0,0.35)',
    cushMid: '#520a14', cushLight: 'rgba(200,50,70,0.40)', cushDark: '#280508',
    woodTop: '#3a1404', woodMid: '#180602',
    diamond: 'rgba(255,190,200,0.70)',
  },
  // 3: Midnight navy
  {
    felt: '#0c1430', feltCenter: 'rgba(40,80,180,0.14)', feltEdge: 'rgba(0,0,0,0.38)',
    cushMid: '#080c20', cushLight: 'rgba(40,70,160,0.40)', cushDark: '#040608',
    woodTop: '#2a2410', woodMid: '#0e0c06',
    diamond: 'rgba(160,190,255,0.60)',
  },
  // 4: Deep violet
  {
    felt: '#3c1268', feltCenter: 'rgba(140,60,255,0.13)', feltEdge: 'rgba(0,0,0,0.32)',
    cushMid: '#280a4a', cushLight: 'rgba(130,60,240,0.40)', cushDark: '#120522',
    woodTop: '#3a1828', woodMid: '#180a14',
    diamond: 'rgba(210,170,255,0.72)',
  },
  // 5: Ocean teal
  {
    felt: '#0d5050', feltCenter: 'rgba(30,200,200,0.13)', feltEdge: 'rgba(0,0,0,0.30)',
    cushMid: '#083838', cushLight: 'rgba(30,180,180,0.40)', cushDark: '#041818',
    woodTop: '#2a3020', woodMid: '#101408',
    diamond: 'rgba(150,240,240,0.72)',
  },
  // 6: Graphite slate
  {
    felt: '#2a2a32', feltCenter: 'rgba(150,150,180,0.10)', feltEdge: 'rgba(0,0,0,0.40)',
    cushMid: '#181820', cushLight: 'rgba(120,120,150,0.38)', cushDark: '#0a0a10',
    woodTop: '#282028', woodMid: '#100c10',
    diamond: 'rgba(200,200,220,0.65)',
  },
];

function theme() {
  return TABLE_THEMES[S.tableTheme % TABLE_THEMES.length];
}

// ── Felt texture patterns (one per theme) ────────────────────────────────────
let feltPatCache = {};
export function initFeltPat() {
  TABLE_THEMES.forEach((t, i) => {
    const fc = document.createElement('canvas'); fc.width = 4; fc.height = 4;
    const fx = fc.getContext('2d');
    fx.fillStyle = t.felt; fx.fillRect(0, 0, 4, 4);
    fx.fillStyle = 'rgba(0,0,0,0.07)'; fx.fillRect(0, 0, 2, 2); fx.fillRect(2, 2, 2, 2);
    fx.fillStyle = 'rgba(255,255,255,0.03)'; fx.fillRect(2, 0, 2, 2); fx.fillRect(0, 2, 2, 2);
    feltPatCache[i] = ctx.createPattern(fc, 'repeat');
  });
}

export function drawTable() {
  _drawWoodFrame();
  _drawFelt();
  _drawCushions3D();
  _drawDiamondMarkers();
  _drawPockets3D();
  _drawMarkings();
}

// ── 1. Wood frame ─────────────────────────────────────────────────────────────
function _drawWoodFrame() {
  const { TX, TY, TW, TH } = S;
  const th = theme();
  const R = 14;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.88)'; ctx.shadowBlur = 42; ctx.shadowOffsetY = 16;
  rr(TX, TY, TW, TH, R); ctx.fillStyle = '#0a0400'; ctx.fill();
  ctx.restore();

  const wg = ctx.createLinearGradient(TX, TY, TX, TY + TH);
  wg.addColorStop(0, th.woodTop); wg.addColorStop(0.04, th.woodMid);
  wg.addColorStop(0.5, th.woodMid); wg.addColorStop(0.96, th.woodMid);
  wg.addColorStop(1, th.woodTop);
  rr(TX, TY, TW, TH, R); ctx.fillStyle = wg; ctx.fill();

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
  const twh = ctx.createLinearGradient(0, TY, 0, TY + 22);
  twh.addColorStop(0, 'rgba(200,120,50,0.5)'); twh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = twh; ctx.fillRect(TX, TY, TW, 22);
  const bwh = ctx.createLinearGradient(0, TY + TH - 16, 0, TY + TH);
  bwh.addColorStop(0, 'rgba(0,0,0,0)'); bwh.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = bwh; ctx.fillRect(TX, TY + TH - 16, TW, 16);
  ctx.restore();

  rr(TX, TY, TW, TH, R); ctx.strokeStyle = '#100600'; ctx.lineWidth = 3; ctx.stroke();

  const { IX, IY, IW, IH } = S;
  ctx.strokeStyle = '#8a6010'; ctx.lineWidth = 1.5;
  rr(IX - 2, IY - 2, IW + 4, IH + 4, 3); ctx.stroke();
  ctx.strokeStyle = 'rgba(220,160,30,0.35)'; ctx.lineWidth = 0.8;
  rr(IX - 4, IY - 4, IW + 8, IH + 8, 4); ctx.stroke();

  S.POCKETS.forEach(p => {
    const cg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 1.2);
    cg.addColorStop(0, 'rgba(180,120,20,0.18)'); cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 1.2, 0, Math.PI * 2);
    ctx.fillStyle = cg; ctx.fill();
  });
}

// ── 2. Felt ───────────────────────────────────────────────────────────────────
function _drawFelt() {
  const { IX, IY, IW, IH } = S;
  const th = theme();

  ctx.fillStyle = th.felt; ctx.fillRect(IX, IY, IW, IH);

  const pat = feltPatCache[S.tableTheme % TABLE_THEMES.length];
  if (pat) { ctx.fillStyle = pat; ctx.fillRect(IX, IY, IW, IH); }

  const rl = ctx.createRadialGradient(IX + IW / 2, IY + IH / 2, 20, IX + IW / 2, IY + IH / 2, IW * 0.7);
  rl.addColorStop(0, th.feltCenter);
  rl.addColorStop(0.5, 'rgba(0,0,0,0.02)');
  rl.addColorStop(1, th.feltEdge);
  ctx.fillStyle = rl; ctx.fillRect(IX, IY, IW, IH);

  const esh = 18;
  [
    [IX,          IY, esh, IH, 'l'],
    [IX+IW-esh,   IY, esh, IH, 'r'],
    [IX,          IY, IW, esh, 't'],
    [IX, IY+IH-esh, IW, esh, 'b'],
  ].forEach(([ex, ey, ew, eh, d]) => {
    let g;
    if (d === 'l') { g = ctx.createLinearGradient(ex, 0, ex+ew, 0); g.addColorStop(0,'rgba(0,0,0,0.30)'); g.addColorStop(1,'rgba(0,0,0,0)'); }
    if (d === 'r') { g = ctx.createLinearGradient(ex+ew,0,ex,0); g.addColorStop(0,'rgba(0,0,0,0.30)'); g.addColorStop(1,'rgba(0,0,0,0)'); }
    if (d === 't') { g = ctx.createLinearGradient(0,ey,0,ey+eh); g.addColorStop(0,'rgba(0,0,0,0.26)'); g.addColorStop(1,'rgba(0,0,0,0)'); }
    if (d === 'b') { g = ctx.createLinearGradient(0,ey+eh,0,ey); g.addColorStop(0,'rgba(0,0,0,0.26)'); g.addColorStop(1,'rgba(0,0,0,0)'); }
    ctx.fillStyle = g; ctx.fillRect(ex, ey, ew, eh);
  });
}

// ── 3. 3D cushions ────────────────────────────────────────────────────────────
function _drawCushions3D() {
  const { PX, PY, PW, PH, CW, IX, IY, IW, IH, PCR, PMR } = S;
  const th = theme();

  const segs = [
    { x0: PX + PCR*0.72, y0: IY,          x1: PX+PW/2-PMR-CW*0.4, y1: IY+CW,    side: 'T' },
    { x0: PX+PW/2+PMR+CW*0.4, y0: IY,     x1: PX+PW-PCR*0.72,     y1: IY+CW,    side: 'T' },
    { x0: PX + PCR*0.72, y0: IY+IH-CW,    x1: PX+PW/2-PMR-CW*0.4, y1: IY+IH,   side: 'B' },
    { x0: PX+PW/2+PMR+CW*0.4, y0: IY+IH-CW, x1: PX+PW-PCR*0.72,  y1: IY+IH,   side: 'B' },
    { x0: IX,            y0: PY+PCR*0.72, x1: IX+CW,               y1: PY+PH-PCR*0.72, side: 'L' },
    { x0: IX+IW-CW,      y0: PY+PCR*0.72, x1: IX+IW,               y1: PY+PH-PCR*0.72, side: 'R' },
  ];

  segs.forEach(({ x0, y0, x1, y1, side }) => {
    if (x1 <= x0 || y1 <= y0) return;
    const w = x1-x0, h = y1-y0;

    let bg;
    if (side === 'T') {
      bg = ctx.createLinearGradient(0,y0,0,y1);
      bg.addColorStop(0, th.cushDark); bg.addColorStop(0.35, th.cushMid); bg.addColorStop(1, th.cushMid);
    } else if (side === 'B') {
      bg = ctx.createLinearGradient(0,y0,0,y1);
      bg.addColorStop(0, th.cushMid); bg.addColorStop(0.65, th.cushMid); bg.addColorStop(1, th.cushDark);
    } else if (side === 'L') {
      bg = ctx.createLinearGradient(x0,0,x1,0);
      bg.addColorStop(0, th.cushDark); bg.addColorStop(0.4, th.cushMid); bg.addColorStop(1, th.cushMid);
    } else {
      bg = ctx.createLinearGradient(x0,0,x1,0);
      bg.addColorStop(0, th.cushMid); bg.addColorStop(0.6, th.cushMid); bg.addColorStop(1, th.cushDark);
    }
    ctx.fillStyle = bg; ctx.fillRect(x0,y0,w,h);

    const HL = 3.5;
    let hg;
    ctx.save();
    if (side === 'T') {
      hg = ctx.createLinearGradient(0,y1-HL,0,y1);
      hg.addColorStop(0, th.cushLight); hg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hg; ctx.fillRect(x0,y1-HL,w,HL);
    } else if (side === 'B') {
      hg = ctx.createLinearGradient(0,y0,0,y0+HL);
      hg.addColorStop(0, th.cushLight); hg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hg; ctx.fillRect(x0,y0,w,HL);
    } else if (side === 'L') {
      hg = ctx.createLinearGradient(x1-HL,0,x1,0);
      hg.addColorStop(0, th.cushLight); hg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hg; ctx.fillRect(x1-HL,y0,HL,h);
    } else {
      hg = ctx.createLinearGradient(x0,0,x0+HL,0);
      hg.addColorStop(0, th.cushLight); hg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hg; ctx.fillRect(x0,y0,HL,h);
    }
    ctx.restore();

    ctx.strokeStyle = th.cushDark; ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (side === 'T')      { ctx.moveTo(x0, y0+.75); ctx.lineTo(x1, y0+.75); }
    else if (side === 'B') { ctx.moveTo(x0, y1-.75); ctx.lineTo(x1, y1-.75); }
    else if (side === 'L') { ctx.moveTo(x0+.75, y0); ctx.lineTo(x0+.75, y1); }
    else                   { ctx.moveTo(x1-.75, y0); ctx.lineTo(x1-.75, y1); }
    ctx.stroke();
  });
}

// ── 4. Diamond markers ────────────────────────────────────────────────────────
function _drawDiamondMarkers() {
  const { PX, PY, PW, PH, CW, IY, IH } = S;
  const th = theme();
  [1/8,2/8,3/8,4/8,5/8,6/8,7/8].forEach(t => {
    _drawDot(PX + PW*t, IY + CW*0.5, th.diamond);
    _drawDot(PX + PW*t, IY + IH - CW*0.5, th.diamond);
  });
  [1/4,2/4,3/4].forEach(t => {
    _drawDot(S.IX + CW*0.5, PY + PH*t, th.diamond);
    _drawDot(S.IX + S.IW - CW*0.5, PY + PH*t, th.diamond);
  });
}

function _drawDot(x, y, col) {
  const r = 3;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 3;
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle = col; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(x-r*0.3,y-r*0.35,r*0.35,0,Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fill();
  ctx.restore();
}

// ── 5. 3D pockets ─────────────────────────────────────────────────────────────
function _drawPockets3D() {
  S.POCKETS.forEach(p => {
    const r = p.r;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.92)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 5;
    ctx.beginPath(); ctx.arc(p.x,p.y,r+6,0,Math.PI*2); ctx.fillStyle = 'rgba(0,0,0,0.001)'; ctx.fill();
    ctx.restore();

    const og = ctx.createRadialGradient(p.x-r*0.2,p.y-r*0.25,0,p.x,p.y,r+7);
    og.addColorStop(0,'#7a5010'); og.addColorStop(0.35,'#5a3808'); og.addColorStop(0.7,'#3a2004'); og.addColorStop(1,'#1a0c02');
    ctx.beginPath(); ctx.arc(p.x,p.y,r+7,0,Math.PI*2); ctx.fillStyle = og; ctx.fill();
    ctx.beginPath(); ctx.arc(p.x,p.y,r+5,0,Math.PI*2);
    ctx.strokeStyle = 'rgba(180,130,30,0.75)'; ctx.lineWidth = 1.5; ctx.stroke();

    const lg = ctx.createRadialGradient(p.x-r*0.15,p.y-r*0.18,0,p.x,p.y,r+1);
    lg.addColorStop(0,'#2a1a08'); lg.addColorStop(0.5,'#180c04'); lg.addColorStop(1,'#080402');
    ctx.beginPath(); ctx.arc(p.x,p.y,r+1,0,Math.PI*2); ctx.fillStyle = lg; ctx.fill();

    const vg = ctx.createRadialGradient(p.x-r*0.1,p.y-r*0.12,0,p.x,p.y,r);
    vg.addColorStop(0,'#0a0806'); vg.addColorStop(0.6,'#050302'); vg.addColorStop(1,'#000000');
    ctx.beginPath(); ctx.arc(p.x,p.y,r-1,0,Math.PI*2); ctx.fillStyle = vg; ctx.fill();

    ctx.beginPath(); ctx.arc(p.x-r*0.3,p.y-r*0.55,r*0.22,0,Math.PI*2);
    ctx.fillStyle = 'rgba(220,170,60,0.28)'; ctx.fill();
  });
}

// ── 6. Markings ───────────────────────────────────────────────────────────────
function _drawMarkings() {
  const { PX, PY, PW, PH } = S;
  const bx = PX + PW*0.25;
  const cy2 = PY + PH/2;

  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.setLineDash([4,7]);
  ctx.beginPath(); ctx.moveTo(bx,PY+5); ctx.lineTo(bx,PY+PH-5); ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath(); ctx.arc(bx,cy2,PH*0.15,-Math.PI/2,Math.PI/2);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.stroke();

  ctx.beginPath(); ctx.arc(PX+PW*0.735,cy2,3.5,0,Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,0.20)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 0.8; ctx.stroke();

  ctx.beginPath(); ctx.arc(PX+PW/2,cy2,2.5,0,Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill();

  if (S.estado === 'ballInHand') {
    ctx.fillStyle = 'rgba(60,220,120,0.07)'; ctx.fillRect(PX,PY,PW,PH);
    ctx.strokeStyle = 'rgba(60,220,120,0.30)'; ctx.lineWidth = 1.5; ctx.setLineDash([7,5]);
    ctx.beginPath(); ctx.rect(PX+1,PY+1,PW-2,PH-2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(60,220,120,0.85)';
    ctx.font = `bold ${Math.round(PH*0.055)}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Toque para posicionar a bola branca', PX+PW/2, PY+PH/2);
  }
}
