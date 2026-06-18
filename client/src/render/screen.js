import { ctx } from '../canvas.js';
import { S } from '../state.js';
import { rr } from '../utils.js';

let bgPat = null;
export function initBgPat() {
  const fc = document.createElement('canvas'); fc.width = 40; fc.height = 40;
  const fx = fc.getContext('2d');
  fx.fillStyle = '#06080e'; fx.fillRect(0, 0, 40, 40);
  fx.strokeStyle = 'rgba(255,255,255,0.025)'; fx.lineWidth = 1;
  fx.beginPath(); fx.moveTo(0, 40); fx.lineTo(40, 0); fx.stroke();
  fx.beginPath(); fx.moveTo(-20, 40); fx.lineTo(20, 0); fx.stroke();
  fx.beginPath(); fx.moveTo(20, 40); fx.lineTo(60, 0); fx.stroke();
  bgPat = ctx.createPattern(fc, 'repeat');
}

export function drawBg() {
  ctx.fillStyle = '#06080e'; ctx.fillRect(0, 0, S.BW, S.BH);
  if (bgPat) { ctx.fillStyle = bgPat; ctx.fillRect(0, 0, S.BW, S.BH); }
  const rg = ctx.createRadialGradient(S.BW/2, S.BH/2, 80, S.BW/2, S.BH/2, S.BW*0.6);
  rg.addColorStop(0, 'rgba(30,50,120,0.12)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, S.BW, S.BH);
}

export function drawVitoria() {
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, S.BW, S.BH);
  const pw=360, ph=210, px2=(S.BW-pw)/2, py2=(S.BH-ph)/2;
  rr(px2, py2, pw, ph, 16);
  const wg = ctx.createLinearGradient(px2, py2, px2, py2+ph);
  wg.addColorStop(0,'#1a1428'); wg.addColorStop(1,'#0e0a1a');
  ctx.fillStyle=wg; ctx.fill();
  rr(px2,py2,pw,ph,16); ctx.strokeStyle='rgba(240,180,0,0.65)'; ctx.lineWidth=2; ctx.stroke();
  ctx.font='46px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('🏆',S.BW/2,py2+62);
  ctx.fillStyle='#f0c040'; ctx.font='bold 22px Arial';
  ctx.fillText(S.players[S.vencedor].name+' venceu!',S.BW/2,py2+112);
  const bw=170, bh=38, bx2=(S.BW-bw)/2, by2=py2+148;
  rr(bx2,by2,bw,bh,19); ctx.fillStyle='rgba(240,180,0,0.88)'; ctx.fill();
  ctx.fillStyle='#0a0a10'; ctx.font='bold 14px Arial';
  ctx.fillText('Jogar novamente',S.BW/2,by2+bh/2);
  drawVitoria._bx=bx2; drawVitoria._by=by2; drawVitoria._bw=bw; drawVitoria._bh=bh;
}

export function drawPowerBar() {
  if (S.estado === 'vitoria') return;
  const pbX=S.TX+S.TW-S.FW+5, pbY=S.TY+18, pbW=18, pbH=S.TH-36;
  ctx.save();
  rr(pbX-2,pbY-2,pbW+4,pbH+4,13); ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=1; ctx.stroke();
  rr(pbX,pbY,pbW,pbH,pbW/2); ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fill();
  const fh=pbH*S.power, fy=pbY+pbH-fh;
  ctx.save(); rr(pbX,pbY,pbW,pbH,pbW/2); ctx.clip();
  const pg=ctx.createLinearGradient(0,fy,0,fy+fh);
  pg.addColorStop(0,'#ff2828'); pg.addColorStop(0.3,'#ff9900'); pg.addColorStop(0.65,'#ffe000'); pg.addColorStop(1,'#00e060');
  ctx.fillStyle=pg; ctx.fillRect(pbX,fy,pbW,fh);
  const fs=ctx.createLinearGradient(pbX,0,pbX+pbW,0);
  fs.addColorStop(0,'rgba(255,255,255,0.0)'); fs.addColorStop(0.4,'rgba(255,255,255,0.18)'); fs.addColorStop(1,'rgba(255,255,255,0.0)');
  ctx.fillStyle=fs; ctx.fillRect(pbX,fy,pbW,fh); ctx.restore();
  ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=1.2;
  for (let t=1;t<4;t++){const ty2=pbY+pbH*t/4; ctx.beginPath(); ctx.moveTo(pbX+3,ty2); ctx.lineTo(pbX+pbW-3,ty2); ctx.stroke();}
  if (S.power>0.7){ctx.shadowColor=S.power>.9?'#ff4040':'#ffaa00';ctx.shadowBlur=12;rr(pbX,pbY+pbH-pbH*S.power,pbW,pbH*S.power,pbW/2);ctx.strokeStyle='rgba(255,180,0,0.4)';ctx.lineWidth=1;ctx.stroke();ctx.shadowBlur=0;}
  ctx.fillStyle='rgba(200,200,220,0.55)'; ctx.font='bold 9px Arial'; ctx.textAlign='center'; ctx.textBaseline='bottom';
  ctx.fillText('FORCE',pbX+pbW/2,pbY-4);
  ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font='bold 8px Arial'; ctx.textBaseline='top';
  ctx.fillText(Math.round(S.power*100)+'%',pbX+pbW/2,pbY+pbH+3);
  ctx.restore();
}
