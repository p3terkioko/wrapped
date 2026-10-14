'use strict';

// The refresh pipeline, sized for a 60-second serverless function:
// Spotify sync → enrichment of new or pending tracks until the time budget is
// spent → payload computation. The slow, complete run is scripts/backfill.js.

const spotify = require('./spotify');
const { syncFromSpotify } = require('./sync');
const { runEnrichment } = require('./enrich');
const { buildAndStore } = require('./payloads');
const { logUpdate } = require('./cache');
const { prisma } = require('../db/client');
const { env } = require('../config/env');
const { AppError } = require('../middleware/errorHandler');

const BUDGET_MS = 50000;      // whole run
const COMPUTE_RESERVE_MS = 8000; // kept back for computing and storing payloads

// One refresh at a time: a run claims a row in settings atomically, and nobody
// else can start until `gapMinutes` have passed since the last claim. Manual
// and cron runs use a short gap (just covers a run in progress); the automatic
// run triggered by a new song uses a longer one.
async function claim(gapMinutes) {
  const cutoff = new Date(Date.now() - gapMinutes * 60000);
  await prisma.setting.createMany({ data: [{ key: 'refreshLock', value: {}, updatedAt: new Date(0) }], skipDuplicates: true });
  const { count } = await prisma.setting.updateMany({ where: { key: 'refreshLock', updatedAt: { lt: cutoff } }, data: { value: { at: new Date().toISOString() } } });
  return count === 1;
}

async function runRefresh(triggeredBy = 'admin', { gapMinutes = 1 } = {}) {
  if (!prisma) throw new AppError(503, 'Database not available');
  if (!env.SPOTIFY_REFRESH_TOKEN) throw new AppError(400, 'SPOTIFY_REFRESH_TOKEN not configured');
  if (!(await claim(gapMinutes))) throw new AppError(409, 'A refresh is running or ran moments ago. Try again in a minute.');
  const start = Date.now();
  const lines = [];
  const log = m => { lines.push(m); console.log('[refresh]', m); };
  try {
    const { access_token: token } = await spotify.refreshAccessToken(env.SPOTIFY_REFRESH_TOKEN);
    const res = await syncFromSpotify(prisma, { token, playlistId: env.SPOTIFY_PLAYLIST_ID, log });
    await prisma.setting.upsert({ where: { key: 'playlistMeta' }, create: { key: 'playlistMeta', value: res.playlist }, update: { value: res.playlist } });

    const deadline = start + BUDGET_MS - COMPUTE_RESERVE_MS;
    const report = await runEnrichment(prisma, { sources: ['colour', 'reccobeats', 'deezer', 'lrclib', 'musicbrainz'], deadline, log });
    log('enrichment ' + JSON.stringify(report));

    const built = await buildAndStore(prisma, { log });
    const msg = `${triggeredBy}: ${res.newTrackIds.length} new tracks, payload ${built.version}, ${Date.now() - start} ms`;
    await logUpdate('success', msg, null, triggeredBy);
    return { newTracks: res.newTrackIds.length, version: built.version, ms: Date.now() - start, log: lines };
  } catch (err) {
    await logUpdate('failed', `${triggeredBy}: ${err.message}`, null, triggeredBy);
    throw err;
  }
}

async function recompute(triggeredBy = 'admin') {
  if (!prisma) throw new AppError(503, 'Database not available');
  const built = await buildAndStore(prisma);
  await logUpdate('success', `${triggeredBy}: recomputed payload ${built.version}`, null, triggeredBy);
  return built;
}

module.exports = { runRefresh, recompute };
