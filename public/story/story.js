/* =============================================================================
   KamiLimu.inthe.Ears — Story mode
   Moved here unchanged from the old public/script.js so the new film page can
   host it. The only edits are three data fixes, so every number is computed:
   "Built from N worlds" and the summary's genre count use the real total
   (totalGenres), and "Musical era" uses the whole playlist (musicTimeSpan)
   instead of only the top ten contributors' songs.
   ============================================================================= */

'use strict';

// Set by the loader in film page before showStory() runs.
var currentData = null;

// ── Helpers (from the old script, unchanged) ──────────────────────────────────
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

// ── Keyboard (story part of the old handler) ─────────────────────────────────
document.addEventListener('keydown', function(e) {
  var story = document.getElementById('story-container');
  if (story && !story.classList.contains('hidden')) {
    if (e.key === 'ArrowRight') onStoryNext();
    if (e.key === 'ArrowLeft')  navigateStory('prev');
    if (e.key === 'Escape')     exitStory();
  }
});

document.getElementById('story-prev-btn')?.addEventListener('click', function() { navigateStory('prev'); });
document.getElementById('story-next-btn')?.addEventListener('click', onStoryNext);
document.getElementById('story-exit-btn')?.addEventListener('click', exitStory);


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
        '<h1>Built from <span class="story-highlight">' + (d.totalGenres || genres.length) + '</span> worlds</h1>' +
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
      if (d.musicTimeSpan) { oldest = d.musicTimeSpan.oldest; newest = d.musicTimeSpan.newest; }
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
          '<div class="story-stat-cell"><div class="story-stat-num">' + (d.totalGenres || (d.topGenres ? d.topGenres.length : '—')) + '</div><div class="story-stat-lbl">Genres</div></div>' +
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
