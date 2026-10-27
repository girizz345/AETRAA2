import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK, SWITCHER_CSS, SWITCHER_JS } from './shared.js';

// Who is on this project, and what each of them may touch.
//
// The old page listed access codes. This one lists people, which is a different
// thing: a code can be passed around a site office, a person cannot. Their name
// goes on every update they send, so an activity marked 90% complete in August
// can be traced to the man who marked it.
//
// The one screen that matters here is the handover: you add somebody standing in
// front of you, and a code appears once, large, with a Copy button. It is never
// shown again, because it is not stored — only its hash is.

export const peopleHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>People · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 980px; }
.who { background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
       padding: 13px 15px; margin-bottom: 10px; display: flex; gap: 14px;
       align-items: flex-start; flex-wrap: wrap; }
.who.out { opacity: .55; }
.who .main { flex: 1 1 260px; min-width: 0; }
.who h3 { font-size: var(--fs-body); margin: 0; line-height: 1.3; }
.who .meta { font-size: var(--fs-secondary); color: var(--muted); margin-top: 3px; line-height: 1.55; }
.who .acts { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.role { display: inline-block; font-size: var(--fs-label); font-weight: 500; letter-spacing: .04em;
        text-transform: uppercase; padding: 2px 7px; border-radius: 5px;
        background: var(--surface-2); color: var(--ink-2); border: 1px solid var(--border); }
.role.owner { background: var(--series-1); color: var(--on-accent); border-color: transparent; }
.role.manager { background: var(--accent); color: var(--on-accent); border-color: transparent; }
.tag { display: inline-block; font-size: var(--fs-secondary); padding: 2px 7px; border-radius: 5px;
       background: var(--surface-2); color: var(--ink-2); border: 1px solid var(--border); }

.codebox { background: var(--surface-2); border: 1px dashed var(--border); border-radius: 10px;
           padding: 16px; text-align: center; margin: 14px 0; }
.codebox .code { font-size: var(--fs-title); font-weight: 500; letter-spacing: 3px;
                 font-family: var(--mono); margin: 6px 0 10px; }

dialog { border: 1px solid var(--border); border-radius: 14px; background: var(--surface);
         color: var(--ink); padding: 0; max-width: 520px; width: calc(100% - 28px); }
dialog::backdrop { background: var(--scrim); }
.dlg-in { padding: 18px 20px 20px; }
.dlg-in h2 { margin: 0 0 4px; font-size: var(--fs-headline); }
.checks { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px;
          border: 1px solid var(--border); border-radius: 8px; padding: 9px; max-height: 190px;
          overflow: auto; background: var(--surface-2); }
.checks label { display: flex; gap: 7px; align-items: center; font-size: var(--fs-secondary); font-weight: 400;
                margin: 0; cursor: pointer; }
.row { display: flex; gap: 10px; flex-wrap: wrap; }
.row > * { flex: 1 1 180px; }
#orgSel { width: auto; max-width: 320px; }
.banner { background: var(--surface-2); border: 1px solid var(--border); border-left: 3px solid var(--series-1);
          border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; font-size: var(--fs-secondary); line-height: 1.6; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>People</h1><div class="sub" id="orgName">who is on this project</div></div>
  <div class="spacer"></div>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  <a class="btn" href="/">Dashboard</a>
  <a class="btn" href="/admin">Admin</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  <div id="orgPick" class="banner" hidden>
    You run more than one account. Showing
    <select id="orgSel" class="proj" style="margin:0 4px"></select>
  </div>

  <div id="notMigrated" class="banner" hidden>
    Accounts are not switched on for this database yet. Run
    <code>bash upgrade-org.sh</code> once, and this page fills in.
  </div>

  <!-- Email sign-in is the one part of this app that depends on something
       outside it, and when it fails it fails silently: the form says "check
       your email" and nothing ever comes. So the page says plainly whether the
       app can send at all, and offers to prove it. -->
  <div id="mailState" class="banner" hidden></div>

  <div class="card">
    <div class="card-head">
      <h2 style="margin:0">Everyone on this account</h2>
      <span class="note" id="count"></span>
      <div class="spacer" style="flex:1"></div>
      <button class="btn btn-primary" id="addBtn">Add somebody</button>
    </div>
    <p class="hint" style="margin:0 0 14px">
      A manager signs in with their email and a six-digit code we send them — there is no
      password to set, forget, or have stolen. Anyone on site gets a personal code on a card.
      Their name goes on every update they send.
    </p>
    <div id="list"></div>
  </div>

  <div class="card">
    <div class="card-head"><h2 style="margin:0">Recent activity</h2>
      <span class="note">signing in, and changes to who has access</span></div>
    <div id="audit" class="hint">…</div>
  </div>
</div>

<dialog id="dlg"><form method="dialog" class="dlg-in" id="frm">
  <h2 id="dlgTitle">Add somebody</h2>
  <p class="hint" id="dlgHint" style="margin:2px 0 16px"></p>

  <div class="field">
    <label for="pName">Name</label>
    <input id="pName" required maxlength="120" placeholder="Full name">
  </div>

  <div class="field">
    <label for="pRole">What they do</label>
    <select id="pRole">
      <option value="manager">Project manager — everything, and approves the day</option>
      <option value="lead">Discipline engineer — his own trades, own dashboard</option>
      <option value="site">Site team — reports progress on his trades</option>
      <option value="view">Read-only — looks, changes nothing</option>
      <option value="owner">Owner — everything, including adding people</option>
    </select>
  </div>

  <div class="row">
    <div class="field" id="emailField">
      <label for="pEmail">Email <span class="hint" id="emailNote"></span></label>
      <input id="pEmail" type="email" maxlength="200" placeholder="name@company.com"
             autocapitalize="off" autocorrect="off">
    </div>
    <div class="field">
      <label for="pPhone">Phone <span class="hint">(optional)</span></label>
      <input id="pPhone" maxlength="40" placeholder="+971 50 …">
    </div>
  </div>

  <div class="field" id="groupField">
    <label>Which disciplines</label>
    <div class="checks" id="groups"></div>
    <p class="hint" style="margin:6px 0 0">Tick none to give them the whole programme.</p>
  </div>

  <div class="field" id="projField">
    <label>Which projects</label>
    <div class="checks" id="projects"></div>
    <p class="hint" style="margin:6px 0 0">Tick none for every project on this account.</p>
  </div>

  <p class="hint" id="retireNote" hidden
     style="margin:-4px 0 14px;color:var(--serious-text, var(--ink-2))">
    Saving this with an email address retires the code they are carrying now.
    They will sign in with their email from then on.
  </p>

  <div class="field" id="reissueField" hidden>
    <label style="display:flex;gap:8px;align-items:center;font-weight:400">
      <input type="checkbox" id="pNewCode" style="width:auto">
      Issue a new code — the old one stops working straight away
    </label>
  </div>

  <div class="err" id="dlgErr" style="color:var(--critical);font-size:var(--fs-secondary);min-height:18px"></div>
  <div class="row" style="margin-top:12px">
    <button class="btn" type="button" id="cancelBtn" style="flex:0 0 auto">Cancel</button>
    <div style="flex:1"></div>
    <button class="btn btn-primary" type="button" id="saveBtn" style="flex:0 0 auto">Save</button>
  </div>
</form></dialog>

<dialog id="codeDlg"><div class="dlg-in">
  <h2>Their code</h2>
  <p class="hint" style="margin:2px 0 0">
    Write this on a card and hand it over now. It is stored only as a fingerprint,
    so this is the one and only time it can be shown.
  </p>
  <div class="codebox">
    <div class="hint" id="codeFor"></div>
    <div class="code" id="codeVal"></div>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
      <button class="btn" id="copyBtn" type="button">Copy the code</button>
      <button class="btn btn-primary" id="copyMsgBtn" type="button">Copy the whole message</button>
    </div>
  </div>
  <p class="hint" style="margin:0 0 14px">
    <em>The whole message</em> is the link, the code and what to do with it — ready to paste
    into WhatsApp.
  </p>
  <button class="btn btn-primary" id="codeDone" type="button" style="width:100%">Done</button>
</div></dialog>

<dialog id="signinDlg"><div class="dlg-in">
  <h2>Read this to them</h2>
  <p class="hint" style="margin:2px 0 0">
    The same code the app would have emailed. Ten minutes, one use, and asking for
    another one kills this one. Every time you do this it goes in the activity log
    below under your name — because this is the one way one person can obtain
    another's sign-in.
  </p>
  <div class="codebox">
    <div class="hint" id="signinFor"></div>
    <div class="code" id="signinVal"></div>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
      <button class="btn" id="signinCopy" type="button">Copy the code</button>
      <button class="btn btn-primary" id="signinCopyMsg" type="button">Copy the whole message</button>
    </div>
  </div>
  <p class="hint" style="margin:0 0 14px">
    They still put in their own email address first — the code only works against it.
  </p>
  <button class="btn btn-primary" id="signinDone" type="button" style="width:100%">Done</button>
</div></dialog>

<div class="toast" id="toast"></div>

<script>
${PWA_BOOT}
${SWITCHER_JS}
var esc = function (s) { return String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
var state = { people: [], groups: [], projects: [], editing: null, org: null };
try { state.org = new URLSearchParams(location.search).get('org') || null; } catch (e) {}

function toast(msg, bad) {
  var t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
  setTimeout(function () { t.className = 'toast'; }, 2600);
}

var ROLE_WORDS = {
  owner: 'Owner', manager: 'Project manager', lead: 'Discipline engineer',
  site: 'Site team', view: 'Read-only',
};

function describe(p) {
  var bits = [];
  if (p.email) bits.push(esc(p.email));
  else if (p.has_code) bits.push('personal code');
  var g = (p.scope && p.scope.groups) || [];
  bits.push(g.length ? g.map(esc).join(' + ') : 'the whole programme');
  var pr = p.projects || [];
  bits.push(pr.length ? pr.length + ' project' + (pr.length === 1 ? '' : 's') : 'every project');
  if (p.status === 'invited') bits.push('has not signed in yet');
  else if (p.last_seen) bits.push('last in ' + String(p.last_seen).slice(0, 10));
  return bits.join(' · ');
}

function render() {
  var el = document.getElementById('list');
  if (!state.people.length) {
    el.innerHTML = '<p class="hint">Nobody yet. Add the project manager first.</p>';
    document.getElementById('count').textContent = '';
    return;
  }
  var live = state.people.filter(function (p) { return p.status !== 'suspended'; }).length;
  document.getElementById('count').textContent =
    live + ' with access' + (state.people.length > live ? ', ' + (state.people.length - live) + ' withdrawn' : '');
  el.innerHTML = state.people.map(function (p) {
    var out = p.status === 'suspended';
    return '<div class="who' + (out ? ' out' : '') + '">' +
      '<div class="main"><h3>' + esc(p.name) +
        ' <span class="role ' + esc(p.role) + '">' + esc(ROLE_WORDS[p.role] || p.role) + '</span>' +
        (out ? ' <span class="tag">withdrawn</span>' : '') + '</h3>' +
        '<div class="meta">' + describe(p) + '</div></div>' +
      '<div class="acts">' +
        // Somebody who signs in by email has no other way in — so when email is
        // down, or you simply have him on the phone, his code can be made here
        // and read out. Every use of it is written to the activity below.
        (!out && p.email
          ? '<button class="btn" data-code="' + esc(p.id) + '">Code now</button>' : '') +
        '<button class="btn" data-edit="' + esc(p.id) + '">Edit</button>' +
        '<button class="btn" data-susp="' + esc(p.id) + '" data-on="' + (out ? '0' : '1') + '">' +
          (out ? 'Give access back' : 'Withdraw access') + '</button>' +
      '</div></div>';
  }).join('');
}

/* ------------------------------------------- a code to read down the phone */

async function codeNow(uid) {
  var person = null;
  for (var i = 0; i < state.people.length; i++) if (state.people[i].id === uid) person = state.people[i];
  if (!person) return;
  var r = await fetch('/api/signin/issue', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: uid, org: state.org || undefined })
  });
  var j = await r.json().catch(function () { return {}; });
  if (!j.ok) { toast(j.error || 'Could not make a code', true); return; }

  document.getElementById('signinFor').textContent =
    j.name + ' \\u00B7 ' + j.email + ' \\u2014 good for ' + j.minutes + ' minutes, once';
  document.getElementById('signinVal').textContent = j.code;
  var msg = 'Your sign-in code for ' + (j.org || 'the site progress monitor') + ' is ' + j.code +
            '. Open ' + location.origin + ' , put in your email ' + j.email +
            ' , then this code. It lasts ' + j.minutes + ' minutes and works once.';
  document.getElementById('signinCopy').onclick = function () {
    navigator.clipboard.writeText(j.code).then(function () { toast('Code copied'); });
  };
  document.getElementById('signinCopyMsg').onclick = function () {
    navigator.clipboard.writeText(msg).then(function () { toast('Message copied'); });
  };
  document.getElementById('signinDlg').showModal();
  loadAudit();
}

