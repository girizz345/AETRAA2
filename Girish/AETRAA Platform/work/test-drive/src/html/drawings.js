import { THEME_CSS } from './theme.js';
import { NOTIFY_UI } from './notify-ui.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK, SWITCHER_CSS, SWITCHER_JS } from './shared.js';
import { AIREAD_JS } from './ai-read.js';
import { icon, iconsFor } from './icons.js';
import { BUILDING_ART, SKETCH_ART } from './art.js';

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
.overview.no-drop { grid-template-columns: minmax(150px, 1fr) minmax(0, 2fr); }
.reg-label { margin: 0 0 var(--s3); }
#heroCta:empty { display: none; }
/* The floating card on the drawing: what needs doing, or the latest live sheet. */
#pmBanner .t-label { margin: 0; }
#pmBanner p { margin: 0; }
#pmBanner .ref { font-size: var(--fs-headline); }

/* The register's sections: quiet pills, the open one raised with its dot. */
.tabs { display: flex; flex-wrap: wrap; gap: var(--s2); margin-bottom: var(--s4); border: 0; overflow: visible; }
.tabs button { appearance: none; position: relative; border: 1px solid var(--line); background: none;
  color: var(--text-2); font: inherit; font-size: var(--fs-secondary); line-height: var(--lh-secondary);
  min-height: 44px; padding: 0 var(--s4); border-radius: var(--r-pill); cursor: pointer;
  display: inline-flex; align-items: center; gap: var(--s2); }
.tabs button:hover { color: var(--text); border-color: var(--line-strong); }
.tabs button[aria-pressed="true"] { background: var(--surface-2); color: var(--text); border-color: var(--line-strong); }
.tabs button[aria-pressed="true"]::after { content: ""; position: absolute; left: 50%; bottom: 5px; width: 4px; height: 4px;
  margin-left: -2px; border-radius: 50%; background: var(--accent); }
.tabs .cnt { font-family: var(--mono); font-variant-numeric: tabular-nums; color: var(--text-2); }
.tabs .pend { color: var(--warn-ink); }

.bar { display: flex; flex-wrap: wrap; gap: var(--s2); align-items: center; margin-bottom: var(--s4); }
.bar select, .bar input[type="search"] { width: auto; flex: 0 0 auto; }
.bar .search { position: relative; flex: 1 1 240px; max-width: 360px; display: flex; margin: 0; }
.bar .search .ic { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-2); pointer-events: none; }
.bar .search input { flex: 1 1 auto; padding-left: 40px; }
.seg { display: inline-flex; gap: var(--s1); padding: var(--s1); border: 1px solid var(--line); border-radius: var(--r-pill); }
.seg button { appearance: none; border: 0; background: none; color: var(--text-2); font: inherit;
  font-size: var(--fs-secondary); min-height: 34px; padding: 0 var(--s4); border-radius: var(--r-pill); cursor: pointer; }
.seg button[aria-pressed="true"] { background: var(--surface-2); color: var(--text); }
@media (pointer: coarse) { .seg button { min-height: 42px; } }

/* The upload: the page's cream card, with a sketch on the right. */
.drop { position: relative; display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: var(--s4);
  align-items: end; min-height: 220px; outline: 1px dashed transparent; outline-offset: -8px; }
.drop.over { outline-color: var(--on-card-light); }
.drop .what { display: grid; gap: var(--s2); align-content: end; }
.drop .what p { margin: 0; }
.drop .t-title { margin: 0; }
.drop .acts { display: flex; gap: var(--s4); flex-wrap: wrap; }
.drop .link-arrow { color: var(--on-card-light); }
.drop .bulk a { color: var(--on-card-light); }
.drop .sketch { color: var(--on-card-light); opacity: .55; align-self: stretch; display: flex; align-items: center; }
.drop .sketch .art { width: 100%; max-height: 200px; }
@media (max-width: 600px) { .drop { grid-template-columns: 1fr; } .drop .sketch { display: none; } }

