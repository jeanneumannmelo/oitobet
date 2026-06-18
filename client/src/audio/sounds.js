let AC = null;

export function getAC() { return AC; }

export function initAudio() {
  if (!AC) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { return; }
  }
  if (AC.state === 'suspended') AC.resume();
}

document.addEventListener('touchstart', initAudio, { passive: true });
document.addEventListener('mousedown', initAudio);

function sndGain(ac, val, t) {
  const g = ac.createGain();
  g.gain.setValueAtTime(val, t || ac.currentTime);
  return g;
}

let _noiseBuf = null;
function noiseBuf() {
  const ac = getAC(); if (!ac) return null;
  if (_noiseBuf) return _noiseBuf;
  const buf = ac.createBuffer(1, ac.sampleRate * 0.4, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  _noiseBuf = buf; return buf;
}

export function sndBallHit(speed) {
  const ac = getAC(); if (!ac) return;
  const t = ac.currentTime, vol = Math.min(1, speed / 16) * 0.7 + 0.06;
  const src = ac.createBufferSource(); src.buffer = noiseBuf();
  const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000 + speed * 120; hp.Q.value = 0.6;
  const env = sndGain(ac, 0, t);
  env.gain.linearRampToValueAtTime(vol * 0.85, t + 0.0015);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.022);
  src.connect(hp); hp.connect(env); env.connect(ac.destination);
  src.start(t); src.stop(t + 0.04);
  const freq = 2400 + speed * 180;
  const osc1 = ac.createOscillator(); osc1.type = 'sine'; osc1.frequency.value = freq;
  const env1 = sndGain(ac, 0, t);
  env1.gain.linearRampToValueAtTime(vol * 0.55, t + 0.001);
  env1.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
  osc1.connect(env1); env1.connect(ac.destination); osc1.start(t); osc1.stop(t + 0.09);
  const osc2 = ac.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = freq * 1.52;
  const env2 = sndGain(ac, 0, t);
  env2.gain.linearRampToValueAtTime(vol * 0.28, t + 0.001);
  env2.gain.exponentialRampToValueAtTime(0.001, t + 0.038);
  osc2.connect(env2); env2.connect(ac.destination); osc2.start(t); osc2.stop(t + 0.06);
}

export function sndCueStrike(power) {
  const ac = getAC(); if (!ac) return;
  const t = ac.currentTime, vol = 0.25 + power * 0.55;
  const src = ac.createBufferSource(); src.buffer = noiseBuf();
  const filt = ac.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = 2200;
  const env = sndGain(ac, 0, t);
  env.gain.linearRampToValueAtTime(vol, t + 0.002);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.045 + power * 0.03);
  src.connect(filt); filt.connect(env); env.connect(ac.destination);
  src.start(t); src.stop(t + 0.1);
  const osc = ac.createOscillator(); osc.type = 'sine';
  osc.frequency.setValueAtTime(120 + power * 80, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);
  const env3 = sndGain(ac, 0, t);
  env3.gain.linearRampToValueAtTime(vol * 0.7, t + 0.005);
  env3.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  osc.connect(env3); env3.connect(ac.destination); osc.start(t); osc.stop(t + 0.12);
}

export function sndWall(speed) {
  const ac = getAC(); if (!ac) return;
  const t = ac.currentTime, vol = Math.min(1, speed / 12) * 0.3 + 0.04;
  const src = ac.createBufferSource(); src.buffer = noiseBuf();
  const filt = ac.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 600 + speed * 40;
  const env = sndGain(ac, 0, t);
  env.gain.linearRampToValueAtTime(vol, t + 0.003);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  src.connect(filt); filt.connect(env); env.connect(ac.destination);
  src.start(t); src.stop(t + 0.12);
}

export function sndPocket() {
  const ac = getAC(); if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator(); osc.type = 'sine';
  osc.frequency.setValueAtTime(520, t);
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.22);
  const env = sndGain(ac, 0.35, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
  osc.connect(env); env.connect(ac.destination); osc.start(t); osc.stop(t + 0.26);
  const src = ac.createBufferSource(); src.buffer = noiseBuf();
  const filt = ac.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 350;
  const env2 = sndGain(ac, 0, t + 0.18);
  env2.gain.linearRampToValueAtTime(0.5, t + 0.22);
  env2.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
  src.connect(filt); filt.connect(env2); env2.connect(ac.destination);
  src.start(t + 0.18); src.stop(t + 0.5);
}

export function sndAssign() {
  const ac = getAC(); if (!ac) return;
  const t = ac.currentTime;
  [440, 660].forEach((freq, i) => {
    const osc = ac.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq;
    const env = sndGain(ac, 0, t + i * 0.12);
    env.gain.linearRampToValueAtTime(0.22, t + i * 0.12 + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.18);
    osc.connect(env); env.connect(ac.destination); osc.start(t + i * 0.12); osc.stop(t + i * 0.12 + 0.22);
  });
}

export function sndCelebration() {
  const ac = getAC(); if (!ac) return;
  const t = ac.currentTime;
  [523, 659, 784, 1047].forEach((freq, i) => {
    const osc = ac.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq;
    const env = sndGain(ac, 0, t + i * 0.1);
    env.gain.linearRampToValueAtTime(0.18, t + i * 0.1 + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.25);
    osc.connect(env); env.connect(ac.destination); osc.start(t + i * 0.1); osc.stop(t + i * 0.1 + 0.3);
  });
}

export function sndFoul() {
  const ac = getAC(); if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 160;
  const env = sndGain(ac, 0.25, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  osc.connect(env); env.connect(ac.destination); osc.start(t); osc.stop(t + 0.4);
}

export function sndWin() {
  const ac = getAC(); if (!ac) return;
  const t = ac.currentTime;
  [523, 659, 784, 880, 1047].forEach((freq, i) => {
    const osc = ac.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq;
    const env = sndGain(ac, 0, t + i * 0.13);
    env.gain.linearRampToValueAtTime(0.22, t + i * 0.13 + 0.03);
    env.gain.exponentialRampToValueAtTime(0.001, t + i * 0.13 + 0.28);
    osc.connect(env); env.connect(ac.destination); osc.start(t + i * 0.13); osc.stop(t + i * 0.13 + 0.35);
  });
}

let _lastWall = 0, _lastBall = 0;
export function throttledWall(spd) { const n = Date.now(); if (n - _lastWall > 60) { _lastWall = n; sndWall(spd); } }
export function throttledBall(spd) { const n = Date.now(); if (n - _lastBall > 30) { _lastBall = n; sndBallHit(spd); } }
