# Data pipeline

How the playlist becomes the film's data. Written for whoever maintains this next.

## Flow

```
Spotify ──sync──▶ tracks / playlist_entries / artists / contributors   (src/services/sync.js)
                      │
        enrichment ◀──┘  colour · ReccoBeats · Deezer · LRCLIB · MusicBrainz   (src/services/enrich)
        (+ essentia.js locally, scripts/audio)
                      │
        compute ──────▶ payloads: film · people · tracks · legacy          (src/services/compute, payloads.js)
                      │
        public API ───▶ /api/public/film | people | tracks | data | pulse   (src/routes/public.js)
```

- **Refresh** (`POST /api/admin/refresh`, daily Vercel Cron): sync from Spotify, enrich new or pending songs until ~42 s have passed, then recompute. Fits the 60 s function limit.
- **Backfill** (`npm run backfill`, local): every source for every song, at polite rates (MusicBrainz is 1 request per second), plus essentia.js for songs still missing tempo or key. Then recompute.
- **Recompute** (`POST /api/admin/recompute`, and after every admin correction): payloads only, no network.

## Tables (prisma/schema.prisma)

| Table | Holds |
| --- | --- |
| `tracks` | One row per Spotify track: metadata, audio features with `tempoSource`/`keySource`/`featuresSource`, Deezer rank/bpm, lyric-derived numbers, artwork colour, `enrichment` (per-source attempt log), `overrides` (admin corrections). |
| `playlist_entries` | The playlist in order: track, `addedAt`, `addedBy` (null when Spotify has no record). Replaced on every sync. |
| `artists` | Genres (with fetch date), popularity, followers, MusicBrainz origin; `overrides` for corrected genres/country. |
| `contributors` | Spotify user id → display name, avatar, admin name (wins). |
| `community_events` | Admin-entered moments for the rhythm timeline. |
| `settings` | `playlistMeta`, `genreFamilies` overrides. |
| `payloads` | Precomputed JSON served by the API, with a version hash. |
| `playlist_data`, `update_logs` | Unchanged from before. `playlist_data` still receives the legacy payload so a rollback works. |

## Rules the numbers follow

- **Time:** Africa/Nairobi (UTC+3, no DST) for every date, weekday and hour.
- **Count bases:** *entries* (515, every add) for people, time, runtime, growth. *Unique songs* (485, one per ISRC) for genres, eras, tempo, key, mood, language, geography and picks. *Artists* for artist counts. Each chart says which.
- **Denominators:** shares use the whole playlist.
- **Unknown adders:** the 6 entries with no `added_by` stay as "unknown"; they count in totals and never in anyone's share.
- **Genre families:** one primary family per song (rule in `src/services/genres.js`); coverage = songs whose artists have any genre tag.
- **Coverage:** every chart built from enriched data carries `{ songs, of }`, and the UI prints it.
- **Lyrics:** fetched from LRCLIB, reduced in memory to word counts and per-line language counts, then discarded. No lyric text is stored, logged or sent to the browser.
- **Previews:** Deezer previews are analysed in memory by essentia.js (local only) and never stored.

## Source precedence

| Value | Order (first wins) |
| --- | --- |
| tempo | admin → ReccoBeats → Deezer `bpm` → essentia |
| key / mode | admin → ReccoBeats → essentia (only with key strength ≥ 0.5) |
| energy, valence, danceability… | admin → ReccoBeats |
| country | admin → MusicBrainz (lead artist) |
| genres | admin → Spotify artist genres |

Failed lookups retry after a day; "not found" retries after 30 days. `npm run backfill -- --retry-errors` retries failures immediately.

## Spotify, now and later

The client works under the February 2026 Development Mode rules and uses the old endpoints only as a fast path:
- playlist rows from `/items` (falls back to `/tracks`), reading `item.item ?? item.track`;
- artists by batch while `/artists?ids=` exists, then single lookups (cached 30 days);
- names from `/users/{id}` while it exists, otherwise from the admin name map;
- popularity and followers are optional everywhere (picks and badges that need them disappear rather than break).

**Watch-out:** under Development Mode rules, playlist contents are returned only to the playlist's owner or a collaborator. The refresh token currently belongs to Peter, and the playlist is owned by `tanuiii`. If the app is moved to Development Mode rules, use a refresh token from the owner (or a collaborator) or the playlist rows will disappear.

## Running it locally

```bash
cp .env.local.example .env.local      # dev database URL, scheduler off, dev admin password
npm run dev:db                        # terminal 1: local Postgres (PGlite) on 127.0.0.1:5433
npm run dev:push                      # create tables in the dev database
npm run dev:pull                      # read-only snapshot of the playlist → .cache/pull.json
npm run dev:seed                      # load it into the dev database
npm --prefix scripts/audio install    # optional: local tempo/key analysis (essentia.js, AGPL)
npm run backfill                      # enrich everything and compute payloads (~30 min)
npm start                             # http://localhost:3000, admin at /admin
```

Write scripts refuse to run unless `DATABASE_URL` points at localhost (`scripts/lib/guard.js`). Plain `npx prisma …` reads `.env`, which may point at production: use `npm run dev:push`.

## Going to production (needs Peter's sign-off; not done)

1. In Vercel → Settings → Environment Variables (Production): set `ADMIN_PASSWORD` (the admin no longer falls back to a default) and `CRON_SECRET` (the cron route now rejects requests without it).
2. Add the new tables to the production database: `npx prisma db push` with the production `DATABASE_URL`. This only adds tables; the two existing ones are unchanged.
3. Fill them: `ALLOW_PRODUCTION_DB=yes-i-mean-production npm run backfill -- --sync` with the production `DATABASE_URL` in the environment (about 30 minutes, from a laptop).
4. Deploy the branch to production.
5. Check `/admin` → Status shows the payload version and `CRON_SECRET: set`; open the site; story mode from the opening and the closing frame.