#panel { padding: var(--s2) var(--s5) var(--s3); }
#panel table.reg th { background: none; position: static; padding-top: var(--s4); }
table.reg td { vertical-align: middle; }
table.reg tbody tr:last-child td { border-bottom: 0; }
table.reg th.n, table.reg td.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
table.reg tr.sup td, table.reg tr.rej td { color: var(--text-2); }
table.reg .num { font-family: var(--mono); font-variant-numeric: tabular-nums; font-size: var(--fs-secondary);
  color: var(--text); white-space: nowrap; }
table.reg .rev { font-family: var(--mono); color: var(--text-2); }
table.reg .ttl { color: var(--text); font-size: var(--fs-body); line-height: var(--lh-body); }
.scroll { overflow-x: auto; }
.scroll > table { min-width: 960px; }

/* What a sheet applies to: quiet words, a dot between them. */
.tag { font-size: var(--fs-secondary); line-height: var(--lh-secondary); color: var(--text); white-space: nowrap; }
.tag + .tag::before { content: "·"; color: var(--text-2); margin: 0 var(--s2); }
.tag.any { color: var(--text-2); }
.byline { font-size: var(--fs-secondary); line-height: var(--lh-secondary); color: var(--text-2); margin-top: 2px; }
.rnote { font-size: var(--fs-secondary); line-height: var(--lh-secondary); color: var(--bad-ink); margin-top: var(--s1); }
.rowbtns { display: flex; gap: var(--s1); justify-content: flex-end; flex-wrap: nowrap; }
.rowbtns button, .rowbtns a { font: inherit; font-size: var(--fs-secondary); min-height: 32px; padding: 0 var(--s3);
  border-radius: var(--r-pill); border: 1px solid transparent; background: none; color: var(--text-2);
  cursor: pointer; text-decoration: none; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; }
.rowbtns button:hover, .rowbtns a:hover { color: var(--text); border-color: var(--line-strong); }
.rowbtns .ok { color: var(--good-ink); border-color: color-mix(in srgb, var(--good-ink) 40%, transparent); }
.rowbtns .no { color: var(--bad-ink); }
@media (pointer: coarse) { .rowbtns button, .rowbtns a { min-height: 44px; } }

.dlg { padding: var(--s5); width: 680px; max-width: 92vw; }
.dlg h2 { margin: 0 0 var(--s1); }
.q { max-height: 56vh; overflow: auto; margin-top: var(--s3); }
.qrow { border: 1px solid var(--line); border-radius: var(--r-card); padding: var(--s4); margin-bottom: var(--s2);
        background: var(--surface-2); }
.qrow input, .qrow select { background: var(--surface); }
.qrow .fname { font-size: var(--fs-secondary); color: var(--text-2); margin-bottom: var(--s2); word-break: break-all; }
.grid4 { display: grid; gap: var(--s2); grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); }
.grid4 + .grid4 { margin-top: var(--s2); }
.qrow .bad { color: var(--bad-ink); font-size: var(--fs-secondary); margin-top: var(--s2); }
.lede { font-size: var(--fs-secondary); line-height: var(--lh-secondary); color: var(--text-2); margin: var(--s1) 0 var(--s3); max-width: 72ch; }
.dlg-acts { display: flex; gap: var(--s2); justify-content: flex-end; margin-top: var(--s4); }
#dlCard h2 { margin: 0 0 var(--s2); }
#dlCard .hint { max-width: 80ch; margin: 0 0 var(--s3); }
#dlOut table { margin: var(--s3) 0; }
#dlOut .btn-primary { margin-top: var(--s2); }
.bulk { margin-top: var(--s2); }

/* Phones: each drawing is a card of its own — number, revision and status on
   top, the rest below; nothing scrolls sideways. */