async function load() {
  var r = await fetch('/api/people' + (state.org ? '?org=' + encodeURIComponent(state.org) : ''),
                      { cache: 'no-store' });
  if (!r.ok) { document.getElementById('list').innerHTML =
    '<p class="hint">Could not load the people on this account.</p>'; return; }
  var d = await r.json();
  document.getElementById('notMigrated').hidden = d.migrated !== false;
  state.people = d.people || [];
  state.groups = d.groups || [];
  state.projects = d.projects || [];
  if (d.org && d.org.name) document.getElementById('orgName').textContent = d.org.name;
  var orgs = d.orgs || [];
  // Landed without saying which account: show the first rather than an empty page.
  if (!d.org && orgs.length && !state.org) { state.org = orgs[0].id; return load(); }
  if (orgs.length > 1) {
    var sel = document.getElementById('orgSel');
    sel.innerHTML = orgs.map(function (o) {
      return '<option value="' + esc(o.id) + '"' +
        (d.org && o.id === d.org.id ? ' selected' : '') + '>' + esc(o.name) + '</option>';
    }).join('');
    document.getElementById('orgPick').hidden = false;
    sel.onchange = function () { state.org = sel.value; load(); };
  }
  render();
  loadAudit();
  loadMail();
}

/* ------------------------------------------------- can this app send email */

