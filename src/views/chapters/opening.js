'use strict';

// The opening (what is this?) and the growth mosaic (how it grew).

const nbo = require('../../lib/nairobi');
const { esc, fmt, date, time12, spotifyTrack } = require('../util');

const COLS = 23;

function mosaicSvg(colours) {
  const n = colours.length;
  const rows = Math.ceil(n / COLS);
  const gap = 0.14;
  let rects = '';
  colours.forEach((c, i) => {
    const x = (i % COLS) + gap / 2, y = Math.floor(i / COLS) + gap / 2;
    rects += `<rect x="${x}" y="${y}" width="${1 - gap}" height="${1 - gap}" rx=".08" fill="${c ? '#' + c : 'rgba(243,233,214,.22)'}"/>`;
  });
  return `<svg viewBox="0 0 ${COLS} ${rows}" role="img" aria-labelledby="mosaic-title" preserveAspectRatio="xMinYMin meet"><title id="mosaic-title">${fmt(n)} tiles, one per song added, in the order they were added, each coloured by its album artwork.</title>${rects}</svg>`;
}

function growthSvg(film) {
  const { growth } = film.opening;
  const days = film.totals.days || 1;
  const total = film.totals.entries;
  const W = 600, H = 230, L = 34, R = 10, T = 12, B = 30;
  const x = d => L + (d / days) * (W - L - R);
  const y = n => T + (1 - n / total) * (H - T - B);
  let d = `M ${x(0)} ${y(0)}`;
  let prev = 0;
  for (const [day, n] of growth) { d += ` L ${x(day).toFixed(1)} ${y(prev).toFixed(1)} L ${x(day).toFixed(1)} ${y(n).toFixed(1)}`; prev = n; }
  d += ` L ${x(days)} ${y(prev)}`;
  const area = `${d} L ${x(days)} ${y(0)} L ${x(0)} ${y(0)} Z`;
  // Year ticks on 1 January (Nairobi).
  const start = Date.parse(film.totals.firstAddedAt);
  const firstYear = nbo.wall(start).getUTCFullYear();
  let ticks = '';
  for (let yr = firstYear + 1; ; yr++) {
    const t = Date.parse(`${yr}-01-01T00:00:00+03:00`);
    const dd = nbo.daysBetween(start, t);
    if (dd > days) break;
    ticks += `<line class="grid" x1="${x(dd)}" x2="${x(dd)}" y1="${T}" y2="${H - B}"/><text class="axis" x="${x(dd)}" y="${H - 10}" text-anchor="middle">${yr}</text>`;
  }
  const yTicks = [0, 250, 500].filter(v => v <= total).map(v => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('');
  return `<svg class="growth-line" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="growth-title growth-desc">
  <title id="growth-title">Songs in the playlist over time</title>
  <desc id="growth-desc">A step line from 1 song on ${date(film.totals.firstAddedAt)} to ${fmt(total)} on ${date(film.totals.lastAddedAt)}. Milestones: ${film.opening.milestones.map(m => `song ${m.n} on ${date(m.at)} by ${m.name}`).join('; ')}.</desc>
  <defs><linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5b33" stop-opacity=".28"/><stop offset="1" stop-color="#ff5b33" stop-opacity="0"/></linearGradient></defs>
  ${yTicks}${ticks}
  <text class="axis" x="${L}" y="${H - 10}" text-anchor="start">${date(film.totals.firstAddedAt, { month: 'short' })}</text>
  <text class="axis" x="${W - R}" y="${H - 10}" text-anchor="end">${date(film.totals.lastAddedAt, { month: 'short' })}</text>
  <path class="area" d="${area}"/><path class="line" d="${d}" id="growth-path"/>
</svg>`;
}

function renderOpening(film, { storyAvailable = true } = {}) {
  const t = film.totals;
  const p = film.pulse;
  const people = film.people.ranking;
  return `<section class="chapter opening" id="opening" aria-labelledby="opening-title" data-chapter="opening">
  <h1 class="title" id="opening-title" aria-label="KamiLimu.inthe.Ears"><span class="line" data-split>KamiLimu</span><span class="line dim" data-split>.inthe.Ears</span></h1>
  <p class="lede"><span class="n">${fmt(t.entries)}</span> songs, added by <span class="n">${fmt(t.contributors)}</span> people of the KamiLimu community since ${esc(date(t.firstAddedAt))}. Scroll to play it back.</p>
  <div class="actions">
    ${storyAvailable ? '<button type="button" class="btn btn--primary" id="view-story-btn" data-story-open>Play the 12-slide story</button>' : ''}
    <details class="find" id="find">
      <summary class="btn">Find yourself</summary>
      <ul class="find__list">${people.map(r => `<li><a href="/?me=${encodeURIComponent(r.id)}" data-me="${esc(r.id)}">${esc(r.name)} <span class="mono">${fmt(r.n)}</span></a></li>`).join('')}</ul>
    </details>
  </div>
  <p class="pulse-line" id="pulse-line"><span class="dot" aria-hidden="true"></span>Latest add: <a href="${spotifyTrack(p.song.id)}">${esc(p.song.name)}</a> by ${esc(p.song.artists)}, added by ${esc(p.name)} on ${esc(date(p.at))} at ${esc(time12(p.at))}.</p>
  <p class="scroll-cue" aria-hidden="true"><i></i>Scroll</p>
</section>`;
}

function renderGrowth(film) {
  const t = film.totals;
  const ms = film.opening.milestones;
  const m100 = ms.find(m => m.n === 100);
  const m500 = ms.find(m => m.n === 500);
  const d100 = m100 ? nbo.daysBetween(t.firstAddedAt, m100.at) : null;
  const y500 = m500 ? (nbo.daysBetween(t.firstAddedAt, m500.at) / 365.25) : null;
  const aside = m100 && m500 ? `The 100th arrived ${d100} days in. The 500th took ${y500 >= 2.4 && y500 < 2.6 ? 'two and a half years' : y500.toFixed(1) + ' years'}.` : '';
  return `<section class="chapter growth" id="growth" aria-labelledby="growth-h" data-chapter="growth">
  <div class="chapter__head">
    <h2 class="headline" id="growth-h" data-split>From <span class="n">1</span> song to <span class="n">${fmt(t.entries)}</span> in ${fmt(t.days)} days.${aside ? ` <span class="aside">${esc(aside)}</span>` : ''}</h2>
  </div>
  <div class="growth__stage" id="growth-stage">
    <div class="mosaic" id="mosaic">${mosaicSvg(film.opening.tiles.colours)}</div>
    <div class="growth__clock" aria-hidden="true">
      <p class="clock-date" id="growth-date">${esc(date(t.lastAddedAt))}</p>
      <p class="clock-count" id="growth-count"><span class="n">${fmt(t.entries)}</span>songs so far</p>
      <p class="clock-mark" id="growth-mark"></p>
    </div>
  </div>
  <div class="growth__detail">
    <ol class="milestones" id="milestones">${ms.map(m => `<li data-n="${m.n}" data-day="${nbo.daysBetween(t.firstAddedAt, m.at)}"><span class="k">${m.n === t.entries ? 'latest' : (m.n === 1 ? '1st' : m.n + 'th')}</span><span><strong>${esc(m.song.name)}</strong> by ${esc(m.song.artists)}. Added by ${esc(m.name)}, ${esc(date(m.at))}.</span></li>`).join('')}</ol>
    ${growthSvg(film)}
  </div>
  <p class="caption">Each tile is one add, in the order it was added, coloured by its album artwork. <b>${fmt(t.entries)} adds</b>, including ${fmt(t.duplicateEntries)} songs added a second time by someone else. Dates in Nairobi time. Songs removed from the playlist leave no trace, so "the 100th song" means the 100th of those still here.</p>
</section>`;
}

module.exports = { renderOpening, renderGrowth, COLS };
