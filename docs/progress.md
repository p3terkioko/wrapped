# Progress log — dashboard rebuild

Running log for the KamiLimu.inthe.Ears rebuild. Newest entries at the bottom of each stage. "Check later" items are things Peter should verify himself.

## Ground rules in force (from Peter, 13 Oct 2026)

- Stages 2 → 8 run back to back; this log gets a summary at every stage boundary.
- Stop and ask only before anything that writes to, changes, or deploys to production, or for a decision that can't be made from the brief, audit, or research where a wrong guess costs more than a stage.
- Never run against the production database. Local work uses a separate dev database seeded from the read-only pull; the refresh job stays off locally.
- Work on a branch. Vercel preview deployments are allowed; production only after sign-off.
- The scroll film replaces the landing page and the old dashboard. (Story mode first stayed; Peter later asked for it to go, and it is removed.) Old URLs land on the film. The admin page stays.
- Corrections accepted as truth: Nairobi time for all time stats; 42 contributors plus 6 honestly-unknown tracks; 515 entries / 485 unique songs with the count named on screen; whole-playlist denominators; genre families with coverage and admin corrections; a defensible hidden-gem definition; cached API, slim payload, CDN static files; audio data from ReccoBeats → Deezer → essentia.js with coverage shown.

## Stage 1 — Audit (done)

See `docs/audit.md`. Story-mode baseline in `docs/baseline/story/`, old landing and dashboard in `docs/baseline/landing/` and `docs/baseline/dashboard/` (reference only).

## Housekeeping

- Committed production's uncommitted WIP, unchanged, on branch **`prod-snapshot`** (`172e8c5`), so the live state is preserved.
- Rebuild branch **`dashboard-rebuild`** created from `prod-snapshot`. `main` is untouched.
- Moved `motion-study.html` → `docs/reference/motion-study.html`.

## Stage 2 — Research (done)

Wrote `docs/research.md`: 21 rules, 12 conflicts between the brief and the research with fixes, inspiration notes, a measured tool table, and data-source constraints.

Decisions:
- **Native scroll, no Lenis.** Smooth-wheel interpolation changes the scroll rate, which is NN/g's definition of scrolljacking. It also breaks over the Spotify player iframe.
- **GSAP 3.15.0 + ScrollTrigger + SplitText** (≈ 50 KB gz, licence allows commercial websites). Motion, Scrollama, Rive, d3/Plot in the browser, three.js and Chart.js were rejected; layouts get computed server-side.
- **Spotify artwork is never animated, cropped, blurred or overlaid**, per Spotify's design guidelines. The brief's "covers assembling into one image" becomes one tile per song in its cover's extracted colour. Grain never covers artwork. Spotify logo attribution plus link-backs are required.
- **A persistent motion on/off control** (WCAG 2.2.2) for the looping motion: record spin and beat pulses.
- **Counters scrub against the timeline**, so every intermediate value is true at some date. No odometers rolling through false digits.
- **The persistent shape is a 7-inch 45 rpm single**, following East African singles culture, rather than an LP.

Check later:
- **essentia.js is AGPL-3.0.** It's only used in the local backfill script as an optional dependency and is never deployed. Confirm you're comfortable with that.
- Spotify's guidelines require their logo where Spotify content appears. The current site doesn't show it; the rebuild will.

## Stage 3 — Direction (done)

Built three style frames of "The people" chapter with real data, rendered at desktop and phone widths (`docs/direction/`):
- A Nganya (matatu night)
- B Seven Inch (1970s East African single)
- C Signal (current teal and mono, refined)

**Chosen: B "Seven Inch".** It's warm, cinematic and community-specific (the 7-inch single with a spider-adapter centre) without pastiche, and the record changes role cleanly. A read as nightlife/esports and its neon fights the data. C is the cold analytics look we're leaving behind. Reasoning and brand rules are in `docs/direction.md`.

Fixes found while looking at the frames:
- Phone bar charts truncated names in every direction → names go above bars on phones.
- Caption alpha 0.38 fails contrast → 0.56.
- The record's ring text needs fitting to its circumference.

Check later: Fraunces + Schibsted Grotesk + JetBrains Mono is three families. The font budget gets measured in Stage 8.

## Stage 4 — Data foundation (done)

