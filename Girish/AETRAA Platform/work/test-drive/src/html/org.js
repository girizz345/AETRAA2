import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK, SWITCHER_CSS, SWITCHER_JS } from './shared.js';
import { ADMIN_CSS, ADMIN_BAR, ADMIN_JS, STEPS_CSS, STEPS_BAR } from './admin-nav.js';

// THE PROJECT ORGANISATION — the second thing that happens on a project, and
// until now the thing that never happened at all.
//
// A project used to be created with twenty fields of contract detail and then
// filled with documents. Who was on it was a separate screen nobody had to
// visit, and "Nobody is on this project" was one line among eight on the
// readiness check. So a project could be documented, verified and handed over
// without its org chart ever being drawn — and a document has no route until
// you know who receives it.
//
// The order is now: project name and Principal → THIS → documents → verify.
//
// A ROLE HERE CARRIES THREE THINGS, all of them the Principal's to change at
// any time, on a live job:
//
//   DISCIPLINES   checkboxes, several at once. The engineer who covers
//                 Structural and Civil is the normal case on a job this size.
//
//   DASHBOARDS    checkboxes, full or read. This is what makes a role real
//                 rather than a label: give the Supervisor the Site dashboard
//                 and he sees exactly what the Project Engineer sees, which is
//                 usually what an office actually means by the word.
//
//   WORKFLOW      checkboxes, on the same screen — every step in the project
//                 this role signs. Assigning a role is one act in one place,
//                 not three acts in three.
//
// TWO REFUSALS, and they are refusals rather than warnings because both strand
// a project instead of merely misconfiguring it, and after go-live there is
// nobody outside the project who can repair either: a step with no role on it
// stops every record of that kind for good, and the last Principal cannot be
// removed. Both are enforced on the server; the screen just explains them.

export const orgHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Project organisation · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}${ADMIN_CSS}${STEPS_CSS}
.onward { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; justify-content: flex-end;
          margin: 4px 0 20px; }
.onward .muted { font-size: var(--fs-secondary); }
.btn.big { font-size: var(--fs-body); padding: 10px 20px; }
.wrap { max-width: 1180px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
        padding: 14px 16px; margin-bottom: 12px; }
.card h2 { margin: 0 0 3px; font-size: var(--fs-body); }
.card .sub { font-size: var(--fs-secondary); color: var(--muted); margin-bottom: 12px; line-height: 1.55; }

.split { display: flex; gap: 12px; align-items: flex-start; }
.nav { flex: 0 0 272px; position: sticky; top: 12px; }
.main { flex: 1 1 auto; min-width: 0; }
@media (max-width: 900px) { .split { display: block; } .nav { position: static; } }

.gname { font-size: var(--fs-label); font-weight: 500; letter-spacing: .07em; text-transform: uppercase;
         color: var(--muted); margin: 13px 0 5px 3px; }
.gname:first-child { margin-top: 0; }
.rl { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left;
      padding: 7px 10px; border-radius: 8px; border: 1px solid transparent;
      background: none; color: var(--ink); font: inherit; font-size: var(--fs-secondary); cursor: pointer; }
