import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, SWITCHER_CSS, SWITCHER_JS, BRAND_CSS, BRAND_MARK } from './shared.js';

export const adminHTML = (noProject = false) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${SWITCHER_CSS}${BRAND_CSS}
.wrap { max-width: 900px; }
code { background: var(--surface-2); padding: 1px 5px; border-radius: 4px; font-size: 12.5px; }
pre { background: var(--surface-2); padding: 10px 12px; border-radius: 8px; overflow-x: auto; font-size: 12px; }
#paste, #ppaste, #tpaste { min-height: 150px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
.stat { display: flex; gap: 18px; flex-wrap: wrap; font-size: 13px; color: var(--ink-2); }
.stat b { color: var(--ink); font-size: 18px; display: block; font-weight: 600; }
.into { background: var(--surface-2); border: 1px solid var(--border); border-left: 3px solid var(--series-1);
        border-radius: 8px; padding: 9px 12px; font-size: 13px; margin-bottom: 14px; }
.into b { color: var(--ink); }
.plist { width: 100%; font-size: 13px; }
.plist td { padding: 8px 9px; border-bottom: 1px solid var(--grid); vertical-align: middle; }
.plist tr:last-child td { border-bottom: none; }
.plist .nm { font-weight: 600; }
.plist .sub { font-size: 11.5px; color: var(--muted); }
.here { font-size: 11px; font-weight: 600; color: var(--series-1); border: 1px solid var(--series-1);
        border-radius: 4px; padding: 1px 6px; margin-left: 6px; }
.codebox { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); }
.acrow { display: flex; gap: 10px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--grid); flex-wrap: wrap; }
.acrow:last-child { border-bottom: 0; }
.acrow[data-off] { opacity: .55; }
.ac-main { flex: 1 1 240px; min-width: 0; }
.ac-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
.scopechip { display: inline-flex; align-items: center; gap: 7px; cursor: pointer; font-size: 13px;
  border: 1px solid var(--border); background: var(--surface-2); border-radius: 999px; padding: 7px 13px; }
