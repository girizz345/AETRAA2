import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK } from './shared.js';

// The programme loop with Primavera P6, for the Planning Engineer and the PM:
//   1. download site progress in P6's import format   (AETRAA → P6)
//   2. upload the updated .xer, see what changed, then apply it   (P6 → AETRAA)
export const programmeHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Programme · P6 update & export</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}
.wrap { max-width: 980px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; box-shadow: var(--shadow); margin: 0 0 16px; }
.card h2 { font-size: var(--fs-body); margin: 0 0 6px; }
.step { display: inline-block; font-size: var(--fs-label); font-weight: 500; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
.hint { font-size: var(--fs-secondary); color: var(--muted); line-height: 1.5; }
.btn { font: inherit; font-size: var(--fs-body); padding: 9px 16px; border-radius: 9px; border: 1px solid var(--border); background: var(--surface-2); color: var(--ink); cursor: pointer; text-decoration: none; display: inline-block; }
.btn.prim { background: var(--series-1); border-color: var(--series-1); color: var(--on-accent); }
.btn[disabled] { opacity: .5; cursor: default; }
.row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 12px; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 14px 0; }
.kpi { border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; background: var(--surface-2); }
.kpi b { display: block; font-size: var(--fs-headline); }
.kpi span { font-size: var(--fs-secondary); color: var(--muted); }
.kpi.bad b { color: var(--critical); }
.kpi.good b { color: var(--good-text); }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-secondary); margin-top: 8px; }
th { text-align: left; font-size: var(--fs-label); text-transform: uppercase; color: var(--muted); padding: 6px 8px; border-bottom: 1px solid var(--border); }
td { padding: 7px 8px; border-bottom: 1px solid var(--grid); }
.msg { padding: 10px 14px; border-radius: 9px; margin: 0 0 14px; font-size: var(--fs-secondary); display: none; }
.msg.ok { background: color-mix(in srgb, var(--good-text) 14%, transparent); color: var(--good-text); display: block; }
.msg.err { background: color-mix(in srgb, var(--critical) 14%, transparent); color: var(--critical); display: block; }
.warn { background: color-mix(in srgb, var(--critical) 10%, transparent); border-radius: 9px; padding: 10px 12px; font-size: var(--fs-secondary); margin-top: 10px; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Programme</h1><div class="sub" id="projName">P6 update &amp; export</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/">Back to dashboard</a>
</div></div>
<div class="wrap">
  <div class="msg" id="msg"></div>
  <div class="card">
    <div class="hint" id="state">Loading…</div>
  </div>

  <div class="card">
    <div class="step">Step 1 · AETRAA → P6</div>
    <h2>Download site progress for Primavera P6</h2>
    <div class="hint">One row per activity site has reported on: Activity ID, status, actual start, actual finish and
      physical % complete. A completion is sent as <b>Completed</b> only once the PM has verified it; an unverified 100% goes as
      99%, and a claim the PM queried is left out. In P6: <b>File → Import → Spreadsheet (XLSX)</b>, choose <i>Activities</i>,
      update the existing project, then reschedule (F9).</div>
    <div class="row">
      <a class="btn prim" href="/api/programme/p6-progress" id="dlP6">Download progress for P6 (.xlsx)</a>
      <a class="btn" href="/api/programme/p6-review">Download review sheet</a>
    </div>
  </div>

  <div class="card">
    <div class="step">Step 2 · P6 → AETRAA</div>
    <h2>Upload the updated programme (.xer)</h2>
    <div class="hint">Export the rescheduled project from P6 as .xer and upload it here. You will see what changed before
      anything is saved. Activities are matched on their P6 Activity ID, so every site update, photo and record stays with its activity.</div>
    <div class="row">
      <input type="file" id="xer" accept=".xer">
      <button class="btn prim" id="read" disabled>Check what changed</button>
    </div>
    <div id="review"></div>
  </div>
</div>
<script>
function el(id){ return document.getElementById(id); }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function msg(t, ok){ var m = el('msg'); m.textContent = t; m.className = 'msg ' + (ok ? 'ok' : 'err'); window.scrollTo(0, 0); }
function d(v){ if(!v) return '—'; var t = Date.parse(String(v).slice(0,10)); return isFinite(t) ? new Date(t).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : v; }
var B64 = null;

function loadState(){
  fetch('/api/programme/status', { cache: 'no-store' }).then(function(r){ return r.json(); }).then(function(j){
    if (j.error) { el('state').textContent = 'Updating the programme is for Planning and the Project Manager.'; el('read').disabled = true; el('dlP6').style.display='none'; return; }
    el('projName').textContent = (j.project || '') + ' · P6 update & export';
    var h = (j.history || []).map(function(x){ return '<tr><td>' + esc(d(x.at)) + '</td><td>' + esc(x.who) + '</td><td>' + esc(x.detail) + '</td></tr>'; }).join('');
    el('state').innerHTML = '<b>' + esc(j.activities) + '</b> activities on the programme · data date <b>' + esc(d(j.data_date)) +
      '</b> · contract completion <b>' + esc(d(j.contract_finish)) + '</b>' +
      (h ? '<table><tr><th>When</th><th>Who</th><th>What</th></tr>' + h + '</table>' : '');
  }).catch(function(){ el('state').textContent = 'Could not reach the server.'; });
}

el('xer').addEventListener('change', function(){
  var f = this.files[0]; B64 = null; el('review').innerHTML = ''; el('read').disabled = true;
  if (!f) return;
  if (!/\\.xer$/i.test(f.name)) { msg('That is not a .xer file — export the project from P6 as XER.', false); return; }
  var rd = new FileReader();
  rd.onload = function(){ var u8 = new Uint8Array(rd.result), s = '', CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    B64 = btoa(s); el('read').disabled = false; };
  rd.readAsArrayBuffer(f);
});

function post(url){
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_b64: B64 }) })
    .then(function(r){ return r.json(); });
}

