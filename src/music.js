// The speaker's music. Two kinds of track share one player:
//  - files listed in MUSIC (data.js), played through an <audio> element
//  - built-in lo-fi tracks, composed live in Web Audio from a chord progression
// Both run through one analyser, so the speaker and the UI can pulse to the beat.
import { MUSIC } from './data';
import { audioContext } from './sound';

const BUILT_IN = [
  { title: 'Late Commit', artist: 'sujal-1 · lo-fi', bpm: 78, hue: 330, chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]] },
  { title: 'Gradient Descent', artist: 'sujal-1 · lo-fi', bpm: 72, hue: 265, chords: [[57, 60, 64, 67], [50, 57, 60, 65], [55, 59, 62, 65], [48, 55, 59, 64]] },
  { title: 'Night Shift, Kolhapur', artist: 'sujal-1 · lo-fi', bpm: 84, hue: 25, chords: [[51, 55, 58, 62], [48, 51, 55, 58], [53, 56, 60, 63], [46, 50, 53, 56]] },
  { title: 'Overfit', artist: 'sujal-1 · lo-fi', bpm: 70, hue: 190, chords: [[50, 54, 57, 61], [47, 50, 54, 57], [52, 55, 59, 62], [45, 49, 52, 55]] },
];
const BARS = 40; // a built-in track's length

export const TRACKS = [
  ...MUSIC.filter((m) => m.src).map((m) => ({ ...m, kind: 'file', src: `${import.meta.env.BASE_URL}${m.src}`, cover: m.cover && `${import.meta.env.BASE_URL}${m.cover}` })),
  ...BUILT_IN.map((t) => ({ ...t, kind: 'synth', duration: (BARS * 16 * 60) / t.bpm / 4 })),
];

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const listeners = new Set();
const state = { index: 0, playing: false, startedAt: 0, offset: 0 };
let out = null; // { ctx, bus, analyser, data }
let synth = null;
let audioEl = null;

function chain() {
  if (out) return out;
  const ctx = audioContext();
  const bus = ctx.createGain();
  bus.gain.value = 0.9;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 5200;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 3;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  bus.connect(tone).connect(comp).connect(analyser).connect(ctx.destination);
  out = { ctx, bus, analyser, data: new Uint8Array(analyser.frequencyBinCount) };
  return out;
}

function emit() {
  listeners.forEach((f) => f());
}

/* ---------- the lo-fi engine ---------- */

function noiseBuffer(ctx, seconds) {
  const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function startSynth(track) {
  const { ctx, bus } = chain();
  const noise = noiseBuffer(ctx, 1);
  const spb = 60 / track.bpm / 4; // seconds per 16th
  let rnd = track.hue * 9301 + 49297;
  const rand = () => ((rnd = (rnd * 9301 + 49297) % 233280) / 233280);

  const keysBus = ctx.createBiquadFilter();
  keysBus.type = 'lowpass';
  keysBus.frequency.value = 1500;
  keysBus.connect(bus);
  const echo = ctx.createDelay();
  echo.delayTime.value = spb * 3;
  const fb = ctx.createGain();
  fb.gain.value = 0.32;
  echo.connect(fb).connect(echo);
  echo.connect(keysBus);

  // vinyl crackle
  const crackleBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const cd = crackleBuf.getChannelData(0);
  for (let i = 0; i < cd.length; i++) cd[i] = Math.random() < 0.0007 ? Math.random() * 2 - 1 : (Math.random() * 2 - 1) * 0.015;
  const crackle = ctx.createBufferSource();
  crackle.buffer = crackleBuf;
  crackle.loop = true;
  const cg = ctx.createGain();
  cg.gain.value = 0.35;
  crackle.connect(cg).connect(bus);
  crackle.start();

  const env = (g, t, peak, a, d) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  };
  const tone = (freq, t, len, type, peak, dest, detune = 0) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    env(g, t, peak, 0.03, len);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + len + 0.1);
  };
  const hit = (t, freq, q, peak, len, type = 'bandpass') => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    env(g, t, peak, 0.002, len);
    s.connect(f).connect(g).connect(bus);
    s.start(t);
    s.stop(t + len + 0.05);
  };
  const kick = (t) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    env(g, t, 0.85, 0.004, 0.32);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + 0.4);
  };

  let step = 0;
  let next = ctx.currentTime + 0.08;
  const schedule = () => {
    while (next < ctx.currentTime + 0.15) {
      const s = step % 16;
      const bar = Math.floor(step / 16);
      const chord = track.chords[bar % track.chords.length];
      const swing = s % 4 === 2 ? spb * 0.18 : 0;
      const t = next + swing;
      if (s === 0) {
        chord.forEach((n, i) => {
          tone(midi(n), t + i * 0.012, spb * 15, 'triangle', 0.045, keysBus, -6);
          tone(midi(n), t + i * 0.012, spb * 15, 'sine', 0.035, keysBus, 6);
        });
        tone(midi(chord[0] - 12), t, spb * 7, 'sine', 0.24, bus);
      }
      if (s === 8) tone(midi(chord[rand() < 0.5 ? 0 : 2] - 12), t, spb * 6, 'sine', 0.2, bus);
      if ([3, 6, 10, 13].includes(s) && rand() < 0.55) {
        const n = chord[Math.floor(rand() * chord.length)] + 12 + (rand() < 0.3 ? 12 : 0);
        tone(midi(n), t, spb * 3, 'sine', 0.05, echo);
        tone(midi(n), t, spb * 3, 'sine', 0.05, keysBus);
      }
      if (s === 0 || s === 10 || (s === 7 && rand() < 0.35)) kick(t);
      if (s === 4 || s === 12) hit(t, 1800, 0.8, 0.28, 0.18);
      if (s % 2 === 0) hit(t, 8000, 0.7, s % 4 === 0 ? 0.07 : 0.045, 0.04, 'highpass');
      if (s === 14 && rand() < 0.3) hit(t, 7000, 0.6, 0.06, 0.25, 'highpass');
      next += spb;
      step++;
    }
  };
  schedule();
  const timer = setInterval(schedule, 25);
  return {
    stop() {
      clearInterval(timer);
      crackle.stop();
      keysBus.disconnect();
      echo.disconnect();
    },
  };
}

