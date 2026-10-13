// Chapter-level motion: the record's role in each chapter, the ring's value,
// beat loops (heartbeat, breathing bars, record pulse) and play-in-place.

import { film, BEAT, isPhone } from '../motion.js';
import * as record from '../record.js';

// Which record role each chapter uses (chapters not listed sit in the corner).
const ROLE_OF = { opening: 'opening', first: 'first', growth: 'growth', runtime: 'runtime', people: 'people', families: 'families', tempo: 'tempo', finale: 'finale' };
const roleOf = el => ROLE_OF[el.dataset.chapter] || 'corner';

// What the ring shows in a chapter (null leaves it to the chapter's own scene).
function ringFor(chapter) {
  if (chapter === 'people') return film.people.ranking[0].share / 100;
  if (chapter === 'families') { const s = film.sound; return s.families[0].n / s.familyCoverage.songs; }
  if (chapter === 'growth' || chapter === 'runtime') return null;
  return 0;
}
const LABEL = {
  opening: 'Side A', first: 'Track 1', people: () => film.people.ranking[0].name, race: 'The race', twins: 'Twins', minds: 'Great minds', badges: 'Badges',
  families: () => film.sound.families[0].family, eras: 'The eras', mood: 'The mood', tempo: () => `${Math.round(film.sound.tempo.median)} BPM`, keys: () => film.sound.keys.top.name,
  language: 'Kiswahili', geo: 'Made in', rhythm: () => film.rhythm.peak.name, hours: 'The hours', streaks: 'Binges', picks: 'Today', nostalgia: 'Then & now', convo: 'Replies', credits: 'Credits', finale: 'Side A',
};

export function setupChapters() {
  const { gsap, ScrollTrigger } = window;
  const kill = [];
  const sections = [...document.querySelectorAll('main.film > section[data-chapter]')];
  const keys = ['x', 'y', 's', 'o'];

  // The record's position is a single function of scroll: between the moment
  // a chapter's top enters the viewport and when it reaches 35% from the top,
  // the record travels from the previous chapter's role to this one's. One
  // owner, so nothing overwrites anything on load or resize.
  let windows = [];
  const measure = () => {
    windows = sections.map((sec, i) => {
      const top = sec.getBoundingClientRect().top + scrollY;
      return { role: roleOf(sec), start: top - innerHeight, end: top - innerHeight * 0.35, i };
    });
  };
  const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const place = () => {
    if (!windows.length) return;
    const y = scrollY;
    let k = 0;
    for (let i = 1; i < windows.length; i++) if (windows[i].start <= y) k = i;
    const w = windows[k];
    const to = record.roleState(w.role);
    let v = to;
    if (k > 0 && y < w.end) {
      const from = record.roleState(windows[k - 1].role);
      const t = ease(Math.min(1, Math.max(0, (y - w.start) / (w.end - w.start))));
      v = Object.fromEntries(keys.map(key => [key, from[key] + (to[key] - from[key]) * t]));
    }
    for (const key of keys) record.state[key] = v[key];
    record.render();
  };
  const traveller = ScrollTrigger.create({ start: 0, end: 'max', onUpdate: place, onRefresh: () => { measure(); place(); } });
  kill.push(() => traveller.kill());

  // Ring value and label per chapter, cut on entry.
  sections.forEach(sec => {
    const ch = sec.dataset.chapter;
    const apply = () => {
      const lab = LABEL[ch];
      if (lab) record.setLabel({ title: typeof lab === 'function' ? lab() : lab });
      const v = ringFor(ch);
      if (v != null) gsap.to(record.state, { arc: v, duration: BEAT * 2, ease: 'power2.inOut', onUpdate: record.render, overwrite: 'auto' });
    };
    const st = ScrollTrigger.create({ trigger: sec, start: 'top 55%', end: 'bottom 55%', onEnter: apply, onEnterBack: apply });
    kill.push(() => st.kill());
  });

  // Beat loops, only while their chapter is in view (the motion toggle kills them).
  const loop = (trigger, build) => {
    let tl = null;
    const st = ScrollTrigger.create({ trigger, start: 'top 85%', end: 'bottom 15%',
      onToggle: self => { if (self.isActive) { tl = tl || build(); tl.play(); } else tl?.pause(); } });
    kill.push(() => { st.kill(); tl?.kill(); });
  };
  const ecg = document.getElementById('ecg');
  if (ecg) loop('#tempo', () => {
    const len = ecg.getTotalLength();
    gsap.set(ecg, { strokeDasharray: `${len * 0.32} ${len}` });
    const tl = gsap.timeline({ repeat: -1, paused: true });
    tl.fromTo(ecg, { strokeDashoffset: len * 0.32 }, { strokeDashoffset: -len, duration: BEAT * 2, ease: 'none' });
    tl.to(record.state, { s: '+=0.02', duration: BEAT * 0.18, ease: 'power2.out', yoyo: true, repeat: 1, onUpdate: record.render }, 0)
      .to(record.state, { s: '+=0.02', duration: BEAT * 0.18, ease: 'power2.out', yoyo: true, repeat: 1, onUpdate: record.render }, BEAT);
    return tl;
  });
  const wk = document.querySelector('#weekday-chart');
  if (wk) loop('#rhythm', () => gsap.timeline({ repeat: -1, paused: true })
    .to(wk.querySelectorAll('.col'), { scaleY: 1.03, duration: BEAT * 0.18, ease: 'power2.out' })
    .to(wk.querySelectorAll('.col'), { scaleY: 1, duration: BEAT * 0.82, ease: 'power2.in' }));

  return () => kill.forEach(fn => fn());
}

// Play in place: a tap swaps the button for Spotify's embedded player, and
// the page light takes the song's colour. Works with motion on or off.
export function setupPlay() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-play]');
    if (!btn) return;
    const id = btn.dataset.play;
    const frame = document.createElement('iframe');
    frame.className = 'embed';
    frame.title = 'Spotify player';
    frame.loading = 'lazy';
    frame.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    frame.src = `https://open.spotify.com/embed/track/${encodeURIComponent(id)}?theme=0`;
    btn.replaceWith(frame);
    const colour = btn.closest('[data-song]')?.style.getPropertyValue('--song');
    if (colour) document.documentElement.style.setProperty('--music', colour.trim());
  });
}
