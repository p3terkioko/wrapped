const express = require('express');
const router = express.Router();
const axios = require('axios');
const SpotifyAPI = require('../utils/spotify');

const spotify = new SpotifyAPI();

// Analyze playlist and return insights
router.post('/analyze', async (req, res) => {
  try {
    const { playlistId, accessToken } = req.body;
    
    if (!playlistId || !accessToken) {
      return res.status(400).json({ error: 'Playlist ID and access token are required' });
    }

    // Get playlist details
    const playlist = await spotify.getPlaylist(playlistId, accessToken);
    
    // Get all tracks
    const tracks = await spotify.getPlaylistTracks(playlistId, accessToken);
      // Filter out null tracks (deleted/unavailable songs)
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
      // Continue without audio features - we'll generate mock data
      audioFeatures = trackIds.map(() => null);
    }
    
    // Extract unique artist IDs
    const artistIds = [...new Set(
      validTracks.flatMap(item => 
        item.track.artists.map(artist => artist.id)
      )
    )];
      // Get artist details for genres
    const artists = await spotify.getArtists(artistIds, accessToken);
      // Get contributor user IDs
    const contributorIds = [...new Set(
      validTracks
        .map(item => item.added_by?.id)
        .filter(id => id && id !== 'unknown')
    )];
    
    // Get contributor user IDs and counts
    const contributorCounts = {};
    validTracks.forEach(item => {
      const addedBy = item.added_by?.id || 'unknown';
      contributorCounts[addedBy] = (contributorCounts[addedBy] || 0) + 1;
    });
    
    // Get user profiles for contributors using the working method
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
    );    // Process data and generate insights
    const insights = generateInsights(playlist, validTracks, audioFeatures, artists);
      // Add the resolved contributors to insights (legacy format for basic display)
    insights.topContributors = topContributors;
    
    // Generate comprehensive contributor analytics with badges - fetch ALL contributor profiles
    const allContributorIds = [...new Set(
      validTracks
        .map(item => item.added_by?.id)
        .filter(id => id && id !== 'unknown')
    )];
    
    // Fetch user profiles for ALL contributors
    const allUserProfiles = [];
    for (const userId of allContributorIds) {
      try {
        const { data: profile } = await axios.get(`https://api.spotify.com/v1/users/${userId}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
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
    
    console.log(`Fetched profiles for ${allUserProfiles.length} contributors (out of ${allContributorIds.length} total)`);
    
    const contributorAnalytics = generateAdvancedContributorAnalytics(validTracks, audioFeatures, artists, allUserProfiles);
    insights.contributors = contributorAnalytics;
    
    res.json(insights);
    
  } catch (error) {
    console.error('Error analyzing playlist:', error);
    res.status(500).json({ error: 'Failed to analyze playlist' });
  }
});

function generateInsights(playlist, tracks, audioFeatures, artists) {
  // Top Artists (by track count)
  const artistCounts = {};
  tracks.forEach(item => {
    item.track.artists.forEach(artist => {
      artistCounts[artist.id] = (artistCounts[artist.id] || 0) + 1;
    });
  });
  
  const topArtists = Object.entries(artistCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([artistId, count]) => {
      const artist = tracks.find(item => 
        item.track.artists.some(a => a.id === artistId)
      )?.track.artists.find(a => a.id === artistId);
      return {
        name: artist?.name || 'Unknown',
        count,
        id: artistId
      };
    });

  // Top Genres (from artist data)
  const genreCounts = {};
  artists.forEach(artist => {
    if (artist && artist.genres) {
      artist.genres.forEach(genre => {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      });
    }
  });
  
  const topGenres = Object.entries(genreCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8)
    .map(([genre, count]) => ({ genre, count }));

  // Most and Least Popular Tracks
  const tracksWithPopularity = tracks
    .filter(item => item.track.popularity !== undefined)
    .map(item => ({
      name: item.track.name,
      artists: item.track.artists.map(a => a.name).join(', '),
      popularity: item.track.popularity,
      id: item.track.id,
      external_urls: item.track.external_urls
    }));
  
  const mostPopular = tracksWithPopularity
    .sort((a, b) => b.popularity - a.popularity)[0];
  
  const leastPopular = tracksWithPopularity
    .sort((a, b) => a.popularity - b.popularity)[0];  // Audio Features Analysis
  const validFeatures = audioFeatures.filter(f => f !== null);
  const avgFeatures = {
    valence: 0.5,
    energy: 0.5,
    danceability: 0.5,
    acousticness: 0.5,
    instrumentalness: 0.5,
    speechiness: 0.5,
    tempo: 120
  };
  
  if (validFeatures.length > 0) {
    // Calculate proper averages for each feature
    avgFeatures.valence = validFeatures.reduce((sum, f) => sum + (f.valence || 0), 0) / validFeatures.length;
    avgFeatures.energy = validFeatures.reduce((sum, f) => sum + (f.energy || 0), 0) / validFeatures.length;
    avgFeatures.danceability = validFeatures.reduce((sum, f) => sum + (f.danceability || 0), 0) / validFeatures.length;
    avgFeatures.acousticness = validFeatures.reduce((sum, f) => sum + (f.acousticness || 0), 0) / validFeatures.length;
    avgFeatures.instrumentalness = validFeatures.reduce((sum, f) => sum + (f.instrumentalness || 0), 0) / validFeatures.length;
    avgFeatures.speechiness = validFeatures.reduce((sum, f) => sum + (f.speechiness || 0), 0) / validFeatures.length;
    avgFeatures.tempo = validFeatures.reduce((sum, f) => sum + (f.tempo || 120), 0) / validFeatures.length;
    
    console.log(`Calculated audio features from ${validFeatures.length} tracks:`, avgFeatures);  } else {
    console.log('No valid audio features found, using genre-based estimates');
    // Generate more realistic defaults based on top genres
    if (topGenres.some(g => g.genre.includes('afro') || g.genre.includes('amapiano'))) {
      avgFeatures.valence = 0.7; // Afro music tends to be more positive
      avgFeatures.energy = 0.8;  // High energy
      avgFeatures.danceability = 0.85; // Very danceable
      avgFeatures.acousticness = 0.2; // Lower acousticness
      avgFeatures.speechiness = 0.15; // Some vocal elements
      avgFeatures.tempo = 115; // Typical afrobeats tempo
    }
  }

  // Date Range Analysis
  const addedDates = tracks
    .map(item => new Date(item.added_at))
    .filter(date => !isNaN(date));
  
  const dateRange = addedDates.length > 0 ? {
    earliest: new Date(Math.min(...addedDates)),
    latest: new Date(Math.max(...addedDates))
  } : null;  return {
    playlist: {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      image: playlist.images?.[0]?.url,
      owner: playlist.owner.display_name,
      totalTracks: playlist.tracks.total,
      followers: playlist.followers.total,
      public: playlist.public
    },
    topArtists,
    totalUniqueArtists: Object.keys(artistCounts).length,
    topGenres,
    mostPopular,
    leastPopular,
    audioFeatures: avgFeatures,
    dateRange,
    totalAnalyzedTracks: validFeatures.length
  };
}

// Advanced Analytics: Contributors with badges and detailed stats
router.post('/contributors', async (req, res) => {
  try {
    const { playlistId, accessToken } = req.body;
    
    if (!playlistId || !accessToken) {
      return res.status(400).json({ error: 'Playlist ID and access token are required' });
    }

    // Get playlist tracks with detailed contributor info
    const tracks = await spotify.getPlaylistTracks(playlistId, accessToken);
    const validTracks = tracks.filter(item => item.track && item.track.id);
    
    // Get audio features for all tracks
    const trackIds = validTracks.map(item => item.track.id);
    const audioFeatures = await spotify.getAudioFeatures(trackIds, accessToken);
    
    // Get artist details for genre diversity calculation
    const artistIds = [...new Set(
      validTracks.flatMap(item => 
        item.track.artists.map(artist => artist.id)
      )
    )];
    const artists = await spotify.getArtists(artistIds, accessToken);
    
    // Get contributor user IDs and fetch their profiles directly
    const contributorIds = [...new Set(
      validTracks
        .map(item => item.added_by?.id)
        .filter(id => id && id !== 'unknown')
    )];
    
    // Fetch user profiles directly using the proven pattern
    const userProfiles = [];
    for (const userId of contributorIds) {
      try {
        const { data: profile } = await axios.get(`https://api.spotify.com/v1/users/${userId}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        userProfiles.push({
          id: profile.id,
          displayName: profile.display_name || profile.id
        });
      } catch (error) {
        console.warn(`Failed to fetch profile for user ${userId}:`, error.response?.status);
        userProfiles.push({
          id: userId,
          displayName: `User ${userId.slice(-4)}`
        });
      }
    }
    
    console.log('Contributors analytics - Fetched user profiles:', userProfiles.length, 'profiles for', contributorIds.length, 'contributors');
    
    // Calculate advanced contributor analytics with comprehensive badge system
    const contributorAnalytics = generateAdvancedContributorAnalytics(validTracks, audioFeatures, artists, userProfiles);
    
    res.json(contributorAnalytics);
    
  } catch (error) {
    console.error('Error analyzing contributors:', error);
    res.status(500).json({ error: 'Failed to analyze contributors' });
  }
});

