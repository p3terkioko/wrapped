'use strict';

// Per-contributor statistics, badges, taste twins, and the lazily loaded
// "people" payload used by Find yourself. Shares use the whole playlist
// (all entries) as the denominator.

const nbo = require('../../lib/nairobi');
const { mean, median, round, pct, countBy, ranked } = require('./stats');

const MIN_FOR_BADGE = 5; // songs needed before a rate-based badge is fair

function contributorStats(ctx) {
  const total = ctx.entries.length;
  const by = new Map();
  for (const e of ctx.entries) {
    if (!e.addedBy) continue;
    if (!by.has(e.addedBy)) by.set(e.addedBy, []);
    by.get(e.addedBy).push(e);
  }
  const list = [...by.entries()].map(([id, es]) => {
    const tracks = es.map(e => e.track);
    const withF = tracks.filter(t => t.hasFeatures);
    const years = tracks.map(t => t.year).filter(Boolean);
    const pops = tracks.map(t => t.popularity).filter(p => p != null && p > 0);
    const fam = ranked(countBy(tracks, t => t.family));
    const artistCount = ranked(countBy(tracks.flatMap(t => t.artistNames), a => a));
    const hours = es.map(e => nbo.hour(e.at));
    const lines = tracks.filter(t => t.lyricsStatus === 'counted').reduce((s, t) => ({
      sw: s.sw + (t.linesSwahili || 0), en: s.en + (t.linesEnglish || 0), mx: s.mx + (t.linesMixed || 0), ot: s.ot + (t.linesOther || 0),
    }), { sw: 0, en: 0, mx: 0, ot: 0 });
    const lineTotal = lines.sw + lines.en + lines.mx + lines.ot;
    const fresh = es.filter(e => e.track.released != null && e.at - e.track.released <= 30 * 864e5 && e.at >= e.track.released).length;
    return {
      id,
      name: ctx.nameOf(id),
      avatar: ctx.avatarOf(id),
      n: es.length,
      share: pct(es.length, total),
      first: es[0].at,
      last: es[es.length - 1].at,
      entries: es,
      artistIds: new Set(tracks.flatMap(t => t.artistIds)),
      families: fam.map(([family, n]) => ({ family, n })),
      familyCount: fam.length,
      diversity: (() => { const tot = fam.reduce((x, [, n]) => x + n, 0); return tot ? round(-fam.reduce((x, [, n]) => x + (n / tot) * Math.log2(n / tot), 0), 3) : null; })(),
      familySongs: fam.reduce((x, [, n]) => x + n, 0),
      topArtist: artistCount[0] ? { name: artistCount[0][0], n: artistCount[0][1] } : null,
      medianYear: years.length ? Math.round(median(years)) : null,
      medianPopularity: pops.length ? median(pops) : null,
      features: {
        n: withF.length,
        energy: round(mean(withF.map(t => t.energy)), 3),
        valence: round(mean(withF.map(t => t.valence)), 3),
        danceability: round(mean(withF.map(t => t.danceability)), 3),
      },
      nightShare: pct(hours.filter(h => h >= 22 || h < 4).length, hours.length),
      morningShare: pct(hours.filter(h => h >= 5 && h < 9).length, hours.length),
      favouriteHour: ranked(countBy(hours, h => h))[0]?.[0] ?? null,
      favouriteWeekday: ranked(countBy(es, e => nbo.weekday(e.at)))[0]?.[0] ?? null,
      eastAfricanShare: pct(tracks.filter(t => t.family === 'East African').length, tracks.filter(t => t.family).length),
      swahiliShare: lineTotal ? pct(lines.sw + lines.mx, lineTotal) : null,
      lyricSongs: tracks.filter(t => t.lyricsStatus === 'counted').length,
      freshShare: pct(fresh, es.length),
    };
  });
  list.sort((a, b) => b.n - a.n || a.first - b.first);
  for (const c of list) c.rank = 1 + list.filter(o => o.n > c.n).length;
  return list;
}

