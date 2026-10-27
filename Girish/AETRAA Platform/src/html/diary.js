import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK, SWITCHER_CSS, SWITCHER_JS } from './shared.js';

// One page for both hands: the site engineer fills it on a phone during the day,
// the PM opens the same thing on a laptop, checks it and generates the document.
export const diaryHTML = (role) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Daily site diary</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1180px; padding-bottom: 96px; }
.bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
       background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
       padding: 11px 13px; margin-bottom: 14px; }
.bar input[type="date"] { font: inherit; font-size: 13px; padding: 6px 9px; border-radius: 8px;
  width: auto; flex: 0 0 auto; min-width: 148px;
  border: 1px solid var(--border); background: var(--surface-2); color: var(--ink); }
.state { font-size: 12px; color: var(--muted); }
.state b { color: var(--ink); }
.state.carried { color: var(--serious-text); }

/* Columns rather than a grid: the labour list is far taller than the rest, and a
   grid would leave half the page empty beside it. */
.cards { columns: 1; column-gap: 14px; }
@media (min-width: 900px) { .cards { columns: 2; } }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
        padding: 14px 16px; margin-bottom: 14px; break-inside: avoid; page-break-inside: avoid; }
.card h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted);
           margin-bottom: 10px; display: flex; align-items: baseline; gap: 8px; }
.card h2 .r { margin-left: auto; font-size: 12px; text-transform: none; letter-spacing: 0; color: var(--ink-2); }


/* the trade / plant grid — number box big enough for a thumb */
.rows { display: grid; gap: 4px; }
.row {
  display: grid; grid-template-columns: 1fr 64px 52px; gap: 6px; align-items: center;
  padding: 3px 0; border-bottom: 1px solid var(--grid);
}
.row:last-child { border-bottom: 0; }
.row .nm { font-size: 13px; line-height: 1.3; }
.row .nm small { display: block; color: var(--muted); font-size: 10.5px; }
.row input { font: inherit; font-size: 14px; text-align: center; padding: 7px 4px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--surface-2); color: var(--ink); width: 100%; }
.row input.has { border-color: var(--series-1); font-weight: 600; }
.row .hd { font-size: 10px; color: var(--muted); text-align: center; text-transform: uppercase; letter-spacing: .04em; }
.rowhead { display: grid; grid-template-columns: 1fr 64px 52px; gap: 6px; margin-bottom: 2px; }

.tot { display: flex; gap: 14px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--grid); }
.tot div { flex: 1; }
.tot b { display: block; font-size: 21px; font-weight: 600; font-variant-numeric: tabular-nums; }
.tot span { font-size: 11px; color: var(--muted); }

.wx { display: flex; flex-wrap: wrap; gap: 7px; }
.wx button { appearance: none; font: inherit; font-size: 13px; cursor: pointer; padding: 8px 14px;
  border-radius: 999px; border: 1px solid var(--border); background: var(--surface-2); color: var(--ink-2); }
.wx button[aria-pressed="true"] { background: var(--series-1); border-color: var(--series-1); color: #fff; font-weight: 600; }

.lines { display: grid; gap: 6px; }
.line { display: grid; gap: 6px; align-items: center; }
.line.work { grid-template-columns: 1fr 60px 32px; }
.line.mat  { grid-template-columns: 1fr 70px 70px 32px; }
.line.sub  { grid-template-columns: minmax(120px,1.4fr) minmax(110px,1.2fr) minmax(100px,1fr) 58px 52px 32px; }
.line select { font: inherit; font-size: 13px; padding: 8px 6px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--surface-2); color: var(--ink);
  width: 100%; appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%),
                    linear-gradient(135deg, var(--muted) 50%, transparent 50%);
  background-position: right 10px center, right 5px center;
  background-size: 5px 5px, 5px 5px; background-repeat: no-repeat; }
/* On a phone the six columns will not fit, so the gang wraps into two rows with
   the name across the top — it stays one line of data either way. */
