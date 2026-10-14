'use strict';

// The lineup: the most-added artists, festival-poster style, with their
// Spotify pictures. Pictures are shown whole (no cropping, overlays, effects
// or motion) and each artist links back to Spotify.

const { esc, fmt, plural, artwork, spotifyTrack } = require('../util');

const spotifyArtist = id => `https://open.spotify.com/artist/${encodeURIComponent(id)}`;
const initials = name => String(name).split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
const andList = xs => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const people = n => (n === 1 ? 'one person' : `${fmt(n)} different people`);

// The headliner and the next three are shown large enough to want the 640 px
// picture on sharp screens; `sizes` says how wide each is displayed.
function picture(a, { sizes = null } = {}) {
  if (!a.image) return `<span class="artist__img artist__img--none" aria-hidden="true">${esc(initials(a.name))}</span>`;
  const src = artwork(a.image);
  const set = sizes && a.imageLarge && a.imageLarge !== a.image ? ` srcset="${src} 320w, ${artwork(a.imageLarge)} 640w" sizes="${sizes}"` : '';
  return `<img class="artist__img" src="${src}"${set} width="320" height="320" alt="" loading="lazy" decoding="async">`;
}

function card(a, rank) {
  return `<li class="artist" data-people="${esc(a.adders.join(' '))}">
    <a class="artist__link" href="${spotifyArtist(a.id)}">
      ${picture(a, { sizes: rank <= 4 ? '(min-width: 760px) 340px, 30vw' : null })}
      <span class="artist__name"><span class="artist__rank">${rank}</span> ${esc(a.name)}</span>
      <span class="artist__meta">${plural(a.songs, 'song')} · ${plural(a.people, 'person', 'people')}</span>
    </a>
  </li>`;
}

function renderLineup(film) {
  const L = film.lineup;
  if (!L || !L.top.length) return '';
  const [head, ...rest] = L.top;
  return `<section class="chapter lineup" id="lineup" aria-labelledby="lineup-h" data-chapter="lineup" data-record="lineup">
  <div class="chapter__head">
    <h2 class="headline" id="lineup-h" data-split>${esc(head.name)} tops the lineup: <span class="n">${fmt(head.songs)}</span> songs.</h2>
    <p class="sub">Added by ${people(head.people)}. Then ${andList(rest.slice(0, 3).map(a => `${esc(a.name)} (${fmt(a.songs)})`))}. ${fmt(L.once)} of ${fmt(L.artists)} artists are here for a single song.</p>
  </div>
  <div class="lineup__headliner artist" data-people="${esc(head.adders.join(' '))}">
    <a class="lineup__pic" href="${spotifyArtist(head.id)}" aria-label="${esc(head.name)} on Spotify">${picture(head, { sizes: '(min-width: 760px) 360px, 92vw' })}</a>
    <div class="lineup__about">
      <h3 class="lineup__name"><a href="${spotifyArtist(head.id)}">${esc(head.name)}</a></h3>
      <p class="artist__meta">${plural(head.songs, 'song')} · added by ${people(head.people)}</p>
      <ol class="lineup__songs">${(head.titles || []).map(t => `<li><a href="${spotifyTrack(t.id)}">${esc(t.name)}</a></li>`).join('')}</ol>
    </div>
  </div>
  <ol class="lineup__list lineup__list--mid" start="2">${rest.slice(0, 3).map((a, i) => card(a, i + 2)).join('')}</ol>
  <ol class="lineup__list lineup__list--small" start="5">${rest.slice(3).map((a, i) => card(a, i + 5)).join('')}</ol>
  <p class="caption">${esc(L.rule)} Counts are unique songs; people are everyone who added one. Pictures from Spotify; each links to the artist.</p>
</section>`;
}

module.exports = { renderLineup };
