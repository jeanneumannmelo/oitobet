import { S } from '../state.js';

export function mkBall(id, x, y) {
  return { id, x, y, vx: 0, vy: 0, out: false, roll: 0 };
}

export function initBalls() {
  const { PX, PY, PW, PH, BR } = S;
  S.balls = [];
  S.balls.push(mkBall(0, PX + PW * 0.26, PY + PH / 2));
  const rx = PX + PW * 0.735, ry = PY + PH / 2;
  const sp = BR * 2 + 0.3, h = sp * Math.cos(Math.PI / 6);
  const rack = [[1],[9,2],[3,8,10],[4,14,11,7],[12,6,15,13,5]];
  for (let r = 0; r < rack.length; r++)
    for (let c = 0; c < rack[r].length; c++)
      S.balls.push(mkBall(rack[r][c], rx + r * h, ry + (c - r / 2) * sp));
}
