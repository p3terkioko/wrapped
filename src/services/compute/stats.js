'use strict';

const sum = xs => xs.reduce((s, x) => s + x, 0);
const mean = xs => (xs.length ? sum(xs) / xs.length : null);

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const round = (x, d = 1) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);
const pct = (n, of, d = 1) => (of ? round((n / of) * 100, d) : 0);

function countBy(xs, key) {
  const m = new Map();
  for (const x of xs) {
    const k = key(x);
    if (k == null) continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

// Sorted [key, count] pairs, largest first, ties by key.
const ranked = m => [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));

// Camelot wheel position for a pitch class and mode (1 major → B, 0 minor → A).
const CAMELOT_MAJOR = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1];
const CAMELOT_MINOR = [5, 12, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10];
const KEY_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

function camelot(key, mode) {
  if (key == null || key < 0 || mode == null) return null;
  return (mode === 1 ? CAMELOT_MAJOR[key] : CAMELOT_MINOR[key]) + (mode === 1 ? 'B' : 'A');
}
const keyName = (key, mode) => (key == null || key < 0 ? null : KEY_NAMES[key] + (mode === 1 ? ' major' : ' minor'));

// Two Camelot codes mix harmonically if they share the number, or the letter
// with numbers one apart on the wheel.
function compatible(a, b) {
  if (!a || !b) return false;
  const na = parseInt(a, 10), nb = parseInt(b, 10), la = a.slice(-1), lb = b.slice(-1);
  if (na === nb) return true;
  if (la !== lb) return false;
  const d = Math.abs(na - nb);
  return d === 1 || d === 11;
}

module.exports = { sum, mean, median, round, pct, countBy, ranked, camelot, keyName, compatible, KEY_NAMES };
