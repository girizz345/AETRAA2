import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK, SWITCHER_CSS, SWITCHER_JS } from './shared.js';
import { ADMIN_CSS, ADMIN_BAR, ADMIN_JS } from './admin-nav.js';

// THE PROJECT PAGE — what is loaded, what is missing, and the way out of setup.
//
// The problem this exists for: a project's contents were spread across five
// screens and no screen said what a project HELD. An Admin who loaded 226
// documents had no way to confirm they had landed — the drawing register opens
// on a stage that was empty, the library is elsewhere, the BOQ elsewhere again.
// The first time anyone counted was when a customer asked where his drawings had
// gone, and they had been there all along, on a tab he had not clicked.
//
// So this answers one question: is this project ready to hand over, and if not,
// what is missing. THE GAPS ARE THE POINT. Everything that would embarrass
// AETRAA at handover — nobody able to sign in, no BOQ, no gate, no logos — is
// named here rather than discovered by the client.
//
// GO LIVE IS THE LAST THING ON THE PAGE, and it is disabled while a gap remains.
// That ordering is deliberate: handover is the moment the client's people can
// sign in and, by the access model, the moment AETRAA's own reach over the
// project ends. It should not be possible to do that from a screen that has not
// shown you what you are handing over.
//
// Every count links to the screen that holds it, so this is a way IN to the work
// as well as a check on it. It carries no forms of its own: the setup cards and
// intake already own those, and a second copy of a form is a second place for
// them to disagree.

export const projectHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Project · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}${ADMIN_CSS}
.wrap { max-width: 1000px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
        padding: 15px 17px; margin-bottom: 12px; }
.card h2 { margin: 0 0 3px; font-size: var(--fs-body); }
.card .sub { font-size: var(--fs-secondary); color: var(--muted); margin-bottom: 11px; }

.hd { display: flex; gap: 14px; align-items: flex-start; flex-wrap: wrap; }
.hd .main { flex: 1 1 320px; min-width: 0; }
.hd h2 { font-size: var(--fs-headline); margin: 0 0 2px; }
.state { display: inline-block; font-size: var(--fs-label); font-weight: 500; letter-spacing: .05em;
         text-transform: uppercase; padding: 3px 9px; border-radius: 6px; }
.state.draft { background: color-mix(in srgb, var(--warn-ink) 16%, transparent); color: var(--warn-ink); }
.state.live  { background: color-mix(in srgb, var(--good-ink) 16%, transparent); color: var(--good-ink); }

.rows { display: grid; gap: 1px; background: var(--border); border: 1px solid var(--border);
        border-radius: 10px; overflow: hidden; }
.row { background: var(--surface); padding: 10px 13px; display: flex; gap: 12px;
       align-items: center; flex-wrap: wrap; }
.row .what { flex: 1 1 210px; min-width: 0; font-size: var(--fs-secondary); }
.row .what small { display: block; color: var(--muted); font-size: var(--fs-secondary); margin-top: 2px; }
.row .num { font-size: var(--fs-body); font-weight: 500; font-variant-numeric: tabular-nums; }
.row .num.zero { color: var(--muted); font-weight: 500; }
.row .go { font-size: var(--fs-secondary); }

.gaps { list-style: none; margin: 0; padding: 0; }
.gaps li { padding: 9px 12px 9px 32px; position: relative; font-size: var(--fs-secondary);
           border: 1px solid var(--border); border-radius: 9px; margin-bottom: 7px;
           background: var(--surface-2); }
.gaps li::before { content: '!'; position: absolute; left: 11px; top: 9px; width: 15px; height: 15px;
                   border-radius: 50%; background: color-mix(in srgb, var(--warn-ink) 16%, transparent); color: var(--warn-ink); font-size: var(--fs-secondary);
                   font-weight: 500; text-align: center; line-height: 15px; }
.allclear { padding: 12px; border-radius: 10px; background: var(--surface-2);
            border: 1px solid var(--border); font-size: var(--fs-secondary); }

