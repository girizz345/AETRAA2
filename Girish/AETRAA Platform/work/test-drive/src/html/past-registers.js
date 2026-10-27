import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK, SWITCHER_CSS } from './shared.js';

// K6 · v5 E12: Document Control brings the old system's logs in. Drop the
// log; check how its columns were read and change any; say what odd statuses
// mean and how the log writes its dates; see every row as read, not read or
// held, with the reason; confirm. Confirmed rows become imported records
// (closed, no clocks — K5). The page is a shell: /api/past-registers decides.
export const pastRegistersHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Past registers · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1150px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
.card h2 { margin: 0 0 8px; font-size: var(--fs-body); }
.card h3 { margin: 14px 0 6px; font-size: var(--fs-secondary); }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-secondary); }
th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { font-size: var(--fs-secondary); color: var(--muted); font-weight: 500; }
td.n { text-align: right; font-variant-numeric: tabular-nums; }
.src { font-size: var(--fs-secondary); color: var(--muted); line-height: 1.45; }
.tag { font-size: var(--fs-secondary); padding: 1px 6px; border-radius: 6px; border: 1px solid var(--border); white-space: nowrap; }
.tag.read { border-color: var(--good-text); color: var(--good-text); background: var(--good-bg); }
.tag.held { border-color: var(--serious); color: var(--serious-text); background: var(--serious-bg); }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
select, input[type=text] { font: inherit; font-size: var(--fs-secondary); padding: 5px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--ink); }
.say { margin-top: 8px; font-size: var(--fs-secondary); } .say.err { color: var(--serious-text); }
.scroll { max-height: 460px; overflow: auto; border: 1px solid var(--border); border-radius: 8px; }
.tiles { display: flex; gap: 10px; flex-wrap: wrap; margin: 6px 0; }
.tiles span { border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; font-size: var(--fs-secondary); }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Past registers</h1><div class="sub">the old system’s RFI, submittal, material and NCR logs</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/">Dashboard</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>
<div class="wrap">
  <div class="card"><h2>Bring a log in</h2>
    <p class="src">Drop the log as it was kept (Excel .xlsx or .csv). Every row is read and reported. Records brought in are closed and marked “imported — not raised on this platform”: no clock runs on them, and the platform numbers its own above them. Anything still live can be taken over as a new record from the register.</p>
    <div class="row"><label class="btn">Choose the log<input type="file" id="file" accept=".xlsx,.xlsm,.csv" hidden></label>
      <select id="type"><option value="">Which log is it?</option></select></div>
    <div class="say" id="say"></div></div>
  <div class="card" id="prop" hidden></div>
  <div class="card"><h2>Logs brought in on this project</h2><table id="logs"></table></div>
