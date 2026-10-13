'use strict';

// The sound: what it sounds like. Counts are unique songs (one per ISRC).

const { esc, fmt, pct, spotifyTrack } = require('../util');
const { hbars, columns } = require('../charts');

const regionName = (() => { try { const d = new Intl.DisplayNames(['en'], { type: 'region' }); return c => d.of(c) || c; } catch { return c => c; } })();
const KEY_ORDER = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1]; // camelot numbers clockwise from C major at the top
const CAMELOT_NAMES = { '1B': 'B', '2B': 'F♯', '3B': 'D♭', '4B': 'A♭', '5B': 'E♭', '6B': 'B♭', '7B': 'F', '8B': 'C', '9B': 'G', '10B': 'D', '11B': 'A', '12B': 'E', '1A': 'A♭m', '2A': 'E♭m', '3A': 'B♭m', '4A': 'Fm', '5A': 'Cm', '6A': 'Gm', '7A': 'Dm', '8A': 'Am', '9A': 'Em', '10A': 'Bm', '11A': 'F♯m', '12A': 'D♯m' };

function tenths(share) {
  const k = Math.round(share / 10);
  return Math.abs(share - k * 10) <= 1.5 && k >= 1 && k <= 9 ? `${k} in 10` : pct(share, 0);
}

function renderFamilies(film) {
  const s = film.sound;
  const cov = s.familyCoverage;
  const top = s.families[0];
  const rows = s.families.slice(0, 10).map((f, i) => ({ label: f.family, value: f.n, highlight: i === 0, note: f.genres.slice(0, 3).map(g => g.genre).join(' · ') }));
  const rest = s.families.slice(10).reduce((x, f) => x + f.n, 0);
  return `<section class="chapter families" id="sound" aria-labelledby="families-h" data-chapter="families" data-record="families">
  <div class="chapter__head">
    <h2 class="headline" id="families-h" data-split>${esc(top.family)} music leads: <span class="n">${fmt(top.n)}</span> of the ${fmt(cov.songs)} songs with a genre.</h2>
    <p class="sub">Spotify tags artists, not songs, and its tags for Kenyan artists are noisy, so every song is counted once, in the family most of its artists' tags point to.</p>
  </div>
  <div class="chapter__narrow">
    ${hbars(rows, { share: r => (r.value / cov.songs) * 100 })}
    <p class="caption">Unique songs by primary genre family${rest ? `; ${fmt(rest)} more in smaller families` : ''}. Based on ${fmt(cov.songs)} of ${fmt(cov.of)} songs: the rest are by artists with no Spotify genre tags. Regional African tags decide first, then pan-African ones (afro soul, afro r&amp;b, afropop), then global styles.</p>
  </div>
</section>`;
}

function renderEras(film) {
  const s = film.sound;
  const dated = s.years.reduce((x, y) => x + y.n, 0);
  const d2020 = s.decades.find(d => d.decade === 2020);
  const share = d2020 ? (d2020.n / dated) * 100 : 0;
  const y0 = s.years[0].year, y1 = s.years[s.years.length - 1].year;
  const byYear = Object.fromEntries(s.years.map(y => [y.year, y.n]));
  const cols = [];
  for (let y = y0; y <= y1; y++) cols.push({ label: y % 10 === 0 ? String(y) : '', value: byYear[y] || 0, highlight: y >= 2020, tick: y % 10 === 0 });
  const p = film.picks;
  return `<section class="chapter eras" id="eras" aria-labelledby="eras-h" data-chapter="eras" data-record="eras">
  <div class="chapter__head">
    <h2 class="headline" id="eras-h" data-split><span class="n">${tenths(share)}</span> songs came out in the 2020s.</h2>
    <p class="sub">The oldest is from ${y0}${p.oldest ? `: ${esc(p.oldest.name)} by ${esc(p.oldest.artists)}` : ''}. The newest came out in ${y1}${p.newest ? `: ${esc(p.newest.name)}` : ''}.</p>
  </div>
  ${columns(cols, { id: 'eras-chart', height: 200, title: 'Songs by release year', desc: s.decades.map(d => `${d.decade}s: ${d.n} songs`).join('; ') })}
  <ul class="decade-row">${s.decades.map(d => `<li${d.decade === 2020 ? ' class="is-lead"' : ''}><b>${d.decade}s</b> ${fmt(d.n)}</li>`).join('')}</ul>
  <p class="caption">Unique songs by the year their album or single was released (${fmt(dated)} songs). A song added from a later compilation counts in that compilation's year.</p>
</section>`;
}

