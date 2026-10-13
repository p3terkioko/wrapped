// Growth: every add as a tile coloured by its artwork, arriving on the day it
// was added. Scroll is time (linear), so the counter is true at every frame.

import { film, BEAT, isPhone, clamp } from '../motion.js';
import * as record from '../record.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY = 86400000, EAT = 3 * 3600000;

export function setupGrowth() {
  const { gsap, ScrollTrigger } = window;
  const stage = document.getElementById('growth-stage');
  const mosaic = document.getElementById('mosaic');
  const svg = mosaic.querySelector('svg');
  const dateEl = document.getElementById('growth-date');
  const countEl = document.getElementById('growth-count').querySelector('.n');
  const markEl = document.getElementById('growth-mark');
  const items = [...document.querySelectorAll('#milestones li')];
  const { colours, days } = film.opening.tiles;
  const total = colours.length;
  const span = film.totals.days || 1;
  const first = Date.parse(film.totals.firstAddedAt);
  const firstDayStart = Date.parse(new Date(first + EAT).toISOString().slice(0, 10) + 'T00:00:00Z') - EAT;
  const COLS = 23, ROWS = Math.ceil(total / COLS);
  const ARRIVE = Math.max(6, span * 0.02); // days a tile takes to land

  // Canvas over the server-rendered SVG (which stays for screen readers).
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  mosaic.appendChild(canvas);
  svg.style.opacity = '0';
  const ctx = canvas.getContext('2d');
  let cell = 0, dpr = 1;
  const size = () => {
    const r = svg.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    cell = r.width / COLS;
    draw(current);
  };

  // Clip for the growth line so it draws up to the current day.
  const line = document.querySelector('.growth-line');
  const NS = 'http://www.w3.org/2000/svg';
  const clip = document.createElementNS(NS, 'clipPath'); clip.id = 'growth-clip';
  const clipRect = document.createElementNS(NS, 'rect');
  const vb = line.viewBox.baseVal;
  clipRect.setAttribute('x', 0); clipRect.setAttribute('y', 0); clipRect.setAttribute('height', vb.height);
  clip.appendChild(clipRect); line.querySelector('defs').appendChild(clip);
  line.querySelectorAll('.line, .area').forEach(p => p.setAttribute('clip-path', 'url(#growth-clip)'));
  const xOf = d => 34 + (d / span) * (vb.width - 44);

  const ease = t => 1 - Math.pow(1 - t, 4);
  let current = span;
  let lastCount = -1, lastDay = -1;

  function draw(day) {
    current = day;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const gap = cell * 0.14;
    let count = 0;
    for (let i = 0; i < total; i++) {
      const d = days[i];
      if (d > day) continue;
      count++;
      const a = ease(clamp((day - d) / ARRIVE, 0, 1));
      const x = (i % COLS) * cell + gap / 2, y = Math.floor(i / COLS) * cell + gap / 2;
      const s = (cell - gap) * (0.55 + 0.45 * a);
      const drop = (1 - a) * cell * 1.6;
      ctx.globalAlpha = 0.25 + 0.75 * a;
      ctx.fillStyle = colours[i] ? '#' + colours[i] : 'rgba(243,233,214,.22)';
      ctx.fillRect(x + (cell - gap - s) / 2, y - drop + (cell - gap - s) / 2, s, s);
    }
    ctx.globalAlpha = 1;
    const dayInt = Math.floor(day);
    if (count !== lastCount) { countEl.textContent = count.toLocaleString('en-GB'); lastCount = count; }
    if (dayInt !== lastDay) {
      const w = new Date(firstDayStart + EAT + dayInt * DAY);
      dateEl.textContent = `${w.getUTCDate()} ${MONTHS[w.getUTCMonth()]} ${w.getUTCFullYear()}`;
      const passed = film.opening.milestones.filter(m => Number(items.find(li => +li.dataset.n === m.n)?.dataset.day) <= dayInt);
      const m = passed[passed.length - 1];
      markEl.innerHTML = m ? `<strong>${m.n === total ? 'Latest song' : ordinal(m.n) + ' song'}:</strong> ${escapeHtml(m.song.name)}, added by ${escapeHtml(m.name)}` : '';
      items.forEach(li => li.classList.toggle('is-future', +li.dataset.day > dayInt));
      lastDay = dayInt;
    }
    clipRect.setAttribute('width', Math.max(0, xOf(day)));
    record.state.arc = clamp(day / span, 0, 1);
    record.render();
  }

  size();
  addEventListener('resize', size);

  const pinLength = () => innerHeight * (isPhone() ? 1.2 : 1.5);
  const st = ScrollTrigger.create({
    trigger: stage,
    start: isPhone() ? 'top 12%' : 'center center',
    end: () => '+=' + pinLength(),
    pin: true,
    scrub: 0.4,
    onUpdate: self => draw(self.progress * span),
    onRefresh: self => draw(self.progress * span),
    onLeave: () => draw(span),
  });
  draw(0);
  return () => { st.kill(true); canvas.remove(); svg.style.opacity = ''; clipRect.parentNode?.remove(); line.querySelectorAll('.line, .area').forEach(p => p.removeAttribute('clip-path')); items.forEach(li => li.classList.remove('is-future')); removeEventListener('resize', size); };
}

const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
