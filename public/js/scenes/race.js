// The race: cumulative songs per person, month by month, scrubbed by scroll.
// Rows re-sort as people overtake each other; bars are scaled to the leader.

import { film, isPhone } from '../motion.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ROW = 44;

export function setupRace() {
  const { gsap, ScrollTrigger } = window;
  const host = document.getElementById('race-rows');
  const label = document.getElementById('race-month');
  const stage = document.getElementById('race-stage');
  const { months, ids, counts } = film.people.race;
  const nameOf = Object.fromEntries(film.people.ranking.map(p => [p.id, p.name]));
  const firstOf = Object.fromEntries(film.people.ranking.map(p => [p.id, Date.parse(p.first)]));
  const original = host.innerHTML;

  host.innerHTML = '';
  const rows = new Map();
  for (const id of ids) {
    const li = document.createElement('li');
    li.className = 'race__row';
    li.dataset.id = id;
    li.innerHTML = '<span class="race__name"></span><span class="race__track"><span class="bar" style="--w:100%"></span></span><span class="race__v"></span>';
    li.querySelector('.race__name').textContent = nameOf[id] || 'Someone';
    host.appendChild(li);
    rows.set(id, { li, bar: li.querySelector('.bar'), v: li.querySelector('.race__v'), y: gsap.quickTo(li, 'y', { duration: 0.35, ease: 'power3.out' }), shown: null, last: -1 });
  }
  gsap.set([...rows.values()].map(r => r.li), { y: 8 * ROW, opacity: 0, '--i': 0 });

  let lastMonth = -1;
  function draw(p) {
    const f = p * (months.length - 1);
    const i0 = Math.floor(f), i1 = Math.min(months.length - 1, i0 + 1), t = f - i0;
    const val = id => counts[id][i0] + (counts[id][i1] - counts[id][i0]) * t;
    const order = ids.map(id => ({ id, v: val(id) })).filter(x => x.v > 0)
      .sort((a, b) => b.v - a.v || firstOf[a.id] - firstOf[b.id]);
    const max = order[0]?.v || 1;
    const top = new Set(order.slice(0, 8).map(x => x.id));
    order.forEach((x, rank) => {
      const r = rows.get(x.id);
      if (!top.has(x.id)) return;
      r.y(rank * ROW);
      if (r.shown !== true) { gsap.to(r.li, { opacity: 1, duration: 0.25 }); r.shown = true; }
      r.bar.style.transform = `scaleX(${(x.v / max).toFixed(4)})`;
      const shownV = Math.round(x.v);
      if (shownV !== r.last) { r.v.textContent = shownV; r.last = shownV; }
      r.li.classList.toggle('is-lead', rank === 0);
    });
    for (const [id, r] of rows) if (!top.has(id) && r.shown !== false) { r.y(8 * ROW); gsap.to(r.li, { opacity: 0, duration: 0.25 }); r.shown = false; }
    const m = Math.round(f);
    if (m !== lastMonth) { const [y, mo] = months[m].split('-').map(Number); label.textContent = `${MONTHS[mo - 1]} ${y}`; lastMonth = m; }
  }

  const st = ScrollTrigger.create({
    trigger: stage,
    start: isPhone() ? 'top 12%' : 'top 20%',
    end: () => '+=' + innerHeight * (isPhone() ? 1.2 : 1.5),
    pin: true,
    anticipatePin: 1,
    scrub: true,
    onUpdate: self => draw(self.progress),
    onRefresh: self => draw(self.progress),
  });
  draw(0);
  return () => { st.kill(true); host.innerHTML = original; label.textContent = (() => { const [y, mo] = months[months.length - 1].split('-').map(Number); return `${MONTHS[mo - 1]} ${y}`; })(); };
}
