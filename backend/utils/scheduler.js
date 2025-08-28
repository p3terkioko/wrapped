const cron = require('node-cron');
const SpotifyAPI = require('./spotify');
const fs = require('fs');
const path = require('path');

class PlaylistScheduler {
  constructor() {
    this.spotify = new SpotifyAPI();
    this.isRunning = false;
    this.lastUpdateTime = null;
    
    // Cache file paths
    this.BACKEND_CACHE_FILE = path.join(__dirname, '..', 'cache', 'playlist-data.json');
    this.API_CACHE_FILE = path.join(__dirname, '..', '..', 'api', 'cache', 'playlist-data.json');
  }

  // Get fresh access token using refresh token
  async getAccessToken() {
    const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
    if (!refreshToken) {
      throw new Error('No refresh token found in environment variables');
    }

    try {
      const tokenData = await this.spotify.refreshAccessToken(refreshToken);
      return tokenData.access_token;
    } catch (error) {
      console.error('Failed to refresh access token:', error);
      throw error;
    }
  }

  // Update playlist data
  async updatePlaylistData() {
    if (this.isRunning) {
      console.log('⏳ Update already in progress, skipping...');
      return { success: false, message: 'Update already in progress' };
    }

    this.isRunning = true;
    console.log('🔄 Starting scheduled playlist update...');

    try {
      // Get fresh access token
      const accessToken = await this.getAccessToken();
      
      const playlistId = process.env.DEFAULT_PLAYLIST_ID || '1BZY7mhShLhc2fIlI6uIa4';
      
      // Get playlist details
      const playlist = await this.spotify.getPlaylist(playlistId, accessToken);
      
      // Get all tracks
      const tracks = await this.spotify.getPlaylistTracks(playlistId, accessToken);
      const validTracks = tracks.filter(item => item.track && item.track.id);
      
      // Extract track IDs for audio features
      const trackIds = validTracks.map(item => item.track.id);
      
      // Get audio features
      let audioFeatures = [];
      try {
        audioFeatures = await this.spotify.getAudioFeatures(trackIds, accessToken);
        console.log(`✅ Fetched audio features for ${audioFeatures.length} tracks`);
      } catch (audioError) {
        console.warn('⚠️ Failed to fetch audio features, continuing without them:', audioError.message);
        audioFeatures = trackIds.map(() => null);
      }
      
      // Extract unique artist IDs and get artist details
      const artistIds = [...new Set(
        validTracks.flatMap(item => 
          item.track.artists.map(artist => artist.id)
        )
      )];
      
      const artists = await this.spotify.getArtists(artistIds, accessToken);
      
      // Generate insights
      const { generateInsights } = require('../routes/playlist');
      const insights = generateInsights(playlist, validTracks, audioFeatures, artists);
      
      // Get contributor data
      const contributorCounts = {};
      validTracks.forEach(item => {
        const addedBy = item.added_by?.id || 'unknown';
        contributorCounts[addedBy] = (contributorCounts[addedBy] || 0) + 1;
      });
      
      // Resolve contributor display names
      const topContributors = await Promise.all(
        Object.entries(contributorCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(async ([userId, count]) => {
            if (userId === playlist.owner.id) {
              return {
                userId,
                count,
                displayName: playlist.owner.display_name || playlist.owner.id
              };
            } else if (userId === 'unknown') {
              return {
                userId,
                count,
                displayName: 'Unknown User'
              };
            } else {
              try {
                const profile = await this.spotify.getUserProfile(userId, accessToken);
                return {
                  userId,
                  count,
                  displayName: profile?.display_name || `User ${userId.slice(-4)}`
                };
              } catch {
                return {
                  userId,
                  count,
                  displayName: `User ${userId.slice(-4)}`
                };
              }
            }
          })
      );
      
      insights.topContributors = topContributors;
      
      // Generate advanced analytics
      const allContributorIds = [...new Set(
        validTracks
          .map(item => item.added_by?.id)
          .filter(id => id && id !== 'unknown')
      )];
      
      const allUserProfiles = [];
      for (const userId of allContributorIds) {
        try {
          const profile = await this.spotify.getUserProfile(userId, accessToken);
          allUserProfiles.push({
            id: userId,
            displayName: profile?.display_name || `User ${userId.slice(-4)}`
          });
        } catch (error) {
          allUserProfiles.push({
            id: userId,
            displayName: `User ${userId.slice(-4)}`
          });
        }
      }
      
      const { generateAdvancedContributorAnalytics, calculateGenreMaestros, generatePlaylistMembers } = require('../routes/playlist');
      
      const contributorAnalytics = generateAdvancedContributorAnalytics(validTracks, audioFeatures, artists, allUserProfiles);
      insights.contributors = contributorAnalytics;
      
      const genreMaestros = calculateGenreMaestros(validTracks, artists, allUserProfiles);
      insights.genreMaestros = genreMaestros;
      
      const followerCount = playlist.followers?.total || 0;
      const playlistMembers = generatePlaylistMembers(validTracks, allUserProfiles, followerCount);
      insights.playlistMembers = playlistMembers;
      
      // Cache the data
      const success = this.writeCache(insights);
      
      if (success) {
        this.lastUpdateTime = new Date().toISOString();
        console.log('✅ Scheduled update completed successfully');
        return { 
          success: true, 
          message: 'Playlist data updated successfully',
          lastUpdated: this.lastUpdateTime,
          tracksCount: validTracks.length
        };
      } else {
        throw new Error('Failed to cache data');
      }
      
    } catch (error) {
      console.error('❌ Scheduled update failed:', error);
      return { 
        success: false, 
        message: `Update failed: ${error.message}`,
        error: error.message
      };
    } finally {
      this.isRunning = false;
    }
  }

  // Write cache to both locations
  writeCache(data) {
    try {
      const cacheData = {
        lastUpdated: new Date().toISOString(),
        data: data
      };
      
      // Ensure directories exist
      const backendCacheDir = path.dirname(this.BACKEND_CACHE_FILE);
      const apiCacheDir = path.dirname(this.API_CACHE_FILE);
      
      if (!fs.existsSync(backendCacheDir)) {
        fs.mkdirSync(backendCacheDir, { recursive: true });
      }
      if (!fs.existsSync(apiCacheDir)) {
        fs.mkdirSync(apiCacheDir, { recursive: true });
      }
      
      // Write to both locations
      const success1 = this.writeCacheFile(this.BACKEND_CACHE_FILE, cacheData);
      const success2 = this.writeCacheFile(this.API_CACHE_FILE, cacheData);
      
      return success1 || success2;
    } catch (error) {
      console.error('Error writing cache:', error);
      return false;
    }
  }

  writeCacheFile(filePath, data) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`📝 Cache written to: ${filePath}`);
      return true;
    } catch (error) {
      console.error(`❌ Error writing cache to ${filePath}:`, error);
      return false;
    }
  }

  // Start the scheduled job
  start() {
    // Schedule for 9 AM every day (09:00) East Africa Time
    // Cron format: second minute hour day month dayOfWeek
    const cronExpression = '0 0 9 * * *'; // 9 AM every day
    
    console.log('📅 Scheduling daily playlist updates at 9 AM EAT...');
    
    cron.schedule(cronExpression, async () => {
      console.log('🌅 Executing scheduled playlist update at 9 AM EAT...');
      const result = await this.updatePlaylistData();
      
      if (result.success) {
        console.log(`✅ Scheduled update completed: ${result.tracksCount} tracks processed`);
      } else {
        console.error(`❌ Scheduled update failed: ${result.message}`);
      }
    }, {
      scheduled: true,
      timezone: "Africa/Nairobi" // East Africa Time (EAT)
    });

    console.log('⏰ Daily scheduler started - updates will run at 9 AM EAT (East Africa Time)');
  }

  // Manual trigger for testing
  async triggerUpdate() {
    console.log('🔄 Manual update triggered...');
    return await this.updatePlaylistData();
  }

  // Get last update status
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastUpdateTime: this.lastUpdateTime,
      nextUpdate: '09:00 EAT (9 AM East Africa Time) daily',
      timezone: 'Africa/Nairobi'
    };
  }
}

module.exports = PlaylistScheduler;
