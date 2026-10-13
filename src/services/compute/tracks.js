'use strict';

// Lazily loaded per-song table (columnar, compact) for the chapters that plot
// individual songs: the mood map, key wheel, song of the day, Find yourself pins.

const { camelot, round } = require('./stats');
const { imageHash } = require('./film');

function buildTracks(ctx) {
  const people = [...new Set(ctx.entries.map(e => e.addedBy).filter(Boolean))];
  const pIndex = new Map(people.map((id, i) => [id, i]));
  const firstBy = new Map();
  const times = new Map();
  for (const e of ctx.entries) {
    if (!firstBy.has(e.track.songKey)) firstBy.set(e.track.songKey, e.addedBy);
    times.set(e.track.songKey, (times.get(e.track.songKey) || 0) + 1);
  }
  const S = ctx.songs;
  const col = f => S.map(f);
  const first = ctx.entries[0].at;
  return {
    people: people.map(id => ({ id, name: ctx.nameOf(id) })),
    songs: {
      id: col(t => t.id),
      name: col(t => t.name),
      artists: col(t => t.artistNames.join(', ')),
      year: col(t => t.year),
      image: col(t => imageHash(t.imageUrl)),
      small: col(t => imageHash(t.imageSmall)),
      colour: col(t => t.colour ? t.colour.slice(1) : null),
      tempo: col(t => (t.tempo > 0 ? round(t.tempo, 0) : null)),
      camelot: col(t => camelot(t.key, t.mode)),
      energy: col(t => (t.energy != null ? round(t.energy, 2) : null)),
      valence: col(t => (t.valence != null ? round(t.valence, 2) : null)),
      family: col(t => t.family),
      country: col(t => t.country),
      popularity: col(t => t.popularity),
      by: col(t => (firstBy.get(t.songKey) ? pIndex.get(firstBy.get(t.songKey)) : null)),
      times: col(t => times.get(t.songKey)),
    },
    // Every add: [song index, minutes since the first add, person index or null]
    entries: ctx.entries.map(e => [ctx.songIndex.get(e.track.songKey), Math.round((e.at - first) / 60000), e.addedBy ? pIndex.get(e.addedBy) : null]),
    firstAt: new Date(first).toISOString(),
  };
}

module.exports = { buildTracks };
