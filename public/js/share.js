// Share cards: any chapter as a 1080×1920 image (WhatsApp Status, Instagram
// Stories). Drawn on a canvas from the chapter's own headline, so the card
// says exactly what the page says. No album artwork is drawn (Spotify's
// artwork rules); the record, the words and the numbers carry it.

import { film } from './motion.js';
import { currentPerson } from './find.js';

const W = 1080, H = 1920;
const C = { lacquer: '#0e0b09', cream: '#f3e9d6', cream2: 'rgba(243,233,214,0.72)', vermilion: '#ff5b33', gold: '#e9b44c', green: '#1d5c45' };

export function setupShare() {
  // One quiet button per chapter, after its headline block.
  document.querySelectorAll('main.film > section .chapter__head').forEach(head => {
    const sec = head.closest('section');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'share-btn';
    b.dataset.share = sec.id;
    b.textContent = 'Share this';
    b.setAttribute('aria-label', `Share this chapter as an image: ${head.querySelector('h2')?.textContent.trim().slice(0, 80) || sec.id}`);
    head.appendChild(b);
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-share]');
    if (!b) return;
    e.preventDefault();
    share(b.dataset.share || 'opening', b);
  });
}

function segmentsOf(h) {
  // Headline → [{ text, num }] with asides split off.
  const segs = [], aside = [];
  const walk = (node, num, inAside) => {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) (inAside ? aside : segs).push({ text: n.textContent, num });
      else if (n.nodeType === 1) {
        if (n.classList.contains('sr-only') || n.tagName === 'BUTTON') continue;
        walk(n, num || n.classList.contains('n'), inAside || n.classList.contains('aside'));
      }
    }
  };
  walk(h, false, false);
  return { segs, aside: aside.map(s => s.text).join('').trim() };
}

function wrapRich(ctx, segs, maxW, font, numFont) {
  const words = [];
  segs.forEach(s => s.text.split(/(\s+)/).forEach(w => { if (w) words.push({ w, num: s.num }); }));
  const lines = [[]];
  let x = 0;
  for (const t of words) {
    ctx.font = t.num ? numFont : font;
    const wd = ctx.measureText(t.w).width;
    if (/^\s+$/.test(t.w)) { if (x > 0) { lines[lines.length - 1].push({ ...t, wd }); x += wd; } continue; }
    if (x + wd > maxW && x > 0) { lines.push([]); x = 0; }
    lines[lines.length - 1].push({ ...t, wd }); x += wd;
  }
  return lines.map(l => { while (l.length && /^\s+$/.test(l[l.length - 1].w)) l.pop(); return l; });
}

function wrapPlain(ctx, text, maxW) {
  const out = []; let line = '';
  for (const w of text.split(/\s+/)) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
  }
  if (line) out.push(line);
  return out;
}

