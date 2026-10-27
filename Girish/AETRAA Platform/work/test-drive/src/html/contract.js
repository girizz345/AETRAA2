import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK, SWITCHER_CSS, SWITCHER_JS } from './shared.js';
import { ADMIN_CSS, ADMIN_BAR, ADMIN_JS, STEPS_CSS, STEPS_BAR } from './admin-nav.js';

// STEP 2 — THE CONTRACT, AND EVERYTHING THAT COMES OUT OF IT.
//
// The old first screen asked for twenty things: client, consultant, contractor,
// location, completion date, currency, retention, retention cap, advance,
// payment days, notice clause, RFI reply days. Thirteen of them are on the
// first pages of the contract. Typing them in before the contract has been
// loaded is how a project ends up with 10% retention because that was the
// number already in the box.
//
// So the contract comes second, immediately after the project has a name, and
// it answers the rest. Both halves of it:
//
//   THE PARTIES     who the Employer, the Engineer and the Contractor are.
//                   Read off the preamble, carried to step 3 to be confirmed.
//   THE FIGURES     retention, cap, advance, payment days, RFI reply days, the
//                   notice clause and the completion date.
//
// NOTHING IS APPLIED WITHOUT A PERSON. Every proposal arrives with the page it
// is on and the sentence it came from, and is applied only when ticked. A
// figure without its clause is exactly as useless as no figure at all, because
// the person still has to open the contract to check it — so the sentence is on
// the screen, and the tick is the act of having read it.
//
// A SCANNED CONTRACT READS AS NOTHING, and the screen says so in those words
// rather than showing an empty list that looks like a contract with no terms
// in it. That distinction matters: one means type them in, the other means
// there is nothing to type.

export const contractHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The contract · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}${ADMIN_CSS}${STEPS_CSS}
.wrap { max-width: 980px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
        padding: 15px 17px; margin-bottom: 12px; }
.card h2 { margin: 0 0 3px; font-size: var(--fs-body); }
.card .sub { font-size: var(--fs-secondary); color: var(--muted); margin-bottom: 12px; line-height: 1.55; }

.drop { border: 2px dashed var(--border); border-radius: 12px; padding: 26px 18px; text-align: center;
        color: var(--muted); font-size: var(--fs-secondary); transition: border-color .12s, background .12s; }
.drop.over { border-color: var(--ink); background: var(--surface-2); color: var(--ink); }
.drop b { display: block; color: var(--ink); font-size: var(--fs-body); margin-bottom: 4px; }
.drop .or { margin-top: 10px; }
.prog { font-size: var(--fs-secondary); color: var(--muted); margin-top: 8px; min-height: 16px; }

.filed { display: grid; gap: 1px; background: var(--border); border: 1px solid var(--border);
         border-radius: 10px; overflow: hidden; margin-top: 12px; }
.filed div { background: var(--surface); padding: 8px 12px; font-size: var(--fs-secondary); }

.rows { display: grid; gap: 1px; background: var(--border); border: 1px solid var(--border);
        border-radius: 10px; overflow: hidden; }
.row { background: var(--surface); padding: 11px 13px; display: flex; gap: 12px; align-items: flex-start; }
.row .tickbox { flex: 0 0 auto; margin-top: 2px; }
.row .what { flex: 1 1 auto; min-width: 0; }
.row .what b { font-size: var(--fs-secondary); }
.row .what .v { font-size: var(--fs-secondary); font-weight: 500; margin-left: 6px; }
.row .what .src { display: block; font-size: var(--fs-secondary); color: var(--muted); margin-top: 4px;
                  line-height: 1.55; font-style: italic; }
.row .what .pg { font-style: normal; font-weight: 500; }
.row.was { background: var(--surface-2); }
.warn { font-size: var(--fs-secondary); color: var(--warn-ink); margin-top: 3px; }

.pty { display: grid; gap: 1px; background: var(--border); border: 1px solid var(--border);
       border-radius: 10px; overflow: hidden; }
.pty .p { background: var(--surface); padding: 11px 13px; }
.pty .p .lab { font-size: var(--fs-label); color: var(--muted); text-transform: uppercase;
               letter-spacing: .05em; font-weight: 500; }
.pty .p .nm { font-size: var(--fs-body); margin-top: 3px; }
.pty .p .nm.none { color: var(--muted); font-style: italic; font-size: var(--fs-secondary); }
.pty .p .src { font-size: var(--fs-secondary); color: var(--muted); margin-top: 4px; font-style: italic; line-height: 1.5; }
.pty .p .alt { font-size: var(--fs-secondary); color: var(--warn-ink); margin-top: 4px; }