@media (max-width: 767px) {
  #panel { padding: 0; background: none; border: 0; -webkit-backdrop-filter: none; backdrop-filter: none; }
  .scroll { overflow: visible; }
  .scroll > table { min-width: 0; }
  table.reg.stack tr { display: grid; grid-template-columns: auto auto 1fr auto; column-gap: var(--s2); align-items: center; }
  table.reg.stack td { grid-column: 1 / -1; }
  table.reg.stack td.num { grid-column: 1; grid-row: 1; font-size: var(--fs-body); }
  table.reg.stack td.rev { grid-column: 2; grid-row: 1; }
  table.reg.stack td.rev::before { content: "Rev "; display: inline; text-transform: none; letter-spacing: 0;
    font-size: var(--fs-secondary); font-weight: 400; font-family: var(--font); }
  table.reg.stack td.st { grid-column: 4; grid-row: 1; }
  table.reg.stack td.st::before, table.reg.stack td.ttl::before { display: none; }
  table.reg.stack td.ttl { padding-top: var(--s2); }
  table.reg.stack td.n { text-align: left; grid-column: 1 / 3; }
  table.reg.stack td.n + td.n { grid-column: 3 / 5; }
  table.reg.stack td.act { padding-top: var(--s2); border-top: 1px solid var(--line); margin-top: var(--s2); }
  table.reg.stack .rowbtns { justify-content: flex-start; flex-wrap: wrap; }
  .bar .search { max-width: none; flex-basis: 100%; }
  .bar select { flex: 1 1 auto; }
}
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in centered">
  <div class="start">
    ${BRAND_MARK}
    <select class="proj" id="proj" hidden aria-label="Project"></select>
  </div>
  <nav class="nav" aria-label="Main">
    <a href="/">Dashboard</a>
    <a href="/design" aria-current="page">Design</a>
    <a href="/site">Site update</a>
  </nav>
  <div class="end">
    <button class="icon-btn" id="themeBtn" type="button" title="Light / dark" aria-label="Switch between light and dark">${icon('contrast', 18)}</button>
    <a class="btn btn-cream" href="/api/logout">Sign out</a>
  </div>
</div></div>

