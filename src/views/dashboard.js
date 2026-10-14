'use strict';

// The Crate: the dashboard as a separate page, reached from the end of the
// film. Server renders the shell and the totals (so it reads without script);
// the script loads the per-song table and makes everything filterable.

const { esc, fmt, date } = require('./util');
const { ASSET_VERSION } = require('./page');

const FAVICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100"><circle r="48" fill="#0e0b09"/><circle r="22" fill="#f3e9d6"/><circle r="9" fill="#0e0b09"/><circle r="4" fill="#e9b44c"/></svg>');

function panel(id, title, body = '', cls = '') {
  return `<section class="panel ${cls}" id="${id}" aria-labelledby="${id}-h">
    <h2 class="panel__h" id="${id}-h">${title}</h2>
    <p class="panel__line" id="${id}-line"></p>
    <div class="panel__body" id="${id}-body">${body}</div>
  </section>`;
}

function renderDashboard(film, { url = '/dashboard' } = {}) {
  const t = film.totals;
  const rt = film.runtime;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>The Crate · KamiLimu.inthe.Ears</title>
<meta name="description" content="Dig through all ${fmt(t.entries)} songs in the KamiLimu community playlist: filter by person, genre family, decade, day, hour, month, key and mood.">
<meta property="og:title" content="The Crate · KamiLimu.inthe.Ears">
<meta property="og:url" content="${esc(url)}">
<meta name="theme-color" content="#0e0b09">
<link rel="icon" href="${FAVICON}">
<link rel="preload" href="/fonts/fraunces-800.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/film.css?v=${ASSET_VERSION}">
<link rel="stylesheet" href="/css/chapters.css?v=${ASSET_VERSION}">
<link rel="stylesheet" href="/css/dashboard.css?v=${ASSET_VERSION}">
<script>(function(){try{var s=localStorage.getItem('kle-motion'),r=matchMedia('(prefers-reduced-motion: reduce)').matches;if(s==='off'||(s!=='on'&&r))document.documentElement.classList.add('motion-off')}catch(e){}document.documentElement.classList.add('js')})()</script>
</head>
<body class="crate-page">
<a class="skip" href="#tracklist">Skip to the tracklist</a>
<div class="light" aria-hidden="true"></div>
<div class="grain" aria-hidden="true"></div>
<header class="crate-head">
  <div class="crate-head__top">
    <a class="crate-back" href="/#finale">← Back to the film</a>
    <div class="crate-disc" aria-hidden="true"><span class="crate-disc__label" id="crate-label">All</span></div>
  </div>
  <h1 class="crate-title">The Crate</h1>
  <p class="crate-lede">Every song in KamiLimu.inthe.Ears. Tap any artist, bar, day, hour, key or corner to dig; everything re-cuts to match.</p>
  <div class="crate-tools">
    <label class="crate-search"><span class="sr-only">Search songs, artists or people</span><input type="search" id="crate-q" placeholder="Search songs, artists, people" autocomplete="off"></label>
    <button type="button" class="btn btn--small" id="crate-mine" hidden>Only mine</button>
    <button type="button" class="btn btn--small" id="crate-clear" hidden>Clear all</button>
  </div>
  <ul class="chips" id="crate-chips" aria-live="polite"></ul>
</header>
<main class="crate" id="crate">
  <dl class="crate-stats" id="crate-stats">
    <div><dt>songs added</dt><dd data-k="entries">${fmt(t.entries)}</dd></div>
    <div><dt>unique songs</dt><dd data-k="songs">${fmt(t.uniqueSongs)}</dd></div>
    <div><dt>people</dt><dd data-k="people">${fmt(t.contributors)}</dd></div>
    <div><dt>artists</dt><dd data-k="artists">${fmt(t.artists)}</dd></div>
    <div><dt>of music</dt><dd data-k="hours">${rt.hours}h ${String(rt.minutes).padStart(2, '0')}m</dd></div>
    <div><dt>median tempo</dt><dd data-k="bpm">${fmt(Math.round(film.sound.tempo.median))}</dd></div>
  </dl>
  <noscript><p class="caption">The Crate needs JavaScript to filter. The film on the <a href="/">main page</a> has every chart without it.</p></noscript>
  <div class="crate-grid">
    ${panel('p-people', 'People', '', 'panel--people')}
    ${panel('p-families', 'Genre families', '', 'panel--families')}
    ${panel('p-decades', 'Release decades', '', 'panel--decades')}
    ${panel('p-weekday', 'Day of the week', '', 'panel--weekday')}
    ${panel('p-artists', 'Artists', '', 'panel--artists')}
    ${panel('p-months', 'Month by month', '', 'panel--months')}
    ${panel('p-hour', 'Hour of the day', '', 'panel--hour')}
    ${panel('p-mood', 'Mood', '', 'panel--mood')}
    ${panel('p-keys', 'Keys', '', 'panel--keys')}
    <section class="panel panel--tracks" id="tracklist" aria-labelledby="tracklist-h">
      <div class="tracks__head">
        <h2 class="panel__h" id="tracklist-h">The tracklist</h2>
        <div class="tracks__sort" role="group" aria-label="Sort the tracklist">
          <button type="button" data-sort="added" aria-pressed="true">Newest</button>
          <button type="button" data-sort="title" aria-pressed="false">A–Z</button>
          <button type="button" data-sort="year" aria-pressed="false">Oldest</button>
          <button type="button" data-sort="bpm" aria-pressed="false">Fastest</button>
        </div>
      </div>
      <p class="panel__line" id="tracklist-line"></p>
      <ol class="tracks" id="tracks"></ol>
      <button type="button" class="btn btn--small tracks__more" id="tracks-more" hidden>Show more</button>
    </section>
  </div>
  <p class="caption crate-foot">Counts of songs added use every entry (${fmt(t.entries)}); sound panels (families, decades, mood, keys) count unique songs. Times are Nairobi time. Data as of ${esc(date(film.generatedAt))}; genre tags, audio features and origins are partial, and each panel says how many songs it can see.</p>
</main>
<button type="button" class="motion-toggle" id="motion-toggle" aria-pressed="true">Motion</button>
<script defer src="/vendor/gsap-3.15.0/gsap.min.js"></script>
<script type="module" src="/js/dashboard.js?v=${ASSET_VERSION}"></script>
</body>
</html>`;
}

module.exports = { renderDashboard };