.rl:hover { background: var(--surface-2); }
.rl.on { background: var(--surface-2); border-color: var(--border); font-weight: 500; }
.rl .lab { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rl .n { font-size: var(--fs-secondary); color: var(--muted); font-variant-numeric: tabular-nums; }
.rl .n.none { color: var(--warn-ink); font-weight: 500; }
.rl.retired .lab { text-decoration: line-through; opacity: .55; }

.hd { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
.hd h2 { margin: 0; font-size: var(--fs-headline); }
.hd .tag { font-size: var(--fs-secondary); padding: 1px 7px; border-radius: 5px; background: var(--surface-2);
           border: 1px solid var(--border); color: var(--ink-2); }

.sect { margin-top: 16px; padding-top: 13px; border-top: 1px solid var(--border); }
.sect h3 { margin: 0 0 3px; font-size: var(--fs-secondary); }
.sect .why { font-size: var(--fs-secondary); color: var(--muted); margin-bottom: 9px; line-height: 1.55; }

.chips { display: flex; flex-wrap: wrap; gap: 7px; }
.chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 8px;
        border: 1px solid var(--border); background: var(--surface-2); font-size: var(--fs-secondary); cursor: pointer; }
.chip input { margin: 0; }
.chip.on { border-color: color-mix(in srgb, var(--good-ink) 45%, transparent); }

.dash { display: grid; grid-template-columns: repeat(auto-fill, minmax(268px, 1fr)); gap: 7px; }
.dbox { border: 1px solid var(--border); border-radius: 9px; padding: 8px 10px; background: var(--surface-2); }
.dbox .t { display: flex; align-items: flex-start; gap: 7px; font-size: var(--fs-secondary); }
.dbox .t input { margin-top: 2px; }
.dbox .lv { margin-top: 6px; display: none; gap: 12px; font-size: var(--fs-secondary); color: var(--muted); }
.dbox.on .lv { display: flex; }
.dbox.on { border-color: color-mix(in srgb, var(--good-ink) 45%, transparent); }
.dbox .warn { display: block; color: var(--warn-ink); font-size: var(--fs-secondary); margin-top: 3px; }

.wf { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.wfg { font-size: var(--fs-label); font-weight: 500; letter-spacing: .06em; text-transform: uppercase;
       color: var(--muted); padding: 9px 11px 3px; background: var(--surface-2); }
.wfr { display: flex; gap: 9px; align-items: flex-start; padding: 7px 11px; font-size: var(--fs-secondary);
       border-top: 1px solid var(--border); }
.wfr input { margin-top: 3px; }
.wfr .s { flex: 1 1 auto; min-width: 0; }
.wfr .s small { display: block; color: var(--muted); font-size: var(--fs-secondary); margin-top: 2px; }
.wfr.only { background: var(--surface-2); }
.wfr .pin { font-size: var(--fs-secondary); color: var(--warn-ink); }

.person { display: flex; gap: 10px; align-items: center; padding: 9px 2px; font-size: var(--fs-secondary);
          border-bottom: 1px solid var(--border); }
.person:last-child { border-bottom: 0; }
.person .nm { flex: 1 1 auto; min-width: 0; }
.person .nm small { display: block; color: var(--muted); font-size: var(--fs-secondary); }
.pill { font-size: var(--fs-secondary); padding: 2px 7px; border-radius: 5px; background: var(--surface-2);
        border: 1px solid var(--border); color: var(--ink-2); }
.pill.invited { background: color-mix(in srgb, var(--warn-ink) 16%, transparent); color: var(--warn-ink); border-color: transparent; }
.empty { padding: 20px 2px; color: var(--muted); font-size: var(--fs-secondary); }
.muted { color: var(--muted); }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 12px; }
input.nm { max-width: 280px; }

dialog#pdlg { border: 1px solid var(--border); border-radius: 14px; background: var(--surface);
              color: var(--ink); padding: 20px 22px; max-width: 680px; width: calc(100% - 32px);
              max-height: 88vh; overflow: auto; }
