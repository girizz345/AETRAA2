import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK, SWITCHER_CSS } from './shared.js';

// K10 · v5 A2: the correspondence register — every letter in and out, overdue
// first. Document Control drops an incoming letter: its text and the records
// it names are read by rule, the AI fills what the rules did not, DC checks
// and logs it (IN-00x). DC logs an outgoing letter signed outside the
// platform with its signed copy. Nothing is logged until DC presses Log.
const SCRIPT = String.raw`
var D = null, READ = null;
function el(id){ return document.getElementById(id); }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
function say(id, t, bad){ var e = el(id); if (e) { e.textContent = t || ''; e.className = 'say' + (bad ? ' err' : ''); } }
async function api(path, body){ var r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' }); var j = await r.json().catch(function(){ return {}; }); if (!r.ok && !j.error) j.error = 'It did not work (' + r.status + ').'; return j; }
function b64(file){ return new Promise(function(ok){ var fr = new FileReader(); fr.onload = function(){ var s = String(fr.result); ok(s.slice(s.indexOf(',') + 1)); }; fr.readAsDataURL(file); }); }
var today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);

async function load(){
  D = await api('/api/letters');
  if (D.error) { el('reg').innerHTML = '<p class="say err">' + esc(D.error) + '</p>'; return; }
  el('sum').textContent = D.letters.length + (D.letters.length === 1 ? ' letter' : ' letters') + (D.overdue ? ' · ' + D.overdue + ' overdue for our reply' : '');
  el('logCard').hidden = !D.may.log; el('outCard').hidden = !D.may.outgoing;
  el('aiNote').textContent = D.may.ai ? 'The text and the records it names are read by rule; the AI fills in what the rules did not. You check every value before it is logged.'
    : 'The text and the records it names are read by rule; type the rest. (AI is not switched on.)';
  el('oreply').innerHTML = (D.open_incoming || []).map(function(x){ return '<option value="' + esc(x.ref) + '">' + esc(x.ref + ' — ' + x.subject + (x.their_ref ? ' (' + x.their_ref + ')' : '')) + '</option>'; }).join('');
  paint();
}
function paint(){
  var dir = el('fdir').value, open = el('fopen').checked, q = el('fq').value.trim().toLowerCase();
  var rows = D.letters.filter(function(x){
    if (dir && x.dir !== dir) return false;
    if (open && !x.open) return false;
    if (q && (x.ref + ' ' + x.from_to + ' ' + x.their_ref + ' ' + x.subject).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
  el('reg').innerHTML = rows.length ? '<table><tr><th>Ref</th><th>In/Out</th><th>Date</th><th>From / To</th><th>Their ref</th><th>Subject</th><th>Action by</th><th>Reply-by</th><th>Answered by</th><th>Status</th></tr>' +
    rows.map(function(x){
      return '<tr' + (x.overdue ? ' class="late"' : '') + '><td><b>' + esc(x.ref) + '</b></td><td>' + esc(x.dir) + '</td><td>' + esc(x.date) + '</td><td>' + esc(x.from_to) + '</td><td>' + esc(x.their_ref) + '</td><td>' + esc(x.subject) +
        (x.summary ? '<div class="src">' + esc(x.summary) + '</div>' : '') + (x.linked ? '<div class="src">names ' + esc(x.linked) + '</div>' : '') + '</td><td>' + esc(x.action_by) + '</td><td>' +
        (x.overdue ? '<b>' + esc(x.reply_by) + '</b><div class="src">' + x.days_late + ' day' + (x.days_late === 1 ? '' : 's') + ' late</div>' : esc(x.reply_by)) + '</td><td>' + esc(x.answered_by) + '</td><td>' + esc(x.status) + '</td></tr>';
    }).join('') + '</table>' : '<p class="src">No letters' + (dir || open || q ? ' match.' : ' yet.') + '</p>';
}

// ---- incoming: drop, check, log
var FIELDS = ['From', 'Their reference', 'Letter date', 'Subject', 'Type', 'Action by', 'Summary'];
function tag(d){
  if (!d || !d.source) return '';
  return '<span class="tag ' + d.source + '">' + (d.source === 'rule' ? 'read from the letter' : 'read by AI' + (d.sure ? ' (' + d.sure + ')' : '')) + '</span>';
}
function draftForm(r){
  READ = r;
  var d = (r && r.draft) || {};
  var input = function(f){
    var v = (d[f] || {}).value || '';
    if (f === 'Type') return '<select data-f="Type"><option></option>' + D.types.map(function(t){ return '<option' + (t === v ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>';
    if (f === 'Action by') return '<select data-f="Action by"><option></option>' + D.action_by.map(function(t){ return '<option' + (t === v ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>';
    if (f === 'Letter date') return '<input type="date" data-f="Letter date" value="' + esc(v) + '">';
    if (f === 'Summary') return '<textarea data-f="Summary" rows="2">' + esc(v) + '</textarea>';
    return '<input type="text" data-f="' + esc(f) + '" value="' + esc(v) + '">';
  };
  var h = '';
  if (r) {
    h += '<p class="src">' + esc(r.filename) + (r.kept ? ' · read before' : '') + (r.model ? ' · read by rule and by ' + esc(r.model) : ' · read by rule') + '</p>';
    if (r.already) h += '<p class="say err">' + esc(r.already) + '</p>';
    if (r.why) h += '<p class="src">' + esc(r.why) + '</p>';
    var L = r.refs || { linked: [], unmatched: [] };
    h += '<p class="src">Records it names: ' + (L.linked.length ? L.linked.map(function(x){ return '<span class="chip">' + esc(x.ref) + '</span>'; }).join(' ') : 'none on this project') +
      (L.unmatched.length ? ' · not on this project: ' + L.unmatched.map(function(x){ return esc(x.ref); }).join(', ') : '') + '</p>';
  }
  h += '<table class="form">' + FIELDS.map(function(f){
    var x = d[f] || {};
    return '<tr><th>' + esc(f) + '</th><td>' + input(f) + ' ' + tag(x) + ((x.flags || []).length ? '<div class="src warn">' + x.flags.map(esc).join(' · ') + '</div>' : '') + '</td></tr>';
  }).join('') +
    '<tr><th>Date received</th><td><input type="date" data-f="Date received" value="' + today + '"></td></tr>' +
    '<tr><th>Reply by</th><td><input type="date" data-f="Reply by"> <span class="src">leave blank for the project’s reply period</span></td></tr></table>' +
    '<div class="row"><button class="btn prim" id="logIt"' + (r && r.logged_ref ? ' disabled' : '') + '>Log it</button> <button class="btn" id="logCancel">Cancel</button></div><div class="say" id="sayl"></div>';
  el('draft').innerHTML = h; el('draft').hidden = false;
}
document.addEventListener('change', async function(e){
  if (e.target.id === 'lfile' && e.target.files[0]) {
    var f = e.target.files[0];
    say('sayd', 'Reading ' + f.name + '…');
    var r = await api('/api/letters/read', { filename: f.name, data: await b64(f) });
    if (r.error) { say('sayd', r.error, true); return; }
    say('sayd', ''); draftForm(r);
  }
  if (e.target.id === 'fdir' || e.target.id === 'fopen') paint();
});
document.addEventListener('input', function(e){ if (e.target.id === 'fq') paint(); });
document.addEventListener('click', async function(e){
  var b = e.target.closest('button'); if (!b) return;
  if (b.id === 'typeIt') { draftForm(null); return; }
  if (b.id === 'logCancel') { el('draft').hidden = true; READ = null; return; }
  if (b.id === 'logIt') {
    var data = {};
    [].forEach.call(document.querySelectorAll('#draft [data-f]'), function(i){ if (i.value) data[i.getAttribute('data-f')] = i.value; });
    b.disabled = true;
    var r = await api('/api/records', { type: 'incoming', title: data.Subject || '', data: data, read_id: READ ? READ.id : undefined });
    b.disabled = false;
    if (r.error) { say('sayl', r.error, true); return; }
    el('draft').hidden = true; READ = null;
    say('sayd', r.ref + ' logged' + (r.record && r.record.due ? ' — reply by ' + r.record.due : ' — for information') + (r.notified ? '; the action owner was told.' : '.'));
    load();
  }
  if (b.id === 'outIt') {
    var f = el('ofile').files[0];
    var body = { to: el('oto').value, subject: el('osubj').value, type: el('otype').value, issued_on: el('odate').value, our_ref: el('oref').value, signed_by: el('osig').value,
      in_reply_to: [].map.call(el('oreply').selectedOptions, function(o){ return o.value; }).join(', ') };
    if (f) { body.filename = f.name; body.data = await b64(f); }
    var r2 = await api('/api/letters/outgoing', body);
    if (r2.error) { say('sayo', r2.error, true); return; }
    say('sayo', r2.ref + ' logged and its signed copy kept' + (r2.replied_to && r2.replied_to.length ? ' — it answers ' + r2.replied_to.join(', ') + ', now closed.' : '.'));
    load();
  }
});
el('odate').value = today;
load();
`;

