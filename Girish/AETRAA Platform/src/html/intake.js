import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK } from './shared.js';

// PROJECT INTAKE — the screen behind "drop a folder and the project sets
// itself up".
//
// Four steps, and only the fourth writes anything. The design decision that
// governs the whole page: THE REVIEW SCREEN SEPARATES WHAT A PERSON MUST DECIDE
// FROM WHAT THEY NEED ONLY TO NOTICE. Five groups, in order of how much
// attention each deserves:
//
//   Ready to file            scan the number, decide nothing
//   Filed without verification   note what is being taken on trust
//   Needs a decision         the only group that requires work
//   Will be held             see what goes to the Admin, and why, BEFORE committing
//   Not identified           say what these are, or leave them out
//
// Contract terms are not in those groups. They get their own panel, every term
// unticked, because no contract figure is ever applied without a person saying
// so — every payment certificate for the life of the job is computed from them.
//
// Progress is per file with the current filename, never a bare spinner: four
// hundred files takes minutes, and a spinner with no count is indistinguishable
// from a hang.
export const intakeHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AETRAA Admin · Project intake</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}
.wrap { max-width: 1100px; margin: 0 auto; padding: 18px 16px 60px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; box-shadow: var(--shadow); margin: 0 0 16px; }
.card h2 { font-size: 15px; margin: 0 0 4px; }
.card .sub { font-size: 12.5px; color: var(--muted); margin: 0 0 14px; line-height: 1.5; }
label { font-size: 12px; color: var(--ink-2); display: block; margin-bottom: 4px; }
select, input[type=text] { font: inherit; font-size: 14px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--ink); min-width: 260px; }
.btn { font: inherit; font-size: 14px; padding: 9px 16px; border-radius: 9px; border: 1px solid var(--border); background: var(--surface-2); color: var(--ink); cursor: pointer; text-decoration: none; display: inline-block; }
.btn.prim { background: var(--series-1); border-color: var(--series-1); color: #fff; }
.btn:disabled { opacity: .5; cursor: default; }
.drop { border: 2px dashed var(--border); border-radius: 12px; padding: 34px 20px; text-align: center; background: var(--surface-2); cursor: pointer; transition: border-color .15s, background .15s; }
.drop.over { border-color: var(--series-1); background: color-mix(in srgb, var(--series-1) 8%, transparent); }
.drop b { display: block; font-size: 15px; margin-bottom: 6px; }
.drop span { font-size: 12.5px; color: var(--muted); }
.prog { display: none; margin-top: 14px; }
.prog.on { display: block; }
.bar { height: 6px; border-radius: 999px; background: var(--grid); overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--series-1); width: 0; transition: width .2s; }
.progline { font-size: 12.5px; color: var(--muted); margin-top: 7px; font-variant-numeric: tabular-nums; }
.sumline { font-size: 14px; line-height: 1.7; margin: 0 0 6px; }
.sumline b { font-weight: 650; }
.sumline .held { color: var(--critical); }
.grp { border: 1px solid var(--border); border-radius: 10px; margin: 0 0 10px; overflow: hidden; }
.grp > summary { list-style: none; cursor: pointer; padding: 11px 14px; background: var(--surface-2); font-size: 13.5px; display: flex; gap: 10px; align-items: center; }
.grp > summary::-webkit-details-marker { display: none; }
.grp > summary b { font-weight: 600; }
.grp > summary .n { margin-left: auto; font-variant-numeric: tabular-nums; color: var(--muted); font-size: 12.5px; }
.grp.warn > summary { background: color-mix(in srgb, var(--critical) 10%, transparent); }
.grp .why { padding: 9px 14px 0; font-size: 12px; color: var(--muted); line-height: 1.5; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); padding: 7px 10px; border-bottom: 1px solid var(--border); }
td { padding: 8px 10px; border-bottom: 1px solid var(--grid); vertical-align: top; }
td.f { font-family: ui-monospace, monospace; font-size: 12px; word-break: break-all; }
td .path { display: block; color: var(--muted); font-size: 11px; margin-top: 2px; }
td .reason { color: var(--muted); font-size: 11.5px; line-height: 1.45; }
select.sm { min-width: 0; font-size: 12.5px; padding: 4px 7px; }
.terms { display: grid; gap: 10px; }
.term { display: grid; grid-template-columns: 26px 1fr; gap: 10px; padding: 11px 13px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); }
.term.conflict { border-color: var(--critical); }
.term input[type=checkbox] { width: 16px; height: 16px; margin: 2px 0 0; }
.term b { font-size: 13.5px; display: block; }
.term .val { font-size: 15px; font-variant-numeric: tabular-nums; margin: 3px 0; }
.term .cite { font-size: 11.5px; color: var(--muted); line-height: 1.5; font-style: italic; }
.term .note { font-size: 12px; color: var(--critical); margin-top: 5px; line-height: 1.45; }
.term .opt { display: block; font-size: 12.5px; margin: 4px 0; }
.msg { padding: 10px 14px; border-radius: 9px; margin: 0 0 14px; font-size: 13.5px; display: none; }
.msg.ok { background: color-mix(in srgb, var(--good-text) 14%, transparent); color: var(--good-text); display: block; }
.msg.err { background: color-mix(in srgb, var(--critical) 14%, transparent); color: var(--critical); display: block; }
.gatewarn { font-size: 12.5px; padding: 10px 13px; border: 1px dashed var(--critical); border-radius: 9px; color: var(--critical); margin-bottom: 14px; line-height: 1.5; display: none; }
.gatewarn.on { display: block; }
#reviewCard, #termsCard, #resultCard { display: none; }
#reviewCard.on, #termsCard.on, #resultCard.on { display: block; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>AETRAA Admin</h1><div class="sub">project intake</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/setup">Setup console</a>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  <div class="msg" id="msg"></div>

  <div class="card">
    <h2>1 &middot; Which project</h2>
    <p class="sub">Everything attaches to a project, so pick it before dropping anything. A draft project is invisible to the customer until you take it live.</p>
    <label for="proj">Project</label>
    <select id="proj"><option value="">Loading&hellip;</option></select>
    <div class="gatewarn" id="gateWarn"></div>
  </div>

  <div class="card">
    <h2>2 &middot; Drop the folder</h2>
    <p class="sub">The whole folder, sub-folders and all &mdash; nothing to zip, nothing to install. Sub-folder names are kept, because <code>/Tender Drawings/Structural/</code> is a hint a flat list would lose.</p>
    <div class="drop" id="drop">
      <b>Drop a folder here</b>
      <span>or click to choose one</span>
      <input type="file" id="picker" webkitdirectory directory multiple hidden>
    </div>
    <div class="prog" id="prog">
      <div class="bar"><i id="barFill"></i></div>
      <div class="progline" id="progLine"></div>
    </div>
  </div>

  <div class="card" id="reviewCard">
    <h2>3 &middot; Review</h2>
    <p class="sub">Nothing has been written yet. Everything below is what the engine <em>proposes</em>.</p>
    <p class="sumline" id="sumLine"></p>
    <div id="groups"></div>
    <div style="margin-top:16px">
      <button class="btn prim" id="commitBtn">File everything confirmed</button>
      <span class="sub" id="commitHint" style="margin-left:10px"></span>
    </div>
  </div>

  <div class="card" id="termsCard">
    <h2>Contract terms</h2>
    <p class="sub"><b>Nothing here is ticked.</b> Every payment certificate, reply-by clock and overdue flag on this project is computed from these figures, so each one is a proposal you confirm &mdash; never something the engine applies for you.</p>
    <div class="terms" id="terms"></div>
    <div style="margin-top:14px">
      <button class="btn" id="termsBtn">Apply the ticked terms</button>
    </div>
  </div>

  <div class="card" id="resultCard">
    <h2>Result</h2>
    <div id="result"></div>
  </div>