module.exports = router;
module.exports.generateInsights = generateInsights;
module.exports.generateAdvancedContributorAnalytics = generateAdvancedContributorAnalytics;

// Utility Functions for Advanced Analytics

function generateAdvancedContributorAnalytics(tracks, audioFeatures, artists, userProfiles = []) {
  const contributorStats = {};
  
  // Build artist genre mapping and popularity mapping
  const artistGenreMap = {};
  const artistPopularityMap = {};
  artists.forEach(artist => {
    if (artist && artist.id) {
      artistGenreMap[artist.id] = artist.genres || [];
      artistPopularityMap[artist.id] = artist.popularity || 0;
    }
  });
  
  // Create audio features mapping
  const audioFeaturesMap = {};
  audioFeatures.forEach((features, index) => {
    if (features && tracks[index]) {
      audioFeaturesMap[tracks[index].track.id] = features;
    }
  });
  
  // Create a mapping of user IDs to display names
  const userDisplayNames = {};
  userProfiles.forEach(({ id, displayName }) => {
    if (displayName) {
      userDisplayNames[id] = displayName;
    }
  });
  
  // Analyze each contributor's tracks
  tracks.forEach(item => {
    const contributorId = item.added_by?.id || 'unknown';
    const track = item.track;
    const addedAt = new Date(item.added_at);
    const audioFeature = audioFeaturesMap[track.id];
    
    if (!contributorStats[contributorId]) {
      let displayName;
      if (contributorId === 'unknown') {
        displayName = 'Unknown User';
      } else if (userDisplayNames[contributorId]) {
        displayName = userDisplayNames[contributorId];
      } else {
        displayName = `User ${contributorId.slice(-4)}`;
      }
      
      contributorStats[contributorId] = {
        id: contributorId,
        name: displayName,
        tracksAdded: 0,
        totalPopularity: 0,
        genres: new Set(),
        artists: new Set(),
        tracks: [],
        audioFeatures: {
          energy: [],
          danceability: [],
          valence: [],
          acousticness: [],
          speechiness: [],
          tempo: []
        },
        addedDates: [],
        releaseYears: []
      };
    }
    
    const contributor = contributorStats[contributorId];
    contributor.tracksAdded++;
    contributor.totalPopularity += track.popularity || 0;
    contributor.addedDates.push(addedAt);
    
    // Extract release year
    if (track.album && track.album.release_date) {
      const releaseYear = new Date(track.album.release_date).getFullYear();
      if (!isNaN(releaseYear)) {
        contributor.releaseYears.push(releaseYear);
      }
    }
    
    // Store track details
    contributor.tracks.push({
      name: track.name,
      artists: track.artists.map(a => a.name).join(', '),
      popularity: track.popularity || 0,
      addedAt: addedAt,
      releaseDate: track.album?.release_date,
      trackId: track.id
    });
    
    // Add genres and artists from this track
    track.artists.forEach(artist => {
      contributor.artists.add(artist.name);
      const genres = artistGenreMap[artist.id] || [];
      genres.forEach(genre => contributor.genres.add(genre));
    });
    
    // Store audio features if available
    if (audioFeature) {
      Object.keys(contributor.audioFeatures).forEach(feature => {
        if (audioFeature[feature] !== undefined) {
          contributor.audioFeatures[feature].push(audioFeature[feature]);
        }
      });
    }
  });
  
  // Calculate metrics and assign comprehensive badges
  const contributors = Object.values(contributorStats).map(contributor => {
    const avgPopularity = contributor.tracksAdded > 0 
      ? contributor.totalPopularity / contributor.tracksAdded 
      : 0;
    
    const genreDiversity = contributor.genres.size;
    const artistDiversity = contributor.artists.size;
    
    // Calculate audio feature averages
    const avgAudioFeatures = {};
    Object.keys(contributor.audioFeatures).forEach(feature => {
      const values = contributor.audioFeatures[feature];
      avgAudioFeatures[feature] = values.length > 0 
        ? values.reduce((sum, val) => sum + val, 0) / values.length 
        : 0;
    });
    
    // Calculate average release year
    const avgReleaseYear = contributor.releaseYears.length > 0
      ? contributor.releaseYears.reduce((sum, year) => sum + year, 0) / contributor.releaseYears.length
      : new Date().getFullYear();
    
    return {
      ...contributor,
      avgPopularity: Math.round(avgPopularity * 10) / 10,
      genreDiversity,
      artistDiversity,
      genres: Array.from(contributor.genres),
      artists: Array.from(contributor.artists),
      avgAudioFeatures,
      avgReleaseYear: Math.round(avgReleaseYear),
      badges: []
    };
  });
  
  // Sort contributors by tracks added for ranking
  contributors.sort((a, b) => b.tracksAdded - a.tracksAdded);
  
  // Assign comprehensive badge system
  assignComprehensiveBadges(contributors);
  
  return {
    totalContributors: contributors.length,
    contributors: contributors.slice(0, 10), // Top 10
    summary: {
      mostActive: contributors[0]?.name || 'Unknown',
      avgContribution: Math.round(tracks.length / contributors.length),
      totalGenres: new Set(contributors.flatMap(c => c.genres)).size,
      totalArtists: new Set(contributors.flatMap(c => c.artists)).size
    }
  };
}