dialog#pdlg::backdrop { background: var(--scrim); }
.ff { margin-bottom: 11px; }
.ff label { display: block; font-size: var(--fs-secondary); color: var(--muted); margin-bottom: 4px; }
.ff input { width: 100%; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
@media (max-width: 540px) { .two { grid-template-columns: 1fr; } }
.sgrp { font-size: var(--fs-label); font-weight: 500; letter-spacing: .06em; text-transform: uppercase;
        color: var(--muted); margin: 12px 0 6px; }
.sgrp:first-child { margin-top: 0; }
.person .btn { flex: 0 0 auto; }
.person .st { font-size: var(--fs-secondary); color: var(--muted); }
.person.off { opacity: .55; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Project organisation</h1><div class="sub">the roles on this job, and what each one carries</div></div>
  <div class="spacer"></div>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  <a class="btn" href="/home">All projects</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  ${ADMIN_BAR}
  ${STEPS_BAR('org')}

  <div id="msg" class="msg" hidden></div>

  <div class="split">
    <div class="nav card">
      <div id="nav"></div>
      <div class="row" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
        <input class="nm" id="newRole" placeholder="Add a role — e.g. Façade Engineer" autocomplete="off">
        <button class="btn" id="addRole">Add</button>
      </div>
      <div class="muted" style="font-size:var(--fs-secondary);margin-top:7px">
        A new role starts with nothing ticked. Give it dashboards before anyone holds it.
      </div>
    </div>

    <div class="main card">
      <div class="hd">
        <h2 id="rname">—</h2>
        <span class="tag" id="rgrp"></span>
        <span class="tag" id="rheld"></span>
      </div>
      <div class="sub" id="rnote"></div>

      <div class="sect" id="secDisc">
        <h3>Disciplines</h3>
        <div class="why">Which disciplines a person in this role may be scoped to. Tick several —
          the engineer who covers Structural and Civil is the normal case, not the exception.</div>
        <div class="chips" id="disc"></div>
      </div>

      <div class="sect">
        <h3>Dashboards</h3>
        <div class="why">What this role opens, and whether it may act there or only read.
          This is what makes a role real: a Supervisor given the Site dashboard sees what a
          Project Engineer sees.</div>
        <div class="dash" id="dash"></div>
      </div>

      <!-- THE STEPS THIS ROLE SIGNS USED TO BE TICKED HERE, one row per step per
           record type — sixty rows asking "which of these is the QA/QC
           engineer's?", a question nobody in an office has. What a document
           controller asks is "what happens to a submittal?", so that is where
           the routes are now set, on the Workflows tab. This just says what
           this role ends up signing, and does not ask you to build it here. -->
      <div class="sect">
        <h3>What this role signs</h3>
        <div class="why">Read from the workflows each document type is on.
          To change a route, set it on <a href="#" id="toWf">Workflows</a> —
          one change there covers every document type using it.</div>
        <div class="wf" id="wf"></div>
      </div>

      <div class="row">
        <button class="btn prim" id="save">Save and next role &rarr;</button>
        <button class="btn" id="retire">Retire</button>
        <button class="btn" id="restore" hidden>Bring back</button>
        <span class="muted" id="saved" style="font-size:var(--fs-secondary)"></span>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>People on this project</h2>
    <div class="sub">Their roles, their disciplines, and the workflows each one is actually on.
      Nobody can sign in until the project is live.</div>
    <div id="people"></div>
    <div style="margin-top:12px">
      <button class="btn prim" id="addPerson">Add somebody</button>
    </div>
  </div>

  <!-- THE WAY ON. Every other setup step ends with a button to the next one;
       this page had none, and saving a role left the admin exactly where he
       was with nothing to say what came next. -->
  <div class="onward">
    <span class="muted" id="onwardWhy"></span>
    <button class="btn prim big" id="onward">Continue to Workflows &rarr;</button>
  </div>

<!-- THE THREE THINGS THAT DECIDE WHAT A PERSON SEES AND DOES, in one place.
     People used to be added on a different screen, from the old coarse role
     list, so the roles and ladders set up on this page reached nobody. -->
<dialog id="pdlg">
  <h3 id="pdTitle" style="margin:0 0 3px;font-size:var(--fs-body)">Add somebody</h3>
  <div class="why" id="pdHint" style="margin-bottom:14px"></div>

  <div class="two">
    <div class="ff"><label>Full name</label><input id="pd_name" autocomplete="off"></div>
    <div class="ff"><label>Email — how they sign in</label><input id="pd_email" autocomplete="off"></div>
  </div>
  <div class="ff"><label>Phone — optional</label><input id="pd_phone" autocomplete="off"></div>

  <div class="sect">
    <h3>Role</h3>
    <div class="why">What their job is. It decides which dashboards they open and which steps they
      may sign. Somebody can hold more than one.</div>
    <div class="chips" id="pd_roles"></div>
  </div>

  <div class="sect" id="pd_discWrap">
    <h3>Disciplines</h3>
    <div class="why">Which disciplines they cover. Leave all clear for the whole project.</div>
    <div class="chips" id="pd_disc"></div>
  </div>

  <div class="sect">
    <h3>Workflows they are on</h3>
    <div class="why">Two engineers can hold the same role and be on different work — one on
      inspections, the other on NCRs and material approvals. This is what divides them.
      <b>Leave everything clear and they get whatever their role covers.</b> It can only narrow
      what the role allows, never widen it.</div>
    <div style="margin:0 0 9px"><a href="#" id="pd_all">Tick all</a> ·
      <a href="#" id="pd_none">Clear all</a></div>
    <div id="pd_streams"></div>
  </div>

  <div class="msg err" id="pd_err" hidden></div>
  <div class="row">
    <button class="btn prim" id="pd_save">Save</button>
    <button class="btn" id="pd_cancel">Cancel</button>
    <span style="flex:1 1 auto"></span>
    <button class="btn" id="pd_suspend" hidden>Withdraw access</button>
  </div>
</dialog>
</div>

<script>
var D = null, ROLE = null, WF = null, DIRTY = false;

function el(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function say(t, ok){ var m=el('msg'); m.hidden=false; m.textContent=t; m.className='msg '+(ok?'ok':'err'); }
function clearSay(){ el('msg').hidden = true; }
function pid(){
  // The address is the source of truth, and it is there before any script
  // runs. Relying on window.PROJECT_ID alone made this screen depend on the
  // order two script tags happened to execute in — which is how every tab
  // came up empty with "no such project".
  return window.PROJECT_ID || new URLSearchParams(location.search).get('p') || '';
}
function role(){ return (D.roles || []).filter(function(r){ return r.id === ROLE; })[0] || null; }

/* ------------------------------------------------------------ the role list */

function paintNav(){
  var out = '';
  (D.groups || []).forEach(function(g){
    var inG = (D.roles || []).filter(function(r){ return r.grp === g; });
    if (!inG.length) return;
    out += '<div class="gname">' + esc(g) + '</div>';
    inG.forEach(function(r){
      var held = ((D.holders || {})[r.id] || []).length;
      out += '<button class="rl' + (ROLE === r.id ? ' on' : '') + (r.retired ? ' retired' : '')
           + '" data-id="' + esc(r.id) + '">'
           + '<span class="lab">' + esc(r.label) + '</span>'
           + '<span class="n' + (held ? '' : ' none') + '">' + (held || '\\u2014') + '</span></button>';
    });
  });
  el('nav').innerHTML = out;
  Array.prototype.forEach.call(el('nav').querySelectorAll('.rl'), function(b){
    b.addEventListener('click', function(){ pick(b.getAttribute('data-id')); });
  });
}

/* ------------------------------------------------------------- one role */

function paintRole(){
  var r = role();
  if (!r) return;
  // Says where the button goes, so it is never a surprise.
  el('save').innerHTML = nextRole(r.id) ? 'Save and next role &rarr;' : 'Save and go to Workflows &rarr;';
  el('rname').textContent = r.label;
  el('rgrp').textContent = r.grp;
  var held = (D.holders || {})[r.id] || [];
  el('rheld').textContent = held.length ? held.join(', ') : 'nobody yet';
  el('rnote').textContent = r.note || '';
  el('rnote').hidden = !r.note;
  el('retire').hidden = !!r.retired;
  el('restore').hidden = !r.retired;
  el('saved').textContent = '';

  // Disciplines only where they mean something. A Finance role scoped to MEP is
  // noise, so the whole section goes rather than showing ticks nobody wants.
  var wants = (D.discipline_roles || []).indexOf(r.id) >= 0 || !r.builtin;
  el('secDisc').hidden = !wants;
  el('disc').innerHTML = (D.disciplines || []).map(function(x){
    var on = (r.disciplines || []).indexOf(x) >= 0;
    return '<label class="chip' + (on ? ' on' : '') + '"><input type="checkbox" data-disc="' + esc(x) + '"'
         + (on ? ' checked' : '') + '>' + esc(x) + '</label>';
  }).join('');

  el('dash').innerHTML = (D.dashboards || []).map(function(d){
    var cur = (r.dash || []).filter(function(e){ return e[0] === d.id; })[0];
    var on = !!cur, lv = cur ? cur[1] : 'full';
    return '<div class="dbox' + (on ? ' on' : '') + '" data-box="' + esc(d.id) + '">'
         + '<label class="t"><input type="checkbox" data-dash="' + esc(d.id) + '"' + (on ? ' checked' : '') + '>'
         + '<span>' + esc(d.label)
         + (d.warn ? '<span class="warn">' + esc(d.warn) + '</span>' : '') + '</span></label>'
         + '<div class="lv">'
         + '<label><input type="radio" name="lv_' + esc(d.id) + '" value="full"'
         + (lv === 'full' ? ' checked' : '') + '> can act</label>'
         + '<label><input type="radio" name="lv_' + esc(d.id) + '" value="read"'
         + (lv === 'read' ? ' checked' : '') + '> read only</label>'
         + '</div></div>';
  }).join('');

  Array.prototype.forEach.call(el('dash').querySelectorAll('input[data-dash]'), function(b){
    b.addEventListener('change', function(){
      el('dash').querySelector('[data-box="' + b.getAttribute('data-dash') + '"]')
        .classList.toggle('on', b.checked);
      DIRTY = true;
    });
  });
  Array.prototype.forEach.call(el('disc').querySelectorAll('input[data-disc]'), function(b){
    b.addEventListener('change', function(){ b.parentNode.classList.toggle('on', b.checked); DIRTY = true; });
  });

  paintWorkflow();
}

/* ------------------------------------------------- the steps this role signs */

function paintWorkflow(){
  if (!WF) { el('wf').innerHTML = '<div class="empty">Loading the ladders\\u2026</div>'; return; }
  var groups = [];
  // Only what this role signs. The full sixty-row list was the confusion.
  (WF.steps || []).filter(function(s){ return s.on; }).forEach(function(s){
    var g = groups.filter(function(x){ return x.g === s.group; })[0];
    if (!g) { g = { g: s.group, rows: [] }; groups.push(g); }
    g.rows.push(s);
  });

  if (!groups.length) {
    el('wf').innerHTML = '<div class="empty">This role signs nothing yet. Put it on a step in a '
      + 'workflow and it will appear here.</div>';
    return;
  }
  el('wf').innerHTML = groups.map(function(g){
    return '<div class="wfg">' + esc(g.g) + '</div>' + g.rows.map(function(s){
      return '<div class="wfr' + (s.alone ? ' only' : '') + '">'
           + '<input type="checkbox" data-wf="' + esc(s.type) + '|' + s.i + '"' + (s.on ? ' checked' : '') + '>'
           + '<div class="s"><b>' + esc(s.label) + '</b>'
           + '<small>Step ' + (s.i + 1) + ' \\u2014 ' + esc(s.st)
           + (s.alone ? '  <span class="pin">only this role</span>' : '') + '</small></div></div>';
    }).join('');
  }).join('');

}

async function loadWorkflow(){
  try {
    var r = await fetch('/api/org-workflow?project=' + encodeURIComponent(pid())
      + '&role=' + encodeURIComponent(ROLE), { cache: 'no-store' });
    WF = await r.json();
    paintWorkflow();
  } catch (e) { el('wf').innerHTML = '<div class="empty">Could not read the ladders.</div>'; }
}

/* ------------------------------------------------------------------ saving */

el('save').addEventListener('click', async function(){
  var r = role(); if (!r) return;
  var dash = [];
  Array.prototype.forEach.call(el('dash').querySelectorAll('input[data-dash]:checked'), function(b){
    var id = b.getAttribute('data-dash');
    var lv = el('dash').querySelector('input[name="lv_' + id + '"]:checked');
    dash.push([id, lv && lv.value === 'read' ? 'read' : 'full']);
  });
  var disc = [];
  Array.prototype.forEach.call(el('disc').querySelectorAll('input[data-disc]:checked'), function(b){
    disc.push(b.getAttribute('data-disc'));
  });

  this.disabled = true;
  try {
    var res = await fetch('/api/org-roles', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', project_id: pid(),
        role: { id: r.id, label: r.label, grp: r.grp, dash: dash, disciplines: disc, note: r.note } }) });
    var d = await res.json();
    if (d.error) say(d.error, false);
    else {
      DIRTY = false; clearSay();
      /* SAVING MOVES YOU ON. It used to save and leave the admin on the same
       * role, with "Saved." in small grey type and nothing to say what came
       * next — so it read as though the button had done nothing. Now the next
       * role in the list opens, in the order the list shows them; the last one
       * goes on to the next step. */
      var next = nextRole(r.id);
      await load(true);
      if (next) {
        pick(next);
        say(r.label + ' saved. Now: ' + roleLabel(next) + '.', true);
      } else {
        say(r.label + ' saved \u2014 that was the last role. Taking you to Workflows.', true);
        setTimeout(goOnward, 700);
      }
    }
  } catch (e) { say('Could not reach the server.', false); }
  this.disabled = false;
});

