import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK, SWITCHER_CSS } from './shared.js';

// A13: the delay / EOT register. Slips and delay-marked issues are flagged with
// the end of their notice period; Planning prepares the notice and narrative
// (drafted from the facts), completes them and enters the days claimed; the
// Director signs; Document Control issues. The dates are shown as arithmetic
// only — the platform never says a notice is late, valid or time-barred.
export const delaysHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Delays and EOT · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1050px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-secondary); } td, th { padding: 6px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
th { font-size: var(--fs-secondary); color: var(--muted); }
textarea { width: 100%; min-height: 160px; font: inherit; padding: 7px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--ink); }
input { font: inherit; padding: 5px; width: 90px; }
.sub { font-size: var(--fs-secondary); color: var(--muted); }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Delays and EOT</h1><div class="sub">event · notice date · end of notice period · days claimed · status</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/api/delays/xlsx">Excel</a>
  <a class="btn" href="/">Dashboard</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>
<div class="wrap">
  <div class="card"><span id="acts"></span> <span class="sub" id="say"></span><table id="reg" style="margin-top:10px"></table></div>
  <div class="card" id="ed" hidden>
    <div id="clock" class="sub"></div>
    <h3 style="font-size:var(--fs-body)">Notice</h3><textarea id="notice"></textarea>
    <h3 style="font-size:var(--fs-body)">EOT narrative</h3><textarea id="narr"></textarea>
    <div style="margin-top:8px">Days claimed (your figure): <input id="days" type="number" min="0">
      <button class="btn" id="saveB">Save</button> <button class="btn prim" id="compB">Complete</button></div>
  </div>
</div>
<script>
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
async function post(path, body){ var r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); return r.json(); }
function say(t){ document.getElementById('say').textContent = t; }
var D = null, CUR = null;
async function load(){
  D = await (await fetch('/api/delays', { cache: 'no-store' })).json();
  if (D.error) { say(D.error); return; }
  document.getElementById('acts').innerHTML = D.may.plan ? '<button class="btn" id="scan">Look for delays</button>' : '';
  var rows = D.delays || [];
  document.getElementById('reg').innerHTML = rows.length ? '<tr><th>Event</th><th>Dates</th><th>Notice</th><th>Days claimed</th><th>Status</th><th></th></tr>' + rows.map(function(x){
    var b = '';
    if (D.may.plan && ['flagged', 'drafting', 'completed'].indexOf(x.status) >= 0) b += '<button class="btn pr" data-id="' + x.id + '">' + (x.notice_draft ? 'Edit' : 'Prepare delay notice') + '</button> ';
    if (D.may.sign && x.status === 'completed') b += '<button class="btn sg" data-id="' + x.id + '">Sign</button> ';
    if (D.may.issue && x.status === 'signed') b += '<button class="btn is" data-id="' + x.id + '">Issue</button>';
    return '<tr><td>' + esc(x.description) + '<div class="sub">' + esc(x.effect || '') + '</div></td><td class="sub">' + esc(x.clock) + '</td><td>' + esc(x.letter_ref || '') + (x.notice_date ? '<div class="sub">' + esc(x.notice_date) + '</div>' : '') + '</td><td>' + esc(x.days_claimed == null ? '' : x.days_claimed) + '</td><td>' + esc(x.status) + '</td><td>' + b + '</td></tr>'; }).join('')
    : '<tr><td class="sub">Nothing flagged. Press "Look for delays" after a programme update.</td></tr>';
  bind();
}
function bind(){
  var s = document.getElementById('scan'); if (s) s.addEventListener('click', async function(){ var r = await post('/api/delays/scan'); say(r.error || r.found + ' found, ' + r.added + ' new.'); load(); });
  [].forEach.call(document.querySelectorAll('button.pr'), function(b){ b.addEventListener('click', async function(){
    var x = D.delays.find(function(y){ return y.id === b.getAttribute('data-id'); }); CUR = x;
    if (!x.notice_draft) { say('Drafting…'); var r = await post('/api/delays/prepare', { id: x.id }); if (r.error) { say(r.error); return; } x.notice_draft = r.notice; x.eot_narrative = r.narrative; say(r.ai ? 'Drafted by AI from the facts — yours to edit.' : 'AI is off: a skeleton from the facts.'); }
    document.getElementById('ed').hidden = false; document.getElementById('clock').textContent = x.clock;
    document.getElementById('notice').value = x.notice_draft || ''; document.getElementById('narr').value = x.eot_narrative || ''; document.getElementById('days').value = x.days_claimed == null ? '' : x.days_claimed;
  }); });
  [].forEach.call(document.querySelectorAll('button.sg'), function(b){ b.addEventListener('click', async function(){ var r = await post('/api/delays/sign', { id: b.getAttribute('data-id') }); say(r.error || 'Signed.'); load(); }); });
  [].forEach.call(document.querySelectorAll('button.is'), function(b){ b.addEventListener('click', async function(){ var r = await post('/api/delays/issue', { id: b.getAttribute('data-id') }); say(r.error || 'Issued as ' + r.ref + '.'); load(); }); });
}
async function save(complete){
  var r = await post('/api/delays/save', { id: CUR.id, notice: document.getElementById('notice').value, narrative: document.getElementById('narr').value, days_claimed: document.getElementById('days').value, complete: complete });
  say(r.error || (complete ? 'Completed — waiting for the Director to sign.' : 'Saved.')); if (!r.error && complete) document.getElementById('ed').hidden = true; load();
}
document.getElementById('saveB').addEventListener('click', function(){ save(false); });
document.getElementById('compB').addEventListener('click', function(){ save(true); });
load();
</script>
</body>
</html>`;