</div>

<script>
var state = { pid: '', batch: null, items: [], terms: [] };
var $ = function (id) { return document.getElementById(id); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
  return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function say(t, bad) { var m = $('msg'); m.textContent = t; m.className = 'msg ' + (bad ? 'err' : 'ok'); }
function clearSay() { $('msg').className = 'msg'; }

$('themeBtn').addEventListener('click', function () {
  var d = document.documentElement;
  d.setAttribute('data-theme', d.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
});

/* ---------------------------------------------------------------- projects */
(async function () {
  try {
    var r = await fetch('/api/projects', { cache: 'no-store' });
    var d = await r.json();
    var list = d.projects || d || [];
    $('proj').innerHTML = '<option value="">Choose a project\\u2026</option>' + list.map(function (p) {
      return '<option value="' + esc(p.id) + '">' + esc(p.name || p.id) +
             (p.ref ? ' \\u00B7 ' + esc(p.ref) : '') +
             (p.setup_state === 'draft' ? ' (draft)' : '') + '</option>';
    }).join('');
  } catch (e) { $('proj').innerHTML = '<option value="">Could not load projects</option>'; }
})();

$('proj').addEventListener('change', async function () {
  state.pid = this.value;
  $('gateWarn').className = 'gatewarn';
  if (!state.pid) return;
  // Say plainly when the gate is not configured. A gate nobody set up protects
  // nothing and must not look as though it does.
  try {
    var r = await fetch('/api/setup/rules?project=' + encodeURIComponent(state.pid), { cache: 'no-store' });
    var d = await r.json();
    if (!d.configured) {
      $('gateWarn').innerHTML = '<b>Drawing gate: not configured.</b> This project has no drawing ' +
        'numbering set, so nothing will stop another project\\u2019s drawings being filed here. ' +
        'Set it in the <a href="/setup">setup console</a> from the contractor\\u2019s drawing register.';
      $('gateWarn').className = 'gatewarn on';
    }
  } catch (e) {}
});

/* ---------------------------------------------------------------- the drop */
var drop = $('drop'), picker = $('picker');
drop.addEventListener('click', function () { picker.click(); });
['dragenter', 'dragover'].forEach(function (e) {
  drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('over'); });
});
['dragleave', 'drop'].forEach(function (e) {
  drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.remove('over'); });
});
picker.addEventListener('change', function () { start([].slice.call(this.files)); });
drop.addEventListener('drop', async function (ev) {
  var items = ev.dataTransfer && ev.dataTransfer.items;
  if (items && items.length && items[0].webkitGetAsEntry) {
    var entries = [];
    for (var i = 0; i < items.length; i++) {
      var e = items[i].webkitGetAsEntry();
      if (e) entries.push(e);
    }
    var files = [];
    for (var j = 0; j < entries.length; j++) await walk(entries[j], '', files);
    start(files);
  } else {
    start([].slice.call(ev.dataTransfer.files));
  }
});

