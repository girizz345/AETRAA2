import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK, SWITCHER_CSS } from './shared.js';

// Tender ↔ IFC deviations: each IFC sheet against its tender sheet. Paired and
// compared by rule (the overlay shows removed in red, added in green); the AI
// describes each deviation where it is on; a person decides each one.
export const deviationsHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tender vs IFC · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1150px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-secondary); } td, th { padding: 6px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
th { font-size: var(--fs-secondary); color: var(--muted); }
.sub { font-size: var(--fs-secondary); color: var(--muted); }
.pill { font-size: var(--fs-secondary); padding: 2px 7px; border-radius: 9px; background: var(--surface-2); }
.var { color: var(--critical); font-weight: 500; }
img.ov { max-width: 100%; border: 1px solid var(--border); border-radius: 6px; margin-top: 6px; }
input.note { width: 220px; font: inherit; font-size: var(--fs-secondary); }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Tender vs IFC</h1><div class="sub">what was priced against what is to be built</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/api/deviations/xlsx">Excel</a>
  <a class="btn" href="/drawings">Drawings</a>
  <a class="btn" href="/">Dashboard</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>
<div class="wrap">
  <div class="card"><span id="acts"></span> <span class="sub" id="say"></span><div id="top" class="sub" style="margin-top:6px"></div></div>
  <div id="sheets"></div>
  <div class="card" id="unpaired"></div>
</div>
<script>
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
async function post(path, body){ var r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); return r.json().catch(function(){ return { error: 'no answer from the server' }; }); }
function say(t){ document.getElementById('say').textContent = t; }
var D = null;
var DEC = { proposed: 'to decide', variation: 'possible variation', no_impact: 'no cost impact', not_a_change: 'not a change' };
async function load(){
  D = await (await fetch('/api/deviations', { cache: 'no-store' })).json();
  if (D.error) { say(D.error); return; }
  document.getElementById('acts').innerHTML = D.may.run ? '<button class="btn prim" id="run">Compare the sheets</button>' : '';
  var open = D.deviations.filter(function(x){ return x.decision === 'proposed'; }).length, vars = D.deviations.filter(function(x){ return x.decision === 'variation'; }).length;
  document.getElementById('top').textContent = D.pairs.length + ' sheets compared · ' + D.deviations.length + ' deviations · ' + open + ' to decide · ' + vars + ' possible variations' + (D.ai_on ? '' : ' · AI is off: each changed line of text is listed to decide');
  var byPair = {}; D.deviations.forEach(function(x){ (byPair[x.pair_id] = byPair[x.pair_id] || []).push(x); });
  document.getElementById('sheets').innerHTML = D.pairs.map(function(p){
    var devs = byPair[p.id] || [];
    return '<div class="card"><b>' + esc(p.number) + '</b> ' + esc(p.title || '') + ' <span class="pill">' + (p.state === 'no_change' ? 'no change found' : p.state === 'error' ? 'could not be compared' : esc(p.change_pct) + '% of the drawing changed') + '</span>'
      + '<div class="sub">paired by ' + esc(p.paired_by) + (p.model ? ' · described by ' + esc(p.model) : '') + (p.note ? ' · ' + esc(p.note) : '') + '</div>'
      + (p.summary ? '<p>' + esc(p.summary) + '</p>' : '')
      + (p.overlay_key ? '<details><summary class="sub">Overlay — removed in red, added in green</summary><img class="ov" loading="lazy" src="/api/deviations/overlay?id=' + encodeURIComponent(p.id) + '"></details>' : '')
      + (devs.length ? '<table style="margin-top:8px"><tr><th>Deviation</th><th>Kind</th><th>Where</th><th>Decision</th><th></th></tr>' + devs.map(function(x){
          var act = D.may.decide && x.decision === 'proposed'
            ? '<input class="note" placeholder="what the variation is (for the QS)"> <button class="btn" data-d="variation">Possible variation</button> <button class="btn" data-d="no_impact">No cost impact</button> <button class="btn" data-d="not_a_change">Not a change</button>' : '';
          return '<tr data-id="' + esc(x.id) + '"><td>' + esc(x.what) + (x.variation ? ' <span class="var">may be a variation</span>' : '') + '<div class="sub">' + (x.source === 'ai' ? 'described by AI' : 'found by rule') + '</div></td><td>' + esc(x.kind) + '</td><td>' + esc(x.place || '') + '</td>'
            + '<td>' + esc(DEC[x.decision] || x.decision) + (x.note ? '<div class="sub">' + esc(x.note) + '</div>' : '') + (x.decided_by ? '<div class="sub">' + esc(x.decided_by) + '</div>' : '') + '</td><td>' + act + '</td></tr>';
        }).join('') + '</table>' : '')
      + '</div>';
  }).join('');
  document.getElementById('unpaired').innerHTML = '<b>Sheets with no partner</b><div class="sub">IFC sheets the tender never showed: ' + (D.ifc_only.length ? D.ifc_only.map(function(d){ return esc(d.number + ' ' + (d.title || '')); }).join(', ') : 'none')
    + '</div><div class="sub">Tender sheets with no IFC sheet: ' + (D.tender_only.length ? D.tender_only.map(function(d){ return esc(d.number + ' ' + (d.title || '')); }).join(', ') : 'none') + '</div>';
  bind();
}
function bind(){
  var r = document.getElementById('run');
  if (r) r.onclick = async function(){
    r.disabled = true; var left = 1, n = 0, guard = 0;
    while (left > 0 && guard++ < 100) { say('Comparing… ' + n + ' sheets'); var x = await post('/api/deviations/run', { limit: 3 }); if (x.error) { say(x.error); break; } n += x.compared.length; left = x.remaining; if (!x.compared.length) break; }
    say(n ? n + ' sheets compared.' : 'Nothing new to compare.'); r.disabled = false; load();
  };
  [].forEach.call(document.querySelectorAll('button[data-d]'), function(b){ b.onclick = async function(){
    var tr = b.closest('tr'); var x = await post('/api/deviations/decide', { id: tr.getAttribute('data-id'), decision: b.getAttribute('data-d'), note: tr.querySelector('input.note').value });
    say(x.error || 'Decided.'); load();
  }; });
}
load();
</script>
</body>
</html>`;
