'use strict';

// Admin API. Every route needs the admin password (header x-admin-password),
// except the cron route, which needs CRON_SECRET. Corrections are stored as
// overrides next to the source values and the payloads are recomputed.

const express = require('express');
const router = express.Router();
const { prisma } = require('../db/client');
const { runRefresh, recompute } = require('../services/refresh');
const { getRecentLogs } = require('../services/cache');
const { readPayload } = require('../services/payloads');
const { FAMILIES } = require('../services/genres');
const { adminAuth, cronAuth } = require('../middleware/adminAuth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { env } = require('../config/env');

const db = () => { if (!prisma) throw new AppError(503, 'Database not available'); return prisma; };
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// ── Cron (Vercel sends Authorization: Bearer <CRON_SECRET>) ────────────────────
router.get('/cron/refresh', cronAuth, asyncHandler(async (req, res) => {
  const r = await runRefresh('cron');
  res.json({ success: true, message: `Cron refresh: ${r.newTracks} new tracks`, ...r });
}));

router.use(adminAuth);

// ── Refresh and recompute ─────────────────────────────────────────────────────
async function handleRefresh(req, res) {
  const r = await runRefresh('admin');
  res.json({ success: true, message: `Refreshed: ${r.newTracks} new tracks in ${Math.round(r.ms / 1000)} s`, ...r });
}
router.post('/refresh', asyncHandler(handleRefresh));
router.post('/trigger-update', asyncHandler(handleRefresh));

router.post('/recompute', asyncHandler(async (req, res) => {
  const r = await recompute('admin');
  res.json({ success: true, message: `Recomputed payload ${r.version}`, ...r });
}));

router.get('/status', asyncHandler(async (req, res) => {
  const film = await readPayload(db(), 'film');
  let logs = [];
  try { logs = await getRecentLogs(15); } catch { /* table may be empty */ }
  res.json({
    success: true, hasData: !!film, version: film?.version || null, lastUpdated: film?.updatedAt || null,
    entries: film?.data?.totals?.entries || 0, uniqueSongs: film?.data?.totals?.uniqueSongs || 0,
    environment: env.VERCEL_ENV || env.NODE_ENV, cronSecretSet: !!env.CRON_SECRET, recentLogs: logs,
  });
}));

// ── Coverage report: what each source has supplied ────────────────────────────
router.get('/coverage', asyncHandler(async (req, res) => {
  const tracks = await db().track.findMany({ select: { enrichment: true, tempoSource: true, keySource: true, featuresSource: true, lyricsStatus: true, colour: true } });
  const artists = await db().artist.findMany({ select: { country: true, enrichment: true, genres: true, overrides: true } });
  const bySource = {};
  for (const t of tracks) for (const [src, v] of Object.entries(t.enrichment || {})) {
    bySource[src] = bySource[src] || { ok: 0, not_found: 0, error: 0 };
    bySource[src][v.status] = (bySource[src][v.status] || 0) + 1;
  }
  const count = (xs, f) => xs.reduce((m, x) => { const k = f(x) ?? 'none'; m[k] = (m[k] || 0) + 1; return m; }, {});
  res.json({
    tracks: tracks.length, bySource,
    tempo: count(tracks, t => t.tempoSource), key: count(tracks, t => t.keySource), features: count(tracks, t => t.featuresSource),
    lyrics: count(tracks, t => t.lyricsStatus), colour: tracks.filter(t => t.colour).length,
    artists: artists.length, artistsWithCountry: artists.filter(a => a.country).length, artistsWithGenres: artists.filter(a => (a.genres || []).length).length,
    artistsCorrected: artists.filter(a => a.overrides && Object.keys(a.overrides).length).length,
  });
}));

// ── Contributors: Spotify id → display name ───────────────────────────────────
router.get('/contributors', asyncHandler(async (req, res) => {
  const [people, counts] = await Promise.all([
    db().contributor.findMany(),
    db().playlistEntry.groupBy({ by: ['addedBy'], where: { playlistId: env.SPOTIFY_PLAYLIST_ID }, _count: { _all: true } }),
  ]);
  const n = Object.fromEntries(counts.map(c => [c.addedBy, c._count._all]));
  res.json(people.map(p => ({ ...p, songs: n[p.id] || 0 })).sort((a, b) => b.songs - a.songs));
}));

router.put('/contributors/:id', asyncHandler(async (req, res) => {
  const { adminName, hidden } = req.body || {};
  const data = {};
  if (adminName !== undefined) data.adminName = adminName ? String(adminName).trim().slice(0, 60) : null;
  if (hidden !== undefined) data.hidden = !!hidden;
  const row = await db().contributor.upsert({ where: { id: req.params.id }, create: { id: req.params.id, ...data }, update: data });
  await recompute('admin: contributor name');
  res.json(row);
}));

// ── Artists: correct genres and origin ────────────────────────────────────────
router.get('/artists', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const rows = await db().artist.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { genres: { has: q.toLowerCase() } }] } : undefined,
    orderBy: { name: 'asc' }, take: 60,
  });
  res.json(rows);
}));

