import { C, ctx } from './canvas.js';
import { S } from './state.js';

export function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
}

export function pill(x, y, w, h) { rr(x, y, w, h, h / 2); }

export function hex2rgb(h) {
  return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
}

export function lighter(h, a) {
  const c = hex2rgb(h);
  return `rgb(${Math.min(255,c[0]+a)},${Math.min(255,c[1]+a)},${Math.min(255,c[2]+a)})`;
}

export function darker(h, a) {
  const c = hex2rgb(h);
  return `rgb(${Math.max(0,c[0]-a)},${Math.max(0,c[1]-a)},${Math.max(0,c[2]-a)})`;
}

export function toGame(cx, cy) {
  const rect = C.getBoundingClientRect(), rx = cx - rect.left, ry = cy - rect.top;
  if (S.isPortrait) return { x: ry / S.sc, y: (rect.width - rx) / S.sc };
  return { x: rx / S.sc, y: ry / S.sc };
}

export function ballMoving() {
  // Threshold must be <= physics zeroing threshold (0.012) so processTurn is never
  // called while balls still have residual velocity and can drift into pockets.
  return S.balls.some(b => !b.out && (Math.abs(b.vx) >= 0.012 || Math.abs(b.vy) >= 0.012));
}

export function getBall(id) {
  return S.balls.find(b => b.id === id);
}
