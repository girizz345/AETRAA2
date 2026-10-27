import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK, SWITCHER_CSS, SWITCHER_JS } from './shared.js';
import { ADMIN_CSS, ADMIN_BAR, ADMIN_JS } from './admin-nav.js';
import { SIGNBOX_JS } from './signboxes.js';
import { DOC_TYPES } from '../templates-store.js';

// DOCUMENT CONTROL — the filing cabinet, and the four things you do to it.
//
// THE PROBLEM THIS REPLACES, in the operator's own words: "the project intake
// folder arrangement and navigation have no logic at all", "if some drawings
// landed in the wrong place how will this be moved", "if I want to add more to
// one section how will I add", "there should be an extractor on each section".
//
// He is right, and the reason was a design mistake, not a missing feature. The
// review screen grouped a drop by the ENGINE'S CONFIDENCE — ready, unverified,
// needs a decision, held. That is the right view for the five minutes after a
// drop and the wrong one forever after, because it answers a question about the
// software instead of a question about the job. Once the batch was committed
// there was no view of the filing cabinet at all: the documents existed, and
// nothing on the platform would show you them by section.
//
// So: the sections ARE the navigation, on the left, with a count each. Pick one
// and you see what is in it. And every section carries the same three actions,
// because a document controller needs exactly these and nothing else:
//
//   ADD      drop files on the section. They file INTO it — the section is the
//            answer to "what are these", which no extractor can be sure of, and
//            the extractor still reads the number, revision and title off each
//            sheet, which is the part it is good at.
//
//   MOVE     tick what landed wrong, choose the right section, done. No
//            re-upload. This is the action whose absence made a bad drop
//            unrecoverable except by clearing the project.
//
//   OPEN     the register, the library, the BOQ — wherever that section's work
//            actually happens. This page never duplicates those screens.
//
// Unsorted is a section, deliberately and visibly. A sheet whose stage nothing
// stated used to be filed as a shop drawing, which is a wrong answer the
// register then repeats to everyone downstream. Here it sits in Unsorted,
// counted, waiting for one click.

export const filesHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Document control · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}${ADMIN_CSS}
.wrap { max-width: 1180px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
        padding: 14px 16px; margin-bottom: 12px; }

.split { display: flex; gap: 12px; align-items: flex-start; }
.nav { flex: 0 0 258px; position: sticky; top: 12px; }
.main { flex: 1 1 auto; min-width: 0; }
@media (max-width: 860px) { .split { display: block; } .nav { position: static; } }

/* ---- the cabinet ---- */
.gname { font-size: var(--fs-label); font-weight: 500; letter-spacing: .07em; text-transform: uppercase;
         color: var(--muted); margin: 13px 0 5px 3px; }
.gname:first-child { margin-top: 0; }
.sec { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left;
       padding: 7px 10px; border-radius: 8px; border: 1px solid transparent;
       background: none; color: var(--ink); font: inherit; font-size: var(--fs-secondary); cursor: pointer; }
.sec:hover { background: var(--surface-2); }
.sec.on { background: var(--surface-2); border-color: var(--border); font-weight: 500; }
.sec .lab { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sec .n { font-variant-numeric: tabular-nums; font-size: var(--fs-secondary); color: var(--muted); }
.sec.on .n, .sec .n.has { color: var(--ink); font-weight: 500; }
.sec .n.warn { background: color-mix(in srgb, var(--warn-ink) 16%, transparent); color: var(--warn-ink); border-radius: 9px; padding: 1px 7px; font-weight: 500; }

/* ---- the contents ---- */
.hd { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; margin-bottom: 3px; }
.hd h2 { margin: 0; font-size: var(--fs-body); }
.hd .n { color: var(--muted); font-size: var(--fs-secondary); }
.note { font-size: var(--fs-secondary); color: var(--muted); margin: 4px 0 12px; line-height: 1.55; }

.bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
       padding: 9px 0 11px; border-bottom: 1px solid var(--border); margin-bottom: 2px; }
.bar .grow { flex: 1 1 auto; }
select.sel { max-width: 230px; }

.it { display: flex; gap: 10px; align-items: flex-start; padding: 9px 4px;
      border-bottom: 1px solid var(--border); font-size: var(--fs-secondary); }
.it:last-child { border-bottom: 0; }
.it input { margin-top: 3px; flex: 0 0 auto; }
.it .who { flex: 1 1 auto; min-width: 0; }
.it .who b { font-weight: 500; }
.it .who small { display: block; color: var(--muted); font-size: var(--fs-secondary); margin-top: 2px;
                 overflow: hidden; text-overflow: ellipsis; }
.it .meta { flex: 0 0 auto; font-size: var(--fs-secondary); color: var(--muted); text-align: right; }
.tag { font-size: var(--fs-secondary); padding: 1px 6px; border-radius: 5px; background: var(--surface-2);
       border: 1px solid var(--border); color: var(--ink-2); margin-left: 6px; }
.empty { padding: 26px 4px; color: var(--muted); font-size: var(--fs-secondary); }

/* ---- the drop target ---- */
.drop { margin-top: 12px; border: 1.5px dashed var(--border); border-radius: 11px;
        padding: 16px; text-align: center; font-size: var(--fs-secondary); color: var(--muted); }
.drop.hot { border-color: color-mix(in srgb, var(--good-ink) 45%, transparent); color: var(--ink); background: var(--surface-2); }
.drop b { color: var(--ink); }
.prog { font-size: var(--fs-secondary); color: var(--muted); margin-top: 7px; }

.board { display: grid; gap: 9px; grid-template-columns: repeat(auto-fill, minmax(226px, 1fr)); }
.bgrp { font-size: var(--fs-label); font-weight: 500; letter-spacing: .07em; text-transform: uppercase;
        color: var(--muted); margin: 16px 0 7px 2px; }
.bgrp:first-child { margin-top: 2px; }
.tile { border: 1.5px dashed var(--border); border-radius: 11px; padding: 12px 13px;
        background: var(--surface); cursor: pointer; text-align: left; width: 100%;
        color: inherit; font: inherit; display: block; }
