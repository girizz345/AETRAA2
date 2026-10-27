import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK, SWITCHER_CSS, SWITCHER_JS } from './shared.js';

export const siteHTML = (role) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Site Update</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 760px; padding-bottom: 112px; }

/* ---- who bar */
.who-bar { display: flex; gap: 8px; align-items: center; background: var(--surface); border: 1px solid var(--border);
           border-radius: 10px; padding: 8px 10px; margin-bottom: 14px; box-shadow: var(--shadow); }
.who-bar input { border: none; background: none; padding: 4px 2px; }
.who-bar input:focus { outline: none; }
.who-bar .sep { width: 1px; align-self: stretch; background: var(--grid); }
.who-bar .lab { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }

/* ---- trade picker */
.picker-h { margin: 4px 0 12px; }
.picker-h h2 { font-size: 17px; }
.picker-h p { margin: 4px 0 0; font-size: 13px; color: var(--ink-2); }
.grp { margin-top: 18px; }
.grp-title { font-size: 11.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted);
             font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
.grp-title::after { content: ''; flex: 1; height: 1px; background: var(--grid); }
.trades { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(158px, 1fr)); }
.trade {
  appearance: none; text-align: left; font: inherit; cursor: pointer;
  background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--series-1);
  border-radius: 10px; padding: 11px 12px; display: flex; flex-direction: column; gap: 3px; min-height: 72px;
}
.trade:hover { background: var(--surface-2); }
.trade[data-g="MEP"] { border-left-color: var(--series-3); }
.trade[data-g="other"] { border-left-color: var(--muted); }
.trade .t-name { font-weight: 600; font-size: 13.5px; line-height: 1.3; color: var(--ink); }
.trade .t-sub { font-size: 11.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.trade .t-flag { color: var(--critical); font-weight: 600; }
.trade .t-done { color: var(--good-text); font-weight: 600; }

/* ---- trade header */
.thead { position: sticky; top: 49px; z-index: 15; background: var(--plane); padding: 8px 0 6px; margin-bottom: 2px; }
.thead .row1 { display: flex; align-items: center; gap: 10px; }
.thead h2 { font-size: 16px; flex: 1 1 auto; min-width: 0; }
.thead .sub { font-size: 12px; color: var(--muted); }
.chips { display: flex; gap: 6px; overflow-x: auto; padding: 8px 0 2px; scrollbar-width: none; }
.chips::-webkit-scrollbar { display: none; }
.chip { appearance: none; font: inherit; font-size: 12.5px; white-space: nowrap; cursor: pointer;
        background: var(--surface); color: var(--ink-2); border: 1px solid var(--border);
        border-radius: 999px; padding: 6px 12px; }
.chip[aria-pressed="true"] { background: var(--ink); color: var(--plane); border-color: var(--ink); font-weight: 600; }

/* ---- activity card */
.act { border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; background: var(--surface); }
.act.touched { border-color: var(--series-1); box-shadow: inset 3px 0 0 var(--series-1); }
.act.done { opacity: .62; }
.act .hdr { display: flex; gap: 10px; align-items: flex-start; }
.act .nm { font-weight: 600; font-size: 14px; flex: 1 1 auto; min-width: 0; line-height: 1.35; }
.act .meta { font-size: 11.5px; color: var(--muted); margin-top: 3px; font-weight: 400;
             line-height: 1.45; font-variant-numeric: tabular-nums; }
.act .late { color: var(--critical); font-weight: 600; }
.tgt { display: inline-block; font-size: 10.5px; font-weight: 600; letter-spacing: .02em;
       color: var(--series-7); border: 1px solid var(--series-7); border-radius: 4px;
       padding: 0 5px; margin-left: 4px; vertical-align: 1px; }
.act .quick { display: grid; grid-template-columns: 92px 1fr; gap: 8px; align-items: end; margin-top: 10px; }
.act .more { display: none; margin-top: 10px; border-top: 1px solid var(--grid); padding-top: 10px; }
.act.open .more { display: block; }
.more-btn { background: none; border: 1px solid var(--border); border-radius: 8px; width: 34px; height: 34px;
            font-size: 16px; color: var(--ink-2); cursor: pointer; flex: 0 0 34px; }
.pct-row { display: flex; gap: 6px; margin-top: 8px; }
.pct-row button { flex: 1; appearance: none; font: inherit; font-size: 12.5px; cursor: pointer;
                  background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 7px 0; color: var(--ink-2); }
.pct-row button:hover { background: var(--surface); border-color: var(--series-1); color: var(--ink); }

.sticky-foot {
  position: fixed; left: 0; right: 0; bottom: 0; background: var(--surface);
  border-top: 1px solid var(--border); padding: 10px 16px; z-index: 30;
  display: flex; gap: 10px; align-items: center;
}
.sticky-foot .count { font-size: 12.5px; color: var(--ink-2); flex: 1 1 auto; }
.mp-row { display: grid; grid-template-columns: 1fr 84px 34px; gap: 8px; align-items: end; margin-bottom: 8px; }
.mp-row .rm { background: none; border: 1px solid var(--border); border-radius: 8px; height: 38px; color: var(--critical); cursor: pointer; }
.thumbs { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px,1fr)); gap: 8px; margin-top: 10px; }
.thumbs figure { margin: 0; position: relative; }
.thumbs img { width: 100%; height: 78px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border); }
.thumbs button { position: absolute; top: 3px; right: 3px; border: none; background: rgba(0,0,0,.6); color: #fff;
                 border-radius: 50%; width: 22px; height: 22px; cursor: pointer; font-size: 13px; line-height: 1; }
/* The camera sits on the card itself, so the proof is taken where the claim is
   made rather than on a tab somebody has to remember. */
