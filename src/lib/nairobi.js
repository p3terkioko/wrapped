// Africa/Nairobi time helpers. East Africa Time is UTC+3 all year (no DST),
// so a fixed offset is exact and avoids depending on the server's timezone.
'use strict';

const OFFSET_MS = 3 * 60 * 60 * 1000;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// A Date whose getUTC* fields read as Nairobi wall-clock time.
function wall(date) {
  return new Date(new Date(date).getTime() + OFFSET_MS);
}

function weekday(date) { return wall(date).getUTCDay(); }
function hour(date) { return wall(date).getUTCHours(); }

// YYYY-MM-DD in Nairobi.
function dayKey(date) { return wall(date).toISOString().slice(0, 10); }
// YYYY-MM in Nairobi.
function monthKey(date) { return wall(date).toISOString().slice(0, 7); }

// "13 March 2024"
function longDate(date) {
  const w = wall(date);
  return `${w.getUTCDate()} ${MONTHS[w.getUTCMonth()]} ${w.getUTCFullYear()}`;
}

// "18:05"
function clock(date) {
  const w = wall(date);
  return String(w.getUTCHours()).padStart(2, '0') + ':' + String(w.getUTCMinutes()).padStart(2, '0');
}

// Whole days between two instants, counted on Nairobi calendar dates.
function daysBetween(a, b) {
  return Math.round((Date.parse(dayKey(b)) - Date.parse(dayKey(a))) / 86400000);
}

module.exports = { OFFSET_MS, DAYS, MONTHS, wall, weekday, hour, dayKey, monthKey, longDate, clock, daysBetween };
