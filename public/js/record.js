// The record: spins at 45 rpm while the film moves, changes role per chapter.

import { BEAT, velocity, isPhone, clamp } from './motion.js';

const RPM45 = 270; // degrees per second
const el = document.getElementById('record');
const label = document.getElementById('record-label');
const arc = document.getElementById('ring-arc');
const head = document.getElementById('ring-head');
const CIRC = 2 * Math.PI * 101;

const state = { x: 0, y: 0, s: 1, o: 1, angle: 0, speed: 0, arc: 0 };
let tickerFn = null;

// Positions are fractions of the viewport (centre of the record) plus a size
// in px; phone and desktop have their own layouts.
const ROLES = {
  opening: { desk: { cx: 0.76, cy: 0.5, s: 1, o: 1 }, phone: { cx: 0.5, cy: 0.25, s: 1, o: 1 } },
  growth: { desk: { cx: 0.9, cy: 0.86, s: 0.42, o: 0.5 }, phone: { cx: 0.9, cy: 0.1, s: 0.38, o: 0.55 } },
  runtime: { desk: { cx: 0.76, cy: 0.5, s: 0.9, o: 1 }, phone: { cx: 0.5, cy: 0.3, s: 0.9, o: 0.4 } },
};

function size() { return el.getBoundingClientRect().width / (state.s || 1); }

export function roleState(name) {
  const r = ROLES[name] || ROLES.opening;
  const v = isPhone() ? r.phone : r.desk;
  const w = el.offsetWidth;
  return { x: v.cx * innerWidth - w / 2, y: v.cy * innerHeight - w / 2, s: v.s, o: v.o };
}

export function render() {
  el.style.transform = `translate3d(${state.x.toFixed(1)}px, ${state.y.toFixed(1)}px, 0) scale(${state.s.toFixed(4)})`;
  el.style.opacity = state.o.toFixed(3);
  label.style.transform = `rotate(${state.angle.toFixed(2)}deg)`;
  arc.setAttribute('stroke-dasharray', `${(CIRC * state.arc).toFixed(2)} ${CIRC.toFixed(2)}`);
  if (state.arc > 0) {
    const a = 2 * Math.PI * state.arc - Math.PI / 2;
    head.setAttribute('cx', (101 * Math.cos(a)).toFixed(2));
    head.setAttribute('cy', (101 * Math.sin(a)).toFixed(2));
    head.setAttribute('opacity', '1');
  } else head.setAttribute('opacity', '0');
}

export function place(name) {
  Object.assign(state, roleState(name));
  render();
}

export function setLabel({ title, cat }) {
  if (title != null) document.getElementById('label-title').textContent = title;
  if (cat != null) document.getElementById('label-cat').textContent = cat;
}

// Spin: speeds up to 45 rpm while the reader scrolls (a little faster with
// fast scrolling) and coasts to a stop one beat after they stop.
export function startSpin({ spinUp = true } = {}) {
  const { gsap } = window;
  if (spinUp) gsap.to(state, { speed: 1, duration: BEAT * 4, ease: 'power2.inOut' });
  let introUntil = performance.now() + BEAT * 4000 + 1500;
  tickerFn = (time, dt) => {
    const moving = performance.now() < introUntil || Math.abs(velocity.smooth) > 2 || performance.now() - velocity.lastScroll < BEAT * 1000;
    const target = moving ? 1 + clamp(Math.abs(velocity.smooth) / 3000, 0, 1) : 0;
    state.speed += (target - state.speed) * (moving ? 0.06 : 0.025);
    if (state.speed < 0.002 && !moving) state.speed = 0;
    if (state.speed > 0) { state.angle = (state.angle + RPM45 * state.speed * (dt / 1000)) % 360; render(); }
  };
  gsap.ticker.add(tickerFn);
}

export function stopSpin() {
  if (tickerFn) window.gsap.ticker.remove(tickerFn);
  tickerFn = null;
  state.speed = 0;
}

export { state, el as recordEl };
