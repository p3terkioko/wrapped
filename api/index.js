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

// Cache file paths
const CACHE_FILE = '/tmp/playlist-data.json';
const FALLBACK_CACHE = path.join(__dirname, 'cache', 'playlist-data.json');

// Ensure cache directory exists
const cacheDir = path.dirname(CACHE_FILE);
if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
}

// Admin password
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Utility functions for cache
function readCache() {
    try {
        // Try /tmp first (runtime cache)
        if (fs.existsSync(CACHE_FILE)) {
            const data = fs.readFileSync(CACHE_FILE, 'utf8');
            console.log('Using runtime cache data');
            return JSON.parse(data);
        }
        
        // Fallback to local cache file
        if (fs.existsSync(FALLBACK_CACHE)) {
            const data = fs.readFileSync(FALLBACK_CACHE, 'utf8');
            console.log('Using fallback cache data');
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
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));
        console.log('Cache updated successfully');
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
