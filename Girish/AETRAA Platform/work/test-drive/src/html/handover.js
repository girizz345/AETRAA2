import { THEME_CSS } from './theme.js';
import { icon } from './icons.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK, SWITCHER_CSS, SWITCHER_JS } from './shared.js';
import { ADMIN_CSS, ADMIN_BAR, ADMIN_JS } from './admin-nav.js';

// THE LAST THING BEFORE HANDOVER.
//
// Go-live was gated on a list of gaps — is there a BOQ, a programme, a set of
// logos. Every one of those is a count. A count says a thing exists; it does
// not say it is right, and it says nothing at all about whether the screen the
// client opens on Monday morning is worth opening.
//
// So this screen asks the only question that matters at handover: has somebody
// looked at each dashboard the way the person who will live in it is going to
// see it, on this project's real data, and said it is right.
//
// ONLY THE SCREENS SOMEBODY REACHES. The list is built from the people actually
// on the project and the roles they actually hold. A tick against Finance on a
// job with no Finance role held is a tick with nothing behind it, and a
// checklist with filler in it stops being read — which is how the gap list this
// replaces ended up being scrolled past.
//
// EVERY CHECK LAPSES WHEN THE DOCUMENTS CHANGE. Load a folder, move a document,
// clear the project, and the screens that were checked are no longer the
// screens being handed over. The ticks go and are taken again. A tick that
// outlives the thing it was ticking is worse than no tick at all, because it is
// believed.
//
// THE PREVIEW IS READ-ONLY, and the guarantee is not on this page — it is at
// the server's front door, where every write carrying the preview stamp is
// refused before any route sees it. Without that, an Admin checking the QA/QC
// screen could close an NCR in the client's name from a screen whose whole
// purpose was to look at it.

export const handoverHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Handover checks · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}${ADMIN_CSS}
.wrap { max-width: 980px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
        padding: 15px 17px; margin-bottom: 12px; }
.card h2 { margin: 0 0 3px; font-size: var(--fs-body); }
.card .sub { font-size: var(--fs-secondary); color: var(--muted); margin-bottom: 12px; line-height: 1.55; }

.count { display: flex; gap: 16px; align-items: baseline; flex-wrap: wrap; margin-bottom: 4px; }
.count b { font-size: var(--fs-number); font-variant-numeric: tabular-nums; }
.bar { height: 7px; border-radius: 4px; background: var(--surface-2); overflow: hidden; margin: 9px 0 2px; }
.bar i { display: block; height: 100%; background: var(--good); transition: width .25s; }

.rows { display: grid; gap: 1px; background: var(--border); border: 1px solid var(--border);
        border-radius: 10px; overflow: hidden; }
.row { background: var(--surface); padding: 11px 13px; display: flex; gap: 12px;
       align-items: center; flex-wrap: wrap; }
.row.done { background: var(--surface-2); }
.row .what { flex: 1 1 250px; min-width: 0; font-size: var(--fs-secondary); }
.row .what small { display: block; color: var(--muted); font-size: var(--fs-secondary); margin-top: 2px; }
.row .what b.sig { color: var(--good-ink); }
.tick { width: 21px; height: 21px; border-radius: 50%; flex: 0 0 auto; border: 1.5px solid var(--border);
        display: grid; place-items: center; font-size: var(--fs-secondary); color: transparent; }
.tick.on { background: color-mix(in srgb, var(--good-ink) 16%, transparent); border-color: transparent; color: var(--good-ink); }
.tag { font-size: var(--fs-secondary); padding: 1px 7px; border-radius: 5px; background: var(--surface-2);
       border: 1px solid var(--border); color: var(--ink-2); }

.golive { margin-top: 14px; padding-top: 13px; border-top: 1px solid var(--border); }
.btn.big { font-size: var(--fs-body); padding: 10px 20px; }
.btn.go { background: color-mix(in srgb, var(--good-ink) 16%, transparent); color: var(--good-ink); border-color: transparent; }
.btn.go[disabled] { background: var(--surface-2); color: var(--muted); border-color: var(--border); }
.note { font-size: var(--fs-secondary); color: var(--muted); margin-top: 9px; line-height: 1.6; }
.empty { padding: 22px 4px; color: var(--muted); font-size: var(--fs-secondary); }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Handover checks</h1><div class="sub">every screen, as the person who will use it sees it</div></div>
  <div class="spacer"></div>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  <a class="btn" href="/home">All projects</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  ${ADMIN_BAR}

  <div id="msg" class="msg" hidden></div>

  <div class="card">
    <h2>Test</h2>
    <div class="sub">
      Try the work itself, not just the screens: every position down the left, their real dashboard beside it,
      every workflow run for real. It all happens on a test copy of this project; <b>Complete test</b> deletes
      every test record before go-live. The real project is never touched.
    </div>
    <a class="btn prim" id="tdOpen" href="#">Open the Test tab</a>
    <span class="note" id="tdNote" style="margin-left:10px"></span>
  </div>

  <div class="card">
    <div class="count"><b id="n">—</b><span class="sub" style="margin:0" id="nsub"></span></div>
    <div class="bar"><i id="barfill" style="width:0"></i></div>
    <div class="sub" style="margin-top:9px">
      Open each one as the role that will use it. You will see this project's real data in the real
      application — nothing there can be changed. Come back and sign it off.
    </div>
    <div class="rows" id="rows"></div>

    <div class="golive">
      <button class="btn big go" id="golive" disabled>Go live</button>
      <div class="note" id="note"></div>
    </div>
  </div>
