'use strict';

// Enrichment sources. Each function takes plain track/artist data and returns
// plain values to store, plus a status: ok | not_found | error.
// Polite rate limits are enforced per source.

const axios = require('axios');
const jpeg = require('jpeg-js');
const { analyseLyrics } = require('./language');

const UA = 'KamiLimuInTheEars/2.0 ( https://github.com/p3terkioko/wrapped )';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// GET with retries on network errors, 429 and 5xx.
async function fetchGet(url, config = {}, attempts = 4) {
  for (let i = 0; ; i++) {
    try {
      return await axios.get(url, config);
    } catch (err) {
      const s = err.response?.status;
      const transient = !err.response || s === 429 || s >= 500;
      if (!transient || i >= attempts - 1) throw err;
      const retryAfter = Number(err.response?.headers?.['retry-after']);
      await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 600 * 2 ** i);
    }
  }
}

// Minimum gap between requests to one host.
function limiter(minGapMs) {
  let next = 0;
  return async () => {
    const now = Date.now();
    const wait = Math.max(0, next - now);
    next = Math.max(now, next) + minGapMs;
    if (wait) await sleep(wait);
  };
}
const gate = {
  reccobeats: limiter(400),
  deezer: limiter(130),
  lrclib: limiter(150),
  musicbrainz: limiter(1100),
  image: limiter(20),
};

// ── Artwork colour ────────────────────────────────────────────────────────────
// Dominant colour of the smallest artwork image, favouring saturated mid-tones
// so a mostly-black cover with a red title still reads as red-ish.
async function colour(track) {
  if (!track.imageSmall) return { status: 'not_found' };
  await gate.image();
  const res = await fetchGet(track.imageSmall, { responseType: 'arraybuffer', timeout: 10000 });
  const img = jpeg.decode(Buffer.from(res.data), { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 64 });
  const buckets = new Map();
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
    const l = (max + min) / 2;
    const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
    const w = 1 + 4 * s * (1 - Math.abs(2 * l - 1));
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = buckets.get(key) || { w: 0, r: 0, g: 0, b: 0, n: 0 };
    e.w += w; e.r += r; e.g += g; e.b += b; e.n += 1;
    buckets.set(key, e);
  }
  let best = null;
  for (const e of buckets.values()) if (!best || e.w > best.w) best = e;
  const hex = '#' + [best.r, best.g, best.b].map(v => Math.round(v / best.n).toString(16).padStart(2, '0')).join('');
  return { status: 'ok', data: { colour: hex } };
}

// ── ReccoBeats: audio features by Spotify id (batch of up to 40) ──────────────
async function reccobeats(tracks) {
  await gate.reccobeats();
  const res = await fetchGet('https://api.reccobeats.com/v1/audio-features', {
    params: { ids: tracks.map(t => t.id).join(',') }, timeout: 20000, headers: { 'User-Agent': UA },
  });
  const byId = new Map();
  for (const f of res.data?.content || []) {
    const id = String(f.href || '').split('/track/')[1];
    if (id) byId.set(id, f);
  }
  return tracks.map(t => {
    const f = byId.get(t.id);
    if (!f) return { id: t.id, status: 'not_found' };
    return {
      id: t.id, status: 'ok',
      data: {
        tempo: f.tempo, key: f.key >= 0 ? f.key : null, mode: f.mode, energy: f.energy, valence: f.valence,
        danceability: f.danceability, acousticness: f.acousticness, instrumentalness: f.instrumentalness,
        speechiness: f.speechiness, liveness: f.liveness, loudness: f.loudness,
      },
    };
  });
}

// ── Deezer: rank, bpm, gain by ISRC. The preview URL is returned for in-memory
// analysis only and must never be stored. ──────────────────────────────────────
async function deezer(track) {
  if (!track.isrc) return { status: 'not_found' };
  await gate.deezer();
  const res = await fetchGet(`https://api.deezer.com/track/isrc:${encodeURIComponent(track.isrc)}`, { timeout: 10000 });
  if (res.data?.error) return { status: res.data.error.code === 800 ? 'not_found' : 'error' };
  return {
    status: 'ok',
    data: { deezerId: String(res.data.id), deezerRank: res.data.rank ?? null, deezerBpm: res.data.bpm > 0 ? res.data.bpm : null, deezerGain: typeof res.data.gain === 'number' ? res.data.gain : null },
    preview: res.data.preview || null,
  };
}