// Sub-folder names are kept rather than flattened: the path is a hint the
// classifier uses when it is decisive.
function walk(entry, path, out) {
  return new Promise(function (done) {
    if (entry.isFile) {
      entry.file(function (f) { f._path = path; out.push(f); done(); }, done);
    } else if (entry.isDirectory) {
      var rd = entry.createReader();
      var all = [];
      (function read() {
        rd.readEntries(async function (batch) {
          if (!batch.length) {
            for (var i = 0; i < all.length; i++) await walk(all[i], path + '/' + entry.name, out);
            return done();
          }
          all = all.concat([].slice.call(batch));
          read();
        }, done);
      })();
    } else done();
  });
}

var MAX = 40 * 1024 * 1024;

async function start(files) {
  clearSay();
  if (!state.pid) { say('Pick a project first.', true); return; }
  files = files.filter(function (f) { return f && f.size >= 0 && !/^\\./.test(f.name); });
  if (!files.length) { say('That folder had no files in it.', true); return; }

  var r = await post('/api/intake/batch', { project_id: state.pid });
  if (!r || r.error) { say((r && r.error) || 'Could not open a batch.', true); return; }
  state.batch = r.id;

  $('prog').className = 'prog on';
  var done = 0, skipped = 0, tooBig = 0;
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    // Per file, with the name — never a bare spinner. Four hundred files takes
    // minutes and a countless spinner is indistinguishable from a hang.
    $('progLine').textContent = 'Reading ' + (i + 1) + ' of ' + files.length + ' \\u00B7 ' + f.name;
    $('barFill').style.width = Math.round(((i + 1) / files.length) * 100) + '%';
    if (f.size > MAX) { tooBig++; continue; }
    try {
      var body = {
        batch_id: state.batch, project_id: state.pid,
        filename: f.name, path: (f._path || f.webkitRelativePath || ''), mime: f.type,
        data: await toB64(f),
      };
      var res = await post('/api/intake/scan', body);
      if (res && res.skipped) skipped++;
      done++;
    } catch (e) { /* a file that fails to read fails alone */ }
  }
  $('progLine').textContent = 'Read ' + done + ' of ' + files.length +
    (tooBig ? ' \\u00B7 ' + tooBig + ' too large to store' : '') +
    (skipped ? ' \\u00B7 ' + skipped + ' outside this batch' : '');
  $('barFill').style.width = '100%';
  await loadReview();
}

function toB64(file) {
  return new Promise(function (ok, bad) {
    var fr = new FileReader();
    fr.onload = function () { ok(String(fr.result).split(',')[1] || ''); };
    fr.onerror = bad;
    fr.readAsDataURL(file);
  });
}

async function post(path, body) {
  var r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(body) });
  try { return await r.json(); } catch (e) { return null; }
}

