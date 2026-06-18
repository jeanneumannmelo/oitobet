import { ctx } from '../canvas.js';
import { S } from '../state.js';
import { rr } from '../utils.js';

let feltPat = null;
export function initFeltPat() {
  const fc = document.createElement('canvas'); fc.width = 6; fc.height = 6;
  const fx = fc.getContext('2d');
  fx.fillStyle = '#1e7a3c'; fx.fillRect(0, 0, 6, 6);
  fx.fillStyle = 'rgba(0,0,0,0.07)'; fx.fillRect(0, 0, 3, 3); fx.fillRect(3, 3, 3, 3);
  fx.fillStyle = 'rgba(255,255,255,0.04)'; fx.fillRect(3, 0, 3, 3); fx.fillRect(0, 3, 3, 3);
  fx.fillStyle = 'rgba(255,255,255,0.06)'; fx.fillRect(1, 1, 1, 1); fx.fillRect(4, 4, 1, 1);
  feltPat = ctx.createPattern(fc, 'repeat');
}

export function drawTable() {
  const { TX, TY, TW, TH, IX, IY, IW, IH } = S;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 8;
  rr(TX, TY, TW, TH, 12); ctx.fillStyle = '#200404'; ctx.fill();
  ctx.restore();
  const wg = ctx.createLinearGradient(TX, TY, TX, TY + TH);
  wg.addColorStop(0,'#c42222'); wg.addColorStop(0.06,'#821010');
  wg.addColorStop(0.5,'#620c0c'); wg.addColorStop(0.94,'#821010'); wg.addColorStop(1,'#c42222');
  rr(TX, TY, TW, TH, 12); ctx.fillStyle = wg; ctx.fill();
  ctx.save(); rr(TX, TY, TW, TH, 12); ctx.clip();
  ctx.lineWidth = 1.2;
  for (let gy = TY - 2; gy < TY + TH + 2; gy += 8) {
    ctx.strokeStyle = `rgba(0,0,0,${0.08 + 0.06 * Math.sin(gy * 0.5)})`;
    ctx.beginPath(); ctx.moveTo(TX, gy + Math.sin(gy * 0.35) * 2); ctx.lineTo(TX + TW, gy + Math.sin(gy * 0.35 + 2.8) * 2); ctx.stroke();
  }
  const th2 = ctx.createLinearGradient(0, TY, 0, TY + 18);
  th2.addColorStop(0,'rgba(240,100,100,0.5)'); th2.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = th2; ctx.fillRect(TX, TY, TW, 18);
  const bh2 = ctx.createLinearGradient(0, TY + TH - 14, 0, TY + TH);
  bh2.addColorStop(0,'rgba(0,0,0,0)'); bh2.addColorStop(1,'rgba(200,60,60,0.35)');
  ctx.fillStyle = bh2; ctx.fillRect(TX, TY + TH - 14, TW, 14);
  ctx.restore();
  const ish = ctx.createLinearGradient(IX, IY, IX + 8, IY);
  ish.addColorStop(0,'rgba(0,0,0,0.5)'); ish.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = ish; ctx.fillRect(IX, IY, 8, S.IH);
  const ish2 = ctx.createLinearGradient(IX + IW, IY, IX + IW - 8, IY);
  ish2.addColorStop(0,'rgba(0,0,0,0.5)'); ish2.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = ish2; ctx.fillRect(IX + IW - 8, IY, 8, S.IH);
  rr(TX, TY, TW, TH, 12); ctx.strokeStyle = '#180202'; ctx.lineWidth = 2.5; ctx.stroke();
  rr(IX, IY, IW, S.IH, 0); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#1e7a3c'; ctx.fillRect(IX, IY, IW, S.IH);
  if (feltPat) { ctx.fillStyle = feltPat; ctx.fillRect(IX, IY, IW, S.IH); }
  const fv = ctx.createRadialGradient(IX + IW / 2, IY + S.IH / 2, 30, IX + IW / 2, IY + S.IH / 2, IW * 0.62);
  fv.addColorStop(0,'rgba(120,255,160,0.06)'); fv.addColorStop(0.6,'rgba(0,0,0,0.03)'); fv.addColorStop(1,'rgba(0,0,0,0.20)');
  ctx.fillStyle = fv; ctx.fillRect(IX, IY, IW, S.IH);
  drawCushions(); drawPockets(); drawMarkings();
}

