'use strict';

// Loads everything the payload builders need from the database once, applies
// admin corrections, and exposes small helpers. All time maths is Nairobi time.

const { primaryFamily, artistGenres } = require('../genres');

// Fields an admin may correct on a track or an artist.
const TRACK_FIELDS = ['tempo', 'key', 'mode', 'energy', 'valence', 'danceability', 'acousticness', 'releaseDate', 'colour', 'name'];
const SOURCE_FOR = { tempo: 'tempoSource', key: 'keySource', mode: 'keySource', energy: 'featuresSource', valence: 'featuresSource', danceability: 'featuresSource' };

function applyTrackOverrides(t) {
  const o = t.overrides || {};
  const out = { ...t };
  for (const f of TRACK_FIELDS) {
    if (o[f] === undefined) continue;
    out[f] = o[f];
    if (SOURCE_FOR[f]) out[SOURCE_FOR[f]] = 'admin';
  }
  return out;
}

const year = t => {
  const y = parseInt(String(t.releaseDate || '').slice(0, 4), 10);
  return Number.isFinite(y) && y > 1900 ? y : null;
};

// Release date as a Date (year-only dates fall on 1 July, month-only on the 15th).
const releaseTime = t => {
  const s = String(t.releaseDate || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Date.parse(s + 'T00:00:00Z');
  if (/^\d{4}-\d{2}$/.test(s)) return Date.parse(s + '-15T00:00:00Z');
  if (/^\d{4}$/.test(s)) return Date.parse(s + '-07-01T00:00:00Z');
  return null;
};

async function loadContext(prisma, playlistId) {
  const [entriesRaw, tracksRaw, artistsRaw, contributorsRaw, events, settings] = await Promise.all([
    prisma.playlistEntry.findMany({ where: { playlistId }, orderBy: { position: 'asc' } }),
    prisma.track.findMany(),
    prisma.artist.findMany(),
    prisma.contributor.findMany(),
    prisma.communityEvent.findMany({ orderBy: { date: 'asc' } }),
    prisma.setting.findMany(),
  ]);
  const setting = Object.fromEntries(settings.map(s => [s.key, s.value]));
  const familyOverrides = setting.genreFamilies || {};

  const artists = new Map(artistsRaw.map(a => {
    const o = a.overrides || {};
    return [a.id, { ...a, genres: artistGenres(a), country: o.country !== undefined ? o.country : a.country, area: o.area !== undefined ? o.area : a.area }];
  }));

  const tracks = new Map();
  for (const raw of tracksRaw) {
    const t = applyTrackOverrides(raw);
    t.year = year(t);
    t.released = releaseTime(t);
    t.genres = [...new Set(t.artistIds.flatMap(id => artists.get(id)?.genres || []))];
    t.family = primaryFamily(t.genres, familyOverrides);
    const lead = artists.get(t.artistIds[0]);
    t.country = lead?.country || null;
    t.songKey = t.isrc || t.id;
    t.hasFeatures = t.energy != null && t.valence != null;
    t.lyricsKnown = t.lyricsStatus === 'counted' || t.lyricsStatus === 'instrumental';
    tracks.set(t.id, t);
  }

  const people = new Map(contributorsRaw.map(c => [c.id, c]));
  const nameOf = id => {
    if (!id) return 'Unknown';
    const c = people.get(id);
    return c?.adminName || c?.displayName || 'Unnamed member';
  };
  const avatarOf = id => people.get(id)?.avatarUrl || null;

  // Entries in the order they were added (Spotify order can be rearranged).
  const entries = entriesRaw
    .map(e => ({ ...e, at: e.addedAt.getTime(), track: tracks.get(e.trackId) }))
    .filter(e => e.track)
    .sort((a, b) => a.at - b.at || a.position - b.position);

  // Unique songs: one per ISRC (fallback Spotify id), first add wins.
  const songs = [];
  const songIndex = new Map();
  for (const e of entries) {
    if (songIndex.has(e.track.songKey)) continue;
    songIndex.set(e.track.songKey, songs.length);
    songs.push(e.track);
  }

  return {
    playlistId,
    meta: setting.playlistMeta || { id: playlistId, name: 'KamiLimu.inthe.Ears' },
    familyOverrides,
    entries,
    songs,
    songIndex,
    tracks,
    artists,
    people,
    nameOf,
    avatarOf,
    events,
  };
}

module.exports = { loadContext, applyTrackOverrides, year, releaseTime };
