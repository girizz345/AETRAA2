import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK, SWITCHER_CSS, SWITCHER_JS } from './shared.js';
import { ADMIN_CSS, ADMIN_BAR, ADMIN_JS, STEPS_CSS, STEPS_BAR } from './admin-nav.js';
import { MODULES, MODULE_GROUPS, CORE } from '../modules.js';

// STEP 4 — WHAT EACH PARTY RUNS.
//
// Modules already existed, but they were chosen once for the whole project,
// which is the wrong granularity the moment there is more than one company on
// it. Procurement and Subcontractors mean nothing to a consultant. Payment
// certification means nothing to a contractor — they apply, they do not
// certify. Budget and approvals are the developer's alone. One list for the
// project either gives everybody everything, which is the noise this platform
// already had, or gives somebody less than they need.
//
// So the set belongs to the party.
//
// AND IT IS THE SAME THING AS THE DASHBOARD TICKS, SAID ONCE.
//
// There was a real risk of building "modules" as a second concept alongside the
// dashboard checkboxes on each person, and then watching the two drift until
// nobody could say which one decided anything. They are one idea at two levels,
// and the relationship only runs one way:
//
//     MODULE ON    this party runs this on this project        (here)
//     DASHBOARD    which of that party's people open it        (step 5)
//     MODULE OFF   nobody on that party is offered it at all
//
// That is also what fixes the organisation screen, where every role was offered
// all fourteen dashboards whether or not the project used them.
//
// THE PROJECT'S OWN MODULE LIST IS THE UNION. Every gate already written asks
// "is this module on for this project", and there are a lot of them. Rather
// than teach all of them about parties, the project's list becomes the union of
// what its parties run — which is correct: the Documents module is on because
// somebody files documents, and who may see what inside it is a question for
// the visibility rules, not for a switch.
//
// NOTHING IS DELETED BY A TICK. Switching a module off hides it and refuses it.
// Turn it back on and every record is exactly where it was.

export const modulesHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Modules · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}${ADMIN_CSS}${STEPS_CSS}
.wrap { max-width: 1040px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
        padding: 15px 17px; margin-bottom: 12px; }
.card h2 { margin: 0 0 3px; font-size: var(--fs-body); }
.card .sub { font-size: var(--fs-secondary); color: var(--muted); margin-bottom: 12px; line-height: 1.55; }

.pt { border: 1px solid var(--border); border-radius: 11px; margin-bottom: 11px; overflow: hidden; }
.pt .hd { padding: 11px 14px; background: var(--surface-2); display: flex; gap: 10px;
          align-items: baseline; flex-wrap: wrap; }
.pt .hd b { font-size: var(--fs-body); }
.pt .hd .co { font-size: var(--fs-secondary); color: var(--muted); flex: 1 1 auto; min-width: 0; }
.pt .hd .me { font-size: var(--fs-label); font-weight: 500; letter-spacing: .05em; text-transform: uppercase;
              padding: 2px 7px; border-radius: 5px; background: var(--ink); color: var(--surface); }
.pt .hd a { font-size: var(--fs-secondary); color: var(--ink-2); cursor: pointer; text-decoration: underline; }
.pt .ms { padding: 4px 14px 14px; }
.grp { margin-top: 12px; }
.grp:first-child { margin-top: 4px; }
.grp .gh { display: flex; gap: 10px; align-items: baseline; padding: 6px 0 4px;
           border-bottom: 1px solid var(--border); margin-bottom: 4px; }
.grp .gh b { font-size: var(--fs-label); font-weight: 500; letter-spacing: .06em; text-transform: uppercase;
             color: var(--muted); flex: 1 1 auto; }
.grp .gh a { font-size: var(--fs-secondary); color: var(--ink-2); cursor: pointer; text-decoration: underline;
             white-space: nowrap; }
.cols { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0 16px; }
@media (max-width: 680px) { .cols { grid-template-columns: 1fr; } }
.m { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; cursor: pointer; margin: 0; }
.m input { margin: 2px 0 0; flex: 0 0 auto; }
.m .t { flex: 1 1 auto; min-width: 0; }
.m .t b { font-size: var(--fs-secondary); font-weight: 500; display: block; color: var(--ink); }
.m .t span { font-size: var(--fs-secondary); color: var(--muted); line-height: 1.45; display: block; margin-top: 1px; }
.m.off .t b, .m.off .t span { opacity: .5; }

