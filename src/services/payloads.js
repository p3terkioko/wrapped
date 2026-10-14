'use strict';

// Builds every payload from the database and stores it. Runs at the end of a
// refresh, after admin corrections, and from the backfill script. Cheap: no
// network calls, just the rows already stored.

const crypto = require('crypto');
const { env } = require('../config/env');
const { loadContext } = require('./compute/context');
const { buildFilm, songRef } = require('./compute/film');
const { buildPeople } = require('./compute/people');
const { buildTracks } = require('./compute/tracks');
const { buildLegacy } = require('./compute/legacy');

// Bump whenever what the payloads contain or how they're computed changes.
// The live check compares it with the stored film payload and recomputes after
// a deploy, so new chapters fill in without waiting for a new song.
const COMPUTE_VERSION = 2;

function buildAll(ctx, { generatedAt = new Date() } = {}) {
  const { film, stats, twins, badgeList } = buildFilm(ctx, { generatedAt });
  film.computeVersion = COMPUTE_VERSION;
  const people = buildPeople(ctx, stats, { twins, badgeList, songRef });
  const tracks = buildTracks(ctx);
  const legacy = buildLegacy(ctx, film, stats);
  return { film, people, tracks, legacy };
}

async function buildAndStore(prisma, { playlistId = env.SPOTIFY_PLAYLIST_ID, log = () => {} } = {}) {
  const t0 = Date.now();
  const ctx = await loadContext(prisma, playlistId);
  if (!ctx.entries.length) throw new Error('No playlist entries stored yet; run a refresh or seed first.');
  const payloads = buildAll(ctx);
  const version = crypto.createHash('sha1').update(JSON.stringify(payloads.film)).digest('hex').slice(0, 12);
  for (const p of [payloads.film, payloads.people, payloads.tracks, payloads.legacy]) p.version = version;

  const sizes = {};
  const ops = Object.entries(payloads).map(([key, data]) => {
    sizes[key] = Buffer.byteLength(JSON.stringify(data));
    return prisma.payload.upsert({ where: { key }, create: { key, data, version }, update: { data, version } });
  });
  // Keep the old snapshot table filled too, so a rollback to the previous
  // deployment still finds data.
  ops.push(prisma.playlistData.upsert({ where: { playlistId }, create: { playlistId, data: payloads.legacy }, update: { data: payloads.legacy } }));
  await prisma.$transaction(ops);
  log(`payloads built in ${Date.now() - t0} ms, version ${version}, bytes ${JSON.stringify(sizes)}`);
  return { version, sizes };
}

async function readPayload(prisma, key) {
  const row = await prisma.payload.findUnique({ where: { key } });
  return row ? { data: row.data, version: row.version, updatedAt: row.updatedAt } : null;
}

module.exports = { buildAll, buildAndStore, readPayload, COMPUTE_VERSION };
