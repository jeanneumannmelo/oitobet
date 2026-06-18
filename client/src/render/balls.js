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
    ctx.beginPath(); ctx.arc(x,y,r+4,0,Math.PI*2);
    if (humanHas) {
      ctx.strokeStyle='rgba(255,210,0,1)'; ctx.lineWidth=3.5;
      ctx.shadowColor='rgba(255,220,0,1)'; ctx.shadowBlur=12;
    } else {
      ctx.strokeStyle='rgba(80,160,255,1)'; ctx.lineWidth=3.5;
      ctx.shadowColor='rgba(80,160,255,0.9)'; ctx.shadowBlur=12;
    }
    ctx.stroke();
    ctx.beginPath(); ctx.arc(x,y,r+4,0,Math.PI*2);
    ctx.globalAlpha=0.35; ctx.lineWidth=6; ctx.stroke(); ctx.globalAlpha=1;
    ctx.restore();
  }

  ctx.save();
  const sh = ctx.createRadialGradient(x+2,y+4,0,x+2,y+4,r*1.2);
  sh.addColorStop(0,'rgba(0,0,0,0.55)'); sh.addColorStop(1,'rgba(0,0,0,0)');
  ctx.beginPath(); ctx.arc(x+2,y+4,r*1.2,0,Math.PI*2); ctx.fillStyle=sh; ctx.fill();
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
  if (cue) {
    const cg = ctx.createRadialGradient(x-r*.28,y-r*.3,0,x,y,r);
    cg.addColorStop(0,'#ffffff'); cg.addColorStop(0.45,'#eeeeee'); cg.addColorStop(1,'#c5c5c5');
    ctx.fillStyle=cg;
  } else if (stripe) {
    ctx.fillStyle='#f3f3f3';
  } else {
    const bg = ctx.createRadialGradient(x-r*.22,y-r*.24,0,x,y,r);
    bg.addColorStop(0,lighter(hex,50)); bg.addColorStop(0.5,hex); bg.addColorStop(1,darker(hex,55));
    ctx.fillStyle=bg;
  }
  ctx.fill();

  // Rolling rotation
  const rollAng = b.roll || 0;
  const moveAng = (b.vx || b.vy) ? Math.atan2(b.vy, b.vx) : 0;
  if (stripe) {
    ctx.save();
    ctx.translate(x,y); ctx.rotate(moveAng+rollAng); ctx.translate(-x,-y);
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.clip();
    const sg = ctx.createRadialGradient(x-r*.22,y-r*.24,0,x,y,r);
    sg.addColorStop(0,lighter(hex,50)); sg.addColorStop(0.5,hex); sg.addColorStop(1,darker(hex,55));
    ctx.fillStyle=sg; ctx.fillRect(x-r,y-r*.45,r*2,r*.9);
    ctx.restore();
  }
  if (!cue) {
    ctx.save();
    ctx.translate(x,y); ctx.rotate(moveAng+rollAng); ctx.translate(-x,-y);
    ctx.beginPath(); ctx.arc(x,y,r*.43,0,Math.PI*2); ctx.fillStyle='rgba(252,252,252,0.94)'; ctx.fill();
    ctx.fillStyle='#111'; ctx.font=`bold ${Math.round(r*.7)}px Arial`;
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(id,x,y+1);
    ctx.restore();
  }

  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=0.8; ctx.stroke();
  const hi = ctx.createRadialGradient(x-r*.36,y-r*.4,0,x-r*.08,y-r*.1,r*.7);
  hi.addColorStop(0,'rgba(255,255,255,0.82)'); hi.addColorStop(0.4,'rgba(255,255,255,0.22)'); hi.addColorStop(1,'rgba(255,255,255,0)');
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=hi; ctx.fill();
  const hi2 = ctx.createRadialGradient(x+r*.3,y+r*.32,0,x+r*.3,y+r*.32,r*.25);
  hi2.addColorStop(0,'rgba(255,255,255,0.18)'); hi2.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=hi2; ctx.fill();
  ctx.restore();
}

export function drawMiniBall(x, y, r, id, dimmed) {
  const hex = BHEX[id] || '#888', stripe = id >= 9;
  ctx.save();
  if (dimmed) ctx.globalAlpha = 0.2;
  ctx.beginPath(); ctx.arc(x+1,y+1.5,r,0,Math.PI*2); ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fill();
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
  if (stripe) {
    ctx.fillStyle='#f3f3f3'; ctx.fill();
    ctx.save(); ctx.clip();
    const sg = ctx.createRadialGradient(x-r*.22,y-r*.24,0,x,y,r);
    sg.addColorStop(0,lighter(hex,50)); sg.addColorStop(0.5,hex); sg.addColorStop(1,darker(hex,55));
    ctx.fillStyle=sg; ctx.fillRect(x-r,y-r*.45,r*2,r*.9); ctx.restore();
  } else {
    const bg = ctx.createRadialGradient(x-r*.22,y-r*.24,0,x,y,r);
    bg.addColorStop(0,lighter(hex,45)); bg.addColorStop(0.5,hex); bg.addColorStop(1,darker(hex,50));
    ctx.fillStyle=bg; ctx.fill();
  }
  const hi = ctx.createRadialGradient(x-r*.35,y-r*.4,0,x,y,r);
  hi.addColorStop(0,'rgba(255,255,255,0.75)'); hi.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=hi; ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.38)'; ctx.lineWidth=0.6; ctx.stroke();
  ctx.restore();
}
