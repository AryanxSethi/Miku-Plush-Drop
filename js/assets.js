/**
 * Miku Plush Drop — asset loading.
 *
 * Loads plush PNGs (patterned `plush_<n>.png` under images/) into
 * `state.plushList` and provides canvas-drawn fallback plushies if no PNGs
 * load at all. Only requests files that actually exist — patterned plushies
 * come from `images/plush_1.png … images/plush_PLUSH_COUNT.png` and secrets
 * from `images/<name>.png` — so no probe URLs 404 in the console.
 *
 * Loading is parallel: files are fetched with a small concurrency cap, so
 * the game becomes playable after a handful of round trips.
 */

import { state } from './state.js';
import { SECRET_PLUSHES, PLUSH_COUNT } from './config.js';
import { assignRarities } from './rarity.js';

/** Max concurrent image fetches (keeps the request spike polite). */
const MAX_CONCURRENCY = 16;

/**
 * Load an image, resolving null on failure so loaders keep going.
 * @param {string} url
 * @returns {Promise<HTMLImageElement|null>}
 */
function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Run async tasks with at most MAX_CONCURRENCY in flight at once, preserving
 * completion order. Resolves when every task has settled.
 * @param {Array<() => Promise<T|null>>} tasks
 * @returns {Promise<Array<T|null>>}
 * @template T
 */
async function mapPooled(tasks) {
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  }
  const n = Math.min(MAX_CONCURRENCY, tasks.length);
  await Promise.all(Array.from({ length: n }, worker));
  return results;
}

/**
 * Load all plush PNGs progressively, in chunks, into the shared plushList.
 * `onProgress(done, total)` is invoked after every chunk so the caller can
 * unblock the game the moment a usable subset is ready and let the rest
 * stream in — the game never waits for the full (~38 MB) download. Rarities
 * are (re)assigned per chunk so picks always have valid tiers; secrets keep
 * their 'secret' tier and are hidden until collected. Falls back to generated
 * canvas plushies if nothing loads at all.
 * @param {(done: number, total: number) => void} [onProgress]
 * @returns {Promise<number>} number of plushies in the pool
 */
export async function loadPlushImages(onProgress) {
  const urls = [];
  for (let i = 1; i <= PLUSH_COUNT; i++) {
    urls.push(`images/plush_${i}.png`);
  }
  for (const name of SECRET_PLUSHES) {
    urls.push(`images/${name}.png`);
  }

  const CHUNK = 8;
  for (let start = 0; start < urls.length; start += CHUNK) {
    const chunk = urls.slice(start, start + CHUNK);
    const settled = await mapPooled(chunk.map((url) => () => loadImage(url)));
    for (let j = 0; j < chunk.length; j++) {
      const img = settled[j];
      if (!img) continue;
      const idx = start + j;
      const isSecret = idx >= PLUSH_COUNT;
      state.plushList.push({
        img,
        key: urls[idx],
        rarity: isSecret ? 'secret' : null,
        secret: isSecret
      });
    }
    // (Re)assign rarities as the pool grows so spawns have valid tiers.
    assignRarities();
    if (onProgress) onProgress(state.plushList.length, urls.length);
  }

  if (!state.plushList.length) makeFallbackPlushes();
  return state.plushList.length;
}

/**
 * Generate simple canvas-drawn Miku plushies if no PNGs loaded at all, so
 * the site still works offline/misconfigured. Each carries a dataUrl so the
 * collection grid can render the canvas as an <img>.
 */
export function makeFallbackPlushes() {
  const variants = [
    { body: '#ffc9d6', hair: '#39c5bb', accent: '#ff8fb0' },
    { body: '#d6f6f3', hair: '#ff9ec3', accent: '#2fb3a8' }
  ];
  let idx = 0;
  for (const pal of variants) {
    const c = document.createElement('canvas');
    c.width = 220;
    c.height = 220;
    const g = c.getContext('2d');

    g.fillStyle = pal.hair;
    g.beginPath();
    g.moveTo(60, 72);
    g.bezierCurveTo(8, 82, 28, 212, 55, 216);
    g.bezierCurveTo(92, 216, 96, 122, 86, 76);
    g.fill();
    g.beginPath();
    g.moveTo(160, 72);
    g.bezierCurveTo(212, 82, 192, 212, 165, 216);
    g.bezierCurveTo(128, 216, 124, 122, 134, 76);
    g.fill();

    g.fillStyle = pal.hair;
    g.beginPath();
    g.moveTo(57, 92);
    g.lineTo(82, 96);
    g.lineTo(70, 120);
    g.lineTo(96, 100);
    g.lineTo(104, 122);
    g.lineTo(124, 100);
    g.lineTo(138, 118);
    g.lineTo(150, 94);
    g.lineTo(163, 92);
    g.lineTo(110, 46);
    g.closePath();
    g.fill();

    g.fillStyle = pal.body;
    g.beginPath();
    g.arc(110, 96, 52, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(110, 186, 46, 44, 0, Math.PI, 0);
    g.fill();

    g.fillStyle = '#3d3d4a';
    g.beginPath();
    g.arc(88, 104, 4, 0, Math.PI * 2);
    g.arc(132, 104, 4, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = '#3d3d4a';
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(110, 112, 14, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();

    g.fillStyle = pal.accent;
    g.globalAlpha = 0.5;
    g.beginPath();
    g.ellipse(74, 116, 10, 6, 0, 0, Math.PI * 2);
    g.ellipse(146, 116, 10, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;

    g.strokeStyle = pal.accent;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(110, 46);
    g.quadraticCurveTo(110, 30, 122, 27);
    g.stroke();

    const dataUrl = c.toDataURL(); // cache data URL
    state.plushList.push({ img: c, key: 'fallback-' + idx, rarity: null, dataUrl });
    idx++;
  }
}