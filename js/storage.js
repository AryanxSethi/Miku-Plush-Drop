/**
 * Miku Plush Drop — local storage persistence helpers.
 *
 * Pure utilities (no game state): JSON read/write against localStorage and a
 * basename normalizer used for key matching across asset paths.
 */

/**
 * Read a JSON value from localStorage with a fallback on any failure.
 * @param {string} key
 * @param {*} fallback
 * @returns {*} parsed value or fallback
 */
export function loadLS(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch (e) {
    return fallback;
  }
}

/**
 * Write a JSON value to localStorage, ignoring quota/security errors.
 * @param {string} key
 * @param {*} value
 */
export function saveLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

/**
 * Normalize any asset path to a lowercase basename w/o extension so lookup
 * keys ('images/plush_1.png', 'PLUSH_1.PNG', ...) all match the same entry.
 * @param {string} k
 * @returns {string}
 */
export function normKey(k) {
  return String(k)
    .trim()
    .toLowerCase()
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/\.[^.]+$/, '');
}