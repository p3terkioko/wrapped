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

// Vertical columns as HTML, so labels keep their real size at any width
// (an SVG stretched to the container distorts text). Each column can be
// focused or tapped to read its exact value.
// cols: [{ label, value, highlight?, tick? }]
function columns(cols, { title, desc, id = '', valueLabels = false, height = 200, unit = 'songs' } = {}) {
  const max = Math.max(...cols.map(c => c.value), 1);
  const plot = cols.map(c => {
    const tip = `${c.tipLabel || c.label}: ${fmt(c.value)} ${unit}`;
    return `<span class="colchart__c${c.highlight ? ' is-lead' : ''}" tabindex="0" data-tip="${esc(tip)}">${valueLabels ? `<span class="colchart__v">${c.value ? fmt(c.value) : ''}</span>` : ''}<span class="col" style="--h:${((c.value / max) * 100).toFixed(2)}%"></span></span>`;
  }).join('');
  const axis = cols.map(c => `<span>${esc(c.label || '')}</span>`).join('');
  return `<figure class="colchart"${id ? ` id="${esc(id)}"` : ''} style="--plot-h:${height}px" data-reveal="cols">
  <div class="colchart__plot" role="img" aria-label="${esc(title)}. ${esc(desc)}">${plot}</div>
  <div class="colchart__axis" aria-hidden="true">${axis}</div>
</figure>`;
}

// A small two-ring glyph whose overlap reflects a Jaccard similarity.
function overlapGlyph(j) {
  const d = 22 - 20 * Math.min(1, j * 2.5);
  return `<svg class="twin-glyph" viewBox="0 0 64 34" aria-hidden="true"><circle cx="${(32 - d / 2).toFixed(1)}" cy="17" r="13"/><circle cx="${(32 + d / 2).toFixed(1)}" cy="17" r="13"/></svg>`;
}

module.exports = { hbars, columns, overlapGlyph };
