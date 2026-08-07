/**
 * Miku Plush Drop — WebAudio synthesis.
 *
 * Lazily-created AudioContext plus a selectable bank of synth "drop" styles
 * (Surprise / Boing / Coins / Pop / Wobble / Marimba / Bubble) and a heftier
 * secret "boom". These backstop the game when no audio files are present;
 * playSound prefers real files when they exist and rate-limits playback.
 */

import { state } from './state.js';

/**
 * Lazily get/resume the shared AudioContext (created on first user gesture).
 * @returns {AudioContext}
 */
function audio() {
  if (!state.actx) state.actx = new (window.AudioContext || window.webkitAudioContext)();
  if (state.actx.state === 'suspended') state.actx.resume();
  return state.actx;
}

function boingSynth(a, f) {
  const t = a.currentTime;
  const osc = a.createOscillator();
  const gain = a.createGain();
  const f0 = 240 * f;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.linearRampToValueAtTime(f0 * 1.8, t + 0.05);
  osc.frequency.linearRampToValueAtTime(f0 * 0.7, t + 0.16);
  osc.frequency.linearRampToValueAtTime(f0 * 0.9, t + 0.22);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
  osc.connect(gain);
  gain.connect(a.destination);
  osc.start(t);
  osc.stop(t + 0.26);
}

function coinSynth(a, f) {
  const t = a.currentTime;
  const notes = [
    [0, 1318.5],
    [0.09, 1975.5]
  ];
  for (const [i, freq] of notes) {
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq * f;
    gain.gain.setValueAtTime(0.0001, t + i);
    gain.gain.exponentialRampToValueAtTime(0.22, t + i + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + i + 0.18);
    osc.connect(gain);
    gain.connect(a.destination);
    osc.start(t + i);
    osc.stop(t + i + 0.2);
  }
}

function yPopSynth(a, f) {
  const t = a.currentTime;
  const dur = 0.12;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
  }
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1400 * f;
  bp.Q.value = 1.2;
  const g = a.createGain();
  g.gain.setValueAtTime(0.25, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(a.destination);
  src.start(t);

  const osc = a.createOscillator();
  const og = a.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(500 * f, t);
  osc.frequency.exponentialRampToValueAtTime(300 * f, t + 0.1);
  og.gain.setValueAtTime(0.12, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(og);
  og.connect(a.destination);
  osc.start(t);
  osc.stop(t + 0.13);
}

function bounceSynth(a, f) {
  const t = a.currentTime;
  const osc = a.createOscillator();
  const gain = a.createGain();
  const f0 = 330 * f;
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f0 * 0.5, t + 0.06);
  osc.frequency.exponentialRampToValueAtTime(f0 * 1.4, t + 0.14);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  osc.connect(gain);
  gain.connect(a.destination);
  osc.start(t);
  osc.stop(t + 0.22);
}

function boomSynth(a) {
  const t = a.currentTime;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(38, t + 0.5);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.55, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  osc.connect(gain);
  gain.connect(a.destination);
  osc.start(t);
  osc.stop(t + 0.6);

  const noiseDur = 0.12;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * noiseDur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
  }
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = 'lowpass';
  bp.frequency.value = 700;
  const ng = a.createGain();
  ng.gain.setValueAtTime(0.25, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + noiseDur);
  src.connect(bp);
  bp.connect(ng);
  ng.connect(a.destination);
  src.start(t);
}

function wobbleSynth(a, f) {
  const t = a.currentTime;
  const osc = a.createOscillator();
  const gain = a.createGain();
  const lfo = a.createOscillator();
  const lfoG = a.createGain();
  const f0 = 190 * f * (0.85 + Math.random() * 0.4);
  osc.type = 'sine';
  osc.frequency.value = f0;
  lfo.type = 'sine';
  lfo.frequency.value = 20 + Math.random() * 16;
  lfoG.gain.value = f0 * 0.55;
  lfo.connect(lfoG);
  lfoG.connect(osc.frequency);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  osc.connect(gain);
  gain.connect(a.destination);
  osc.start(t);
  lfo.start(t);
  osc.stop(t + 0.32);
  lfo.stop(t + 0.32);
}

const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0];

function marimbaSynth(a, f) {
  const t = a.currentTime;
  const base = PENTA[(Math.random() * PENTA.length) | 0] * f;
  for (const [mult, amp, dur] of [[1, 0.24, 0.34], [4, 0.06, 0.13]]) {
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = 'triangle';
    osc.frequency.value = base * mult;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(amp, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(a.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}

function bubbleSynth(a, f) {
  const t = a.currentTime;
  const dur = 0.1;
  const osc = a.createOscillator();
  const gain = a.createGain();
  const f0 = 250 * f * (0.8 + Math.random() * 0.5);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f0 * 2.4, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain);
  gain.connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// Selectable drop-sound styles: each maps to the synth bank used for normal
// drops (a random preset + slight pitch jitter per drop). 'Surprise' is the
// original mixed bag and the default; secrets keep their boom in every style.
export const FX_STYLES = ['Surprise', 'Boing', 'Coins', 'Pop', 'Wobble', 'Marimba', 'Bubble'];

const FX_PRESETS = {
  Surprise: [boingSynth, coinSynth, yPopSynth, bounceSynth],
  Boing: [boingSynth, bounceSynth],
  Coins: [coinSynth, coinSynth, bubbleSynth],
  Pop: [yPopSynth, yPopSynth, bubbleSynth],
  Wobble: [wobbleSynth],
  Marimba: [marimbaSynth, marimbaSynth, coinSynth],
  Bubble: [bubbleSynth, yPopSynth]
};

/**
 * Play a normal drop sound using the selected FX style bank.
 * @param {AudioContext} a
 */
function normalSynth(a) {
  const name = FX_STYLES[state.fxStyle] || 'Surprise';
  const bank = FX_PRESETS[name];
  const f = Math.pow(2, (Math.random() - 0.5) * 0.35);
  bank[(Math.random() * bank.length) | 0](a, f);
}

/**
 * Play a drop sound: a boom (booms array or boomSynth) for secret plushies,
 * otherwise the regular sound bank. Rate limited to once per 70ms.
 * @param {boolean} [secret=false]
 */
export function playSound(secret) {
  if (state.muted) return;
  const now = performance.now();
  if (now - state.lastSoundAt < 70) return;
  state.lastSoundAt = now;
  const a = audio();
  if (secret) {
    if (state.booms.length) {
      const s = state.booms[(Math.random() * state.booms.length) | 0];
      const c = s.cloneNode();
      c.volume = 0.8;
      c.play().catch(() => {});
    } else {
      boomSynth(a, 1);
    }
    return;
  }
  if (state.sounds.length) {
    const s = state.sounds[(Math.random() * state.sounds.length) | 0];
    const c = s.cloneNode();
    c.volume = 0.55;
    c.play().catch(() => {});
  } else {
    normalSynth(a);
  }
}