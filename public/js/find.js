// Find yourself: pick your name (or open a ?me= link) and the film re-centres
// on you: your bar, race row, badges, credits line, mosaic tiles and mood dots
// are marked in gold, and a personal line appears under each headline. Every
// line is computed from the people and tracks payloads, loaded on demand.

import { film } from './motion.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hourLabel = h => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
const median = xs => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const fmtDate = iso => { const d = new Date(Date.parse(iso) + 3 * 3600e3); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const mostCommon = xs => { const m = new Map(); xs.forEach(x => x != null && m.set(x, (m.get(x) || 0) + 1)); return [...m].sort((a, b) => b[1] - a[1])[0] || null; };

let payloads = null;
async function load() {
  if (!payloads) payloads = Promise.all([fetch('/api/public/people').then(r => r.json()), fetch('/api/public/tracks').then(r => r.json())]);
  return payloads;
}

let mosaicRef = null;
let current = null;

export function setupFind(mosaic) {
  mosaicRef = mosaic;
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-me]');
    if (a) { e.preventDefault(); choose(a.dataset.me); a.closest('details')?.removeAttribute('open'); return; }
    if (e.target.closest('[data-me-clear]')) { e.preventDefault(); choose(null); return; }
    if (e.target.closest('[data-find-open]')) {
      e.preventDefault();
      const d = document.getElementById('find');
      d.open = true;
      d.scrollIntoView({ block: 'center' });
      d.querySelector('summary')?.focus({ preventScroll: true });
    }
  });
  let initial = document.getElementById('dashboard').dataset.me || null;
  if (!initial) { try { initial = localStorage.getItem('kle-me'); } catch { /* ignore */ } }
  if (initial) choose(initial, { quiet: true });
}

