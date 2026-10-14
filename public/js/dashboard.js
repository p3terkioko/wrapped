// The Crate: every panel is a view of the same filtered selection. Tapping a
// bar, column, key or mood corner toggles a filter; each panel is computed
// without its own filter, so the other options stay visible to pick. The URL
// carries the filters, so a selection can be shared.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const KEY_ORDER = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1];
const KEY_NAMES = { '1B': 'B', '2B': 'F♯', '3B': 'D♭', '4B': 'A♭', '5B': 'E♭', '6B': 'B♭', '7B': 'F', '8B': 'C', '9B': 'G', '10B': 'D', '11B': 'A', '12B': 'E', '1A': 'A♭m', '2A': 'E♭m', '3A': 'B♭m', '4A': 'Fm', '5A': 'Cm', '6A': 'Gm', '7A': 'Dm', '8A': 'Am', '9A': 'Em', '10A': 'Bm', '11A': 'F♯m', '12A': 'D♯m' };
const MOOD = { bL: 'bright & loud', dL: 'darker & loud', bC: 'bright & calm', dC: 'darker & calm' };
const EAT = 3 * 3600000;
const PAGE = 60;

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => Number(n).toLocaleString('en-GB');
const hourLabel = h => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;
const median = xs => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const motion = () => !document.documentElement.classList.contains('motion-off');

let S, E, P, A, firstAt, months, me = null;
const F = { person: null, artist: null, family: null, decade: null, weekday: null, hour: null, month: null, key: null, mood: null, q: '' };
let sortBy = 'added', shown = PAGE;

// ── Load and index ───────────────────────────────────────────────────────────
async function load() {
  const tracks = await (await fetch('/api/public/tracks')).json();
  S = tracks.songs; P = tracks.people; A = tracks.artistInfo || {}; firstAt = Date.parse(tracks.firstAt);
  const N = S.id.length;
  S.decade = S.year.map(y => (y ? Math.floor(y / 10) * 10 : null));
  S.mood = S.energy.map((e, i) => (e == null || S.valence[i] == null ? null : (S.valence[i] >= 0.5 ? 'b' : 'd') + (e >= 0.5 ? 'L' : 'C')));
  S.text = Array.from({ length: N }, (_, i) => `${S.name[i]} ${S.artists[i]}`.toLowerCase());
  E = tracks.entries.map(([si, min, pi], idx) => {
    const t = firstAt + min * 60000;
    const w = new Date(t + EAT);
    return { idx, si, pi, t, weekday: w.getUTCDay(), hour: w.getUTCHours(), month: w.toISOString().slice(0, 7), person: pi == null ? null : P[pi].id };
  });
  const m0 = E[0].month, m1 = E[E.length - 1].month;
  months = [];
  for (let [y, m] = m0.split('-').map(Number); ; ) {
    const k = `${y}-${String(m).padStart(2, '0')}`; months.push(k); if (k === m1) break; m++; if (m === 13) { m = 1; y++; }
  }
  try { me = localStorage.getItem('kle-me'); } catch { /* ignore */ }
}

// ── Filtering ────────────────────────────────────────────────────────────────
function matches(e, skip) {
  const si = e.si;
  if (skip !== 'person' && F.person && e.person !== F.person) return false;
  if (skip !== 'artist' && F.artist && !(S.artistIds[si] || []).includes(F.artist)) return false;
  if (skip !== 'weekday' && F.weekday != null && e.weekday !== F.weekday) return false;
  if (skip !== 'hour' && F.hour != null && e.hour !== F.hour) return false;
  if (skip !== 'month' && F.month && e.month !== F.month) return false;
  if (skip !== 'family' && F.family && S.family[si] !== F.family) return false;
  if (skip !== 'decade' && F.decade != null && S.decade[si] !== F.decade) return false;
  if (skip !== 'key' && F.key && S.camelot[si] !== F.key) return false;
  if (skip !== 'mood' && F.mood && S.mood[si] !== F.mood) return false;
  if (F.q) {
    const q = F.q.toLowerCase();
    if (!S.text[si].includes(q) && !(e.person && P[e.pi].name.toLowerCase().includes(q))) return false;
  }
  return true;
}
const entries = skip => E.filter(e => matches(e, skip));
const songsOf = es => [...new Set(es.map(e => e.si))];
const anyFilter = () => Object.entries(F).some(([k, v]) => (k === 'q' ? !!v : v != null));

