'use strict';

// The people: who made it.

const nbo = require('../../lib/nairobi');
const { esc, fmt, pct, date, oneIn, spotifyTrack, artwork, monthYear } = require('../util');
const { hbars, overlapGlyph } = require('../charts');

const MONTHS_SHORT = nbo.MONTHS.map(m => m.slice(0, 3));
const monthLabel = k => { const [y, m] = k.split('-').map(Number); return `${nbo.MONTHS[m - 1]} ${y}`; };
const monthShort = k => { const [y, m] = k.split('-').map(Number); return `${MONTHS_SHORT[m - 1]} ${y}`; };

// Who led at the end of each month, collapsed into runs.
function leaderRuns(film) {
  const { months, ids, counts } = film.people.race;
  const firstOf = Object.fromEntries(film.people.ranking.map(r => [r.id, Date.parse(r.first)]));
  const runs = [];
  months.forEach((m, i) => {
    const leader = ids.filter(id => counts[id][i] > 0).sort((a, b) => counts[b][i] - counts[a][i] || firstOf[a] - firstOf[b])[0];
    if (!runs.length || runs[runs.length - 1].id !== leader) runs.push({ id: leader, from: m, to: m });
    else runs[runs.length - 1].to = m;
  });
  return runs;
}

function renderPeople(film) {
  const r = film.people.ranking;
  const t = film.totals;
  const lead = r[0];
  const nextFive = r.slice(1, 6).reduce((s, x) => s + x.n, 0);
  const rows = r.slice(0, 10).map((p, i) => ({ label: p.name, value: p.n, highlight: i === 0, key: p.id }));
  const all = r.map(p => `<li data-key="${esc(p.id)}"><span class="rk">${p.rank}</span><span class="nm">${esc(p.name)}</span><span class="ct">${fmt(p.n)} <small>${pct(p.share)}</small></span></li>`).join('');
  return `<section class="chapter people" id="people" aria-labelledby="people-h" data-chapter="people" data-record="people">
  <div class="chapter__head">
    <h2 class="headline" id="people-h" data-split>${esc(lead.name)} added <span class="n">${fmt(lead.n)}</span> of the ${fmt(t.entries)} songs.${oneIn(lead.share) ? ` <span class="aside">${esc(oneIn(lead.share))}</span>` : ''}</h2>
    <p class="sub">${fmt(t.contributors)} people have added songs. The next five added ${fmt(nextFive)} between them.</p>
  </div>
  <div class="chapter__narrow">
    ${hbars(rows, { share: row => (row.value / t.entries) * 100 })}
    <p class="you-line" id="you-people" hidden></p>
    <details class="everyone">
      <summary>Everyone, all ${fmt(r.length)}</summary>
      <ol class="everyone__list">${all}</ol>
    </details>
    <p class="caption">Songs added by each person, as a share of all ${fmt(t.entries)} entries. ${fmt(film.people.unattributed)} entries have no recorded adder; they count in the total and in nobody's share. Tied counts share a rank.</p>
  </div>
</section>`;
}

function renderRace(film) {
  const runs = leaderRuns(film);
  const now = runs[runs.length - 1];
  const nameOf = id => film.people.ranking.find(p => p.id === id)?.name || 'Someone';
  const before = runs.slice(0, -1).map(x => `${esc(nameOf(x.id))} (${monthShort(x.from)}${x.from !== x.to ? '–' + monthShort(x.to) : ''})`).join(', ');
  const { months, ids, counts } = film.people.race;
  const last = months.length - 1;
  const top = ids.map(id => ({ id, v: counts[id][last] })).sort((a, b) => b.v - a.v).slice(0, 8);
  const max = top[0]?.v || 1;
  return `<section class="chapter race" id="race" aria-labelledby="race-h" data-chapter="race" data-record="race">
  <div class="chapter__head">
    <h2 class="headline" id="race-h" data-split>${esc(nameOf(now.id))} has led since <span class="n">${esc(monthLabel(now.from))}</span>.</h2>
    ${before ? `<p class="sub">Before that, the lead belonged to ${before}.</p>` : ''}
  </div>
  <div class="race__stage" id="race-stage">
    <p class="race__month" id="race-month" aria-hidden="true">${esc(monthLabel(months[last]))}</p>
    <ol class="race__rows" id="race-rows">${top.map((x, i) => `<li class="race__row${i === 0 ? ' is-lead' : ''}" data-id="${esc(x.id)}" style="--i:${i}"><span class="race__name">${esc(nameOf(x.id))}</span><span class="race__track"><span class="bar" style="--w:${((x.v / max) * 100).toFixed(2)}%"></span></span><span class="race__v">${fmt(x.v)}</span></li>`).join('')}</ol>
  </div>
  <p class="caption">Songs added so far by the end of each month, Nairobi time, for everyone who was ever in the top eight. The bars are scaled to the leader of each month.</p>
</section>`;
}