el('addRole').addEventListener('click', async function(){
  var label = el('newRole').value.trim();
  if (!label) { say('Give the role a name first.', false); return; }
  this.disabled = true;
  try {
    var res = await fetch('/api/org-roles', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', project_id: pid(),
        // A new role opens the Site dashboard read-only — something rather than
        // nothing, so it can be saved at all, and obviously wrong so it gets set.
        role: { label: label, grp: 'Engineering', dash: [['site', 'read']], disciplines: [] } }) });
    var d = await res.json();
    if (d.error) { say(d.error, false); }
    else {
      el('newRole').value = '';
      say('Added. Now tick its dashboards and its workflow steps.', true);
      await load(true);
      pick(d.id);
    }
  } catch (e) { say('Could not reach the server.', false); }
  this.disabled = false;
});

async function roleAction(action){
  var r = role(); if (!r) return;
  try {
    var res = await fetch('/api/org-roles', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action, project_id: pid(), id: r.id }) });
    var d = await res.json();
    if (d.error) say(d.error, false);
    else { clearSay(); await load(true); }
  } catch (e) { say('Could not reach the server.', false); }
}
el('retire').addEventListener('click', function(){ roleAction('retire'); });
el('restore').addEventListener('click', function(){ roleAction('restore'); });

/* ------------------------------------------------------------------ people */