.core { font-size: var(--fs-secondary); color: var(--muted); line-height: 1.6; padding: 11px 13px;
        border-radius: 10px; background: var(--surface-2); border: 1px solid var(--border); }
.core b { color: var(--ink); }

.go { margin-top: 14px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.btn.big { font-size: var(--fs-body); padding: 10px 20px; }
.note { font-size: var(--fs-secondary); color: var(--muted); line-height: 1.6; margin-top: 10px; }
.empty { padding: 18px 4px; color: var(--muted); font-size: var(--fs-secondary); line-height: 1.6; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Modules</h1><div class="sub">what each party on this project runs</div></div>
  <div class="spacer"></div>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  <a class="btn" href="/home">All projects</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  ${ADMIN_BAR}
  ${STEPS_BAR('modules')}

  <div id="msg" class="msg" hidden></div>

  <div class="card">
    <h2>What each party runs</h2>
    <div class="sub">Everything AETRAA does, by area. Each party starts on what that kind of company
      normally runs — tick anything else on, or use <b>all</b> on a heading to take a whole area.
      A module switched off is hidden and refused for that party; nothing is deleted, and turning it
      back on puts every record back where it was.</div>

    <div class="core">
      <b>Always on for everybody:</b> ${CORE[0].note}.
    </div>

    <div id="parties" style="margin-top:12px"></div>

    <div class="go">
      <button class="btn prim big" id="save">Save and set the people &rarr;</button>
      <button class="btn" id="saveOnly">Save</button>
    </div>
    <div class="note" id="note"></div>
  </div>
</div>

<script>
var MODULES = ${JSON.stringify(MODULES.map(({ id, group, label, note }) => ({ id, group, label, note })))};
var GROUPS = ${JSON.stringify(MODULE_GROUPS)};
var STATE = [];

function el(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function say(t, ok){ var m=el('msg'); m.hidden=false; m.textContent=t; m.className='msg '+(ok?'ok':'err');
  window.scrollTo(0,0); }
function clearSay(){ el('msg').hidden = true; }
function pid(){ return new URLSearchParams(location.search).get('p') || window.PROJECT_ID || ''; }

function paint(){
  if (!STATE.length) {
    el('parties').innerHTML = '<div class="empty">No parties are on this project yet. '
      + '<a href="/parties?p=' + encodeURIComponent(pid()) + '">Set them first</a> \\u2014 the modules '
      + 'belong to the parties, so there is nothing to choose until there is somebody to choose for.</div>';
    return;
  }
  el('parties').innerHTML = STATE.map(function(p){
    var on = {};
    (p.modules || []).forEach(function(m){ on[m] = 1; });

    // GROUPED, NOT ONE LONG LIST. Eighteen tick boxes in a column is a wall;
    // by area, with a select-all on each, it is a decision per area.
    var groups = GROUPS.map(function(g){
      var mine = MODULES.filter(function(m){ return m.group === g; });
      if (!mine.length) return '';
      var lit = mine.filter(function(m){ return on[m.id]; }).length;
      var boxes = mine.map(function(m){
        return '<label class="m' + (on[m.id] ? '' : ' off') + '">'
          + '<input type="checkbox" data-party="' + esc(p.party) + '" data-m="' + esc(m.id) + '"'
          + (on[m.id] ? ' checked' : '') + '>'
          + '<div class="t"><b>' + esc(m.label) + '</b><span>' + esc(m.note) + '</span></div></label>';
      }).join('');
      return '<div class="grp"><div class="gh"><b>' + esc(g) + '</b>'
        + '<span class="co">' + lit + ' of ' + mine.length + '</span>'
        + '<a data-all="' + esc(p.party) + '|' + esc(g) + '|'
        + (lit === mine.length ? 'off' : 'on') + '">'
        + (lit === mine.length ? 'none' : 'all') + '</a>'
        + '</div><div class="cols">' + boxes + '</div></div>';
    }).join('');

    var n = (p.modules || []).length;
    return '<div class="pt"><div class="hd"><b>' + esc(p.label) + '</b>'
      + (p.is_self ? '<span class="me">you</span>' : '')
      + '<span class="co">' + esc(p.company_name || 'to be appointed')
      + ' \\u00b7 ' + n + ' of ' + MODULES.length + ' modules</span>'
      + '<a data-reset="' + esc(p.party) + '">Reset to the usual set</a>'
      + '<a data-all="' + esc(p.party) + '||on">Everything</a>'
      + '</div><div class="ms">' + groups + '</div></div>';
  }).join('');
}

document.addEventListener('change', function(e){
  var t = e.target;
  if (!t || !t.getAttribute || !t.getAttribute('data-m')) return;
  var party = t.getAttribute('data-party'), m = t.getAttribute('data-m');
  for (var i = 0; i < STATE.length; i++) {
    if (STATE[i].party !== party) continue;
    var list = (STATE[i].modules || []).filter(function(x){ return x !== m; });
    if (t.checked) list.push(m);
    STATE[i].modules = list;
  }
  paint();
});

document.addEventListener('click', function(e){
  var t = e.target;
  if (!t || !t.getAttribute) return;

  var party = t.getAttribute('data-reset');
  if (party) {
    e.preventDefault();
    for (var i = 0; i < STATE.length; i++) {
      if (STATE[i].party === party) STATE[i].modules = (STATE[i].defaults || []).slice();
    }
    paint();
    return;
  }

  // "all" / "none" on a group heading, and "Everything" on the party — the
  // same handler, with a blank group meaning every group.
  var all = t.getAttribute('data-all');
  if (!all) return;
  e.preventDefault();
  var bits = all.split('|'), who = bits[0], grp = bits[1], want = bits[2] === 'on';
  var ids = MODULES.filter(function(m){ return !grp || m.group === grp; }).map(function(m){ return m.id; });
  for (var j = 0; j < STATE.length; j++) {
    if (STATE[j].party !== who) continue;
    var keep = (STATE[j].modules || []).filter(function(m){ return ids.indexOf(m) < 0; });
    STATE[j].modules = want ? keep.concat(ids) : keep;
  }
  paint();
});

async function load(){
  try {
    var r = await fetch('/api/parties?project=' + encodeURIComponent(pid()), { cache: 'no-store' });
    var d = await r.json();
    if (!r.ok) { say(d.error || 'Could not read that project.', false); return; }
    STATE = (d.parties || []).map(function(p){
      return { party: p.party, label: p.label, company_name: p.company_name, is_self: p.is_self,
               modules: (p.modules || []).slice(), defaults: (d.defaults || {})[p.party] || [] };
    });
    paint();
    el('note').textContent = 'The project runs whatever any party on it runs \\u2014 '
      + 'who sees what inside a module is set by their role, on the next step.';
  } catch (e) { say('Could not reach the server.', false); }
}

async function save(then){
  if (!STATE.length) { say('Set the parties first — the modules belong to them.', false); return; }
  // A PARTY WITH NOTHING TICKED IS A PARTY WITH A BLANK APPLICATION. Refused
  // here rather than discovered by whoever signs in on Monday.
  var blank = STATE.filter(function(p){ return !(p.modules || []).length; });
  if (blank.length) {
    say(blank[0].label + ' has no module ticked. Everyone on that side would sign in to the base '
      + 'platform and nothing else.', false);
    return;
  }
  clearSay();
  try {
    var r = await fetch('/api/party-modules', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: pid(),
        modules: STATE.map(function(p){ return { party: p.party, modules: p.modules }; }) }) });
    var d = await r.json();
    if (!d.ok) { say(d.error || 'Could not save that.', false); return; }
    if (then) { location.href = '/org?p=' + encodeURIComponent(pid()); return; }
    say('Saved. The project runs ' + (d.project_modules || []).length + ' modules in all.', true);
    await load();
  } catch (e) { say('Could not reach the server.', false); }
}

el('save').addEventListener('click', function(){ save(true); });
el('saveOnly').addEventListener('click', function(){ save(false); });

load();
${SWITCHER_JS}
${PWA_BOOT}
</script>
${ADMIN_JS('modules')}
</body>
</html>`;
