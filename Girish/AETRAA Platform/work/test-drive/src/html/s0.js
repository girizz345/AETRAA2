import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK, SWITCHER_CSS } from './shared.js';

// K7 · v5 S0: one submittal / method statement / material / RFI on its road
// to the consultant and back — where it stands, the comments to answer, the
// issue (To, Cc, the files), and the reply (read from the returned form, or
// typed). The page is a shell; /api/s0 decides who may do what.
export const s0HTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Submittal desk · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 980px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
.card h2 { margin: 0 0 8px; font-size: var(--fs-body); }
.state { font-size: var(--fs-body); padding: 10px 12px; border-radius: 8px; border-left: 3px solid var(--border); background: var(--surface-2); }
.state.warn { border-left-color: var(--serious); background: var(--serious-bg); color: var(--serious-text); }
.state.ok { border-left-color: var(--good-text); background: var(--good-bg); color: var(--good-text); }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-secondary); }
th, td { text-align: left; padding: 6px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { font-size: var(--fs-secondary); color: var(--muted); font-weight: 500; }
.src { font-size: var(--fs-secondary); color: var(--muted); line-height: 1.45; }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
input[type=text], input[type=date], textarea, select { font: inherit; font-size: var(--fs-secondary); padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--ink); }
input[type=text] { flex: 1 1 260px; min-width: 0; } textarea { width: 100%; min-height: 70px; box-sizing: border-box; }
.say { margin-top: 8px; font-size: var(--fs-secondary); } .say.err { color: var(--serious-text); }
.tag { font-size: var(--fs-secondary); padding: 1px 6px; border-radius: 6px; border: 1px solid var(--border); white-space: nowrap; }
.tag.open { border-color: var(--serious); color: var(--serious-text); background: var(--serious-bg); }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1 id="h">Submittal desk</h1><div class="sub" id="sub">to the consultant and back</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/">Dashboard</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>
<div class="wrap" id="main">Loading…</div>
<script>
var REF = new URLSearchParams(location.search).get('ref') || '', D = null;
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
async function api(path, body){
  var r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  var d = await r.json().catch(function(){ return { error: 'HTTP ' + r.status }; });
  return d;
}
function b64(file){ return new Promise(function(ok){ var fr = new FileReader(); fr.onload = function(){ var s = String(fr.result); ok(s.slice(s.indexOf(',') + 1)); }; fr.readAsDataURL(file); }); }
function say(id, t, bad){ var e = document.getElementById(id); if (e) { e.textContent = t || ''; e.className = 'say' + (bad ? ' err' : ''); } }
async function load(){
  D = await api('/api/s0?ref=' + encodeURIComponent(REF));
  var m = document.getElementById('main');
  if (D.error) { m.textContent = D.error; return; }
  var r = D.record, may = D.may;
  document.getElementById('h').textContent = r.ref + ' — ' + r.title;
  document.getElementById('sub').textContent = (r.rev ? 'revision ' + r.rev + ' · ' : '') + (r.revision_of ? 'follows ' + r.revision_of : 'to the consultant and back');
  var cls = r.returned || /Code C|Code D/.test(r.status || '') ? 'warn' : (r.code ? 'ok' : '');
  var h = '<div class="card"><div class="state ' + cls + '">' + esc(r.status) + (r.replied_on ? ' — replied ' + esc(r.replied_on) : '') + (r.due && !r.code ? ' · reply by ' + esc(r.due) : '') + '</div>';
  if (r.issued_to) h += '<p class="src">' + (r.issued_to.outside ? 'Issued outside the platform: ' + esc(r.issued_to.note) : 'Issued to ' + esc((r.issued_to.to || []).join(', ')) + ((r.issued_to.cc || []).length ? ', cc ' + esc(r.issued_to.cc.join(', ')) : '') + ' with ' + esc((r.issued_to.files || []).join(', '))) + ' — ' + esc(r.issued_to.by) + '</p>';
  h += '<table><tr><th>Step</th><th>Who</th><th>When</th></tr>' + (r.workflow || []).map(function(s){ return '<tr><td>' + esc(s.st) + '</td><td>' + esc(s.who || '') + '</td><td>' + esc(s.when || (s.state === 'now' ? 'waiting' : '')) + '</td></tr>'; }).join('') + '</table></div>';
  // Comments.
  var cm = D.comments || [];
  if (cm.length) {
    h += '<div class="card"><h2>Comments</h2><table><tr><th>From</th><th>Comment</th><th>Answer</th></tr>' + cm.map(function(c){
      return '<tr><td>' + esc(c.source === 'internal' ? 'PM / internal' : 'Consultant') + (c.from_ref ? '<div class="src">on ' + esc(c.from_ref) + '</div>' : '') + '</td><td>' + esc(c.text) + (c.about ? '<div class="src">' + esc(c.about) + '</div>' : '') + '</td><td>' +
        (c.state === 'open' ? (may.answer && c.source !== 'internal' ? '<input type="text" data-ans="' + esc(c.id) + '" placeholder="What was changed"> <button class="btn" data-a="' + esc(c.id) + '">Answered</button> <button class="btn" data-na="' + esc(c.id) + '">Does not apply</button>' : '<span class="tag open">open</span>')
          : esc(c.state) + (c.answer ? ': ' + esc(c.answer) : '')) + '</td></tr>';
    }).join('') + '</table><div class="say" id="saycm"></div></div>';
  }
  // Returned to Design.
  if (may.resubmit) {
    h += '<div class="card"><h2>Returned to Design — resubmit</h2><div class="row"><input type="text" id="rtitle" value="' + esc(r.title) + '"></div>' +
      '<textarea id="rnote" placeholder="What was changed, for the PM"></textarea><div class="row"><button class="btn prim" id="resub">Resubmit</button></div><div class="say" id="sayr"></div></div>';
  }
  // Issue.
  if (may.issue) {
    var il = D.issue_list || { to: [], cc: [] };
    h += '<div class="card"><h2>Issue to the consultant</h2>' +
      '<div class="row"><span class="src" style="width:30px">To</span><input type="text" id="ito" value="' + esc(il.to.join(', ')) + '"></div>' +
      '<div class="row"><span class="src" style="width:30px">Cc</span><input type="text" id="icc" value="' + esc(il.cc.join(', ')) + '"></div>' +
      '<p class="src">The consultant’s form goes filled and signed. Add files from the record (up to ' + D.max_mb + ' MB in all):</p>' +
      (D.attachments || []).map(function(a){ return '<label class="src" style="display:block"><input type="checkbox" data-att="' + esc(a.id) + '"> ' + esc(a.filename) + ' (' + Math.round((a.size || 0) / 1024) + ' KB)</label>'; }).join('') +
      '<div class="row">' + (D.email_on ? '<button class="btn prim" id="issue">Issue by email</button>' : '<span class="src">Email is not set up here.</span>') +
      ' <input type="text" id="inote" placeholder="Or: how it was issued by hand (transmittal no.)"> <button class="btn" id="outside">Record as issued by hand</button></div><div class="say" id="sayi"></div></div>';
  }
  // Reply.
  if (may.reply) {
    h += '<div class="card"><h2>The consultant’s reply</h2><div class="row"><label class="btn">Upload the reply<input type="file" id="rform" accept=".xlsx,.docx,.pdf,.png,.jpg,.jpeg" hidden></label><span class="src" id="rread"></span></div>' +
      '<p class="src">The consultant’s own Excel or Word form is read as it is. A scanned or stamped reply (PDF or picture) ' + (D.ai_on ? 'can be read with AI — you confirm what it read.' : 'is entered by hand below.') + '</p><div id="aiwrap"></div>' +
      '<div class="row"><select id="rcode">' + (r.type === 'rfi' ? '<option value="answered">Answered</option>' : '') +
      ['A','B','C','D'].map(function(k){ return '<option value="' + k + '">' + esc(D.codes[k]) + '</option>'; }).join('') + '</select>' +
      '<input type="date" id="rdate"></div><textarea id="rcomments" placeholder="The consultant’s comments, one per line"></textarea>' +
      // K13 (v5 A10): an answer that changes scope is flagged to the QS.
      (r.type === 'rfi' ? '<div class="row"><input type="text" id="rvar" placeholder="If the answer changes scope: why — flags a possible variation to the QS" style="flex:1;min-width:320px"></div>' : '') +
      '<div class="row"><button class="btn prim" id="reply">Record the reply</button></div><div class="say" id="sayp"></div></div>';
  }
  m.innerHTML = h;
  var rd = document.getElementById('rdate'); if (rd) rd.value = new Date().toISOString().slice(0, 10);
}
var READ = null;
document.addEventListener('change', async function(e){
  if (e.target.id !== 'rform' || !e.target.files[0]) return;
  var f = e.target.files[0];
  var d = await api('/api/s0/read-reply', { ref: REF, filename: f.name, data: await b64(f) });
  if (d.error) { say('sayp', d.error, true); return; }
  READ = d; var p = d.proposal || {};
  document.getElementById('rread').textContent = (p.read || []).map(function(x){ return x.part + ': ' + x.why; }).join(' · ');
  if (p.code) document.getElementById('rcode').value = p.code;
  if (p.replied_on) document.getElementById('rdate').value = p.replied_on;
  if ((p.comments || []).length) document.getElementById('rcomments').value = p.comments.map(function(c){ return c.text; }).join('\\n');
  // K9 (v5 A3): a scan or a PDF — offered to the AI reader.
  if (D.ai_on && /[.](pdf|png|jpe?g)$/i.test(f.name)) {
    document.getElementById('aiwrap').innerHTML = '<div class="row"><button class="btn" id="aread" data-att="' + esc(d.attachment_id) + '">Read with AI</button><span class="src">the code, each comment and the reply date — nothing is recorded until you confirm</span></div>';
  }
});
// K9 (v5 A3): the AI's draft reply, checked here and on the server.
var AIREPLY = null;
function showAiReply(d){
  AIREPLY = d;
  var rows = (d.comments || []).map(function(c, i){ return '<tr><td>' + (i + 1) + '</td><td>' + esc(c.text) + '</td><td>' + esc(c.about || '') + '</td><td>' + esc(c.discipline || '') + '</td></tr>'; }).join('');
  var flags = (d.flags || []).map(function(f){ return '<div class="say' + (f.blocks ? ' err' : '') + '">' + esc(f.why) + '</div>'; }).join('');
  document.getElementById('aiwrap').innerHTML = '<div class="card" style="margin-top:8px"><h3>Read by AI (' + esc(d.model) + ')</h3>' +
    '<p>Reference <b>' + esc(d.read.reference || '—') + '</b> · code <b>' + esc(d.code ? (D.codes[d.code] || d.code) : '—') + '</b> · reply dated <b>' + esc(d.replied_on || d.read.date || '—') + '</b></p>' + flags +
    (rows ? '<table><tr><th>#</th><th>Comment</th><th>Drawing or clause</th><th>Discipline</th></tr>' + rows + '</table>' : '<p class="src">No comments were read.</p>') +
    '<div class="row">' + (d.may_confirm ? '<button class="btn prim" id="aconfirm">Confirm: record this reply</button>' : '<span class="src">This cannot be recorded with one click — check the reply and record it with the form below (filled in from what was read).</span>') + '</div></div>';
  if (d.code) document.getElementById('rcode').value = d.code;
  if (d.replied_on) document.getElementById('rdate').value = d.replied_on;
  if ((d.comments || []).length) document.getElementById('rcomments').value = d.comments.map(function(c){ return c.text + (c.about ? ' (' + c.about + ')' : ''); }).join('\\n');
  var rv = document.getElementById('rvar');
  if (rv && d.scope_change && d.scope_change.likely && !rv.value) { rv.value = d.scope_change.why || 'the answer may change scope'; rv.title = 'Suggested by the AI — clear it if it does not'; }
}
document.addEventListener('click', async function(e){
  var b = e.target.closest('button'); if (!b) return;
  var d;
  if (b.hasAttribute('data-a') || b.hasAttribute('data-na')) {
    var id = b.getAttribute('data-a') || b.getAttribute('data-na');
    var inp = document.querySelector('[data-ans="' + id + '"]');
    d = await api('/api/s0/answer', { ref: REF, id: id, answer: inp ? inp.value : '', not_applicable: b.hasAttribute('data-na') });
    if (d.error) { say('saycm', d.error, true); return; }
  } else if (b.id === 'resub') {
    d = await api('/api/s0/resubmit', { ref: REF, title: document.getElementById('rtitle').value, note: document.getElementById('rnote').value });
    if (d.error) { say('sayr', d.error, true); return; }
  } else if (b.id === 'issue') {
    var atts = [].map.call(document.querySelectorAll('[data-att]:checked'), function(x){ return x.getAttribute('data-att'); });
    b.disabled = true; say('sayi', 'Sending…');
    d = await api('/api/s0/issue', { ref: REF, to: document.getElementById('ito').value, cc: document.getElementById('icc').value, attachments: atts });
    b.disabled = false;
    if (d.error) { say('sayi', d.error, true); return; }
  } else if (b.id === 'outside') {
    d = await api('/api/s0/issue', { ref: REF, outside: true, note: document.getElementById('inote').value });
    if (d.error) { say('sayi', d.error, true); return; }
  } else if (b.id === 'aread') {
    b.disabled = true; say('sayp', 'Reading the reply with AI…');
    d = await api('/api/s0/ai-read', { ref: REF, attachment_id: b.getAttribute('data-att') });
    b.disabled = false;
    if (d.error) { say('sayp', d.error, true); return; }
    say('sayp', ''); showAiReply(d); return;
  } else if (b.id === 'aconfirm') {
    d = await api('/api/s0/ai-confirm', { ref: REF, id: AIREPLY.id, variation: (document.getElementById('rvar') || {}).value || undefined });
    if (d.error) { say('sayp', d.error, true); return; }
    if (d.revision) { location.href = '/s0?ref=' + encodeURIComponent(d.revision); return; }
  } else if (b.id === 'reply') {
    var lines = document.getElementById('rcomments').value.split('\\n').map(function(x){ return x.trim(); }).filter(Boolean);
    d = await api('/api/s0/reply', { ref: REF, code: document.getElementById('rcode').value, replied_on: document.getElementById('rdate').value,
      comments: lines, attachment_id: READ ? READ.attachment_id : undefined, read_id: READ ? READ.read_id : undefined,
      variation: (document.getElementById('rvar') || {}).value || undefined });
    if (d.error) { say('sayp', d.error, true); return; }
    if (d.revision) { location.href = '/s0?ref=' + encodeURIComponent(d.revision); return; }
  } else return;
  load();
});
load();
</script>
</body>
</html>`;
