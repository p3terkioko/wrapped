'use strict';

// Runs enrichment sources over tracks that still need them, within a time
// budget. Each track remembers, per source, when it was tried and the outcome,
// so later refreshes only touch new songs (and retry failures occasionally).

const src = require('./sources');

const RETRY_DAYS = { error: 1, not_found: 30 };
const ALL = ['colour', 'reccobeats', 'deezer', 'lrclib', 'musicbrainz'];

function due(enrichment, source, retryErrors = false) {
  const e = enrichment?.[source];
  if (!e) return true;
  if (retryErrors && e.status === 'error') return true;
  const days = RETRY_DAYS[e.status];
  return days != null && Date.now() - Date.parse(e.at) > days * 864e5;
}

const mark = (enrichment, source, status) => ({ ...(enrichment || {}), [source]: { at: new Date().toISOString(), status } });

// Precedence when several sources supply tempo or key.
const RANK = { admin: 0, reccobeats: 1, deezer: 2, essentia: 3 };
const better = (incoming, current) => current == null || RANK[incoming] <= RANK[current];

async function runEnrichment(prisma, { sources = ALL, deadline = Infinity, limit = Infinity, retryErrors = false, log = () => {} } = {}) {
  const report = {};
  const timeLeft = () => Date.now() < deadline;
  const tracks = await prisma.track.findMany();

  for (const source of sources) {
    if (!timeLeft()) break;
    const todo = tracks.filter(t => due(t.enrichment, source, retryErrors)).slice(0, limit);
    const r = report[source] = { tried: 0, ok: 0, not_found: 0, error: 0 };

    const save = async (t, status, data = {}) => {
      t.enrichment = mark(t.enrichment, source, status);
      await prisma.track.update({ where: { id: t.id }, data: { ...data, enrichment: t.enrichment } });
      Object.assign(t, data);
      r.tried += 1; r[status] += 1;
    };

    if (source === 'reccobeats') {
      for (let i = 0; i < todo.length && timeLeft(); i += 40) {
        const batch = todo.slice(i, i + 40);
        let results;
        try { results = await src.reccobeats(batch); } catch (err) { log(`reccobeats batch failed: ${err.code || err.response?.status || ''} ${err.message}`); for (const t of batch) await save(t, 'error'); continue; }
        for (const res of results) {
          const t = batch.find(b => b.id === res.id);
          if (res.status !== 'ok') { await save(t, res.status); continue; }
          const d = { ...res.data, featuresSource: 'reccobeats' };
          if (!better('reccobeats', t.tempoSource)) { delete d.tempo; } else d.tempoSource = 'reccobeats';
          if (!better('reccobeats', t.keySource)) { delete d.key; delete d.mode; } else d.keySource = 'reccobeats';
          await save(t, 'ok', d);
        }
      }
      continue;
    }

    for (const t of todo) {
      if (!timeLeft()) break;
      try {
        if (source === 'colour') {
          const res = await src.colour(t);
          await save(t, res.status, res.data);
        } else if (source === 'deezer') {
          const res = await src.deezer(t);
          const d = { ...(res.data || {}) };
          if (d.deezerBpm && better('deezer', t.tempoSource) && t.tempoSource !== 'deezer') { d.tempo = d.deezerBpm; d.tempoSource = 'deezer'; }
          await save(t, res.status, d);
        } else if (source === 'lrclib') {
          const res = await src.lrclib(t);
          await save(t, res.status, res.data);
        } else if (source === 'musicbrainz') {
          const res = await src.musicbrainzRecording(t);
          if (res.status === 'ok') await linkArtists(prisma, t, res.credits, log);
          await save(t, res.status);
        }
      } catch (err) {
        log(`${source} ${t.id} failed: ${err.code || err.response?.status || ''} ${err.message}`);
        await save(t, 'error');
      }
    }
  }
  return report;
}

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// Match MusicBrainz credits to the track's Spotify artists by name, then fetch
// origin for any matched artist we haven't looked up yet.
async function linkArtists(prisma, track, credits, log) {
  for (const c of credits) {
    const idx = track.artistNames.findIndex(n => norm(n) === norm(c.name));
    if (idx < 0) continue;
    const artistId = track.artistIds[idx];
    const artist = await prisma.artist.findUnique({ where: { id: artistId } });
    if (!artist || artist.enrichment?.musicbrainz) continue;
    try {
      const res = await src.musicbrainzArtist(c.mbid);
      await prisma.artist.update({ where: { id: artistId }, data: { ...(res.data || {}), enrichment: { ...(artist.enrichment || {}), musicbrainz: { at: new Date().toISOString(), status: res.status } } } });
    } catch (err) {
      log(`musicbrainz artist ${c.mbid} failed: ${err.message}`);
    }
  }
}

module.exports = { runEnrichment, ALL };
