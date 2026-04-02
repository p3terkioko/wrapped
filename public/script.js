/* =============================================================================
   KamiLimu.inthe.Ears — Dashboard Script
   ============================================================================= */

'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
let currentData = null;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadData();
});

// ── Event Listeners ───────────────────────────────────────────────────────────
function setupEventListeners() {
  document.getElementById('analyze-btn')?.addEventListener('click', onEnterDashboard);
  document.getElementById('analyze-btn-hero')?.addEventListener('click', onEnterDashboard);
  document.getElementById('back-btn')?.addEventListener('click', showLanding);
  document.getElementById('view-story-btn')?.addEventListener('click', showStory);
  document.getElementById('share-btn')?.addEventListener('click', shareResults);
  document.getElementById('export-btn')?.addEventListener('click', exportResults);
  document.getElementById('story-prev-btn')?.addEventListener('click', () => navigateStory('prev'));
  document.getElementById('story-next-btn')?.addEventListener('click', onStoryNext);
  document.getElementById('story-exit-btn')?.addEventListener('click', exitStory);
  document.addEventListener('keydown', handleKeyboard);
}

function onEnterDashboard() {
  if (currentData) {
    showDashboard();
  } else {
    loadData().then(() => { if (currentData) showDashboard(); });
  }
}

// ── Data Loading ──────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const res = await fetch('/api/public/data');
    if (!res.ok) return;
    const result = await res.json();
    if (!result.success) return;

    currentData = result.data;

    populateHeaderStats(currentData);
    populateLandingStats(currentData);

    const ts = result.lastUpdated || result.cached_at;
    if (ts) {
      const formatted = new Date(ts).toLocaleString('en-US', {
        timeZone: 'Africa/Nairobi',
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      });
      const el = document.getElementById('last-updated-info');
      if (el) el.textContent = 'Updated ' + formatted + ' EAT';
    }
  } catch (e) {
    console.error('Failed to load data:', e);
  }
}

// ── Landing Population ────────────────────────────────────────────────────────
function populateHeaderStats(data) {
  const meta = document.getElementById('header-meta');
  if (!meta) return;
  meta.innerHTML = [
    mkStat('tracks',    fmt(data.playlist.totalTracks)),
    mkStat('followers', fmt(data.playlist.followers)),
    mkStat('curator',   data.playlist.owner),
  ].join('');
}

function populateLandingStats(data) {
  const container = document.getElementById('landing-stats');
  if (!container) return;
  container.innerHTML = [
    mkStatCard(fmt(data.playlist.totalTracks), 'Tracks'),
    mkStatCard(fmt(data.totalUniqueArtists), 'Artists'),
    mkStatCard(data.topGenres ? data.topGenres.length : '—', 'Genres'),
    mkStatCard(data.contributors ? data.contributors.totalContributors : (data.topContributors ? data.topContributors.length : '—'), 'Contributors'),
  ].join('');
}

function mkStat(label, value) {
  return '<div class="header-stat"><span class="header-stat-label">' + label +
    '</span><span class="header-stat-value">' + value + '</span></div>';
}

function mkStatCard(number, label) {
  return '<div class="landing-stat-card"><div class="landing-stat-number">' + number +
    '</div><div class="landing-stat-label">' + label + '</div></div>';
}

// ── Page Transitions ──────────────────────────────────────────────────────────
function showLanding() {
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('landing-page').classList.remove('hidden');
}

function showDashboard() {
  if (!currentData) return;
  document.getElementById('landing-page').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  populateDashboard(currentData);
}

// ── Dashboard Population ──────────────────────────────────────────────────────
var genreChartInstance = null;
var moodChartInstance  = null;

