'use strict';

// The core payload for the scroll film. Everything here is computed from the
// database; the browser only animates it. Count bases:
//   entries      — every add (515). Used for people, time, runtime, growth.
//   unique songs — one per ISRC (485). Used for what the music sounds like.
//   artists      — distinct credited artists.

const nbo = require('../../lib/nairobi');
const { sum, mean, median, round, pct, countBy, ranked, camelot, keyName, compatible } = require('./stats');
const { contributorStats, tasteTwins, badges, race } = require('./people');
const { FAMILIES } = require('../genres');

const YEAR_MS = 365.25 * 864e5;
const imageHash = url => (url ? String(url).split('/image/')[1] || url : null);

function songRef(t, extra = {}) {
  return {
    id: t.id, name: t.name, artists: t.artistNames.join(', '), year: t.year,
    image: imageHash(t.imageUrl), colour: t.colour || null, url: `https://open.spotify.com/track/${t.id}`, ...extra,
  };
}

function totals(ctx) {
  const E = ctx.entries;
  const artistIds = new Set(E.flatMap(e => e.track.artistIds));
  const genres = new Set(E.flatMap(e => e.track.genres));
  const songsWithGenre = ctx.songs.filter(t => t.genres.length).length;
  return {
    entries: E.length,
    uniqueSongs: ctx.songs.length,
    duplicateEntries: E.length - ctx.songs.length,
    artists: artistIds.size,
    genres: genres.size,
    genreCoverage: { songs: songsWithGenre, of: ctx.songs.length },
    contributors: new Set(E.map(e => e.addedBy).filter(Boolean)).size,
    unattributed: E.filter(e => !e.addedBy).length,
    runtimeMs: sum(E.map(e => e.track.durationMs)),
    explicitSongs: ctx.songs.filter(t => t.explicit).length,
    firstAddedAt: new Date(E[0].at).toISOString(),
    lastAddedAt: new Date(E[E.length - 1].at).toISOString(),
    days: nbo.daysBetween(E[0].at, E[E.length - 1].at),
  };
}

// "Press play Friday at 6pm and it's still going at …"
function runtime(ms) {
  const totalMin = ms / 60000;
  const end = 18 * 60 + totalMin;
  const dayIndex = (5 + Math.floor(end / 1440)) % 7;
  const minuteOfDay = Math.floor(end % 1440);
  const h = Math.floor(minuteOfDay / 60), m = minuteOfDay % 60;
  const h12 = ((h + 11) % 12) + 1;
  return {
    ms, hours: Math.floor(totalMin / 60), minutes: Math.floor(totalMin % 60),
    start: { day: 'Friday', time: '18:00', label: 'Friday at 6pm' },
    end: { day: nbo.DAYS[dayIndex], time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, label: `${h12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'} ${nbo.DAYS[dayIndex]}` },
  };
}

function opening(ctx) {
  const E = ctx.entries;
  const first = E[0].at;
  const growth = [];
  let n = 0;
  for (const e of E) {
    n += 1;
    const d = nbo.daysBetween(first, e.at);
    if (growth.length && growth[growth.length - 1][0] === d) growth[growth.length - 1][1] = n;
    else growth.push([d, n]);
  }
  const milestone = k => {
    const e = E[k - 1];
    return { n: k, at: new Date(e.at).toISOString(), by: e.addedBy, name: ctx.nameOf(e.addedBy), song: songRef(e.track) };
  };
  const marks = [...new Set([1, 100, 250, 500, E.length].filter(k => k <= E.length))];
  return {
    tiles: {
      colours: E.map(e => (e.track.colour || '').replace('#', '')),
      years: E.map(e => e.track.year),
      days: E.map(e => nbo.daysBetween(first, e.at)),
      songs: E.map(e => ctx.songIndex.get(e.track.songKey)),
    },
    growth,
    milestones: marks.map(milestone),
  };
}

function people(ctx, stats) {
  const twins = tasteTwins(stats, ctx);
  const badgeList = badges(stats, ctx);
  return {
    ranking: stats.map(c => ({ id: c.id, name: c.name, avatar: c.avatar, n: c.n, share: c.share, rank: c.rank, first: new Date(c.first).toISOString() })),
    unattributed: ctx.entries.filter(e => !e.addedBy).length,
    race: race(stats, ctx),
    twins,
    badges: badgeList,
    _twins: twins,
    _badges: badgeList,
  };
}

