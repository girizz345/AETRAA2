// K11 · v5 A5: the diary's "Delivery notes and certificates" card. Upload,
// check what was read (each value says whether it was read from the document
// or by AI, and anything not used says why), then confirm: a delivery note's
// lines into Delivery of materials, a certificate into the certificates
// register. Runs beside the diary page's own script (load, toast, DIRTY, D).
export const DIARY_DOCS_JS = String.raw`
var DOCS = null, DDOC = null;
function ddEsc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
function ddDay(){ var e = document.getElementById('day'); return e ? e.value : ''; }
async function ddApi(path, body){ var r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  var j = await r.json().catch(function(){ return {}; }); if (!r.ok && !j.error) j.error = 'It did not work (' + r.status + ').'; return j; }
function ddB64(file){ return new Promise(function(ok){ var fr = new FileReader(); fr.onload = function(){ var s = String(fr.result); ok(s.slice(s.indexOf(',') + 1)); }; fr.readAsDataURL(file); }); }
function ddTag(x){ return !x || !x.source ? '' : ' <span class="hint">' + (x.source === 'rule' ? 'read from the document' : 'read by AI' + (x.sure ? ' (' + x.sure + ')' : '')) + '</span>'
  + ((x.flags || []).length ? '<div class="hint" style="color:var(--warn-ink)">' + x.flags.map(ddEsc).join(' · ') + '</div>' : ''); }
async function loadDocs(){
  var d = ddDay(); if (!d) return;
  DOCS = await ddApi('/api/diary/docs?day=' + d);
  var box = document.getElementById('docList');
  if (DOCS.error) { box.innerHTML = '<p class="hint">' + ddEsc(DOCS.error) + '</p>'; return; }
  var exp = (DOCS.expiring || []).filter(function(c){ return c.state !== 'not found'; });
  box.innerHTML = (exp.length ? '<p class="hint" style="color:var(--warn-ink)">' + exp.map(function(c){ return ddEsc(c.ref) + (c.state === 'expired' ? ' expired ' : ' expires ') + ddEsc(c.expiry); }).join(' · ') + '</p>' : '') +
    (DOCS.docs.length ? '<table style="width:100%;font-size:var(--fs-secondary);margin-top:8px">' + DOCS.docs.map(function(x){
      return '<tr><td>' + (x.kind === 'delivery' ? 'Delivery note' : 'Certificate') + '</td><td><a href="/api/diary/docs/file?id=' + encodeURIComponent(x.id) + '" target="_blank" rel="noopener">' + ddEsc(x.filename) + '</a></td><td>' +
        (x.state === 'read' ? '<button class="btn" data-ddopen="' + ddEsc(x.id) + '">Check and confirm</button>' : ddEsc(x.state) + (x.cert_ref ? ' as ' + ddEsc(x.cert_ref) : '') + (x.confirmed_by ? ' by ' + ddEsc(x.confirmed_by) : '')) + '</td></tr>';
    }).join('') + '</table>' : '<p class="hint">Nothing uploaded for this day.</p>');
}
function showDoc(x){
  DDOC = x;
  var g = x.draft || {}, h = '<div class="card" style="margin-top:10px;border-style:dashed"><b>' + ddEsc(x.filename) + '</b> <span class="hint">' + (x.model ? 'read from the document and by ' + ddEsc(x.model) : 'read from the document') + '</span>' +
    (x.already ? '<p class="hint" style="color:var(--warn-ink)">' + ddEsc(x.already) + '</p>' : '') + (x.why ? '<p class="hint">' + ddEsc(x.why) + '</p>' : '');
  if (x.kind === 'delivery') {
    var items = (g.items && g.items.length ? g.items : [{ m: '', q: '', u: '', b: '' }]);
    h += '<div style="display:grid;grid-template-columns:120px 1fr;gap:6px;align-items:center;margin-top:8px">' +
      '<span>Supplier</span><span><input id="ddSup" value="' + ddEsc((g.supplier || {}).value) + '">' + ddTag(g.supplier) + '</span>' +
      '<span>Delivery note no.</span><span><input id="ddDn" value="' + ddEsc((g.dn || {}).value) + '">' + ddTag(g.dn) + '</span>' +
      ((g.date || {}).value && g.date.value !== x.day ? '<span>Note dated</span><span>' + ddEsc(g.date.value) + ' <span class="hint">(this is the diary of ' + ddEsc(x.day) + ')</span></span>' : '') + '</div>' +
      '<table style="width:100%;margin-top:8px" id="ddItems"><tr><th>Material</th><th>Qty</th><th>Unit</th><th>Batch</th><th></th></tr>' + items.map(function(it){
        return '<tr><td><input data-i="m" value="' + ddEsc(it.m) + '"></td><td><input data-i="q" value="' + ddEsc(it.q) + '" style="width:70px"></td><td><input data-i="u" value="' + ddEsc(it.u) + '" style="width:60px"></td><td><input data-i="b" value="' + ddEsc(it.b) + '" style="width:110px"></td><td><button class="rm" type="button" data-ddrm>×</button></td></tr>';
      }).join('') + '</table><button class="btn add" type="button" id="ddAdd">Add a line</button>' +
      (D && D.status === 'submitted' ? '<div style="margin-top:8px"><input id="ddReason" placeholder="The diary is submitted — why it is changed" style="width:100%"></div>' : '') +
      '<div style="margin-top:10px;display:flex;gap:8px"><button class="btn primary" id="ddOk">Add to the day’s deliveries</button><button class="btn" id="ddNo">Discard</button></div>';
  } else {
    var types = (DOCS && DOCS.types) || [];
    h += '<div style="display:grid;grid-template-columns:130px 1fr;gap:6px;align-items:center;margin-top:8px">' +
      '<span>Type</span><span><select id="ddType"><option></option>' + types.map(function(t){ return '<option' + (t === (g.type || {}).value ? ' selected' : '') + '>' + ddEsc(t) + '</option>'; }).join('') + '</select>' + ddTag(g.type) + '</span>' +
      '<span>Certificate no.</span><span><input id="ddNo2" value="' + ddEsc((g.number || {}).value) + '">' + ddTag(g.number) + '</span>' +
      '<span>Issued by</span><span><input id="ddBy" value="' + ddEsc((g.issued_by || {}).value) + '">' + ddTag(g.issued_by) + '</span>' +
      '<span>Covers</span><span><input id="ddSub" value="' + ddEsc((g.subject || {}).value) + '" placeholder="plant / serial, person, or material and heat no.">' + ddTag(g.subject) + '</span>' +
      '<span>Issued</span><span><input type="date" id="ddIss" value="' + ddEsc((g.issued || {}).value) + '">' + ddTag(g.issued) + '</span>' +
      '<span>Expiry</span><span><input type="date" id="ddExp" value="' + ddEsc((g.expiry || {}).value) + '">' + ddTag(g.expiry) + '<div class="hint">An expired certificate is still filed, and flagged. With no expiry it is listed as “expiry not found”.</div></span></div>' +
      (DOCS && DOCS.certs_on === false ? '<p class="hint" style="color:var(--warn-ink)">The certificates register (HSE) is not switched on for this project.</p>' : '') +
      '<div style="margin-top:10px;display:flex;gap:8px"><button class="btn primary" id="ddOk">File in the certificates register</button><button class="btn" id="ddNo">Discard</button></div>';
  }
  document.getElementById('docDraft').innerHTML = h + '<div class="hint" id="ddSay"></div></div>';
}
document.addEventListener('change', async function(e){
  if (e.target.id === 'day') { document.getElementById('docDraft').innerHTML = ''; loadDocs(); return; }
  if (e.target.id !== 'docFile' || !e.target.files[0]) return;
  var f = e.target.files[0], say = document.getElementById('docSay');
  say.textContent = 'Reading ' + f.name + '…';
  var r = await ddApi('/api/diary/docs/read', { day: ddDay(), kind: document.getElementById('docKind').value, filename: f.name, data: await ddB64(f) });
  e.target.value = '';
  if (r.error) { say.textContent = r.error; return; }
  say.textContent = ''; showDoc(r); loadDocs();
});
document.addEventListener('click', async function(e){
  var b = e.target.closest ? e.target.closest('button') : null; if (!b) return;
  if (b.hasAttribute('data-ddopen')) { var x = (DOCS.docs || []).filter(function(d){ return d.id === b.getAttribute('data-ddopen'); })[0]; if (x) showDoc(x); return; }
  if (b.hasAttribute('data-ddrm')) { var tr = b.closest('tr'); if (tr) tr.remove(); return; }
  if (b.id === 'ddAdd') { var t = document.getElementById('ddItems'); var row = t.insertRow(-1); row.innerHTML = '<td><input data-i="m"></td><td><input data-i="q" style="width:70px"></td><td><input data-i="u" style="width:60px"></td><td><input data-i="b" style="width:110px"></td><td><button class="rm" type="button" data-ddrm>×</button></td>'; return; }
  if (b.id === 'ddNo') { await ddApi('/api/diary/docs/discard', { id: DDOC.id }); document.getElementById('docDraft').innerHTML = ''; loadDocs(); return; }
  if (b.id !== 'ddOk') return;
  var body = { id: DDOC.id }, say = document.getElementById('ddSay');
  if (DDOC.kind === 'delivery') {
    if (typeof DIRTY !== 'undefined' && DIRTY) { say.textContent = 'Save your changes to the diary first — the delivery is added to the diary as it is saved.'; return; }
    body.supplier = document.getElementById('ddSup').value; body.dn = document.getElementById('ddDn').value;
    body.items = [].map.call(document.querySelectorAll('#ddItems tr'), function(tr){ var o = {}; tr.querySelectorAll('[data-i]').forEach(function(i){ o[i.getAttribute('data-i')] = i.value; }); return o; }).filter(function(o){ return o.m; });
    var rs = document.getElementById('ddReason'); if (rs) body.reason = rs.value;
  } else {
    body.type = document.getElementById('ddType').value; body.number = document.getElementById('ddNo2').value; body.issued_by = document.getElementById('ddBy').value;
    body.subject = document.getElementById('ddSub').value; body.issued = document.getElementById('ddIss').value; body.expiry = document.getElementById('ddExp').value;
  }
  b.disabled = true;
  var r = await ddApi('/api/diary/docs/confirm', body);
  b.disabled = false;
  if (r.error) { say.textContent = r.error; return; }
  document.getElementById('docDraft').innerHTML = '';
  if (typeof toast === 'function') toast(DDOC.kind === 'delivery' ? r.lines + ' line' + (r.lines === 1 ? '' : 's') + ' added to the day’s deliveries' : r.ref + ' filed' + (r.flag ? ' — ' + r.flag : ''));
  loadDocs();
  if (DDOC.kind === 'delivery' && typeof load === 'function') load();
});
loadDocs();
`;