function renderMood(film) {
  const m = film.sound.mood;
  const q = m.quadrants;
  const n = m.coverage.songs;
  const quads = [['brightLoud', 'bright and high-energy'], ['darkLoud', 'intense: high energy, darker mood'], ['brightCalm', 'calm and bright'], ['darkCalm', 'calm and darker']];
  const [bigKey, bigLabel] = quads.sort((a, b) => q[b[0]] - q[a[0]])[0];
  const share = (q[bigKey] / n) * 100;
  const W = 300, H = 300;
  const dots = m.points.map(([v, e, c]) => `<circle cx="${(v / 100 * W).toFixed(1)}" cy="${((1 - e / 100) * H).toFixed(1)}" r="3.2" fill="${c ? '#' + c : '#f3e9d6'}"/>`).join('');
  return `<section class="chapter mood" id="mood" aria-labelledby="mood-h" data-chapter="mood" data-record="mood">
  <div class="mood__grid">
    <div class="chapter__head">
      <h2 class="headline" id="mood-h" data-split><span class="n">${pct(share, 0)}</span> of the songs with audio data are ${esc(bigLabel)}.</h2>
      <p class="sub">On average the playlist sits at ${Math.round(m.averages.energy * 100)}% energy, ${Math.round(m.averages.valence * 100)}% positivity and ${Math.round(m.averages.danceability * 100)}% danceability. Each dot is a song, in the colour of its cover.</p>
    </div>
    <figure class="moodmap">
      <svg viewBox="-34 -14 ${W + 48} ${H + 46}" role="img" aria-labelledby="mood-t mood-d" data-reveal="dots">
        <title id="mood-t">Mood map: energy against positivity</title>
        <desc id="mood-d">${fmt(n)} songs. Bright and high-energy: ${q.brightLoud}. Intense, darker: ${q.darkLoud}. Calm and bright: ${q.brightCalm}. Calm and darker: ${q.darkCalm}.</desc>
        <rect class="moodmap__frame" x="0" y="0" width="${W}" height="${H}"/>
        <line class="moodmap__mid" x1="${W / 2}" x2="${W / 2}" y1="0" y2="${H}"/><line class="moodmap__mid" x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}"/>
        <g class="moodmap__dots">${dots}</g>
        <text class="moodmap__q" x="${W - 6}" y="16" text-anchor="end">bright, loud · ${q.brightLoud}</text>
        <text class="moodmap__q" x="6" y="16">darker, loud · ${q.darkLoud}</text>
        <text class="moodmap__q" x="${W - 6}" y="${H - 8}" text-anchor="end">bright, calm · ${q.brightCalm}</text>
        <text class="moodmap__q" x="6" y="${H - 8}">darker, calm · ${q.darkCalm}</text>
        <text class="axis" x="${W / 2}" y="${H + 26}" text-anchor="middle">positivity →</text>
        <text class="axis" x="-14" y="${H / 2}" text-anchor="middle" transform="rotate(-90 -14 ${H / 2})">energy →</text>
      </svg>
    </figure>
  </div>
  <p class="caption">Energy and positivity (valence) from ReccoBeats, 0 to 100%. Based on ${fmt(n)} of ${fmt(m.coverage.of)} unique songs.</p>
</section>`;
}

