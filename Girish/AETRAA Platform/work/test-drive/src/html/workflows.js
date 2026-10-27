import { THEME_CSS } from './theme.js';
import { icon } from './icons.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK, SWITCHER_CSS, SWITCHER_JS } from './shared.js';
import { ADMIN_CSS, ADMIN_BAR, ADMIN_JS, STEPS_CSS, STEPS_BAR } from './admin-nav.js';

// WHAT HAPPENS TO EACH KIND OF DOCUMENT — built by dragging, not by form.
//
// THE THIRD VERSION OF THIS SCREEN, and the reason for each is worth keeping.
//
// The first listed the roles and, for each, every step in the project it
// signed — "which of these sixty steps is the QA/QC engineer's?" Nobody in an
// office has that question. The operator called it very confusing.
//
// The second turned it round: the document types down the page, each on a
// named route picked from a dropdown, with a separate library of routes below
// and a dialog to edit them. Right question, but three places to look to change
// one step: the dropdown, the library card, and a modal of tick boxes where a
// route of five steps was sixty checkboxes long. Still too much.
//
// This one is the route itself, as boxes, and you change it by moving things:
//
//   PEOPLE are chips down the side. Drag one onto a step and they sign it.
//   STEPS are boxes in a row. Drag one to where it belongs.
//   A chip on a step comes off with its ×. A step comes out with its ×.
//
// Nothing is saved until Save, so a mess can be thrown away with Discard. On a
// tablet, where dragging is unreliable, tap a person and then tap the step.
//
// THE REPRESENTATIVE. Every party acts through one named person, who signs
// everything that party sends. The card at the top says who that is on this
// project, whether anyone holds the role yet, and puts their signature in front
// of every step where something leaves — in one act, not sixteen.
//
// THE TWO REFUSALS STILL HOLD, on the server, whatever this screen sends: no
// step may have nobody on it, and the first step must have somebody who can
// raise it. Both strand documents rather than merely misconfiguring them, and
// after go-live there is nobody outside the project who can repair either.

export const workflowsHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Workflows · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}${ADMIN_CSS}${STEPS_CSS}
.wrap { max-width: 1240px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
        padding: 15px 17px; margin-bottom: 12px; }
.card h2 { margin: 0 0 3px; font-size: var(--fs-body); }
.card .sub { font-size: var(--fs-secondary); color: var(--muted); margin-bottom: 12px; line-height: 1.55; }

