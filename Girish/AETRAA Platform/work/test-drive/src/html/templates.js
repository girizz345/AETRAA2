import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK } from './shared.js';
import { SIGNBOX_JS } from './signboxes.js';

// TEMPLATES — kept by Document Control, per project.
//
// Every consultant sends their own forms. Document Control uploads each one,
// exactly as it was sent, against its document (RFI, submittal, WIR …). The
// form is read for its fields (src/template-extract.js): what each box is
// called, which ones the platform fills (reference, date, project, parties),
// and which the person raising the document is asked for. Document Control
// checks that on the form itself — rename a field, remove it, click a box to
// add one — and where each step signs. From then on that document's New form
// asks for exactly those fields, and the document is issued on that form.

const SCRIPT = String.raw`
var Q = new URLSearchParams(location.search).get('p') || '';
var PID = Q, DOCS = {}, LIST = [], ED = null, AI_FIELDS = false;
function el(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function api(path){ return path + (path.indexOf('?') >= 0 ? '&' : '?') + (Q ? 'p=' + encodeURIComponent(Q) : ''); }
function say(t, ok){ var m = el('msg'); m.hidden = !t; m.textContent = t || ''; m.className = 'msg ' + (ok ? 'ok' : 'err'); }
async function get(path){ var r = await fetch(api(path), { cache: 'no-store' }); var d = await r.json().catch(function(){ return {}; }); if (!r.ok || d.error) throw new Error(d.error || 'HTTP ' + r.status); return d; }
async function post(path, body){ var r = await fetch(api(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  var d = await r.json().catch(function(){ return {}; }); if (!r.ok || d.error) throw new Error(d.error || 'HTTP ' + r.status); return d; }

async function load(){
  try {
    if (!PID) { var pr = await get('/api/projects'); PID = pr.current || ''; el('proj').textContent = ((pr.projects || []).filter(function(x){ return x.id === PID; })[0] || {}).name || ''; }
    var d = await get('/api/templates');
    DOCS = d.doc_types || {}; LIST = d.templates || []; AI_FIELDS = !!d.ai_fields;
    var by = {}; LIST.forEach(function(t){ by[t.doc_type] = t; });
    el('rows').innerHTML = Object.keys(DOCS).map(function(k){
      var t = by[k];
      // K4: a Word form read from its tables (E16) has fields and signature
      // boxes like an Excel one; a form whose placeholders nothing fills says so.
      var unk = t && t.unknown_tokens && t.unknown_tokens.length ? '<div class="hint" style="color:var(--warn-ink)">Prints blank: ' + t.unknown_tokens.map(function(u){ return '<b>' + esc(u.token) + '</b>'; }).join(', ') + ' — ' + esc(t.unknown_tokens[0].why) + '</div>' : '';
      var what = !t ? '' : t.inputs.length ? t.inputs.length + ' fields: ' + esc(t.inputs.join(', '))
        : t.has_fields ? 'every field is filled by the platform'
        : (t.format === 'docx' ? 'filled from its {{placeholders}}' : 'no fields to fill');
      return '<tr><td><b>' + esc(DOCS[k]) + '</b></td>' +
        '<td>' + (t ? esc(t.filename) + '<div class="hint">' + what + (t.needs_ai && t.has_fields ? ' · fewer than two fields were read — check them on the form' : '') + '</div>' + unk : '<span class="hint">No form yet — the plain form is used</span>') + '</td>' +
        '<td class="acts"><label class="btn">' + (t ? 'Replace' : 'Upload form') + '<input type="file" accept=".xlsx,.docx,.pdf" data-up="' + esc(k) + '" hidden></label>' +
        // K9 (v5 A6): fewer than two fields read — the AI can propose them.
        (t && t.needs_ai && AI_FIELDS ? ' <button class="btn" data-aifields="' + esc(k) + '">Find fields with AI</button>' : '') +
        (t && (t.format === 'xlsx' || t.has_fields) ? ' <button class="btn" data-fields="' + esc(k) + '">Fields</button> <button class="btn" data-signs="' + esc(k) + '">Signature boxes' + (t.boxes ? ' (' + t.boxes + ')' : '') + '</button>' : '') +
        (t ? ' <button class="btn" data-del="' + esc(k) + '">Remove</button>' : '') + '</td></tr>';
    }).join('');
  } catch (e) { say(e.message, false); }
}

document.addEventListener('change', async function(ev){
  var inp = ev.target.closest && ev.target.closest('[data-up]');
  if (!inp || !inp.files || !inp.files[0]) return;
  var f = inp.files[0], type = inp.getAttribute('data-up');
  if (!/\.(xlsx|docx)$/i.test(f.name)) { say('Upload the consultant’s Excel (.xlsx) or Word (.docx) form.', false); return; }
  say('Reading ' + f.name + '…', true);
  var buf = new Uint8Array(await f.arrayBuffer()), s = '';
  for (var i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  try {
    var r = await post('/api/templates/upload', { doc_type: type, filename: f.name, file_b64: btoa(s) });
    say(DOCS[type] + ': ' + f.name + ' read — ' + (r.inputs != null ? r.inputs + ' fields to fill, ' : '') + (r.sign_boxes || 0) + ' signature boxes. Check the fields on the form.'
      + ((r.unknown_tokens || []).length ? ' These print blank: ' + r.unknown_tokens.map(function(u){ return u.token; }).join(', ') + '.' : '')
      + (r.warning ? ' ' + r.warning : ''), true);
    await load();
    if (r.fields) openFields(type);
  } catch (e) { say(e.message, false); }
});

document.addEventListener('click', async function(ev){
  var ai = ev.target.closest ? ev.target.closest('[data-aifields]') : null;
  if (ai) {
    var at = ai.getAttribute('data-aifields');
    ai.disabled = true; say('Finding the fields on the ' + (DOCS[at] || at) + ' form with AI — only the cell text and positions are sent…', true);
    try { var pr = await post('/api/templates/ai-fields', { doc_type: at }); say('', true); openFields(at, pr); }
    catch (e) { say(e.message, false); }
    ai.disabled = false;
    return;
  }
  var b = ev.target.closest ? ev.target.closest('[data-fields],[data-signs],[data-del]') : null;
  if (!b) return;
  var type = b.getAttribute('data-fields') || b.getAttribute('data-signs') || b.getAttribute('data-del');
  if (b.hasAttribute('data-fields')) openFields(type);
  else if (b.hasAttribute('data-signs')) openSignBoxes(PID, type, DOCS[type] || type);
  else if (confirm('Remove the ' + (DOCS[type] || type) + ' form? Documents raised from now on use the plain form.')) {
    try { await post('/api/templates/remove', { doc_type: type }); say('Removed.', true); load(); } catch (e) { say(e.message, false); }
  }
});

// ---- the fields, on the form itself
// aiDraft (K9, v5 A6): the AI's proposed fields and signature boxes, shown on
// the form beside what the extractor read; nothing is kept until Save.
async function openFields(type, aiDraft){
  try {
    var d = await get('/api/templates/review?type=' + encodeURIComponent(type));
    ED = { type: type, fields: d.fields.map(function(f){ return Object.assign({}, f); }), adding: false, ai: null };
    if (aiDraft && aiDraft.id) {
      (aiDraft.fields || []).forEach(function(f){ ED.fields.push({ cell: f.cell, label: f.label, token: f.token, auto: f.auto, long: f.long, ai: true }); });
      ED.ai = { id: aiDraft.id, model: aiDraft.model, signs: (aiDraft.signatures || []).map(function(s){ return { cell: s.cell, label: s.label, keep: true }; }), dropped: aiDraft.dropped || [] };
    }
    if (!el('tpCss')) { var st = document.createElement('style'); st.id = 'tpCss'; st.textContent = d.css; document.head.appendChild(st); }
    var ov = el('fov'); ov.style.display = 'flex';
    el('fbox').innerHTML = '<div class="fhead"><h2>' + esc(DOCS[type] || type) + ' — fields</h2><span class="hint">' + esc(d.filename) + '</span><span style="flex:1"></span>' +
      '<button class="btn prim" id="fsave">Save</button><button class="btn" id="fclose">Close</button></div>' +
      '<div class="hint" style="margin:6px 0 10px">These are the boxes read from the form. <b>Asked for</b> boxes become the inputs of the New ' + esc(DOCS[type] || type) +
      ' form, in this order, under these names. <b>Filled by the platform</b> boxes take the reference, date, project and parties. Rename, remove, or press <b>Add a field</b> and click a box on the form.</div>' +
      '<div class="fgrid"><div id="flist"></div><div class="tp-wrap" id="fform">' + d.html + '</div></div>';
    el('fclose').onclick = function(){ ov.style.display = 'none'; };
    el('fsave').onclick = saveFields;
    el('fform').addEventListener('click', function(ev){
      var td = ev.target.closest('[data-cell]'); if (!td || !ED.adding) return;
      var cell = td.getAttribute('data-cell');
      if (ED.fields.some(function(f){ return f.cell === cell; })) { ED.adding = false; paintFields(); return; }
      ED.fields.push({ cell: cell, label: 'New field', token: '', auto: false, long: false });
      ED.adding = false; paintFields();
    });
    paintFields();
  } catch (e) { say(e.message, false); }
}
function paintFields(){
  var ask = ED.fields.filter(function(f){ return !f.auto; }), auto = ED.fields.filter(function(f){ return f.auto; });
  el('flist').innerHTML = '<div class="fsec">Asked for (' + ask.length + ')</div>' + ask.map(function(f){
      var i = ED.fields.indexOf(f);
      return '<div class="frow"><input data-lbl="' + i + '" value="' + esc(f.label) + '"><span class="cell">' + esc(f.cell) + (f.ai ? ' <b title="Proposed by AI">AI</b>' : '') + '</span>' +
        '<label class="hint"><input type="checkbox" data-long="' + i + '"' + (f.long ? ' checked' : '') + '> long</label><button class="x" data-rm="' + i + '">×</button></div>';
    }).join('') +
    '<button class="btn" id="fadd" style="margin:6px 0 12px">' + (ED.adding ? 'Click a box on the form…' : '+ Add a field') + '</button>' +
    '<div class="fsec">Filled by the platform (' + auto.length + ')</div>' + auto.map(function(f){
      var i = ED.fields.indexOf(f);
      return '<div class="frow auto"><span>' + esc(f.label) + '</span><span class="cell">' + esc(f.cell) + (f.ai ? ' <b title="Proposed by AI">AI</b>' : '') + '</span><button class="x" data-rm="' + i + '">×</button></div>';
    }).join('') +
    // K9 (v5 A6): the AI's signature boxes, kept only if ticked; and what it
    // proposed that could not be used, with the reason.
    (ED.ai ? '<div class="fsec" style="margin-top:12px">Signature boxes proposed by AI (' + ED.ai.signs.length + ')</div>' + ED.ai.signs.map(function(s, j){
        return '<label class="frow hint"><input type="checkbox" data-sgn="' + j + '"' + (s.keep ? ' checked' : '') + '> ' + esc(s.label) + ' <span class="cell">' + esc(s.cell) + '</span></label>';
      }).join('') + '<div class="hint">Kept boxes are offered under <b>Signature boxes</b>, where you say which step signs in each.</div>' +
      (ED.ai.dropped.length ? '<div class="fsec" style="margin-top:12px">Not used (' + ED.ai.dropped.length + ')</div>' + ED.ai.dropped.map(function(x){ return '<div class="hint">' + esc(x.cell) + ' ' + esc(x.label || '') + ' — ' + esc(x.why) + '</div>'; }).join('') : '') +
      '<div class="hint" style="margin-top:8px">Proposed by ' + esc(ED.ai.model || 'AI') + ' from the cell text and positions only. Nothing is kept until you press Save.</div>' : '');
  el('flist').querySelectorAll('[data-sgn]').forEach(function(x){ x.onchange = function(){ ED.ai.signs[x.getAttribute('data-sgn')].keep = x.checked; }; });
  el('flist').querySelectorAll('[data-lbl]').forEach(function(x){ x.oninput = function(){ ED.fields[x.getAttribute('data-lbl')].label = x.value; }; });
  el('flist').querySelectorAll('[data-long]').forEach(function(x){ x.onchange = function(){ ED.fields[x.getAttribute('data-long')].long = x.checked; }; });
  el('flist').querySelectorAll('[data-rm]').forEach(function(x){ x.onclick = function(){ ED.fields.splice(Number(x.getAttribute('data-rm')), 1); paintFields(); }; });
  el('fadd').onclick = function(){ ED.adding = true; paintFields(); };
  var form = el('fform');
  form.querySelectorAll('td.tp-chosen').forEach(function(td){ td.classList.remove('tp-chosen'); });
  ED.fields.forEach(function(f){ var td = form.querySelector('[data-cell="' + f.cell + '"]'); if (td) td.classList.add('tp-chosen'); });
}
async function saveFields(){
  var seen = {};
  var fields = ED.fields.map(function(f){
    var t = f.token && f.auto ? f.token : String(f.label || 'field').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';
    if (seen[t]) { seen[t]++; t = t + '_' + seen[t]; } else seen[t] = 1;
    return { cell: f.cell, label: f.label, token: t, auto: f.auto, long: f.long };
  });
  var body = { doc_type: ED.type, fields: fields };
  if (ED.ai) { body.proposal_id = ED.ai.id; body.ai_signs = ED.ai.signs.filter(function(s){ return s.keep; }).map(function(s){ return s.cell; }); }
  try { var r = await post('/api/templates/fields', body);
    el('fov').style.display = 'none'; say(DOCS[ED.type] + ': saved — ' + r.inputs + ' fields on the New form.', true); load();
  } catch (e) { say(e.message, false); }
}
window.SIGNBOX_SAVE_URL = '/api/templates/signs';
window.onSignBoxesSaved = function(label){ say('Signature boxes saved for ' + label + '.', true); load(); };
load();
`;

