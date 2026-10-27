import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK, SWITCHER_CSS } from './shared.js';

// K12 · v5 A7: material submittals — the log by discipline, a package started
// from the catalogue (or a due P3 item), and the one-screen review: every
// line opens its source page; edit, override with a reason, regenerate a
// section; complete (the last revision kept); generate the PDF and the form;
// confirm and submit — then the submittal desk (S0) takes it.
const SCRIPT = String.raw`
var D = null, P = null, Q = new URLSearchParams(location.search);
function el(id){ return document.getElementById(id); }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
function say(id, t, bad){ var e = el(id); if (e) { e.textContent = t || ''; e.className = 'say' + (bad ? ' err' : ''); } }
async function api(path, body){ var r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' }); var j = await r.json().catch(function(){ return {}; }); if (!r.ok && !j.error) j.error = 'It did not work (' + r.status + ').'; return j; }
function b64(file){ return new Promise(function(ok){ var fr = new FileReader(); fr.onload = function(){ var s = String(fr.result); ok(s.slice(s.indexOf(',') + 1)); }; fr.readAsDataURL(file); }); }

async function load(){
  D = await api('/api/material');
  if (D.error) { el('log').innerHTML = '<p class="say err">' + esc(D.error) + '</p>'; return; }
  el('log').innerHTML = D.log.length ? '<table><tr><th>Sr</th><th>Ref</th><th>Discipline</th><th>Description</th><th>Supplier</th><th>Brand</th><th>Submitted</th><th>Rev</th><th>Status</th></tr>' + D.log.map(function(r){
    var open = r.package ? '<a href="?id=' + encodeURIComponent(r.package) + '">' : r.ref ? '<a href="/s0?ref=' + encodeURIComponent(r.ref) + '">' : '';
    return '<tr><td>' + r.sr + '</td><td>' + (r.ref ? (r.ref ? '<a href="/s0?ref=' + encodeURIComponent(r.ref) + '">' + esc(r.ref) + '</a>' : '') : '<span class="src">not numbered yet</span>') + '</td><td>' + esc(r.discipline) + '</td><td>' + open + esc(r.description) + (open ? '</a>' : '') + '</td><td>' + esc(r.supplier) + '</td><td>' + esc(r.brand) + '</td><td>' + esc(r.submitted) + '</td><td>' + esc(r.rev) + '</td><td>' + esc(r.status) + '</td></tr>';
  }).join('') + '</table>' : '<p class="src">No material submittals yet.</p>';
  el('startCard').hidden = !D.may.prepare;
  el('qaqcCard').hidden = !D.may.qaqc;
  el('qaqcSay').textContent = D.qaqc_step ? 'This project’s material workflow has a QA/QC step.' : 'No QA/QC step (as agreed in v5).';
  el('qaqcBtn').textContent = D.qaqc_step ? 'Take the QA/QC step out' : 'Add a QA/QC step';
  el('ssec').innerHTML = '<option value="">— a section from the spec index —</option>' + D.sections.map(function(s){ return '<option value="' + esc(s.code) + '">' + esc(s.code + ' ' + s.title) + '</option>'; }).join('');
  el('slib').innerHTML = '<option value="">— or a library specification —</option>' + D.specs.map(function(s){ return '<option value="' + esc(s.id) + '">' + esc(s.title || s.filename) + '</option>'; }).join('');
  el('sboq').innerHTML = '<option value="">— BOQ line (optional) —</option>' + D.boq.map(function(b){ return '<option value="' + esc(b.ref) + '">' + esc(b.ref + ' — ' + String(b.description || '').slice(0, 70)) + '</option>'; }).join('');
  el('sp3').innerHTML = '<option value="">— or start from a P3 schedule item —</option>' + D.p3.map(function(x){ return '<option value="' + esc(x.id) + '">' + esc(x.sr + '. ' + x.description) + '</option>'; }).join('');
  if (Q.get('id')) openPkg(Q.get('id'));
}
document.addEventListener('change', function(e){
  if (e.target.id === 'ssec') {
    var s = D.sections.filter(function(x){ return x.code === e.target.value; })[0];
    if (s) { el('sapp').value = (s.manufacturers || []).join('\n'); if (!el('sdisc').value) el('sdisc').value = s.discipline || ''; }
  }
  if (e.target.id === 'sp3') {
    var p = D.p3.filter(function(x){ return x.id === e.target.value; })[0];
    if (p) { el('stitle').value = p.description; el('ssup').value = p.supplier || ''; el('sbrand').value = p.brand || ''; el('sdisc').value = p.discipline || ''; if (p.spec_code) { el('ssec').value = p.spec_code; el('ssec').dispatchEvent(new Event('change', { bubbles: true })); } }
  }
});

function pageLink(src, n, label){ return n ? '<a href="/api/material/page?id=' + encodeURIComponent(P.package.id) + '&src=' + src + '&page=' + n + '" target="_blank" rel="noopener">' + esc(label || ('p.' + n)) + '</a>' : '<span class="src">—</span>'; }
function flags(f){ return (f || []).length ? '<div class="say err">' + f.map(esc).join(' · ') + '</div>' : ''; }
async function openPkg(id){
  P = await api('/api/material/one?id=' + encodeURIComponent(id));
  var v = el('pkg'); v.hidden = false;
  if (P.error) { v.innerHTML = '<p class="say err">' + esc(P.error) + '</p>'; return; }
  var k = P.package, s = k.sections || {}, edit = P.may.prepare && k.state !== 'submitted';
  var STATE = { preparing: 'Being prepared', ready: 'Ready for engineer review', complete: 'Rev ' + k.rev + ' — ready to submit', submitted: 'Submitted as ' + (k.record_ref || '') };
  var h = '<h2>' + esc(k.title) + ' <span class="src">Rev ' + k.rev + ' · ' + esc(STATE[k.state] || k.state) + '</span></h2>' +
    '<p class="src">Spec ' + esc((k.spec.code || '') + ' ' + (k.spec.title || '')) + ' (pages ' + k.spec.from + '–' + k.spec.to + ') · BOQ ' + esc((k.boq && k.boq.ref) || '—') +
    ' · catalogue ' + esc(k.catalogue.filename) + ' (' + k.catalogue.pages + ' pages' + ((k.inputs.unread_catalogue_pages || []).length ? ', ' + k.inputs.unread_catalogue_pages.length + ' with no text' : '') + ')</p>' +
    '<div class="row">Supplier <input type="text" id="psup" value="' + esc(k.supplier) + '"' + (edit ? '' : ' disabled') + '> Brand <input type="text" id="pbrand" value="' + esc(k.brand) + '"' + (edit ? '' : ' disabled') + '> <b>' + esc((s.brand || {}).label || '') + '</b></div>' +
    '<div class="row src">Approved manufacturers: <input type="text" id="papp" style="min-width:320px" value="' + esc((k.approved.names || []).join(', ')) + '"' + (edit ? '' : ' disabled') + '>' + (k.approved.or_equal ? ' (the section allows “or equal”)' : '') + '</div>';
  if ((P.comments || []).length) h += '<div class="card"><h3>The consultant’s comments</h3><ol>' + P.comments.map(function(c){ return '<li>' + esc(c.text) + (c.about ? ' <span class="src">(' + esc(c.about) + ')</span>' : '') + ' — ' + esc(c.state) + '</li>'; }).join('') + '</ol><p class="src">Answer each on the <a href="/s0?ref=' + encodeURIComponent(k.record_ref) + '">submittal desk</a>.</p></div>';
  if (edit) h += '<div class="row">' + (P.ai_on ? '<button class="btn prim" data-draft="">Prepare with AI</button>' : '<span class="src">AI is not switched on — fill the sections in by hand.</span>') + ' <button class="btn" id="psave">Save changes</button> <button class="btn" id="pdone">Complete — form Rev ' + (k.rev + 1) + '</button></div>';
  h += '<div class="row"><a class="btn" href="/api/material/pdf?id=' + encodeURIComponent(k.id) + '" target="_blank">Generate the package (PDF)</a>' + (P.has_form ? ' <a class="btn" href="/api/material/form?id=' + encodeURIComponent(k.id) + '">The consultant’s form (filled)</a>' : ' <span class="src">No consultant’s material form is set up; the platform’s plain form is used.</span>') +
    (P.may.prepare && k.state === 'complete' ? ' <button class="btn prim" id="psub">Confirm & submit for approval</button>' : '') + '</div><div class="say" id="sayp"></div>';
  // the form's values
  h += '<h3>The consultant’s form' + (edit && P.ai_on ? ' <button class="btn sm" data-draft="form">Regenerate</button>' : '') + '</h3><table><tr><th>Field</th><th>Value</th><th>From</th></tr>' +
    P.form_fields.map(function(n){ var f = ((s.form || {}).fields || []).filter(function(x){ return x.name === n; })[0] || { name: n, value: '', page: 0 };
      return '<tr><td>' + esc(n) + '</td><td><input type="text" data-ff="' + esc(n) + '" data-pg="' + (f.page || 0) + '" value="' + esc(f.value) + '"' + (edit ? '' : ' disabled') + '>' + flags(f.flags) + '</td><td>' + pageLink('catalogue', f.page) + ' <span class="src">' + esc(f.source || '') + '</span></td></tr>'; }).join('') + '</table>';
  // the compliance statement
  h += '<h3>Compliance statement' + (edit && P.ai_on ? ' <button class="btn sm" data-draft="compliance">Regenerate</button>' : '') + '</h3><table id="ctab"><tr><th>Spec clause</th><th>Requirement</th><th>Submitted (from the catalogue)</th><th>Complies</th><th>Deviation</th><th>Catalogue page</th></tr>' +
    (s.compliance || []).map(function(r, i){
      var dis = edit ? '' : ' disabled';
      return '<tr data-i="' + i + '"><td>' + pageLink('spec', r.spec_page, r.clause) + '<input type="hidden" data-c="clause" value="' + esc(r.clause) + '"></td>' +
        '<td><textarea data-c="requirement" rows="2"' + dis + '>' + esc(r.requirement) + '</textarea></td><td><textarea data-c="submitted" rows="2"' + dis + '>' + esc(r.submitted) + '</textarea><div class="src">' + esc(r.quote ? '“' + r.quote + '”' : '') + '</div><input type="hidden" data-c="quote" value="' + esc(r.quote) + '"></td>' +
        '<td><select data-c="complies"' + dis + '>' + ['', 'Y', 'N', 'Partly'].map(function(c){ return '<option' + (c === r.complies ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select>' +
        (r.override ? '<div class="src">changed from ' + esc(r.override.from) + ' by ' + esc(r.override.by) + ': ' + esc(r.override.note) + '</div>' : '') + (edit ? '<input type="text" data-c="override_note" placeholder="why, if you change the AI’s answer">' : '') + '</td>' +
        '<td><textarea data-c="deviation" rows="2"' + dis + '>' + esc(r.deviation) + '</textarea>' + (r.ai_remark ? '<div class="src">AI: ' + esc(r.ai_remark) + '</div>' : '') + '</td>' +
        '<td>' + pageLink('catalogue', r.page) + '<input type="number" min="0" data-c="page" value="' + (r.page || 0) + '" style="width:58px"' + dis + '>' + flags(r.flags) + '<div class="src">' + esc(r.source) + '</div></td></tr>';
    }).join('') + '</table>' + (edit ? '<button class="btn sm" id="addrow">Add a line</button>' : '');
  ['method', 'explanations'].forEach(function(sec){
    var x = s[sec] || {};
    h += '<h3>' + (sec === 'method' ? 'Method statement' : 'Technical explanations') + (edit && P.ai_on ? ' <button class="btn sm" data-draft="' + sec + '">Regenerate</button>' : '') + '</h3><textarea id="t_' + sec + '" rows="7" style="width:100%"' + (edit ? '' : ' disabled') + '>' + esc(x.text || '') + '</textarea>' +
      flags(x.flags) + ((x.pages || []).length ? '<div class="src">From catalogue pages ' + x.pages.map(function(n){ return pageLink('catalogue', n, String(n)); }).join(', ') + '</div>' : '');
  });
  h += '<h3>Certificates</h3><p class="src">' + ((k.certificates || []).map(function(c){ return esc(c.filename); }).join(', ') || 'none') + '</p>' + (edit ? '<label class="btn sm">Add a certificate<input type="file" id="pcert" accept=".pdf,.png,.jpg,.jpeg" hidden></label>' : '');
  h += '<details><summary class="src">The specification’s clauses collected (' + k.inputs.clauses.length + ')</summary>' + k.inputs.clauses.map(function(c){ return '<div class="src">' + pageLink('spec', c.page, c.no) + ' ' + esc(c.text) + '</div>'; }).join('') + '</details>';
  if ((P.revs || []).length) h += '<p class="src">Kept: ' + P.revs.map(function(r){ return 'Rev ' + r.rev + ' (' + esc(r.note || '') + ', ' + esc(String(r.kept_at || '').slice(0, 10)) + ')'; }).join(' · ') + '</p>';
  v.innerHTML = h;
}
function collect(){
  var rows = [].map.call(document.querySelectorAll('#ctab tr[data-i]'), function(tr){
    var o = { i: Number(tr.getAttribute('data-i')) }; tr.querySelectorAll('[data-c]').forEach(function(x){ o[x.getAttribute('data-c')] = x.value; }); if (o.i < 0) delete o.i; return o; });
  return { id: P.package.id, compliance: rows, supplier: el('psup').value, brand: el('pbrand').value,
    approved: el('papp').value.split(/[,\n]/).map(function(x){ return x.trim(); }).filter(Boolean),
    form: { fields: [].map.call(document.querySelectorAll('[data-ff]'), function(x){ return { name: x.getAttribute('data-ff'), value: x.value, page: Number(x.getAttribute('data-pg')) || 0 }; }) },
    method: { text: el('t_method').value }, explanations: { text: el('t_explanations').value } };
}
document.addEventListener('click', async function(e){
  var b = e.target.closest('button'); if (!b) return;
  if (b.id === 'qaqcBtn') { var q = await api('/api/material/qaqc', { on: !D.qaqc_step }); if (q.error) { el('qaqcSay').textContent = q.error; return; } load(); return; }
  if (b.id === 'start') {
    var f = el('scat').files[0];
    if (!f) { say('says', 'Drop the supplier’s catalogue (PDF).', true); return; }
    say('says', 'Reading the catalogue and the specification…');
    var certs = [];
    for (var i = 0; i < el('scerts').files.length; i++) certs.push({ filename: el('scerts').files[i].name, data: await b64(el('scerts').files[i]) });
    var spec = el('ssec').value ? { code: el('ssec').value } : { library_id: el('slib').value, from: el('sfrom').value, to: el('sto').value, code: el('scode').value };
    var r = await api('/api/material/start', { title: el('stitle').value, discipline: el('sdisc').value, supplier: el('ssup').value, brand: el('sbrand').value, spec: spec, boq_ref: el('sboq').value,
      approved: el('sapp').value.split(/[,\n]/).map(function(x){ return x.trim(); }).filter(Boolean), schedule_item: el('sp3').value || undefined,
      catalogue: { filename: f.name, data: await b64(f) }, certificates: certs });
    if (r.error) { say('says', r.error, true); return; }
    history.replaceState(null, '', '?id=' + encodeURIComponent(r.id)); say('says', ''); await load(); return;
  }
  if (!P) return;
  if (b.hasAttribute('data-draft')) {
    say('sayp', 'The AI is preparing ' + (b.getAttribute('data-draft') || 'the package') + '…');
    var d = await api('/api/material/draft', { id: P.package.id, sections: b.getAttribute('data-draft') ? [b.getAttribute('data-draft')] : undefined });
    if (d.error) { say('sayp', d.error, true); return; }
    await openPkg(P.package.id); say('sayp', 'Drafted: ' + d.done.join(', ') + '. Check every line against its page.'); load(); return;
  }
  if (b.id === 'addrow') { var t = el('ctab'); var tr = t.insertRow(-1); tr.setAttribute('data-i', '-1');
    tr.innerHTML = '<td><input type="text" data-c="clause" style="width:60px"></td><td><textarea data-c="requirement" rows="2"></textarea></td><td><textarea data-c="submitted" rows="2"></textarea><input type="hidden" data-c="quote" value=""></td><td><select data-c="complies"><option></option><option>Y</option><option>N</option><option>Partly</option></select></td><td><textarea data-c="deviation" rows="2"></textarea></td><td><input type="number" min="0" data-c="page" value="0" style="width:58px"></td>'; return; }
  if (b.id === 'psave') { var r2 = await api('/api/material/edit', collect()); if (r2.error) { say('sayp', r2.error, true); return; } await openPkg(P.package.id); say('sayp', 'Saved.'); return; }
  if (b.id === 'pdone') { var r3 = await api('/api/material/edit', collect()); if (r3.error) { say('sayp', r3.error, true); return; }
    var r4 = await api('/api/material/complete', { id: P.package.id }); if (r4.error) { await openPkg(P.package.id); say('sayp', r4.error, true); return; } await openPkg(P.package.id); say('sayp', 'Rev ' + r4.rev + ' formed; the one before is kept.'); load(); return; }
  if (b.id === 'psub') { var r5 = await api('/api/material/submit', { id: P.package.id }); if (r5.error) { say('sayp', r5.error, true); return; } location.href = '/s0?ref=' + encodeURIComponent(r5.ref); }
});
document.addEventListener('change', async function(e){
  if (e.target.id !== 'pcert' || !e.target.files[0]) return;
  var f = e.target.files[0];
  var r = await api('/api/material/cert', { id: P.package.id, filename: f.name, data: await b64(f) });
  if (r.error) { say('sayp', r.error, true); return; } openPkg(P.package.id);
});
load();
`;

