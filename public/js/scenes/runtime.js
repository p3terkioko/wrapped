// Runtime: the playlist played back to back, as a weekend scrubbed by scroll.

import { film, clamp } from '../motion.js';
import * as record from '../record.js';

const DAYS = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];

export function setupRuntime() {
  const { ScrollTrigger } = window;
  const fill = document.getElementById('weekend-fill');
  const head = document.getElementById('weekend-head');
  const clock = document.getElementById('weekend-clock');
  const totalMin = film.runtime.ms / 60000;
  const track = fill.parentElement;
  let width = track.offsetWidth;
  head.style.left = '0';
  function set(p) {
    fill.style.transform = `scaleX(${p})`;
    head.style.transform = `translateX(${(p * width).toFixed(1)}px)`;
    const m = Math.floor(18 * 60 + p * totalMin);
    clock.textContent = `${DAYS[Math.floor(m / 1440) % 7]} ${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    record.state.arc = clamp(p, 0, 1);
    record.render();
  }
  const st = ScrollTrigger.create({
    trigger: '#weekend', start: 'top 85%', end: 'bottom 30%', scrub: true,
    onUpdate: self => set(self.progress),
    onRefresh: self => { width = track.offsetWidth; set(self.progress); },
  });
  set(0);
  return () => { st.kill(); fill.style.transform = ''; head.style.left = ''; head.style.transform = ''; clock.textContent = `${film.runtime.end.day.slice(0, 3)} ${film.runtime.end.time}`; };
}
