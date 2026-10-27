import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK, SWITCHER_CSS } from './shared.js';

// A9: draft a reply to an incoming letter, or a new letter. The AI drafts from
// the facts (the incoming letter, the indexed clauses, the related records);
// the author edits and completes it — each completion a revision — and raises
// it as a letter, which the PM or Director signs and Document Control issues.
export const lettersHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Letters · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 960px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
label { display: block; font-size: var(--fs-secondary); color: var(--muted); margin-top: 8px; }
input, textarea, select { width: 100%; font: inherit; padding: 7px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--ink); }
textarea { min-height: 70px; } #f_Body { min-height: 240px; }
.warn { border-left: 3px solid var(--critical); padding: 6px 10px; margin: 6px 0; font-size: var(--fs-secondary); background: var(--surface-2); }
.sub { font-size: var(--fs-secondary); color: var(--muted); }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-secondary); } td, th { padding: 5px; border-bottom: 1px solid var(--border); text-align: left; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Letters</h1><div class="sub">drafted from the facts, written by you</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/letter-check">Check and complete</a>
  <a class="btn" href="/">Dashboard</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>
<div class="wrap">
  <div class="card">
    <label>Reply to an incoming letter</label><select id="inc"><option value="">— or start a new letter below —</option></select>
    <label>Subject (for a new letter)</label><input id="subj">
    <label>What you want to say, in a line or two (optional)</label><textarea id="note"></textarea>
    <div style="margin-top:8px"><button class="btn prim" id="draft">Draft it</button> <span class="sub" id="say"></span></div>
  </div>
  <div class="card" id="ed" hidden>
    <div id="meta" class="sub"></div><div id="warns"></div>
    <label>Subject</label><input id="f_Subject">
    <label>References</label><textarea id="f_References"></textarea>
    <label>Body</label><textarea id="f_Body"></textarea>
    <label>Clause cited</label><textarea id="f_Clause"></textarea>
    <label>Enclosures</label><textarea id="f_Enclosures"></textarea>
    <div style="margin-top:10px"><button class="btn" id="save">Complete this revision</button> <button class="btn prim" id="raise">Raise as a letter</button>
      <span class="sub">Raising it sends it to the PM / Director to sign. Nothing is sent to anyone outside.</span></div>
  </div>
  <div class="card"><h2 style="margin:0 0 8px;font-size:var(--fs-body)">Drafts</h2><table id="list"></table></div>
</div>
<script>
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
async function post(path, body){ var r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); return r.json(); }
var T = null;
function fields(){ return { Subject: v('f_Subject'), References: v('f_References'), Body: v('f_Body'), 'Clause cited': v('f_Clause'), Enclosures: v('f_Enclosures') }; }
function v(id){ return document.getElementById(id).value; }
function show(d){
  T = d.thread; document.getElementById('ed').hidden = false;
  var f = d.fields || {};
  document.getElementById('f_Subject').value = f.Subject || ''; document.getElementById('f_References').value = f.References || '';
  document.getElementById('f_Body').value = f.Body || ''; document.getElementById('f_Clause').value = f['Clause cited'] || ''; document.getElementById('f_Enclosures').value = f.Enclosures || '';
  document.getElementById('meta').textContent = 'Revision ' + d.rev + (d.note ? ' · ' + d.note : '');
  warns(d.warnings);
}
function warns(w){ document.getElementById('warns').innerHTML = (w || []).map(function(x){ return '<div class="warn">' + esc(x) + '</div>'; }).join(''); }
async function load(){
  var d = await (await fetch('/api/letters/drafts', { cache: 'no-store' })).json();
  if (d.error) { document.getElementById('say').textContent = d.error; return; }
  document.getElementById('inc').innerHTML = '<option value="">— or start a new letter below —</option>' + (d.incoming || []).map(function(x){ return '<option value="' + esc(x.ref) + '">' + esc(x.ref + ' · ' + x.title + ' (' + x.status + ')') + '</option>'; }).join('');
  document.getElementById('list').innerHTML = (d.drafts || []).length ? '<tr><th>Subject</th><th>Reply to</th><th>Revisions</th><th>Raised as</th><th></th></tr>' + d.drafts.map(function(x){
    return '<tr><td>' + esc(x.fields.Subject) + '</td><td>' + esc(x.incoming_ref || '') + '</td><td>' + esc(x.revisions) + '</td><td>' + esc(x.record_ref || '') + '</td><td>' + (x.record_ref ? '' : '<button class="btn op" data-t="' + esc(x.thread) + '">Open</button>') + '</td></tr>'; }).join('')
    : '<tr><td class="sub">No drafts yet.</td></tr>';
  [].forEach.call(document.querySelectorAll('button.op'), function(b){ b.addEventListener('click', function(){ var x = d.drafts.find(function(y){ return y.thread === b.getAttribute('data-t'); }); show(x); }); });
}
document.getElementById('draft').addEventListener('click', async function(){
  document.getElementById('say').textContent = 'Drafting…';
  var d = await post('/api/letters/draft', { incoming_ref: v('inc') || null, subject: v('subj'), note: v('note') });
  document.getElementById('say').textContent = d.error || '';
  if (!d.error) { show(d); load(); }
});
document.getElementById('save').addEventListener('click', async function(){
  var d = await post('/api/letters/draft/save', { thread: T, fields: fields() });
  if (d.error) { document.getElementById('say').textContent = d.error; return; }
  document.getElementById('meta').textContent = 'Revision ' + d.rev + ' completed.'; warns(d.warnings); load();
});
document.getElementById('raise').addEventListener('click', async function(){
  var d = await post('/api/letters/draft/raise', { thread: T });
  if (d.error && d.warnings && confirm(d.error + '\\n\\n' + d.warnings.join('\\n') + '\\n\\nRaise it anyway?')) d = await post('/api/letters/draft/raise', { thread: T, accept_warnings: true });
  document.getElementById('say').textContent = d.error || d.note || ('Raised as ' + d.ref + '.');
  load();
});
load();
</script>
</body>
</html>`;
