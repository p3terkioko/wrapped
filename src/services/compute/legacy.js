'use strict';

// The payload in the shape story mode (and the old /api/public/data) reads,
// filled with true, computed values. Fields nothing reads any more, or that
// were invented (listener counts, "members"), are not produced.

const nbo = require('../../lib/nairobi');
const { mean, round, countBy, ranked, keyName, KEY_NAMES } = require('./stats');

function buildLegacy(ctx, film, stats) {
  const E = ctx.entries, S = ctx.songs;
  const spotifyUrl = id => ({ spotify: `https://open.spotify.com/track/${id}` });
  const pick = (ref, t) => ref && { id: ref.id, name: ref.name, artists: ref.artists, artist: ref.artists, popularity: ref.popularity ?? t?.popularity ?? null, image: t?.imageUrl || null, external_urls: spotifyUrl(ref.id) };

  const artistCounts = ranked(countBy(E.flatMap(e => e.track.artistIds.map((id, i) => ({ id, name: e.track.artistNames[i] }))), a => a.id));
  const nameOfArtist = id => ctx.artists.get(id)?.name || E.flatMap(e => e.track.artistIds.map((x, i) => [x, e.track.artistNames[i]])).find(([x]) => x === id)?.[1];

  const withF = S.filter(t => t.hasFeatures);
  const avg = f => round(mean(withF.map(t => t[f]).filter(v => v != null)), 4);
  const audioFeatures = withF.length ? {
    valence: avg('valence'), energy: avg('energy'), danceability: avg('danceability'), acousticness: avg('acousticness'),
    instrumentalness: avg('instrumentalness'), liveness: avg('liveness'), speechiness: avg('speechiness'),
    tempo: round(mean(S.filter(t => t.tempo > 0).map(t => t.tempo)), 1),
  } : {};

  const withKey = S.filter(t => t.key != null && t.key >= 0 && t.mode != null);
  const keyDist = ranked(countBy(withKey, t => KEY_NAMES[t.key].replace('♯', '#').replace('♭', 'b')));
  const major = withKey.filter(t => t.mode === 1).length;

  const tempos = S.filter(t => t.tempo > 0).map(t => t.tempo);
  const zone = (lo, hi) => tempos.filter(x => x >= lo && x < hi).length;
  const tz = [['Slow', '< 80 BPM', 0, 80], ['Mid', '80–120 BPM', 80, 120], ['Fast', '120–160 BPM', 120, 160], ['Very Fast', '> 160 BPM', 160, 1e9]]
    .map(([label, range, lo, hi]) => ({ label, range, count: zone(lo, hi), pct: tempos.length ? Math.round((zone(lo, hi) / tempos.length) * 100) : 0 }));

  const dayOfWeek = nbo.DAYS.map((day, i) => ({ day, short: day.slice(0, 3), count: film.rhythm.weekday[i] }));
  const peakDay = dayOfWeek.reduce((m, d) => (d.count > m.count ? d : m), dayOfWeek[0]);

  const months = new Map();
  for (const e of E) {
    const k = nbo.monthKey(e.at);
    const m = months.get(k) || { count: 0, v: [], en: [] };
    m.count += 1;
    if (e.track.hasFeatures) { m.v.push(e.track.valence); m.en.push(e.track.energy); }
    months.set(k, m);
  }
  const moodTimeline = [...months.entries()].sort().map(([k, m]) => {
    const [y, mo] = k.split('-').map(Number);
    return { month: k, label: `${nbo.MONTHS[mo - 1].slice(0, 3)} ${String(y).slice(2)}`, count: m.count, valence: m.v.length ? mean(m.v) : null, energy: m.en.length ? mean(m.en) : null };
  });

  const badgesFor = id => film.people.badges.filter(b => b.holder === id).map(b => ({ id: b.id, name: b.name, description: b.description }));
  const span = film.picks;

  return {
    playlist: {
      id: ctx.meta.id, name: ctx.meta.name, description: ctx.meta.description || '', image: ctx.meta.image || null,
      owner: ctx.meta.owner || null, totalTracks: E.length, followers: ctx.meta.followers ?? null,
    },
    topArtists: artistCounts.slice(0, 10).map(([id, count]) => ({ id, name: nameOfArtist(id), count })),
    totalUniqueArtists: film.totals.artists,
    topGenres: film.sound.topGenres.slice(0, 8).map(g => ({ genre: g.genre, count: g.n })),
    totalGenres: film.totals.genres,
    mostPopular: pick(span.mostPopular, S.find(t => t.id === span.mostPopular?.id)),
    leastPopular: pick(span.hiddenGem, S.find(t => t.id === span.hiddenGem?.id)),
    audioFeatures,
    dateRange: { earliest: film.totals.firstAddedAt, latest: film.totals.lastAddedAt },
    totalAnalyzedTracks: withF.length,
    runtime: { totalMs: film.runtime.ms, hours: film.runtime.hours, minutes: film.runtime.minutes, display: `${film.runtime.hours}h ${film.runtime.minutes}m` },
    decades: film.sound.decades.map(d => ({ decade: d.decade, label: d.decade + 's', count: d.n })),
    keyInsights: {
      distribution: keyDist.map(([key, count]) => ({ key, count })), topKey: keyDist[0]?.[0] || null, topKeyCount: keyDist[0]?.[1] || 0,
      majorCount: major, minorCount: withKey.length - major, majorPct: withKey.length ? Math.round((major / withKey.length) * 100) : null,
      topKeyName: film.sound.keys.top?.name || null,
    },
    dayOfWeek, peakDay,
    tempoBreakdown: tz,
    moodTimeline, moodHasFeatures: moodTimeline.some(m => m.valence != null),
    topContributors: stats.slice(0, 5).map(c => ({ userId: c.id, count: c.n, displayName: c.name, avatarUrl: c.avatar })),
    contributors: {
      totalContributors: film.totals.contributors,
      contributors: stats.slice(0, 10).map(c => ({
        id: c.id, name: c.name, avatarUrl: c.avatar, tracksAdded: c.n, share: c.share,
        genreDiversity: new Set(c.entries.flatMap(e => e.track.genres)).size,
        artistDiversity: c.artistIds.size, avgReleaseYear: c.medianYear, badges: badgesFor(c.id),
      })),
      summary: { mostActive: stats[0]?.name, avgContribution: Math.round(E.length / Math.max(1, stats.length)), totalGenres: film.totals.genres, totalArtists: film.totals.artists },
    },
    // Read by story mode's "Musical era" slide (across the whole playlist).
    musicTimeSpan: span.oldest && span.newest ? {
      oldest: { name: span.oldest.name, artists: span.oldest.artists, releaseDate: span.oldest.released },
      newest: { name: span.newest.name, artists: span.newest.artists, releaseDate: span.newest.released },
    } : null,
    keyName: film.sound.keys.top?.name || null,
  };
}

module.exports = { buildLegacy };