.tile:hover { border-color: var(--ink-2); }
.tile.hot { border-color: color-mix(in srgb, var(--good-ink) 45%, transparent); border-style: solid; background: var(--surface-2); }
.tile.hot .lab { color: var(--good-ink); }
.tile .lab { font-size: var(--fs-secondary); font-weight: 500; display: block; }
.tile .n { font-size: var(--fs-secondary); color: var(--muted); margin-top: 3px; display: block;
           font-variant-numeric: tabular-nums; }
.tile .n.warn { color: var(--warn-ink); font-weight: 500; }
.tile.figures.full { border-style: solid; }
.tile .rd { font-size: var(--fs-secondary); color: var(--muted); margin-top: 5px; display: block; line-height: 1.4; }
.reads { font-size: var(--fs-secondary); color: var(--ink-2); line-height: 1.55; padding: 9px 11px; border-radius: 9px;
         background: var(--surface-2); border: 1px solid var(--border); margin: 12px 0 0; }
.reads b { color: var(--ink); }
.xer table { width: 100%; border-collapse: collapse; font-size: var(--fs-secondary); margin-top: 8px; }
.xer th, .xer td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border); }
.xer th { font-size: var(--fs-secondary); color: var(--muted); font-weight: 500; }
.xer select { width: auto; padding: 5px 8px; font-size: var(--fs-secondary); }
.tplpick { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 12px; font-size: var(--fs-secondary); }
.tplpick select { width: auto; padding: 6px 8px; font-size: var(--fs-secondary); }
.res { margin-top: 8px; font-size: var(--fs-secondary); line-height: 1.6; }
.res .bad { color: var(--bad-ink); }
.tile.busy { border-color: color-mix(in srgb, var(--warn-ink) 45%, transparent); border-style: solid; }
.fig { display: flex; gap: 22px; flex-wrap: wrap; padding: 6px 0 2px; }
.fig div { font-size: var(--fs-secondary); }
.fig b { display: block; font-size: var(--fs-title); font-variant-numeric: tabular-nums; }
.trm { display: flex; gap: 10px; align-items: flex-start; padding: 8px 4px;
        border-bottom: 1px solid var(--border); font-size: var(--fs-secondary); }
