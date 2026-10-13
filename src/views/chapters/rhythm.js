'use strict';

// The rhythm: when it happens. Every add, in Nairobi time.

const nbo = require('../../lib/nairobi');
const { esc, fmt, date, time12 } = require('../util');
const { columns } = require('../charts');

const hourLabel = h => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;

function radialClock(hours) {
  const max = Math.max(...hours, 1);
  const peak = hours.indexOf(max);
  const r0 = 46, r1 = 132;
  let bars = '', ticks = '';
  hours.forEach((n, h) => {
    const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
    const r = r0 + (r1 - r0) * (n / max);
    const w = (Math.PI * 2 / 24) * 0.74;
    const p = (rad, ang) => `${(rad * Math.cos(ang)).toFixed(2)} ${(rad * Math.sin(ang)).toFixed(2)}`;
    const d = `M ${p(r0, a - w / 2)} L ${p(r, a - w / 2)} A ${r} ${r} 0 0 1 ${p(r, a + w / 2)} L ${p(r0, a + w / 2)} A ${r0} ${r0} 0 0 0 ${p(r0, a - w / 2)} Z`;
    bars += `<path class="clock-bar${h === peak ? ' is-lead' : ''}" d="${d}"><title>${hourLabel(h)}–${hourLabel((h + 1) % 24)}: ${n} songs</title></path>`;
    if (h % 3 === 0) ticks += `<text class="axis" x="${(146 * Math.cos(a)).toFixed(1)}" y="${(146 * Math.sin(a) + 4).toFixed(1)}" text-anchor="middle">${hourLabel(h)}</text>`;
  });
  return `<svg class="radial-clock" viewBox="-165 -165 330 330" role="img" aria-labelledby="clock-t clock-d" data-reveal="clock">
  <title id="clock-t">Songs added by hour of day, Nairobi time</title>
  <desc id="clock-d">${hours.map((n, h) => `${hourLabel(h)}: ${n}`).join(', ')}.</desc>
  <circle r="${r0 - 2}" class="clock-hub"/><text class="clock-hub-t" y="-4" text-anchor="middle">${hourLabel(peak)}</text><text class="clock-hub-s" y="13" text-anchor="middle">${fmt(max)} songs</text>
  ${bars}${ticks}</svg>`;
}

function heatmap(heat) {
  const cell = 14, gap = 2, L = 34, T = 16;
  const max = Math.max(...heat.flat(), 1);
  const order = [1, 2, 3, 4, 5, 6, 0]; // Monday first
  let rects = '';
  order.forEach((d, row) => {
    rects += `<text class="axis" x="${L - 6}" y="${T + row * (cell + gap) + cell - 3}" text-anchor="end">${nbo.DAYS[d].slice(0, 3)}</text>`;
    heat[d].forEach((n, h) => {
      rects += `<rect x="${L + h * (cell + gap)}" y="${T + row * (cell + gap)}" width="${cell}" height="${cell}" rx="2" class="heat" style="--o:${n ? (0.12 + 0.88 * n / max).toFixed(3) : 0.04}"><title>${nbo.DAYS[d]} ${hourLabel(h)}: ${n}</title></rect>`;
    });
  });
  for (let h = 0; h < 24; h += 6) rects += `<text class="axis" x="${L + h * (cell + gap) + cell / 2}" y="${T - 5}" text-anchor="middle">${hourLabel(h)}</text>`;
  const W = L + 24 * (cell + gap), H = T + 7 * (cell + gap);
  return `<div class="scroll-x"><svg class="heatmap" viewBox="0 0 ${W} ${H}" role="img" aria-label="Songs added by weekday and hour, darkest where most were added" data-reveal="fade">${rects}</svg></div>`;
}

