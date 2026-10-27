import { THEME_CSS } from './theme.js';
import { icon } from './icons.js';
import { HEAD_LINKS, PWA_BOOT, SWITCHER_CSS, SWITCHER_JS, BRAND_CSS, BRAND_MARK } from './shared.js';

export const dashboardHTML = (role) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${SWITCHER_CSS}${BRAND_CSS}
.scope-bar { background: var(--surface-2); border: 1px solid var(--border);
  border-left: 3px solid var(--series-1); border-radius: 8px; padding: 9px 12px;
  font-size: var(--fs-secondary); color: var(--ink-2); margin-bottom: 12px; }
.scope-bar b { color: var(--ink); }
.gantt-wrap { overflow: auto; max-height: 70vh; border: 1px solid var(--grid); border-radius: 8px; }
.mono { font-variant-numeric: tabular-nums; }
.filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.filters input, .filters select { width: auto; min-width: 130px; padding: 7px 9px; font-size: var(--fs-secondary); }
.feed { list-style: none; margin: 0; padding: 0; }
.feed li { padding: 9px 0; border-bottom: 1px solid var(--grid); display: flex; gap: 10px; align-items: flex-start; }
.feed li:last-child { border-bottom: none; }
.feed .who { font-size: var(--fs-secondary); color: var(--muted); }
.feed .what { font-size: var(--fs-secondary); }
.bar-mini { height: 6px; border-radius: 3px; background: var(--surface-2); overflow: hidden; min-width: 54px; }
.bar-mini i { display: block; height: 100%; border-radius: 3px; background: var(--series-1); }
.stale { color: var(--critical); }
#tableBox table { min-width: 1280px; }
#tList table { min-width: 1080px; }
#tList td.edit { min-width: 330px; }
#tList td:first-child { min-width: 250px; max-width: 330px; }
#tableBox td:nth-child(-n+4), #tableBox th:nth-child(-n+4) { white-space: nowrap; }
#tableBox td:nth-child(5) { min-width: 260px; max-width: 340px; }
td.clamp { max-width: 230px; }
td.clamp > div { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
#feed { max-height: 430px; overflow-y: auto; }
#attention { max-height: 430px; overflow: auto; }
</style>
</head>
<body data-role="${role}">
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand">
    <h1 id="pname">AETRAA</h1>
    <div class="sub"><span id="pref"></span><span id="ddate"></span></div>
  </div>
  <select class="proj" id="projSel" title="Switch project" hidden></select>
  <div class="spacer"></div>
  <span class="hint" id="refreshed">loading…</span>
  <button class="btn" id="refresh" title="Refresh now" aria-label="Refresh now">${icon('refresh', 16)}</button>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  ${role === 'view' ? '' : '<a class="btn" href="/site">Site update</a>'}
  <a class="btn" href="/diary">Diary</a>
  <a class="btn" href="/design">Design</a>
  ${role === 'owner' || role === 'manager' ? '<a class="btn" href="/verify" id="verifyBtn">Verify</a>' : ''}
  ${role === 'lead' ? '' : '<a class="btn" href="/issues">Issues</a><a class="btn" href="/reports">Reports</a>'}
  ${role === 'owner' || role === 'manager' || role === 'view' ? '<a class="btn" href="/resources">Resources</a>' : ''}
  ${role === 'owner' ? '<a class="btn" href="/portfolio">Portfolio</a><a class="btn" href="/people">People</a><a class="btn" href="/admin">Admin</a>' : ''}
  ${role === 'owner' || role === 'manager' ? '<a class="btn" href="/api/export">Export CSV</a>' : ''}
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  <div class="scope-bar" id="scopeBar" hidden></div>
  <div class="tabs" role="tablist">
    <button class="tab" role="tab" data-tab="target" aria-selected="true" id="tabTarget" hidden>Target</button>
    <button class="tab" role="tab" data-tab="overview" aria-selected="false">Overview</button>
    <button class="tab" role="tab" data-tab="gantt" aria-selected="false">Gantt</button>
    <button class="tab" role="tab" data-tab="table" aria-selected="false">Programme</button>
    <button class="tab" role="tab" data-tab="manpower" aria-selected="false">Manpower</button>
    <button class="tab" role="tab" data-tab="photos" aria-selected="false">Photos</button>
  </div>

  <div class="filters" id="filterbar" hidden>
    <input id="q" type="search" placeholder="Search activity…">
    <select id="fWbs"><option value="">All sections</option></select>
    <select id="fTrade"><option value="">All trades</option></select>
    <select id="fFloor"><option value="">All floors</option></select>
    <select id="fDisc"><option value="">All disciplines</option></select>
    <select id="fStatus"><option value="">All statuses</option></select>
    <button class="btn" id="clearF">Clear</button>
    <span class="hint" id="fCount"></span>
  </div>

  <section id="panel-target" hidden>
    <div class="tiles" id="tTiles"></div>
    <div class="card" style="margin-top:14px">
      <div class="card-head">
        <h2 id="tBurnTitle">Activities left to clear</h2>
        <span class="note">Against the finish-by date on each line</span>
      </div>
      <div class="legend" id="tLegend"></div>
      <div id="tBurn"></div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-head"><h2>By trade group</h2><span class="note">Click a row to list it below</span></div>
      <div class="scroll-x" id="tGroups"></div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-head">
        <h2 id="tListTitle">The list</h2>
        <span class="note" id="tListNote"></span>
      </div>
      <div class="filters">
        <input id="tq" type="search" placeholder="Search…">
        <select id="tGroup"><option value="">All groups</option></select>
        <select id="tState">
          <option value="open">Still open</option>
          <option value="missed">Missed their date</option>
          <option value="soon">Due within 7 days</option>
          <option value="cleared">Cleared</option>
          <option value="">Everything</option>
        </select>
        <button class="btn" id="tClear">Clear</button>
      </div>
      <div class="scroll-x" style="max-height:66vh;overflow:auto" id="tList"></div>
      <div style="text-align:center;margin-top:10px"><button class="btn" id="tMore" hidden>Show more</button></div>
    </div>
  </section>

  <section id="panel-overview" hidden>
    <div class="tiles" id="tiles"></div>
    <div class="card" style="margin-top:14px">
      <div class="card-head">
        <h2>Progress against programme</h2>
        <span class="note">Cumulative % complete, weighted by activity duration</span>
      </div>
      <div class="legend" id="sLegend"></div>
      <div id="scurve"></div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-head">
        <h2>Open work by trade</h2>
        <span class="note">Every trade with activities still to finish — worst first</span>
      </div>
      <div class="scroll-x" style="max-height:440px;overflow:auto" id="byTrade"></div>
    </div>
    <div class="row two" style="margin-top:14px">
      <div class="card">
        <div class="card-head"><h2>Latest from site</h2></div>
        <ul class="feed" id="feed"></ul>
      </div>
      <div class="card">
        <div class="card-head"><h2>Needs attention</h2><span class="note">Delayed, at risk or on hold</span></div>
        <div class="scroll-x" id="attention"></div>
      </div>
    </div>
  </section>

  <section id="panel-gantt" hidden>
    <div class="card">
      <div class="card-head">
        <h2>Planned vs actual</h2>
        <span class="note">Upper bar planned, lower bar actual progress</span>
      </div>
      <div class="legend" id="gLegend"></div>
      <div class="hint" id="gNote" hidden style="margin:6px 0 8px"></div>
      <div class="gantt-wrap"><div id="gantt"></div></div>
    </div>
  </section>

  <section id="panel-table" hidden>
    <div class="card">
      <div class="scroll-x" style="max-height:74vh;overflow:auto" id="tableBox"></div>
      <div style="text-align:center;margin-top:10px"><button class="btn" id="moreRows" hidden>Show more rows</button></div>
    </div>
  </section>

  <section id="panel-manpower" hidden>
    <div class="card">
      <div class="card-head"><h2>Manpower on site</h2><span class="note">Headcount by trade, last 30 returns</span></div>
      <div class="legend" id="mLegend"></div>
      <div id="mchart"></div>
    </div>
    <div class="card">
      <div class="card-head"><h2>Returns</h2></div>
      <div class="scroll-x" style="max-height:50vh;overflow:auto" id="mtable"></div>
    </div>
  </section>

  <section id="panel-photos" hidden>
    <div class="card">
      <div class="filters">
        <select id="fPhotoAct"><option value="">All activities</option></select>
        <span class="hint" id="photoCount"></span>
      </div>
      <div class="grid-photos" id="photos"></div>
    </div>
  </section>
</div>

<div class="tooltip" id="tip"></div>
<div class="lightbox" id="lb"><img alt="Progress photo" id="lbImg"></div>
<div class="toast" id="toast"></div>

<script>
/* ------------------------------------------------------------ utilities */
var STATUS = {
  not_started: { label: 'Not started', color: 'var(--muted)',    icon: '${icon('minus', 12)}' },
  in_progress: { label: 'In progress', color: 'var(--series-1)', icon: '${icon('clock', 12)}' },
  complete:    { label: 'Complete',    color: 'var(--good)',     icon: '${icon('check', 12)}' },
  at_risk:     { label: 'At risk',     color: 'var(--warning)',  icon: '${icon('alert', 12)}' },
  delayed:     { label: 'Delayed',     color: 'var(--critical)', icon: '${icon('alert', 12)}' },
  on_hold:     { label: 'On hold',     color: 'var(--serious)',  icon: '${icon('clock', 12)}' }
};
var SERIES = ['var(--series-1)','var(--series-2)','var(--series-3)','var(--series-4)',
              'var(--series-5)','var(--series-6)','var(--series-7)','var(--series-8)'];
var MS = 86400000;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function D(s) { return s ? new Date(s + 'T00:00:00Z') : null; }
function dayNum(d) { return Math.floor(d.getTime() / MS); }
function iso(d) { return new Date(d).toISOString().slice(0, 10); }
function fmt(s) {
  var d = D(s); if (!d) return '';
  var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return String(d.getUTCDate()).padStart(2, '0') + ' ' + m[d.getUTCMonth()] + ' ' + String(d.getUTCFullYear()).slice(2);
}
function fmtMon(d) {
  var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return m[d.getUTCMonth()] + " '" + String(d.getUTCFullYear()).slice(2);
}
function one(n) { return (Math.round(n * 10) / 10).toFixed(1); }
function ago(isoTs) {
  var mins = Math.floor((Date.now() - Date.parse(isoTs)) / 60000);
  if (!isFinite(mins)) return '';
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + ' min ago';
  var h = Math.floor(mins / 60);
  if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
  var dd = Math.floor(h / 24);
  return dd + (dd === 1 ? ' day ago' : ' days ago');
}
function toast(msg, bad) {
  var t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
  setTimeout(function () { t.className = 'toast' + (bad ? ' bad' : ''); }, 3200);
}

/* --------------------------------------------------------------- state */
var DATA = null, MODEL = null, SWITCHER_UP = false;

function weightOf(a) {
  if (a.weight && a.weight > 0) return a.weight;
  var s = D(a.planned_start), f = D(a.planned_finish);
  if (s && f) return Math.max(1, dayNum(f) - dayNum(s) + 1);
  return 1;
}

// Build everything the views need, once per fetch.
function buildModel(d) {
  var acts = d.activities.slice();
  var detail = acts.filter(function (a) { return (a.level == null ? 1 : a.level) >= 1; });
  if (!detail.length) detail = acts;

  var totW = 0, byId = {};
  detail.forEach(function (a) { a._w = weightOf(a); totW += a._w; });
  acts.forEach(function (a) { byId[a.id] = a; });

  // current status per activity
  acts.forEach(function (a) {
    var c = d.current[a.id];
    a._pct = c && c.pct != null ? c.pct : 0;
    a._as = c ? c.actual_start : null;
    a._af = c ? c.actual_finish : null;
    a._status = (c && c.status) || (a._pct >= 100 ? 'complete' : a._pct > 0 ? 'in_progress' : 'not_started');
    a._reason = c ? c.delay_reason : null;
    a._remarks = c ? c.remarks : null;
    a._rd = c ? c.report_date : null;
    a._by = c ? c.submitted_by : null;
    a._at = c ? c.created_at : null;
    var pf = D(a.planned_finish), af = D(a._af);
    a._slip = null;
    if (pf && af) a._slip = dayNum(af) - dayNum(pf);
    else if (pf && a._pct < 100) {
      var over = dayNum(new Date()) - dayNum(pf);
      if (over > 0) a._slip = over;
    }
  });

  // summary rows: roll up % and span from the detail rows in the same section
  acts.forEach(function (a) {
    a._isSum = (a.level == null ? 1 : a.level) === 0;
    if (!a._isSum) return;
    var kids = detail.filter(function (k) { return (k.wbs || '') === (a.wbs || ''); });
    var w = 0, s = 0, ps = [], pf = [];
    kids.forEach(function (k) {
      w += k._w; s += (k._pct / 100) * k._w;
      if (k.planned_start) ps.push(dayNum(D(k.planned_start)));
      if (k.planned_finish) pf.push(dayNum(D(k.planned_finish)));
    });
    a._pct = w ? (s / w) * 100 : 0;
    a._kids = kids.length;
    a._sumS = ps.length ? Math.min.apply(null, ps) : null;
    a._sumF = pf.length ? Math.max.apply(null, pf) : null;
    a._status = null; a._slip = null;
  });

  // domain
  var starts = [], finishes = [];
  detail.forEach(function (a) {
    if (a.planned_start) starts.push(dayNum(D(a.planned_start)));
    if (a.planned_finish) finishes.push(dayNum(D(a.planned_finish)));
    if (a._as) starts.push(dayNum(D(a._as)));
    if (a._af) finishes.push(dayNum(D(a._af)));
  });
  var todayN = dayNum(new Date());
  var dataDate = d.history.length
    ? d.history.map(function (h) { return h.report_date; }).sort().slice(-1)[0]
    : iso(new Date());
  var d0 = starts.length ? Math.min.apply(null, starts) : todayN - 30;
  var d1 = finishes.length ? Math.max.apply(null, finishes) : todayN + 30;
  d1 = Math.max(d1, todayN, dayNum(D(dataDate)));

  // Planned cumulative % per day, computed once. With a few thousand activities this
  // is the difference between a responsive page and a locked-up one: each activity
  // spreads its weight across its own days, then one running total sweeps the domain.
  var span = d1 - d0 + 2;
  var daily = new Float64Array(span);
  detail.forEach(function (a) {
    var s = D(a.planned_start), f = D(a.planned_finish);
    if (!s || !f) return;
    var sn = dayNum(s), fn = dayNum(f), len = fn - sn;
    if (len <= 0) {                                   // milestone: all of it lands on one day
      daily[Math.max(0, Math.min(span - 1, fn - d0))] += a._w;
      return;
    }
    var per = a._w / len;
    var from = Math.max(d0, sn + 1), to = Math.min(d1, fn);
    for (var i = from; i <= to; i++) daily[i - d0] += per;
  });
  var cum = new Float64Array(span);
  var run = 0;
  for (var ci = 0; ci < span; ci++) { run += daily[ci]; cum[ci] = run; }
  function plannedAt(n) {
    if (!totW) return 0;
    var i = Math.max(0, Math.min(span - 1, n - d0));
    return (cum[i] / totW) * 100;
  }

  // Actual cumulative %, also per day. Where an activity has real start and finish dates
  // its weight is earned across the days it was actually worked — that is what gives a
  // proper S-curve from a P6 import, which otherwise carries only one reporting date.
  // Activities with no actual dates fall back to the step history of what site submitted.
  var hist = {};
  d.history.forEach(function (h) {
    (hist[h.activity_id] = hist[h.activity_id] || []).push(h);
  });
  Object.keys(hist).forEach(function (k) {
    hist[k].sort(function (a, b) { return a.report_date < b.report_date ? -1 : 1; });
  });

  var ddN0 = dayNum(D(dataDate));
  var aDaily = new Float64Array(span);
  var put = function (n, v) { aDaily[Math.max(0, Math.min(span - 1, n - d0))] += v; };
  var spread = function (from, to, total) {
    var len = to - from;
    if (len <= 0) { put(to, total); return; }
    var per = total / len;
    for (var i = Math.max(d0, from + 1); i <= Math.min(d1, to); i++) put(i, per);
  };
  detail.forEach(function (a) {
    var as = a._as ? dayNum(D(a._as)) : null;
    var af = a._af ? dayNum(D(a._af)) : null;
    var earned = (Math.max(0, Math.min(100, a._pct)) / 100) * a._w;
    if (as != null && af != null && af >= as) spread(as, af, a._w);
    else if (as != null && earned > 0) spread(as, Math.max(as, ddN0), earned);
    else {
      var rows = hist[a.id];
      if (!rows) return;
      var prev = 0;
      rows.forEach(function (r) {
        if (r.pct == null) return;
        put(dayNum(D(r.report_date)), ((r.pct - prev) / 100) * a._w);
        prev = r.pct;
      });
    }
  });
  var aCum = new Float64Array(span);
  var arun = 0;
  for (var ai = 0; ai < span; ai++) { arun += aDaily[ai]; aCum[ai] = arun; }
  function actualAt(n) {
    if (!totW) return 0;
    var i = Math.max(0, Math.min(span - 1, n - d0));
    return (aCum[i] / totW) * 100;
  }

  // weekly samples for the S-curve
  var step = Math.max(1, Math.ceil((d1 - d0) / 120));
  var ddN = dayNum(D(dataDate));
  var sampleAt = {};
  for (var n = d0; n <= d1; n += step) sampleAt[n] = 1;
  sampleAt[d1] = 1; sampleAt[ddN] = 1;                 // always land on the data date
  d.history.forEach(function (h) { sampleAt[dayNum(D(h.report_date))] = 1; });
  var curve = Object.keys(sampleAt).map(Number).sort(function (a, b) { return a - b; })
    .filter(function (v) { return v >= d0 && v <= d1; })
    .map(function (v) { return { n: v, planned: plannedAt(v), actual: v <= ddN ? actualAt(v) : null }; });

  var actualNow = actualAt(ddN), plannedNow = plannedAt(ddN);

  // days behind: when was the programme at today's actual progress?
  var behind = null;
  if (actualNow < plannedNow - 0.05) {
    for (var k = ddN; k >= d0; k--) {
      if (plannedAt(k) <= actualNow) { behind = ddN - k; break; }
    }
    if (behind === null) behind = ddN - d0;
  } else if (actualNow > plannedNow + 0.05) {
    for (var k2 = ddN; k2 <= d1; k2++) {
      if (plannedAt(k2) >= actualNow) { behind = ddN - k2; break; }
    }
    if (behind === null) behind = ddN - d1;
  } else behind = 0;

  var counts = { delayed: 0, at_risk: 0, on_hold: 0, complete: 0, in_progress: 0, not_started: 0 };
  detail.forEach(function (a) { counts[a._status] = (counts[a._status] || 0) + 1; });

  var photosBy = {};
  d.photos.forEach(function (p) { photosBy[p.activity_id] = (photosBy[p.activity_id] || 0) + 1; });

  return {
    acts: acts, detail: detail, byId: byId, totW: totW,
    d0: d0, d1: d1, todayN: todayN, dataDate: dataDate, ddN: ddN,
    curve: curve, actualNow: actualNow, plannedNow: plannedNow,
    behind: behind, counts: counts, photosBy: photosBy,
    plannedAt: plannedAt
  };
}

/* ------------------------------------------------------------- tooltip */
var tipEl = document.getElementById('tip');
function showTip(x, y, html) {
  tipEl.innerHTML = html;
  tipEl.style.opacity = '1';
  var r = tipEl.getBoundingClientRect();
  var left = Math.min(x + 14, window.innerWidth - r.width - 8);
  var top = Math.max(8, Math.min(y - r.height - 12, window.innerHeight - r.height - 8));
  tipEl.style.left = left + 'px'; tipEl.style.top = top + 'px';
}
function hideTip() { tipEl.style.opacity = '0'; }

/* -------------------------------------------------------------- tiles */
function renderTiles() {
  var m = MODEL, v = m.actualNow - m.plannedNow;
  var varColor = v >= -0.5 ? 'var(--good-text)' : v > -5 ? 'var(--serious)' : 'var(--critical)';
  var bh = m.behind;
  var bhLabel = bh === 0 ? 'On programme' : bh > 0 ? 'Behind programme' : 'Ahead of programme';
  var bhColor = bh <= 0 ? 'var(--good-text)' : bh <= 7 ? 'var(--serious)' : 'var(--critical)';
  var last = DATA.recent && DATA.recent[0];
  var attn = (m.counts.delayed || 0) + (m.counts.at_risk || 0) + (m.counts.on_hold || 0);

  var t = [
    ['Actual progress', one(m.actualNow) + '%', 'Planned ' + one(m.plannedNow) + '% at ' + fmt(m.dataDate), ''],
    ['Variance', (v >= 0 ? '+' : '') + one(v) + ' pp', v >= 0 ? 'At or ahead of plan' : 'Behind plan', varColor],
    ['Time slippage', Math.abs(bh) + (Math.abs(bh) === 1 ? ' day' : ' days'), bhLabel, bhColor],
    ['Needs attention', String(attn), (m.counts.delayed || 0) + ' delayed \\u00B7 ' + (m.counts.at_risk || 0) + ' at risk \\u00B7 ' + (m.counts.on_hold || 0) + ' on hold', attn ? 'var(--critical)' : 'var(--good-text)'],
    ['Activities complete', (m.counts.complete || 0) + ' / ' + m.detail.length, (m.counts.in_progress || 0) + ' in progress', ''],
    ['Last update received', last ? ago(last.created_at) : 'none yet', last ? 'by ' + esc(last.submitted_by || 'site') : 'site has not submitted', last && (Date.now() - Date.parse(last.created_at)) > 3 * MS ? 'var(--critical)' : '']
  ];
  document.getElementById('tiles').innerHTML = t.map(function (x) {
    return '<div class="tile"><div class="k">' + x[0] + '</div>' +
           '<div class="v"' + (x[3] ? ' style="color:' + x[3] + '"' : '') + '>' + x[1] + '</div>' +
           '<div class="s">' + x[2] + '</div></div>';
  }).join('');
}

/* ------------------------------------------------------------ S-curve */
function renderSCurve() {
  var m = MODEL, box = document.getElementById('scurve');
  if (!m.curve.length) { box.innerHTML = '<div class="empty">No programme dates yet.</div>'; return; }
  var W = Math.max(320, box.clientWidth || 900), H = 300;
  var pad = { t: 14, r: 16, b: 34, l: 40 };
  var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  var x = function (n) { return pad.l + ((n - m.d0) / Math.max(1, m.d1 - m.d0)) * iw; };
  var y = function (v) { return pad.t + ih - (v / 100) * ih; };

  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img" aria-label="Planned versus actual cumulative progress">';
  // gridlines
  for (var g = 0; g <= 100; g += 25) {
    s += '<line x1="' + pad.l + '" y1="' + y(g) + '" x2="' + (W - pad.r) + '" y2="' + y(g) +
         '" stroke="var(--grid)" stroke-width="1"/>' +
         '<text x="' + (pad.l - 7) + '" y="' + (y(g) + 4) + '" text-anchor="end" font-size="10.5" fill="var(--muted)">' + g + '%</text>';
  }
  // month ticks
  var cur = new Date((m.d0) * MS); cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), 1));
  var span = m.d1 - m.d0, everyN = span > 900 ? 3 : span > 400 ? 2 : 1, i = 0;
  while (dayNum(cur) <= m.d1) {
    var xn = x(dayNum(cur));
    if (xn >= pad.l - 1 && i % everyN === 0) {
      s += '<line x1="' + xn + '" y1="' + pad.t + '" x2="' + xn + '" y2="' + (pad.t + ih) + '" stroke="var(--grid)" stroke-width="1"/>' +
           '<text x="' + xn + '" y="' + (H - 12) + '" text-anchor="middle" font-size="10.5" fill="var(--muted)">' + fmtMon(cur) + '</text>';
    }
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1)); i++;
  }
  // data-date marker
  s += '<line x1="' + x(m.ddN) + '" y1="' + pad.t + '" x2="' + x(m.ddN) + '" y2="' + (pad.t + ih) +
       '" stroke="var(--ink-2)" stroke-width="1" stroke-dasharray="3 3"/>' +
       '<text x="' + (x(m.ddN) - 5) + '" y="' + (pad.t + 11) + '" text-anchor="end" font-size="10.5" fill="var(--ink-2)">data date</text>';
  // baseline
  s += '<line x1="' + pad.l + '" y1="' + (pad.t + ih) + '" x2="' + (W - pad.r) + '" y2="' + (pad.t + ih) + '" stroke="var(--axis)" stroke-width="1"/>';

  var pPath = m.curve.map(function (c, j) { return (j ? 'L' : 'M') + x(c.n) + ' ' + y(c.planned); }).join(' ');
  var aPts = m.curve.filter(function (c) { return c.actual != null; });
  var aPath = aPts.map(function (c, j) { return (j ? 'L' : 'M') + x(c.n) + ' ' + y(c.actual); }).join(' ');
  s += '<path d="' + pPath + '" fill="none" stroke="var(--series-1)" stroke-width="2" stroke-linecap="round"/>';
  if (aPath) s += '<path d="' + aPath + '" fill="none" stroke="var(--series-2)" stroke-width="2" stroke-linecap="round"/>';
  if (aPts.length) {
    var lastP = aPts[aPts.length - 1];
    s += '<circle cx="' + x(lastP.n) + '" cy="' + y(lastP.actual) + '" r="4.5" fill="var(--series-2)" stroke="var(--surface)" stroke-width="2"/>';
  }
  s += '<line id="cross" x1="0" y1="' + pad.t + '" x2="0" y2="' + (pad.t + ih) + '" stroke="var(--axis)" stroke-width="1" opacity="0"/>';
  s += '<rect id="hit" x="' + pad.l + '" y="' + pad.t + '" width="' + iw + '" height="' + ih + '" fill="transparent"/>';
  s += '</svg>';
  box.innerHTML = s;

  document.getElementById('sLegend').innerHTML =
    '<span><i class="swatch" style="background:var(--series-1)"></i>Planned</span>' +
    '<span><i class="swatch" style="background:var(--series-2)"></i>Actual</span>';

  var svg = box.querySelector('svg'), cross = box.querySelector('#cross'), hit = box.querySelector('#hit');
  function move(ev) {
    var r = svg.getBoundingClientRect();
    var px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) * (W / r.width);
    var n = Math.round(m.d0 + ((px - pad.l) / iw) * (m.d1 - m.d0));
    n = Math.max(m.d0, Math.min(m.d1, n));
    cross.setAttribute('x1', x(n)); cross.setAttribute('x2', x(n)); cross.setAttribute('opacity', '1');
    var pl = m.plannedAt(n);
    var near = null, best = 1e9;
    m.curve.forEach(function (c) { if (c.actual != null && Math.abs(c.n - n) < best) { best = Math.abs(c.n - n); near = c; } });
    var htm = '<b>' + fmt(iso(n * MS)) + '</b>' +
      '<div class="tl"><span>Planned</span><span>' + one(pl) + '%</span></div>';
    if (near && n <= m.ddN) htm += '<div class="tl"><span>Actual</span><span>' + one(near.actual) + '%</span></div>';
    showTip(ev.touches ? ev.touches[0].clientX : ev.clientX, r.top + 40, htm);
  }
  hit.addEventListener('mousemove', move);
  hit.addEventListener('touchmove', function (e) { move(e); }, { passive: true });
  svg.addEventListener('mouseleave', function () { hideTip(); cross.setAttribute('opacity', '0'); });
}

