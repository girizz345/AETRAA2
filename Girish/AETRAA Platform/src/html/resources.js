import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK, SWITCHER_CSS, SWITCHER_JS } from './shared.js';

// What the job has consumed, against what it built.
//
// The temptation on a page like this is to lead with the big number — total
// man-days, total spend — because it is impressive. It is also useless: it only
// goes up, and it never tells you to do anything.
//
// So the table people are meant to read is Effort, and the column that matters
// in it is man-days per point of progress, now against over the life of the job.
// That is the only figure here that can be acted on this week.

export const resourcesHTML = (role, money) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Resources · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1120px; }
.tiles { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); margin-bottom: 14px; }
.tile { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 11px 13px; }
.tile b { display: block; font-size: 23px; font-weight: 600; font-variant-numeric: tabular-nums;
          letter-spacing: -0.01em; line-height: 1.2; }
.tile span { font-size: 11.5px; color: var(--muted); display: block; margin-top: 2px; }
.tile .sub { font-size: 11px; color: var(--muted); margin-top: 4px; }
.tile.money b { color: var(--series-1); }

.bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
       background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
       padding: 11px 13px; margin-bottom: 14px; }
.bar input[type="date"] { width: auto; flex: 0 0 auto; min-width: 150px; font-size: 13px;
  padding: 6px 9px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--surface-2); color: var(--ink); }
