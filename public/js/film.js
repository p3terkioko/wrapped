// The film's client: motion on top of the server-rendered page.
// With motion off (reduced-motion preference or the toggle), this only wires
// up the controls and the cover-art mosaic; the page is already complete.

import { BEAT, motionOn, setupToggle, startVelocity, stopVelocity, velocity, clamp } from './motion.js';
import * as record from './record.js';
import { createMosaic } from './mosaic.js';
import { setupGrowth } from './scenes/growth.js';
import { setupRuntime } from './scenes/runtime.js';
import { setupReveals } from './scenes/reveals.js';
import { setupRace } from './scenes/race.js';
import { setupChapters, setupPlay, setupLight } from './scenes/chapters.js';
import { setupFind } from './find.js';
import { setupPulse } from './pulse.js';
import { setupShare } from './share.js';

let teardown = [];
setupPlay();
const mosaic = createMosaic();
mosaic.setDay(Infinity, 0);

setupFind(mosaic);
setupShare();
setupLight();
setupPulse();

// Covers load when the mosaic is about a screen away, motion or not.
new IntersectionObserver((entries, io) => {
  if (entries.some(e => e.isIntersecting)) { io.disconnect(); mosaic.loadArt(); }
}, { rootMargin: '150% 0px' }).observe(document.getElementById('mosaic'));

// SplitText masks clip to the glyph box, which cuts italic overhangs and
// descenders. Pad each mask outward and pull it back with negative margins so
// layout is unchanged but nothing is clipped once the word has landed.
function roomyMasks(split) {
  (split.masks || []).forEach(m => {
    m.style.padding = '0.14em 0.22em 0.24em 0.06em';
    m.style.margin = '-0.14em -0.22em -0.24em -0.06em';
  });
  return split;
}

function splitHeadlines() {
  const { gsap, SplitText } = window;
  const splits = [];
  document.querySelectorAll('.headline[data-split]').forEach(h => {
    const split = roomyMasks(SplitText.create(h, { type: 'words', mask: 'words', aria: 'auto' }));
    splits.push(split);
    gsap.from(split.words, {
      yPercent: 110, duration: BEAT * 1.5, ease: 'expo.out', stagger: BEAT / 8,
      scrollTrigger: { trigger: h, start: 'top 82%', toggleActions: 'play none none reverse' },
    });
  });
  return () => splits.forEach(s => s.revert());
}

// The title sequence (about two bars): the room warms, the record spins up,
// the tonearm swings over and drops on the beat, the title lands.
function openingSequence() {
  const { gsap, SplitText } = window;
  const lines = [...document.querySelectorAll('.title [data-split]')];
  const splits = lines.map(l => roomyMasks(SplitText.create(l, { type: 'chars', mask: 'chars', aria: 'auto' })));
  record.armMix.intro = 0; record.updateArm();
  const names = document.getElementById('record-names');
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.from('.light', { opacity: 0, duration: BEAT * 3, ease: 'power2.out' }, 0)
    .from(record.state, { o: 0, s: 0.9, duration: BEAT * 3, ease: 'power3.out', onUpdate: record.render }, 0)
    .from(names, { opacity: 0, rotation: -24, transformOrigin: '50% 50%', duration: BEAT * 4, ease: 'power3.out' }, BEAT * 0.5)
    .from(splits[0].chars, { yPercent: 108, duration: BEAT * 1.2, stagger: BEAT / 12 }, BEAT * 0.25)
    .from(splits[1].chars, { yPercent: 108, duration: BEAT * 1.2, stagger: BEAT / 14 }, BEAT * 0.75)
    .to(record.armMix, { intro: 1.04, duration: BEAT * 1.5, ease: 'power2.inOut', onUpdate: record.updateArm }, BEAT * 1.5)
    .to(record.armMix, { intro: 1, duration: BEAT / 2, ease: 'power2.out', onUpdate: record.updateArm }, BEAT * 3)
    .from('.opening .lede, .opening .label-strip, .opening .actions, .opening .now-playing, .scroll-cue', { y: 16, opacity: 0, duration: BEAT * 1.2, stagger: BEAT / 4 }, BEAT * 1.5);
  return () => { tl.kill(); splits.forEach(s => s.revert()); gsap.set([names, '.light'], { clearProps: 'all' }); };
}

// The arm lifts as the first chapter arrives and drops again at the finale.
function recordTravel() {
  const { ScrollTrigger } = window;
  const a = ScrollTrigger.create({ trigger: '#first', start: 'top 95%', end: 'top 65%', onUpdate: self => { record.armMix.lift = self.progress; record.updateArm(); }, onRefresh: self => { record.armMix.lift = self.progress; record.updateArm(); } });
  const b = ScrollTrigger.create({ trigger: '#finale', start: 'top 60%', end: 'top 25%', onUpdate: self => { record.armMix.drop = self.progress; record.updateArm(); }, onRefresh: self => { record.armMix.drop = self.progress; record.updateArm(); } });
  return () => { a.kill(); b.kill(); record.armMix.intro = 1; record.armMix.lift = 0; record.armMix.drop = 0; };
}

// Headlines lean very slightly with fast scrolling (±3°), never body copy.
function velocitySkew() {
  const { gsap } = window;
  const heads = [...document.querySelectorAll('.headline')];
  const setters = heads.map(h => gsap.quickTo(h, 'skewY', { duration: BEAT / 2, ease: 'power3.out' }));
  let last = 0;
  const fn = () => {
    const k = Math.round(clamp(-velocity.smooth / 1200, -3, 3) * 20) / 20;
    if (k === last) return;
    last = k;
    setters.forEach(s => s(k));
  };
  gsap.ticker.add(fn);
  return () => { gsap.ticker.remove(fn); gsap.set(heads, { clearProps: 'transform' }); };
}

function start({ intro = true } = {}) {
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger, window.SplitText);
  // Mobile address bars resizing the viewport must not re-layout pins mid-scroll.
  ScrollTrigger.config({ ignoreMobileResize: true });
  record.place('opening');
  startVelocity();
  teardown.push(stopVelocity);
  const playIntro = intro && scrollY < innerHeight * 0.5;
  if (playIntro) teardown.push(openingSequence());
  teardown.push(splitHeadlines());
  teardown.push(setupGrowth(mosaic));
  teardown.push(setupRuntime());
  teardown.push(setupRace());
  teardown.push(setupReveals());
  teardown.push(recordTravel());
  teardown.push(setupChapters());
  teardown.push(velocitySkew());
  record.startSpin({ spinUp: playIntro });
  teardown.push(record.stopSpin);
  // Triggers were created by scene, not in page order; sort them so each is
  // measured after the pins above it, then measure again once fonts swap in.
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
  document.fonts?.ready.then(() => { ScrollTrigger.sort(); ScrollTrigger.refresh(); });
}

function stop() {
  teardown.reverse().forEach(fn => { try { fn(); } catch (e) { /* keep going */ } });
  teardown = [];
  window.ScrollTrigger?.getAll().forEach(t => t.kill(true));
  window.gsap?.globalTimeline.clear();
  record.armMix.intro = 1; record.armMix.lift = 0; record.armMix.drop = 0; record.updateArm();
  record.state.arc = 0;
  ['record', 'record-label', 'record-names'].forEach(id => document.getElementById(id)?.removeAttribute('style'));
  document.querySelectorAll('.headline, .title, .opening *').forEach(n => { n.style.transform = ''; n.style.opacity = ''; });
  mosaic.setDay(Infinity, 0);
}

setupToggle(on => { if (on && motionOn()) start({ intro: false }); else stop(); });
if (motionOn()) start();