/* -------------------------------------------------------------- Gantt */
function renderGantt() {
  var m = MODEL, box = document.getElementById('gantt');
  if (!m.acts.length) { box.innerHTML = '<div class="empty">No programme loaded yet.</div>'; return; }
  var all = filtered(true);
  var acts = all.slice(0, GANTT_CAP);
  var note = document.getElementById('gNote');
  note.textContent = all.length > GANTT_CAP
    ? 'Showing the first ' + GANTT_CAP + ' of ' + all.length + ' rows — filter by trade, floor or section to narrow it down.'
    : '';
  note.hidden = all.length <= GANTT_CAP;
  if (!acts.length) { box.innerHTML = '<div class="empty">Nothing matches those filters.</div>'; return; }
  var nameW = 260, rowH = 26, head = 34;
  var days = Math.max(1, m.d1 - m.d0);
  var ppd = Math.max(1.1, Math.min(9, 1100 / days));
  var W = nameW + days * ppd + 24;
  var H = head + acts.length * rowH + 10;
  var x = function (n) { return nameW + (n - m.d0) * ppd; };

  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" font-size="11.5">';
  // month grid + header
  var cur = new Date(m.d0 * MS); cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), 1));
  var everyN = ppd < 2 ? 3 : ppd < 4 ? 2 : 1, i = 0;
  while (dayNum(cur) <= m.d1) {
    var xn = x(dayNum(cur));
    if (xn >= nameW) {
      s += '<line x1="' + xn + '" y1="' + (head - 8) + '" x2="' + xn + '" y2="' + H + '" stroke="var(--grid)" stroke-width="1"/>';
      if (i % everyN === 0) s += '<text x="' + (xn + 4) + '" y="' + (head - 14) + '" fill="var(--muted)">' + fmtMon(cur) + '</text>';
    }
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1)); i++;
  }
  // today
  if (m.todayN >= m.d0 && m.todayN <= m.d1) {
    s += '<line x1="' + x(m.todayN) + '" y1="' + (head - 8) + '" x2="' + x(m.todayN) + '" y2="' + H +
         '" stroke="var(--series-7)" stroke-width="1.5" stroke-dasharray="4 3"/>';
  }
  s += '<rect x="0" y="0" width="' + nameW + '" height="' + H + '" fill="var(--surface)"/>';
  s += '<line x1="' + nameW + '" y1="0" x2="' + nameW + '" y2="' + H + '" stroke="var(--border)" stroke-width="1"/>';
  s += '<text x="8" y="' + (head - 14) + '" fill="var(--muted)">Activity</text>';

  acts.forEach(function (a, r) {
    var y0 = head + r * rowH;
    var isSum = (a.level == null ? 1 : a.level) === 0;
    if (r % 2) s += '<rect x="' + nameW + '" y="' + y0 + '" width="' + (W - nameW) + '" height="' + rowH + '" fill="var(--surface-2)" opacity=".5"/>';
    var nm = a.name.length > 34 ? a.name.slice(0, 33) + '\\u2026' : a.name;
    s += '<text x="' + (8 + (isSum ? 0 : 10)) + '" y="' + (y0 + 17) + '" fill="var(--ink' + (isSum ? '' : '-2') + ')"' +
         (isSum ? ' font-weight="600"' : '') + '>' + esc(nm) + '</text>';

    if (isSum) {
      if (a._sumS != null && a._sumF != null) {
        var sw = Math.max(3, (a._sumF - a._sumS + 1) * ppd);
        s += '<path d="M' + x(a._sumS) + ' ' + (y0 + 7) + ' h' + sw + ' v5 l-4 -2 h' + -(sw - 8) + ' l-4 2 z" fill="var(--ink-2)"/>';
        if (a._pct > 0) s += '<rect x="' + x(a._sumS) + '" y="' + (y0 + 15) + '" width="' + Math.max(2, sw * (a._pct / 100)) +
             '" height="5" rx="2.5" fill="var(--series-1)"/>';
      }
      s += '<rect class="grow" data-id="' + esc(a.id) + '" x="0" y="' + y0 + '" width="' + W + '" height="' + rowH + '" fill="transparent"/>';
      return;
    }
    var ps = a.planned_start ? dayNum(D(a.planned_start)) : null;
    var pf = a.planned_finish ? dayNum(D(a.planned_finish)) : null;
    if (ps != null && pf != null) {
      s += '<rect x="' + x(ps) + '" y="' + (y0 + 4) + '" width="' + Math.max(2, (pf - ps + 1) * ppd) +
           '" height="7" rx="3.5" fill="var(--planned-bar)"/>';
      var as = a._as ? dayNum(D(a._as)) : ps;
      var pct = Math.max(0, Math.min(100, a._pct));
      var len = a._af ? (dayNum(D(a._af)) - as + 1) * ppd : ((pf - ps + 1) * ppd) * (pct / 100);
      if (pct > 0 || a._as) {
        s += '<rect x="' + x(as) + '" y="' + (y0 + 13) + '" width="' + Math.max(2, len) +
             '" height="7" rx="3.5" fill="' + (STATUS[a._status] || STATUS.in_progress).color + '"/>';
      }
    }
    s += '<rect class="grow" data-id="' + esc(a.id) + '" x="0" y="' + y0 + '" width="' + W + '" height="' + rowH + '" fill="transparent"/>';
  });
  s += '</svg>';
  box.innerHTML = s;

  document.getElementById('gLegend').innerHTML =
    '<span><i class="swatch" style="background:var(--planned-bar)"></i>Planned</span>' +
    Object.keys(STATUS).map(function (k) {
      return '<span><i class="swatch" style="background:' + STATUS[k].color + '"></i>' + STATUS[k].label + '</span>';
    }).join('') +
    '<span><i class="swatch" style="background:var(--series-7)"></i>Today</span>';

  box.querySelectorAll('.grow').forEach(function (el) {
    el.addEventListener('mouseenter', function (ev) { showTip(ev.clientX, ev.clientY, rowTip(MODEL.byId[el.dataset.id])); });
    el.addEventListener('mousemove', function (ev) { showTip(ev.clientX, ev.clientY, rowTip(MODEL.byId[el.dataset.id])); });
    el.addEventListener('mouseleave', hideTip);
  });
}