<div class="wrap">
  <section class="hero">
    <div class="hero-copy">
      <p class="t-label">Design</p>
      <h1 class="t-display">Drawing register</h1>
      <p class="lead">IFC and shop drawings — the register, and what each sheet reaches.</p>
      <div id="heroCta"></div>
    </div>
    <div class="hero-art">
      ${BUILDING_ART}
      <div class="float" id="pmBanner" hidden></div>
    </div>
  </section>

  <section class="overview${canUpload ? '' : ' no-drop'}">
    <div class="stats" id="stats" aria-live="polite"></div>
    ${canUpload ? `<div class="card-light drop" id="drop">
      <div class="what">
        <p class="t-label">Upload</p>
        <h2 class="t-title">Drop drawings here</h2>
        <p class="t-secondary">PDF, or an image of a sheet. The number and revision are read off the file name where they are in it.
        ${canApprove ? '' : 'Your uploads go to the project manager for approval before they reach site.'}</p>
        <div class="acts">
          <button class="link-arrow" id="pickBtn" type="button">choose files ${icon('arrow-right')}</button>
          <button class="link-arrow" id="linkBtn" type="button">link to one ${icon('arrow-right')}</button>
        </div>
        <div id="bulkLine" class="bulk t-secondary" hidden>A whole folder? <a href="/intake">Drop a folder of drawings</a> — each sheet read, checked against the numbering, and filed.</div>
      </div>
      <div class="sketch">${SKETCH_ART}</div>
      <input type="file" id="pick" multiple accept="application/pdf,image/*" hidden>
    </div>` : ''}
    <div class="feats">
      <div class="feat"><span class="icon-tile">${icon('layers', 18)}</span><div><b>Live revision only</b><span class="d">Site works from the approved, current sheet.</span></div></div>
      <div class="feat"><span class="icon-tile">${icon('check', 18)}</span><div><b>An approval gate</b><span class="d">An upload waits for the project manager.</span></div></div>
      <div class="feat"><span class="icon-tile">${icon('list', 18)}</span><div><b>Checked against the list</b><span class="d">Missing sheets show here as awaited.</span></div></div>
    </div>
  </section>

  <p class="t-label reg-label">The register</p>
  <div class="tabs" id="tabs"></div>

  <div class="bar">
    <label class="search"><span class="sr">Search the register</span>${icon('search')}
      <input type="search" id="q" placeholder="Number, title, trade…"></label>
    <select id="fTrade" aria-label="Trade"><option value="">Every trade</option></select>
    <div class="seg" role="group" aria-label="Which revisions">
      <button data-view="live" aria-pressed="true">Live</button>
      <button data-view="all" aria-pressed="false">All revisions</button>
    </div>
    <div class="spacer"></div>
    <span class="hint" id="stamp"></span>
  </div>

  <div class="card" id="panel"><div class="skel" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div><p class="sr">Loading…</p></div>

  ${canUpload || canApprove ? `<div class="card" id="dlCard">
    <h2>Drawing list from the designer</h2>
    <p class="hint">Drop the designer's or consultant's drawing list (Excel). It is compared with this register: sheets
    missing from the register, sheets at another revision, and sheets not on the list. Document Control confirms; the PM
    approves; missing sheets then show here as <b>awaited</b> until they arrive.</p>
    ${canUpload ? `<input type="file" id="dlFile" accept=".xlsx,.xlsm,.csv">` : ''}
    <div id="dlOut"></div>
  </div>` : ''}
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
  <div class="dlg-acts">
    <button class="btn" id="addCancel">Cancel</button>
    <button class="btn btn-primary" id="addSave">Save to the register</button>
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
var IC = ${iconsFor(['check', 'clock', 'undo', 'archive', 'alert', 'external', 'tag', 'trash', 'sparkle', 'x', 'layers', 'arrow-right'])};
var IC_BIG = ${iconsFor(['layers', 'check'], 22)};

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
  // Bulk loading (spec D2, §25): shown where AETRAA switched it on for this project.
  var bl = document.getElementById('bulkLine'); if (bl) bl.hidden = !D.bulk_load;
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

  // The card floating on the drawing: what is waiting for this person, or
  // else the sheet that most recently went live.
  var banner = document.getElementById('pmBanner');
  if (CAN_APPROVE && pend && TAB !== 'pending') {
    banner.innerHTML = '<p class="t-label">Awaiting your approval</p><span class="t-number">' + pend + '</span>' +
      '<p class="t-secondary">' + pend + (pend === 1 ? ' drawing is' : ' drawings are') + ' waiting for your approval.</p>' +
      '<button class="link-arrow go" id="goPend" type="button">Review now <span class="ring">' + IC['arrow-right'] + '</span></button>';
    banner.hidden = false;
    document.getElementById('goPend').addEventListener('click', goPending);
  } else {
    var latest = D.drawings.filter(function (d) { return d.status === 'current'; })
      .sort(function (a, b) { return String(b.approved_at || b.uploaded_at || '').localeCompare(String(a.approved_at || a.uploaded_at || '')); })[0];
    if (latest) {
      var href = latest.has_file ? '/dwg/' + encodeURIComponent(latest.id) : (latest.url || '');
      banner.innerHTML = '<p class="t-label">Latest live sheet</p>' +
        '<p><span class="ref">' + esc(latest.number) + '</span>' + (latest.revision ? ' <span class="hint">Rev ' + esc(latest.revision) + '</span>' : '') + '</p>' +
        '<p class="t-secondary">' + esc(latest.title || '') + '</p>' +
        (href ? '<a class="link-arrow go" href="' + esc(href) + '" target="_blank" rel="noopener">Open <span class="ring">' + IC['arrow-right'] + '</span></a>' : '');
      banner.hidden = false;
    } else { banner.innerHTML = ''; banner.hidden = true; }
  }

  // The one main button: upload, for whoever uploads; otherwise review.
  var cta = document.getElementById('heroCta');
  if (CAN_UPLOAD) {
    cta.innerHTML = '<button class="btn btn-primary" id="ctaUp" type="button">Upload drawings</button>';
    document.getElementById('ctaUp').addEventListener('click', function () { document.getElementById('pick').click(); });
  } else if (CAN_APPROVE && pend) {
    cta.innerHTML = '<button class="btn btn-primary" id="ctaRev" type="button">Review now</button>';
    document.getElementById('ctaRev').addEventListener('click', goPending);
  } else cta.innerHTML = '';

  // The figures, for the whole register.
  var n = { current: 0, pending: 0, rejected: 0 };
  D.drawings.forEach(function (d) { if (n[d.status] !== undefined) n[d.status]++; });
  document.getElementById('stats').innerHTML =
    '<div class="stat"><span class="t-number">' + n.current + '</span><span class="t-label">Sheets live</span></div>' +
    '<div class="stat"><span class="t-number">' + n.pending + '</span><span class="t-label">Awaiting approval</span></div>' +
    '<div class="stat"><span class="t-number">' + n.rejected + '</span><span class="t-label">Sent back</span></div>';
}

