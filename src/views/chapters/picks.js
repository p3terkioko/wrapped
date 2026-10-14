'use strict';

// The picks: songs that matter, playable in place, and the closing credits.

const { esc, fmt, date, time12, spotifyTrack, artwork, plural } = require('../util');
const { hbars } = require('../charts');
const nbo = require('../../lib/nairobi');

function single(song, { kicker, why, rule }) {
  if (!song) return '';
  return `<article class="single" data-song="${esc(song.id)}"${song.colour ? ` style="--song:${esc(song.colour)}"` : ''}>
    ${song.image ? `<img class="single__art" src="${artwork(song.image)}" width="300" height="300" alt="Album artwork for ${esc(song.name)} by ${esc(song.artists)}" loading="lazy" decoding="async">` : '<span class="single__art single__art--none"></span>'}
    <div class="single__meta">
      <h3 class="single__name"><a href="${spotifyTrack(song.id)}">${esc(song.name)}</a></h3>
      <p class="single__artist">${esc(song.artists)}${song.year ? ' · ' + song.year : ''}</p>
    </div>
    <p class="single__why"><em>${esc(kicker)}.</em> ${why}</p>
    <button type="button" class="btn btn--small single__play" data-play="${esc(song.id)}" aria-label="Play ${esc(song.name)} here">Play here</button>
    ${rule ? `<p class="caption single__rule">${esc(rule)}</p>` : ''}
  </article>`;
}

function renderPicks(film) {
  const p = film.picks;
  // Today's pick by the Nairobi date at render time (the page is re-rendered
  // at least every minute), falling back to the pick made at the last refresh.
  const sod = p.songsOfDays?.[nbo.dayKey(Date.now())] || p.songOfDay;
  const nost = p.nostalgia;
  const cards = [
    single(p.mostPopular, { kicker: 'The crowd favourite', why: `Added by ${esc(p.mostPopular?.addedBy)}. The most popular song here on Spotify, at ${fmt(p.mostPopular?.popularity)} out of 100.`, rule: 'Spotify popularity (0–100) reflects recent plays across all of Spotify.' }),
    single(p.hiddenGem, { kicker: 'The hidden gem', why: `Added by ${esc(p.hiddenGem?.addedBy)}. Spotify popularity ${fmt(p.hiddenGem?.popularity)} out of 100.`, rule: p.hiddenGemRule }),
    single(p.deepestCut, { kicker: 'The deepest cut', why: `${esc(p.deepestCut?.artist)} has ${fmt(p.deepestCut?.followers)} followers on Spotify. Added by ${esc(p.deepestCut?.addedBy)}.`, rule: p.deepestCutRule }),
    single(p.oldest, { kicker: 'The oldest', why: `Released ${esc(String(p.oldest?.released || '').slice(0, 4))}. Added by ${esc(p.oldest?.addedBy)}.` }),
    single(p.newest, { kicker: 'The newest', why: `Released ${p.newest?.released ? esc(date(p.newest.released + (p.newest.released.length === 10 ? 'T12:00:00+03:00' : '-01T12:00:00+03:00'))) : ''}. Added by ${esc(p.newest?.addedBy)}.` }),
  ].join('');
  const conv = p.conversation;
  return `<section class="chapter picks" id="picks" aria-labelledby="picks-h" data-chapter="picks" data-record="picks">
  <div class="chapter__head">
    <h2 class="headline" id="picks-h" data-split>Today's song is <span class="n">${esc(sod.name)}</span>.</h2>
    <p class="sub">${esc(sod.artists)}${sod.year ? ', ' + sod.year : ''}. A new one is picked every day at midnight, Nairobi time.</p>
  </div>
  ${single(sod, { kicker: 'Song of the day', why: `Added by <b>${esc(sod.addedBy)}</b> on ${esc(date(sod.addedAt))}. ${sod.family ? esc(sod.family) + ' · ' : ''}one of ${fmt(film.totals.uniqueSongs)} songs.` })}
  <div class="singles">${cards}</div>
</section>
<section class="chapter nostalgia" id="nostalgia" aria-labelledby="nost-h" data-chapter="nostalgia" data-record="nostalgia">
  <div class="chapter__head">
    <h2 class="headline" id="nost-h" data-split>A song is usually <span class="n">${fmt(nost.medianYears)}</span> years old when someone adds it.</h2>
    <p class="sub">${fmt(nost.buckets[0].n)} songs went in within a month of release. ${fmt(nost.buckets[4].n)} were over twenty years old.</p>
  </div>
  <div class="chapter__narrow">
    ${hbars(nost.buckets.map((b, i) => ({ label: b.label, value: b.n, highlight: i === 2 })), { share: r => (r.value / nost.of) * 100 })}
    <p class="caption">Age of each song when it was added: the time from its release date to the day it entered the playlist, for all ${fmt(nost.of)} entries.</p>
  </div>
</section>
${conv ? `<section class="chapter convo" id="conversation" aria-labelledby="convo-h" data-chapter="convo" data-record="convo">
  <div class="chapter__head">
    <h2 class="headline" id="convo-h" data-split>The longest musical conversation: <span class="n">${fmt(conv.length)}</span> songs in ${fmt(conv.minutes)} minutes.</h2>
    <p class="sub">${fmt(conv.people)} people, replying to each other one song at a time on ${esc(date(conv.turns[0].at))}.</p>
  </div>
  <ol class="convo__list" data-reveal="fade">${conv.turns.map((t, i) => `<li class="turn${i % 2 ? ' turn--b' : ''}"><span class="turn__who">${esc(t.name)} <time>${esc(time12(t.at))}</time></span><a class="turn__song" href="${spotifyTrack(t.song.id)}">${esc(t.song.name)}</a><span class="turn__artist">${esc(t.song.artists)}</span></li>`).join('')}</ol>
  <p class="caption">${esc(conv.rule)}</p>
</section>` : ''}`;
}

