'use strict';

// ── Core insights ─────────────────────────────────────────────────────────────

function generateInsights(playlist, tracks, audioFeatures, artists) {
  // Top artists by track count
  const artistCounts = {};
  tracks.forEach(item => {
    item.track.artists.forEach(artist => {
      artistCounts[artist.id] = (artistCounts[artist.id] || 0) + 1;
    });
  });

  const topArtists = Object.entries(artistCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([artistId, count]) => {
      const artist = tracks
        .find(item => item.track.artists.some(a => a.id === artistId))
        ?.track.artists.find(a => a.id === artistId);
      return { name: artist?.name || 'Unknown', count, id: artistId };
    });

  // Top genres from artist data
  const genreCounts = {};
  artists.forEach(artist => {
    if (artist && artist.genres) {
      artist.genres.forEach(genre => {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      });
    }
  });

  const topGenres = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([genre, count]) => ({ genre, count }));

  // Most and least popular tracks
  const tracksWithPopularity = tracks
    .filter(item => item.track.popularity !== undefined)
    .map(item => ({
      name: item.track.name,
      artist: item.track.artists.map(a => a.name).join(', '),
      popularity: item.track.popularity,
      id: item.track.id,
      image: item.track.album?.images?.[0]?.url || null,
    }));

  const sorted = [...tracksWithPopularity].sort((a, b) => b.popularity - a.popularity);
  const mostPopular = sorted[0] || null;
  const leastPopular = sorted[sorted.length - 1] || null;

  // Audio feature averages
  const validFeatures = audioFeatures.filter(f => f !== null);
  const avgFeatures = { valence: 0.5, energy: 0.5, danceability: 0.5, acousticness: 0.5, instrumentalness: 0.5, speechiness: 0.5, tempo: 120 };

  if (validFeatures.length > 0) {
    ['valence', 'energy', 'danceability', 'acousticness', 'instrumentalness', 'speechiness', 'tempo'].forEach(f => {
      avgFeatures[f] = validFeatures.reduce((sum, item) => sum + (item[f] || 0), 0) / validFeatures.length;
    });
  }

  // Date range
  const addedDates = tracks.map(item => new Date(item.added_at)).filter(d => !isNaN(d));
  const dateRange = addedDates.length > 0
    ? { earliest: new Date(Math.min(...addedDates)), latest: new Date(Math.max(...addedDates)) }
    : null;

  // ── New insights ──────────────────────────────────────────────────────────────

  // Playlist runtime (ms → hours/minutes)
  const totalMs = tracks.reduce((sum, item) => sum + (item.track.duration_ms || 0), 0);
  const totalMin = Math.floor(totalMs / 60000);
  const runtime = {
    totalMs,
    hours:   Math.floor(totalMin / 60),
    minutes: totalMin % 60,
    display: Math.floor(totalMin / 60) + 'h ' + (totalMin % 60) + 'm',
  };

  // Decade breakdown
  const decadeCounts = {};
  tracks.forEach(item => {
    const rd = item.track.album?.release_date;
    if (!rd) return;
    const year = parseInt(rd.slice(0, 4), 10);
    if (isNaN(year)) return;
    const decade = Math.floor(year / 10) * 10;
    decadeCounts[decade] = (decadeCounts[decade] || 0) + 1;
  });
  const decades = Object.entries(decadeCounts)
    .map(([decade, count]) => ({ decade: parseInt(decade, 10), label: decade + 's', count }))
    .sort((a, b) => a.decade - b.decade);

  // Musical key distribution (Pitch Class notation)
  const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const keyCounts = {};
  let majorCount = 0, minorCount = 0;
  validFeatures.forEach(f => {
    if (f.key === undefined || f.key < 0) return;
    const name = KEY_NAMES[f.key] || 'Unknown';
    keyCounts[name] = (keyCounts[name] || 0) + 1;
    if (f.mode === 1) majorCount++; else minorCount++;
  });
  const topKey = Object.entries(keyCounts).sort(([, a], [, b]) => b - a)[0];
  const keyInsights = {
    distribution: Object.entries(keyCounts)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count),
    topKey:    topKey ? topKey[0] : null,
    topKeyCount: topKey ? topKey[1] : 0,
    majorCount,
    minorCount,
    majorPct:  validFeatures.length > 0 ? Math.round((majorCount / validFeatures.length) * 100) : 50,
  };

  // Day-of-week breakdown (when tracks get added)
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  tracks.forEach(item => {
    const d = new Date(item.added_at);
    if (!isNaN(d)) dayCounts[d.getDay()]++;
  });
  const dayOfWeek = DAY_NAMES.map((name, i) => ({ day: name, short: name.slice(0, 3), count: dayCounts[i] }));
  const peakDay = dayOfWeek.reduce((max, d) => d.count > max.count ? d : max, dayOfWeek[0]);

  // Tempo zones
  const tempoZones = { slow: 0, mid: 0, fast: 0, veryFast: 0 };
  validFeatures.forEach(f => {
    const bpm = f.tempo || 0;
    if      (bpm < 80)  tempoZones.slow++;
    else if (bpm < 120) tempoZones.mid++;
    else if (bpm < 160) tempoZones.fast++;
    else                tempoZones.veryFast++;
  });
  const tempoTotal = validFeatures.length || 1;
  const tempoBreakdown = [
    { label: 'Slow',      range: '< 80 BPM',    count: tempoZones.slow,     pct: Math.round((tempoZones.slow     / tempoTotal) * 100) },
    { label: 'Mid',       range: '80–120 BPM',   count: tempoZones.mid,      pct: Math.round((tempoZones.mid      / tempoTotal) * 100) },
    { label: 'Fast',      range: '120–160 BPM',  count: tempoZones.fast,     pct: Math.round((tempoZones.fast     / tempoTotal) * 100) },
    { label: 'Very Fast', range: '> 160 BPM',    count: tempoZones.veryFast, pct: Math.round((tempoZones.veryFast / tempoTotal) * 100) },
  ];

  return {
    playlist: {
      id:          playlist.id,
      name:        playlist.name,
      description: playlist.description,
      image:       playlist.images?.[0]?.url || null,
      owner:       playlist.owner.display_name || playlist.owner.id,
      totalTracks: playlist.tracks.total,
      followers:   playlist.followers?.total || 0,
      public:      playlist.public,
    },
    topArtists,
    totalUniqueArtists: Object.keys(artistCounts).length,
    topGenres,
    mostPopular,
    leastPopular,
    audioFeatures: avgFeatures,
    dateRange,
    totalAnalyzedTracks: validFeatures.length,
    runtime,
    decades,
    keyInsights,
    dayOfWeek,
    peakDay,
    tempoBreakdown,
  };
}