.scopechip input { width: 16px; height: 16px; accent-color: var(--series-1); }
.scopechip span { color: var(--muted); font-size: 11.5px; font-variant-numeric: tabular-nums; }
.scopechip:has(input:checked) { border-color: var(--series-1); background: var(--surface); font-weight: 600; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Admin</h1><div class="sub">projects, programme and target lists</div></div>
  <select class="proj" id="projSel" title="Switch project" hidden></select>
  <div class="spacer"></div>
  <a class="btn" href="/portfolio">Portfolio</a>
  <a class="btn" href="/">Dashboard</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  ${noProject ? `<div class="card" style="border-left:3px solid var(--serious)">
    <h2>No projects yet</h2>
    <p class="hint" style="margin:6px 0 0">Create your first project below, then load its programme into it.</p>
  </div>` : ''}

  <div class="card">
    <div class="card-head"><h2>Projects</h2><span class="note">Each one keeps its own programme, progress and photos</span></div>
    <table class="plist"><tbody id="plist"></tbody></table>
    <div class="row three" style="margin-top:14px">
      <div class="field"><label for="npName">New project name</label>
        <input id="npName" placeholder="e.g. Dubai Islands Tower"></div>
      <div class="field"><label for="npRef">Reference</label>
        <input id="npRef" placeholder="e.g. DIA-RE-0160"></div>
      <div class="field" style="align-self:end"><button class="btn btn-primary" id="npAdd">Add project</button></div>
    </div>
  </div>

  <div class="card">
    <div class="card-head"><h2>This project</h2></div>
    <div class="row two">
      <div class="field"><label for="pn">Project name</label><input id="pn"></div>
      <div class="field"><label for="pr">Reference</label><input id="pr" placeholder="e.g. DIA-RE-0160"></div>
    </div>
    <div class="row two">
      <div class="field"><label for="cc">Contract completion date</label><input id="cc" type="date"></div>
      <div class="field" style="align-self:end"><button class="btn btn-primary" id="saveMeta">Save project details</button></div>
    </div>
    <div class="stat" id="stat"></div>
  </div>

  <div class="card">
    <div class="card-head">
      <h2>The project's original three codes</h2>
      <span class="note">shared codes — use the per-person ones below instead</span>
    </div>
    <p class="hint" style="margin-top:0">
      These are the three shared codes <b id="codeFor">this project</b> started with: one manager,
      one site, one read-only, each covering the whole project. They still work, but a code handed
      round a site is a code that is out. Prefer <b>Who can get in</b> below, where each person has
      their own code limited to their own trades. Leave a box blank to leave that code unchanged;
      type a space to remove one altogether. Minimum 8 characters.
    </p>
    <div class="codebox">
      <div class="field"><label for="cMgr">Project manager</label><input id="cMgr" placeholder="unchanged"></div>
      <div class="field"><label for="cSite">Site team</label><input id="cSite" placeholder="unchanged"></div>
      <div class="field"><label for="cView">Read-only</label><input id="cView" placeholder="unchanged"></div>
    </div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-primary" id="saveCodes">Save codes</button>
      <button class="btn" id="genCodes">Suggest strong codes</button>
      <span class="hint" id="codeOut"></span>
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <h2>Material list</h2>
      <span class="note">what site picks from on the diary, so deliveries add up</span>
    </div>
    <p class="hint" style="margin-top:0">
      One material per line, as <b>Name | unit</b>. Site picks from this list on the diary and the
      unit comes with it, which is what lets the Resources page total a material rather than
      counting three spellings of it separately. Anything unusual can still be typed by hand.
    </p>
    <div class="field">
      <label for="matList">The list</label>
      <textarea id="matList" rows="9" spellcheck="false"
        placeholder="Ready-mix concrete C40 | m³&#10;Steel reinforcement | ton&#10;Hollow block 200mm | no"></textarea>
    </div>
    <div class="field" style="max-width:180px">
      <label for="curCode">Currency</label>
      <input id="curCode" maxlength="8" placeholder="AED">
    </div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-primary" id="saveMat">Save the list</button>
      <button class="btn" id="matReset">Put the standard list back</button>
      <span class="hint" id="matOut"></span>
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <h2>Who can get in</h2>
      <span class="note">one code per person, each limited to their own trades</span>
    </div>
    <p class="hint" style="margin-top:0">
      Give each person their own code and say what it covers. A discipline engineer scoped to
      <b>MEP</b> sees only MEP trades and the server refuses anything else — it is not merely hidden
      from the page. Withdrawing one signs that person out on their next tap and touches nobody else.
    </p>
    <div id="codeList"><div class="empty">Loading…</div></div>

    <div style="border-top:1px solid var(--grid);margin-top:14px;padding-top:14px">
      <div class="codebox">
        <div class="field"><label for="acLabel">Who is it for</label>
          <input id="acLabel" placeholder="e.g. Civil / Architecture — Rakesh"></div>
        <div class="field"><label for="acRole">What they can do</label>
          <select id="acRole">
            <option value="lead">Discipline engineer — updates their trades, dashboard of their scope</option>
            <option value="site">Site team — updates their trades on the phone only</option>
            <option value="view">Read-only — sees their scope, changes nothing</option>
            <option value="manager">Project manager — everything on this project, reviews the day</option>
          </select></div>
        <div class="field"><label for="acCode">The code</label>
          <input id="acCode" placeholder="at least 8 characters"></div>
      </div>
      <div class="field" id="acScopeWrap">
        <label>Which trades it covers <span style="font-weight:400;color:var(--muted)">— nothing ticked means the whole project</span></label>
        <div id="acScope" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px"></div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px">
        <button class="btn btn-primary" id="acSave">Add this code</button>
        <button class="btn" id="acGen">Suggest a code</button>
        <button class="btn" id="acCancel" hidden>Cancel</button>
        <span class="hint" id="acOut"></span>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <h2>Proof of completion</h2>
      <span class="note">what site must show before claiming an activity finished</span>
    </div>
    <label class="check" style="display:flex;gap:9px;align-items:flex-start;margin:0 0 10px">
      <input type="checkbox" id="proof100" style="width:18px;height:18px;margin-top:2px;accent-color:var(--series-1)">
      <span style="font-size:13px;line-height:1.5">An activity cannot be marked <b>100% complete</b>
        without a photograph attached to it. Site gets the camera on every activity either way;
        this decides whether the app refuses the claim without one. Refused on the server, so it
        holds however the update is sent. You and the PM are never blocked.</span>
    </label>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-primary" id="saveProof">Save</button>
      <span class="hint" id="proofOut"></span>
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <h2>Daily diary letterhead</h2>
      <span class="note">the logos across the top of the diary sheet</span>
    </div>
    <p class="hint" style="margin-top:0">
      Pick each one once. They are shrunk in the browser before upload and stored with the
      project, so the diary prints with the right heads whichever project you are in.
    </p>
    <div class="codebox">
      <div class="field"><label for="lg1">Consultant</label><input id="lg1" type="file" accept="image/*"></div>
      <div class="field"><label for="lg2">Second consultant (optional)</label><input id="lg2" type="file" accept="image/*"></div>
      <div class="field"><label for="lg3">Contractor</label><input id="lg3" type="file" accept="image/*"></div>
    </div>
    <div id="lgPrev" style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin:10px 0;min-height:8px"></div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-primary" id="saveLogos">Save logos</button>
      <button class="btn" id="clearLogos">Remove them</button>
      <span class="hint" id="lgOut"></span>
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <h2>RFIs and notices</h2>
      <span class="note">what goes on the documents the issues register produces</span>
    </div>
    <p class="hint" style="margin-top:0">
      These fill in the letterhead so an RFI or a notice comes out ready to check and sign.
      The clause is the notice provision of <b>this</b> contract — set it once and it appears on
      every notice for this project. Read it off your own conditions; nothing here is legal advice.
    </p>
    <div class="codebox">
      <div class="field"><label for="engName">Addressed to (Engineer / Consultant)</label>
        <input id="engName" placeholder="e.g. MIMAR Engineering Consultants"></div>
      <div class="field"><label for="conName">From (your company)</label>
        <input id="conName" placeholder="e.g. NAF Contracting LLC"></div>
      <div class="field"><label for="noticeClause">Notice provision</label>
        <input id="noticeClause" placeholder="e.g. Sub-Clause 20.2.1"></div>
    </div>
    <div class="field" style="max-width:220px">
      <label for="replyDays">Default reply period (days)</label>
      <input id="replyDays" type="number" min="1" max="60" placeholder="7">
    </div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-primary" id="saveLetter">Save</button>
      <span class="hint" id="letterOut"></span>
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <h2>Reports by email</h2>
      <span class="note">for <b id="repFor">this project</b></span>
    </div>
    <p class="hint" style="margin-top:0">
      The same reports you see on the Reports page, sent automatically. One address per line,
      or separated by commas. Anything that isn't an address is dropped.
    </p>
    <div class="field">
      <label for="repEmails">Recipients</label>
      <textarea id="repEmails" rows="3" placeholder="pm@example.com, you@example.com"></textarea>
    </div>
    <label class="check" style="display:flex;gap:8px;align-items:center;margin:10px 0">
      <input type="checkbox" id="repDaily"> Send the daily report automatically each evening
    </label>
    <label class="check" style="display:flex;gap:8px;align-items:center;margin:0 0 10px">
      <input type="checkbox" id="repWeekly"> Send the weekly report automatically every Monday morning
    </label>
    <label class="check" style="display:flex;gap:8px;align-items:center;margin:0 0 10px">
      <input type="checkbox" id="repMonthly"> Send last month's report automatically on the 1st
    </label>
    <label class="check" style="display:flex;gap:8px;align-items:center;margin:0 0 10px">
      <input type="checkbox" id="repDigest"> Email each person on the project their own "needs your attention" list at 6am (only when there is something on it)
    </label>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-primary" id="saveReport">Save recipients</button>
      <button class="btn" id="testReport">Send daily now</button>
      <button class="btn" id="testWeekly">Send weekly now</button>
      <button class="btn" id="testMonthly">Send last month now</button>
      <span class="hint" id="repOut"></span>
    </div>
  </div>

  <div class="card">
    <div class="card-head"><h2>Load the programme</h2><span class="note">Paste straight from Excel, or choose a CSV</span></div>
    <div class="into" id="into1"></div>
    <p class="hint" style="margin-top:0">
      Recognised columns, any order, extras ignored:
      <code>ID</code> <code>WBS</code> <code>Activity</code> <code>Level</code>
      <code>Planned Start</code> <code>Planned Finish</code> <code>Weight</code>
      <code>Trade</code> <code>Trade Group</code> <code>Floor</code> <code>Discipline</code>
      <code>Responsible</code>. Only <code>Activity</code> is essential; <code>Trade</code> is what
      makes the site page work. From P6: <code>node tools/xer-to-csv.mjs your.xer</code>.
    </p>
    <div class="field"><label for="file">CSV file</label><input id="file" type="file" accept=".csv,.txt,text/csv"></div>
    <div class="field"><label for="paste">…or paste rows here</label><textarea id="paste"></textarea></div>
    <label style="display:flex;align-items:center;gap:8px;font-size:13px">
      <input type="checkbox" id="replace" style="width:auto" checked>
      Replace this project's programme (progress is kept either way)
    </label>
    <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
      <button class="btn btn-primary btn-lg" id="imp">Import programme</button>
      <button class="btn" id="sample">Put a sample in the box</button>
    </div>
    <div id="out" class="hint" style="margin-top:12px"></div>
  </div>

  <div class="card">
    <div class="card-head"><h2>Load progress from the programme</h2>
      <span class="note">Carries the P6 position across so the dashboard doesn't start at zero</span></div>
    <div class="into" id="into2"></div>
    <p class="hint" style="margin-top:0">
      Columns: <code>ID</code> <code>Report Date</code> <code>%</code>
      <code>Actual Start</code> <code>Actual Finish</code> <code>Status</code>.
      These rows are tagged as coming from the programme, so they stay out of the
      <b>Latest from site</b> feed.
    </p>
    <div class="field"><label for="pfile">Progress CSV</label><input id="pfile" type="file" accept=".csv,.txt,text/csv"></div>
    <div class="field"><label for="ppaste">…or paste rows here</label><textarea id="ppaste"></textarea></div>
    <label style="display:flex;align-items:center;gap:8px;font-size:13px">
      <input type="checkbox" id="preplace" style="width:auto" checked>
      Replace the last programme import (site submissions are never touched)
    </label>
    <button class="btn btn-primary btn-lg" id="pimp" style="margin-top:14px">Import progress</button>
    <div id="pout" class="hint" style="margin-top:12px"></div>
  </div>

  <div class="card">
    <div class="card-head"><h2>Load a target list</h2>
      <span class="note">Activities that must be cleared by a date</span></div>
    <div class="into" id="into3"></div>
    <p class="hint" style="margin-top:0">
      Columns: <code>ID</code> <code>Target Group</code> <code>Work</code> <code>Level</code>
      <code>Days Left</code> <code>Start</code> <code>Finish By</code>. Whether a line has cleared is
      never read from this file — it comes from what site reports against the same activity ID.
      From the workbook: <code>node tools/xlsx-to-targets.mjs "your file.xlsx"</code>.
    </p>
    <div class="row two">
      <div class="field"><label for="tname">Target name</label><input id="tname" placeholder="Remaining work by 8 November"></div>
      <div class="field"><label for="tdate">Deadline</label><input id="tdate" type="date"></div>
    </div>
    <div class="field"><label for="tfile">Target CSV</label><input id="tfile" type="file" accept=".csv,.txt,text/csv"></div>
    <div class="field"><label for="tpaste">…or paste rows here</label><textarea id="tpaste"></textarea></div>
    <button class="btn btn-primary btn-lg" id="timp">Import target list</button>
    <div id="tout" class="hint" style="margin-top:12px"></div>
  </div>

  <div class="card">
    <div class="card-head"><h2>Links to share</h2></div>
    <p class="hint" style="margin-top:0">Site team gets the site link and this project's site code. Management gets the
      dashboard link and its read-only code. Keep the admin link to yourself.</p>
    <pre id="links"></pre>
  </div>
</div>
<div class="toast" id="toast"></div>

<script>
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function toast(m, bad) {
  var t = document.getElementById('toast');
  t.textContent = m; t.className = 'toast show' + (bad ? ' bad' : '');
  setTimeout(function () { t.className = 'toast'; }, 3400);
}
async function api(path, body) {
  var r = await fetch(path, body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : { cache: 'no-store' });
  var j = await r.json().catch(function () { return {}; });
  if (!r.ok) throw new Error(j.error || ('request failed (' + r.status + ')'));
  return j;
}

document.getElementById('links').textContent =
  'Dashboard (you, PM, management):  ' + location.origin + '/\\n' +
  'Site update form (site team):     ' + location.origin + '/site\\n' +
  'Portfolio (you only):             ' + location.origin + '/portfolio\\n' +
  'This admin page:                  ' + location.origin + '/admin';

var CURRENT = null;

async function loadProjects() {
  var d = await api('/api/projects');
  CURRENT = d.current;
  var rows = d.projects.map(function (p) {
    return '<tr>' +
      '<td><div class="nm">' + esc(p.name) + (p.id === d.current ? '<span class="here">open</span>' : '') + '</div>' +
        '<div class="sub">' + esc(p.ref || '') + (p.ref ? ' · ' : '') + esc(p.id) + '</div></td>' +
      '<td style="text-align:right;white-space:nowrap">' +
        (p.id === d.current ? '' : '<button class="btn" data-open="' + esc(p.id) + '">Open</button> ') +
        '<button class="btn" data-arch="' + esc(p.id) + '" data-to="' + (p.archived ? 0 : 1) + '">' +
          (p.archived ? 'Restore' : 'Archive') + '</button></td></tr>';
  }).join('');
  document.getElementById('plist').innerHTML = rows || '<tr><td class="hint">No projects yet.</td></tr>';
  document.querySelectorAll('[data-open]').forEach(function (b) {
    b.addEventListener('click', async function () {
      await fetch('/api/project?p=' + encodeURIComponent(b.dataset.open), { cache: 'no-store' });
      location.reload();
    });
  });
  document.querySelectorAll('[data-arch]').forEach(function (b) {
    b.addEventListener('click', async function () {
      try {
        await api('/api/project', { action: 'archive', id: b.dataset.arch, archived: Number(b.dataset.to) });
        toast(Number(b.dataset.to) ? 'Archived' : 'Restored');
        loadProjects();
      } catch (e) { toast(e.message, true); }
    });
  });
}

async function loadProject() {
  var d = await api('/api/data').catch(function () { return null; });
  if (!d) return;
  var m = d.meta || {};
  document.getElementById('pn').value = m.project_name || '';
  document.getElementById('pr').value = m.project_ref || '';
  document.getElementById('cc').value = m.contract_completion || '';
  document.getElementById('tname').value = m.target_name || '';
  document.getElementById('tdate').value = m.target_deadline || '';
  document.getElementById('stat').innerHTML =
    '<div><b>' + d.activities.length + '</b>activities</div>' +
    '<div><b>' + Object.keys(d.current || {}).length + '</b>with progress</div>' +
    '<div><b>' + (d.targets || []).length + '</b>target lines</div>' +
    '<div><b>' + (d.photos || []).length + '</b>photos</div>' +
    '<div><b>' + (d.manpower || []).length + '</b>manpower returns</div>';
  var label = '<b>' + esc(m.project_name || 'this project') + '</b>';
  ['into1', 'into2', 'into3'].forEach(function (id) {
    document.getElementById(id).innerHTML = 'Loads into ' + label + '. Switch project at the top if that is wrong.';
  });
  document.getElementById('codeFor').innerHTML = esc(m.project_name || 'this project');
  document.getElementById('repFor').innerHTML = esc(m.project_name || 'this project');
  document.getElementById('repEmails').value = m.report_emails || '';
  document.getElementById('repDaily').checked = !!m.report_daily;
  document.getElementById('repWeekly').checked = !!m.report_weekly;
  document.getElementById('repMonthly').checked = !!m.report_monthly;
  document.getElementById('repDigest').checked = !!m.report_digest;
  document.getElementById('engName').value = m.engineer_name || '';
  document.getElementById('conName').value = m.contractor_name || '';
  document.getElementById('noticeClause').value = m.notice_clause || '';
  document.getElementById('replyDays').value = m.reply_days || '';
  document.getElementById('matList').value = matToText(m.materials);
  document.getElementById('curCode').value = m.currency || 'AED';
  document.getElementById('matOut').textContent = m.materials_set
    ? '' : "This is the standard list — edit it and save to make it this project's own.";
  LOGOS = {
    logo_consultant: m.logo_consultant || '',
    logo_consultant2: m.logo_consultant2 || '',
    logo_contractor: m.logo_contractor || '',
  };
  previewLogos();
  document.getElementById('proof100').checked = m.proof_at_100 !== 0;
}

document.getElementById('npAdd').addEventListener('click', async function () {
  var name = document.getElementById('npName').value.trim();
  if (!name) { toast('Give the project a name', true); return; }
  this.disabled = true;
  try {
    var j = await api('/api/project', {
      action: 'create', name: name, ref: document.getElementById('npRef').value.trim(),
    });
    document.getElementById('npName').value = ''; document.getElementById('npRef').value = '';
    toast('Project created');
    await fetch('/api/project?p=' + encodeURIComponent(j.id), { cache: 'no-store' });
    location.reload();
  } catch (e) { toast(e.message, true); this.disabled = false; }
});

document.getElementById('saveMeta').addEventListener('click', async function () {
  try {
    await api('/api/project', {
      action: 'save', id: CURRENT,
      name: document.getElementById('pn').value,
      ref: document.getElementById('pr').value,
      contract_completion: document.getElementById('cc').value,
      target_name: document.getElementById('tname').value,
      target_deadline: document.getElementById('tdate').value,
    });
    toast('Saved'); loadProjects(); loadProject();
  } catch (e) { toast(e.message, true); }
});

document.getElementById('genCodes').addEventListener('click', function () {
  var al = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function blk(n) {
    var a = new Uint32Array(n); crypto.getRandomValues(a);
    return Array.from(a).map(function (x) { return al[x % al.length]; }).join('');
  }
  var base = (document.getElementById('pn').value || 'PRJ').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'PRJ';
  document.getElementById('cMgr').value  = base + '-PM-' + blk(4) + '-' + blk(4);
  document.getElementById('cSite').value = base + '-Site-' + blk(4) + '-' + blk(4);
  document.getElementById('cView').value = base + '-View-' + blk(4) + '-' + blk(4);
  document.getElementById('codeOut').textContent = 'Copy these somewhere before you save — they cannot be read back.';
});

document.getElementById('saveCodes').addEventListener('click', async function () {
  var body = { action: 'codes', id: CURRENT };
  var any = false;
  [['cMgr', 'manager_code'], ['cSite', 'site_code'], ['cView', 'view_code']].forEach(function (pair) {
    var v = document.getElementById(pair[0]).value;
    if (v !== '') { body[pair[1]] = v.trim(); any = true; }
  });
  if (!any) { toast('Nothing to change', true); return; }
  try {
    await api('/api/project', body);
    document.getElementById('codeOut').textContent = 'Saved. Anyone holding an old code for this project is now signed out.';
    toast('Codes updated');
  } catch (e) { toast(e.message, true); }
});

/* ------------------------------------------------------ who can get in */

var GROUPS = [], EDITING = null;

function fmtWhen(s) {
  if (!s) return 'never used';
  var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var d = new Date(s);
  return String(d.getUTCDate()).padStart(2, '0') + ' ' + m[d.getUTCMonth()] + ' ' + String(d.getUTCFullYear()).slice(2);
}

async function loadCodes() {
  var j;
  try { j = await api('/api/codes'); } catch (e) { return; }
  if (!j.migrated) {
    document.getElementById('codeList').innerHTML =
      '<div class="empty">Per-person codes are not set up yet — run upgrade-access.sh.</div>';
    return;
  }
  GROUPS = j.groups || [];
  renderScopePicker();
  var rows = j.codes || [];
  document.getElementById('codeList').innerHTML = rows.length ? rows.map(function (c) {
    var roleLabel = { manager: 'Project manager', lead: 'Discipline engineer',
                      site: 'Site team', view: 'Read-only' }[c.role] || c.role;
    return '<div class="acrow" data-id="' + c.id + '"' + (c.active ? '' : ' data-off="1"') + '>' +
      '<div class="ac-main"><b>' + esc(c.label) + '</b>' +
        '<div class="ac-sub">' + esc(roleLabel) + ' &middot; ' + esc(c.scope_text) +
        ' &middot; last used ' + fmtWhen(c.last_used) + (c.active ? '' : ' &middot; <b>withdrawn</b>') + '</div></div>' +
      '<button class="btn" data-edit>Change</button>' +
      '<button class="btn" data-toggle>' + (c.active ? 'Withdraw' : 'Restore') + '</button>' +
      '<button class="btn" data-remove title="Delete for good">&times;</button>' +
      '</div>';
  }).join('') : '<div class="empty">No per-person codes yet. Add one below.</div>';

  document.getElementById('codeList').querySelectorAll('.acrow').forEach(function (row) {
    var c = rows.filter(function (x) { return x.id === row.dataset.id; })[0];
    row.querySelector('[data-edit]').addEventListener('click', function () { editCode(c); });
    row.querySelector('[data-toggle]').addEventListener('click', async function () {
      try {
        await api('/api/code', { id: c.id, label: c.label, role: c.role,
          groups: c.scope.groups, trades: c.scope.trades, active: !c.active });
        toast(c.active ? 'Withdrawn — they are signed out on their next tap' : 'Restored');
        loadCodes();
      } catch (e) { toast(e.message, true); }
    });
    row.querySelector('[data-remove]').addEventListener('click', async function () {
      if (!confirm('Delete ' + c.label + ' for good? Withdrawing is usually enough.')) return;
      try { await api('/api/code', { remove: true, id: c.id }); toast('Deleted'); loadCodes(); }
      catch (e) { toast(e.message, true); }
    });
  });
}

function renderScopePicker(picked) {
  var sel = picked || { groups: [], trades: [] };
  document.getElementById('acScope').innerHTML = GROUPS.map(function (g) {
    return '<label class="scopechip"><input type="checkbox" value="' + esc(g.group) + '"' +
      (sel.groups.indexOf(g.group) >= 0 ? ' checked' : '') + '>' +
      esc(g.group) + ' <span>' + g.activities + '</span></label>';
  }).join('') || '<span class="hint">Load a programme first — the groups come from it.</span>';
}

function scopePicked() {
  var out = [];
  document.getElementById('acScope').querySelectorAll('input:checked').forEach(function (i) { out.push(i.value); });
  return out;
}

function editCode(c) {
  EDITING = c.id;
  document.getElementById('acLabel').value = c.label;
  document.getElementById('acRole').value = c.role;
  document.getElementById('acCode').value = '';
  document.getElementById('acCode').placeholder = 'leave blank to keep the same code';
  renderScopePicker(c.scope);
  document.getElementById('acSave').textContent = 'Save changes';
  document.getElementById('acCancel').hidden = false;
  document.getElementById('acOut').textContent = 'Changing ' + c.label + '.';
  document.getElementById('acLabel').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetCodeForm() {
  EDITING = null;
  ['acLabel', 'acCode'].forEach(function (id) { document.getElementById(id).value = ''; });
  document.getElementById('acCode').placeholder = 'at least 8 characters';
  document.getElementById('acRole').value = 'lead';
  renderScopePicker();
  document.getElementById('acSave').textContent = 'Add this code';
  document.getElementById('acCancel').hidden = true;
  document.getElementById('acOut').textContent = '';
}

document.getElementById('acCancel').addEventListener('click', resetCodeForm);

document.getElementById('acRole').addEventListener('change', function () {
  // A project manager holds the whole project; there is nothing to scope.
  document.getElementById('acScopeWrap').hidden = this.value === 'manager';
});

document.getElementById('acGen').addEventListener('click', function () {
  var al = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function blk(n) {
    var a = new Uint32Array(n); crypto.getRandomValues(a);
    return Array.from(a).map(function (x) { return al[x % al.length]; }).join('');
  }
  var who = (document.getElementById('acLabel').value || '').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase();
  var base = (document.getElementById('pn').value || 'PRJ').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'PRJ';
  document.getElementById('acCode').value = base + '-' + (who || 'USR') + '-' + blk(4) + '-' + blk(4);
  document.getElementById('acOut').textContent = 'Copy it before you save — it cannot be read back.';
});

document.getElementById('acSave').addEventListener('click', async function () {
  var body = {
    label: document.getElementById('acLabel').value,
    role: document.getElementById('acRole').value,
    code: document.getElementById('acCode').value,
    groups: document.getElementById('acRole').value === 'manager' ? [] : scopePicked(),
    trades: [],
  };
  if (EDITING) body.id = EDITING;
  try {
    await api('/api/code', body);
    toast(EDITING ? 'Saved' : 'Code added');
    document.getElementById('acOut').textContent = EDITING
      ? 'Saved. It applies on their next tap.'
      : 'Added. Copy the code now — it cannot be read back.';
    var keep = document.getElementById('acCode').value;
    resetCodeForm();
    if (keep) document.getElementById('acOut').textContent = 'Added. The code was: ' + keep;
    loadCodes();
  } catch (e) { toast(e.message, true); }
});

// Logos are shrunk here rather than on the server: a 2 MB letterhead becomes a
// few KB, and the diary only ever prints it 34 px tall.
var LOGOS = {};
function shrink(file, maxW, maxH) {
  return new Promise(function (res, rej) {
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(maxW / img.width, maxH / img.height, 1);
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        var x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/png'));
      };
      img.onerror = function () { rej(new Error('that file is not an image')); };
      img.src = fr.result;
    };
    fr.onerror = function () { rej(new Error('could not read that file')); };
    fr.readAsDataURL(file);
  });
}
function previewLogos() {
  document.getElementById('lgPrev').innerHTML =
    ['logo_consultant', 'logo_consultant2', 'logo_contractor']
      .filter(function (k) { return LOGOS[k]; })
      .map(function (k) { return '<img src="' + LOGOS[k] + '" style="max-height:38px;max-width:190px;background:#fff;border:1px solid var(--border);border-radius:6px;padding:3px">'; })
      .join('') || '<span class="hint">No logos set — the diary prints without them.</span>';
}
[['lg1', 'logo_consultant'], ['lg2', 'logo_consultant2'], ['lg3', 'logo_contractor']].forEach(function (pair) {
  document.getElementById(pair[0]).addEventListener('change', async function () {
    if (!this.files || !this.files[0]) return;
    try {
      LOGOS[pair[1]] = await shrink(this.files[0], 560, 160);
      previewLogos();
      document.getElementById('lgOut').textContent = 'Ready — press Save logos.';
    } catch (e) { toast(e.message, true); }
  });
});
document.getElementById('saveProof').addEventListener('click', async function () {
  try {
    await api('/api/project', { action: 'proof', id: CURRENT,
      proof_at_100: document.getElementById('proof100').checked });
    document.getElementById('proofOut').textContent = 'Saved.';
    toast('Saved'); loadProject();
  } catch (e) { toast(e.message, true); }
});

