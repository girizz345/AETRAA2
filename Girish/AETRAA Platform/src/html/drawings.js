import { THEME_CSS } from './theme.js';
import { NOTIFY_UI } from './notify-ui.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK, SWITCHER_CSS, SWITCHER_JS } from './shared.js';

// The Design section — the drawing register, split into what a sheet is.
//
// Two things make this a register rather than a shared folder. The first is that
// it knows which revision is LIVE: a man opening a sheet from his activity gets
// the approved current one and cannot reach a superseded one by accident. The
// second is the approval gate: a discipline engineer uploads a sheet, it sits as
// "awaiting approval" for all to see but reaches no activity, and only when the
// PM approves it does it become the live sheet — retiring whatever it replaced
// in the same breath. After that, only the PM can change it.
//
// Everyone sees the whole register, pending sheets included. Only the dashboard
// and the site build-view are held to the live approved revision.

export const drawingsHTML = (role, canUpload, canApprove, notify) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Design · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1280px; }
.tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.tabs button { appearance: none; border: 1px solid var(--border); background: var(--surface);
  color: var(--ink-2); font: inherit; font-size: 13.5px; font-weight: 600; padding: 9px 15px;
  border-radius: 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
.tabs button[aria-pressed="true"] { background: var(--series-1); color: #fff; border-color: var(--series-1); }
.tabs .cnt { font-size: 11px; font-weight: 700; background: rgba(0,0,0,.12); border-radius: 999px;
  padding: 1px 7px; }
.tabs button[aria-pressed="true"] .cnt { background: rgba(255,255,255,.25); }
.tabs .pend { border-color: var(--warn, #b7791f); color: var(--warn, #b7791f); }
.tabs .pend[aria-pressed="true"] { background: var(--warn, #b7791f); color: #fff; border-color: var(--warn, #b7791f); }
.tabs .pend .cnt { background: #fde8c8; color: #92600c; }
[data-theme="dark"] .tabs .pend .cnt { background: #3a2d12; color: #e7b866; }

.bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
       background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
       padding: 11px 13px; margin-bottom: 14px; }
.bar select, .bar input[type="search"] {
  font: inherit; font-size: 13px; padding: 6px 9px; border-radius: 8px; width: auto; flex: 0 0 auto;
  border: 1px solid var(--border); background: var(--surface-2); color: var(--ink); }
.bar input[type="search"] { min-width: 170px; flex: 1 1 200px; max-width: 320px; }
.seg { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.seg button { appearance: none; border: 0; background: var(--surface-2); color: var(--ink-2);
  font: inherit; font-size: 13px; font-weight: 600; padding: 7px 13px; cursor: pointer; }
.seg button + button { border-left: 1px solid var(--border); }
.seg button[aria-pressed="true"] { background: var(--series-1); color: #fff; }

.drop { border: 2px dashed var(--border); border-radius: 12px; padding: 22px 16px; text-align: center;
        color: var(--muted); font-size: 13px; margin-bottom: 14px; background: var(--surface); }
.drop.over { border-color: var(--series-1); background: var(--surface-2); color: var(--ink); }
.drop b { color: var(--ink); }

table.reg { width: 100%; border-collapse: collapse; font-size: 13px; }
table.reg th { text-align: left; font-size: 10.5px; letter-spacing: .05em; text-transform: uppercase;
  color: var(--muted); font-weight: 600; padding: 8px 9px; border-bottom: 1px solid var(--border);
  white-space: nowrap; }
table.reg td { padding: 9px; border-bottom: 1px solid var(--grid); vertical-align: top; }
table.reg th.n, table.reg td.n { text-align: right; font-variant-numeric: tabular-nums; }
table.reg tr.sup td, table.reg tr.rej td { opacity: .62; }
table.reg .num { font-weight: 600; white-space: nowrap; }
table.reg .ttl { color: var(--ink-2); }
.scroll { overflow-x: auto; }
.scroll > table { min-width: 1000px; }

.pill { display: inline-block; font-size: 10.5px; font-weight: 700; letter-spacing: .03em;
        padding: 2px 7px; border-radius: 999px; background: var(--surface-2); color: var(--muted);
        white-space: nowrap; }
.pill.live { background: #e8f5ec; color: var(--good-text); }
.pill.pend { background: #fdf0d8; color: #92600c; }
.pill.rej  { background: #fdecec; color: var(--critical); }
.pill.sup  { background: var(--surface-2); color: var(--muted); }
.pill.none { background: #fdecec; color: var(--critical); }
[data-theme="dark"] .pill.live { background: #16301f; }
[data-theme="dark"] .pill.pend { background: #3a2d12; color: #e7b866; }
[data-theme="dark"] .pill.rej, [data-theme="dark"] .pill.none { background: #3a1f1f; }
.tag { display: inline-block; font-size: 11.5px; color: var(--ink-2); background: var(--surface-2);
       border-radius: 6px; padding: 1px 7px; margin-right: 4px; white-space: nowrap; }
.tag.any { color: var(--muted); font-style: italic; }
.byline { font-size: 11px; color: var(--muted); margin-top: 3px; }
.rnote { font-size: 11.5px; color: var(--critical); margin-top: 4px; }
.rowbtns { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
.rowbtns button, .rowbtns a { font: inherit; font-size: 12px; padding: 4px 9px; border-radius: 7px;
  border: 1px solid var(--border); background: var(--surface-2); color: var(--ink-2);
  cursor: pointer; text-decoration: none; white-space: nowrap; }
.rowbtns button:hover, .rowbtns a:hover { background: var(--surface); color: var(--ink); }
.rowbtns .ok { border-color: var(--good-text); color: var(--good-text); font-weight: 600; }
.rowbtns .no { border-color: var(--critical); color: var(--critical); }

.banner { background: #fdf0d8; border: 1px solid #f0d49a; color: #7a5209; border-radius: 12px;
  padding: 11px 14px; margin-bottom: 14px; font-size: 13px; display: flex; align-items: center; gap: 10px; }
[data-theme="dark"] .banner { background: #2c2210; border-color: #4a3a17; color: #e7b866; }
.banner button { font: inherit; font-size: 12.5px; font-weight: 600; padding: 5px 11px; border-radius: 8px;
  border: 1px solid currentColor; background: transparent; color: inherit; cursor: pointer; }

dialog { border: 1px solid var(--border); border-radius: 14px; background: var(--surface);
         color: var(--ink); padding: 0; max-width: 96vw; }
dialog::backdrop { background: rgba(0,0,0,.45); }
.dlg { padding: 18px 20px 20px; width: 640px; max-width: 92vw; }
.dlg h2 { margin: 0 0 4px; font-size: 18px; }
.q { max-height: 56vh; overflow: auto; margin-top: 12px; }
.qrow { border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; margin-bottom: 8px;
        background: var(--surface-2); }
.qrow .fname { font-size: 11.5px; color: var(--muted); margin-bottom: 7px; word-break: break-all; }
.grid4 { display: grid; gap: 7px; grid-template-columns: repeat(auto-fit, minmax(126px, 1fr)); }
.grid4 label { display: block; font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em;
  color: var(--muted); margin-bottom: 2px; }
.grid4 input, .grid4 select { font: inherit; font-size: 13px; width: 100%; padding: 5px 7px;
  border-radius: 7px; border: 1px solid var(--border); background: var(--surface); color: var(--ink); }
.qrow .bad { color: var(--critical); font-size: 12px; margin-top: 6px; }
.lede { font-size: 12.5px; color: var(--muted); margin: 2px 0 10px; line-height: 1.6; max-width: 72ch; }
.empty { text-align: center; color: var(--muted); padding: 34px 16px; font-size: 13.5px; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Design</h1><div class="sub">IFC and shop drawings — the register, and what each sheet reaches</div></div>
  <select class="proj" id="proj" hidden aria-label="Project"></select>
  <div class="spacer"></div>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  <a class="btn" href="/">Dashboard</a>
  <a class="btn" href="/site">Site update</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  <div id="pmBanner"></div>

  ${canUpload ? `<div class="drop" id="drop">
    <b>Drop drawings here</b> — or <button class="btn" id="pickBtn" type="button">choose files</button>
    or <button class="btn" id="linkBtn" type="button">link to one</button><br>
    PDF, or an image of a sheet. The number and revision are read off the file name where they are in it.
    ${canApprove ? '' : 'Your uploads go to the project manager for approval before they reach site.'}
    <input type="file" id="pick" multiple accept="application/pdf,image/*" hidden>
  </div>` : ''}

  <div class="tabs" id="tabs"></div>

  <div class="bar">
    <input type="search" id="q" placeholder="Number, title, trade…">
    <select id="fTrade"><option value="">Every trade</option></select>
    <div class="seg" role="group" aria-label="Which revisions">
      <button data-view="live" aria-pressed="true">Live</button>
      <button data-view="all" aria-pressed="false">All revisions</button>
    </div>
    <div style="flex:1"></div>
    <span class="hint" id="stamp"></span>
  </div>

  <div class="card" id="panel"><p class="hint">Loading…</p></div>
</div>

${canUpload ? `<dialog id="addDlg"><div class="dlg">
  <h2 id="addTitle">Add drawings</h2>
  <p class="lede">
    A sheet tagged with a trade and a floor appears against every activity of that trade on that floor.
    Leave a box empty and it applies everywhere — which is what a specification and a general arrangement
    actually are. Where the rule is wrong, pin the sheet to the activity from the site page.
  </p>
  <div class="grid4" id="allRow">
    <div><label>Set on all</label><select id="allKind"></select></div>
    <div><label>&nbsp;</label><input id="allTrade" list="tradeList" placeholder="Trade"></div>
    <div><label>&nbsp;</label><input id="allFloor" list="floorList" placeholder="Floor"></div>
    <div><label>&nbsp;</label><input id="allDisc" placeholder="Discipline"></div>
  </div>
  <div class="q" id="queue"></div>
  <div style="display:flex;gap:8px;margin-top:12px">
    <button class="btn" id="addCancel" style="flex:0 0 auto">Cancel</button>
    <button class="btn btn-primary" id="addSave" style="flex:1">Save to the register</button>
  </div>
</div></dialog>` : ''}

<datalist id="tradeList"></datalist>
<datalist id="floorList"></datalist>
<div class="toast" id="toast"></div>

<script>
${PWA_BOOT}
${SWITCHER_JS}
var CAN_UPLOAD = ${canUpload ? 'true' : 'false'};
var CAN_APPROVE = ${canApprove ? 'true' : 'false'};
var ME = null;
var esc = function (s) { return String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
var D = null, VIEW = 'live', TAB = 'tender', QUEUE = [];

// Which drawing kinds live under each section tab.
var TABS = [
  { key: 'tender', label: 'Tender drawings', kinds: ['tender'] },
  { key: 'ifc',    label: 'IFC drawings',    kinds: ['ifc'] },
  { key: 'shop',   label: 'Shop drawings',   kinds: ['shop'] },
  { key: 'other',  label: 'Other',           kinds: ['spec', 'sketch', 'other'] }
];
function tabOf(kind) {
  for (var i = 0; i < TABS.length; i++) if (TABS[i].kinds.indexOf(kind) >= 0) return TABS[i].key;
  return 'other';
}

function toast(msg, bad) {
  var t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
  setTimeout(function () { t.className = 'toast'; }, 3000);
}
function kb(n) {
  n = Number(n) || 0;
  if (!n) return '';
  if (n > 900000) return (n / 1048576).toFixed(1) + ' MB';
  return n < 1024 ? '<1 KB' : Math.round(n / 1024) + ' KB';
}

/* ------------------------------------------------------------------ load */

async function load() {
  var r = await fetch('/api/drawings', { cache: 'no-store' });
  if (r.status === 401) { location.href = '/'; return; }
  D = await r.json();
  if (!D.migrated) {
    document.getElementById('panel').innerHTML =
      '<div class="empty">The design register is not set up on this database yet.<br>' +
      'Run <b>upgrade-design.sh</b> and reload.</div>';
    return;
  }
  ME = D.me || null;
  fillPickers();
  render();
}

function fillPickers() {
  var t = document.getElementById('fTrade');
  t.innerHTML = '<option value="">Every trade</option>' + D.trades.map(function (x) {
    return '<option value="' + esc(x.trade) + '">' + esc(x.trade) + ' · ' + x.n + '</option>'; }).join('');
  document.getElementById('tradeList').innerHTML = D.trades.map(function (x) {
    return '<option value="' + esc(x.trade) + '">'; }).join('');
  document.getElementById('floorList').innerHTML = D.floors.map(function (x) {
    return '<option value="' + esc(x) + '">'; }).join('');
  var ak = document.getElementById('allKind');
  if (ak) ak.innerHTML = '<option value="">Type…</option>' + D.kinds.map(function (x) {
    return '<option value="' + esc(x[0]) + '">' + esc(x[1]) + '</option>'; }).join('');
}

var KIND = {};
function kindLabel(k) {
  if (!KIND.shop) for (var i = 0; i < D.kinds.length; i++) KIND[D.kinds[i][0]] = D.kinds[i][1];
  return KIND[k] || k || '';
}

function pendingCount() {
  var n = 0;
  for (var i = 0; i < D.drawings.length; i++) if (D.drawings[i].status === 'pending') n++;
  return n;
}

// Can the signed-in person change THIS row? A PM can change anything. An
// engineer can change only their own sheet, and only while it is still pending
// or rejected — once approved it is the PM's.
function canEditRow(d) {
  if (CAN_APPROVE) return true;
  if (!CAN_UPLOAD) return false;
  if (d.status !== 'pending' && d.status !== 'rejected') return false;
  return !d.uploaded_by || d.uploaded_by === ME;
}

function drawTabs() {
  var counts = { tender: 0, ifc: 0, shop: 0, other: 0 };
  for (var i = 0; i < D.drawings.length; i++) {
    if (D.drawings[i].status === 'rejected') continue;      // rejected shown only under All revisions
    counts[tabOf(D.drawings[i].kind)]++;
  }
  var h = TABS.map(function (t) {
    return '<button data-tab="' + t.key + '" aria-pressed="' + (TAB === t.key) + '">' +
      esc(t.label) + ' <span class="cnt">' + (counts[t.key] || 0) + '</span></button>';
  }).join('');
  var pend = pendingCount();
  if (pend) {
    h += '<button class="pend" data-tab="pending" aria-pressed="' + (TAB === 'pending') + '">' +
      (CAN_APPROVE ? 'Awaiting your approval' : 'Awaiting approval') +
      ' <span class="cnt">' + pend + '</span></button>';
  }
  var el = document.getElementById('tabs');
  el.innerHTML = h;
  el.querySelectorAll('[data-tab]').forEach(function (b) {
    b.addEventListener('click', function () { TAB = b.dataset.tab; drawTabs(); render(); });
  });

  var banner = document.getElementById('pmBanner');
  if (CAN_APPROVE && pend && TAB !== 'pending') {
    banner.innerHTML = '<div class="banner"><span>' + pend +
      (pend === 1 ? ' drawing is' : ' drawings are') + ' waiting for your approval.</span>' +
      '<button id="goPend">Review now</button></div>';
    document.getElementById('goPend').addEventListener('click', function () {
      TAB = 'pending'; drawTabs(); render();
    });
  } else banner.innerHTML = '';
}

function statusPill(d) {
  if (d.status === 'pending') return '<span class="pill pend">awaiting approval</span>';
  if (d.status === 'rejected') return '<span class="pill rej">sent back</span>';
  if (d.status === 'superseded') return '<span class="pill sup">superseded</span>';
  return '<span class="pill live">live</span>';
}

function render() {
  drawTabs();
  var q = document.getElementById('q').value.trim().toLowerCase();
  var trade = document.getElementById('fTrade').value;
  var pendingTab = TAB === 'pending';

  var list = D.drawings.filter(function (d) {
    if (pendingTab) { if (d.status !== 'pending') return false; }
    else {
      if (TABS.find(function (t) { return t.key === TAB; }).kinds.indexOf(d.kind) < 0) return false;
      if (VIEW === 'live') { if (d.status !== 'current') return false; }
      else { if (d.status === 'pending') return false; }   // pending has its own tab; All = current/superseded/rejected
    }
    if (trade && (d.trade || '') !== trade) return false;
    if (q) {
      var hay = (d.number + ' ' + (d.title || '') + ' ' + (d.trade || '') + ' ' +
                 (d.floor || '') + ' ' + (d.discipline || '')).toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  });

  // The stamp: how many are live in this section, and how many waiting.
  var liveHere = 0, pendHere = 0;
  for (var i = 0; i < D.drawings.length; i++) {
    var d = D.drawings[i];
    if (!pendingTab && TABS.find(function (t) { return t.key === TAB; }).kinds.indexOf(d.kind) < 0) continue;
    if (d.status === 'current') liveHere++;
    if (d.status === 'pending') pendHere++;
  }
  document.getElementById('stamp').textContent = pendingTab
    ? pendingCount() + ' awaiting approval'
    : liveHere + (liveHere === 1 ? ' sheet live' : ' sheets live') + (pendHere ? ' · ' + pendHere + ' awaiting' : '');

  var panel = document.getElementById('panel');
  if (!list.length) {
    panel.innerHTML = '<div class="empty">' + (pendingTab
      ? 'Nothing is waiting for approval.'
      : (D.drawings.length ? 'Nothing here yet.' : 'Nothing on the register yet.') +
        (CAN_UPLOAD ? ' Drop drawings in above.' : '')) + '</div>';
    return;
  }

  var h = '<div class="scroll"><table class="reg"><thead><tr>' +
    '<th>Number</th><th>Rev</th><th>Title</th><th>Status</th><th>Applies to</th>' +
    '<th class="n">Reaches</th><th class="n">Size</th><th></th></tr></thead><tbody>';
  list.forEach(function (d) {
    var reach = D.reach[d.id];
    var open = d.has_file ? '/dwg/' + encodeURIComponent(d.id) : (d.url || '');
    var cls = d.status === 'superseded' ? ' class="sup"' : d.status === 'rejected' ? ' class="rej"' : '';
    var isLive = d.status === 'current';
    h += '<tr' + cls + '>' +
      '<td class="num">' + esc(d.number) + '</td>' +
      '<td>' + (d.revision ? esc(d.revision) : '<span class="hint">—</span>') + '</td>' +
      '<td class="ttl">' + esc(d.title || '') +
        (d.uploaded_by ? '<div class="byline">by ' + esc(d.uploaded_by) +
           (d.status === 'current' && d.approved_by ? ' · approved by ' + esc(d.approved_by) : '') + '</div>' : '') +
        (d.status === 'rejected' && d.reject_note ? '<div class="rnote">' + esc(d.reject_note) + '</div>' : '') +
      '</td>' +
      '<td>' + statusPill(d) + '</td>' +
      '<td>' + (d.trade ? '<span class="tag">' + esc(d.trade) + '</span>' :
                d.trade_group ? '<span class="tag">' + esc(d.trade_group) + ' (all)</span>' :
                '<span class="tag any">any trade</span>') +
             (d.floor ? '<span class="tag">' + esc(d.floor) + '</span>' :
                '<span class="tag any">any floor</span>') + '</td>' +
      '<td class="n">' + (!isLive ? '<span class="hint">—</span>'
        : !reach || !reach.activities ? '<span class="pill none">nothing</span>'
        : reach.activities + (reach.pinned ? ' <span class="hint">(' + reach.pinned + ' pinned)</span>' : '')) + '</td>' +
      '<td class="n">' + (d.has_file ? kb(d.size) : '<span class="hint">link</span>') + '</td>' +
      '<td><div class="rowbtns">' +
        (open ? '<a href="' + esc(open) + '" target="_blank" rel="noopener">Open</a>' : '') +
        (CAN_APPROVE && d.status === 'pending'
          ? '<button class="ok" data-approve="' + esc(d.id) + '">Approve</button>' +
            '<button class="no" data-reject="' + esc(d.id) + '">Send back</button>' : '') +
        (canEditRow(d) ? '<button data-edit="' + esc(d.id) + '">Tags</button>' +
                         '<button data-del="' + esc(d.id) + '">Remove</button>' : '') +
      '</div></td></tr>';
  });
  h += '</tbody></table></div>';
  panel.innerHTML = h;

  panel.querySelectorAll('[data-edit]').forEach(function (b) {
    b.addEventListener('click', function () { editOne(b.dataset.edit); });
  });
  panel.querySelectorAll('[data-del]').forEach(function (b) {
    b.addEventListener('click', function () { remove(b.dataset.del); });
  });
  panel.querySelectorAll('[data-approve]').forEach(function (b) {
    b.addEventListener('click', function () { approve(b.dataset.approve); });
  });
  panel.querySelectorAll('[data-reject]').forEach(function (b) {
    b.addEventListener('click', function () { reject(b.dataset.reject); });
  });
}

/* ------------------------------------------------------ approve / send back */

async function approve(id) {
  var d = find(id); if (!d) return;
  var res = await fetch('/api/drawing/approve', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: id }),
  });
  var j = await res.json().catch(function () { return {}; });
  if (!j.ok) { toast(j.error || 'it did not approve', true); return; }
  await load();
  toast(j.superseded ? 'Approved — Rev ' + j.superseded + ' retired.' : 'Approved and live.');
}

async function reject(id) {
  var d = find(id); if (!d) return;
  var note = prompt('Send ' + d.number + (d.revision ? ' Rev ' + d.revision : '') +
                    ' back. What needs fixing?', '');
  if (note === null) return;
  var res = await fetch('/api/drawing/approve', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: id, reject: true, note: note }),
  });
  var j = await res.json().catch(function () { return {}; });
  if (!j.ok) { toast(j.error || 'it did not go back', true); return; }
  await load();
  toast('Sent back.');
}

function find(id) {
  for (var i = 0; i < D.drawings.length; i++) if (D.drawings[i].id === id) return D.drawings[i];
  return null;
}

/* ------------------------------------------------------------- the queue */

function fileName(f) { return f.name || 'drawing'; }

function readOne(file) {
  return new Promise(function (res, rej) {
    var fr = new FileReader();
    fr.onload = function () { res(String(fr.result)); };
    fr.onerror = function () { rej(new Error('could not read ' + fileName(file))); };
    fr.readAsDataURL(file);
  });
}

async function queueFiles(files) {
  if (!CAN_UPLOAD || !files || !files.length) return;
  QUEUE = [];
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var row = { name: fileName(f), size: f.size, data: null, err: null };
    if (f.size > D.max_bytes) {
      row.err = kb(f.size) + ' — too large to keep in the database, and the limit is ' +
                kb(D.max_bytes) + '. Put it on a link instead.';
    } else {
      try { row.data = await readOne(f); } catch (e) { row.err = e.message; }
      if (row.data && row.data.length > D.max_bytes) {
        row.err = kb(row.data.length) + ' once encoded — the limit is ' + kb(D.max_bytes) + '.';
        row.data = null;
      }
    }
    var g = guess(row.name);
    row.number = g.number || ''; row.revision = g.revision || ''; row.title = g.title || '';
    // A new upload lands in the tab you are looking at.
    row.kind = (TABS.find(function (t) { return t.key === TAB; }) || TABS[0]).kinds[0];
    QUEUE.push(row);
  }
  drawQueue();
  document.getElementById('addDlg').showModal();
}

// The same reading the server does, repeated here so the boxes are filled in
// before anybody looks at them rather than after a round trip.
function guess(name) {
  var raw = String(name || '').replace(/\\.[a-z0-9]+$/i, '').trim();
  if (!raw) return {};
  var base = raw.replace(/_/g, ' ');
  var out = {};
  var num = base.match(/\\b([A-Z]{1,4}[- ]?[0-9]{2,5}(?:-[0-9]{1,3})?)(?![A-Z0-9])/i);
  if (num) out.number = num[1].replace(/ /g, '-').toUpperCase();
  var rev = base.match(/\\b(?:rev(?:ision)?|r)[- .]?([A-Z]|[0-9]{1,2})\\b/i);
  if (rev) out.revision = rev[1].toUpperCase();
  var title = base;
  if (num) title = title.replace(num[0], ' ');
  if (rev) title = title.replace(rev[0], ' ');
  title = title.replace(/[-]+/g, ' ').replace(/\\s+/g, ' ').trim();
  if (title) out.title = title;
  return out;
}

function drawQueue() {
  document.getElementById('addTitle').textContent =
    QUEUE.length === 1 ? 'Add a drawing' : 'Add ' + QUEUE.length + ' drawings';
  document.getElementById('queue').innerHTML = QUEUE.map(function (r, i) {
    return '<div class="qrow" data-i="' + i + '">' +
      '<div class="fname">' + esc(r.name) + (r.size ? ' · ' + kb(r.size) : '') + '</div>' +
      (r.link ? '<div class="grid4" style="margin-bottom:7px"><div style="grid-column:1/-1">' +
        '<label>Link to the sheet</label>' +
        '<input class="f-url" value="' + esc(r.url || '') + '" placeholder="https://…"></div></div>' : '') +
      '<div class="grid4">' +
        '<div><label>Number</label><input class="f-number" value="' + esc(r.number) + '" placeholder="AR-101"></div>' +
        '<div><label>Rev</label><input class="f-revision" value="' + esc(r.revision) + '" placeholder="C"></div>' +
        '<div style="grid-column:span 2"><label>Title</label><input class="f-title" value="' + esc(r.title) + '"></div>' +
      '</div>' +
      '<div class="grid4" style="margin-top:7px">' +
        '<div><label>Type</label><select class="f-kind">' + D.kinds.map(function (k) {
            return '<option value="' + esc(k[0]) + '"' + (r.kind === k[0] ? ' selected' : '') + '>' +
                   esc(k[1]) + '</option>'; }).join('') + '</select></div>' +
        '<div><label>Trade</label><input class="f-trade" list="tradeList" value="' + esc(r.trade || '') + '" placeholder="any"></div>' +
        '<div><label>Floor</label><input class="f-floor" list="floorList" value="' + esc(r.floor || '') + '" placeholder="any"></div>' +
        '<div><label>Discipline</label><input class="f-discipline" value="' + esc(r.discipline || '') + '" placeholder="optional"></div>' +
      '</div>' +
      (r.err ? '<div class="bad">' + esc(r.err) + '</div>' : '') +
    '</div>';
  }).join('');
}

function collectQueue() {
  document.querySelectorAll('#queue .qrow').forEach(function (el) {
    var r = QUEUE[Number(el.dataset.i)];
    ['number', 'revision', 'title', 'kind', 'trade', 'floor', 'discipline', 'url'].forEach(function (f) {
      var i = el.querySelector('.f-' + f);
      if (i) r[f] = i.value.trim();
    });
  });
}

async function saveQueue() {
  collectQueue();
  var ok = 0, failed = [], SAVED = [];
  for (var i = 0; i < QUEUE.length; i++) {
    var r = QUEUE[i];
    if (r.err) { failed.push(r.name + ' — ' + r.err); continue; }
    if (!r.number) { failed.push(r.name + ' — it needs a number'); continue; }
    if (r.link && !r.url) { failed.push(r.number + ' — it needs a link'); continue; }
    var res = await fetch('/api/drawing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: r.number, revision: r.revision, title: r.title, kind: r.kind,
        trade: r.trade, floor: r.floor, discipline: r.discipline,
        data: r.data, url: r.url,
      }),
    });
    var j = await res.json().catch(function () { return {}; });
    if (j.ok) { ok++; SAVED.push(r.number + (r.revision ? ' rev ' + r.revision : '')); }
    else failed.push(r.name + ' — ' + (j.error || 'it did not save'));
  }
  document.getElementById('addDlg').close();
  QUEUE = [];
  await load();
  if (failed.length) {
    toast(ok + ' saved, ' + failed.length + ' did not: ' + failed[0], true);
  } else {
    toast(CAN_APPROVE ? (ok === 1 ? 'On the register and live.' : ok + ' on the register.')
                      : (ok === 1 ? 'Submitted for approval.' : ok + ' submitted for approval.'));
  }
  // Document Control has put drawings on the register: offer to tell the team.
  if (ok > 0 && window.__NOTIFY__ && window.__NOTIFY__.dc && window.notifyTeam) {
    window.notifyTeam({ kind: 'drawing', ref: SAVED.join(', ').slice(0, 60),
      title: (ok === 1 ? 'Drawing ' + SAVED[0] : ok + ' drawings') + ' uploaded to the register',
      message: 'Uploaded by Document Control: ' + SAVED.join(', ') + '. Please use the current revision.' });
  }
}

/* ------------------------------------------------------------ one at a time */

function editOne(id) {
  var d = find(id);
  if (!d) return;
  QUEUE = [{ name: d.number + (d.revision ? ' Rev ' + d.revision : ''), size: d.size, data: null,
             id: d.id, number: d.number, revision: d.revision || '', title: d.title || '',
             kind: d.kind, trade: d.trade || '', floor: d.floor || '',
             discipline: d.discipline || '', edit: true,
             link: !d.has_file && !!d.url, url: d.url || '' }];
  drawQueue();
  document.getElementById('addTitle').textContent = 'Tags on ' + d.number;
  document.getElementById('addDlg').showModal();
}

async function saveEdit() {
  collectQueue();
  var r = QUEUE[0];
  var res = await fetch('/api/drawing', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: r.id, number: r.number, revision: r.revision, title: r.title,
      kind: r.kind, trade: r.trade, floor: r.floor, discipline: r.discipline, url: r.url }),
  });
  var j = await res.json().catch(function () { return {}; });
  document.getElementById('addDlg').close();
  QUEUE = [];
  if (!j.ok) { toast(j.error || 'it did not save', true); return; }
  await load();
  toast('Saved.');
}

async function remove(id) {
  var d = find(id);
  if (!d) return;
  if (!confirm('Take ' + d.number + (d.revision ? ' Rev ' + d.revision : '') +
               ' off the register?' + (d.status === 'current' ? ' Whatever it superseded becomes live again.' : ''))) return;
  var res = await fetch('/api/drawing', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: id, remove: true }),
  });
  var j = await res.json().catch(function () { return {}; });
  if (!j.ok) { toast(j.error || 'it did not go', true); return; }
  await load();
  toast('Taken off.');
}

/* ------------------------------------------------------------------ wiring */

document.getElementById('q').addEventListener('input', render);
document.getElementById('fTrade').addEventListener('change', render);
document.querySelectorAll('.seg button').forEach(function (b) {
  b.addEventListener('click', function () {
    VIEW = b.dataset.view;
    document.querySelectorAll('.seg button').forEach(function (x) {
      x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    render();
  });
});

if (CAN_UPLOAD) {
  var pick = document.getElementById('pick');
  document.getElementById('pickBtn').addEventListener('click', function () { pick.click(); });
  pick.addEventListener('change', function () { queueFiles(pick.files); pick.value = ''; });
  document.getElementById('linkBtn').addEventListener('click', function () {
    QUEUE = [{ name: 'A sheet kept somewhere else', link: true, url: '', data: null, err: null,
               kind: (TABS.find(function (t) { return t.key === TAB; }) || TABS[0]).kinds[0] }];
    drawQueue();
    document.getElementById('addTitle').textContent = 'Link a drawing';
    document.getElementById('addDlg').showModal();
  });

  var drop = document.getElementById('drop');
  ['dragenter', 'dragover'].forEach(function (e) {
    drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (e) {
    drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.remove('over'); });
  });
  drop.addEventListener('drop', function (ev) {
    if (ev.dataTransfer && ev.dataTransfer.files) queueFiles(ev.dataTransfer.files);
  });

  document.getElementById('addCancel').addEventListener('click', function () {
    document.getElementById('addDlg').close(); QUEUE = [];
  });
  document.getElementById('addSave').addEventListener('click', function () {
    if (QUEUE.length === 1 && QUEUE[0].edit) saveEdit(); else saveQueue();
  });
  ['allKind', 'allTrade', 'allFloor', 'allDisc'].forEach(function (idd) {
    var f = { allKind: 'kind', allTrade: 'trade', allFloor: 'floor', allDisc: 'discipline' }[idd];
    document.getElementById(idd).addEventListener('change', function () {
      var v = document.getElementById(idd).value;
      collectQueue();
      QUEUE.forEach(function (r) { r[f] = v; });
      drawQueue();
    });
  });
}

mountSwitcher('proj');
load();
</script>
<script>window.__NOTIFY__ = { can: ${notify && notify.can ? 'true' : 'false'}, auto: false, dc: ${notify && notify.dc ? 'true' : 'false'} };</script>
${NOTIFY_UI}
</body>
</html>`;