// ── Advanced contributor analytics ────────────────────────────────────────────

function generateAdvancedContributorAnalytics(tracks, audioFeatures, artists, userProfiles = []) {
  const contributorStats = {};

  const artistGenreMap = {};
  artists.forEach(artist => {
    if (artist?.id) artistGenreMap[artist.id] = artist.genres || [];
  });

  const audioFeaturesMap = {};
  audioFeatures.forEach((features, index) => {
    if (features && tracks[index]) audioFeaturesMap[tracks[index].track.id] = features;
  });

  const userDisplayNames = {};
  userProfiles.forEach(({ id, displayName }) => { if (displayName) userDisplayNames[id] = displayName; });

  tracks.forEach(item => {
    const contributorId = item.added_by?.id || 'unknown';
    const track         = item.track;
    const addedAt       = new Date(item.added_at);
    const audioFeature  = audioFeaturesMap[track.id];

    if (!contributorStats[contributorId]) {
      const displayName = contributorId === 'unknown'
        ? 'Unknown User'
        : (userDisplayNames[contributorId] || `User ${contributorId.slice(-4)}`);

      contributorStats[contributorId] = {
        id: contributorId,
        name: displayName,
        tracksAdded: 0,
        totalPopularity: 0,
        genres: new Set(),
        artists: new Set(),
        tracks: [],
        audioFeatures: { energy: [], danceability: [], valence: [], acousticness: [], speechiness: [], tempo: [] },
        addedDates: [],
        releaseYears: [],
      };
    }

    const c = contributorStats[contributorId];
    c.tracksAdded++;
    c.totalPopularity += track.popularity || 0;
    c.addedDates.push(addedAt);

    if (track.album?.release_date) {
      const y = new Date(track.album.release_date).getFullYear();
      if (!isNaN(y)) c.releaseYears.push(y);
    }

    c.tracks.push({
      name:        track.name,
      artists:     track.artists.map(a => a.name).join(', '),
      popularity:  track.popularity || 0,
      addedAt,
      releaseDate: track.album?.release_date,
      trackId:     track.id,
    });

    track.artists.forEach(artist => {
      c.artists.add(artist.name);
      (artistGenreMap[artist.id] || []).forEach(g => c.genres.add(g));
    });

    if (audioFeature) {
      Object.keys(c.audioFeatures).forEach(f => {
        if (audioFeature[f] !== undefined) c.audioFeatures[f].push(audioFeature[f]);
      });
    }
  });

  const contributors = Object.values(contributorStats).map(c => {
    const avgPopularity = c.tracksAdded > 0 ? c.totalPopularity / c.tracksAdded : 0;

    const avgAudioFeatures = {};
    Object.keys(c.audioFeatures).forEach(f => {
      const vals = c.audioFeatures[f];
      avgAudioFeatures[f] = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    });

    const avgReleaseYear = c.releaseYears.length > 0
      ? Math.round(c.releaseYears.reduce((s, y) => s + y, 0) / c.releaseYears.length)
      : new Date().getFullYear();

    return {
      ...c,
      avgPopularity:   Math.round(avgPopularity * 10) / 10,
      genreDiversity:  c.genres.size,
      artistDiversity: c.artists.size,
      genres:          Array.from(c.genres),
      artists:         Array.from(c.artists),
      avgAudioFeatures,
      avgReleaseYear,
      badges: [],
    };
  });

  contributors.sort((a, b) => b.tracksAdded - a.tracksAdded);
  assignComprehensiveBadges(contributors);

  return {
    totalContributors: contributors.length,
    contributors:      contributors.slice(0, 10),
    summary: {
      mostActive:       contributors[0]?.name || 'Unknown',
      avgContribution:  Math.round(tracks.length / Math.max(contributors.length, 1)),
      totalGenres:      new Set(contributors.flatMap(c => c.genres)).size,
      totalArtists:     new Set(contributors.flatMap(c => c.artists)).size,
    },
  };
}

