import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK, SWITCHER_CSS } from './shared.js';

// K13 (A10) · v5 A10: "+ RFI" — a short note and a photo (or the marked-up
// drawing) in; the RFI's fields drafted on the consultant's form, the
// drawings and spec sections it names found, what is missing listed, any RFI
// already asked named; the engineer edits, checks the document, and raises it.
// Then the submittal desk (S0). Below, the RFI log by discipline.
const SCRIPT = String.raw`
var D = null, DRAFT = null, ISSUE = null;
function el(id){ return document.getElementById(id); }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
function say(id, t, bad){ var e = el(id); if (e) { e.innerHTML = t || ''; e.className = 'say' + (bad ? ' err' : ''); } }
async function api(path, body){ var r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' }); var j = await r.json().catch(function(){ return {}; }); j._status = r.status; if (!r.ok && !j.error) j.error = 'It did not work (' + r.status + ').'; return j; }
function b64(file){ return new Promise(function(ok){ var fr = new FileReader(); fr.onload = function(){ var s = String(fr.result); ok(s.slice(s.indexOf(',') + 1)); }; fr.readAsDataURL(file); }); }
async function load(){
  D = await api('/api/rfi');
  if (D.error) { el('log').innerHTML = '<p class="say err">' + esc(D.error) + '</p>'; return; }
  el('newCard').hidden = !D.may.raise;
  el('aiBtn').hidden = !D.ai_on;
  el('aiNote').textContent = D.ai_on ? 'Type a short note and add a photo or the marked-up drawing; the RFI is drafted for you to check. It never proposes a solution.' : 'Type the RFI below. (AI is not switched on.)';
  paintFields({});
  // Raised from an issue (Information required): its words start the note.
  var fromIssue = new URLSearchParams(location.search).get('issue');
  if (fromIssue && D.may.raise) {
    var iss = await api('/api/issue?ref=' + encodeURIComponent(fromIssue));
    var it = iss && (iss.issue || iss);
    if (it && it.ref) { ISSUE = it.ref; el('note').value = [it.title, it.detail].filter(Boolean).join('\n'); paintFields({ Subject: it.title || '', Question: it.detail || '' });
      say('sayd', 'From issue ' + esc(it.ref) + ' — the RFI will be linked to it.'); }
  }
  el('log').innerHTML = D.log.length ? '<table><tr><th>Sr</th><th>Ref</th><th>Discipline</th><th>Subject</th><th>Raised</th><th>Issued</th><th>Reply by</th><th>Answered</th><th>Days open</th><th>Status</th><th>Variation flag</th></tr>' +
    D.log.map(function(r){ return '<tr><td>' + r.sr + '</td><td><a href="/s0?ref=' + encodeURIComponent(r.ref) + '">' + esc(r.ref) + '</a></td><td>' + esc(r.discipline) + '</td><td>' + esc(r.subject) + '</td><td>' + esc(r.raised) + '</td><td>' + esc(r.issued) + '</td><td>' + esc(r.reply_by) + '</td><td>' + esc(r.answered) + '</td><td>' + esc(r.days_open) + '</td><td>' + esc(r.status) + '</td><td>' + esc(r.variation) + '</td></tr>'; }).join('') + '</table>'
    : '<p class="src">No RFIs yet.</p>';
}
function paintFields(vals){
  el('fields').innerHTML = D.fields.map(function(f){
    var v = vals[f] || '';
    var input = /question/i.test(f) ? '<textarea data-f="' + esc(f) + '" rows="4">' + esc(v) + '</textarea>'
      : /needed|reply by|required/i.test(f) ? '<input type="date" data-f="' + esc(f) + '" value="' + esc(v) + '">'
      : /priority/i.test(f) ? '<select data-f="' + esc(f) + '"><option' + (v === 'Urgent' ? '' : ' selected') + '>Normal</option><option' + (v === 'Urgent' ? ' selected' : '') + '>Urgent</option></select>'
      : '<input type="text" data-f="' + esc(f) + '" value="' + esc(v) + '">';
    return '<div class="fr"><label>' + esc(f) + '</label>' + input + '</div>';
  }).join('');
}
function values(){ var o = {}; document.querySelectorAll('[data-f]').forEach(function(x){ if (x.value) o[x.getAttribute('data-f')] = x.value; }); return o; }
function titleOf(v){ return v.Subject || v[D.fields[0]] || 'RFI'; }
document.addEventListener('click', async function(e){
  var b = e.target.closest('button'); if (!b) return;
  if (b.id === 'aiBtn') {
    var f = el('photo').files[0];
    say('sayd', 'Drafting the RFI…');
    var r = await api('/api/rfi/draft', { note: el('note').value, photo: f ? { filename: f.name, data: await b64(f) } : undefined });
    if (r.error) { say('sayd', esc(r.error), true); return; }
    DRAFT = r;
    paintFields(r.fields || {});
    var h = '';
    if (r.why) h += '<div class="src">' + esc(r.why) + '</div>';
    h += '<div class="src">Drawings named: ' + (r.refs.drawings.length ? r.refs.drawings.map(function(d){ return '<b>' + esc(d.number) + '</b>' + (d.title ? ' ' + esc(d.title) : ''); }).join(', ') : 'none in the register') +
      (r.refs.unknown_drawings.length ? ' · not in the register: ' + esc(r.refs.unknown_drawings.join(', ')) : '') + '</div>';
    if (r.refs.specs.length) h += '<div class="src">Spec sections it may concern: ' + r.refs.specs.map(function(s){ return '<b>' + esc(s.code) + '</b> ' + esc(s.title) + ' (by ' + esc(s.by) + ')'; }).join(', ') + '</div>';
    if (r.missing.length) h += '<div class="say err">' + r.missing.map(esc).join('<br>') + '</div>';
    if ((r.left_blank || []).length) h += '<div class="src">Left blank — an RFI asks, it does not propose: ' + esc(r.left_blank.join(', ')) + '</div>';
    if (r.duplicates.length) h += '<div class="say err">May already be asked: ' + r.duplicates.map(function(x){ return '<a href="/s0?ref=' + encodeURIComponent(x.ref) + '">' + esc(x.ref) + '</a> “' + esc(x.title) + '” (' + esc(x.status) + ')'; }).join('; ') + '</div>';
    say('sayd', h + (r.model ? '<div class="src">Drafted by ' + esc(r.model) + ' — check every field.</div>' : ''));
    return;
  }
  if (b.id === 'checkBtn') {
    var v = values();
    var p = D.has_form ? await api('/api/template/preview', { type: 'rfi', title: titleOf(v), data: v }) : null;
    el('check').hidden = false;
    el('checkBody').innerHTML = p && p.html ? '<style>' + (p.css || '') + '</style><div class="tp-wrap">' + p.html + '</div>'
      : '<table>' + Object.keys(v).map(function(k){ return '<tr><th>' + esc(k) + '</th><td style="white-space:pre-wrap">' + esc(v[k]) + '</td></tr>'; }).join('') + '</table>';
    return;
  }
  if (b.id === 'submitBtn' || b.id === 'anywayBtn') {
    var v2 = values();
    var r2 = await api('/api/records', { type: 'rfi', title: titleOf(v2), data: v2, from_issue: ISSUE || undefined, not_duplicate: b.id === 'anywayBtn' || undefined });
    if (r2._status === 409 && r2.duplicates) { say('says', esc(r2.error) + ' <button class="btn" id="anywayBtn">Raise it anyway</button>', true); return; }
    if (r2.error) { say('says', esc(r2.error), true); return; }
    location.href = '/s0?ref=' + encodeURIComponent(r2.ref);
  }
});
load();
`;