function sound(ctx) {
  const S = ctx.songs;
  const N = S.length;

  // Families (primary family per song) and the genres inside each.
  const famCount = countBy(S, t => t.family);
  const genreSongs = new Map();
  for (const t of S) for (const g of t.genres) genreSongs.set(g, (genreSongs.get(g) || 0) + 1);
  const { familyOf } = require('../genres');
  const families = ranked(famCount).map(([family, n]) => ({
    family, n, share: pct(n, N),
    genres: ranked(new Map([...genreSongs].filter(([g]) => familyOf(g, ctx.familyOverrides) === family))).slice(0, 4).map(([genre, c]) => ({ genre, n: c })),
  }));
  const covered = S.filter(t => t.family).length;

  // Release years and decades (unique songs).
  const years = ranked(countBy(S, t => t.year)).map(([y, n]) => ({ year: Number(y), n })).sort((a, b) => a.year - b.year);
  const decades = ranked(countBy(S, t => (t.year ? Math.floor(t.year / 10) * 10 : null))).map(([d, n]) => ({ decade: Number(d), n, share: pct(n, N) })).sort((a, b) => a.decade - b.decade);

  // Tempo.
  const withTempo = S.filter(t => t.tempo > 0);
  const tempos = withTempo.map(t => t.tempo);
  const bins = [];
  for (let b = 50; b < 210; b += 10) bins.push({ from: b, to: b + 10, n: tempos.filter(x => x >= b && x < b + 10).length });
  const tempo = {
    median: round(median(tempos), 1),
    coverage: { songs: withTempo.length, of: N },
    sources: Object.fromEntries(ranked(countBy(withTempo, t => t.tempoSource))),
    bins,
  };

  // Keys on the Camelot wheel.
  const withKey = S.filter(t => t.key != null && t.key >= 0 && t.mode != null);
  const cam = countBy(withKey, t => camelot(t.key, t.mode));
  const topKey = ranked(countBy(withKey, t => keyName(t.key, t.mode)))[0];
  const keys = {
    camelot: Object.fromEntries(cam),
    major: withKey.filter(t => t.mode === 1).length,
    minor: withKey.filter(t => t.mode === 0).length,
    top: topKey ? { name: topKey[0], n: topKey[1] } : null,
    coverage: { songs: withKey.length, of: N },
    sources: Object.fromEntries(ranked(countBy(withKey, t => t.keySource))),
  };

  // Mood: energy against valence.
  const withF = S.filter(t => t.hasFeatures);
  const q = (e, v) => withF.filter(t => (t.energy >= 0.5) === e && (t.valence >= 0.5) === v).length;
  const mood = {
    averages: {
      energy: round(mean(withF.map(t => t.energy)), 3), valence: round(mean(withF.map(t => t.valence)), 3),
      danceability: round(mean(withF.map(t => t.danceability)), 3), acousticness: round(mean(withF.map(t => t.acousticness)), 3),
    },
    quadrants: { brightLoud: q(true, true), darkLoud: q(true, false), brightCalm: q(false, true), darkCalm: q(false, false) },
    coverage: { songs: withF.length, of: N },
    // [positivity 0-100, energy 0-100, artwork colour] per song with features
    points: withF.map(t => [Math.round(t.valence * 100), Math.round(t.energy * 100), (t.colour || '').replace('#', '')]),
  };

  // Language mix from lyric lines (numbers only).
  const counted = S.filter(t => t.lyricsStatus === 'counted');
  const lines = { swahili: sum(counted.map(t => t.linesSwahili || 0)), english: sum(counted.map(t => t.linesEnglish || 0)), mixed: sum(counted.map(t => t.linesMixed || 0)), other: sum(counted.map(t => t.linesOther || 0)) };
  const dominant = t => {
    const c = { swahili: t.linesSwahili || 0, english: t.linesEnglish || 0, mixed: t.linesMixed || 0, other: t.linesOther || 0 };
    const tot = sum(Object.values(c));
    if (!tot) return null;
    if (c.mixed / tot >= 0.25 || (c.swahili / tot >= 0.2 && c.english / tot >= 0.2)) return 'mixed';
    return ranked(new Map(Object.entries(c)))[0][0];
  };
  const fastest = [...counted].filter(t => t.wordsPerMinute).sort((a, b) => b.wordsPerMinute - a.wordsPerMinute)[0];
  const language = {
    lines, lineTotal: sum(Object.values(lines)),
    songs: Object.fromEntries(ranked(countBy(counted, dominant))),
    instrumental: S.filter(t => t.lyricsStatus === 'instrumental').length,
    coverage: { songs: S.filter(t => t.lyricsKnown).length, of: N },
    medianWpm: round(median(counted.map(t => t.wordsPerMinute).filter(Boolean)), 0),
    fastest: fastest ? songRef(fastest, { wpm: fastest.wordsPerMinute }) : null,
  };

  // Where the lead artist is from (MusicBrainz, with admin corrections).
  const withCountry = S.filter(t => t.country);
  const geography = {
    countries: ranked(countBy(withCountry, t => t.country)).map(([code, n]) => ({ code, n })),
    kenya: withCountry.filter(t => t.country === 'KE').length,
    coverage: { songs: withCountry.length, of: N },
    eastAfricanFamily: S.filter(t => t.family === 'East African').length,
  };

  // How well the outside sources cover East African songs specifically.
  const ea = S.filter(t => t.family === 'East African');
  language.eastAfrican = { songs: ea.filter(t => t.lyricsKnown).length, of: ea.length };
  geography.eastAfrican = { songs: ea.filter(t => t.country).length, of: ea.length, kenya: ea.filter(t => t.country === 'KE').length };

  return {
    families, familyCoverage: { songs: covered, of: N }, familyOrder: FAMILIES,
    topGenres: ranked(genreSongs).slice(0, 12).map(([genre, n]) => ({ genre, n })),
    years, decades, tempo, keys, mood, language, geography,
  };
}

