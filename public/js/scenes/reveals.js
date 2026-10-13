// Reveals driven by data-reveal attributes on server-rendered charts.
// Each plays when its element is 80% up the viewport (≤ 1.5 beats) and
// reverses when scrolled back above. Bars always grow from zero.

import { BEAT } from '../motion.js';

export function setupReveals() {
  const { gsap } = window;
  const tweens = [];
  const st = el => ({ trigger: el, start: 'top 82%', toggleActions: 'play none none reverse' });
  const add = t => { tweens.push(t); return t; };

  document.querySelectorAll('[data-reveal="bars"]').forEach(el => {
    add(gsap.from(el.querySelectorAll('.bar'), { scaleX: 0, duration: BEAT * 1.5, ease: 'power3.out', stagger: BEAT / 4, scrollTrigger: st(el) }));
  });
  document.querySelectorAll('[data-reveal="cols"]').forEach(el => {
    const cols = el.querySelectorAll('.col');
    add(gsap.from(cols, { scaleY: 0, duration: BEAT * 1.5, ease: 'power3.out', stagger: { amount: BEAT, from: 'start' }, scrollTrigger: st(el) }));
  });
  document.querySelectorAll('[data-reveal="fade"]').forEach(el => {
    const kids = el.children.length > 1 ? el.children : [el];
    add(gsap.from(kids, { y: 16, opacity: 0, duration: BEAT * 1.2, ease: 'expo.out', stagger: BEAT / 4, scrollTrigger: st(el) }));
  });
  document.querySelectorAll('[data-reveal="stack"]').forEach(el => {
    add(gsap.from(el.querySelectorAll('.stack__part'), { scaleX: 0, duration: BEAT, ease: 'power3.out', stagger: BEAT / 2, scrollTrigger: st(el) }));
  });
  document.querySelectorAll('[data-reveal="wheel"]').forEach(el => {
    add(gsap.from(el.querySelectorAll('.kw-seg'), { opacity: 0, duration: BEAT, ease: 'power2.out', stagger: { amount: BEAT * 1.5, from: 0 }, scrollTrigger: st(el) }));
  });
  document.querySelectorAll('[data-reveal="clock"]').forEach(el => {
    add(gsap.from(el.querySelectorAll('.clock-bar'), { scale: 0.3, opacity: 0, svgOrigin: '0 0', duration: BEAT * 1.5, ease: 'power3.out', stagger: { amount: BEAT, from: 0 }, scrollTrigger: st(el) }));
  });
  // Mood map: dots appear from the middle outward through a growing circle.
  document.querySelectorAll('[data-reveal="dots"]').forEach(el => {
    const NS = 'http://www.w3.org/2000/svg';
    const clip = document.createElementNS(NS, 'clipPath'); clip.id = 'mood-clip';
    const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', 150); c.setAttribute('cy', 150); c.setAttribute('r', 0);
    clip.appendChild(c); el.appendChild(clip);
    const dots = el.querySelector('.moodmap__dots'); dots.setAttribute('clip-path', 'url(#mood-clip)');
    const tw = add(gsap.fromTo(c, { attr: { r: 0 } }, { attr: { r: 230 }, duration: BEAT * 2, ease: 'power2.out', scrollTrigger: st(el) }));
    tweens.push({ kill: () => { dots.removeAttribute('clip-path'); clip.remove(); tw.kill(); } });
  });
  return () => tweens.forEach(t => { t.scrollTrigger?.kill(); t.kill(); });
}
