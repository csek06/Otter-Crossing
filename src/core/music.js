// Background music, synthesized with Web Audio. A four-bar loop that adds layers
// and speeds up as the run gets longer. stepEvents is pure so the tests can check
// that intensity only ever adds layers.

import { audioContext, getMusicBus, isMuted } from './audio.js';

// Lanes crossed for full intensity.
export const MUSIC_FULL_AT = 100;

// Intensity at which each layer joins.
export const LAYERS = { bass: 0, pad: 0, hat: 0.12, arp: 0.3, drums: 0.5, lead: 0.75 };

// I, V, vi, IV in C. MIDI notes, root first.
const CHORDS = [
  [48, 52, 55],
  [43, 47, 50],
  [45, 48, 52],
  [41, 45, 48],
];
const LEAD = [2, -1, -1, 1, -1, -1, 0, -1, -1, -1, 1, -1, 2, -1, -1, -1];

export function intensityFor(lanes) {
  return Math.max(0, Math.min(1, lanes / MUSIC_FULL_AT));
}

export function bpmFor(k) {
  return 104 + 24 * k;
}

// Events for one 16th-note step. Each is { voice, note?, gain }.
export function stepEvents(step, k) {
  const s = step % 16;
  const chord = CHORDS[Math.floor(step / 16) % 4];
  const out = [];
  if (s === 0) for (const n of chord) out.push({ voice: 'pad', note: n + 12, gain: 0.025 });
  if (s === 0 || s === 6 || s === 8) out.push({ voice: 'bass', note: chord[0] - 12, gain: 0.24 });
  if (s === 14) out.push({ voice: 'bass', note: chord[2] - 12, gain: 0.2 });
  if (k >= LAYERS.hat && s % 4 === 2) out.push({ voice: 'hat', gain: 0.05 });
  if (k >= LAYERS.arp && s % 2 === 0) out.push({ voice: 'arp', note: chord[(s / 2) % 3] + 12, gain: 0.035 });
  if (k >= LAYERS.drums) {
    if (s % 4 === 0) out.push({ voice: 'kick', gain: 0.3 });
    if (s === 4 || s === 12) out.push({ voice: 'snare', gain: 0.09 });
  }
  if (k >= LAYERS.lead) {
    if (s % 2 === 1) out.push({ voice: 'hat', gain: 0.025 });
    if (LEAD[s] >= 0) out.push({ voice: 'lead', note: chord[LEAD[s]] + 24, gain: 0.045 });
  }
  return out;
}

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

let noiseBuf = null;
function noiseBuffer(ac) {
  if (noiseBuf) return noiseBuf;
  const len = Math.floor(ac.sampleRate * 0.2);
  noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function osc(ac, bus, t, type, f0, f1, dur, gain, attack = 0.008) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function hiss(ac, bus, t, freq, dur, gain) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const f = ac.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(bus);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function play(ac, bus, e, t, stepDur) {
  switch (e.voice) {
    case 'bass': return osc(ac, bus, t, 'triangle', hz(e.note), hz(e.note), stepDur * 1.8, e.gain);
    case 'pad': return osc(ac, bus, t, 'sine', hz(e.note), hz(e.note), stepDur * 15, e.gain, stepDur * 3);
    case 'arp': return osc(ac, bus, t, 'square', hz(e.note), hz(e.note), stepDur * 0.9, e.gain);
    case 'lead': return osc(ac, bus, t, 'triangle', hz(e.note), hz(e.note), stepDur * 1.6, e.gain);
    case 'kick': return osc(ac, bus, t, 'sine', 150, 45, 0.14, e.gain);
    case 'snare': return hiss(ac, bus, t, 1500, 0.12, e.gain);
    case 'hat': return hiss(ac, bus, t, 7000, 0.04, e.gain);
  }
}

const VOLUME = 0.55;

export function createMusic() {
  const m = { playing: false, step: 0, k: 0, scheduled: 0 };
  let timer = 0;
  let next = 0;

  function tick() {
    const ac = audioContext();
    if (!ac) return;
    const bus = getMusicBus();
    const stepDur = 60 / bpmFor(m.k) / 4;
    if (next < ac.currentTime) next = ac.currentTime + 0.05;
    while (next < ac.currentTime + 0.12) {
      if (!isMuted()) {
        for (const e of stepEvents(m.step, m.k)) {
          play(ac, bus, e, next, stepDur);
          m.scheduled++;
        }
      }
      m.step++;
      next += stepDur;
    }
  }

  function fade(to, time) {
    const ac = audioContext();
    if (!ac) return;
    const g = getMusicBus().gain;
    g.cancelScheduledValues(ac.currentTime);
    g.setValueAtTime(g.value, ac.currentTime);
    g.linearRampToValueAtTime(to, ac.currentTime + time);
  }

  m.start = (fromTop = true) => {
    if (m.playing) return;
    if (!audioContext()) return;
    m.playing = true;
    if (fromTop) m.step = 0;
    next = 0;
    fade(VOLUME, 0.3);
    tick();
    timer = setInterval(tick, 25);
  };
  m.stop = () => {
    if (!m.playing) return;
    m.playing = false;
    clearInterval(timer);
    fade(0, 0.25);
  };
  m.setLanes = (lanes) => {
    m.k = intensityFor(lanes);
  };
  return m;
}
