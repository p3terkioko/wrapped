# Stage 1 audit (13 October 2026)

What exists, what the live data really says, and how this Spotify app behaves today. Numbers come from a read-only pull of the playlist on 13 Oct 2026 (515 items, 494 artists) and the production payload refreshed at 06:58 UTC the same day.

## 1. Repo state

- **Uncommitted work in progress** in `.gitignore`, `public/script.js`, `public/style.css`, `src/routes/admin.js`, `src/services/insights.js`: avatars, a mood timeline, a sonic-fingerprint panel, a scrolling members list, and hiding Key & Tempo when there is no audio data. **Production is already running this uncommitted code** (the live payload contains `moodTimeline`), so it was deployed from the working copy with the Vercel CLI.
- `motion-study.html` is untracked at the repo root, not at `docs/reference/`.
- `README.md` is UTF-16 encoded and out of date (221 tracks, 26 contributors, file caching).
- **Local `.env` is risky:** `NODE_ENV=production`, `ENABLE_SCHEDULER=true` and `DATABASE_URL` pointing at the production Prisma Accelerate database. A plain `npm run dev` starts a daily 09:00 EAT job that writes to production. Run locally with `ENABLE_SCHEDULER=false NODE_ENV=development`. `SPOTIFY_REFRESH_TOKEN` appears twice (the second wins).
- `/api/admin/cron/refresh` checks `CRON_SECRET` only if it is set. It is not in the local `.env`; if it is also unset in Vercel, anyone can trigger a full refresh. `ADMIN_PASSWORD` falls back to `admin123`.
- `vercel.json` routes every path, static files included, through the serverless function, so CSS and JS get no CDN caching (`max-age=0`) and pay cold starts.

## 2. Spotify: how this app behaves

The developer dashboard is the only place that names the quota mode. This is what the API does for this app:

| Probe | Result | What Development Mode (after 9 Mar 2026) would do |
| --- | --- | --- |
| `GET /playlists/{id}/tracks` | 200; items carry both `track` and `item` | 403 (renamed to `/items`) |
| `GET /playlists/{id}/items` | 200 | 200 |
| `GET /artists?ids=` (batch) | 200 | removed |
| `GET /users/{id}` | 200 | removed |
| `GET /tracks?ids=` (batch) | 200 | removed |
| `popularity` on track and artist, `followers` on artist | present | removed |
| `/me` `product`, `country` | present (owner of token: Peter, **premium**) | removed |
| `GET /search` with `limit=20` | 200, 20 results | max 10 |
| `external_ids.isrc` | present on 515 of 515 | kept (removal reverted in March 2026) |
| `preview_url` | null on 515 of 515 | deprecated |
| `GET /audio-features`, `/audio-analysis` | **403** | 403 |
| `GET /artists/{id}/related-artists`, `/recommendations` | **404** | 404 |

**Conclusion:** the February 2026 Development Mode restrictions are **not applied** to this app; it behaves like Extended Quota. Only the November 2024 restrictions apply (no audio features, analysis, related artists or recommendations).

**Risk if that changes:** the token belongs to Peter, the playlist belongs to `tanuiii`, and the playlist reports `collaborative=false`. Under Development Mode rules, contents are returned only to the owner or a collaborator. The two official pages disagree on this point: the changelog says the user's own playlist only, while the migration guide says owned or collaborated. If the app is ever moved to those rules, the refresh could lose the playlist entirely unless the token belongs to the owner or a recognised collaborator.

## 3. The brief's data claims, verified

| Claim | Verified | Notes |
| --- | --- | --- |
| 515 tracks | yes | **30 are duplicates** (485 unique songs by ISRC; 487 unique track IDs). Every duplicate was added by a different person from the original. |
| 32h 45m runtime | yes | "Friday 6pm → still going 2:45am Sunday" is correct. |
| 494 artists | yes | Counts any credited artist. |
| 168 genres | yes | Only **318 of 494 artists** have genre tags, covering **365 of 515 tracks (71%)**. |
| ~43 contributors | partly | **42 people** plus 6 tracks with no `added_by` (all added 14 Mar 2024). The code counts "unknown" as a contributor. |
| First track 13 Mar 2024 | yes | Added by tanuiii, 13:29 EAT. |
| 309 of 515 from the 2020s; oldest 1960s | yes | Oldest: 1967. Newest: 19 Aug 2026. 15 release dates are year-only. |
| Dr. C 114 (22%); then 50, 43, 28, 20 | yes | 20 is a tie: 0xFidel and Nchekukathryn. |
| Thursday 115, Friday 105 | **no** | Computed in server time (UTC). **In Nairobi time: Thu 119, Fri 88, Mon 70, Wed 68, Sat 68, Sun 51, Tue 51.** Peak hour 10:00 EAT (79 adds). |
| Top genres by artist count | yes | Matches exactly. **By track count the list changes:** afro soul 118, afro r&b 92, afropop 89, gengetone 83, rumba congolaise 71, afrobeats 69, afrobeat 65, bongo flava 58, afropiano 54, amapiano 38. |
| Every audio-feature value is zero | partly | Per-contributor averages are 0. Playlist-level values are **placeholders (0.5 and 120 BPM)**, which story mode shows as real (see 4). |