- **Dev database:** PGlite on 127.0.0.1:5433 (`npm run dev:db`), seeded from a read-only Spotify pull (`dev:pull`, `dev:seed`). `.env.local` overrides `.env`. Write scripts refuse non-local databases (`scripts/lib/guard.js`). The local scheduler won't start against a non-local database.
- **Spotify client:** works under the 2026 Development Mode rules, with the old endpoints as a fast path (`/items` then `/tracks`; batch then single artists; profiles optional). Verified: the pull used `/items` and batch artists.
- **Enrichment:** per-source status on every track, final coverage of 487 tracks:
  - tempo 475 (ReccoBeats 404, essentia 66, Deezer 5); key 475;
  - lyric numbers 389 counted + 5 instrumental (no lyric text stored anywhere);
  - artwork colour 487/487; Deezer match 485/487;
  - MusicBrainz country for 248/494 artists.
- **Payloads:** film (≈ 70 KB raw / 15 KB br, inlined in the page), people, tracks (lazy), legacy (story mode). Rules in `docs/data.md`.
- **Admin:** password typed by the operator (the old page had `admin123` hard-coded in client code), name map, artist genre/country corrections, track corrections, community events, genre-family overrides, coverage report.
- **Cron:** rejects any request without `CRON_SECRET`, including when it isn't set.

Check later:
- **`CRON_SECRET` and `ADMIN_PASSWORD` must be set in Vercel** before deploy, or cron and admin will refuse everything.
- Production needs `prisma db push` and a backfill. Steps in `docs/data.md` § "Going to production". Both write to production, so they're yours to run.
- Under Development Mode rules, playlist contents are only returned to the playlist owner or a collaborator. The token is Peter's; the owner is tanuiii.

## Stage 5 — Motion system (done)

- `docs/motion.md`: GSAP 3.15 (self-hosted), native scroll, a beat grid from the median tempo (113 BPM), three easing families, scrub vs trigger vs pin rules, velocity caps, the reduced-motion and toggle behaviour, and a budget.
- **The page is rendered on the server**, so it's complete without JS: all numbers, charts as SVG with titles and descriptions. Scripts only add motion and lazy layers.
- **Fonts self-hosted:** 79 KB for four faces. The body face changed from Schibsted Grotesk (a 47 KB variable file) to a Fraunces text cut; recorded in `direction.md`.
- **Peter's feedback, applied:**
  - **No eyebrow labels anywhere.** Rule added to `direction.md`.
  - **Text clipping.** SplitText masks clipped italic overhangs and descenders; masks are now padded.
  - **The opening was too thin.** It's now a title sequence: the record with all 42 names pressed around the rim, a tonearm that drops on the beat, a label strip, a live latest-add readout, "Add a song", and "It started with one song".
  - **The mosaic should show real cover art.** It now shows the covers themselves, lazy-loaded in add order. They're never animated (Spotify rule); tiles appear by cut and Data Saver is respected.
  - **Scrolling was jumpy.** Measured with rAF frame timings, long-animation-frame attribution and CPU profiles. Fixes: direct scrubs, anticipatePin, ignoreMobileResize, trigger sort, isolated record layers, incremental mosaic drawing without per-tile clipping, and deduped DOM writes.
    - Desktop: frames over 50 ms went from 67 to 6 per scroll.
    - 4×-throttled phone: median frame went from 66 ms to 17 ms.

## Stage 6 — Chapters (done, first full pass)

The film now runs about 32,700 px on desktop (the motion study: 10,140), every chapter with real data and motion:
- **The opening:** title sequence, "It started with one song", the cover mosaic (pinned and scrubbed day by day), and the runtime weekend.
- **The people:**
  - ranking (whole-playlist shares, ties share a rank, unknown adders stated);
  - the month-by-month race (pinned scrub, re-sorting rows);
  - taste twins;
  - great minds (30 songs added twice);
  - 13 badges, with the four audio badges restored.
