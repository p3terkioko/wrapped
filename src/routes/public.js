'use strict';

// Public, read-only, CDN-cacheable API. Payloads are precomputed at refresh
// time; nothing here computes over raw data per request.

const express = require('express');
const router = express.Router();
const { prisma } = require('../db/client');
const { readPayload } = require('../services/payloads');
const spotify = require('../services/spotify');
const { env } = require('../config/env');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// Browsers revalidate after a minute; the CDN serves for 10 minutes and keeps
// serving a stale copy for a day while it refetches in the background.
const CACHE = 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400';

function servePayload(key, wrap = data => data) {
  return asyncHandler(async (req, res) => {
    if (!prisma) throw new AppError(503, 'Database not available');
    const p = await readPayload(prisma, key);
    if (!p) return res.status(503).json({ success: false, error: 'Data is not ready yet. Check back soon.' });
    const etag = `"${key}-${p.version}"`;
    res.set('Cache-Control', CACHE);
    res.set('ETag', etag);
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    res.json(wrap(p.data, p));
  });
}

router.get('/film', servePayload('film'));
router.get('/people', servePayload('people'));
router.get('/tracks', servePayload('tracks'));

// Legacy shape for story mode and anything still calling the old endpoint.
router.get('/data', servePayload('legacy', (data, p) => ({ success: true, data, lastUpdated: p.updatedAt, cached_at: p.updatedAt })));

router.get('/status', asyncHandler(async (req, res) => {
  const p = prisma ? await readPayload(prisma, 'film') : null;
  res.set('Cache-Control', 'public, max-age=30, s-maxage=60');
  res.json({ success: true, hasData: !!p, lastUpdated: p?.updatedAt || null, version: p?.version || null });
}));

// Live pulse: the most recent add, checked against Spotify at most every few
// minutes (CDN-cached), falling back to the last refresh's value.
router.get('/pulse', asyncHandler(async (req, res) => {
  const film = prisma ? await readPayload(prisma, 'film') : null;
  const fallback = film?.data?.pulse || null;
  let live = null;
  try {
    if (env.SPOTIFY_REFRESH_TOKEN) {
      const { access_token: token } = await spotify.refreshAccessToken(env.SPOTIFY_REFRESH_TOKEN);
      const { items, total } = await spotify.getLastItems(env.SPOTIFY_PLAYLIST_ID, token);
      const last = items.filter(i => i.track?.id).sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt))[0];
      if (last) {
        const person = last.addedBy && prisma ? await prisma.contributor.findUnique({ where: { id: last.addedBy } }) : null;
        live = {
          at: new Date(last.addedAt).toISOString(), by: last.addedBy,
          name: person?.adminName || person?.displayName || (last.addedBy ? 'A new contributor' : 'Unknown'),
          song: { id: last.track.id, name: last.track.name, artists: (last.track.artists || []).map(a => a.name).join(', '), url: `https://open.spotify.com/track/${last.track.id}` },
          total,
        };
      }
    }
  } catch { /* fall back */ }
  const pulse = live && (!fallback || Date.parse(live.at) >= Date.parse(fallback.at)) ? { ...live, live: true } : { ...fallback, live: false };
  res.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600');
  res.json(pulse);
}));

module.exports = router;
