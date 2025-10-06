// Test complete Spotify fetch and database upload
require('dotenv').config();

async function testCompleteFlow() {
    console.log('🎵 Testing Complete Spotify → Database Flow\n');
    
    try {
        // 1. Initialize Prisma
        console.log('🔄 Step 1: Setting up Prisma...');
        const { PrismaClient } = require('./generated/prisma/edge');
        const { withAccelerate } = require('@prisma/extension-accelerate');
        
        const prisma = new PrismaClient().$extends(withAccelerate());
        console.log('✅ Prisma client ready');
        
        // 2. Initialize Spotify API
        console.log('🔄 Step 2: Setting up Spotify API...');
        const SpotifyAPI = require('./backend/utils/spotify');
        const spotify = new SpotifyAPI();
        console.log('✅ Spotify API ready');
        
        // 3. Get fresh access token
        console.log('🔄 Step 3: Getting fresh access token...');
        const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
        const tokenData = await spotify.refreshAccessToken(refreshToken);
        const accessToken = tokenData.access_token;
        console.log('✅ Access token obtained:', accessToken.substring(0, 20) + '...');
        
        // 4. Fetch playlist data
        console.log('🔄 Step 4: Fetching playlist data...');
        const playlistId = process.env.DEFAULT_PLAYLIST_ID;
        console.log('Playlist ID:', playlistId);
        
        const playlist = await spotify.getPlaylist(playlistId, accessToken);
        console.log('✅ Playlist fetched:', playlist.name);
        console.log('- Owner:', playlist.owner.display_name);
        console.log('- Total tracks:', playlist.tracks.total);
        console.log('- Followers:', playlist.followers.total);
        
        // 5. Fetch tracks
        console.log('🔄 Step 5: Fetching all tracks...');
        const tracks = await spotify.getPlaylistTracks(playlistId, accessToken);
        const validTracks = tracks.filter(item => item.track && item.track.id);
        console.log('✅ Tracks fetched:', validTracks.length, 'valid tracks');
        
        // 6. Get track IDs for audio features
        console.log('🔄 Step 6: Fetching audio features...');
        const trackIds = validTracks.map(item => item.track.id);
        
        let audioFeatures = [];
        try {
            audioFeatures = await spotify.getAudioFeatures(trackIds, accessToken);
            console.log('✅ Audio features fetched:', audioFeatures.length);
        } catch (audioError) {
            console.warn('⚠️ Audio features failed, continuing without them:', audioError.message);
            audioFeatures = trackIds.map(() => null);
        }
        
        // 7. Get unique artists
        console.log('🔄 Step 7: Fetching artist data...');
        const artistIds = [...new Set(
            validTracks.flatMap(item => 
                item.track.artists.map(artist => artist.id)
            )
        )];
        
        const artists = await spotify.getArtists(artistIds, accessToken);
        console.log('✅ Artists fetched:', artists.length);
        
        // 8. Generate insights
        console.log('🔄 Step 8: Generating insights...');
        const { generateInsights } = require('./backend/routes/playlist');
        const insights = generateInsights(playlist, validTracks, audioFeatures, artists);
        
        console.log('✅ Insights generated:');
        console.log('- Top artist:', insights.topArtists[0]?.name);
        console.log('- Top genre:', insights.topGenres[0]?.genre);
        console.log('- Most popular track:', insights.mostPopular?.name);
        console.log('- Date range:', insights.dateRange?.earliest, 'to', insights.dateRange?.latest);
        
        // 9. Generate contributor data
        console.log('🔄 Step 9: Processing contributors...');
        
        const contributorCounts = {};
        validTracks.forEach(item => {
            const addedBy = item.added_by?.id || 'unknown';
            contributorCounts[addedBy] = (contributorCounts[addedBy] || 0) + 1;
        });
        
        // Get top 5 contributors with display names
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
        console.log('✅ Top contributor:', topContributors[0]?.displayName, '(', topContributors[0]?.count, 'tracks)');
        
        // 10. Save to database
        console.log('🔄 Step 10: Saving to database...');
        
        const savedData = await prisma.playlistData.upsert({
            where: { playlistId: playlistId },
            update: {
                data: insights,
                lastUpdated: new Date()
            },
            create: {
                playlistId: playlistId,
                data: insights,
                lastUpdated: new Date()
            }
        });
        
        console.log('✅ Data saved to database! Record ID:', savedData.id);
        
        // 11. Log the update
        console.log('🔄 Step 11: Logging update...');
        
        await prisma.updateLog.create({
            data: {
                playlistId: playlistId,
                status: 'success',
                message: `Manual test update: ${validTracks.length} tracks processed`,
                tracksCount: validTracks.length,
                triggeredBy: 'Manual Test'
            }
        });
        
        console.log('✅ Update logged successfully');
        
        // 12. Verify data can be read back
        console.log('🔄 Step 12: Verifying data...');
        
        const readBack = await prisma.playlistData.findUnique({
            where: { playlistId: playlistId }
        });
        
        console.log('✅ Data verification successful:');
        console.log('- Playlist name:', readBack.data.playlist.name);
        console.log('- Tracks count:', readBack.data.playlist.totalTracks);
        console.log('- Last updated:', readBack.lastUpdated);
        
        await prisma.$disconnect();
        
        console.log('\n🎉 COMPLETE SUCCESS! 🎉');
        console.log('✅ Spotify data fetched successfully');
        console.log('✅ Database upload successful');
        console.log('✅ Data verification successful');
        console.log('\n🌍 This data is now available to ALL USERS globally! 🌍');
        
        console.log('\n📊 Summary:');
        console.log(`- Processed: ${validTracks.length} tracks`);
        console.log(`- Artists: ${artists.length} unique artists`);
        console.log(`- Contributors: ${topContributors.length} top contributors`);
        console.log(`- Saved to database: ${savedData.id}`);
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Full error:', error);
    }
    
    process.exit();
}

testCompleteFlow();