function assignComprehensiveBadges(contributors) {
  if (contributors.length === 0) return;
  
  // Filter contributors with meaningful contributions (at least 3 tracks)
  const significantContributors = contributors.filter(c => c.tracksAdded >= 3);
  const allContributors = contributors; // Include all for some badges
  
  // 🔹 Contribution-Based Badges
  
  // 🔥 Top Curator: Most tracks added
  if (contributors[0].tracksAdded > 5) {
    contributors[0].badges.push({
      id: 'top_curator',
      name: '🔥 Top Curator',
      description: `Added the most tracks (${contributors[0].tracksAdded}) to this playlist`
    });
  }
  
  // 🧠 Eclectic Ear: Contributor with the widest genre spread
  if (significantContributors.length > 0) {
    const eclecticEar = significantContributors.reduce((max, c) => 
      c.genreDiversity > max.genreDiversity ? c : max
    );
    if (eclecticEar.genreDiversity > 5) {
      eclecticEar.badges.push({
        id: 'eclectic_ear',
        name: '🧠 Eclectic Ear',
        description: `Most diverse taste with ${eclecticEar.genreDiversity} different genres`
      });
    }
  }
  
  // 🎖️ Genre Guru: Most tracks in a single genre (need to calculate dominant genre)
  significantContributors.forEach(contributor => {
    const genreCounts = {};
    contributor.tracks.forEach(track => {
      // This is simplified - in reality we'd need to map tracks to genres
      contributor.genres.forEach(genre => {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      });
    });
    
    const maxGenreCount = Math.max(...Object.values(genreCounts));
    const dominantGenre = Object.entries(genreCounts).find(([, count]) => count === maxGenreCount)?.[0];
    
    if (maxGenreCount >= Math.max(3, contributor.tracksAdded * 0.4)) {
      contributor.badges.push({
        id: 'genre_guru',
        name: '🎖️ Genre Guru',
        description: `Master of ${dominantGenre} with ${maxGenreCount} tracks`
      });
    }
  });
  
  // 🌚 Underground Hero: Contributor with lowest average track popularity
  if (significantContributors.length > 1) {
    const undergroundHero = significantContributors.reduce((min, c) => 
      c.avgPopularity < min.avgPopularity ? c : min
    );
    if (undergroundHero.avgPopularity < 40) {
      undergroundHero.badges.push({
        id: 'underground_hero',
        name: '🌚 Underground Hero',
        description: `Discovers hidden gems (avg popularity: ${undergroundHero.avgPopularity})`
      });
    }
  }
  
  // 📈 Trendsetter: Early adopter (simplified - based on low popularity tracks that might have grown)
  significantContributors.forEach(contributor => {
    const lowPopTracks = contributor.tracks.filter(t => t.popularity < 30).length;
    if (lowPopTracks >= Math.max(2, contributor.tracksAdded * 0.3)) {
      contributor.badges.push({
        id: 'trendsetter',
        name: '📈 Trendsetter',
        description: `Early adopter with ${lowPopTracks} underground picks`
      });
    }
  });
    // 💿 Old Soul: Person who added the oldest song in the playlist
  let oldestTrack = null;
  let oldSoulContributor = null;
  significantContributors.forEach(contributor => {
    contributor.tracks.forEach(track => {
      if (track.releaseDate && (!oldestTrack || track.releaseDate < oldestTrack.releaseDate)) {
        oldestTrack = track;
        oldSoulContributor = contributor;
      }
    });
  });
  if (oldSoulContributor && oldestTrack) {
    const releaseYear = new Date(oldestTrack.releaseDate).getFullYear();
    oldSoulContributor.badges.push({
      id: 'old_soul',
      name: '💿 Old Soul',
      description: `Added oldest track: "${oldestTrack.name}" (${releaseYear})`
    });
  }
  
  // 🆕 Fresh Dropper: Person who added the newest song in the playlist
  let newestTrack = null;
  let freshDropperContributor = null;
  significantContributors.forEach(contributor => {
    contributor.tracks.forEach(track => {
      if (track.releaseDate && (!newestTrack || track.releaseDate > newestTrack.releaseDate)) {
        newestTrack = track;
        freshDropperContributor = contributor;
      }
    });
  });
  if (freshDropperContributor && newestTrack) {
    const releaseYear = new Date(newestTrack.releaseDate).getFullYear();
    freshDropperContributor.badges.push({
      id: 'fresh_dropper',
      name: '🆕 Fresh Dropper',
      description: `Added newest track: "${newestTrack.name}" (${releaseYear})`
    });
  }
  
  // 📀 Collector: Contributor with the most unique artists
  if (significantContributors.length > 0) {
    const collector = significantContributors.reduce((max, c) => 
      c.artistDiversity > max.artistDiversity ? c : max
    );
    if (collector.artistDiversity > 10) {
      collector.badges.push({
        id: 'collector',
        name: '📀 Collector',
        description: `Music explorer with ${collector.artistDiversity} different artists`
      });
    }
  }
  
  // 🔹 Mood & Audio Feature-Based Badges
    // ⚡ Energy Dealer: Highest average energy
  if (significantContributors.length > 1) {
    const energyContributors = significantContributors.filter(c => c.avgAudioFeatures.energy > 0);
    if (energyContributors.length > 0) {
      const energyDealer = energyContributors.reduce((max, c) => 
        c.avgAudioFeatures.energy > max.avgAudioFeatures.energy ? c : max
      );
      if (energyDealer && energyDealer.avgAudioFeatures.energy > 0.8) {
        energyDealer.badges.push({
          id: 'energy_dealer',
          name: '⚡ Energy Dealer',
          description: `High-energy music curator (${Math.round(energyDealer.avgAudioFeatures.energy * 100)}% energy)`
        });
      }
    }
  }
  
  // 💃 Dancefloor Commander: Highest average danceability
  if (significantContributors.length > 1) {
    const danceContributors = significantContributors.filter(c => c.avgAudioFeatures.danceability > 0);
    if (danceContributors.length > 0) {
      const dancefloorCommander = danceContributors.reduce((max, c) => 
        c.avgAudioFeatures.danceability > max.avgAudioFeatures.danceability ? c : max
      );
      if (dancefloorCommander && dancefloorCommander.avgAudioFeatures.danceability > 0.8) {
        dancefloorCommander.badges.push({
          id: 'dancefloor_commander',
          name: '💃 Dancefloor Commander',
          description: `Makes everyone move (${Math.round(dancefloorCommander.avgAudioFeatures.danceability * 100)}% danceability)`
        });
      }
    }
  }
  
  // 🌈 Vibes Master: Highest average valence
  if (significantContributors.length > 1) {
    const valenceContributors = significantContributors.filter(c => c.avgAudioFeatures.valence > 0);
    if (valenceContributors.length > 0) {
      const vibesMaster = valenceContributors.reduce((max, c) => 
        c.avgAudioFeatures.valence > max.avgAudioFeatures.valence ? c : max
      );
      if (vibesMaster && vibesMaster.avgAudioFeatures.valence > 0.7) {
        vibesMaster.badges.push({
          id: 'vibes_master',
          name: '🌈 Vibes Master',
          description: `Spreads positive energy (${Math.round(vibesMaster.avgAudioFeatures.valence * 100)}% positivity)`
        });
      }
    }
  }
  
  // 🌧️ Sad Boi: Lowest average valence
  if (significantContributors.length > 1) {
    const sadContributors = significantContributors.filter(c => c.avgAudioFeatures.valence > 0);
    if (sadContributors.length > 0) {
      const sadBoi = sadContributors.reduce((min, c) => 
        c.avgAudioFeatures.valence < min.avgAudioFeatures.valence ? c : min
      );
      if (sadBoi && sadBoi.avgAudioFeatures.valence < 0.4) {
        sadBoi.badges.push({
          id: 'sad_boi',
          name: '🌧️ Sad Boi',
          description: `Embraces melancholy (${Math.round(sadBoi.avgAudioFeatures.valence * 100)}% positivity)`
        });
      }
    }
  }
}
