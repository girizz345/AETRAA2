import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK, SWITCHER_CSS } from './shared.js';

// E13: the specification, findable by section number and title. Document
// Control (or AETRAA at setup) builds the index from a specification in the
// library; Design confirms it, and its sections go live for the schedules,
// the material package and RFIs. Each section opens on its own.
export const specHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Specification index · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1100px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-secondary); }
th, td { text-align: left; padding: 6px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { font-size: var(--fs-secondary); color: var(--muted); font-weight: 500; }
.sub { font-size: var(--fs-secondary); color: var(--muted); }
.tag { font-size: var(--fs-secondary); padding: 1px 6px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--border); margin-right: 3px; }
input[type=search], select { font: inherit; padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--ink); }
#say { font-size: var(--fs-secondary); margin-top: 8px; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Specification index</h1><div class="sub">every section by number and title</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/">Dashboard</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>
<div class="wrap">
  <div class="card">
    <h2 style="margin:0 0 8px;font-size:var(--fs-body)">Build an index</h2>
    <p class="sub">From a specification already in the library, or upload one (it is filed in the library first). It is split into sections only where a table of contents or section headings can be read; otherwise it stays whole, with the reason.</p>
    <select id="lib"><option value="">Choose a specification…</option></select>
    <button class="btn" id="build">Read it</button>
    <span class="sub"> or </span><input type="file" id="up" accept=".pdf">
    <div id="say"></div>
  </div>
  <div class="card" id="proposal" hidden></div>
  <div class="card">
    <h2 style="margin:0 0 8px;font-size:var(--fs-body)">Live sections</h2>
    <input type="search" id="q" placeholder="Section number or title"> <a class="btn" href="/api/spec-sections/xlsx">Excel</a>
    <table id="live" style="margin-top:10px"></table>
  </div>
</div>
<script>
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
var REQ = { shop_drawings: 'shop drawings', product_data: 'product data', samples: 'samples', mock_up: 'mock-up', method_statement: 'method statement', testing: 'testing', inspection: 'inspection' };
function reqTags(rq){ return Object.keys(REQ).filter(function(k){ return rq && rq[k] && rq[k].length; }).map(function(k){
  return '<span class="tag" title="' + esc(rq[k].map(function(h){ return 'p.' + h.page + ': ' + h.sentence; }).join(' | ')) + '">' + REQ[k] + '</span>'; }).join(''); }
var STATE = null;
async function load(){
  var d = await (await fetch('/api/spec-index', { cache: 'no-store' })).json();
  STATE = d;
  document.getElementById('lib').innerHTML = '<option value="">Choose a specification…</option>' + (d.specifications || []).map(function(x){
    return '<option value="' + esc(x.id) + '">' + esc(x.title || x.filename) + '</option>'; }).join('');
  var open = (d.indexes || []).find(function(x){ return x.state === 'proposed'; });
  if (open) showIndex(open.id); else document.getElementById('proposal').hidden = true;
  live();
}
async function showIndex(id){
  var ix = await (await fetch('/api/spec-index?id=' + encodeURIComponent(id), { cache: 'no-store' })).json();
  var r = ix.result || {}, el = document.getElementById('proposal');
  el.hidden = false;
  var h = '<h2 style="margin:0 0 6px;font-size:var(--fs-body)">' + esc(ix.filename) + ' — waiting for Design to confirm</h2>';
  if (!r.split) h += '<p>' + esc(r.reason) + '</p>';
  else {
    h += '<p class="sub">' + r.sections.length + ' sections, found from the ' + (r.method === 'contents' ? 'table of contents' : 'section headings') + ' · ' + r.pages + ' pages' +
      (r.unread_pages.length ? ' · ' + r.unread_pages.length + ' pages with no text (not read): ' + esc(r.unread_pages.slice(0, 20).join(', ')) : '') +
      (r.not_located ? ' · ' + r.not_located + ' listed in the contents but not found in the pages' : '') + '</p>';
    h += '<table><tr><th>Section</th><th>Title</th><th>Discipline</th><th>Pages</th><th>Manufacturers named</th><th>Requirements found</th></tr>' + r.sections.map(function(s){
      return '<tr><td>' + esc(s.code) + '</td><td><input data-code="' + esc(s.code) + '" class="ti" value="' + esc(s.title) + '" style="width:100%"></td><td>' + esc(s.discipline) + '</td><td>' +
        (s.page_from ? s.page_from + '–' + s.page_to : '<span class="sub">' + esc(s.note || 'not located') + '</span>') + '</td><td>' + esc((s.manufacturers || []).join(', ')) +
        (s.or_equal ? ' <span class="tag">or equal</span>' : '') + '</td><td>' + reqTags(s.requirements) + '</td></tr>'; }).join('') + '</table>';
  }
  h += STATE && STATE.may_confirm ? '<button class="btn prim" id="confirm" style="margin-top:10px">Confirm the index</button>' : '<p class="sub">Design confirms this index before it is used.</p>';
  el.innerHTML = h;
  var b = document.getElementById('confirm');
  if (b) b.addEventListener('click', async function(){
    var edits = [].map.call(document.querySelectorAll('input.ti'), function(i){ return { code: i.getAttribute('data-code'), title: i.value }; });
    var x = await (await fetch('/api/spec-index/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ix.id, edits: edits }) })).json();
    document.getElementById('say').textContent = x.error ? x.error : x.sections + ' sections are now live.';
    load();
  });
}
async function live(){
  var q = document.getElementById('q').value;
  var d = await (await fetch('/api/spec-sections?q=' + encodeURIComponent(q), { cache: 'no-store' })).json();
  var rows = d.sections || [];
  document.getElementById('live').innerHTML = rows.length ? '<tr><th>Section</th><th>Title</th><th>Discipline</th><th>Pages</th><th>Manufacturers</th><th>Requirements</th><th></th></tr>' + rows.map(function(s){
    return '<tr><td>' + esc(s.code) + '</td><td>' + esc(s.title) + '</td><td>' + esc(s.discipline) + '</td><td>' + (s.page_from ? s.page_from + '–' + s.page_to : '—') + '</td><td>' +
      esc((s.manufacturers || []).join(', ')) + '</td><td>' + reqTags(s.requirements) + '</td><td>' + (s.page_from ? '<a href="/api/spec-sections/file?id=' + encodeURIComponent(s.id) + '">PDF</a>' : '') + '</td></tr>'; }).join('')
    : '<tr><td class="sub">No confirmed index yet.</td></tr>';
}
async function build(body){
  document.getElementById('say').textContent = 'Reading…';
  var r = await (await fetch('/api/spec-index', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  document.getElementById('say').textContent = r.error ? r.error : (r.result.split ? r.result.sections.length + ' sections found.' : 'Not split: ' + r.result.reason);
  if (!r.error) { await load(); showIndex(r.id); }
}
document.getElementById('build').addEventListener('click', function(){ var v = document.getElementById('lib').value; if (v) build({ library_id: v }); });
document.getElementById('up').addEventListener('change', async function(){
  var f = this.files[0]; if (!f) return;
  var data = await new Promise(function(ok, bad){ var fr = new FileReader(); fr.onload = function(){ ok(String(fr.result).split(',')[1] || ''); }; fr.onerror = bad; fr.readAsDataURL(f); });
  build({ filename: f.name, data: data });
});
document.getElementById('q').addEventListener('input', live);
load();
</script>
</body>
</html>`;