- **The sound:** genre families with the coverage rule stated, eras, the mood map (dots in cover colours), the 113 BPM heartbeat, the Camelot key wheel plus a 10-song "perfect mix" by 10 people, the language mix (with honest coverage), and geography as a ranked list (coverage under 60%, so no map).
- **The rhythm:** weekdays in Nairobi time (Thursday 119), the 24-hour radial clock (10am), a weekday × hour heatmap, a calendar, and binges and silences.
- **The picks:** song of the day (fixed at each refresh, the same for everyone that day), crowd favourite, hidden gem, deepest cut, oldest, newest (all playable in place), the nostalgia gap (3.7 years), and the longest musical conversation.
- **The credits:** all 42 names in order of appearance, then a finale whose closing frame rhymes with the opening (the record returns and the tonearm drops).

Decisions:
- Every claim in a headline is computed. "More than one in every five" is now provably true (ceil); the mood headline says "of the songs with audio data".
- "Hidden gem" excludes duplicates, zero-popularity copies and songs added within six months of release.
- "Deepest cut" is the song whose lead artist has the fewest followers.

## Story mode (moved, minimal fixes, compared — later removed)

- **Removed entirely at Peter's request** (commit 6568037): the 12-slide story, its CSS, loader and buttons are gone. The notes below are kept as the record of what it showed.
- Moved unchanged into `public/story/story.js`. `story.css` is untouched. `story-base.css` holds the few old base rules, scoped with `:where()` so specificity matches the old global rules. The old fonts load only when story mode opens.
- Reachable from the opening ("Play the 12-slide story") and the finale. Closing it returns to the same place in the film.
- **Code changes (3, approved):** "Built from N worlds" and the summary genre count use `totalGenres`; "Musical era" uses `musicTimeSpan` (whole playlist).
- **Compared with `docs/baseline/story/`** (new captures in `docs/baseline/story-after/`). 0.02–1.7% of pixels differ per slide. Every visible difference is data:
  - Slide 2: "Built from 6 worlds" → "168 worlds"; genres counted by songs (afro soul, afro r&b, afropop, gengetone, rumba congolaise, afrobeats).
  - Slide 4: "Treat You Better" → "End of Beginning" (Djo), both at 94/100 (the tie is broken differently); the artist line and "Listen on Spotify" now appear (they were blank before).
  - Slide 5: hidden gem "Tuendelee" 0/100 (a duplicate copy) → "Deborah", The Black Vaccine, 1/100; the artist line now appears.
  - Slide 6: "43 curators" → "42".
  - Slide 7: "afropop throne" → "afro soul throne".
  - Slide 9: vibe bars go from 50% placeholders to real values (energy 62, happiness 53, danceability 66, acoustic 29).
  - Slide 11: Genres 8 → 168, Curators 43 → 42, "afro soul sets the mood", energy 50% → 62%.
  - Slide 12: confetti positions vary (random, as before).
  - Slides 1, 3, 8, 10: unchanged.

## Stage 7 — Signature moments (done)

