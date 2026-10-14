// Live pulse: the server-rendered "latest add" comes from the last refresh;
// once the page is idle, ask the API (CDN-cached for five minutes) whether
// Spotify has something newer, and update the line if so.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function stamp(iso) {
  const d = new Date(Date.parse(iso) + 3 * 3600e3);
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
}

export function setupPulse() {
  const line = document.getElementById('pulse-line');
  if (!line) return;
  const run = async () => {
    try {
      const p = await (await fetch('/api/public/pulse')).json();
      if (!p || !p.song || !p.live) return;
      const shown = JSON.parse(document.getElementById('film-data').textContent).pulse;
      if (shown && Date.parse(p.at) <= Date.parse(shown.at)) return;
      // When this check rebuilt the numbers, a reload shows the song everywhere.
      const more = p.refreshed ? ` <a href="${esc(location.pathname + location.search)}">Reload to see it in the mosaic and charts</a>` : '';
      line.innerHTML = `<span class="dot" aria-hidden="true"></span><span class="now-playing__k">Latest add</span> <span>${esc(stamp(p.at))}</span> <span>${esc(p.name)} added <a href="${esc(p.song.url)}">${esc(p.song.name)}</a> by ${esc(p.song.artists)}</span>${more}`;
      line.classList.add('is-new');
    } catch { /* keep the server's version */ }
  };
  ('requestIdleCallback' in window) ? requestIdleCallback(run, { timeout: 4000 }) : setTimeout(run, 2000);
}