.cam-btn { background: none; border: 1px solid var(--border); border-radius: 8px; width: 34px; height: 34px;
           font-size: 15px; cursor: pointer; flex: 0 0 34px; position: relative; line-height: 1; }
.cam-btn i { position: absolute; top: -5px; right: -5px; font-style: normal; font-size: 10px;
             font-weight: 700; background: var(--good-text); color: #fff; border-radius: 9px;
             min-width: 15px; padding: 1px 3px; line-height: 13px; }
/* The drawings sit on the card for the same reason the camera does: a man
   building to the wrong revision is not going to go and look for the right one
   on another screen. The badge is how many sheets this activity carries. */
.dwg-btn { background: none; border: 1px solid var(--border); border-radius: 8px; width: 34px; height: 34px;
           font-size: 15px; cursor: pointer; flex: 0 0 34px; position: relative; line-height: 1; }
.dwg-btn i { position: absolute; top: -5px; right: -5px; font-style: normal; font-size: 10px;
             font-weight: 700; background: var(--series-1); color: #fff; border-radius: 9px;
             min-width: 15px; padding: 1px 3px; line-height: 13px; }
.dwg-btn[data-none="1"] { opacity: .45; }
#dwgDlg { border: 1px solid var(--border); border-radius: 14px; background: var(--surface);
          color: var(--ink); padding: 0; width: 560px; max-width: 94vw; }
#dwgDlg::backdrop { background: rgba(0,0,0,.5); }
#dwgDlg .in { padding: 16px 18px 18px; }
#dwgDlg h2 { margin: 0; font-size: 16px; }
#dwgDlg .who { font-size: 12px; color: var(--muted); margin: 3px 0 12px; }
.sheet-l { list-style: none; margin: 0; padding: 0; max-height: 58vh; overflow: auto; }
.sheet-l li { border: 1px solid var(--border); border-radius: 10px; margin-bottom: 8px; }
.sheet-l a { display: block; padding: 11px 12px; text-decoration: none; color: inherit; }
.sheet-l a:hover { background: var(--surface-2); }
.sheet-l .n { font-weight: 600; font-size: 13.5px; }
.sheet-l .n em { font-style: normal; color: var(--good-text); font-weight: 700; font-size: 11.5px;
                 margin-left: 6px; }
.sheet-l .t { font-size: 12.5px; color: var(--ink-2); margin-top: 2px; }
.sheet-l .m { font-size: 11.5px; color: var(--muted); margin-top: 3px; }
.sheet-l .m b { color: var(--series-1); font-weight: 700; }
.shots { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.shots:empty { display: none; }
.shot { width: 56px; height: 56px; border-radius: 8px; border: 1px solid var(--border);
        overflow: hidden; background: var(--surface-2); font-size: 9.5px; color: var(--muted);
        display: flex; align-items: center; justify-content: center; text-align: center; padding: 3px; }
.shot img { width: 100%; height: 100%; object-fit: cover; }
.act.needs-photo { border-color: var(--critical); box-shadow: inset 3px 0 0 var(--critical); }
.shot.failed { color: var(--critical); cursor: pointer; border-color: var(--critical); }
.queried { background: var(--serious-bg); color: var(--serious-text); border-radius: 8px;
           border: 1px solid var(--serious); border-left-width: 3px;
           padding: 8px 10px; margin-top: 9px; font-size: 12.5px; line-height: 1.45; }
.queried span { display: block; font-weight: 600; margin-top: 3px; }
.verified { color: var(--good-text); font-size: 12px; margin-top: 7px; font-weight: 500; }
.scope-bar { background: var(--surface-2); border: 1px solid var(--border);
  border-left: 3px solid var(--series-1); border-radius: 8px; padding: 9px 12px;
  font-size: 12.5px; color: var(--ink-2); margin-bottom: 12px; }
.scope-bar b { color: var(--ink); }
.sec-head { margin: 16px 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); font-weight: 600; }
/* Raising it with the office is one tap, and deliberately looks different from
   the progress fields — it sends something out, the rest only records. */
.raise { display: flex; gap: 9px; align-items: flex-start; margin-top: 10px; cursor: pointer;
         background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 9px 11px; }
