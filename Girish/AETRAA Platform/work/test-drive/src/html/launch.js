import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK } from './shared.js';

// AETRAA only: what this server has been given and what it still needs before
// real people use it — read from the running server (src/launch-check.js).
export const launchHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Launch check · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}
.wrap { max-width: 980px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-secondary); } td, th { padding: 7px 6px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
.ok { color: var(--good-ink); font-weight: 500; } .missing { color: var(--bad-ink); font-weight: 500; } .check { color: var(--warn-ink); font-weight: 500; }
.sub { font-size: var(--fs-secondary); color: var(--muted); }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Launch check</h1><div class="sub">what this server has, and what it still needs</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/">Home</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>
<div class="wrap">
  <div class="card"><div id="top">Checking…</div></div>
  <div class="card"><table id="list"></table></div>
  <div class="card"><b>Checked by hand after deploy</b><ul id="hand" class="sub"></ul></div>
</div>
<script>
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
fetch('/api/launch-check', { cache: 'no-store' }).then(function(r){ return r.json(); }).then(function(d){
  if (d.error) { document.getElementById('top').textContent = d.error; return; }
  document.getElementById('top').innerHTML = d.ok ? '<span class="ok">Nothing missing.</span> ' + (d.to_check ? d.to_check + ' to check.' : '') : '<span class="missing">' + d.missing + ' missing</span>' + (d.to_check ? ', ' + d.to_check + ' to check' : '') + '. <span class="sub">Checked ' + esc(d.at.slice(0, 16).replace('T', ' ')) + ' UTC</span>';
  var L = { ok: 'OK', missing: 'Missing', check: 'Check' };
  document.getElementById('list').innerHTML = '<tr><th></th><th>What</th><th>This server</th><th>To do</th></tr>' + d.items.map(function(x){
    return '<tr><td class="' + x.state + '">' + L[x.state] + '</td><td>' + esc(x.label) + '</td><td class="sub">' + esc(x.detail) + '</td><td class="sub">' + esc(x.todo || '') + '</td></tr>'; }).join('');
  document.getElementById('hand').innerHTML = (d.by_hand || []).map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('');
});
</script>
</body>
</html>`;
