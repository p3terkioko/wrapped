// Growth: the mosaic fills in day by day as you scroll. Scroll is time
// (linear), so the date and the counter are true at every frame.

import { film, isPhone, clamp } from '../motion.js';
import * as record from '../record.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY = 86400000, EAT = 3 * 3600000;

export function setupGrowth(mosaic) {
  const { ScrollTrigger } = window;
  const stage = document.getElementById('growth-stage');
  const dateEl = document.getElementById('growth-date');
  const countEl = document.getElementById('growth-count').querySelector('.n');
  const markEl = document.getElementById('growth-mark');
  const items = [...document.querySelectorAll('#milestones li')];
  const { days } = film.opening.tiles;
  const total = days.length;
  const span = film.totals.days || 1;
  const first = Date.parse(film.totals.firstAddedAt);
  const firstDayStart = Date.parse(new Date(first + EAT).toISOString().slice(0, 10) + 'T00:00:00Z') - EAT;
  const GLOW = Math.max(4, span * 0.012); // days the playhead outline lingers

  // Clip the growth line so it draws up to the current day.
  const line = document.querySelector('.growth-line');
  const NS = 'http://www.w3.org/2000/svg';
  const clip = document.createElementNS(NS, 'clipPath'); clip.id = 'growth-clip';
  const clipRect = document.createElementNS(NS, 'rect');
  const vb = line.viewBox.baseVal;
  clipRect.setAttribute('x', 0); clipRect.setAttribute('y', 0); clipRect.setAttribute('height', vb.height);
  clip.appendChild(clipRect); line.querySelector('defs').appendChild(clip);
  line.querySelectorAll('.line, .area').forEach(p => p.setAttribute('clip-path', 'url(#growth-clip)'));
  const xOf = d => 34 + (d / span) * (vb.width - 44);

  let lastCount = -1, lastDay = -1, lastMark = -1;
  function draw(day) {
    mosaic.setDay(day, day >= span ? 0 : GLOW);
    let count = 0;
    for (let i = 0; i < total; i++) if (days[i] <= day) count++; else break;
    const dayInt = Math.floor(day);
    if (count !== lastCount) { countEl.textContent = count.toLocaleString('en-GB'); lastCount = count; }
    if (dayInt !== lastDay) {
      const w = new Date(firstDayStart + EAT + dayInt * DAY);
      dateEl.textContent = `${w.getUTCDate()} ${MONTHS[w.getUTCMonth()]} ${w.getUTCFullYear()}`;
      const passed = film.opening.milestones.filter(m => Number(items.find(li => +li.dataset.n === m.n)?.dataset.day) <= dayInt);
      const m = passed[passed.length - 1];
      const mk = m ? m.n : 0;
      if (mk !== lastMark) {
        markEl.innerHTML = m ? `<strong>${m.n === total ? 'Latest song' : ordinal(m.n) + ' song'}:</strong> ${escapeHtml(m.song.name)}, added by ${escapeHtml(m.name)}` : '';
        items.forEach(li => li.classList.toggle('is-future', +li.dataset.day > dayInt));
        lastMark = mk;
      }
      lastDay = dayInt;
    }
    clipRect.setAttribute('width', Math.max(0, xOf(day)));
    record.state.arc = clamp(day / span, 0, 1);
    record.render();
  }

  const st = ScrollTrigger.create({
    trigger: stage,
    start: isPhone() ? 'top 10%' : 'center center',
    end: () => '+=' + innerHeight * (isPhone() ? 1.2 : 1.5),
    pin: true,
    anticipatePin: 1,
    scrub: true,
    onUpdate: self => draw(self.progress * span),
    onRefresh: self => draw(self.progress * span),
    onLeave: () => draw(span),
  });
  draw(0);
  return () => {
    st.kill(true);
    mosaic.setDay(Infinity, 0);
    clipRect.parentNode?.remove();
    line.querySelectorAll('.line, .area').forEach(p => p.removeAttribute('clip-path'));
    items.forEach(li => li.classList.remove('is-future'));
  };
}

const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