.trm:last-child { border-bottom: 0; }
.trm .val { font-weight: 500; font-variant-numeric: tabular-nums; flex: 0 0 auto; }
.trm .why { flex: 1 1 auto; min-width: 0; }
.trm .why small { display: block; color: var(--muted); font-size: var(--fs-secondary); margin-top: 2px; }
.muted { color: var(--muted); }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Document control</h1><div class="sub">every section, what is in it, and where it goes</div></div>
  <div class="spacer"></div>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  <a class="btn" href="/home">All projects</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  ${ADMIN_BAR}

  <div id="msg" class="msg" hidden></div>

  <div class="split">
    <div class="nav card" id="nav"></div>

    <div class="main">

    <!-- THE BOARD: every section at once, every one of them a drop target.
         Opening one section at a time made a drop into it a four-step act —
         find the section, click it, wait for it to load, then drop. A folder
         of two hundred documents is not sorted four steps at a time. Here the
         whole cabinet is open and a file goes straight to the drawer it
         belongs in. -->
    <div class="card" id="boardCard">
      <div class="hd"><h2>All sections</h2>
        <div class="n">drag documents straight onto the section they belong in</div></div>
      <div class="note">Drag <b>files or a whole folder</b> onto a section. They are filed
        <b>into that section</b> — the section is the
        answer to “what are these”, which no extractor can be sure of. Each sheet still has its
        number, revision and title read off its title block.</div>
      <div id="board"></div>
      <div class="prog" id="boardProg"></div>
    </div>

    <div class="card" id="secCard" hidden>
      <div class="hd"><h2 id="secName">—</h2><div class="n" id="secN"></div>
        <span style="flex:1 1 auto"></span>
        <button class="btn" id="backBoard">← All sections</button></div>
      <div class="note" id="secNote"></div>

      <div class="bar" id="bar" hidden>
        <label style="font-size:var(--fs-secondary)"><input type="checkbox" id="all"> Select all</label>
        <span class="grow"></span>
        <span style="font-size:var(--fs-secondary)" class="muted">Move selected to</span>
        <select id="to" class="proj sel"></select>
        <button class="btn" id="moveGo" disabled>Move</button>
      </div>

      <div id="list"></div>

      <!-- THE CONTRACT SECTION CARRIES THE TERMS.
           They used to be readable only in the ninety seconds after a drop, off
           the batch. Once committed, the panel was gone — and if the contract
           had been mis-classified on the way in, it never appeared at all. Here
           it sits on the section the contract lives in, for the life of the job. -->
      <div id="terms" hidden style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
        <button class="btn" id="termsGo">Read the contract terms</button>
        <div class="prog" id="termsWhy"></div>
        <div id="termsList" style="margin-top:10px"></div>
      </div>

      <!-- WHAT THIS SECTION'S EXTRACTOR READS. Every section has one; this says
           which, so a drop is never a guess about whether a file will be read or
           merely stored. -->
      <div class="reads" id="reads" hidden></div>

      <!-- Templates only: which document a dropped form is the template for,
           when its file name does not say. -->
      <div class="tplpick" id="tplPick" hidden>
        <span>These are templates for</span>
        <select id="tplType">
          <option value="">— work it out from each file's name —</option>
          ${Object.entries(DOC_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
        </select>
      </div>

      <!-- Programme only: the .xer is read here, its WBS branches assigned to
           disciplines here, and loaded from here. It used to send the admin to
           Project intake, or to Setup, to do exactly this. -->
      <div class="xer" id="xer" hidden></div>

      <div class="drop" id="drop" hidden>
        <b>Drop files here</b> to add them to this section —
        <a href="#" id="pick">choose files</a> ·
        <a href="#" id="pickFolder">choose a folder</a>
        <div id="dropWhat" style="margin-top:5px"></div>
        <div class="prog" id="prog"></div>
      </div>
      <input type="file" id="file" multiple hidden>
      <input type="file" id="folder" webkitdirectory directory multiple hidden>
    </div>

    </div>
  </div>
</div>

<script>
var TREE = null, SEC = null, ITEMS = [], BUSY = false;
var FIG = null;          // the figures section open, and what is in it
var DOC_TYPES = ${JSON.stringify(DOC_TYPES)};

function el(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function say(t, ok){ var m=el('msg'); m.hidden=false; m.textContent=t; m.className='msg '+(ok?'ok':'err'); }
function clearSay(){ el('msg').hidden = true; }
// A drop that stopped part-way blocks the next one. Whoever ran it may
// continue it here — the rest is filed exactly as it would have been — or
// abandon it (Ajay, 6 Oct 2026, decision 13). Anyone else is told whose it is.
async function offerContinue(bid, why){
  var g = await (await fetch('/api/intake/batch?id=' + encodeURIComponent(bid), { cache: 'no-store' })).json().catch(function(){ return null; });
  if (!g || g.error) { say(why || 'Another drop is open on this project.', false); return; }
  var left = (g.items || []).filter(function(i){ return i.state === 'proposed' || i.state === 'confirmed'; });
  var filed = (g.items || []).filter(function(i){ return i.state === 'filed'; }).length;
  if (!g.mine) { say('A drop started by ' + (g.started_by || 'someone else') + ' is still open: ' + filed + ' filed, ' + left.length + ' not. They or AETRAA can continue it; then try again.', false); return; }
  if (!left.length) { say('Your earlier drop has nothing left to file. Try again in a moment.', false); return; }
  if (window.confirm('Your drop of ' + (g.items || []).length + ' files stopped part-way: ' + filed + ' filed, ' + left.length + ' not.\\n\\nOK = continue it and file the rest.\\nCancel = leave it (you can abandon it instead).')) {
    var done = 0, held = 0, bad = 0;
    for (var i = 0; i < left.length; i += 25) {
      var cr = await fetch('/api/intake/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: bid, ids: left.slice(i, i + 25).map(function(x){ return x.id; }) }) });
      var cd = await cr.json().catch(function(){ return null; });
      if (!cd || !cd.results) { say('Stopped again at ' + (i + 1) + ' of ' + left.length + ' — the connection dropped. Drop again to continue.', false); return; }
      cd.results.forEach(function(x){ if (x.held) held++; else if (x.ok && x.state === 'filed') done++; else if (!x.ok) bad++; });
    }
    say('Continued: ' + done + ' filed' + (held ? ', ' + held + ' held for AETRAA' : '') + (bad ? ', ' + bad + ' could not be' : '') + '. You can drop your new files now.', !bad);
  } else if (window.confirm('Abandon the earlier drop instead? What it already filed stays filed; the rest is dropped.')) {
    var ar = await (await fetch('/api/intake/abandon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batch_id: bid }) })).json().catch(function(){ return {}; });
    say(ar.error || 'The earlier drop was abandoned. You can drop your new files now.', !ar.error);
  } else { say('Nothing was changed.', true); }
}
function pid(){
  // The address is the source of truth, and it is there before any script
  // runs. Relying on window.PROJECT_ID alone made this screen depend on the
  // order two script tags happened to execute in — which is how every tab
  // came up empty with "no such project".
  return window.PROJECT_ID || new URLSearchParams(location.search).get('p') || '';
}
function money(n){ return n ? 'AED ' + Number(n).toLocaleString('en-AE', { maximumFractionDigits: 2 }) : '—'; }
function kb(n){ if (!n) return ''; return n > 1048576 ? (n/1048576).toFixed(1)+' MB' : Math.round(n/1024)+' KB'; }
function day(s){ return s ? String(s).slice(0,10) : ''; }

/* ------------------------------------------------------------- the cabinet */

function paintNav(){
  var out = '<button class="sec' + (SEC ? '' : ' on') + '" data-all="1">'
          + '<span class="lab">All sections</span></button>';
  (TREE.groups || []).forEach(function(g){
    out += '<div class="gname">' + esc(g.group) + '</div>';
    g.sections.forEach(function(s){
      // An Unsorted section with anything in it is the one thing on this page
      // that is asking for attention, so it is the one thing marked.
      var unsorted = /\\.(other)$/.test(s.id) && s.total > 0;
      out += '<button class="sec' + (SEC === s.id ? ' on' : '') + '" data-id="' + esc(s.id) + '">'
           + '<span class="lab">' + esc(s.label) + '</span>'
           + '<span class="n' + (unsorted ? ' warn' : (s.total ? ' has' : '')) + '">'
           + esc(String(s.total)) + '</span></button>';
    });
  });
  el('nav').innerHTML = out;
  Array.prototype.forEach.call(el('nav').querySelectorAll('.sec'), function(b){
    b.addEventListener('click', function(){
      if (b.getAttribute('data-all')) { showBoard(); return; }
      open(b.getAttribute('data-id'));
    });
  });

  var opts = (TREE.movable || []).map(function(m){
    return '<option value="' + esc(m.id) + '">' + esc(m.group) + ' — ' + esc(m.label) + '</option>'; });
  el('to').innerHTML = opts.join('');
}

/* ------------------------------------------------------- the board of drawers

   Every section, drawn as its own drop target. The one that matters is that a
   file can go straight to the drawer it belongs in: the operator is holding a
   folder of two hundred documents and knows perfectly well which is a contract
   and which is an IFC sheet. Making him open a section first, and then drop,
   turned that knowledge into four clicks a document.

   EVERY TILE TAKES A DROP, including the three that are read into rows rather
   than filed — the priced BOQ, the programme and the templates. They used to
   refuse it and send the admin to the Setup screen to import there instead,
   which is the "jumping back to the admin page" he reported. The importers
   were always there; the page simply never let a drop reach them. */

function paintBoard(){
  var out = '';
  (TREE.groups || []).forEach(function(g){
    out += '<div class="bgrp">' + esc(g.group) + '</div><div class="board">';
    g.sections.forEach(function(s){
      var unsorted = /\.(other)$/.test(s.id) && s.total > 0;
      var figures = s.store === 'figures';
      var count = figures
        ? (s.total ? s.total + (s.key === 'boq' ? ' lines' : s.key === 'programme' ? ' activities' : ' loaded')
                   : 'empty — drop here')
        : (s.total ? s.total + (s.total === 1 ? ' document' : ' documents') : 'empty — drop here');
      // The extractor, in the tooltip on every tile, and in full inside it.
      out += '<button class="tile' + (figures ? ' figures' : '') + (figures && s.total ? ' full' : '')
           + '" data-id="' + esc(s.id) + '" data-drop="1" title="' + esc('Reads: ' + (s.reads || '')) + '">'
           + '<span class="lab">' + esc(s.label) + '</span>'
           + '<span class="n' + (unsorted ? ' warn' : '') + '">' + esc(count) + '</span></button>';
    });
    out += '</div>';
  });
  el('board').innerHTML = out;

  Array.prototype.forEach.call(el('board').querySelectorAll('.tile'), function(t){
    t.addEventListener('click', function(){ open(t.getAttribute('data-id')); });
    if (!t.getAttribute('data-drop')) return;

    // dragenter/dragover fire continuously and on children, so the highlight is
    // set on the tile rather than toggled, or it flickers as the pointer moves.
    ['dragenter', 'dragover'].forEach(function(ev){
      t.addEventListener(ev, function(e){ e.preventDefault(); e.stopPropagation(); t.classList.add('hot'); });
    });
    ['dragleave', 'dragend'].forEach(function(ev){
      t.addEventListener(ev, function(e){ e.preventDefault(); t.classList.remove('hot'); });
    });
    t.addEventListener('drop', async function(e){
      e.preventDefault(); e.stopPropagation();
      t.classList.remove('hot');
      // The DataTransfer is only readable during this event, so the entries are
      // taken now and the walking happens on them.
      var picked = await filesFromDrop(e.dataTransfer);
      if (!picked.length) {
        say('Nothing readable came with that drop. Drag files, or a folder of them.', false);
        return;
      }
      sendTo(t.getAttribute('data-id'), picked, t);
    });
  });
}

// A file dropped anywhere that is NOT a tile would otherwise be opened by the
// browser, replacing the page and losing whatever was in progress.
['dragover', 'drop'].forEach(function(ev){
  window.addEventListener(ev, function(e){ e.preventDefault(); });
});

function showBoard(){
  SEC = null;
  history.replaceState(null, '', '/files?p=' + encodeURIComponent(pid()));
  el('boardCard').hidden = false;
  el('secCard').hidden = true;
  paintNav();
}

function secDef(id){
  var found = null;
  (TREE.groups || []).forEach(function(g){ g.sections.forEach(function(s){ if (s.id === id) found = s; }); });
  return found;
}

/* ------------------------------------------------------------ the contents */

function paintItems(d){
  var s = d.section || {};
  el('secName').textContent = s.label || '—';
  el('secNote').textContent = s.note || '';
  el('secNote').hidden = !s.note;

  // WHAT THIS SECTION'S EXTRACTOR READS, on every section, before anything
  // is dropped — so a drop is never a guess about whether it will be read.
  el('reads').hidden = !s.reads;
  el('reads').innerHTML = '<b>Extractor on this section.</b> Reads: ' + esc(s.reads || '');
  el('tplPick').hidden = s.id !== 'fig.template';
  el('xer').hidden = true;
  el('xer').innerHTML = '';
  FIG = null;

  // A figures section holds imported rows, not files. Saying "1 document" about
  // a BOQ would be true and useless; what a person needs to know is whether the
  // bill is there, how many lines and what it totals.
  //
  // AND IT TAKES A DROP, right here. Every button on this card used to be a
  // link to /setup or /intake — the jump back to the admin page. The drop zone
  // below reads the file in place, with the same extractor Setup uses.
  if (s.store === 'figures') {
    el('bar').hidden = true;
    el('secN').textContent = '';
    var f = d.figures || {};
    FIG = { key: s.key, f: f };
    if (s.key === 'boq') {
      el('secN').textContent = f.lines ? f.lines + ' lines' : 'nothing imported';
      el('list').innerHTML = f.lines
        ? '<div class="fig"><div><b>' + f.lines + '</b>priced lines</div>'
          + '<div><b>' + esc(money(f.total)) + '</b>bill total</div>'
          + (f.source ? '<div><b style="font-size:var(--fs-body);padding-top:6px">' + esc(f.source) + '</b>'
              + 'imported ' + esc(day(f.source_at)) + '</div>' : '') + '</div>'
          + '<div class="note">This is the priced bill every certificate is computed from. '
          + 'Dropping a new workbook below replaces it — you will be asked first.</div>'
        : '<div class="empty">No priced BOQ yet. Until there is one, no payment certificate can be '
          + 'valued. Drop the priced workbook below.</div>';
    } else if (s.key === 'programme') {
      el('secN').textContent = f.activities ? f.activities + ' activities' : 'nothing imported';
      el('list').innerHTML = f.activities
        ? '<div class="fig"><div><b>' + f.activities + '</b>activities</div>'
          + '<div><b style="font-size:var(--fs-body);padding-top:6px">' + esc(day(f.start)) + ' → ' + esc(day(f.finish))
          + '</b>baseline span</div></div>'
          + '<div class="note">Dropping a new .xer below reads it here first — you see what is in it '
          + 'and assign its WBS branches before anything is replaced. '
          + '<a href="/programme" target="_blank" rel="noopener">See the programme</a></div>'
        : '<div class="empty">No programme yet. Drop the baseline Primavera .xer below — it is read '
          + 'here, and you assign its WBS branches to disciplines before it is loaded.</div>';
    } else {
      var t = (f.templates || []);
      el('secN').textContent = t.length + ' of ' + Object.keys(DOC_TYPES).length + ' loaded';
      el('list').innerHTML = t.length
        ? t.map(function(x){ return '<div class="it"><div class="who"><b>' + esc(DOC_TYPES[x.doc_type] || x.doc_type) + '</b>'
            + '<small>' + esc(x.filename || '') + '</small></div>'
            + '<div class="meta">' + esc(day(x.uploaded_at))
            + (/\\.(xlsx|docx)$/i.test(x.filename || '') ? ' <button class="btn" data-signs="' + esc(x.doc_type) + '" data-label="' + esc(DOC_TYPES[x.doc_type] || x.doc_type) + '">Signature boxes</button>' : '')
            + '</div></div>'; }).join('')
        : '<div class="empty">No letter or certificate templates loaded. Until they are, every letter '
          + 'this project issues comes out unbranded. Drop the blank forms below.</div>';
    }
    el('terms').hidden = true;
    el('drop').hidden = false;
    el('file').accept = s.accept || '';
    el('dropWhat').innerHTML = s.key === 'boq'
      ? 'One priced workbook (.xlsx or .csv) with a header row naming Description, Qty and Rate.'
      : s.key === 'programme'
        ? 'One Primavera P6 export (.xer).'
        : 'The blank forms. A file named after its document — “WIR form”, “RFI template” '
          + '— is placed automatically; for anything else, pick the type above first.';
    return;
  }
  el('file').accept = '';

  ITEMS = d.items || [];
  el('secN').textContent = ITEMS.length
    ? ITEMS.length + (ITEMS.length === 1 ? ' document' : ' documents')
    : 'empty';
  el('bar').hidden = !ITEMS.length;
  el('all').checked = false;

  el('list').innerHTML = ITEMS.length ? ITEMS.map(function(it, i){
    return '<div class="it"><input type="checkbox" data-i="' + i + '">'
         + '<div class="who"><b>' + esc(it.name) + '</b>'
         + (it.status && it.status !== 'current' ? '<span class="tag">' + esc(it.status) + '</span>' : '')
         + (it.title ? '<small>' + esc(it.title) + '</small>' : '')
         + (it.detail ? '<small>' + esc(it.detail) + '</small>' : '')
         + '</div>'
         + '<div class="meta">' + esc(kb(it.bytes)) + '<br>' + esc(day(it.at)) + '</div></div>';
  }).join('') : '<div class="empty">Nothing in this section yet. Drop files below to add them.</div>';

  Array.prototype.forEach.call(el('list').querySelectorAll('input[type=checkbox]'), function(b){
    b.addEventListener('change', tick);
  });
  tick();

  // The contract section, and only it, offers the terms read.
  el('terms').hidden = s.id !== 'lib.contract';
  if (!el('terms').hidden) { el('termsWhy').textContent = ''; el('termsList').innerHTML = ''; }

  el('drop').hidden = false;
  el('dropWhat').innerHTML = 'They will be filed as <b>' + esc(s.label) + '</b>'
    + (s.store === 'drawings'
        ? ', and each sheet\\u2019s number, revision and title read off its title block.'
        : '.');
}

function tick(){
  var n = el('list').querySelectorAll('input[type=checkbox]:checked').length;
  el('moveGo').disabled = !n || BUSY;
  el('moveGo').textContent = n ? 'Move ' + n : 'Move';
}

el('all').addEventListener('change', function(){
  var on = this.checked;
  Array.prototype.forEach.call(el('list').querySelectorAll('input[type=checkbox]'), function(b){ b.checked = on; });
  tick();
});

/* ---------------------------------------------------------------- the move */

el('moveGo').addEventListener('click', async function(){
  var picked = [];
  Array.prototype.forEach.call(el('list').querySelectorAll('input[type=checkbox]:checked'), function(b){
    var it = ITEMS[Number(b.getAttribute('data-i'))];
    if (it) picked.push({ store: it.store, id: it.id });
  });
  if (!picked.length) return;
  var to = el('to').value;
  if (to === SEC) { say('That is the section they are already in.', false); return; }

  BUSY = true; this.disabled = true;
  try {
    var r = await fetch('/api/section', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'move', project_id: pid(), items: picked, to: to }) });
    var d = await r.json();
    if (!r.ok || d.error) { say(d.error || 'Nothing was moved.', false); }
    else {
      var bad = (d.results || []).filter(function(x){ return !x.ok; });
      // A refusal is reported in full, because the only refusal that happens is
      // "no drawing number could be read", and the operator has to know WHICH.
      if (bad.length) say(d.moved + ' moved. ' + bad.length + ' refused: ' + bad[0].error, false);
      else say(d.moved + (d.moved === 1 ? ' document moved.' : ' documents moved.'), true);
      await refresh();
    }
  } catch (e) { say('Could not reach the server.', false); }
  BUSY = false; tick();
});

/* ------------------------------------------------- add, straight into here */

var drop = el('drop');
['dragenter','dragover'].forEach(function(e){
  drop.addEventListener(e, function(ev){ ev.preventDefault(); drop.classList.add('hot'); });
});
['dragleave','drop'].forEach(function(e){
  drop.addEventListener(e, function(ev){ ev.preventDefault(); drop.classList.remove('hot'); });
});
drop.addEventListener('drop', async function(ev){
  var picked = await filesFromDrop(ev.dataTransfer);
  if (!picked.length) { say('Nothing readable came with that drop. Drag files, or a folder of them.', false); return; }
  send(picked);
});
el('pick').addEventListener('click', function(ev){ ev.preventDefault(); el('file').click(); });
el('file').addEventListener('change', function(){ send(this.files); this.value = ''; });
var _folder = el('folder');
if (_folder) _folder.addEventListener('change', function(){ send(this.files); this.value = ''; });

/* A DROPPED FOLDER IS THE NORMAL CASE, and it used to do nothing at all.
 *
 * dataTransfer.files holds loose files only. Drop a folder and it is EMPTY —
 * the browser puts the folder in dataTransfer.items instead, behind
 * webkitGetAsEntry(). So dragging "05 - IFC Drawings" onto a section looked
 * like the screen had stopped working, because from the page's point of view
 * nothing had been dropped.
 *
 * Walking the entries also recovers each file's path inside the folder, which
 * is what the extractor reads the stage from when a sheet carries no stamp.
 */
async function filesFromDrop(dt){
  var items = dt && dt.items ? Array.prototype.slice.call(dt.items) : [];
  var entries = [];
  for (var i = 0; i < items.length; i++) {
    var e = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
    if (e) entries.push(e);
  }
  // No entry API, or nothing behind it: whatever loose files came with the drop.
  if (!entries.length) return Array.prototype.slice.call((dt && dt.files) || []);

  var out = [];
  async function walk(entry, path){
    if (out.length >= 800) return;                 // a sane ceiling on one drop
    if (entry.isFile) {
      var f = await new Promise(function(res){ entry.file(res, function(){ res(null); }); });
      if (f) { try { f.dropPath = path + f.name; } catch (e) {} out.push({ file: f, path: path + f.name }); }
      return;
    }
    if (!entry.isDirectory) return;
    var reader = entry.createReader();
    // readEntries returns at most 100 at a time; keep asking until it is empty.
    for (;;) {
      var batch = await new Promise(function(res){ reader.readEntries(res, function(){ res([]); }); });
      if (!batch.length) break;
      for (var j = 0; j < batch.length; j++) await walk(batch[j], path + entry.name + '/');
    }
  }
  for (var k = 0; k < entries.length; k++) {
    await (entries[k].isFile ? walk(entries[k], '') : walk(entries[k], ''));
  }
  return out;
}

function readAsB64(f){
  return new Promise(function(res, rej){
    var fr = new FileReader();
    fr.onload = function(){ var s = String(fr.result || ''); res(s.slice(s.indexOf(',') + 1)); };
    fr.onerror = function(){ rej(new Error('unreadable')); };
    fr.readAsDataURL(f);
  });
}

async function send(files){ return sendTo(SEC, files, null); }

/* ONE UPLOAD PATH, whether the file was dropped on a tile or inside an open
   section. Two paths would have drifted: the section one would gain a fix the
   board one never got. */
async function sendTo(sectionId, files, tile){
  // Either loose File objects or {file, path} pairs from a walked folder.
  var list = Array.prototype.slice.call(files || []).map(function(x){
    return x && x.file ? x : { file: x, path: (x && x.webkitRelativePath) || '' };
  }).filter(function(x){ return x.file; });

  if (!list.length) { say('Nothing readable came with that drop.', false); return; }
  // A drop arriving while one is still going used to be dropped on the floor
  // with no message, which reads as the screen having stopped working.
  if (BUSY) { say('Still uploading the last lot — wait for it to finish, then drop again.', false); return; }
  var def = secDef(sectionId);
  if (!def) return;

  /* THE THREE SECTIONS READ INTO ROWS take a drop now, like every other.
   *
   * They used to answer "Open it to import a file into it", and opening it
   * offered only a link to the Setup screen. Each is read here instead, with
   * the same extractor Setup uses. */
  if (def.store === 'figures') {
    if (def.key === 'programme') {
      // Read first, loaded only after the WBS branches have been assigned.
      var xer = list.filter(function(x){ return /\.xer$/i.test(x.file.name); })[0];
      if (!xer) { say('The programme reads a Primavera P6 export — a .xer file. That was not one.', false); return; }
      if (SEC !== sectionId) await open(sectionId);
      return readXer(xer.file);
    }
    if (def.key === 'boq') {
      var wb = list.filter(function(x){ return /\.(xlsx|xls|csv)$/i.test(x.file.name); });
      if (!wb.length) { say('The priced BOQ reads a workbook — .xlsx or .csv. That was not one.', false); return; }
      // ONE BILL. Two workbooks dropped at once would each replace the other,
      // and the one that survived would be whichever finished last.
      if (wb.length > 1) { say('Drop one priced BOQ at a time — each one replaces the whole bill.', false); return; }
      list = wb;
      // REPLACING THE BILL IS NOT A DROP, IT IS A DECISION. Every line and its
      // billed percentage goes, and every payment certificate is computed from
      // what replaces it. A wrong file dropped on the wrong tile must not do
      // that without being asked.
      var have = def.total || 0;
      if (have && !window.confirm('This REPLACES the priced BOQ — all ' + have + ' lines, and the billed '
          + 'percentage on each. Every payment certificate is computed from this bill.\\n\\n'
          + 'Replace it with ' + wb[0].file.name + '?')) { say('Nothing was changed.', true); return; }
    }
  }
  BUSY = true; clearSay();
  if (tile) tile.classList.add('busy');
  var where = tile ? el('boardProg') : el('prog');
  var note = function(t){ if (where) where.textContent = t; };
  note('Opening a batch…');

  try {
    var r = await fetch('/api/intake/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: pid(), section: sectionId }) });
    var b = await r.json();
    if (!b.ok && b.code === 'batch_open' && b.open_batch) { await offerContinue(b.open_batch, b.error); }
    else if (!b.ok) { say(b.error || 'Could not start the upload.', false); }
    else {
      var ids = [], failed = 0;
      for (var i = 0; i < list.length; i++) {
        var f = list[i].file;
        note(def.label + ' — reading ' + (i + 1) + ' of ' + list.length + ': ' + f.name);
        var data;
        try { data = await readAsB64(f); } catch (e) { failed++; continue; }
        var sr = await fetch('/api/intake/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: pid(), batch_id: b.id, filename: f.name,
                                 // The path inside the dropped folder. The extractor reads the
                                 // stage from it when a sheet carries no stamp of its own.
                                 path: list[i].path || f.webkitRelativePath || '',
                                 // Templates only: the type picked above, when the
                                 // file's name does not say which form it is.
                                 template_type: sectionId === 'fig.template' ? (el('tplType').value || null) : null,
                                 mime: f.type, data: data }) });
        var sd = await sr.json();
        if (sd && sd.id) ids.push(sd.id); else failed++;
      }

      if (!ids.length) { say('Nothing could be read from those files.', false); }
      else {
        // Filed without a review step, because the section already answered the
        // only question a review would have asked: what are these.
        note('Filing ' + ids.length + ' into ' + def.label + '…');
        var cr = await fetch('/api/intake/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch_id: b.id, ids: ids }) });
        var cd = await cr.json();
        var res = cd.results || [];
        var filed = res.filter(function(x){ return x.ok && x.state === 'filed'; });
        var held  = res.filter(function(x){ return x.held; }).length;
        var bad   = res.filter(function(x){ return !x.ok; });

        // WHAT THE EXTRACTOR DID, not just how many files went in. "1 filed"
        // said nothing about whether a BOQ had been read into 341 lines or
        // stored as a workbook nobody would ever open. The extractor says where
        // each one went; a refusal says why, in its own words.
        var went = {};
        filed.forEach(function(x){ var w = x.where || 'filed'; went[w] = (went[w] || 0) + 1; });
        var parts = Object.keys(went).map(function(w){ return (went[w] > 1 ? went[w] + ' into ' : 'Into ') + w; });
        var msg = (filed.length ? parts.join('; ') + '.' : 'Nothing was filed.')
          + (held ? ' ' + held + ' held by the gate for checking.' : '')
          + (failed ? ' ' + failed + ' could not be read at all.' : '')
          + (bad.length ? ' ' + bad.length + ' refused \u2014 ' + (bad[0].error || 'no reason given') : '');
        say(msg, filed.length > 0 && !bad.length);
        await refresh();
      }
    }
  } catch (e) { say('Could not reach the server.', false); }

  note('');
  if (tile) tile.classList.remove('busy');
  BUSY = false;
}

/* ------------------------------------------------ the programme, read here

   The same two calls the Setup screen makes — read, then load — but on the
   section the programme lives in, so nobody is sent anywhere to do it.

   READ BEFORE LOAD, because a programme is not filed, it is interpreted. Its
   WBS branches decide which site engineer sees which activities; loaded with
   none assigned, every activity is on nobody's screen. So the file is read,
   what is in it is shown, the branches are assigned, and only then does the
   baseline get replaced — with a question first, if there is one already. */

var XER = null;
var DISC = ['Civil', 'Structural', 'Architecture', 'MEP', 'Finishes', 'Infrastructure', 'Facade', 'Landscape'];

async function readXer(file){
  var box = el('xer');
  box.hidden = false;
  box.innerHTML = '<div class="prog">Reading ' + esc(file.name) + '…</div>';
  BUSY = true;
  try {
    var b64 = await readAsB64(file);
    var r = await fetch('/api/setup/xer/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: pid(), file_b64: b64 }) });
    var d = await r.json();
    if (!d.ok) { box.innerHTML = '<div class="res bad">' + esc(d.error || 'That .xer could not be read.') + '</div>'; BUSY = false; return; }
    XER = { b64: b64, name: file.name, d: d };
    paintXer();
  } catch (e) { box.innerHTML = '<div class="res bad">Could not reach the server.</div>'; }
  BUSY = false;
}

function paintXer(){
  var d = XER.d, c = d.counts || {};
  var rows = (d.branches || []).map(function(b){
    var guess = DISC.filter(function(x){ return x.toLowerCase() === String(b.branch).toLowerCase(); })[0] || '';
    return '<tr><td><b>' + esc(b.branch) + '</b></td><td>' + b.activities + '</td><td>'
      + '<select class="xbr" data-branch="' + esc(b.branch) + '"><option value="">— nobody yet —</option>'
      + DISC.map(function(x){ return '<option' + (x === guess ? ' selected' : '') + '>' + x + '</option>'; }).join('')
      + '</select></td></tr>';
  }).join('');
  el('xer').innerHTML = '<div class="reads" style="margin-top:14px"><b>' + esc(XER.name) + '</b> — '
    + d.total + ' activities, data date ' + esc(d.data_date || '—')
    + ' · site work ' + (c.site || 0) + ' · drawing submissions ' + (c.drawing || 0)
    + ' · material approvals ' + (c.material || 0) + ' · procurement ' + (c.procurement || 0) + '</div>'
    + '<div class="note" style="margin-top:10px">Give each WBS branch its discipline. That is what decides '
    + 'which site engineer sees which activities — a branch with nobody on it is on nobody’s screen.</div>'
    + '<table><tr><th>WBS branch</th><th>Activities</th><th>Discipline</th></tr>' + rows + '</table>'
    + (d.will_derive
        ? '<div class="res" style="color:var(--warn-ink)">' + d.will_derive + ' submission and delivery dates are not in '
          + 'the programme and will be <b>derived</b> backwards from when the work starts. They are labelled '
          + '“derived” everywhere they appear, until your planner accepts them.</div>'
        : '<div class="res">Every deliverable date came from the programme itself — nothing had to be derived.</div>')
    + '<div class="go" style="margin-top:12px;display:flex;gap:10px">'
    + '<button class="btn prim" id="xerGo">Load this programme</button>'
    + '<button class="btn" id="xerNo">Cancel</button></div>';
  el('xerGo').addEventListener('click', loadXer);
  el('xerNo').addEventListener('click', function(){ XER = null; el('xer').hidden = true; el('xer').innerHTML = ''; });
}

async function loadXer(){
  if (!XER) return;
  var map = {}, blank = 0;
  Array.prototype.forEach.call(document.querySelectorAll('#xer .xbr'), function(sel){
    if (sel.value) map[sel.getAttribute('data-branch')] = sel.value; else blank++;
  });
  var have = FIG && FIG.f ? FIG.f.activities : 0;
  var q = (have ? 'This REPLACES the programme on this project — all ' + have + ' activities.\\n\\n' : '')
        + (blank ? blank + ' WBS branch' + (blank === 1 ? ' has' : 'es have') + ' no discipline. Their '
                   + 'activities will not appear on any site engineer’s screen.\\n\\n' : '');
  if (q && !window.confirm(q + 'Load ' + XER.name + '?')) return;
  var btn = el('xerGo'); btn.disabled = true; btn.textContent = 'Loading…';
  BUSY = true;
  try {
    var r = await fetch('/api/setup/xer/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: pid(), file_b64: XER.b64, discipline_by_branch: map, replace: true }) });
    var d = await r.json();
    if (!d.ok) { say(d.error || 'The programme could not be loaded.', false); btn.disabled = false; btn.textContent = 'Load this programme'; BUSY = false; return; }
    say('Programme loaded: ' + d.saved + ' lines — ' + d.from_programme + ' from the programme, '
        + d.derived + ' derived.', true);
    XER = null;
    BUSY = false;
    await refresh();
  } catch (e) { say('Could not reach the server.', false); btn.disabled = false; BUSY = false; }
}

/* -------------------------------------------------- the seven contract terms */
/*
 * NOTHING IS TICKED BY DEFAULT, and that is not a UI preference. Every payment
 * certificate for the life of this job is computed from these seven figures. A
 * wrong one is silent — the certificate still prints, still looks right, and is
 * wrong by the retention on every valuation until somebody re-reads the
 * contract. So the contract proposes and a person accepts, one figure at a time.
 *
 * Where the contract states a figure TWICE, nothing is proposed at all: the
 * options are shown and one has to be chosen. Picking the first would be the
 * software deciding a contractual question it cannot see the context of.
 */
var TERMS = [];

el('termsGo').addEventListener('click', async function(){
  this.disabled = true;
  el('termsWhy').textContent = 'Reading the contract…';
  el('termsList').innerHTML = '';
  try {
    var r = await fetch('/api/terms/read?project=' + encodeURIComponent(pid()), { cache: 'no-store' });
    var d = await r.json();
    if (!d.read) { el('termsWhy').textContent = d.why || 'Nothing could be read from the contract.';
                   this.disabled = false; return; }

    TERMS = d.terms || [];
    el('termsWhy').textContent = 'Read from ' + (d.documents || []).join(', ')
      + '. Nothing is applied until you tick it — every certificate for the life of this job '
      + 'is computed from these figures.';

    el('termsList').innerHTML = TERMS.map(function(t, i){
      var conflict = t.state === 'conflict';
      var found = t.state !== 'not_found';
      var val = conflict
        ? '<select class="proj" data-pick="' + i + '" style="max-width:150px">'
          + '<option value="">choose…</option>'
          + (t.options || []).map(function(o){
              return '<option value="' + esc(String(o.value)) + '">' + esc(String(o.value))
                   + (t.unit ? ' ' + esc(t.unit) : '') + (o.page ? '  (p.' + o.page + ')' : '') + '</option>'; }).join('')
          + '</select>'
        : '<span class="val">' + (found ? esc(String(t.value)) + (t.unit ? ' ' + esc(t.unit) : '') : '—') + '</span>';

      return '<div class="trm">'
           + (found ? '<input type="checkbox" data-t="' + i + '">' : '<span style="width:13px"></span>')
           + val
           + '<div class="why"><b>' + esc(t.label || t.key) + '</b>'
           + (t.state === 'disagrees' ? '<span class="tag">differs from this project</span>' : '')
           + (conflict ? '<span class="tag">stated more than once</span>' : '')
           + (t.sentence ? '<small>' + (t.clause ? esc(t.clause) + ' — ' : '') + '“' + esc(t.sentence) + '”'
               + (t.page ? ' — p.' + t.page : '') + '</small>' : '')
           + (t.note ? '<small>' + esc(t.note) + '</small>' : '')
           + '</div></div>';
    }).join('')
      + '<div style="margin-top:11px"><button class="btn prim" id="termsApply">Apply the ticked figures</button></div>';

    // A conflicted figure has no value until one is chosen, so choosing one is
    // what makes it tickable at all.
    Array.prototype.forEach.call(el('termsList').querySelectorAll('select[data-pick]'), function(sel){
      sel.addEventListener('change', function(){
        var i = Number(sel.getAttribute('data-pick'));
        TERMS[i].value = sel.value === '' ? null : sel.value;
      });
    });

    el('termsApply').addEventListener('click', async function(){
      var picked = [];
      Array.prototype.forEach.call(el('termsList').querySelectorAll('input[type=checkbox]:checked'), function(b){
        var t = TERMS[Number(b.getAttribute('data-t'))];
        if (t && t.value != null && t.value !== '') picked.push(Object.assign({}, t, { accepted: true }));
      });
      // Every proposal is sent, ticked or not, so the refused ones are kept as
      // evidence too (spec §14). Only the ticked ones are applied.
      var sent = TERMS.map(function(t){
        var on = picked.some(function(p){ return p.key === t.key; });
        return Object.assign({}, t, { accepted: on });
      });
      if (!picked.length) {
        fetch('/api/intake/terms', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: pid(), terms: sent }) }).catch(function(){});
        say('Nothing was ticked with a figure behind it, so nothing was changed.', false); return;
      }
      this.disabled = true;
      try {
        var ar = await fetch('/api/intake/terms', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: pid(), terms: sent }) });
        var ad = await ar.json();
        if (ad.error) { say(ad.error, false); }
        else say((ad.applied || []).length + ' of the contract figures are now set on this project.', true);
      } catch (e) { say('Could not reach the server.', false); }
      this.disabled = false;
    });
  } catch (e) { el('termsWhy').textContent = 'Could not reach the server.'; }
  this.disabled = false;
});

