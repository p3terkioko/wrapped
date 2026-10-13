# Research — KamiLimu.inthe.Ears scroll film

Stage 2, written 13 Oct 2026. What I read, the rules I will hold myself to, where the brief and the research disagree (and the fix), inspiration notes, and the technical constraints that shape the build. Sources are listed at the end; "verified" means I read the current page or measured it myself on this date.

---

## 1. The rules

These are binding for every chapter. Each cites the reason.

**Scroll and pacing**

1. **Native scroll, always.** No smooth-scroll library, no wheel interception, no scroll-snap, no horizontal takeover. The scroll rate the reader produces is the rate the page moves. *(Bostock: "Rapid, incremental, reversible scrolls are more usable than slow, animated swipes"; NN/g defines scrolljacking as changing the speed or direction of scrolling, and found most participants "at least mildly disoriented".)*
2. **Every scroll increment changes something visible.** While a section is held, the graphic inside it keeps responding. *(Bostock: "Don't simply make everything position-fixed".)*
3. **Pins are short and rare.** At most one held shot per chapter, ≤ 120 svh of scroll on phone and ≤ 150 svh on desktop, never in the first viewport, and no more than 25% of the page's total scroll length held. The headline is readable before the hold starts. *(NN/g: disorientation was "severely exacerbated when scrolljacks were excessively lengthy"; keep them below the fold; mix with normal scrolling.)*
4. **Scrub what means time; trigger what is type.** Data transforms that represent something passing (songs accumulating, a weekend playing out, a ranking changing month by month) are scrubbed to scroll, so the reader controls time. Headline entrances are time-based triggers that finish in about a second and then hold still; they reverse when the reader scrolls back. *(Bostock: position-based transitions match the reader's speed; time-based triggers avoid getting stuck half-way.)*
5. **Text never moves while it is being read.** Kinetic type performs its entrance, lands, and stops. Velocity effects apply only while scrolling and never to body copy. *(NN/g: text plus altered motion is the worst combination.)*
6. **Nothing plays sound on its own.** Audio starts only from an explicit tap on a labelled control. *(Bostock: "It's only the unexpected trigger that is disruptive"; browsers block autoplay anyway.)*
7. **Martini glass structure.** The film is author-driven from the opening to the credits; the reader-driven part (find yourself, explore every contributor, play songs) opens up at the credits and is offered, lightly, at the opening. *(Segel & Heer: the martini glass "begins with an author-driven approach"; "once the author's intended narrative is complete, the visualization opens up to a reader-driven stage". It is "the most common" structure in their survey.)*
8. **One idea per screen.** Each chapter opens with a single sentence that states the finding with its number; the graphic is the evidence. Repeat the key number in the caption, and close with a synthesis. *(Segel & Heer: narrative messaging, especially repetition, introductory text and final summaries, is under-used in interactive graphics.)*

**Motion safety (WCAG 2.2 and vestibular research)**

9. **Reduced motion means no movement through space.** With `prefers-reduced-motion: reduce` there is no scrubbed transform, parallax, spin, skew, marquee or count-up; every chapter renders in its final state, and only opacity cross-fades of ≤ 200 ms remain. *(WCAG 2.3.3, technique C39/SCR40; A List Apart: opacity and colour changes are low-risk; scaling, spinning, parallax and large-area motion are triggers.)*
10. **A visible pause for all looping motion.** The spinning record, beat pulses and any marquee start automatically and run longer than five seconds alongside other content, so a persistent, keyboard-reachable "motion" control stops all of them at once, and the choice is remembered. *(WCAG 2.2.2 Pause, Stop, Hide, Level A, which applies to motion started by scrolling into view; Understanding doc recommends a single control for all moving elements.)*
11. **No flashing, ever.** Beat pulses change scale or opacity by ≤ 5%; there are no luminance flashes, and nothing blinks more than three times a second. *(WCAG 2.3.1.)*
12. **Movement stays small and follows input.** Large-area wipes are cuts in colour or opacity, not travel across the screen. Velocity skew is capped at ±3° and eased. Nothing moves against the scroll direction by more than a few percent of the viewport. *(A List Apart: "Animations that move an object across a large amount of space are most apt to trigger a negative response"; movement opposite to scroll direction disorients.)*

**Small screens**

13. **Design at 360–390 px first.** Charts read without pinching or sideways scrolling; horizontal bars over vertical where labels are long; direct labels over legends; ≤ 12 marks labelled at once. *(Pudding: plan for mobile early, desktop is the enhanced version; Datawrapper's mobile-first defaults switch labelling strategy on small screens.)*
14. **No hover-only information.** Every exact value is reachable by tap or keyboard focus, and taps don't fire while the reader is scrolling. *(Pudding: "inadvertent interactions may happen while the user is simply trying to scroll".)*
15. **Use `svh`/measured pixels, not `vh`, for anything tied to the viewport**, so mobile browser bars appearing and hiding don't reflow the film. *(Pudding: "don't use vh for scrollytelling" because browser bars resize the viewport; `svh` now solves this natively.)*

**Performance (Core Web Vitals as requirements)**

16. **Budget:** first-load JavaScript ≤ 90 KB gzip (motion libraries ≈ 50 KB, app ≤ 40 KB); first data payload ≤ 25 KB compressed; LCP < 2.5 s and visible data < 3 s on Slow 4G with 4× CPU throttling; CLS < 0.1; INP < 200 ms. *(web.dev thresholds at the 75th percentile.)*
17. **Animate only `transform` and `opacity`.** Reserve space for everything (images with width/height or `aspect-ratio`, chapters with min-heights). Shifts during scrolling count towards CLS; composited transforms don't. *(web.dev CLS: "Any content shift during either of these interactions counts as unexpected"; "Composited animations using translate can't impact other elements".)*
18. **Keep the main thread free.** No long tasks on interaction; layouts are precomputed on the server; reads and writes to layout are batched (no thrashing); the DOM stays small and off-screen chapters render lazily. At most two heavy animated layers at once (for example, canvas + one SVG). *(web.dev INP: yield, keep callbacks light, keep the DOM small, avoid layout thrashing.)*

**Data and rights**

19. **Every number is computed, labelled and honest.** Count basis on screen (entries vs unique songs; tracks vs artists); whole-playlist denominators; bars from zero; one scale per chapter; Nairobi time; coverage stated in small type wherever it is partial.
20. **Spotify artwork is shown unaltered.** No cropping, blurring, overlays, distortion or animation of the artwork itself; corner radius 4 px (small) / 8 px (large); the Spotify logo attributes Spotify content; every track and artist name links back to Spotify. Colour extracted from artwork may light the page; Spotify's own guidelines describe exactly this. *(Spotify Design & Branding Guidelines, verified.)*
21. **Subtraction test.** Every motion must explain continuity, a relationship, time passing, or where to look. If it does none of these, it goes. *(NN/g: "Employ animations sparingly and only when they add meaning to the interaction.")*

---

## 2. Where the brief and the research disagree

| # | Brief | Research says | Fix |
| --- | --- | --- | --- |
| 1 | Lenis smooth scroll (in the motion study, and listed to evaluate). | Interpolating the wheel changes the felt scroll speed, which is NN/g's definition of scrolljacking. Lenis also stops working over iframes (the Spotify player) and blocks anchor links by default. | **No Lenis.** Native scroll; velocity read from ScrollTrigger. Saves 5.4 KB. |
| 2 | "Held shots (pinned moments)" as camera language. | Pins are fine only when short, rare, below the fold, and still responsive (NN/g, Bostock). | Rule 3 limits. The opening is never pinned. |
| 3 | Velocity skew, spinning record, streaming genre names. | Spinning, multi-speed parallax and large-area motion are vestibular triggers. | Caps in rule 12; all off under reduced motion; the motion toggle stops loops. |
| 4 | Continuous loops (record spin, breathing bars). | WCAG 2.2.2 requires a pause mechanism for auto-started motion longer than 5 s shown in parallel with content. | A small, persistent motion control. It isn't a wordmark or a slide counter, so it respects principle 7 of the brief. |
| 5 | "All album covers assembling into one image"; film grain over everything. | Spotify forbids cropping, overlaying, blurring or animating artwork. | Covers are never animated or overlaid. The opening assembles **one tile per song in the colour extracted from its cover** (extraction is endorsed by Spotify). The grain sits behind artwork, never on top. |
| 6 | Odometer counters. | Mid-roll digits show numbers that were never true (seen in the motion-study capture as "11h 11m"), and screen readers hear nonsense. | Counters are **scrubbed to the timeline**, so every intermediate value is the true count at that date; static final values carry `aria-label`. |
| 7 | "Taste twins" network. | Force-directed networks are hard to read at phone width and imply structure that layout noise creates. | Ranked pairs with an overlap measure and a small adjacency strip; no force layout. |
| 8 | World map with arcs into Nairobi. | Geography coverage will be partial (MusicBrainz hit 8/15 in the sample); ISRC country codes are distributor codes, not origin. | Decide in the sound chapter by coverage: map only if coverage ≥ 60% of tracks; otherwise a ranked "made in" list with the coverage line. |
| 9 | "Find yourself" re-centres the whole page from the start. | Martini glass says the reader-driven layer comes after the author's story. | Offer the picker at the opening as a quiet option and prominently in the credits; once chosen, it threads through every chapter as a personal line, without reordering the story. |
| 10 | Rive as the motion layer (Spotify did). | Rive pays off when designers author `.riv` files; here there is no authoring pipeline, and the runtime is 53.5 KB gzip of JavaScript plus a WebAssembly module. | **Not used.** GSAP plus code-drawn SVG/canvas, which is closer to Peter's Remotion practice (scenes as pure functions of progress). |
| 11 | Language share from lyrics (Swahili vs English). | Language detectors don't recognise Sheng, which mixes Swahili and English inside a line. | Classify at line level into Swahili / English / mixed / other, state the method and coverage, and never claim more precision than that. |
| 12 | essentia.js as the fallback for BPM and key. | essentia.js is **AGPL-3.0**, last released June 2021 (0.1.3). | Used only in the local backfill script as an optional dependency; never shipped to the browser or the deployed function. Flagged for Peter in the progress log. |

---

## 3. Inspiration notes: borrow / avoid

**The Pudding** (music DNA, motifs, K-pop generations, rap vocabulary). Fetches returned text and methodology; the visuals render client-side, so notes on layout come from the text and prior viewing.
- *Borrow:* methodology written for normal readers, with explicit inclusion rules and limits, and an invitation to report mistakes (motifs; K-pop's Google Sheet for omissions). One sentence per finding with the number in it (vocabulary: "Lil Uzi Vert at 2,556 words"). Chapters with a repeated internal rhythm (K-pop's five generations: cover, dates, voices, songs, chart). Audio behind an explicit "Click play".
- *Avoid:* prev/next galleries inside a scrolling story (motifs) and "Loading visualization data…" screens that show nothing without JavaScript. Also a number in the text that disagrees with the chart: K-pop says 33 groups in the prose and 35 in the chart, which is exactly the error our computed-only rule prevents.

**Spotify Wrapped 2022 (It's Nice That) and 2025 (Rive case study)**
- *Borrow:* one grammar, many combinations. 2022 built 48 shape and colour combinations on a 16×16 grid so that every piece "feel[s] like they come from the same place". Reusable card systems instead of one-off animations (2025). Month-by-month "Top Artist Sprint" is the precedent for our scrubbed ranking. Design for owning and sharing ("There's no hiding behind Wrapped").
- *Avoid:* maximal colour noise that would fight data legibility, and story formats that are taps instead of scroll.

**GSAP Showcase, Codrops, Awwwards, Apple product pages**
- *Borrow (Apple):* one idea per viewport, very large confident type, product (here: the data) as the hero, sticky media that changes while copy scrolls past, text that is still once it has arrived. *(Codrops):* text splitting, velocity-aware type, Flip-style continuity between layouts, used sparingly.
- *Avoid (Awwwards storytelling winners):* preloaders, cursor followers, full-page scroll hijacks in the first viewport, multi-megabyte WebGL on mobile.

**Lusion, Active Theory, Unseen Studio**
- *Borrow:* light and depth that make a single coherent world; restraint in UI chrome.
- *Avoid:* their weight. A mid-range Android on mobile data can't afford multi-MB WebGL scenes; we get light and depth from layered gradients, canvas 2D and SVG instead.

**Rieranthony/product-film-skill**
- *Borrow:* a brand rules file that overrides defaults (our `docs/direction.md` plays that role); three style frames before building; stills and contact sheets at every handoff; a beat grid measured from the music; "every frame a pure function of time". For us, every scene is a pure function of scroll progress plus data, which makes reduced motion simply "progress = 1".

**The reference motion study** (`docs/reference/motion-study.html`)
- *Keep:* the record as the shape that never cuts; the beat grid; split-word headlines on the beat; the share ring on the record; the runtime as a weekend; the closing frame that rhymes with the first.
- *Surpass:* it uses Lenis (rule 1); full-screen grain moved by a `setInterval` 12 times a second (main-thread cost on phones); UTC weekdays and artist-count genres (both now corrected); odometers that pass through false numbers; an abstract mosaic; monospace-only type that reads as a developer tool rather than warm; on phones the record is pushed mostly off-screen.

**Kenyan visual culture**
- Most 1970s–80s Kenyan recordings came out on small-run **7-inch 45 rpm singles** with printed paper centre labels (Soundway's *Kenya Special* liner notes). That makes the persistent shape a **7-inch single**, not an LP: a centre label with ringed text, a catalogue number, and a large centre hole.
- **Matatu (nganya) art:** airbrushed, hand-lettered, slogan-driven, lit at night by LED strips and UV. The artists see it as conveying messages, not decoration. *Borrow* the night light (saturated strips of colour against dark), the slogan voice for headlines, and the sense of a moving, personal vehicle. *Avoid* graffiti pastiche; the result must read as contemporary and premium, not themed.

---

## 4. Technical constraints and tool choice

Sizes measured on 13 Oct 2026 (gzip -9 of the published minified file).

| Tool | Version / date | Size (gz) | Licence | Decision |
| --- | --- | --- | --- | --- |
| GSAP core | 3.15.0 (13 Apr 2026) | 28.3 KB | Standard "no charge" licence: websites incl. commercial; prohibited only for no-code animation-builder tools | **Use** |
| ScrollTrigger | 3.15.0 | 18.0 KB | same | **Use** for pins, scrubs, triggers, velocity |
| SplitText | 3.15.0 | 3.7 KB | same | **Use** for kinetic type (handles accessibility of split text) |
| Flip / DrawSVG | 3.15.0 | 9.6 / 2.2 KB | same | DrawSVG only if a chapter needs it; Flip not needed |
| Lenis | 1.3.26 | 5.4 KB | MIT | Rejected (rule 1) |
| Motion | 12.x | 28.2 KB | MIT | Rejected: a second engine duplicating GSAP |
| Scrollama | 3.2.0 | 2.1 KB | MIT | Rejected: ScrollTrigger already covers step triggers |
| d3 (full) / Observable Plot | 7.9.0 / 0.6.17 | 92.4 / 68.8 KB | ISC | Not shipped to the browser. Layouts (packing, scales, geography) are computed in Node at refresh time; the browser receives coordinates |
| Chart.js (current) | 4.4.0 | 69.4 KB | MIT | Removed with the old dashboard |
| Rive canvas-lite | 2.44.2 | 53.5 KB + WASM | MIT | Rejected (conflict 10) |
| three.js / OGL | 0.170 / 1.x | 170.8 KB / small | MIT | No WebGL unless a moment earns it; none planned |

**Browser features**
- CSS scroll-driven animations (`animation-timeline`): Chrome 115+, Safari 26+, **Firefox preview builds only** (MDN compat data). Not relied on; GSAP drives everything so there is one timing system.
- View Transitions (same-document): about 93% global support. Optional polish for entering and leaving story mode; the page works without it.
- `text-wrap: balance`: about 89%. Progressive.
- `svh` units: supported in all current engines; used for viewport-tied layout.

**Hosting**
- Vercel serves `public/` from the CDN once the catch-all route is removed; the function handles only `/api/*`, `/admin` and legacy redirects.
- Function responses become CDN-cacheable with `s-maxage` + `stale-while-revalidate`; the payload changes once a day.

**Data sources**
- **Spotify** (see `docs/audit.md`): build on `/items` with `/tracks` fallback, `item.item ?? item.track`, single-artist lookups with a long cache when batch lookups disappear, and an admin name map because `/users/{id}` can disappear. iFrame API: `createController`, `loadUri`/`loadEntity`, `togglePlay`, and `playback_update` with `position`, `duration` and `isPaused`, so visuals can follow playback. `play()` may be blocked without a gesture (Safari).
- **ReccoBeats:** free, no key, may "modify, suspend, or shut down the API at any time". Batch by Spotify ID, store results with their source, and tolerate outages.
- **Deezer:** 30-second previews are allowed; "Local Storage/Offline Storage of audio data is strictly forbidden", so previews are analysed in memory at refresh time and discarded. BPM was present for only 12 of 40 sampled tracks.
- **MusicBrainz:** about 1 request per second per IP; requests over the limit get a 503. Requires a User-Agent of the form `App/version ( contact )`.
- **LRCLIB:** exact match hit 10 of 20 in the sample; fall back to search with a duration tolerance. Lyrics live only in memory long enough to count words and classify lines; only the numbers are stored.
- **essentia.js:** AGPL-3.0, 0.1.3 (2021). Local backfill only (conflict 12).

---

## 5. Sources

UX and storytelling
- Mike Bostock, "How To Scroll" — https://bost.ocks.org/mike/scroll/ (verified)
- NN/g, "Scrolljacking 101" — https://www.nngroup.com/articles/scrolljacking-101/ (verified)
- Segel & Heer, "Narrative Visualization: Telling Stories with Data" (InfoVis 2010), §4.2–4.4 — https://idl.uw.edu/papers/narrative (verified from the PDF)
- WCAG 2.2 Understanding 2.3.3 — https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html (verified)
- WCAG 2.2 Understanding 2.2.2 — https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html (verified)
- web.dev, "Optimize CLS" — https://web.dev/articles/optimize-cls (verified)
- web.dev, "Optimize INP" — https://web.dev/articles/optimize-inp (verified)
- Additional: Russell Samora (The Pudding), "Responsive scrollytelling best practices" — https://pudding.cool/process/responsive-scrollytelling/ (verified)
- Additional: NN/g, "Animation for Attention and Comprehension" — https://www.nngroup.com/articles/animation-usability/ (verified)
- Additional: Val Head, "Designing Safer Web Animation for Motion Sensitivity", A List Apart — https://alistapart.com/article/designing-safer-web-animation-for-motion-sensitivity/ (verified)
- Additional: McKenna et al., "Visual Narrative Flow" (EuroVis 2017): visuals and navigation feedback shaped engagement more than discrete vs continuous control — https://users.cs.utah.edu/~miriah/publications/narrative-flow.pdf (abstract-level)
- Additional: Datawrapper, mobile-first chart defaults — https://www.datawrapper.de/blog/datawrapper-becomes-mobile-first-charting-tool (search summary)

Inspiration
- The Pudding — https://pudding.cool/2025/04/music-dna, https://pudding.cool/2025/12/motifs, https://pudding.cool/2026/05/kpop-generations, https://pudding.cool/projects/vocabulary/
- It's Nice That on Wrapped 2022 — https://itsnicethat.com/features/spotify-wrapped-campaign-identity-2022-graphic-design-301122
- Rive × Spotify Wrapped 2025 — https://rive.app/blog/spotify-used-rive-for-spotify-wrapped-2025
- product-film-skill — https://github.com/Rieranthony/product-film-skill
- Soundway Records, *Kenya Special* — https://soundwayrecords.com/release/156147-various-artists-kenya-special-selected-east-african-recordings-from-the-1970s-1980s
- Matatu culture — https://africa.com/how-graffiti-artists-are-driving-the-matatu-industry-in-nairobi/, https://www.the-star.co.ke/news/2026-05-22-ruto-orders-ntsa-to-allow-graffiti-on-matatus

Tools, rights and data
- GSAP pricing and Standard Licence — https://gsap.com/pricing/, https://gsap.com/standard-license/
- Lenis README — https://github.com/darkroomengineering/lenis
- MDN browser-compat-data, `animation-timeline`; caniuse View Transitions
- Spotify Design & Branding Guidelines — https://developer.spotify.com/documentation/design
- Spotify iFrame API — https://developer.spotify.com/documentation/embeds/references/iframe-api
- Deezer API guidelines — https://developers.deezer.com/guidelines
- MusicBrainz rate limiting — https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
- ReccoBeats API and terms — https://reccobeats.com/docs/apis/get-audio-features, https://reccobeats.com/docs/documentation/terms-of-service
- essentia.js — https://github.com/MTG/essentia.js