// Taste twins: pairs who share the most artists relative to their combined
// collections (Jaccard similarity of artist sets), among people with 5+ songs
// who share at least 3 artists.
function twinPairs(stats, ctx) {
  const pool = stats.filter(c => c.n >= 5);
  const pairs = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i], b = pool[j];
      const shared = [...a.artistIds].filter(x => b.artistIds.has(x));
      if (shared.length < 3) continue;
      const union = new Set([...a.artistIds, ...b.artistIds]).size;
      const names = shared.map(id => ctx.artists.get(id)?.name).filter(Boolean);
      pairs.push({ a: a.id, b: b.id, shared: shared.length, jaccard: round(shared.length / union, 3), artists: names.slice(0, 4) });
    }
  }
  return pairs.sort((x, y) => y.jaccard - x.jaccard || y.shared - x.shared);
}

const tasteTwins = (stats, ctx) => twinPairs(stats, ctx).slice(0, 8);

// Each person's closest match (null when nobody shares 3+ artists with them).
function bestTwins(stats, ctx) {
  const pairs = twinPairs(stats, ctx);
  const best = new Map();
  for (const p of pairs) {
    if (!best.has(p.a)) best.set(p.a, p);
    if (!best.has(p.b)) best.set(p.b, p);
  }
  return best;
}

// Badges celebrate; each goes to one person, with the number that earned it.
function badges(stats, ctx) {
  const out = [];
  const eligible = stats.filter(c => c.n >= MIN_FOR_BADGE);
  const award = (id, name, holder, value, description) => holder && out.push({ id, name, holder: holder.id, holderName: holder.name, value, description });
  const top = (arr, f, dir = 1) => arr.filter(c => f(c) != null).sort((a, b) => dir * (f(b) - f(a)) || b.n - a.n)[0];

  award('top_curator', 'Top Curator', stats[0], stats[0]?.n, `Added the most songs: ${stats[0]?.n} of ${ctx.entries.length} (${stats[0]?.share}%)`);

  // Eclectic Ear: the most even spread across genre families (Shannon
  // diversity), among people with at least eight songs that have a family.
  const ee = top(stats.filter(c => c.familySongs >= 8), c => c.diversity);
  award('eclectic_ear', 'Eclectic Ear', ee, ee?.diversity, `The widest spread of sound: songs from ${ee?.familyCount} genre families, more evenly than anyone`);

  const os = top(eligible, c => c.medianYear, -1);
  award('old_soul', 'Old Soul', os, os?.medianYear, `Their typical song came out in ${os?.medianYear}`);

  const fd = top(eligible, c => c.freshShare);
  if (fd?.freshShare > 0) award('fresh_dropper', 'Fresh Dropper', fd, fd.freshShare, `${fd.freshShare}% of their songs were added within a month of release`);

  const uh = top(eligible.filter(c => c.medianPopularity != null), c => c.medianPopularity, -1);
  award('underground_hero', 'Underground Hero', uh, uh?.medianPopularity, `Digs deepest: median Spotify popularity of ${uh?.medianPopularity}`);

  const no = top(eligible, c => c.nightShare);
  if (no?.nightShare > 0) award('night_owl', 'Night Owl', no, no.nightShare, `${no.nightShare}% of their songs were added between 10pm and 4am`);

  const eb = top(eligible, c => c.morningShare);
  if (eb?.morningShare > 0) award('early_bird', 'Early Bird', eb, eb.morningShare, `${eb.morningShare}% of their songs were added between 5am and 9am`);

  const hh = top(eligible, c => c.eastAfricanShare);
  if (hh?.eastAfricanShare > 0) award('hometown_hero', 'Hometown Hero', hh, hh.eastAfricanShare, `${hh.eastAfricanShare}% of their songs are East African`);

  const ss = top(eligible.filter(c => c.lyricSongs >= MIN_FOR_BADGE), c => c.swahiliShare);
  if (ss?.swahiliShare > 0) award('sheng_sensei', 'Sheng Sensei', ss, ss.swahiliShare, `${ss.swahiliShare}% of the lyric lines in their songs are in Swahili or Sheng`);

  // The four audio badges, restored: awarded to the highest (or lowest)
  // average among people with at least five songs that have audio features.
  const audio = eligible.filter(c => c.features.n >= MIN_FOR_BADGE);
  const ed = top(audio, c => c.features.energy);
  award('energy_dealer', 'Energy Dealer', ed, ed?.features.energy, `Highest-energy picks: ${Math.round((ed?.features.energy || 0) * 100)}% average energy`);
  const dc = top(audio, c => c.features.danceability);
  award('dancefloor_commander', 'Dancefloor Commander', dc, dc?.features.danceability, `Most danceable picks: ${Math.round((dc?.features.danceability || 0) * 100)}% average danceability`);
  const vm = top(audio, c => c.features.valence);
  award('vibes_master', 'Vibes Master', vm, vm?.features.valence, `Brightest picks: ${Math.round((vm?.features.valence || 0) * 100)}% average positivity`);
  const sb = top(audio, c => c.features.valence, -1);
  award('sad_boi', 'Sad Boi', sb, sb?.features.valence, `Brings the feels: ${Math.round((sb?.features.valence || 0) * 100)}% average positivity, the most heartfelt picks`);

  return out;
}

