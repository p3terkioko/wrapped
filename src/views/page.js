'use strict';

// Renders the whole film as HTML on the server, from the precomputed film
// payload. Everything readable is in the HTML; scripts only add motion and
// the lazy interactive layers.

const { esc, fmt } = require('./util');
const { renderRecord } = require('./record');
const { renderOpening, renderFirst, renderGrowth, renderRuntime } = require('./chapters/opening');

const ASSET_VERSION = '1';
const FAVICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100"><circle r="48" fill="#0e0b09"/><circle r="22" fill="#f3e9d6"/><circle r="9" fill="#0e0b09"/><circle r="4" fill="#e9b44c"/></svg>');

// JSON safe to embed in a <script> element: escape "<" and the two line
// separators that end a JavaScript string.
const BS = String.fromCharCode(92);
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
const inlineJson = obj => JSON.stringify(obj).split('<').join(BS + 'u003c').split(LS).join(BS + 'u2028').split(PS).join(BS + 'u2029');

function head(film, { url }) {
  const t = film.totals;
  const title = `${film.playlist.name || 'KamiLimu.inthe.Ears'}: ${fmt(t.entries)} songs from ${fmt(t.contributors)} people`;
  const desc = `The KamiLimu community's shared playlist, played back: who added what, when, and what it sounds like. ${fmt(t.entries)} songs, ${fmt(t.artists)} artists, since March 2024.`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#0e0b09">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
${film.playlist.image ? `<meta property="og:image" content="${esc(film.playlist.image)}">` : ''}
<meta name="twitter:card" content="summary">
<link rel="icon" href="${FAVICON}">
<link rel="preload" href="/fonts/fraunces-800.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/fraunces-text.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/film.css?v=${ASSET_VERSION}">
<script>(function(){try{var s=localStorage.getItem('kle-motion'),r=matchMedia('(prefers-reduced-motion: reduce)').matches;if(s==='off'||(s!=='on'&&r))document.documentElement.classList.add('motion-off')}catch(e){}document.documentElement.classList.add('js')})()</script>
</head>`;
}

function renderPage(film, { url = '/', me = null } = {}) {
  const t = film.totals;
  const years = `${new Date(t.firstAddedAt).getUTCFullYear()}–${new Date(t.lastAddedAt).getUTCFullYear()}`;
  return `${head(film, { url })}
<body>
<a class="skip" href="#first">Skip to the story of the playlist</a>
<div class="light" aria-hidden="true"></div>
<div class="grain" aria-hidden="true"></div>
<div class="vignette" aria-hidden="true"></div>
${renderRecord({ ringText: `KAMILIMU · INTHE · EARS · 45 RPM · SIDE A · ${fmt(t.entries)} SONGS · `, title: 'Side A', catalogue: `KLE · ${years}`, names: [...film.credits.roll].map(c => c.name) })}
<main class="film" id="dashboard" data-version="${esc(film.version || '')}"${me ? ` data-me="${esc(me)}"` : ''}>
${renderOpening(film)}
${renderFirst(film)}
${renderGrowth(film)}
${renderRuntime(film)}
</main>
<button type="button" class="motion-toggle" id="motion-toggle" aria-pressed="true">Motion</button>
<script id="film-data" type="application/json">${inlineJson(film)}</script>
<script defer src="/vendor/gsap-3.15.0/gsap.min.js"></script>
<script defer src="/vendor/gsap-3.15.0/ScrollTrigger.min.js"></script>
<script defer src="/vendor/gsap-3.15.0/SplitText.min.js"></script>
<script type="module" src="/js/film.js?v=${ASSET_VERSION}"></script>
</body>
</html>`;
}

function renderUnavailable() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>KamiLimu.inthe.Ears</title><link rel="stylesheet" href="/css/film.css?v=${ASSET_VERSION}"></head>
<body><main class="film"><section class="chapter opening"><h1 class="title"><span class="line">KamiLimu</span><span class="line dim">.inthe.Ears</span></h1><p class="lede">The playlist's numbers are being refreshed. Please check back in a few minutes.</p></section></main></body></html>`;
}

module.exports = { renderPage, renderUnavailable, ASSET_VERSION };
