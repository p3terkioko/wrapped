// Opens story mode from the film: loads its styles, the old fonts and the
// legacy data on first use, then hands over to the original showStory().
// When story mode closes (it re-shows #dashboard), the film's scroll
// position is restored and its scroll triggers re-measured.

(function () {
  'use strict';
  const FONTS = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Hind+Guntur:wght@300;400;500;600&display=swap';
  let ready = null;
  let savedScroll = 0;

  const addCss = href => new Promise(res => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href; l.onload = res; l.onerror = res;
    document.head.appendChild(l);
  });
  const addScript = src => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.body.appendChild(s);
  });

  function prepare() {
    if (ready) return ready;
    ready = Promise.all([
      addCss('/story/story-base.css?v=1'),
      addCss('/story.css?v=1'),
      addCss(FONTS),
      addScript('/story/story.js?v=1'),
      fetch('/api/public/data').then(r => r.json()),
    ]).then(async ([, , , , result]) => {
      window.currentData = result.data; // the story script's global
      try {
        await Promise.race([
          Promise.all(['400 16px "Hind Guntur"', '700 16px "JetBrains Mono"', '400 12px "JetBrains Mono"'].map(f => document.fonts.load(f))),
          new Promise(r => setTimeout(r, 2500)),
        ]);
      } catch (e) { /* show anyway */ }
    });
    return ready;
  }

  document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-story-open]');
    if (!btn) return;
    e.preventDefault();
    btn.setAttribute('aria-busy', 'true');
    try {
      await prepare();
      savedScroll = scrollY;
      window.showStory();
      document.getElementById('story-next-btn')?.focus();
    } catch (err) {
      btn.removeAttribute('aria-busy');
      alertFallback();
    }
    btn.removeAttribute('aria-busy');
  });

  // Prefetch on intent so opening feels instant.
  document.addEventListener('pointerover', e => { if (e.target.closest?.('[data-story-open]')) prepare(); }, { passive: true });

  // Story mode shows #dashboard again when it closes.
  const film = document.getElementById('dashboard');
  new MutationObserver(() => {
    if (!film.classList.contains('hidden') && document.getElementById('story-container').classList.contains('hidden')) {
      requestAnimationFrame(() => {
        scrollTo(0, savedScroll);
        window.ScrollTrigger?.refresh();
        document.querySelector('[data-story-open]')?.focus({ preventScroll: true });
      });
    }
  }).observe(film, { attributes: true, attributeFilter: ['class'] });

  function alertFallback() {
    const n = document.createElement('p');
    n.className = 'caption';
    n.textContent = 'Story mode could not load. Please check your connection and try again.';
    document.querySelector('.opening .actions')?.after(n);
  }
})();
