// Motion core: beat grid, motion on/off, scroll velocity. See docs/motion.md.

export const film = JSON.parse(document.getElementById('film-data').textContent);

export const BPM = film.beat && film.beat.bpm ? film.beat.bpm : 104;
export const BEAT = 60 / BPM;
document.documentElement.style.setProperty('--beat', BEAT.toFixed(3) + 's');

const html = document.documentElement;
const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');

export const isPhone = () => innerWidth < 760;

export function motionOn() {
  return !html.classList.contains('motion-off') && !!(window.gsap && window.ScrollTrigger);
}

// The toggle: remembered per browser, wins over the OS setting once used.
export function setupToggle(onChange) {
  const btn = document.getElementById('motion-toggle');
  const sync = () => {
    const on = !html.classList.contains('motion-off');
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? 'Motion on' : 'Motion off';
    btn.setAttribute('aria-label', on ? 'Motion on. Turn motion off' : 'Motion off. Turn motion on');
  };
  sync();
  btn.addEventListener('click', () => {
    const turningOn = html.classList.contains('motion-off');
    html.classList.toggle('motion-off', !turningOn);
    try { localStorage.setItem('kle-motion', turningOn ? 'on' : 'off'); } catch (e) { /* storage blocked */ }
    sync();
    onChange(turningOn);
  });
  reduceQuery.addEventListener?.('change', e => {
    let stored = null;
    try { stored = localStorage.getItem('kle-motion'); } catch (err) { /* ignore */ }
    if (stored) return;
    html.classList.toggle('motion-off', e.matches);
    sync();
    onChange(!e.matches);
  });
}

// Scroll velocity (px/s), smoothed and decaying to zero within a beat.
export const velocity = { raw: 0, smooth: 0, lastScroll: 0 };
let velocityTrigger = null;

export function startVelocity() {
  const { gsap, ScrollTrigger } = window;
  velocityTrigger = ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: self => { velocity.raw = self.getVelocity(); velocity.lastScroll = performance.now(); },
  });
  gsap.ticker.add(() => {
    const idle = performance.now() - velocity.lastScroll > BEAT * 500;
    const target = idle ? 0 : velocity.raw;
    velocity.smooth += (target - velocity.smooth) * 0.12;
    if (Math.abs(velocity.smooth) < 0.5) velocity.smooth = 0;
  });
}

export function stopVelocity() {
  velocityTrigger?.kill();
  velocityTrigger = null;
  velocity.raw = velocity.smooth = 0;
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