</div>
<script>
var META = null, CUR = null;
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
function say(t, bad){ var e = document.getElementById('say'); e.textContent = t || ''; e.className = 'say' + (bad ? ' err' : ''); }
async function api(path, body){
  var r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  return r.json();
}
async function load(){
  META = await api('/api/past-registers');
  if (META.error) { say(META.error, true); return; }
  var sel = document.getElementById('type');
  sel.innerHTML = '<option value="">Which log is it? (read from its references)</option>' + Object.keys(META.types).map(function(k){ return '<option value="' + k + '">' + esc(META.types[k]) + '</option>'; }).join('');
  document.getElementById('logs').innerHTML = '<tr><th>Log</th><th>Kind</th><th class="n">Rows</th><th class="n">Read</th><th class="n">Held</th><th class="n">Not read</th><th>State</th><th></th></tr>' +
    (META.logs.length ? META.logs.map(function(l){
      return '<tr><td>' + esc(l.filename) + '<div class="src">' + esc(l.created_by) + ', ' + esc(String(l.created_at).slice(0, 10)) + '</div></td><td>' + esc(l.type_label || l.type) + '</td>' +
        '<td class="n">' + (l.counts.rows || 0) + '</td><td class="n">' + (l.counts.read || 0) + '</td><td class="n">' + (l.counts.held || 0) + '</td><td class="n">' + (l.counts.not_read || 0) + '</td>' +
        '<td>' + esc(l.state === 'confirmed' ? 'imported (' + (l.created_count || 0) + ')' : l.state) + '</td><td>' + (l.state === 'proposed' ? '<button class="btn" data-open="' + esc(l.id) + '">Open</button>' : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="8" class="src">None yet.</td></tr>');
}
function b64(file){ return new Promise(function(ok){ var fr = new FileReader(); fr.onload = function(){ var s = String(fr.result); ok(s.slice(s.indexOf(',') + 1)); }; fr.readAsDataURL(file); }); }
document.getElementById('file').addEventListener('change', async function(){
  var f = this.files && this.files[0]; if (!f) return;
  say('Reading every row of ' + f.name + '…');
  var d = await api('/api/past-registers/read', { filename: f.name, data: await b64(f), type: document.getElementById('type').value || undefined });
  this.value = '';
  if (d.error) { say(d.error, true); return; }
  say(''); show(d); load();
});
function show(d){
  CUR = d;
  var c = d.counts, card = document.getElementById('prop'); card.hidden = false;
  var h = '<h2>' + esc(d.filename) + ' — ' + esc(d.type_label) + '</h2>' +
    '<div class="tiles"><span><b>' + c.rows + '</b> rows</span><span class="tag read"><b>' + c.read + '</b> will be brought in</span><span class="tag held"><b>' + c.held + '</b> held for you</span><span><b>' + c.not_read + '</b> not read</span><span><b>' + c.already + '</b> already here</span></div>' +
    '<p class="src">Sheet “' + esc(d.sheet) + '”, header on row ' + d.header_row + ' · read by ' + esc(d.reader) + ' · file ' + esc(String(d.sha256).slice(0, 12)) + (d.adds_up === false ? ' · <b>the counts do not add up — tell AETRAA</b>' : '') + '</p>';
  // The columns.
  var head = d.header || [];
  h += '<h3>How its columns were read</h3><table><tr><th>Platform</th><th>Column in the log</th></tr>' + Object.keys(META.fields).map(function(k){
    return '<tr><td>' + esc(META.fields[k]) + '</td><td><select data-map="' + k + '"><option value="">(not in this log)</option>' + head.map(function(x, i){ return x ? '<option value="' + i + '"' + (d.mapping[k] === i ? ' selected' : '') + '>' + esc(x) + '</option>' : ''; }).join('') + '</select></td></tr>';
  }).join('') + '</table>';
  // Dates and statuses.
  h += '<div class="row"><span class="src">Dates in this log are written</span><select id="dord"><option value="">' + (d.date_order_settled ? 'as read from the log (' + (d.date_order === 'mdy' ? 'month first' : 'day first') + ')' : 'not yet known') + '</option><option value="dmy"' + (d.date_order === 'dmy' ? ' selected' : '') + '>day first (03/04/2025 = 3 April)</option><option value="mdy"' + (d.date_order === 'mdy' ? ' selected' : '') + '>month first (03/04/2025 = 4 March)</option></select></div>';
  if ((d.unknown_statuses || []).length) {
    h += '<h3>Statuses the platform does not know</h3><table><tr><th>In the log</th><th>Means</th></tr>' + d.unknown_statuses.map(function(s){
      return '<tr><td>' + esc(s) + '</td><td><select data-st="' + esc(s) + '"><option value="">(say what it means)</option>' + META.statuses.map(function(x){ return '<option>' + esc(x) + '</option>'; }).join('') + '<option value="keep">keep it as written</option></select></td></tr>';
    }).join('') + '</table>';
  }
  h += '<div class="row"><button class="btn" id="remap">Read it again with these</button></div>';
  // The rows.
  h += '<h3>Every row</h3><div class="scroll"><table><tr><th class="n">Row</th><th>Reference</th><th>Subject</th><th>Raised</th><th>Status</th><th></th></tr>' + d.rows.map(function(r){
    return '<tr><td class="n">' + r.row + '</td><td>' + esc(r.ref) + '</td><td>' + esc(String(r.subject || '').slice(0, 70)) + '</td><td>' + esc((r.dates || {}).raised || '') + '</td><td>' + esc(r.status || '') + '</td>' +
      '<td>' + (r.outcome === 'read' ? '<span class="tag read">read</span>' : '<span class="tag ' + (r.outcome === 'held' ? 'held' : '') + '">' + esc(r.outcome) + '</span> <span class="src">' + esc(r.why || '') + '</span>') + '</td></tr>';
  }).join('') + '</table></div>';
  h += (d.sequence || []).filter(function(s){ return s.missing.length; }).map(function(s){ return '<p class="src">' + esc(s.prefix) + ': highest ' + s.highest + ', missing from the log: ' + s.missing.slice(0, 30).join(', ') + (s.missing.length > 30 ? '…' : '') + '</p>'; }).join('');
  h += '<div class="row"><button class="btn prim" id="confirm"' + (c.read ? '' : ' disabled') + '>Bring in the ' + c.read + ' row(s) read</button><span class="src">Held rows are not brought in; fix them above and read it again, or leave them out.</span></div><div class="say" id="say2"></div>';
  card.innerHTML = h;
}
document.addEventListener('click', async function(e){
  var b = e.target.closest('button'); if (!b) return;
  var s2 = document.getElementById('say2');
  if (b.hasAttribute('data-open')) { var g = await api('/api/past-registers?id=' + encodeURIComponent(b.getAttribute('data-open'))); if (!g.error) show(g); return; }
  if (b.id === 'remap') {
    var mapping = {}; [].forEach.call(document.querySelectorAll('[data-map]'), function(x){ mapping[x.getAttribute('data-map')] = x.value === '' ? -1 : Number(x.value); });
    var sm = {}; [].forEach.call(document.querySelectorAll('[data-st]'), function(x){ if (x.value) sm[x.getAttribute('data-st')] = x.value; });
    var dord = document.getElementById('dord').value || undefined;
    var d = await api('/api/past-registers/map', { id: CUR.id, mapping: mapping, status_map: sm, date_order: dord });
    if (d.error) { s2.textContent = d.error; s2.className = 'say err'; return; }
    show(d); load(); return;
  }
  if (b.id === 'confirm') {
    if (!confirm('Bring in ' + CUR.counts.read + ' record(s) as imported? They are closed and no clock runs on them.')) return;
    b.disabled = true;
    var r = await api('/api/past-registers/confirm', { id: CUR.id });
    if (r.error) { s2.textContent = r.error; s2.className = 'say err'; b.disabled = false; return; }
    s2.textContent = r.message; s2.className = 'say'; load();
  }
});
load();
</script>
</body>
</html>`;
