/**
 * Miku Plush Drop — rarity assignment & drop picking.
 *
 * Assigns a rarity to every loaded plush (overrides > persisted > proportional
 * fill), computes per-plush weights, and picks the next plushy to drop —
 * honouring the normal pity (PITY_DROPS) and the secret logic (1/1000 roll,
 * SECRET_PITY dry streak). Reads/writes the shared state module.
 */

import { state } from './state.js';
import {
  RARITY_TIERS,
  RARITY_OVERRIDES,
  PLUSH_WEIGHTS,
  RARITY_TARGETS,
  PITY_DROPS,
  SECRET_CHANCE,
  SECRET_PITY
} from './config.js';
import { loadLS, saveLS, normKey } from './storage.js';

/**
 * Assign a rarity to every loaded plush. Order of precedence:
 *   1. RARITY_OVERRIDES (always wins)
 *   2. Persisted per-plush rarity (keeps tiers stable across reloads)
 *   3. Proportional fill from RARITY_TARGETS (guarantees every tier ≥ 1,
 *      exact counts via round-robin correction of the scaled totals)
 * Secret plushies are skipped entirely — they keep their 'secret' rarity.
 */
export function assignRarities() {
  const stored = loadLS('miku-plush-rarity', {});
  const unassigned = [];
  for (const p of state.plushList) {
    if (p.secret) continue;
    const pk = normKey(p.key);
    let rarity = null;
    for (const ok of Object.keys(RARITY_OVERRIDES)) {
      if (normKey(ok) === pk && RARITY_TIERS[RARITY_OVERRIDES[ok]]) {
        rarity = RARITY_OVERRIDES[ok];
        break;
      }
    }
    if (!rarity) {
      for (const sk of Object.keys(stored)) {
        if (normKey(sk) === pk && RARITY_TIERS[stored[sk]]) {
          rarity = stored[sk];
          break;
        }
      }
    }
    p.rarity = rarity;
    if (!rarity) unassigned.push(p);
  }
  if (!unassigned.length) return;

  // Distribute rarities proportionally to the unassigned count,
  // ensuring every non-legendary tier appears at least once (if possible)
  const totalTargets = Object.values(RARITY_TARGETS).reduce((a, b) => a + b, 0);
  const count = unassigned.length;
  const fresh = {};

  // Build a queue based on scaled targets, but guarantee at least 1 of each
  const queue = [];
  const tierNames = Object.keys(RARITY_TARGETS);
  let remaining = count;

  // First pass: assign at least 1 to each tier if there are enough plushies
  for (const name of tierNames) {
    if (remaining <= 0) break;
    queue.push(name);
    remaining--;
  }

  // Second pass: distribute the rest proportionally
  if (remaining > 0 && totalTargets > 0) {
    const scaled = {};
    for (const name of tierNames) {
      scaled[name] = Math.round((RARITY_TARGETS[name] / totalTargets) * remaining);
    }
    const scaledTotal = Object.values(scaled).reduce((a, b) => a + b, 0);
    let miss = remaining - scaledTotal;
    while (miss > 0) {
      for (const name of tierNames) {
        if (miss <= 0) break;
        scaled[name]++;
        miss--;
      }
    }
    while (miss < 0) {
      for (const name of tierNames) {
        if (miss >= 0) break;
        if (scaled[name] > 0) {
          scaled[name]--;
          miss++;
        }
      }
    }
    for (const name of tierNames) {
      for (let i = 0; i < scaled[name]; i++) queue.push(name);
    }
  }

  // Shuffle unassigned
  for (let i = unassigned.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const tmp = unassigned[i];
    unassigned[i] = unassigned[j];
    unassigned[j] = tmp;
  }

  for (const p of unassigned) {
    const tier = queue.shift() || 'common'; // fallback
    p.rarity = tier;
    fresh[p.key] = tier;
  }
  saveLS('miku-plush-rarity', Object.assign({}, stored, fresh));
}

/**
 * Per-plush weight multiplier (from PLUSH_WEIGHTS, basename-matched),
 * defaulting to 1 for anything unlisted.
 * @param {object} p plush entry
 * @returns {number}
 */
function plushWeight(p) {
  const pk = normKey(p.key);
  for (const ok of Object.keys(PLUSH_WEIGHTS)) {
    if (normKey(ok) === pk) {
      const v = Number(PLUSH_WEIGHTS[ok]);
      return isFinite(v) ? Math.max(0, v) : 1;
    }
  }
  return 1;
}

/**
 * Pick a non-secret plushy via weighted random selection. If the normal pity
 * threshold has been reached (PITY_DROPS without a new plush) the pool is
 * narrowed to plushies not yet collected.
 * @returns {object} plush entry
 */
export function pickPlush() {
  let pool = state.plushList.filter((p) => !p.secret);
  const allCollected = pool.every((p) => (state.collection[p.key] || 0) > 0);
  if (!allCollected && state.noNewStreak >= PITY_DROPS) {
    pool = pool.filter((p) => !(state.collection[p.key] || 0));
  }
  let total = 0;
  for (const p of pool) {
    const w = plushWeight(p) * RARITY_TIERS[p.rarity].weight;
    p._pw = w;
    total += w;
  }
  if (!(total > 0)) return pool[(Math.random() * pool.length) | 0];
  let roll = Math.random() * total;
  for (const p of pool) {
    roll -= p._pw;
    if (roll <= 0) return p;
  }
  return pool[pool.length - 1];
}

/**
 * Pick a secret plushy uniformly. Prefers collecting uncollected secrets;
 * falls back to any secret once all are found. Returns null if none are
 * loaded (defensive; shouldDropSecret never prompts for non-loaded secrets).
 * @returns {object|null}
 */
export function pickSecret() {
  const pool = state.plushList.filter((p) => p.secret);
  if (!pool.length) return null;
  const uncollected = pool.filter((p) => !(state.collection[p.key] || 0));
  const src = uncollected.length ? uncollected : pool;
  return src[(Math.random() * src.length) | 0];
}

/**
 * Decide whether this drop should be a secret: hard pity (SECRET_PITY dry
 * drops) or a random SECRET_CHANCE roll. Never fires if no secrets loaded.
 * @returns {boolean}
 */
export function shouldDropSecret() {
  if (!state.plushList.some((p) => p.secret)) return false;
  if (state.secretStreak >= SECRET_PITY) return true;
  return Math.random() < SECRET_CHANCE;
}