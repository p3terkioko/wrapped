// Chapter-level motion: the record's role in each chapter, the ring's value,
// beat loops (heartbeat, record pulse) and play-in-place.

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
  opening: 'Side A', first: 'Track 1', people: () => film.people.ranking[0].name, race: 'The race', twins: 'Twins', minds: 'Great minds', badges: 'Badges', lineup: 'Lineup',
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
    // Label and ring cut over once a chapter is past its arrival window.
    const current = y >= w.end || k === 0 ? k : k - 1;
    if (current !== shown) { shown = current; applyChapter(sections[current].dataset.chapter); }
  };
  let shown = -1;
  const applyChapter = ch => {
    const lab = LABEL[ch];
    if (lab) record.setLabel({ title: typeof lab === 'function' ? lab() : lab });
    const v = ringFor(ch);
    if (v != null) gsap.to(record.state, { arc: v, duration: BEAT * 2, ease: 'power2.inOut', onUpdate: record.render, overwrite: 'auto' });
  };
  const traveller = ScrollTrigger.create({ start: 0, end: 'max', onUpdate: place, onRefresh: () => { measure(); place(); } });
  kill.push(() => traveller.kill());

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
  // No loops on chart bars: a bar's length is its value and never moves.

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
    if (colour) setMusic(colour.trim());
  });
}

// Colour follows the music: the room's second light takes the colour of the
// cover in view (song cards, the first song, the newest tile in the mosaic).
// The variable is set on the light layer only, so nothing else restyles.
const lightEl = document.querySelector('.light');
let lastMusic = '';
export function setMusic(colour) {
  if (!colour || colour === lastMusic) return;
  lastMusic = colour;
  lightEl?.style.setProperty('--music', colour);
}

export function setupLight() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) setMusic(e.target.style.getPropertyValue('--song').trim() || e.target.dataset.colour); });
  }, { rootMargin: '-40% 0px -40% 0px' });
  document.querySelectorAll('[data-song], [data-colour]').forEach(el => io.observe(el));
}

// Exact values: hover, focus or tap any [data-tip] mark.
export function setupTips() {
  const tip = document.createElement('div');
  tip.className = 'tip'; tip.setAttribute('role', 'status'); tip.hidden = true;
  document.body.appendChild(tip);
  const show = el => { const r = el.getBoundingClientRect(); tip.textContent = el.dataset.tip; tip.style.left = (r.left + r.width / 2) + 'px'; tip.style.top = Math.max(8, r.top) + 'px'; tip.hidden = false; };
  const hide = () => { tip.hidden = true; };
  document.addEventListener('pointerover', e => { const el = e.target.closest('[data-tip]'); if (el && e.pointerType === 'mouse') show(el); });
  document.addEventListener('pointerout', e => { if (e.target.closest('[data-tip]') && e.pointerType === 'mouse') hide(); });
  document.addEventListener('click', e => { const el = e.target.closest('[data-tip]'); if (el) show(el); else hide(); });
  document.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); if (el) show(el); });
  document.addEventListener('focusout', e => { if (e.target.closest('[data-tip]')) hide(); });
  addEventListener('scroll', hide, { passive: true });
}
