import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK, SWITCHER_CSS, SWITCHER_JS } from './shared.js';
import { ADMIN_CSS, ADMIN_BAR, ADMIN_JS, STEPS_CSS, STEPS_BAR } from './admin-nav.js';
import { PARTIES } from '../parties.js';

// STEP 3 — WHO IS ON THIS PROJECT.
//
// The platform used to have no idea that a construction project has more than
// one company on it. Every role was a contractor's role, all fourteen
// dashboards were contractor screens, and every workflow route ended the same
// way: "Document Control issues to the Engineer / consultant / client." The
// system stopped at the contractor's front door, and the review, the coding and
// the return trip happened by email.
//
// This screen is where that changes. It asks two different questions, and the
// difference between them is the whole point:
//
//   WHICH PARTIES ARE ON THIS PROJECT — the shape of the job. Ticking the
//   Consultant does not staff them; it says the Engineer exists, so a submittal
//   route continues past "issue to the Engineer" instead of ending there.
//
//   WHICH ONE IS MY ORGANISATION — exactly one. It decides which roles you are
//   offered, which dashboards those roles open, and which half of every route
//   is yours to sign. Without it, one admin ends up configuring three
//   companies' internal teams, and a consultant's draft comments sit where the
//   contractor can read them.
//
// THE NAMES COME OFF THE CONTRACT. They were read on step 2 and are filled in
// here with the sentence they came from underneath. An admin typing the
// Engineer's name from memory is how a project gets the trading name in one
// place and the legal name in another, and then a transmittal addressed to a
// company that appears nowhere in the contract.
//
// A PARTY MAY BE "TO BE APPOINTED". In this region the Engineer is routinely
// appointed weeks after award. A project that refused to open until every party
// had a name would never open, so a party can be ticked with no company and no
// email — the routes know it will exist, and records that reach its step park
// at the boundary rather than being refused.

export const partiesHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The parties · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}${ADMIN_CSS}${STEPS_CSS}
.wrap { max-width: 980px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
        padding: 15px 17px; margin-bottom: 12px; }
.card h2 { margin: 0 0 3px; font-size: var(--fs-body); }
.card .sub { font-size: var(--fs-secondary); color: var(--muted); margin-bottom: 12px; line-height: 1.55; }

.p { border: 1px solid var(--border); border-radius: 12px; margin-bottom: 11px; overflow: hidden;
     background: var(--surface); }
.p .hd { display: flex; gap: 13px; align-items: flex-start; padding: 14px 16px;
         background: var(--surface-2); cursor: pointer; margin: 0; }
.p .hd .onbox { margin: 2px 0 0; flex: 0 0 auto; }
.p .hd .t { flex: 1 1 auto; min-width: 0; }
.p .hd b { font-size: var(--fs-body); display: block; color: var(--ink); }
.p .hd span.d { font-size: var(--fs-secondary); color: var(--muted); line-height: 1.55; display: block; margin-top: 3px; }
.p .hd .chip { flex: 0 0 auto; font-size: var(--fs-label); font-weight: 500; letter-spacing: .05em;
               text-transform: uppercase; padding: 3px 8px; border-radius: 5px; white-space: nowrap;
               background: var(--surface); border: 1px solid var(--border); color: var(--muted); }
.p .hd .chip.me { background: var(--ink); color: var(--surface); border-color: transparent; }
.p .hd .chip.tba { background: color-mix(in srgb, var(--warn-ink) 16%, transparent); color: var(--warn-ink); border-color: transparent; }
.p .hd .chip.set { background: color-mix(in srgb, var(--good-ink) 16%, transparent); color: var(--good-ink); border-color: transparent; }
.p.on { border-color: var(--ink-2); }
.p.on .hd { background: var(--surface); border-bottom: 1px solid var(--border); }
.p:not(.on) .hd b, .p:not(.on) .hd span.d { opacity: .6; }
.p .body { padding: 14px 16px 16px; display: none; }
.p.on .body { display: block; }

.mine { display: inline-flex; gap: 8px; align-items: center; font-size: var(--fs-secondary); padding: 7px 12px;
        border-radius: 8px; border: 1px solid var(--border); background: var(--surface-2);
        cursor: pointer; margin: 0 0 14px; width: auto; }
.mine input { margin: 0; }
.mine.on { background: var(--ink); color: var(--surface); border-color: transparent; font-weight: 500; }