async function loadMail() {
  var el = document.getElementById('mailState');
  var d;
  try {
    var r = await fetch('/api/email-check', { cache: 'no-store' });
    if (!r.ok) { el.hidden = true; return; }
    d = await r.json();
  } catch (e) { el.hidden = true; return; }

  var h;
  if (!d.key) {
    // Two ways to fix it, and the Azure one first: the platform already runs in
    // the customer's own Azure tenant, so the sign-in codes belong there too.
    h = '<b>This app cannot send email.</b> No email provider is set on the server, so nobody can be ' +
        'sent a sign-in code \\u2014 office people will see an error at the form rather than a code. ' +
        'On the server: <code>sudo aetraa-config ACS_CONNECTION_STRING "endpoint=\\u2026;accesskey=\\u2026"</code> ' +
        'from your Azure Communication Service, then ' +
        '<code>sudo aetraa-config REPORT_FROM "AETRAA &lt;no-reply@your-domain&gt;"</code>.';
  } else if (d.driver === 'azure' && !d.sender_set) {
    h = '<b>Azure email is set up but has no sender.</b> Azure has no shared sender of its own, so ' +
        'nothing will go out until one is given: ' +
        '<code>sudo aetraa-config REPORT_FROM "AETRAA &lt;no-reply@your-domain&gt;"</code> \\u2014 using an ' +
        'address on a domain connected to that Communication Service.';
  } else if (d.test_sender) {
    h = '<b>Email is on Resend\\u2019s test sender.</b> ' + esc(d.from) + ' only ever delivers to the ' +
        'address your Resend account was opened with \\u2014 every other person gets nothing, with no ' +
        'error anywhere they can see. Verify your own domain, then ' +
        '<code>sudo aetraa-config REPORT_FROM "AETRAA &lt;no-reply@aetraa.ae&gt;"</code>.';
  } else {
    h = 'Email goes out as <b>' + esc(d.from) + '</b> through ' + esc(d.driver_label || 'the mail service') +
        (d.people_with_email != null
          ? ' \\u00B7 ' + d.people_with_email + ' of ' + d.people + ' people sign in by email'
          : '') + '.';
  }
  h += ' <button class="btn" id="mailTest" style="margin-left:6px">Send a test to me</button>' +
       '<div id="mailOut" class="hint" style="margin-top:8px"></div>';
  el.innerHTML = h;
  el.hidden = false;

  document.getElementById('mailTest').addEventListener('click', async function () {
    var b = this, out = document.getElementById('mailOut');
    var to = prompt('Send the test to which address?', '');
    if (!to) return;
    b.disabled = true; out.textContent = 'Sending\\u2026';
    try {
      var r = await fetch('/api/email-check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to })
      });
      var j = await r.json();
      out.innerHTML = j.ok
        ? 'Sent to <b>' + esc(j.to) + '</b>. If it is not in the inbox in a minute, look in spam \\u2014 ' +
          'and if it is not there either, the address is wrong or the domain is not verified.'
        : '<b>It did not go.</b> ' + esc(j.error) +
          (j.raw ? '<div style="margin-top:6px;opacity:.7;font-size:var(--fs-secondary)">' + esc(j.raw) + '</div>' : '');
    } catch (e) {
      out.textContent = 'Could not reach the server.';
    }
    b.disabled = false;
  });
}

