import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK, SWITCHER_CSS } from './shared.js';

// Spec §29: write the draft first, in your own words; then Check and complete.
// Every proposal is accepted, edited then accepted, or refused — nothing goes
// in on its own, the writer's lines are never rewritten, and an edited
// quotation stops being presented as a quotation. Confirming completes the
// content; the letter then goes through its own workflow to be signed and issued.
export const letterCheckHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Check and complete · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1000px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
textarea { width: 100%; min-height: 180px; font: inherit; padding: 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--ink); }
.p { border: 1px solid var(--border); border-radius: 8px; padding: 9px 11px; margin-bottom: 8px; }
.p.inferred { border-left: 3px solid var(--serious); }
.p.flag { border-left: 3px solid var(--critical); }
.sub { font-size: var(--fs-secondary); color: var(--muted); }
.q { font-size: var(--fs-secondary); margin: 4px 0; }
#final { white-space: pre-wrap; font-size: var(--fs-body); line-height: 1.5; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Check and complete</h1><div class="sub">references, clauses and dates for a draft letter</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/">Dashboard</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>
<div class="wrap">
  <div class="card">
    <textarea id="draft" placeholder="Write the letter in your own words. Then press Check and complete."></textarea>
    <div style="margin-top:8px"><button class="btn prim" id="check">Check and complete</button> <button class="btn" id="rebuild">Rebuild the project index</button> <span class="sub" id="say"></span></div>
  </div>
  <div class="card" id="props" hidden></div>
  <div class="card" id="result" hidden><h2 style="margin:0 0 8px;font-size:var(--fs-body)">The letter, with what you accepted</h2><div id="final"></div>
    <div style="margin-top:10px"><button class="btn prim" id="confirm">Confirm the letter</button> <span class="sub">Confirming completes the content. It does not sign or issue the letter.</span></div></div>
</div>
<script>
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
async function post(path, body){ var r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); return r.json(); }
var R = null, DEC = {};
function finalText(){
  var draft = document.getElementById('draft').value, adds = [];
  (R.proposals || []).forEach(function(p){
    var d = DEC[p.id]; if (!d || d.choice === 'refuse' || !p.propose) return;
    var t = d.choice === 'edit' ? d.text : p.propose;
    // An edited quotation is the writer's paraphrase: no quotation marks, no "quoted from".
    if (d.choice === 'edit' && p.verbatim && d.text !== p.propose) t = String(t).replace(/[\\u201C\\u201D"]/g, '') + ' (paraphrase of ' + p.source.ref + ')';
    adds.push({ at: p.anchor, text: t });
  });
  // Each accepted item goes after the sentence it belongs to; the writer's own lines are left as written.
  adds.sort(function(a, b){ return b.at - a.at; });
  adds.forEach(function(a){
    if (a.at < 0) { draft = draft + '\\n' + a.text; return; }
    var end = draft.indexOf('.', a.at); end = end < 0 ? draft.length : end + 1;
    draft = draft.slice(0, end) + ' [' + a.text + ']' + draft.slice(end);
  });
  return draft;
}
function paint(){
  var el = document.getElementById('props'); el.hidden = false;
  var ps = R.proposals || [];
  el.innerHTML = '<p class="sub">' + esc(R.note) + '</p>' + (ps.length ? ps.map(function(p){
    var d = DEC[p.id] || {};
    if (p.flag) return '<div class="p flag"><b>' + esc(p.says) + '</b> — ' + esc(p.flag) + '</div>';
    if (p.kind === 'arithmetic') return '<div class="p"><b>Dates</b> — ' + esc(p.note) + ' <a href="' + esc(p.source.link) + '">source</a></div>';
    return '<div class="p' + (p.basis === 'inferred' ? ' inferred' : '') + '">' + (p.says ? '<div class="sub">Your draft says: “' + esc(p.says) + '”</div>' : '') +
      '<div class="q">' + esc(p.propose) + '</div>' + (p.note ? '<div class="sub">' + esc(p.note) + '</div>' : '') +
      '<div class="sub"><a href="' + esc(p.source.link) + '">open ' + esc(p.source.ref) + (p.source.page ? ' at page ' + esc(p.source.page) : '') + '</a></div>' +
      '<div style="margin-top:6px"><button class="btn" data-a="accept" data-id="' + p.id + '"' + (d.choice === 'accept' ? ' disabled' : '') + '>Accept</button> ' +
      '<button class="btn" data-a="edit" data-id="' + p.id + '">Edit, then accept</button> ' +
      '<button class="btn" data-a="refuse" data-id="' + p.id + '"' + (d.choice === 'refuse' ? ' disabled' : '') + '>Refuse</button> <span class="sub">' + esc(d.choice || '') + '</span></div>' +
      (d.choice === 'edit' ? '<textarea data-ed="' + p.id + '" style="min-height:60px;margin-top:6px">' + esc(d.text) + '</textarea>' : '') + '</div>';
  }).join('') : '<p class="sub">Nothing to propose.</p>');
  [].forEach.call(el.querySelectorAll('button[data-a]'), function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-id'), a = b.getAttribute('data-a'), p = R.proposals.find(function(x){ return x.id === id; });
    DEC[id] = { id: id, choice: a, text: a === 'edit' ? ((DEC[id] && DEC[id].text) || p.propose) : null }; paint(); }); });
  [].forEach.call(el.querySelectorAll('textarea[data-ed]'), function(t){ t.addEventListener('input', function(){ DEC[t.getAttribute('data-ed')].text = t.value; showFinal(); }); });
  showFinal();
}
function showFinal(){ document.getElementById('result').hidden = false; document.getElementById('final').textContent = finalText(); }
document.getElementById('check').addEventListener('click', async function(){
  DEC = {};
  R = await post('/api/index/check', { draft: document.getElementById('draft').value });
  if (R.error) { document.getElementById('say').textContent = R.error; return; }
  paint();
});
document.getElementById('rebuild').addEventListener('click', async function(){
  var r = await post('/api/index/rebuild');
  document.getElementById('say').textContent = r.error || ('Index rebuilt: ' + r.entries + ' entries, ' + r.clauses + ' contract clauses.');
});
document.getElementById('confirm').addEventListener('click', async function(){
  var decisions = (R.proposals || []).filter(function(p){ return p.propose; }).map(function(p){ return DEC[p.id] || { id: p.id, choice: 'refuse' }; });
  var r = await post('/api/index/confirm', { draft: document.getElementById('draft').value, proposals: R.proposals, decisions: decisions, final_text: finalText() });
  document.getElementById('say').textContent = r.error || (r.accepted + ' accepted, ' + r.edited + ' edited, ' + r.refused + ' refused. ' + r.note);
});
</script>
</body>
</html>`;