.two { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
@media (max-width: 620px) { .two { grid-template-columns: 1fr; } }
.f { margin-bottom: 10px; }
.f label { display: block; font-size: var(--fs-secondary); color: var(--muted); margin-bottom: 4px; }
.f input { width: 100%; }
.from { font-size: var(--fs-secondary); color: var(--muted); font-style: italic; line-height: 1.5;
        margin: -4px 0 10px; }
.from b { font-style: normal; }
.use { font-size: var(--fs-secondary); margin: -4px 0 10px; }
.use a { color: var(--ink-2); cursor: pointer; text-decoration: underline; }
.tba { font-size: var(--fs-secondary); color: var(--warn-ink); margin-top: -2px; }

.go { margin-top: 16px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.btn.big { font-size: var(--fs-body); padding: 10px 20px; }
.note { font-size: var(--fs-secondary); color: var(--muted); line-height: 1.6; margin-top: 10px; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>The parties</h1><div class="sub">who is on this project, and which one is you</div></div>
  <div class="spacer"></div>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  <a class="btn" href="/home">All projects</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  ${ADMIN_BAR}
  ${STEPS_BAR('parties')}

  <div id="msg" class="msg" hidden></div>

  <div class="card">
    <h2>Who is on this project</h2>
    <div class="sub">Tick every party that is on the job, and mark the one that is your own
      organisation. A party can be ticked with no name yet — "to be appointed" is a normal state
      between award and the Engineer's appointment, and it does not hold the project up.</div>

    ${PARTIES.map((p) => `
    <div class="p" id="p_${p.id}">
      <label class="hd">
        <input type="checkbox" class="onbox" data-party="${p.id}">
        <div class="t"><b>${p.label}</b><span class="d">${p.note}</span></div>
        <span class="chip" id="chip_${p.id}">not on this project</span>
      </label>
      <div class="body">
        <label class="mine" id="mine_${p.id}">
          <input type="radio" name="self" value="${p.id}"> This is my organisation
        </label>
        <div class="f"><label>Company name</label>
          <input id="co_${p.id}" placeholder="Leave blank if not appointed yet" autocomplete="off"></div>
        <div class="from" id="from_${p.id}" hidden></div>
        <div class="use" id="use_${p.id}" hidden></div>
        <div class="two">
          <div class="f"><label>Contact — their lead on this job</label>
            <input id="cn_${p.id}" placeholder="Full name" autocomplete="off"></div>
          <div class="f"><label>Email — used to invite them</label>
            <input id="em_${p.id}" placeholder="name@company.com" autocomplete="off"></div>
        </div>
        <div class="tba" id="tba_${p.id}" hidden>To be appointed — records that reach this party's
          step will park at the boundary until they are on the project.</div>
      </div>
    </div>`).join('')}

    <div class="go">
      <button class="btn prim big" id="save">Save and choose the modules &rarr;</button>
      <button class="btn" id="saveOnly">Save</button>
      <span class="sub" style="margin:0" id="count"></span>
    </div>
    <div class="note" id="note"></div>
  </div>
</div>

<script>
var PARTY_IDS = ${JSON.stringify(PARTIES.map((p) => p.id))};
var PROPOSED = {};

function el(id){ return document.getElementById(id); }
function val(id){ var e = el(id); return e ? e.value.trim() : ''; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function say(t, ok){ var m=el('msg'); m.hidden=false; m.textContent=t; m.className='msg '+(ok?'ok':'err');
  window.scrollTo(0,0); }
function clearSay(){ el('msg').hidden = true; }
function pid(){ return new URLSearchParams(location.search).get('p') || window.PROJECT_ID || ''; }

function paint(){
  var mine = document.querySelector('input[name=self]:checked');
  var n = 0;
  for (var i = 0; i < PARTY_IDS.length; i++) {
    var k = PARTY_IDS[i];
    var on = el('p_' + k).querySelector('.onbox').checked;
    var isMe = !!(mine && mine.value === k);
    var named = !!val('co_' + k);
    if (on) n++;
    el('p_' + k).className = 'p' + (on ? ' on' : '');
    el('mine_' + k).className = 'mine' + (isMe ? ' on' : '');
    el('tba_' + k).hidden = !on || named;

    // THE STATE OF EACH PARTY, READABLE WITHOUT OPENING IT. Four states, and
    // the one that matters most — which of them is you — is the loudest.
    var chip = el('chip_' + k);
    chip.className = 'chip' + (isMe ? ' me' : on ? (named ? ' set' : ' tba') : '');
    chip.textContent = isMe ? 'your organisation'
      : on ? (named ? 'on the project' : 'to be appointed')
      : 'not on this project';

    // A party that is not on the project cannot be your own organisation.
    var r = el('mine_' + k).querySelector('input');
    r.disabled = !on;
    if (!on && r.checked) { r.checked = false; }
  }
  el('count').textContent = n === 0 ? 'Nothing ticked yet.'
    : n + ' part' + (n === 1 ? 'y' : 'ies') + ' on this project'
      + (mine ? '' : ' \\u2014 still need to mark which one is yours');
}

document.addEventListener('input', paint);
document.addEventListener('change', paint);

/* ------------------------------------------------------------------ loading */

async function load(){
  try {
    var r = await fetch('/api/parties?project=' + encodeURIComponent(pid()), { cache: 'no-store' });
    var d = await r.json();
    if (!r.ok) { say(d.error || 'Could not read that project.', false); return; }
    PROPOSED = d.proposed || {};

    var have = {};
    (d.parties || []).forEach(function(p){ have[p.party] = p; });

    for (var i = 0; i < PARTY_IDS.length; i++) {
      var k = PARTY_IDS[i], p = have[k];
      el('p_' + k).querySelector('.onbox').checked = !!p;
      if (p) {
        el('co_' + k).value = p.company_name || '';
        el('cn_' + k).value = p.contact_name || '';
        el('em_' + k).value = p.contact_email || '';
        if (p.is_self) el('mine_' + k).querySelector('input').checked = true;
      }
      // What the contract said, offered rather than forced — a saved name the
      // admin corrected by hand must not be overwritten by a re-read.
      var prop = PROPOSED[k];
      if (prop && prop.found) {
        var same = (p && (p.company_name || '').toLowerCase()) === prop.name.toLowerCase();
        el('from_' + k).hidden = false;
        el('from_' + k).innerHTML = 'The contract says <b>' + esc(prop.name) + '</b>'
          + (prop.page ? ' on page ' + prop.page : '')
          + (prop.said_as ? ' (named as the ' + esc(prop.said_as) + ')' : '');
        if (!p || !p.company_name) {
          el('co_' + k).value = prop.name;
          el('p_' + k).querySelector('.onbox').checked = true;
        } else if (!same) {
          el('use_' + k).hidden = false;
          el('use_' + k).innerHTML = '<a data-use="' + esc(k) + '">Use the contract\\u2019s name instead</a>';
        }
      }
    }

    // A brand-new project has one party — whichever the creator said they were.
    // Nothing else is ticked for them, because the contract is what says who
    // else is on it and it may not have been loaded yet.
    if (!(d.parties || []).length && d.self) {
      el('p_' + d.self).querySelector('.onbox').checked = true;
      el('mine_' + d.self).querySelector('input').checked = true;
    }
    paint();
  } catch (e) { say('Could not reach the server.', false); }
}

document.addEventListener('click', function(e){
  var a = e.target && e.target.getAttribute && e.target.getAttribute('data-use');
  if (!a) return;
  e.preventDefault();
  el('co_' + a).value = (PROPOSED[a] || {}).name || '';
  el('use_' + a).hidden = true;
  paint();
});

/* ------------------------------------------------------------------- saving */

function collect(){
  var out = [], mine = document.querySelector('input[name=self]:checked');
  for (var i = 0; i < PARTY_IDS.length; i++) {
    var k = PARTY_IDS[i];
    if (!el('p_' + k).querySelector('.onbox').checked) continue;
    out.push({ party: k, company_name: val('co_' + k), contact_name: val('cn_' + k),
               contact_email: val('em_' + k), is_self: !!(mine && mine.value === k) });
  }
  return out;
}

async function save(then){
  var list = collect();
  if (!list.length) { say('Tick at least the party your own company is on this project.', false); return false; }
  if (!list.some(function(x){ return x.is_self; })) {
    say('Mark which party is your own organisation. It decides which roles, dashboards and '
      + 'workflow steps you are offered.', false); return false;
  }
  clearSay();
  try {
    var r = await fetch('/api/parties', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: pid(), parties: list }) });
    var d = await r.json();
    if (!d.ok) { say(d.error || 'Could not save that.', false); return false; }
    if (then) { location.href = '/modules?p=' + encodeURIComponent(pid()); return true; }
    say('Saved. ' + list.length + ' part' + (list.length === 1 ? 'y' : 'ies') + ' on this project.', true);
    await load();
    return true;
  } catch (e) { say('Could not reach the server.', false); return false; }
}

el('save').addEventListener('click', function(){ save(true); });
el('saveOnly').addEventListener('click', function(){ save(false); });

load();
${SWITCHER_JS}
${PWA_BOOT}
</script>
${ADMIN_JS('parties')}
</body>
</html>`;