function drawRecord(ctx, cx, cy, R, arc) {
  const g = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R);
  g.addColorStop(0, '#16110d'); g.addColorStop(1, '#0a0806');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(243,233,214,0.05)'; ctx.lineWidth = 1.2;
  for (let r = R * 0.5; r < R * 0.98; r += R * 0.018) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
  const sheen = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  sheen.addColorStop(0.3, 'rgba(255,255,255,0)'); sheen.addColorStop(0.47, 'rgba(255,231,184,0.12)'); sheen.addColorStop(0.62, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  const L = R * 0.48;
  ctx.fillStyle = C.cream; ctx.beginPath(); ctx.arc(cx, cy, L, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = C.vermilion; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, L * 0.94, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = C.green; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, L * 0.78, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = C.lacquer; ctx.beginPath(); ctx.arc(cx, cy, L * 0.43, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.gold;
  for (let k = 0; k < 3; k++) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate((k * 2 * Math.PI) / 3);
    ctx.beginPath(); ctx.moveTo(-L * 0.1, -L * 0.07); ctx.lineTo(-L * 0.15, -L * 0.42); ctx.quadraticCurveTo(0, -L * 0.47, L * 0.15, -L * 0.42); ctx.lineTo(L * 0.1, -L * 0.07); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(cx, cy, L * 0.17, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.lacquer; ctx.beginPath(); ctx.arc(cx, cy, L * 0.05, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(243,233,214,0.1)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R * 1.09, 0, Math.PI * 2); ctx.stroke();
  if (arc > 0) {
    ctx.strokeStyle = C.vermilion; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.09, -Math.PI / 2, -Math.PI / 2 + arc * Math.PI * 2); ctx.stroke();
  }
}

async function render(sectionId) {
  await Promise.all(['800 92px Fraunces', 'italic 600 92px Fraunces', '400 30px "Fraunces Text"', '400 28px "JetBrains Mono"'].map(f => document.fonts.load(f).catch(() => {})));
  const sec = document.getElementById(sectionId) || document.getElementById('opening');
  const h = sec.querySelector('h2, h1');
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = C.lacquer; ctx.fillRect(0, 0, W, H);
  const music = getComputedStyle(document.querySelector('.light')).getPropertyValue('--music').trim() || C.gold;
  const g1 = ctx.createRadialGradient(W * 0.75, H * 0.22, 0, W * 0.75, H * 0.22, W * 0.9);
  g1.addColorStop(0, 'rgba(233,180,76,0.18)'); g1.addColorStop(1, 'rgba(233,180,76,0)');
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
  const g2 = ctx.createRadialGradient(W * 0.15, H * 0.9, 0, W * 0.15, H * 0.9, W);
  g2.addColorStop(0, music); g2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.16; ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  // Grain, blended on top (putImageData would replace pixels, not blend).
  const tile = document.createElement('canvas'); tile.width = tile.height = 256;
  const tctx = tile.getContext('2d'); const img = tctx.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  tctx.putImageData(img, 0, 0);
  ctx.globalAlpha = 0.05; ctx.fillStyle = ctx.createPattern(tile, 'repeat'); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;

  const arcFor = { people: film.people.ranking[0].share / 100, sound: film.sound.families[0].n / film.sound.familyCoverage.songs };
  drawRecord(ctx, W * 0.62, 560, 330, arcFor[sectionId] || 0);

  const PAD = 90, maxW = W - PAD * 2;
  let y = 1040;
  if (sectionId === 'opening') {
    ctx.fillStyle = C.cream; ctx.font = '800 150px Fraunces'; ctx.fillText('KamiLimu', PAD, y); y += 140;
    ctx.fillStyle = C.cream2; ctx.font = 'italic 600 130px Fraunces'; ctx.fillText('.inthe.Ears', PAD, y); y += 110;
    const t = film.totals;
    var segs = [{ text: `${t.entries}`, num: true }, { text: ' songs, pressed by ', num: false }, { text: `${t.contributors}`, num: true }, { text: ' people since March 2024.', num: false }];
    var aside = '';
  } else {
    var { segs, aside } = segmentsOf(h);
  }
  let size = sectionId === 'opening' ? 64 : 96;
  let lines;
  for (;;) {
    lines = wrapRich(ctx, segs, maxW, `800 ${size}px Fraunces`, `italic 600 ${size}px Fraunces`);
    if (lines.length <= 6 || size <= 58) break;
    size -= 6;
  }
  for (const l of lines) {
    let x = PAD;
    for (const t of l) { ctx.font = t.num ? `italic 600 ${size}px Fraunces` : `800 ${size}px Fraunces`; ctx.fillStyle = t.num ? C.vermilion : C.cream; ctx.fillText(t.w, x, y); x += t.wd; }
    y += size * 1.02;
  }
  if (aside) { y += 10; ctx.font = `italic 600 ${Math.round(size * 0.56)}px Fraunces`; ctx.fillStyle = C.cream2; for (const l of wrapPlain(ctx, aside, maxW)) { ctx.fillText(l, PAD, y); y += size * 0.64; } }
  const you = sec.querySelector('.you-line');
  const me = currentPerson();
  if (you && me) {
    y += 30; ctx.font = '400 40px "Fraunces Text"'; ctx.fillStyle = C.gold;
    for (const l of wrapPlain(ctx, you.textContent.trim(), maxW)) { ctx.fillText(l, PAD, y); y += 52; }
  }
  // Footer.
  ctx.fillStyle = 'rgba(243,233,214,0.12)'; ctx.fillRect(PAD, H - 250, maxW, 2);
  ctx.font = '800 54px Fraunces'; ctx.fillStyle = C.cream; ctx.fillText('KamiLimu.inthe.Ears', PAD, H - 170);
  ctx.font = '400 30px "JetBrains Mono"'; ctx.fillStyle = C.gold;
  const link = location.host + (me ? `/?me=${me.id}` : '');
  ctx.fillText(link.length > 52 ? location.host : link, PAD, H - 118);
  ctx.font = '400 24px "JetBrains Mono"'; ctx.fillStyle = 'rgba(243,233,214,0.55)';
  ctx.fillText(`Data from Spotify and friends · as of ${new Date(film.generatedAt).toISOString().slice(0, 10)}`, PAD, H - 76);
  return canvas;
}

async function share(sectionId, btn) {
  btn?.setAttribute('aria-busy', 'true');
  try {
    const canvas = await render(sectionId);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    const file = new File([blob], `kamilimu-${sectionId}.png`, { type: 'image/png' });
    const me = currentPerson();
    const url = location.origin + '/' + (me ? `?me=${encodeURIComponent(me.id)}` : '') + (sectionId !== 'opening' ? `#${sectionId}` : '');
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'KamiLimu.inthe.Ears', text: url });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
  } catch (err) {
    if (err?.name !== 'AbortError') console.warn('share failed', err);
  } finally {
    btn?.removeAttribute('aria-busy');
  }
}

export { render as renderCard };
