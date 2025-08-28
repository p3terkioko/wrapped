require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const SpotifyAPI = require('./utils/spotify');
const PlaylistScheduler = require('./utils/scheduler');
const playlistRoutes = require('./routes/playlist');

const app = express();
const PORT = process.env.PORT || 3000;
const spotify = new SpotifyAPI();
const scheduler = new PlaylistScheduler();

// Start the scheduler for automated updates
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SCHEDULER === 'true') {
  scheduler.start();
  console.log('📅 Automated playlist updates enabled');
} else {
  console.log('📅 Automated updates disabled (development mode)');
}

// Cache file paths - both backend and api directories
const BACKEND_CACHE_FILE = path.join(__dirname, 'cache', 'playlist-data.json');
const API_CACHE_FILE = path.join(__dirname, '..', 'api', 'cache', 'playlist-data.json');

// Ensure both cache directories exist
const backendCacheDir = path.dirname(BACKEND_CACHE_FILE);
const apiCacheDir = path.dirname(API_CACHE_FILE);

if (!fs.existsSync(backendCacheDir)) {
    fs.mkdirSync(backendCacheDir, { recursive: true });
}
if (!fs.existsSync(apiCacheDir)) {
    fs.mkdirSync(apiCacheDir, { recursive: true });
}

// Admin password (in production, use environment variable)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Utility functions for cache
function readCache() {
    try {
        // Try to read from backend cache first, then api cache as fallback
        let cacheFile = BACKEND_CACHE_FILE;
        if (!fs.existsSync(BACKEND_CACHE_FILE) && fs.existsSync(API_CACHE_FILE)) {
            cacheFile = API_CACHE_FILE;
        }
        
        if (fs.existsSync(cacheFile)) {
            const data = fs.readFileSync(cacheFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading cache:', error);
    }
    return { lastUpdated: null, data: null };
}

function writeCache(data) {
    try {
        const cacheData = {
            lastUpdated: new Date().toISOString(),
            data: data
        };
        
        // Write to both cache locations
        const success1 = writeCacheFile(BACKEND_CACHE_FILE, cacheData);
        const success2 = writeCacheFile(API_CACHE_FILE, cacheData);
        
        if (success1 && success2) {
            console.log('✅ Cache updated in both backend and api directories');
            return true;
        } else if (success1 || success2) {
            console.log('⚠️ Cache updated partially - one location failed');
            return true;
        } else {
            console.log('❌ Failed to update cache in both locations');
            return false;
        }
    } catch (error) {
        console.error('Error writing cache:', error);
        return false;
    }
}

function writeCacheFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`Cache written to: ${filePath}`);
        return true;
    } catch (error) {
        console.error(`Error writing cache to ${filePath}:`, error);
        return false;
    }
}

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/playlist', playlistRoutes);

// Public route to get cached data (no auth required)
app.get('/api/public/data', (req, res) => {
    const cache = readCache();
    if (cache.data) {
        res.json({
            success: true,
            data: cache.data,
            lastUpdated: cache.lastUpdated
        });
    } else {
        res.status(404).json({
            success: false,
            error: 'No data available. Admin needs to fetch data first.'
        });
    }
});

// Public route to get just the last updated info
app.get('/api/public/status', (req, res) => {
    const cache = readCache();
    res.json({
        hasData: !!cache.data,
        lastUpdated: cache.lastUpdated,
        tracksCount: cache.data?.playlist?.totalTracks || 0,
        playlistName: cache.data?.playlist?.name || null
    });
});

