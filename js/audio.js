/**
 * Miku Plush Drop — WebAudio synthesis.
 *
 * Lazily-created AudioContext plus a small bank of synth "drop" presets
 * (boing / coin / Y-pop / bounce) and a heftier secret "boom". These backstop
 * the game when no audio files are present; playSound prefers real files when
 * they exist and rate-limits playback.
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

// List of synth functions cycled for normal drops when no sound files exist.
const SYNTH_PRESETS = [boingSynth, coinSynth, yPopSynth, bounceSynth];

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
    const f = Math.pow(2, (Math.random() - 0.5) * 0.35);
    SYNTH_PRESETS[(Math.random() * SYNTH_PRESETS.length) | 0](a, f);
  }
}