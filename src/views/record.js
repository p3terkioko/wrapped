'use strict';

// The seven-inch single: the one shape that never leaves the screen.
// Layers (so only the label spins, as a composited transform):
//   base   — lacquer, grooves, fixed sheen (the light doesn't turn with the disc)
//   ring   — outer gauge: a share, a clock, a key wheel (set per chapter by script)
//   label  — cream paper label, ringed text, title, catalogue line, spider adapter

const { esc } = require('./util');

function grooves() {
  let out = '';
  for (let r = 47; r <= 90; r += 1.6) {
    const o = r > 88 ? 0.05 : 0.035 + (Math.sin(r * 1.7) + 1) * 0.012;
    out += `<circle r="${r.toFixed(1)}" fill="none" stroke="#f3e9d6" stroke-opacity="${o.toFixed(3)}" stroke-width=".35"/>`;
  }
  return out;
}

function spider() {
  let arms = '';
  for (let k = 0; k < 3; k++) arms += `<path d="M -4.2,-3 L -6.5,-18.5 Q 0,-20.5 6.5,-18.5 L 4.2,-3 Z" transform="rotate(${k * 120})"/>`;
  return `<g fill="#e9b44c">${arms}<circle r="7.5"/></g><circle r="2.2" fill="#0e0b09"/>`;
}

function renderRecord({ ringText, title, catalogue }) {
  const C = (2 * Math.PI * 101).toFixed(2);
  return `<div class="record" id="record" aria-hidden="true">
  <svg viewBox="-110 -110 220 220" class="record__base">
    <defs>
      <radialGradient id="lac" cx="50%" cy="50%" r="50%"><stop offset=".55" stop-color="#16110d"/><stop offset="1" stop-color="#0a0806"/></radialGradient>
      <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset=".28" stop-color="#fff" stop-opacity="0"/><stop offset=".46" stop-color="#ffe7b8" stop-opacity=".13"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/></linearGradient>
    </defs>
    <circle r="101" fill="none" stroke="rgba(243,233,214,.08)" stroke-width="1.2"/>
    <circle r="92" fill="url(#lac)"/>
    ${grooves()}
    <circle r="92" fill="url(#sheen)"/>
  </svg>
  <svg viewBox="-110 -110 220 220" class="record__ring">
    <circle id="ring-arc" r="101" fill="none" stroke="#ff5b33" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="0 ${C}" transform="rotate(-90)"/>
    <circle id="ring-head" r="3.4" fill="#ff5b33" cx="0" cy="-101" opacity="0"/>
    <g id="ring-marks"></g>
  </svg>
  <svg viewBox="-110 -110 220 220" class="record__label" id="record-label">
    <defs><path id="label-ring" d="M 0,-38.5 A 38.5,38.5 0 1 1 -0.01,-38.5"/></defs>
    <circle r="44" fill="#f3e9d6"/>
    <circle r="41.5" fill="none" stroke="#ff5b33" stroke-width="1.1"/>
    <circle r="34.5" fill="none" stroke="#1d5c45" stroke-width=".5"/>
    <text fill="#1d5c45" font-family="JetBrains Mono, monospace" font-size="3.7" letter-spacing="1"><textPath href="#label-ring" textLength="236" lengthAdjust="spacing" id="label-ring-text">${esc(ringText)}</textPath></text>
    <text id="label-title" x="0" y="-24.5" text-anchor="middle" fill="#0e0b09" font-family="Fraunces, Georgia, serif" font-weight="600" font-style="italic" font-size="6.2">${esc(title)}</text>
    <text id="label-cat" x="0" y="28.5" text-anchor="middle" fill="#ff5b33" font-family="JetBrains Mono, monospace" font-size="3.2" letter-spacing=".7">${esc(catalogue)}</text>
    <circle r="19" fill="#0e0b09"/>
    ${spider()}
  </svg>
</div>`;
}

module.exports = { renderRecord };
