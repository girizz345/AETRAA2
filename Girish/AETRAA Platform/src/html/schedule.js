import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK, SWITCHER_CSS, SWITCHER_JS } from './shared.js';

// When the job now finishes, and what is holding it.
//
// One number on this page matters and the rest is supporting evidence: the gap
// between the date the contract says and the date the logic says. Everything
// else — the driving path, the what-if — exists to answer the two questions
// that follow it, which are "why" and "what would it take".

export const scheduleHTML = (role) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Programme · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1100px; }
.tiles { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-bottom: 14px; }
.tile { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; }
.tile b { display: block; font-size: 21px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.25;
          font-variant-numeric: tabular-nums; }
.tile span { font-size: 11.5px; color: var(--muted); display: block; margin-top: 3px; }
.tile .sub { font-size: 11px; color: var(--muted); margin-top: 5px; }
.tile.bad b { color: var(--critical); }
.tile.good b { color: var(--good-text); }

.lede { font-size: 13px; color: var(--ink-2); line-height: 1.65; max-width: 74ch; margin: 0 0 14px; }
.warn { background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--serious);
        border-radius: 10px; padding: 12px 15px; margin-bottom: 14px; font-size: 13px; line-height: 1.6; }
.warn b { display: block; margin-bottom: 4px; }

.chain { list-style: none; margin: 0; padding: 0; }
.chain li { display: grid; grid-template-columns: 22px 1fr auto; gap: 10px; align-items: start;
            padding: 9px 0; border-top: 1px solid var(--grid); }
.chain li:first-child { border-top: 0; }
.chain .n { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums;
            text-align: right; padding-top: 2px; }
.chain .nm { font-size: 13.5px; font-weight: 600; line-height: 1.35; }
.chain .meta { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
.chain .when { font-size: 12px; color: var(--ink-2); white-space: nowrap; font-variant-numeric: tabular-nums;
               text-align: right; }
.chain .when i { display: block; font-style: normal; font-size: 11px; color: var(--muted); }
.chain button { appearance: none; font: inherit; font-size: 11.5px; cursor: pointer; margin-top: 4px;
                background: var(--surface-2); border: 1px solid var(--border); border-radius: 7px;
                padding: 3px 9px; color: var(--ink-2); }
.chain button:hover { background: var(--surface); color: var(--ink); }
.done { opacity: .55; }

.ask { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; background: var(--surface);
       border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; }
.ask input, .ask select { font: inherit; font-size: 13px; padding: 7px 9px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--surface-2); color: var(--ink); width: auto; }
.ask input[type="number"] { width: 78px; }
.ask select { max-width: 420px; flex: 1 1 260px; }

.answer { background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
          padding: 15px 17px; margin-bottom: 14px; }