function renderTempo(film) {
  const t = film.sound.tempo;
  const cols = t.bins.map(b => ({ label: b.from % 20 === 0 ? String(b.from) : '', value: b.n, highlight: t.median >= b.from && t.median < b.to, tick: b.from % 20 === 0 }));
  const src = t.sources;
  return `<section class="chapter tempo" id="tempo" aria-labelledby="tempo-h" data-chapter="tempo" data-record="tempo">
  <div class="chapter__head">
    <h2 class="headline" id="tempo-h" data-split>The playlist's heartbeat: <span class="n">${fmt(Math.round(t.median))}</span> beats per minute.</h2>
    <p class="sub">That's the median tempo, and it's the tempo this page moves to: every entrance and pulse is timed to it.</p>
  </div>
  <div class="heartbeat" aria-hidden="true"><svg viewBox="0 0 600 60" preserveAspectRatio="none"><path id="ecg" d="M0 30 H170 L182 30 L190 8 L200 52 L210 22 L218 30 H600"/></svg></div>
  ${columns(cols, { id: 'tempo-chart', height: 180, title: 'Songs by tempo', desc: t.bins.filter(b => b.n).map(b => `${b.from}–${b.to} BPM: ${b.n}`).join('; '), valueLabels: false })}
  <p class="caption">Unique songs in 10 BPM bands; the band with the median is highlighted. Tempo known for ${fmt(t.coverage.songs)} of ${fmt(t.coverage.of)} songs: ${fmt(src.reccobeats || 0)} from ReccoBeats, ${fmt(src.essentia || 0)} estimated from 30-second previews, ${fmt(src.deezer || 0)} from Deezer. Fast songs are sometimes measured at half speed, and slow ones at double.</p>
</section>`;
}

function keyWheel(keys) {
  const R1 = 140, R2 = 100, R3 = 62, cx = 0, cy = 0;
  const max = Math.max(...Object.values(keys.camelot), 1);
  const top = Object.entries(keys.camelot).sort((a, b) => b[1] - a[1])[0]?.[0];
  const seg = (i, r0, r1) => {
    const a0 = (i / 12) * Math.PI * 2 - Math.PI / 2 - Math.PI / 12, a1 = a0 + Math.PI / 6;
    const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
    return `M ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`;
  };
  let out = '';
  KEY_ORDER.forEach((num, i) => {
    for (const [letter, r0, r1] of [['B', R2, R1], ['A', R3, R2]]) {
      const code = num + letter, n = keys.camelot[code] || 0;
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2, rm = (r0 + r1) / 2;
      out += `<path class="kw-seg${code === top ? ' is-lead' : ''}" d="${seg(i, r0, r1)}" style="--o:${(0.08 + 0.92 * (n / max)).toFixed(3)}"><title>${code} (${CAMELOT_NAMES[code]}): ${n} songs</title></path>`;
      out += `<text class="kw-label" x="${(rm * Math.cos(a)).toFixed(1)}" y="${(rm * Math.sin(a) + 3).toFixed(1)}" text-anchor="middle">${CAMELOT_NAMES[code]}</text>`;
    }
  });
  return `<svg class="keywheel" viewBox="-150 -150 300 300" role="img" aria-labelledby="kw-t kw-d" data-reveal="wheel"><title id="kw-t">Camelot key wheel</title><desc id="kw-d">Songs per key. Outer ring major, inner ring minor. Most common: ${top} (${CAMELOT_NAMES[top]}).</desc>${out}<circle r="${R3 - 4}" class="kw-hub"/><text class="kw-hub-t" y="-4" text-anchor="middle">${fmt(keys.major)} major</text><text class="kw-hub-t" y="12" text-anchor="middle">${fmt(keys.minor)} minor</text></svg>`;
}

function renderKeys(film) {
  const k = film.sound.keys;
  const majorShare = (k.major / (k.major + k.minor)) * 100;
  const mix = film.picks.perfectMix;
  return `<section class="chapter keys" id="keys" aria-labelledby="keys-h" data-chapter="keys" data-record="keys">
  <div class="keys__grid">
    <div class="chapter__head">
      <h2 class="headline" id="keys-h" data-split>The most common key is <span class="n">${esc(k.top.name)}</span>.</h2>
      <p class="sub">${pct(majorShare, 0)} of songs are in a major key. Neighbours on the wheel mix smoothly into each other, which is how DJs plan a set.</p>
    </div>
    ${keyWheel(k)}
  </div>
  ${mix ? `<div class="mix">
    <h3 class="mix__h">A perfect mix, from the playlist: ${fmt(mix.songs.length)} songs, ${fmt(mix.people)} different people.</h3>
    <ol class="mix__list" data-reveal="fade">${mix.songs.map(sg => `<li><span class="mix__key">${esc(sg.camelot)}</span><span class="mix__bpm">${fmt(sg.tempo)}</span><a href="${spotifyTrack(sg.id)}">${esc(sg.name)}</a><span class="mix__by">${esc(sg.artists)} · added by ${esc(sg.addedBy)}</span></li>`).join('')}</ol>
    <p class="caption">${esc(mix.rule)} Keys and tempos from ReccoBeats or estimated from previews.</p>
  </div>` : ''}
  <p class="caption">Key known for ${fmt(k.coverage.songs)} of ${fmt(k.coverage.of)} unique songs.</p>
</section>`;
}

