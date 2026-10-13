# Creative direction — chosen: **Seven Inch**

Stage 3, 13 Oct 2026. Three directions were built as still style frames of the same chapter ("The people", real data, a sample "find yourself" line for Peter) and rendered at 1440×900 and 390×844. Frames live in `docs/direction/frames/`, renders in `docs/direction/*.png`.

This file is the brand rules file for the build: where it conflicts with a default, this file wins. Where it conflicts with `docs/research.md` rules (safety, honesty, performance), research wins.

---

## The three directions

### A — Nganya
*A matatu at night.* LED strips in magenta and UV violet cut diagonally across a blue-black night, an airbrushed gradient label on the record, and condensed black signage type (Archivo at 62% width) that shouts the finding in caps.
- **Palette:** night `#07060b`, ink `#f6f2ec`, magenta `#ff2e88`, UV `#7a5cff`, amber `#ffb52e`.
- **Type:** Archivo (variable width) for display and body; Martian Mono for data.
- **Motion character:** fast cuts and light sweeps; strips pulse on the beat; type snaps in at full width and compresses.
- **Verdict:** the most *alive*, and the most local in energy, but it reads as nightlife or esports advertising rather than premium. Magenta glow competes with the data accent, and all-caps condensed names are harder to read. It sits closest to the "themed" trap the brief warns about.

### B — Seven Inch ✔
*A 1970s East African 45 on a lacquer-black night.* The persistent shape is a 7-inch single: lacquer with fine grooves, a cream paper centre label with ringed text, and the large centre hole held by a gold three-armed spider adapter (the jukebox-single detail). Headlines are set in a soft, slightly wonky display serif with the warmth of 70s sleeve lettering. Numbers are performed in italic vermilion. Data sits in a quiet monospace.
- **Palette:** lacquer `#0e0b09`, lacquer-2 `#17120e`, label cream `#f3e9d6`, vermilion `#ff5b33` (the accent; one per screen), gold `#e9b44c` (you / personal), label green `#1d5c45` (label print only). Text alphas: 1.0 / 0.66 / 0.56 (captions; 0.56 keeps small text above 4.5:1).
- **Type:** **Fraunces** (SOFT 100, WONK 1, opsz 144; 800 roman for headlines, 400–700 italic for numbers and asides); **Schibsted Grotesk** for body copy; **JetBrains Mono** for data, labels and captions (kept from the old identity, and shared with story mode).
- **Motion character:** a film title sequence. Words rise out of a baseline mask on the beat and land with `expo.out`; numbers arrive in italic as if hand-set; the record spins at a true **45 rpm** while the film plays and settles when you stop. Light is warm and directional, tinted by the album art in view. Cuts between chapters are colour cuts and label changes, not long travels.
- **Verdict:** chosen. See below.

### C — Signal
*The current identity, refined.* Teal on near-black, JetBrains Mono 800 headlines, Hind Guntur body, a hairline 12-column grid, and a tick-marked dial around a teal label.
- **Palette:** `#050606`, ink `#f4f6ee`, teal `#00b4c2` / `#4dd0da`, deep teal `#003d42`, gamboge `#eaa000`.
- **Type:** JetBrains Mono and Hind Guntur.
- **Motion character:** precise and metronomic; ticks and hairlines draw on the beat.
- **Verdict:** clean, cheapest to build, and continuous with the old site, but it is the "analytics tool" the brief is trying to leave: cold, generic, and monospace headlines read as a developer console. It has no warmth and nothing specific to the community.

---

## Why Seven Inch

1. **It hits the brief's words.** Cinematic (title-sequence type, directional light, grain), confident (huge editorial headlines with the number in them), warm (cream, vermilion, gold on warm black), alive and rhythmic (a record that actually turns at 45 rpm, entrances on the beat).
2. **It is specific to this community, without costume.** East African popular music lived on 7-inch singles; the spider-adapter centre and the paper label make the shape unmistakably a *single* (one song, added by one person), which is exactly the unit this playlist is made of. Nothing in it is pastiche of matatu art or "African pattern" decoration.
3. **The record can change role cleanly.** A label is a natural place for chapter titles, a person's name, a catalogue number (entries count), or an album colour. The ring around it is a natural share gauge, clock face, key wheel (Camelot) and progress ring. That's the "one shape that never cuts".
4. **It leaves room for the music's own colour.** Neutral lacquer and cream accept tinted light from album art without clashing; A's neon would fight it.
5. **It reads on a phone.** At 390 px the italic vermilion number is the first thing you see, names sit above their bars untruncated, and the record stays fully on screen.

**Borrowed from the others:** from A, the idea that light is *colour from the music* (the album art in view tints the room, like matatu LED strips); from C, JetBrains Mono for data (continuity, and story mode already loads it).

---

## Brand rules (bind the build)

**Composition**
- One finding per screen. The headline is a full sentence containing the number; the number is italic vermilion. A second, quieter italic line can carry the human version ("More than one in every five").
- Vermilion marks the subject of the headline only. Everything else is cream at 0.66 or 0.56, or neutral grey bars. Gold is reserved for *you* (find yourself) and for the playhead.
- Charts are labelled directly. On phones, names sit above bars. Values show the count and its share of the stated whole.
- Captions (JetBrains Mono, 12.5 px, 0.56) state the basis and coverage on every chart.
- No chapter numbers, no slide counters, no wordmark parked in a corner. The only fixed UI is the motion toggle and, once chosen, the "you" chip.

**The record**
- Built in SVG from tokens: lacquer body, grooves, sheen fixed to the light (the sheen never rotates; only the label and grooves do), cream label, ring text fitted to the circumference, gold spider adapter.
- Its label text changes per chapter (chapter name, the person, the decade, the key). The outer ring carries one quantity at a time: a share, a time of day, a key position, or progress.
- It spins at 45 rpm (270°/s) while the film is in motion, speeds up slightly with scroll velocity (capped), and settles to still after one beat of no scroll. Reduced motion or motion-off: still.

**Type**
- Fraunces 800 for headlines (`"SOFT" 100, "WONK" 1, opsz 144`), tracking −0.02em, line-height 0.95, `text-wrap: balance`. Italic 400–700 for numbers and asides.
- Schibsted Grotesk 400/500 for body (≥ 16 px on phone), JetBrains Mono 400/600 for data.
- Tabular figures for any number that changes.

**Light and texture**
- Background: lacquer with one warm radial light (gold at ~16%) placed behind the record, plus a second light tinted by the current album colour.
- Grain at ≤ 9% opacity, static, and behind artwork. A soft vignette at the edges only.
- Album artwork is never under grain, overlay, blur or crop (Spotify rule), and corners are 4 px (small) or 8 px (large).

**Motion character**
- Ease families: `expo.out` for arrivals, `power2.inOut` for the record's travel between roles, `none` for anything scrubbed to time.
- Durations and staggers are multiples of the beat (full spec in `docs/motion.md`).
- Entrances: words rise from a baseline mask (yPercent 110 → 0) and land; no letter-by-letter fades; no bounces.
- Transitions between chapters: a colour cut of the light plus a label change on the record. No full-screen wipes.

## Fixes found in the frames (carried into the build)
- Ring text must be fitted to its circumference (`textLength`) or it collides with itself.
- Share labels sit beyond the arc head, never on top of the arc.
- Phone charts: names above bars (implemented in frame B).
- Caption alpha raised from 0.38 to 0.56 for contrast.
