/**
 * Miku Plush Drop — shared runtime state.
 *
 * Single module of truth consumed by every other module. Holds DOM element
 * references, the Matter.js engine, and all mutable per-session state:
 * viewport size, counters, pity streaks, idle flags, asset caches, and the
 * persisted collection. Also owns the debounced localStorage persistence for
 * the collection (flushed on page unload).
 *
 * Since this module owns the shared mutable state, the rest of the app imports
 * `state` and mutates / reads its properties — preserving the behaviour of the
 * original single-file build without cross-module live-binding quirks.
 */

import { loadLS, saveLS } from './storage.js';
import { DPR_LEVELS } from './config.js';

/** DOM element references (gathered once at boot). */
export const dom = {
  canvas: document.getElementById('game'),
  ctx: document.getElementById('game').getContext('2d'),
  countEl: document.getElementById('count'),
  collectBtn: document.getElementById('collectBtn'),
  collectCount: document.getElementById('collectCount'),
  collectTotal: document.getElementById('collectTotal'),
  clearBtn: document.getElementById('clearBtn'),
  muteBtn: document.getElementById('muteBtn'),
  hintEl: document.getElementById('hint'),
  panelEl: document.getElementById('collection'),
  gridEl: document.getElementById('collectionGrid'),
  scrollEl: document.getElementById('collectionScroll'),
  resetCollectBtn: document.getElementById('resetCollect'),
  progressBar: document.getElementById('progressBar'),
  collectCloseBtn: document.getElementById('collectClose'),
  scrollTopBtn: document.getElementById('scrollTopBtn'),
  progressCount: document.getElementById('progressCount'),
  progressTotal: document.getElementById('progressTotal')
};

const { Engine, World, Bodies, Body, Composite, Pairs, Events } = Matter;

/** The physics world. enableSleeping lets settled plushies sleep (cheap);
 *  note that sleeping pairs are never auto-pruned by Matter 0.19, which the
 *  pair-table cap in game.js step() compensates for. */
const engine = Engine.create();
engine.enableSleeping = true;
engine.sleepThreshold = 50;
engine.positionIterations = 6;

/** Live, shared, mutable game state. */
export const state = {
  dom,
  engine,
  Matter,
  Engine,
  World,
  Bodies,
  Body,
  Composite,
  Pairs,
  Events,

  // Viewport size (CSS px) + active device-pixel-ratio scale
  W: 0,
  H: 0,
  DPR: 1,

  // Static boundary bodies
  ground: null,
  wallL: null,
  wallR: null,

  // Counters / flags
  dropped: 0,
  muted: false,
  idle: false,
  actx: null, // Lazily-created AudioContext

  // DPR auto-tuning
  lastPaint: 0,
  lastStep: performance.now(),
  lastSoundAt: 0,
  tuneAcc: 0,
  tuneN: 0,
  tuneStart: performance.now(),
  lastFrameAt: performance.now(),
  dprIdx: DPR_LEVELS.length - 1,

  // Rarity pity streaks
  noNewStreak: 0,
  secretStreak: 0,

  // Performance / rebuild flags
  physicsDirty: true,
  gridDirty: true,

  // Data stores
  plushList: [],       // All loaded plushies (image + key + rarity)
  sounds: [],          // Loaded normal drop sounds
  booms: [],           // Loaded secret "boom" sounds
  visuals: new Map(),  // body -> visual state
  haloCache: {},       // rarity -> pre-built glow halo canvas
  secretHaloCache: {}, // phase bucket -> animated rainbow halo canvas
  collection: loadLS('miku-plush-collection', {}) // key -> drop count
};

// Debounced persistence for the collection so rapid drops don't write to
// localStorage (synchronous) on every single click. Flushed on page unload.
let collectSaveTimer = 0;

/**
 * Schedule a debounced write of the collection to localStorage.
 */
export function scheduleCollectionSave() {
  if (collectSaveTimer) return;
  collectSaveTimer = setTimeout(() => {
    collectSaveTimer = 0;
    saveLS('miku-plush-collection', state.collection);
  }, 500);
}

/**
 * Flush any pending collection write immediately (used on page unload).
 */
export function flushCollectionSave() {
  if (collectSaveTimer) {
    clearTimeout(collectSaveTimer);
    collectSaveTimer = 0;
    saveLS('miku-plush-collection', state.collection);
  }
}
window.addEventListener('beforeunload', flushCollectionSave);