// Admin routes
app.post('/api/admin/refresh', async (req, res) => {
    const { password, accessToken } = req.body;
    
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid admin password' });
    }
    
    if (!accessToken) {
        return res.status(400).json({ error: 'Access token required' });
    }
    
    try {
        const playlistId = process.env.DEFAULT_PLAYLIST_ID || '1BZY7mhShLhc2fIlI6uIa4';
        
        // Get playlist details
        const playlist = await spotify.getPlaylist(playlistId, accessToken);
        
        // Get all tracks
        const tracks = await spotify.getPlaylistTracks(playlistId, accessToken);
        const validTracks = tracks.filter(item => item.track && item.track.id);
        
        // Extract track IDs for audio features
        const trackIds = validTracks.map(item => item.track.id);
        
        // Get audio features (handle errors gracefully)
        let audioFeatures = [];
        try {
            audioFeatures = await spotify.getAudioFeatures(trackIds, accessToken);
            console.log(`Successfully fetched audio features for ${audioFeatures.length} tracks`);
        } catch (audioError) {
            console.warn('Failed to fetch audio features, continuing without them:', audioError.message);
            audioFeatures = trackIds.map(() => null);
        }
        
        // Extract unique artist IDs
        const artistIds = [...new Set(
            validTracks.flatMap(item => 
                item.track.artists.map(artist => artist.id)
            )
        )];        // Get artist details for genres
        const artists = await spotify.getArtists(artistIds, accessToken);
        
        // Generate insights using the same function from playlist route
        const { generateInsights } = require('./routes/playlist');
        const insights = generateInsights(playlist, validTracks, audioFeatures, artists);
        
        // Get contributor counts and resolve display names
        const contributorCounts = {};
        validTracks.forEach(item => {
            const addedBy = item.added_by?.id || 'unknown';
            contributorCounts[addedBy] = (contributorCounts[addedBy] || 0) + 1;
        });
        
        // Resolve contributor display names using the working method
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
                            const axios = require('axios');
                            const { data: profile } = await axios.get(
                                `https://api.spotify.com/v1/users/${userId}`,
                                { headers: { Authorization: `Bearer ${accessToken}` } }
                            );
                            return {
                                userId,
                                count,
                                displayName: profile.display_name || profile.id
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
        );        // Add resolved contributors to insights
        insights.topContributors = topContributors;
        
        // Generate comprehensive contributor analytics with badges - fetch ALL contributor profiles
        const { generateAdvancedContributorAnalytics } = require('./routes/playlist');
        
        const allContributorIds = [...new Set(
            validTracks
                .map(item => item.added_by?.id)
                .filter(id => id && id !== 'unknown')
        )];
        
        // Fetch user profiles for ALL contributors
        const allUserProfiles = [];
        for (const userId of allContributorIds) {
            try {
                const axios = require('axios');
                const { data: profile } = await axios.get(
                    `https://api.spotify.com/v1/users/${userId}`,
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );
                allUserProfiles.push({
                    id: profile.id,
                    displayName: profile.display_name || profile.id
                });
            } catch (error) {
                console.warn(`Failed to fetch profile for user ${userId}:`, error.response?.status);
                allUserProfiles.push({
                    id: userId,
                    displayName: `User ${userId.slice(-4)}`
                });
            }
        }
          console.log(`Admin refresh: Fetched profiles for ${allUserProfiles.length} contributors (out of ${allContributorIds.length} total)`);
        
        const contributorAnalytics = generateAdvancedContributorAnalytics(validTracks, audioFeatures, artists, allUserProfiles);
        insights.contributors = contributorAnalytics;
        
        // Calculate genre maestros - import the function
        const { calculateGenreMaestros } = require('./routes/playlist');
        const genreMaestros = calculateGenreMaestros(validTracks, artists, allUserProfiles);
        insights.genreMaestros = genreMaestros;
        console.log(`Admin refresh: Found ${genreMaestros.length} genre maestros`);
          // Generate playlist members list - import the function and pass follower count
        const { generatePlaylistMembers } = require('./routes/playlist');
        const followerCount = playlist.followers?.total || 0;
        const playlistMembers = generatePlaylistMembers(validTracks, allUserProfiles, followerCount);
        insights.playlistMembers = playlistMembers;
        console.log(`Admin refresh: Found ${playlistMembers.totalMembers} playlist members`);
        
        // Cache the data
        const success = writeCache(insights);
        
        if (success) {
            res.json({
                success: true,
                message: 'Data refreshed successfully',
                lastUpdated: new Date().toISOString()
            });
        } else {
            res.status(500).json({ error: 'Failed to cache data' });
        }
        
    } catch (error) {
        console.error('Error refreshing data:', error);
        res.status(500).json({ error: 'Failed to refresh data' });
    }
});

app.get('/api/admin/status', (req, res) => {
    const cache = readCache();
    const schedulerStatus = scheduler.getStatus();
    
    res.json({
        hasData: !!cache.data,
        lastUpdated: cache.lastUpdated,
        tracksCount: cache.data?.playlist?.totalTracks || 0,
        scheduler: schedulerStatus,
        environment: process.env.NODE_ENV || 'development'
    });
});

// Manual trigger for admin
app.post('/api/admin/trigger-update', async (req, res) => {
    const { password } = req.body;
    
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid admin password' });
    }
    
    try {
        console.log('🔄 Admin triggered manual update...');
        const result = await scheduler.triggerUpdate();
        
        res.json({
            success: result.success,
            message: result.message,
            lastUpdated: result.lastUpdated,
            tracksCount: result.tracksCount || 0
        });
    } catch (error) {
        console.error('❌ Admin trigger failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to trigger update',
            message: error.message 
        });
    }
});

// Auth routes
app.get('/auth/login', (req, res) => {
  const state = Math.random().toString(36).substring(7);
  res.cookie('spotify_auth_state', state);
  
  const authURL = spotify.getAuthURL(state);
  res.redirect(authURL);
});

app.get('/auth/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const storedState = req.cookies?.spotify_auth_state;

  if (error) {
    return res.redirect(`/?error=${error}`);
  }

  if (!state || state !== storedState) {
    return res.redirect('/?error=state_mismatch');
  }

  try {
    const tokenData = await spotify.getAccessToken(code);
    
    // Log the tokens for debugging
    console.log('🎯 ACCESS TOKEN:', tokenData.access_token);
    console.log('🔄 REFRESH TOKEN:', tokenData.refresh_token);
    console.log('⏰ EXPIRES IN:', tokenData.expires_in, 'seconds');
    
    // Store token in cookie (in production, use secure httpOnly cookies)
    res.cookie('spotify_access_token', tokenData.access_token, {
      maxAge: tokenData.expires_in * 1000,
      httpOnly: false // Set to true in production
    });
    
    if (tokenData.refresh_token) {
      res.cookie('spotify_refresh_token', tokenData.refresh_token, {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: false
      });
    }
    
    res.clearCookie('spotify_auth_state');
    res.redirect('/?auth=success');
    
  } catch (error) {
    console.error('Auth callback error:', error);
    res.redirect('/?error=auth_failed');
  }
});

// Logout route
app.post('/auth/logout', (req, res) => {
  res.clearCookie('spotify_access_token');
  res.clearCookie('spotify_refresh_token');
  res.json({ success: true });
});

// Check auth status
app.get('/auth/status', (req, res) => {
  const token = req.cookies?.spotify_access_token;
  res.json({ authenticated: !!token });
});

// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Serve admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🎵 Playlist Wrapped server running on http://localhost:${PORT}`);
  console.log(`🔗 Make sure ngrok is forwarding to this port for Spotify OAuth`);
});