function populateDashboard(data) {
  var p = data.playlist;

  setText('playlist-name',   p.name);
  setText('total-tracks',    fmt(p.totalTracks));
  setText('total-followers', fmt(p.followers));
  setText('playlist-owner',  p.owner);

  var topGenre   = (data.topGenres && data.topGenres[0]) ? data.topGenres[0].genre : '—';
  var topContrib = (data.contributors && data.contributors.contributors && data.contributors.contributors[0])
    ? data.contributors.contributors[0].name
    : (data.topContributors && data.topContributors[0] ? data.topContributors[0].displayName : '—');

  setText('ov-tracks',          fmt(p.totalTracks));
  setText('ov-contributors',    data.contributors ? data.contributors.totalContributors : (data.topContributors ? data.topContributors.length : '—'));
  setText('ov-top-genre',       topGenre);
  setText('ov-top-contributor', topContrib);

  renderArtists(data.topArtists || []);
  renderContributors(data.topContributors || []);
  renderTrackSpotlight('popular-track', data.mostPopular, false);
  renderTrackSpotlight('hidden-gem',    data.leastPopular, true);
  renderTimeline(data.dateRange);
  renderGenreChart(data.topGenres || []);
  renderMoodChart(data.audioFeatures || {});

  if (data.contributors && data.contributors.contributors && data.contributors.contributors.length) {
    renderLeaderboard(data.contributors);
  }
  if (data.genreMaestros && data.genreMaestros.length) {
    renderMaestros(data.genreMaestros);
  }
  if (data.playlistMembers && data.playlistMembers.contributors && data.playlistMembers.contributors.length) {
    renderMembers(data.playlistMembers);
  }
}

// ── Artists ───────────────────────────────────────────────────────────────────
function renderArtists(artists) {
  var el = document.getElementById('artists-list');
  if (!el) return;
  el.innerHTML = artists.slice(0, 10).map(function(a, i) {
    return '<div class="artist-row"><span class="row-rank">' + (i + 1) +
      '</span><span class="row-name">' + esc(a.name) +
      '</span><span class="row-count">' + a.count + '</span></div>';
  }).join('');
}

// ── Top Contributors (simple) ─────────────────────────────────────────────────
function renderContributors(contribs) {
  var el = document.getElementById('contributors-list');
  if (!el) return;
  el.innerHTML = contribs.slice(0, 10).map(function(c, i) {
    return '<div class="contributor-row"><span class="row-rank">' + (i + 1) +
      '</span><span class="row-name">' + esc(c.displayName) +
      '</span><span class="row-count">' + c.count + '</span></div>';
  }).join('');
}

// ── Track Spotlight ───────────────────────────────────────────────────────────
function renderTrackSpotlight(id, track, isGem) {
  var el = document.getElementById(id);
  if (!el) return;
  if (!track) {
    el.innerHTML += '<p class="no-data">No data</p>';
    return;
  }
  var spotifyHref = track.external_urls && track.external_urls.spotify ? track.external_urls.spotify : null;
  el.innerHTML =
    '<span class="track-type-label">' + (isGem ? 'Hidden Gem' : 'Most Popular') + '</span>' +
    '<div class="track-main-name">' + esc(track.name) + '</div>' +
    '<div class="track-main-artist">' + esc(track.artists) + '</div>' +
    '<div class="track-score">' + track.popularity + '<small>/100</small></div>' +
    '<div class="track-score-label">Spotify Popularity</div>' +
    (spotifyHref ? '<a class="track-spotify-link" href="' + spotifyHref + '" target="_blank" rel="noopener">Listen on Spotify</a>' : '');
}

// ── Timeline ──────────────────────────────────────────────────────────────────
function renderTimeline(dateRange) {
  var el = document.getElementById('timeline-info');
  if (!el) return;
  if (!dateRange) { el.innerHTML = '<p class="no-data">No timeline data</p>'; return; }

  var start = new Date(dateRange.earliest);
  var end   = new Date(dateRange.latest);
  var days  = Math.ceil((end - start) / 86400000);
  var opts  = { month: 'short', day: 'numeric', year: 'numeric' };

  el.innerHTML =
    '<div class="timeline-line">' +
      '<div class="timeline-dot"></div>' +
      '<div class="timeline-track"></div>' +
      '<div class="timeline-dot"></div>' +
    '</div>' +
    '<div class="timeline-dates">' +
      '<span class="timeline-date-label">' + start.toLocaleDateString('en-US', opts) + '</span>' +
      '<span class="timeline-date-label">' + end.toLocaleDateString('en-US', opts)   + '</span>' +
    '</div>' +
    '<div class="timeline-duration">Built over ' + days + ' day' + (days !== 1 ? 's' : '') + '</div>';
}

