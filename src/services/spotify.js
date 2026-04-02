'use strict';

const axios = require('axios');
const { env } = require('../config/env');

const BASE_URL  = 'https://api.spotify.com/v1';
const AUTH_URL  = 'https://accounts.spotify.com/api/token';

function authHeader(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}

function basicAuth() {
  const creds = `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`;
  return `Basic ${Buffer.from(creds).toString('base64')}`;
}

// ── OAuth ─────────────────────────────────────────────────────────────────────

function getAuthURL(state = '') {
  const scopes = 'playlist-read-private playlist-read-collaborative user-read-private user-read-email';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.SPOTIFY_CLIENT_ID,
    scope: scopes,
    redirect_uri: env.REDIRECT_URI,
    state,
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

async function getAccessToken(code) {
  const res = await axios.post(AUTH_URL,
    new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: env.REDIRECT_URI }),
    { headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return res.data;
}

async function refreshAccessToken(refreshToken) {
  const res = await axios.post(AUTH_URL,
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    { headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return res.data;
}

// ── Playlist data ─────────────────────────────────────────────────────────────

async function getPlaylist(playlistId, accessToken) {
  const res = await axios.get(`${BASE_URL}/playlists/${playlistId}`, { headers: authHeader(accessToken) });
  return res.data;
}

async function getPlaylistTracks(playlistId, accessToken) {
  let tracks = [];
  let url = `${BASE_URL}/playlists/${playlistId}/tracks?limit=50`;
  while (url) {
    const res = await axios.get(url, { headers: authHeader(accessToken) });
    tracks = tracks.concat(res.data.items);
    url = res.data.next;
  }
  return tracks;
}

async function getAudioFeatures(trackIds, accessToken) {
  const chunks = [];
  for (let i = 0; i < trackIds.length; i += 100) chunks.push(trackIds.slice(i, i + 100));

  let all = [];
  for (const chunk of chunks) {
    const res = await axios.get(`${BASE_URL}/audio-features`, {
      headers: authHeader(accessToken),
      params: { ids: chunk.join(',') },
    });
    if (res.data.audio_features) all = all.concat(res.data.audio_features);
  }
  return all;
}

async function getArtists(artistIds, accessToken) {
  const chunks = [];
  for (let i = 0; i < artistIds.length; i += 50) chunks.push(artistIds.slice(i, i + 50));

  let all = [];
  for (const chunk of chunks) {
    const res = await axios.get(`${BASE_URL}/artists`, {
      headers: authHeader(accessToken),
      params: { ids: chunk.join(',') },
    });
    all = all.concat(res.data.artists);
  }
  return all;
}

async function getUserProfile(userId, accessToken) {
  try {
    const res = await axios.get(`${BASE_URL}/users/${userId}`, { headers: authHeader(accessToken) });
    return res.data;
  } catch {
    return null;
  }
}

module.exports = {
  getAuthURL,
  getAccessToken,
  refreshAccessToken,
  getPlaylist,
  getPlaylistTracks,
  getAudioFeatures,
  getArtists,
  getUserProfile,
};