function toggle(dim, value) {
  F[dim] = F[dim] === value ? null : value;
  shown = PAGE;
  render(true);
}

// ── URL ──────────────────────────────────────────────────────────────────────
const KEYS = ['person', 'artist', 'family', 'decade', 'weekday', 'hour', 'month', 'key', 'mood', 'q'];
function readUrl() {
  const u = new URL(location.href);
  for (const k of KEYS) {
    const v = u.searchParams.get(k);
    if (v == null) continue;
    F[k] = ['decade', 'weekday', 'hour'].includes(k) ? Number(v) : v;
  }
  if (F.artist && !A[F.artist]) F.artist = null; // an artist no longer in the playlist
  $('#crate-q').value = F.q || '';
}
function writeUrl() {
  const u = new URL(location.href);
  for (const k of KEYS) { if (F[k] == null || F[k] === '') u.searchParams.delete(k); else u.searchParams.set(k, F[k]); }
  history.replaceState(null, '', u);
}

// ── Rendering helpers ────────────────────────────────────────────────────────
function picker(host, rows, { dim, max, limit = 12, you = null }) {
  const top = max || Math.max(1, ...rows.map(r => r.n));
  const open = host.dataset.open === '1';
  const list = open ? rows : rows.slice(0, limit);
  host.innerHTML = `<ul class="picker">${list.map(r => `<li><button type="button" class="pick${r.n ? '' : ' pick--zero'}${you && r.value === you ? ' is-you' : ''}" data-dim="${dim}" data-value="${esc(r.value)}" aria-pressed="${F[dim] === r.value}"><span class="pick__label">${esc(r.label)}</span><span class="pick__value">${fmt(r.n)}</span><span class="pick__track"><span class="pick__bar" style="--v:${(r.n / top).toFixed(4)}"></span></span></button></li>`).join('')}</ul>${rows.length > limit ? `<button type="button" class="more" data-more>${open ? 'Show fewer' : `Show all ${rows.length}`}</button>` : ''}`;
}

function columns(host, rows, { dim, labelEvery = 1, height = 150, labelFn = r => r.label }) {
  const top = Math.max(1, ...rows.map(r => r.n));
  host.innerHTML = `<div class="cols" style="--h:${height}px">${rows.map(r => `<button type="button" data-dim="${dim}" data-value="${esc(r.value)}" aria-pressed="${String(F[dim] === r.value)}" aria-label="${esc(r.full || r.label)}: ${fmt(r.n)}" data-tip="${esc(r.full || r.label)}: ${fmt(r.n)}"><span style="--v:${(r.n / top).toFixed(4)}"></span></button>`).join('')}</div>
  <div class="cols-axis" aria-hidden="true">${rows.map((r, i) => `<span>${i % labelEvery === 0 ? esc(labelFn(r)) : ''}</span>`).join('')}</div>`;
}

const line = (id, html) => { $(`#${id}-line`).innerHTML = html; };

// ── Panels ───────────────────────────────────────────────────────────────────
function renderStats(sel) {
  const songs = songsOf(sel);
  const artists = new Set(songs.flatMap(si => S.artistIds[si] || []));
  const secs = sel.reduce((s, e) => s + (S.seconds[e.si] || 0), 0);
  const bpm = median(songs.map(si => S.tempo[si]).filter(Boolean));
  const vals = {
    entries: fmt(sel.length), songs: fmt(songs.length), people: fmt(new Set(sel.map(e => e.person).filter(Boolean)).size),
    artists: fmt(artists.size), hours: `${Math.floor(secs / 3600)}h ${String(Math.floor((secs % 3600) / 60)).padStart(2, '0')}m`, bpm: bpm ? fmt(Math.round(bpm)) : '—',
  };
  document.querySelectorAll('#crate-stats dd').forEach(dd => { dd.textContent = vals[dd.dataset.k]; dd.classList.toggle('is-filtered', anyFilter()); });
}