// ── LRCLIB: lyrics → numbers only ─────────────────────────────────────────────
const cleanTitle = s => String(s).replace(/\s*[-–(\[].*(remaster|feat|ft\.|with |live|version|edit|mix).*$/i, '').trim();

async function lrclib(track) {
  const durationS = Math.round(track.durationMs / 1000);
  const artist = track.artistNames[0];
  await gate.lrclib();
  let hit = null;
  try {
    const r = await fetchGet('https://lrclib.net/api/get', {
      params: { track_name: track.name, artist_name: artist, album_name: track.albumName || '', duration: durationS },
      headers: { 'User-Agent': UA }, timeout: 12000,
    });
    hit = r.data;
  } catch (err) {
    if (err.response?.status !== 404) throw err;
  }
  if (!hit) {
    await gate.lrclib();
    const r = await fetchGet('https://lrclib.net/api/search', {
      params: { track_name: cleanTitle(track.name), artist_name: artist }, headers: { 'User-Agent': UA }, timeout: 12000,
    });
    hit = (r.data || []).find(x => Math.abs((x.duration || 0) - durationS) <= 3) || null;
  }
  if (!hit) return { status: 'not_found', data: { lyricsStatus: 'not_found' } };
  if (hit.instrumental) return { status: 'ok', data: { lyricsStatus: 'instrumental', wordCount: 0, wordsPerMinute: 0, linesSwahili: 0, linesEnglish: 0, linesMixed: 0, linesOther: 0 } };
  const text = hit.plainLyrics || String(hit.syncedLyrics || '').replace(/\[\d+:\d+(\.\d+)?\]/g, '');
  if (!text.trim()) return { status: 'not_found', data: { lyricsStatus: 'not_found' } };
  const { lines, words } = analyseLyrics(text);
  return {
    status: 'ok',
    data: {
      lyricsStatus: 'counted', wordCount: words, wordsPerMinute: Math.round((words / (track.durationMs / 60000)) * 10) / 10,
      linesSwahili: lines.swahili, linesEnglish: lines.english, linesMixed: lines.mixed, linesOther: lines.other,
    },
  };
}

// ── MusicBrainz: ISRC → artist credits; artist → origin ───────────────────────
async function mbGet(path, params) {
  await gate.musicbrainz();
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await axios.get('https://musicbrainz.org/ws/2/' + path, { params: { fmt: 'json', ...params }, headers: { 'User-Agent': UA }, timeout: 15000 });
      return r.data;
    } catch (err) {
      const s = err.response?.status;
      if (s === 404) return null;
      if (s === 503 && attempt < 3) { await sleep(2000 * (attempt + 1)); continue; }
      throw err;
    }
  }
}

async function musicbrainzRecording(track) {
  if (!track.isrc) return { status: 'not_found' };
  const data = await mbGet(`isrc/${encodeURIComponent(track.isrc)}`, { inc: 'artist-credits' });
  const rec = data?.recordings?.[0];
  if (!rec) return { status: 'not_found' };
  const credits = (rec['artist-credit'] || []).map(c => ({ mbid: c.artist?.id, name: c.artist?.name || c.name })).filter(c => c.mbid);
  return { status: 'ok', credits };
}

async function musicbrainzArtist(mbid) {
  const a = await mbGet(`artist/${mbid}`, {});
  if (!a) return { status: 'not_found' };
  const iso = a.country || a.area?.['iso-3166-1-codes']?.[0] || null;
  const begin = parseInt(String(a['life-span']?.begin || '').slice(0, 4), 10);
  return {
    status: 'ok',
    data: { mbid, country: iso, area: a['begin-area']?.name || a.area?.name || null, kind: a.type || null, beginYear: Number.isFinite(begin) ? begin : null },
  };
}

module.exports = { colour, reccobeats, deezer, lrclib, musicbrainzRecording, musicbrainzArtist, UA };