.golive { margin-top: 13px; padding-top: 13px; border-top: 1px solid var(--border); }
.golive .note { font-size: var(--fs-secondary); color: var(--muted); margin-top: 8px; line-height: 1.6; }
.btn.big { font-size: var(--fs-body); padding: 10px 20px; }
.btn.danger { background: color-mix(in srgb, var(--good-ink) 16%, transparent); color: var(--good-ink); border-color: transparent; }
.btn.danger[disabled] { background: var(--surface-2); color: var(--muted); border-color: var(--border); }

.person { display: flex; gap: 10px; align-items: center; padding: 8px 0; font-size: var(--fs-secondary);
          border-bottom: 1px solid var(--border); }
.person:last-child { border-bottom: 0; }
.pill { font-size: var(--fs-secondary); padding: 2px 7px; border-radius: 5px; background: var(--surface-2);
        border: 1px solid var(--border); color: var(--ink-2); }
.pill.invited { background: color-mix(in srgb, var(--warn-ink) 16%, transparent); color: var(--warn-ink); border-color: transparent; }
.muted { color: var(--muted); }

/* The irreversible pair. Kept visually apart from the rest of the page, and
   behind a name that has to be typed — an id is one keypress from the wrong
   project, a name has to be read off the screen deliberately. */
.zone { border-color: color-mix(in srgb, var(--warn-ink) 45%, transparent); }
.zone h2 { color: var(--warn-ink); }
.row.confirm { background: var(--surface-2); }
/* Not .btn.danger — that is go-live's green, and redefining it here would have
   turned the handover button red. */