async function choose(id, { quiet = false } = {}) {
  clear();
  const url = new URL(location.href);
  if (!id) {
    url.searchParams.delete('me');
    history.replaceState(null, '', url);
    try { localStorage.removeItem('kle-me'); } catch { /* ignore */ }
    return;
  }
  const [people, tracks] = await load();
  const me = people.contributors.find(c => c.id === id);
  if (!me) return;
  current = me;
  url.searchParams.set('me', id);
  history.replaceState(null, '', url);
  try { localStorage.setItem('kle-me', id); } catch { /* ignore */ }
  apply(me, people, tracks);
  if (!quiet) document.getElementById('people')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

function line(sectionId, html) {
  const sec = document.getElementById(sectionId);
  const head = sec?.querySelector('.chapter__head, .opening__copy');
  if (!head) return;
  const p = document.createElement('p');
  p.className = 'you-line';
  p.dataset.you = '';
  p.innerHTML = html;
  head.appendChild(p);
}

function mark(selector) { document.querySelectorAll(selector).forEach(el => { el.classList.add('is-you'); el.dataset.youMark = ''; }); }

function apply(me, people, tracks) {
  const S = tracks.songs;
  const mine = me.songs.filter(i => i != null);
  const total = film.totals.entries;
  const pIndex = tracks.people.findIndex(p => p.id === me.id);
  const tileIdx = new Set(tracks.entries.map((e, i) => (e[2] === pIndex ? i : -1)).filter(i => i >= 0));
  const firstTile = Math.min(...tileIdx);

  // Chip: who the film is centred on, with a way out.
  const chip = document.createElement('div');
  chip.className = 'you-chip';
  chip.dataset.you = '';
  chip.innerHTML = `<span>Centred on <b>${esc(me.name)}</b></span><button type="button" data-me-clear aria-label="Stop centring the film on ${esc(me.name)}">✕</button>`;
  document.body.appendChild(chip);

  // Opening and growth.
  line('opening', `<b>${me.n}</b> of these songs are yours, ${esc(me.name)}.`);
  line('growth', `Your first add, <b>${esc(me.firstSong.name)}</b>, was the ${ordinal(firstTile + 1)} song, on ${fmtDate(me.first)}. Your tiles are outlined in gold.`);
  mosaicRef?.highlight(tileIdx);

  // People.
  line('people', `You: <b>${me.n}</b> songs, ${me.share}% of the playlist, ${ordinal(me.rank)} of ${film.totals.contributors}.`);
  const row = document.querySelector(`#people .hbar[data-key="${CSS.escape(me.id)}"]`);
  if (row) mark(`#people .hbar[data-key="${CSS.escape(me.id)}"]`);
  else {
    const list = document.querySelector('#people .hbars');
    const top = film.people.ranking[0].n;
    const li = document.createElement('li');
    li.className = 'hbar is-you';
    li.dataset.you = '';
    li.innerHTML = `<span class="hbar__label">${esc(me.name)} (you)</span><span class="hbar__track"><span class="bar" style="--w:${(me.n / top * 100).toFixed(2)}%"></span></span><span class="hbar__value">${me.n} <small>${me.share}%</small></span>`;
    list?.appendChild(li);
  }
  mark(`.everyone__list li[data-key="${CSS.escape(me.id)}"]`);

  // Race: your row, and when you joined.
  const { months, ids, counts } = film.people.race;
  const joined = new Date(Date.parse(me.first) + 3 * 3600e3);
  const inRace = ids.includes(me.id);
  let best = null;
  if (inRace) months.forEach((m, i) => {
    const rank = 1 + ids.filter(o => counts[o][i] > counts[me.id][i]).length;
    if (counts[me.id][i] > 0 && (best == null || rank < best.rank)) best = { rank, m };
  });
  line('race', `You joined in ${MONTHS[joined.getUTCMonth()]} ${joined.getUTCFullYear()}.${best ? ` Your best month-end position: ${ordinal(best.rank)}.` : ''}`);
  document.documentElement.style.setProperty('--you-id', `"${me.id}"`);
  const styleTag = document.createElement('style');
  styleTag.dataset.you = '';
  styleTag.textContent = `.race__row[data-id="${CSS.escape(me.id)}"] .race__name, .race__row[data-id="${CSS.escape(me.id)}"] .race__v { color: var(--gold) !important; } .race__row[data-id="${CSS.escape(me.id)}"] .bar { box-shadow: 0 0 0 1.5px var(--gold); }`;
  document.head.appendChild(styleTag);

  // Twins and great minds.
  if (me.twin) {
    const twinName = people.contributors.find(c => c.id === me.twin.id)?.name || 'someone';
    line('twins', `Your taste twin: <b>${esc(twinName)}</b>, ${me.twin.shared} shared artists, including ${me.twin.artists.slice(0, 3).map(esc).join(', ')}.`);
  } else line('twins', `Nobody shares three or more artists with you yet. Your next add could change that.`);
  const repeats = mine.filter(i => S.times[i] > 1);
  line('great-minds', repeats.length ? `${repeats.length} of your songs were also added by someone else.` : `None of your songs has been added twice, yet.`);

  // Badges.
  const myBadges = film.people.badges.filter(b => b.holder === me.id);
  mark(`.badge[data-holder="${CSS.escape(me.id)}"]`);
  line('badges', myBadges.length ? `You hold ${myBadges.length === 1 ? 'one' : myBadges.length}: <b>${myBadges.map(b => esc(b.name)).join(', ')}</b>.` : (me.n >= 5 ? `No badge for you this time; each one goes to a single person.` : `Add ${5 - me.n} more song${5 - me.n === 1 ? '' : 's'} to be eligible for the rate-based badges.`));

  // Sound.
  const fam = me.families[0];
  if (fam) line('sound', `Your most-added family: <b>${esc(fam.family)}</b>, ${fam.n} of your songs.`);
  if (me.medianYear) line('eras', `Your typical song came out in <b>${me.medianYear}</b>.`);
  const withF = mine.filter(i => S.energy[i] != null && S.valence[i] != null);
  if (withF.length) {
    const avg = k => Math.round(withF.reduce((s, i) => s + S[k][i], 0) / withF.length * 100);
    line('mood', `Your songs average ${avg('energy')}% energy and ${avg('valence')}% positivity. They're the dots ringed in gold.`);
    const g = document.querySelector('.moodmap .moodmap__dots');
    if (g) {
      const NS = 'http://www.w3.org/2000/svg';
      const grp = document.createElementNS(NS, 'g'); grp.dataset.you = ''; grp.setAttribute('class', 'moodmap__you');
      withF.forEach(i => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', (S.valence[i] * 300).toFixed(1)); c.setAttribute('cy', ((1 - S.energy[i]) * 300).toFixed(1)); c.setAttribute('r', 5.6); grp.appendChild(c); });
      g.after(grp);
    }
  }
  const tempos = mine.map(i => S.tempo[i]).filter(Boolean);
  if (tempos.length) line('tempo', `Your songs' median tempo: <b>${Math.round(median(tempos))} BPM</b>.`);
  const key = mostCommon(mine.map(i => S.camelot[i]));
  if (key) line('keys', `Your most common key position: <b>${esc(key[0])}</b> (${key[1]} song${key[1] === 1 ? '' : 's'}).`);
  if (me.swahiliShare != null && me.lyricSongs) line('language', `In your ${me.lyricSongs} songs with lyrics found, ${me.swahiliShare}% of lines are in Swahili or Sheng.`);
  const countries = new Set(mine.map(i => S.country[i]).filter(Boolean));
  if (countries.size) line('geography', `Your songs come from artists in ${countries.size} countr${countries.size === 1 ? 'y' : 'ies'} that the records know.`);

  // Rhythm.
  if (me.favouriteWeekday != null) line('rhythm', `Your favourite day to add a song: <b>${DAYS[me.favouriteWeekday]}</b>.`);
  if (me.favouriteHour != null) line('hours', `Your favourite hour: <b>${hourLabel(me.favouriteHour)}</b>${me.nightShare ? `; ${me.nightShare}% of your songs came in between 10pm and 4am` : ''}.`);
  const times = tracks.entries.filter(e => e[2] === pIndex).map(e => e[1]);
  let run = 1, bestRun = 1;
  for (let i = 1; i < times.length; i++) { run = times[i] - times[i - 1] <= 30 ? run + 1 : 1; bestRun = Math.max(bestRun, run); }
  line('streaks', bestRun > 1 ? `Your biggest session: <b>${bestRun}</b> songs in one sitting.` : `You add one song at a time.`);

  // Picks and credits.
  line('picks', `Your first song here: <a href="https://open.spotify.com/track/${esc(me.firstSong.id)}">${esc(me.firstSong.name)}</a> by ${esc(me.firstSong.artists)}.`);
  const convo = film.picks.conversation;
  if (convo && convo.turns.some(t => t.by === me.id)) line('conversation', `You're in this one.`);
  mark(`.roll__row[data-id="${CSS.escape(me.id)}"]`);
  line('credits', `You're in here: ${ordinal(film.credits.roll.findIndex(r => r.id === me.id) + 1)} to join.`);
}

function clear() {
  current = null;
  document.querySelectorAll('[data-you]').forEach(el => el.remove());
  document.querySelectorAll('[data-you-mark]').forEach(el => { el.classList.remove('is-you'); delete el.dataset.youMark; });
  mosaicRef?.highlight(null);
}

export const currentPerson = () => current;
