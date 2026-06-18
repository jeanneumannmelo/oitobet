import { ctx } from '../canvas.js';
import { S } from '../state.js';

export function drawCue() {
  if (S.estado === 'rolando' || S.estado === 'vitoria') return;
  const b = S.balls[0]; if (!b || b.out) return;
  const bx = b.x, by = b.y, dx = Math.cos(S.aimAng), dy = Math.sin(S.aimAng);
  const { BR, PX, PY, PW, PH } = S;
  if (S.estado === 'mira') {
    ctx.save(); ctx.beginPath(); ctx.rect(PX, PY, PW, PH); ctx.clip();
    ctx.setLineDash([10,8]); ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.moveTo(bx+dx*BR,by+dy*BR); ctx.lineTo(bx+dx*PW*.88,by+dy*PW*.88); ctx.stroke(); ctx.setLineDash([]);
    const gd = Math.min(PW*.5, PH);
    let gx = bx+dx*gd, gy = by+dy*gd;
    gx = Math.max(PX+BR, Math.min(PX+PW-BR, gx));
    gy = Math.max(PY+BR, Math.min(PY+PH-BR, gy));
    ctx.beginPath(); ctx.arc(gx,gy,BR,0,Math.PI*2); ctx.strokeStyle='rgba(255,255,255,0.28)'; ctx.lineWidth=1.8; ctx.stroke();
    const gf = ctx.createRadialGradient(gx-BR*.3,gy-BR*.3,0,gx,gy,BR);
    gf.addColorStop(0,'rgba(255,255,255,0.12)'); gf.addColorStop(1,'rgba(255,255,255,0.04)');
    ctx.fillStyle=gf; ctx.fill();
    ctx.setLineDash([5,9]); ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(gx+dx*BR,gy+dy*BR); ctx.lineTo(gx+dx*PW*.35,gy+dy*PW*.35); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  const tipGap = BR + 3 + S.pullBack, cueLen = 230;
  const sx = bx - dx*tipGap, sy = by - dy*tipGap;
  const ex = bx - dx*(tipGap+cueLen), ey = by - dy*(tipGap+cueLen);
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,0.4)'; ctx.shadowBlur=8; ctx.shadowOffsetX=2; ctx.shadowOffsetY=3;
  ctx.strokeStyle='rgba(0,0,0,0.01)'; ctx.lineWidth=10; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(ex,ey); ctx.lineTo(sx,sy); ctx.stroke();
  ctx.shadowBlur=0; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0;
  ctx.lineWidth=10; ctx.strokeStyle='#4a2208'; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(ex,ey); ctx.lineTo(sx,sy); ctx.stroke();
  const cg = ctx.createLinearGradient(ex,ey,sx,sy);
  cg.addColorStop(0,'#4a2208'); cg.addColorStop(0.12,'#7a3a10'); cg.addColorStop(0.28,'#9a5218');
  cg.addColorStop(0.48,'#c88a30'); cg.addColorStop(0.65,'#e8c878'); cg.addColorStop(0.8,'#f2e0a8');
  cg.addColorStop(0.92,'#fef8e8'); cg.addColorStop(0.97,'#fffffe'); cg.addColorStop(1,'#3ab0d0');
  ctx.lineWidth=6.5; ctx.strokeStyle=cg;
  ctx.beginPath(); ctx.moveTo(ex,ey); ctx.lineTo(sx,sy); ctx.stroke();
  const perp = { x: -dy, y: dx };
  ctx.lineWidth=1; ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineCap='butt';
  ctx.beginPath(); ctx.moveTo(ex+perp.x*2,ey+perp.y*2); ctx.lineTo(sx+perp.x*2,sy+perp.y*2); ctx.stroke();
  ctx.strokeStyle='rgba(0,0,0,0.55)'; ctx.lineWidth=2; ctx.lineCap='round';
  for (let i = 1; i <= 5; i++) {
    const t = 0.22 + i * 0.028;
    const wx = ex+(sx-ex)*t, wy = ey+(sy-ey)*t;
    ctx.beginPath(); ctx.arc(wx,wy,5,0,Math.PI*2); ctx.stroke();
  }
  ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=1;
  [0.22, 0.36].forEach(t => {
    const wx = ex+(sx-ex)*t, wy = ey+(sy-ey)*t;
    ctx.beginPath(); ctx.arc(wx,wy,5.5,0,Math.PI*2); ctx.stroke();
  });
  ctx.beginPath(); ctx.arc(sx,sy,3.5,0,Math.PI*2); ctx.fillStyle='#4ab8d8'; ctx.fill();
  ctx.strokeStyle='#2a8aaa'; ctx.lineWidth=0.8; ctx.stroke();
  ctx.restore();
}
