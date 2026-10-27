import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK, SWITCHER_CSS } from './shared.js';

// P1: the project knowledge base. AETRAA reviews what was read, what is
// missing and what was flagged, confirms the proposed links and issues it; the
// PM approves it; afterwards, what reissued documents changed is listed here
// for the PM.
export const knowledgeHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Knowledge base · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1100px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
h2 { margin: 0 0 8px; font-size: var(--fs-body); }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-secondary); }
th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { font-size: var(--fs-secondary); color: var(--muted); font-weight: 500; }
.sub { font-size: var(--fs-secondary); color: var(--muted); }
.state { padding: 9px 12px; border-radius: 8px; background: var(--surface-2); border-left: 3px solid var(--border); font-size: var(--fs-secondary); }
ul { margin: 4px 0 0 18px; padding: 0; font-size: var(--fs-secondary); }
.grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
#say { font-size: var(--fs-secondary); margin-top: 8px; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Knowledge base</h1><div class="sub">everything read at setup, cross-linked</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/api/knowledge/xlsx">Excel</a>
  <a class="btn" href="/">Dashboard</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>
<div class="wrap">
  <div class="card"><div class="state" id="state">Loading…</div><div id="acts" style="margin-top:10px"></div><div id="say"></div></div>
  <div class="card" id="changesCard" hidden><h2>What reissued documents changed</h2><ul id="changes"></ul><div id="chActs" style="margin-top:8px"></div></div>
  <div class="grid">
    <div class="card"><h2>What was read</h2><ul id="read"></ul></div>
    <div class="card"><h2>What is missing</h2><ul id="missing"></ul></div>
    <div class="card"><h2>What was flagged</h2><ul id="flagged"></ul></div>
    <div class="card"><h2>Consultant templates</h2><div id="tpl"></div></div>
  </div>
  <div class="card"><h2>Links</h2>
    <p class="sub">Drawing ↔ specification section ↔ BOQ line ↔ programme activity, proposed by rules (discipline, trade, floor, shared words) or by AI where marked. Each is confirmed or rejected by AETRAA.</p>
    <div id="linkActs"></div><table id="links" style="margin-top:8px"></table></div>
  <div class="card"><h2>Tender vs IFC</h2><p class="sub" id="tvNote"></p><table id="tv"></table></div>
  <div class="card"><h2>What the IFC drawings show (AI, proposed)</h2><table id="contents"></table></div>