function rhythm(ctx) {
  const E = ctx.entries;
  const weekday = Array(7).fill(0), hour = Array(24).fill(0);
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const e of E) {
    const d = nbo.weekday(e.at), h = nbo.hour(e.at);
    weekday[d] += 1; hour[h] += 1; heat[d][h] += 1;
  }
  const calendar = ranked(countBy(E, e => nbo.dayKey(e.at))).map(([day, n]) => ({ day, n })).sort((a, b) => a.day.localeCompare(b.day));
  const busiest = [...calendar].sort((a, b) => b.n - a.n || a.day.localeCompare(b.day))[0];

  // Binges: one person, 5+ songs in a session with gaps of 30 minutes or less.
  const binges = [];
  const byPerson = new Map();
  for (const e of E) if (e.addedBy) (byPerson.get(e.addedBy) || byPerson.set(e.addedBy, []).get(e.addedBy)).push(e);
  for (const [id, es] of byPerson) {
    let run = [es[0]];
    const flush = () => { if (run.length >= 5) binges.push({ by: id, name: ctx.nameOf(id), n: run.length, from: new Date(run[0].at).toISOString(), to: new Date(run[run.length - 1].at).toISOString(), minutes: Math.round((run[run.length - 1].at - run[0].at) / 60000) }); };
    for (let i = 1; i < es.length; i++) {
      if (es[i].at - es[i - 1].at <= 30 * 60000) run.push(es[i]);
      else { flush(); run = [es[i]]; }
    }
    flush();
  }
  binges.sort((a, b) => b.n - a.n || a.minutes - b.minutes);

  // Droughts: 14+ days with no new song.
  const droughts = [];
  for (let i = 1; i < E.length; i++) {
    const days = nbo.daysBetween(E[i - 1].at, E[i].at);
    if (days >= 14) droughts.push({ from: new Date(E[i - 1].at).toISOString(), to: new Date(E[i].at).toISOString(), days, brokenBy: ctx.nameOf(E[i].addedBy) });
  }
  droughts.sort((a, b) => b.days - a.days);

  const events = ctx.events.map(ev => {
    const t = ev.date.getTime();
    return { date: ev.date.toISOString(), title: ev.title, kind: ev.kind, adds: E.filter(e => Math.abs(e.at - t) <= 3 * 864e5).length };
  });

  const peak = weekday.indexOf(Math.max(...weekday));
  const peakHour = hour.indexOf(Math.max(...hour));
  return { weekday, hour, heat, calendar, busiest, peak: { weekday: peak, name: nbo.DAYS[peak], n: weekday[peak] }, peakHour: { hour: peakHour, n: hour[peakHour] }, binges: binges.slice(0, 6), droughts: droughts.slice(0, 6), events, timezone: 'Africa/Nairobi' };
}