</div>

<script>
var V = null;

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
function when(s){ return s ? String(s).slice(0,10) : ''; }

function paint(d){
  V = d;
  var live = d.project.state !== 'draft';

  if (d.nobody) {
    el('n').textContent = '—';
    el('nsub').textContent = 'nothing to check yet';
    el('barfill').style.width = '0';
    el('rows').innerHTML = '<div class="empty">Nobody is on this project, so there are no dashboards '
      + 'to check. Add the people first \\u2014 the screens to check are worked out from the roles '
      + 'they hold.<div style="margin-top:11px"><a class="btn" href="/org?p='
      + encodeURIComponent(pid()) + '">Set the organisation</a></div></div>';
  } else {
    el('n').textContent = d.done + ' / ' + d.total;
    el('nsub').textContent = d.ready ? 'every screen checked'
      : (d.total - d.done) + ' still to look at';
    el('barfill').style.width = (d.total ? Math.round(100 * d.done / d.total) : 0) + '%';

    el('rows').innerHTML = d.rows.map(function(r, i){
      var s = r.signed;
      return '<div class="row' + (s ? ' done' : '') + '">'
           + '<div class="tick' + (s ? ' on' : '') + '">${icon('check', 14)}</div>'
           + '<div class="what"><b>' + esc(r.label) + '</b>'
           + '<small>As <b>' + esc(r.as_label) + '</b> \\u2014 ' + esc((r.who || []).join(', ')) + '</small>'
           + (s ? '<small><b class="sig">Checked</b> by ' + esc(s.by) + ' on ' + esc(when(s.at)) + '</small>' : '')
           + '</div>'
           + '<a class="btn" target="_blank" rel="noopener" href="/preview?p=' + encodeURIComponent(pid())
           + '&as=' + encodeURIComponent(r.as) + '">Open as ' + esc(r.as_label) + '</a>'
           + (s ? '<button class="btn" data-un="' + i + '">Undo</button>'
                : '<button class="btn prim" data-sign="' + i + '">Checked \\u2014 sign off</button>')
           + '</div>';
    }).join('');

    Array.prototype.forEach.call(el('rows').querySelectorAll('[data-sign]'), function(b){
      b.addEventListener('click', function(){ mark('sign', d.rows[Number(b.getAttribute('data-sign'))], b); });
    });
    Array.prototype.forEach.call(el('rows').querySelectorAll('[data-un]'), function(b){
      b.addEventListener('click', function(){ mark('unsign', d.rows[Number(b.getAttribute('data-un'))], b); });
    });
  }

  var btn = el('golive');
  btn.disabled = live || !d.ready;
  btn.textContent = live ? 'Already live' : 'Go live';
  el('note').textContent = live
    ? 'This project is live. Its people can sign in, and documents can no longer be deleted — only '
      + 'superseded or withdrawn.'
    : (d.nobody
        ? 'Add the people first. A project with nobody on it cannot be handed over to anybody.'
        : (d.ready
            ? 'Every screen has been looked at. Going live lets this client\\u2019s people sign in and '
              + 'closes deletion for good. It cannot be undone from here.'
            : 'Look at the rest first. A screen nobody has opened is one the client opens instead of you.'));
}

async function mark(action, row, btn){
  btn.disabled = true;
  try {
    var r = await fetch('/api/handover', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action, project_id: pid(), dash: row.dash, as: row.as }) });
    var d = await r.json();
    if (d.error) { say(d.error, false); btn.disabled = false; return; }
    clearSay();
    d.project = V.project;
    paint(d);
  } catch (e) { say('Could not reach the server.', false); btn.disabled = false; }
}

el('golive').addEventListener('click', async function(){
  if (!V || !V.ready) return;
  var name = V.project.name || 'this project';
  if (!confirm('Take ' + name + ' live?\\n\\nIts people can sign in from that moment, and documents '
    + 'can no longer be deleted. This cannot be undone here.')) return;
  this.disabled = true;
  try {
    var r = await fetch('/api/setup/golive', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: V.project.id }) });
    var d = await r.json();
    if (d.ok) { say('Live. ' + name + ' has been handed over.', true); load(); }
    else { say(d.error || 'Could not take it live.', false); this.disabled = false; }
  } catch (e) { say('Could not reach the server.', false); this.disabled = false; }
});

async function loadTD(){
  el('tdOpen').href = '/testdrive?p=' + encodeURIComponent(pid());
  try {
    var r = await fetch('/api/testdrive?project=' + encodeURIComponent(pid()), { cache: 'no-store' });
    var d = await r.json();
    el('tdNote').textContent = d.running
      ? 'Testing is under way \u2014 ' + d.actions + ' actions so far. Complete the test before going live.'
      : 'No test running.';
  } catch (e) {}
}

async function load(){
  clearSay();
  loadTD();
  try {
    var r = await fetch('/api/handover?project=' + encodeURIComponent(pid()), { cache: 'no-store' });
    var d = await r.json();
    if (!r.ok) { say(d.error || 'Could not read that project.', false); return; }
    paint(d);
  } catch (e) { say('Could not reach the server.', false); }
}



// Coming back from a preview tab should show what changed while it was open.
document.addEventListener('visibilitychange', function(){ if (!document.hidden && V) load(); });


load();
${SWITCHER_JS}
${PWA_BOOT}
</script>
${ADMIN_JS('handover')}
</body>
</html>`;