function rowTip(a) {
  if (!a) return '';
  if (a._isSum) {
    return '<b>' + esc(a.name) + '</b>' +
      '<div class="tl"><span>Section complete</span><span>' + one(a._pct) + '%</span></div>' +
      '<div class="tl"><span>Activities</span><span>' + (a._kids || 0) + '</span></div>' +
      (a._sumS ? '<div class="tl"><span>Planned</span><span>' + fmt(iso(a._sumS * MS)) + ' \\u2192 ' + fmt(iso(a._sumF * MS)) + '</span></div>' : '');
  }
  var st = STATUS[a._status] || STATUS.not_started;
  var h = '<b>' + esc(a.id) + ' \\u00B7 ' + esc(a.name) + '</b>';
  h += '<div class="tl"><span>Status</span><span>' + st.icon + ' ' + st.label + '</span></div>';
  h += '<div class="tl"><span>Complete</span><span>' + one(a._pct) + '%</span></div>';
  h += '<div class="tl"><span>Planned</span><span>' + fmt(a.planned_start) + ' \\u2192 ' + fmt(a.planned_finish) + '</span></div>';
  if (a._as || a._af) h += '<div class="tl"><span>Actual</span><span>' + (fmt(a._as) || '\\u2014') + ' \\u2192 ' + (fmt(a._af) || '\\u2026') + '</span></div>';
  if (a._slip != null && a._slip !== 0) h += '<div class="tl"><span>Slippage</span><span>' + (a._slip > 0 ? '+' : '') + a._slip + 'd</span></div>';
  if (a._reason) h += '<div class="tl"><span>Reason</span><span>' + esc(a._reason) + '</span></div>';
  if (a._remarks) h += '<div style="margin-top:5px;color:var(--ink-2)">' + esc(a._remarks) + '</div>';
  if (a._rd) h += '<div style="margin-top:5px;font-size:var(--fs-secondary);color:var(--muted)">reported ' + fmt(a._rd) + ' by ' + esc(a._by || 'site') + '</div>';
  return h;
}

