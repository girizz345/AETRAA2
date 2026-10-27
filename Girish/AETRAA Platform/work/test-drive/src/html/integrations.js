import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK } from './shared.js';
import { icon, iconsFor } from './icons.js';

// INTEGRATIONS — the team's side of src/integrations.js: the company's API
// keys, the connectors to other programs, and the inbox of what those programs
// have sent to a project.

export const integrationsHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Integrations · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}
.in-head h1 { font-family: var(--font-display); font-weight: 400; font-size: var(--fs-d1); line-height: .95; letter-spacing: .015em; margin: var(--s1) 0 var(--s2); }
.in-head p { color: var(--text-2); max-width: 70ch; margin: 0 0 var(--s5); }
.grid2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--s5); align-items: start; }
@media (max-width: 900px) { .grid2 { grid-template-columns: 1fr; } }
@media (pointer: coarse), (max-width: 640px) {
  div.acts button, div.acts a { min-height: 44px; }
  .checks label { min-height: 44px; }
  .checks input { width: 22px; height: 22px; }
}
.card h2 { margin: 0 0 var(--s2); }
.card .hint { margin: 0 0 var(--s4); }
.row-form { display: flex; gap: var(--s2); flex-wrap: wrap; align-items: flex-end; margin-bottom: var(--s4); }
.row-form .field { margin: 0; flex: 1 1 200px; }
.checks { display: flex; gap: var(--s4); align-items: center; min-height: 44px; }
.checks label { display: inline-flex; gap: var(--s2); align-items: center; margin: 0; color: var(--text); }
.reveal { background: var(--card-light); color: var(--on-card-light); border-radius: var(--r-card); padding: var(--s4); margin-bottom: var(--s4); }
.reveal code { display: block; word-break: break-all; font-size: var(--fs-secondary); margin: var(--s2) 0; padding: var(--s2) var(--s3);
  background: color-mix(in srgb, var(--on-card-light) 7%, transparent); border-radius: var(--r-control); }
