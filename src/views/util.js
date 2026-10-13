'use strict';

// Helpers for the server-rendered film. All dates render in Nairobi time.

const nbo = require('../lib/nairobi');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => (n == null ? '—' : Number(n).toLocaleString('en-GB'));
const plural = (n, one, many = one + 's') => `${fmt(n)} ${n === 1 ? one : many}`;
const pct = (x, d = 1) => (x == null ? '—' : `${Number(x).toFixed(d).replace(/\.0$/, '')}%`);

const MONTHS_SHORT = nbo.MONTHS.map(m => m.slice(0, 3));
function date(iso, { month = 'long', year = true } = {}) {
  const w = nbo.wall(iso);
  const m = month === 'short' ? MONTHS_SHORT[w.getUTCMonth()] : nbo.MONTHS[w.getUTCMonth()];
  return `${w.getUTCDate()} ${m}${year ? ' ' + w.getUTCFullYear() : ''}`;
}
function monthYear(iso) {
  const w = nbo.wall(iso);
  return `${nbo.MONTHS[w.getUTCMonth()]} ${w.getUTCFullYear()}`;
}
function time12(iso) {
  const w = nbo.wall(iso);
  const h = w.getUTCHours(), m = w.getUTCMinutes();
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
}

// "one in five" style phrasing for a share, only when it is exactly true as
// "more than one in N" (N = floor(1/share)).
function oneIn(share) {
  const n = Math.floor(100 / share);
  const words = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  return n >= 2 && n <= 10 ? `More than one in every ${words[n]}.` : null;
}

const spotifyTrack = id => `https://open.spotify.com/track/${id}`;
const artwork = hash => (hash ? `https://i.scdn.co/image/${hash}` : null);

// Coverage line, e.g. "Based on 404 of 485 unique songs."
const coverage = (c, noun = 'unique songs') => (c && c.songs < c.of ? `Based on ${fmt(c.songs)} of ${fmt(c.of)} ${noun}.` : `All ${fmt(c?.of)} ${noun}.`);

module.exports = { esc, fmt, plural, pct, date, monthYear, time12, oneIn, spotifyTrack, artwork, coverage, MONTHS_SHORT };
