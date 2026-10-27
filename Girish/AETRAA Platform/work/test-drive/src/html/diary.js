import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK, SWITCHER_CSS, SWITCHER_JS } from './shared.js';
import { DIARY_DOCS_JS } from './diary-docs.js';

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
.bar input[type="date"] { font: inherit; font-size: var(--fs-secondary); padding: 6px 9px; border-radius: 8px;
  width: auto; flex: 0 0 auto; min-width: 148px;
  border: 1px solid var(--border); background: var(--surface-2); color: var(--ink); }
.state { font-size: var(--fs-secondary); color: var(--muted); }
.state b { color: var(--ink); }
.state.carried { color: var(--serious-text); }

/* Columns rather than a grid: the labour list is far taller than the rest, and a
   grid would leave half the page empty beside it. */
.cards { columns: 1; column-gap: 14px; }
@media (min-width: 900px) { .cards { columns: 2; } }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
        padding: 14px 16px; margin-bottom: 14px; break-inside: avoid; page-break-inside: avoid; }
.card h2 { font-size: var(--fs-secondary); text-transform: uppercase; letter-spacing: .05em; color: var(--muted);
           margin-bottom: 10px; display: flex; align-items: baseline; gap: 8px; }
.card h2 .r { margin-left: auto; font-size: var(--fs-secondary); text-transform: none; letter-spacing: 0; color: var(--ink-2); }


/* the trade / plant grid — number box big enough for a thumb */
.rows { display: grid; gap: 4px; }
.row {
  display: grid; grid-template-columns: 1fr 64px 52px; gap: 6px; align-items: center;
  padding: 3px 0; border-bottom: 1px solid var(--grid);
}
.row:last-child { border-bottom: 0; }
.row .nm { font-size: var(--fs-secondary); line-height: 1.3; }
.row .nm small { display: block; color: var(--muted); font-size: var(--fs-secondary); }
.row input { font: inherit; font-size: var(--fs-body); text-align: center; padding: 7px 4px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--surface-2); color: var(--ink); width: 100%; }
.row input.has { border-color: var(--series-1); font-weight: 500; }
.row .hd { font-size: var(--fs-label); color: var(--muted); text-align: center; text-transform: uppercase; letter-spacing: .04em; }
.rowhead { display: grid; grid-template-columns: 1fr 64px 52px; gap: 6px; margin-bottom: 2px; }

.tot { display: flex; gap: 14px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--grid); }
.tot div { flex: 1; }
.tot b { display: block; font-size: var(--fs-title); font-weight: 500; font-variant-numeric: tabular-nums; }
.tot span { font-size: var(--fs-secondary); color: var(--muted); }

.wx { display: flex; flex-wrap: wrap; gap: 7px; }
.wx button { appearance: none; font: inherit; font-size: var(--fs-secondary); cursor: pointer; padding: 8px 14px;
  border-radius: 999px; border: 1px solid var(--border); background: var(--surface-2); color: var(--ink-2); }
.wx button[aria-pressed="true"] { background: var(--series-1); border-color: var(--series-1); color: var(--on-accent); font-weight: 500; }
/* K13 (A12): who prepares the diary, and the AI's draft */
.a12 { font-size: var(--fs-secondary); }
.a12 select { font: inherit; font-size: var(--fs-secondary); padding: 5px 8px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-2); color: var(--ink); }
.a12 select { width: auto; max-width: 100%; }
@media (max-width: 600px) { .a12 span[style*="nowrap"] { white-space: normal !important; display: inline-flex; flex-wrap: wrap; gap: 6px; align-items: center; max-width: 100%; } }
.a12 details { margin-top: 10px; }
.a12 summary { cursor: pointer; font-weight: 500; }
.a12 ul { margin: 6px 0 0 18px; }

