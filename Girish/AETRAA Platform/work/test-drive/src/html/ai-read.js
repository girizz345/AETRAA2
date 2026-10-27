// K9 · v5 A1: "Read with AI" on a scanned sheet — the panel shared by the
// drawing register and the intake review. The AI's reading of the sheet's
// title-block corner is shown beside the image that was sent; Document
// Control takes each value, types over it, or leaves it. Nothing is written
// until Confirm, and a value already on the sheet is kept unless typed over.
// Calls window.onAiSheetDone(result) after a confirm or a discard.
export const AIREAD_JS = String.raw`
var AIR = null;
var AIR_NAMES = { number: 'Number', revision: 'Revision', title: 'Title', date: 'Date', discipline: 'Discipline' };
function airEsc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function airBox(html){
  var ov = document.getElementById('airOverlay');
  if (!ov) { ov = document.createElement('div'); ov.id = 'airOverlay';
    ov.style.cssText = 'position:fixed;inset:0;background:var(--scrim);z-index:99;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 16px';
    document.body.appendChild(ov); }
  ov.style.display = 'flex';
  ov.innerHTML = '<div style="background:var(--surface);color:var(--text);border:1px solid var(--line);border-radius:var(--r-frame);max-width:1100px;width:100%;padding:24px">' + html + '</div>';
  return ov;
}
function airClose(){ var ov = document.getElementById('airOverlay'); if (ov) ov.style.display = 'none'; }
async function readSheetAI(target, label){
  airBox('<b>' + airEsc(label) + '</b><p>Reading the title-block corner with AI&hellip; only the corner is sent.</p>');
  var d = {};
  try { var r = await fetch('/api/ai/sheet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(target) });
    d = await r.json().catch(function(){ return {}; }); if (!r.ok && !d.error) d.error = 'The sheet could not be read (' + r.status + ').'; }
  catch (e) { d = { error: 'Could not reach the server.' }; }
  if (d.error) { airBox('<b>' + airEsc(label) + '</b><p style="color:var(--bad-ink)">' + airEsc(d.error) + '</p><button class="btn" onclick="airClose()">Close</button>'); return; }
  // Its title block states another project: held for AETRAA, nothing to confirm here.
  if (d.held) {
    airBox('<b>' + airEsc(label) + ' — held for AETRAA</b><p>' + airEsc(d.held.reason) + '</p><p class="hint">AETRAA checks it on the held list: released, it comes back here; rejected, you are told why.</p><button class="btn" id="airHeldOk">Close</button>');
    document.getElementById('airHeldOk').onclick = function(){ airClose(); if (window.onAiSheetDone) window.onAiSheetDone({ held: d.held }); };
    return;
  }
  AIR = { d: d, label: label };
  paintAIR('');
}
function paintAIR(err){
  var d = AIR.d, f = d.fields || {};
  var rows = ['number', 'revision', 'title', 'date', 'discipline'].map(function(k){
    var x = f[k] || {};
    var flags = (x.flags || []).map(function(g){ return '<div style="font-size:var(--fs-secondary);color:' + (g.blocks ? 'var(--bad-ink)' : 'var(--warn-ink)') + '">' + airEsc(g.why) + '</div>'; }).join('');
    var read = x.ai ? '<b>' + airEsc(x.ai) + '</b>' + (k === 'date' && x.iso && x.iso !== x.ai ? ' <span class="hint">(' + airEsc(x.iso) + ')</span>' : '') + ' <span class="hint">' + airEsc(x.sure) + '</span>' : '<span class="hint">not read</span>';
    var now = x.kept ? airEsc(x.kept) + ' <span class="hint">(' + airEsc(x.source || '') + ')</span>' : '<span class="hint">—</span>';
    var take = x.may_take ? '<label><input type="checkbox" data-air-take="' + k + '"' + (x.sure !== 'low' ? ' checked' : '') + '> use it</label>' : '';
    var typed = '<input data-air-type="' + k + '" ' + (k === 'date' ? 'type="date"' : 'placeholder="or type it"') + ' style="width:150px">';
    return '<tr><td><b>' + AIR_NAMES[k] + '</b></td><td>' + read + flags + '</td><td>' + now + '</td><td>' + take + ' ' + typed + '</td></tr>';
  }).join('');
  airBox('<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h2 style="margin:0">' + airEsc(AIR.label) + ' — read by AI</h2>'
    + '<span class="hint">' + airEsc(d.model || '') + ' · only the title-block corner was sent</span><span style="flex:1"></span>'
    + '<button class="btn" id="airX">Close</button><button class="btn" id="airNo">Discard the reading</button><button class="btn btn-primary prim" id="airOk">Confirm</button></div>'
    + (err ? '<p style="color:var(--bad-ink)">' + airEsc(err) + '</p>' : '')
    + '<p class="hint">Check each value against the corner. Tick <b>use it</b> to take what the AI read, or type the right value. A value already on the sheet is kept unless you type over it. Nothing is saved until you confirm, and the sheet still waits for the PM’s approval.</p>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:16px;align-items:start">'
    + '<div style="overflow-x:auto"><table><tr><th>Value</th><th>AI read</th><th>On the sheet now</th><th>Keep</th></tr>' + rows + '</table></div>'
    + '<img src="' + airEsc(d.corner_url) + '" alt="The title-block corner sent to the AI" style="max-width:100%;border:1px solid var(--line-strong);border-radius:var(--r-card)"></div>');
  document.getElementById('airX').onclick = airClose;
  document.getElementById('airNo').onclick = async function(){
    await fetch('/api/ai/sheet/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: AIR.d.id, discard: true }) });
    airClose(); if (window.onAiSheetDone) window.onAiSheetDone({ discarded: true });
  };
  document.getElementById('airOk').onclick = async function(){
    var fields = {};
    document.querySelectorAll('[data-air-take]').forEach(function(c){ if (c.checked) fields[c.getAttribute('data-air-take')] = 'ai'; });
    document.querySelectorAll('[data-air-type]').forEach(function(i){ if (i.value.trim()) fields[i.getAttribute('data-air-type')] = { value: i.value.trim() }; });
    var r = await fetch('/api/ai/sheet/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: AIR.d.id, fields: fields }) });
    var j = await r.json().catch(function(){ return {}; });
    if (!r.ok || j.error) { paintAIR(j.error || 'It was not saved.'); return; }
    airClose(); if (window.onAiSheetDone) window.onAiSheetDone(j);
  };
}
`;
