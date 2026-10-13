// Read-only pull of the playlist from Spotify into .cache/pull.json, for
// seeding the local dev database. Writes nothing to any database.
//
//   npm run dev:pull
'use strict';

const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env.local') });
require('dotenv').config({ path: path.join(root, '.env') });

const spotify = require('../src/services/spotify');
const { env } = require('../src/config/env');

(async () => {
  const { access_token: token } = await spotify.refreshAccessToken(env.SPOTIFY_REFRESH_TOKEN);
  const playlist = await spotify.getPlaylist(env.SPOTIFY_PLAYLIST_ID, token);
  const { items, endpoint } = await spotify.getPlaylistItems(env.SPOTIFY_PLAYLIST_ID, token);
  const artistIds = [...new Set(items.flatMap(i => (i.track?.artists || []).map(a => a.id)).filter(Boolean))];
  const { artists, mode } = await spotify.getArtists(artistIds, token);
  const userIds = [...new Set(items.map(i => i.addedBy).filter(Boolean))];
  const users = [];
  for (const id of userIds) {
    const p = await spotify.getUserProfile(id, token);
    users.push({ id, displayName: p?.display_name || null, avatarUrl: p?.images?.[0]?.url || null });
  }
  delete playlist.tracks; delete playlist.items; // keep only metadata
  const out = { pulledAt: new Date().toISOString(), playlist, items, artists, users };
  fs.mkdirSync(path.join(root, '.cache'), { recursive: true });
  fs.writeFileSync(path.join(root, '.cache', 'pull.json'), JSON.stringify(out));
  console.log(`pulled ${items.length} items via /${endpoint}, ${artists.length} artists (${mode}), ${users.length} contributors → .cache/pull.json`);
})().catch(err => { console.error('pull failed:', err.response?.status, err.message); process.exit(1); });
