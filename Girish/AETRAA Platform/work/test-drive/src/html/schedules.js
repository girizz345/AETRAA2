import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK, SWITCHER_CSS } from './shared.js';

// P2-P5: the four schedules, one tab each. The owning team reviews (adds,
// removes, corrects links, lead times and dates), the PM approves the
// baseline, and each item raises its submittal and is then tracked live.
export const schedulesHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Schedules · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1250px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
.tabs button { margin-right: 6px; }
.tabs button[aria-pressed="true"] { background: var(--series-1); color: var(--on-accent); }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-secondary); }
th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { font-size: var(--fs-secondary); color: var(--muted); font-weight: 500; }
.sub { font-size: var(--fs-secondary); color: var(--muted); }
.late { color: var(--critical); font-weight: 500; }
input.sm { width: 80px; font: inherit; padding: 2px 4px; }
#say { font-size: var(--fs-secondary); margin-top: 8px; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Schedules</h1><div class="sub">shop drawings · materials · method statements · ITPs</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/knowledge">Knowledge base</a>
  <a class="btn" href="/">Dashboard</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>
<div class="wrap">
  <div class="card"><div class="tabs" id="tabs"></div><div id="head" style="margin-top:10px"></div><div id="say"></div></div>
  <div class="card" id="gatesCard" hidden><h2 style="margin:0 0 6px;font-size:var(--fs-body)">Coverage gaps (must all be cleared before the PM approves)</h2><table id="gates"></table></div>
  <div class="card"><table id="items"></table><div id="add" style="margin-top:10px"></div></div>
