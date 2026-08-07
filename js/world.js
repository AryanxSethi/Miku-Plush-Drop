/**
 * Miku Plush Drop — world setup, spawning & trimming.
 *
 * Viewport/canvas sizing + DPR auto-tuning, static boundary (floor/walls)
 * construction, dropping a plushy at a click point (rarity pick + pity streaks
 * + toast + collection + sound), and enforcing the MAX_PLUSH cap by removing
 * the oldest dynamic bodies.
 */

import { state, scheduleCollectionSave } from './state.js';
import { DPR_LEVELS, MAX_PLUSH } from './config.js';
import { pickPlush, pickSecret, shouldDropSecret } from './rarity.js';
import { playSound } from './audio.js';
import { showToast, updateCollectionStats } from './ui.js';

/**
 * Apply the current DPR level to the canvas and resize.
 */
export function applyDpr() {
  state.DPR = Math.min(DPR_LEVELS[state.dprIdx], window.devicePixelRatio || 1, 2);
  resize();
}

/**
 * Auto-tune DPR to keep the frame time in a healthy band: drop resolution
 * when frames get slow (>26ms avg), raise it back when there's headroom.
 * @param {number} now
 */
export function tuneDpr(now) {
  const dt = Math.min(now - state.lastFrameAt, 50);
  state.lastFrameAt = now;
  state.tuneAcc += dt;
  state.tuneN++;
  if (now - state.tuneStart < 2000 || state.tuneN < 30) return;
  const avg = state.tuneAcc / state.tuneN;
  if (avg > 26 && state.dprIdx > 0) {
    state.dprIdx--;
    applyDpr();
  } else if (
    avg < 11 &&
    state.dprIdx < DPR_LEVELS.length - 1 &&
    DPR_LEVELS[state.dprIdx] < window.devicePixelRatio
  ) {
    state.dprIdx++;
    applyDpr();
  }
  state.tuneAcc = 0;
  state.tuneN = 0;
  state.tuneStart = now;
}

/**
 * Resize canvas + rebuild bounds bodies to match the new window size.
 * Marks visuals for re-bake and forces a physics re-step.
 */
export function resize() {
  const { canvas, ctx } = state.dom;
  state.W = window.innerWidth;
  state.H = window.innerHeight;
  canvas.width = Math.max(1, Math.round(state.W * state.DPR));
  canvas.height = Math.max(1, Math.round(state.H * state.DPR));
  canvas.style.width = state.W + 'px';
  canvas.style.height = state.H + 'px';
  buildBounds();
  for (const v of state.visuals.values()) v.baked = null;
  state.idle = false;
  state.lastPaint = 0;
  state.physicsDirty = true; // bounds changed, need physics update
}

/**
 * Rebuild the static boundary bodies (floor + left/right walls) sized to the
 * current viewport, removing the old ones first.
 */
export function buildBounds() {
  const { Bodies, Composite, World } = state;
  if (state.ground) Composite.remove(state.engine.world, [state.ground, state.wallL, state.wallR]);
  const opts = { isStatic: true, friction: 0.8, restitution: 0 };
  state.ground = Bodies.rectangle(state.W / 2, state.H + 80, state.W * 3, 160, opts);
  state.wallL = Bodies.rectangle(-80, state.H / 2, 160, state.H * 3, opts);
  state.wallR = Bodies.rectangle(state.W + 80, state.H / 2, 160, state.H * 3, opts);
  Composite.add(state.engine.world, [state.ground, state.wallL, state.wallR]);
}

/**
 * Drop a plushy at viewport coords: pick it, update pity streaks, show a
 * rarity toast, create the Matter body + visual, record collection, play
 * sound, and trim the world to MAX_PLUSH.
 * @param {number} x
 * @param {number} y
 */
export function spawnAt(x, y) {
  const { Bodies, Body, World, Composite } = state;
  if (!state.plushList.length) return;
  const p = shouldDropSecret() ? pickSecret() : pickPlush();
  if (!p) return;
  const isSecret = p.secret;
  const isNew = !(state.collection[p.key] || 0);

  if (isSecret) {
    state.secretStreak = 0;
    if (isNew) state.noNewStreak = 0;
  } else {
    state.secretStreak++;
    state.noNewStreak = isNew ? 0 : state.noNewStreak + 1;
  }

  if (isSecret) {
    showToast('Secret!', 'secret', x, y - 40);
  } else if (p.rarity === 'legendary') {
    showToast('Legendary!', 'legendary', x, y - 40);
  } else if (p.rarity === 'epic') {
    showToast('Epic!', 'epic', x, y - 40);
  } else if (p.rarity === 'rare') {
    showToast('Rare!', 'rare', x, y - 40);
  }

  const w = 64 + Math.random() * 46;
  const h = (w * p.img.height) / p.img.width;
  const body = Bodies.rectangle(x, y, w * 0.94, h * 0.94, {
    friction: 0.7,
    frictionStatic: 1.4,
    frictionAir: 0.02,
    restitution: 0.12,
    density: 0.0018
  });
  const visual = {
    img: p.img,
    w,
    h,
    pitch: (Math.random() - 0.5) * 2.2,
    pitchVel: 0,
    yaw: (Math.random() - 0.5) * 1.6,
    yawVel: 0,
    squash: 0,
    squashVel: 0,
    flip: Math.random() < 0.5,
    glow: p.rarity,
    baked: null,
    bakedSize: 0
  };
  state.visuals.set(body, visual);
  Body.setVelocity(body, {
    x: (Math.random() - 0.5) * 3,
    y: -(2.5 + Math.random() * 3)
  });
  Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.4);
  World.add(state.engine.world, body);
  state.dropped++;
  state.dom.countEl.textContent = state.dropped;

  state.collection[p.key] = (state.collection[p.key] || 0) + 1;
  scheduleCollectionSave();
  updateCollectionStats(); // fast stats update, no full grid rebuild

  playSound(isSecret);
  trim();

  state.physicsDirty = true; // new body, need physics steps
}

/**
 * Enforce MAX_PLUSH by removing the oldest dynamic bodies (and their visuals)
 * until the live count fits. Removed bodies stay referenced in the engine's
 * pair table — handled by the pair cap in game.js step() and clear button.
 */
export function trim() {
  const { Composite, World } = state;
  const dynamic = Composite.allBodies(state.engine.world).filter((b) => !b.isStatic);
  while (dynamic.length > MAX_PLUSH) {
    const b = dynamic.shift();
    World.remove(state.engine.world, b);
    state.visuals.delete(b);
  }
}