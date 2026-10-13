# Motion system

Stage 5. The rules every scene follows. Read with `docs/direction.md` (look) and `docs/research.md` (why). If a scene needs something this file doesn't allow, change this file first.

## 1. Engine

- **GSAP 3.15.0** core + **ScrollTrigger** + **SplitText**, self-hosted under `public/vendor/gsap-3.15.0/` (immutable cache, ≈ 50 KB gzip). No other animation library.
- **Native scroll.** No smooth-scroll layer. Scroll velocity comes from one global `ScrollTrigger` (`self.getVelocity()`), smoothed.
- **Server-rendered final state.** Every chapter's HTML, numbers and SVG charts arrive from the server already in their final state. The motion script *borrows* that state: it sets the "from" values just before a scene plays and returns to the final state at its end. If scripts fail, nothing is lost.
- **Scenes are pure functions of progress.** Scrubbed scenes are `render(p)` for `p ∈ [0, 1]`; reduced motion is simply `render(1)` (borrowed from the Remotion habit of "every frame a pure function of time").

## 2. The beat grid

```
BPM  = film.beat.bpm  (median tempo of songs with a known tempo; 104 until the data loads)
BEAT = 60 / BPM s     (≈ 0.53 s at 114 BPM)
```

| Unit | Value | Used for |
| --- | --- | --- |
| `BEAT / 8` | ≈ 66 ms | word stagger in headlines |
| `BEAT / 4` | ≈ 130 ms | stagger between bars, list rows |
| `BEAT / 2` | ≈ 260 ms | light colour cuts, small reveals, hover/tap feedback upper bound |
| `BEAT` | ≈ 530 ms | label swaps on the record, number settles |
| `1.5 × BEAT` | ≈ 790 ms | headline entrance (the longest triggered motion) |
| `4 × BEAT` (a bar) | ≈ 2.1 s | opening title sequence, the only multi-beat performance |

- Triggered motions start on the *next* beat boundary of a global clock only when that is under `BEAT / 4` away; otherwise they start immediately. Responsiveness beats musical purity.
- **The pulse:** elements that "breathe" (the tempo chapter's record, the heartbeat line) scale by ≤ 3% on each beat: `BEAT × 0.18` up with `power2.out`, `BEAT × 0.82` down with `power2.in`. Never a brightness flash.
- **The record** turns at a true **45 rpm** (270°/s) while the film is moving. It is a record, not a metronome.

## 3. Easing families

| Family | GSAP ease | For |
| --- | --- | --- |
| Arrive | `expo.out` | type, marks, labels landing |
| Settle | `power3.out` | numbers counting to their value, bars growing |
| Travel | `power2.inOut` | the record moving between roles, layout changes |
| Time | `none` | anything scrubbed to scroll that represents time (dates, the weekend clock, the race). Linear, so scroll distance is proportional to time and the scrub never distorts the data |

No `elastic`, `bounce` or `back` eases: they overshoot values, which reads as a wrong number for a frame.

## 4. Scrubbed, triggered, pinned

| Kind | Rule | Scenes |
| --- | --- | --- |
| **Scrubbed** | Scroll position is time. Reversible by definition. Linear ease. | Opening tiles arriving day by day with the "songs so far" counter; the weekend runtime clock; the month-by-month race; the 24-hour clock sweep |
| **Triggered** | Fires once when its element is 80% up the viewport, plays ≤ `1.5 × BEAT`, reverses when scrolled back above. | Headlines, bars growing from zero, labels, record label swaps |
| **Pinned** | A held shot. ≤ 120 svh of scroll on phone, ≤ 150 svh desktop. Never in the first viewport. At most three on the page, and pinned scroll ≤ 25% of total. The graphic keeps changing every scroll step. | Opening tiles; the race; (optional) the clock |

Counters are always tied to a scrubbed timeline or settle in ≤ `BEAT` from 0 to their value with `aria-label` holding the true value. They never roll through digits.

## 5. Scroll velocity

`v` = ScrollTrigger velocity (px/s), smoothed with `gsap.quickTo(…, { duration: BEAT / 2 })`, decaying to 0 within one beat of stopping.

| Target | Mapping | Cap |
| --- | --- | --- |
| Record spin | 45 rpm × (1 + `|v|` / 3000) | 2× |
| Headline skew | `skewY = -v / 1200` degrees, headlines in view only | ±3° |
| Genre family labels | drift speed + `|v|` / 40 px/s | 3× base |

Body copy, numbers in charts and captions never skew or drift.

## 6. Camera language (web edition)

- **Held shot:** a pin (rules above).
- **Push-in:** a chapter's stage scales 0.96 → 1 as it enters (≤ 4%).
- **Depth:** the record layer moves with the page at 0.92× (a 8% parallax), and the light layer is fixed. Off under reduced motion.
- **Cut:** chapter changes are a colour cut of the light (`BEAT / 2`) plus a record label swap on the beat. No full-screen wipes or long travels.
- **No horizontal takeovers.** Anything wide scrolls inside its own container with a visible scrollbar, or wraps.

## 7. Texture

- **Grain:** one static 160 px noise tile at 6% opacity on a fixed layer *below* any Spotify artwork. No per-frame movement; no `mix-blend-mode` (it forces whole-page compositing on mobile).
- **Vignette:** a fixed radial gradient, static.
- **Light:** two fixed radial-gradient layers (warm gold behind the record, and the "music light" tinted by the album colour in view). Colour changes cross-fade the layers' opacity; gradients are never animated per frame.

## 8. Reduced motion and the motion toggle

- `prefers-reduced-motion: reduce` **or** the on-page **Motion** toggle set to off:
  - no timelines, no pins, no scrubbing, no skew, no spin, no pulse, no parallax;
  - every chapter shows its server-rendered final state in normal flow;
  - only opacity cross-fades ≤ 200 ms remain (light colour changes).
- The toggle is a small labelled button, keyboard-reachable, with `aria-pressed`, remembered in `localStorage`. Turning motion off mid-film kills every ScrollTrigger and clears inline styles; turning it on rebuilds the scenes from the current scroll position.

## 9. Budget

- **At once:** ≤ 2 heavy animated layers (for example the tiles canvas + the record), ≤ 40 DOM nodes animating.
- **Properties:** `transform` and `opacity` only; canvas for anything with hundreds of marks.
- **Frame time:** ≤ 16 ms average while scrubbing the opening on a 4× CPU-throttled phone profile; no long task > 50 ms on interaction.
- **Idle:** when nothing is in motion (scroll still for a beat, motion off, or tab hidden), the ticker does no work except the record spin, and that stops when motion is off.
- **Lazy:** chapters below the fold attach their ScrollTriggers when they are within one viewport; the people and tracks payloads load when their chapters approach.

## 10. Subtraction checklist (run before calling a scene done)

1. What does this motion explain: continuity, a relationship, time passing, or where to look? If none, cut it.
2. Would the scene read the same as a still? If yes, the motion must be ≤ `BEAT` and quiet.
3. Is any text moving while it should be read? Stop it.
4. Does anything move against the scroll direction by more than a few percent? Remove it.
5. Is anything looping without the toggle stopping it? Wire it to the toggle.