function assignComprehensiveBadges(contributors) {
  if (!contributors.length) return;
  const sig = contributors.filter(c => c.tracksAdded >= 3);

  // Top Curator
  if (contributors[0].tracksAdded > 5) {
    contributors[0].badges.push({ id: 'top_curator', name: 'Top Curator', description: `Added the most tracks (${contributors[0].tracksAdded})` });
  }

  // Eclectic Ear
  if (sig.length > 0) {
    const best = sig.reduce((m, c) => c.genreDiversity > m.genreDiversity ? c : m);
    if (best.genreDiversity > 5) best.badges.push({ id: 'eclectic_ear', name: 'Eclectic Ear', description: `Most diverse taste with ${best.genreDiversity} genres` });
  }

  // Underground Hero
  if (sig.length > 1) {
    const hero = sig.reduce((m, c) => c.avgPopularity < m.avgPopularity ? c : m);
    if (hero.avgPopularity < 40) hero.badges.push({ id: 'underground_hero', name: 'Underground Hero', description: `Discovers hidden gems (avg popularity: ${hero.avgPopularity})` });
  }

  // Trendsetter
  sig.forEach(c => {
    const low = c.tracks.filter(t => t.popularity < 30).length;
    if (low >= Math.max(2, c.tracksAdded * 0.3)) c.badges.push({ id: 'trendsetter', name: 'Trendsetter', description: `Early adopter with ${low} underground picks` });
  });

  // Old Soul
  let oldestTrack = null, oldSoul = null;
  sig.forEach(c => c.tracks.forEach(t => {
    if (t.releaseDate && (!oldestTrack || t.releaseDate < oldestTrack.releaseDate)) { oldestTrack = t; oldSoul = c; }
  }));
  if (oldSoul && oldestTrack) oldSoul.badges.push({ id: 'old_soul', name: 'Old Soul', description: `Added oldest track: "${oldestTrack.name}" (${new Date(oldestTrack.releaseDate).getFullYear()})` });

  // Fresh Dropper
  let newestTrack = null, freshDropper = null;
  sig.forEach(c => c.tracks.forEach(t => {
    if (t.releaseDate && (!newestTrack || t.releaseDate > newestTrack.releaseDate)) { newestTrack = t; freshDropper = c; }
  }));
  if (freshDropper && newestTrack) freshDropper.badges.push({ id: 'fresh_dropper', name: 'Fresh Dropper', description: `Added newest track: "${newestTrack.name}" (${new Date(newestTrack.releaseDate).getFullYear()})` });

  // Collector
  if (sig.length > 0) {
    const best = sig.reduce((m, c) => c.artistDiversity > m.artistDiversity ? c : m);
    if (best.artistDiversity > 10) best.badges.push({ id: 'collector', name: 'Collector', description: `Music explorer with ${best.artistDiversity} different artists` });
  }

  // Energy Dealer
  const energySig = sig.filter(c => c.avgAudioFeatures.energy > 0);
  if (energySig.length > 1) {
    const best = energySig.reduce((m, c) => c.avgAudioFeatures.energy > m.avgAudioFeatures.energy ? c : m);
    if (best.avgAudioFeatures.energy > 0.8) best.badges.push({ id: 'energy_dealer', name: 'Energy Dealer', description: `High-energy curator (${Math.round(best.avgAudioFeatures.energy * 100)}% energy)` });
  }

  // Dancefloor Commander
  const danceSig = sig.filter(c => c.avgAudioFeatures.danceability > 0);
  if (danceSig.length > 1) {
    const best = danceSig.reduce((m, c) => c.avgAudioFeatures.danceability > m.avgAudioFeatures.danceability ? c : m);
    if (best.avgAudioFeatures.danceability > 0.8) best.badges.push({ id: 'dancefloor_commander', name: 'Dancefloor Commander', description: `Makes everyone move (${Math.round(best.avgAudioFeatures.danceability * 100)}% danceability)` });
  }

  // Vibes Master
  const valenceSig = sig.filter(c => c.avgAudioFeatures.valence > 0);
  if (valenceSig.length > 1) {
    const best = valenceSig.reduce((m, c) => c.avgAudioFeatures.valence > m.avgAudioFeatures.valence ? c : m);
    if (best.avgAudioFeatures.valence > 0.7) best.badges.push({ id: 'vibes_master', name: 'Vibes Master', description: `Spreads positive energy (${Math.round(best.avgAudioFeatures.valence * 100)}% positivity)` });
  }

  // Sad Boi
  if (valenceSig.length > 1) {
    const min = valenceSig.reduce((m, c) => c.avgAudioFeatures.valence < m.avgAudioFeatures.valence ? c : m);
    if (min.avgAudioFeatures.valence < 0.4) min.badges.push({ id: 'sad_boi', name: 'Sad Boi', description: `Embraces melancholy (${Math.round(min.avgAudioFeatures.valence * 100)}% positivity)` });
  }
}