.lines { display: grid; gap: 6px; }
.line { display: grid; gap: 6px; align-items: center; }
.line.work { grid-template-columns: 1fr 60px 32px; }
.line.mat  { grid-template-columns: 1fr 70px 70px 32px; }
.line.sub  { grid-template-columns: minmax(120px,1.4fr) minmax(110px,1.2fr) minmax(100px,1fr) 58px 52px 32px; }
.line select { font: inherit; font-size: var(--fs-secondary); padding: 8px 6px; border-radius: 8px;
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
.line input, .line textarea { font: inherit; font-size: var(--fs-secondary); padding: 8px 9px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--surface-2); color: var(--ink); width: 100%; }
.line textarea { min-height: 38px; resize: vertical; }
.line .rm { background: none; border: 1px solid var(--border); border-radius: 8px; height: 36px;
            color: var(--critical); cursor: pointer; font-size: var(--fs-body); }
.linehead { display: grid; gap: 6px; font-size: var(--fs-label); color: var(--muted);
            text-transform: uppercase; letter-spacing: .04em; margin-bottom: 2px; }
.add { margin-top: 8px; }
textarea.big { font: inherit; font-size: var(--fs-secondary); width: 100%; min-height: 64px; padding: 8px 9px;
  border-radius: 8px; border: 1px solid var(--border); background: var(--surface-2); color: var(--ink); resize: vertical; }