/* ---------------------------------------------------------------- review */
var GROUPS = [
  ['ready', 'Ready to file', 'Nothing to decide here \\u2014 scan the number and move on.'],
  ['unverified', 'Filed without verification', 'The engine had no evidence either way. These WILL be filed; this is what you are taking on trust.'],
  ['decide', 'Needs a decision', 'The only group that needs work from you.'],
  ['held', 'Will be held', 'These go to the held queue instead of being filed. You are seeing why BEFORE anything is committed.'],
  ['unidentified', 'Not identified', 'Say what these are, or leave them out. Nothing is discarded and nothing is guessed at.'],
];

var FAMILY_CHOICES = ['drawing', 'specification', 'contract', 'programme', 'commercial', 'payment',
  'technical', 'quality', 'hse', 'authority', 'correspondence', 'minutes', 'site', 'handover',
  'template', 'logo', 'unknown'];

async function loadReview() {
  var r = await fetch('/api/intake/batch?id=' + encodeURIComponent(state.batch), { cache: 'no-store' });
  var d = await r.json();
  state.items = d.items || [];
  var c = d.counts || {};

  // On a later drop the interesting numbers are not "380 ready" but "12
  // revisions, 3 new, 38 already filed". Lead with what changed, or a DC who
  // cannot see a drop is mostly revisions stops checking.
  var line = '<b>' + c.total + ' files</b> \\u00B7 <b>' + c.ready + ' ready</b>' +
    ' \\u00B7 ' + c.unverified + ' filed without verification' +
    ' \\u00B7 ' + c.decide + ' need a decision' +
    ' \\u00B7 <b class="held">' + c.held + ' will be held</b>' +
    ' \\u00B7 ' + c.unidentified + ' not identified';
  if (c.already_filed) line += '<br><span class="sub">' + c.already_filed +
    ' already filed on this project \\u00B7 ' + c.fresh + ' new</span>';
  $('sumLine').innerHTML = line;

  $('groups').innerHTML = GROUPS.map(function (g) {
    var rows = state.items.filter(function (i) { return i.group === g[0]; });
    if (!rows.length) return '';
    return '<details class="grp' + (g[0] === 'held' ? ' warn' : '') + '"' +
      (g[0] === 'decide' || g[0] === 'held' ? ' open' : '') + '>' +
      '<summary><b>' + esc(g[1]) + '</b><span class="n">' + rows.length + '</span></summary>' +
      '<div class="why">' + esc(g[2]) + '</div>' +
      '<table><thead><tr><th>File</th><th>What it is</th><th>Why</th></tr></thead><tbody>' +
      rows.map(function (i) { return row(i, g[0]); }).join('') +
      '</tbody></table></details>';
  }).join('') || '<p class="sub">Nothing was read.</p>';

  $('reviewCard').className = 'card on';
  $('commitHint').textContent = c.held
    ? c.held + ' item' + (c.held === 1 ? '' : 's') + ' will go to the held queue, not the register.'
    : '';
  bindRows();
  await loadTerms();
}

function row(i, group) {
  var what = group === 'decide' || group === 'unidentified'
    ? '<select class="sm famsel" data-id="' + esc(i.id) + '">' +
      FAMILY_CHOICES.map(function (f) {
        return '<option value="' + f + '"' + (f === i.family ? ' selected' : '') + '>' + esc(f) + '</option>';
      }).join('') + '</select>'
    : esc(i.family_label || i.family);
  return '<tr><td class="f">' + esc(i.filename) +
    (i.path ? '<span class="path">' + esc(i.path) + '</span>' : '') +
    (i.already_filed ? '<span class="path">already filed on this project</span>' : '') +
    '</td><td>' + what + '</td><td><span class="reason">' + esc(i.reason) + '</span></td></tr>';
}

function bindRows() {
  [].forEach.call(document.querySelectorAll('.famsel'), function (sel) {
    sel.addEventListener('change', async function () {
      await post('/api/intake/confirm', { batch_id: state.batch,
        items: [{ id: this.dataset.id, family: this.value }] });
    });
  });
}

