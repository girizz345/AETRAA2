import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK, SWITCHER_CSS, SWITCHER_JS } from './shared.js';

// The queue of claims nobody in the office has looked at, each with its
// photographs beside it. The whole point is that the proof is on the same screen
// as the number — a verification that needs you to go and find the picture is a
// verification that does not happen.
export const verifyHTML = (role) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Verify · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1080px; }
.tiles { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); margin-bottom: 14px; }
.tile { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 11px 13px; }
.tile b { display: block; font-size: 23px; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.tile span { font-size: 11.5px; color: var(--muted); }
.tile.warn b { color: var(--serious-text); }
.tile.good b { color: var(--good-text); }
.tile.bad b { color: var(--critical); }

.bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
       background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
       padding: 11px 13px; margin-bottom: 14px; }
.seg { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.seg button { appearance: none; border: 0; background: var(--surface-2); color: var(--ink-2);
  font: inherit; font-size: 13px; font-weight: 600; padding: 7px 13px; cursor: pointer; }
.seg button + button { border-left: 1px solid var(--border); }
.seg button[aria-pressed="true"] { background: var(--series-1); color: #fff; }
.bar input[type="search"] { font: inherit; font-size: 13px; padding: 6px 9px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--surface-2); color: var(--ink);
  width: auto; flex: 1 1 170px; max-width: 280px; }

.claim { background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
         padding: 14px 16px; margin-bottom: 12px; }
.claim.done { border-left: 3px solid var(--good-text); }
.claim.queried { border-left: 3px solid var(--serious); }
.claim.verified { border-left: 3px solid var(--good-text); opacity: .8; }
.claim h3 { font-size: 15px; line-height: 1.35; margin: 0; }
.claim .meta { font-size: 12px; color: var(--muted); margin-top: 3px; line-height: 1.5; }
.claim .top { display: flex; gap: 14px; align-items: flex-start; flex-wrap: wrap; }
.claim .num { flex: 0 0 auto; text-align: right; font-variant-numeric: tabular-nums; }
.claim .num b { font-size: 26px; font-weight: 600; letter-spacing: -0.02em; }
.claim .num .was { display: block; font-size: 11.5px; color: var(--muted); }
.remark { background: var(--surface-2); border-radius: 8px; padding: 9px 11px; margin-top: 10px;
          font-size: 13px; line-height: 1.5; white-space: pre-wrap; }
.pics { display: flex; gap: 8px; margin-top: 11px; flex-wrap: wrap; }
.pics a { display: block; border: 1px solid var(--border); border-radius: 8px; overflow: hidden;
          background: var(--surface-2); line-height: 0; text-decoration: none; color: inherit; }
.pics img { width: 132px; height: 100px; object-fit: cover; display: block; }
.pics figcaption { font-size: 10.5px; color: var(--muted); padding: 4px 6px; line-height: 1.3; }
.nopic { font-size: 12.5px; color: var(--critical); margin-top: 11px; font-weight: 500; }
.acts { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; align-items: center; }
.verdict { font-size: 12.5px; padding: 9px 12px; border-radius: 8px; margin-top: 10px;
           border: 1px solid var(--border); border-left-width: 3px; }
.verdict.verified { background: var(--good-bg); color: var(--good-text); border-left-color: var(--good-text); }
.verdict.queried { background: var(--serious-bg); color: var(--serious-text); border-left-color: var(--serious); }
.pill { display: inline-block; font-size: 10.5px; font-weight: 700; letter-spacing: .03em;
        padding: 2px 7px; border-radius: 4px; text-transform: uppercase; vertical-align: 2px; margin-left: 6px; }
.pill.c { background: var(--good-bg); color: var(--good-text); }

/* Full size, because judging render from a thumbnail is not judging. */
.lb { position: fixed; inset: 0; background: rgba(8,12,20,.9); z-index: 100;
      display: flex; align-items: center; justify-content: center; padding: 20px; }
.lb img { max-width: 100%; max-height: 100%; border-radius: 6px; }
.lb button { position: absolute; top: 14px; right: 16px; font: inherit; font-size: 22px;
             background: none; border: 0; color: #fff; cursor: pointer; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Verify</h1><div class="sub">what site has claimed, and the proof</div></div>
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
    <div class="seg" role="group" aria-label="Which claims">
      <button data-state="awaiting" aria-pressed="true">To check</button>
      <button data-state="queried" aria-pressed="false">Queried</button>
      <button data-state="verified" aria-pressed="false">Verified</button>
      <button data-state="" aria-pressed="false">All</button>
    </div>
    <button class="btn" id="onlyDone" aria-pressed="false">Claimed complete only</button>
    <input type="search" id="q" placeholder="Search…">
    <div class="spacer"></div>
    <span class="hint" id="count"></span>
  </div>

  <div id="list"><div class="empty">Loading…</div></div>
</div>
<div class="toast" id="toast"></div>

<script>
${SWITCHER_JS}
var STATE = 'awaiting', DONE_ONLY = false, ROWS = [], PICS = {}, WHO = '';
try { WHO = localStorage.getItem('sm_verifier') || ''; } catch (e) {}

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
function ago(ts) {
  if (!ts) return '';
  var mins = Math.floor((Date.now() - Date.parse(ts)) / 60000);
  if (!isFinite(mins)) return '';
  if (mins < 60) return mins + ' min ago';
  if (mins < 1440) return Math.floor(mins / 60) + ' h ago';
  return Math.floor(mins / 1440) + ' d ago';
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
  var qs = '/api/verify?state=' + STATE + (DONE_ONLY ? '&complete=1' : '');
  try {
    var d = await api(qs);
    if (!d.migrated) {
      document.getElementById('list').innerHTML =
        '<div class="empty">Verification is not set up yet — run upgrade-verify.sh.</div>';
      return;
    }
    ROWS = d.claims || [];
    PICS = d.photos || {};
    renderTiles(d.counts || {});
    render();
  } catch (e) { toast(e.message, true); }
}

function renderTiles(c) {
  document.getElementById('tiles').innerHTML = [
    [c.awaiting || 0, 'claims to check', c.awaiting ? 'warn' : 'good'],
    [c.awaiting_complete || 0, 'of those claimed complete', c.awaiting_complete ? 'warn' : ''],
    [c.queried || 0, 'queried, back with site', c.queried ? 'bad' : ''],
    [c.verified || 0, 'verified', 'good'],
  ].map(function (t) {
    return '<div class="tile ' + t[2] + '"><b>' + t[0] + '</b><span>' + esc(t[1]) + '</span></div>';
  }).join('');
}

function render() {
  var q = document.getElementById('q').value.trim().toLowerCase();
  var list = ROWS.filter(function (r) {
    if (!q) return true;
    return (r.name + ' ' + (r.trade || '') + ' ' + (r.floor || '') + ' ' + r.id + ' ' +
            (r.submitted_by || '') + ' ' + (r.remarks || '')).toLowerCase().indexOf(q) >= 0;
  });
  document.getElementById('count').textContent = list.length + (list.length === 1 ? ' claim' : ' claims');

  if (!list.length) {
    document.getElementById('list').innerHTML = '<div class="empty">' +
      (STATE === 'awaiting' ? 'Nothing waiting. Every claim site has made has been looked at.'
        : 'Nothing here.') + '</div>';
    return;
  }

  document.getElementById('list').innerHTML = list.map(function (r) {
    var pics = PICS[r.id] || [];
    var complete = Number(r.pct) >= 100;
    var cls = r.verdict === 'queried' ? 'queried' : r.verdict === 'verified' ? 'verified' : (complete ? 'done' : '');
    var was = (r.before_pct == null) ? null : Number(r.before_pct);

    return '<div class="claim ' + cls + '" data-id="' + esc(r.id) + '">' +
      '<div class="top">' +
        '<div style="flex:1 1 260px;min-width:0">' +
          '<h3>' + esc(r.name) + (complete ? '<span class="pill c">complete</span>' : '') + '</h3>' +
          '<div class="meta">' + esc([r.trade, r.floor, r.wbs].filter(Boolean).join(' · ')) +
            '<br>Claimed by <b>' + esc(r.submitted_by || 'site') + '</b> on ' + fmt(r.report_date) +
            ' · ' + ago(r.created_at) + ' · ' + esc(r.id) + '</div>' +
        '</div>' +
        '<div class="num"><b>' + (r.pct == null ? '—' : Math.round(r.pct * 10) / 10 + '%') + '</b>' +
          '<span class="was">' + (was == null ? 'first report' : 'was ' + Math.round(was) + '%') + '</span></div>' +
      '</div>' +
      (r.remarks || r.delay_reason
        ? '<div class="remark">' + (r.delay_reason ? '<b>' + esc(r.delay_reason) + '</b>' +
            (r.remarks ? ' — ' : '') : '') + esc(r.remarks || '') + '</div>'
        : '') +
      (pics.length
        ? '<div class="pics">' + pics.map(function (p) {
            return '<a href="#" data-pic="' + esc(p.id) + '"><img src="/photo/' + esc(p.id) +
              '" alt="" loading="lazy"><figcaption>' + fmt(p.report_date) +
              (p.caption ? '<br>' + esc(p.caption) : '') + '</figcaption></a>';
          }).join('') + '</div>'
        : '<div class="nopic">No photograph against this activity' +
          (complete ? ' — and it is claimed complete.' : '.') + '</div>') +
      (r.verdict === 'verified' || r.verdict === 'queried'
        ? '<div class="verdict ' + esc(r.verdict) + '">' +
          (r.verdict === 'verified' ? 'Verified' : 'Queried') + ' by ' + esc(r.verdict_by || 'the office') +
          ' · ' + ago(r.verdict_at) + (r.verdict_note ? ' — ' + esc(r.verdict_note) : '') + '</div>'
        : '') +
      '<div class="acts">' +
        (r.awaiting
          ? '<button class="btn btn-primary" data-verify>Verified</button>' +
            '<button class="btn" data-query>Query it back</button>'
          : '<button class="btn" data-verify>Re-verify</button>') +
      '</div></div>';
  }).join('');

  document.getElementById('list').querySelectorAll('.claim').forEach(function (card) {
    var id = card.dataset.id;
    var v = card.querySelector('[data-verify]');
    if (v) v.addEventListener('click', function () { verdict(id, 'verified', v); });
    var q2 = card.querySelector('[data-query]');
    if (q2) q2.addEventListener('click', function () { verdict(id, 'queried', q2); });
    card.querySelectorAll('[data-pic]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); lightbox(a.dataset.pic); });
    });
  });
}

function lightbox(id) {
  var d = document.createElement('div');
  d.className = 'lb';
  d.innerHTML = '<button aria-label="Close">&times;</button><img src="/photo/' + id + '" alt="">';
  d.addEventListener('click', function () { d.remove(); });
  document.body.appendChild(d);
}

async function verdict(id, status, btn) {
  var note = '';
  if (status === 'queried') {
    note = prompt('What is wrong with it? Site sees this on their own list.') || '';
    if (!note.trim()) return;
  }
  if (!WHO) {
    WHO = prompt('Your name, for the record') || '';
    if (!WHO) return;
    try { localStorage.setItem('sm_verifier', WHO); } catch (e) {}
  }
  btn.disabled = true;
  try {
    await api('/api/verify', { activity_id: id, status: status, note: note, by: WHO });
    toast(status === 'verified' ? 'Verified' : 'Queried — site will see it');
    await load();
  } catch (e) { toast(e.message, true); btn.disabled = false; }
}

document.querySelectorAll('[data-state]').forEach(function (b) {
  b.addEventListener('click', function () {
    STATE = b.dataset.state;
    document.querySelectorAll('[data-state]').forEach(function (x) {
      x.setAttribute('aria-pressed', String(x === b));
    });
    load();
  });
});
document.getElementById('onlyDone').addEventListener('click', function () {
  DONE_ONLY = !DONE_ONLY;
  this.setAttribute('aria-pressed', String(DONE_ONLY));
  load();
});
document.getElementById('q').addEventListener('input', render);

mountSwitcher('proj');
load();
${PWA_BOOT}
</script>
</body></html>`;