/* ---- who signs */
.sig { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
.sig .pen { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center;
            background: var(--accent); color: var(--on-accent); font-size: var(--fs-headline); flex: 0 0 auto; }
.sig .who { flex: 1 1 260px; min-width: 0; }
.sig .who b { font-size: var(--fs-body); display: block; }
.sig .who small { font-size: var(--fs-secondary); color: var(--muted); display: block; margin-top: 2px; line-height: 1.5; }
.sig .who small.warn { color: var(--warn-ink); }
.sig .n { font-size: var(--fs-secondary); color: var(--muted); }

/* ---- the two columns */
.board { display: grid; grid-template-columns: 250px 1fr; gap: 14px; align-items: start; }
@media (max-width: 860px) { .board { grid-template-columns: 1fr; } }
.side { position: sticky; top: 12px; }
@media (max-width: 860px) { .side { position: static; } }

/* ---- the people */
.pal h3 { margin: 0 0 3px; font-size: var(--fs-secondary); }
.pal .tip { font-size: var(--fs-secondary); color: var(--muted); line-height: 1.5; margin-bottom: 10px; }
.pal .g { font-size: var(--fs-label); font-weight: 500; letter-spacing: .07em; text-transform: uppercase;
          color: var(--muted); margin: 11px 0 5px; }
.pal .g:first-of-type { margin-top: 2px; }
.pal .list { display: flex; flex-wrap: wrap; gap: 5px; }
.who-chip { display: inline-flex; align-items: center; gap: 5px; padding: 5px 9px; border-radius: 7px;
            border: 1px solid var(--border); background: var(--surface-2); font-size: var(--fs-secondary);
            cursor: grab; user-select: none; -webkit-user-select: none; line-height: 1.25; }
.who-chip:hover { border-color: var(--ink-2); }
.who-chip:active { cursor: grabbing; }
.who-chip.sign { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
/* Signs: the pen line icon (the ✍ emoji drew in another font). */
.who-chip.sign::before { content: ""; display: inline-block; width: 14px; height: 14px; flex: 0 0 14px; background: currentColor;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 20h9'/%3E%3Cpath d='M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z'/%3E%3C/svg%3E") center / contain no-repeat;
          mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 20h9'/%3E%3Cpath d='M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z'/%3E%3C/svg%3E") center / contain no-repeat; }
.who-chip.nobody { border-style: dashed; }
.who-chip.armed { background: var(--ink); color: var(--surface); border-color: transparent; }
.who-chip .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--good); flex: 0 0 auto; }
.who-chip.nobody .dot { background: var(--accent); }

/* ---- the document types */
.gname { font-size: var(--fs-label); font-weight: 500; letter-spacing: .07em; text-transform: uppercase;
         color: var(--muted); margin: 16px 0 7px 2px; }
.gname:first-child { margin-top: 0; }
.dt { border: 1px solid var(--border); border-radius: 11px; margin-bottom: 8px; background: var(--surface); }
.dt.open { border-color: var(--ink-2); box-shadow: 0 1px 0 var(--border); }
.dt .head { display: flex; gap: 12px; align-items: center; padding: 11px 14px; cursor: pointer; flex-wrap: wrap; }
.dt .head .tw { width: 12px; color: var(--muted); font-size: var(--fs-secondary); flex: 0 0 auto; transition: transform .12s; }
.dt.open .head .tw { transform: rotate(90deg); }
.dt .head .nm { flex: 0 0 200px; min-width: 0; }
.dt .head .nm b { font-size: var(--fs-secondary); display: block; }
.dt .head .nm small { color: var(--muted); font-size: var(--fs-secondary); }
.dt .head .mini { flex: 1 1 300px; min-width: 0; display: flex; flex-wrap: wrap; gap: 4px; align-items: center;
                  font-size: var(--fs-secondary); color: var(--ink-2); }
.dt .head .mini span.s { padding: 2px 7px; border-radius: 5px; background: var(--surface-2);
                         border: 1px solid var(--border); white-space: nowrap; }
.dt .head .mini span.s.sign { border-color: var(--accent); }
.dt .head .mini span.s.issue { border-color: color-mix(in srgb, var(--warn-ink) 45%, transparent); }
.dt .head .mini span.s.reply { border-color: color-mix(in srgb, var(--good-ink) 45%, transparent); }
.dt .head .mini i { font-style: normal; color: var(--muted); }
.dt .head .flag { font-size: var(--fs-secondary); font-weight: 500; padding: 2px 7px; border-radius: 5px;
                  background: color-mix(in srgb, var(--warn-ink) 16%, transparent); color: var(--warn-ink); white-space: nowrap; }
.dt .body { display: none; padding: 4px 14px 14px; border-top: 1px solid var(--border); }
.dt.open .body { display: block; }

/* ---- the route, as boxes */
.route { display: flex; flex-wrap: wrap; gap: 10px; align-items: stretch; padding: 12px 0 4px; }
.box { width: 196px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2);
       padding: 8px 9px 9px; display: flex; flex-direction: column; gap: 6px; position: relative;
       transition: border-color .1s, background .1s, opacity .1s; }
.box.sign { border-color: var(--accent); }
.box.issue { border-color: color-mix(in srgb, var(--warn-ink) 45%, transparent); }
.box.reply { border-color: color-mix(in srgb, var(--good-ink) 45%, transparent); }
.box.over { border-color: var(--ink); background: var(--surface); box-shadow: 0 0 0 2px var(--ink) inset; }
.box.dragging { opacity: .35; }
.box.empty { border-color: color-mix(in srgb, var(--bad-ink) 45%, transparent); }
.box .bar { display: flex; gap: 4px; align-items: center; }
.box .grip { cursor: grab; color: var(--muted); font-size: var(--fs-secondary); padding: 0 3px; user-select: none;
             letter-spacing: -2px; }
