import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK, SWITCHER_CSS } from './shared.js';

// K2 · What each project holds, and where its files are kept (spec §8, §12).
// AETRAA Admin only. The platform's database against its limit, the object
// store, files that fell back to the database, every project's drawings,
// records, documents, photos, bytes and last activity — and the move of the
// files still in PostgreSQL to the object store: a dry run first, then the
// move, a batch at a time, each file read back before the database copy goes.
export const storageHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Storage · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1150px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
.card h2 { margin: 0 0 8px; font-size: var(--fs-body); }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
.tile { border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; background: var(--surface-2); }
.tile .k { font-size: var(--fs-label); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.tile .v { font-size: var(--fs-headline); font-weight: 500; margin-top: 2px; }
.tile .n { font-size: var(--fs-secondary); color: var(--muted); margin-top: 2px; }
.bar { height: 8px; border-radius: 4px; background: var(--border); overflow: hidden; margin-top: 6px; }
.bar > i { display: block; height: 100%; background: var(--good-text); }
.bar.warn > i { background: var(--serious); }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-secondary); }
th, td { text-align: left; padding: 6px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { font-size: var(--fs-secondary); color: var(--muted); font-weight: 500; }
td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
.src { font-size: var(--fs-secondary); color: var(--muted); line-height: 1.45; }
.say { margin-top: 8px; font-size: var(--fs-secondary); }
.say.err { color: var(--serious-text); }
.state { font-size: var(--fs-secondary); padding: 9px 12px; border-radius: 8px; border-left: 3px solid var(--border); background: var(--surface-2); margin-bottom: 10px; }
.state.bad { border-left-color: var(--serious); background: var(--serious-bg); color: var(--serious-text); }
.scroll { overflow-x: auto; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Storage</h1><div class="sub">what each project holds, and where its files are kept</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/home">All projects</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>
<div class="wrap">
  <div class="card"><h2>The platform</h2><div id="warn"></div><div class="tiles" id="tiles">Loading…</div>
    <div class="row" style="margin-top:10px"><button class="btn" id="selftest">Check the file store now</button> <span class="src" id="selfsay"></span></div></div>
  <div class="card"><h2>Moving files out of the database</h2>
    <p class="src">Every file still held in PostgreSQL, counted first. Nothing moves until you press Move; then each file is written to the object store, read back and compared, and only then removed from the database. A file that fails stays where it was. Once moved, a file is protected by the object store's soft delete and versioning, not by the database's 7-day restore.</p>
    <div id="plan">Loading…</div>
    <div class="row" style="margin-top:10px"><button class="btn" id="dry">Run the dry run again</button> <button class="btn prim" id="move" disabled>Move them</button></div>
    <div class="say" id="movesay"></div></div>
  <div class="card"><h2>What each project holds</h2><div class="scroll"><table id="projects"></table></div></div>
</div>
<script>
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
function size(b){ if (b == null) return '—'; b = Number(b) || 0; var u = ['B','KB','MB','GB','TB'], i = 0; while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; } return (i ? b.toFixed(b < 10 ? 1 : 0) : b) + ' ' + u[i]; }
function day(s){ return s ? String(s).slice(0, 10) : '—'; }
var PLAN = null;
async function load(){
  var c = await (await fetch('/api/storage/capacity', { cache: 'no-store' })).json();
  if (c.error) { document.getElementById('tiles').textContent = c.error; return; }
  var d = c.database, pct = d.used_pct;
  document.getElementById('tiles').innerHTML =
    '<div class="tile"><div class="k">Files go to</div><div class="v" style="font-size:var(--fs-body)">' + esc(c.driver_label) + '</div><div class="n">' + (c.driver === 'database' ? 'no object store is configured' : 'configured') + '</div></div>' +
    '<div class="tile"><div class="k">Database</div><div class="v">' + size(d.bytes) + '</div><div class="n">' + (pct == null ? esc(d.how) : pct + '% of ' + d.limit_gb + ' GB') + '</div>' +
      (pct == null ? '' : '<div class="bar' + (pct >= 80 ? ' warn' : '') + '"><i style="width:' + Math.min(100, pct) + '%"></i></div>') + '</div>' +
    '<div class="tile"><div class="k">Files still in the database</div><div class="v">' + d.files_still_in_database + '</div><div class="n">' + size(d.bytes_files_in_database) + '</div></div>' +
    '<div class="tile"><div class="k">In the object store</div><div class="v">' + c.object_store.files + '</div><div class="n">' + size(c.object_store.bytes) + '</div></div>';
  var w = '';
  if (pct != null && pct >= 80) w += '<div class="state bad">The database is ' + pct + '% full. Move the files out of it below.</div>';
  if (c.fell_back.files) w += '<div class="state bad">' + c.fell_back.files + ' file(s) (' + size(c.fell_back.bytes) + ') went to the database because the object store refused them or could not be reached. Check the file store, then move them across below.</div>';
  document.getElementById('warn').innerHTML = w;
  document.getElementById('projects').innerHTML = '<tr><th>Project</th><th>Company</th><th class="n">Drawings</th><th class="n">Records</th><th class="n">Documents</th><th class="n">Photos</th><th class="n">Object store</th><th class="n">Still in the database</th><th>Last activity</th></tr>' +
    (c.projects.length ? c.projects.map(function(p){
      return '<tr><td>' + esc(p.name || p.id) + (p.archived ? ' <span class="src">(archived)</span>' : '') + '</td><td>' + esc(p.company) + '</td>' +
        '<td class="n">' + p.drawings + (p.drawings ? ' <span class="src">(' + p.drawings_live + ' live)</span>' : '') + '</td><td class="n">' + p.records + '</td><td class="n">' + p.library + '</td><td class="n">' + p.photos + '</td>' +
        '<td class="n">' + size(p.bytes_object_store) + '</td><td class="n">' + size(p.bytes_in_database) + '</td><td>' + esc(day(p.last_activity)) + '</td></tr>';
    }).join('') : '<tr><td colspan="9" class="src">No projects yet.</td></tr>');
}
async function plan(){
  var p = PLAN = await (await fetch('/api/storage/move', { cache: 'no-store' })).json();
  if (p.error) { document.getElementById('plan').textContent = p.error; return; }
  var rows = p.sources.filter(function(s){ return s.count; });
  document.getElementById('plan').innerHTML = (p.why_not ? '<div class="state bad">' + esc(p.why_not) + '</div>' : '') +
    (rows.length ? '<table><tr><th>What</th><th class="n">Files</th><th class="n">Size</th></tr>' + rows.map(function(s){
      return '<tr><td>' + esc(s.label) + '</td><td class="n">' + s.count + '</td><td class="n">' + size(s.bytes) + '</td></tr>'; }).join('') +
      '<tr><td><b>Total</b>' + (p.can_move ? ' — to ' + esc(p.target_label) : '') + '</td><td class="n"><b>' + p.total.count + '</b></td><td class="n"><b>' + size(p.total.bytes) + '</b></td></tr></table>'
      : '<p class="src">Nothing is held in the database. Every file is in ' + esc(p.target_label) + '.</p>');
  document.getElementById('move').disabled = !(p.can_move && p.total.count);
}
document.getElementById('dry').addEventListener('click', plan);
document.getElementById('move').addEventListener('click', async function(){
  if (!PLAN || !confirm('Move ' + PLAN.total.count + ' file(s) out of the database to ' + PLAN.target_label + '? Each is read back before the database copy is removed.')) return;
  var b = this, say = document.getElementById('movesay'), total = 0, failed = [];
  b.disabled = true; say.className = 'say';
  for (var round = 0; round < 1000; round++) {
    var r = await (await fetch('/api/storage/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: 'move', limit: 100 }) })).json();
    if (r.error) { say.className = 'say err'; say.textContent = r.error; break; }
    total += r.moved; failed = r.failed;
    say.textContent = total + ' moved · ' + r.remaining.count + ' left' + (failed.length ? ' · ' + failed.length + ' failed' : '');
    if (r.finished || !r.moved) break;
  }
  if (failed.length) { say.className = 'say err'; say.textContent += ' — ' + failed.slice(0, 5).map(function(f){ return f.source + ' ' + f.id + ': ' + f.error; }).join('; '); }
  await plan(); await load();
});
document.getElementById('selftest').addEventListener('click', async function(){
  var r = await (await fetch('/api/storage', { cache: 'no-store' })).json();
  document.getElementById('selfsay').textContent = r.working ? 'Working: a test file was stored in ' + r.label + ', read back and removed.' : (r.note || 'Not working — the test file did not round-trip.');
});
load(); plan();
</script>
</body>
</html>`;