</div>
<script>
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
async function post(path, body){ var r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); return r.json(); }
function say(t){ document.getElementById('say').textContent = t; }
var TAB = 'shop', S = null;
var TABS = [['shop', 'P2 Shop drawings'], ['material', 'P3 Materials'], ['ms', 'P4 Method statements'], ['itp', 'P5 ITPs']];
function tabs(){
  document.getElementById('tabs').innerHTML = TABS.map(function(t){ return '<button class="btn" data-t="' + t[0] + '" aria-pressed="' + (t[0] === TAB) + '">' + t[1] + '</button>'; }).join('') +
    ' <button class="btn" id="gen">Generate / refresh</button>';
  [].forEach.call(document.querySelectorAll('[data-t]'), function(b){ b.addEventListener('click', function(){ TAB = b.getAttribute('data-t'); load(); }); });
  document.getElementById('gen').addEventListener('click', async function(){ var r = await post('/api/schedules/generate'); say(r.error || 'Added: ' + Object.keys(r.added).map(function(k){ return r.added[k] + ' ' + k; }).join(', ') + '.'); load(); });
}
async function load(){
  tabs();
  S = await (await fetch('/api/schedules?s=' + TAB, { cache: 'no-store' })).json();
  var m = S.may || {};
  document.getElementById('head').innerHTML = '<b>' + esc(S.code + ' ' + S.label) + '</b> — ' +
    (S.state === 'approved' ? 'baseline approved by ' + esc(S.approved_by) + ' on ' + esc(String(S.approved_at || '').slice(0, 10)) : 'draft: the team reviews it, then the PM approves it') +
    ' · <a href="/api/schedules/xlsx?s=' + TAB + '">Excel</a>' +
    (m.review ? ' · <button class="btn" id="ai">Propose more items with AI</button>' : '') +
    (m.approve && S.state !== 'approved' ? ' · <button class="btn prim" id="approve">Approve the baseline</button>' : '') +
    '<div class="sub">Dates: from the programme where it has its own activity, otherwise derived back from the first activity that needs the item (start − lead time − review − one resubmission − preparation). They move with every programme update.</div>';
  var g = S.gates;
  document.getElementById('gatesCard').hidden = !g;
  if (g) document.getElementById('gates').innerHTML = g.gates.length ? '<tr><th>Gap</th><th>What</th><th>Cleared</th></tr>' + g.gates.map(function(x){
    return '<tr><td>' + esc(x.gate) + '</td><td>' + esc(x.what) + '</td><td>' + (x.resolved ? esc(x.resolution) + ' <span class="sub">(' + esc(x.by) + ')</span>' :
      (m.review ? '<input class="gr" data-k="' + esc(x.key) + '" placeholder="covered by… / not a material because…" style="width:260px"> <button class="btn gb" data-k="' + esc(x.key) + '">Clear</button>' : 'open')) + '</td></tr>'; }).join('')
    : '<tr><td class="sub">No gaps.</td></tr>';
  var it = S.items || [];
  document.getElementById('items').innerHTML = it.length ? '<tr><th>Sr</th><th>Discipline</th><th>Item</th><th>Spec</th><th>Activity / basis</th><th>Lead (days)</th><th>Planned submit</th><th>Baseline</th><th>Actual</th><th>Code</th><th>Status</th><th></th></tr>' + it.map(function(i){
    var extra = TAB === 'shop' && i.based_on.length ? '<div class="sub">based on ' + esc(i.based_on.join(', ')) + '</div>' : '';
    if (TAB === 'itp' && i.hold_points.length) extra += '<div class="sub">hold/witness: ' + esc(i.hold_points.map(function(h){ return 'p.' + h.page + ' ' + h.quote; }).join(' | ')) + '</div>';
    if (TAB === 'itp' && i.inspections.length) extra += '<div class="sub">inspections: ' + esc(i.inspections.map(function(x){ return x.activity + ' ' + x.planned; }).join(', ')) + '</div>';
    if (TAB === 'material' && i.notes) extra += '<div class="sub">' + esc(i.notes) + '</div>';
    if (TAB === 'ms' && i.risk_draft) extra += '<details><summary class="sub">risk assessment draft (AI) — for HSE to check</summary><pre style="white-space:pre-wrap">' + esc(i.risk_draft) + '</pre></details>';
    return '<tr><td>' + esc(i.sr) + '</td><td>' + esc(i.discipline) + '</td><td>' + esc(i.description) + (i.state === 'proposed' ? ' <span class="sub">(proposed)</span>' : '') + extra + '</td><td>' + esc(i.spec_code) + '</td>' +
      '<td>' + (m.review ? '<input class="sm ed" data-id="' + esc(i.id) + '" data-f="activity_id" value="' + esc(i.activity_id || '') + '"> ' : esc(i.activity_id || '')) + esc(i.activity_name) + '<div class="sub">' + esc(i.basis) + '</div></td>' +
      '<td>' + (m.review ? '<input class="sm ed" data-id="' + esc(i.id) + '" data-f="lead_days" value="' + esc(i.lead_days == null ? '' : i.lead_days) + '">' : esc(i.lead_days)) + '</td>' +
      '<td class="' + (i.late ? 'late' : '') + '">' + esc(i.planned_submit || '—') + '<div class="sub">' + esc(i.date_source) + (i.date_note ? ': ' + esc(i.date_note) : '') + '</div></td>' +
      '<td>' + esc(i.baseline_submit || '') + '</td><td>' + esc(i.actual_submit || '') + '</td><td>' + esc(i.code) + '</td><td>' + (i.late ? '<span class="late">late</span> ' : '') + esc(i.record_ref ? i.record_ref + ' ' + i.status : i.status) + '</td>' +
      '<td>' + (!i.record_ref && S.state === 'approved' ? '<button class="btn rs" data-id="' + esc(i.id) + '">Raise</button> ' : '') + (TAB === 'ms' && m.review ? '<button class="btn rk" data-id="' + esc(i.id) + '">Risk (AI)</button> ' : '') +
      (m.review ? '<button class="btn rm" data-id="' + esc(i.id) + '">Remove</button>' : '') + '</td></tr>'; }).join('')
    : '<tr><td class="sub">No items. The schedules are generated once the PM approves the knowledge base — or press Generate / refresh.</td></tr>';
  document.getElementById('add').innerHTML = m.review ? '<input id="nd" placeholder="Add an item: description" style="width:380px"> <input id="ns" placeholder="spec section" style="width:110px"> <button class="btn" id="addBtn">Add</button>' : '';
  bind();
}
function bind(){
  var on = function(id, fn){ var e = document.getElementById(id); if (e) e.addEventListener('click', fn); };
  on('approve', async function(){ var r = await post('/api/schedules/approve', { schedule: TAB }); say(r.error || 'Approved: ' + r.items + ' items baselined.'); load(); });
  on('ai', async function(){ say('Asking the AI…'); var r = await post('/api/schedules/ai-propose', { schedule: TAB }); say(r.error || r.proposed + ' items proposed.'); load(); });
  on('addBtn', async function(){ var r = await post('/api/schedules/item', { schedule: TAB, description: document.getElementById('nd').value, spec_code: document.getElementById('ns').value }); say(r.error || 'Added.'); load(); });
  [].forEach.call(document.querySelectorAll('input.ed'), function(x){ x.addEventListener('change', async function(){ var b = { schedule: TAB, id: x.getAttribute('data-id') }; b[x.getAttribute('data-f')] = x.value; var r = await post('/api/schedules/item', b); say(r.error || 'Saved.'); load(); }); });
  [].forEach.call(document.querySelectorAll('button.rm'), function(x){ x.addEventListener('click', async function(){ var r = await post('/api/schedules/item', { schedule: TAB, id: x.getAttribute('data-id'), remove: true }); say(r.error || 'Removed.'); load(); }); });
  [].forEach.call(document.querySelectorAll('button.rs'), function(x){ x.addEventListener('click', async function(){ var r = await post('/api/schedules/raise', { id: x.getAttribute('data-id') }); say(r.error || 'Raised ' + r.ref + '.'); load(); }); });
  [].forEach.call(document.querySelectorAll('button.rk'), function(x){ x.addEventListener('click', async function(){ say('Drafting…'); var r = await post('/api/schedules/risk', { id: x.getAttribute('data-id') }); say(r.error || r.note); load(); }); });
  [].forEach.call(document.querySelectorAll('button.gb'), function(x){ x.addEventListener('click', async function(){ var k = x.getAttribute('data-k'); var v = document.querySelector('input.gr[data-k="' + k.replace(/"/g, '') + '"]'); var r = await post('/api/schedules/gate', { key: k, resolution: v ? v.value : '' }); say(r.error || 'Cleared.'); load(); }); });
}
load();
</script>
</body>
</html>`;