- **Find yourself.** Pick a name in the opening (works without JS as plain `?me=` links), or open a shared `?me=` link. The film re-centres:
  - **Marked in gold:** your bar (a "you" row is added when you're outside the top 10), your race row, your badges, your credits line, your mosaic tiles, your mood-map dots.
  - **Personal lines,** computed, under each headline. For Peter: first add was the 203rd song; 7th of 42; best month-end position 6th; taste twin Viv Mwirigi (6 shared artists); typical song from 2021; median 122 BPM; 11.6% Swahili/Sheng lines; Thursday; biggest session 5 songs.
  - A "Centred on …" chip clears it; the choice is remembered on the device.
  - **Personal link previews:** for `?me=` links the server writes the Open Graph title, e.g. "Peter added 19 songs to KamiLimu.inthe.Ears".
- **Musical conversations:** the longest reply chain is in the picks chapter (5 songs in 4 minutes); the rule is stated.
- **Colour follows the music.** The second light layer takes the cover colour in view (the first song, the newest mosaic tile while scrubbing, song cards, a song you press play on). It's scoped to the light layer, so nothing else restyles.
- **Live pulse.** The latest add is server-rendered from the last refresh. On idle the page asks `/api/public/pulse` (CDN-cached for five minutes), which reads the playlist's last page from Spotify, and updates the line if something newer has arrived.
- **Share cards.** "Share this" on every chapter draws a 1080×1920 card: the record (with the ring where the chapter has a share), the chapter's own headline with vermilion numbers, your personal line, and the link. It uses the native share sheet with the image where supported, otherwise downloads. No album artwork on cards (Spotify rule).

## After Stage 7 — Peter's requests

- **Charts:** vertical columns are HTML, not stretched SVG, so labels keep their size at any width; tap or focus a column to read its value.
- **Song cards:** Spotify's player gets the card's full width.
- **Binges and silences:** only the lead binge and the lead silence are labelled on the line; the rest are listed underneath (biggest binges, longest silences, community moments), so no labels collide.
- **Finale:** the long sources line is gone (Spotify's logo credit stays once, in the growth chapter). On phones the closing words sit below the record, as in the opening.
- **The Crate (`/dashboard`):** the dashboard as its own page, opened from the finale.
  - Every panel is a filter: people, genre families, release decades, weekday, month, hour, mood quadrant, Camelot key, plus search and "Only mine".
  - Each panel counts with every filter except its own, so you can see what you'd get by switching.
  - Filters live in the URL, so a cut can be shared.
  - The tracklist has four sorts and plays songs in place.
  - The half record in the corner names the current cut.
  - Checked: East African + Thursday → 22 songs, 8 people, 34 artists, 1 h 22 m, 120 BPM; no console errors at 1440 and 390 px.

## Going live — status

- **Schema change (checked offline against main's schema):** additive only. It adds 7 tables (tracks, playlist_entries, artists, contributors, community_events, settings, payloads), 3 indexes and 1 foreign key between the new tables. `PlaylistData` and `UpdateLog` are not touched.
- **Order that keeps the live site up:**
  1. Back up the production tables.
  2. Run `prisma db push` (additive; the old live code ignores the new tables).
  3. Load the catalogue and compute the payloads.
  4. Merge to main.
  Merging first would deploy code whose tables don't exist yet, and the site would show "unavailable".
- **Done 13 Oct 2026 with Peter's go-ahead,** via `scripts/migrate-production.js` (a dry run first, then `--apply`):
  - **Backup:** `.cache/prod/backup-*.json`, covering playlist_data (1 row) and update_logs (133 rows).
  - **Schema:** the 11 additive statements were checked against the live database and applied with `prisma db push`.
  - **Copied from the local copy:** 42 contributors, 494 artists, 487 tracks, 515 entries, and the playlistMeta setting. It held no admin corrections or test events.
  - **Fresh Spotify sync:** 0 new songs.
  - **Payloads:** version 42891e69f69c.
  - **Totals in production:** 515 entries, 485 unique songs, 42 people, 494 artists, all equal to local.
- The PR merge went out before the migration and had two faults:
  - `/` hit Vercel's 404, because `/:path*` doesn't match the bare root. Fixed with an explicit `/` rewrite.
  - The other pages said "being refreshed" until the data landed.
- **Still Peter's:**
  - Set `CRON_SECRET` in Vercel; without it the daily refresh is refused.
  - Set `ADMIN_PASSWORD`; without it `/admin` is disabled.
  - Apply the Sauti Sol and Mutoriah genre corrections in `/admin`.

## After go-live (14 Oct 2026)

- **The site follows the playlist.** When the live check (`/api/public/pulse`, which runs on every visit to the film or the Crate) sees a song newer than the data, it rebuilds everything: sync, enrichment of the new song, payloads.
  - It runs at most once every 10 minutes, guarded by an atomic lock row in `settings`. Cron and admin runs take the same lock, so two refreshes never overlap.
  - Pages and payloads now stay at the CDN for 60 s, so the mosaic, charts and the Crate show a new song within a couple of minutes.
  - Tested locally: Michelle's add was picked up in 18 s, giving 516 songs.
- **Song of the day changes at Nairobi midnight** without a refresh. Each refresh schedules the next 31 days, and the page picks today's at render time.
  - The pick uses rendezvous hashing over the date and each song: adding a song changes a day's pick only if the new song wins. Before this, the pick was tied to the refresh date and could jump when a song was added.
- **The weekday chart is honest in every frame.**
  - The "breathing" beat loop on its bars is gone: it fought the reveal transition, and each bar trailed it by its own delay.
  - Bars in a chart now grow together.
  - The value labels sit in reserved headroom, so the tallest bar is no longer squeezed.
