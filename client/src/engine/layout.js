import { C, ctx } from '../canvas.js';
import { S } from '../state.js';

export function recalcLayout() {
  const { BW, BH, HH, FW, CW, SB, MG } = S;
  S.TX = SB; S.TY = HH + MG; S.TW = BW - SB * 2; S.TH = BH - S.TY - MG;
  S.IX = S.TX + FW; S.IY = S.TY + FW; S.IW = S.TW - FW * 2; S.IH = S.TH - FW * 2;
  S.PX = S.IX + CW; S.PY = S.IY + CW; S.PW = S.IW - CW * 2; S.PH = S.IH - CW * 2;
  S.BR = Math.max(9, Math.min(13, Math.round(S.PH * 0.058)));
  S.PCR = Math.round(S.BR * 1.6);
  S.PMR = Math.round(S.BR * 1.32);
  S.POCKETS = [
    { x: S.PX,         y: S.PY,       r: S.PCR, dr: S.PCR + S.BR },
    { x: S.PX+S.PW/2,  y: S.IY,       r: S.PMR, dr: S.PMR + CW + S.BR },
    { x: S.PX+S.PW,    y: S.PY,       r: S.PCR, dr: S.PCR + S.BR },
    { x: S.PX,         y: S.PY+S.PH,  r: S.PCR, dr: S.PCR + S.BR },
    { x: S.PX+S.PW/2,  y: S.IY+S.IH, r: S.PMR, dr: S.PMR + CW + S.BR },
    { x: S.PX+S.PW,    y: S.PY+S.PH,  r: S.PCR, dr: S.PCR + S.BR },
  ];
}

export function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  S.isPortrait = vh > vw;
  if (S.isPortrait) {
    S.BH = 580; S.sc = vw / S.BH; S.BW = Math.round(vh / S.sc);
    const cw = Math.round(S.BW * S.sc), ch = Math.round(S.BH * S.sc);
    C.width = cw * S.DPR; C.height = ch * S.DPR;
    C.style.width = cw + 'px'; C.style.height = ch + 'px';
    C.style.transform = 'translate(-50%,-50%) rotate(90deg)';
  } else {
    S.BW = 900; S.BH = 580; S.sc = Math.min(vw / S.BW, vh / S.BH);
    const cw = Math.round(S.BW * S.sc), ch = Math.round(S.BH * S.sc);
    C.width = cw * S.DPR; C.height = ch * S.DPR;
    C.style.width = cw + 'px'; C.style.height = ch + 'px';
    C.style.transform = 'translate(-50%,-50%)';
  }
  recalcLayout();
  ctx.setTransform(S.sc * S.DPR, 0, 0, S.sc * S.DPR, 0, 0);
}