.go { margin-top: 16px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.btn.big { font-size: var(--fs-body); padding: 10px 20px; }
.empty { padding: 18px 4px; color: var(--muted); font-size: var(--fs-secondary); line-height: 1.6; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>The contract</h1><div class="sub">load it once, and it answers the rest</div></div>
  <div class="spacer"></div>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  <a class="btn" href="/home">All projects</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  ${ADMIN_BAR}
  ${STEPS_BAR('contract')}

  <div id="msg" class="msg" hidden></div>

  <div class="card">
    <h2>Load the contract</h2>
    <div class="sub">The agreement and its conditions — the Particular Conditions too, if they are a
      separate file. It is filed in the Contract section and stays there for the life of the job.</div>
    <div class="drop" id="drop">
      <b>Drop the contract here</b>
      PDF, Word or a folder of them
      <div class="or"><button class="btn" id="pick">Choose files</button></div>
      <input type="file" id="file" multiple hidden>
    </div>
    <div class="prog" id="prog"></div>
    <div class="filed" id="filed" hidden></div>
  </div>

  <div class="card" id="readCard" hidden>
    <h2>Who the contract says the parties are</h2>
    <div class="sub">Read off the preamble. You confirm them on the next step — nothing is saved from
      this screen.</div>
    <div class="pty" id="pty"></div>
  </div>

  <div class="card" id="termsCard" hidden>
    <h2>The commercial terms</h2>
    <div class="sub">Each one with the page it is on and the sentence it came from. Tick what is
      right and apply it; anything left unticked changes nothing.</div>
    <div class="rows" id="rows"></div>
    <div class="go">
      <button class="btn prim" id="apply">Apply what is ticked</button>
      <span class="sub" style="margin:0" id="applied"></span>
    </div>
  </div>

  <div class="card" id="noneCard" hidden>
    <div class="empty" id="why"></div>
  </div>

  <div class="go">
    <button class="btn prim big" id="next">Confirm the parties &rarr;</button>
    <a class="btn" id="skip" href="#">Skip — no contract yet</a>
  </div>
</div>

<script>
var READ = null, BUSY = false;

function el(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function say(t, ok){ var m=el('msg'); m.hidden=false; m.textContent=t; m.className='msg '+(ok?'ok':'err'); }
function clearSay(){ el('msg').hidden = true; }
// The address is the source of truth and it is there before any script runs.
// Reading window.PROJECT_ID alone made every tab depend on the order two script
// tags happened to run in, which is how they all came up "no such project".
function pid(){ return new URLSearchParams(location.search).get('p') || window.PROJECT_ID || ''; }

function goNext(){ location.href = '/parties?p=' + encodeURIComponent(pid()); }
el('next').addEventListener('click', goNext);
el('skip').addEventListener('click', function(e){ e.preventDefault(); goNext(); });

/* ------------------------------------------------------------------ the drop */

el('pick').addEventListener('click', function(){ el('file').click(); });
el('file').addEventListener('change', function(){ send(this.files); this.value = ''; });

var drop = el('drop');
['dragenter','dragover'].forEach(function(n){
  drop.addEventListener(n, function(e){ e.preventDefault(); drop.classList.add('over'); }); });
['dragleave','drop'].forEach(function(n){
  drop.addEventListener(n, function(e){ e.preventDefault(); drop.classList.remove('over'); }); });
drop.addEventListener('drop', function(e){ e.preventDefault(); filesFromDrop(e.dataTransfer).then(send); });

// A DROPPED FOLDER CARRIES NO FILES.
//
// dataTransfer.files is empty for a folder — the entries are only reachable
// through webkitGetAsEntry, and without this a folder drop did nothing at all
// and said nothing about why.
async function filesFromDrop(dt){
  var items = dt && dt.items ? Array.prototype.slice.call(dt.items) : [];
  var entries = [];
  for (var i = 0; i < items.length; i++) {
    var e = items[i].webkitGetAsEntry && items[i].webkitGetAsEntry();
    if (e) entries.push(e);
  }
  if (!entries.length) return Array.prototype.slice.call((dt && dt.files) || []);
  var out = [];
  async function walk(entry){
    if (entry.isFile) {
      await new Promise(function(res){ entry.file(function(f){ out.push(f); res(); }, res); });
      return;
    }
    if (!entry.isDirectory) return;
    var rd = entry.createReader();
    while (true) {
      var batch = await new Promise(function(res){ rd.readEntries(res, function(){ res([]); }); });
      if (!batch.length) break;
      for (var j = 0; j < batch.length; j++) await walk(batch[j]);
    }
  }
  for (var k = 0; k < entries.length; k++) await walk(entries[k]);
  return out;
}

function readAsB64(f){
  return new Promise(function(res, rej){
    var r = new FileReader();
    r.onload = function(){ var s = String(r.result || ''); res(s.slice(s.indexOf(',') + 1)); };
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

async function send(files){
  var list = Array.prototype.slice.call(files || []).filter(Boolean);
  if (!list.length) { say('Nothing readable came with that drop.', false); return; }
  if (BUSY) { say('Still loading the last one — wait for it to finish.', false); return; }
  BUSY = true; clearSay();
  var note = function(t){ el('prog').textContent = t; };
  try {
    note('Opening a batch…');
    var r = await fetch('/api/intake/batch', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: pid(), section: 'lib.contract' }) });
    var b = await r.json();
    if (!b.ok) { say(b.error || 'Could not start the upload.', false); BUSY = false; note(''); return; }

    var ids = [], failed = 0;
    for (var i = 0; i < list.length; i++) {
      note('Reading ' + (i + 1) + ' of ' + list.length + ': ' + list[i].name);
      var data;
      try { data = await readAsB64(list[i]); } catch (e) { failed++; continue; }
      var sr = await fetch('/api/intake/scan', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: pid(), batch_id: b.id, filename: list[i].name,
                               mime: list[i].type, data: data }) });
      var sd = await sr.json();
      if (sd && sd.id) ids.push(sd.id); else failed++;
    }
    if (!ids.length) { say('Nothing could be read from those files.', false); BUSY = false; note(''); return; }

    note('Filing ' + ids.length + ' into the Contract section…');
    await fetch('/api/intake/commit', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch_id: b.id, ids: ids }) });
    say(ids.length + ' filed' + (failed ? ', ' + failed + ' could not be read' : '') + '. Reading it…', true);
    note('');
    await load();
  } catch (e) { say('Could not reach the server.', false); note(''); }
  BUSY = false;
}

