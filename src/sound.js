// Tiny Web Audio kit: one shared context, a soft room tone, and UI blips. No audio files.
let ctx = null;
let master = null; // room tone + blips
let on = false;

export function audioContext() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function ensureRoom() {
  if (master) return;
  const c = audioContext();
  master = c.createGain();
  master.gain.value = 0;
  master.connect(c.destination);

  // Brown noise through a low-pass filter sounds like a quiet room / PC fan.
  const len = c.sampleRate * 4;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  const noise = c.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 320;
  const ng = c.createGain();
  ng.gain.value = 0.25;
  noise.connect(lp).connect(ng).connect(master);
  noise.start();
}

export function setSoundOn(value) {
  on = value;
  if (value) ensureRoom();
  if (!master) return;
  ctx.resume();
  master.gain.setTargetAtTime(value ? 0.5 : 0, ctx.currentTime, 0.3);
}

export function blip(freq = 660) {
  if (!on) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.08);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.2);
}

export function whoosh() {
  if (!on) return;
  const t = ctx.currentTime;
  const len = ctx.sampleRate * 0.5;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(1400, t + 0.4);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  src.connect(bp).connect(g).connect(master);
  src.start(t);
}