async function loadAudit() {
  var r = await fetch('/api/audit' + (state.org ? '?org=' + encodeURIComponent(state.org) : ''),
                      { cache: 'no-store' });
  var el = document.getElementById('audit');
  if (!r.ok) { el.textContent = 'Not available.'; return; }
  var d = await r.json();
  if (!d.entries || !d.entries.length) { el.textContent = 'Nothing recorded yet.'; return; }
  el.innerHTML = '<div style="display:grid;gap:5px">' + d.entries.slice(0, 40).map(function (e) {
    return '<div style="display:flex;gap:10px;font-size:var(--fs-secondary)">' +
      '<span style="color:var(--muted);flex:0 0 132px;font-variant-numeric:tabular-nums">' +
        esc(String(e.at || '').slice(0, 16).replace('T', ' ')) + '</span>' +
      '<span style="flex:1"><b>' + esc(e.who || '—') + '</b> · ' + esc(e.action) +
        (e.detail ? ' · ' + esc(e.detail) : '') + '</span></div>';
  }).join('') + '</div>';
}

/* ------------------------------------------------------------- the dialog */

var dlg = document.getElementById('dlg');
var roleSel = document.getElementById('pRole');

function officeRole() { var v = roleSel.value; return v === 'owner' || v === 'manager'; }