export const correspondenceHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Correspondence · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1240px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
.card h2 { margin: 0 0 8px; font-size: var(--fs-body); }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-secondary); }
th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { font-size: var(--fs-secondary); color: var(--muted); font-weight: 500; }
tr.late td { background: var(--serious-bg); }
table.form th { width: 130px; } table.form input[type=text], table.form textarea { width: 100%; max-width: 520px; }
.src { font-size: var(--fs-secondary); color: var(--muted); } .src.warn { color: var(--serious-text); }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
input[type=text], input[type=date], select, textarea { font: inherit; font-size: var(--fs-secondary); padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--ink); }
.say { margin-top: 8px; font-size: var(--fs-secondary); } .say.err { color: var(--serious-text); }
.tag { font-size: var(--fs-secondary); padding: 1px 6px; border-radius: 6px; border: 1px solid var(--border); color: var(--muted); }
.tag.ai { border-color: var(--accent); color: var(--accent-text); }
.chip { font-size: var(--fs-secondary); padding: 1px 6px; border-radius: 6px; background: var(--surface-2, color-mix(in srgb, var(--accent) 14%, transparent)); }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Correspondence register</h1><div class="sub" id="sum">every letter in and out</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/api/letters/register.xlsx">Download (Excel)</a>
  <a class="btn" href="/">Dashboard</a>
