import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK, SWITCHER_CSS } from './shared.js';

// K1 · v5 E7 and E8: the priced BOQ and the bill of materials.
//
//   1 the QS (or Procurement, for the BOM) uploads the bill
//   2 the platform reads every sheet and row, checks the totals, and flags
//     every line with no rate or a wrong sum
//   3 the QS fixes the file and uploads it again, or accepts each flagged line
//     with a reason; for the BOM, Procurement matches each material to a BOQ line
//   4 the PM approves: the BOQ is live for IPC valuation, the BOM for orders
//     and deliveries
//
// The page is a shell. What each person may do is decided by /api/bills; the
// buttons only follow what it says.
export const billsHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BOQ & BOM · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1100px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
.card h2 { margin: 0 0 8px; font-size: var(--fs-body); }
.card h3 { margin: 14px 0 6px; font-size: var(--fs-secondary); }
.state { font-size: var(--fs-secondary); padding: 10px 12px; border-radius: 8px; border-left: 3px solid var(--border); background: var(--surface-2); }
.state.pending { border-left-color: var(--serious); background: var(--serious-bg); color: var(--serious-text); }
.state.approved { border-left-color: var(--good-text); background: var(--good-bg); color: var(--good-text); }
.state.checking { border-left-color: var(--warning); }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-secondary); }
th, td { text-align: left; padding: 6px 6px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { font-size: var(--fs-secondary); color: var(--muted); font-weight: 500; }
td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
.src { font-size: var(--fs-secondary); color: var(--muted); line-height: 1.45; }
.tag { font-size: var(--fs-secondary); padding: 1px 6px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--border); white-space: nowrap; }
.tag.bad { border-color: var(--serious); color: var(--serious-text); background: var(--serious-bg); }
.tag.ok { border-color: var(--good-text); color: var(--good-text); background: var(--good-bg); }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
.row input[type=text] { flex: 1 1 260px; min-width: 0; padding: 7px 9px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--ink); font: inherit; font-size: var(--fs-secondary); }
.say { margin-top: 8px; font-size: var(--fs-secondary); }
.say.err { color: var(--serious-text); }
.scroll { max-height: 420px; overflow: auto; border: 1px solid var(--border); border-radius: 8px; }
.scroll table th { position: sticky; top: 0; background: var(--surface); }
details { margin-top: 8px; }
summary { cursor: pointer; font-size: var(--fs-secondary); }
select { max-width: 100%; font: inherit; font-size: var(--fs-secondary); padding: 5px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--ink); }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>BOQ &amp; BOM</h1><div class="sub" id="sub">read, checked, approved</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/">Dashboard</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>
<div class="wrap">
  <div class="card" id="boq"><h2>Priced BOQ</h2><div class="state">Loading…</div></div>
  <div class="card" id="bom"><h2>Bill of materials</h2><div class="state">Loading…</div></div>