function calendar(cal, first, last) {
  const byDay = Object.fromEntries(cal.map(c => [c.day, c.n]));
  const max = Math.max(...cal.map(c => c.n), 1);
  const y0 = Number(first.slice(0, 4)), y1 = Number(last.slice(0, 4));
  const cell = 5.2, gap = 1.2, L = 30;
  let labels = '', inRange = '', outRange = '', active = '', row = 0;
  for (let y = y0; y <= y1; y++) {
    const top = row * (7 * (cell + gap) + 14) + 12;
    labels += `<text class="axis" x="0" y="${top + 3.5 * (cell + gap)}">${y}</text>`;
    const jan1 = Date.UTC(y, 0, 1);
    const offset = (new Date(jan1).getUTCDay() + 6) % 7; // Monday-first
    for (let d = 0; d < 366; d++) {
      const day = new Date(jan1 + d * 864e5).toISOString().slice(0, 10);
      if (Number(day.slice(0, 4)) !== y) break;
      const idx = d + offset, x = (L + Math.floor(idx / 7) * (cell + gap)).toFixed(1), yy = (top + (idx % 7) * (cell + gap)).toFixed(1);
      const n = byDay[day] || 0;
      if (n) active += `<rect x="${x}" y="${yy}" width="${cell}" height="${cell}" rx="1" class="cal has" style="--o:${(0.25 + 0.75 * Math.min(1, n / Math.min(max, 12))).toFixed(3)}"><title>${day}: ${n} songs</title></rect>`;
      else if (day >= first.slice(0, 10) && day <= last.slice(0, 10)) inRange += `M${x} ${yy}h${cell}v${cell}h-${cell}z`;
      else outRange += `M${x} ${yy}h${cell}v${cell}h-${cell}z`;
    }
    row++;
  }
  const W = L + 54 * (cell + gap), H = row * (7 * (cell + gap) + 14) + 6;
  return `<svg class="calendar" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" role="img" aria-label="Calendar of days with songs added, one row per year: ${cal.length} days had at least one song" data-reveal="fade">${labels}<path class="cal-empty" d="${inRange}"/><path class="cal-out" d="${outRange}"/><g>${active}</g></svg>`;
}

function renderRhythm(film) {
  const r = film.rhythm;
  const order = [1, 2, 3, 4, 5, 6, 0];
  const cols = order.map(d => ({ label: nbo.DAYS[d].slice(0, 3), tipLabel: nbo.DAYS[d], value: r.weekday[d], highlight: d === r.peak.weekday }));
  const second = [...r.weekday].map((n, d) => ({ n, d })).sort((a, b) => b.n - a.n)[1];
  return `<section class="chapter rhythm" id="rhythm" aria-labelledby="rhythm-h" data-chapter="rhythm" data-record="rhythm">
  <div class="chapter__head">
    <h2 class="headline" id="rhythm-h" data-split>${esc(r.peak.name)} is drop day: <span class="n">${fmt(r.peak.n)}</span> songs.</h2>
    <p class="sub">${esc(nbo.DAYS[second.d])} is next with ${fmt(second.n)}.</p>
  </div>
  <div class="weekdays">${columns(cols, { id: 'weekday-chart', height: 220, title: 'Songs added by day of the week, Nairobi time', desc: order.map(d => `${nbo.DAYS[d]}: ${r.weekday[d]}`).join('; '), valueLabels: true })}</div>
  <p class="caption">Every entry by the day it was added, in Nairobi time (UTC+3).</p>
</section>
<section class="chapter hours" id="hours" aria-labelledby="hours-h" data-chapter="hours" data-record="hours">
  <div class="hours__grid">
    <div class="chapter__head">
      <h2 class="headline" id="hours-h" data-split>The busiest hour is <span class="n">${hourLabel(r.peakHour.hour)}</span>.</h2>
      <p class="sub">${fmt(r.peakHour.n)} songs were added between ${hourLabel(r.peakHour.hour)} and ${hourLabel((r.peakHour.hour + 1) % 24)}. Late nights have their regulars too.</p>
    </div>
    ${radialClock(r.hour)}
  </div>
  ${heatmap(r.heat)}
  <p class="caption">Entries by hour of day and weekday, Nairobi time.</p>
</section>`;
}