@media (max-width: 620px) {
  .line.sub { grid-template-columns: 1fr 1fr 58px 52px 32px; }
  .line.sub > :first-child { grid-column: 1 / -1; }
  .linehead.sub { display: none; }
}
.line input, .line textarea { font: inherit; font-size: 13px; padding: 8px 9px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--surface-2); color: var(--ink); width: 100%; }
.line textarea { min-height: 38px; resize: vertical; }
.line .rm { background: none; border: 1px solid var(--border); border-radius: 8px; height: 36px;
            color: var(--critical); cursor: pointer; font-size: 15px; }
.linehead { display: grid; gap: 6px; font-size: 10px; color: var(--muted);
            text-transform: uppercase; letter-spacing: .04em; margin-bottom: 2px; }
.add { margin-top: 8px; }
textarea.big { font: inherit; font-size: 13px; width: 100%; min-height: 64px; padding: 8px 9px;
  border-radius: 8px; border: 1px solid var(--border); background: var(--surface-2); color: var(--ink); resize: vertical; }

.foot { position: fixed; left: 0; right: 0; bottom: 0; background: var(--surface);
        border-top: 1px solid var(--border); padding: 10px 16px; z-index: 30;
        display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.foot .msg { font-size: 12.5px; color: var(--ink-2); flex: 1 1 auto; min-width: 120px; }
.hist { width: 100%; border-collapse: collapse; font-size: 13px; }
.hist th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em;
           color: var(--muted); font-weight: 600; padding: 7px 8px; border-bottom: 1px solid var(--border); }
.hist td { padding: 8px; border-bottom: 1px solid var(--grid); }
.hist tbody tr { cursor: pointer; }
.hist tbody tr:hover { background: var(--surface-2); }
.pill { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px;
        background: var(--surface-2); color: var(--ink-2); }
