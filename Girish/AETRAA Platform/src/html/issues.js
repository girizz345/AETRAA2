import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK, SWITCHER_CSS, SWITCHER_JS } from './shared.js';

// The register. Site raises; this is where the office decides what goes out.
export const issuesHTML = (role) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Issues · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1280px; }
.bar {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  padding: 11px 13px; margin-bottom: 14px;
}
.bar select, .bar input[type="search"] {
  font: inherit; font-size: 13px; padding: 6px 9px; border-radius: 8px; width: auto; flex: 0 0 auto;
  border: 1px solid var(--border); background: var(--surface-2); color: var(--ink);
}
.bar input[type="search"] { min-width: 170px; flex: 1 1 170px; max-width: 280px; }
.tiles { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(128px, 1fr)); margin-bottom: 14px; }
.tile { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 11px 13px; }
.tile b { display: block; font-size: 23px; font-weight: 600; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
.tile span { font-size: 11.5px; color: var(--muted); }
.tile.bad b { color: var(--critical); }
.tile.warn b { color: var(--serious); }

table.reg { width: 100%; border-collapse: collapse; font-size: 13px; }
table.reg th {
  text-align: left; font-size: 10.5px; letter-spacing: .05em; text-transform: uppercase;
  color: var(--muted); font-weight: 600; padding: 8px 9px; border-bottom: 1px solid var(--border);
  position: sticky; top: 0; background: var(--bg); z-index: 1;
}
table.reg td { padding: 9px; border-bottom: 1px solid var(--grid); vertical-align: top; }
table.reg tbody tr { cursor: pointer; }
table.reg tbody tr:hover { background: var(--surface-2); }
table.reg tr[aria-selected="true"] { background: var(--surface-2); box-shadow: inset 3px 0 0 var(--series-1); }
.ref { font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.pill {
  display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px;
  background: var(--surface-2); color: var(--ink-2); white-space: nowrap;
}
.pill.draft { background: var(--serious-bg); color: var(--serious-text); }
.pill.issued { background: var(--series-1); color: #fff; }
.pill.answered { background: var(--good-bg); color: var(--good-text); }
.pill.closed, .pill.withdrawn { background: var(--surface-2); color: var(--muted); }
.late { color: var(--critical); font-weight: 600; }

.split { display: grid; gap: 14px; grid-template-columns: 1fr; }
@media (min-width: 1080px) { .split { grid-template-columns: minmax(0,1fr) 400px; align-items: start; } }
.panel {
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  padding: 16px 18px; position: sticky; top: 14px;
}
.panel h2 { font-size: 15px; margin-bottom: 2px; }
.panel .sub { font-size: 12px; color: var(--muted); margin-bottom: 12px; }
.panel .field { margin-bottom: 10px; }
.panel label { display: block; font-size: 11.5px; color: var(--muted); font-weight: 600; margin-bottom: 4px; }
.panel input, .panel select, .panel textarea {
  font: inherit; font-size: 13px; width: 100%; padding: 7px 9px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--surface-2); color: var(--ink);
}
.panel textarea { min-height: 74px; resize: vertical; }
.acts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.facts { font-size: 12.5px; display: grid; gap: 6px; margin: 10px 0 4px;
         padding: 10px 0; border-top: 1px solid var(--grid); border-bottom: 1px solid var(--grid); }
.facts div { display: flex; justify-content: space-between; gap: 12px; }
.facts span:first-child { color: var(--muted); }
.facts span:last-child { font-variant-numeric: tabular-nums; text-align: right; }
.scroll { max-height: 72vh; overflow: auto; border: 1px solid var(--border); border-radius: 12px;
          background: var(--surface); }
@media (max-width: 760px) { .scroll { overflow-x: auto; } table.reg { min-width: 700px; } }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Issues</h1><div class="sub">RFIs, notices and inspections</div></div>
  <select class="proj" id="proj" hidden aria-label="Project"></select>
  <div class="spacer"></div>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  <a class="btn" href="/">Dashboard</a>
  <a class="btn" href="/reports">Reports</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  <div class="tiles" id="tiles"></div>

  <div class="bar">
    <select id="fStatus">
      <option value="open">Open</option>
      <option value="">All</option>
      <option value="draft">Waiting to be issued</option>
      <option value="issued">Issued, awaiting reply</option>
      <option value="answered">Answered</option>
      <option value="closed">Closed</option>
      <option value="withdrawn">Withdrawn</option>
    </select>
    <select id="fType"><option value="">Every type</option></select>
    <input type="search" id="q" placeholder="Search…">
    <button class="btn" id="onlyLate" aria-pressed="false">Overdue only</button>
    <div class="spacer"></div>
    <button class="btn btn-primary" id="newIssue">New issue</button>
  </div>

  <div class="split">
    <div class="scroll">
      <table class="reg">
        <thead><tr>
          <th>Ref</th><th>Raised</th><th>Type</th><th>Subject</th>
          <th>Activity</th><th>Status</th><th class="num">Age</th><th class="num">Reply due</th>
        </tr></thead>
        <tbody id="rows"><tr><td colspan="8"><div class="empty">Loading…</div></td></tr></tbody>
      </table>
    </div>
    <div class="panel" id="panel"><div class="empty">Pick an issue to work on it.</div></div>
  </div>
</div>
<div class="toast" id="toast"></div>

<script>
${SWITCHER_JS}
var ROLE = ${JSON.stringify(role)};
var CAN_ISSUE = ROLE === 'owner' || ROLE === 'manager';
var TYPES = {}, ROWS = [], SEL = null, LATE_ONLY = false, ACTS = {};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function fmt(s) {
  if (!s) return '—';
  var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var d = new Date(s.slice(0, 10) + 'T00:00:00Z');
  return String(d.getUTCDate()).padStart(2, '0') + ' ' + m[d.getUTCMonth()] + ' ' + String(d.getUTCFullYear()).slice(2);
}
function toast(m, bad) {
  var t = document.getElementById('toast');
  t.textContent = m; t.className = 'toast show' + (bad ? ' bad' : '');
  setTimeout(function () { t.className = 'toast'; }, 3000);
}
async function api(path, body) {
  var r = await fetch(path, body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : { cache: 'no-store' });
  var j = await r.json().catch(function () { return {}; });
  if (!r.ok) throw new Error(j.error || 'that did not work');
  return j;
}

async function load() {
  var st = document.getElementById('fStatus').value;
  var ty = document.getElementById('fType').value;
  var qs = '/api/issues?' + (st === 'open' ? 'open=1' : st ? 'status=' + st : '') + (ty ? '&type=' + ty : '');
  var d = await api(qs);
  TYPES = d.types || {};
  ROWS = d.issues || [];
  ACTS = d.activities || {};
  if (!document.getElementById('fType').dataset.filled) {
    document.getElementById('fType').innerHTML = '<option value="">Every type</option>' +
      Object.keys(TYPES).map(function (k) {
        return '<option value="' + k + '">' + esc(TYPES[k].label) + '</option>';
      }).join('');
    document.getElementById('fType').dataset.filled = '1';
  }
  renderTiles(d.summary || {});
  renderRows();
}

function renderTiles(s) {
  var t = [
    ['' + (s.draft || 0), 'waiting to be issued', s.draft ? 'warn' : ''],
    ['' + (s.issued || 0), 'issued, awaiting reply', ''],
    ['' + (s.overdue || 0), 'past their reply date', s.overdue ? 'bad' : ''],
    ['' + (s.oldest_open == null ? '—' : s.oldest_open + 'd'), 'oldest item still open', s.oldest_open > 21 ? 'bad' : ''],
    ['' + (s.closed || 0), 'closed', ''],
    ['' + (s.impact_days == null ? '—' : s.impact_days), 'days of delay claimed', ''],
  ];
  document.getElementById('tiles').innerHTML = t.map(function (x) {
    return '<div class="tile ' + x[2] + '"><b>' + esc(x[0]) + '</b><span>' + esc(x[1]) + '</span></div>';
  }).join('');
}

function visible() {
  var q = document.getElementById('q').value.trim().toLowerCase();
  return ROWS.filter(function (r) {
    if (LATE_ONLY && !r.overdue) return false;
    if (!q) return true;
    return (r.ref + ' ' + r.title + ' ' + (r.detail || '') + ' ' + (r.activity_id || '') + ' ' +
            (r.trade || '') + ' ' + (r.raised_by || '')).toLowerCase().indexOf(q) >= 0;
  });
}

function renderRows() {
  var list = visible();
  var tb = document.getElementById('rows');
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="8"><div class="empty">Nothing here. Site raises these from the site page when something is holding the work up.</div></td></tr>';
    return;
  }
  tb.innerHTML = list.map(function (r) {
    var due = r.status === 'issued' && r.reply_due
      ? (r.overdue ? '<span class="late">' + r.days_overdue + 'd over</span>' : fmt(r.reply_due))
      : (r.status === 'draft' ? '<span class="late">not issued</span>' : '—');
    var act = ACTS[r.activity_id];
    return '<tr data-ref="' + esc(r.ref) + '"' + (SEL === r.ref ? ' aria-selected="true"' : '') + '>' +
      '<td class="ref">' + esc(r.ref) + '</td>' +
      '<td>' + fmt(r.raised_date) + '<div style="font-size:11px;color:var(--muted)">' + esc(r.raised_by || '') + '</div></td>' +
      '<td>' + esc(r.type_label) + '</td>' +
      '<td>' + esc(r.title) + '</td>' +
      '<td>' + (act ? esc(act.name) : esc(r.activity_id || '—')) +
        (r.floor ? '<div style="font-size:11px;color:var(--muted)">' + esc(r.floor) + '</div>' : '') + '</td>' +
      '<td><span class="pill ' + esc(r.status) + '">' + esc(r.status) + '</span></td>' +
      '<td class="num">' + (r.age == null ? '—' : r.age + 'd') + '</td>' +
      '<td class="num">' + due + '</td></tr>';
  }).join('');
  tb.querySelectorAll('tr[data-ref]').forEach(function (tr) {
    tr.addEventListener('click', function () { select(tr.dataset.ref); });
  });
}

function select(ref) {
  SEL = ref;
  renderRows();
  var r = ROWS.filter(function (x) { return x.ref === ref; })[0];
  if (!r) return;
  var act = ACTS[r.activity_id];
  var p = document.getElementById('panel');
  var readOnly = !CAN_ISSUE;

  var actions = '';
  if (CAN_ISSUE) {
    if (r.status === 'draft') actions = '<button class="btn btn-primary" data-act="issue">Issue it</button>' +
      '<button class="btn" data-act="withdraw">Withdraw</button>';
    else if (r.status === 'issued') actions = '<button class="btn btn-primary" data-act="answer">Record the reply</button>' +
      '<button class="btn" data-act="close">Close</button>';
    else if (r.status === 'answered') actions = '<button class="btn btn-primary" data-act="close">Close</button>';
    else actions = '<button class="btn" data-act="reopen">Reopen</button>';
    actions += '<button class="btn" data-act="save">Save changes</button>';
  }

  p.innerHTML =
    '<h2>' + esc(r.ref) + ' · ' + esc(r.type_label) + '</h2>' +
    '<div class="sub">' + (act ? esc(act.name) : esc(r.activity_id || 'no activity')) + '</div>' +
    '<div class="facts">' +
      '<div><span>Raised on site</span><span>' + fmt(r.raised_date) + ' · ' + esc(r.raised_by || '—') + '</span></div>' +
      '<div><span>Issued</span><span>' + (r.issued_date ? fmt(r.issued_date) : 'not yet') + '</span></div>' +
      '<div><span>Reply due</span><span>' + (r.reply_due ? fmt(r.reply_due) + (r.overdue ? ' · <b class="late">' + r.days_overdue + 'd over</b>' : '') : '—') + '</span></div>' +
      '<div><span>Answered</span><span>' + (r.answered_date ? fmt(r.answered_date) : '—') + '</span></div>' +
      (act ? '<div><span>Programme</span><span>' + fmt(act.planned_start) + ' → ' + fmt(act.planned_finish) + '</span></div>' : '') +
    '</div>' +
    '<div class="field"><label>Subject</label><input id="eTitle" value="' + esc(r.title) + '"' + (readOnly ? ' readonly' : '') + '></div>' +
    '<div class="field"><label>Type</label><select id="eType"' + (readOnly ? ' disabled' : '') + '>' +
      Object.keys(TYPES).map(function (k) {
        return '<option value="' + k + '"' + (k === r.type ? ' selected' : '') + '>' + esc(TYPES[k].label) + '</option>';
      }).join('') + '</select></div>' +
    '<div class="field"><label>Detail — this is what goes into the document</label>' +
      '<textarea id="eDetail"' + (readOnly ? ' readonly' : '') + '>' + esc(r.detail || '') + '</textarea></div>' +
    '<div class="field"><label>Delay anticipated (working days)</label>' +
      '<input id="eImpact" type="number" step="0.5" min="0" value="' + (r.impact_days == null ? '' : r.impact_days) + '"' + (readOnly ? ' readonly' : '') + '></div>' +
    (r.status === 'issued' || r.status === 'answered' || r.status === 'closed'
      ? '<div class="field"><label>Reply received</label><textarea id="eAnswer"' + (readOnly ? ' readonly' : '') + '>' + esc(r.answer || '') + '</textarea></div>'
      : '') +
    '<div class="acts">' + actions +
      '<a class="btn" href="/issues/doc?ref=' + encodeURIComponent(r.ref) + '" target="_blank">Open the document</a>' +
    '</div>';

  p.querySelectorAll('[data-act]').forEach(function (b) {
    b.addEventListener('click', function () { act2(r.ref, b.dataset.act, b); });
  });
}

function panelValues() {
  var g = function (id) { var e = document.getElementById(id); return e ? e.value : undefined; };
  return {
    title: g('eTitle'), type: g('eType'), detail: g('eDetail'),
    impact_days: g('eImpact') === '' ? null : g('eImpact'), answer: g('eAnswer'),
  };
}

async function act2(ref, action, btn) {
  btn.disabled = true;
  try {
    var body = Object.assign({ ref: ref }, panelValues());
    if (action !== 'save') body.action = action;
    await api('/api/issue', body);
    toast(action === 'issue' ? 'Issued — the clock starts today' :
          action === 'save' ? 'Saved' : 'Updated');
    await load();
    select(ref);
  } catch (e) { toast(e.message, true); }
  btn.disabled = false;
}

document.getElementById('fStatus').addEventListener('change', load);
document.getElementById('fType').addEventListener('change', load);
document.getElementById('q').addEventListener('input', renderRows);
document.getElementById('onlyLate').addEventListener('click', function () {
  LATE_ONLY = !LATE_ONLY;
  this.setAttribute('aria-pressed', String(LATE_ONLY));
  renderRows();
});

document.getElementById('newIssue').addEventListener('click', async function () {
  var title = prompt('One line — what is the issue?');
  if (!title) return;
  try {
    var j = await api('/api/issue', { create: true, title: title, type: 'rfi' });
    await load();
    select(j.ref);
    toast(j.ref + ' created — fill in the detail, then issue it');
  } catch (e) { toast(e.message, true); }
});

mountSwitcher('proj');
load().catch(function (e) { toast(e.message, true); });
${PWA_BOOT}
</script>
</body></html>`;

// The RFI or notice itself, on its own page so it prints clean.
export const issueDocHTML = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title.replace(/[<>&"]/g, '')}</title>
${HEAD_LINKS}
<style>
body { margin: 0; background: #eef1f6; color: #1b2437; }
.sheet { background: #fff; max-width: 900px; margin: 18px auto; padding: 34px 38px;
         box-shadow: 0 2px 14px rgba(16,24,40,.12); border-radius: 8px; }
.tools { max-width: 900px; margin: 14px auto 0; display: flex; gap: 8px; padding: 0 14px; }
.tools button, .tools a {
  font: 600 13px/1 Arial, Helvetica, sans-serif; padding: 9px 14px; border-radius: 8px;
  border: 1px solid #cbd5e4; background: #fff; color: #1b2437; cursor: pointer; text-decoration: none;
}
.tools .go { background: #2a78d6; border-color: #2a78d6; color: #fff; }
@media print {
  @page { size: A4; margin: 16mm 14mm; }
  body { background: #fff; }
  .tools { display: none !important; }
  .sheet { box-shadow: none; border-radius: 0; margin: 0; padding: 0; max-width: none; }
}
@media (max-width: 640px) { .sheet { padding: 20px 16px; margin: 10px; } }
</style>
</head>
<body>
<div class="tools">
  <button class="go" onclick="window.print()">Download PDF</button>
  <a href="/issues">Back to the register</a>
</div>
<div class="sheet">${body}</div>
</body></html>`;
