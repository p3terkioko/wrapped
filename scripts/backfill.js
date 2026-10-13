// One-time (and occasional) slow enrichment run, done locally because a full
// run doesn't fit in a serverless time limit. Writes to the database in
// DATABASE_URL, which must be local unless ALLOW_PRODUCTION_DB is set.
//
//   npm run backfill                       all sources, then recompute payloads
//   npm run backfill -- --sync             pull fresh data from Spotify first
//   npm run backfill -- --sources=deezer,lrclib --limit=50
//   npm run backfill -- --no-compute
//   npm run backfill -- --retry-errors     retry failed lookups now instead of after a day
'use strict';

const path = require('path');
const root = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env.local') });
require('dotenv').config({ path: path.join(root, '.env') });
require('./lib/guard').assertLocalDatabase(process.env.DATABASE_URL);

const { prisma } = require('../src/db/client');
const { env } = require('../src/config/env');
const { runEnrichment, ALL } = require('../src/services/enrich');
const src = require('../src/services/enrich/sources');

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const sources = args.sources ? String(args.sources).split(',') : [...ALL, 'essentia'];
const limit = args.limit ? Number(args.limit) : Infinity;
const log = (...m) => console.log(new Date().toISOString().slice(11, 19), ...m);

async function essentiaPass() {
  let audio;
  try { audio = require('./audio/analyse'); } catch {
    log('essentia skipped: run `npm --prefix scripts/audio install` to enable local tempo/key analysis');
    return;
  }
  const tracks = (await prisma.track.findMany()).filter(t => (t.tempo == null || t.key == null) && !t.enrichment?.essentia).slice(0, limit);
  log(`essentia: ${tracks.length} tracks missing tempo or key`);
  const r = { ok: 0, not_found: 0, error: 0 };
  for (const t of tracks) {
    let status = 'error', data = {};
    try {
      const dz = await src.deezer(t); // fresh, signed preview URL; never stored
      if (!dz.preview) status = 'not_found';
      else {
        const a = await require('./audio/analyse').analysePreview(dz.preview);
        if (t.tempo == null && a.tempo > 0) { data.tempo = a.tempo; data.tempoSource = 'essentia'; }
        if (t.key == null && a.key != null && a.keyStrength >= 0.5) { data.key = a.key; data.mode = a.mode; data.keySource = 'essentia'; }
        status = 'ok';
      }
    } catch (err) { log(`essentia ${t.id}: ${err.message}`); }
    await prisma.track.update({ where: { id: t.id }, data: { ...data, enrichment: { ...(t.enrichment || {}), essentia: { at: new Date().toISOString(), status } } } });
    r[status] += 1;
  }
  log('essentia', JSON.stringify(r));
}

(async () => {
  if (args.sync) {
    const spotify = require('../src/services/spotify');
    const { syncFromSpotify } = require('../src/services/sync');
    const { access_token: token } = await spotify.refreshAccessToken(env.SPOTIFY_REFRESH_TOKEN);
    const res = await syncFromSpotify(prisma, { token, playlistId: env.SPOTIFY_PLAYLIST_ID, log });
    await prisma.setting.upsert({ where: { key: 'playlistMeta' }, create: { key: 'playlistMeta', value: res.playlist }, update: { value: res.playlist } });
  }
  const web = sources.filter(s => s !== 'essentia');
  if (web.length) {
    const report = await runEnrichment(prisma, { sources: web, limit, retryErrors: !!args['retry-errors'], log });
    log('enrichment', JSON.stringify(report));
  }
  if (sources.includes('essentia')) await essentiaPass();
  if (!args['no-compute']) {
    const { buildAndStore } = require('../src/services/payloads');
    const res = await buildAndStore(prisma, { log });
    log('payloads', JSON.stringify(res));
  }
  await prisma.$disconnect();
})().catch(async err => { console.error(err); process.exit(1); });
