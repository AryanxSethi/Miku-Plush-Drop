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
import { loadPlushImages } from './assets.js';
import { updateCollectionStats, renderCollectionGrid, setPanel } from './ui.js';
import { spawnAt, resize } from './world.js';
import { frame, wireCollisions } from './game.js';
import { loadLS, saveLS } from './storage.js';
import { DPR_LEVELS } from './config.js';
import { FX_STYLES } from './audio.js';

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
  scrollTopBtn,
  fxBtn,
  themeBtn
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

// Theme: always starts light; the pill toggles and persists the choice.
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeBtn.textContent = theme === 'dark' ? 'Theme: Dark' : 'Theme: Light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0e232b' : '#39c5bb');
}

themeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  saveLS('miku-plush-theme', next);
  applyTheme(next);
});

// Drop-sound style: cycle through the FX bank, persisted across visits.
let fxIdx = Math.min(Math.max(parseInt(loadLS('miku-plush-fx', 0), 10) || 0, 0), FX_STYLES.length - 1);
state.fxStyle = fxIdx;
fxBtn.textContent = 'Fx: ' + FX_STYLES[fxIdx];

fxBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fxIdx = (fxIdx + 1) % FX_STYLES.length;
  state.fxStyle = fxIdx;
  fxBtn.textContent = 'Fx: ' + FX_STYLES[fxIdx];
  saveLS('miku-plush-fx', fxIdx);
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

// Show the scroll-to-top button once the grid is scrolled well down. The
// visible class drives a CSS fade/slide transition (see .scroll-top).
scrollEl.addEventListener('scroll', () => {
  const first = gridEl.firstElementChild;
  const rowH = first ? first.offsetWidth + 12 : 112;
  scrollTopBtn.classList.toggle('visible', scrollEl.scrollTop >= rowH * 10);
});

scrollTopBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
});

// Main interaction: clicking anywhere (outside UI panels/buttons) drops a
// plushy; clicking the collect button toggles the panel; Escape closes it.
// Clicks made while plushies are still loading are queued and flushed once
// the sprites arrive, so the page is usable from first paint.
const dropQueue = [];

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
  if (!state.ready) {
    dropQueue.push({ x: e.clientX, y: e.clientY });
    return;
  }
  spawnAt(e.clientX, e.clientY);
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setPanel(false);
});

window.addEventListener('resize', resize);

// ---------- Tooltips (hover ≥ 2s) ----------
// One shared tooltip div, repositioned over whatever button is hovered. The
// 2s delay is enforced with a timer that is cancelled on mouseleave/click.
const tooltip = document.createElement('div');
tooltip.className = 'tooltip';
tooltip.hidden = true;
document.body.appendChild(tooltip);

let tipTimer = 0;

function showTooltip(el) {
  const tip = el.getAttribute('data-tip');
  if (!tip) return;
  tooltip.textContent = tip;
  tooltip.hidden = false;
  const r = el.getBoundingClientRect();
  tooltip.style.left = Math.round(r.left + r.width / 2) + 'px';
  tooltip.style.top = Math.round(r.top - 8) + 'px';
}

function hideTooltip() {
  if (tipTimer) {
    clearTimeout(tipTimer);
    tipTimer = 0;
  }
  tooltip.hidden = true;
}

document.addEventListener('mouseover', (e) => {
  const el = e.target.closest('[data-tip]');
  if (!el) return;
  hideTooltip();
  tipTimer = setTimeout(() => showTooltip(el), 2000);
});

document.addEventListener('mouseout', (e) => {
  const el = e.target.closest('[data-tip]');
  if (!el || el.contains(e.relatedTarget)) return;
  hideTooltip();
});

document.addEventListener('pointerdown', (e) => {
  if (e.target.closest('[data-tip]')) hideTooltip();
});

// ---------- First-boot credit notice ----------
// "All images are property of their respective creators" — shown once, as a
// second line inside the drop hint (never a separate element, so the two can
// not overlap). Remembered in localStorage; the line drops off after 8s.
function setupHint() {
  if (loadLS('miku-plush-credit-seen', false)) return;
  saveLS('miku-plush-credit-seen', true);
  const credit = document.createElement('span');
  credit.className = 'credit';
  credit.textContent = 'All images are property of their respective creators.';
  hintEl.appendChild(credit);
  setTimeout(() => credit.remove(), 8000);
}

/**
 * Boot sequence: wire collisions, size canvas, start rendering immediately,
 * then load images progressively. The animation loop never waits on assets —
 * the game unlocks as soon as the first batch of plushies is ready (clicks
 * made before that are queued and flushed), and the remaining images stream
 * in the background. When the pool finishes growing the collection stats and
 * grid refresh once more.
 */
export async function init() {
  state.DPR = Math.min(DPR_LEVELS[state.dprIdx], window.devicePixelRatio || 1, 2);
  wireCollisions();
  resize();
  applyTheme(loadLS('miku-plush-theme', 'light'));
  setupHint();
  state.ready = false;

  const pill = document.createElement('div');
  pill.className = 'loading-pill';
  pill.textContent = 'Loading plushies\u2026';
  document.body.appendChild(pill);

  // First frame now — HUD, hint and physics render before any asset is ready.
  requestAnimationFrame(frame);

  // Unlock after the first chunk so early clicks never feel blocked; refresh
  // stats as the rest streams in.
  let unlocked = false;
  await loadPlushImages((done, total) => {
    if (!unlocked && done >= 8) {
      unlocked = true;
      pill.remove();
      state.ready = true;
      updateCollectionStats();
      while (dropQueue.length) {
        const d = dropQueue.shift();
        spawnAt(d.x, d.y);
      }
    }
    if (state.ready) updateCollectionStats();
  });

  // Pool fully grown (or stream finished) — final refresh + grid render.
  if (!unlocked) {
    unlocked = true;
    pill.remove();
    state.ready = true;
  }
  updateCollectionStats();
  renderCollectionGrid();
  while (dropQueue.length) {
    const d = dropQueue.shift();
    spawnAt(d.x, d.y);
  }
}

init();