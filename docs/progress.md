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