function renderRhythmTimeline(film) {
  const r = film.rhythm;
  const b = r.binges[0], d = r.droughts[0];
  const first = film.totals.firstAddedAt, last = film.totals.lastAddedAt;
  const span = Date.parse(last) - Date.parse(first);
  const x = iso => (((Date.parse(iso) - Date.parse(first)) / span) * 100).toFixed(2);
  return `<section class="chapter streaks" id="streaks" aria-labelledby="streaks-h" data-chapter="streaks" data-record="streaks">
  <div class="chapter__head">
    <h2 class="headline" id="streaks-h" data-split>Binges and silences: <span class="n">${fmt(b.n)}</span> songs in ${fmt(b.minutes)} minutes, and ${fmt(d.days)} days of quiet.</h2>
    <p class="sub">${esc(b.name)} added ${fmt(b.n)} songs on ${esc(date(b.from))}, starting at ${esc(time12(b.from))}. The longest silence ran from ${esc(date(d.from, { month: 'short' }))} to ${esc(date(d.to, { month: 'short' }))}, until ${esc(d.brokenBy)} broke it.</p>
  </div>
  ${calendar(r.calendar, first, last)}
  <div class="timeline" aria-hidden="true">
    <div class="timeline__axis"></div>
    ${r.droughts.slice(0, 4).map((g, i) => `<span class="tl-gap${i === 0 ? ' is-lead' : ''}" style="--a:${x(g.from)}%;--b:${x(g.to)}%">${i === 0 ? `<span class="tl-label">${fmt(g.days)} days quiet</span>` : ''}</span>`).join('')}
    ${r.binges.slice(0, 5).map((g, i) => `<span class="tl-binge${i === 0 ? ' is-lead' : ''}" style="--a:${x(g.from)}%;--h:${Math.min(100, 20 + g.n * 2.4)}%">${i === 0 ? `<span class="tl-label">${esc(g.name)}, ${fmt(g.n)} songs</span>` : ''}</span>`).join('')}
    ${r.events.map(ev => `<span class="tl-event" style="--a:${x(ev.date)}%"></span>`).join('')}
    <span class="tl-end tl-end--a">${esc(date(first, { month: 'short' }))}</span><span class="tl-end tl-end--b">${esc(date(last, { month: 'short' }))}</span>
  </div>
  <div class="streaks__lists">
    <div>
      <h3 class="streaks__h">Biggest binges</h3>
      <ol class="streaks__list">${r.binges.slice(0, 5).map(g => `<li><b>${fmt(g.n)}</b> songs in ${fmt(g.minutes)} min <span>${esc(g.name)} · ${esc(date(g.from, { month: 'short' }))}</span></li>`).join('')}</ol>
    </div>
    <div>
      <h3 class="streaks__h">Longest silences</h3>
      <ol class="streaks__list">${r.droughts.slice(0, 5).map(g => `<li><b>${fmt(g.days)}</b> days <span>${esc(date(g.from, { month: 'short' }))} – ${esc(date(g.to, { month: 'short' }))} · broken by ${esc(g.brokenBy)}</span></li>`).join('')}</ol>
    </div>
    ${r.events.length ? `<div><h3 class="streaks__h">Community moments</h3><ol class="streaks__list">${r.events.map(ev => `<li><b>${esc(date(ev.date, { month: 'short' }))}</b> ${esc(ev.title)} <span>${fmt(ev.adds)} songs within three days</span></li>`).join('')}</ol></div>` : ''}
  </div>
  <p class="caption">A binge is one person adding five or more songs with no more than 30 minutes between them. A silence is 14 or more days with no new song. ${r.events.length ? 'Community moments come from the admin list.' : 'Community moments (kickoffs, outdoor days) can be added in the admin and will appear on this line.'} Busiest single day: ${esc(date(r.busiest.day + 'T12:00:00+03:00'))}, ${fmt(r.busiest.n)} songs.</p>
</section>`;
}

module.exports = { renderRhythm, renderRhythmTimeline, hourLabel };
