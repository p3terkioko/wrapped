# Local audio analysis (backfill only)

Estimates tempo and key from Deezer's 30-second previews for songs that ReccoBeats and Deezer don't cover.

- Install once: `npm --prefix scripts/audio install`
- Used by `npm run backfill` when this folder's dependencies are installed; skipped otherwise.
- Previews are analysed in memory and never written to disk or the database (Deezer forbids storing audio).
- **Licence note:** essentia.js is AGPL-3.0. This folder has its own `package.json` so the library is never installed by Vercel or bundled into the site or the API. Only the resulting numbers (tempo, key, mode) are stored, tagged `essentia`.