</div></div>
<div class="wrap">
  <div class="card" id="logCard" hidden><h2>Log an incoming letter</h2>
    <p class="src" id="aiNote"></p>
    <div class="row"><label class="btn">Drop or choose the letter (PDF, Word, .eml, .msg, scan)<input type="file" id="lfile" accept=".pdf,.docx,.eml,.msg,.txt,.png,.jpg,.jpeg" hidden></label>
      <button class="btn" id="typeIt">Type it in instead</button></div>
    <div class="say" id="sayd"></div>
    <div id="draft" hidden></div>
  </div>
  <div class="card"><h2>The register</h2>
    <div class="row"><select id="fdir"><option value="">In and out</option><option value="In">Incoming</option><option value="Out">Outgoing</option></select>
      <label class="src"><input type="checkbox" id="fopen"> open only</label> <input type="text" id="fq" placeholder="Search ref, sender, subject"></div>
    <div id="reg" style="margin-top:10px"><p class="src">Loading…</p></div>
  </div>
  <div class="card" id="outCard" hidden><h2>Log an outgoing letter signed outside the platform</h2>
    <p class="src">A letter drafted here is logged and stored when Document Control issues it. One signed and sent outside the platform is logged here, with its signed copy; it closes the incoming letters it answers.</p>
    <div class="row"><input type="text" id="oto" placeholder="To (who it went to)"> <input type="text" id="osubj" placeholder="Subject" style="min-width:320px">
      <select id="otype"><option>Letter</option><option>Notice</option><option>Instruction</option><option>Email</option><option>Transmittal</option><option>Other</option></select></div>
    <div class="row"><span class="src">Issued</span> <input type="date" id="odate"> <input type="text" id="oref" placeholder="Our reference"> <input type="text" id="osig" placeholder="Signed by"></div>
    <div class="row"><span class="src">In reply to</span> <select id="oreply" multiple size="3" style="min-width:360px"></select></div>
    <div class="row"><label class="src">The signed copy <input type="file" id="ofile" accept=".pdf,.docx,.eml,.msg,.png,.jpg,.jpeg"></label> <button class="btn prim" id="outIt">Log it</button></div>
    <div class="say" id="sayo"></div>
  </div>
</div>
<script>${SCRIPT}</script>
</body>
</html>`;
