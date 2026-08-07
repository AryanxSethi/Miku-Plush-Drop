/**
 * Miku Plush Drop — constants & difficulty config.
 *
 * Central place for all tunable values: rarity tiers and their drop weights,
 * per-plush overrides/weights, secret-plush settings, pity thresholds,
 * physics limits, DPR auto-tuning levels, and glow styling. Editing anything
 * here re-shapes drop odds, look, or limits without touching game logic.
 */

/** Rarity tiers: weight drives drop weighting, label feeds UI badges/toasts.
 *  `secret` (weight 0) is excluded from the normal pick pool on purpose. */
export const RARITY_TIERS = {
  common: { weight: 40, label: 'Common' },
  uncommon: { weight: 25, label: 'Uncommon' },
  rare: { weight: 18, label: 'Rare' },
  epic: { weight: 10, label: 'Epic' },
  legendary: { weight: 5, label: 'Legendary' },
  secret: { weight: 0, label: 'Secret' }
};

/** Rarity overrides: keys are basename-matched to loaded images (via normKey).
 *  Overrides take precedence over the stored/per-target rarity assignment. */
export const RARITY_OVERRIDES = {
  'plush_17':'legendary',
  'plush_15':'legendary',
  'plush_18':'legendary',
  'plush_30':'legendary',
  'plush_100':'legendary',
  'plush_96':'legendary'
};

/** Per-plush meta-weight multipliers applied on top of their tier weight.
 *  Only matches plushies whose basename normalizes to one of these keys. */
export const PLUSH_WEIGHTS = {
  'plush_17':1,
  'plush_100':0.05,
  'plush_96':0.001
};

/** Secret plush filenames (loaded from assets in order, basename = file stem).
 *  These drop at a 1/1000 roll with their own pity counter, are hidden from
 *  the collection until first collected, and use a rainbow glow + boom sound. */
export const SECRET_PLUSHES = ['eva', 'eva_0', 'eva_1', 'eva_02', 'eva_08', 'eva_13'];

/** Target counts used as proportions when distributing rarities among
 *  plushies that have no override — scaled to the number of unassigned items. */
export const RARITY_TARGETS = {
  common: 13,
  uncommon: 11,
  rare: 8,
  epic: 10
};

/** Normal pity: force an un-collected new plush after this many non-new drops. */
export const PITY_DROPS = 50;
/** Base probability of a secret plush per drop. */
export const SECRET_CHANCE = 1 / 1000;
/** Secret pity: force a secret after this many dry drops. */
export const SECRET_PITY = 1000;
/** Max concurrent plushies on screen (world). */
export const MAX_PLUSH = 150;
/** Physics/render step interval in ms. */
export const FRAME_STEP = 1000 / 60;
/** DPR auto-tuning steps. */
export const DPR_LEVELS = [1.25, 1.5, 2];

/** Glow palette (RGBA) per rarity, used to build the radial halo sprites.
 *  `secret` is handled separately by getSecretHalo (animated rainbow). */
export const GLOW_PALETTE = {
  common: { r: 57, g: 197, b: 187, a: 0.2 },
  uncommon: { r: 91, g: 143, b: 199, a: 0.26 },
  rare: { r: 217, g: 122, b: 154, a: 0.38 },
  epic: { r: 122, g: 92, b: 192, a: 0.5 },
  legendary: { r: 255, g: 200, b: 96, a: 0.62 }
};

/** Multiplier applied to halo size per rarity (bigger glow for rarer tiers). */
export const GLOW_SCALE = {
  common: 1,
  uncommon: 1.05,
  rare: 1.12,
  epic: 1.2,
  legendary: 1.35,
  secret: 1.5
};

/** Display/sort order for rarity, most valuable first (used by raritySort). */
export const RARITY_ORDER = ['secret', 'legendary', 'epic', 'rare', 'uncommon', 'common'];
