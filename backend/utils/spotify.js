const axios = require('axios');

class SpotifyAPI {
  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID;
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    this.redirectUri = process.env.REDIRECT_URI;
    this.baseURL = 'https://api.spotify.com/v1';
    this.authURL = 'https://accounts.spotify.com/api/token';
  }
  // Generate authorization URL for OAuth
  getAuthURL(state = '') {
    const scopes = 'playlist-read-private playlist-read-collaborative user-read-private user-read-email user-library-read user-top-read';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      scope: scopes,
      redirect_uri: this.redirectUri,
      state: state
    });
    
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  // Exchange authorization code for access token
  async getAccessToken(code) {
    try {
      const response = await axios.post(this.authURL, 
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri,
        }),
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error getting access token:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get playlist details
  async getPlaylist(playlistId, accessToken) {
    try {
      const response = await axios.get(`${this.baseURL}/playlists/${playlistId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching playlist:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get all tracks from a playlist (handles pagination)
  async getPlaylistTracks(playlistId, accessToken) {
    try {
      let tracks = [];
      let url = `${this.baseURL}/playlists/${playlistId}/tracks?limit=50`;
      
      while (url) {
        const response = await axios.get(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        tracks = tracks.concat(response.data.items);
        url = response.data.next;
      }
      
      return tracks;
    } catch (error) {
      console.error('Error fetching playlist tracks:', error.response?.data || error.message);
      throw error;
    }
  }
  // Get audio features for tracks
  async getAudioFeatures(trackIds, accessToken) {
    try {
      // Spotify API allows max 100 track IDs per request
      const chunks = [];
      for (let i = 0; i < trackIds.length; i += 100) {
        chunks.push(trackIds.slice(i, i + 100));
      }

      let allFeatures = [];
      for (const chunk of chunks) {
        const response = await axios.get(`${this.baseURL}/audio-features`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          params: {
            ids: chunk.join(',')
          }
        });
        
        if (response.data.audio_features) {
          allFeatures = allFeatures.concat(response.data.audio_features);
        }
      }
      
      return allFeatures;
    } catch (error) {
      console.error('Error fetching audio features:', error.response?.data || error.message);
      console.error('Status:', error.response?.status);
      console.error('Headers:', error.response?.headers);
      throw error;
    }
  }
  // Get multiple artists' details
  async getArtists(artistIds, accessToken) {
    try {
      const chunks = [];
      for (let i = 0; i < artistIds.length; i += 50) {
        chunks.push(artistIds.slice(i, i + 50));
      }

      let allArtists = [];
      for (const chunk of chunks) {
        const response = await axios.get(`${this.baseURL}/artists`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          params: {
            ids: chunk.join(',')
          }
        });
        
        allArtists = allArtists.concat(response.data.artists);
      }
      
      return allArtists;
    } catch (error) {
      console.error('Error fetching artists:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get user profile by user ID
  async getUserProfile(userId, accessToken) {
    try {
      const response = await axios.get(`${this.baseURL}/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      return response.data;
    } catch (error) {
      // If we can't fetch the user profile (common for privacy reasons), return null
      console.warn(`Could not fetch profile for user ${userId}:`, error.response?.status);
      return null;
    }
  }  // Get multiple user profiles - following reference pattern
  async getUserProfiles(userIds, accessToken) {
    try {
      const profiles = await Promise.all(
        userIds.map(async userId => {
          if (!userId || userId === 'unknown') {
            return { id: userId, profile: null };
          }
            try {
            const response = await axios.get(`https://api.spotify.com/v1/users/${userId}`, {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            
            console.log(`Fetched profile for ${userId}:`, {
              id: response.data.id,
              display_name: response.data.display_name,
              type: response.data.type
            });
            
            return {
              id: userId,
              displayName: response.data.display_name || `User ${userId.slice(-4)}`,
              profile: response.data
            };          } catch (error) {
            // In case of error (e.g. profile not found), fall back to user-friendly ID
            console.warn(`Could not fetch profile for user ${userId}:`, error.response?.status || error.message);
            return {
              id: userId,
              displayName: `User ${userId.slice(-4)}`,
              profile: null
            };
          }
        })
      );
      
      return profiles;
    } catch (error) {
      console.error('Error fetching user profiles:', error.message);
      return [];
    }
  }

  // Get playlist followers information (note: Spotify doesn't provide follower lists for privacy)
  async getPlaylistFollowers(playlistId, accessToken) {
    try {
      // Note: Spotify API doesn't provide a way to get the list of followers
      // We can only get the follower count from the playlist endpoint
      const playlist = await this.getPlaylist(playlistId, accessToken);
      return {
        total: playlist.followers?.total || 0,
        followers: [] // Empty array since Spotify doesn't provide follower lists
      };
    } catch (error) {
      console.error('Error fetching playlist followers:', error.response?.data || error.message);
      return { total: 0, followers: [] };
    }
  }
}

module.exports = SpotifyAPI;