.box .grip:active { cursor: grabbing; }
.box .num { font-size: var(--fs-secondary); font-weight: 500; color: var(--muted); flex: 1 1 auto; }
.box .ic { border: 0; background: none; padding: 1px 5px; font-size: var(--fs-secondary); color: var(--muted);
           cursor: pointer; border-radius: 5px; line-height: 1.2; }
.box .ic:hover { background: var(--surface); color: var(--ink); }
.box input.nm { font-size: var(--fs-secondary); font-weight: 500; padding: 5px 7px; border-radius: 6px; }
.box .who { display: flex; flex-wrap: wrap; gap: 4px; min-height: 24px; }
.box .who span { display: inline-flex; align-items: center; gap: 3px; font-size: var(--fs-secondary); padding: 2px 4px 2px 7px;
                 border-radius: 5px; background: var(--surface); border: 1px solid var(--border); }
.box .who span.sign { border-color: var(--accent); }
.box .who span.nobody { border-style: dashed; color: var(--warn-ink); }
.box .who span button { border: 0; background: none; padding: 0 3px; cursor: pointer; color: var(--muted);
                        font-size: var(--fs-secondary); line-height: 1; }
.box .who span button:hover { color: var(--bad-ink); }
.box .drop { font-size: var(--fs-secondary); color: var(--muted); text-align: center; padding: 6px 4px; border-radius: 6px;
             border: 1px dashed var(--border); }
body.armed .box .drop { border-color: var(--ink); color: var(--ink); cursor: copy; }
.box .flags { display: flex; gap: 10px; font-size: var(--fs-secondary); color: var(--muted); flex-wrap: wrap; }
.box .flags label { display: inline-flex; gap: 4px; align-items: center; margin: 0; font-size: var(--fs-secondary);
                    color: var(--muted); font-weight: 400; cursor: pointer; }
.box .tag { position: absolute; top: -8px; right: 9px; font-size: var(--fs-label); font-weight: 500; letter-spacing: .04em;
            text-transform: uppercase; padding: 1px 6px; border-radius: 4px; color: var(--on-accent); }
.box .tag.sign { background: var(--accent); }
.box .tag.issue { background: var(--warn); }
.box .tag.reply { background: var(--good); }
.add { width: 120px; border: 1.5px dashed var(--border); border-radius: 10px; display: grid; place-items: center;
       color: var(--muted); font-size: var(--fs-secondary); cursor: pointer; background: none; min-height: 120px; }
.add:hover { border-color: var(--ink-2); color: var(--ink); }

.foot { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 12px;
        padding-top: 11px; border-top: 1px solid var(--border); }
.foot .lab { font-size: var(--fs-secondary); color: var(--muted); }
.foot select { width: auto; max-width: 300px; font-size: var(--fs-secondary); padding: 6px 8px; }
.foot input.days { width: 64px; padding: 6px 8px; font-size: var(--fs-secondary); }
.foot .sp { flex: 1 1 auto; }
.foot .dirty { font-size: var(--fs-secondary); font-weight: 500; color: var(--warn-ink); }
.err { font-size: var(--fs-secondary); color: var(--bad-ink); margin-top: 9px; line-height: 1.5; }
.muted { color: var(--muted); }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Workflows</h1><div class="sub">what happens to each kind of document</div></div>
  <div class="spacer"></div>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  <a class="btn" href="/home">All projects</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  ${ADMIN_BAR}
  ${STEPS_BAR('workflows')}
  <div id="msg" class="msg" hidden></div>

  <div class="card" id="sigCard" hidden>
    <div class="sig">
      <div class="pen">${icon('pen', 18)}</div>
      <div class="who">
        <b id="sigName">&mdash;</b>
        <small id="sigHeld"></small>
      </div>
      <span class="n" id="sigCount"></span>
      <button class="btn prim" id="sigAdd">Sign everything that goes out</button>
    </div>
  </div>

  <div class="board">
    <div class="side">
      <div class="card pal">
        <h3>People</h3>
        <div class="tip">Drag a person onto a step and they sign it.
          On a tablet: tap a person, then tap a step.</div>
        <div id="pal"></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:0">
      <h2>Document types</h2>
      <div class="sub">Open a type to see its route as boxes. Drag the boxes into order, drag people onto
        them, and save. Documents already raised keep the route they started on.</div>
      <div id="types"></div>
    </div>
  </div>
