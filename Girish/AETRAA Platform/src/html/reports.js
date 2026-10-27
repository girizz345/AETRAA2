import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK, SWITCHER_CSS, SWITCHER_JS } from './shared.js';

// The report itself arrives as ready-made HTML with its own inline styles, so it
// looks identical here, on paper, and in the evening email. This page only
// wraps it: a date picker, a print button, and the paper it sits on.
export const reportsHTML = (role) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reports · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1020px; }
.bar {
  display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  padding: 12px 14px; margin-bottom: 16px;
}
.bar label { font-size: 12px; color: var(--muted); font-weight: 600; }
.seg { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.seg button {
  appearance: none; border: 0; background: var(--surface-2); color: var(--ink-2);
  font: inherit; font-size: 13px; font-weight: 600; padding: 7px 14px; cursor: pointer;
}
.seg button + button { border-left: 1px solid var(--border); }
.seg button[aria-pressed="true"] { background: var(--series-1); color: #fff; }
/* The theme stretches inputs to fill their field; in this bar they must not. */
.bar input[type="date"], .bar input[type="month"] {
  font: inherit; font-size: 13px; padding: 6px 9px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--surface-2); color: var(--ink);
  width: auto; flex: 0 0 auto; min-width: 150px;
}
/* The report is a document: white paper, dark ink, in either theme. */
.reviewed { background: var(--good-bg); color: var(--good-text); border: 1px solid var(--border);
  border-radius: 8px; padding: 9px 12px; font-size: 13px; margin-bottom: 12px; }
.reviewed.no { background: var(--surface-2); color: var(--ink-2); }
.paper {
  background: #fff; color: #1b2437; border: 1px solid var(--border); border-radius: 12px;
  padding: 28px 30px; box-shadow: var(--shadow); min-height: 340px;
}
.paper a { color: inherit; }
/* The report is laid out as a document, so on a phone it scrolls sideways
   rather than collapsing — the tables stay readable and printing is unaffected. */
@media (max-width: 760px) {
  .paper { padding: 18px 16px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .paper > div { min-width: 660px; }
}

/* What actually goes on the page when it prints, or when the browser saves a PDF. */
@media print {
  @page { size: A4; margin: 14mm 12mm; }
  .topbar, .bar, .toast, .noprint { display: none !important; }
  .wrap { max-width: none; padding: 0; margin: 0; }
  .paper { border: 0; border-radius: 0; box-shadow: none; padding: 0; background: #fff; }
  body { background: #fff; }
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  h2 { page-break-after: avoid; }
}
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Reports</h1><div class="sub" id="pname">progress report</div></div>
  <select class="proj" id="proj" hidden aria-label="Project"></select>
  <div class="spacer"></div>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  <a class="btn" href="/">Dashboard</a>
  ${role === 'owner' ? '<a class="btn" href="/portfolio">Portfolio</a>' : ''}
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  <div class="bar noprint">
    <div class="seg" role="group" aria-label="Report type">
      <button id="bDaily" aria-pressed="true">Daily</button>
      <button id="bWeekly" aria-pressed="false">Weekly</button>
      <button id="bMonthly" aria-pressed="false">Monthly</button>
    </div>
    <label for="day" id="lblDay">Date</label>
    <input type="date" id="day">
    <input type="month" id="month" hidden>
    <button class="btn" id="prev" title="Previous">‹</button>
    <button class="btn" id="next" title="Next">›</button>
    <div class="spacer"></div>
    <button class="btn" id="review" hidden></button>
    <button class="btn" id="word">Download Word</button>
    <button class="btn btn-primary" id="print">Download PDF</button>
  </div>
  <div class="reviewed" id="reviewed" hidden></div>

  <div class="paper" id="paper"><div class="empty">Loading…</div></div>
</div>
<div class="toast" id="toast"></div>

<script>
${SWITCHER_JS}
var kind = 'daily';
var paper = document.getElementById('paper');
var dayEl = document.getElementById('day');
var monEl = document.getElementById('month');

function isoDay(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function toast(m) {
  var t = document.getElementById('toast');
  t.textContent = m; t.classList.add('show');
  setTimeout(function () { t.classList.remove('show'); }, 2600);
}

// Yesterday, not today: at the moment you open this in the morning, yesterday is
// the last day site has finished reporting on.
(function seed() {
  var d = new Date(); d.setDate(d.getDate() - 1);
  dayEl.value = isoDay(d);
  monEl.value = isoDay(new Date()).slice(0, 7);
})();

var AUTOPRINT = false;
function currentKey() { return (kind === 'monthly' || kind === 'hse') ? monEl.value : dayEl.value; }   // weekly uses the date picker
async function load() {
  var key = currentKey();
  if (!key) return;
  paper.innerHTML = '<div class="empty">Building the report…</div>';
  try {
    var r = await fetch('/api/report?kind=' + kind + '&key=' + encodeURIComponent(key), { cache: 'no-store' });
    if (!r.ok) { paper.innerHTML = '<div class="empty">Could not build that report.</div>'; return; }
    paper.innerHTML = await r.text();
    loadReview();
    if (AUTOPRINT) { AUTOPRINT = false; setTimeout(function () { window.print(); }, 400); }
  } catch (e) {
    paper.innerHTML = '<div class="empty">Offline — try again in a moment.</div>';
  }
}

/* ------------------------------------------------------ signing off a day */

var CAN_REVIEW = ${JSON.stringify(role === 'owner' || role === 'manager')};
var REVIEWED = null;

function fmtStamp(s) {
  if (!s) return '';
  var d = new Date(s);
  var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return String(d.getDate()).padStart(2, '0') + ' ' + m[d.getMonth()] + ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Reviewing belongs to a single day, so it is hidden on the monthly.
async function loadReview() {
  var btn = document.getElementById('review');
  var bar = document.getElementById('reviewed');
  if (kind !== 'daily') { btn.hidden = true; bar.hidden = true; return; }
  try {
    var r = await fetch('/api/review?from=' + dayEl.value + '&to=' + dayEl.value, { cache: 'no-store' });
    var j = await r.json();
    if (!j.migrated) { btn.hidden = true; bar.hidden = true; return; }
    REVIEWED = (j.reviews || [])[0] || null;
  } catch (e) { return; }

  if (REVIEWED) {
    bar.hidden = false; bar.className = 'reviewed';
    bar.textContent = 'Reviewed by ' + (REVIEWED.reviewed_by || 'the office') +
      ' on ' + fmtStamp(REVIEWED.reviewed_at) + '.';
  } else {
    bar.hidden = !CAN_REVIEW; bar.className = 'reviewed no';
    bar.textContent = 'Nobody in the office has signed this day off yet.';
  }
  btn.hidden = !CAN_REVIEW;
  btn.textContent = REVIEWED ? 'Undo review' : 'Mark this day reviewed';
}

document.getElementById('review').addEventListener('click', async function () {
  this.disabled = true;
  try {
    var who = REVIEWED ? null : (prompt('Reviewed by — your name', localStorage.getItem('sm_reviewer') || '') || '');
    if (!REVIEWED) {
      if (!who) { this.disabled = false; return; }
      try { localStorage.setItem('sm_reviewer', who); } catch (e) {}
    }
    await fetch('/api/review', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dayEl.value, by: who, undo: !!REVIEWED }),
    });
    toast(REVIEWED ? 'Review removed' : 'Day signed off');
    await loadReview();
  } catch (e) { toast('That did not work'); }
  this.disabled = false;
});

function setKind(k) {
  kind = k;
  document.getElementById('bDaily').setAttribute('aria-pressed', String(k === 'daily'));
  document.getElementById('bWeekly').setAttribute('aria-pressed', String(k === 'weekly'));
  document.getElementById('bMonthly').setAttribute('aria-pressed', String(k === 'monthly'));
  dayEl.hidden = k === 'monthly';       // daily and weekly both pick a date
  monEl.hidden = k !== 'monthly';
  document.getElementById('lblDay').textContent =
    k === 'monthly' ? 'Month' : k === 'weekly' ? 'Week of' : 'Date';
  load();
  loadReview();
}

document.getElementById('bDaily').addEventListener('click', function () { setKind('daily'); });
document.getElementById('bWeekly').addEventListener('click', function () { setKind('weekly'); });
document.getElementById('bMonthly').addEventListener('click', function () { setKind('monthly'); });
dayEl.addEventListener('change', load);
monEl.addEventListener('change', load);

function step(n) {
  if (kind === 'daily' || kind === 'weekly') {
    var d = new Date(dayEl.value + 'T00:00:00');
    d.setDate(d.getDate() + n * (kind === 'weekly' ? 7 : 1));
    dayEl.value = isoDay(d);
  } else {
    var p = monEl.value.split('-');
    var m = new Date(Number(p[0]), Number(p[1]) - 1 + n, 1);
    monEl.value = m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0');
  }
  load();
}
document.getElementById('prev').addEventListener('click', function () { step(-1); });
document.getElementById('next').addEventListener('click', function () { step(1); });

// There is no server-side PDF here on purpose — the browser's own print dialog
// makes a better one, and every phone and laptop already has it.
document.getElementById('word').addEventListener('click', function () {
  var key = currentKey();
  if (key) window.location.href = '/api/report?kind=' + kind + '&key=' + encodeURIComponent(key) + '&format=doc';
});
document.getElementById('print').addEventListener('click', function () {
  toast('Choose "Save as PDF" in the print dialog');
  setTimeout(function () { window.print(); }, 350);
});

mountSwitcher('proj');
// Opened from the dashboard with a report already chosen: ?kind=weekly&key=2026-09-14&print=1
(function fromLink() {
  var q = new URLSearchParams(location.search);
  var k = q.get('kind'), key = q.get('key') || '';
  if (['daily', 'weekly', 'monthly', 'lookahead', 'programme', 'hse'].indexOf(k) < 0) return;
  kind = k;
  var byMonth = k === 'monthly' || k === 'hse';
  if (byMonth && /^[0-9]{4}-[0-9]{2}$/.test(key)) monEl.value = key;
  if (!byMonth && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(key)) dayEl.value = key;
  ['bDaily', 'bWeekly', 'bMonthly'].forEach(function (id) {
    document.getElementById(id).setAttribute('aria-pressed', String(id.toLowerCase() === 'b' + k));
  });
  dayEl.hidden = byMonth; monEl.hidden = !byMonth;
  document.getElementById('lblDay').textContent = byMonth ? 'Month' : k === 'weekly' ? 'Week of' : k === 'daily' ? 'Date' : 'As at';
  AUTOPRINT = q.get('print') === '1';
})();
load();
${PWA_BOOT}
</script>
</body></html>`;
