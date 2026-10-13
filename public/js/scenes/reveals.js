// Reveals: CSS transitions switched on by an IntersectionObserver, so nothing
// is measured or tweened at load. An element gets .is-in when it is 82% up the
// viewport and loses it when it drops back below (reversible). Bars grow from
// zero. Staggers come from --i, set once here. Without this script (or with
// motion off) the reveal rules don't apply and everything shows final state.

const SELECTORS = {
  bars: '.bar',
  cols: '.col',
  fade: ':scope > *',
  stack: '.stack__part',
  wheel: '.kw-seg',
  clock: '.clock-bar',
  dots: '.moodmap__dots',
};

export function setupReveals() {
  const html = document.documentElement;
  const els = [...document.querySelectorAll('[data-reveal], .headline[data-split]')];
  els.forEach(el => {
    const sel = SELECTORS[el.dataset.reveal];
    if (!sel) return;
    el.querySelectorAll(sel).forEach((kid, i) => kid.style.setProperty('--i', i));
  });
  // Anything already on screen starts revealed, so nothing flashes.
  const vh = innerHeight;
  els.forEach(el => { if (el.getBoundingClientRect().top < vh * 0.82) el.classList.add('is-in'); });
  html.classList.add('reveal-ready');
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) e.target.classList.add('is-in');
      else if (e.boundingClientRect.top > 0) e.target.classList.remove('is-in'); // scrolled back above it
    });
  }, { rootMargin: '0px 0px -18% 0px' });
  els.forEach(el => io.observe(el));
  return () => { io.disconnect(); html.classList.remove('reveal-ready'); els.forEach(el => el.classList.remove('is-in')); };
}