.foot { position: fixed; left: 0; right: 0; bottom: 0; background: var(--surface);
        border-top: 1px solid var(--border); padding: 10px 16px; z-index: 30;
        display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.foot .msg { font-size: var(--fs-secondary); color: var(--ink-2); flex: 1 1 auto; min-width: 120px; }
.hist { width: 100%; border-collapse: collapse; font-size: var(--fs-secondary); }
.hist th { text-align: left; font-size: var(--fs-label); text-transform: uppercase; letter-spacing: .05em;
           color: var(--muted); font-weight: 500; padding: 7px 8px; border-bottom: 1px solid var(--border); }
.hist td { padding: 8px; border-bottom: 1px solid var(--grid); }
.hist tbody tr { cursor: pointer; }
.hist tbody tr:hover { background: var(--surface-2); }
.pill { display: inline-block; font-size: var(--fs-secondary); font-weight: 500; padding: 2px 8px; border-radius: 20px;
        background: var(--surface-2); color: var(--ink-2); }
.pill.submitted { background: var(--good-bg); color: var(--good-text); }
.checks { border-radius: 12px; padding: 12px 16px; margin: 0 0 14px; font-size: var(--fs-secondary); line-height: 1.5; border: 1px solid var(--border); background: var(--surface); }
.checks b { display: block; font-size: var(--fs-label); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
.checks ul { margin: 0 0 6px; padding-left: 18px; }
.checks .blk { color: var(--critical); }
.checks .wrn { color: var(--warn-ink); }
[data-theme="dark"] .checks .wrn { color: var(--warn-ink); }
.strip { display: flex; gap: 4px; flex-wrap: wrap; margin: 0 0 14px; align-items: center; font-size: var(--fs-secondary); }
.strip .d { width: 46px; text-align: center; border-radius: 8px; padding: 5px 0; cursor: pointer; border: 1px solid var(--border); background: var(--surface); line-height: 1.25; }
.strip .d small { display: block; color: var(--muted); font-size: var(--fs-secondary); }
.strip .submitted { background: var(--good-bg); color: var(--good-text); border-color: transparent; }
.strip .draft { background: color-mix(in srgb, var(--warn-ink) 15%, transparent); color: var(--warn-ink); border-color: transparent; }
.strip .missing { background: color-mix(in srgb, var(--critical) 16%, transparent); color: var(--critical); border-color: transparent; font-weight: 500; }
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
  <a class="btn" href="/timesheets" title="Read subcontractors’ timesheets into the manpower (E15)">Timesheets</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  <div class="bar">
    <label for="day" style="font-size:var(--fs-secondary);color:var(--muted);font-weight:500">Diary for</label>
    <input type="date" id="day">
    <button class="btn" id="prev" title="Previous day">‹</button>
    <button class="btn" id="next" title="Next day">›</button>
    <span class="state" id="state"></span>
    <span class="state" id="kept" hidden></span>
    <div class="spacer"></div>
    <a class="btn" id="btnPdf" href="#" target="_blank">Open / print</a>
    <a class="btn" id="btnDocx" href="#">Word</a>
  </div>
  <div class="strip" id="strip"></div>
  <div id="checks"></div>
  <div id="a12"></div>

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
      <h2>Expected works tomorrow <span class="r">becomes tomorrow's list</span></h2>
      <div class="linehead" style="grid-template-columns:1fr 60px 32px"><span>Activity</span><span>Qty</span><span></span></div>
      <div class="lines" id="tomorrow"></div>
      <button class="btn add" data-add="tomorrow">Add a line</button>
    </div>

    <div class="card" id="photoCard" hidden>
      <h2>Photos <span class="r" id="photoR"></span></h2>
      <div id="photoList"></div>
      <button class="btn add" id="photoAi" hidden>Suggest captions with AI</button>
      <span class="r" id="photoSay"></span>
    </div>

    <div class="card">
      <h2>Delivery of materials</h2>
      <div class="linehead" style="grid-template-columns:1fr 70px 70px 32px"><span>Material</span><span>Qty</span><span>Unit</span><span></span></div>
      <div class="lines" id="materials"></div>
      <datalist id="matlist"></datalist>
      <button class="btn add" data-add="materials">Add a delivery</button>
    </div>

    <div class="card" id="docsCard">
      <h2>Delivery notes and certificates <span class="r">read, then confirmed by you</span></h2>
      <p class="hint" style="margin:-4px 0 10px">Upload the day’s delivery notes and certificates (PDF or a photo). What they state is read; nothing is received or filed until you confirm it here. A delivery note’s lines go into Delivery of materials; a certificate goes into the certificates register.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <select id="docKind"><option value="delivery">Delivery note</option><option value="certificate">Certificate</option></select>
        <label class="btn">Upload<input type="file" id="docFile" accept=".pdf,.docx,.png,.jpg,.jpeg" hidden></label>
        <span class="hint" id="docSay"></span>
      </div>
      <div id="docDraft"></div>
      <div id="docList"></div>
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
      <h2>Remarks, problems, visitors and who prepared it</h2>
      <div style="display:grid;gap:10px;grid-template-columns:1fr">
        <div><label style="font-size:var(--fs-secondary);color:var(--muted);font-weight:500">Remarks — instructions, stoppages, anything worth a record</label>
          <textarea class="big" id="remarks" placeholder="e.g. Concrete pour held 2 hrs — consultant inspection late"></textarea></div>
        <div><label style="font-size:var(--fs-secondary);color:var(--muted);font-weight:500">Problems — anything that held the work up or needs the office</label>
          <textarea class="big" id="problems" style="min-height:44px" placeholder="e.g. Concrete pump broke down 10:00–12:00"></textarea></div>
        <div><label style="font-size:var(--fs-secondary);color:var(--muted);font-weight:500">Visitors</label>
          <textarea class="big" id="visitors" style="min-height:44px" placeholder="e.g. Municipality inspection 11:00"></textarea></div>
        <div><label style="font-size:var(--fs-secondary);color:var(--muted);font-weight:500">Prepared by</label>
          <input class="big" id="prepared" style="min-height:0" placeholder="Name — job title"></div>
      </div>
    </div>

    <div class="card">
      <h2>Diaries kept <span class="r" id="histR"></span></h2>
      <div style="overflow-x:auto">
        <table class="hist"><thead><tr>
          <th>Date</th><th>Weather</th><th>On site</th><th>Sub-con</th><th>Prepared by</th><th>Status</th>
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

/* THE DAY'S PHOTOS (v5 A12; Ajay, 6 Oct 2026, decision 2). The AI proposes a
   caption, the activity and the location; nothing is on the photo until the
   person writing the diary confirms or corrects it. */
var PH = null;
async function loadPhotos(day) {
  var card = document.getElementById('photoCard');
  try { PH = await api('/api/diary/photos?date=' + day); } catch (e) { card.hidden = true; return; }
  var ps = PH.photos || [];
  card.hidden = !ps.length;
  if (!ps.length) return;
  var waiting = ps.filter(function (p) { return !p.ai_state || p.ai_state === 'rejected'; }).length;
  document.getElementById('photoR').textContent = ps.length + ' photo' + (ps.length === 1 ? '' : 's') + ' · ' + ps.filter(function (p) { return p.ai_state === 'confirmed'; }).length + ' confirmed';
  var ai = document.getElementById('photoAi');
  ai.hidden = !(PH.ai_on && PH.may.confirm && waiting);
  var acts = PH.activities || [];
  document.getElementById('photoList').innerHTML = ps.map(function (p) {
    var prop = p.ai_state === 'proposed';
    var cap = prop ? (p.ai_caption || p.caption || '') : (p.caption || '');
    var act = prop ? (p.ai_activity_id || p.activity_id || '') : (p.activity_id || '');
    var loc = prop ? (p.ai_location || p.location || '') : (p.location || '');
    var opts = '<option value="">— no activity —</option>' + acts.map(function (a) { return '<option value="' + esc(a.id) + '"' + (a.id === act ? ' selected' : '') + '>' + esc(a.id + ' · ' + a.name) + '</option>'; }).join('')
      + (act && !acts.some(function (a) { return a.id === act; }) ? '<option value="' + esc(act) + '" selected>' + esc(act) + '</option>' : '');
    var state = p.ai_state === 'confirmed' ? 'confirmed by ' + esc(p.confirmed_by || '') : prop ? 'proposed by AI (' + esc(p.ai_sure || 'low') + ') — check it' : p.ai_state === 'rejected' ? 'the AI’s suggestion was set aside' : 'not captioned yet';
    var edit = PH.may.confirm && p.ai_state !== 'confirmed';
    return '<div class="photo" data-ph="' + esc(p.id) + '" style="display:grid;grid-template-columns:120px 1fr;gap:10px;margin:8px 0;align-items:start">'
      + '<a href="/photo/' + esc(p.id) + '" target="_blank"><img src="/photo/' + esc(p.id) + '" style="width:120px;border-radius:6px;border:1px solid var(--border)"></a><div>'
      + (edit ? '<input data-pf="caption" value="' + esc(cap) + '" placeholder="caption" style="width:100%"><div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">'
          + '<select data-pf="activity_id">' + opts + '</select><input data-pf="location" value="' + esc(loc) + '" placeholder="location (level, zone, grid)">'
          + '<button class="btn" data-pact="ok">Confirm</button>' + (prop ? '<button class="btn" data-pact="no">Not right</button>' : '') + '</div>'
        : '<div>' + esc(p.caption || '') + '</div><div class="r">' + esc(p.activity_name || '') + (p.location ? ' · ' + esc(p.location) : '') + '</div>')
      + '<div class="r">' + state + '</div></div></div>';
  }).join('');
  document.querySelectorAll('[data-pact]').forEach(function (b) {
    b.addEventListener('click', async function () {
      var box = b.closest('[data-ph]'), v = function (f) { var x = box.querySelector('[data-pf="' + f + '"]'); return x ? x.value : ''; };
      try {
        await api('/api/diary/photos/confirm', b.dataset.pact === 'no' ? { id: box.dataset.ph, reject: true }
          : { id: box.dataset.ph, caption: v('caption'), activity_id: v('activity_id'), location: v('location') });
        toast(b.dataset.pact === 'no' ? 'Set aside — caption it yourself' : 'Confirmed');
      } catch (e) { toast(e.message, true); }
      loadPhotos(day);
    });
  });
  ai.onclick = async function () {
    ai.disabled = true; document.getElementById('photoSay').textContent = 'Reading the photos…';
    try {
      var left = 1, guard = 0;
      while (left > 0 && guard++ < 10) { var r = await api('/api/diary/photos/suggest', { date: day }); left = r.remaining; if (!r.read) break; }
      document.getElementById('photoSay').textContent = 'Suggested — check each one and confirm.';
    } catch (e) { document.getElementById('photoSay').textContent = e.message; }
    ai.disabled = false; loadPhotos(day);
  };
}

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
      '<button class="rm" type="button" title="Remove">×</button>' +
      // K11 (v5 A5): a delivery confirmed from its delivery note says where it came from.
      (key === 'materials' && (r.s || r.dn || r.b) ? '<div class="hint" style="grid-column:1/-1;margin:-2px 0 4px">' +
        esc([r.s, r.dn ? 'DN ' + r.dn : '', r.b ? 'batch ' + r.b : ''].filter(Boolean).join(' · ')) + (r.src ? ' · from the delivery note' : '') + '</div>' : '') +
      '</div>';
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
  // No works section (v5 A12; Ajay, 6 Oct 2026, decision 12). A diary's old
  // works lines are kept in the record, not shown.
  ['tomorrow', 'materials', 'subs'].forEach(lineRows);
  document.getElementById('remarks').value = D.remarks || '';
  document.getElementById('visitors').value = D.visitors || '';
  document.getElementById('problems').value = D.problems || '';
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
  paintKept(d);
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
    renderA12(D.a12);
    loadHistory();
    loadStrip();
    loadPhotos(d);
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
        '<td>' + esc(r.prepared_by || '') + '</td>' +
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

/* K13 (v5 A12): who prepares the diary (Document Control, or the person the
   PM assigns), and the AI's draft from typed notes or a scanned site sheet.
   The draft fills this screen only; nothing is saved until Save, and only
   the PM submits. */
var A12FILE = null;
function renderA12(a) {
  var box = document.getElementById('a12');
  if (!a) { box.innerHTML = ''; return; }
  // Only Document Control and the assigned person save; the PM submits.
  var sv = document.getElementById('save'), sb = document.getElementById('submit');
  if (sv && a.may_save === false) sv.hidden = true;
  if (sb && a.may_submit === false) sb.hidden = true;
  var names = (a.preparers || []).map(function (u) { return esc(u.name); }).join(', ');
  var line = a.assigned
    ? 'The site diary is prepared by <b>' + names + '</b>, assigned by the Project Manager.'
    : 'The site diary is prepared by Document Control' + (names ? ' (<b>' + names + '</b>)' : '') + '.';
  var current = a.assigned && a.preparers[0] ? a.preparers[0].id : '';
  var pick = a.may_assign ? ' <span style="white-space:nowrap">Assign: <select id="a12who"><option value="">Document Control</option>' +
    (a.team || []).map(function (u) {
      return '<option value="' + esc(u.id) + '"' + (u.id === current ? ' selected' : '') + '>' + esc(u.name) + '</option>';
    }).join('') + '</select> <button class="btn" id="a12set">Assign</button></span>' : '';
  var ai = a.ai_on
    ? '<details id="a12box"><summary>Prepare the diary with AI — from typed notes or a scanned site sheet</summary>' +
      '<textarea class="big" id="a12notes" style="margin-top:8px" placeholder="e.g. Sunny. 12 masons, 6 steel fixers 10 hrs. Mobile crane. 20 m3 C32 from the supplier. Visitor: consultant RE at 10:00. Problem: pump broke down 2 hrs. Tomorrow: L4 slab pour."></textarea>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">' +
      '<label class="btn">Add the scanned site sheet<input type="file" id="a12file" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg" hidden></label>' +
      '<span class="hint" id="a12fname"></span><button class="btn btn-primary" id="a12go">Prepare the diary</button></div>' +
      '<p class="hint">The AI fills the diary on this screen for you to check. Nothing is saved until you save, and only the Project Manager submits it.</p>' +
      '<div id="a12out"></div></details>'
    : '';
  // v5 A12 step 3: DC sends the submitted diary where the contract requires it.
  var s = a.send || {};
  var send = (s.may_set || s.may_send || (s.to || []).length)
    ? '<div style="margin-top:8px">' + (s.basis ? 'The contract asks for daily records: <b>' + esc(s.basis.clause) + '</b> — “' + esc(s.basis.quote) + '”. ' : '') +
      'Sent to: ' + (s.may_set ? '<input id="sendTo" style="width:260px" value="' + esc((s.to || []).join(', ')) + '" placeholder="the Engineer’s email"> <button class="btn" id="sendToSet">Set</button>' : esc((s.to || []).join(', ') || 'nobody yet')) +
      (s.may_send && D.status === 'submitted' && (s.to || []).length ? ' <button class="btn btn-primary" id="sendDiary">Send this day’s diary</button>' : '') +
      ((s.log || []).length ? '<div class="hint">' + s.log.map(function (x) { return 'Sent ' + esc(String(x.at).slice(0, 16).replace('T', ' ')) + ' by ' + esc(x.by) + ' to ' + esc((x.to || []).join(', ')); }).join('<br>') + '</div>' : '') + '</div>'
    : '';
  box.innerHTML = '<div class="card a12">' + line + pick + ai + send + '</div>';
  var st = document.getElementById('sendToSet');
  if (st) st.addEventListener('click', async function () {
    try { await api('/api/diary/send-to', { to: document.getElementById('sendTo').value }); toast('Saved'); var k = await api('/api/diary?date=' + document.getElementById('day').value); D.a12 = k.a12; renderA12(D.a12); }
    catch (e) { toast(e.message, true); }
  });
  var sd = document.getElementById('sendDiary');
  if (sd) sd.addEventListener('click', async function () {
    if (!confirm('Email this day’s diary (Word) to ' + (s.to || []).join(', ') + '?')) return;
    sd.disabled = true;
    try { var j = await api('/api/diary/send', { date: document.getElementById('day').value }); toast('Sent to ' + j.to.join(', ')); var k = await api('/api/diary?date=' + document.getElementById('day').value); D.a12 = k.a12; renderA12(D.a12); }
    catch (e) { toast(e.message, true); sd.disabled = false; }
  });
  var set = document.getElementById('a12set');
  if (set) set.addEventListener('click', async function () {
    set.disabled = true;
    try {
      var j = await api('/api/diary/assignee', { user_id: document.getElementById('a12who').value });
      toast(j.assignee ? j.assignee.name + ' now prepares the site diary' : 'Document Control prepares the site diary');
      var k = await api('/api/diary?date=' + document.getElementById('day').value);
      D.a12 = k.a12; renderA12(D.a12);
    } catch (e) { toast(e.message, true); set.disabled = false; }
  });
  var fileIn = document.getElementById('a12file');
  if (fileIn) fileIn.addEventListener('change', function () {
    var fl = fileIn.files && fileIn.files[0];
    A12FILE = null; document.getElementById('a12fname').textContent = '';
    if (!fl) return;
    var rd = new FileReader();
    rd.onload = function () {
      A12FILE = { filename: fl.name, data: String(rd.result).split(',')[1] || '' };
      document.getElementById('a12fname').textContent = fl.name;
    };
    rd.readAsDataURL(fl);
  });
  var go = document.getElementById('a12go');
  if (go) go.addEventListener('click', a12Prepare);
}
async function a12Prepare() {
  var go = document.getElementById('a12go');
  var notes = document.getElementById('a12notes').value;
  if (!notes.trim() && !A12FILE) { toast('Type the day’s notes, or add the scanned site sheet.', true); return; }
  if (DIRTY && !window.confirm('This diary has changes that are not saved. The AI’s draft is laid over the diary as last saved, so those changes would be lost. Go on?')) return;
  go.disabled = true; go.textContent = 'Preparing…';
  try {
    var body = { date: document.getElementById('day').value, notes: notes };
    if (A12FILE) body.file = A12FILE;
    var j = await api('/api/diary/ai-draft', body);
    var keep = { a12: D.a12, checks: D.checks, exists: D.exists, status: D.status, updated_at: D.updated_at, carried_from: D.carried_from };
    D = j.diary;
    Object.keys(keep).forEach(function (k) { D[k] = keep[k]; });
    render();
    dirty();
    document.getElementById('a12out').innerHTML = '<p style="margin-top:8px"><b>Prepared from ' + esc(j.from) + ' by ' + esc(j.model) + '.</b> Check every line, then save.</p>' +
      ((j.notes || []).length ? '<b class="wrn">Check</b><ul>' + j.notes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '');
    toast('Prepared — check it, then save. Nothing is saved yet.');
  } catch (e) { toast(e.message, true); }
  go.disabled = false; go.textContent = 'Prepare the diary';
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
      (j.draft ? ' · <b style="color:var(--warn-ink)">' + j.draft + ' not submitted</b>' : '') + '</span>' +
      j.days.map(function (x) {
        return '<div class="d ' + x.status + (x.date === cur ? ' sel' : '') + '" data-d="' + x.date + '" title="' + esc(x.date + ' — ' + label[x.status]) + '">' +
          '<small>' + x.day + '</small>' + Number(x.date.slice(8)) + '</div>';
      }).join('');
    document.getElementById('strip').querySelectorAll('[data-d]').forEach(function (el) {
      el.addEventListener('click', function () { document.getElementById('day').value = el.dataset.d; load(); });
    });
  } catch (e) {}
}

async function save(submit) {
  var btn = document.getElementById(submit ? 'submit' : 'save');
  // CHANGING A SUBMITTED DIARY IS A CORRECTION, AND IT SAYS WHY. The version
  // as submitted is kept by the server whatever happens; the reason is what
  // makes the correction readable a year later, beside the original.
  var reason = '';
  if (D.exists && D.status === 'submitted') {
    reason = window.prompt('This diary has already been submitted. The version as submitted will be kept '
      + 'beside your correction.\\n\\nWhy is it being changed?', '');
    if (reason === null) return;                      // cancelled: nothing saved
    reason = String(reason).trim();
    if (!reason) { toast('Say why a submitted diary is being changed \u2014 nothing was saved.', true); return; }
  }
  btn.disabled = true;
  D.remarks = document.getElementById('remarks').value;
  D.visitors = document.getElementById('visitors').value;
  D.problems = document.getElementById('problems').value;
  D.prepared_by = document.getElementById('prepared').value;
  try {
    await api('/api/diary', {
      report_date: document.getElementById('day').value,
      weather: D.weather, staff: D.staff, plant: D.plant, materials: D.materials,
      works: D.works, tomorrow: D.tomorrow, subs: D.subs,
      remarks: D.remarks, visitors: D.visitors, problems: D.problems, prepared_by: D.prepared_by,
      submit: !!submit, reason: reason || undefined,
    });
    toast(submit ? 'Marked submitted' : reason ? 'Corrected \u2014 the submitted version is kept' : 'Saved');
    await load();
  } catch (e) { toast(e.message, true); await load(); }
  btn.disabled = false;
}

/* THE VERSIONS THAT WERE KEPT. A diary changed after it was submitted says
   so on its face, with each earlier version one click away exactly as it was. */
async function paintKept(day){
  var k = document.getElementById('kept');
  k.hidden = true; k.innerHTML = '';
  try {
    var j = await api('/api/diary/versions?date=' + encodeURIComponent(day));
    var v = j.versions || [];
    if (!v.length || document.getElementById('day').value !== day) return;
    k.hidden = false;
    k.className = 'state carried';
    k.innerHTML = '<b>Changed after submission</b> \u2014 '
      + v.map(function(x){
          return '<a href="/diary/docx?date=' + encodeURIComponent(day) + '&v=' + x.version + '" title="'
            + esc((x.kept_by || '') + (x.reason ? ': ' + x.reason : '')) + '">version ' + x.version
            + (x.version === 1 ? ' as submitted' : '') + '</a>';
        }).join(' \u00b7 ')
      + ' kept';
  } catch (e) { /* the diary still works without its history panel */ }
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
['remarks', 'visitors', 'problems', 'prepared'].forEach(function (id) {
  document.getElementById(id).addEventListener('input', dirty);
});
document.getElementById('save').addEventListener('click', function () { save(false); });
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
<script>${DIARY_DOCS_JS}</script>
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
body { margin: 0; background: var(--surface-2); color: var(--text); }
.tools { max-width: 1000px; margin: 14px auto 0; display: flex; gap: 8px; padding: 0 14px; flex-wrap: wrap; }
.tools button, .tools a {
  font-family: var(--font); font-size: var(--fs-secondary); line-height: 1; font-weight: 500; padding: 9px 14px; border-radius: 8px;
  border: 1px solid var(--line-strong); background: var(--surface); color: var(--text); cursor: pointer; text-decoration: none;
}
.tools .go { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.sheet { background: var(--surface); width: 1000px; max-width: calc(100% - 24px); margin: 14px auto;
         padding: 14px 16px; box-shadow: none; }
.sheet + .sheet { margin-top: 18px; }
@media print {
  @page { size: A4 landscape; margin: 8mm; }
  body { background: var(--surface); }
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
