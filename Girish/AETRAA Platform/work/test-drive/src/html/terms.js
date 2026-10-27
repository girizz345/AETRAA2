import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK, SWITCHER_CSS } from './shared.js';

// E9 step 3: the payment terms read from the contract, each with the clause,
// the page and the sentence it came from and who accepted it, and the
// Principal's approval. Nothing is typed here: the figures were confirmed one
// by one when the contract was read, and this is the company's sign-off on
// the set before any application for payment is computed from it.
export const termsHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Payment terms · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 900px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
.state { font-size: var(--fs-secondary); padding: 10px 12px; border-radius: 8px; border-left: 3px solid var(--border); background: var(--surface-2); }
.state.pending { border-left-color: var(--serious); background: var(--serious-bg); color: var(--serious-text); }
.state.approved { border-left-color: var(--good-text); background: var(--good-bg); color: var(--good-text); }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-secondary); }
th, td { text-align: left; padding: 7px 6px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { font-size: var(--fs-secondary); color: var(--muted); font-weight: 500; }
.src { font-size: var(--fs-secondary); color: var(--muted); line-height: 1.45; }
.tag { font-size: var(--fs-secondary); padding: 1px 6px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--border); }
#say { margin-top: 10px; font-size: var(--fs-secondary); }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Payment terms</h1><div class="sub">read from the contract, approved by the Principal</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/">Dashboard</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>
<div class="wrap">
  <div class="card"><div id="state" class="state">Loading…</div>
    <div style="margin-top:12px"><button class="btn prim" id="approve" hidden>Approve these payment terms</button></div>
    <div id="say"></div></div>
  <div class="card"><h2 style="margin:0 0 8px;font-size:var(--fs-body)">The terms in use</h2><table id="vals"></table></div>
  <div class="card"><h2 style="margin:0 0 8px;font-size:var(--fs-body)">Where each figure came from</h2>
    <p class="src">Every proposal read from the contract, and what was done with it: accepted, corrected or refused.</p>
    <table id="ev"></table></div>
</div>
<script>
var LABEL = { retention_pct: 'Retention', retention_cap_pct: 'Retention cap', advance_pct: 'Advance payment',
  payment_days: 'Payment period', rfi_reply_days: 'RFI reply period', notice_clause: 'Notice clause', completion_date: 'Completion date' };
var UNIT = { retention_pct: '%', retention_cap_pct: '%', advance_pct: '%', payment_days: ' days', rfi_reply_days: ' days' };
var STATE = { accepted: 'accepted', edited: 'corrected', refused: 'refused', not_found: 'not in the contract' };
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
function day(s){ return s ? String(s).slice(0, 16).replace('T', ' ') : ''; }
async function load(){
  var r = await fetch('/api/terms/status', { cache: 'no-store' });
  var d = await r.json();
  if (d.error) { document.getElementById('state').textContent = d.error; return; }
  var st = document.getElementById('state');
  st.className = 'state ' + d.state;
  st.innerHTML = d.state === 'pending'
    ? 'Waiting for the Principal’s approval. Applied from the contract by ' + esc(d.applied_by) + ' on ' + esc(day(d.applied_at)) + '. No application for payment can be raised on these terms until they are approved.'
    : d.state === 'approved'
      ? 'Approved by ' + esc(d.approved_by) + ' on ' + esc(day(d.approved_at)) + '.'
      : 'No terms have been applied from the contract yet.';
  document.getElementById('approve').hidden = !(d.state === 'pending' && d.may_approve);
  document.getElementById('vals').innerHTML = '<tr><th>Term</th><th>Value</th></tr>' + Object.keys(LABEL).map(function(k){
    var v = d.values[k];
    return '<tr><td>' + LABEL[k] + '</td><td>' + (v == null || v === '' ? '—' : esc(v) + (UNIT[k] || '')) + '</td></tr>';
  }).join('');
  var seen = {};
  var rows = (d.evidence || []).filter(function(e){ if (seen[e.term]) return false; seen[e.term] = 1; return true; });
  document.getElementById('ev').innerHTML = rows.length
    ? '<tr><th>Term</th><th>Contract said</th><th>Set to</th><th>Source</th><th>By</th></tr>' + rows.map(function(e){
        return '<tr><td>' + esc(LABEL[e.term] || e.term) + ' <span class="tag">' + esc(STATE[e.state] || e.state) + '</span></td>'
          + '<td>' + (e.proposed == null ? '—' : esc(e.proposed) + (UNIT[e.term] || '')) + '</td>'
          + '<td>' + (e.value == null ? '—' : esc(e.value) + (UNIT[e.term] || '')) + '</td>'
          + '<td class="src">' + (e.clause ? esc(e.clause) + ' · ' : '') + (e.page ? 'page ' + esc(e.page) : '')
          + (e.sentence ? '<br>“' + esc(e.sentence) + '”' : '') + '</td>'
          + '<td class="src">' + esc(e.decided_by) + '<br>' + esc(day(e.decided_at)) + '</td></tr>';
      }).join('')
    : '<tr><td class="src">Nothing has been read from a contract on this project yet.</td></tr>';
}
document.getElementById('approve').addEventListener('click', async function(){
  this.disabled = true;
  var r = await fetch('/api/terms/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  var d = await r.json();
  document.getElementById('say').textContent = d.error ? d.error : 'Approved. Applications for payment can now be raised on these terms.';
  this.disabled = false;
  load();
});
load();
</script>
</body>
</html>`;