.reveal .btn { background: var(--on-card-light); color: var(--card-light); border-color: transparent; }
.conn { display: flex; align-items: center; gap: var(--s3); padding: var(--s3) 0; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.conn:last-child { border-bottom: 0; }
.conn .nm { flex: 1 1 200px; }
.conn .nm b { display: block; font-weight: 500; }
.dev pre { white-space: pre-wrap; word-break: break-all; background: var(--surface-2); border-radius: var(--r-control); padding: var(--s3); font-size: var(--fs-secondary); margin: var(--s2) 0 0; }
table.ib td { vertical-align: middle; }
.acts { display: flex; gap: var(--s1); flex-wrap: wrap; justify-content: flex-end; }
.acts button, .acts a { min-height: 32px; padding: 0 var(--s3); border-radius: var(--r-pill); border: 1px solid transparent; background: none;
  color: var(--text-2); font: inherit; font-size: var(--fs-secondary); cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
.acts button:hover, .acts a:hover { color: var(--text); border-color: var(--line-strong); }
dialog .dlg { padding: var(--s5); width: 720px; max-width: 92vw; }
dialog pre { white-space: pre-wrap; word-break: break-word; background: var(--surface-2); border-radius: var(--r-control); padding: var(--s3);
  font-size: var(--fs-secondary); max-height: 55vh; overflow: auto; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in centered">
  <div class="start">${BRAND_MARK}</div>
  <nav class="nav" aria-label="Main"><a href="/">Dashboard</a><a href="/integrations" aria-current="page">Integrations</a><a href="/myfiles">My files</a></nav>
  <div class="end">
    <button class="icon-btn" id="themeBtn" type="button" title="Light / dark" aria-label="Switch between light and dark">${icon('contrast', 18)}</button>
    <a class="btn btn-cream" href="/api/logout">Sign out</a>
  </div>
</div></div>

<div class="wrap">
  <div class="in-head">
    <p class="t-label">Connected programs</p>
    <h1>Integrations</h1>
    <p>Revit and the other programs your projects run on can send their data here, and AETRAA can call them. What they send waits in the project’s inbox below for someone to look at.</p>
  </div>

  <div class="grid2">
    <div class="card" id="keysCard">
      <h2>API keys</h2>
      <p class="hint">A key lets a program send data to your company’s projects. It is shown once — copy it into the program. Revoke it the moment it is no longer needed.</p>
      <div id="reveal"></div>
      <form class="row-form" id="kf">
        <div class="field"><label for="kn">Name it after what will use it</label><input id="kn" placeholder="e.g. Revit add-in — Ajay’s laptop"></div>
        <div class="checks"><label><input type="checkbox" id="kr" checked> Read</label><label><input type="checkbox" id="kw" checked> Write</label></div>
        <button class="btn btn-primary" type="submit">Make a key</button>
      </form>
      <div id="keys"></div>
    </div>

    <div>
      <div class="card">
        <h2>Connectors</h2>
        <p class="hint">Programs AETRAA calls. They are set up on the server by whoever runs it (see docs/INTEGRATION.md).</p>
        <div id="conns"></div>
      </div>
      <div class="card dev">
        <h2>For developers</h2>
        <p class="hint" style="margin:0">The API lives at <b id="apiBase"></b>. Every call carries a key:</p>
        <pre id="curl"></pre>
      </div>
    </div>
  </div>

  <div class="card" style="margin-top:var(--s5)">
    <div style="display:flex;gap:var(--s3);align-items:center;flex-wrap:wrap;margin-bottom:var(--s3)">
      <h2 style="margin:0;flex:1 1 auto">Inbox</h2>
      <label class="sr" for="proj">Project</label><select id="proj" style="width:auto;max-width:340px"></select>
    </div>
    <div id="inbox"></div>
  </div>
</div>

<dialog id="dl"><div class="dlg"><h2 id="dlT" style="margin:0 0 var(--s3)"></h2><div id="dlB"></div>
  <div style="display:flex;gap:var(--s2);justify-content:flex-end;margin-top:var(--s4)"><button class="btn" id="dlX" type="button">Close</button></div></div></dialog>
<div class="toast" id="toast"></div>

<script>
${PWA_BOOT}
var IC = ${iconsFor(['check', 'trash', 'download', 'eye', 'archive', 'activity'], 14)};
var S = null, PROJ = new URLSearchParams(location.search).get('project') || '';
function $(id){ return document.getElementById(id); }
var esc = function (s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
function toast(m, bad){ var t = $('toast'); t.textContent = m; t.className = 'toast show' + (bad ? ' bad' : ''); setTimeout(function(){ t.className = 'toast'; }, 3200); }
function when(iso){ return iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'; }
function size(n){ n = Number(n) || 0; return n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }
async function api(url, body){
  var r = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  if (r.status === 401) { location.href = '/'; throw new Error('Log in again.'); }
  var j = await r.json().catch(function(){ return {}; });
  if (!r.ok) throw new Error(j.error || 'That did not work.');
  return j;
}
var PILL = { received: 'warn', reviewed: '', applied: 'good', failed: 'bad', archived: '' };
function render(){
  $('keysCard').hidden = !S.may_manage_keys;
  $('keys').innerHTML = S.keys.length ? '<table><thead><tr><th>Name</th><th>Key</th><th>Can</th><th>Last used</th><th></th></tr></thead><tbody>' +
    S.keys.map(function(k){ return '<tr><td>' + esc(k.name) + '<div class="hint">by ' + esc(k.created_by || '—') + '</div></td><td class="ref">aet_' + esc(k.prefix) + '_…</td><td>' +
      esc((k.scopes || []).join(', ')) + '</td><td>' + (k.revoked_at ? '<span class="pill">revoked</span>' : when(k.last_used_at)) + '</td><td><div class="acts">' +
      (k.revoked_at ? '' : '<button data-revoke="' + esc(k.id) + '" data-name="' + esc(k.name) + '">' + IC.trash + 'Revoke</button>') + '</div></td></tr>'; }).join('') + '</tbody></table>'
    : '<div class="empty"><span>No keys yet.</span></div>';
  $('conns').innerHTML = S.connectors.length ? S.connectors.map(function(c){
    var st = !c.configured ? '<span class="pill warn">' + IC.activity + 'not set up</span>' : !c.has_secret ? '<span class="pill warn">no secret</span>'
      : c.last ? (c.last.ok ? '<span class="pill good">' + IC.check + 'answered ' + when(c.last.created_at) + '</span>' : '<span class="pill bad">failed ' + when(c.last.created_at) + '</span>')
      : '<span class="pill">ready</span>';
    return '<div class="conn"><div class="nm"><b>' + esc(c.label) + '</b><span class="hint">' + esc(c.name) + '</span></div>' + st +
      '<button class="btn" data-test="' + esc(c.name) + '"' + (c.configured && c.has_secret ? '' : ' disabled') + '>Test</button></div>'; }).join('')
    : '<div class="empty"><span>No connectors are set up on this server yet.</span></div>';
  $('apiBase').textContent = S.api_base;
  $('curl').textContent = 'curl -H "Authorization: Bearer aet_…" ' + S.api_base + '/projects\\n\\n' +
    'curl -X POST -H "Authorization: Bearer aet_…" -H "Content-Type: application/json" \\\\\\n' +
    '  -d \\'{"source":"revit","kind":"quantities","title":"Level 3 walls","external_id":"L3-walls","data":{}}\\' \\\\\\n  ' +
    S.api_base + '/projects/' + (S.project ? S.project.id : '<project id>') + '/inbox';
  $('proj').innerHTML = S.projects.map(function(p){ return '<option value="' + esc(p.id) + '"' + (S.project && S.project.id === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') ||
    '<option value="">No projects yet</option>';
  $('inbox').innerHTML = !S.project ? '<div class="empty"><span>Open a project to see its inbox.</span></div>'
    : !S.inbox.length ? '<div class="empty"><span>Nothing has arrived for ' + esc(S.project.name) + ' yet.</span></div>'
    : '<table class="ib stack"><thead><tr><th>Arrived</th><th>From</th><th>What</th><th>File</th><th>Status</th><th></th></tr></thead><tbody>' +
      S.inbox.map(function(it){ return '<tr><td data-label="Arrived">' + when(it.updated_at) + '</td><td data-label="From">' + esc(it.source) + '</td><td data-label="What"><b>' + esc(it.title || it.kind) +
        '</b><div class="hint">' + esc(it.kind) + (it.external_id ? ' · ' + esc(it.external_id) : '') + '</div></td><td data-label="File">' +
        (it.file_name ? '<a href="/api/integrations/item/file?id=' + encodeURIComponent(it.id) + '">' + IC.download + ' ' + esc(it.file_name) + '</a> <span class="hint">' + size(it.file_size) + '</span>' : '—') +
        '</td><td data-label="Status"><span class="pill ' + (PILL[it.status] || '') + '">' + esc(it.status) + '</span></td><td><div class="acts">' +
        '<button data-view="' + esc(it.id) + '">' + IC.eye + 'View</button>' +
        (it.status === 'received' ? '<button data-status="reviewed" data-id="' + esc(it.id) + '">' + IC.check + 'Reviewed</button>' : '') +
        (it.status !== 'archived' ? '<button data-status="archived" data-id="' + esc(it.id) + '">' + IC.archive + 'Archive</button>' : '') +
        '</div></td></tr>'; }).join('') + '</tbody></table>';
}
async function load(){
  try { S = await api('/api/integrations' + (PROJ ? '?project=' + encodeURIComponent(PROJ) : '')); render(); }
  catch (e) { $('inbox').innerHTML = '<div class="empty"><span>' + esc(e.message) + '</span></div>'; }
}
$('proj').addEventListener('change', function(){ PROJ = this.value; load(); });
$('kf').addEventListener('submit', async function(e){
  e.preventDefault();
  var scopes = []; if ($('kr').checked) scopes.push('read'); if ($('kw').checked) scopes.push('write');
  try {
    var r = await api('/api/integrations/keys', { name: $('kn').value.trim(), scopes: scopes });
    $('reveal').innerHTML = '<div class="reveal"><b>Copy this key now — it will not be shown again.</b><code id="newKey">' + esc(r.key) + '</code>' +
      '<button class="btn" type="button" id="copyKey">Copy</button></div>';
    $('copyKey').addEventListener('click', function(){ navigator.clipboard.writeText(r.key).then(function(){ toast('Copied.'); }); });
    $('kn').value = ''; load();
  } catch (x) { toast(x.message, true); }
});
document.addEventListener('click', async function(e){
  var b = e.target.closest && e.target.closest('[data-revoke],[data-test],[data-view],[data-status]');
  if (!b) return;
  try {
    if (b.dataset.revoke) { if (!confirm('Revoke “' + b.dataset.name + '”? Anything using it stops working at once.')) return;
      await api('/api/integrations/keys/revoke', { id: b.dataset.revoke }); toast('Revoked.'); return load(); }
    if (b.dataset.test) { b.disabled = true; var r = await api('/api/integrations/call', { connector: b.dataset.test, action: 'ping', payload: {}, project_id: S.project && S.project.id })
      .catch(function(x){ return { error: x.message }; }); b.disabled = false; toast(r.error ? r.error : 'It answered in ' + r.ms + ' ms.', !!r.error); return load(); }
    if (b.dataset.view) { var it = (await api('/api/integrations/item?id=' + encodeURIComponent(b.dataset.view))).item;
      $('dlT').textContent = (it.title || it.kind) + ' — from ' + it.source;
      $('dlB').innerHTML = '<p class="hint">' + esc(it.kind) + (it.external_id ? ' · ' + esc(it.external_id) : '') + ' · arrived ' + when(it.created_at) +
        (it.updated_at !== it.created_at ? ', updated ' + when(it.updated_at) : '') + (it.note ? ' · ' + esc(it.note) : '') + '</p><pre>' + esc(JSON.stringify(it.data, null, 2)) + '</pre>';
      $('dl').showModal(); return; }
    if (b.dataset.status) { await api('/api/integrations/item/status', { id: b.dataset.id, status: b.dataset.status }); return load(); }
  } catch (x) { toast(x.message, true); }
});
$('dlX').addEventListener('click', function(){ $('dl').close(); });
load();
</script>
</body>
</html>`;
