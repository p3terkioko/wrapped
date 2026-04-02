'use strict';

const express    = require('express');
const router     = express.Router();
const spotify    = require('../services/spotify');
const { generateInsights, generateAdvancedContributorAnalytics, calculateGenreMaestros, generatePlaylistMembers } = require('../services/insights');
const { readCache, writeCache, logUpdate, getRecentLogs } = require('../services/cache');
const { adminAuth }    = require('../middleware/adminAuth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { env }    = require('../config/env');

// Full pipeline: refresh token → Spotify data → insights → DB
async function runRefreshPipeline(triggeredBy = 'admin') {
  if (!env.SPOTIFY_REFRESH_TOKEN) throw new AppError(400, 'SPOTIFY_REFRESH_TOKEN not configured');

  const tokenData   = await spotify.refreshAccessToken(env.SPOTIFY_REFRESH_TOKEN);
  const accessToken = tokenData.access_token;
  const playlistId  = env.SPOTIFY_PLAYLIST_ID;

  const playlist    = await spotify.getPlaylist(playlistId, accessToken);
  const tracks      = await spotify.getPlaylistTracks(playlistId, accessToken);
  const validTracks = tracks.filter(item => item.track && item.track.id);
  const trackIds    = validTracks.map(item => item.track.id);

  let audioFeatures = [];
  let audioFeaturesAvailable = true;
  try {
    audioFeatures = await spotify.getAudioFeatures(trackIds, accessToken);
    // If all returned null, Spotify has restricted the endpoint for this app
    if (!audioFeatures.some(f => f !== null)) audioFeaturesAvailable = false;
  } catch {
    audioFeaturesAvailable = false;
    audioFeatures = trackIds.map(() => null);
  }

  // If audio features are unavailable, preserve the ones from the previous cache
  if (!audioFeaturesAvailable) {
    const existing = await readCache().catch(() => null);
    if (existing?.data?.audioFeatures && existing.data.totalAnalyzedTracks > 0) {
      console.log('Audio features API unavailable — preserving previous values from cache');
      audioFeatures = null; // signal to generateInsights to use preserved values
    }
  }

  const artistIds = [...new Set(validTracks.flatMap(item => item.track.artists.map(a => a.id)))];
  const artists   = await spotify.getArtists(artistIds, accessToken);

  const insights = generateInsights(playlist, validTracks, audioFeatures || trackIds.map(() => null), artists);

  // Restore preserved audio feature insights if new fetch was unavailable
  if (!audioFeaturesAvailable) {
    const existing = await readCache().catch(() => null);
    if (existing?.data?.audioFeatures && existing.data.totalAnalyzedTracks > 0) {
      insights.audioFeatures       = existing.data.audioFeatures;
      insights.totalAnalyzedTracks = existing.data.totalAnalyzedTracks;
      insights.keyInsights         = existing.data.keyInsights;
      insights.tempoBreakdown      = existing.data.tempoBreakdown;
    }
  }

  // Top contributors (top 5 with display names)
  const contributorCounts = {};
  validTracks.forEach(item => {
    const id = item.added_by?.id || 'unknown';
    contributorCounts[id] = (contributorCounts[id] || 0) + 1;
  });

  insights.topContributors = await Promise.all(
    Object.entries(contributorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(async ([userId, count]) => {
        if (userId === playlist.owner.id) return { userId, count, displayName: playlist.owner.display_name || playlist.owner.id };
        if (userId === 'unknown') return { userId, count, displayName: 'Unknown User' };
        const profile = await spotify.getUserProfile(userId, accessToken);
        return { userId, count, displayName: profile?.display_name || `User ${userId.slice(-4)}` };
      })
  );

  // All contributor profiles for advanced analytics
  const allContributorIds = [...new Set(validTracks.map(item => item.added_by?.id).filter(id => id && id !== 'unknown'))];
  const allUserProfiles   = await Promise.all(
    allContributorIds.map(async userId => {
      const profile = await spotify.getUserProfile(userId, accessToken);
      return { id: userId, displayName: profile?.display_name || `User ${userId.slice(-4)}` };
    })
  );

  insights.contributors    = generateAdvancedContributorAnalytics(validTracks, audioFeatures, artists, allUserProfiles);
  insights.genreMaestros   = calculateGenreMaestros(validTracks, artists, allUserProfiles);
  insights.playlistMembers = generatePlaylistMembers(validTracks, allUserProfiles, playlist.followers?.total || 0);

  await writeCache(insights);
  await logUpdate('success', `${triggeredBy} — ${validTracks.length} tracks`, validTracks.length, triggeredBy);

  return { tracksCount: validTracks.length, playlistName: playlist.name };
}

// POST /api/admin/refresh  (also aliased as /api/admin/trigger-update for admin panel)
async function handleRefresh(req, res) {
  const result = await runRefreshPipeline('admin');
  res.json({ success: true, message: `Updated ${result.tracksCount} tracks`, tracksCount: result.tracksCount });
}

router.post('/refresh',        adminAuth, asyncHandler(handleRefresh));
router.post('/trigger-update', adminAuth, asyncHandler(handleRefresh));

// GET /api/admin/status
router.get('/status', asyncHandler(async (req, res) => {
  const cached = await readCache();
  let logs = [];
  try { logs = await getRecentLogs(10); } catch { /* DB may not have logs yet */ }

  res.json({
    success:     true,
    hasData:     !!cached,
    tracksCount: cached?.data?.playlist?.totalTracks || 0,
    lastUpdated: cached?.lastUpdated || null,
    environment: env.NODE_ENV,
    recentLogs:  logs,
  });
}));

module.exports = router;
