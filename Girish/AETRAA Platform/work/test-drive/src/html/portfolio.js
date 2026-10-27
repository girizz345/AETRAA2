import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK } from './shared.js';

export const portfolioHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Portfolio · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}
.wrap { max-width: 1200px; }
.cards { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); }
.pcard {
  display: block; text-decoration: none; color: inherit;
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  padding: 16px 18px; box-shadow: var(--shadow); border-top: 3px solid var(--series-1);
}
.pcard:hover { background: var(--surface-2); }
.pcard.risk { border-top-color: var(--critical); }
.pcard.warn { border-top-color: var(--serious); }
.pcard.quiet { border-top-color: var(--muted); opacity: .72; }
.pcard h2 { font-size: var(--fs-body); line-height: 1.3; }
.pcard .ref { font-size: var(--fs-secondary); color: var(--muted); margin-top: 2px; }
.meter { height: 8px; border-radius: 4px; background: var(--surface-2); overflow: hidden; margin: 14px 0 6px; }
.meter i { display: block; height: 100%; border-radius: 4px; background: var(--series-1); }
.pcard .pctline { display: flex; justify-content: space-between; align-items: baseline;
                  font-size: var(--fs-secondary); color: var(--ink-2); font-variant-numeric: tabular-nums; }
.pcard .pctline b { font-size: var(--fs-headline); color: var(--ink); font-weight: 500; letter-spacing: -0.01em; }
.facts { display: grid; gap: 7px; margin-top: 14px; padding-top: 12px;
         border-top: 1px solid var(--grid); font-size: var(--fs-secondary); }
.facts div { display: flex; justify-content: space-between; gap: 14px; align-items: baseline; }
.facts span:last-child { white-space: nowrap; }
.facts span:first-child { color: var(--muted); }
.facts span:last-child { font-variant-numeric: tabular-nums; font-weight: 500; }
.bad { color: var(--critical); font-weight: 500; }
.ok { color: var(--good-text); }
.dim { color: var(--muted); }
.empty-wrap { max-width: 520px; margin: 60px auto; text-align: center; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Portfolio</h1><div class="sub" id="sub">every project you are running</div></div>
  <div class="spacer"></div>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  <a class="btn" href="/people">People</a>
  <a class="btn" href="/admin">Admin</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  <div id="cards"><div class="empty">Loading…</div></div>
</div>
<div class="toast" id="toast"></div>

<script>
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function fmt(s) {
  if (!s) return '—';
  var d = new Date(s.slice(0, 10) + 'T00:00:00Z');
  var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return String(d.getUTCDate()).padStart(2, '0') + ' ' + m[d.getUTCMonth()] + ' ' + String(d.getUTCFullYear()).slice(2);
}
function ago(ts) {
  if (!ts) return 'never';
  var mins = Math.floor((Date.now() - Date.parse(ts)) / 60000);
  if (!isFinite(mins)) return 'never';
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + ' min ago';
  var h = Math.floor(mins / 60);
  if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
  var d = Math.floor(h / 24);
  return d + (d === 1 ? ' day ago' : ' days ago');
}
function one(n) { return (Math.round(n * 10) / 10).toFixed(1); }

async function load() {
  var r = await fetch('/api/portfolio', { cache: 'no-store' });
  if (r.status === 401) { location.href = '/'; return; }
  var d = await r.json();
  var live = d.projects.filter(function (p) { return !p.archived; });
  var box = document.getElementById('cards');

  if (!d.projects.length) {
    box.innerHTML = '<div class="empty-wrap card"><h2>No projects yet</h2>' +
      '<p class="hint" style="margin:8px 0 16px">Create your first one on the Admin page, then load its programme.</p>' +
      '<a class="btn btn-primary btn-lg" href="/admin">Go to Admin</a></div>';
    return;
  }
  document.getElementById('sub').textContent =
    live.length + (live.length === 1 ? ' project' : ' projects') +
    (d.projects.length > live.length ? ' · ' + (d.projects.length - live.length) + ' archived' : '');

  box.innerHTML = '<div class="cards">' + d.projects.map(function (p) {
    var s = p.stats;
    var pct = (s.pct || 0);
    var stale = s.last_update ? (Date.now() - Date.parse(s.last_update)) > 3 * 86400000 : true;
    var cls = p.archived ? 'quiet' : s.target_missed > 0 ? 'risk' : (s.flagged > 0 || stale) ? 'warn' : '';
    var openTargets = s.target_total - s.target_cleared;
    return '<a class="pcard ' + cls + '" href="/api/project?p=' + encodeURIComponent(p.id) + '" data-p="' + esc(p.id) + '">' +
      '<h2>' + esc(p.name) + (p.archived ? ' <span class="hint">(archived)</span>' : '') + '</h2>' +
      '<div class="ref">' + esc(p.ref || '') + '</div>' +
      '<div class="meter"><i style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></div>' +
      '<div class="pctline"><span><b>' + one(pct) + '%</b> complete</span>' +
        '<span>' + s.complete.toLocaleString() + ' of ' + s.activities.toLocaleString() + ' activities</span></div>' +
      '<div class="facts">' +
        (s.target_total
          ? '<div><span>' + esc(p.target_name || 'Target list') + '</span><span>' + openTargets + ' open</span></div>' +
            '<div><span>Missed date</span><span class="' + (s.target_missed ? 'bad' : 'ok') + '">' +
              (s.target_missed || 'none') + '</span></div>' +
            '<div><span>Deadline</span><span>' + fmt(p.target_deadline) + '</span></div>'
          : '<div><span>Target list</span><span class="dim">none loaded</span></div>' +
            '<div><span>Programme ends</span><span>' + fmt(s.last_finish) + '</span></div>' +
            '<div><span>Contract</span><span>' + fmt(p.contract_completion) + '</span></div>') +
        '<div><span>Flagged by site</span><span class="' + (s.flagged ? 'bad' : 'ok') + '">' +
          (s.flagged || 'none') + '</span></div>' +
        '<div><span>Last site update</span><span class="' + (stale ? 'bad' : '') + '">' +
          ago(s.last_update) + '</span></div>' +
      '</div></a>';
  }).join('') + '</div>';

  // Opening a card switches the session to that project, then lands on its dashboard.
  box.querySelectorAll('.pcard').forEach(function (a) {
    a.addEventListener('click', async function (e) {
      e.preventDefault();
      await fetch('/api/project?p=' + encodeURIComponent(a.dataset.p), { cache: 'no-store' });
      location.href = '/';
    });
  });
}

document.getElementById('themeBtn').addEventListener('click', function () {
  var cur = document.documentElement.getAttribute('data-theme');
  var next = cur === 'dark' ? 'light' : cur === 'light' ? '' : 'dark';
  if (next) document.documentElement.setAttribute('data-theme', next);
  else document.documentElement.removeAttribute('data-theme');
  try { localStorage.setItem('sm-theme', JSON.stringify(next)); } catch (e) {}
});
try { var sv = localStorage.getItem('sm-theme'); if (sv) document.documentElement.setAttribute('data-theme', JSON.parse(sv)); } catch (e) {}
load();
${PWA_BOOT}
</script>
</body>
</html>`;
