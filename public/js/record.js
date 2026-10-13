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
const CORNER = { desk: { cx: 0.92, cy: 0.15, s: 0.3, o: 0.85 }, phone: { cx: 0.93, cy: 0.07, s: 0.2, o: 0.6 } };
const ROLES = {
  opening: { desk: { cx: 0.7, cy: 0.5, s: 1, o: 1 }, phone: { cx: 0.62, cy: 0.27, s: 1, o: 1 } },
  first: { desk: { cx: 0.86, cy: 0.52, s: 0.7, o: 0.9 }, phone: { cx: 0.9, cy: 0.13, s: 0.42, o: 0.85 } },
  growth: { desk: { cx: 0.92, cy: 0.84, s: 0.36, o: 0.55 }, phone: { cx: 0.9, cy: 0.07, s: 0.3, o: 0.6 } },
  runtime: { desk: { cx: 0.8, cy: 0.42, s: 0.8, o: 1 }, phone: { cx: 0.5, cy: 0.16, s: 0.62, o: 0.35 } },
  people: { desk: { cx: 0.84, cy: 0.38, s: 0.62, o: 1 }, phone: { cx: 0.88, cy: 0.1, s: 0.34, o: 0.8 } },
  families: { desk: { cx: 0.88, cy: 0.42, s: 0.5, o: 0.9 }, phone: CORNER.phone },
  tempo: { desk: { cx: 0.84, cy: 0.36, s: 0.55, o: 1 }, phone: { cx: 0.88, cy: 0.1, s: 0.3, o: 0.8 } },
  finale: { desk: { cx: 0.7, cy: 0.5, s: 1, o: 1 }, phone: { cx: 0.62, cy: 0.27, s: 1, o: 1 } },
  corner: CORNER,
};

function size() { return el.getBoundingClientRect().width / (state.s || 1); }

export function roleState(name) {
  const r = ROLES[name] || ROLES.opening;
  const v = isPhone() ? r.phone : r.desk;
  const w = el.offsetWidth;
  return { x: v.cx * innerWidth - w / 2, y: v.cy * innerHeight - w / 2, s: v.s, o: v.o };
}

let last = { t: '', o: '', a: '', arc: -1 };
export function render() {
  const t = `translate3d(${state.x.toFixed(1)}px, ${state.y.toFixed(1)}px, 0) scale(${state.s.toFixed(4)})`;
  if (t !== last.t) { el.style.transform = t; last.t = t; }
  const o = state.o.toFixed(3);
  if (o !== last.o) { el.style.opacity = o; last.o = o; }
  const a = `rotate(${state.angle.toFixed(1)}deg)`;
  if (a !== last.a) { label.style.transform = a; last.a = a; }
  const arcNow = Math.round(state.arc * 1000);
  if (arcNow === last.arc) return;
  last.arc = arcNow;
  return renderArc();
}
function renderArc() {
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

// Tonearm angle: 15 = on the outer grooves, 0 = parked off the record.
const arm = document.getElementById('tonearm');
const armAttr = arm ? arm.getAttribute('transform') || '' : '';
export const armState = { angle: parseFloat(armAttr.slice(armAttr.indexOf('(') + 1)) || 15 };
export function renderArm() { arm?.setAttribute('transform', `rotate(${armState.angle.toFixed(2)} 112 -100)`); }

// One owner for the arm: a function of scroll position (lift as the first
// chapter arrives, drop as the finale arrives), scaled by the intro.
export const armMix = { intro: 1, lift: 0, drop: 0 };
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export function updateArm() {
  const onRecord = (1 - easeInOut(armMix.lift)) + easeInOut(armMix.drop);
  armState.angle = 15 * armMix.intro * Math.min(1, onRecord);
  renderArm();
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