router.put('/artists/:id', asyncHandler(async (req, res) => {
  const artist = await db().artist.findUnique({ where: { id: req.params.id } });
  if (!artist) throw new AppError(404, 'Artist not found');
  const o = { ...(artist.overrides || {}) };
  const { genres, country, area } = req.body || {};
  if (genres === null) delete o.genres;
  else if (Array.isArray(genres)) o.genres = genres.map(g => String(g).toLowerCase().trim()).filter(Boolean).slice(0, 12);
  if (country === null) delete o.country; else if (country !== undefined) o.country = String(country).toUpperCase().slice(0, 2);
  if (area === null) delete o.area; else if (area !== undefined) o.area = String(area).slice(0, 80);
  const row = await db().artist.update({ where: { id: artist.id }, data: { overrides: o } });
  await recompute('admin: artist correction');
  res.json(row);
}));

// ── Tracks: correct audio values or release date ──────────────────────────────
const TRACK_EDITABLE = { tempo: 'number', key: 'number', mode: 'number', energy: 'number', valence: 'number', danceability: 'number', acousticness: 'number', releaseDate: 'string' };

router.get('/tracks', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const rows = await db().track.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { artistNames: { has: q } }] } : undefined,
    orderBy: { name: 'asc' }, take: 40,
    select: { id: true, name: true, artistNames: true, releaseDate: true, tempo: true, tempoSource: true, key: true, mode: true, keySource: true, energy: true, valence: true, danceability: true, featuresSource: true, overrides: true },
  });
  res.json(rows);
}));

router.put('/tracks/:id', asyncHandler(async (req, res) => {
  const track = await db().track.findUnique({ where: { id: req.params.id } });
  if (!track) throw new AppError(404, 'Track not found');
  const o = { ...(track.overrides || {}) };
  for (const [field, type] of Object.entries(TRACK_EDITABLE)) {
    if (!(field in (req.body || {}))) continue;
    const v = req.body[field];
    if (v === null || v === '') delete o[field];
    else o[field] = type === 'number' ? Number(v) : String(v);
  }
  const row = await db().track.update({ where: { id: track.id }, data: { overrides: o } });
  await recompute('admin: track correction');
  res.json(row);
}));

// ── Community events for the rhythm timeline ──────────────────────────────────
router.get('/events', asyncHandler(async (req, res) => {
  res.json(await db().communityEvent.findMany({ orderBy: { date: 'asc' } }));
}));

router.post('/events', asyncHandler(async (req, res) => {
  const { date, title, kind } = req.body || {};
  if (!date || !title) throw new AppError(400, 'date and title are required');
  const d = new Date(date);
  if (isNaN(d)) throw new AppError(400, 'invalid date');
  const row = await db().communityEvent.create({ data: { date: d, title: String(title).slice(0, 80), kind: kind ? String(kind).slice(0, 30) : null } });
  await recompute('admin: event added');
  res.json(row);
}));

router.delete('/events/:id', asyncHandler(async (req, res) => {
  await db().communityEvent.delete({ where: { id: req.params.id } });
  await recompute('admin: event removed');
  res.json({ success: true });
}));

// ── Genre → family mapping overrides ──────────────────────────────────────────
router.get('/genre-families', asyncHandler(async (req, res) => {
  const row = await db().setting.findUnique({ where: { key: 'genreFamilies' } });
  res.json({ families: FAMILIES, overrides: row?.value || {} });
}));

router.put('/genre-families', asyncHandler(async (req, res) => {
  const { genre, family } = req.body || {};
  if (!genre) throw new AppError(400, 'genre is required');
  if (family && !FAMILIES.includes(family)) throw new AppError(400, 'unknown family');
  const row = await db().setting.findUnique({ where: { key: 'genreFamilies' } });
  const value = { ...(row?.value || {}) };
  if (family) value[String(genre).toLowerCase().trim()] = family; else delete value[String(genre).toLowerCase().trim()];
  await db().setting.upsert({ where: { key: 'genreFamilies' }, create: { key: 'genreFamilies', value }, update: { value } });
  await recompute('admin: genre family');
  res.json({ overrides: value });
}));

module.exports = router;