Other computed facts:

- Milestones by add date: 1st, tanuiii (13 Mar 2024); 100th, 0xFidel (7 Apr 2024); 250th, Dr. C (29 Jul 2025); 500th, Tams (27 Sep 2026). Latest add: 13 Oct 2026 by Tams. **Caveat:** removed songs leave no trace, so "Nth song" means Nth among songs still in the playlist.
- Median "nostalgia gap" (song age when added): 3.75 years.
- 85 of 515 tracks are explicit.
- **Genre tags are noisy for Kenyan artists:** Spotify tags Sauti Sol, Mutoriah, Bien, King Kaka, Bensoul and others as "rumba congolaise", and Bien alone carries 8 genres. Counting a track under every tag of every artist inflates the totals. The sound chapter needs genre families or a primary-genre rule, with coverage stated.
- **ISRC country prefix is not artist origin** (US 175, QZ 110 and QM 31 are distributor codes). Geography needs MusicBrainz.

## 4. Honesty and bug list (current dashboard and story)

1. Leaderboard "% of playlist" divides by the **top-10 total**, not 515: Dr. C shows **34%**; the truth is 22.1%.
2. The genre chart says "by track count" and its tooltip says "tracks", but it counts artists.
3. Most Popular and Hidden Gem: the payload has `artist` and no Spotify URL, but the UI reads `artists` and `external_urls`, so the artist line is blank and there is no link (dashboard, and story slides 4–5).
4. Hidden Gem is the minimum popularity, which is 0. 37 tracks have popularity 0, and they look like relinked duplicates of well-known songs (for example Nyashinski 2024), not obscure picks.
5. "Members" uses `totalMembers = max(contributors, followers)` and `listenerCount = followers − contributors`. Both are invented relationships.
6. Genre Maestros: 9 of 12 go to Dr. C. The award measures volume, not taste.
7. Day of week is computed in UTC.
8. Only the top 10 contributors get full analytics, so "find yourself" cannot work for the other 32 without a new payload.
9. **Story mode** shows "Built from 6 worlds" and "8 Genres" (slice lengths; the real figure is 168), "43 curators" (includes unattributed tracks), and vibe-check bars plus "50% average energy" taken from placeholder values. Its vibe-bar animation fires on slide 8 instead of 9 (harmless).

## 5. Enrichment sources (fixed 40-track sample: every 13th track)

| Source | Hit rate | Notes |
| --- | --- | --- |
| ReccoBeats `GET /v1/audio-features?ids=<spotify ids>` | 30/40 (75%) | Returns tempo, key, mode, energy, valence, danceability, acousticness, instrumentalness, liveness, loudness, speechiness and ISRC. No key needed. The terms allow free commercial use, but the service may shut down "at any time … without prior notice". |
| Deezer `GET /track/isrc:{isrc}` | 40/40 | `rank` 40/40, `gain` 40/40, `preview` 38/40, but **`bpm` only 12/40**. Tempo gaps need essentia.js on the previews. |
| MusicBrainz `GET /ws/2/isrc/{isrc}` | 8/15 | Geography will be partial; artist origin needs a second lookup per artist. |
| LRCLIB `GET /api/get` (exact match) | 10/20 | The search endpoint may raise this. Only counts were kept; no lyric text was printed or stored. |

## 6. Performance

- `/api/public/data`: 104 KB raw (29 KB brotli). **81% of it is the top-10 contributors' raw track arrays.** It is uncached (`max-age=0`) and takes 3–5 s per request, because every hit reads Postgres through Prisma Accelerate from iad1 (US East).
- Throttled phone run (about Slow 4G, 4× CPU): landing LCP 1.4 s, **data visible after 4.9 s**, 301 KB transferred, CLS 0.002.
- Dashboard height: 5,499 px on desktop, 7,514 px on phone.

## 7. Story-mode coupling (constraints for the rebuild)

- Story mode shares `index.html`, `script.js` and `style.css` with the dashboard (it depends on the `.btn-primary`, `.btn-ghost`, `.track-spotify-link` and `.hidden` classes, the reset, and the tokens). It is reachable only from the dashboard (`#view-story-btn`); exiting returns to the dashboard.
- It reads these payload fields: `playlist`, `topGenres`, `topArtists`, `mostPopular`, `leastPopular`, `contributors.totalContributors`, `contributors.contributors[].tracks`, `dateRange`, `audioFeatures`, `totalUniqueArtists`. The rebuilt pipeline must keep these fields in their current shape.
- Baseline screenshots of all 12 slides, at 1440×900 and 390×844, are in `docs/baseline/story/` for regression checks.