function syncDialog() {
  var office = officeRole();
  document.getElementById('groupField').hidden = office;
  document.getElementById('emailNote').textContent = office
    ? '(required — this is how they sign in)' : '(optional)';
  document.getElementById('pEmail').required = office;
  var editing = state.editing;
  document.getElementById('reissueField').hidden = !(editing && !office && editing.has_code);
  // Naming the man behind an old shared code and giving him an email retires that
  // code. Say so before it happens, not after somebody rings up locked out.
  var note = document.getElementById('retireNote');
  note.hidden = !(editing && office && editing.has_code);
}
roleSel.addEventListener('change', syncDialog);

function boxes(id, items, chosen) {
  document.getElementById(id).innerHTML = items.map(function (v, i) {
    var val = typeof v === 'string' ? v : v.id;
    var label = typeof v === 'string' ? v : v.name;
    return '<label><input type="checkbox" value="' + esc(val) + '"' +
      (chosen.indexOf(val) >= 0 ? ' checked' : '') + '> ' + esc(label) + '</label>';
  }).join('') || '<span class="hint">nothing to choose from yet</span>';
}
function picked(id) {
  return Array.prototype.slice.call(
    document.querySelectorAll('#' + id + ' input:checked')).map(function (c) { return c.value; });
}

function openDialog(person) {
  state.editing = person || null;
  document.getElementById('dlgTitle').textContent = person ? 'Edit ' + person.name : 'Add somebody';
  document.getElementById('dlgHint').textContent = person ? ''
    : 'A site man gets his code as soon as you save — have something to write it on.';
  document.getElementById('pName').value = person ? person.name : '';
  document.getElementById('pEmail').value = (person && person.email) || '';
  document.getElementById('pPhone').value = (person && person.phone) || '';
  roleSel.value = (person && person.role) || 'site';
  document.getElementById('pNewCode').checked = false;
  document.getElementById('dlgErr').textContent = '';
  boxes('groups', state.groups.filter(function (g) { return g !== '(no group)'; }),
        (person && person.scope && person.scope.groups) || []);
  boxes('projects', state.projects, (person && person.projects) || []);
  syncDialog();
  dlg.showModal();
}