function renderCredits(film) {
  const c = film.credits;
  const t = film.totals;
  return `<section class="chapter credits" id="credits" aria-labelledby="credits-h" data-chapter="credits" data-record="credits">
  <div class="chapter__head">
    <h2 class="headline" id="credits-h" data-split>Pressed by <span class="n">${fmt(c.roll.length)}</span> people, in order of appearance.</h2>
  </div>
  <ol class="roll">${c.roll.map(p => `<li class="roll__row" data-id="${esc(p.id)}"><span class="roll__name">${esc(p.name)}</span><span class="roll__what">${plural(p.n, 'song')}${p.family ? ' · ' + esc(p.family) : ''}${p.topArtist ? ' · ' + esc(p.topArtist) : ''}</span><span class="roll__when">since ${esc(date(p.first, { month: 'short' }))}</span></li>`).join('')}
    ${c.unattributed ? `<li class="roll__row roll__row--unknown"><span class="roll__name">and someone unrecorded</span><span class="roll__what">${plural(c.unattributed, 'song')} with no adder on record</span><span class="roll__when"></span></li>` : ''}
  </ol>
  <p class="caption">Each line: songs added, the genre family they added most, and the artist they added most.</p>
</section>
<section class="chapter finale" id="finale" aria-labelledby="finale-h" data-chapter="finale" data-record="finale">
  <h2 class="title" id="finale-h" aria-label="KamiLimu.inthe.Ears"><span class="line" data-split>KamiLimu</span><span class="line dim" data-split>.inthe.Ears</span></h2>
  <p class="lede"><span class="n">${fmt(t.entries)}</span> songs and counting. The record's still spinning. What's the next one?</p>
  <div class="actions">
    <a class="btn btn--primary" href="/dashboard">Open the dashboard</a>
    <a class="btn" href="${esc(film.playlist.url || 'https://open.spotify.com/playlist/' + film.playlist.id)}" rel="noopener">Add a song ↗</a>
    <a class="btn" href="#opening" data-find-open>Find yourself</a>
    <button type="button" class="btn" data-share>Share</button>
  </div>
</section>`;
}

module.exports = { renderPicks, renderCredits };