</div>
<script>
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
function day(s){ return s ? String(s).slice(0, 16).replace('T', ' ') : ''; }
function li(a){ return a.length ? a.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') : '<li class="sub">Nothing.</li>'; }
async function post(path, body){ var r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); return r.json(); }
var D = null;
async function load(){
  D = await (await fetch('/api/knowledge', { cache: 'no-store' })).json();
  var st = { draft: 'Not issued yet. AETRAA reviews this summary and the links, then issues it.',
    issued: 'Issued by ' + esc(D.issued_by) + ' on ' + esc(day(D.issued_at)) + ' (version ' + esc(D.version) + '). Waiting for the PM to approve it.',
    approved: 'Approved by ' + esc(D.approved_by) + ' on ' + esc(day(D.approved_at)) + '. The schedules can now be generated.' };
  document.getElementById('state').innerHTML = st[D.state] || esc(D.state);
  var a = '';
  if (D.may.issue) a += '<button class="btn" id="propose">Propose links</button> <button class="btn" id="aiLinks">Propose more links with AI</button> <button class="btn prim" id="issue">Issue the knowledge base</button>';
  if (D.may.approve && D.state === 'issued') a += ' <button class="btn prim" id="approve">Approve the knowledge base</button>';
  document.getElementById('acts').innerHTML = a;
  var s = D.summary, r = s.read;
  document.getElementById('read').innerHTML = li([
    'Drawings: ' + r.drawings.current + ' current' + (Object.keys(r.drawings.by_kind).length ? ' (' + Object.keys(r.drawings.by_kind).map(function(k){ return r.drawings.by_kind[k] + ' ' + k; }).join(', ') + ')' : '') + (r.drawings.awaited ? ', ' + r.drawings.awaited + ' awaited' : ''),
    'BOQ: ' + r.boq.lines + ' lines, total ' + r.boq.total, 'Bill of materials: ' + r.bom.lines + ' lines',
    'Programme: ' + r.programme.activities + ' activities, data date ' + (r.programme.data_date || '—'),
    'Specification: ' + r.specification.sections + ' sections (' + r.specification.with_manufacturers + ' name manufacturers)',
    'Contract: ' + r.contract.documents + ' documents; payment terms ' + r.contract.terms_state ]);
  document.getElementById('missing').innerHTML = li(s.missing);
  document.getElementById('flagged').innerHTML = li(s.flagged);
  document.getElementById('tpl').innerHTML = '<p class="sub">Found: ' + esc(s.templates.found.map(function(t){ return t.label; }).join(', ') || 'none') + '</p><p class="sub">Missing: ' + esc(s.templates.missing.map(function(t){ return t.label; }).join(', ') || 'none') + '</p>';
  var L = D.links || [];
  document.getElementById('linkActs').innerHTML = '<span class="sub">' + L.filter(function(l){ return l.state === 'proposed'; }).length + ' proposed · ' + L.filter(function(l){ return l.state === 'confirmed'; }).length + ' confirmed · ' + L.filter(function(l){ return l.state === 'rejected'; }).length + ' rejected</span>' +
    (D.may.decide ? ' <button class="btn" id="confirmSel">Confirm the ticked</button> <button class="btn" id="rejectSel">Reject the ticked</button>' : '');
  document.getElementById('links').innerHTML = L.length ? '<tr><th>' + (D.may.decide ? '<input type="checkbox" id="all">' : '') + '</th><th>From</th><th>To</th><th>Basis</th><th>State</th></tr>' + L.map(function(l){
    return '<tr><td>' + (D.may.decide && l.state === 'proposed' ? '<input type="checkbox" class="lk" value="' + esc(l.id) + '">' : '') + '</td><td>' + esc(l.from_kind) + ': ' + esc(l.from_label) + '</td><td>' + esc(l.to_kind) + ': ' + esc(l.to_label) + '</td><td class="sub">' + esc(l.basis) + '</td><td>' + esc(l.state) + '</td></tr>'; }).join('')
    : '<tr><td class="sub">No links yet.' + (D.may.issue ? ' Press Propose links.' : '') + '</td></tr>';
  var tv = s.tender_vs_ifc;
  document.getElementById('tvNote').textContent = tv.note;
  var tr = [].concat(tv.changed.map(function(x){ return [x.number, x.title_changed ? 'revision and/or title changed' : 'revision changed', x.tender_revision + ' ' + x.tender_title, x.ifc_revision + ' ' + x.ifc_title]; }),
    tv.ifc_only.map(function(x){ return [x.number, 'new at IFC', '', x.revision + ' ' + x.title]; }), tv.tender_only.map(function(x){ return [x.number, 'no IFC issued yet', x.revision + ' ' + x.title, '']; }));
  document.getElementById('tv').innerHTML = tr.length ? '<tr><th>Number</th><th>Change</th><th>Tender</th><th>IFC</th></tr>' + tr.map(function(x){ return '<tr><td>' + x.map(esc).join('</td><td>') + '</td></tr>'; }).join('') : '<tr><td class="sub">No tender and IFC sheets to compare.</td></tr>';
  document.getElementById('contents').innerHTML = (D.drawing_contents || []).length ? '<tr><th>Drawing</th><th>Elements</th><th>Systems</th><th>Materials</th></tr>' + D.drawing_contents.map(function(x){
    var c = x.contents || {}; return '<tr><td>' + esc(x.number) + '</td><td>' + esc((c.elements || []).join(', ')) + '</td><td>' + esc((c.systems || []).join(', ')) + '</td><td>' + esc((c.materials || []).join(', ')) + '</td></tr>'; }).join('') : '<tr><td class="sub">None read yet.</td></tr>';
  var ch = D.changes || [];
  document.getElementById('changesCard').hidden = D.state !== 'approved';
  document.getElementById('changes').innerHTML = li(ch.map(function(c){ return c.what; }));
  document.getElementById('chActs').innerHTML = D.may.review && ch.length ? '<button class="btn" id="reviewed">Mark these changes reviewed</button>' : '';
  bind();
}
function ticked(){ return [].filter.call(document.querySelectorAll('input.lk'), function(x){ return x.checked; }).map(function(x){ return x.value; }); }
function say(t){ document.getElementById('say').textContent = t; }
function bind(){
  var on = function(id, fn){ var e = document.getElementById(id); if (e) e.addEventListener('click', fn); };
  on('propose', async function(){ var r = await post('/api/knowledge/links/propose'); say(r.error || r.proposed + ' new links proposed.'); load(); });
  on('aiLinks', async function(){ say('Asking the AI…'); var r = await post('/api/knowledge/ai-links'); say(r.error || r.proposed + ' links proposed by AI' + (r.discarded ? ', ' + r.discarded + ' discarded' : '') + '.'); load(); });
  on('issue', async function(){ var r = await post('/api/knowledge/issue'); say(r.error || 'Issued, version ' + r.version + '.'); load(); });
  on('approve', async function(){ var r = await post('/api/knowledge/approve'); say(r.error || 'Approved.'); load(); });
  on('confirmSel', async function(){ var r = await post('/api/knowledge/links/decide', { ids: ticked(), decision: 'confirm' }); say(r.error || r.decided + ' confirmed.'); load(); });
  on('rejectSel', async function(){ var r = await post('/api/knowledge/links/decide', { ids: ticked(), decision: 'reject' }); say(r.error || r.decided + ' rejected.'); load(); });
  on('reviewed', async function(){ var r = await post('/api/knowledge/review-changes'); say(r.error || 'Reviewed.'); load(); });
  var all = document.getElementById('all');
  if (all) all.addEventListener('change', function(){ [].forEach.call(document.querySelectorAll('input.lk'), function(x){ x.checked = all.checked; }); });
}
load();
</script>
</body>
</html>`;
