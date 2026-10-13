'use strict';

// Spotify Web API client that survives the 2026 Development Mode rules.
// Fast path: the endpoints that still work for this app today.
// Fallbacks: what Development Mode apps get after the February 2026 changes
// (playlist /items with item.item, single-artist lookups, no /users/{id}).

const axios = require('axios');
const { env } = require('../config/env');

const API = 'https://api.spotify.com/v1';
const AUTH_URL = 'https://accounts.spotify.com/api/token';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function basicAuth() {
  return 'Basic ' + Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
}

// ── OAuth ─────────────────────────────────────────────────────────────────────

function getAuthURL(state = '') {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.SPOTIFY_CLIENT_ID,
    scope: 'playlist-read-private playlist-read-collaborative user-read-private user-read-email',
    redirect_uri: env.REDIRECT_URI,
    state,
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

async function getAccessToken(code) {
  const res = await axios.post(AUTH_URL,
    new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: env.REDIRECT_URI }),
    { headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' } });
  return res.data;
}

async function refreshAccessToken(refreshToken) {
  const res = await axios.post(AUTH_URL,
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    { headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' } });
  return res.data;
}

// ── Request helper: retries 429 (Retry-After) and transient 5xx ───────────────

async function get(pathOrUrl, token, params) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : API + pathOrUrl;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` }, params, timeout: 15000 });
      return res.data;
    } catch (err) {
      const status = err.response?.status;
      if (status === 429 && attempt < 4) {
        const wait = Number(err.response.headers['retry-after'] || 2) * 1000;
        await sleep(Math.min(wait, 20000));
        continue;
      }
      if (status >= 500 && attempt < 2) { await sleep(800 * (attempt + 1)); continue; }
      throw err;
    }
  }
}

// Statuses that mean "this endpoint is not available to this app".
const GONE = new Set([403, 404, 410]);
const isGone = err => GONE.has(err.response?.status);

// ── Playlist ──────────────────────────────────────────────────────────────────

async function getPlaylist(playlistId, token) {
  return get(`/playlists/${playlistId}`, token);
}

// Normalise one playlist row from either the 2026 shape (item.item) or the
// legacy shape (item.track).
function normaliseItem(row) {
  return {
    addedAt: row.added_at,
    addedBy: row.added_by?.id || null,
    isLocal: !!row.is_local,
    track: row.item ?? row.track ?? null,
  };
}

async function pageAll(firstUrl, token) {
  let rows = [];
  let url = firstUrl;
  while (url) {
    const data = await get(url, token);
    rows = rows.concat(data.items || []);
    url = data.next;
  }
  return rows;
}

// Every row of the playlist. Tries /items first (current API), falls back to
// /tracks (legacy) if /items is refused.
async function getPlaylistItems(playlistId, token) {
  try {
    const rows = await pageAll(`${API}/playlists/${playlistId}/items?limit=50`, token);
    return { items: rows.map(normaliseItem), endpoint: 'items' };
  } catch (err) {
    if (!isGone(err)) throw err;
    const rows = await pageAll(`${API}/playlists/${playlistId}/tracks?limit=50`, token);
    return { items: rows.map(normaliseItem), endpoint: 'tracks' };
  }
}

// The most recent page of the playlist (two requests), for the live pulse.
async function getLastItems(playlistId, token, n = 50) {
  for (const path of ['items', 'tracks']) {
    try {
      const head = await get(`/playlists/${playlistId}/${path}`, token, { limit: 1 });
      const offset = Math.max(0, (head.total || 0) - n);
      const page = await get(`/playlists/${playlistId}/${path}`, token, { limit: n, offset });
      return { items: (page.items || []).map(normaliseItem), total: head.total };
    } catch (err) {
      if (!isGone(err)) throw err;
    }
  }
  return { items: [], total: 0 };
}

// ── Artists ───────────────────────────────────────────────────────────────────

// Batch lookup (50 per call) while it exists; single lookups otherwise.
async function getArtists(artistIds, token) {
  const ids = [...new Set(artistIds.filter(Boolean))];
  const out = [];
  let batch = true;
  for (let i = 0; i < ids.length && batch; i += 50) {
    try {
      const data = await get('/artists', token, { ids: ids.slice(i, i + 50).join(',') });
      out.push(...(data.artists || []).filter(Boolean));
    } catch (err) {
      if (!isGone(err)) throw err;
      batch = false; // fall through to single lookups for the rest
    }
  }
  if (!batch) {
    const done = new Set(out.map(a => a.id));
    const rest = ids.filter(id => !done.has(id));
    for (let i = 0; i < rest.length; i += 4) {
      const chunk = await Promise.all(rest.slice(i, i + 4).map(id => get(`/artists/${id}`, token).catch(() => null)));
      out.push(...chunk.filter(Boolean));
    }
  }
  return { artists: out, mode: batch ? 'batch' : 'single' };
}

// ── Users ─────────────────────────────────────────────────────────────────────

// Returns null when the profile endpoint is unavailable; names then come from
// the admin-editable contributors table.
async function getUserProfile(userId, token) {
  try {
    return await get(`/users/${encodeURIComponent(userId)}`, token);
  } catch {
    return null;
  }
}

module.exports = {
  getAuthURL,
  getAccessToken,
  refreshAccessToken,
  getPlaylist,
  getPlaylistItems,
  getLastItems,
  getArtists,
  getUserProfile,
  normaliseItem,
};