/* ---------- the player ---------- */

function stopAll() {
  synth?.stop();
  synth = null;
  if (audioEl) audioEl.pause();
}

let tick = null;
function startTicker() {
  clearInterval(tick);
  tick = setInterval(() => {
    const t = TRACKS[state.index];
    if (state.playing && t.kind === 'synth' && elapsed() >= t.duration) player.next();
    emit();
  }, 500);
}

function elapsed() {
  const t = TRACKS[state.index];
  if (t.kind === 'file') return audioEl?.currentTime || 0;
  if (!state.playing) return state.offset;
  return state.offset + (out.ctx.currentTime - state.startedAt);
}

export const player = {
  tracks: TRACKS,
  get index() { return state.index; },
  get playing() { return state.playing; },
  get track() { return TRACKS[state.index]; },
  elapsed,
  duration() {
    const t = TRACKS[state.index];
    return t.kind === 'file' ? audioEl?.duration || 0 : t.duration;
  },
  play(i = state.index) {
    const { ctx, bus } = chain();
    ctx.resume();
    const changed = i !== state.index;
    stopAll();
    state.index = (i + TRACKS.length) % TRACKS.length;
    if (changed) state.offset = 0;
    const t = TRACKS[state.index];
    if (t.kind === 'file') {
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.crossOrigin = 'anonymous';
        ctx.createMediaElementSource(audioEl).connect(bus);
        audioEl.addEventListener('ended', () => player.next());
      }
      if (audioEl.dataset.src !== t.src) {
        audioEl.src = t.src;
        audioEl.dataset.src = t.src;
      }
      audioEl.play();
    } else {
      synth = startSynth(t);
      state.startedAt = ctx.currentTime;
    }
    state.playing = true;
    startTicker();
    emit();
  },
  pause() {
    if (!state.playing) return;
    state.offset = elapsed();
    stopAll();
    state.playing = false;
    emit();
  },
  toggle() {
    state.playing ? player.pause() : player.play();
  },
  next() {
    state.offset = 0;
    player.play(state.index + 1);
  },
  prev() {
    state.offset = 0;
    player.play(state.index - 1);
  },
  // 0..1 loudness, for the speaker rings and the bars
  level() {
    if (!out || !state.playing) return 0;
    out.analyser.getByteFrequencyData(out.data);
    let sum = 0;
    for (let i = 0; i < 24; i++) sum += out.data[i];
    return sum / (24 * 255);
  },
  bands(n = 16) {
    if (!out || !state.playing) return new Array(n).fill(0);
    out.analyser.getByteFrequencyData(out.data);
    const step = Math.floor(out.data.length / n);
    return Array.from({ length: n }, (_, i) => out.data[i * step] / 255);
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