/* ------------------------------------------------------------------ wiring */

el('backBoard').addEventListener('click', function(){ showBoard(); });
var _pf = el('pickFolder');
if (_pf) _pf.addEventListener('click', function(ev){ ev.preventDefault(); el('folder').click(); });

async function open(id){
  SEC = id;
  history.replaceState(null, '', '/files?p=' + encodeURIComponent(pid()) + '&s=' + encodeURIComponent(id));
  el('boardCard').hidden = true;
  el('secCard').hidden = false;
  paintNav();
  try {
    var r = await fetch('/api/section?project=' + encodeURIComponent(pid()) + '&id=' + encodeURIComponent(id),
      { cache: 'no-store' });
    var d = await r.json();
    if (!r.ok) { say(d.error || 'Could not read that section.', false); return; }
    paintItems(d);
  } catch (e) { say('Could not reach the server.', false); }
}

async function refresh(){
  var r = await fetch('/api/sections?project=' + encodeURIComponent(pid()), { cache: 'no-store' });
  TREE = await r.json();
  paintNav();
  paintBoard();
  if (SEC) await open(SEC);
}

async function load(){
  clearSay();
  try {
    var r = await fetch('/api/sections?project=' + encodeURIComponent(pid()), { cache: 'no-store' });
    var d = await r.json();
    if (!r.ok) { say(d.error || 'Could not read that project.', false); return; }
    TREE = d;
    paintNav();
    paintBoard();
    // The board is where this screen starts. A section opens only when one was
    // asked for — otherwise the whole cabinet is in front of the operator and
    // every drawer takes a drop.
    var want = new URLSearchParams(location.search).get('s');
    if (want && secDef(want)) await open(want);
    else showBoard();
  } catch (e) { say('Could not reach the server.', false); }
}



load();
${SWITCHER_JS}
${PWA_BOOT}

document.addEventListener('click', function(ev){
  var b = ev.target.closest && ev.target.closest('[data-signs]');
  if (!b) return;
  var pid0 = window.PROJECT_ID || new URLSearchParams(location.search).get('p') || '';
  openSignBoxes(pid0, b.getAttribute('data-signs'), b.getAttribute('data-label') || b.getAttribute('data-signs'));
});
${SIGNBOX_JS}
</script>
${ADMIN_JS('docs')}
</body>
</html>`;