/* ---------------------------------------------------------------- commit */
$('commitBtn').addEventListener('click', async function () {
  var btn = this;
  btn.disabled = true;
  clearSay();
  var ids = state.items.filter(function (i) { return i.state !== 'filed' && i.state !== 'skipped'; })
                       .map(function (i) { return i.id; });
  if (!ids.length) { say('Nothing left to file.'); btn.disabled = false; return; }

  // Per item, in chunks. Four hundred drawings in one request would exhaust the
  // server, and a commit that stops at item 300 must leave the first 299 filed.
  var filed = 0, held = 0, failed = [];
  $('prog').className = 'prog on';
  for (var i = 0; i < ids.length; i += 10) {
    var chunk = ids.slice(i, i + 10);
    $('progLine').textContent = 'Filing ' + Math.min(i + chunk.length, ids.length) + ' of ' + ids.length;
    $('barFill').style.width = Math.round(((i + chunk.length) / ids.length) * 100) + '%';
    var r = await post('/api/intake/commit', { batch_id: state.batch, ids: chunk });
    (r && r.results || []).forEach(function (x) {
      if (x.held) held++;
      else if (x.ok && x.state === 'filed') filed++;
      else if (!x.ok) failed.push(x);
    });
  }
  $('progLine').textContent = 'Done.';
  $('result').innerHTML = '<p class="sumline"><b>' + filed + ' filed</b>' +
    (held ? ' \\u00B7 <b class="held">' + held + ' held</b>' : '') +
    (failed.length ? ' \\u00B7 ' + failed.length + ' failed' : '') + '</p>' +
    (held ? '<p class="sub">Held items are in the <a href="/app#quarantine">held queue</a> with their reason. ' +
            'Only AETRAA can release them.</p>' : '') +
    (failed.length ? '<table><thead><tr><th>Item</th><th>Why it failed</th></tr></thead><tbody>' +
      failed.map(function (f) { return '<tr><td class="f">' + esc(f.id) + '</td><td>' + esc(f.error) + '</td></tr>'; }).join('') +
      '</tbody></table><p class="sub">A failure is recorded on the item. Re-dropping the same folder retries only what did not land.</p>' : '');
  $('resultCard').className = 'card on';
  btn.disabled = false;
  await loadReview();
});

/* ---------------------------------------------------------------- terms */
async function loadTerms() {
  var contract = state.items.filter(function (i) { return i.family === 'contract'; });
  if (!contract.length) { $('termsCard').className = 'card'; return; }
  var r = await fetch('/api/intake/terms?batch=' + encodeURIComponent(state.batch), { cache: 'no-store' });
  if (!r.ok) { $('termsCard').className = 'card'; return; }
  var d = await r.json();
  state.terms = d.terms || [];
  if (!state.terms.length) { $('termsCard').className = 'card'; return; }

  $('terms').innerHTML = state.terms.map(function (t, n) {
    if (t.state === 'not_found') {
      return '<div class="term"><span></span><div><b>' + esc(t.label) + '</b>' +
        '<div class="cite">' + esc(t.note || 'not found') + '</div></div></div>';
    }
    var body = '<b>' + esc(t.label) + '</b>';
    if (t.state === 'conflict') {
      body += '<div class="note">' + esc(t.note) + '</div>' +
        t.options.map(function (o, k) {
          return '<label class="opt"><input type="radio" name="t' + n + '" value="' + esc(o.value) + '"> ' +
            esc(o.value) + (t.unit ? ' ' + esc(t.unit) : '') +
            ' <span class="cite">&mdash; p' + esc(o.page || '?') + ': &ldquo;' + esc(o.sentence) + '&rdquo;</span></label>';
        }).join('');
    } else {
      body += '<div class="val">' + esc(t.value) + (t.unit ? ' ' + esc(t.unit) : '') + '</div>' +
        (t.sentence ? '<div class="cite">p' + esc(t.page || '?') + ': &ldquo;' + esc(t.sentence) + '&rdquo;</div>' : '') +
        (t.note ? '<div class="note">' + esc(t.note) + '</div>' : '');
    }
    return '<div class="term' + (t.state === 'conflict' ? ' conflict' : '') + '">' +
      '<input type="checkbox" data-key="' + esc(t.key) + '" data-n="' + n + '">' +
      '<div>' + body + '</div></div>';
  }).join('');
  $('termsCard').className = 'card on';
}

$('termsBtn').addEventListener('click', async function () {
  clearSay();
  var picks = [];
  [].forEach.call(document.querySelectorAll('#terms input[type=checkbox]'), function (cb) {
    if (!cb.checked) return;
    var t = state.terms[Number(cb.dataset.n)];
    var value = t.value;
    if (t.state === 'conflict') {
      var chosen = document.querySelector('input[name=t' + cb.dataset.n + ']:checked');
      if (!chosen) return;                 // ticked but nothing chosen: not applied
      value = chosen.value;
    }
    picks.push({ key: t.key, value: value, accepted: true });
  });
  if (!picks.length) { say('Nothing ticked, so nothing was changed.', true); return; }
  var r = await post('/api/intake/terms', { batch_id: state.batch, project_id: state.pid, terms: picks });
  if (r && r.error) { say(r.error, true); return; }
  say(picks.length + ' term' + (picks.length === 1 ? '' : 's') + ' applied to the project.');
});
</script>
</body>
</html>`;