// ── Genre Chart ───────────────────────────────────────────────────────────────
function renderGenreChart(genres) {
  var ctx = document.getElementById('genres-chart');
  if (!ctx) return;
  if (genreChartInstance) { genreChartInstance.destroy(); genreChartInstance = null; }

  var COLORS = ['#00b4c2','#1b4864','#eaa000','#214e34','#ac3931','#4dd0da','#007f8a','rgba(248,249,240,0.5)'];
  var top = genres.slice(0, 8);

  genreChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(function(g) { return g.genre; }),
      datasets: [{
        data: top.map(function(g) { return g.count; }),
        backgroundColor: top.map(function(_, i) { return COLORS[i % COLORS.length]; }),
        borderWidth: 0,
        borderRadius: 0,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#141414',
          titleColor: '#f8f9f0',
          bodyColor: 'rgba(248,249,240,0.55)',
          borderColor: 'rgba(248,249,240,0.07)',
          borderWidth: 1,
          titleFont: { family: 'JetBrains Mono' },
          bodyFont:  { family: 'JetBrains Mono' },
          callbacks: { label: function(c) { return ' ' + c.raw + ' tracks'; } },
        },
      },
      scales: {
        x: {
          grid:  { color: 'rgba(248,249,240,0.05)' },
          ticks: { color: 'rgba(248,249,240,0.28)', font: { family: 'JetBrains Mono', size: 10 } },
        },
        y: {
          grid:  { display: false },
          ticks: { color: 'rgba(248,249,240,0.55)', font: { family: 'JetBrains Mono', size: 11 } },
        },
      },
    },
  });
}

// ── Mood Radar ────────────────────────────────────────────────────────────────
function renderMoodChart(af) {
  var ctx = document.getElementById('mood-chart');
  if (!ctx) return;
  if (moodChartInstance) { moodChartInstance.destroy(); moodChartInstance = null; }

  moodChartInstance = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Valence', 'Energy', 'Danceability', 'Acousticness', 'Speechiness'],
      datasets: [{
        label: 'Mood',
        data: [af.valence, af.energy, af.danceability, af.acousticness, af.speechiness],
        backgroundColor: 'rgba(0,180,194,0.12)',
        borderColor: '#00b4c2',
        borderWidth: 1.5,
        pointBackgroundColor: '#00b4c2',
        pointRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#141414',
          titleColor: '#f8f9f0',
          bodyColor: 'rgba(248,249,240,0.55)',
          borderColor: 'rgba(248,249,240,0.07)',
          borderWidth: 1,
          titleFont: { family: 'JetBrains Mono' },
          bodyFont:  { family: 'JetBrains Mono' },
        },
      },
      scales: {
        r: {
          min: 0, max: 1,
          backgroundColor: 'transparent',
          angleLines: { color: 'rgba(248,249,240,0.07)' },
          grid:        { color: 'rgba(248,249,240,0.07)' },
          pointLabels: { color: 'rgba(248,249,240,0.4)', font: { family: 'JetBrains Mono', size: 10 } },
          ticks:       { display: false },
        },
      },
    },
  });
}

// ── Contributor Leaderboard ───────────────────────────────────────────────────
function renderLeaderboard(data) {
  var el = document.getElementById('contributor-analytics');
  if (!el) return;

  var contribs = data.contributors || [];
  var total    = contribs.reduce(function(s, c) { return s + c.tracksAdded; }, 0);

  var rows = contribs.map(function(c, i) {
    var pct    = total > 0 ? Math.round((c.tracksAdded / total) * 100) : 0;
    var badges = (c.badges || []).map(function(b) {
      return '<span class="badge">' + esc(b.name) + '</span>';
    }).join('');
    return '<div class="leaderboard-row">' +
      '<span class="lb-rank">' + (i + 1) + '</span>' +
      '<div class="lb-info">' +
        '<span class="lb-name">' + esc(c.name) + '</span>' +
        '<div class="lb-meta">' +
          '<span class="lb-meta-item"><b>' + pct + '%</b> of playlist</span>' +
          '<span class="lb-meta-item"><b>' + (c.genreDiversity || 0) + '</b> genres</span>' +
          '<span class="lb-meta-item">avg pop <b>' + Math.round(c.avgPopularity || 0) + '</b></span>' +
        '</div>' +
        (badges ? '<div class="lb-badges">' + badges + '</div>' : '') +
      '</div>' +
      '<div class="lb-track-count">' + c.tracksAdded + '<small>tracks</small></div>' +
    '</div>';
  }).join('');

  var s = data.summary || {};
  var summary =
    '<div class="leaderboard-summary">' +
      '<div class="ls-cell"><div class="ls-value">' + data.totalContributors + '</div><div class="ls-label">Contributors</div></div>' +
      '<div class="ls-cell"><div class="ls-value">' + (s.avgContribution || '—') + '</div><div class="ls-label">Avg tracks / person</div></div>' +
      '<div class="ls-cell"><div class="ls-value">' + (s.totalGenres || '—') + '</div><div class="ls-label">Total genres</div></div>' +
      '<div class="ls-cell"><div class="ls-value">' + (s.totalArtists || '—') + '</div><div class="ls-label">Total artists</div></div>' +
    '</div>';

  el.innerHTML = '<div class="leaderboard">' + rows + '</div>' + summary;
}