function renderTwins(film) {
  const tw = film.people.twins.slice(0, 6);
  if (!tw.length) return '';
  const nameOf = id => film.people.ranking.find(p => p.id === id)?.name || 'Someone';
  const t0 = tw[0];
  return `<section class="chapter twins" id="twins" aria-labelledby="twins-h" data-chapter="twins" data-record="twins">
  <div class="chapter__head">
    <h2 class="headline" id="twins-h" data-split>Taste twins: ${esc(nameOf(t0.a))} and ${esc(nameOf(t0.b))} share <span class="n">${fmt(t0.shared)}</span> artists.</h2>
    <p class="sub">Nobody planned these overlaps. Here are the pairs whose collections overlap the most.</p>
  </div>
  <ol class="twins__list" data-reveal="fade">${tw.map(p => `<li class="twin">${overlapGlyph(p.jaccard)}<div><p class="twin__names">${esc(nameOf(p.a))} <span class="amp">&amp;</span> ${esc(nameOf(p.b))}</p><p class="twin__what"><span class="n">${fmt(p.shared)}</span> shared artists, including ${p.artists.slice(0, 3).map(esc).join(', ')}.</p></div></li>`).join('')}</ol>
  <p class="caption">Pairs ranked by the share of their combined artists that both of them added (Jaccard similarity), among people with at least five songs who share at least three artists.</p>
</section>`;
}

function renderGreatMinds(film) {
  const gm = film.picks.greatMinds;
  if (!gm.length) return '';
  const sameDay = gm.filter(g => g.gapDays === 0).length;
  const show = [...gm.slice(0, 3), ...gm.slice(-3).reverse()].filter((g, i, a) => a.indexOf(g) === i);
  const longest = gm[gm.length - 1];
  return `<section class="chapter minds" id="great-minds" aria-labelledby="minds-h" data-chapter="minds" data-record="minds">
  <div class="chapter__head">
    <h2 class="headline" id="minds-h" data-split>Great minds: <span class="n">${fmt(gm.length)}</span> songs were added twice, each time by someone else.</h2>
    <p class="sub">${sameDay ? `${fmt(sameDay)} of them on the same day. ` : ''}The longest gap: ${fmt(longest.gapDays)} days between ${esc(longest.adds[0].name)} and ${esc(longest.adds[1].name)} adding ${esc(longest.song.name)}.</p>
  </div>
  <ul class="minds__list" data-reveal="fade">${show.map(g => `<li class="mind">
    ${g.song.image ? `<img src="${artwork(g.song.image)}" width="64" height="64" alt="" loading="lazy" decoding="async">` : '<span class="mind__ph"></span>'}
    <div><a class="mind__song" href="${spotifyTrack(g.song.id)}">${esc(g.song.name)}</a><span class="mind__artist">${esc(g.song.artists)}</span>
    <span class="mind__who">${esc(g.adds[0].name)}, ${esc(date(g.adds[0].at, { month: 'short' }))} → ${esc(g.adds[1].name)}, ${esc(date(g.adds[1].at, { month: 'short' }))} <em>${g.gapDays === 0 ? 'same day' : fmt(g.gapDays) + ' days later'}</em></span></div>
  </li>`).join('')}</ul>
  <p class="caption">Duplicates are matched by ISRC, the recording's international code. These ${fmt(gm.length)} repeats are why the playlist has ${fmt(film.totals.entries)} entries but ${fmt(film.totals.uniqueSongs)} unique songs.</p>
</section>`;
}

function renderBadges(film) {
  const b = film.people.badges;
  if (!b.length) return '';
  const holders = new Set(b.map(x => x.holder)).size;
  return `<section class="chapter badges" id="badges" aria-labelledby="badges-h" data-chapter="badges" data-record="badges">
  <div class="chapter__head">
    <h2 class="headline" id="badges-h" data-split><span class="n">${fmt(b.length)}</span> badges, pressed for ${fmt(holders)} people.</h2>
    <p class="sub">Each one goes to a single person, with the number that earned it.</p>
  </div>
  <ul class="badges__grid" data-reveal="fade">${b.map(x => `<li class="badge" data-holder="${esc(x.holder)}">
    <span class="badge__disc" aria-hidden="true"></span>
    <p class="badge__name">${esc(x.name)}</p>
    <p class="badge__holder">${esc(x.holderName)}</p>
    <p class="badge__why">${esc(x.description)}</p>
  </li>`).join('')}</ul>
  <p class="caption">Rate-based badges need at least five songs; the four audio badges need five songs with audio features (energy, danceability, positivity from ReccoBeats). Ties go to whoever added more songs.</p>
</section>`;
}

module.exports = { renderPeople, renderRace, renderTwins, renderGreatMinds, renderBadges, leaderRuns };