// ── Genre maestros ────────────────────────────────────────────────────────────

function calculateGenreMaestros(tracks, artists, userProfiles) {
  const genreContributors = {};

  tracks.forEach(item => {
    const contributorId = item.added_by?.id;
    if (!contributorId || contributorId === 'unknown') return;

    const trackGenres = new Set();
    item.track.artists.forEach(trackArtist => {
      const artistData = artists.find(a => a?.id === trackArtist.id);
      if (artistData?.genres) artistData.genres.forEach(g => trackGenres.add(g));
    });

    trackGenres.forEach(genre => {
      if (!genreContributors[genre]) genreContributors[genre] = {};
      if (!genreContributors[genre][contributorId]) genreContributors[genre][contributorId] = { count: 0, tracks: [] };
      genreContributors[genre][contributorId].count++;
      genreContributors[genre][contributorId].tracks.push({
        name:       item.track.name,
        artists:    item.track.artists.map(a => a.name).join(', '),
        popularity: item.track.popularity || 0,
        trackId:    item.track.id,
      });
    });
  });

  const maestros = [];
  Object.entries(genreContributors).forEach(([genre, contributors]) => {
    const [topId, topData] = Object.entries(contributors).sort(([, a], [, b]) => b.count - a.count)[0];
    if (topData.count < 2) return;

    const profile = userProfiles.find(p => p.id === topId);
    const total   = Object.values(contributors).reduce((s, c) => s + c.count, 0);

    maestros.push({
      genre,
      contributorId:   topId,
      contributorName: profile?.displayName || `User ${topId.slice(-4)}`,
      songCount:       topData.count,
      totalGenreTracks: total,
      percentage:      Math.round((topData.count / total) * 100),
      title:           generateGenreMaestroTitle(genre),
      tracks:          topData.tracks.sort((a, b) => b.popularity - a.popularity).slice(0, 3),
    });
  });

  return maestros.sort((a, b) => b.songCount - a.songCount).slice(0, 12);
}