.pill.submitted { background: var(--good-bg); color: var(--good-text); }
.checks { border-radius: 12px; padding: 12px 16px; margin: 0 0 14px; font-size: 13.5px; line-height: 1.5; border: 1px solid var(--border); background: var(--surface); }
.checks b { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
.checks ul { margin: 0 0 6px; padding-left: 18px; }
.checks .blk { color: var(--critical); }
.checks .wrn { color: #9a6a0c; }
[data-theme="dark"] .checks .wrn { color: #e7b866; }
.strip { display: flex; gap: 4px; flex-wrap: wrap; margin: 0 0 14px; align-items: center; font-size: 12px; }
.strip .d { width: 46px; text-align: center; border-radius: 8px; padding: 5px 0; cursor: pointer; border: 1px solid var(--border); background: var(--surface); line-height: 1.25; }
.strip .d small { display: block; color: var(--muted); font-size: 10.5px; }
.strip .submitted { background: var(--good-bg); color: var(--good-text); border-color: transparent; }
.strip .draft { background: #fdf1d8; color: #92600c; border-color: transparent; }
.strip .missing { background: color-mix(in srgb, var(--critical) 16%, transparent); color: var(--critical); border-color: transparent; font-weight: 700; }
.strip .off { opacity: .45; }
.strip .sel { outline: 2px solid var(--series-1); }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Daily site diary</h1><div class="sub" id="psub"></div></div>
  <select class="proj" id="proj" hidden aria-label="Project"></select>
  <div class="spacer"></div>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  ${role === 'site' ? '<a class="btn" href="/site">Site update</a>'
    : '<a class="btn" href="/">Dashboard</a><a class="btn" href="/site">Site update</a>'}
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  <div class="bar">
    <label for="day" style="font-size:12px;color:var(--muted);font-weight:600">Diary for</label>
    <input type="date" id="day">
    <button class="btn" id="prev" title="Previous day">‹</button>
    <button class="btn" id="next" title="Next day">›</button>
    <span class="state" id="state"></span>
    <div class="spacer"></div>
    <a class="btn" id="btnPdf" href="#" target="_blank">Open / print</a>
    <a class="btn" id="btnDocx" href="#">Word</a>
  </div>
  <div class="strip" id="strip"></div>
  <div id="checks"></div>

  <div class="cards">
    <div class="card">
      <h2>On site staff &amp; labour record <span class="r" id="staffR"></span></h2>
      <div class="rowhead"><span></span><span class="hd">No.</span><span class="hd">Hrs</span></div>
      <div class="rows" id="staff"></div>
      <div class="tot">
        <div><b id="tTotal">0</b><span>grand total on site</span></div>
        <div><b id="tProd">0</b><span>productive manpower</span></div>
        <div><b id="tSub">0</b><span>subcontractor</span></div>
      </div>
    </div>

    <div class="card">
      <h2>Weather</h2>
      <div class="wx" id="wx"></div>

      <h2 style="margin-top:18px">On site plant &amp; equipment <span class="r" id="plantR"></span></h2>
      <div class="rowhead"><span></span><span class="hd">No.</span><span class="hd">Hrs</span></div>
      <div class="rows" id="plant"></div>
    </div>

    <div class="card">
      <h2>Description of works <span class="r">men against each</span></h2>
      <div class="linehead" style="grid-template-columns:1fr 60px 32px"><span>Activity</span><span>Qty</span><span></span></div>
      <div class="lines" id="works"></div>
      <button class="btn add" data-add="works">Add a line</button>
      <button class="btn add" id="pullProgress" title="Adds a line for each activity site updated on this day">Add today’s site progress</button>
    </div>

    <div class="card">
      <h2>Expected works tomorrow <span class="r">becomes tomorrow's list</span></h2>
      <div class="linehead" style="grid-template-columns:1fr 60px 32px"><span>Activity</span><span>Qty</span><span></span></div>
      <div class="lines" id="tomorrow"></div>
      <button class="btn add" data-add="tomorrow">Add a line</button>
    </div>

    <div class="card">
      <h2>Delivery of materials</h2>
      <div class="linehead" style="grid-template-columns:1fr 70px 70px 32px"><span>Material</span><span>Qty</span><span>Unit</span><span></span></div>
      <div class="lines" id="materials"></div>
      <datalist id="matlist"></datalist>
      <button class="btn add" data-add="materials">Add a delivery</button>
    </div>

    <div class="card">
      <h2>Sub-contractor labour</h2>
      <p class="hint" style="margin:-4px 0 10px">
        One line per gang — who they work for, what trade, and what they are on site as.
        A subcontractor sending a foreman and eight masons is two lines, because the day
        it costs is not the same day.
      </p>
      <div class="linehead sub" style="grid-template-columns:minmax(120px,1.4fr) minmax(110px,1.2fr) minmax(100px,1fr) 58px 52px 32px">
        <span>Sub-contractor</span><span>Trade</span><span>Position</span><span>No.</span><span>Hrs</span><span></span></div>
      <div class="lines" id="subs"></div>
      <datalist id="sublist"></datalist>
      <button class="btn add" data-add="subs">Add a gang</button>
    </div>

  </div>

  <div class="wides">
    <div class="card">
      <h2>Remarks, visitors and who prepared it</h2>
      <div style="display:grid;gap:10px;grid-template-columns:1fr">
        <div><label style="font-size:11.5px;color:var(--muted);font-weight:600">Remarks — instructions, stoppages, anything worth a record</label>
          <textarea class="big" id="remarks" placeholder="e.g. Concrete pour held 2 hrs — consultant inspection late"></textarea></div>
        <div><label style="font-size:11.5px;color:var(--muted);font-weight:600">Visitors</label>
          <textarea class="big" id="visitors" style="min-height:44px" placeholder="e.g. Municipality inspection 11:00"></textarea></div>
        <div><label style="font-size:11.5px;color:var(--muted);font-weight:600">Prepared by</label>
          <input class="big" id="prepared" style="min-height:0" placeholder="e.g. Rakesh — Site Engineer"></div>
      </div>
    </div>

    <div class="card">
      <h2>Diaries kept <span class="r" id="histR"></span></h2>
      <div style="overflow-x:auto">
        <table class="hist"><thead><tr>
          <th>Date</th><th>Weather</th><th>On site</th><th>Sub-con</th><th>Works</th><th>Prepared by</th><th>Status</th>
        </tr></thead><tbody id="hist"><tr><td colspan="7"><div class="empty">Loading…</div></td></tr></tbody></table>
      </div>
    </div>
  </div>
</div>

<div class="foot">
  <span class="msg" id="msg"></span>
  <button class="btn" id="save">Save</button>
  ${role === 'site' ? '' : '<button class="btn" id="submit">Mark submitted</button>'}
  <a class="btn btn-primary" id="btnPdf2" href="#" target="_blank">Generate the diary</a>
</div>
<div class="toast" id="toast"></div>

<script>
${SWITCHER_JS}
var ROLE = ${JSON.stringify(role)};
var D = null, ROSTER = { trades: [], plant: [], materials: [], positions: [], subcontractors: [] }, DIRTY = false;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function toast(m, bad) {
  var t = document.getElementById('toast');
  t.textContent = m; t.className = 'toast show' + (bad ? ' bad' : '');
  setTimeout(function () { t.className = 'toast'; }, 3000);
}
function isoDay(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function fmt(s) {
  if (!s) return '—';
  var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var d = new Date(s.slice(0, 10) + 'T00:00:00Z');
  return String(d.getUTCDate()).padStart(2, '0') + ' ' + m[d.getUTCMonth()] + ' ' + String(d.getUTCFullYear()).slice(2);
}
async function api(path, body) {
  var r = await fetch(path, body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : { cache: 'no-store' });
  var j = await r.json().catch(function () { return {}; });
  if (!r.ok) throw new Error(j.error || 'that did not work');
  return j;
}
function dirty() { DIRTY = true; document.getElementById('msg').textContent = 'Not saved yet'; }

/* ------------------------------------------------------------- rendering */

function numRows(boxId, list) {
  document.getElementById(boxId).innerHTML = list.map(function (r, i) {
    return '<div class="row" data-i="' + i + '">' +
      '<div class="nm">' + esc(r.t) + (r.indirect ? '<small>indirect</small>' : '') + '</div>' +
      '<input class="n" type="number" min="0" inputmode="numeric" value="' + (r.n ? r.n : '') + '" placeholder="0">' +
      '<input class="h" type="text" inputmode="numeric" value="' + esc(r.h || '') + '" placeholder="hrs">' +
      '</div>';
  }).join('');
  var box = document.getElementById(boxId);
  box.querySelectorAll('.row').forEach(function (row) {
    var n = row.querySelector('.n');
    n.classList.toggle('has', !!Number(n.value));
    row.addEventListener('input', function () {
      var i = Number(row.dataset.i);
      list[i].n = Number(row.querySelector('.n').value) || 0;
      list[i].h = row.querySelector('.h').value;
      n.classList.toggle('has', !!list[i].n);
      recount(); dirty();
    });
  });
}

var FIELDS = {
  works:     { cls: 'work', f: [['a','Activity','text'],['q','Qty','number']] },
  tomorrow:  { cls: 'work', f: [['a','Activity','text'],['q','Qty','number']] },
  materials: { cls: 'mat',  f: [['m','Material','text'],['q','Qty','text'],['u','Unit','text']] },
  // Trade and position are chosen, not typed: a trade spelt three ways is three
  // trades when the month is totalled.
  subs:      { cls: 'sub',  f: [['n','Sub-contractor','text'], ['t','Trade','select-trade'],
                               ['p','Position','select-position'], ['c','No.','number'],
                               ['h','Hrs','number']] },
};

function lineRows(key) {
  var spec = FIELDS[key], list = D[key] || (D[key] = []);
  if (!list.length) list.push({});
  document.getElementById(key).innerHTML = list.map(function (r, i) {
    return '<div class="line ' + spec.cls + '" data-i="' + i + '">' +
      spec.f.map(function (f) {
        var val = r[f[0]] == null ? '' : r[f[0]];
        if (f[2] === 'select-trade' || f[2] === 'select-position') {
          var opts = f[2] === 'select-trade'
            ? (ROSTER.trades || []).map(function (x) { return x.t; })
            : (ROSTER.positions || []);
          // Whatever is already on the line stays selectable even if it has since
          // been taken off the roster — an issued diary is not rewritten because
          // somebody tidied a list.
          if (val && opts.indexOf(val) < 0) opts = [val].concat(opts);
          return '<select data-k="' + f[0] + '"><option value="">' + f[1] + '\u2026</option>' +
            opts.map(function (o) {
              return '<option value="' + esc(o) + '"' + (o === val ? ' selected' : '') + '>' +
                     esc(o) + '</option>'; }).join('') + '</select>';
        }
        var extra = (key === 'materials' && f[0] === 'm') ? ' list="matlist" autocomplete="off"'
                  : (key === 'subs' && f[0] === 'n') ? ' list="sublist" autocomplete="off"' : '';
        return '<input data-k="' + f[0] + '" type="' + f[2] + '"' + (f[2] === 'number' ? ' min="0" inputmode="numeric"' : '') + extra +
          ' value="' + esc(val) + '" placeholder="' + f[1] + '">';
      }).join('') +
      '<button class="rm" type="button" title="Remove">×</button></div>';
  }).join('');
  var box = document.getElementById(key);
  box.querySelectorAll('.line').forEach(function (ln) {
    var i = Number(ln.dataset.i);
    var collect = function (e) {
      ln.querySelectorAll('[data-k]').forEach(function (inp) { list[i][inp.dataset.k] = inp.value; });
      // Picking a material off the list brings its unit with it, so a delivery
      // booked in tonnes against a material measured in cubic metres cannot
      // happen by accident. A unit already typed is left alone.
      if (key === 'materials' && e.target.dataset.k === 'm') {
        var hit = (ROSTER.materials || []).filter(function (m) {
          return m.m.toLowerCase() === String(list[i].m || '').toLowerCase(); })[0];
        var uBox = ln.querySelector('[data-k="u"]');
        if (hit && uBox && !uBox.value) { uBox.value = hit.u || ''; list[i].u = uBox.value; }
      }
      if (key === 'subs') recount();
      dirty();
    };
    ln.addEventListener('input', collect);
    ln.addEventListener('change', collect);
    ln.querySelector('.rm').addEventListener('click', function () {
      list.splice(i, 1); lineRows(key); recount(); dirty();
    });
  });
}

function recount() {
  var indirect = {};
  ROSTER.trades.forEach(function (r) { if (r.indirect) indirect[r.t] = 1; });
  var total = 0, prod = 0;
  (D.staff || []).forEach(function (r) {
    var n = Number(r.n) || 0; total += n; if (!indirect[r.t]) prod += n;
  });
  // Counts both shapes: the gang rows the diary keeps now, and the two-number
  // rows on every diary issued before this was changed.
  var sub = (D.subs || []).reduce(function (s, r) {
    return s + (r.c !== undefined && r.c !== null && r.c !== ''
      ? (Number(r.c) || 0)
      : (Number(r.s) || 0) + (Number(r.l) || 0));
  }, 0);
  document.getElementById('tTotal').textContent = total;
  document.getElementById('tProd').textContent = prod;
  document.getElementById('tSub').textContent = sub;
  document.getElementById('staffR').textContent = total + ' on site';
  document.getElementById('plantR').textContent =
    (D.plant || []).filter(function (r) { return Number(r.n); }).length + ' in use';
}

function renderWeather() {
  var picked = String(D.weather || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  document.getElementById('wx').innerHTML = ${JSON.stringify(['Sunny','Cloudy','Rainy','Windy','Dusty'])}
    .map(function (w) {
      return '<button type="button" data-w="' + w + '" aria-pressed="' + (picked.indexOf(w) >= 0) + '">' + w + '</button>';
    }).join('');
  document.getElementById('wx').querySelectorAll('[data-w]').forEach(function (b) {
    b.addEventListener('click', function () {
      var on = b.getAttribute('aria-pressed') === 'true';
      b.setAttribute('aria-pressed', String(!on));
      var now = [];
      document.getElementById('wx').querySelectorAll('[data-w]').forEach(function (x) {
        if (x.getAttribute('aria-pressed') === 'true') now.push(x.dataset.w);
      });
      D.weather = now.join(', ');
      dirty();
    });
  });
}

function render() {
  ROSTER = D.roster || { trades: [], plant: [], materials: [], positions: [], subcontractors: [] };
  var dl = document.getElementById('matlist');
  var sl = document.getElementById('sublist');
  if (sl) sl.innerHTML = (ROSTER.subcontractors || []).map(function (n) {
    return '<option value="' + esc(n) + '">'; }).join('');
  if (dl) dl.innerHTML = (ROSTER.materials || []).map(function (m) {
    return '<option value="' + esc(m.m) + '">' + esc(m.u || '') + '</option>'; }).join('');
  var byTrade = {};
  ROSTER.trades.forEach(function (r) { byTrade[r.t] = r; });
  (D.staff || []).forEach(function (r) { r.indirect = !!(byTrade[r.t] && byTrade[r.t].indirect); });

  numRows('staff', D.staff || []);
  numRows('plant', D.plant || []);
  renderWeather();
  ['works', 'tomorrow', 'materials', 'subs'].forEach(lineRows);
  document.getElementById('remarks').value = D.remarks || '';
  document.getElementById('visitors').value = D.visitors || '';
  document.getElementById('prepared').value = D.prepared_by || '';
  recount();

  var st = document.getElementById('state');
  if (D.exists) {
    st.className = 'state';
    st.innerHTML = D.status === 'submitted'
      ? '<b>Submitted</b> · saved ' + fmt(D.updated_at)
      : '<b>Saved as a draft</b>';
  } else if (D.carried_from) {
    st.className = 'state carried';
    st.innerHTML = 'New — filled in from <b>' + fmt(D.carried_from) + '</b>. Check it before saving.';
  } else {
    st.className = 'state';
    st.textContent = 'New — nothing to carry forward.';
  }
  var d = document.getElementById('day').value;
  document.getElementById('btnPdf').href = '/diary/doc?date=' + d;
  document.getElementById('btnPdf2').href = '/diary/doc?date=' + d;
  document.getElementById('btnDocx').href = '/diary/docx?date=' + d;
  DIRTY = false;
  document.getElementById('msg').textContent = '';
}

async function load() {
  var d = document.getElementById('day').value;
  if (!d) return;
  try {
    D = await api('/api/diary?date=' + d);
    if (D.missing) { toast('The diary is not set up yet — run upgrade-diary.sh', true); return; }
    render();
    renderChecks(D.checks);
    loadHistory();
    loadStrip();
  } catch (e) { toast(e.message, true); }
}

async function loadHistory() {
  try {
    var j = await api('/api/diary/list');
    var rows = j.diaries || [];
    document.getElementById('histR').textContent = rows.length ? rows.length + ' kept' : '';
    document.getElementById('hist').innerHTML = rows.length ? rows.map(function (r) {
      return '<tr data-d="' + r.report_date + '"><td><b>' + fmt(r.report_date) + '</b></td>' +
        '<td>' + esc(r.weather || '—') + '</td><td>' + r.men + '</td><td>' + r.subs + '</td>' +
        '<td>' + r.works + '</td><td>' + esc(r.prepared_by || '') + '</td>' +
        '<td><span class="pill ' + esc(r.status) + '">' + esc(r.status) + '</span></td></tr>';
    }).join('') : '<tr><td colspan="7"><div class="empty">No diaries kept yet. The first one you save starts the record.</div></td></tr>';
    document.getElementById('hist').querySelectorAll('tr[data-d]').forEach(function (tr) {
      tr.addEventListener('click', function () {
        document.getElementById('day').value = tr.dataset.d; load();
        window.scrollTo(0, 0);
      });
    });
  } catch (e) {}
}

// Step 3: what stops this diary being submitted, and what to look at first.
function renderChecks(c) {
  var box = document.getElementById('checks');
  if (!c) { box.innerHTML = ''; return; }
  if (!c.blockers.length && !c.warnings.length) {
    box.innerHTML = '<div class="checks"><b style="color:var(--good-text)">Ready to submit</b>Everything the diary needs is filled in.</div>';
    return;
  }
  box.innerHTML = '<div class="checks">' +
    (c.blockers.length ? '<b class="blk">Needed before it can be submitted</b><ul class="blk">' +
      c.blockers.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
    (c.warnings.length ? '<b class="wrn">Check</b><ul class="wrn">' +
      c.warnings.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
}
// The last 14 days at a glance — red is a working day with no diary at all.
async function loadStrip() {
  try {
    var j = await api('/api/diary/status?days=14');
    var cur = document.getElementById('day').value;
    var label = { submitted: 'Submitted', draft: 'Draft — not submitted', missing: 'No diary', off: 'Day off', today: 'Today' };
    document.getElementById('strip').innerHTML = '<span style="color:var(--muted);margin-right:6px">Last 14 days' +
      (j.missing ? ' · <b style="color:var(--critical)">' + j.missing + ' missing</b>' : '') +
      (j.draft ? ' · <b style="color:#92600c">' + j.draft + ' not submitted</b>' : '') + '</span>' +
      j.days.map(function (x) {
        return '<div class="d ' + x.status + (x.date === cur ? ' sel' : '') + '" data-d="' + x.date + '" title="' + esc(x.date + ' — ' + label[x.status]) + '">' +
          '<small>' + x.day + '</small>' + Number(x.date.slice(8)) + '</div>';
      }).join('');
    document.getElementById('strip').querySelectorAll('[data-d]').forEach(function (el) {
      el.addEventListener('click', function () { document.getElementById('day').value = el.dataset.d; load(); });
    });
  } catch (e) {}
}
// Lines for "Description of works" from what site reported today.
async function pullProgress() {
  try {
    var j = await api('/api/diary/progress?date=' + document.getElementById('day').value);
    var have = {};
    (D.works || []).forEach(function (w) { have[String(w.a || '').toLowerCase()] = 1; });
    var added = 0;
    (j.progress || []).forEach(function (a) {
      var line = a.name + ' — ' + a.pct + '%' + (a.pct >= 100 ? ' (completed)' : '');
      if (have[line.toLowerCase()]) return;
      (D.works || (D.works = [])).push({ a: line, q: '' }); added++;
    });
    if (!added) { toast((j.progress || []).length ? 'Those are already in the list.' : 'Site has not reported progress on this day.'); return; }
    lineRows('works'); dirty(); toast(added + ' line' + (added === 1 ? '' : 's') + ' added — enter the men against each, then save.');
  } catch (e) { toast(e.message, true); }
}

async function save(submit) {
  var btn = document.getElementById(submit ? 'submit' : 'save');
  btn.disabled = true;
  D.remarks = document.getElementById('remarks').value;
  D.visitors = document.getElementById('visitors').value;
  D.prepared_by = document.getElementById('prepared').value;
  try {
    await api('/api/diary', {
      report_date: document.getElementById('day').value,
      weather: D.weather, staff: D.staff, plant: D.plant, materials: D.materials,
      works: D.works, tomorrow: D.tomorrow, subs: D.subs,
      remarks: D.remarks, visitors: D.visitors, prepared_by: D.prepared_by,
      submit: !!submit,
    });
    toast(submit ? 'Marked submitted' : 'Saved');
    await load();
  } catch (e) { toast(e.message, true); await load(); }
  btn.disabled = false;
}

/* ---------------------------------------------------------------- wiring */

(function seed() {
  document.getElementById('day').value = isoDay(new Date());
})();
document.getElementById('day').addEventListener('change', load);
document.getElementById('prev').addEventListener('click', function () { step(-1); });
document.getElementById('next').addEventListener('click', function () { step(1); });
function step(n) {
  var d = new Date(document.getElementById('day').value + 'T00:00:00');
  d.setDate(d.getDate() + n);
  document.getElementById('day').value = isoDay(d);
  load();
}
document.querySelectorAll('[data-add]').forEach(function (b) {
  b.addEventListener('click', function () {
    (D[b.dataset.add] || (D[b.dataset.add] = [])).push({});
    lineRows(b.dataset.add); dirty();
  });
});
['remarks', 'visitors', 'prepared'].forEach(function (id) {
  document.getElementById(id).addEventListener('input', dirty);
});
document.getElementById('save').addEventListener('click', function () { save(false); });
document.getElementById('pullProgress').addEventListener('click', pullProgress);
var sb = document.getElementById('submit');
if (sb) sb.addEventListener('click', function () { save(true); });

// Generating the sheet from a diary you have not saved would print yesterday's
// numbers, so save first and then open it.
['btnPdf', 'btnPdf2', 'btnDocx'].forEach(function (id) {
  document.getElementById(id).addEventListener('click', async function (e) {
    if (!DIRTY) return;
    e.preventDefault();
    await save(false);
    window.open(this.href, id === 'btnDocx' ? '_self' : '_blank');
  });
});
window.addEventListener('beforeunload', function (e) {
  if (DIRTY) { e.preventDefault(); e.returnValue = ''; }
});

mountSwitcher('proj');
load();
${PWA_BOOT}
</script>
</body></html>`;

// The sheet on its own page, sized for A4 and ready to print.
export const diarySheetHTML = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title.replace(/[<>&"]/g, '')}</title>
${HEAD_LINKS}
<style>
body { margin: 0; background: #eef1f6; color: #111827; }
.tools { max-width: 1000px; margin: 14px auto 0; display: flex; gap: 8px; padding: 0 14px; flex-wrap: wrap; }
.tools button, .tools a {
  font: 600 13px/1 Arial, Helvetica, sans-serif; padding: 9px 14px; border-radius: 8px;
  border: 1px solid #cbd5e4; background: #fff; color: #111827; cursor: pointer; text-decoration: none;
}
.tools .go { background: #2a78d6; border-color: #2a78d6; color: #fff; }
.sheet { background: #fff; width: 1000px; max-width: calc(100% - 24px); margin: 14px auto;
         padding: 14px 16px; box-shadow: 0 2px 14px rgba(16,24,40,.12); }
.sheet + .sheet { margin-top: 18px; }
@media print {
  @page { size: A4 landscape; margin: 8mm; }
  body { background: #fff; }
  .tools { display: none !important; }
  .sheet { width: auto; max-width: none; margin: 0; padding: 0; box-shadow: none; }
  .sheet + .sheet { page-break-before: always; }
  table { page-break-inside: avoid; }
}
@media (max-width: 1040px) { .sheet { overflow-x: auto; } .sheet-in { min-width: 960px; } }
</style>
</head>
<body>
<div class="tools">
  <button class="go" onclick="window.print()">Print / save as PDF</button>
  <a href="#" id="dx">Download Word</a>
  <a href="/diary">Back to the diary</a>
</div>
${body}
<script>
var d = new URLSearchParams(location.search).get('date') || '';
document.getElementById('dx').href = '/diary/docx?date=' + d;
</script>
</body></html>`;