/* -------------------------------------------------------------- table */
var sortKey = null, sortDir = 1, rowLimit = 400;
var GANTT_CAP = 400;

// One filter, used by both the Gantt and the programme table.
function filtered(keepSummaries) {
  var m = MODEL;
  var v = function (id) { var e = document.getElementById(id); return e ? e.value : ''; };
  var q = (v('q') || '').toLowerCase();
  var fw = v('fWbs'), ft = v('fTrade'), ff = v('fFloor'), fd = v('fDisc'), fs = v('fStatus');
  var any = q || fw || ft || ff || fd || fs;
  var rows = m.acts.filter(function (a) {
    if (a._isSum) return keepSummaries && !any;
    if (fw && (a.wbs || '') !== fw) return false;
    if (ft && (a.trade || '') !== ft) return false;
    if (ff && (a.floor || '') !== ff) return false;
    if (fd && (a.discipline || '') !== fd) return false;
    if (fs && a._status !== fs) return false;
    if (q && (a.name + ' ' + a.id + ' ' + (a.wbs || '') + ' ' + (a.trade || '') + ' ' + (a._remarks || '')).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
  var el = document.getElementById('fCount');
  if (el) el.textContent = rows.filter(function (a) { return !a._isSum; }).length + ' of ' + m.detail.length + ' activities';
  return rows;
}

function renderTable() {
  var m = MODEL;
  var all = filtered(true);
  var rows = all;
  if (sortKey) {
    rows = rows.slice().sort(function (a, b) {
      var va = a[sortKey], vb = b[sortKey];
      if (va == null) va = ''; if (vb == null) vb = '';
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sortDir;
      return String(va).localeCompare(String(vb)) * sortDir;
    });
  }
  var capped = rows.length > rowLimit;
  if (capped) rows = rows.slice(0, rowLimit);
  var more = document.getElementById('moreRows');
  more.hidden = !capped;
  more.textContent = 'Show more (' + (all.length - rowLimit) + ' not shown)';

  var cols = [
    ['id', 'ID'], ['wbs', 'Section'], ['trade', 'Trade'], ['floor', 'Floor'], ['name', 'Activity'],
    ['planned_start', 'Plan start'], ['planned_finish', 'Plan finish'],
    ['_as', 'Act start'], ['_af', 'Act finish'],
    ['_pct', '%'], ['_status', 'Status'], ['_slip', 'Slip'],
    ['_reason', 'Delay reason'], ['_remarks', 'Remarks'], ['_rd', 'Reported']
  ];
  var h = '<table><thead><tr>' + cols.map(function (c) {
    var isNum = c[0] === '_pct' || c[0] === '_slip';
    return '<th class="' + (isNum ? 'num' : '') + '" data-k="' + c[0] + '">' + c[1] +
           (sortKey === c[0] ? (sortDir > 0 ? ' \\u2191' : ' \\u2193') : '') + '</th>';
  }).join('') + '</tr></thead><tbody>';

  if (!rows.length) h += '<tr><td colspan="' + cols.length + '"><div class="empty">Nothing matches those filters.</div></td></tr>';
  rows.forEach(function (a) {
    var isSum = a._isSum;
    var st = isSum ? { color: 'var(--series-1)', label: '' } : (STATUS[a._status] || STATUS.not_started);
    h += '<tr' + (isSum ? ' class="summary"' : '') + '>' +
      '<td class="mono">' + esc(a.id) + '</td>' +
      '<td>' + esc(a.wbs || '') + '</td>' +
      '<td>' + esc(a.trade || '') + '</td>' +
      '<td>' + esc(a.floor || '') + '</td>' +
      '<td>' + esc(a.name) + (isSum ? ' <span class="hint">(' + (a._kids || 0) + ')</span>' : '') +
        (MODEL.photosBy[a.id] ? ' <span class="hint">\\u00B7 ' + MODEL.photosBy[a.id] + ' photo' + (MODEL.photosBy[a.id] > 1 ? 's' : '') + '</span>' : '') + '</td>' +
      '<td class="num">' + (isSum ? (a._sumS ? fmt(iso(a._sumS * MS)) : '') : fmt(a.planned_start)) + '</td>' +
      '<td class="num">' + (isSum ? (a._sumF ? fmt(iso(a._sumF * MS)) : '') : fmt(a.planned_finish)) + '</td>' +
      '<td class="num">' + (isSum ? '' : fmt(a._as)) + '</td>' +
      '<td class="num">' + (isSum ? '' : fmt(a._af)) + '</td>' +
      '<td class="num" style="min-width:86px"><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">' +
        '<span>' + one(a._pct) + '</span><span class="bar-mini"><i style="width:' + Math.max(0, Math.min(100, a._pct)) + '%;background:' + st.color + '"></i></span></div></td>' +
      '<td>' + (isSum ? '' : '<span class="pill"><i class="dot" style="background:' + st.color + '"></i>' + st.label + '</span>') + '</td>' +
      '<td class="num"' + (a._slip > 0 ? ' style="color:var(--critical)"' : '') + '>' + (a._slip == null || a._slip === 0 ? '' : (a._slip > 0 ? '+' : '') + a._slip + 'd') + '</td>' +
      '<td class="clamp" title="' + esc(a._reason || '') + '"><div>' + esc(a._reason || '') + '</div></td>' +
      '<td class="clamp" title="' + esc(a._remarks || '') + '"><div>' + esc(a._remarks || '') + '</div></td>' +
      '<td class="num">' + fmt(a._rd) + '</td>' +
    '</tr>';
  });
  h += '</tbody></table>';
  document.getElementById('tableBox').innerHTML = h;
  document.querySelectorAll('#tableBox th').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.dataset.k;
      if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = 1; }
      renderTable();
    });
  });
}

