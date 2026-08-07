/**
 * Miku Plush Drop — UI helpers.
 *
 * Floating rarity toasts, the collection stats bar, the lazily-rebuilt 5-column
 * collection grid, and the open/close panel controller. Reads shared state and
 * writes DOM through the `dom` refs held in state.
 */

import { state } from './state.js';
import { RARITY_TIERS, RARITY_ORDER } from './config.js';

/**
 * Sort plushies for the collection grid: by rarity (RARITY_ORDER, highest
 * first) then by numeric key suffix, falling back to a string compare.
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
function raritySort(a, b) {
  const ra = RARITY_ORDER.indexOf(a.rarity);
  const rb = RARITY_ORDER.indexOf(b.rarity);
  if (ra !== rb) return ra - rb;
  const na = a.key.match(/(\d+)/);
  const nb = b.key.match(/(\d+)/);
  if (na && nb) return parseInt(na[1], 10) - parseInt(nb[1], 10);
  return a.key.localeCompare(b.key);
}

/**
 * Spawn a floating rarity toast at a screen position. Secret toasts live
 * longer to match their longer pulse animation.
 * @param {string} text
 * @param {string} cls css class suffix (e.g. 'legendary' -> .toast.legendary)
 * @param {number} x
 * @param {number} y
 */
export function showToast(text, cls, x, y) {
  const el = document.createElement('div');
  el.className = 'toast ' + cls;
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), cls === 'secret' ? 2400 : 1300);
}

/**
 * Update the collection count/total/progress UI. Undiscovered secrets are
 * excluded from the totals until first collected. Cheap — marks the grid
 * dirty for a full rebuild only when the panel next opens.
 */
export function updateCollectionStats() {
  let got = 0;
  let total = 0;
  for (const p of state.plushList) {
    if (p.secret && !(state.collection[p.key] || 0)) continue;
    total++;
    if ((state.collection[p.key] || 0) > 0) got++;
  }
  const { collectCount, collectTotal, progressCount, progressTotal, progressBar } = state.dom;
  collectCount.textContent = got;
  collectTotal.textContent = total;
  progressCount.textContent = got;
  progressTotal.textContent = total;
  progressBar.style.width = total ? Math.round((got / total) * 100) + '%' : '0%';
  state.gridDirty = true; // mark grid for rebuild
}

/**
 * Rebuild the collection grid DOM (called lazily when panel opens). Collected
 * pluesies show their image + count badge; uncollected show a grey "?" tile;
 * undiscovered secrets are omitted entirely.
 */
export function renderCollectionGrid() {
  const { gridEl } = state.dom;
  gridEl.innerHTML = '';
  for (const p of state.plushList.slice().sort(raritySort)) {
    const seen = (state.collection[p.key] || 0) > 0;
    if (p.secret && !seen) continue;
    const tile = document.createElement('div');
    tile.className = 'tile' + (seen ? ' seen' : ' unseen') + ' ' + p.rarity;

    const badge = document.createElement('span');
    badge.className = 'tile-badge ' + p.rarity;
    badge.textContent = RARITY_TIERS[p.rarity].label;
    tile.appendChild(badge);

    if (seen) {
      const img = document.createElement('img');
      img.alt = '';
      // Use cached dataUrl for canvas fallbacks
      img.src = typeof p.img.src === 'string' ? p.img.src : p.dataUrl;
      tile.appendChild(img);
      if (state.collection[p.key] > 1) {
        const n = document.createElement('span');
        n.className = 'tile-count';
        n.textContent = '\u00d7' + state.collection[p.key];
        tile.appendChild(n);
      }
    } else {
      const q = document.createElement('span');
      q.className = 'tile-q';
      q.textContent = '?';
      tile.appendChild(q);
    }
    gridEl.appendChild(tile);
  }
  state.gridDirty = false;
}

/**
 * Open/close the collection panel; rebuilds the grid lazily on open if dirty.
 * @param {boolean} open
 */
export function setPanel(open) {
  const { panelEl, scrollEl } = state.dom;
  panelEl.classList.toggle('open', open);
  if (open) {
    scrollEl.scrollTop = 0;
    if (state.gridDirty) renderCollectionGrid();
  }
}