function roleLabel(id){
  var r = (D.roles || []).filter(function(x){ return x.id === id; })[0];
  return r ? r.label : id;
}

function paintPeople(){
  var ppl = D.people || [];
  el('people').innerHTML = ppl.length ? ppl.map(function(u, i){
    // What they are ON, said plainly. "everything their role covers" is the
    // honest answer when nothing is ticked, and it is not the same as "nothing".
    var on = !u.streams || !u.streams.length
      ? 'everything their role covers'
      : u.streams.map(function(t){ return ((D.streams || {})[t] || {}).label || t; }).join(', ');

    return '<div class="person' + (u.status === 'suspended' ? ' off' : '') + '">'
      + '<div class="nm"><b>' + esc(u.name || '—') + '</b>'
      + '<small>' + esc(u.email || 'no email — cannot sign in') + '</small>'
      + '<small>' + (u.functions || []).map(function(f){ return esc(roleLabel(f)); }).join(' · ')
      + (u.disciplines && u.disciplines.length ? ' — ' + esc(u.disciplines.join(', ')) : '')
      + '</small>'
      + '<small><b>On:</b> ' + esc(on) + '</small></div>'
      + '<span class="pill' + (u.status === 'invited' ? ' invited' : '') + '">'
      + esc(u.status || '') + '</span>'
      + '<button class="btn" data-edit="' + i + '">Edit</button></div>';
  }).join('') : '<div class="empty">Nobody on this project yet. Until somebody is, no record can '
              + 'be raised, nothing can be approved, and there is no dashboard to check.</div>';

  Array.prototype.forEach.call(el('people').querySelectorAll('[data-edit]'), function(b){
    b.addEventListener('click', function(){ openPerson(ppl[Number(b.getAttribute('data-edit'))]); });
  });
}