function goPending() {
  TAB = 'pending'; drawTabs(); render();
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById('tabs').scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
}

// A status is tint + icon + words, never colour alone.
function statusPill(d) {
  if (d.status === 'pending') return '<span class="pill warn">' + IC.clock + 'awaiting approval</span>';
  if (d.status === 'rejected') return '<span class="pill bad">' + IC.undo + 'sent back</span>';
  if (d.status === 'held') return '<span class="pill warn">' + IC.alert + 'held for AETRAA</span>';
  if (d.status === 'superseded') return '<span class="pill">' + IC.archive + 'superseded</span>';
  if (d.status === 'awaited') return '<span class="pill warn">' + IC.clock + 'awaited' + (d.revision ? ' rev ' + esc(d.revision) : '') + '</span>';
  return '<span class="pill good">' + IC.check + 'live</span>';
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
      if (VIEW === 'live') { if (d.status !== 'current' && d.status !== 'awaited') return false; }
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
    panel.innerHTML = '<div class="empty"><span class="icon-tile">' + (pendingTab ? IC_BIG.check : IC_BIG.layers) + '</span><span>' + (pendingTab
      ? 'Nothing is waiting for approval.'
      : (D.drawings.length ? 'Nothing here yet.' : 'Nothing on the register yet.') +
        (CAN_UPLOAD ? ' Drop drawings in above.' : '')) + '</span></div>';
    return;
  }

  var h = '<div class="scroll"><table class="reg stack"><thead><tr>' +
    '<th>Number</th><th>Rev</th><th>Title</th><th>Status</th><th>Applies to</th>' +
    '<th class="n">Reaches</th><th class="n">Size</th><th><span class="sr">Actions</span></th></tr></thead><tbody>';
  list.forEach(function (d) {
    var reach = D.reach[d.id];
    var open = d.has_file ? '/dwg/' + encodeURIComponent(d.id) : (d.url || '');
    var cls = d.status === 'superseded' ? ' class="sup"' : d.status === 'rejected' ? ' class="rej"' : '';
    var isLive = d.status === 'current';
    h += '<tr' + cls + '>' +
      '<td class="num">' + esc(d.number) + '</td>' +
      '<td class="rev" data-label="Rev">' + (d.revision ? esc(d.revision) : '<span class="hint">—</span>') + '</td>' +
      '<td class="ttl" data-label="Title">' + esc(d.title || '') +
        (d.uploaded_by ? '<div class="byline">by ' + esc(d.uploaded_by) +
           (d.status === 'current' && d.approved_by ? ' · approved by ' + esc(d.approved_by) : '') + '</div>' : '') +
        (d.status === 'rejected' && d.reject_note ? '<div class="rnote">' + esc(d.reject_note) + '</div>' : '') +
        aiLine(d) +
      '</td>' +
      '<td class="st" data-label="Status">' + statusPill(d) + '</td>' +
      '<td data-label="Applies to">' + (d.trade ? '<span class="tag">' + esc(d.trade) + '</span>' :
                d.trade_group ? '<span class="tag">' + esc(d.trade_group) + ' (all)</span>' :
                '<span class="tag any">any trade</span>') +
             (d.floor ? '<span class="tag">' + esc(d.floor) + '</span>' :
                '<span class="tag any">any floor</span>') + '</td>' +
      '<td class="n" data-label="Reaches">' + (!isLive ? '<span class="hint">—</span>'
        : !reach || !reach.activities ? '<span class="pill bad">' + IC.alert + 'nothing</span>'
        : reach.activities + (reach.pinned ? ' <span class="hint">(' + reach.pinned + ' pinned)</span>' : '')) + '</td>' +
      '<td class="n" data-label="Size">' + (d.has_file ? kb(d.size) : '<span class="hint">link</span>') + '</td>' +
      '<td class="act"><div class="rowbtns">' +
        (open ? '<a href="' + esc(open) + '" target="_blank" rel="noopener">' + IC.external + 'Open</a>' : '') +
        (D.ai_read && Number(d.scanned) === 1 && d.has_file && (d.status === 'pending' || d.status === 'rejected')
          ? '<button data-airead="' + esc(d.id) + '">' + IC.sparkle + 'Read with AI</button>' : '') +
        (CAN_APPROVE && d.status === 'pending'
          ? '<button class="ok" data-approve="' + esc(d.id) + '">' + IC.check + 'Approve</button>' +
            '<button class="no" data-reject="' + esc(d.id) + '">' + IC.undo + 'Send back</button>' : '') +
        (canEditRow(d) ? '<button data-edit="' + esc(d.id) + '">' + IC.tag + 'Tags</button>' +
                         '<button data-del="' + esc(d.id) + '">' + IC.trash + 'Remove</button>' : '') +
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
  panel.querySelectorAll('[data-airead]').forEach(function (b) {
    b.addEventListener('click', function () { var d = find(b.dataset.airead); readSheetAI({ drawing_id: b.dataset.airead }, d ? d.number : 'Sheet'); });
  });
}

// K9 (v5 A1): the sheet's date, and which values the AI read and who
// confirmed them — "read by AI, confirmed by …".
function aiLine(d) {
  var h = d.sheet_date ? '<div class="byline">sheet dated ' + esc(d.sheet_date) + '</div>' : '';
  var a = null;
  try { a = d.read_by_ai ? JSON.parse(d.read_by_ai) : null; } catch (e) { a = null; }
  if (a && a.fields) {
    var byAi = Object.keys(a.fields).filter(function (k) { return a.fields[k] === 'ai'; });
    var typed = Object.keys(a.fields).filter(function (k) { return a.fields[k] !== 'ai'; });
    h += '<div class="byline">' + (byAi.length ? esc(byAi.join(', ')) + ' read by AI, ' : '') + 'confirmed by ' + esc(a.confirmed_by || '') +
      (typed.length ? ' (' + esc(typed.join(', ')) + ' typed)' : '') + '</div>';
  } else if (Number(d.scanned) === 1 && (d.status === 'pending' || d.status === 'rejected')) {
    h += '<div class="byline">a scan — its title block has no text to read' + (D.ai_read ? '; Read with AI' : '') + '</div>';
  }
  return h;
}
window.onAiSheetDone = function (j) { load(); toast(j && j.discarded ? 'The reading was discarded; nothing changed.' : 'Saved to the sheet. It still waits for the PM’s approval.'); };

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

/* ---- E11: the designer's drawing list */
var DL = null;
function dlRow(r, tick) {
  return '<tr>' + (tick ? '<td><input type="checkbox" class="dlx" data-n="' + esc(r.number) + '" checked></td>' : '<td></td>') +
    '<td>' + esc(r.number) + '</td><td>' + esc(r.revision || '') + (r.register_revision !== undefined ? ' <span class="hint">(register: ' + esc(r.register_revision || 'none') + ')</span>' : '') +
    '</td><td>' + esc(r.title || '') + '</td></tr>';
}
function dlShow(d) {
  DL = d;
  var c = d.comparison || {}, st = d.state || 'proposed';
  var notRead = (d.rows && d.rows.rows ? d.rows.rows : d.rows || []).filter(function (x) { return !x.read; });
  var h = '<p class="hint"><b>' + (c.counts ? c.counts.missing : 0) + ' missing</b> from the register · <b>' + (c.counts ? c.counts.changed : 0) +
    ' at another revision</b> · ' + (c.counts ? c.counts.same : 0) + ' as listed · ' + (c.counts ? c.counts.not_listed : 0) + ' in the register but not on the list' +
    (notRead.length ? ' · ' + notRead.length + ' lines not read' : '') + '</p>';
  var editable = st === 'proposed';
  h += '<table class="tbl"><tr><th></th><th>Number</th><th>Revision</th><th>Title</th></tr>' +
    '<tr><td colspan="4"><b>Missing — will become awaited</b></td></tr>' + (c.missing || []).map(function (r) { return dlRow(r, editable); }).join('') +
    '<tr><td colspan="4"><b>At another revision — the listed revision becomes awaited</b></td></tr>' + (c.changed || []).map(function (r) { return dlRow(r, editable); }).join('') +
    '<tr><td colspan="4"><b>In the register but not on the list</b> (nothing is changed)</td></tr>' + (c.not_listed || []).map(function (r) { return dlRow(r, false); }).join('') +
    (notRead.length ? '<tr><td colspan="4"><b>Lines not read</b></td></tr>' + notRead.map(function (r) { return '<tr><td></td><td colspan="3" class="hint">Line ' + r.line + ': ' + esc(r.reason) + '</td></tr>'; }).join('') : '') +
    '</table>';
  if (st === 'proposed' && CAN_UPLOAD_LIST) h += '<button class="btn btn-primary" id="dlConfirm">Confirm the ticked changes</button>';
  if (st === 'confirmed') h += CAN_APPROVE_LIST ? '<button class="btn btn-primary" id="dlApprove">Approve into the register</button>' : '<p class="hint">Confirmed by ' + esc(d.confirmed_by || '') + '. Waiting for the PM to approve it.</p>';
  if (st === 'approved') h += '<p class="hint">Approved by ' + esc(d.approved_by || '') + ': ' + esc((d.result || {}).awaited || 0) + ' sheets are now awaited.</p>';
  document.getElementById('dlOut').innerHTML = h;
  var cb = document.getElementById('dlConfirm');
  if (cb) cb.addEventListener('click', async function () {
    var ex = [].filter.call(document.querySelectorAll('.dlx'), function (x) { return !x.checked; }).map(function (x) { return x.getAttribute('data-n'); });
    var r = await (await fetch('/api/drawing-lists/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: DL.id, exclude: ex }) })).json();
    if (r.error) { toast(r.error); return; }
    dlLoad(DL.id);
  });
  var ab = document.getElementById('dlApprove');
  if (ab) ab.addEventListener('click', async function () {
    var r = await (await fetch('/api/drawing-lists/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: DL.id }) })).json();
    if (r.error) { toast(r.error); return; }
    toast((r.result || {}).awaited + ' sheets are now awaited in the register.');
    dlLoad(DL.id); load();
  });
}
async function dlLoad(id) {
  var d = await (await fetch('/api/drawing-lists?id=' + encodeURIComponent(id), { cache: 'no-store' })).json();
  if (!d.error) dlShow(d);
}
var CAN_UPLOAD_LIST = !!document.getElementById('dlFile');
var CAN_APPROVE_LIST = ${canApprove ? 'true' : 'false'};
(async function () {
  if (!document.getElementById('dlCard')) return;
  var l = await (await fetch('/api/drawing-lists', { cache: 'no-store' })).json();
  var open = (l.lists || []).find(function (x) { return x.state !== 'approved'; });
  if (open) dlLoad(open.id);
  var f = document.getElementById('dlFile');
  if (f) f.addEventListener('change', async function () {
    var file = f.files[0]; if (!file) return;
    var data = await new Promise(function (ok, bad) { var fr = new FileReader(); fr.onload = function () { ok(String(fr.result).split(',')[1] || ''); }; fr.onerror = bad; fr.readAsDataURL(file); });
    var r = await (await fetch('/api/drawing-lists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, data: data }) })).json();
    if (r.error) { toast(r.error); return; }
    dlLoad(r.id);
  });
})();

mountSwitcher('proj');
load();
</script>
<script>${AIREAD_JS}</script>
<script>window.__NOTIFY__ = { can: ${notify && notify.can ? 'true' : 'false'}, auto: false, dc: ${notify && notify.dc ? 'true' : 'false'} };</script>
${NOTIFY_UI}
</body>
</html>`;