/* ------------------------------------------------------------- target */
var T_LIMIT = 150;
var CAN_EDIT = document.body.dataset.role === 'owner' || document.body.dataset.role === 'manager';

// Build the target model: every line, its state, and when it actually cleared.
function buildTargets() {
  var m = MODEL, todayN = m.todayN;
  var cleared = {};              // activity id -> day number it first hit 100%
  (DATA.history || []).forEach(function (h) {
    if (h.pct != null && h.pct >= 100) {
      var n = dayNum(D(h.report_date));
      if (cleared[h.activity_id] == null || n < cleared[h.activity_id]) cleared[h.activity_id] = n;
    }
  });
  return (DATA.targets || []).map(function (t) {
    var a = m.byId[t.activity_id] || {};
    var pct = a._pct == null ? 0 : a._pct;
    var fin = t.target_finish ? dayNum(D(t.target_finish)) : null;
    var done = pct >= 100;
    var clearedOn = done ? (cleared[t.activity_id] != null ? cleared[t.activity_id]
                           : (a._af ? dayNum(D(a._af)) : todayN)) : null;
    var state = done ? 'cleared'
      : (fin != null && fin < todayN) ? 'missed'
      : (fin != null && fin - todayN <= 7) ? 'soon'
      : 'open';
    return {
      id: t.activity_id,
      group: t.target_group || 'Ungrouped',
      work: t.work || a.name || t.activity_id,
      level: t.level && t.level !== '-' ? t.level : (a.floor || ''),
      days: t.days_left == null ? 0 : t.days_left,
      finish: t.target_finish, finishN: fin,
      pct: pct, status: a._status, trade: a.trade || '',
      remarks: a._remarks || '', reason: a._reason || '',
      by: a._by || '', reported: a._rd || '',
      done: done, clearedOn: clearedOn, state: state,
      late: (!done && fin != null) ? todayN - fin : 0,
      inProgramme: !!m.byId[t.activity_id],
    };
  });
}

function renderTarget() {
  var rows = MODEL.targets;
  var box = document.getElementById('panel-target');
  if (!rows.length) return;
  var m = MODEL, todayN = m.todayN;
  var deadline = DATA.meta.target_deadline || null;
  var dlN = deadline ? dayNum(D(deadline)) : null;
  var daysToGo = dlN != null ? dlN - todayN : null;

  var total = rows.length;
  var done = rows.filter(function (r) { return r.done; }).length;
  var missed = rows.filter(function (r) { return r.state === 'missed'; }).length;
  var soon = rows.filter(function (r) { return r.state === 'soon'; }).length;
  var openRows = rows.filter(function (r) { return !r.done; });
  var afterDl = dlN != null ? rows.filter(function (r) { return r.finishN != null && r.finishN > dlN; }).length : 0;

  document.getElementById('tTiles').innerHTML = [
    ['To clear', String(total), DATA.meta.target_name || 'target list', ''],
    ['Cleared', done + ' \\u00B7 ' + one((done / total) * 100) + '%', (total - done) + ' still open',
      done ? 'var(--good-text)' : ''],
    ['Missed their date', String(missed), missed ? 'past finish-by, not complete' : 'none overdue',
      missed ? 'var(--critical)' : 'var(--good-text)'],
    ['Due within 7 days', String(soon), 'finish-by inside a week', soon ? 'var(--serious)' : ''],
    [deadline ? 'To ' + fmt(deadline) : 'Deadline',
      daysToGo == null ? '\\u2014' : (daysToGo >= 0 ? daysToGo + ' days' : Math.abs(daysToGo) + ' days ago'),
      afterDl ? afterDl + ' lines finish after it' : 'every line inside the date',
      daysToGo != null && daysToGo < 0 ? 'var(--critical)' : ''],
  ].map(function (x) {
    return '<div class="tile"><div class="k">' + x[0] + '</div>' +
      '<div class="v"' + (x[3] ? ' style="color:' + x[3] + '"' : '') + '>' + x[1] + '</div>' +
      '<div class="s">' + x[2] + '</div></div>';
  }).join('');

  renderBurn(rows, dlN);
  renderTargetGroups(rows);
  renderTargetList();
}

// Remaining-to-clear over time: the plan is each line's own finish-by date,
// the actual is when site reported it complete.
function renderBurn(rows, dlN) {
  var box = document.getElementById('tBurn');
  var fins = rows.filter(function (r) { return r.finishN != null; }).map(function (r) { return r.finishN; });
  if (!fins.length) { box.innerHTML = '<div class="empty">No finish-by dates in the target list.</div>'; return; }
  var todayN = MODEL.todayN;
  var d0 = Math.min.apply(null, fins.concat([todayN]));
  var d1 = Math.max.apply(null, fins.concat([todayN, dlN == null ? todayN : dlN]));
  var W = Math.max(320, box.clientWidth || 900), H = 280;
  var pad = { t: 14, r: 16, b: 34, l: 46 };
  var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  var total = rows.length;
  var x = function (n) { return pad.l + ((n - d0) / Math.max(1, d1 - d0)) * iw; };
  var y = function (v) { return pad.t + ih - (v / total) * ih; };

  var plan = [], act = [];
  for (var n = d0; n <= d1; n++) {
    var p = 0, a = 0;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].finishN == null || rows[i].finishN > n) p++;
      if (!(rows[i].done && rows[i].clearedOn != null && rows[i].clearedOn <= n)) a++;
    }
    plan.push([n, p]);
    if (n <= todayN) act.push([n, a]);
  }

  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img" aria-label="Activities left to clear over time">';
  for (var g = 0; g <= 4; g++) {
    var v = Math.round((total / 4) * g);
    s += '<line x1="' + pad.l + '" y1="' + y(v) + '" x2="' + (W - pad.r) + '" y2="' + y(v) + '" stroke="var(--grid)"/>' +
         '<text x="' + (pad.l - 7) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="10.5" fill="var(--muted)">' + v + '</text>';
  }
  var cur = new Date(d0 * MS); cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), 1));
  while (dayNum(cur) <= d1) {
    var xn = x(dayNum(cur));
    if (xn >= pad.l - 1) {
      s += '<line x1="' + xn + '" y1="' + pad.t + '" x2="' + xn + '" y2="' + (pad.t + ih) + '" stroke="var(--grid)"/>' +
           '<text x="' + xn + '" y="' + (H - 12) + '" text-anchor="middle" font-size="10.5" fill="var(--muted)">' + fmtMon(cur) + '</text>';
    }
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
  }
  if (dlN != null && dlN >= d0 && dlN <= d1) {
    s += '<line x1="' + x(dlN) + '" y1="' + pad.t + '" x2="' + x(dlN) + '" y2="' + (pad.t + ih) +
         '" stroke="var(--series-7)" stroke-width="1.5" stroke-dasharray="4 3"/>' +
         '<text x="' + (x(dlN) + 5) + '" y="' + (pad.t + 11) + '" font-size="10.5" fill="var(--series-7)">deadline</text>';
  }
  s += '<line x1="' + x(MODEL.todayN) + '" y1="' + pad.t + '" x2="' + x(MODEL.todayN) + '" y2="' + (pad.t + ih) +
       '" stroke="var(--ink-2)" stroke-width="1" stroke-dasharray="3 3"/>';
  s += '<line x1="' + pad.l + '" y1="' + (pad.t + ih) + '" x2="' + (W - pad.r) + '" y2="' + (pad.t + ih) + '" stroke="var(--axis)"/>';
  s += '<path d="' + plan.map(function (p, j) { return (j ? 'L' : 'M') + x(p[0]) + ' ' + y(p[1]); }).join(' ') +
       '" fill="none" stroke="var(--series-1)" stroke-width="2" stroke-linecap="round"/>';
  if (act.length) {
    s += '<path d="' + act.map(function (p, j) { return (j ? 'L' : 'M') + x(p[0]) + ' ' + y(p[1]); }).join(' ') +
         '" fill="none" stroke="var(--series-2)" stroke-width="2" stroke-linecap="round"/>';
    var last = act[act.length - 1];
    s += '<circle cx="' + x(last[0]) + '" cy="' + y(last[1]) + '" r="4.5" fill="var(--series-2)" stroke="var(--surface)" stroke-width="2"/>' +
         '<text x="' + (x(last[0]) + 9) + '" y="' + (y(last[1]) + 4) + '" font-size="11.5" font-weight="600" fill="var(--ink)">' + last[1] + ' left</text>';
  }
  s += '</svg>';
  box.innerHTML = s;
  document.getElementById('tLegend').innerHTML =
    '<span><i class="swatch" style="background:var(--series-1)"></i>Planned to be left</span>' +
    '<span><i class="swatch" style="background:var(--series-2)"></i>Actually left</span>';
}