function picks(ctx) {
  const S = ctx.songs;
  const E = ctx.entries;
  const timesAdded = countBy(E, e => e.track.songKey);
  const firstAdd = new Map();
  for (const e of E) if (!firstAdd.has(e.track.songKey)) firstAdd.set(e.track.songKey, e);

  const pop = S.filter(t => t.popularity != null);
  const mostPopular = [...pop].sort((a, b) => b.popularity - a.popularity || (b.deezerRank || 0) - (a.deezerRank || 0))[0];

  // Hidden gem: lowest Spotify popularity among songs that appear once, have a
  // non-zero score (zero marks duplicate or regional copies), and were at least
  // six months old when added (so it isn't just new).
  const gemPool = pop.filter(t => timesAdded.get(t.songKey) === 1 && t.popularity > 0 && t.released != null && firstAdd.get(t.songKey).at - t.released >= 182 * 864e5);
  const hiddenGem = [...gemPool].sort((a, b) => a.popularity - b.popularity || (a.deezerRank || Infinity) - (b.deezerRank || Infinity))[0];

  // Deepest cut: the song whose lead artist has the fewest Spotify followers.
  const followersOf = t => ctx.artists.get(t.artistIds[0])?.followers;
  const deepPool = S.filter(t => followersOf(t) != null && timesAdded.get(t.songKey) === 1);
  const deepestCut = [...deepPool].sort((a, b) => followersOf(a) - followersOf(b))[0];

  const dated = S.filter(t => t.released != null);
  const oldest = [...dated].sort((a, b) => a.released - b.released)[0];
  const newest = [...dated].sort((a, b) => b.released - a.released)[0];

  // Nostalgia gap: how old a song was when it was added (every add).
  const ages = E.filter(e => e.track.released != null).map(e => Math.max(0, (e.at - e.track.released) / YEAR_MS));
  const nostalgia = {
    medianYears: round(median(ages), 1),
    buckets: [
      { label: 'Under a month', n: ages.filter(a => a < 1 / 12).length },
      { label: '1 month – 1 year', n: ages.filter(a => a >= 1 / 12 && a < 1).length },
      { label: '1 – 5 years', n: ages.filter(a => a >= 1 && a < 5).length },
      { label: '5 – 20 years', n: ages.filter(a => a >= 5 && a < 20).length },
      { label: '20+ years', n: ages.filter(a => a >= 20).length },
    ],
    of: ages.length,
  };

  // Great minds: the same song added by two different people.
  const groups = new Map();
  for (const e of E) (groups.get(e.track.songKey) || groups.set(e.track.songKey, []).get(e.track.songKey)).push(e);
  const greatMinds = [...groups.values()].filter(g => g.length > 1).map(g => ({
    song: songRef(g[0].track),
    adds: g.map(e => ({ by: e.addedBy, name: ctx.nameOf(e.addedBy), at: new Date(e.at).toISOString() })),
    gapDays: nbo.daysBetween(g[0].at, g[1].at),
  })).sort((a, b) => a.gapDays - b.gapDays);

  // Musical conversations: an add within 60 minutes of the previous add, by a
  // different person, is a reply. The longest unbroken chain wins.
  let best = [], cur = [E[0]];
  for (let i = 1; i < E.length; i++) {
    const reply = E[i].addedBy && E[i - 1].addedBy && E[i].addedBy !== E[i - 1].addedBy && E[i].at - E[i - 1].at <= 60 * 60000;
    if (reply) cur.push(E[i]); else { if (cur.length > best.length) best = cur; cur = [E[i]]; }
  }
  if (cur.length > best.length) best = cur;
  const conversation = best.length >= 2 ? {
    length: best.length, people: new Set(best.map(e => e.addedBy)).size,
    minutes: Math.round((best[best.length - 1].at - best[0].at) / 60000),
    turns: best.map(e => ({ by: e.addedBy, name: ctx.nameOf(e.addedBy), at: new Date(e.at).toISOString(), song: songRef(e.track) })),
    rule: 'Each song added within 60 minutes of the one before, by someone different.',
  } : null;

  return {
    mostPopular: mostPopular ? songRef(mostPopular, { popularity: mostPopular.popularity }) : null,
    hiddenGem: hiddenGem ? songRef(hiddenGem, { popularity: hiddenGem.popularity, addedBy: ctx.nameOf(firstAdd.get(hiddenGem.songKey).addedBy) }) : null,
    hiddenGemRule: 'Lowest Spotify popularity among songs added once, with a non-zero score, that were at least six months old when added.',
    deepestCut: deepestCut ? songRef(deepestCut, { followers: followersOf(deepestCut), artist: ctx.artists.get(deepestCut.artistIds[0])?.name, addedBy: ctx.nameOf(firstAdd.get(deepestCut.songKey).addedBy) }) : null,
    deepestCutRule: 'The song whose lead artist has the fewest Spotify followers.',
    oldest: oldest ? songRef(oldest, { released: oldest.releaseDate, addedBy: ctx.nameOf(firstAdd.get(oldest.songKey).addedBy) }) : null,
    newest: newest ? songRef(newest, { released: newest.releaseDate, addedBy: ctx.nameOf(firstAdd.get(newest.songKey).addedBy) }) : null,
    nostalgia,
    greatMinds,
    conversation,
  };
}

