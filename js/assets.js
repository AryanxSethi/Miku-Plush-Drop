/**
 * Miku Plush Drop — asset loading.
 *
 * Loads plush PNGs (patterned `plush_<n>.png` + secret basenames) into
 * `state.plushList`, loads drop/boom audio files, and provides canvas-drawn
 * fallback plushies if no PNGs load at all. All files come via the local HTTP
 * server, so serve the folder over HTTP (not file://).
 */

import { state } from './state.js';
import { SECRET_PLUSHES } from './config.js';
import { assignRarities } from './rarity.js';

/**
 * Load an image, resolving null on failure so loaders keep going.
 * @param {string} url
 * @returns {Promise<HTMLImageElement|null>}
 */
function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Load an HTMLAudioElement, resolving null on failure.
 * @param {string} url
 * @returns {Promise<HTMLAudioElement|null>}
 */
function loadAudio(url) {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = 'auto';
    a.onloadeddata = () => resolve(a);
    a.onerror = () => resolve(null);
    a.src = url;
  });
}

/**
 * Load all plush PNGs (patterned via plush_<n>.png and secret basenames) into
 * the shared plushList. Falls back to generated canvas plushies if nothing
 * loads, then assigns rarities.
 */
export async function loadPlushImages() {
  const patterns = [];
  for (let i = 1; i <= 110; i++) {
    patterns.push(
      `images/plush_${i}.png`,
      `images/plush${i}.png`,
      `assets/plush/plush_${i}.png`,
      `assets/plush/plush${i}.png`
    );
  }
  for (const url of patterns) {
    const img = await loadImage(url);
    if (img) state.plushList.push({ img, key: url, rarity: null });
  }
  for (const name of SECRET_PLUSHES) {
    const img = await loadImage(`images/${name}.png`) || await loadImage(`assets/plush/${name}.png`);
    if (img) state.plushList.push({ img, key: `images/${name}.png`, rarity: 'secret', secret: true });
  }
  if (!state.plushList.length) makeFallbackPlushes();
  assignRarities();
}

/**
 * Load drop sounds (into state.sounds) and any secret "boom" file (into
 * state.booms). Cross-trains all audio formats so a single present file
 * satisfies it.
 */
export async function loadSounds() {
  const exts = ['mp3', 'wav', 'ogg', 'm4a'];
  const names = ['drop', 'pop', 'plush', 'miku', 'sound', 'boing'];
  for (const name of names) {
    for (const ext of exts) {
      const a = await loadAudio(`assets/sound/${name}.${ext}`);
      if (a) state.sounds.push(a);
    }
  }
  for (const ext of exts) {
    const a = await loadAudio(`assets/sound/boom.${ext}`);
    if (a) state.booms.push(a);
  }
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