export const templatesHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Templates · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}
.wrap { max-width: 1180px; margin: 0 auto; padding: 16px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 15px 17px; }
table { width: 100%; border-collapse: collapse; }
td { padding: 10px 8px; border-top: 1px solid var(--border); vertical-align: top; font-size: var(--fs-secondary); }
td.acts { text-align: right; white-space: nowrap; }
.hint { font-size: var(--fs-secondary); color: var(--muted); }
.msg { margin: 10px 0; }
#fov { position: fixed; inset: 0; background: var(--scrim); z-index: 90; display: none; align-items: flex-start; justify-content: center; overflow: auto; padding: 22px; }
#fbox { background: var(--surface); border-radius: 12px; max-width: 1360px; width: 100%; padding: 16px 18px; }
.fhead { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.fhead h2 { margin: 0; font-size: var(--fs-body); }
.fgrid { display: grid; grid-template-columns: 330px 1fr; gap: 14px; align-items: start; }
.fsec { font-size: var(--fs-label); text-transform: uppercase; letter-spacing: .07em; color: var(--muted); margin: 4px 0 6px; }
.frow { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; }
.frow input:not([type]) { flex: 1; padding: 6px 8px; border: 1px solid var(--border); border-radius: 7px; font: inherit; font-size: var(--fs-secondary); }
.frow.auto span:first-child { flex: 1; font-size: var(--fs-secondary); color: var(--ink-2); }
.cell { font-size: var(--fs-secondary); color: var(--muted); min-width: 30px; }
.x { border: none; background: none; font-size: var(--fs-headline); cursor: pointer; color: var(--muted); }
@media (max-width: 900px) { .fgrid { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Templates</h1><div class="sub">the consultant's forms for <span id="proj">this project</span></div></div>
  <div class="spacer"></div>
  <a class="btn" href="/">Back to the dashboard</a>
</div></div>
<div class="wrap">
  <div id="msg" class="msg" hidden></div>
  <div class="card">
    <div class="hint" style="margin-bottom:8px">Upload each consultant form exactly as it was sent — even one still filled in from the last job. It is read for its fields; check them with <b>Fields</b>, set where each step signs with <b>Signature boxes</b>. From then on that document is raised on that form, with those fields.</div>
    <table><tbody id="rows"><tr><td class="hint">Loading…</td></tr></tbody></table>
  </div>
</div>
<div id="fov"><div id="fbox"></div></div>
<script>${SCRIPT}
${SIGNBOX_JS}
</script>
</body>
</html>`;
