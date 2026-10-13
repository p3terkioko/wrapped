# Progress log — dashboard rebuild

Running log for the KamiLimu.inthe.Ears rebuild. Newest entries at the bottom of each stage. "Check later" items are things Peter should verify himself.

## Ground rules in force (from Peter, 13 Oct 2026)

- Stages 2 → 8 run back to back; this log gets a summary at every stage boundary.
- Stop and ask only before anything that writes to, changes, or deploys to production, or for a decision that can't be made from the brief, audit, or research where a wrong guess costs more than a stage.
- Never run against the production database. Local work uses a separate dev database seeded from the read-only pull; the refresh job stays off locally.
- Work on a branch. Vercel preview deployments are allowed; production only after sign-off.
- The scroll film replaces the landing page and the old dashboard. Story mode stays, reachable from the opening and the closing frame. Old URLs land on the film. The admin page stays.
- Corrections accepted as truth: Nairobi time for all time stats; 42 contributors plus 6 honestly-unknown tracks; 515 entries / 485 unique songs with the count named on screen; whole-playlist denominators; genre families with coverage and admin corrections; a defensible hidden-gem definition; cached API, slim payload, CDN static files; audio data from ReccoBeats → Deezer → essentia.js with coverage shown.

## Stage 1 — Audit (done)

See `docs/audit.md`. Story-mode baseline in `docs/baseline/story/`, old landing and dashboard in `docs/baseline/landing/` and `docs/baseline/dashboard/` (reference only).

## Housekeeping

- Committed production's uncommitted WIP, unchanged, on branch **`prod-snapshot`** (`172e8c5`), so the live state is preserved.
- Rebuild branch **`dashboard-rebuild`** created from `prod-snapshot`. `main` is untouched.
- Moved `motion-study.html` → `docs/reference/motion-study.html`.