document.getElementById('saveLogos').addEventListener('click', async function () {
  try {
    await api('/api/project', Object.assign({ action: 'logos', id: CURRENT }, LOGOS));
    document.getElementById('lgOut').textContent = 'Saved.';
    toast('Logos saved'); loadProject();
  } catch (e) { toast(e.message, true); }
});
document.getElementById('clearLogos').addEventListener('click', async function () {
  if (!confirm('Remove the logos from this project\\'s diary?')) return;
  try {
    await api('/api/project', { action: 'logos', id: CURRENT, clear: true });
    LOGOS = {}; previewLogos();
    document.getElementById('lgOut').textContent = 'Removed.';
    toast('Removed'); loadProject();
  } catch (e) { toast(e.message, true); }
});

document.getElementById('saveLetter').addEventListener('click', async function () {
  try {
    await api('/api/project', {
      action: 'letter', id: CURRENT,
      engineer_name: document.getElementById('engName').value,
      contractor_name: document.getElementById('conName').value,
      notice_clause: document.getElementById('noticeClause').value,
      reply_days: document.getElementById('replyDays').value,
    });
    document.getElementById('letterOut').textContent = 'Saved — new documents use these.';
    toast('Saved'); loadProject();
  } catch (e) { toast(e.message, true); }
});

function matToText(list) {
  return (list || []).map(function (m) { return m.m + (m.u ? ' | ' + m.u : ''); }).join('\\n');
}
function matFromText(text) {
  return String(text || '').split(/\\r?\\n/).map(function (line) {
    var bits = line.split('|');
    return { m: (bits[0] || '').trim(), u: (bits[1] || '').trim() };
  }).filter(function (m) { return m.m; });
}
document.getElementById('saveMat').addEventListener('click', async function () {
  try {
    var j = await api('/api/project', {
      action: 'materials', id: CURRENT,
      materials: matFromText(document.getElementById('matList').value),
      currency: document.getElementById('curCode').value,
    });
    document.getElementById('matOut').textContent =
      j.materials ? j.materials + ' materials saved.' : 'Cleared — the standard list is back.';
    toast('Saved'); loadProject();
  } catch (e) { toast(e.message, true); }
});
document.getElementById('matReset').addEventListener('click', async function () {
  try {
    await api('/api/project', { action: 'materials', id: CURRENT, materials: [],
                                currency: document.getElementById('curCode').value });
    document.getElementById('matOut').textContent = 'The standard list is back.';
    toast('Reset'); loadProject();
  } catch (e) { toast(e.message, true); }
});

document.getElementById('saveReport').addEventListener('click', async function () {
  try {
    var j = await api('/api/project', {
      action: 'report', id: CURRENT,
      report_emails: document.getElementById('repEmails').value,
      report_daily: document.getElementById('repDaily').checked,
      report_weekly: document.getElementById('repWeekly').checked,
      report_monthly: document.getElementById('repMonthly').checked,
      report_digest: document.getElementById('repDigest').checked,
    });
    var n = (j.recipients || []).length;
    document.getElementById('repOut').textContent =
      n ? n + ' recipient' + (n === 1 ? '' : 's') + ' saved.' : 'No valid address found — nothing will be sent.';
    toast('Saved'); loadProject();
  } catch (e) { toast(e.message, true); }
});

document.getElementById('testReport').addEventListener('click', async function () {
  this.disabled = true;
  document.getElementById('repOut').textContent = 'Sending…';
  try {
    var j = await api('/api/report-email', { kind: 'daily' });
    document.getElementById('repOut').textContent = 'Sent to ' + j.sent + ' recipient' + (j.sent === 1 ? '' : 's') + '.';
    toast('Report sent');
  } catch (e) {
    document.getElementById('repOut').textContent = e.message;
    toast(e.message, true);
  }
  this.disabled = false;
});

document.getElementById('testMonthly').addEventListener('click', async function () {
  this.disabled = true;
  document.getElementById('repOut').textContent = 'Sending…';
  try {
    var d = new Date(); d.setDate(0);   // last day of last month
    var mk = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    var j = await api('/api/report-email', { kind: 'monthly', key: mk });
    document.getElementById('repOut').textContent = 'Monthly report for ' + mk + ' sent to ' + j.sent + ' recipient' + (j.sent === 1 ? '' : 's') + '.';
    toast('Monthly report sent');
  } catch (e) {
    document.getElementById('repOut').textContent = e.message;
    toast(e.message, true);
  }
  this.disabled = false;
});

document.getElementById('testWeekly').addEventListener('click', async function () {
  this.disabled = true;
  document.getElementById('repOut').textContent = 'Sending…';
  try {
    var j = await api('/api/report-email', { kind: 'weekly' });
    document.getElementById('repOut').textContent = 'Weekly report sent to ' + j.sent + ' recipient' + (j.sent === 1 ? '' : 's') + '.';
    toast('Weekly report sent');
  } catch (e) {
    document.getElementById('repOut').textContent = e.message;
    toast(e.message, true);
  }
  this.disabled = false;
});

function wireImport(fileId, pasteId, btnId, outId, run) {
  document.getElementById(fileId).addEventListener('change', function () {
    var f = this.files[0]; if (!f) return;
    var fr = new FileReader();
    fr.onload = function () { document.getElementById(pasteId).value = fr.result; toast('File read — now press the import button'); };
    fr.readAsText(f);
  });
  document.getElementById(btnId).addEventListener('click', async function () {
    var text = document.getElementById(pasteId).value.trim();
    var out = document.getElementById(outId);
    if (!text) { toast('Nothing to import', true); return; }
    var label = this.textContent;
    this.disabled = true; this.textContent = 'Importing…';
    try {
      out.textContent = await run(text); out.className = 'hint';
      toast('Imported'); loadProject();
    } catch (e) { out.textContent = e.message; out.className = 'hint stale'; toast(e.message, true); }
    this.disabled = false; this.textContent = label;
  });
}

wireImport('file', 'paste', 'imp', 'out', async function (text) {
  var j = await api('/api/import', { text: text, replace: document.getElementById('replace').checked });
  return 'Imported ' + j.imported + ' activities' + (j.skipped ? ', skipped ' + j.skipped + ' blank rows' : '') + '.';
});
wireImport('pfile', 'ppaste', 'pimp', 'pout', async function (text) {
  var j = await api('/api/import-progress', {
    text: text, replace: document.getElementById('preplace').checked, submitted_by: 'programme import' });
  return 'Loaded progress for ' + j.imported + ' activities.';
});
wireImport('tfile', 'tpaste', 'timp', 'tout', async function (text) {
  var j = await api('/api/import-targets', {
    text: text,
    target_name: document.getElementById('tname').value.trim(),
    target_deadline: document.getElementById('tdate').value });
  return 'Loaded ' + j.imported + ' target lines, ' + j.matched + ' matched to activities in this programme' +
    (j.imported !== j.matched ? ' — the rest carry IDs this programme does not hold.' : '.');
});

document.getElementById('sample').addEventListener('click', function () {
  document.getElementById('paste').value =
    'ID,WBS,Activity,Level,Planned Start,Planned Finish,Trade,Trade Group,Floor\\n' +
    'S000,Substructure,SUBSTRUCTURE,0,,,,,\\n' +
    'S010,Substructure,Excavation to raft level,1,2026-10-05,2026-10-24,Excavation,Civil,Raft\\n' +
    'S020,Substructure,Raft reinforcement and concrete,1,2026-11-02,2026-11-28,Reinforcement,Civil,Raft\\n' +
    'U000,Superstructure,SUPERSTRUCTURE,0,,,,,\\n' +
    'U010,Superstructure,GF columns and core walls,1,2026-11-25,2026-12-15,Concrete,Civil,Ground Floor\\n' +
    'M010,MEP,Electrical conduiting in slabs,1,2026-12-10,2027-04-15,Conduits,MEP,Ground Floor\\n';
  toast('Sample loaded into the box');
});

try { var sv = localStorage.getItem('sm-theme'); if (sv) document.documentElement.setAttribute('data-theme', JSON.parse(sv)); } catch (e) {}
mountSwitcher('projSel');
loadProjects();
loadProject();
loadCodes();
${SWITCHER_JS}
${PWA_BOOT}
</script>
</body>
</html>`;