/* ---------------------------------------------------- adding and editing one */

var PDLG = el('pdlg'), EDITING = null;

function tickList(id, items, chosen, attr){
  el(id).innerHTML = items.map(function(x){
    var on = (chosen || []).indexOf(x.id) >= 0;
    return '<label class="chip' + (on ? ' on' : '') + '"><input type="checkbox" '
      + attr + '="' + esc(x.id) + '"' + (on ? ' checked' : '') + '>' + esc(x.label) + '</label>';
  }).join('');
  Array.prototype.forEach.call(el(id).querySelectorAll('input'), function(b){
    b.addEventListener('change', function(){ b.parentNode.classList.toggle('on', b.checked); });
  });
}
function ticked(id, attr){
  return Array.prototype.slice.call(el(id).querySelectorAll('input[' + attr + ']:checked'))
    .map(function(b){ return b.getAttribute(attr); });
}

function paintStreams(chosen){
  var S = D.streams || {}, G = D.stream_groups || [];
  el('pd_streams').innerHTML = G.map(function(g){
    var ids = Object.keys(S).filter(function(k){ return S[k].group === g; });
    if (!ids.length) return '';
    return '<div class="sgrp">' + esc(g) + '</div><div class="chips">'
      + ids.map(function(k){
          var on = (chosen || []).indexOf(k) >= 0;
          return '<label class="chip' + (on ? ' on' : '') + '"><input type="checkbox" data-st="'
            + esc(k) + '"' + (on ? ' checked' : '') + '>' + esc(S[k].label) + '</label>';
        }).join('') + '</div>';
  }).join('');
  Array.prototype.forEach.call(el('pd_streams').querySelectorAll('input'), function(b){
    b.addEventListener('change', function(){ b.parentNode.classList.toggle('on', b.checked); });
  });
}

