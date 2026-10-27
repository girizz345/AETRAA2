import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK } from './shared.js';

// STEP 8 — meeting minutes and the action tracker, as one page.
//   Minutes: write a draft (attendance, matters arising, items, actions), check
//            it, issue it. Issued minutes are read-only and download as Word.
//   Actions: every action from every issued meeting — open, mine, overdue —
//            closed or re-dated with a note, and the whole log as Excel.
export const minutesPageHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Meetings & actions</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}
.wrap { max-width: 1080px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; box-shadow: var(--shadow); margin: 0 0 14px; }
.card h2 { font-size: 15px; margin: 0 0 8px; }
.card h3 { font-size: 13px; margin: 16px 0 6px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.hint { font-size: 13px; color: var(--muted); line-height: 1.5; }
.btn { font: inherit; font-size: 13.5px; padding: 8px 14px; border-radius: 9px; border: 1px solid var(--border); background: var(--surface-2); color: var(--ink); cursor: pointer; text-decoration: none; display: inline-block; }
.btn.prim { background: var(--series-1); border-color: var(--series-1); color: #fff; }
.btn.sm { padding: 4px 9px; font-size: 12.5px; }
.btn[disabled] { opacity: .5; cursor: default; }
.row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; }
.tabs { display: flex; gap: 6px; margin: 0 0 14px; flex-wrap: wrap; }
.tabs .btn[aria-pressed="true"] { background: var(--series-1); color: #fff; border-color: var(--series-1); }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; font-size: 11px; text-transform: uppercase; color: var(--muted); padding: 6px 8px; border-bottom: 1px solid var(--border); }
td { padding: 6px 8px; border-bottom: 1px solid var(--grid); vertical-align: top; }
input[type=text], input[type=date], input[type=time], select, textarea { font: inherit; font-size: 13px; padding: 6px 8px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--surface-2); color: var(--ink); width: 100%; box-sizing: border-box; }
textarea { min-height: 54px; resize: vertical; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
.grid label, .item label { font-size: 11.5px; font-weight: 600; color: var(--muted); display: block; margin-bottom: 3px; }
.item { border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; margin: 10px 0; background: var(--surface-2); }
.act { display: grid; grid-template-columns: 1fr 190px 150px 30px; gap: 6px; margin-top: 6px; }
@media (max-width: 720px) { .act { grid-template-columns: 1fr; } }
.pill { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11.5px; font-weight: 600; }
.pill.draft { background: color-mix(in srgb, var(--gold, #b6761d) 18%, transparent); color: var(--gold, #8a5a12); }
.pill.issued, .pill.closed { background: color-mix(in srgb, var(--good-text) 15%, transparent); color: var(--good-text); }
.pill.open { background: color-mix(in srgb, var(--series-1) 14%, transparent); color: var(--series-1); }
.pill.late { background: color-mix(in srgb, var(--critical) 14%, transparent); color: var(--critical); }
.checks { border-radius: 9px; padding: 10px 12px; font-size: 13px; margin-top: 10px; }
.checks.bad { background: color-mix(in srgb, var(--critical) 10%, transparent); }
.checks.warn { background: color-mix(in srgb, var(--gold, #b6761d) 12%, transparent); }
.checks ul { margin: 6px 0 0 18px; padding: 0; }
.msg { padding: 10px 14px; border-radius: 9px; margin: 0 0 14px; font-size: 13.5px; display: none; }
.msg.ok { background: color-mix(in srgb, var(--good-text) 14%, transparent); color: var(--good-text); display: block; }
.msg.err { background: color-mix(in srgb, var(--critical) 14%, transparent); color: var(--critical); display: block; }
.paper { background: #fff; color: #1b2437; border: 1px solid var(--border); border-radius: 12px; padding: 22px 24px; overflow-x: auto; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Meetings &amp; actions</h1><div class="sub" id="projName">minutes and the action tracker</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/">Back to dashboard</a>
</div></div>
<div class="wrap">
  <div class="msg" id="msg"></div>
  <div class="tabs">
    <button class="btn" id="tMinutes" aria-pressed="true">Minutes</button>
    <button class="btn" id="tActions" aria-pressed="false">Action tracker</button>
    <span style="flex:1"></span>
    <button class="btn prim" id="newBtn" hidden>＋ New minutes</button>
  </div>
  <div id="view"><div class="card hint">Loading…</div></div>
</div>
<script>
var S = { tab: 'minutes', meetings: [], types: {}, may: {}, team: [], me: '', draft: null, filter: 'open', actions: [], mayAny: false };
var view = document.getElementById('view');
function esc(v){ return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function today(){ return new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10); }
function say(t, bad){ var m = document.getElementById('msg'); m.textContent = t; m.className = 'msg ' + (bad ? 'err' : 'ok'); if (!bad) setTimeout(function(){ m.className = 'msg'; }, 4000); window.scrollTo(0, 0); }
function get(u){ return fetch(u, { cache: 'no-store' }).then(function(r){ return r.json(); }); }
function post(u, b){ return fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
  .then(function(r){ return r.json().then(function(j){ j.__status = r.status; return j; }); }); }

function tab(t){
  S.tab = t;
  document.getElementById('tMinutes').setAttribute('aria-pressed', String(t === 'minutes'));
  document.getElementById('tActions').setAttribute('aria-pressed', String(t === 'actions'));
  if (t === 'actions') loadActions(); else loadMeetings();
}
document.getElementById('tMinutes').onclick = function(){ tab('minutes'); };
document.getElementById('tActions').onclick = function(){ tab('actions'); };
document.getElementById('newBtn').onclick = function(){ newDraft(); };

/* ------------------------------------------------------------ the list */
function loadMeetings(){
  return get('/api/meetings').then(function(d){
    S.meetings = d.meetings || []; S.types = d.types || {}; S.may = d.may || {}; S.team = d.team || []; S.me = d.me || '';
    if (d.project && d.project.name) document.getElementById('projName').textContent = d.project.name;
    document.getElementById('newBtn').hidden = !S.may.write;
    var q = new URLSearchParams(location.search);
    if (q.get('ref') && !S.opened) { S.opened = true; return openMeeting(q.get('ref')); }
    listView();
  }).catch(function(){ view.innerHTML = '<div class="card hint">Could not load.</div>'; });
}
function listView(){
  var ms = S.meetings;
  view.innerHTML = '<div class="card"><h2>Minutes of meetings</h2>' +
    (ms.length ? '<table><tr><th>Ref</th><th>Meeting</th><th>Date</th><th>Status</th><th>Actions</th><th></th></tr>' +
      ms.map(function(m){
        return '<tr><td><b>' + esc(m.ref) + '</b></td><td>' + esc(m.title) + '<div class="hint">' + esc(m.type_label) + '</div></td><td>' + esc(m.meeting_date || '—') +
          '</td><td><span class="pill ' + m.status + '">' + (m.status === 'draft' ? 'Draft' : 'Issued ' + esc(m.issued_at || '')) + '</span></td><td>' +
          (m.status === 'draft' ? '—' : m.actions + ' raised · ' + m.open_actions + ' open') + '</td><td>' +
          '<button class="btn sm" data-open="' + esc(m.ref) + '">' + (m.status === 'draft' && S.may.write ? 'Edit' : 'Open') + '</button> ' +
          '<a class="btn sm" href="/api/meeting/doc?ref=' + encodeURIComponent(m.ref) + '">Word</a></td></tr>';
      }).join('') + '</table>'
      : '<div class="hint">No minutes yet.' + (S.may.write ? ' Press “New minutes” after your next meeting.' : '') + '</div>') + '</div>';
  view.querySelectorAll('[data-open]').forEach(function(b){ b.onclick = function(){ openMeeting(this.getAttribute('data-open')); }; });
}

/* ------------------------------------------------------------ the editor */
function blankItem(n){ return { no: String(n), subject: '', discussion: '', decision: '', actions: [] }; }
function newDraft(){
  S.draft = { ref: '', type: 'progress', title: '', meeting_date: today(), start_time: '', location: '', chair: '', next_meeting: '',
    attendees: [], items: [blankItem(1)], arising: [], arising_open: [], status: 'draft' };
  editView();
}
function openMeeting(ref){
  return get('/api/meeting?ref=' + encodeURIComponent(ref)).then(function(d){
    if (!d.meeting) { say(d.error || 'Not found', true); return listView(); }
    if (d.meeting.status === 'draft' && S.may.write) { S.draft = d.meeting; editView(d.checks); }
    else readView(d.meeting);
  });
}
function readView(m){
  view.innerHTML = '<div class="card"><div class="row" style="margin:0 0 12px"><button class="btn" id="backBtn">‹ All minutes</button>' +
    '<a class="btn prim" href="/api/meeting/doc?ref=' + encodeURIComponent(m.ref) + '">Download Word</a></div><div class="paper" id="paper">Loading…</div></div>';
  document.getElementById('backBtn').onclick = function(){ loadMeetings(); };
  fetch('/api/meeting/doc?ref=' + encodeURIComponent(m.ref) + '&view=1', { cache: 'no-store' }).then(function(r){ return r.text(); })
    .then(function(h){ document.getElementById('paper').innerHTML = h; });
}
function ownerSelect(a, ii, ai){
  var opts = '<option value="">— who —</option>' + S.team.map(function(u){
    return '<option value="u:' + esc(u.id) + '"' + (a.owner_user_id === u.id ? ' selected' : '') + '>' + esc(u.name) + '</option>'; }).join('') +
    '<option value="x"' + (!a.owner_user_id && a.owner_name ? ' selected' : '') + '>Someone else (type the name)…</option>';
  return '<div><select data-f="owner" data-i="' + ii + '" data-a="' + ai + '">' + opts + '</select>' +
    (!a.owner_user_id && (a.owner_name || a.__other) ? '<input type="text" data-f="owner_name" data-i="' + ii + '" data-a="' + ai + '" value="' + esc(a.owner_name) + '" placeholder="e.g. Engineer (Dar Consult)" style="margin-top:4px">' : '') + '</div>';
}
function editView(checks){
  var d = S.draft, isNew = !d.ref;
  var typeOpts = Object.keys(S.types).map(function(k){ return '<option value="' + k + '"' + (d.type === k ? ' selected' : '') + '>' + esc(S.types[k].label) + '</option>'; }).join('');
  var arising = (d.arising_open || []);
  var dec = {}; (d.arising || []).forEach(function(a){ dec[a.ref] = a; });
  var h = '<div class="card"><div class="row" style="margin:0 0 10px"><button class="btn" id="backBtn">‹ All minutes</button><span class="hint">' +
    (isNew ? 'New minutes — nothing is numbered until you save.' : esc(d.ref) + ' · draft by ' + esc(d.prepared_by || '')) + '</span></div>' +
    '<div class="grid">' +
      '<div><label>Meeting</label>' + (isNew ? '<select data-top="type">' + typeOpts + '</select>' : '<input type="text" value="' + esc((S.types[d.type] || {}).label || d.type) + '" disabled>') + '</div>' +
      '<div><label>Title</label><input type="text" data-top="title" value="' + esc(d.title) + '" placeholder="e.g. Progress meeting no. 12"></div>' +
      '<div><label>Date</label><input type="date" data-top="meeting_date" value="' + esc(d.meeting_date) + '"></div>' +
      '<div><label>Time</label><input type="time" data-top="start_time" value="' + esc(d.start_time) + '"></div>' +
      '<div><label>Location</label><input type="text" data-top="location" value="' + esc(d.location) + '"></div>' +
      '<div><label>Chaired by</label><input type="text" data-top="chair" value="' + esc(d.chair) + '"></div>' +
      '<div><label>Next meeting</label><input type="text" data-top="next_meeting" value="' + esc(d.next_meeting) + '" placeholder="date, time, place"></div>' +
    '</div>' +
    '<h3>Attendance</h3><table><tr><th>Name</th><th>Company / role</th><th>Present</th><th></th></tr>' +
    d.attendees.map(function(a, i){
      return '<tr><td><input type="text" data-att="name" data-i="' + i + '" value="' + esc(a.name) + '"></td><td><input type="text" data-att="company" data-i="' + i + '" value="' + esc(a.company) + '"></td>' +
        '<td><input type="checkbox" data-att="present" data-i="' + i + '"' + (a.present !== false ? ' checked' : '') + '></td><td><button class="btn sm" data-attdel="' + i + '">✕</button></td></tr>';
    }).join('') + '</table>' +
    '<div class="row"><button class="btn sm" id="attAdd">Add a person</button><button class="btn sm" id="attTeam">Add the project team</button></div>';
  if (arising.length) {
    h += '<h3>Matters arising — actions still open from earlier meetings of this kind</h3><table><tr><th>Ref</th><th>Action</th><th>By</th><th>Due</th><th>At this meeting</th></tr>' +
      arising.map(function(a){
        var x = dec[a.ref] || { decision: 'carry', note: '', due: '' };
        var late = a.due && a.due < (d.meeting_date || today());
        return '<tr><td><b>' + esc(a.ref) + '</b><div class="hint">' + esc(a.meeting_ref) + '</div></td><td>' + esc(a.text) + '</td><td>' + esc(a.owner_name) + '</td><td>' +
          (late ? '<span class="pill late">' + esc(a.due) + '</span>' : esc(a.due)) + '</td><td>' +
          '<select data-ar="decision" data-ref="' + esc(a.ref) + '"><option value="carry"' + (x.decision === 'carry' ? ' selected' : '') + '>Carried forward</option>' +
          '<option value="close"' + (x.decision === 'close' ? ' selected' : '') + '>Closed</option><option value="redate"' + (x.decision === 'redate' ? ' selected' : '') + '>New date</option></select>' +
          (x.decision !== 'carry' ? '<input type="text" data-ar="note" data-ref="' + esc(a.ref) + '" value="' + esc(x.note) + '" placeholder="' + (x.decision === 'close' ? 'what was done' : 'why the date moves') + '" style="margin-top:4px">' : '') +
          (x.decision === 'redate' ? '<input type="date" data-ar="due" data-ref="' + esc(a.ref) + '" value="' + esc(x.due) + '" style="margin-top:4px">' : '') + '</td></tr>';
      }).join('') + '</table>';
  }
  h += '<h3>Items discussed</h3>' + d.items.map(function(it, i){
    return '<div class="item"><div class="grid" style="grid-template-columns:70px 1fr 34px"><div><label>No</label><input type="text" data-it="no" data-i="' + i + '" value="' + esc(it.no) + '"></div>' +
      '<div><label>Subject</label><input type="text" data-it="subject" data-i="' + i + '" value="' + esc(it.subject) + '"></div>' +
      '<div><label>&nbsp;</label><button class="btn sm" data-itdel="' + i + '" title="Remove this item">✕</button></div></div>' +
      '<label style="margin-top:6px">Discussion</label><textarea data-it="discussion" data-i="' + i + '">' + esc(it.discussion) + '</textarea>' +
      '<label style="margin-top:6px">Agreed / decision</label><textarea data-it="decision" data-i="' + i + '" style="min-height:36px">' + esc(it.decision) + '</textarea>' +
      (it.actions || []).map(function(a, ai){
        return '<div class="act"><input type="text" data-ac="text" data-i="' + i + '" data-a="' + ai + '" value="' + esc(a.text) + '" placeholder="Action — what is to be done">' +
          ownerSelect(a, i, ai) + '<input type="date" data-ac="due" data-i="' + i + '" data-a="' + ai + '" value="' + esc(a.due) + '">' +
          '<button class="btn sm" data-acdel="' + i + ':' + ai + '">✕</button></div>';
      }).join('') +
      '<div class="row"><button class="btn sm" data-acadd="' + i + '">Add an action</button></div></div>';
  }).join('') +
  '<div class="row"><button class="btn sm" id="itAdd">Add an item</button></div>' +
  '<div id="checks">' + checksHTML(checks) + '</div>' +
  '<div class="row" style="margin-top:14px"><button class="btn prim" id="saveBtn">Save draft</button>' +
    (d.ref ? '<button class="btn" id="checkBtn">Check</button>' : '') +
    (d.ref && S.may.issue ? '<button class="btn prim" id="issueBtn">Issue the minutes</button>' : '') +
    (d.ref ? '<a class="btn" href="/api/meeting/doc?ref=' + encodeURIComponent(d.ref) + '">Draft (Word)</a><button class="btn" id="discardBtn">Discard draft</button>' : '') + '</div>' +
  '<div class="hint" style="margin-top:8px">' + (S.may.issue ? 'Issuing numbers every action (AI-001…), tells each owner on the platform, and puts them in the action tracker. Issued minutes are not edited.'
    : 'The PM, the Principal or Document Control issues the minutes.') + '</div></div>';
  view.innerHTML = h;
  wireEditor();
}
function checksHTML(c){
  if (!c) return '';
  return (c.blockers && c.blockers.length ? '<div class="checks bad"><b>Before these minutes can be issued:</b><ul>' + c.blockers.map(function(b){ return '<li>' + esc(b) + '</li>'; }).join('') + '</ul></div>' : '') +
    (c.warnings && c.warnings.length ? '<div class="checks warn"><b>Worth a look:</b><ul>' + c.warnings.map(function(b){ return '<li>' + esc(b) + '</li>'; }).join('') + '</ul></div>' : '') +
    (c.ok && !(c.warnings || []).length ? '<div class="checks" style="background:color-mix(in srgb, var(--good-text) 12%, transparent)">Ready to issue.</div>' : '');
}
function arisingEntry(ref){
  var d = S.draft; d.arising = d.arising || [];
  var x = d.arising.filter(function(a){ return a.ref === ref; })[0];
  if (!x) { x = { ref: ref, decision: 'carry', note: '', due: '' }; d.arising.push(x); }
  return x;
}
function wireEditor(){
  var d = S.draft;
  document.getElementById('backBtn').onclick = function(){ S.draft = null; loadMeetings(); };
  view.querySelectorAll('[data-top]').forEach(function(el){ el.oninput = el.onchange = function(){ d[this.getAttribute('data-top')] = this.value; }; });
  view.querySelectorAll('[data-att]').forEach(function(el){ el.oninput = el.onchange = function(){
    var a = d.attendees[+this.getAttribute('data-i')], k = this.getAttribute('data-att'); a[k] = k === 'present' ? this.checked : this.value; }; });
  view.querySelectorAll('[data-attdel]').forEach(function(el){ el.onclick = function(){ d.attendees.splice(+this.getAttribute('data-attdel'), 1); editView(); }; });
  document.getElementById('attAdd').onclick = function(){ d.attendees.push({ name: '', company: '', present: true }); editView(); };
  document.getElementById('attTeam').onclick = function(){
    var have = {}; d.attendees.forEach(function(a){ have[a.name] = 1; });
    S.team.forEach(function(u){ if (!have[u.name]) d.attendees.push({ name: u.name, company: u.role || '', present: true }); });
    editView();
  };
  view.querySelectorAll('[data-ar]').forEach(function(el){ el.oninput = el.onchange = function(){
    var x = arisingEntry(this.getAttribute('data-ref')), k = this.getAttribute('data-ar'); x[k] = this.value; if (k === 'decision') editView(); }; });
  view.querySelectorAll('[data-it]').forEach(function(el){ el.oninput = function(){ d.items[+this.getAttribute('data-i')][this.getAttribute('data-it')] = this.value; }; });
  view.querySelectorAll('[data-itdel]').forEach(function(el){ el.onclick = function(){ d.items.splice(+this.getAttribute('data-itdel'), 1); editView(); }; });
  document.getElementById('itAdd').onclick = function(){ d.items.push(blankItem(d.items.length + 1)); editView(); };
  view.querySelectorAll('[data-acadd]').forEach(function(el){ el.onclick = function(){ d.items[+this.getAttribute('data-acadd')].actions.push({ text: '', owner_user_id: '', owner_name: '', due: '' }); editView(); }; });
  view.querySelectorAll('[data-acdel]').forEach(function(el){ el.onclick = function(){ var p = this.getAttribute('data-acdel').split(':'); d.items[+p[0]].actions.splice(+p[1], 1); editView(); }; });
  view.querySelectorAll('[data-ac]').forEach(function(el){ el.oninput = el.onchange = function(){ d.items[+this.getAttribute('data-i')].actions[+this.getAttribute('data-a')][this.getAttribute('data-ac')] = this.value; }; });
  view.querySelectorAll('[data-f]').forEach(function(el){ el.oninput = el.onchange = function(){
    var a = d.items[+this.getAttribute('data-i')].actions[+this.getAttribute('data-a')];
    if (this.getAttribute('data-f') === 'owner_name') { a.owner_name = this.value; return; }
    var v = this.value;
    if (v.indexOf('u:') === 0) { var u = S.team.filter(function(t){ return t.id === v.slice(2); })[0]; a.owner_user_id = u ? u.id : ''; a.owner_name = u ? u.name : ''; a.__other = false; }
    else if (v === 'x') { a.owner_user_id = ''; a.owner_name = ''; a.__other = true; }
    else { a.owner_user_id = ''; a.owner_name = ''; a.__other = false; }
    editView();
  }; });
  document.getElementById('saveBtn').onclick = function(){ save(); };
  var ck = document.getElementById('checkBtn'); if (ck) ck.onclick = function(){ save().then(function(ok){ if (ok) refreshChecks(); }); };
  var is = document.getElementById('issueBtn'); if (is) is.onclick = function(){ save().then(function(ok){ if (ok) issue(); }); };
  var ds = document.getElementById('discardBtn'); if (ds) ds.onclick = function(){
    if (!confirm('Discard draft ' + d.ref + '? It is deleted.')) return;
    post('/api/meeting/discard', { ref: d.ref }).then(function(r){ if (r.error) return say(r.error, true); S.draft = null; say('Draft discarded.'); loadMeetings(); });
  };
}
function save(){
  var d = S.draft;
  return post('/api/meeting', d).then(function(r){
    if (r.error) { say(r.error, true); return false; }
    var wasNew = !d.ref;
    S.draft = r.meeting; say((wasNew ? r.ref + ' created' : 'Saved') + ' — still a draft.');
    editView(); return true;
  }).catch(function(){ say('Could not reach the server.', true); return false; });
}
function refreshChecks(){
  return get('/api/meeting?ref=' + encodeURIComponent(S.draft.ref)).then(function(d){ document.getElementById('checks').innerHTML = checksHTML(d.checks); });
}
function issue(){
  var d = S.draft;
  if (!confirm('Issue ' + d.ref + '? The minutes are then fixed, and every action goes to its owner.')) return;
  post('/api/meeting/issue', { ref: d.ref }).then(function(r){
    if (r.error) { document.getElementById('checks').innerHTML = checksHTML(r.checks || { blockers: [r.error] }); say(r.error, true); return; }
    S.draft = null;
    say(r.ref + ' issued — ' + r.created.length + ' action' + (r.created.length === 1 ? '' : 's') + ' raised' + (r.notified ? ', ' + r.notified + ' owner' + (r.notified === 1 ? '' : 's') + ' told' : '') + '.');
    openMeeting(r.ref);
  });
}

/* ------------------------------------------------------ the tracker */
function loadActions(){
  var f = S.filter;
  var q = f === 'mine' ? '?mine=1&status=open' : (f === 'all' ? '' : '?status=' + f);
  return get('/api/actions' + q).then(function(d){ S.actions = d.actions || []; S.mayAny = !!(d.may && d.may.update_any); S.me = d.me || S.me; actionsView(); });
}
function actionsView(){
  var fl = [['open', 'Open'], ['mine', 'Mine'], ['overdue', 'Overdue'], ['closed', 'Closed'], ['all', 'All']];
  var list = S.actions;
  view.innerHTML = '<div class="card"><h2>Action tracker</h2><div class="row" style="margin:0 0 10px">' +
    fl.map(function(x){ return '<button class="btn sm" data-fl="' + x[0] + '"' + (S.filter === x[0] ? ' style="background:var(--series-1);color:#fff"' : '') + '>' + x[1] + '</button>'; }).join('') +
    '<span style="flex:1"></span><a class="btn sm" href="/api/actions/xlsx">Action log (Excel)</a></div>' +
    (list.length ? '<table><tr><th>Ref</th><th>Action</th><th>By</th><th>Due</th><th>From</th><th>Status</th><th></th></tr>' +
      list.map(function(a){
        var mine = a.owner_user_id && a.owner_user_id === S.me;
        var can = a.status === 'open' && (mine || S.mayAny);
        var hist = (a.history || []).map(function(h){ return String(h.at).slice(0, 10) + ' ' + h.what + (h.note ? ' — ' + h.note : '') + ' (' + h.by + ')'; }).join('\\n');
        return '<tr title="' + esc(hist) + '"><td><b>' + esc(a.ref) + '</b></td><td>' + esc(a.text) + (a.carried ? '<div class="hint">carried ' + a.carried + '×</div>' : '') +
          (a.closed_note ? '<div class="hint">Closed ' + esc(a.closed_at) + ': ' + esc(a.closed_note) + '</div>' : '') + '</td><td>' + esc(a.owner_name) + (mine ? ' <span class="pill open">you</span>' : '') +
          '</td><td>' + (a.overdue ? '<span class="pill late">' + esc(a.due) + '</span>' : esc(a.due)) + '</td><td>' + esc(a.meeting_ref) + '</td><td><span class="pill ' + (a.status === 'open' ? (a.overdue ? 'late' : 'open') : 'closed') + '">' +
          (a.status === 'open' ? (a.overdue ? 'Overdue' : 'Open') : 'Closed') + '</span></td><td>' +
          (can ? '<button class="btn sm" data-close="' + esc(a.ref) + '">Close</button> <button class="btn sm" data-redate="' + esc(a.ref) + '">New date</button>' : '') + '</td></tr>';
      }).join('') + '</table>' : '<div class="hint">Nothing here.</div>') +
    '<div class="hint" style="margin-top:8px">Actions come from issued minutes. The owner, the PM, the Principal or Document Control closes one — always with a note of what was done.</div></div>';
  view.querySelectorAll('[data-fl]').forEach(function(b){ b.onclick = function(){ S.filter = this.getAttribute('data-fl'); loadActions(); }; });
  view.querySelectorAll('[data-close]').forEach(function(b){ b.onclick = function(){
    var ref = this.getAttribute('data-close'), note = prompt('What was done? (' + ref + ')', ''); if (!note) return;
    post('/api/action', { ref: ref, close: true, note: note }).then(function(r){ if (r.error) return say(r.error, true); say(ref + ' closed.'); loadActions(); });
  }; });
  view.querySelectorAll('[data-redate]').forEach(function(b){ b.onclick = function(){
    var ref = this.getAttribute('data-redate'), due = prompt('New date for ' + ref + ' (YYYY-MM-DD)', ''); if (!due) return;
    var note = prompt('Why does the date move?', ''); if (!note) return;
    post('/api/action', { ref: ref, due: due, note: note }).then(function(r){ if (r.error) return say(r.error, true); say(ref + ' re-dated.'); loadActions(); });
  }; });
}
var q0 = new URLSearchParams(location.search);
if (q0.get('tab') === 'actions') { S.filter = q0.get('filter') || 'open'; tab('actions'); get('/api/meetings').then(function(d){ S.may = d.may || {}; document.getElementById('newBtn').hidden = !S.may.write; }); }
else loadMeetings();
</script>
</body></html>`;