.seg { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.seg button { appearance: none; border: 0; background: var(--surface-2); color: var(--ink-2);
  font: inherit; font-size: 13px; font-weight: 600; padding: 7px 13px; cursor: pointer; }
.seg button + button { border-left: 1px solid var(--border); }
.seg button[aria-pressed="true"] { background: var(--series-1); color: #fff; }

table.data { width: 100%; border-collapse: collapse; font-size: 13px; }
table.data th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .05em;
  color: var(--muted); font-weight: 700; padding: 0 10px 6px 0; white-space: nowrap; }
table.data td { padding: 7px 10px 7px 0; border-top: 1px solid var(--border); vertical-align: top; }
table.data th.n, table.data td.n { text-align: right; font-variant-numeric: tabular-nums; }
table.data tr.dim td { opacity: .6; }
.scroll { overflow-x: auto; }
.scroll > table { min-width: 720px; }

.trend { display: inline-block; font-size: 11px; font-weight: 700; padding: 1px 6px;
         border-radius: 4px; margin-left: 6px; white-space: nowrap; }
.trend.worse { background: #fdecec; color: var(--critical); }
.trend.better { background: #e8f5ec; color: var(--good-text); }
.trend.steady { background: var(--surface-2); color: var(--muted); }
[data-theme="dark"] .trend.worse { background: #3a1f1f; }
[data-theme="dark"] .trend.better { background: #16301f; }

.meter { height: 5px; border-radius: 3px; background: var(--surface-2); overflow: hidden;
         margin-top: 4px; min-width: 70px; }
.meter i { display: block; height: 100%; background: var(--series-1); }
.off { font-size: 11px; color: var(--serious-text, var(--muted)); }

.warn { background: var(--surface); border: 1px solid var(--border);
        border-left: 3px solid var(--serious); border-radius: 10px; padding: 12px 15px; margin-bottom: 14px; }
.warn h3 { font-size: 13px; margin: 0 0 6px; }
.warn ul { margin: 0; padding-left: 17px; font-size: 12.5px; color: var(--ink-2); line-height: 1.6; }

.rate-in { width: 86px; font-size: 12.5px; padding: 4px 6px; border-radius: 6px;
           border: 1px solid var(--border); background: var(--surface-2); color: var(--ink);
           text-align: right; font-variant-numeric: tabular-nums; }
dialog { border: 1px solid var(--border); border-radius: 14px; background: var(--surface);
         color: var(--ink); padding: 0; }
dialog::backdrop { background: rgba(0,0,0,.45); }
.lede { font-size: 12.5px; color: var(--muted); margin: 0 0 12px; line-height: 1.6; max-width: 70ch; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Resources</h1><div class="sub">what the job has used, against what it built</div></div>
  <select class="proj" id="proj" hidden aria-label="Project"></select>
  <div class="spacer"></div>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  <a class="btn" href="/">Dashboard</a>
  <a class="btn" href="/reports">Reports</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  <div class="bar">
    <label for="to" class="hint" style="margin:0">As at</label>
    <input type="date" id="to">
    <div class="seg" role="group" aria-label="What to show">
      <button data-view="effort" aria-pressed="true">Effort</button>
      <button data-view="plant" aria-pressed="false">Plant</button>
      <button data-view="materials" aria-pressed="false">Materials</button>
      <button data-view="months" aria-pressed="false">By month</button>
    </div>
    <div style="flex:1"></div>
    ${money ? '<button class="btn" id="ratesBtn">Rates</button>' : ''}
    <span class="hint" id="stamp"></span>
  </div>

  <div class="tiles" id="tiles"></div>
  <div id="warn"></div>

  <div class="card" id="panel"><p class="hint">Loading…</p></div>
</div>

${money ? `<dialog id="rateDlg"><div style="padding:18px 20px 20px;max-width:560px">
  <h2 style="margin:0 0 4px;font-size:18px">Rates</h2>
  <p class="hint" style="margin:2px 0 14px">
    A day-rate per trade and per machine, a unit rate per material. Only you see these,
    and only you see any figure calculated from them. Leave one blank to take it out.
  </p>
  <div id="rateBody" style="max-height:58vh;overflow:auto"></div>
  <button class="btn btn-primary" id="rateDone" style="width:100%;margin-top:14px">Done</button>
</div></dialog>` : ''}

<div class="toast" id="toast"></div>

<script>
${PWA_BOOT}
${SWITCHER_JS}
var MONEY = ${money ? 'true' : 'false'};
var esc = function (s) { return String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
var D = null, view = 'effort';

function toast(msg, bad) {
  var t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
  setTimeout(function () { t.className = 'toast'; }, 2600);
}

// Man-days are whole men; rates are money; percentages are percentages. Each
// wants a different number of decimals, and getting that wrong is how a page
// stops being believed.
function n0(v) { return (Math.round(Number(v) || 0)).toLocaleString('en-US'); }
function n1(v) { return (Number(v) || 0).toFixed(1); }
function n2(v) { return (Number(v) || 0).toFixed(2); }
function money(v) {
  if (v === null || v === undefined) return '—';
  var n = Number(v) || 0;
  // One decimal in the thousands, so the parts under a total visibly add up to it.
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'm';
  if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
  return n0(n);
}
function qty(v) {
  var n = Number(v) || 0;
  return n % 1 === 0 ? n0(n) : n.toFixed(2);
}

function tiles() {
  var L = D.labour, P = D.plant, M = D.materials;
  var cur = D.currency || 'AED';
  var t = [];
  t.push(['Man-days to date', n0(L.total_man_days),
          n0(L.direct_man_days) + ' working, ' + n0(L.indirect_man_days) + ' indirect'
          + (L.sub_man_days ? ', ' + n0(L.sub_man_days) + ' subcontract' : '')]);
  t.push(['Man-hours', n0(L.man_hours), D.days_recorded + ' days on record']);
  t.push(['Plant-days', n0(P.plant_days), P.by_type.length + ' machines used']);
  t.push(['Deliveries', n0(M.deliveries), M.items + ' different materials']);
  if (MONEY && D.priced) {
    var total = (L.cost || 0) + (P.cost || 0) + (M.cost || 0);
    t.push(['Spent to date', cur + ' ' + money(total),
            'labour ' + money(L.cost) + ' · plant ' + money(P.cost) + ' · material ' + money(M.cost),
            'money']);
  }
  document.getElementById('tiles').innerHTML = t.map(function (x) {
    return '<div class="tile ' + (x[3] || '') + '"><b>' + x[1] + '</b><span>' + esc(x[0]) + '</span>' +
      (x[2] ? '<div class="sub">' + esc(x[2]) + '</div>' : '') + '</div>';
  }).join('');
}

function warnings() {
  var el = document.getElementById('warn');
  if (!D.warnings || !D.warnings.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="warn"><h3>What these figures cannot tell you</h3><ul>' +
    D.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>';
}

/* --------------------------------------------------------------- effort */

function effort() {
  var rows = D.labour.by_trade;
  if (!rows.length) return '<p class="hint">Nothing logged yet.</p>';
  var cur = D.currency || 'AED';
  var head = '<tr><th>Trade</th><th class="n">Man-days</th><th class="n">Hours</th>' +
    '<th class="n">Complete</th><th class="n">Man-days<br>per point</th>' +
    '<th class="n">Last ' + D.recent_days + ' days</th><th class="n">Projected<br>at 100%</th>' +
    (MONEY && D.priced ? '<th class="n">' + cur + '</th>' : '') + '</tr>';

  var body = rows.map(function (t) {
    var dim = t.indirect || !t.in_programme;
    var pct = t.pct === null ? '—'
      : n1(t.pct) + '%<div class="meter"><i style="width:' + Math.min(100, t.pct) + '%"></i></div>';
    var per = t.per_point === null ? '<span class="off">' +
        (t.indirect ? 'indirect' : 'not in the programme') + '</span>' : n2(t.per_point);
    var rec = t.recent_per_point === null
      ? (t.recent_days ? n0(t.recent_days) + ' md, no gain' : '—')
      : n2(t.recent_per_point) + (t.trend ? '<span class="trend ' + t.trend + '">' +
          (t.trend === 'worse' ? 'slower' : t.trend === 'better' ? 'faster' : 'steady') + '</span>' : '');
    return '<tr class="' + (dim ? 'dim' : '') + '">' +
      '<td><b>' + esc(t.trade) + '</b>' + (t.group ? ' <span class="hint">' + esc(t.group) + '</span>' : '') + '</td>' +
      '<td class="n">' + n0(t.man_days) + '</td>' +
      '<td class="n">' + n0(t.man_hours) + '</td>' +
      '<td class="n">' + pct + '</td>' +
      '<td class="n">' + per + '</td>' +
      '<td class="n">' + rec + '</td>' +
      '<td class="n">' + (t.projected === null ? '—' : n0(t.projected)) + '</td>' +
      (MONEY && D.priced ? '<td class="n">' + (t.cost === null ? '<span class="off">no rate</span>' : money(t.cost)) + '</td>' : '') +
      '</tr>';
  }).join('');

  var subs = D.labour.subcontractors.length ? '<h3 style="font-size:14px;margin:18px 0 6px">Subcontractors</h3>' +
    '<div class="scroll"><table class="data"><tr><th>Subcontractor</th><th class="n">Man-days</th></tr>' +
    D.labour.subcontractors.map(function (s) {
      return '<tr><td>' + esc(s.name) + '</td><td class="n">' + n0(s.man_days) + '</td></tr>';
    }).join('') + '</table></div>' : '';

  return '<p class="lede"><b>Man-days per point</b> is what the trade has cost you for each ' +
    'percent of its own work. The column beside it is the same figure over the last ' +
    D.recent_days + ' days only — when that is the larger number, the trade is getting slower, ' +
    'and it shows here weeks before the programme moves.</p>' +
    '<div class="scroll"><table class="data">' + head + body + '</table></div>' + subs;
}

/* ---------------------------------------------------------------- plant */

function plant() {
  var rows = D.plant.by_type;
  if (!rows.length) return '<p class="hint">No plant logged yet.</p>';
  var cur = D.currency || 'AED';
  return '<div class="scroll"><table class="data">' +
    '<tr><th>Machine</th><th class="n">Plant-days</th><th class="n">Hours</th>' +
    '<th class="n">Last ' + D.recent_days + ' days</th><th>On site</th>' +
    (MONEY && D.priced ? '<th class="n">' + cur + '</th>' : '') + '</tr>' +
    rows.map(function (p) {
      return '<tr><td><b>' + esc(p.type) + '</b></td>' +
        '<td class="n">' + n0(p.plant_days) + '</td>' +
        '<td class="n">' + n0(p.plant_hours) + '</td>' +
        '<td class="n">' + (p.recent_days ? n0(p.recent_days) : '—') + '</td>' +
        '<td class="hint">' + esc(p.first) + ' → ' + esc(p.last) + '</td>' +
        (MONEY && D.priced ? '<td class="n">' + (p.cost === null ? '<span class="off">no rate</span>' : money(p.cost)) + '</td>' : '') +
        '</tr>';
    }).join('') + '</table></div>' +
    '<p class="lede" style="margin-top:12px">A machine still logging days after the work it ' +
    'came for has finished is the cheapest overrun there is to stop.</p>';
}

/* ------------------------------------------------------------ materials */

function materials() {
  var rows = D.materials.by_item;
  if (!rows.length) return '<p class="hint">No deliveries logged yet.</p>';
  var cur = D.currency || 'AED';
  return '<div class="scroll"><table class="data">' +
    '<tr><th>Material</th><th class="n">Delivered</th><th>Unit</th><th class="n">Deliveries</th>' +
    '<th>Last</th>' + (MONEY && D.priced ? '<th class="n">' + cur + '</th>' : '') + '</tr>' +
    rows.map(function (m) {
      return '<tr class="' + (m.listed ? '' : 'dim') + '"><td><b>' + esc(m.material) + '</b>' +
        (m.listed ? '' : ' <span class="off">not on the list</span>') + '</td>' +
        '<td class="n">' + qty(m.qty) + '</td>' +
        '<td>' + esc(m.unit || '—') + '</td>' +
        '<td class="n">' + n0(m.deliveries) + '</td>' +
        '<td class="hint">' + esc(m.last) + '</td>' +
        (MONEY && D.priced ? '<td class="n">' + (m.cost === null ? '<span class="off">no rate</span>' : money(m.cost)) + '</td>' : '') +
        '</tr>';
    }).join('') + '</table></div>' +
    '<p class="lede" style="margin-top:12px">Anything marked <i>not on the list</i> was typed by ' +
    'hand on the diary and will not add up with the same material spelt another way. Put it on ' +
    'the project\\'s material list in Admin and site picks it from a menu after that.</p>';
}

/* --------------------------------------------------------------- months */

function months() {
  var rows = D.months;
  if (!rows.length) return '<p class="hint">Nothing recorded yet.</p>';
  var max = Math.max.apply(null, rows.map(function (m) { return m.man_days; })) || 1;
  return '<div class="scroll"><table class="data">' +
    '<tr><th>Month</th><th class="n">Days kept</th><th class="n">Man-days</th>' +
    '<th style="width:40%"></th><th class="n">Plant-days</th></tr>' +
    rows.map(function (m) {
      return '<tr><td><b>' + esc(m.month) + '</b></td>' +
        '<td class="n">' + n0(m.days) + '</td>' +
        '<td class="n">' + n0(m.man_days) + '</td>' +
        '<td><div class="meter" style="height:8px"><i style="width:' +
          Math.round(m.man_days / max * 100) + '%"></i></div></td>' +
        '<td class="n">' + n0(m.plant_days) + '</td></tr>';
    }).join('') + '</table></div>';
}

function draw() {
  document.getElementById('panel').innerHTML =
    view === 'plant' ? plant() : view === 'materials' ? materials()
    : view === 'months' ? months() : effort();
}

async function load() {
  var to = document.getElementById('to').value;
  var r = await fetch('/api/resources' + (to ? '?to=' + to : ''), { cache: 'no-store' });
  if (!r.ok) {
    document.getElementById('panel').innerHTML = '<p class="hint">Could not load the figures.</p>';
    return;
  }
  D = await r.json();
  document.getElementById('stamp').textContent =
    D.from === D.to ? '' : 'from ' + D.from;
  tiles(); warnings(); draw();
}

Array.prototype.forEach.call(document.querySelectorAll('.seg button'), function (b) {
  b.addEventListener('click', function () {
    Array.prototype.forEach.call(document.querySelectorAll('.seg button'), function (x) {
      x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
    });
    view = b.getAttribute('data-view');
    draw();
  });
});
document.getElementById('to').addEventListener('change', load);

${money ? `
/* ----------------------------------------------------------- the rates */

var rateDlg = document.getElementById('rateDlg');
document.getElementById('ratesBtn').addEventListener('click', async function () {
  var r = await fetch('/api/rates', { cache: 'no-store' });
  if (!r.ok) { toast('Could not open the rates', true); return; }
  var d = await r.json();
  if (!d.rates) {
    document.getElementById('rateBody').innerHTML =
      '<p class="hint">Rates are not switched on for this database yet. ' +
      'Run <code>bash upgrade-resources.sh</code> once.</p>';
    rateDlg.showModal();
    return;
  }
  // Only what the job has actually used gets a box. A list of every trade in the
  // roster would be a form nobody finishes.
  var groups = [
    ['labour', 'Trades — per man-day', (D.labour.by_trade || []).map(function (t) { return t.trade; })],
    ['plant', 'Plant — per machine-day', (D.plant.by_type || []).map(function (p) { return p.type; })],
    ['material', 'Materials — per unit', (D.materials.by_item || []).map(function (m) {
       return m.material + (m.unit ? '  (' + m.unit + ')' : ''); })],
  ];
  document.getElementById('rateBody').innerHTML = groups.map(function (g) {
    var names = g[2];
    if (!names.length) return '';
    return '<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;' +
      'color:var(--muted);margin:14px 0 6px">' + esc(g[1]) + '</h3>' +
      names.map(function (label) {
        var name = label.replace(/\\s+\\([^)]*\\)$/, '');
        var cur = (d.rates[g[0]] || {});
        var found = Object.keys(cur).map(function (k) { return cur[k]; })
          .filter(function (x) { return x.name === name; })[0];
        return '<div style="display:flex;gap:10px;align-items:center;padding:3px 0">' +
          '<span style="flex:1;font-size:13px">' + esc(label) + '</span>' +
          '<input class="rate-in" type="number" min="0" step="0.01" data-kind="' + g[0] + '" ' +
          'data-name="' + esc(name) + '" value="' + (found ? found.rate : '') + '" placeholder="—">' +
          '</div>';
      }).join('');
  }).join('');
  rateDlg.showModal();
});

document.getElementById('rateBody').addEventListener('change', async function (e) {
  var el = e.target;
  if (!el.getAttribute || !el.getAttribute('data-kind')) return;
  var r = await fetch('/api/rate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: el.getAttribute('data-kind'), name: el.getAttribute('data-name'),
                           rate: el.value === '' ? 0 : Number(el.value) }),
  });
  var j = await r.json().catch(function () { return {}; });
  if (!r.ok) { toast(j.error || 'Could not save that rate', true); return; }
  toast(j.removed ? 'Rate removed' : 'Saved');
});
document.getElementById('rateDone').addEventListener('click', function () {
  rateDlg.close(); load();
});
` : ''}

document.getElementById('themeBtn').addEventListener('click', function () {
  var cur = document.documentElement.getAttribute('data-theme');
  var next = cur === 'dark' ? '' : 'dark';
  if (next) document.documentElement.setAttribute('data-theme', next);
  else document.documentElement.removeAttribute('data-theme');
  try { localStorage.setItem('sm-theme', JSON.stringify(next)); } catch (e) {}
});
try {
  var sv = localStorage.getItem('sm-theme');
  if (sv) { var t = JSON.parse(sv); if (t) document.documentElement.setAttribute('data-theme', t); }
} catch (e) {}

mountSwitcher('proj');
document.getElementById('to').value = new Date().toISOString().slice(0, 10);
load();
setInterval(load, 120000);
</script>
</body>
</html>`;