.answer h3 { margin: 0 0 6px; font-size: 15px; }
.answer .big { font-size: 26px; font-weight: 600; letter-spacing: -0.01em; }
.answer .big.bad { color: var(--critical); }
.answer .big.good { color: var(--good-text); }
.answer p { margin: 6px 0 0; font-size: 13px; color: var(--ink-2); line-height: 1.6; }
.answer ol { margin: 10px 0 0; padding-left: 20px; font-size: 12.5px; color: var(--ink-2); line-height: 1.75; }
.empty { text-align: center; color: var(--muted); padding: 34px 16px; font-size: 13.5px; line-height: 1.7; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Programme</h1><div class="sub">when it finishes, and what is holding it</div></div>
  <select class="proj" id="proj" hidden aria-label="Project"></select>
  <div class="spacer"></div>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  <a class="btn" href="/">Dashboard</a>
  <a class="btn" href="/resources">Resources</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  <div id="body"><p class="hint">Computing the network…</p></div>
</div>

<div class="toast" id="toast"></div>

<script>
${PWA_BOOT}
${SWITCHER_JS}
var esc = function (s) { return String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
var D = null;

function toast(msg, bad) {
  var t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
  setTimeout(function () { t.className = 'toast'; }, 3000);
}
function fmt(d) {
  if (!d) return '—';
  var p = String(d).split('-');
  var M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return p[2] + ' ' + M[Number(p[1]) - 1] + " '" + p[0].slice(2);
}

async function load() {
  var r = await fetch('/api/schedule', { cache: 'no-store' });
  if (r.status === 401) { location.href = '/'; return; }
  D = await r.json();
  if (D.error) {
    document.getElementById('body').innerHTML =
      '<div class="empty">' + esc(D.error) +
      (D.no_logic ? '<br><br>Import it with<br><code>node tools/xer-logic.mjs "your.xer" --project=' +
        '&lt;id&gt; --out=logic.sql</code>' : '') + '</div>';
    return;
  }
  render();
}

function render() {
  var over = D.over_contract_days;
  var h = '';

  if (!D.trustworthy) {
    h += '<div class="warn"><b>This programme cannot be forecast.</b>' +
      'There are loops in the logic — ' + D.cycles.length + ' activities sit in a circle, each ' +
      'waiting for the other. No date below can be trusted until a planner breaks them: ' +
      esc(D.cycles.slice(0, 6).join(', ')) + '.</div>';
  }

  h += '<div class="tiles">' +
    tile(fmt(D.contract_finish), 'Contract completion', '') +
    tile(fmt(D.forecast_finish), 'The logic says', 'from the work still to run', over > 0 ? 'bad' : 'good') +
    tile((over === null ? '—' : (over > 0 ? '+' : '') + over + 'd'),
         over > 0 ? 'Past the contract date' : 'Against the contract date',
         over > 0 ? 'working days' : '', over > 0 ? 'bad' : 'good') +
    tile(D.driving.length, 'Activities driving the end',
         'delay one of these and the job moves') +
    tile(D.behind_activities, 'Carrying no float at all', 'of ' + D.activities + ' activities') +
    '</div>';

  h += '<p class="lede">Computed from ' + D.links + ' relationships and ' + D.activities +
    ' activities on the baseline, walked on each activity\\u2019s own calendar, as at ' +
    fmt(D.data_date) + '. The last thing to happen is <b>' + esc(D.finish_activity_name) + '</b>.</p>';

  h += '<div class="card"><div class="card-head"><h2 style="margin:0">If this slips</h2>' +
    '<span class="note">the answer is computed, not estimated \\u2014 the whole network is re-run</span></div>' +
    '<div class="ask">' +
      '<select id="actSel"></select>' +
      '<label class="hint" style="margin:0">slips by</label>' +
      '<input type="number" id="days" value="10" min="1" max="365" step="1">' +
      '<span class="hint">working days</span>' +
      '<button class="btn btn-primary" id="ask">What does that do?</button>' +
    '</div>' +
    '<div id="answer"></div></div>';

  h += '<div class="card" style="margin-top:14px"><div class="card-head">' +
    '<h2 style="margin:0">What is holding the end of the job</h2>' +
    '<span class="note">each one sets the start of the next</span></div>' +
    '<ul class="chain">' + D.driving.map(function (a, i) {
      return '<li' + (a.status === 'complete' ? ' class="done"' : '') + '>' +
        '<span class="n">' + (i + 1) + '</span>' +
        '<span><span class="nm">' + esc(a.name) + '</span>' +
          '<span class="meta">' + esc(a.id) +
            (a.trade ? ' \\u00B7 ' + esc(a.trade) : '') +
            (a.floor ? ' \\u00B7 ' + esc(a.floor) : '') +
            (a.status === 'complete' ? ' \\u00B7 done' :
             a.status === 'in_progress' ? ' \\u00B7 running' : '') +
          '</span>' +
          (a.status === 'complete' ? '' :
            '<button data-try="' + esc(a.id) + '">what if this slips?</button>') +
        '</span>' +
        '<span class="when">' + fmt(a.finish) + '<i>' + fmt(a.start) + '</i></span>' +
      '</li>';
    }).join('') + '</ul></div>';

  document.getElementById('body').innerHTML = h;

  var sel = document.getElementById('actSel');
  sel.innerHTML = D.driving.filter(function (a) { return a.status !== 'complete'; })
    .map(function (a) {
      return '<option value="' + esc(a.id) + '">' + esc(a.name) + ' \\u00B7 ' + esc(a.id) + '</option>';
    }).join('');

  document.getElementById('ask').addEventListener('click', function () {
    askImpact(sel.value, Number(document.getElementById('days').value));
  });
  document.querySelectorAll('[data-try]').forEach(function (b) {
    b.addEventListener('click', function () {
      sel.value = b.dataset.try;
      askImpact(b.dataset.try, Number(document.getElementById('days').value));
      document.getElementById('answer').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
}

function tile(big, label, sub, cls) {
  return '<div class="tile ' + (cls || '') + '"><b>' + esc(big) + '</b><span>' + esc(label) + '</span>' +
    (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') + '</div>';
}

async function askImpact(id, days) {
  if (!id || !days) return;
  var el = document.getElementById('answer');
  el.innerHTML = '<p class="hint" style="margin-top:12px">Re-running the network…</p>';
  var r = await fetch('/api/impact?activity=' + encodeURIComponent(id) + '&days=' + days,
                      { cache: 'no-store' });
  var j = await r.json();
  if (j.error) { el.innerHTML = '<p class="hint" style="margin-top:12px">' + esc(j.error) + '</p>'; return; }

  var moved = j.slip_days > 0;
  el.innerHTML = '<div class="answer" style="margin-top:12px">' +
    '<h3>' + esc(j.activity_name) + ' slips ' + j.added_days + ' days</h3>' +
    '<div class="big ' + (moved ? 'bad' : 'good') + '">' +
      (moved ? 'Handover moves ' + j.slip_days + ' days' : 'Handover does not move') + '</div>' +
    '<p>' + (moved
      ? fmt(j.finish_before) + ' becomes <b>' + fmt(j.finish_after) + '</b>.' +
        (j.slip_days < j.added_days
          ? ' Less than the ' + j.added_days + ' days of delay, because ' +
            (j.float_days > 0 ? 'this activity had ' + j.float_days + ' days of float to give up first.'
                              : 'another path takes over as the driver partway through.')
          : ' The whole delay lands on the end date.')
      : 'It has ' + (j.float_days === null ? 'enough' : j.float_days) +
        ' days of float, so the delay is absorbed before it reaches anything that matters.') +
    '</p>' +
    (j.path && j.path.length
      ? '<p style="margin-top:10px">It gets to the end through:</p><ol>' +
        j.path.map(function (p) {
          return '<li>' + esc(p.name) + ' <span class="hint">' + fmt(p.finish) + '</span></li>';
        }).join('') + '</ol>'
      : '') +
    '</div>';
}

mountSwitcher('proj');
load();
</script>
</body>
</html>`;