</div>

<script>
var D = null;          // what the server said
var OPEN = null;       // the document type being edited
var DRAFT = null;      // its steps, as edited, not yet saved
var DAYS = null;
var DIRTY = false;
var ARMED = null;      // a person picked by tapping, waiting for a step

function el(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function say(t, ok){ var m=el('msg'); m.hidden=false; m.textContent=t; m.className='msg '+(ok?'ok':'err');
  window.scrollTo(0, 0); }
function clearSay(){ el('msg').hidden = true; }
function pid(){ return new URLSearchParams(location.search).get('p') || window.PROJECT_ID || ''; }

function roleOf(id){ return (D.roles || []).filter(function(r){ return r.id === id; })[0] || null; }
function label(id){ var r = roleOf(id); return r ? r.label : ((D.labels || {})[id] || id); }
function heldBy(id){ return (D.holders || {})[id] || []; }
function isSign(id){ var r = roleOf(id); return !!(r && r.signatory); }
function copySteps(list){
  return (list || []).map(function(s){
    return { st: s.st, by: (s.by || []).slice(), issue: !!s.issue, reply: !!s.reply, sign: !!s.sign };
  });
}

/* ================================================================ who signs */

function paintSignatory(){
  var r = D.representative;
  if (!r) { el('sigCard').hidden = true; return; }
  el('sigCard').hidden = false;
  el('sigName').textContent = r.label + ' signs everything your side sends';
  var h = r.held_by || [];
  el('sigHeld').className = h.length ? '' : 'warn';
  el('sigHeld').textContent = h.length
    ? 'Held by ' + h.join(', ') + '.'
    : 'Nobody holds this role yet. Give it to somebody on Organisation \\u2014 a step only they can sign '
      + 'is a step nothing can pass.';

  // How many routes that send something out already carry the signature.
  var out = 0, signed = 0;
  (D.workflow || []).forEach(function(w){
    var at = -1;
    for (var i = 0; i < w.steps.length; i++) { if (w.steps[i].issue) { at = i; break; } }
    if (at < 0) return;
    out++;
    for (var j = 0; j < at; j++) {
      if ((w.steps[j].by || []).indexOf(r.id) >= 0) { signed++; break; }
    }
  });
  // Three states, and "everything is signed" must never be said of a project
  // where nothing goes out at all — that reads as done when it is empty.
  if (!out) {
    el('sigCount').textContent = 'No route sends anything out yet';
    el('sigAdd').disabled = true;
    el('sigAdd').textContent = 'Nothing to sign yet';
    return;
  }
  el('sigCount').textContent = signed + ' of ' + out + ' outgoing routes signed';
  el('sigAdd').disabled = signed === out;
  el('sigAdd').textContent = signed === out ? 'Everything going out is signed' : 'Sign everything that goes out';
}

el('sigAdd').addEventListener('click', async function(){
  if (DIRTY && !confirmDiscard()) return;
  this.disabled = true;
  try {
    var r = await fetch('/api/org-workflow', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add-signatory', project_id: pid() }) });
    var d = await r.json();
    if (d.error) { say(d.error, false); this.disabled = false; return; }
    say((d.changed || []).length
      ? 'Signature added in front of the issue step on ' + d.changed.length + ' route'
        + (d.changed.length === 1 ? '' : 's') + ': ' + d.changed.join(', ') + '.'
      : 'Every route that goes out was already signed.', true);
    OPEN = null; DRAFT = null; DIRTY = false;
    await load();
  } catch (e) { say('Could not reach the server.', false); this.disabled = false; }
});

/* ================================================================ the people */

function paintPalette(){
  var groups = [];
  (D.roles || []).forEach(function(r){
    var g = groups.filter(function(x){ return x.g === r.grp; })[0];
    if (!g) { g = { g: r.grp, rows: [] }; groups.push(g); }
    g.rows.push(r);
  });
  // The signatories first, in their own group: they are the reason for the card
  // at the top, and the chip everybody is looking for.
  var signers = (D.roles || []).filter(function(r){ return r.signatory; });
  var head = signers.length
    ? '<div class="g">Signs for the party</div><div class="list">' + signers.map(chip).join('') + '</div>'
    : '';
  el('pal').innerHTML = head + groups.map(function(g){
    var rows = g.rows.filter(function(r){ return !r.signatory; });
    if (!rows.length) return '';
    return '<div class="g">' + esc(g.g) + '</div><div class="list">' + rows.map(chip).join('') + '</div>';
  }).join('');
}

function chip(r){
  var h = heldBy(r.id);
  var cls = 'who-chip' + (r.signatory ? ' sign' : '') + (h.length ? '' : ' nobody')
          + (ARMED === r.id ? ' armed' : '');
  var tip = h.length ? 'Held by ' + h.join(', ') : 'Nobody holds this role yet';
  return '<span class="' + cls + '" draggable="true" data-role="' + esc(r.id) + '" title="' + esc(tip) + '">'
       + '<span class="dot"></span>' + esc(r.label) + '</span>';
}

/* ================================================================ the types */

function mini(steps){
  return (steps || []).map(function(s, i){
    var cls = s.sign ? ' sign' : s.issue ? ' issue' : s.reply ? ' reply' : '';
    return (i ? '<i>\\u2192</i>' : '') + '<span class="s' + cls + '">' + esc(s.st) + '</span>';
  }).join('');
}

function paintTypes(){
  var groups = [];
  (D.workflow || []).forEach(function(w){
    var g = groups.filter(function(x){ return x.g === w.group; })[0];
    if (!g) { g = { g: w.group, rows: [] }; groups.push(g); }
    g.rows.push(w);
  });

  el('types').innerHTML = groups.map(function(g){
    return '<div class="gname">' + esc(g.g) + '</div>' + g.rows.map(function(w){
      var open = OPEN === w.type;
      var steps = open && DRAFT ? DRAFT : w.steps;
      // A step nobody can sign is flagged on the closed row too, so it is found
      // by reading down the page rather than by opening sixteen types. The first
      // step counts: if nobody holds it, nothing of this kind can be raised.
      var stuck = steps.some(function(s){
        return (s.by || []).length && (s.by || []).every(function(id){ return !heldBy(id).length; });
      });
      return '<div class="dt' + (open ? ' open' : '') + '" data-type="' + esc(w.type) + '">'
        + '<div class="head" data-toggle="' + esc(w.type) + '">'
        + '<span class="tw">${icon('chevron-right', 12)}</span>'
        + '<div class="nm"><b>' + esc(w.label) + '</b><small>' + esc(w.prefix ? w.prefix + '-0001' : '')
        + (w.days ? ' \\u00b7 reply in ' + w.days + ' days' : '') + '</small></div>'
        + '<div class="mini">' + mini(steps) + '</div>'
        + (stuck ? '<span class="flag" title="A step on this route is held by nobody">nobody signs a step</span>' : '')
        + (open && DIRTY ? '<span class="flag">unsaved</span>' : '')
        + '</div>'
        + (open ? '<div class="body">' + board(w) + '</div>' : '')
        + '</div>';
    }).join('');
  }).join('');
}

function board(w){
  var boxes = DRAFT.map(function(s, i){
    var kind = s.sign ? 'sign' : s.issue ? 'issue' : s.reply ? 'reply' : '';
    var tag = s.sign ? 'signs' : s.issue ? 'goes out' : s.reply ? 'reply' : '';
    var empty = i > 0 && !(s.by || []).length;
    var who = (s.by || []).map(function(id){
      var cls = (isSign(id) ? ' class="sign"' : '');
      if (!heldBy(id).length) cls = ' class="nobody"';
      return '<span' + cls + ' title="' + esc(heldBy(id).length ? 'Held by ' + heldBy(id).join(', ')
                                                                 : 'Nobody holds this role yet') + '">'
        + esc(label(id)) + '<button data-off="' + i + '|' + esc(id) + '" title="Take off this step">\\u00d7</button></span>';
    }).join('');
    return '<div class="box' + (kind ? ' ' + kind : '') + (empty ? ' empty' : '') + '" data-box="' + i + '">'
      + (tag ? '<span class="tag ' + kind + '">' + tag + '</span>' : '')
      + '<div class="bar">'
      +   '<span class="grip" draggable="true" data-grip="' + i + '" title="Drag to move">\\u2807\\u2807</span>'
      +   '<span class="num">' + (i === 0 ? 'Raised by' : 'Step ' + (i + 1)) + '</span>'
      +   '<button class="ic" data-left="' + i + '" title="Move earlier"' + (i === 0 ? ' disabled' : '') + '>\\u2190</button>'
      +   '<button class="ic" data-right="' + i + '" title="Move later"' + (i === DRAFT.length - 1 ? ' disabled' : '') + '>\\u2192</button>'
      +   '<button class="ic" data-del="' + i + '" title="Remove this step">\\u00d7</button>'
      + '</div>'
      + '<input class="nm" data-name="' + i + '" value="' + esc(s.st) + '" placeholder="What happens here">'
      + '<div class="who">' + who + '</div>'
      + '<div class="drop">' + (empty ? 'nobody yet \\u2014 drop a person here' : 'drop a person here') + '</div>'
      + '<div class="flags">'
      +   '<label><input type="checkbox" data-issue="' + i + '"' + (s.issue ? ' checked' : '') + '> goes out</label>'
      +   '<label><input type="checkbox" data-reply="' + i + '"' + (s.reply ? ' checked' : '') + '> reply</label>'
      + '</div>'
      + '</div>';
  }).join('');

  var opts = '<option value="">Start again from a standard route\\u2026</option>'
    + (D.templates || []).map(function(t){
        return '<option value="' + esc(t.id) + '">' + esc(t.name) + '</option>'; }).join('');

  return '<div class="route" id="route">' + boxes + '<button class="add" id="addStep">+ Add a step</button></div>'
    + '<div class="err" id="boardErr" hidden></div>'
    + '<div class="foot">'
    +   '<select id="startFrom">' + opts + '</select>'
    +   '<span class="lab">reply in</span><input class="days" id="days" type="number" min="1" max="365" value="'
    +     (DAYS || '') + '"><span class="lab">days</span>'
    +   '<span class="sp"></span>'
    +   (DIRTY ? '<span class="dirty">not saved</span>' : '')
    +   '<button class="btn" id="discard"' + (DIRTY ? '' : ' disabled') + '>Discard</button>'
    +   '<button class="btn prim" id="save"' + (DIRTY ? '' : ' disabled') + '>Save ' + esc(w.label.toLowerCase()) + ' route</button>'
    + '</div>';
}

function paint(){ paintSignatory(); paintPalette(); paintTypes(); wireBoard(); }

/* ================================================================ editing */

function touch(){ DIRTY = true; paint(); }

function confirmDiscard(){
  return window.confirm('The route you were editing has changes that are not saved. Throw them away?');
}

function openType(type){
  if (OPEN === type) {
    if (DIRTY && !confirmDiscard()) return;
    OPEN = null; DRAFT = null; DIRTY = false; paint(); return;
  }
  if (DIRTY && !confirmDiscard()) return;
  var w = (D.workflow || []).filter(function(x){ return x.type === type; })[0];
  if (!w) return;
  OPEN = type; DRAFT = copySteps(w.steps); DAYS = w.days; DIRTY = false;
  paint();
}

function addRole(i, id){
  var s = DRAFT[i];
  if (!s || !id) return;
  if ((s.by || []).indexOf(id) >= 0) return;
  s.by.push(id);
  // A step that is signed by the Representative alone is the signature step,
  // whatever it was called. Said so on the box.
  if (isSign(id) && s.by.length === 1) s.sign = true;
  touch();
}

function moveStep(from, to){
  if (from === to || from < 0 || to < 0 || from >= DRAFT.length || to >= DRAFT.length) return;
  var s = DRAFT.splice(from, 1)[0];
  DRAFT.splice(to, 0, s);
  touch();
}

document.addEventListener('click', function(e){
  var t = e.target;
  if (!t || !t.closest) return;

  var head = t.closest('[data-toggle]');
  if (head) { openType(head.getAttribute('data-toggle')); return; }

  // TAP A PERSON, THEN TAP A STEP. Dragging is unreliable on a tablet, and a
  // document controller on site is often on one.
  var pal = t.closest('#pal .who-chip');
  if (pal) {
    var id = pal.getAttribute('data-role');
    ARMED = ARMED === id ? null : id;
    document.body.classList.toggle('armed', !!ARMED);
    paintPalette();
    return;
  }

  var off = t.getAttribute && t.getAttribute('data-off');
  if (off) {
    var p = off.split('|'); var s = DRAFT[Number(p[0])];
    s.by = s.by.filter(function(x){ return x !== p[1]; });
    if (!s.by.some(isSign)) s.sign = false;
    touch(); return;
  }
  var v;
  if ((v = t.getAttribute('data-left')) != null && v !== '') { moveStep(Number(v), Number(v) - 1); return; }
  if ((v = t.getAttribute('data-right')) != null && v !== '') { moveStep(Number(v), Number(v) + 1); return; }
  if ((v = t.getAttribute('data-del')) != null && v !== '') {
    if (DRAFT.length <= 1) { showErr('A route needs at least one step \\u2014 who raises it.'); return; }
    DRAFT.splice(Number(v), 1); touch(); return;
  }
  if (t.id === 'addStep') {
    DRAFT.push({ st: '', by: [], issue: false, reply: false, sign: false });
    touch();
    var boxes = document.querySelectorAll('input[data-name]');
    if (boxes.length) boxes[boxes.length - 1].focus();
    return;
  }
  if (t.id === 'discard') { DIRTY = false; var w0 = OPEN; OPEN = null; openType(w0); return; }
  if (t.id === 'save') { save(); return; }

  // An armed person, dropped by tapping the step.
  if (ARMED) {
    var box = t.closest('.box');
    if (box && !t.closest('input,button,label')) {
      addRole(Number(box.getAttribute('data-box')), ARMED);
    }
  }
});

document.addEventListener('keydown', function(e){
  if (e.key === 'Escape' && ARMED) { ARMED = null; document.body.classList.remove('armed'); paintPalette(); }
});

function wireBoard(){
  if (!OPEN) return;
  Array.prototype.forEach.call(document.querySelectorAll('input[data-name]'), function(inp){
    inp.addEventListener('input', function(){
      DRAFT[Number(inp.getAttribute('data-name'))].st = inp.value;
      if (!DIRTY) { DIRTY = true; refreshFoot(); }
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('input[data-issue]'), function(c){
    c.addEventListener('change', function(){
      var i = Number(c.getAttribute('data-issue'));
      // One step sends it out. Two "goes out" steps on one route make the reply
      // period ambiguous — which one does the clock start from?
      DRAFT.forEach(function(s, k){ s.issue = k === i ? c.checked : false; });
      touch();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('input[data-reply]'), function(c){
    c.addEventListener('change', function(){
      var i = Number(c.getAttribute('data-reply'));
      DRAFT.forEach(function(s, k){ s.reply = k === i ? c.checked : false; });
      touch();
    });
  });
  var d = el('days');
  if (d) d.addEventListener('input', function(){ DAYS = d.value ? Number(d.value) : null; if (!DIRTY) { DIRTY = true; refreshFoot(); } });
  var sf = el('startFrom');
  if (sf) sf.addEventListener('change', function(){
    var t = (D.templates || []).filter(function(x){ return x.id === sf.value; })[0];
    if (!t) return;
    DRAFT = copySteps(t.steps);
    touch();
  });
}

// Typing in a box must not repaint the board — it would take the cursor away
// mid-word. So only the footer and the flag are redrawn.
function refreshFoot(){
  var s = el('save'), x = el('discard');
  if (s) s.disabled = false;
  if (x) x.disabled = false;
  var dt = document.querySelector('.dt.open .head');
  if (dt && !dt.querySelector('.flag.unsaved')) {
    var f = document.createElement('span'); f.className = 'flag unsaved'; f.textContent = 'unsaved';
    dt.appendChild(f);
  }
}

/* ================================================================ dragging */

var DRAG = null;   // { kind: 'role'|'step', id|from }

document.addEventListener('dragstart', function(e){
  var t = e.target;
  if (!t || !t.getAttribute) return;
  var role = t.getAttribute('data-role');
  var grip = t.getAttribute('data-grip');
  if (role) {
    DRAG = { kind: 'role', id: role };
    e.dataTransfer.setData('text/plain', 'role:' + role);
    e.dataTransfer.effectAllowed = 'copy';
  } else if (grip != null) {
    DRAG = { kind: 'step', from: Number(grip) };
    e.dataTransfer.setData('text/plain', 'step:' + grip);
    e.dataTransfer.effectAllowed = 'move';
    var box = t.closest('.box');
    if (box) {
      try { e.dataTransfer.setDragImage(box, 20, 20); } catch (x) {}
      setTimeout(function(){ box.classList.add('dragging'); }, 0);
    }
  }
});

document.addEventListener('dragend', function(){
  DRAG = null;
  Array.prototype.forEach.call(document.querySelectorAll('.box.over, .box.dragging'), function(b){
    b.classList.remove('over'); b.classList.remove('dragging');
  });
});

document.addEventListener('dragover', function(e){
  var box = e.target && e.target.closest && e.target.closest('.box');
  if (!box || !DRAG) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = DRAG.kind === 'role' ? 'copy' : 'move';
  if (!box.classList.contains('over')) {
    Array.prototype.forEach.call(document.querySelectorAll('.box.over'), function(b){ b.classList.remove('over'); });
    box.classList.add('over');
  }
});

document.addEventListener('dragleave', function(e){
  var box = e.target && e.target.closest && e.target.closest('.box');
  if (box && !box.contains(e.relatedTarget)) box.classList.remove('over');
});

document.addEventListener('drop', function(e){
  var box = e.target && e.target.closest && e.target.closest('.box');
  if (!box) return;
  e.preventDefault();
  var raw = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || '';
  var to = Number(box.getAttribute('data-box'));
  if (raw.indexOf('role:') === 0) addRole(to, raw.slice(5));
  else if (raw.indexOf('step:') === 0) moveStep(Number(raw.slice(5)), to);
  DRAG = null;
});

/* ================================================================ saving */

function showErr(t){ var b = el('boardErr'); if (!b) { say(t, false); return; } b.hidden = false; b.textContent = t; }

async function save(){
  // The server refuses these too. Said here first, on the box, so the person
  // sees which step rather than reading a sentence about "step 3".
  for (var i = 0; i < DRAFT.length; i++) {
    if (!String(DRAFT[i].st || '').trim()) {
      showErr('Step ' + (i + 1) + ' has no name. Say what happens there.'); return;
    }
  }
  var btn = el('save'); if (btn) btn.disabled = true;
  try {
    var r = await fetch('/api/org-workflow', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', project_id: pid(), type: OPEN, steps: DRAFT, days: DAYS }) });
    var d = await r.json();
    if (d.error) { showErr(d.error); if (btn) btn.disabled = false; return; }
    var w = (D.workflow || []).filter(function(x){ return x.type === OPEN; })[0];
    say('Saved \\u2014 the ' + (w ? w.label.toLowerCase() : '') + ' route. New documents follow it from now on.', true);
    var keep = OPEN;
    OPEN = null; DRAFT = null; DIRTY = false;
    await load();
    openType(keep);
  } catch (e) { showErr('Could not reach the server.'); if (btn) btn.disabled = false; }
}

window.addEventListener('beforeunload', function(e){
  if (DIRTY) { e.preventDefault(); e.returnValue = ''; }
});

async function load(){
  try {
    var r = await fetch('/api/org-workflow?project=' + encodeURIComponent(pid()), { cache: 'no-store' });
    var d = await r.json();
    if (!r.ok) { say(d.error || 'Could not read the workflows.', false); return; }
    D = d;
    paint();
  } catch (e) { say('Could not reach the server.', false); }
}
load();
${SWITCHER_JS}
${PWA_BOOT}
</script>
${ADMIN_JS('workflows')}
</body>
</html>`;