/* ------------------------------------------------------------- what it found */

var PARTY_LABEL = { developer: 'Developer / Employer', consultant: 'Consultant / Engineer',
                    contractor: 'Main Contractor' };

function paintParties(parties){
  var order = ['developer','consultant','contractor'];
  el('pty').innerHTML = order.map(function(k){
    var p = (parties || {})[k] || {};
    var name = p.found
      ? '<div class="nm">' + esc(p.name) + '</div>'
      : '<div class="nm none">not found in the contract — you can type it on the next step</div>';
    var src = p.found && p.sentence
      ? '<div class="src">' + (p.page ? 'page ' + p.page + ' · ' : '')
        + esc(p.sentence) + '</div>' : '';
    // TWO NAMES FOR ONE PARTY IS THE CASE THAT MATTERS. A contract that calls
    // the Employer two different things is a contract somebody has to look at,
    // so both are shown rather than the first one winning quietly.
    var alt = (p.alternatives && p.alternatives.length)
      ? '<div class="alt">also named as: ' + p.alternatives.map(esc).join(' · ') + '</div>' : '';
    return '<div class="p"><div class="lab">' + esc(PARTY_LABEL[k] || k) + '</div>'
         + name + src + alt + '</div>';
  }).join('');
}

function paintTerms(terms){
  var rows = terms || [];
  if (!rows.length) { el('termsCard').hidden = true; return; }
  el('termsCard').hidden = false;
  el('rows').innerHTML = rows.map(function(t, i){
    if (t.state === 'not_found') {
      return '<div class="row was"><span></span><div class="what"><b>' + esc(t.label || t.key) + '</b>'
        + '<span class="sub"> — ' + esc(t.note || 'not found in the contract') + '</span></div></div>';
    }
    var same = t.current != null && String(t.current) === String(t.value);
    var unit = t.unit ? ' ' + t.unit : '';
    var conflict = t.state === 'conflict';
    var shown = conflict
      ? '<select class="pick" data-pick="' + i + '"><option value="">choose…</option>'
        + (t.options || []).map(function(o){ return '<option value="' + esc(String(o.value)) + '">' + esc(String(o.value)) + esc(unit)
            + (o.clause ? ' — ' + esc(o.clause) : '') + (o.page ? ', page ' + o.page : '') + '</option>'; }).join('') + '</select>'
      : '<span class="v">' + esc(String(t.value)) + esc(unit) + '</span>';
    var cur = (t.current != null && !same)
      ? '<div class="warn">the project currently says ' + esc(String(t.current)) + esc(unit) + '</div>' : '';
    return '<label class="row' + (same ? ' was' : '') + '">'
      // Never ticked by default: the tick is the act of having read the clause.
      + '<input class="tickbox" type="checkbox" data-i="' + i + '">'
      + '<div class="what"><b>' + esc(t.label || t.key) + '</b>'
      + shown
      + (conflict ? '<div class="warn">the contract states this more than once — choose which applies</div>' : '')
      + (t.note && !conflict ? '<div class="warn">' + esc(t.note) + '</div>' : '')
      + (same ? ' <span class="sub">— already saved</span>' : '')
      + cur
      + (t.sentence ? '<span class="src">'
          + (t.clause ? '<span class="pg">' + esc(t.clause) + '</span> · ' : '')
          + (t.page ? '<span class="pg">page ' + t.page + '</span> · ' : '')
          + esc(t.sentence) + '</span>' : '')
      + '</div></label>';
  }).join('');
}

