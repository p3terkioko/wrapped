// One-time move of the production database onto the rebuild's schema.
// Deliberate, never automatic:
//
//   node scripts/migrate-production.js          backup + checks, writes nothing
//   node scripts/migrate-production.js --apply  backup, schema, data, payloads, checks
//
// 1. Backs up every production table (read-only) to .cache/prod/.
// 2. Checks the schema change is purely additive, then applies it with
//    `prisma db push` (never with --accept-data-loss).
// 3. Copies the enriched catalogue from the local dev database into the new
//    tables. Stops if they already hold rows, so it can't double-load.
// 4. Syncs fresh from Spotify, enriches anything new, computes the payloads.
// 5. Prints production's totals next to the local ones.
//
// Production is read from DATABASE_URL in .env; the copy source is
// DATABASE_URL in .env.local, which must be the local dev database.
'use strict';

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const dotenv = require('dotenv');
const { isLocalDatabase } = require('./lib/guard');

const root = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');
const log = (...m) => console.log(new Date().toISOString().slice(11, 19), ...m);
const fail = m => { console.error('STOPPED: ' + m); process.exit(1); };

const prodEnv = dotenv.parse(fs.readFileSync(path.join(root, '.env')));
const devEnv = dotenv.parse(fs.readFileSync(path.join(root, '.env.local')));
const PROD_URL = prodEnv.DATABASE_URL || '';
const DEV_URL = devEnv.DATABASE_URL || '';
if (!/^prisma\+postgres:\/\//.test(PROD_URL)) fail('.env DATABASE_URL is not the production Prisma Postgres URL.');
if (!isLocalDatabase(DEV_URL)) fail('.env.local DATABASE_URL must point at the local dev database.');

// The app's modules read process.env: point them at production, scheduler off.
Object.assign(process.env, prodEnv, { DATABASE_URL: PROD_URL, ENABLE_SCHEDULER: 'false' });

const { prisma: prod } = require('../src/db/client');
const { PrismaClient } = require('../generated/prisma');
const dev = new PrismaClient({ datasourceUrl: DEV_URL });

const NEW_TABLES = ['tracks', 'playlist_entries', 'artists', 'contributors', 'community_events', 'settings', 'payloads'];
const KEEP_TABLES = ['playlist_data', 'update_logs'];
// Copy order respects the one foreign key (entries → tracks).
const COPY = ['contributor', 'artist', 'track', 'playlistEntry', 'communityEvent', 'setting'];

function prismaCli(args) {
  return execFileSync(process.execPath, [path.join(root, 'node_modules', 'prisma', 'build', 'index.js'), ...args], {
    cwd: root, env: { ...process.env, DATABASE_URL: PROD_URL }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function backup() {
  const tables = (await prod.$queryRawUnsafe(`select table_name from information_schema.tables where table_schema = 'public' order by 1`)).map(r => r.table_name);
  const takenAt = new Date().toISOString();
  const out = { takenAt, tables, rows: {} };
  const counts = {};
  for (const t of tables) {
    out.rows[t] = await prod.$queryRawUnsafe(`select * from "${t.replace(/"/g, '')}"`);
    counts[t] = out.rows[t].length;
  }
  const dir = path.join(root, '.cache', 'prod');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `backup-${takenAt.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(out, (k, v) => (typeof v === 'bigint' ? Number(v) : v)));
  log(`backup: ${tables.length} tables → ${path.relative(root, file)} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
  for (const t of tables) log(`  ${t}: ${counts[t]} rows`);
  return { tables, counts };
}

function checkAdditive() {
  const sql = prismaCli(['migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/schema.prisma', '--script']);
  const statements = sql.split('\n').filter(l => /^(CREATE|ALTER|DROP)/.test(l));
  const risky = statements.filter(l => /^DROP|DROP COLUMN|ALTER COLUMN|RENAME/i.test(l) || KEEP_TABLES.some(t => l.includes(`"${t}"`)));
  log(`schema change: ${statements.length} statements`);
  for (const l of statements) log('  ' + l.replace(/\s*\($/, ''));
  if (risky.length) fail('the schema change is not purely additive:\n' + risky.join('\n'));
  return statements.length;
}

async function devSummary() {
  const [tracks, entries, artists, contributors, events, settings] = await Promise.all([
    dev.track.count(), dev.playlistEntry.count(), dev.artist.count(), dev.contributor.count(), dev.communityEvent.findMany(), dev.setting.findMany({ select: { key: true } }),
  ]);
  log(`local copy: ${entries} entries, ${tracks} tracks, ${artists} artists, ${contributors} contributors`);
  // Show every admin-made value that would travel, so nothing slips in unseen.
  const tOver = (await dev.track.findMany({ select: { name: true, overrides: true } })).filter(t => Object.keys(t.overrides || {}).length);
  const aOver = (await dev.artist.findMany({ select: { name: true, overrides: true } })).filter(a => Object.keys(a.overrides || {}).length);
  const cOver = await dev.contributor.findMany({ where: { OR: [{ adminName: { not: null } }, { hidden: true }] }, select: { id: true, displayName: true, adminName: true, hidden: true } });
  log(`admin corrections in the copy: ${tOver.length} tracks, ${aOver.length} artists, ${cOver.length} contributors, ${events.length} community events; settings [${settings.map(s => s.key).join(', ')}]`);
  for (const a of aOver) log(`  artist ${a.name}: ${JSON.stringify(a.overrides)}`);
  for (const t of tOver) log(`  track ${t.name}: ${JSON.stringify(t.overrides)}`);
  for (const c of cOver) log(`  contributor ${c.displayName || c.id}: ${c.adminName ? 'named ' + c.adminName : ''}${c.hidden ? ' hidden' : ''}`);
  for (const e of events) log(`  event ${e.date.toISOString().slice(0, 10)} ${e.title}`);
}

async function copy() {
  for (const model of COPY) {
    const rows = await dev[model].findMany();
    for (let i = 0; i < rows.length; i += 100) await prod[model].createMany({ data: rows.slice(i, i + 100) });
    log(`copied ${model}: ${rows.length}`);
  }
}

async function refreshAndCompute() {
  const spotify = require('../src/services/spotify');
  const { syncFromSpotify } = require('../src/services/sync');
  const { runEnrichment } = require('../src/services/enrich');
  const { buildAndStore } = require('../src/services/payloads');
  const { logUpdate } = require('../src/services/cache');
  const { env } = require('../src/config/env');
  const { access_token: token } = await spotify.refreshAccessToken(env.SPOTIFY_REFRESH_TOKEN);
  const res = await syncFromSpotify(prod, { token, playlistId: env.SPOTIFY_PLAYLIST_ID, log });
  await prod.setting.upsert({ where: { key: 'playlistMeta' }, create: { key: 'playlistMeta', value: res.playlist }, update: { value: res.playlist } });
  log(`sync: ${res.newTrackIds.length} tracks new since the local copy`);
  const report = await runEnrichment(prod, { sources: ['colour', 'reccobeats', 'deezer', 'lrclib', 'musicbrainz'], deadline: Date.now() + 5 * 60 * 1000, log });
  log('enrichment ' + JSON.stringify(report));
  const built = await buildAndStore(prod, { log });
  await logUpdate('success', `migration: schema applied, catalogue loaded, payload ${built.version}`, null, 'migration');
  log(`payloads built: ${built.version}`);
}

async function compare() {
  const [p, d] = await Promise.all([prod.payload.findUnique({ where: { key: 'film' } }), dev.payload.findUnique({ where: { key: 'film' } })]);
  log('totals          production   local');
  for (const k of ['entries', 'uniqueSongs', 'contributors', 'artists']) {
    log(`  ${k.padEnd(14)}${String(p?.data?.totals?.[k] ?? '—').padStart(10)}${String(d?.data?.totals?.[k] ?? '—').padStart(8)}`);
  }
}

(async () => {
  log(APPLY ? 'APPLY: production will be changed after the backup and checks.' : 'Dry run: backup and checks only; nothing is written to production.');
  const { tables, counts } = await backup();
  const loaded = NEW_TABLES.filter(t => tables.includes(t) && counts[t] > 0);
  if (loaded.length) fail(`production already has data in ${loaded.join(', ')}; this one-time migration is done. Use the admin refresh instead.`);
  checkAdditive();
  await devSummary();
  if (!APPLY) { log('Dry run complete. Re-run with --apply to migrate.'); return; }

  log('applying schema (prisma db push) …');
  log(prismaCli(['db', 'push', '--skip-generate']).trim().split('\n').filter(Boolean).slice(-2).join(' | '));
  await copy();
  await refreshAndCompute();
  await compare();
  log('Done.');
})()
  .catch(err => { console.error('FAILED:', err.message); process.exitCode = 1; })
  .finally(async () => { await dev.$disconnect().catch(() => {}); await prod?.$disconnect?.().catch(() => {}); });
