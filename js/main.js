/**
 * Miku Plush Drop — entry point & event wiring.
 *
 * Loaded last as the ES-module entry (`<script type="module" src="js/main.js">`).
 * Reads DOM refs from shared state, wires every user interaction (drop,
 * collection panel, clear, mute, reset, scroll helpers, keyboard, resize), and
 * runs the async boot sequence that loads assets, populates the collection
 * panel, and starts the animation loop.
 */

import { state } from './state.js';
import { loadPlushImages, loadSounds } from './assets.js';
import { updateCollectionStats, renderCollectionGrid, setPanel } from './ui.js';
import { spawnAt, resize } from './world.js';
import { frame, wireCollisions } from './game.js';
import { saveLS } from './storage.js';
import { DPR_LEVELS } from './config.js';

const {
  countEl,
  clearBtn,
  muteBtn,
  hintEl,
  panelEl,
  gridEl,
  scrollEl,
  resetCollectBtn,
  collectCloseBtn,
  scrollTopBtn
} = state.dom;

// Clear pile: remove every dynamic body + visual and reset pair table, drop
// count, idle state, and canvas so the world is cleanly empty.
clearBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  for (const b of state.Composite.allBodies(state.engine.world)) {
    if (!b.isStatic) state.World.remove(state.engine.world, b);
  }
  state.visuals.clear();
  state.Pairs.clear(state.engine.pairs);
  state.dropped = 0;
  countEl.textContent = 0;
  state.idle = false;
  state.lastPaint = 0;
  state.physicsDirty = true;
  // Immediately clear canvas (force step will do it, but set dirty to ensure frame runs)
  const { ctx } = state.dom;
  ctx.setTransform(state.DPR, 0, 0, state.DPR, 0, 0);
  ctx.clearRect(0, 0, state.W, state.H);
});

// Toggle sound on/off, persisting nothing (session-only).
muteBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  state.muted = !state.muted;
  muteBtn.textContent = state.muted ? 'Sound off' : 'Sound on';
  muteBtn.classList.toggle('off', state.muted);
});

collectCloseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  setPanel(false);
});

// Reset collection: wipe persisted collection, refresh stats + grid.
resetCollectBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  state.collection = {};
  saveLS('miku-plush-collection', state.collection);
  updateCollectionStats();
  renderCollectionGrid();
});

// Show the scroll-to-top button once the grid is scrolled well down.
scrollEl.addEventListener('scroll', () => {
  const first = gridEl.firstElementChild;
  const rowH = first ? first.offsetWidth + 12 : 112;
  scrollTopBtn.hidden = scrollEl.scrollTop < rowH * 10;
});

scrollTopBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
});

// Main interaction: clicking anywhere (outside UI panels/buttons) drops a
// plushy; clicking the collect button toggles the panel; Escape closes it.
window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('#collectBtn')) {
    e.stopPropagation();
    setPanel(!panelEl.classList.contains('open'));
    return;
  }
  if (e.target.closest('.pill, .collection')) return;
  if (panelEl.classList.contains('open')) {
    setPanel(false);
    return;
  }
  hintEl.classList.add('used');
  spawnAt(e.clientX, e.clientY);
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setPanel(false);
});

window.addEventListener('resize', resize);

/**
 * Boot sequence: wire collisions, size canvas, load images + sounds, populate
 * collection stats and grid, then start the animation loop.
 */
export async function init() {
  state.DPR = Math.min(DPR_LEVELS[state.dprIdx], window.devicePixelRatio || 1, 2);
  wireCollisions();
  resize();
  await Promise.all([loadPlushImages(), loadSounds()]);
  updateCollectionStats();
  renderCollectionGrid();
  requestAnimationFrame(frame);
}

init();