function generateGenreMaestroTitle(genre) {
  const map = {
    'gengetone': 'Gengetone Guru', 'afro soul': 'Afro Soul Sovereign',
    'amapiano': 'Amapiano Ace', 'afropop': 'Afropop Authority',
    'afrobeats': 'Afrobeats Architect', 'afro r&b': 'Afro R&B Royalty',
    'gqom': 'Gqom Guardian', 'bongo flava': 'Bongo Flava Boss',
    'afrobeat': 'Afrobeat Authority', 'hip hop': 'Hip Hop Hero',
    'rap': 'Rap Ruler', 'pop': 'Pop Pioneer', 'rock': 'Rock Royalty',
    'r&b': 'R&B Regent', 'neo soul': 'Neo Soul Sage',
    'reggae': 'Reggae Ruler', 'dancehall': 'Dancehall Duke',
    'house': 'House Heavyweight', 'deep house': 'Deep House Deity',
    'afro house': 'Afro House Hero', 'electronic': 'Electronic Emperor',
    'jazz': 'Jazz Juggernaut', 'gospel': 'Gospel Guardian',
    'latin': 'Latin Legend', 'trap': 'Trap Titan', 'drill': 'Drill Deity',
    'afroswing': 'Afroswing Admiral', 'alte': 'Alte Ambassador',
  };
  const key = genre.toLowerCase();
  return map[key] || genre.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' Master';
}

// ── Playlist members ──────────────────────────────────────────────────────────

function generatePlaylistMembers(tracks, userProfiles, followerCount = 0) {
  const memberStats = {};

  tracks.forEach(item => {
    const id = item.added_by?.id;
    if (!id || id === 'unknown') return;
    if (!memberStats[id]) memberStats[id] = { id, tracksAdded: 0 };
    memberStats[id].tracksAdded++;
  });

  const contributors = Object.values(memberStats).map(member => {
    const profile = userProfiles.find(p => p.id === member.id);
    return {
      ...member,
      name:        profile?.displayName || `User ${member.id.slice(-4)}`,
      description: `Added ${member.tracksAdded} track${member.tracksAdded !== 1 ? 's' : ''}`,
    };
  }).sort((a, b) => b.tracksAdded - a.tracksAdded);

  return {
    totalMembers:  contributors.length,
    totalFollowers: followerCount,
    contributors,
    listeners: [],
    summary: {
      contributorCount: contributors.length,
      listenerCount:    Math.max(0, followerCount - contributors.length),
      totalMembers:     Math.max(contributors.length, followerCount),
    },
  };
}

module.exports = {
  generateInsights,
  generateAdvancedContributorAnalytics,
  assignComprehensiveBadges,
  calculateGenreMaestros,
  generatePlaylistMembers,
};