el('read').addEventListener('click', function(){
  var b = this; b.disabled = true; b.textContent = 'Reading…';
  post('/api/programme/preview').then(function(j){
    b.disabled = false; b.textContent = 'Check what changed';
    if (j.error) { msg(j.error, false); return; }
    var s = j.summary;
    var slip = s.forecast_finish.days;
    var k = function(v, label, cls){ return '<div class="kpi ' + (cls||'') + '"><b>' + esc(v) + '</b><span>' + esc(label) + '</span></div>'; };
    var html = '<h2 style="margin-top:18px">What this update changes</h2>' +
      '<div class="kpis">' +
      k(d(s.data_date.to), 'Data date (was ' + d(s.data_date.from) + ')') +
      k(d(s.forecast_finish.to), 'Forecast finish' + (s.forecast_finish.from ? (slip > 0 ? ' — ' + slip + ' days later' : slip < 0 ? ' — ' + (-slip) + ' days earlier' : ' — no change') : ''), slip > 0 ? 'bad' : slip < 0 ? 'good' : '') +
      k(d(s.contract_finish), 'Contract completion') +
      k(s.activities.total, 'Activities (' + s.activities.added + ' new, ' + s.activities.removed + ' removed)') +
      k(s.completed_since_last, 'Completed since last update', 'good') +
      k(s.started_since_last, 'Started since last update') +
      k(s.finish_later, 'Now finish later', s.finish_later ? 'bad' : '') +
      k(s.negative_float, 'On negative float' + (s.newly_negative_float ? ' (' + s.newly_negative_float + ' new)' : ''), s.negative_float ? 'bad' : '') +
      '</div>';
    if (!s.same_programme) html += '<div class="warn"><b>This does not look like this project’s programme</b> — only ' + s.overlap_pct + '% of its Activity IDs match. It cannot be applied.</div>';
    if (s.removed_with_site_records) html += '<div class="warn">' + s.removed_with_site_records + ' activities that are no longer in P6 have site records. The records are kept; the activities come off the programme.</div>';
    if (s.biggest_slips.length) html += '<h3 style="font-size:var(--fs-secondary);margin:14px 0 0">Biggest slips</h3><table><tr><th>Activity</th><th>Was</th><th>Now</th><th>Days</th></tr>' +
      s.biggest_slips.map(function(m){ return '<tr><td>' + esc(m.id) + ' — ' + esc(m.name) + '</td><td>' + d(m.from) + '</td><td>' + d(m.to) + '</td><td>+' + m.days + '</td></tr>'; }).join('') + '</table>';
    if (s.added_sample.length) html += '<h3 style="font-size:var(--fs-secondary);margin:14px 0 0">New activities</h3><div class="hint">' + s.added_sample.map(function(a){ return esc(a.id) + ' ' + esc(a.name); }).join(' · ') + (s.activities.added > 10 ? ' …' : '') + '</div>';
    if (s.removed_sample.length) html += '<h3 style="font-size:var(--fs-secondary);margin:14px 0 0">Removed</h3><div class="hint">' + s.removed_sample.map(function(a){ return esc(a.id) + ' ' + esc(a.name); }).join(' · ') + (s.activities.removed > 10 ? ' …' : '') + '</div>';
    html += '<div class="row"><button class="btn prim" id="apply"' + (s.same_programme ? '' : ' disabled') + '>Apply this update</button><span class="hint">' + s.relationships + ' relationships and the calendars are loaded with it.</span></div>';
    el('review').innerHTML = html;
    var ap = el('apply');
    if (ap) ap.addEventListener('click', function(){
      ap.disabled = true; ap.textContent = 'Applying…';
      post('/api/programme/commit').then(function(r){
        if (r.error) { msg(r.error, false); ap.disabled = false; ap.textContent = 'Apply this update'; return; }
        msg('Programme updated — ' + r.summary.activities.total + ' activities, data date ' + d(r.summary.data_date.to) + ', forecast finish ' + d(r.summary.forecast_finish.to) + '.', true);
        el('review').innerHTML = ''; el('xer').value = ''; B64 = null; el('read').disabled = true; loadState();
      }).catch(function(){ msg('Could not reach the server.', false); ap.disabled = false; ap.textContent = 'Apply this update'; });
    });
  }).catch(function(){ b.disabled = false; b.textContent = 'Check what changed'; msg('Could not reach the server.', false); });
});
loadState();
${PWA_BOOT}
</script>
</body>
</html>`;