function drawCushions() {
  const { PX, PY, PW, PH, PCR, PMR, CW, IX, IY, IW, IH } = S;
  const segs = [
    [PX+PCR*0.75, IY,      PX+PW/2-PMR*0.85-CW, IY+CW,    'T'],
    [PX+PW/2+PMR*0.85+CW, IY, PX+PW-PCR*0.75,   IY+CW,    'T'],
    [PX+PCR*0.75, IY+IH-CW, PX+PW/2-PMR*0.85-CW, IY+IH,   'B'],
    [PX+PW/2+PMR*0.85+CW, IY+IH-CW, PX+PW-PCR*0.75, IY+IH,'B'],
    [IX,          PY+PCR*0.75, IX+CW,             PY+PH-PCR*0.75, 'L'],
    [IX+IW-CW,    PY+PCR*0.75, IX+IW,             PY+PH-PCR*0.75, 'R'],
  ];
  segs.forEach(([x0,y0,x1,y1,side]) => {
    if (x1 <= x0 || y1 <= y0) return;
    let g;
    if (side==='T'){g=ctx.createLinearGradient(0,y0,0,y1);g.addColorStop(0,'#9e1818');g.addColorStop(0.4,'#5a0c0c');g.addColorStop(1,'#300606');}
    else if(side==='B'){g=ctx.createLinearGradient(0,y0,0,y1);g.addColorStop(0,'#300606');g.addColorStop(0.6,'#5a0c0c');g.addColorStop(1,'#9e1818');}
    else if(side==='L'){g=ctx.createLinearGradient(x0,0,x1,0);g.addColorStop(0,'#9e1818');g.addColorStop(0.4,'#5a0c0c');g.addColorStop(1,'#300606');}
    else{g=ctx.createLinearGradient(x0,0,x1,0);g.addColorStop(0,'#300606');g.addColorStop(0.6,'#5a0c0c');g.addColorStop(1,'#9e1818');}
    ctx.fillStyle=g; ctx.fillRect(x0,y0,x1-x0,y1-y0);
    ctx.strokeStyle='rgba(210,60,60,0.45)'; ctx.lineWidth=1.2; ctx.beginPath();
    if(side==='T'){ctx.moveTo(x0,y1-0.6);ctx.lineTo(x1,y1-0.6);}
    else if(side==='B'){ctx.moveTo(x0,y0+0.6);ctx.lineTo(x1,y0+0.6);}
    else if(side==='L'){ctx.moveTo(x1-0.6,y0);ctx.lineTo(x1-0.6,y1);}
    else{ctx.moveTo(x0+0.6,y0);ctx.lineTo(x0+0.6,y1);}
    ctx.stroke();
  });
}

function drawPockets() {
  S.POCKETS.forEach(p => {
    const r = p.r;
    ctx.save(); ctx.shadowColor='rgba(0,0,0,0.8)'; ctx.shadowBlur=10;
    ctx.beginPath(); ctx.arc(p.x,p.y,r+5,0,Math.PI*2); ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fill(); ctx.restore();
    const lg = ctx.createRadialGradient(p.x-r*.25,p.y-r*.28,0,p.x,p.y,r+2);
    lg.addColorStop(0,'#3a1818'); lg.addColorStop(0.55,'#220c0c'); lg.addColorStop(0.8,'#180606'); lg.addColorStop(1,'#0e0303');
    ctx.beginPath(); ctx.arc(p.x,p.y,r+2,0,Math.PI*2); ctx.fillStyle=lg; ctx.fill();
    ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.strokeStyle='rgba(80,20,20,0.7)'; ctx.lineWidth=2; ctx.stroke();
    const hg = ctx.createRadialGradient(p.x-r*.15,p.y-r*.18,0,p.x,p.y,r-1);
    hg.addColorStop(0,'#181818'); hg.addColorStop(0.4,'#080808'); hg.addColorStop(1,'#000');
    ctx.beginPath(); ctx.arc(p.x,p.y,r-2,0,Math.PI*2); ctx.fillStyle=hg; ctx.fill();
    ctx.beginPath(); ctx.arc(p.x,p.y,r-3,0,Math.PI*2); ctx.strokeStyle='rgba(60,10,10,0.4)'; ctx.lineWidth=1; ctx.stroke();
  });
}

function drawMarkings() {
  const { PX, PY, PW, PH } = S;
  const bx = PX + PW * 0.25, cy2 = PY + PH / 2;
  ctx.strokeStyle='rgba(255,255,255,0.09)'; ctx.lineWidth=1; ctx.setLineDash([5,6]);
  ctx.beginPath(); ctx.moveTo(bx,PY+4); ctx.lineTo(bx,PY+PH-4); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(bx,cy2,PH*0.155,-Math.PI/2,Math.PI/2); ctx.strokeStyle='rgba(255,255,255,0.07)'; ctx.lineWidth=1; ctx.stroke();
  ctx.beginPath(); ctx.arc(PX+PW*0.735,cy2,3,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.fill();
  ctx.beginPath(); ctx.arc(PX+PW*0.5,cy2,2.5,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.1)'; ctx.fill();
  if (S.estado === 'ballInHand') {
    ctx.fillStyle='rgba(80,220,120,0.06)'; ctx.fillRect(PX,PY,PW,PH);
    ctx.strokeStyle='rgba(80,220,120,0.25)'; ctx.lineWidth=1; ctx.setLineDash([6,5]);
    ctx.beginPath(); ctx.rect(PX+1,PY+1,PW-2,PH-2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='rgba(80,220,120,0.7)'; ctx.font='bold 13px Arial';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('Toque para posicionar a bola branca', PX+PW/2, PY+PH/2);
  }
}