// A "perfect mix": ten songs where each mixes harmonically into the next
// (Camelot neighbours) within 6% tempo, by as many different people as possible.
function perfectMix(ctx) {
  const pool = ctx.songs.filter(t => t.tempo > 0 && t.key != null && t.key >= 0 && t.mode != null)
    .map(t => ({ t, cam: camelot(t.key, t.mode), by: ctx.entries.find(e => e.track.songKey === t.songKey)?.addedBy }));
  if (pool.length < 10) return null;
  const camCounts = countBy(pool, p => p.cam);
  const startCam = ranked(camCounts)[0][0];
  let bestMix = [];
  for (const start of pool.filter(p => p.cam === startCam)) {
    const mix = [start];
    const used = new Set([start.t.id]);
    while (mix.length < 10) {
      const last = mix[mix.length - 1];
      const people = new Set(mix.map(m => m.by));
      const next = pool
        .filter(p => !used.has(p.t.id) && compatible(last.cam, p.cam) && Math.abs(p.t.tempo - last.t.tempo) / last.t.tempo <= 0.06)
        .sort((a, b) => (people.has(a.by) - people.has(b.by)) || Math.abs(a.t.tempo - last.t.tempo) - Math.abs(b.t.tempo - last.t.tempo))[0];
      if (!next) break;
      mix.push(next); used.add(next.t.id);
    }
    if (mix.length > bestMix.length || (mix.length === bestMix.length && new Set(mix.map(m => m.by)).size > new Set(bestMix.map(m => m.by)).size)) bestMix = mix;
    if (bestMix.length === 10 && new Set(bestMix.map(m => m.by)).size === 10) break;
  }
  return {
    songs: bestMix.map(m => songRef(m.t, { camelot: m.cam, tempo: round(m.t.tempo, 0), addedBy: ctx.nameOf(m.by) })),
    people: new Set(bestMix.map(m => m.by)).size,
    rule: 'Each song moves to a neighbouring key on the Camelot wheel (or stays), within 6% of the previous tempo.',
  };
}

// Song of the day: chosen by the Nairobi date, the same for everyone that day.
function songOfDay(ctx, when) {
  const day = nbo.dayKey(when.getTime());
  let h = 2166136261;
  for (const ch of day) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const t = ctx.songs[h % ctx.songs.length];
  const e = ctx.entries.find(x => x.track.songKey === t.songKey);
  return songRef(t, { day, addedBy: ctx.nameOf(e.addedBy), addedAt: new Date(e.at).toISOString(), family: t.family });
}

function credits(ctx, stats) {
  return {
    roll: [...stats].sort((a, b) => a.first - b.first).map(c => ({
      id: c.id, name: c.name, n: c.n, first: new Date(c.first).toISOString(),
      family: c.families[0]?.family || null, topArtist: c.topArtist?.name || null, medianYear: c.medianYear,
    })),
    unattributed: ctx.entries.filter(e => !e.addedBy).length,
  };
}

function buildFilm(ctx, { generatedAt = new Date() } = {}) {
  const stats = contributorStats(ctx);
  const t = totals(ctx);
  const s = sound(ctx);
  const p = people(ctx, stats);
  const last = ctx.entries[ctx.entries.length - 1];
  const film = {
    generatedAt: generatedAt.toISOString(),
    playlist: ctx.meta,
    totals: t,
    beat: { bpm: s.tempo.median, songs: s.tempo.coverage.songs, of: s.tempo.coverage.of, rule: 'Median tempo of the songs with a known tempo.' },
    runtime: runtime(t.runtimeMs),
    opening: opening(ctx),
    people: { ranking: p.ranking, unattributed: p.unattributed, race: p.race, twins: p.twins, badges: p.badges },
    sound: s,
    rhythm: rhythm(ctx),
    picks: { ...picks(ctx), perfectMix: perfectMix(ctx), songOfDay: songOfDay(ctx, generatedAt) },
    credits: credits(ctx, stats),
    pulse: { at: new Date(last.at).toISOString(), by: last.addedBy, name: ctx.nameOf(last.addedBy), song: songRef(last.track) },
  };
  return { film, stats, twins: p._twins, badgeList: p._badges };
}

module.exports = { buildFilm, songRef, runtime, imageHash };