.btn.kill { background: color-mix(in srgb, var(--bad-ink) 16%, transparent); color: var(--bad-ink); border-color: transparent; }
.btn.kill[disabled] { background: var(--surface-2); color: var(--muted); border-color: var(--border); }
.row.stale .what small { color: var(--critical); font-weight: 500; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Project</h1><div class="sub">what is loaded, and what is missing</div></div>
  <div class="spacer"></div>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  <a class="btn" href="/home">All projects</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  ${ADMIN_BAR}

  <div id="msg" class="msg" hidden></div>
  <div id="body" hidden>

    <div class="card hd">
      <div class="main">
        <h2 id="pname">—</h2>
        <div class="sub" id="pref"></div>
      </div>
      <div><span class="state" id="pstate">—</span></div>
    </div>

    <div class="card">
      <h2>Documents</h2>
      <div class="sub">Everything dropped through intake, by where it landed.</div>
      <div class="rows" id="docRows"></div>
    </div>

    <div class="card">
      <h2>Commercial &amp; programme</h2>
      <div class="sub">The figures every certificate is computed from.</div>
      <div class="rows" id="comRows"></div>
    </div>

    <div class="card">
      <h2>Setup</h2>
      <div class="sub">How this project's documents are numbered, branded and governed.</div>
      <div class="rows" id="setRows"></div>
    </div>

    <div class="card">
      <h2>People</h2>
      <div class="sub">Who can sign in. Nobody can until the project is live.</div>
      <div id="people"></div>
      <div style="margin-top:10px"><a class="btn" href="/people">Add or change people</a></div>
    </div>

    <div class="card">
      <h2 id="readyH">Ready to hand over?</h2>
      <div class="sub">Everything below must be cleared before this project can go live.</div>
      <ul class="gaps" id="gaps"></ul>
      <div class="allclear" id="allclear" hidden>
        Nothing outstanding. Going live lets this client's people sign in.
      </div>

      <div class="golive" id="goliveWrap">
        <!-- Go-live is taken on the handover screen now, because the last thing
             before handover is looking at each dashboard as its people will,
             and that has to happen where the button is. -->
        <a class="btn big" id="toChecks" href="/handover">Handover checks</a>
        <button class="btn big danger" id="golive" disabled>Go live</button>
        <div class="note" id="goliveNote"></div>
      </div>
    </div>

    <div class="card zone">
      <h2>Irreversible</h2>
      <div class="sub">Both of these are permanent. Neither can be undone from here.</div>

      <div class="rows">
        <div class="row">
          <div class="what">Clear uploaded documents
            <small>Removes the drawings, the library and the intake history, so the folder can be
                   dropped again from scratch. The terms, BOQ, programme, gate and logos stay.</small></div>
          <button class="btn" id="clrBtn">Clear documents</button>
        </div>
        <div class="row confirm" id="clrRow" hidden>
          <div class="what">Type the project name to confirm<small id="clrName"></small></div>
          <input id="clrIn" class="proj" style="flex:1 1 240px" placeholder="project name" autocomplete="off">
          <button class="btn kill" id="clrGo">Clear</button>
          <button class="btn" id="clrNo">Cancel</button>
        </div>

        <div class="row">
          <div class="what">Delete this project
            <small>The project and everything in it — documents, BOQ, programme, records. The audit
                   line saying it existed is kept.</small></div>
          <button class="btn" id="delBtn">Delete project</button>
        </div>
        <div class="row confirm" id="delRow" hidden>
          <div class="what">Type the project name to confirm<small id="delName"></small></div>
          <input id="delIn" class="proj" style="flex:1 1 240px" placeholder="project name" autocomplete="off">
          <button class="btn kill" id="delGo">Delete for good</button>
          <button class="btn" id="delNo">Cancel</button>
        </div>
      </div>
    </div>

  </div>
</div>

<script>
var CHECK = null;

function el(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function say(t, ok){ var m=el('msg'); m.hidden=false; m.textContent=t; m.className='msg '+(ok?'ok':'err'); }
function clearSay(){ el('msg').hidden = true; }

// THE PROGRAMME ROW SAYS WHETHER IT IS CURRENT. Every forecast date on every
// dashboard and in every report is read from the programme; a weekly update
// that was skipped is all of them drifting, and nothing used to say so.
function programmeRow(pg){
  var f = pg.fresh || {};
  var sub = !pg.activities ? 'no programme loaded'
    : f.no_logic ? 'NO LOGIC \u2014 ' + pg.activities + ' activities but no links, so no critical path. '
                 + 'Load the .xer on the Programme section in Documents.'
    : f.stale ? 'OUT OF DATE \u2014 data date ' + (f.data_date || 'not recorded')
                + (f.days_old != null ? ', ' + f.days_old + ' days old' : '') + '. The weekly update was missed.'
    : 'current \u2014 data date ' + (f.data_date || 'not recorded')
      + (f.days_old != null ? ' (' + f.days_old + ' day' + (f.days_old === 1 ? '' : 's') + ' old)' : '');
  var html = row('Programme', sub, pg.activities || 0, '/programme', 'Programme');
  return (f.stale || f.no_logic) ? html.replace('<div class="row">', '<div class="row stale">') : html;
}

// The project, from the address — there before any script runs.
function pid(){ return new URLSearchParams(location.search).get('p') || window.PROJECT_ID || ''; }
// This project's Setup, never the console of every project.
function setupAt(){ return '/setup?p=' + encodeURIComponent(pid()); }

function row(what, sub, n, href, label){
  var zero = !n;
  return '<div class="row"><div class="what">' + esc(what)
       + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>'
       + '<div class="num' + (zero ? ' zero' : '') + '">' + esc(String(n)) + '</div>'
       + (href ? '<a class="btn go" href="' + href + '">' + esc(label || 'Open') + '</a>' : '')
       + '</div>';
}
function yesNo(what, sub, ok, href, label){
  return '<div class="row"><div class="what">' + esc(what)
       + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>'
       + '<div class="num' + (ok ? '' : ' zero') + '">' + (ok ? 'set' : 'not set') + '</div>'
       + (href ? '<a class="btn go" href="' + href + '">' + esc(label || 'Open') + '</a>' : '')
       + '</div>';
}

function money(n){
  if (!n) return '—';
  return 'AED ' + Number(n).toLocaleString('en-AE', { maximumFractionDigits: 2 });
}

function paint(d){
  CHECK = d;
  el('body').hidden = false;
  el('pname').textContent = d.project.name || '—';
  el('pref').textContent = (d.project.ref || '') + (d.project.contract ? ' · ' + money(d.project.contract) : '');
  var st = el('pstate');
  st.textContent = d.project.state === 'draft' ? 'In setup' : 'Live';
  st.className = 'state ' + (d.project.state === 'draft' ? 'draft' : 'live');

  // Documents. Drawings are shown live-vs-total because a register of 160 rows
  // holding 105 current sheets is the normal, and confusing, case.
  var dw = d.drawings || { total: 0, live: 0, by_kind: {} };
  var LABEL = { tender: 'Tender drawings', ifc: 'IFC drawings', shop: 'Shop drawings',
                asbuilt: 'As-built drawings', sketch: 'Sketches / SK', spec: 'Specification sheets',
                other: 'Unsorted \u2014 stage not stated' };
  var pq = '?p=' + encodeURIComponent(d.project.id) + '&s=';
  // Each stage opens the section that holds it. The old link landed on the
  // register's default tab, which is how 226 filed documents looked like none.
  var kinds = Object.keys(dw.by_kind || {}).map(function(k){
    return row(LABEL[k] || k, dw.by_kind[k].live + ' current of ' + dw.by_kind[k].total,
      dw.by_kind[k].total, '/files' + pq + 'dwg.' + k, 'Open');
  }).join('');
  el('docRows').innerHTML =
      row('Drawing register', dw.total ? dw.live + ' current sheets' : 'nothing yet', dw.total, '/drawings', 'Register')
    + kinds
    + row('Library', Object.keys((d.library||{}).by_class||{}).length + ' classes',
          (d.library||{}).total || 0, '/files' + pq + 'lib.contract', 'Open')
    + '<div class="row"><div class="what">Add documents<small>Drop them on the section they belong in, '
    + 'or drop a whole folder and let the extractor sort it</small></div>'
    + '<a class="btn go" href="/files' + pq + 'dwg.ifc">Document control</a>'
    + '<a class="btn go" href="/intake">Folder drop</a></div>';

  el('comRows').innerHTML =
      row('Priced BOQ', (d.boq||{}).total ? money(d.boq.total) + ' imported' : 'no bill imported',
          (d.boq||{}).lines || 0, '/files' + pq + 'fig.boq', 'Open')
    + programmeRow(d.programme || {})
    // EVERY SHORTCUT CARRIES THE PROJECT. These went to plain /setup, which is
    // the console of every company and every project — the "it goes to all
    // projects" the operator reported, reached from this page too.
    + yesNo('Payment terms', 'what every certificate follows', (d.terms||{}).payment, setupAt(), 'Setup')
    + yesNo('Contract reference', 'bond, insurance, damages, dates', (d.terms||{}).contract_ref, setupAt(), 'Setup');

  var br = d.branding || { set: 0, of: 4, missing: [] };
  el('setRows').innerHTML =
      row('Organisation', 'roles, disciplines, dashboards and the approval ladders',
          (d.people || []).length, '/org' + pq.replace('&s=', ''), 'Organisation')
    +
      row('Drawing gate', (d.gate||{}).configured ? 'numbering rules in force' : 'not configured', (d.gate||{}).rules || 0, setupAt(), 'Setup')
    + row('Logos', br.missing.length ? 'missing: ' + br.missing.join(', ') : 'all set', br.set + ' of ' + br.of, setupAt(), 'Branding')
    + row('Modules', 'what each party on this project runs', d.project.modules || 0,
          '/modules?p=' + encodeURIComponent(pid()), 'Modules')
    + row('Dashboards', 'the real dashboard each position will see', (d.people || []).length,
          setupAt(), 'See them');

  var ppl = d.people || [];
  el('people').innerHTML = ppl.length
    ? ppl.map(function(p){
        var invited = (p.status || '') === 'invited';
        return '<div class="person"><div style="flex:1 1 auto">' + esc(p.name || '—') + '</div>'
             + '<span class="pill">' + esc(p.role || '') + '</span>'
             + '<span class="pill' + (invited ? ' invited' : '') + '">' + esc(p.status || '') + '</span></div>';
      }).join('')
    : '<div class="muted" style="font-size:var(--fs-secondary)">Nobody yet — no one at this client can sign in.</div>';

  var gaps = d.gaps || [];
  el('gaps').innerHTML = gaps.map(function(g){ return '<li>' + esc(g) + '</li>'; }).join('');
  el('allclear').hidden = gaps.length > 0;
  el('readyH').textContent = gaps.length
    ? 'Not ready — ' + gaps.length + (gaps.length === 1 ? ' thing outstanding' : ' things outstanding')
    : 'Ready to hand over';

  var live = d.project.state !== 'draft';
  el('toChecks').href = '/handover?p=' + encodeURIComponent(d.project.id);
  el('toChecks').hidden = live;
  var btn = el('golive');
  btn.disabled = live || gaps.length > 0;
  btn.textContent = live ? 'Already live' : 'Go live';
  el('goliveNote').textContent = live
    ? 'This project is live. Its people can sign in, and documents can no longer be deleted — only superseded or withdrawn.'
    : (gaps.length
        ? 'Clear the list above first. Going live with a gap means the client finds it, not you.'
        : 'This lets the client\\u2019s people sign in, and closes deletion for good. It cannot be undone from here.');
}

async function load(){
  // The address, not a global another script tag may not have set yet.
  var pid = window.PROJECT_ID || new URLSearchParams(location.search).get('p') || '';
  if (!pid) return;
  clearSay();
  el('body').hidden = true;
  try {
    var r = await fetch('/api/project-check?project=' + encodeURIComponent(pid), { cache: 'no-store' });
    var d = await r.json();
    if (!r.ok) { say(d.error || 'Could not read that project.', false); return; }
    paint(d);
  } catch (e) { say('Could not reach the server.', false); }
}



el('golive').addEventListener('click', async function(){
  if (!CHECK || (CHECK.gaps || []).length) return;
  var name = CHECK.project.name || 'this project';
  if (!confirm('Take ' + name + ' live?\\n\\nIts people can sign in from that moment, and documents can no longer be deleted. This cannot be undone here.')) return;
  this.disabled = true;
  try {
    var r = await fetch('/api/setup/golive', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: CHECK.project.id }) });
    var d = await r.json();
    if (d.ok) { say('Live. ' + name + ' has been handed over.', true); load(); }
    else { say(d.error || 'Could not take it live.', false); this.disabled = false; }
  } catch (e) { say('Could not reach the server.', false); this.disabled = false; }
});

