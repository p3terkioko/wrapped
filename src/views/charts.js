'use strict';

// Server-rendered chart pieces. Bars always start at zero; every chart has a
// text alternative; labels sit on the marks.

const { esc, fmt, pct } = require('./util');

// Horizontal bars as HTML (names above bars on phones, beside on desktop).
// rows: [{ label, value, note?, highlight?, you? , href? }]
function hbars(rows, { max, unit = '', caption = '', id = '', valueFmt = v => fmt(v), share = null } = {}) {
  const top = max ?? Math.max(...rows.map(r => r.value), 1);
  return `<ol class="hbars" data-reveal="bars"${id ? ` id="${esc(id)}"` : ''}>
${rows.map(r => `  <li class="hbar${r.highlight ? ' is-lead' : ''}${r.you ? ' is-you' : ''}"${r.key ? ` data-key="${esc(r.key)}"` : ''}>
    <span class="hbar__label">${r.href ? `<a href="${esc(r.href)}">${esc(r.label)}</a>` : esc(r.label)}${r.note ? ` <small>${esc(r.note)}</small>` : ''}</span>
    <span class="hbar__track"><span class="bar" style="--w:${((r.value / top) * 100).toFixed(2)}%"></span></span>
    <span class="hbar__value">${valueFmt(r.value)}${unit}${share ? ` <small>${pct(share(r))}</small>` : ''}</span>
  </li>`).join('\n')}
</ol>${caption ? `<p class="caption">${caption}</p>` : ''}`;
}

// Vertical column chart as SVG with an accessible table fallback.
// cols: [{ label, value, highlight?, tick? }]
function columns(cols, { height = 180, title, desc, labelEvery = 1, id = '', valueLabels = false } = {}) {
  const W = Math.max(cols.length * 14, 300), H = height, B = 22, T = valueLabels ? 18 : 6;
  const max = Math.max(...cols.map(c => c.value), 1);
  const bw = W / cols.length;
  const bars = cols.map((c, i) => {
    const h = ((H - B - T) * c.value) / max;
    const x = i * bw + bw * 0.12, w = bw * 0.76;
    return `<rect class="col${c.highlight ? ' is-lead' : ''}" x="${x.toFixed(1)}" y="${(H - B - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1"><title>${esc(c.label)}: ${fmt(c.value)}</title></rect>` +
      (valueLabels && c.value ? `<text class="col-v" x="${(x + w / 2).toFixed(1)}" y="${(H - B - h - 5).toFixed(1)}" text-anchor="middle">${fmt(c.value)}</text>` : '') +
      ((i % labelEvery === 0 || c.tick) && c.label ? `<text class="axis" x="${(x + w / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(c.label)}</text>` : '');
  }).join('');
  return `<svg class="columns"${id ? ` id="${esc(id)}"` : ''} viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-labelledby="${id}-t ${id}-d" data-reveal="cols">
  <title id="${id}-t">${esc(title)}</title><desc id="${id}-d">${esc(desc)}</desc>
  <line class="baseline" x1="0" x2="${W}" y1="${H - B}" y2="${H - B}"/>${bars}
</svg>`;
}

// A small two-ring glyph whose overlap reflects a Jaccard similarity.
function overlapGlyph(j) {
  const d = 22 - 20 * Math.min(1, j * 2.5);
  return `<svg class="twin-glyph" viewBox="0 0 64 34" aria-hidden="true"><circle cx="${(32 - d / 2).toFixed(1)}" cy="17" r="13"/><circle cx="${(32 + d / 2).toFixed(1)}" cy="17" r="13"/></svg>`;
}

module.exports = { hbars, columns, overlapGlyph };
