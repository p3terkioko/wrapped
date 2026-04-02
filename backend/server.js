// Local development entry point — delegates entirely to src/app.js
require('dotenv').config();
const app = require('../src/app');
const { env } = require('../src/config/env');
const cron = require('node-cron');

// Scheduler (only runs in local dev when ENABLE_SCHEDULER=true)
if (env.ENABLE_SCHEDULER) {
  const { refreshAccessToken } = require('../src/services/spotify');
  const { generateInsights, generateAdvancedContributorAnalytics, calculateGenreMaestros, generatePlaylistMembers } = require('../src/services/insights');
  const { writeCache, logUpdate } = require('../src/services/cache');
  const spotify = require('../src/services/spotify');

  let isRunning = false;

  async function scheduledUpdate() {
    if (isRunning) return;
    isRunning = true;
    console.log('Scheduled update starting...');
    try {
      const tokenData = await refreshAccessToken(env.SPOTIFY_REFRESH_TOKEN);
      const accessToken = tokenData.access_token;
      const playlistId = env.SPOTIFY_PLAYLIST_ID;

      const playlist = await spotify.getPlaylist(playlistId, accessToken);
      const tracks = await spotify.getPlaylistTracks(playlistId, accessToken);
      const validTracks = tracks.filter(item => item.track && item.track.id);
      const trackIds = validTracks.map(item => item.track.id);

      let audioFeatures = [];
      try { audioFeatures = await spotify.getAudioFeatures(trackIds, accessToken); }
      catch { audioFeatures = trackIds.map(() => null); }

      const artistIds = [...new Set(validTracks.flatMap(item => item.track.artists.map(a => a.id)))];
      const artists = await spotify.getArtists(artistIds, accessToken);

      const insights = generateInsights(playlist, validTracks, audioFeatures, artists);

      const contributorCounts = {};
      validTracks.forEach(item => {
        const id = item.added_by?.id || 'unknown';
        contributorCounts[id] = (contributorCounts[id] || 0) + 1;
      });

      const topContributors = await Promise.all(
        Object.entries(contributorCounts).sort(([, a], [, b]) => b - a).slice(0, 5)
          .map(async ([userId, count]) => {
            if (userId === playlist.owner.id) return { userId, count, displayName: playlist.owner.display_name || playlist.owner.id };
            if (userId === 'unknown') return { userId, count, displayName: 'Unknown User' };
            const profile = await spotify.getUserProfile(userId, accessToken);
            return { userId, count, displayName: profile?.display_name || `User ${userId.slice(-4)}` };
          })
      );
      insights.topContributors = topContributors;

      const allContributorIds = [...new Set(validTracks.map(item => item.added_by?.id).filter(id => id && id !== 'unknown'))];
      const allUserProfiles = await Promise.all(
        allContributorIds.map(async userId => {
          const profile = await spotify.getUserProfile(userId, accessToken);
          return { id: userId, displayName: profile?.display_name || `User ${userId.slice(-4)}` };
        })
      );

      insights.contributors = generateAdvancedContributorAnalytics(validTracks, audioFeatures, artists, allUserProfiles);
      insights.genreMaestros = calculateGenreMaestros(validTracks, artists, allUserProfiles);
      insights.playlistMembers = generatePlaylistMembers(validTracks, allUserProfiles, playlist.followers?.total || 0);

      await writeCache(insights);
      await logUpdate('success', `Scheduled update — ${validTracks.length} tracks`, validTracks.length, 'scheduler');
      console.log(`Scheduled update complete: ${validTracks.length} tracks`);
    } catch (err) {
      console.error('Scheduled update failed:', err.message);
      await logUpdate('failed', err.message, null, 'scheduler');
    } finally {
      isRunning = false;
    }
  }

  cron.schedule('0 0 9 * * *', scheduledUpdate, { timezone: 'Africa/Nairobi' });
  console.log('Scheduler started — daily at 09:00 EAT');
}

app.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
});