document.getElementById('addBtn').addEventListener('click', function () { openDialog(null); });
document.getElementById('cancelBtn').addEventListener('click', function () { dlg.close(); });

document.getElementById('saveBtn').addEventListener('click', async function () {
  var err = document.getElementById('dlgErr'); err.textContent = '';
  var btn = this; btn.disabled = true;
  var body = {
    id: state.editing ? state.editing.id : undefined,
    name: document.getElementById('pName').value.trim(),
    role: roleSel.value,
    email: document.getElementById('pEmail').value.trim() || null,
    phone: document.getElementById('pPhone').value.trim(),
    groups: picked('groups'),
    projects: picked('projects'),
    new_code: document.getElementById('pNewCode').checked,
    org: state.org || undefined,
  };
  try {
    var r = await fetch('/api/person', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || 'Could not save');
    dlg.close();
    if (j.code) showCode(body.name, j.code);
    else toast(body.email ? 'Saved. They sign in with ' + body.email : 'Saved.');
    load();
  } catch (e) {
    err.textContent = e.message;
  } finally { btn.disabled = false; }
});

var codeDlg = document.getElementById('codeDlg');
function showCode(name, code) {
  document.getElementById('codeFor').textContent = name;
  document.getElementById('codeVal').textContent = code;
  codeDlg.showModal();
}
function copy(text, said) {
  if (!navigator.clipboard) { toast('Copy it by hand — this browser will not let me', true); return; }
  navigator.clipboard.writeText(text).then(function () { toast(said); },
    function () { toast('Could not copy — write it down', true); });
}
document.getElementById('copyBtn').addEventListener('click', function () {
  copy(document.getElementById('codeVal').textContent, 'Code copied');
});
// The code on its own is half a handover. This is what actually gets sent.
document.getElementById('copyMsgBtn').addEventListener('click', function () {
  var code = document.getElementById('codeVal').textContent;
  copy(['Site progress app', location.origin, '', 'Your code: ' + code, '',
        'Open the link, type the code, then tap Share and Add to Home Screen. ' +
        'It opens straight to your trades.'].join(String.fromCharCode(10)),
       'Message copied — paste it to him');
});
document.getElementById('codeDone').addEventListener('click', function () { codeDlg.close(); });
document.getElementById('signinDone').addEventListener('click', function () {
  document.getElementById('signinDlg').close();
});

document.getElementById('list').addEventListener('click', async function (e) {
  var ed = e.target.getAttribute && e.target.getAttribute('data-edit');
  if (ed) {
    var p = state.people.filter(function (x) { return x.id === ed; })[0];
    if (p) openDialog(p);
    return;
  }
  var cn = e.target.getAttribute && e.target.getAttribute('data-code');
  if (cn) { codeNow(cn); return; }
  var su = e.target.getAttribute && e.target.getAttribute('data-susp');
  if (!su) return;
  var on = e.target.getAttribute('data-on') === '1';
  var who = (state.people.filter(function (x) { return x.id === su; })[0] || {}).name || '';
  if (on && !confirm('Withdraw ' + who + "'s access? Their code stops working immediately. "
    + 'Everything they have already reported stays exactly where it is.')) return;
  var r = await fetch('/api/person', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: su, suspend: on, org: state.org || undefined }),
  });
  var j = await r.json().catch(function () { return {}; });
  if (!r.ok) { toast(j.error || 'Could not change that', true); return; }
  toast(on ? who + ' is out' : who + ' is back in');
  load();
});

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

load();
</script>
</body>
</html>`;
