import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK, SWITCHER_CSS } from './shared.js';

// K8 · v5 E15: a subcontractor's timesheet, read and reviewed, filling the
// diary's manpower for that subcontractor and day. Drop the sheet; check what
// was read (every row, held ones with the reason); say whose it is or which
// day when the sheet does not; put it in the diary.
export const timesheetsHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Timesheets · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 980px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
.card h2 { margin: 0 0 8px; font-size: var(--fs-body); } .card h3 { margin: 12px 0 6px; font-size: var(--fs-secondary); }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-secondary); }
th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { font-size: var(--fs-secondary); color: var(--muted); font-weight: 500; } td.n { text-align: right; font-variant-numeric: tabular-nums; }
.src { font-size: var(--fs-secondary); color: var(--muted); } .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
input[type=text], input[type=date], select { font: inherit; font-size: var(--fs-secondary); padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--ink); }
.say { margin-top: 8px; font-size: var(--fs-secondary); } .say.err { color: var(--serious-text); }
.tag { font-size: var(--fs-secondary); padding: 1px 6px; border-radius: 6px; border: 1px solid var(--border); }
.tag.held { border-color: var(--serious); color: var(--serious-text); background: var(--serious-bg); }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Timesheets</h1><div class="sub">subcontractors’ manpower into the diary</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/diary">Daily diary</a>
  <a class="btn" href="/">Dashboard</a>
</div></div>
<div class="wrap">
  <div class="card"><h2>Read a timesheet</h2>
    <p class="src">Drop the subcontractor’s daily timesheet (Excel or CSV) — one row per worker, or one per trade. Every row is read and reported; nothing is put in the diary until you say so.</p>
    <div class="row"><label class="btn">Choose the timesheet<input type="file" id="file" accept=".xlsx,.xlsm,.csv" hidden></label>
      <input type="text" id="sub" placeholder="Subcontractor (if the sheet does not say)"> <input type="date" id="day" title="Day (if the sheet does not say)"></div>
    <div class="say" id="say"></div></div>
  <div class="card" id="res" hidden></div>
  <div class="card"><h2>Manpower by trade and day</h2><div class="row"><input type="date" id="from"> to <input type="date" id="to"> <button class="btn" id="xl">Download (Excel)</button></div></div>
</div>
<script>
var CUR = null;
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
function say(id, t, bad){ var e = document.getElementById(id); e.textContent = t || ''; e.className = 'say' + (bad ? ' err' : ''); }
async function api(path, body){ var r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' }); return r.json(); }
function b64(file){ return new Promise(function(ok){ var fr = new FileReader(); fr.onload = function(){ var s = String(fr.result); ok(s.slice(s.indexOf(',') + 1)); }; fr.readAsDataURL(file); }); }
var FILE = null;
async function read(){
  if (!FILE) return;
  say('say', 'Reading ' + FILE.name + '…');
  var d = await api('/api/diary/timesheets/read', { filename: FILE.name, data: await b64(FILE), subcontractor: document.getElementById('sub').value || undefined, day: document.getElementById('day').value || undefined });
  if (d.error) { say('say', d.error, true); return; }
  say('say', ''); show(d);
}
document.getElementById('file').addEventListener('change', function(){ FILE = this.files[0]; read(); });
function show(d){
  CUR = d; var el = document.getElementById('res'); el.hidden = false;
  var h = '<h2>' + esc(d.filename) + '</h2><p class="src">Read by ' + esc(d.reader) + ' · file ' + esc(String(d.sha256).slice(0, 12)) + (d.state === 'applied' ? ' · <b>already in the diary</b>' : '') + '</p>';
  d.groups.forEach(function(g){
    h += '<h3>' + esc(g.subcontractor || '(whose?)') + ' — ' + esc(g.day || '(which day?)') + ' · ' + g.men + ' men, ' + g.man_hours + ' man-hours <span class="src">(' + esc(g.layout) + ', sheet ' + esc(g.sheet) + ')</span></h3>';
    if (g.held.length) h += '<p class="say err">' + g.held.map(esc).join(' · ') + ' — fill it in above and read the timesheet again.</p>';
    h += '<table><tr><th>Trade</th><th class="n">Men</th><th class="n">Hours each</th><th class="n">Man-hours</th></tr>' + g.lines.map(function(l){ return '<tr><td>' + esc(l.trade) + '</td><td class="n">' + l.count + '</td><td class="n">' + l.hours + '</td><td class="n">' + l.man_hours + '</td></tr>'; }).join('') + '</table>';
    var off = g.rows.filter(function(r){ return r.outcome !== 'read'; });
    if (off.length) h += '<p class="src">' + off.map(function(r){ return 'row ' + r.row + ': <span class="tag ' + (r.outcome === 'held' ? 'held' : '') + '">' + esc(r.outcome) + '</span> ' + esc(r.why); }).join('<br>') + '</p>';
  });
  h += '<div class="row"><input type="text" id="reason" placeholder="If the day’s diary is already submitted: why it is changed"> <button class="btn prim" id="apply">Put it in the diary</button></div><div class="say" id="say2"></div>';
  el.innerHTML = h;
}
document.addEventListener('click', async function(e){
  if (e.target.id === 'apply') {
    var r = await api('/api/diary/timesheets/apply', { id: CUR.id, reason: document.getElementById('reason').value || undefined });
    if (r.error) { say('say2', r.error, true); return; }
    say('say2', r.applied.map(function(a){ return a.subcontractor + ' on ' + a.day + ': ' + a.men + ' men, ' + a.man_hours + ' man-hours in the diary' + (a.revised ? ' (the submitted diary was revised; the earlier version is kept)' : ''); }).join(' · '));
  }
  if (e.target.id === 'xl') location.href = '/api/diary/manpower.xlsx?from=' + document.getElementById('from').value + '&to=' + document.getElementById('to').value;
});
</script>
</body>
</html>`;
