// The film's client: motion on top of the server-rendered page.
// With motion off (reduced-motion preference or the toggle), this only wires
// up the controls; the page is already complete.

import { film, BEAT, motionOn, setupToggle, startVelocity, stopVelocity, velocity, clamp } from './motion.js';
import * as record from './record.js';
import { setupGrowth } from './scenes/growth.js';

let teardown = [];

function splitHeadlines() {
  const { gsap, SplitText } = window;
  const splits = [];
  document.querySelectorAll('.headline[data-split]').forEach(h => {
    const split = SplitText.create(h, { type: 'words', mask: 'words', aria: 'auto' });
    splits.push(split);
    gsap.from(split.words, {
      yPercent: 110, duration: BEAT * 1.5, ease: 'expo.out', stagger: BEAT / 8,
      scrollTrigger: { trigger: h, start: 'top 82%', toggleActions: 'play none none reverse' },
    });
  });
  return () => splits.forEach(s => s.revert());
}

function openingSequence() {
  const { gsap, SplitText } = window;
  const lines = [...document.querySelectorAll('.title [data-split]')];
  const splits = lines.map(l => SplitText.create(l, { type: 'chars', mask: 'chars', aria: 'auto' }));
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.from(splits[0].chars, { yPercent: 105, duration: BEAT * 1.2, stagger: BEAT / 12 }, 0)
    .from(splits[1].chars, { yPercent: 105, duration: BEAT * 1.2, stagger: BEAT / 14 }, BEAT * 0.5)
    .from('.opening .lede, .opening .actions, .opening .pulse-line, .scroll-cue', { y: 18, opacity: 0, duration: BEAT * 1.2, stagger: BEAT / 4 }, BEAT * 1.25)
    .from(record.state, { o: 0, s: 0.86, duration: BEAT * 3, ease: 'power3.out', onUpdate: record.render }, 0);
  return () => { tl.kill(); splits.forEach(s => s.revert()); };
}

function recordTravel() {
  const { gsap } = window;
  const hops = [['opening', 'growth', '#growth', 'top bottom', 'top 25%']];
  const tweens = hops.map(([from, to, trigger, start, end]) => gsap.fromTo(record.state,
    { x: () => record.roleState(from).x, y: () => record.roleState(from).y, s: () => record.roleState(from).s, o: () => record.roleState(from).o },
    { x: () => record.roleState(to).x, y: () => record.roleState(to).y, s: () => record.roleState(to).s, o: () => record.roleState(to).o,
      ease: 'power2.inOut', immediateRender: false, onUpdate: record.render,
      scrollTrigger: { trigger, start, end, scrub: 0.8, invalidateOnRefresh: true } }));
  return () => tweens.forEach(t => { t.scrollTrigger?.kill(); t.kill(); });
}

// Headlines lean very slightly with fast scrolling (±3°), never body copy.
function velocitySkew() {
  const { gsap } = window;
  const heads = [...document.querySelectorAll('.headline')];
  const setters = heads.map(h => gsap.quickTo(h, 'skewY', { duration: BEAT / 2, ease: 'power3.out' }));
  const fn = () => { const k = clamp(-velocity.smooth / 1200, -3, 3); setters.forEach(s => s(k)); };
  gsap.ticker.add(fn);
  return () => { gsap.ticker.remove(fn); gsap.set(heads, { clearProps: 'transform' }); };
}

function start({ intro = true } = {}) {
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger, window.SplitText);
  record.place('opening');
  startVelocity();
  teardown.push(stopVelocity);
  if (intro && scrollY < innerHeight * 0.5) teardown.push(openingSequence());
  teardown.push(splitHeadlines());
  teardown.push(setupGrowth());
  teardown.push(recordTravel());
  teardown.push(velocitySkew());
  record.startSpin({ spinUp: intro });
  teardown.push(record.stopSpin);
  ScrollTrigger.refresh();
}

function stop() {
  teardown.reverse().forEach(fn => { try { fn(); } catch (e) { /* keep going */ } });
  teardown = [];
  window.ScrollTrigger?.getAll().forEach(t => t.kill(true));
  window.gsap?.globalTimeline.clear();
  document.querySelectorAll('#record, #record-label, .headline, .title, .opening *').forEach(n => n.style && (n.style.transform = '', n.style.opacity = ''));
  document.getElementById('record').removeAttribute('style');
  document.getElementById('record-label').removeAttribute('style');
}

setupToggle(on => { if (on && motionOn()) start({ intro: false }); else stop(); });
if (motionOn()) start();
