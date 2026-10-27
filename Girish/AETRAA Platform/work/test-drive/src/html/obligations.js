import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK, SWITCHER_CSS } from './shared.js';

// A4: the contract obligations register. The QS finds them (the AI reads the
// indexed clauses) and confirms each line against its clause; the Principal
// approves; approved obligations are live and their periods drive the notice
// clock (A13). The quotation is the contract's own words and is never edited.
export const obligationsHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Contract obligations · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1100px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-secondary); } td, th { padding: 6px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
th { font-size: var(--fs-secondary); color: var(--muted); }
.q { font-style: italic; }
.sub { font-size: var(--fs-secondary); color: var(--muted); }
.flag { font-size: var(--fs-secondary); color: var(--critical); }
select, input { font: inherit; font-size: var(--fs-secondary); padding: 3px; max-width: 130px; }
.pill { font-size: var(--fs-secondary); padding: 2px 7px; border-radius: 9px; background: var(--surface-2); }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Contract obligations</h1><div class="sub">clause · quotation · who it binds · period</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/delays">Delays and EOT</a>
  <a class="btn" href="/">Dashboard</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>
<div class="wrap">
  <div class="card"><span id="acts"></span> <span class="sub" id="say"></span></div>
  <div class="card"><table id="list"></table></div>
</div>
<script>
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
async function post(path, body){ var r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); return r.json().catch(function(){ return { error: 'no answer from the server' }; }); }
function say(t){ document.getElementById('say').textContent = t; }
var D = null;
var LABEL = { proposed: 'proposed by AI — check it', confirmed: 'confirmed — waiting for the Principal', approved: 'approved — live', rejected: 'rejected' };
async function load(){
  D = await (await fetch('/api/obligations', { cache: 'no-store' })).json();
  if (D.error) { say(D.error); return; }
  var a = '';
  if (D.may.find && D.ai_on) a += '<button class="btn" id="find">Find clauses</button> ';
  var conf = D.obligations.filter(function(o){ return o.state === 'confirmed'; }).length;
  if (D.may.approve && conf) a += '<button class="btn prim" id="approve">Approve the ' + conf + ' confirmed</button>';
  document.getElementById('acts').innerHTML = a;
  var rows = D.obligations.filter(function(o){ return o.state !== 'rejected'; });
  document.getElementById('list').innerHTML = rows.length ? '<tr><th>Clause</th><th>The contract’s words</th><th>Binds</th><th>Kind</th><th>Period</th><th>Starts from</th><th>Status</th><th></th></tr>' + rows.map(function(o){
    var edit = D.may.confirm && (o.state === 'proposed' || o.state === 'confirmed');
    var sel = function(name, list, cur){ return '<select data-f="' + name + '">' + (name === 'binds' && !cur ? '<option value="">— who —</option>' : '') + list.map(function(x){ return '<option' + (x === cur ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>'; };
    return '<tr data-id="' + esc(o.id) + '"><td><b>' + esc(o.clause_key) + '</b><div class="sub">' + esc(o.clause_heading || '') + (o.page ? ' · page ' + esc(o.page) : '') + '</div></td>' +
      '<td><div class="q">“' + esc(o.quote) + '”</div><div class="sub">' + esc(o.summary || '') + '</div>' + (o.flags || []).map(function(f){ return '<div class="flag">' + esc(f) + '</div>'; }).join('') + '</td>' +
      (edit ? '<td>' + sel('binds', D.binds, o.binds) + '</td><td>' + sel('kind', D.kinds, o.kind) + '</td><td><input data-f="period_days" type="number" min="0" style="width:60px" value="' + esc(o.period_days == null ? '' : o.period_days) + '"> days</td><td><input data-f="trigger_text" value="' + esc(o.trigger_text || '') + '"></td>'
        : '<td>' + esc(o.binds) + '</td><td>' + esc(o.kind) + '</td><td>' + esc(o.period_text || '') + '</td><td>' + esc(o.trigger_text || '') + '</td>') +
      '<td><span class="pill">' + esc(LABEL[o.state] || o.state) + '</span>' + (o.confirmed_by ? '<div class="sub">' + esc(o.confirmed_by) + '</div>' : '') + '</td>' +
      '<td>' + (edit ? '<button class="btn ok">Confirm</button> <button class="btn no">Reject</button>' : '') + '</td></tr>';
  }).join('') : '<tr><td class="sub">No obligations yet.' + (D.may.find ? ' File the contract in the library, rebuild the project index, then press “Find clauses”.' : '') + '</td></tr>';
  bind();
}
function bind(){
  var f = document.getElementById('find');
  if (f) f.onclick = async function(){
    f.disabled = true; var left = 1, n = 0, added = 0, guard = 0;
    while (left > 0 && guard++ < 60) {
      say('Reading the contract… ' + n + ' clauses read');
      var r = await post('/api/obligations/find', { clauses: 12 });
      if (r.error) { say(r.error); break; }
      n += r.read; added += r.added; left = r.remaining;
      if (!r.read) break;
    }
    if (!left) say(n + ' clauses read, ' + added + ' obligations proposed — check each against its clause.');
    f.disabled = false; load();
  };
  var ap = document.getElementById('approve');
  if (ap) ap.onclick = async function(){ if (!confirm('Approve every confirmed obligation? Their periods then drive the notice clock.')) return; var r = await post('/api/obligations/approve'); say(r.error || r.approved + ' approved.'); load(); };
  [].forEach.call(document.querySelectorAll('button.ok, button.no'), function(b){ b.onclick = async function(){
    var tr = b.closest('tr'), v = function(k){ var x = tr.querySelector('[data-f="' + k + '"]'); return x ? x.value : undefined; };
    var body = b.classList.contains('no') ? { id: tr.getAttribute('data-id'), reject: true }
      : { id: tr.getAttribute('data-id'), binds: v('binds'), kind: v('kind'), period_days: v('period_days') === '' ? null : Number(v('period_days')), trigger_text: v('trigger_text') };
    var r = await post('/api/obligations/confirm', body); say(r.error || (r.state === 'rejected' ? 'Rejected.' : 'Confirmed.')); load();
  }; });
}
load();
</script>
</body>
</html>`;