export const materialHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Material submittals · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1280px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
.card h2 { margin: 0 0 8px; font-size: var(--fs-body); } h3 { font-size: var(--fs-secondary); margin: 14px 0 6px; }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-secondary); }
th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { font-size: var(--fs-secondary); color: var(--muted); font-weight: 500; }
td textarea { width: 100%; font: inherit; font-size: var(--fs-secondary); }
.src { font-size: var(--fs-secondary); color: var(--muted); } .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
input[type=text], input[type=number], select, textarea { font: inherit; font-size: var(--fs-secondary); padding: 5px 7px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--ink); }
.say { margin-top: 6px; font-size: var(--fs-secondary); } .say.err { color: var(--serious-text); }
.btn.sm { font-size: var(--fs-secondary); padding: 3px 8px; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Material submittals</h1><div class="sub">the package, then the submittal desk</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/api/material/log.xlsx">Log (Excel)</a>
  <a class="btn" href="/">Dashboard</a>
</div></div>
<div class="wrap">
  <div class="card" id="pkg" hidden></div>
  <div class="card" id="startCard" hidden><h2>+ Material submittal</h2>
    <div class="row"><select id="sp3"></select></div>
    <div class="row"><input type="text" id="stitle" placeholder="Material (e.g. External emulsion paint)" style="min-width:320px"> <input type="text" id="sdisc" placeholder="Discipline"> <input type="text" id="ssup" placeholder="Supplier"> <input type="text" id="sbrand" placeholder="Brand"></div>
    <div class="row"><select id="ssec"></select> <select id="slib"></select> <input type="number" id="sfrom" placeholder="from page" style="width:90px"> <input type="number" id="sto" placeholder="to page" style="width:90px"> <input type="text" id="scode" placeholder="section no." style="width:100px"></div>
    <div class="row"><select id="sboq"></select></div>
    <div class="row"><textarea id="sapp" rows="2" placeholder="Approved manufacturers, one per line (from the spec section where it names them)" style="min-width:420px"></textarea></div>
    <div class="row"><label class="src">The catalogue (PDF) <input type="file" id="scat" accept=".pdf"></label> <label class="src">Certificates <input type="file" id="scerts" accept=".pdf,.png,.jpg,.jpeg" multiple></label> <button class="btn prim" id="start">Start the package</button></div>
    <div class="say" id="says"></div>
  </div>
  <div class="card"><h2>Material submittal log</h2><div id="log"><p class="src">Loading…</p></div></div>
  <div class="card" id="qaqcCard" hidden><h2>QA/QC review</h2><p class="src" id="qaqcSay"></p><button class="btn" id="qaqcBtn"></button></div>
</div>
<script>${SCRIPT}</script>
</body>
</html>`;