// Month-by-month race: cumulative songs per person at the end of each Nairobi
// month, for everyone who was ever in the top eight.
function race(stats, ctx) {
  const months = [];
  const first = nbo.monthKey(ctx.entries[0].at), last = nbo.monthKey(ctx.entries[ctx.entries.length - 1].at);
  let [y, m] = first.split('-').map(Number);
  for (;;) {
    const k = `${y}-${String(m).padStart(2, '0')}`;
    months.push(k);
    if (k === last) break;
    m += 1; if (m === 13) { m = 1; y += 1; }
  }
  const series = new Map(stats.map(c => [c.id, months.map(() => 0)]));
  for (const c of stats) {
    const arr = series.get(c.id);
    for (const e of c.entries) arr[months.indexOf(nbo.monthKey(e.at))] += 1;
    for (let i = 1; i < arr.length; i++) arr[i] += arr[i - 1];
  }
  const ever = new Set();
  months.forEach((_, i) => {
    stats.map(c => ({ id: c.id, v: series.get(c.id)[i], first: c.first }))
      .filter(x => x.v > 0).sort((a, b) => b.v - a.v || a.first - b.first).slice(0, 8)
      .forEach(x => ever.add(x.id));
  });
  const ids = stats.filter(c => ever.has(c.id)).map(c => c.id);
  return { months, ids, counts: Object.fromEntries(ids.map(id => [id, series.get(id)])) };
}

// Lazily loaded payload: one record per contributor for Find yourself.
function buildPeople(ctx, stats, extras) {
  const { badgeList, songRef } = extras;
  const twins = bestTwins(stats, ctx);
  return {
    contributors: stats.map(c => {
      const twin = twins.get(c.id);
      return {
        id: c.id, name: c.name, avatar: c.avatar, n: c.n, share: c.share, rank: c.rank,
        first: new Date(c.first).toISOString(), last: new Date(c.last).toISOString(),
        days: [...new Set(c.entries.map(e => nbo.dayKey(e.at)))].length,
        families: c.families.slice(0, 5), topArtist: c.topArtist, medianYear: c.medianYear,
        medianPopularity: c.medianPopularity, features: c.features,
        favouriteHour: c.favouriteHour, favouriteWeekday: c.favouriteWeekday,
        nightShare: c.nightShare, swahiliShare: c.swahiliShare, lyricSongs: c.lyricSongs,
        badges: badgeList.filter(b => b.holder === c.id).map(b => b.id),
        twin: twin ? { id: twin.a === c.id ? twin.b : twin.a, shared: twin.shared, jaccard: twin.jaccard, artists: twin.artists } : null,
        songs: c.entries.map(e => ctx.songIndex.get(e.track.songKey)),
        firstSong: songRef(c.entries[0].track),
      };
    }),
  };
}

module.exports = { contributorStats, tasteTwins, bestTwins, badges, race, buildPeople, MIN_FOR_BADGE };