el('apply').addEventListener('click', async function(){
  if (!READ || !READ.terms) return;
  var boxes = el('rows').querySelectorAll('input[type=checkbox]');
  var terms = [];
  for (var i = 0; i < boxes.length; i++) {
    var t = READ.terms[Number(boxes[i].getAttribute('data-i'))];
    if (!t) continue;
    var pick = el('rows').querySelector('select[data-pick="' + boxes[i].getAttribute('data-i') + '"]');
    var value = pick ? (pick.value === '' ? null : pick.value) : t.value;
    terms.push(Object.assign({}, t, { value: value, accepted: boxes[i].checked && value != null }));
  }
  // The terms with nothing to tick (not found) are sent too, so the record of
  // what the contract did not say is kept beside what it did.
  (READ.terms || []).forEach(function(t){ if (t.state === 'not_found') terms.push(Object.assign({}, t, { accepted: false })); });
  this.disabled = true; this.textContent = 'Applying…';
  try {
    var r = await fetch('/api/intake/terms', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: pid(), terms: terms }) });
    var d = await r.json();
    if (d.error && !(d.applied || []).length) say(d.error, false);
    else {
      say((d.applied || []).length + ' applied'
          + ((d.refused || []).length ? ', ' + d.refused.length + ' could not be saved' : '') + '.', true);
      await load();
    }
  } catch (e) { say('Could not reach the server.', false); }
  this.disabled = false; this.textContent = 'Apply what is ticked';
});

/* -------------------------------------------------------------------- loading */

async function load(){
  try {
    var r = await fetch('/api/terms/read?project=' + encodeURIComponent(pid()), { cache: 'no-store' });
    var d = await r.json();
    if (!r.ok) { say(d.error || 'Could not read that project.', false); return; }
    READ = d;

    if (d.documents && d.documents.length) {
      el('filed').hidden = false;
      el('filed').innerHTML = d.documents.map(function(n){ return '<div>' + esc(n) + '</div>'; }).join('');
    }

    if (!d.read) {
      // TWO DIFFERENT NOTHINGS. "No contract filed yet" and "the contract is a
      // scan and carries no words" need different actions, so they are never
      // shown as the same empty list.
      el('readCard').hidden = true;
      el('termsCard').hidden = true;
      el('noneCard').hidden = false;
      el('why').textContent = d.why || 'Nothing has been read from the contract yet.';
      return;
    }
    el('noneCard').hidden = true;
    el('readCard').hidden = false;
    paintParties(d.parties);
    paintTerms(d.terms);
    if (!(d.terms || []).length) {
      el('termsCard').hidden = true;
      el('noneCard').hidden = false;
      el('why').textContent = 'The contract was read, but none of the seven commercial figures could '
        + 'be found in it. They can be typed in on the Setup screen later.';
    }
  } catch (e) { say('Could not reach the server.', false); }
}

load();
${SWITCHER_JS}
${PWA_BOOT}
</script>
${ADMIN_JS('overview')}
</body>
</html>`;
