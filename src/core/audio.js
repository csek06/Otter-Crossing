// Synthesized sound with the Web Audio API. No audio files.

import { load, save } from './storage.js';

let ac = null;
let master = null;
let musicBus = null;
let muted = load('muted', false);

function ensure() {
  if (ac) return ac;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ac.destination);
  musicBus = ac.createGain();
  musicBus.gain.value = 0;
  musicBus.connect(master);
  return ac;
}

// For the music sequencer in music.js.
export function audioContext() {
  return ensure();
}
export function getMusicBus() {
  ensure();
  return musicBus;
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

function noise({ time, gain = 0.2, freq = 1200, delay = 0, type = 'bandpass' }) {
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
  f.type = type;
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
  splash: () => {
    noise({ time: 0.35, gain: 0.35, freq: 900, type: 'lowpass' });
    tone({ type: 'sine', from: 420, to: 140, time: 0.2, gain: 0.12 });
  },
  pickup: () => {
    tone({ type: 'sine', from: 880, to: 880, time: 0.06, gain: 0.12 });
    tone({ type: 'sine', from: 1320, to: 1320, time: 0.1, gain: 0.12, delay: 0.06 });
  },
  bell: () => {
    tone({ type: 'sine', from: 1480, to: 1460, time: 0.22, gain: 0.08 });
    tone({ type: 'sine', from: 2220, to: 2200, time: 0.16, gain: 0.04 });
  },
  flap: () => {
    noise({ time: 0.12, gain: 0.18, freq: 300, type: 'lowpass' });
    noise({ time: 0.12, gain: 0.18, freq: 300, type: 'lowpass', delay: 0.18 });
  },
  screech: () => {
    tone({ type: 'sawtooth', from: 1800, to: 900, time: 0.45, gain: 0.1 });
    tone({ type: 'square', from: 2400, to: 1300, time: 0.35, gain: 0.05, delay: 0.03 });
  },
  powerup: () => {
    tone({ type: 'triangle', from: 660, to: 660, time: 0.08, gain: 0.14 });
    tone({ type: 'triangle', from: 880, to: 880, time: 0.08, gain: 0.14, delay: 0.07 });
    tone({ type: 'triangle', from: 1320, to: 1320, time: 0.16, gain: 0.14, delay: 0.14 });
  },
  shield: () => {
    tone({ type: 'square', from: 220, to: 160, time: 0.12, gain: 0.14 });
    tone({ type: 'sine', from: 1200, to: 1800, time: 0.25, gain: 0.08, delay: 0.05 });
  },
  revive: () => {
    tone({ type: 'sine', from: 300, to: 1200, time: 0.45, gain: 0.14 });
    tone({ type: 'triangle', from: 600, to: 1500, time: 0.4, gain: 0.06, delay: 0.1 });
  },
  whoosh: () => {
    noise({ time: 0.4, gain: 0.2, freq: 1800 });
    tone({ type: 'sine', from: 400, to: 1000, time: 0.35, gain: 0.08 });
  },
  start: () => {
    tone({ type: 'square', from: 440, to: 440, time: 0.08, gain: 0.08 });
    tone({ type: 'square', from: 660, to: 660, time: 0.12, gain: 0.08, delay: 0.09 });
  },
};
