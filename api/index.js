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

// Import Prisma client with fallback
let prisma;
try {
  const { prisma: prismaClient } = require('../lib/prisma');
  prisma = prismaClient;
  console.log('✅ Prisma client loaded successfully');
} catch (error) {
  console.warn('⚠️ Prisma not available, using file cache fallback:', error.message);
  prisma = null;
}

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

// Database functions (Prisma)
async function readFromDatabase() {
    if (!prisma) return null;
    
    try {
        const data = await prisma.playlistData.findUnique({
            where: { playlistId: process.env.DEFAULT_PLAYLIST_ID || '1BZY7mhShLhc2fIlI6uIa4' }
        });
        
        if (data) {
            console.log('✅ Data loaded from database');
            return {
                data: data.data,
                lastUpdated: data.lastUpdated.toISOString()
            };
        }
        return { data: null, lastUpdated: null };
    } catch (error) {
        console.error('❌ Database read error:', error);
        return null;
    }
}

async function writeToDatabase(insights) {
    if (!prisma) return false;
    
    try {
        const saved = await prisma.playlistData.upsert({
            where: { playlistId: process.env.DEFAULT_PLAYLIST_ID || '1BZY7mhShLhc2fIlI6uIa4' },
            update: {
                data: insights,
                lastUpdated: new Date()
            },
            create: {
                playlistId: process.env.DEFAULT_PLAYLIST_ID || '1BZY7mhShLhc2fIlI6uIa4',
                data: insights,
                lastUpdated: new Date()
            }
        });
        
        console.log('✅ Data saved to database');
        return saved;
    } catch (error) {
        console.error('❌ Database write error:', error);
        return false;
    }
}

async function logUpdate(status, message, tracksCount = null, triggeredBy = null) {
    if (!prisma) return;
    
    try {
        await prisma.updateLog.create({
            data: {
                playlistId: process.env.DEFAULT_PLAYLIST_ID || '1BZY7mhShLhc2fIlI6uIa4',
                status,
                message,
                tracksCount,
                triggeredBy: triggeredBy || 'Unknown'
            }
        });
        console.log(`📝 Update logged: ${status} - ${message}`);
    } catch (error) {
        console.error('❌ Failed to log update:', error);
    }
}

// Utility functions for cache (fallback)
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
app.get('/api/public/data', async (req, res) => {
    console.log('📊 Public data endpoint called');
    
    let result = null;
    
    // Try database first
    if (prisma) {
        result = await readFromDatabase();
    }
    
    // Fallback to file cache
    if (!result) {
        const cache = readCache();
        result = cache;
        console.log('📊 Using file cache fallback');
    }
    
    console.log('📊 Data result:', { 
        hasData: !!result.data, 
        lastUpdated: result.lastUpdated,
        dataKeys: result.data ? Object.keys(result.data) : [],
        playlistName: result.data?.playlist?.name || 'No playlist found',
        source: prisma ? 'database' : 'file-cache'
    });
    
    if (result.data) {
        res.json({
            success: true,
            data: result.data,
            lastUpdated: result.lastUpdated
        });
    } else {
        res.status(404).json({
            success: false,
            error: 'No data available. Admin needs to fetch data first.'
        });
    }
});

// Public status endpoint
app.get('/api/public/status', async (req, res) => {
    console.log('📊 Public status endpoint called');
    
    let result = null;
    
    // Try database first
    if (prisma) {
        result = await readFromDatabase();
    }
    
    // Fallback to file cache
    if (!result) {
        const cache = readCache();
        result = cache;
    }
    
    console.log('📊 Status data:', { 
        hasData: !!result.data, 
        lastUpdated: result.lastUpdated,
        source: prisma ? 'database' : 'file-cache'
    });
    
    res.json({
        hasData: !!result.data,
        lastUpdated: result.lastUpdated,
        tracksCount: result.data?.playlist?.totalTracks || 0,
        playlistName: result.data?.playlist?.name || null,
        source: prisma ? 'database' : 'file-cache'
    });
});

// Admin status endpoint
app.get('/api/admin/status', async (req, res) => {
    let result = null;
    let recentLogs = [];
    
    // Try database first
    if (prisma) {
        try {
            result = await readFromDatabase();
            // Get recent update logs
            recentLogs = await prisma.updateLog.findMany({
                where: { playlistId: process.env.DEFAULT_PLAYLIST_ID || '1BZY7mhShLhc2fIlI6uIa4' },
                orderBy: { createdAt: 'desc' },
                take: 5
            });
        } catch (error) {
            console.error('Database query failed:', error);
        }
    }
    
    // Fallback to file cache
    if (!result) {
        const cache = readCache();
        result = cache;
    }
    
    // Check all cache locations for debugging
    const cacheLocations = [
        { name: 'API Cache', path: API_CACHE, exists: fs.existsSync(API_CACHE) },
        { name: 'Runtime Cache', path: RUNTIME_CACHE, exists: fs.existsSync(RUNTIME_CACHE) },
        { name: 'Backend Cache', path: BACKEND_CACHE, exists: fs.existsSync(BACKEND_CACHE) }
    ];
    
    res.json({
        hasData: !!result.data,
        lastUpdated: result.lastUpdated,
        tracksCount: result.data?.playlist?.totalTracks || 0,
        environment: process.env.NODE_ENV || 'production',
        database: prisma ? 'Connected to Prisma Database ✅' : 'Using File Cache ⚠️',
        storage: prisma ? 'database' : 'file-cache',
        recentLogs: recentLogs,
        cacheLocations: cacheLocations,
        scheduler: {
            isRunning: false, // Vercel doesn't support persistent scheduling
            nextUpdate: 'Manual trigger via admin panel (updates ALL users globally when using database)'
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
        
        // Save to database first (for global access)
        let savedToDatabase = false;
        if (prisma) {
            const dbResult = await writeToDatabase(insights);
            if (dbResult) {
                savedToDatabase = true;
                await logUpdate('success', `Updated successfully with ${validTracks.length} tracks`, validTracks.length, req.ip);
                console.log('🌍 Data saved to database - NOW AVAILABLE TO ALL USERS GLOBALLY! 🌍');
            }
        }
        
        // Fallback: Cache the data locally
        if (!savedToDatabase) {
            writeCache(insights);
            console.log('📝 Data saved to file cache as fallback');
        }
        
        const now = new Date().toISOString();
        
        res.json({
            success: true,
            message: savedToDatabase ? 
                'Playlist data updated successfully for ALL USERS globally! 🌍' : 
                'Playlist data updated successfully using refresh token',
            lastUpdated: now,
            tracksCount: validTracks.length,
            storage: savedToDatabase ? 'database' : 'file-cache',
            globalUpdate: savedToDatabase
        });
        
    } catch (error) {
        console.error('❌ Auto-update failed:', error);
        
        // Log the error to database if possible
        if (prisma) {
            await logUpdate('failed', `Update failed: ${error.message}`, 0, req.ip);
        }
        
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