function openPerson(u){
  EDITING = u || null;
  el('pdTitle').textContent = u ? ('Edit ' + (u.name || 'somebody')) : 'Add somebody';
  el('pdHint').textContent = u ? '' : 'They are invited by email and can sign in once the project is live.';
  el('pd_name').value = (u && u.name) || '';
  el('pd_email').value = (u && u.email) || '';
  el('pd_phone').value = (u && u.phone) || '';
  el('pd_err').hidden = true;

  tickList('pd_roles', (D.roles || []).filter(function(r){ return !r.retired; })
    .map(function(r){ return { id: r.id, label: r.label }; }), (u && u.functions) || [], 'data-fn');
  tickList('pd_disc', (D.disciplines || []).map(function(x){ return { id: x, label: x }; }),
    (u && u.disciplines) || [], 'data-dc');
  paintStreams((u && u.streams) || []);

  el('pd_suspend').hidden = !u;
  el('pd_suspend').textContent = u && u.status === 'suspended' ? 'Restore access' : 'Withdraw access';
  PDLG.showModal();
}

var _wfLink = el('toWf');
if (_wfLink) _wfLink.addEventListener('click', function(ev){
  ev.preventDefault();
  location.href = '/workflows?p=' + encodeURIComponent(pid());
});

el('addPerson').addEventListener('click', function(){ openPerson(null); });
el('pd_cancel').addEventListener('click', function(){ PDLG.close(); });
el('pd_all').addEventListener('click', function(ev){ ev.preventDefault();
  Array.prototype.forEach.call(el('pd_streams').querySelectorAll('input'), function(b){
    b.checked = true; b.parentNode.classList.add('on'); }); });
el('pd_none').addEventListener('click', function(ev){ ev.preventDefault();
  Array.prototype.forEach.call(el('pd_streams').querySelectorAll('input'), function(b){
    b.checked = false; b.parentNode.classList.remove('on'); }); });