/* The irreversible pair.
 *
 * The typed name is not theatre: two projects on this platform have carried the
 * SAME name under different ids, one a demo and one a customer's, differing by a
 * single character in the id. A confirm dialog would have been clicked through.
 * Typing the name makes the operator read what is in front of him.
 *
 * The server checks it again anyway — this is the second lock, not the only one.
 */
function wireDanger(openBtn, rowId, nameEl, input, goBtn, noBtn, run){
  el(openBtn).addEventListener('click', function(){
    if (!CHECK) return;
    el(rowId).hidden = false;
    el(nameEl).textContent = CHECK.project.name;
    el(input).value = '';
    el(input).focus();
  });
  el(noBtn).addEventListener('click', function(){ el(rowId).hidden = true; });
  el(goBtn).addEventListener('click', async function(){
    if (!CHECK) return;
    var typed = el(input).value.trim();
    if (typed !== (CHECK.project.name || '').trim()) {
      say('The name does not match. Nothing was changed.', false);
      return;
    }
    this.disabled = true;
    try { await run(typed); } finally { this.disabled = false; }
  });
}

wireDanger('clrBtn','clrRow','clrName','clrIn','clrGo','clrNo', async function(name){
  var r = await fetch('/api/project', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ action:'clear-documents', id: CHECK.project.id, confirm_name: name }) });
  var d = await r.json();
  if (d.ok) { say('Documents cleared. The folder can be dropped again from scratch.', true);
              el('clrRow').hidden = true; load(); }
  else say(d.error || 'Could not clear the documents.', false);
});

wireDanger('delBtn','delRow','delName','delIn','delGo','delNo', async function(name){
  var r = await fetch('/api/project', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ action:'delete', id: CHECK.project.id, confirm_name: name }) });
  var d = await r.json();
  // The project is gone, so there is nothing on this screen to return to.
  if (d.ok) { location.href = '/home'; return; }
  say(d.error || 'Could not delete the project.', false);
});


// The bar puts the project in the address into window.PROJECT_ID before this runs.
load();
${SWITCHER_JS}
${PWA_BOOT}
</script>
${ADMIN_JS('overview')}
</body>
</html>`;