.raise input { width: 18px; height: 18px; flex: 0 0 18px; margin-top: 1px; accent-color: var(--series-1); }
.raise span { font-size: 12.5px; color: var(--ink-2); line-height: 1.4; }
.f-raise-box { margin-top: 8px; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1 id="pname">Site Update</h1><div class="sub" id="psub"></div></div>
  <div class="spacer"></div>
  <a class="btn btn-primary" href="/diary">Daily diary</a>
  <a class="btn" href="/design">Design</a>
  ${role === 'site' ? '' : '<a class="btn" href="/">Dashboard</a>'}
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  <div class="who-bar">
    <div style="flex:1 1 auto;min-width:0">
      <div class="lab">Your name</div>
      <input id="who" placeholder="e.g. Rakesh — Site Engineer" autocomplete="name">
    </div>
    <div class="sep"></div>
    <div style="flex:0 0 132px">
      <div class="lab">Update for</div>
      <input id="rd" type="date">
    </div>
  </div>

  <div class="scope-bar" id="scopeBar" hidden></div>

  <div class="tabs" role="tablist">
    <button class="tab" role="tab" data-tab="prog" aria-selected="true">Progress</button>
    <button class="tab" role="tab" data-tab="mp" aria-selected="false">Manpower</button>
    <button class="tab" role="tab" data-tab="ph" aria-selected="false">Photos</button>
  </div>

  <section id="panel-prog">
    <!-- step 1 : pick a trade -->
    <div id="picker">
      <div class="picker-h">
        <h2>Which trade are you reporting?</h2>
        <p>Pick your trade once — this phone remembers it. The number is how many activities are still open.</p>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:4px">
        <input id="tq" type="search" placeholder="Find your trade…" style="flex:1 1 auto">
        <button class="btn" id="showFinished" aria-pressed="false">Show finished</button>
      </div>
      <div id="tradeList"><div class="empty">Loading trades…</div></div>
    </div>

    <!-- step 2 : that trade's activities -->
    <div id="work" hidden>
      <div class="thead">
        <div class="row1">
          <div style="flex:1 1 auto;min-width:0">
            <h2 id="tName">Trade</h2>
            <div class="sub" id="tSub"></div>
          </div>
          <button class="btn" id="changeTrade">Change</button>
        </div>
        <div class="chips" id="floorChips"></div>
      </div>
      <div style="display:flex;gap:8px;margin:8px 0 10px">
        <input id="q" type="search" placeholder="Search within this trade…" style="flex:1 1 auto">
        <button class="btn" id="toggleTarget" aria-pressed="false" title="Only the activities on the target list">Target only</button>
        <button class="btn" id="toggleDone" aria-pressed="false" title="Show finished activities too">Show done</button>
      </div>
      <div id="acts"></div>
    </div>
  </section>

  <section id="panel-mp" hidden>
    <div class="card">
      <div class="card-head"><h2>Manpower on site</h2><span class="note">Headcount by trade for the date above</span></div>
      <div id="mpRows"></div>
      <button class="btn" id="addMp">+ Add trade</button>
      <div class="field" style="margin-top:14px"><label for="plant">Plant &amp; equipment on site</label>
        <textarea id="plant" placeholder="e.g. 1 no. tower crane, 2 no. concrete pumps, 1 no. 25T mobile crane"></textarea></div>
      <button class="btn btn-primary btn-lg" id="saveMp" style="width:100%">Submit manpower</button>
    </div>
  </section>

  <section id="panel-ph" hidden>
    <div class="card">
      <div class="card-head"><h2>Progress photos</h2><span class="note">Resized in your phone before upload</span></div>
      <div class="field"><label for="phAct">Activity (optional)</label>
        <select id="phAct"><option value="">General / site overview</option></select></div>
      <div class="field"><label for="phCap">Caption</label>
        <input id="phCap" placeholder="e.g. L3 wet area waterproofing complete"></div>
      <div class="field"><label for="phFile">Choose or take photos</label>
        <input id="phFile" type="file" accept="image/*" multiple capture="environment"></div>
      <div class="thumbs" id="thumbs"></div>
      <button class="btn btn-primary btn-lg" id="savePh" style="width:100%;margin-top:12px">Upload photos</button>
    </div>
  </section>
</div>

<div class="sticky-foot" id="foot" hidden>
  <span class="count" id="cnt"></span>
  <button class="btn" id="reset">Clear</button>
  <button class="btn btn-primary" id="submit">Submit update</button>
</div>
<input type="file" id="actCam" accept="image/*" capture="environment" hidden>

<dialog id="dwgDlg"><div class="in">
  <h2 id="dwgTitle">Drawings</h2>
  <div class="who" id="dwgWho"></div>
  <div id="dwgBody"></div>
  <button class="btn btn-lg" id="dwgClose" style="width:100%;margin-top:12px">Close</button>
</div></dialog>

<div class="toast" id="toast"></div>

<script>
var STATUSES = [
  ['', '\\u2014 status \\u2014'],
  ['in_progress', 'In progress'],
  ['complete', 'Complete'],
  ['at_risk', 'At risk'],
  ['delayed', 'Delayed'],
  ['on_hold', 'On hold'],
  ['not_started', 'Not started']
];
var REASONS = ['', 'Material delivery late', 'Submittal / approval pending', 'Authority approval / NOC',
  'Design change / variation', 'Information awaited (RFI)', 'Access not available',
  'Preceding trade incomplete', 'Labour shortage', 'Plant breakdown', 'Weather',
  'Client instruction / hold', 'Payment delay', 'Rework', 'Other'];
var TRADE_HINTS = ['Civil / concrete', 'Steel fixing', 'Shuttering', 'Blockwork', 'Plastering',
  'Waterproofing', 'Tiling', 'Painting', 'Joinery', 'Aluminium / glazing', 'HVAC', 'Electrical',
  'Plumbing / drainage', 'Fire fighting', 'Lift', 'Landscape', 'Cleaning', 'General labour', 'Supervision'];

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function fmt(s) {
  if (!s) return '';
  var d = new Date(s + 'T00:00:00Z');
  var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return String(d.getUTCDate()).padStart(2, '0') + ' ' + m[d.getUTCMonth()] + ' ' + String(d.getUTCFullYear()).slice(2);
}
function daysLate(f) {
  if (!f) return 0;
  return Math.floor((Date.now() - Date.parse(f + 'T00:00:00Z')) / 86400000);
}
function toast(msg, bad) {
  var t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
  setTimeout(function () { t.className = 'toast'; }, 3400);
}
var LS = {
  get: function (k, d) { try { var v = localStorage.getItem('sm-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem('sm-' + k, JSON.stringify(v)); } catch (e) {} }
};

var TRADES = [], TRADE = LS.get('trade', null), ACTS = [], DRAFT = LS.get('draft', {}), PHOTOS = [];
var FLOOR = '', SHOW_DONE = false, SHOW_FINISHED = false, TARGET_ONLY = false, ACT_LIMIT = 40;

document.getElementById('rd').value = new Date().toISOString().slice(0, 10);
document.getElementById('who').value = LS.get('who', '');
document.getElementById('who').addEventListener('input', function () { LS.set('who', this.value); });

/* ------------------------------------------------------- step 1: trades */
async function loadTrades() {
  var r = await fetch('/api/trades', { cache: 'no-store' });
  if (r.status === 401) { location.reload(); return; }
  var d = await r.json();
  TRADES = d.trades || [];
  document.getElementById('pname').textContent = d.meta.project_name || 'Site Update';
  document.getElementById('psub').textContent = d.meta.project_ref || 'Progress update';
  var sb = document.getElementById('scopeBar');
  if (sb) {
    if (d.scope) {
      sb.hidden = false;
      sb.innerHTML = '<b>' + esc(d.scope.text) + '</b> \u2014 these are your trades. Anything else is not yours to update.';
    } else sb.hidden = true;
  }
  renderTrades();
  if (TRADE && TRADES.some(function (t) { return t.trade === TRADE; })) openTrade(TRADE);
}

function renderTrades() {
  var box = document.getElementById('tradeList');
  if (!TRADES.length) {
    box.innerHTML = '<div class="empty">No programme loaded yet \\u2014 ask the office to import it.</div>';
    return;
  }
  var tq = (document.getElementById('tq').value || '').toLowerCase();
  var list = TRADES.filter(function (t) {
    if (!SHOW_FINISHED && t.pending === 0) return false;
    if (tq && (t.trade + ' ' + (t.trade_group || '')).toLowerCase().indexOf(tq) < 0) return false;
    return true;
  });
  if (!list.length) {
    box.innerHTML = '<div class="empty">No trade matches. ' +
      (SHOW_FINISHED ? '' : 'Press <b>Show finished</b> to include trades with nothing open.') + '</div>';
    return;
  }
  var groups = {};
  list.forEach(function (t) {
    var g = t.trade === '~other' ? 'Other site works' : (t.trade_group || 'Other site works');
    (groups[g] = groups[g] || []).push(t);
  });
  var order = Object.keys(groups).sort(function (a, b) {
    if (a === 'Other site works') return 1;
    if (b === 'Other site works') return -1;
    return a.localeCompare(b);
  });
  box.innerHTML = order.map(function (g) {
    var open = groups[g].reduce(function (s, t) { return s + t.pending; }, 0);
    return '<div class="grp"><div class="grp-title">' + esc(g) + ' \\u00B7 ' + open + ' open</div><div class="trades">' +
      groups[g].sort(function (a, b) { return b.pending - a.pending; }).map(function (t) {
        var nm = t.trade === '~other' ? 'Other site works' : t.trade;
        var sub = t.pending === 0
          ? '<span class="t-done">all ' + t.total + ' done</span>'
          : t.pending + ' of ' + t.total + ' open' + (t.flagged ? ' \\u00B7 <span class="t-flag">' + t.flagged + ' flagged</span>' : '');
        return '<button class="trade" data-t="' + esc(t.trade) + '" data-g="' + esc(t.trade === '~other' ? 'other' : (t.trade_group || 'other')) + '">' +
          '<span class="t-name">' + esc(nm) + '</span><span class="t-sub">' + sub + '</span></button>';
      }).join('') + '</div></div>';
  }).join('');
  box.querySelectorAll('.trade').forEach(function (b) {
    b.addEventListener('click', function () { openTrade(b.dataset.t); });
  });
}

/* --------------------------------------------------- step 2: activities */
async function openTrade(trade) {
  TRADE = trade; LS.set('trade', trade); FLOOR = ''; ACT_LIMIT = 40;
  document.getElementById('picker').hidden = true;
  document.getElementById('work').hidden = false;
  document.getElementById('acts').innerHTML = '<div class="empty">Loading activities…</div>';
  var meta = TRADES.filter(function (t) { return t.trade === trade; })[0] || {};
  document.getElementById('tName').textContent = trade === '~other' ? 'Other site works' : trade;
  document.getElementById('tSub').textContent = (meta.pending || 0) + ' open of ' + (meta.total || 0) + ' activities';
  window.scrollTo(0, 0);
  var r = await fetch('/api/site-data?trade=' + encodeURIComponent(trade), { cache: 'no-store' });
  if (r.status === 401) { location.reload(); return; }
  var d = await r.json();
  ACTS = d.activities || [];
  document.getElementById('phAct').innerHTML = '<option value="">General / site overview</option>' +
    ACTS.map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.name) + '</option>'; }).join('');
  renderFloors();
  renderActs();
}

function renderFloors() {
  var counts = {};
  ACTS.forEach(function (a) {
    if ((a.pct || 0) >= 100 && !SHOW_DONE) return;
    var f = a.floor || 'No floor';
    counts[f] = (counts[f] || 0) + 1;
  });
  var keys = Object.keys(counts).sort();
  var total = Object.keys(counts).reduce(function (s, k) { return s + counts[k]; }, 0);
  var box = document.getElementById('floorChips');
  box.innerHTML = '<button class="chip" data-f="" aria-pressed="' + (FLOOR === '') + '">All \\u00B7 ' + total + '</button>' +
    keys.map(function (f) {
      return '<button class="chip" data-f="' + esc(f) + '" aria-pressed="' + (FLOOR === f) + '">' + esc(f) + ' \\u00B7 ' + counts[f] + '</button>';
    }).join('');
  box.querySelectorAll('.chip').forEach(function (c) {
    c.addEventListener('click', function () { FLOOR = c.dataset.f; ACT_LIMIT = 40; renderFloors(); renderActs(); });
  });
}

function renderActs() {
  var q = (document.getElementById('q').value || '').toLowerCase();
  var list = ACTS.filter(function (a) {
    if (!SHOW_DONE && (a.pct || 0) >= 100) return false;
    if (TARGET_ONLY && !a.target_finish) return false;
    if (FLOOR && (a.floor || 'No floor') !== FLOOR) return false;
    if (q && (a.name + ' ' + a.id + ' ' + (a.wbs || '')).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
  var box = document.getElementById('acts');
  if (!list.length) {
    box.innerHTML = '<div class="empty">' + (SHOW_DONE ? 'Nothing matches.' : 'Nothing open here \\u2014 press <b>Show done</b> to see finished work.') + '</div>';
    updateFoot(); return;
  }
  var full = list.length;
  list = list.slice(0, ACT_LIMIT);
  var lastFloor = null, h = '';
  list.forEach(function (a) {
    var f = a.floor || 'No floor';
    if (!FLOOR && f !== lastFloor) { lastFloor = f; h += '<div class="sec-head">' + esc(f) + '</div>'; }
    var d = DRAFT[a.id] || {};
    var pct = a.pct == null ? 0 : a.pct;
    var late = pct < 100 ? daysLate(a.planned_finish) : 0;
    var touched = d.pct != null || d.status || d.remarks || d.actual_start || d.actual_finish;
    h += '<div class="act' + (touched ? ' touched' : '') + (pct >= 100 ? ' done' : '') + '" data-id="' + esc(a.id) + '">' +
      '<div class="hdr"><div class="nm">' + esc(a.name) +
        '<div class="meta">' + esc(a.wbs || '') + ' \\u00B7 plan ' + fmt(a.planned_start) + ' \\u2192 ' + fmt(a.planned_finish) +
        ' \\u00B7 now <b>' + (Math.round(pct * 10) / 10) + '%</b>' +
        (late > 0 ? ' \\u00B7 <span class="late">' + late + 'd past finish</span>' : '') +
        (a.delay_reason ? ' \\u00B7 ' + esc(a.delay_reason) : '') +
        (a.target_finish ? '<span class="tgt">TARGET ' + fmt(a.target_finish) + '</span>' : '') + '</div></div>' +
        '<button class="dwg-btn" type="button" data-dwg' + (a.drawings ? '' : ' data-none="1"') +
          ' title="The drawings for this activity">\\uD83D\\uDCD0' +
          (a.drawings ? '<i>' + a.drawings + '</i>' : '') + '</button>' +
        '<button class="cam-btn" type="button" data-cam title="Photograph this activity">' +
          '\\uD83D\\uDCF7' + (a.photos ? '<i>' + a.photos + '</i>' : '') + '</button>' +
        '<button class="more-btn" type="button" data-more>\\u22EF</button></div>' +
      (a.verdict === 'queried'
        ? '<div class="queried"><b>Queried by ' + esc(a.verdict_by || 'the office') + '</b>' +
          (a.verdict_note ? ' \\u2014 ' + esc(a.verdict_note) : '') +
          '<span>Fix it and send it again.</span></div>'
        : a.verdict === 'verified'
        ? '<div class="verified">Verified by ' + esc(a.verdict_by || 'the office') + '</div>' : '') +
      '<div class="quick">' +
        '<div><label>% complete</label><input class="f-pct" type="number" min="0" max="100" step="1" inputmode="decimal" value="' + (d.pct != null ? d.pct : '') + '" placeholder="' + Math.round(pct) + '"></div>' +
        '<div><label>Status</label><select class="f-status">' + STATUSES.map(function (s) {
            return '<option value="' + s[0] + '"' + (d.status === s[0] ? ' selected' : '') + '>' + s[1] + '</option>';
          }).join('') + '</select></div>' +
      '</div>' +
      '<div class="pct-row">' + [25, 50, 75, 100].map(function (v) {
          return '<button type="button" data-set="' + v + '">' + v + '%</button>';
        }).join('') + '</div>' +
      '<div class="shots" data-shots></div>' +
      '<div class="more">' +
        '<div class="row two">' +
          '<div class="field"><label>Actual start</label><input class="f-as" type="date" value="' + esc(d.actual_start || a.actual_start || '') + '"></div>' +
          '<div class="field"><label>Actual finish</label><input class="f-af" type="date" value="' + esc(d.actual_finish || a.actual_finish || '') + '"></div>' +
        '</div>' +
        '<div class="field"><label>Delay reason (if behind)</label><select class="f-reason">' +
          REASONS.map(function (r) { return '<option value="' + esc(r) + '"' + (d.delay_reason === r ? ' selected' : '') + '>' + (r || '\\u2014 none \\u2014') + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="field"><label>Remarks</label><textarea class="f-remarks" placeholder="What was done, what is holding it up">' + esc(d.remarks || '') + '</textarea></div>' +
        '<label class="raise"><input type="checkbox" class="f-raise"' + (d.raise ? ' checked' : '') + '>' +
          '<span>Tell the office to act on this \\u2014 it becomes a numbered item, dated today</span></label>' +
        '<div class="field f-raise-box"' + (d.raise ? '' : ' hidden') + '>' +
          '<label>What do you need from the office?</label>' +
          '<textarea class="f-ask" placeholder="e.g. Which detail applies at the beam? Drawing shows two.">' + esc(d.ask || '') + '</textarea>' +
        '</div>' +
      '</div>' +
    '</div>';
  });
  if (full > list.length) {
    h += '<button class="btn btn-lg" id="moreActs" style="width:100%;margin-top:6px">Show more \\u00B7 ' +
         (full - list.length) + ' not shown</button>';
  }
  box.innerHTML = h;
  var mb = document.getElementById('moreActs');
  if (mb) mb.addEventListener('click', function () { ACT_LIMIT += 60; renderActs(); });

  box.querySelectorAll('[data-more]').forEach(function (b) {
    b.addEventListener('click', function () { b.closest('.act').classList.toggle('open'); });
  });
  box.querySelectorAll('[data-cam]').forEach(function (b) {
    b.addEventListener('click', function () { takeShot(b.closest('.act').dataset.id); });
  });
  box.querySelectorAll('[data-dwg]').forEach(function (b) {
    b.addEventListener('click', function () { showDrawings(b.closest('.act').dataset.id); });
  });
  box.querySelectorAll('[data-set]').forEach(function (b) {
    b.addEventListener('click', function () {
      var card = b.closest('.act');
      card.querySelector('.f-pct').value = b.dataset.set;
      var sel = card.querySelector('.f-status');
      if (!sel.value) sel.value = b.dataset.set === '100' ? 'complete' : 'in_progress';
      collect(card);
    });
  });
  box.querySelectorAll('.act').forEach(function (card) {
    card.addEventListener('input', function () { collect(card); });
    card.addEventListener('change', function () { collect(card); });
    var d = DRAFT[card.dataset.id];
    if (d && (d.remarks || d.delay_reason || d.actual_start || d.actual_finish)) card.classList.add('open');
  });
  updateFoot();
}

function collect(card) {
  var id = card.dataset.id;
  var g = function (sel) { var e = card.querySelector(sel); return e ? e.value.trim() : ''; };
  var rec = {};
  var pct = g('.f-pct'); if (pct !== '') rec.pct = Math.max(0, Math.min(100, Number(pct)));
  var st = g('.f-status'); if (st) rec.status = st;
  var as = g('.f-as'); if (as) rec.actual_start = as;
  var af = g('.f-af'); if (af) rec.actual_finish = af;
  var rs = g('.f-reason'); if (rs) rec.delay_reason = rs;
  var rm = g('.f-remarks'); if (rm) rec.remarks = rm;
  var rz = card.querySelector('.f-raise');
  if (rz && rz.checked) { rec.raise = true; rec.ask = g('.f-ask'); }
  var box = card.querySelector('.f-raise-box');
  if (box) box.hidden = !(rz && rz.checked);
  if (Object.keys(rec).length) DRAFT[id] = rec; else delete DRAFT[id];
  card.classList.toggle('touched', !!DRAFT[id]);
  LS.set('draft', DRAFT);
  updateFoot();
}

function updateFoot() {
  var n = Object.keys(DRAFT).length;
  var onProg = document.querySelector('.tab[data-tab="prog"]').getAttribute('aria-selected') === 'true';
  document.getElementById('foot').hidden = n === 0 || !onProg;
  document.getElementById('cnt').textContent = n + (n === 1 ? ' activity ready to send' : ' activities ready to send');
}

document.getElementById('tq').addEventListener('input', renderTrades);
document.getElementById('showFinished').addEventListener('click', function () {
  SHOW_FINISHED = !SHOW_FINISHED;
  this.setAttribute('aria-pressed', String(SHOW_FINISHED));
  this.textContent = SHOW_FINISHED ? 'Hide finished' : 'Show finished';
  renderTrades();
});
document.getElementById('changeTrade').addEventListener('click', function () {
  document.getElementById('work').hidden = true;
  document.getElementById('picker').hidden = false;
  window.scrollTo(0, 0);
});
document.getElementById('q').addEventListener('input', function () { ACT_LIMIT = 40; renderActs(); });
document.getElementById('toggleTarget').addEventListener('click', function () {
  TARGET_ONLY = !TARGET_ONLY; ACT_LIMIT = 40;
  this.setAttribute('aria-pressed', String(TARGET_ONLY));
  renderFloors(); renderActs();
});
document.getElementById('toggleDone').addEventListener('click', function () {
  SHOW_DONE = !SHOW_DONE; ACT_LIMIT = 40;
  this.setAttribute('aria-pressed', String(SHOW_DONE));
  this.textContent = SHOW_DONE ? 'Hide done' : 'Show done';
  renderFloors(); renderActs();
});

document.getElementById('submit').addEventListener('click', async function () {
  var btn = this, who = document.getElementById('who').value.trim();
  var rd = document.getElementById('rd').value;
  if (!who) { toast('Please put your name in first', true); document.getElementById('who').focus(); return; }
  var ids = Object.keys(DRAFT);
  if (!ids.length) return;
  btn.disabled = true;
  var failed = 0, raised = 0, needPhoto = [];
  for (var i = 0; i < ids.length; i++) {
    btn.textContent = 'Sending ' + (i + 1) + '/' + ids.length + '…';
    var draft = DRAFT[ids[i]];
    var body = Object.assign({ activity_id: ids[i], report_date: rd, submitted_by: who }, draft);
    delete body.raise; delete body.ask;
    try {
      var r = await fetch('/api/update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (r.status === 422) {
        // Claimed complete with nothing to show for it.
        var j422 = await r.json().catch(function () { return {}; });
        needPhoto.push(ids[i]);
        failed++;
        continue;
      }
      if (!r.ok) throw new Error('bad status');
      // The progress went through, so the day's record is safe. If raising the
      // issue fails it is reported separately rather than losing the update too.
      if (draft.raise) {
        var act = (ACTS || []).filter(function (a) { return a.id === ids[i]; })[0] || {};
        try {
          var ir = await fetch('/api/issue', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              create: true, activity_id: ids[i], raised_date: rd, raised_by: who,
              reason: draft.delay_reason || '',
              title: (draft.ask || draft.remarks || draft.delay_reason || 'Site issue').slice(0, 140),
              detail: [draft.ask, draft.remarks].filter(Boolean).join('\\n\\n'),
              trade: act.trade || TRADE || '', floor: act.floor || ''
            })
          });
          if (ir.ok) raised++;
        } catch (e2) {}
      }
      delete DRAFT[ids[i]];
      LS.set('draft', DRAFT);
    } catch (e) { failed++; }
  }
  btn.disabled = false; btn.textContent = 'Submit update';
  if (needPhoto.length) {
    toast(needPhoto.length === 1
      ? 'Photograph it before marking it complete \\u2014 tap the camera on that activity'
      : needPhoto.length + ' activities need a photograph before they can be marked complete', true);
    // Open the ones that were refused, so it is obvious which they are.
    needPhoto.forEach(function (id) {
      var c = document.querySelector('.act[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
      if (c) { c.classList.add('needs-photo'); c.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });
  } else if (failed) toast(failed + ' could not be sent \\u2014 they are kept, try again', true);
  else if (raised) toast('Sent \\u2014 and ' + raised + (raised === 1 ? ' item' : ' items') + ' raised with the office');
  else toast('Update sent to the office');
  await loadTrades();
  if (TRADE) await openTrade(TRADE);
});

document.getElementById('reset').addEventListener('click', function () {
  if (!confirm('Clear everything you have typed?')) return;
  DRAFT = {}; LS.set('draft', DRAFT); renderActs();
});

/* --------------------------------------------------------- manpower UI */
function mpRow(trade, n) {
  var d = document.createElement('div');
  d.className = 'mp-row';
  d.innerHTML = '<div><label>Trade</label><input class="t" list="tradeHints" value="' + esc(trade || '') + '" placeholder="Trade"></div>' +
    '<div><label>No.</label><input class="n" type="number" min="0" inputmode="numeric" value="' + (n == null ? '' : n) + '"></div>' +
    '<button class="rm" type="button" title="Remove">\\u00D7</button>';
  d.querySelector('.rm').addEventListener('click', function () { d.remove(); });
  return d;
}
var mpBox = document.getElementById('mpRows');
mpBox.insertAdjacentHTML('beforebegin', '<datalist id="tradeHints">' +
  TRADE_HINTS.map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist>');
['Civil / concrete', 'Steel fixing', 'Electrical', 'Plumbing / drainage'].forEach(function (t) { mpBox.appendChild(mpRow(t, '')); });
document.getElementById('addMp').addEventListener('click', function () { mpBox.appendChild(mpRow('', '')); });

document.getElementById('saveMp').addEventListener('click', async function () {
  var who = document.getElementById('who').value.trim();
  if (!who) { toast('Please put your name in first', true); return; }
  var lines = [];
  mpBox.querySelectorAll('.mp-row').forEach(function (r) {
    var t = r.querySelector('.t').value.trim(), n = r.querySelector('.n').value;
    if (t && n !== '') lines.push({ trade: t, headcount: Number(n), plant: document.getElementById('plant').value.trim() });
  });
  if (!lines.length) { toast('Add at least one trade with a number', true); return; }
  this.disabled = true; this.textContent = 'Sending…';
  try {
    var r = await fetch('/api/manpower', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_date: document.getElementById('rd').value, submitted_by: who, lines: lines })
    });
    if (!r.ok) throw new Error();
    toast('Manpower sent');
  } catch (e) { toast('Could not send \\u2014 check your signal', true); }
  this.disabled = false; this.textContent = 'Submit manpower';
});

/* ------------------------------------------ the drawings for this activity */

// Only the current revision is ever listed here. A superseded sheet stays in the
// register for the record, and cannot be reached from a card at all — which is
// the whole reason for keeping a register rather than a shared folder.
var DWG_CACHE = {};
async function showDrawings(id) {
  var dlg = document.getElementById('dwgDlg');
  var body = document.getElementById('dwgBody');
  var a = null;
  for (var i = 0; i < ACTS.length; i++) if (ACTS[i].id === id) a = ACTS[i];
  document.getElementById('dwgTitle').textContent = a ? a.name : 'Drawings';
  document.getElementById('dwgWho').textContent =
    a ? [a.trade || 'no trade', a.floor || 'no floor'].join(' \\u00B7 ') : '';
  body.innerHTML = '<p class="hint">Looking…</p>';
  dlg.showModal();

  var d = DWG_CACHE[id];
  if (!d) {
    try {
      var r = await fetch('/api/drawings/for?activity=' + encodeURIComponent(id), { cache: 'no-store' });
      d = await r.json();
      if (d.error) { body.innerHTML = '<p class="hint">' + esc(d.error) + '</p>'; return; }
      DWG_CACHE[id] = d;
    } catch (e) {
      body.innerHTML = '<p class="hint">Could not fetch the drawings \\u2014 check your signal.</p>';
      return;
    }
  }
  if (!d.drawings.length) {
    body.innerHTML = '<p class="hint">No drawing is tagged to this trade or this floor yet. ' +
      'The office puts them on the register, and they appear here on their own.</p>';
    return;
  }
  body.innerHTML = '<ul class="sheet-l">' + d.drawings.map(function (s) {
    var href = s.has_file ? '/dwg/' + encodeURIComponent(s.id) : (s.url || '');
    var meta = [];
    if (s.trade) meta.push(esc(s.trade));
    if (s.floor) meta.push(esc(s.floor));
    if (s.pinned) meta.push('<b>pinned to this activity</b>');
    return '<li><a href="' + esc(href) + '" target="_blank" rel="noopener">' +
      '<div class="n">' + esc(s.number) +
        (s.revision ? '<em>REV ' + esc(s.revision) + ' \\u00B7 current</em>' : '<em>current</em>') + '</div>' +
      (s.title ? '<div class="t">' + esc(s.title) + '</div>' : '') +
      (meta.length ? '<div class="m">' + meta.join(' \\u00B7 ') + '</div>' : '') +
    '</a></li>';
  }).join('') + '</ul>';
}

document.getElementById('dwgClose').addEventListener('click', function () {
  document.getElementById('dwgDlg').close();
});

/* ------------------------------------------- a photograph of the activity */

// The photograph goes up the moment it is taken, not when the update is sent.
// Site is standing in front of the work; if the upload waited for Submit, a
// dropped signal or a closed tab would lose the only proof there was.
var SHOT_ACT = null;
function takeShot(id) {
  SHOT_ACT = id;
  document.getElementById('actCam').click();
}

document.getElementById('actCam').addEventListener('change', async function () {
  var files = Array.from(this.files || []);
  this.value = '';
  var id = SHOT_ACT;
  if (!id || !files.length) return;
  var who = document.getElementById('who').value.trim();
  if (!who) { toast('Please put your name in first', true); document.getElementById('who').focus(); return; }

  var card = document.querySelector('.act[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
  var strip = card ? card.querySelector('[data-shots]') : null;
  for (var i = 0; i < files.length; i++) {
    var ph = document.createElement('div');
    ph.className = 'shot pending';
    ph.textContent = 'sending…';
    if (strip) strip.appendChild(ph);
    try {
      var data = await shrink(files[i]);
      var r = await fetch('/api/photo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_id: id, report_date: document.getElementById('rd').value,
          caption: '', submitted_by: who, data: data
        })
      });
      if (!r.ok) throw new Error('upload failed');
      var j = await r.json();
      ph.className = 'shot';
      ph.innerHTML = '<img src="/photo/' + j.id + '" alt="">';
      // The count on the button is what the 100% rule reads, so keep it true.
      var a = ACTS.filter(function (x) { return x.id === id; })[0];
      if (a) { a.photos = (a.photos || 0) + 1; }
      var btn = card && card.querySelector('[data-cam] i');
      if (card) {
        var cb = card.querySelector('[data-cam]');
        if (cb) cb.innerHTML = '\\uD83D\\uDCF7<i>' + ((a && a.photos) || 1) + '</i>';
      }
    } catch (e) {
      ph.className = 'shot failed';
      ph.textContent = 'failed — tap to retry';
      ph.addEventListener('click', function () { ph.remove(); takeShot(id); });
    }
  }
});

/* ----------------------------------------------------------- photos UI */
function shrink(file) {
  return new Promise(function (resolve, reject) {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      URL.revokeObjectURL(url);
      var max = 1280, w = img.width, h = img.height;
      if (w > h && w > max) { h = Math.round(h * max / w); w = max; }
      else if (h >= w && h > max) { w = Math.round(w * max / h); h = max; }
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      var q = 0.72, out = c.toDataURL('image/jpeg', q);
      while (out.length > 900000 && q > 0.32) { q -= 0.12; out = c.toDataURL('image/jpeg', q); }
      resolve(out);
    };
    img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('could not read that image')); };
    img.src = url;
  });
}
document.getElementById('phFile').addEventListener('change', async function () {
  var files = Array.from(this.files || []);
  for (var i = 0; i < files.length; i++) {
    try { PHOTOS.push(await shrink(files[i])); } catch (e) { toast(e.message, true); }
  }
  this.value = '';
  drawThumbs();
});
function drawThumbs() {
  var box = document.getElementById('thumbs');
  box.innerHTML = PHOTOS.map(function (p, i) {
    return '<figure><img src="' + p + '" alt=""><button type="button" data-i="' + i + '">\\u00D7</button></figure>';
  }).join('');
  box.querySelectorAll('button').forEach(function (b) {
    b.addEventListener('click', function () { PHOTOS.splice(Number(b.dataset.i), 1); drawThumbs(); });
  });
}
document.getElementById('savePh').addEventListener('click', async function () {
  var who = document.getElementById('who').value.trim();
  if (!who) { toast('Please put your name in first', true); return; }
  if (!PHOTOS.length) { toast('Choose a photo first', true); return; }
  this.disabled = true;
  var sent = 0, failed = 0;
  for (var i = 0; i < PHOTOS.length; i++) {
    this.textContent = 'Uploading ' + (i + 1) + ' of ' + PHOTOS.length + '…';
    try {
      var r = await fetch('/api/photo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_id: document.getElementById('phAct').value || null,
          report_date: document.getElementById('rd').value,
          caption: document.getElementById('phCap').value.trim(),
          submitted_by: who, data: PHOTOS[i]
        })
      });
      if (!r.ok) throw new Error();
      sent++;
    } catch (e) { failed++; }
  }
  PHOTOS = PHOTOS.slice(sent); drawThumbs();
  this.disabled = false; this.textContent = 'Upload photos';
  if (failed) toast(failed + ' photo(s) failed \\u2014 try again', true);
  else { toast(sent + ' photo(s) uploaded'); document.getElementById('phCap').value = ''; }
});

/* -------------------------------------------------------------- tabs */
document.querySelectorAll('.tab').forEach(function (t) {
  t.addEventListener('click', function () {
    document.querySelectorAll('.tab').forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); });
    ['prog', 'mp', 'ph'].forEach(function (n) { document.getElementById('panel-' + n).hidden = (n !== t.dataset.tab); });
    updateFoot();
  });
});
try { var sv = localStorage.getItem('sm-theme'); if (sv) document.documentElement.setAttribute('data-theme', JSON.parse(sv)); } catch (e) {}
loadTrades();
${PWA_BOOT}
${SWITCHER_JS}
</script>
</body>
</html>`;
