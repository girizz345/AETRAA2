import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK, SWITCHER_CSS } from './shared.js';

// Spec §14 and §30: a contractor can see their own project's intake history —
// what was loaded, when, by whom, and what was held — with each drop's report.
// A gate whose workings are invisible reads as arbitrary; one whose reasons are
// on screen reads as a control. Spec §4: the folders this company has asked the
// platform to remember are listed here too, and can be removed.
export const intakeHistoryHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Intake history · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1000px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-secondary); }
th, td { text-align: left; padding: 7px 6px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { font-size: var(--fs-secondary); color: var(--muted); font-weight: 500; }
.sub { font-size: var(--fs-secondary); color: var(--muted); }
#say { font-size: var(--fs-secondary); margin-top: 8px; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Intake history</h1><div class="sub">every drop of documents onto this project</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/held">Held documents</a>
  <a class="btn" href="/">Dashboard</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>
<div class="wrap">
  <div class="card"><h2 style="margin:0 0 8px;font-size:var(--fs-body)">Drops</h2><table id="drops"></table></div>
  <div class="card"><h2 style="margin:0 0 8px;font-size:var(--fs-body)">Folders this company has asked the platform to remember</h2>
    <p class="sub">A file in a folder of this name is filed as shown, on every project of this company.</p>
    <table id="folders"></table><div id="say"></div></div>
</div>
<script>
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
function day(s){ return s ? String(s).slice(0, 16).replace('T', ' ') : ''; }
var STATUS = { scanning: 'being read', reviewing: 'in review', committing: 'filing', partly_committed: 'partly filed', done: 'filed', abandoned: 'abandoned' };
async function load(){
  var h = await (await fetch('/api/intake/history', { cache: 'no-store' })).json();
  var rows = (h && h.batches) || [];
  document.getElementById('drops').innerHTML = rows.length
    ? '<tr><th>When</th><th>By</th><th>Files</th><th>Where they went</th><th>Status</th><th>Report</th></tr>' + rows.map(function(b){
        var s = b.summary || {};
        var parts = ['filed', 'held', 'archived', 'skipped', 'failed', 'proposed', 'confirmed', 'abandoned']
          .filter(function(k){ return s[k]; }).map(function(k){ return s[k] + ' ' + (k === 'archived' ? 'already there' : k === 'skipped' ? 'left out' : k); });
        var q = '/api/intake/report?batch=' + encodeURIComponent(b.id);
        return '<tr><td>' + esc(day(b.started_at)) + '</td><td>' + esc(b.started_by) + '</td><td>' + esc(b.file_count) + '</td>'
          + '<td class="sub">' + esc(parts.join(' · ') || '—') + '</td><td>' + esc(STATUS[b.status] || b.status) + '</td>'
          + '<td><a href="' + q + '&format=pdf">PDF</a> · <a href="' + q + '&format=xlsx">Excel</a></td></tr>';
      }).join('')
    : '<tr><td class="sub">No documents have been loaded onto this project through intake yet.</td></tr>';
  var f = await (await fetch('/api/intake/folder-map', { cache: 'no-store' })).json();
  var list = (f && f.remembered) || [];
  document.getElementById('folders').innerHTML = list.length
    ? '<tr><th>Folder name</th><th>Filed as</th><th>Confirmed by</th><th></th></tr>' + list.map(function(m){
        return '<tr><td>' + esc(m.pattern) + '</td><td>' + esc(m.family_label || m.family) + '</td><td class="sub">' + esc(m.confirmed_by) + ' ' + esc(day(m.confirmed_at)) + '</td>'
          + '<td><button class="btn" data-rm="' + esc(m.id) + '">Remove</button></td></tr>';
      }).join('')
    : '<tr><td class="sub">None yet. After a drop, folders that held several files of one kind are offered here.</td></tr>';
  [].forEach.call(document.querySelectorAll('button[data-rm]'), function(b){
    b.addEventListener('click', async function(){
      var r = await fetch('/api/intake/folder-map', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remove: b.getAttribute('data-rm') }) });
      var d = await r.json();
      document.getElementById('say').textContent = d.error ? d.error : 'Removed.';
      load();
    });
  });
}
load();
</script>
</body>
</html>`;