function renderPeople() {
  const sel = entries('person');
  const counts = new Map();
  sel.forEach(e => e.person && counts.set(e.person, (counts.get(e.person) || 0) + 1));
  const rows = P.map(p => ({ value: p.id, label: p.name, n: counts.get(p.id) || 0 })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
  picker($('#p-people-body'), rows, { dim: 'person', you: me });
  const total = sel.length;
  if (F.person) { const p = rows.find(r => r.value === F.person); line('p-people', `Showing <span class="n">${esc(p?.label)}</span>: ${fmt(entries().length)} songs.`); }
  else line('p-people', rows[0].n ? `${esc(rows[0].label)} added <span class="n">${fmt(rows[0].n)}</span> of these ${fmt(total)}.` : 'Nobody matches this selection.');
}

// Artists: every credited artist (features count) by unique songs in the
// selection, with their Spotify pictures. Tap to filter; the selected artist
// stays pinned first. Pictures are shown whole, and each links to Spotify.
function renderArtists() {
  const host = $('#p-artists-body');
  const songs = songsOf(entries('artist'));
  const counts = new Map();
  songs.forEach(si => (S.artistIds[si] || []).forEach(id => counts.set(id, (counts.get(id) || 0) + 1)));
  let rows = [...counts].map(([id, n]) => ({ id, n, name: A[id]?.[0] || 'Unknown artist', img: A[id]?.[1] || null }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  const limit = host.dataset.open === '1' ? 36 : 12;
  let list = rows.slice(0, limit);
  if (F.artist) {
    const chosen = rows.find(r => r.id === F.artist) || { id: F.artist, n: 0, name: A[F.artist]?.[0] || 'Unknown artist', img: A[F.artist]?.[1] || null };
    list = [chosen, ...list.filter(r => r.id !== F.artist)].slice(0, limit);
  }
  const initials = s => s.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  host.innerHTML = `<ol class="arts">${list.map(r => `<li class="art${r.n ? '' : ' art--zero'}">
      <button type="button" data-dim="artist" data-value="${esc(r.id)}" aria-pressed="${F.artist === r.id}" aria-label="${esc(r.name)}: ${fmt(r.n)} songs">
        ${r.img ? `<img src="https://i.scdn.co/image/${r.img}" width="160" height="160" alt="" loading="lazy" decoding="async">` : `<span class="art__none" aria-hidden="true">${esc(initials(r.name))}</span>`}
        <span class="art__name">${esc(r.name)}</span><span class="art__n">${fmt(r.n)}</span>
      </button>
      <a class="art__out" href="https://open.spotify.com/artist/${encodeURIComponent(r.id)}" aria-label="${esc(r.name)} on Spotify">Spotify ↗</a>
    </li>`).join('')}</ol>${rows.length > 12 ? `<button type="button" class="more" data-more>${host.dataset.open === '1' ? 'Show fewer' : 'Show more'}</button>` : ''}
    <p class="caption">Unique songs per artist, features included. ${fmt(rows.length)} artists${KEYS.some(k => k !== 'artist' && (k === 'q' ? !!F.q : F[k] != null)) ? ' match the other filters' : ' in all'}.</p>`;
  const sel = F.artist && rows.find(r => r.id === F.artist);
  if (sel) line('p-artists', `Showing <span class="n">${esc(sel.name)}</span>: ${fmt(sel.n)} songs.`);
  else line('p-artists', rows.length ? `${esc(rows[0].name)} leads with <span class="n">${fmt(rows[0].n)}</span> songs.` : 'No artists in this selection.');
}

function renderFamilies() {
  const songs = songsOf(entries('family'));
  const withFam = songs.filter(si => S.family[si]);
  const counts = new Map();
  withFam.forEach(si => counts.set(S.family[si], (counts.get(S.family[si]) || 0) + 1));
  const rows = [...counts].map(([f, n]) => ({ value: f, label: f, n })).sort((a, b) => b.n - a.n);
  picker($('#p-families-body'), rows, { dim: 'family', limit: 10 });
  line('p-families', rows.length ? `${esc(rows[0].label)} leads: <span class="n">${fmt(rows[0].n)}</span> of ${fmt(withFam.length)} songs with a genre.` : 'No genre tags in this selection.');
  $('#p-families-body').insertAdjacentHTML('beforeend', `<p class="caption">Unique songs; ${fmt(songs.length - withFam.length)} of these ${fmt(songs.length)} have no genre tags.</p>`);
}

function renderMonths() {
  const sel = entries('month');
  const counts = new Map();
  sel.forEach(e => counts.set(e.month, (counts.get(e.month) || 0) + 1));
  const rows = months.map(m => { const [y, mo] = m.split('-').map(Number); return { value: m, label: `${MONTHS[mo - 1]} ${String(y).slice(2)}`, full: `${MONTHS_LONG[mo - 1]} ${y}`, n: counts.get(m) || 0 }; });
  columns($('#p-months-body'), rows, { dim: 'month', labelEvery: innerWidth < 600 ? 6 : 3, height: 130 });
  const best = [...rows].sort((a, b) => b.n - a.n)[0];
  line('p-months', best.n ? `Busiest month: <span class="n">${esc(best.full)}</span>, ${fmt(best.n)} songs added.` : 'No songs in this selection.');
}

function renderDecades() {
  const songs = songsOf(entries('decade'));
  const counts = new Map();
  songs.forEach(si => S.decade[si] != null && counts.set(S.decade[si], (counts.get(S.decade[si]) || 0) + 1));
  const ds = [...counts.keys()].sort((a, b) => a - b);
  const all = ds.length ? Array.from({ length: (ds[ds.length - 1] - ds[0]) / 10 + 1 }, (_, i) => ds[0] + i * 10) : [];
  const rows = all.map(d => ({ value: d, label: `'${String(d).slice(2)}`, full: `${d}s`, n: counts.get(d) || 0 }));
  columns($('#p-decades-body'), rows, { dim: 'decade', height: 120 });
  const best = [...rows].sort((a, b) => b.n - a.n)[0];
  line('p-decades', best ? `Most came out in the <span class="n">${best.full}</span>: ${fmt(best.n)} of ${fmt(songs.length)}.` : '—');
}

function renderWeekday() {
  const sel = entries('weekday');
  const counts = Array(7).fill(0); sel.forEach(e => counts[e.weekday]++);
  const rows = WEEK.map(d => ({ value: d, label: DAYS[d].slice(0, 3), full: DAYS[d], n: counts[d] }));
  columns($('#p-weekday-body'), rows, { dim: 'weekday', height: 120 });
  const best = [...rows].sort((a, b) => b.n - a.n)[0];
  line('p-weekday', best.n ? `<span class="n">${best.full}</span> leads with ${fmt(best.n)}.` : '—');
}

function renderHour() {
  const sel = entries('hour');
  const counts = Array(24).fill(0); sel.forEach(e => counts[e.hour]++);
  const rows = counts.map((n, h) => ({ value: h, label: hourLabel(h), full: `${hourLabel(h)}–${hourLabel((h + 1) % 24)}`, n }));
  columns($('#p-hour-body'), rows, { dim: 'hour', labelEvery: 3, height: 120 });
  const best = [...rows].sort((a, b) => b.n - a.n)[0];
  line('p-hour', best.n ? `Busiest hour: <span class="n">${best.label}</span> (${fmt(best.n)} songs, Nairobi time).` : '—');
}

let moodCanvas = null;
function renderMood() {
  const host = $('#p-mood-body');
  if (!moodCanvas) {
    host.innerHTML = `<div class="mood-pad"><canvas aria-hidden="true"></canvas>${['dL', 'bL', 'dC', 'bC'].map((q, i) => `<button type="button" class="q q--${['tl', 'tr', 'bl', 'br'][i]}" data-dim="mood" data-value="${q}" aria-pressed="false"></button>`).join('')}</div><div class="mood-axes" aria-hidden="true"><span>← darker</span><span>positivity</span><span>brighter →</span></div>`;
    moodCanvas = host.querySelector('canvas');
  }
  const songs = songsOf(entries('mood')).filter(si => S.energy[si] != null && S.valence[si] != null);
  const counts = { bL: 0, dL: 0, bC: 0, dC: 0 };
  songs.forEach(si => counts[S.mood[si]]++);
  host.querySelectorAll('.q').forEach(b => { b.setAttribute('aria-pressed', String(F.mood === b.dataset.value)); b.textContent = `${MOOD[b.dataset.value]} · ${counts[b.dataset.value]}`; b.setAttribute('aria-label', `${MOOD[b.dataset.value]}: ${counts[b.dataset.value]} songs`); });
  const r = moodCanvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  moodCanvas.width = r.width * dpr; moodCanvas.height = r.height * dpr;
  const ctx = moodCanvas.getContext('2d'); ctx.scale(dpr, dpr);
  ctx.strokeStyle = 'rgba(243,233,214,.12)'; ctx.setLineDash([3, 4]);
  ctx.beginPath(); ctx.moveTo(r.width / 2, 0); ctx.lineTo(r.width / 2, r.height); ctx.moveTo(0, r.height / 2); ctx.lineTo(r.width, r.height / 2); ctx.stroke();
  ctx.setLineDash([]);
  for (const si of songs) {
    ctx.fillStyle = S.colour[si] ? '#' + S.colour[si] : '#f3e9d6';
    ctx.globalAlpha = F.mood && S.mood[si] !== F.mood ? 0.25 : 0.95;
    ctx.beginPath(); ctx.arc(S.valence[si] * r.width, (1 - S.energy[si]) * r.height, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const big = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  line('p-mood', songs.length ? `<span class="n">${Math.round(big[1] / songs.length * 100)}%</span> are ${MOOD[big[0]]}.` : 'No audio data for this selection.');
}

function renderKeys() {
  const songs = songsOf(entries('key'));
  const counts = new Map();
  songs.forEach(si => S.camelot[si] && counts.set(S.camelot[si], (counts.get(S.camelot[si]) || 0) + 1));
  const max = Math.max(1, ...counts.values());
  const codes = [...KEY_ORDER.map(n => n + 'B'), ...KEY_ORDER.map(n => n + 'A')];
  $('#p-keys-body').innerHTML = `<div class="keys-grid">${codes.map(c => { const n = counts.get(c) || 0; return `<button type="button" data-dim="key" data-value="${c}" aria-pressed="${F.key === c}" style="--v:${(n / max).toFixed(3)}"${n / max < 0.45 ? ' data-low' : ''} aria-label="${KEY_NAMES[c]} (${c}): ${n} songs"><b>${KEY_NAMES[c]}</b>${n}</button>`; }).join('')}</div><p class="caption">Top two rows major keys, bottom two minor, in Camelot order: neighbours mix smoothly.</p>`;
  const best = [...counts].sort((a, b) => b[1] - a[1])[0];
  line('p-keys', best ? `Most common: <span class="n">${KEY_NAMES[best[0]]}</span>, ${fmt(best[1])} songs.` : 'No keys known for this selection.');
}

function renderTracks(sel) {
  const list = [...sel];
  if (sortBy === 'added') list.sort((a, b) => b.t - a.t);
  if (sortBy === 'title') list.sort((a, b) => S.name[a.si].localeCompare(S.name[b.si]));
  if (sortBy === 'year') list.sort((a, b) => (S.year[a.si] || 9999) - (S.year[b.si] || 9999));
  if (sortBy === 'bpm') list.sort((a, b) => (S.tempo[b.si] || 0) - (S.tempo[a.si] || 0));
  const show = list.slice(0, shown);
  $('#tracks').innerHTML = show.map(e => {
    const si = e.si, d = new Date(e.t + EAT);
    const who = e.person ? P[e.pi].name : 'Unrecorded';
    return `<li class="trk${me && e.person === me ? ' is-you' : ''}">
      ${S.small[si] ? `<img class="trk__art" src="https://i.scdn.co/image/${S.small[si]}" width="44" height="44" alt="" loading="lazy" decoding="async">` : '<span class="trk__art"></span>'}
      <div class="trk__main"><a class="trk__name" href="https://open.spotify.com/track/${S.id[si]}">${esc(S.name[si])}</a><span class="trk__artist">${esc(S.artists[si])}</span></div>
      <div class="trk__meta">${e.person ? `<button type="button" data-dim="person" data-value="${esc(e.person)}">${esc(who)}</button>` : `<span>${esc(who)}</span>`}<span>${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}</span>${S.year[si] ? `<span>${S.year[si]}</span>` : ''}${S.tempo[si] ? `<span>${S.tempo[si]} BPM</span>` : ''}${S.camelot[si] ? `<span>${KEY_NAMES[S.camelot[si]]}</span>` : ''}${S.family[si] ? `<button type="button" data-dim="family" data-value="${esc(S.family[si])}">${esc(S.family[si])}</button>` : ''}</div>
      <button type="button" class="trk__play" data-play="${S.id[si]}" aria-label="Play ${esc(S.name[si])} here">▶</button>
    </li>`;
  }).join('');
  $('#tracks-more').hidden = list.length <= shown;
  line('tracklist', `Showing <span class="n">${fmt(show.length)}</span> of ${fmt(list.length)} songs added${anyFilter() ? ' in this selection' : ''}.`);
}

function renderChips() {
  const name = id => P.find(p => p.id === id)?.name || id;
  const labels = {
    person: v => name(v), artist: v => A[v]?.[0] || 'Artist', family: v => v, decade: v => `${v}s`, weekday: v => DAYS[v], hour: v => hourLabel(v),
    month: v => { const [y, m] = v.split('-').map(Number); return `${MONTHS_LONG[m - 1]} ${y}`; }, key: v => KEY_NAMES[v], mood: v => MOOD[v], q: v => `“${v}”`,
  };
  const active = KEYS.filter(k => (k === 'q' ? !!F.q : F[k] != null));
  $('#crate-chips').innerHTML = active.map(k => `<li class="chip${k === 'person' && F.person === me ? ' is-you' : ''}">${esc(labels[k](F[k]))}<button type="button" data-clear="${k}" aria-label="Remove filter ${esc(labels[k](F[k]))}">✕</button></li>`).join('');
  $('#crate-clear').hidden = !active.length;
  const lab = active.length ? labels[active[0]](F[active[0]]) + (active.length > 1 ? ` +${active.length - 1}` : '') : 'All';
  const disc = $('.crate-disc');
  if ($('#crate-label').textContent !== lab) {
    $('#crate-label').textContent = lab;
    if (motion()) { disc.classList.remove('is-spinning'); void disc.offsetWidth; disc.classList.add('is-spinning'); }
  }
}

function render(changed = false) {
  const sel = entries();
  renderStats(sel); renderPeople(); renderArtists(); renderFamilies(); renderMonths(); renderDecades(); renderWeekday(); renderHour(); renderMood(); renderKeys(); renderTracks(sel); renderChips();
  if (changed) writeUrl();
}

// ── Wiring ───────────────────────────────────────────────────────────────────
function wire() {
  document.addEventListener('click', e => {
    const pick = e.target.closest('[data-dim]');
    if (pick) { const v = pick.dataset.value; toggle(pick.dataset.dim, ['decade', 'weekday', 'hour'].includes(pick.dataset.dim) ? Number(v) : v); return; }
    const clr = e.target.closest('[data-clear]');
    if (clr) { F[clr.dataset.clear] = clr.dataset.clear === 'q' ? '' : null; if (clr.dataset.clear === 'q') $('#crate-q').value = ''; render(true); return; }
    const more = e.target.closest('[data-more]');
    if (more) { const host = more.parentElement; host.dataset.open = host.dataset.open === '1' ? '0' : '1'; render(); return; }
    const play = e.target.closest('[data-play]');
    if (play) {
      const f = document.createElement('iframe');
      f.className = 'embed'; f.title = 'Spotify player'; f.loading = 'lazy';
      f.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      f.src = `https://open.spotify.com/embed/track/${encodeURIComponent(play.dataset.play)}?theme=0`;
      play.closest('li').appendChild(f); play.remove();
      return;
    }
    const s = e.target.closest('[data-sort]');
    if (s) { sortBy = s.dataset.sort; document.querySelectorAll('[data-sort]').forEach(b => b.setAttribute('aria-pressed', String(b === s))); shown = PAGE; renderTracks(entries()); }
  });
  $('#tracks-more').addEventListener('click', () => { shown += PAGE; renderTracks(entries()); });
  $('#crate-clear').addEventListener('click', () => { for (const k of KEYS) F[k] = k === 'q' ? '' : null; $('#crate-q').value = ''; render(true); });
  let qt = null;
  $('#crate-q').addEventListener('input', e => { clearTimeout(qt); qt = setTimeout(() => { F.q = e.target.value.trim(); shown = PAGE; render(true); }, 160); });
  if (me && P.some(p => p.id === me)) {
    const b = $('#crate-mine');
    b.hidden = false;
    b.textContent = `Only ${P.find(p => p.id === me).name}`;
    b.addEventListener('click', () => toggle('person', me));
  }
  let rt = null;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { renderMonths(); renderMood(); }, 150); });
  // Motion toggle (same behaviour as the film).
  const mt = $('#motion-toggle');
  const sync = () => { const on = motion(); mt.setAttribute('aria-pressed', String(on)); mt.textContent = on ? 'Motion on' : 'Motion off'; };
  sync();
  mt.addEventListener('click', () => { const on = !motion(); document.documentElement.classList.toggle('motion-off', !on); try { localStorage.setItem('kle-motion', on ? 'on' : 'off'); } catch { /* ignore */ } sync(); });
}

(async () => {
  await load();
  readUrl();
  wire();
  render();
  // Let the server check Spotify for newer songs (it rebuilds the numbers when
  // there are some, at most every 10 minutes). Nothing here waits on it.
  const ping = () => fetch('/api/public/pulse').catch(() => {});
  ('requestIdleCallback' in window) ? requestIdleCallback(ping, { timeout: 6000 }) : setTimeout(ping, 3000);
})();

// Exact values on hover, focus or tap for every column.
(() => {
  const tip = document.createElement('div');
  tip.className = 'tip'; tip.hidden = true; tip.setAttribute('role', 'status');
  document.body.appendChild(tip);
  const show = el => { const r = el.getBoundingClientRect(); tip.textContent = el.dataset.tip; tip.style.left = (r.left + r.width / 2) + 'px'; tip.style.top = Math.max(8, r.top) + 'px'; tip.hidden = false; };
  document.addEventListener('pointerover', e => { const el = e.target.closest('[data-tip]'); if (el && e.pointerType === 'mouse') show(el); });
  document.addEventListener('pointerout', e => { if (e.target.closest('[data-tip]')) tip.hidden = true; });
  document.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); if (el) show(el); });
  document.addEventListener('focusout', () => { tip.hidden = true; });
  addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });
})();