function renderLanguage(film) {
  const l = film.sound.language;
  const L = l.lines, tot = l.lineTotal || 1;
  const parts = [['swahili', 'Swahili & Sheng'], ['mixed', 'Mixed in one line'], ['english', 'English'], ['other', 'Other languages']];
  const swShare = ((L.swahili + L.mixed) / tot) * 100;
  const ea = l.eastAfrican;
  return `<section class="chapter language" id="language" aria-labelledby="lang-h" data-chapter="language" data-record="language">
  <div class="chapter__head">
    <h2 class="headline" id="lang-h" data-split><span class="n">${pct(swShare, 0)}</span> of the lyric lines we could read are in Swahili or Sheng, alone or mixed with English.</h2>
    <p class="sub">The typical song runs at ${fmt(l.medianWpm)} words a minute. The fastest, ${l.fastest ? `${esc(l.fastest.name)} by ${esc(l.fastest.artists)}, hits ${fmt(Math.round(l.fastest.wpm))}` : '—'}.</p>
  </div>
  <div class="stack" role="img" aria-label="${parts.map(([k, lab]) => `${lab}: ${pct((L[k] / tot) * 100)}`).join(', ')}" data-reveal="stack">
    ${parts.map(([k, lab]) => `<span class="stack__part stack__part--${k}" style="--w:${((L[k] / tot) * 100).toFixed(2)}%"><span class="stack__label">${esc(lab)} <b>${pct((L[k] / tot) * 100, 0)}</b></span></span>`).join('')}
  </div>
  <p class="caption">Lines of lyrics from LRCLIB, classified line by line by matching common Swahili, Sheng and English words; lines with both count as mixed, and languages the method can't tell apart (Lingala, French, Pidgin…) count as other. Lyrics found for ${fmt(l.coverage.songs)} of ${fmt(l.coverage.of)} unique songs (${fmt(l.instrumental)} instrumental), but only ${fmt(ea.songs)} of ${fmt(ea.of)} East African songs, so Swahili is under-counted. No lyrics are stored, only these counts.</p>
</section>`;
}

function renderGeography(film) {
  const g = film.sound.geography;
  const rows = g.countries.slice(0, 10).map(c => ({ label: regionName(c.code), value: c.n, highlight: c.code === 'KE' }));
  const ea = g.eastAfrican;
  return `<section class="chapter geo" id="geography" aria-labelledby="geo-h" data-chapter="geo" data-record="geo">
  <div class="chapter__head">
    <h2 class="headline" id="geo-h" data-split><span class="n">${fmt(g.kenya)}</span> songs are by artists from Kenya, as far as the records know.</h2>
    <p class="sub">The lead artist's home country, for the songs where MusicBrainz has one.</p>
  </div>
  <div class="chapter__narrow">
    ${hbars(rows)}
    <p class="caption">Unique songs by the lead artist's country, from MusicBrainz (with admin corrections). Known for ${fmt(g.coverage.songs)} of ${fmt(g.coverage.of)} songs, and for only ${fmt(ea.songs)} of the ${fmt(ea.of)} East African songs, so Kenya is under-counted here; the genre families above (${fmt(g.eastAfricanFamily)} East African songs) are the better guide.</p>
  </div>
</section>`;
}

module.exports = { renderFamilies, renderEras, renderMood, renderTempo, renderKeys, renderLanguage, renderGeography };