// ── Genre Maestros ────────────────────────────────────────────────────────────
function renderMaestros(maestros) {
  var el = document.getElementById('genre-maestros');
  if (!el) return;

  el.innerHTML = '<div class="maestros-list">' +
    maestros.map(function(m) {
      return '<div class="maestro-row">' +
        '<div class="maestro-info">' +
          '<span class="maestro-genre">' + esc(m.genre) + '</span>' +
          '<span class="maestro-name">' + esc(m.contributorName) + '</span>' +
          '<span class="maestro-title-text">' + esc(m.title) + '</span>' +
        '</div>' +
        '<div class="maestro-pct">' + m.percentage + '%</div>' +
        '<div class="maestro-count">' + m.songCount + ' / ' + m.totalGenreTracks + '</div>' +
      '</div>';
    }).join('') +
  '</div>';
}

// ── Playlist Members ──────────────────────────────────────────────────────────
function renderMembers(data) {
  var el = document.getElementById('playlist-members');
  if (!el) return;

  el.innerHTML = '<div class="members-list">' +
    (data.contributors || []).map(function(m, i) {
      return '<div class="member-row">' +
        '<span class="member-rank">' + (i + 1) + '</span>' +
        '<span class="member-name">' + esc(m.name) + '</span>' +
        '<span class="member-tracks">' + m.tracksAdded + ' track' + (m.tracksAdded !== 1 ? 's' : '') + '</span>' +
      '</div>';
    }).join('') +
  '</div>';
}

// ── Share / Export ────────────────────────────────────────────────────────────
function shareResults() {
  if (!currentData) return;
  var p    = currentData.playlist;
  var text = 'KamiLimu.inthe.Ears — ' + p.name + '\n' +
    p.totalTracks + ' tracks · Top artist: ' + (currentData.topArtists && currentData.topArtists[0] ? currentData.topArtists[0].name : '?') +
    ' · Top genre: ' + (currentData.topGenres && currentData.topGenres[0] ? currentData.topGenres[0].genre : '?') +
    '\n' + window.location.origin;

  if (navigator.share) {
    navigator.share({ title: 'KamiLimu.inthe.Ears', text: text, url: window.location.origin });
  } else {
    navigator.clipboard.writeText(text)
      .then(function() { notify('Copied to clipboard', 'success'); })
      .catch(function() { notify('Copy failed', 'error'); });
  }
}

