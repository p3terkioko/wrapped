// Vercel Serverless Function for Playlist Wrapped
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

// Import utilities and routes
const SpotifyAPI = require('../backend/utils/spotify');
const playlistRoutes = require('../backend/routes/playlist');

const app = express();

// Cache file paths - prioritize api cache for Vercel
const API_CACHE = path.join(__dirname, 'cache', 'playlist-data.json');
const RUNTIME_CACHE = '/tmp/playlist-data.json';
const BACKEND_CACHE = path.join(__dirname, '..', 'backend', 'cache', 'playlist-data.json');

// Ensure cache directory exists
const cacheDir = path.dirname(API_CACHE);
if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
    console.log('Created cache directory:', cacheDir);
}

// Admin password
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Utility functions for cache
function readCache() {
    try {
        // Try api cache first (most persistent in Vercel)
        if (fs.existsSync(API_CACHE)) {
            const data = fs.readFileSync(API_CACHE, 'utf8');
            console.log('✅ Using api cache data from:', API_CACHE);
            return JSON.parse(data);
        }
        
        // Try runtime cache next
        if (fs.existsSync(RUNTIME_CACHE)) {
            const data = fs.readFileSync(RUNTIME_CACHE, 'utf8');
            console.log('✅ Using runtime cache data from:', RUNTIME_CACHE);
            return JSON.parse(data);
        }
        
        // Try backend cache as fallback
        if (fs.existsSync(BACKEND_CACHE)) {
            const data = fs.readFileSync(BACKEND_CACHE, 'utf8');
            console.log('✅ Using backend cache data from:', BACKEND_CACHE);
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('❌ Error reading cache:', error);
    }
    console.log('❌ No cache data found in any location');
    return { data: null, lastUpdated: null };
}

function writeCache(data) {
    try {
        const cacheData = {
            data: data,
            lastUpdated: new Date().toISOString()
        };
        
        const cacheString = JSON.stringify(cacheData, null, 2);
        
        // Primary: Write to api cache (most persistent)
        try {
            fs.writeFileSync(API_CACHE, cacheString);
            console.log(`✅ Primary cache written to: ${API_CACHE}`);
        } catch (error) {
            console.error(`❌ Failed to write primary cache:`, error);
        }
        
        // Secondary: Write to runtime cache for this session
        try {
            const runtimeDir = path.dirname(RUNTIME_CACHE);
            if (!fs.existsSync(runtimeDir)) {
                fs.mkdirSync(runtimeDir, { recursive: true });
            }
            fs.writeFileSync(RUNTIME_CACHE, cacheString);
            console.log(`✅ Runtime cache written to: ${RUNTIME_CACHE}`);
        } catch (error) {
            console.error(`❌ Failed to write runtime cache:`, error);
        }
        
        // Tertiary: Try backend cache if possible
        try {
            const backendDir = path.dirname(BACKEND_CACHE);
            if (!fs.existsSync(backendDir)) {
                fs.mkdirSync(backendDir, { recursive: true });
            }
            fs.writeFileSync(BACKEND_CACHE, cacheString);
            console.log(`✅ Backend cache written to: ${BACKEND_CACHE}`);
        } catch (error) {
            console.error(`❌ Failed to write backend cache:`, error);
        }
        
        console.log(`📝 Cache update completed at: ${cacheData.lastUpdated}`);
        
    } catch (error) {
        console.error('❌ Error writing cache:', error);
    }
}

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Public data endpoint
app.get('/api/public/data', (req, res) => {
    console.log('📊 Public data endpoint called');
    const cache = readCache();
    console.log('📊 Cache read result:', { 
        hasData: !!cache.data, 
        lastUpdated: cache.lastUpdated,
        dataKeys: cache.data ? Object.keys(cache.data) : [],
        playlistName: cache.data?.playlist?.name || 'No playlist found'
    });
    
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

// Public status endpoint
app.get('/api/public/status', (req, res) => {
    console.log('📊 Public status endpoint called');
    const cache = readCache();
    console.log('📊 Cache data:', { hasData: !!cache.data, lastUpdated: cache.lastUpdated });
    
    res.json({
        hasData: !!cache.data,
        lastUpdated: cache.lastUpdated,
        tracksCount: cache.data?.playlist?.totalTracks || 0,
        playlistName: cache.data?.playlist?.name || null
    });
});

// Admin status endpoint
app.get('/api/admin/status', (req, res) => {
    const cache = readCache();
    
    // Check all cache locations for debugging
    const cacheLocations = [
        { name: 'API Cache', path: API_CACHE, exists: fs.existsSync(API_CACHE) },
        { name: 'Runtime Cache', path: RUNTIME_CACHE, exists: fs.existsSync(RUNTIME_CACHE) },
        { name: 'Backend Cache', path: BACKEND_CACHE, exists: fs.existsSync(BACKEND_CACHE) }
    ];
    
    res.json({
        hasData: !!cache.data,
        lastUpdated: cache.lastUpdated,
        tracksCount: cache.data?.playlist?.totalTracks || 0,
        environment: process.env.NODE_ENV || 'production',
        cacheLocations: cacheLocations,
        scheduler: {
            isRunning: false, // Vercel doesn't support persistent scheduling
            nextUpdate: '9 AM EAT daily (manual trigger required on Vercel)'
        }
    });
});

// Cache verification endpoint for debugging
app.get('/api/admin/cache-debug', (req, res) => {
    const cacheLocations = [
        { name: 'API Cache', path: API_CACHE, exists: fs.existsSync(API_CACHE) },
        { name: 'Runtime Cache', path: RUNTIME_CACHE, exists: fs.existsSync(RUNTIME_CACHE) },
        { name: 'Backend Cache', path: BACKEND_CACHE, exists: fs.existsSync(BACKEND_CACHE) }
    ];
    
    const cacheData = readCache();
    
    res.json({
        timestamp: new Date().toISOString(),
        cacheLocations: cacheLocations,
        hasData: !!cacheData.data,
        lastUpdated: cacheData.lastUpdated,
        dataPreview: cacheData.data ? {
            playlistName: cacheData.data.playlist?.name,
            trackCount: cacheData.data.playlist?.totalTracks,
            hasContributors: !!cacheData.data.topContributors
        } : null
    });
});

// Manual trigger endpoint for Vercel
app.post('/api/admin/trigger-update', async (req, res) => {
    const { password } = req.body;
    
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid admin password' });
    }
    
    try {
        console.log('🔄 Admin triggered manual update...');
        
        const spotify = new SpotifyAPI();
        const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
        
        if (!refreshToken) {
            throw new Error('No refresh token found in environment variables');
        }

        // Get fresh access token using refresh token
        const tokenData = await spotify.refreshAccessToken(refreshToken);
        const accessToken = tokenData.access_token;
        
        const playlistId = process.env.DEFAULT_PLAYLIST_ID || '1BZY7mhShLhc2fIlI6uIa4';
        
        // Get playlist details
        const playlist = await spotify.getPlaylist(playlistId, accessToken);
        
        // Get all tracks
        const tracks = await spotify.getPlaylistTracks(playlistId, accessToken);
        const validTracks = tracks.filter(item => item.track && item.track.id);
        
        // Extract track IDs for audio features
        const trackIds = validTracks.map(item => item.track.id);
        
        // Get audio features
        let audioFeatures = [];
        try {
            audioFeatures = await spotify.getAudioFeatures(trackIds, accessToken);
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
        
        const artists = await spotify.getArtists(artistIds, accessToken);
        
        // Generate insights using the playlist route functions
        const { generateInsights } = require('../backend/routes/playlist');
        const insights = generateInsights(playlist, validTracks, audioFeatures, artists);
        
        // Get contributor counts and resolve display names (like in backend server.js)
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
                            const profile = await spotify.getUserProfile(userId, accessToken);
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
                const profile = await spotify.getUserProfile(userId, accessToken);
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
        
        const { generateAdvancedContributorAnalytics, calculateGenreMaestros, generatePlaylistMembers } = require('../backend/routes/playlist');
        
        const contributorAnalytics = generateAdvancedContributorAnalytics(validTracks, audioFeatures, artists, allUserProfiles);
        insights.contributors = contributorAnalytics;
        
        const genreMaestros = calculateGenreMaestros(validTracks, artists, allUserProfiles);
        insights.genreMaestros = genreMaestros;
        
        const followerCount = playlist.followers?.total || 0;
        const playlistMembers = generatePlaylistMembers(validTracks, allUserProfiles, followerCount);
        insights.playlistMembers = playlistMembers;
        
        console.log(`✅ Complete data generated: ${validTracks.length} tracks, ${topContributors.length} contributors, ${genreMaestros.length} genre maestros`);
        
        // Cache the data
        writeCache(insights);
        
        res.json({
            success: true,
            message: 'Playlist data updated successfully using refresh token',
            lastUpdated: new Date().toISOString(),
            tracksCount: validTracks.length
        });
        
    } catch (error) {
        console.error('❌ Auto-update failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to trigger update',
            message: error.message 
        });
    }
});

// Admin refresh endpoint
app.post('/api/admin/refresh', async (req, res) => {
    const { password, accessToken } = req.body;
    
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({
            success: false,
            error: 'Invalid admin password'
        });
    }
    
    try {
        const spotify = new SpotifyAPI();
        const playlistId = process.env.DEFAULT_PLAYLIST_ID || '1BZY7mhShLhc2fIlI6uIa4';
        
        // Use provided access token or try to get a new one
        let token = accessToken;
        if (!token) {
            // For admin refresh, we need a token - this should be provided
            return res.status(400).json({
                success: false,
                error: 'Access token required for data refresh'
            });
        }
        
        const data = await spotify.getPlaylistAnalysis(playlistId, token);
        writeCache(data);
        
        res.json({
            success: true,
            message: 'Data refreshed successfully',
            data: data,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Admin refresh error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Mount playlist routes
app.use('/api/playlist', playlistRoutes);

// Catch all route for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Export for Vercel
module.exports = app;