export const rfiHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RFIs · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1200px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
.card h2 { margin: 0 0 8px; font-size: var(--fs-body); }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-secondary); }
th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { font-size: var(--fs-secondary); color: var(--muted); font-weight: 500; }
.src { font-size: var(--fs-secondary); color: var(--muted); margin-top: 4px; } .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
.fr { display: grid; grid-template-columns: 150px 1fr; gap: 8px; margin-top: 6px; align-items: start; } .fr label { font-size: var(--fs-secondary); color: var(--muted); padding-top: 6px; }
input[type=text], input[type=date], select, textarea { font: inherit; font-size: var(--fs-secondary); padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--ink); width: 100%; box-sizing: border-box; }
.say { margin-top: 6px; font-size: var(--fs-secondary); } .say.err { color: var(--serious-text); }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>RFIs</h1><div class="sub">prepare one, then the submittal desk</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/api/register/xlsx?reg=rfi">RFI log (Excel)</a>
  <a class="btn" href="/">Dashboard</a>
</div></div>
<div class="wrap">
  <div class="card" id="newCard" hidden><h2>+ RFI</h2>
    <p class="src" id="aiNote"></p>
    <textarea id="note" rows="3" placeholder="What is the problem? Where? Which drawing?"></textarea>
    <div class="row"><label class="src">Photo or marked-up drawing <input type="file" id="photo" accept=".jpg,.jpeg,.png,.pdf"></label> <button class="btn prim" id="aiBtn">Draft the RFI</button></div>
    <div id="sayd" class="say"></div>
    <div id="fields"></div>
    <div class="row"><button class="btn" id="checkBtn">Check the document</button></div>
    <div id="check" hidden><h2 style="margin-top:12px">As it will be issued</h2><div id="checkBody"></div>
      <div class="row"><button class="btn prim" id="submitBtn">Confirm &amp; submit for approval</button></div></div>
    <div id="says" class="say"></div>
  </div>
  <div class="card"><h2>RFI log</h2><div id="log"><p class="src">Loading…</p></div></div>
</div>
<script>${SCRIPT}</script>
</body>
</html>`;