function exportResults() {
  if (!currentData) return;
  var blob = new Blob([JSON.stringify(currentData, null, 2)], { type: 'application/json' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = 'kamilimu-playlist-data.json';
  a.click();
  URL.revokeObjectURL(url);
  notify('Data exported', 'success');
}

// ── Notifications ─────────────────────────────────────────────────────────────
function notify(message, type) {
  var n = document.createElement('div');
  n.className  = 'notification notification--' + (type || 'success');
  n.textContent = message;
  document.body.appendChild(n);
  requestAnimationFrame(function() { n.classList.add('notification--visible'); });
  setTimeout(function() {
    n.classList.remove('notification--visible');
    setTimeout(function() { n.remove(); }, 300);
  }, 3000);
}

// ── Keyboard ──────────────────────────────────────────────────────────────────
function handleKeyboard(e) {
  var story = document.getElementById('story-container');
  if (!story || story.classList.contains('hidden')) return;
  if (e.key === 'ArrowRight') onStoryNext();
  if (e.key === 'ArrowLeft')  navigateStory('prev');
  if (e.key === 'Escape')     exitStory();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val != null ? val : '—';
}

function fmt(n) {
  return n != null ? Number(n).toLocaleString() : '—';
}

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


/* =============================================================================
   STORY MODE
   ============================================================================= */

var storySlide  = 0;
var TOTAL_SLIDES = 12;

var SLIDE_TYPES = [
  'welcome', 'genre-diversity', 'top-artists', 'most-popular',
  'hidden-gem', 'contributions', 'genre-champions', 'timeline',
  'vibe-check', 'music-time-span', 'summary', 'outro',
];

function showStory() {
  if (!currentData) { notify('No data available', 'error'); return; }
  storySlide = 0;

  var container = document.getElementById('story-container');
  var dashboard = document.getElementById('dashboard');
  if (!container || !dashboard) return;

  buildAllSlides();
  container.classList.remove('hidden');
  dashboard.classList.add('hidden');
  goToSlide(0);
}

function exitStory() {
  var c = document.getElementById('story-container');
  var d = document.getElementById('dashboard');
  if (c) c.classList.add('hidden');
  if (d) d.classList.remove('hidden');
}

function onStoryNext() {
  if (storySlide === TOTAL_SLIDES - 1) exitStory();
  else navigateStory('next');
}

function navigateStory(dir) {
  var next = dir === 'next' ? storySlide + 1 : storySlide - 1;
  if (next < 0 || next >= TOTAL_SLIDES) return;
  goToSlide(next);
}

function goToSlide(index) {
  storySlide = index;

  var slides = document.getElementById('story-slides');
  if (slides) slides.style.transform = 'translateX(' + (-index * 100) + 'vw)';

  var bar = document.getElementById('story-progress-bar');
  if (bar) bar.style.width = (((index + 1) / TOTAL_SLIDES) * 100) + '%';

  var counter = document.getElementById('story-counter');
  if (counter) counter.textContent = (index + 1) + ' / ' + TOTAL_SLIDES;

  var prevBtn = document.getElementById('story-prev-btn');
  if (prevBtn) prevBtn.disabled = (index === 0);

  var nextBtn = document.getElementById('story-next-btn');
  if (nextBtn) nextBtn.textContent = index === TOTAL_SLIDES - 1 ? 'Done' : 'Next \u2192';

  if (index === 7) animateVibeBars();
}

function buildAllSlides() {
  var container = document.getElementById('story-slides');
  if (!container) return;
  container.innerHTML = SLIDE_TYPES.map(function(type, i) {
    return '<div class="story-slide" data-slide="' + i + '">' +
      '<div class="story-slide-content">' + slideContent(type) + '</div>' +
      (type === 'outro' ? buildConfetti() : '') +
    '</div>';
  }).join('');
}

// ── Slide Content ─────────────────────────────────────────────────────────────
function slideContent(type) {
  var d = currentData;

  switch (type) {

    case 'welcome':
      return '<p class="story-eyebrow">KamiLimu &middot; Playlist Analytics</p>' +
        '<h1>' + esc(d.playlist.name) + '</h1>' +
        '<div class="story-rule"></div>' +
        '<div class="story-big-number">' + fmt(d.playlist.totalTracks) + '</div>' +
        '<p>tracks, multiple curators, one community sound.</p>';

    case 'genre-diversity': {
      var genres = (d.topGenres || []).slice(0, 6);
      var maxG   = genres.length ? genres[0].count : 1;
      return '<p class="story-eyebrow">Genre Breakdown</p>' +
        '<h1>Built from <span class="story-highlight">' + genres.length + '</span> worlds</h1>' +
        '<div class="story-genre-list">' +
        genres.map(function(g) {
          var w = Math.round((g.count / maxG) * 100);
          return '<div class="story-genre-item">' +
            '<span class="story-genre-name">' + esc(g.genre) + '</span>' +
            '<div class="story-genre-bar-wrap">' +
              '<div class="story-genre-bar"><div class="story-genre-bar-fill" style="width:' + w + '%"></div></div>' +
              '<span class="story-genre-count">' + g.count + '</span>' +
            '</div></div>';
        }).join('') + '</div>';
    }

    case 'top-artists': {
      var artists = (d.topArtists || []).slice(0, 5);
      return '<p class="story-eyebrow">Top Artists</p>' +
        '<h1>The voices behind the sound</h1>' +
        '<div class="story-artist-list">' +
        artists.map(function(a, i) {
          return '<div class="story-artist-item">' +
            '<span class="story-artist-rank">' + (i + 1) + '</span>' +
            '<span class="story-artist-name">' + esc(a.name) + '</span>' +
            '<span class="story-artist-count">' + a.count + ' tracks</span>' +
          '</div>';
        }).join('') + '</div>';
    }

    case 'most-popular': {
      var t = d.mostPopular;
      if (!t) return '<h1>Every track here shines equally.</h1>';
      var link = t.external_urls && t.external_urls.spotify
        ? '<a class="track-spotify-link" href="' + t.external_urls.spotify + '" target="_blank" rel="noopener">Listen on Spotify</a>' : '';
      return '<p class="story-eyebrow">Most Popular Track</p>' +
        '<h1>The crowd favourite</h1>' +
        '<div class="story-track-block">' +
          '<div class="story-track-name-large">' + esc(t.name) + '</div>' +
          '<div class="story-track-artist-text">' + esc(t.artists) + '</div>' +
          '<div class="story-track-score">' + t.popularity + '<span style="font-size:1rem;color:rgba(248,249,240,0.3)">/100</span></div>' +
          '<div class="story-track-score-label">SPOTIFY POPULARITY</div>' +
          '<div class="story-pop-bar"><div class="story-pop-fill" style="width:' + t.popularity + '%"></div></div>' +
          link +
        '</div>';
    }

    case 'hidden-gem': {
      var t = d.leastPopular;
      if (!t) return '<h1>Pure gold throughout.</h1><p>No hidden gems needed when everything shines.</p>';
      return '<p class="story-eyebrow">Hidden Gem</p>' +
        '<h1>Sleeping on this one?</h1>' +
        '<div class="story-track-block story-track-block--gem">' +
          '<div class="story-track-name-large">' + esc(t.name) + '</div>' +
          '<div class="story-track-artist-text">' + esc(t.artists) + '</div>' +
          '<div class="story-track-score" style="color:#1b4864">' + t.popularity + '<span style="font-size:1rem;color:rgba(248,249,240,0.3)">/100</span></div>' +
          '<div class="story-track-score-label">UNDERRATED</div>' +
          '<div class="story-pop-bar"><div class="story-pop-fill" style="width:' + Math.max(t.popularity, 4) + '%;background:#1b4864"></div></div>' +
        '</div>';
    }

    case 'contributions': {
      var contribs = (d.contributors && d.contributors.contributors) ? d.contributors.contributors : [];
      var top  = contribs[0];
      var rest = contribs.slice(1, 5);
      if (!top) return '<h1>A collaborative effort.</h1>';
      var totalCount = (d.contributors && d.contributors.totalContributors) ? d.contributors.totalContributors : contribs.length;
      return '<p class="story-eyebrow">Contributions</p>' +
        '<h1><span class="story-highlight">' + totalCount + '</span> curators shaped this</h1>' +
        '<div class="story-contrib-spotlight">' +
          '<div class="story-contrib-name">' + esc(top.name) + '</div>' +
          '<div class="story-contrib-count">' + top.tracksAdded + ' tracks \u2014 most active</div>' +
        '</div>' +
        (rest.length ? '<div class="story-contrib-others">' +
          rest.map(function(c) {
            return '<div class="story-contrib-other-row">' +
              '<span class="story-contrib-other-name">' + esc(c.name) + '</span>' +
              '<span class="story-contrib-other-count">' + c.tracksAdded + '</span>' +
            '</div>';
          }).join('') + '</div>' : '');
    }

    case 'genre-champions': {
      var genres = (d.topGenres || []).slice(0, 3);
      if (!genres.length) return '<h1>Genre diversity.</h1><p>Something for everyone.</p>';
      var maxC = genres[0].count || 1;
      return '<p class="story-eyebrow">Genre Podium</p>' +
        '<h1>The <span class="story-highlight">' + esc(genres[0].genre) + '</span> throne</h1>' +
        '<div class="story-genre-list">' +
        genres.map(function(g, i) {
          var w   = Math.round((g.count / maxC) * 100);
          var clr = i === 0 ? '#00b4c2' : 'rgba(248,249,240,0.55)';
          var bar = i === 0 ? '#00b4c2' : 'rgba(248,249,240,0.2)';
          return '<div class="story-genre-item">' +
            '<span class="story-genre-name" style="color:' + clr + '">#' + (i + 1) + ' ' + esc(g.genre) + '</span>' +
            '<div class="story-genre-bar-wrap">' +
              '<div class="story-genre-bar"><div class="story-genre-bar-fill" style="width:' + w + '%;background:' + bar + '"></div></div>' +
              '<span class="story-genre-count">' + g.count + '</span>' +
            '</div></div>';
        }).join('') + '</div>';
    }

    case 'timeline': {
      var dr = d.dateRange;
      if (!dr) return '<h1>A timeless collection.</h1>';
      var start = new Date(dr.earliest);
      var end   = new Date(dr.latest);
      var days  = Math.ceil((end - start) / 86400000);
      var mOpts = { month: 'long', year: 'numeric' };
      return '<p class="story-eyebrow">Playlist Timeline</p>' +
        '<h1>From ' + start.toLocaleDateString('en-US', mOpts) + '</h1>' +
        '<h2>to ' + end.toLocaleDateString('en-US', mOpts) + '</h2>' +
        '<div class="story-timeline-row">' +
          '<div class="story-tl-dot"></div>' +
          '<div class="story-tl-line"></div>' +
          '<div class="story-tl-dot"></div>' +
        '</div>' +
        '<div class="story-tl-labels">' +
          '<span class="story-tl-date">' + start.toLocaleDateString('en-US', mOpts) + '</span>' +
          '<span class="story-tl-date">' + end.toLocaleDateString('en-US', mOpts) + '</span>' +
        '</div>' +
        '<p>' + days + ' day' + (days !== 1 ? 's' : '') + ' of curation</p>';
    }

    case 'vibe-check': {
      var af      = d.audioFeatures || {};
      var p100    = function(v) { return Math.round((v || 0) * 100); };
      var energy  = p100(af.energy);
      var valence = p100(af.valence);
      var dance   = p100(af.danceability);
      var acoustic = p100(af.acousticness);

      var vibe = 'A perfect balance of heart and soul';
      if (energy >= 70 && valence >= 70) vibe = 'High energy, high happiness \u2014 pure euphoria';
      else if (energy >= 70)  vibe = 'Intense and powerful \u2014 emotions run high';
      else if (valence >= 70) vibe = 'Warm and uplifting throughout';
      else if (acoustic >= 60) vibe = 'Acoustic, intimate, raw';

      return '<p class="story-eyebrow">Vibe Check</p>' +
        '<h1>The sonic fingerprint</h1>' +
        '<p>' + vibe + '</p>' +
        '<div class="story-vibe-bars">' +
          mkVibeRow('Energy',       energy) +
          mkVibeRow('Happiness',    valence) +
          mkVibeRow('Danceability', dance) +
          mkVibeRow('Acoustic',     acoustic) +
        '</div>';
    }

    case 'music-time-span': {
      var oldest = null, newest = null;
      var conts  = (d.contributors && d.contributors.contributors) ? d.contributors.contributors : [];
      conts.forEach(function(c) {
        (c.tracks || []).forEach(function(t) {
          if (!t.releaseDate) return;
          if (!oldest || t.releaseDate < oldest.releaseDate) oldest = t;
          if (!newest || t.releaseDate > newest.releaseDate) newest = t;
        });
      });
      if (!oldest || !newest) {
        var dr = d.dateRange;
        if (!dr) return '<p class="story-eyebrow">Musical Era</p><h1>A timeless collection</h1>';
        return '<p class="story-eyebrow">Musical Era</p>' +
          '<h1>' + new Date(dr.earliest).getFullYear() + ' \u2014 ' + new Date(dr.latest).getFullYear() + '</h1>';
      }
      var oy = new Date(oldest.releaseDate).getFullYear();
      var ny = new Date(newest.releaseDate).getFullYear();
      return '<p class="story-eyebrow">Musical Era</p>' +
        '<h1>From <span class="story-highlight">' + oy + '</span> to <span class="story-highlight">' + ny + '</span></h1>' +
        '<p>A ' + (ny - oy) + '-year span of music history</p>' +
        '<div class="story-track-block" style="margin-top:.5rem">' +
          '<div class="story-track-name-large" style="font-size:1rem">' + esc(oldest.name) + '</div>' +
          '<div class="story-track-artist-text">' + esc(oldest.artists) + ' \u00b7 ' + oy + '</div>' +
        '</div>' +
        '<div class="story-track-block story-track-block--gem" style="margin-top:.75rem">' +
          '<div class="story-track-name-large" style="font-size:1rem">' + esc(newest.name) + '</div>' +
          '<div class="story-track-artist-text">' + esc(newest.artists) + ' \u00b7 ' + ny + '</div>' +
        '</div>';
    }

    case 'summary': {
      var topArtist = d.topArtists && d.topArtists[0] ? d.topArtists[0] : null;
      var topGenreS = d.topGenres  && d.topGenres[0]  ? d.topGenres[0]  : null;
      var energyPct = d.audioFeatures && d.audioFeatures.energy ? Math.round(d.audioFeatures.energy * 100) : null;
      var totalC    = d.contributors ? d.contributors.totalContributors : '—';
      return '<p class="story-eyebrow">Summary</p>' +
        '<h1>' + esc(d.playlist.name) + '</h1>' +
        '<div class="story-stats-grid">' +
          '<div class="story-stat-cell"><div class="story-stat-num">' + fmt(d.playlist.totalTracks) + '</div><div class="story-stat-lbl">Tracks</div></div>' +
          '<div class="story-stat-cell"><div class="story-stat-num">' + fmt(d.totalUniqueArtists) + '</div><div class="story-stat-lbl">Artists</div></div>' +
          '<div class="story-stat-cell"><div class="story-stat-num">' + (d.topGenres ? d.topGenres.length : '—') + '</div><div class="story-stat-lbl">Genres</div></div>' +
          '<div class="story-stat-cell"><div class="story-stat-num">' + totalC + '</div><div class="story-stat-lbl">Curators</div></div>' +
        '</div>' +
        '<div class="story-highlights">' +
          (topArtist ? '<div class="story-highlight-row">' + esc(topArtist.name) + ' leads with ' + topArtist.count + ' tracks</div>' : '') +
          (topGenreS ? '<div class="story-highlight-row">' + esc(topGenreS.genre) + ' sets the mood</div>' : '') +
          (energyPct ? '<div class="story-highlight-row">' + energyPct + '% average energy</div>' : '') +
        '</div>';
    }

    case 'outro':
      return '<p class="story-eyebrow">KamiLimu &middot; Community Playlist</p>' +
        '<h1>Keep listening</h1>' +
        '<p>The playlist is live. The music keeps growing.</p>' +
        '<div class="story-outro-actions">' +
          '<button type="button" class="btn-primary" onclick="exitStory()">Back to Dashboard</button>' +
          '<button type="button" class="btn-ghost" onclick="goToSlide(0)">Replay</button>' +
        '</div>';

    default:
      return '<h1>Slide</h1>';
  }
}

function mkVibeRow(label, pct) {
  return '<div class="story-vibe-row">' +
    '<span class="story-vibe-label">' + label + '</span>' +
    '<div class="story-vibe-track"><div class="story-vibe-fill" data-pct="' + pct + '" style="width:0%"></div></div>' +
    '<span class="story-vibe-val">' + pct + '%</span>' +
  '</div>';
}

function animateVibeBars() {
  var fills = document.querySelectorAll('.story-vibe-fill[data-pct]');
  fills.forEach(function(el) {
    var pct = el.getAttribute('data-pct');
    el.style.width = '0%';
    requestAnimationFrame(function() {
      setTimeout(function() { el.style.width = pct + '%'; }, 50);
    });
  });
}

function buildConfetti() {
  var colors = ['#00b4c2','#f8f9f0','#eaa000','#4dd0da','#1b4864'];
  var pieces = [];
  for (var i = 0; i < 50; i++) {
    var color = colors[i % colors.length];
    var left  = (Math.random() * 100).toFixed(1);
    var delay = (Math.random() * 3).toFixed(2);
    pieces.push('<div class="story-confetti-piece" style="left:' + left + '%;background:' + color + ';animation-delay:' + delay + 's"></div>');
  }
  return '<div class="story-confetti">' + pieces.join('') + '</div>';
}