function renderTargetGroups(rows) {
  var g = {};
  rows.forEach(function (r) {
    var t = g[r.group] || (g[r.group] = { name: r.group, total: 0, done: 0, missed: 0, soon: 0, days: 0 });
    t.total++;
    if (r.done) t.done++; else t.days += r.days || 0;
    if (r.state === 'missed') t.missed++;
    if (r.state === 'soon') t.soon++;
  });
  var list = Object.keys(g).map(function (k) { return g[k]; })
    .sort(function (a, b) { return b.missed - a.missed || (b.total - b.done) - (a.total - a.done); });
  var h = '<table><thead><tr><th>Group</th><th class="num">To clear</th><th class="num">Cleared</th>' +
          '<th class="num">Open</th><th class="num">Missed</th><th class="num">Due &le;7d</th>' +
          '<th class="num">Days left</th><th class="num" style="min-width:110px">Progress</th></tr></thead><tbody>';
  list.forEach(function (t) {
    var pct = (t.done / t.total) * 100;
    h += '<tr class="tgrp" data-g="' + esc(t.name) + '" style="cursor:pointer">' +
      '<td>' + esc(t.name) + '</td>' +
      '<td class="num">' + t.total + '</td>' +
      '<td class="num">' + t.done + '</td>' +
      '<td class="num"><b>' + (t.total - t.done) + '</b></td>' +
      '<td class="num"' + (t.missed ? ' style="color:var(--critical);font-weight:500"' : '') + '>' + (t.missed || '') + '</td>' +
      '<td class="num"' + (t.soon ? ' style="color:var(--serious)"' : '') + '>' + (t.soon || '') + '</td>' +
      '<td class="num">' + Math.round(t.days) + '</td>' +
      '<td class="num"><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">' +
        '<span>' + one(pct) + '</span><span class="bar-mini"><i style="width:' + pct + '%;background:' +
        (t.missed ? 'var(--critical)' : 'var(--series-1)') + '"></i></span></div></td></tr>';
  });
  document.getElementById('tGroups').innerHTML = h + '</tbody></table>';
  document.getElementById('tGroups').querySelectorAll('.tgrp').forEach(function (tr) {
    tr.addEventListener('click', function () {
      document.getElementById('tGroup').value = tr.dataset.g;
      T_LIMIT = 150; renderTargetList();
      document.getElementById('tList').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  var sel = document.getElementById('tGroup'), keep = sel.value;
  sel.innerHTML = '<option value="">All groups</option>' + list.map(function (t) {
    return '<option value="' + esc(t.name) + '">' + esc(t.name) + '</option>';
  }).join('');
  sel.value = keep;
}

var T_STATE = {
  cleared: { label: 'Cleared', color: 'var(--good)' },
  missed:  { label: 'Missed',  color: 'var(--critical)' },
  soon:    { label: 'Due soon', color: 'var(--serious)' },
  open:    { label: 'Open',    color: 'var(--series-1)' },
};

function renderTargetList() {
  var rows = MODEL.targets;
  var q = (document.getElementById('tq').value || '').toLowerCase();
  var fg = document.getElementById('tGroup').value;
  var fs = document.getElementById('tState').value;
  var list = rows.filter(function (r) {
    if (fg && r.group !== fg) return false;
    if (fs === 'open' && r.done) return false;
    if (fs && fs !== 'open' && r.state !== fs) return false;
    if (q && (r.work + ' ' + r.id + ' ' + r.level + ' ' + r.group + ' ' + r.trade).toLowerCase().indexOf(q) < 0) return false;
    return true;
  }).sort(function (a, b) {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (a.finishN || 9e9) - (b.finishN || 9e9);
  });

  document.getElementById('tListNote').textContent =
    list.length + (list.length === 1 ? ' line' : ' lines') +
    (fg ? ' in ' + fg : '') + (CAN_EDIT ? ' \\u00B7 type a % and press Save to report progress' : '');

  var shown = list.slice(0, T_LIMIT);
  var more = document.getElementById('tMore');
  more.hidden = list.length <= T_LIMIT;
  more.textContent = 'Show more (' + (list.length - T_LIMIT) + ' not shown)';

  var h = '<table><thead><tr><th>Work to be done</th><th>Group</th><th>Level</th>' +
          '<th class="num">Finish by</th><th class="num">Days</th><th class="num">%</th><th>State</th>' +
          (CAN_EDIT ? '<th>Report progress</th>' : '<th>Last remark</th>') + '</tr></thead><tbody>';
  if (!shown.length) h += '<tr><td colspan="8"><div class="empty">Nothing matches.</div></td></tr>';
  shown.forEach(function (r) {
    var st = T_STATE[r.state];
    h += '<tr data-id="' + esc(r.id) + '">' +
      '<td class="clamp"><div><b>' + esc(r.work) + '</b></div>' +
        '<div class="hint mono">' + esc(r.id) + (r.trade ? ' \\u00B7 ' + esc(r.trade) : '') + '</div></td>' +
      '<td>' + esc(r.group) + '</td>' +
      '<td>' + esc(r.level) + '</td>' +
      '<td class="num">' + fmt(r.finish) + (r.late > 0 ? '<div class="hint" style="color:var(--critical)">' + r.late + 'd late</div>' : '') + '</td>' +
      '<td class="num">' + (r.days || '') + '</td>' +
      '<td class="num">' + one(r.pct) + '</td>' +
      '<td><span class="pill"><i class="dot" style="background:' + st.color + '"></i>' + st.label + '</span></td>' +
      (CAN_EDIT
        ? '<td class="edit"><div style="display:flex;gap:5px;align-items:center">' +
            '<input class="e-pct" type="number" min="0" max="100" step="1" placeholder="' + Math.round(r.pct) + '" style="width:58px;padding:5px 6px">' +
            '<select class="e-status" style="width:auto;padding:5px 6px">' +
              '<option value="">status</option><option value="in_progress">In progress</option>' +
              '<option value="complete">Complete</option><option value="at_risk">At risk</option>' +
              '<option value="delayed">Delayed</option><option value="on_hold">On hold</option></select>' +
            '<input class="e-note" placeholder="remark" style="flex:1 1 110px;min-width:100px;padding:5px 6px;font-size:var(--fs-secondary)">' +
            '<button class="btn e-save" style="padding:5px 9px">Save</button></div></td>'
        : '<td class="clamp"><div>' + esc(r.remarks || r.reason || '') + '</div></td>') +
    '</tr>';
  });
  document.getElementById('tList').innerHTML = h + '</tbody></table>';

  if (CAN_EDIT) {
    document.getElementById('tList').querySelectorAll('.e-save').forEach(function (b) {
      b.addEventListener('click', function () { saveTargetRow(b.closest('tr'), b); });
    });
  }
}

async function saveTargetRow(tr, btn) {
  var pct = tr.querySelector('.e-pct').value.trim();
  var status = tr.querySelector('.e-status').value;
  var note = tr.querySelector('.e-note').value.trim();
  if (pct === '' && !status && !note) { toast('Nothing to save on that line', true); return; }
  var who = localStorage.getItem('sm-who');
  try { who = who ? JSON.parse(who) : ''; } catch (e) { who = ''; }
  if (!who) {
    who = prompt('Your name (saved on this device, shown against every update you make):') || '';
    if (!who.trim()) return;
    try { localStorage.setItem('sm-who', JSON.stringify(who.trim())); } catch (e) {}
  }
  btn.disabled = true; btn.textContent = '…';
  var body = { activity_id: tr.dataset.id, submitted_by: who };
  if (pct !== '') body.pct = Math.max(0, Math.min(100, Number(pct)));
  if (status) body.status = status;
  if (note) body.remarks = note;
  try {
    var r = await fetch('/api/update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error();
    btn.textContent = 'Saved';
    toast('Saved');
    await load();
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Save';
    toast('Could not save — check your connection', true);
  }
}

function renderByTrade() {
  var g = {};
  MODEL.detail.forEach(function (a) {
    var k = a.trade || '';
    if (!k && (a.discipline && a.discipline !== 'Construction')) return;   // office work has no trade
    var key = k || 'Other site works';
    var t = g[key] || (g[key] = { name: key, group: a.trade_group || '', total: 0, open: 0, flagged: 0, w: 0, done: 0, late: 0 });
    t.total++;
    t.w += a._w; t.done += (a._pct / 100) * a._w;
    if (a._pct < 100) t.open++;
    if (a._status === 'delayed' || a._status === 'at_risk' || a._status === 'on_hold') t.flagged++;
    if (a._slip > 0) t.late = Math.max(t.late, a._slip);
  });
  var rows = Object.keys(g).map(function (k) { return g[k]; })
    .map(function (t) { t.pct = t.w ? (t.done / t.w) * 100 : 0; return t; })
    .filter(function (t) { return t.open > 0; })
    .sort(function (a, b) { return b.flagged - a.flagged || b.open - a.open; });

  var box = document.getElementById('byTrade');
  if (!rows.length) { box.innerHTML = '<div class="empty">No open activities.</div>'; return; }
  var h = '<table><thead><tr><th>Trade</th><th>Group</th><th class="num">Open</th><th class="num">Of</th>' +
          '<th class="num">Flagged</th><th class="num" style="min-width:110px">Complete</th><th class="num">Worst slip</th></tr></thead><tbody>';
  rows.forEach(function (t) {
    h += '<tr class="trade-row" data-t="' + esc(t.name === 'Other site works' ? '' : t.name) + '" style="cursor:pointer">' +
      '<td>' + esc(t.name) + '</td>' +
      '<td>' + esc(t.group) + '</td>' +
      '<td class="num"><b>' + t.open + '</b></td>' +
      '<td class="num">' + t.total + '</td>' +
      '<td class="num"' + (t.flagged ? ' style="color:var(--critical);font-weight:500"' : '') + '>' + (t.flagged || '') + '</td>' +
      '<td class="num"><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">' +
        '<span>' + one(t.pct) + '</span><span class="bar-mini"><i style="width:' + Math.max(0, Math.min(100, t.pct)) + '%"></i></span></div></td>' +
      '<td class="num"' + (t.late > 0 ? ' style="color:var(--critical)"' : '') + '>' + (t.late > 0 ? '+' + t.late + 'd' : '') + '</td>' +
    '</tr>';
  });
  box.innerHTML = h + '</tbody></table>';
  box.querySelectorAll('.trade-row').forEach(function (tr) {
    tr.addEventListener('click', function () {
      if (!tr.dataset.t) return;
      document.getElementById('fTrade').value = tr.dataset.t;
      document.querySelector('.tab[data-tab="table"]').click();
      renderTable();
    });
  });
}

function renderAttention() {
  var rows = MODEL.detail.filter(function (a) {
    return a._status === 'delayed' || a._status === 'at_risk' || a._status === 'on_hold';
  }).sort(function (a, b) { return (b._slip || 0) - (a._slip || 0); });
  if (!rows.length) {
    document.getElementById('attention').innerHTML = '<div class="empty">Nothing flagged by site.</div>';
    return;
  }
  var h = '<table><thead><tr><th>Activity</th><th>Status</th><th class="num">Slip</th><th>Reason</th></tr></thead><tbody>';
  rows.slice(0, 14).forEach(function (a) {
    var st = STATUS[a._status];
    h += '<tr><td>' + esc(a.name) + '</td>' +
      '<td><span class="pill"><i class="dot" style="background:' + st.color + '"></i>' + st.label + '</span></td>' +
      '<td class="num"' + (a._slip > 0 ? ' style="color:var(--critical)"' : '') + '>' + (a._slip ? (a._slip > 0 ? '+' : '') + a._slip + 'd' : '') + '</td>' +
      '<td>' + esc(a._reason || a._remarks || '') + '</td></tr>';
  });
  document.getElementById('attention').innerHTML = h + '</tbody></table>';
}

function renderFeed() {
  var r = DATA.recent || [];
  if (!r.length) {
    document.getElementById('feed').innerHTML = '<li><span class="what">No updates submitted yet. Share the site link and the access code with your site engineer.</span></li>';
    return;
  }
  document.getElementById('feed').innerHTML = r.slice(0, 20).map(function (u) {
    var a = MODEL.byId[u.activity_id];
    var st = STATUS[u.status] || {};
    return '<li><i class="dot" style="margin-top:6px;background:' + (st.color || 'var(--muted)') + '"></i><div>' +
      '<div class="what"><b>' + esc(a ? a.name : u.activity_id) + '</b> \\u2014 ' +
      (u.pct != null ? one(u.pct) + '% ' : '') + (st.label ? '\\u00B7 ' + st.label : '') +
      (u.remarks ? '<div style="color:var(--ink-2)">' + esc(u.remarks) + '</div>' : '') + '</div>' +
      '<div class="who">' + esc(u.submitted_by || 'site') + ' \\u00B7 ' + ago(u.created_at) + ' \\u00B7 for ' + fmt(u.report_date) + '</div>' +
      '</div></li>';
  }).join('');
}

/* ----------------------------------------------------------- manpower */
function renderManpower() {
  var rows = DATA.manpower || [];
  var box = document.getElementById('mchart');
  if (!rows.length) {
    box.innerHTML = '<div class="empty">No manpower returns yet.</div>';
    document.getElementById('mtable').innerHTML = '';
    document.getElementById('mLegend').innerHTML = '';
    return;
  }
  var dates = Array.from(new Set(rows.map(function (r) { return r.report_date; }))).sort().slice(-30);
  var totals = {};
  rows.forEach(function (r) { totals[r.trade] = (totals[r.trade] || 0) + r.headcount; });
  var trades = Object.keys(totals).sort(function (a, b) { return totals[b] - totals[a]; });
  var top = trades.slice(0, 7), hasOther = trades.length > 7;
  var keys = hasOther ? top.concat(['Other']) : top;
  var cell = {};
  rows.forEach(function (r) {
    if (dates.indexOf(r.report_date) < 0) return;
    var k = top.indexOf(r.trade) >= 0 ? r.trade : 'Other';
    cell[r.report_date] = cell[r.report_date] || {};
    cell[r.report_date][k] = (cell[r.report_date][k] || 0) + r.headcount;
  });
  var rawMax = Math.max.apply(null, dates.map(function (d) {
    return keys.reduce(function (s, k) { return s + ((cell[d] && cell[d][k]) || 0); }, 0);
  }).concat([1]));
  var mag = Math.pow(10, Math.floor(Math.log10(rawMax)));
  var stepUnit = (rawMax / mag > 5 ? 2.5 : rawMax / mag > 2 ? 1 : 0.5) * mag;
  var maxTot = Math.ceil(rawMax / (stepUnit * 4)) * stepUnit * 4;

  var W = Math.max(320, box.clientWidth || 900), H = 280;
  var pad = { t: 12, r: 12, b: 44, l: 38 };
  var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  var bw = Math.min(34, Math.max(5, iw / dates.length - 3));
  var y = function (v) { return pad.t + ih - (v / maxTot) * ih; };
  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img" aria-label="Manpower by trade">';
  var ticks = 4;
  for (var t = 0; t <= ticks; t++) {
    var v = Math.round((maxTot / ticks) * t);
    s += '<line x1="' + pad.l + '" y1="' + y(v) + '" x2="' + (W - pad.r) + '" y2="' + y(v) + '" stroke="var(--grid)"/>' +
         '<text x="' + (pad.l - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="10.5" fill="var(--muted)">' + v + '</text>';
  }
  dates.forEach(function (d, i2) {
    var cx = pad.l + (iw / dates.length) * (i2 + 0.5);
    var acc = 0;
    keys.forEach(function (k, ki) {
      var v = (cell[d] && cell[d][k]) || 0; if (!v) return;
      var h = (v / maxTot) * ih;
      s += '<rect x="' + (cx - bw / 2) + '" y="' + (y(acc + v) + 1) + '" width="' + bw + '" height="' + Math.max(1, h - 2) +
           '" rx="2" fill="' + SERIES[ki % 8] + '" data-d="' + d + '" data-k="' + esc(k) + '" data-v="' + v + '" class="mbar"/>';
      acc += v;
    });
    if (dates.length <= 16 || i2 % Math.ceil(dates.length / 12) === 0) {
      s += '<text x="' + cx + '" y="' + (H - 14) + '" text-anchor="middle" font-size="10" fill="var(--muted)" transform="rotate(-40 ' + cx + ' ' + (H - 14) + ')">' + fmt(d) + '</text>';
    }
  });
  s += '<line x1="' + pad.l + '" y1="' + (pad.t + ih) + '" x2="' + (W - pad.r) + '" y2="' + (pad.t + ih) + '" stroke="var(--axis)"/></svg>';
  box.innerHTML = s;
  document.getElementById('mLegend').innerHTML = keys.map(function (k, ki) {
    return '<span><i class="swatch" style="background:' + SERIES[ki % 8] + '"></i>' + esc(k) + '</span>';
  }).join('');
  box.querySelectorAll('.mbar').forEach(function (el) {
    el.addEventListener('mouseenter', function (ev) {
      var d = el.dataset.d, tot = keys.reduce(function (s2, k) { return s2 + ((cell[d] && cell[d][k]) || 0); }, 0);
      showTip(ev.clientX, ev.clientY, '<b>' + fmt(d) + '</b><div class="tl"><span>' + esc(el.dataset.k) + '</span><span>' + el.dataset.v + '</span></div>' +
        '<div class="tl" style="color:var(--muted)"><span>Total on site</span><span>' + tot + '</span></div>');
    });
    el.addEventListener('mouseleave', hideTip);
  });

  var h2 = '<table><thead><tr><th>Date</th><th>Trade</th><th class="num">Headcount</th><th>Plant / equipment</th><th>By</th></tr></thead><tbody>';
  rows.slice(0, 300).forEach(function (r) {
    h2 += '<tr><td class="num">' + fmt(r.report_date) + '</td><td>' + esc(r.trade) + '</td><td class="num">' + r.headcount +
          '</td><td>' + esc(r.plant || '') + '</td><td>' + esc(r.submitted_by || '') + '</td></tr>';
  });
  document.getElementById('mtable').innerHTML = h2 + '</tbody></table>';
}

/* ------------------------------------------------------------- photos */
function renderPhotos() {
  var sel = document.getElementById('fPhotoAct');
  var want = sel.value;
  var list = (DATA.photos || []).filter(function (p) { return !want || p.activity_id === want; });
  document.getElementById('photoCount').textContent = list.length + (list.length === 1 ? ' photo' : ' photos');
  var box = document.getElementById('photos');
  if (!list.length) { box.innerHTML = '<div class="empty">No photos yet.</div>'; return; }
  box.innerHTML = list.map(function (p) {
    var a = MODEL.byId[p.activity_id];
    return '<div class="photo"><img loading="lazy" src="/photo/' + encodeURIComponent(p.id) + '" alt="' + esc(p.caption || 'progress photo') + '">' +
      '<div class="cap"><b>' + esc(a ? a.name : (p.activity_id || 'General')) + '</b><br>' +
      esc(p.caption || '') + (p.caption ? '<br>' : '') + fmt(p.report_date) + ' \\u00B7 ' + esc(p.submitted_by || '') + '</div></div>';
  }).join('');
  box.querySelectorAll('img').forEach(function (img) {
    img.addEventListener('click', function () {
      document.getElementById('lbImg').src = img.src;
      document.getElementById('lb').classList.add('on');
    });
  });
}
document.getElementById('lb').addEventListener('click', function () { this.classList.remove('on'); });

/* --------------------------------------------------------------- shell */
function fillFilters() {
  function fill(id, label, values) {
    var el = document.getElementById(id), keep = el.value;
    el.innerHTML = '<option value="">' + label + '</option>' + values.map(function (v) {
      return '<option value="' + esc(v) + '">' + esc(v) + '</option>';
    }).join('');
    el.value = keep;
  }
  var uniq = function (key) {
    return Array.from(new Set(MODEL.acts.map(function (a) { return a[key] || ''; }).filter(Boolean))).sort();
  };
  fill('fWbs', 'All sections', uniq('wbs'));
  fill('fTrade', 'All trades', uniq('trade'));
  fill('fFloor', 'All floors', uniq('floor'));
  fill('fDisc', 'All disciplines', uniq('discipline'));
  var ss = document.getElementById('fStatus'), keep2 = ss.value;
  ss.innerHTML = '<option value="">All statuses</option>' + Object.keys(STATUS).map(function (k) {
    return '<option value="' + k + '">' + STATUS[k].label + '</option>';
  }).join('');
  ss.value = keep2;
  var pa = document.getElementById('fPhotoAct'), keep3 = pa.value;
  var ids = Array.from(new Set((DATA.photos || []).map(function (p) { return p.activity_id; }).filter(Boolean)));
  pa.innerHTML = '<option value="">All activities</option>' + ids.map(function (id) {
    var a = MODEL.byId[id];
    return '<option value="' + esc(id) + '">' + esc(a ? a.name : id) + '</option>';
  }).join('');
  pa.value = keep3;
}

function renderAll() {
  document.getElementById('pname').textContent = DATA.meta.project_name || 'AETRAA';
  document.getElementById('pref').textContent = DATA.meta.project_ref ? DATA.meta.project_ref + ' \\u00B7 ' : '';
  document.getElementById('ddate').textContent = 'data date ' + fmt(MODEL.dataDate);
  if (DATA.meta.target_name) {
    document.getElementById('tabTarget').textContent = 'Target';
    document.getElementById('tListTitle').textContent = DATA.meta.target_name;
    document.getElementById('tBurnTitle').textContent = 'Activities left to clear';
  }
  fillFilters();
  MODEL.targets = buildTargets();
  var hasTarget = MODEL.targets.length > 0;
  document.getElementById('tabTarget').hidden = !hasTarget;
  if (!TAB_PICKED) {
    TAB_PICKED = true;
    document.querySelector('.tab[data-tab="' + (hasTarget ? 'target' : 'overview') + '"]').click();
  }
  if (hasTarget) renderTarget();
  renderTiles(); renderSCurve(); renderFeed(); renderAttention(); renderByTrade();
  renderGantt(); renderTable(); renderManpower(); renderPhotos();
}
var TAB_PICKED = false;

var loading = false;
async function load(showToast) {
  if (loading) return; loading = true;
  try {
    var r = await fetch('/api/data', { cache: 'no-store' });
    if (r.status === 401) { location.reload(); return; }
    if (!r.ok) throw new Error('server returned ' + r.status);
    DATA = await r.json();
    showScope(DATA.scope);
    if (!SWITCHER_UP) { SWITCHER_UP = true; setTimeout(function () { mountSwitcher('projSel'); }, 0); }
    loadVerifyCount();
    MODEL = buildModel(DATA);
    renderAll();
    var el = document.getElementById('refreshed');
    el.textContent = 'updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    el.className = 'hint';
    if (showToast) toast('Refreshed');
  } catch (e) {
    var el2 = document.getElementById('refreshed');
    el2.textContent = 'offline \\u2014 retrying';
    el2.className = 'hint stale';
  } finally { loading = false; }
}

// A scoped dashboard says so at the top. Without this a discipline engineer
// would read his own percentage as the project's.
// The Verify button carries how many claims are waiting, so nobody has to
// remember to go and look.
async function loadVerifyCount() {
  var btn = document.getElementById('verifyBtn');
  if (!btn) return;
  try {
    var r = await fetch('/api/verify?state=awaiting', { cache: 'no-store' });
    if (!r.ok) return;
    var d = await r.json();
    var n = (d.counts || {}).awaiting || 0;
    btn.textContent = n ? 'Verify \u00B7 ' + n : 'Verify';
    btn.classList.toggle('btn-primary', n > 0);
  } catch (e) {}
}

function showScope(scope) {
  var el = document.getElementById('scopeBar');
  if (!el) return;
  if (!scope) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = '<b>' + esc(scope.text) + ' only.</b> Every figure on this page covers your trades, ' +
    'not the whole project.';
}

document.querySelectorAll('.tab').forEach(function (t) {
  t.addEventListener('click', function () {
    document.querySelectorAll('.tab').forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); });
    ['target', 'overview', 'gantt', 'table', 'manpower', 'photos'].forEach(function (n) {
      document.getElementById('panel-' + n).hidden = (n !== t.dataset.tab);
    });
    document.getElementById('filterbar').hidden = !(t.dataset.tab === 'gantt' || t.dataset.tab === 'table');
    if (MODEL) {
      if (t.dataset.tab === 'overview') renderSCurve();
      if (t.dataset.tab === 'manpower') renderManpower();
      if (t.dataset.tab === 'gantt') renderGantt();
      if (t.dataset.tab === 'target' && MODEL.targets && MODEL.targets.length) renderTarget();
    }
  });
});
document.getElementById('refresh').addEventListener('click', function () { load(true); });

var FILTER_IDS = ['q', 'fWbs', 'fTrade', 'fFloor', 'fDisc', 'fStatus'];
function onFilterChange() {
  rowLimit = 400;
  renderTable();
  if (!document.getElementById('panel-gantt').hidden) renderGantt();
}
FILTER_IDS.forEach(function (id) {
  document.getElementById(id).addEventListener('input', onFilterChange);
});
document.getElementById('clearF').addEventListener('click', function () {
  FILTER_IDS.forEach(function (id) { document.getElementById(id).value = ''; });
  onFilterChange();
});
document.getElementById('moreRows').addEventListener('click', function () {
  rowLimit += 800; renderTable();
});
['tq', 'tGroup', 'tState'].forEach(function (id) {
  document.getElementById(id).addEventListener('input', function () { T_LIMIT = 150; renderTargetList(); });
});
document.getElementById('tClear').addEventListener('click', function () {
  document.getElementById('tq').value = '';
  document.getElementById('tGroup').value = '';
  document.getElementById('tState').value = 'open';
  T_LIMIT = 150; renderTargetList();
});
document.getElementById('tMore').addEventListener('click', function () { T_LIMIT += 300; renderTargetList(); });
document.getElementById('fPhotoAct').addEventListener('input', renderPhotos);
document.getElementById('themeBtn').addEventListener('click', function () {
  var cur = document.documentElement.getAttribute('data-theme');
  var next = cur === 'dark' ? 'light' : cur === 'light' ? '' : 'dark';
  if (next) document.documentElement.setAttribute('data-theme', next);
  else document.documentElement.removeAttribute('data-theme');
  try { localStorage.setItem('sm-theme', next); } catch (e) {}
  if (MODEL) { renderSCurve(); renderGantt(); renderManpower(); }
});
try {
  var saved = localStorage.getItem('sm-theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
} catch (e) {}

var rt;
window.addEventListener('resize', function () {
  clearTimeout(rt);
  rt = setTimeout(function () { if (MODEL) { renderSCurve(); renderGantt(); renderManpower(); if (MODEL.targets && MODEL.targets.length) renderTarget(); } }, 200);
});

load();
setInterval(function () { if (!document.hidden) load(); }, 60000);
document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
${SWITCHER_JS}
${PWA_BOOT}
</script>
</body>
</html>`;
