// Synthesized sound with the Web Audio API. No audio files.

import { load, save } from './storage.js';

let ac = null;
let master = null;
let muted = load('muted', false);

function ensure() {
  if (ac) return ac;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ac.destination);
  return ac;
}

// Browsers only allow audio after a user gesture, so call this from one.
export function unlockAudio() {
  const a = ensure();
  if (a && a.state === 'suspended') a.resume();
}

export function isMuted() {
  return muted;
}

export function setMuted(v) {
  muted = v;
  save('muted', v);
  if (master) master.gain.value = v ? 0 : 0.5;
}

function tone({ type = 'square', from, to, time, gain = 0.2, delay = 0 }) {
  const a = ensure();
  if (!a || muted) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + time);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + time);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + time + 0.02);
}

function noise({ time, gain = 0.2, freq = 1200, delay = 0 }) {
  const a = ensure();
  if (!a || muted) return;
  const t0 = a.currentTime + delay;
  const len = Math.floor(a.sampleRate * time);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

export const sfx = {
  hop: () => tone({ type: 'square', from: 520, to: 780, time: 0.07, gain: 0.08 }),
  bump: () => tone({ type: 'triangle', from: 180, to: 120, time: 0.08, gain: 0.15 }),
  hit: () => {
    tone({ type: 'sawtooth', from: 300, to: 60, time: 0.35, gain: 0.18 });
    noise({ time: 0.2, gain: 0.25, freq: 600 });
  },
  start: () => {
    tone({ type: 'square', from: 440, to: 440, time: 0.08, gain: 0.08 });
    tone({ type: 'square', from: 660, to: 660, time: 0.12, gain: 0.08, delay: 0.09 });
  },
};
