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

// Cache file paths - multiple locations for redundancy
const RUNTIME_CACHE = '/tmp/playlist-data.json';
const API_CACHE = path.join(__dirname, 'cache', 'playlist-data.json');
const BACKEND_CACHE = path.join(__dirname, '..', 'backend', 'cache', 'playlist-data.json');

// Ensure all cache directories exist
[RUNTIME_CACHE, API_CACHE, BACKEND_CACHE].forEach(cacheFile => {
    const cacheDir = path.dirname(cacheFile);
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }
});

// Admin password
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Utility functions for cache
function readCache() {
    try {
        // Try runtime cache first (fastest)
        if (fs.existsSync(RUNTIME_CACHE)) {
            const data = fs.readFileSync(RUNTIME_CACHE, 'utf8');
            console.log('Using runtime cache data');
            return JSON.parse(data);
        }
        
        // Try backend cache next
        if (fs.existsSync(BACKEND_CACHE)) {
            const data = fs.readFileSync(BACKEND_CACHE, 'utf8');
            console.log('Using backend cache data');
            return JSON.parse(data);
        }
        
        // Fallback to api cache
        if (fs.existsSync(API_CACHE)) {
            const data = fs.readFileSync(API_CACHE, 'utf8');
            console.log('Using api cache data');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading cache:', error);
    }
    console.log('No cache data found');
    return { data: null, lastUpdated: null };
}

function writeCache(data) {
    try {
        const cacheData = {
            data: data,
            lastUpdated: new Date().toISOString()
        };
        
        // Write to all cache locations for redundancy
        const locations = [
            { path: RUNTIME_CACHE, name: 'runtime' },
            { path: API_CACHE, name: 'api' },
            { path: BACKEND_CACHE, name: 'backend' }
        ];
        
        let successCount = 0;
        locations.forEach(location => {
            try {
                fs.writeFileSync(location.path, JSON.stringify(cacheData, null, 2));
                console.log(`✅ Cache written to ${location.name}: ${location.path}`);
                successCount++;
            } catch (error) {
                console.error(`❌ Failed to write cache to ${location.name}:`, error.message);
            }
        });
        
        console.log(`Cache update complete: ${successCount}/${locations.length} locations updated`);
        
    } catch (error) {
        console.error('Error writing cache:', error);
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
    console.log('Public data endpoint called');
    const cache = readCache();
    console.log('Cache read result:', { hasData: !!cache.data, lastUpdated: cache.lastUpdated });
    
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
    
    res.json({
        hasData: !!cache.data,
        lastUpdated: cache.lastUpdated,
        tracksCount: cache.data?.playlist?.totalTracks || 0,
        environment: process.env.NODE_ENV || 'production',
        scheduler: {
            isRunning: false, // Vercel doesn't support persistent scheduling
            nextUpdate: '9 AM EAT daily (manual trigger required on Vercel)'
        }
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