</div>
<script>
var Q = new URLSearchParams(location.search).get('project') || '';
var STATE = null, CHECK = { boq: null, bom: null }, MATCH = null;
var NOUN = { boq: 'priced BOQ', bom: 'bill of materials' };
var WHO = { boq: 'the QS', bom: 'Procurement' };
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
function day(s){ return s ? String(s).slice(0, 16).replace('T', ' ') : ''; }
function api(path){ return path + (Q ? (path.indexOf('?') >= 0 ? '&' : '?') + 'project=' + encodeURIComponent(Q) : ''); }
async function get(path){ var r = await fetch(api(path), { cache: 'no-store' }); return r.json(); }
async function post(path, body){
  if (Q) body.project_id = Q;
  var r = await fetch(api(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}
function say(kind, text, err){
  var el = document.querySelector('#' + kind + ' .say');
  if (el) { el.textContent = text || ''; el.className = 'say' + (err ? ' err' : ''); }
}

async function load(){
  var d = await get('/api/bills');
  if (d.error) { document.querySelector('#boq .state').textContent = d.error; document.getElementById('bom').hidden = true; return; }
  STATE = d;
  document.getElementById('sub').textContent = (d.project && d.project.name ? d.project.name + ' · ' : '') + 'read, checked, approved';
  for (var k of ['boq', 'bom']) {
    var s = d[k];
    CHECK[k] = s.checking ? await get('/api/bills/check?id=' + encodeURIComponent(s.checking.id)) : null;
  }
  MATCH = d.bom && d.bom.lines ? await get('/api/bills/match') : null;
  render('boq'); render('bom');
}

function render(k){
  var card = document.getElementById(k), s = STATE[k], may = STATE.may || {};
  card.hidden = !(STATE.modules || {})[k];
  if (card.hidden) return;
  var canImport = k === 'boq' ? may.import_boq : may.import_bom;
  var h = '<h2>' + (k === 'boq' ? 'Priced BOQ' : 'Bill of materials') + '</h2>';
  var st = s.state;
  h += '<div class="state ' + st + '">';
  if (st === 'none') h += 'No ' + NOUN[k] + ' has been imported on this project.';
  else if (st === 'pending') h += 'Imported by ' + esc(s.imported_by) + ' on ' + esc(day(s.imported_at)) + ' — ' + s.lines + ' lines'
    + (s.total ? ', ' + esc(s.total) : '') + '. Waiting for the PM’s approval. '
    + (k === 'boq' ? 'No application for payment is valued against it until the PM approves it.' : 'No order or delivery is recorded against it until the PM approves it.');
  else h += s.lines + ' lines' + (s.total ? ', ' + esc(s.total) : '') + '. '
    + (s.legacy ? 'Imported before approval existed; treated as approved.' : 'Approved by ' + esc(s.approved_by) + ' on ' + esc(day(s.approved_at)) + '.');
  h += '</div>';
  if (st === 'pending' && may.approve) {
    var blocked = k === 'bom' && MATCH && MATCH.matching && MATCH.matching.open;
    h += '<div class="row"><button class="btn prim" data-act="approve" data-k="' + k + '"' + (blocked ? ' disabled' : '') + '>Approve the ' + NOUN[k] + '</button>'
      + (blocked ? '<span class="src">' + MATCH.matching.open + ' material(s) are not matched to a BOQ line yet. Procurement resolves them first.</span>' : '') + '</div>';
  }
  if (canImport) {
    h += '<div class="row"><label class="btn">Upload a ' + NOUN[k] + ' (.xlsx or .csv)<input type="file" accept=".xlsx,.xlsm,.csv" data-k="' + k + '" hidden></label>'
      + '<span class="src">Every sheet and every row is read and checked. Nothing is imported until every flagged line is fixed or accepted.</span></div>';
  }
  h += '<div class="say"></div>';
  var c = CHECK[k];
  if (c && !c.error) h += checkHTML(k, c, canImport);
  if (k === 'bom' && MATCH && MATCH.matching && MATCH.matching.lines.length) h += matchHTML(MATCH, canImport);
  card.innerHTML = h;
}

function checkHTML(k, c, canImport){
  var h = '<h3>Waiting to be checked: ' + esc(c.filename || 'rows sent to the platform') + '</h3>';
  h += '<p class="src">Read by ' + esc(c.reader) + (c.sha256 ? ' · file ' + esc(c.sha256.slice(0, 12)) : '') + ' · uploaded by ' + esc(c.created_by) + ' on ' + esc(day(c.created_at))
    + (c.filename ? ' · <a href="' + api('/api/bills/file?id=' + encodeURIComponent(c.id)) + '">the file as uploaded</a>' : '') + '</p>';
  h += '<p><b>' + c.line_count + ' lines · ' + esc(c.total) + '</b> · ' + (c.flags_open ? '<span class="tag bad">' + c.flags_open + ' flagged line(s) open</span>' : '<span class="tag ok">nothing open</span>')
    + (c.flags_total > c.flags_open ? ' · ' + (c.flags_total - c.flags_open) + ' accepted' : '') + '</p>';
  var sheets = c.sheets || [];
  if (sheets.length) {
    h += '<table><tr><th></th><th>Sheet</th><th>What happened</th><th class="n">Lines</th><th>Header row</th><th>Columns read</th></tr>';
    sheets.forEach(function(s, i){
      var choosable = s.status === 'read' || /^not imported/.test(s.status);
      h += '<tr><td>' + (choosable && canImport && c.filename ? '<input type="checkbox" data-sheet="' + esc(s.name) + '"' + (s.status === 'read' ? ' checked' : '') + '>' : '') + '</td>'
        + '<td>' + esc(s.name) + (s.hidden ? ' <span class="tag">hidden</span>' : '') + '</td><td>' + esc(s.status) + '</td><td class="n">' + (s.lines || 0) + '</td>'
        + '<td>' + (s.header_row || '—') + '</td><td class="src">' + Object.keys(s.columns || {}).map(function(f){ return esc(f) + ' ← ' + esc(s.columns[f]); }).join(', ')
        + ((s.unmapped || []).length ? '<br>not used: ' + s.unmapped.map(esc).join(', ') : '') + '</td></tr>';
    });
    h += '</table>';
    if (canImport && c.filename) h += '<div class="row"><button class="btn" data-act="sheets" data-k="' + k + '">Read again with the ticked sheets</button></div>';
  }
  var tot = (c.totals || {}).checked_totals || [];
  if (tot.length) {
    h += '<h3>The bill’s own totals</h3><table><tr><th>Sheet</th><th class="n">Row</th><th>Total</th><th class="n">The bill says</th><th class="n">Its lines add up to</th><th></th></tr>'
      + tot.map(function(t){ return '<tr><td>' + esc(t.sheet) + '</td><td class="n">' + t.row + '</td><td>' + esc(t.text) + '</td><td class="n">' + esc(t.stated == null ? '—' : t.stated) + '</td><td class="n">' + esc(t.lines_add_up_to) + '</td><td>' + (t.ok ? '<span class="tag ok">adds up</span>' : '<span class="tag bad">does not add up</span>') + '</td></tr>'; }).join('') + '</table>';
  }
  var sec = (c.totals || {}).by_section || [];
  if (sec.length > 1) {
    h += '<details><summary>By section (' + sec.length + ')</summary><table><tr><th>Section</th><th class="n">Total</th></tr>'
      + sec.map(function(s){ return '<tr><td>' + esc(s.section) + '</td><td class="n">' + esc(s.total) + '</td></tr>'; }).join('') + '</table></details>';
  }
  var flags = c.flags || [];
  if (flags.length) {
    h += '<h3>Flagged lines</h3><div class="scroll"><table><tr><th></th><th>Sheet</th><th class="n">Row</th><th>Ref</th><th>Description</th><th>Why</th><th>Accepted</th></tr>'
      + flags.map(function(f){
        return '<tr><td>' + (!f.accepted && canImport ? '<input type="checkbox" data-flag="' + esc(f.id) + '">' : '') + '</td><td>' + esc(f.sheet) + '</td><td class="n">' + esc(f.row) + '</td><td>' + esc(f.ref) + '</td>'
          + '<td>' + esc(String(f.description || '').slice(0, 90)) + '</td><td>' + esc(f.text) + '</td>'
          + '<td class="src">' + (f.accepted ? esc(f.accepted.by) + ', ' + esc(day(f.accepted.at)) + '<br>“' + esc(f.accepted.note) + '”' : '<span class="tag bad">open</span>') + '</td></tr>';
      }).join('') + '</table></div>';
    if (canImport && c.flags_open) {
      h += '<div class="row"><input type="text" data-note="' + k + '" placeholder="Why these lines are right as they are — kept with the bill">'
        + '<button class="btn" data-act="accept" data-k="' + k + '">Accept the ticked lines</button>'
        + '<button class="btn" data-act="accept-all" data-k="' + k + '">Accept all ' + c.flags_open + '</button></div>'
        + '<p class="src">Or fix the file and upload it again: the new upload replaces this check.</p>';
    }
  }
  var nr = c.rows_not_read || [];
  if (nr.length) {
    h += '<details><summary>Rows not read as lines (' + nr.reduce(function(a, g){ return a + g.count; }, 0) + ')</summary><table><tr><th>Why</th><th class="n">Rows</th><th>Where</th></tr>'
      + nr.map(function(g){ return '<tr><td>' + esc(g.why) + '</td><td class="n">' + g.count + '</td><td class="src">' + g.rows.slice(0, 12).map(function(r){ return esc((r.sheet ? r.sheet + ' ' : '') + 'row ' + r.row + (r.text ? ': ' + String(r.text).slice(0, 40) : '')); }).join('<br>') + (g.count > 12 ? '<br>…' : '') + '</td></tr>'; }).join('') + '</table></details>';
  }
  var lines = c.lines || [];
  if (lines.length) {
    h += '<details><summary>The lines as read (' + c.line_count + (c.lines_shown < c.line_count ? ', first ' + c.lines_shown + ' shown' : '') + ')</summary><div class="scroll"><table><tr><th>Sheet</th><th class="n">Row</th><th>Section</th><th>Ref</th><th>Description</th><th>Unit</th><th class="n">Qty</th>' + (k === 'boq' ? '<th class="n">Rate</th><th class="n">Amount</th>' : '<th>BOQ ref</th><th>Discipline</th>') + '</tr>'
      + lines.slice(0, 1000).map(function(l){ return '<tr><td>' + esc(l.sheet) + '</td><td class="n">' + esc(l.row) + '</td><td>' + esc(l.section) + '</td><td>' + esc(l.ref) + '</td><td>' + esc(String(l.description).slice(0, 80)) + '</td><td>' + esc(l.unit) + '</td><td class="n">' + esc(l.qty) + '</td>'
        + (k === 'boq' ? '<td class="n">' + esc(l.rate) + '</td><td class="n">' + esc(l.amount) + '</td>' : '<td>' + esc(l.boq_ref) + '</td><td>' + esc(l.discipline) + '</td>') + '</tr>'; }).join('') + '</table></div></details>';
  }
  if (canImport) {
    h += '<div class="row"><button class="btn prim" data-act="commit" data-k="' + k + '"' + (c.flags_open ? ' disabled' : '') + '>Import this ' + NOUN[k] + '</button>'
      + '<button class="btn" data-act="discard" data-k="' + k + '">Discard this upload</button>'
      + (c.flags_open ? '<span class="src">Every flagged line must be fixed or accepted first.</span>' : '<span class="src">After the import it waits for the PM’s approval.</span>') + '</div>';
  }
  return h;
}

function matchHTML(M, canImport){
  var m = M.matching;
  var h = '<h3>Each material against the BOQ</h3><p class="src">' + m.matched + ' matched · ' + m.not_in_boq + ' not in the BOQ · ' + m.proposed + ' proposed · ' + m.unmatched + ' unmatched. '
    + 'A match by the BOQ reference column is taken as it is; a match by name is only a proposal until Procurement confirms it.</p>';
  if (canImport && m.proposed) h += '<div class="row"><button class="btn" data-act="confirm-all">Confirm every proposed match</button></div>';
  var opts = (M.boq || []).map(function(b){ return '<option value="' + esc(b.key) + '">' + esc((b.section ? b.section + ' · ' : '') + b.label) + '</option>'; }).join('');
  h += '<div class="scroll"><table><tr><th>Material</th><th>Discipline</th><th class="n">Budget</th><th>State</th><th>BOQ line(s)</th>' + (canImport ? '<th></th>' : '') + '</tr>';
  m.lines.forEach(function(l){
    var links = l.links.map(function(x){ return esc(x.boq_label) + ' <span class="tag' + (x.state === 'confirmed' ? ' ok' : '') + '">' + (x.state === 'confirmed' ? (x.how === 'ref' ? 'by reference' : 'confirmed') : 'proposed') + '</span>'; }).join('<br>');
    h += '<tr><td>' + esc(l.material) + '</td><td>' + esc(l.discipline || '') + '</td><td class="n">' + esc(l.budget_qty) + ' ' + esc(l.unit || '') + '</td>'
      + '<td>' + (l.state === 'matched' || l.state === 'not in the BOQ' ? '<span class="tag ok">' + esc(l.state) + '</span>' : '<span class="tag bad">' + esc(l.state) + '</span>') + '</td>'
      + '<td class="src">' + (links || (l.note ? '“' + esc(l.note) + '”' : '—')) + '</td>';
    if (canImport) {
      h += '<td>';
      if (l.state === 'proposed') h += '<button class="btn" data-act="confirm" data-m="' + esc(l.mkey) + '">Confirm</button> ';
      if (l.state === 'proposed' || l.state === 'unmatched') {
        h += '<select data-pick="' + esc(l.mkey) + '"><option value="">Choose a BOQ line…</option>' + opts + '</select> <button class="btn" data-act="link" data-m="' + esc(l.mkey) + '">Link</button> '
          + '<button class="btn" data-act="none" data-m="' + esc(l.mkey) + '">Not in the BOQ</button>';
      }
      h += '</td>';
    }
    h += '</tr>';
  });
  return h + '</table></div>';
}

function readFile(file){
  return new Promise(function(ok, no){
    var fr = new FileReader();
    fr.onload = function(){ var s = String(fr.result); ok(s.slice(s.indexOf(',') + 1)); };
    fr.onerror = function(){ no(fr.error); };
    fr.readAsDataURL(file);
  });
}

document.addEventListener('change', async function(e){
  var t = e.target;
  if (t.type !== 'file' || !t.files || !t.files[0]) return;
  var k = t.getAttribute('data-k'), f = t.files[0];
  say(k, 'Reading ' + f.name + '…');
  var d = await post('/api/bills/upload', { kind: k, filename: f.name, data: await readFile(f) });
  t.value = '';
  if (d.error) { say(k, d.error, true); return; }
  await load();
  say(k, d.line_count + ' lines read, ' + d.total + '. ' + (d.flags_open ? d.flags_open + ' flagged line(s) to fix or accept.' : 'Nothing flagged — it can be imported.'));
});

document.addEventListener('click', async function(e){
  var b = e.target.closest('button[data-act]');
  if (!b) return;
  var act = b.getAttribute('data-act'), k = b.getAttribute('data-k') || 'bom', c = CHECK[k], card = document.getElementById(k);
  var d;
  b.disabled = true;
  try {
    if (act === 'approve') d = await post('/api/bills/approve', { kind: k });
    else if (act === 'commit') d = await post('/api/bills/commit', { id: c.id });
    else if (act === 'discard') d = await post('/api/bills/discard', { id: c.id });
    else if (act === 'sheets') {
      var inc = [].slice.call(card.querySelectorAll('input[data-sheet]:checked')).map(function(x){ return x.getAttribute('data-sheet'); });
      d = await post('/api/bills/sheets', { id: c.id, include_sheets: inc });
    } else if (act === 'accept' || act === 'accept-all') {
      var note = (card.querySelector('input[data-note]') || {}).value || '';
      var body = { id: c.id, note: note };
      if (act === 'accept-all') body.all = true;
      else body.flags = [].slice.call(card.querySelectorAll('input[data-flag]:checked')).map(function(x){ return x.getAttribute('data-flag'); });
      d = await post('/api/bills/accept', body);
    } else if (act === 'confirm-all') d = await post('/api/bills/match', { confirm_all: true });
    else if (act === 'confirm') {
      var mk = b.getAttribute('data-m'), line = MATCH.matching.lines.find(function(l){ return l.mkey === mk; });
      d = await post('/api/bills/match', { mkey: mk, confirm: line.links.filter(function(x){ return x.state === 'proposed'; }).map(function(x){ return x.id; }) });
    } else if (act === 'link') {
      var mk2 = b.getAttribute('data-m'), sel = card.querySelector('select[data-pick="' + CSS.escape(mk2) + '"]');
      if (!sel || !sel.value) { say(k, 'Choose the BOQ line first.', true); b.disabled = false; return; }
      d = await post('/api/bills/match', { mkey: mk2, link: [sel.value] });
    } else if (act === 'none') {
      var why = prompt('Why is this material not in the BOQ? (for example: temporary works)');
      if (why == null) { b.disabled = false; return; }
      d = await post('/api/bills/match', { mkey: b.getAttribute('data-m'), not_in_boq: why });
    }
  } catch (err) { d = { error: 'That did not reach the platform — check the connection and try again.' }; }
  if (d && d.error) { b.disabled = false; say(k, d.error, true); return; }
  await load();
  if (act === 'commit') say(k, 'Imported: ' + d.lines + ' lines, ' + d.total + '. It now waits for the PM’s approval.');
  if (act === 'approve') say(k, 'Approved.');
});
load();
</script>
</body>
</html>`;
