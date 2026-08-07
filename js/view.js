/**
 * Miku Plush Drop — rendering.
 *
 * Glow halo sprites (palette-driven per rarity + the animated rainbow secret
 * halo), the per-plush pseudo-3D draw with tumbling/swashing transforms, baked
 * sprites for sleeping plushies, and the full scene draw.
 */

import { state } from './state.js';
import { GLOW_PALETTE, GLOW_SCALE } from './config.js';

/**
 * Get the cached glow halo sprite for a rarity. Secrets use the animated
 * rainbow halo (getSecretHalo) rather than the palette-based one.
 * @param {string} rarity
 * @returns {HTMLCanvasElement}
 */
function getHalo(rarity) {
  if (rarity === 'secret') return getSecretHalo();
  if (!state.haloCache[rarity]) {
    const c = GLOW_PALETTE[rarity] || GLOW_PALETTE.common;
    const h = document.createElement('canvas');
    h.width = 128;
    h.height = 128;
    const g = h.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 6, 64, 64, 64);
    grad.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`);
    grad.addColorStop(1, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    state.haloCache[rarity] = h;
  }
  return state.haloCache[rarity];
}

/**
 * Build an animated rainbow halo for secret plushies. The hue is stepped in
 * 4 phase buckets (90-degree steps) to animate cheaply while still caching;
 * a radial mask feathers it to a soft translucent glow. Not palette-driven.
 * @returns {HTMLCanvasElement}
 */
function getSecretHalo() {
  const bucket = Math.round((performance.now() * 0.06) / 90) % 4;
  if (state.secretHaloCache[bucket]) return state.secretHaloCache[bucket];
  const h = document.createElement('canvas');
  h.width = 128;
  h.height = 128;
  const g = h.getContext('2d');
  g.translate(64, 64);
  const base = ((bucket * 90) % 360) + 360;
  const grad = g.createLinearGradient(-64, -64, 64, 64);
  for (let i = 0; i <= 6; i++) {
    const hue = (base + i * 60) % 360;
    grad.addColorStop(i / 6, `hsla(${hue}, 90%, 60%, 0.75)`);
  }
  g.fillStyle = grad;
  g.fillRect(-64, -64, 128, 128);
  g.globalCompositeOperation = 'destination-in';
  const mask = g.createRadialGradient(0, 0, 6, 0, 0, 64);
  mask.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  mask.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = mask;
  g.fillRect(-64, -64, 128, 128);
  state.secretHaloCache[bucket] = h;
  return h;
}

/**
 * Render one plushy into a 2D context with pseudo-3D tumbling: an elliptical
 * shadow, then the img transformed by pitch/yaw/squash with its glow halo.
 * @param {CanvasRenderingContext2D} g
 * @param {object} body Matter body (for angle)
 * @param {object} v visual state
 * @param {number} x centred x
 * @param {number} y centred y
 */
function drawPlushAt(g, body, v, x, y) {
  const flat = Math.max(Math.abs(Math.cos(v.pitch)), Math.abs(Math.cos(v.yaw)));
  g.fillStyle = 'rgba(31, 95, 92, 0.14)';
  g.beginPath();
  g.ellipse(
    x,
    y + v.h * (0.3 + (1 - flat) * 0.18),
    v.w * 0.5 * (0.8 + (1 - flat) * 0.5),
    v.w * 0.5 * (0.26 + (1 - flat) * 0.16),
    0,
    0,
    Math.PI * 2
  );
  g.fill();

  g.save();
  g.translate(x, y);
  const depth = 1 + (y / Math.max(state.H, 1)) * 0.05;
  g.scale(depth, depth);
  g.rotate(body.angle);
  const cy = Math.abs(Math.cos(v.yaw));
  const cp = Math.abs(Math.cos(v.pitch));
  const sx = 1 + v.squash;
  const sy = 1 - v.squash * 0.8;
  g.transform(cy * sx * (v.flip ? -1 : 1), 0, Math.sin(v.yaw) * cp * 0.85, cp * sy, 0, 0);
  const s = GLOW_SCALE[v.glow] || 1;
  g.drawImage(getHalo(v.glow), -v.w * 0.75 * s, -v.h * 0.75 * s, v.w * 1.5 * s, v.h * 1.5 * s);
  g.drawImage(v.img, -v.w / 2, -v.h / 2, v.w, v.h);
  g.restore();
}

/**
 * Bake a sleeping plushy's final appearance (glow + image at rest) into an
 * offscreen canvas so sleeping bodies cost a single drawImage per frame.
 * @param {object} body
 * @param {object} v visual state (gains .baked / .bakedSize)
 */
function bakeVisual(body, v) {
  const pad = 14;
  const size = Math.ceil(Math.max(v.w, v.h) * 2.4) + pad * 2;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  g.translate(size / 2, size / 2);
  drawPlushAt(g, body, v, 0, 0);
  v.baked = c;
  v.bakedSize = size;
}

/**
 * Draw the full scene: clear canvas, then draw each body back-to-front.
 * Sleeping bodies use their baked sprite; awake ones render live with
 * tumbling transforms.
 * @param {Array<{b: object, v: object}>} list
 */
export function draw(list) {
  const { ctx } = state.dom;
  const { DPR, W, H } = state;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  for (const { b, v } of list) {
    const x = b.position.x;
    const y = b.position.y;
    if (b.isSleeping) {
      if (!v.baked) bakeVisual(b, v);
      ctx.drawImage(v.baked, x - v.bakedSize / 2, y - v.bakedSize / 2);
      continue;
    }
    drawPlushAt(ctx, b, v, x, y);
  }
}