el('pd_save').addEventListener('click', async function(){
  var e = el('pd_err'); e.hidden = true;
  var person = {
    id: EDITING ? EDITING.id : undefined,
    name: el('pd_name').value.trim(),
    email: el('pd_email').value.trim(),
    phone: el('pd_phone').value.trim(),
    functions: ticked('pd_roles', 'data-fn'),
    disciplines: ticked('pd_disc', 'data-dc'),
    streams: ticked('pd_streams', 'data-st'),
  };
  if (!person.name) { e.hidden = false; e.textContent = 'They need a name — it goes on every record they send.'; return; }
  if (!person.functions.length) {
    e.hidden = false;
    e.textContent = 'Give them at least one role. Without one they sign in to a blank screen.';
    return;
  }
  this.disabled = true;
  try {
    var r = await fetch('/api/org-roles', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save-person', project_id: pid(), person: person }) });
    var d = await r.json();
    if (d.error) { e.hidden = false; e.textContent = d.error; }
    else { PDLG.close(); clearSay(); await load(true); }
  } catch (ex) { e.hidden = false; e.textContent = 'Could not reach the server.'; }
  this.disabled = false;
});

el('pd_suspend').addEventListener('click', async function(){
  if (!EDITING) return;
  var back = EDITING.status === 'suspended';
  if (!back && !confirm('Withdraw ' + (EDITING.name || 'this person') + "'s access? "
      + 'They stop being able to sign in. Nothing they have already sent is removed.')) return;
  this.disabled = true;
  try {
    var r = await fetch('/api/org-roles', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: back ? 'restore-person' : 'suspend-person',
                             project_id: pid(), id: EDITING.id }) });
    var d = await r.json();
    if (d.error) say(d.error, false); else { PDLG.close(); await load(true); }
  } catch (ex) { say('Could not reach the server.', false); }
  this.disabled = false;
});

/* ------------------------------------------------------------------ onward */

// The roles in the order the list shows them: by group, then as listed. The
// next one is the one BELOW on screen, not the next in some internal order.
function shownOrder(){
  var out = [];
  (D.groups || []).forEach(function(g){
    (D.roles || []).forEach(function(r){ if (r.grp === g && !r.retired) out.push(r.id); });
  });
  return out;
}
function nextRole(id){
  var order = shownOrder(), i = order.indexOf(id);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}
function roleLabel(id){
  var r = (D.roles || []).filter(function(x){ return x.id === id; })[0];
  return r ? r.label : id;
}
function goOnward(){ location.href = '/workflows?p=' + encodeURIComponent(pid()); }

el('onward').addEventListener('click', function(){
  if (DIRTY && !confirm('This role has unsaved changes. Leave them and go on to Workflows?')) return;
  DIRTY = false;
  goOnward();
});

// Says what is missing before moving on, without refusing to — the handover
// checks are where an unready project is actually stopped.
function paintOnward(){
  var people = (D.people || []).filter(function(p){ return p.status !== 'suspended'; }).length;
  el('onwardWhy').textContent = people
    ? people + (people === 1 ? ' person' : ' people') + ' on this project.'
    : 'Nobody is on this project yet \u2014 add at least the people who sign before going live.';
}

/* ------------------------------------------------------------------ wiring */

function pick(id){
  if (DIRTY && !confirm('This role has unsaved changes. Leave them?')) return;
  DIRTY = false;
  ROLE = id;
  history.replaceState(null, '', '/org?p=' + encodeURIComponent(pid()) + '&r=' + encodeURIComponent(id));
  paintNav();
  paintRole();
  loadWorkflow();
}

async function load(keep){
  clearSay();
  try {
    var r = await fetch('/api/org-roles?project=' + encodeURIComponent(pid()) + '&all=1', { cache: 'no-store' });
    var d = await r.json();
    if (!r.ok) { say(d.error || 'Could not read that project.', false); return; }
    D = d;
    paintPeople();
    var want = keep && ROLE ? ROLE : (new URLSearchParams(location.search).get('r')
      || ((D.roles || [])[0] || {}).id);
    ROLE = want;
    paintNav();
    paintRole();
    paintOnward();
    if (!keep) await loadWorkflow();
  } catch (e) { say('Could not reach the server.', false); }
}



load();
${SWITCHER_JS}
${PWA_BOOT}
</script>
${ADMIN_JS('org')}
</body>
</html>`;
