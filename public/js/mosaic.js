// The mosaic: one tile per add, in add order. Each tile shows its song's
// cover, unaltered and uncropped (Spotify's artwork rules), loaded lazily and
// in add order. Until a cover arrives, or with Data Saver on, the tile shows
// the colour extracted from that cover. The artwork itself is never animated;
// tiles appear by cut, and the newest ones get a gold outline drawn in the gap
// around them.
//
// Performance: settled tiles live on a base canvas that only gains tiles as
// the scrub moves forward; covers are decoded off the main thread and drawn
// straight in (no per-tile clipping: at 15–24 px a rounded corner would be
// under 2 px and invisible); the playhead outline is on its own overlay.

import { film } from './motion.js';

const COLS = 23;
const ART = 'https://i.scdn.co/image/';

export function createMosaic() {
  const host = document.getElementById('mosaic');
  const svg = host.querySelector('svg');
  const { colours, days, songs } = film.opening.tiles;
  const total = colours.length;
  const base = document.createElement('canvas');
  const over = document.createElement('canvas');
  for (const c of [base, over]) { c.setAttribute('aria-hidden', 'true'); host.appendChild(c); }
  svg.style.opacity = '0'; // stays in the accessibility tree with its <title>
  const bctx = base.getContext('2d');
  const octx = over.getContext('2d');
  let cell = 0, dpr = 1, side = 0, gap = 0, radius = 0;
  let day = Infinity, glow = 0, drawnUpTo = -1, raf = 0;
  const images = new Map();   // small-cover hash → HTMLImageElement
  const pending = new Set();  // covers decoded but not yet swapped in
  let hashOf = null;          // tile index → small-cover hash
  let mine = null;            // tile indices to outline for Find yourself

  function size() {
    const r = svg.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    for (const c of [base, over]) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
    cell = r.width / COLS;
    gap = Math.max(1, cell * 0.12);
    side = cell - gap;
    radius = Math.max(1, Math.min(4, side * 0.1)); // Spotify: 4px corners on small artwork
    drawnUpTo = -1;
    bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.clearRect(0, 0, base.width, base.height);
    schedule();
  }

  function rounded(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function paintTile(i, x, y) {
    const hash = hashOf && hashOf[i];
    const img = hash && images.get(hash);
    const px = side * dpr;
    if (img) bctx.drawImage(img, x, y, px, px);
    else { bctx.fillStyle = colours[i] ? '#' + colours[i] : 'rgba(243,233,214,.22)'; bctx.fillRect(x, y, px, px); }
  }

  const xy = i => [((i % COLS) * cell + gap / 2) * dpr, (Math.floor(i / COLS) * cell + gap / 2) * dpr];

  function draw() {
    raf = 0;
    if (!cell) return;
    // Tiles are in add order, so "visible" is always a prefix 0..last.
    let last = -1;
    while (last + 1 < total && days[last + 1] <= day) last++;
    if (last < drawnUpTo) { bctx.clearRect(0, 0, base.width, base.height); drawnUpTo = -1; }
    for (let i = drawnUpTo + 1; i <= last; i++) { const [x, y] = xy(i); paintTile(i, x, y); }
    drawnUpTo = last;
    // Swap in covers that finished decoding since the last frame.
    if (pending.size && hashOf) {
      for (let i = 0; i <= drawnUpTo; i++) if (pending.has(hashOf[i])) { const [x, y] = xy(i); paintTile(i, x, y); }
      pending.clear();
    }
    octx.clearRect(0, 0, over.width, over.height);
    // Find yourself: your tiles get a thin gold outline, outside the artwork.
    if (mine && mine.size) {
      octx.strokeStyle = 'rgba(233,180,76,.95)';
      octx.lineWidth = Math.max(1.2, gap * 0.7) * dpr;
      octx.globalAlpha = 1;
      for (const i of mine) {
        if (i > last) continue;
        const [x, y] = xy(i);
        const g = gap * 0.45 * dpr;
        rounded(octx, x - g, y - g, side * dpr + 2 * g, side * dpr + 2 * g, (radius + gap * 0.45) * dpr);
        octx.stroke();
      }
    }
    // Playhead outline around the latest tiles, outside the artwork.
    if (glow > 0 && last >= 0) {
      octx.strokeStyle = '#e9b44c';
      octx.lineWidth = Math.max(1, gap * 0.6) * dpr;
      for (let i = last; i >= 0 && last - i < 6; i--) {
        const a = 1 - (day - days[i]) / glow;
        if (a <= 0) break;
        octx.globalAlpha = a;
        const [x, y] = xy(i);
        const g = gap * 0.45 * dpr;
        rounded(octx, x - g, y - g, side * dpr + 2 * g, side * dpr + 2 * g, (radius + gap * 0.45) * dpr);
        octx.stroke();
      }
      octx.globalAlpha = 1;
    }
  }

  function schedule() { if (!raf) raf = requestAnimationFrame(draw); }

  // Fetch covers in add order, six at a time.
  async function loadArt() {
    if (navigator.connection && navigator.connection.saveData) return;
    let tracks;
    try { tracks = await (await fetch('/api/public/tracks')).json(); } catch { return; }
    const small = tracks.songs && tracks.songs.small;
    if (!small) return;
    hashOf = songs.map(si => small[si]);
    const order = [...new Set(hashOf.filter(Boolean))];
    let next = 0;
    const worker = async () => {
      while (next < order.length) {
        const hash = order[next++];
        await new Promise(res => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = ART + hash;
          img.decode().then(() => { images.set(hash, img); pending.add(hash); schedule(); }, () => {}).finally(res);
        });
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
  }

  addEventListener('resize', size);
  size();

  return {
    setDay(d, glowDays = 0) { if (d === day && glowDays === glow) return; day = d; glow = glowDays; schedule(); },
    loadArt,
    highlight(set) { mine = set; drawnUpTo = Math.min(drawnUpTo, drawnUpTo); schedule(); },
    destroy() { removeEventListener('resize', size); base.remove(); over.remove(); svg.style.opacity = ''; },
  };
}
