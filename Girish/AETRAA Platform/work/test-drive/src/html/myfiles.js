import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK } from './shared.js';
import { icon, iconsFor } from './icons.js';

// MY FILES — a person's own private files (src/myfiles.js), laid out like any
// drive: folders and a breadcrumb, upload by button or by dropping files
// anywhere on the page, and per file: open, download, rename, move, attach to
// a record on the project, delete.

export const myfilesHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>My files · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}
.mf-head { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--s4); flex-wrap: wrap; margin-bottom: var(--s5); }
.mf-head h1 { font-family: var(--font-display); font-weight: 400; font-size: var(--fs-d1); line-height: .95; letter-spacing: .015em; margin: var(--s1) 0 0; }
.mf-use { min-width: 240px; }
.mf-use .bar { height: 6px; border-radius: var(--r-pill); background: var(--line); overflow: hidden; margin-top: var(--s2); }
.mf-use .bar i { display: block; height: 100%; background: var(--accent); width: 0; }
.mf-use .bar i.full { background: var(--bad); }
.mf-tools { display: flex; gap: var(--s2); align-items: center; flex-wrap: wrap; margin-bottom: var(--s4); }
.mf-tools .search { position: relative; flex: 1 1 220px; max-width: 340px; display: flex; margin: 0; }
.mf-tools .search .ic { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-2); pointer-events: none; }
.mf-tools .search input { padding-left: 40px; }
.crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s1); font-size: var(--fs-secondary); color: var(--text-2); margin-bottom: var(--s3); }
.crumbs button { background: none; border: 0; color: var(--accent-text); font: inherit; cursor: pointer; padding: 4px 6px; border-radius: var(--r-control); }
.crumbs button:hover { background: var(--surface-2); }
.crumbs .sep { color: var(--text-2); }
table.mf td { vertical-align: middle; }
table.mf .nm { display: flex; align-items: center; gap: var(--s3); min-width: 0; }
table.mf .nm .icon-tile { width: 32px; height: 32px; flex-basis: 32px; }
table.mf .nm a, table.mf .nm button.open { color: var(--text); text-decoration: none; background: none; border: 0; padding: 0; font: inherit; cursor: pointer; text-align: left; word-break: break-word; }
table.mf .nm a:hover, table.mf .nm button.open:hover { color: var(--accent-text); }
table.mf td.n { text-align: right; white-space: nowrap; color: var(--text-2); }
.acts { display: flex; gap: var(--s1); justify-content: flex-end; flex-wrap: wrap; }
.acts button, .acts a { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 var(--s3); border-radius: var(--r-pill);
  border: 1px solid transparent; background: none; color: var(--text-2); font: inherit; font-size: var(--fs-secondary); cursor: pointer; text-decoration: none; }
.acts button:hover, .acts a:hover { color: var(--text); border-color: var(--line-strong); }
.acts .del:hover { color: var(--bad-ink); border-color: color-mix(in srgb, var(--bad-ink) 45%, transparent); }
@media (pointer: coarse), (max-width: 640px) {
  .acts button, .acts a, .crumbs button { min-height: 44px; }
  table.mf .nm a, table.mf .nm button.open { display: inline-flex; align-items: center; min-height: 44px; }
}
.drophint { position: fixed; inset: 0; z-index: 70; display: none; place-items: center; background: var(--scrim);
  color: var(--text); font-family: var(--font-display); font-size: var(--fs-d2); letter-spacing: .02em; pointer-events: none; }
.drophint.on { display: grid; }
.drophint span { border: 2px dashed var(--accent); border-radius: var(--r-frame); padding: var(--s6) var(--s7); background: var(--card); }
.ups { display: grid; gap: var(--s2); margin-bottom: var(--s4); }
.up { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--s1) var(--s3); align-items: center; padding: var(--s3) var(--s4);
  border: 1px solid var(--line); border-radius: var(--r-card); background: var(--card); font-size: var(--fs-secondary); }
.up .pb { grid-column: 1 / -1; height: 4px; border-radius: var(--r-pill); background: var(--line); overflow: hidden; }
.up .pb i { display: block; height: 100%; width: 0; background: var(--accent); }
.up.err { border-color: color-mix(in srgb, var(--bad-ink) 45%, transparent); }
.up.err .st { color: var(--bad-ink); }
.up.ok .st { color: var(--good-ink); }
@media (max-width: 767px) {
  table.mf.stack tr { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: var(--s2); }
  table.mf.stack td { grid-column: 1 / -1; }
  table.mf.stack td.nmc { grid-column: 1; }
  table.mf.stack td.nmc::before { display: none; }
  table.mf.stack td.n { text-align: left; grid-column: auto; }
  table.mf.stack .acts { justify-content: flex-start; }
}
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in centered">
  <div class="start">${BRAND_MARK}</div>
  <nav class="nav" aria-label="Main">
    <a href="/">Dashboard</a>
    <a href="/myfiles" aria-current="page">My files</a>
    <a href="/account">Account</a>
  </nav>
  <div class="end">
    <button class="icon-btn" id="themeBtn" type="button" title="Light / dark" aria-label="Switch between light and dark">${icon('contrast', 18)}</button>
    <a class="btn btn-cream" href="/api/logout">Sign out</a>
  </div>
</div></div>

<div class="wrap">
  <div class="mf-head">
    <div><p class="t-label">Your private space</p><h1>My files</h1></div>
    <div class="mf-use"><div class="hint" id="useTxt">&nbsp;</div><div class="bar"><i id="useBar"></i></div></div>
  </div>

  <div class="mf-tools">
    <label class="search"><span class="sr">Search your files</span>${icon('search')}<input type="search" id="q" placeholder="Search your files…"></label>
    <div class="spacer"></div>
    <button class="btn" id="newFolder" type="button">${icon('layers')} New folder</button>
    <button class="btn btn-primary" id="upBtn" type="button">Upload files</button>
    <input type="file" id="pick" multiple hidden>
  </div>

  <div class="crumbs" id="crumbs"></div>
  <div class="ups" id="ups"></div>
  <div class="card" id="panel"><div class="skel" aria-hidden="true"><i></i><i></i><i></i><i></i></div><p class="sr">Loading…</p></div>
  <p class="hint" style="margin-top:var(--s4)">Only you can see these. Programs, scripts and web pages cannot be kept here. To share a file with your team, attach it to a record on the project.</p>
</div>

<div class="drophint" id="drophint"><span>Drop to upload</span></div>
<div class="toast" id="toast"></div>

<script>
${PWA_BOOT}
var IC = ${iconsFor(['file', 'layers', 'download', 'pen', 'arrow-right', 'trash', 'link', 'image'], 16)};
var FOLDER = '/', D = null, Q = '';
function $(id){ return document.getElementById(id); }
var esc = function (s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
function toast(m, bad){ var t = $('toast'); t.textContent = m; t.className = 'toast show' + (bad ? ' bad' : ''); setTimeout(function(){ t.className = 'toast'; }, 3200); }
function size(n){ n = Number(n) || 0; if (n < 1024) return n + ' B'; if (n < 1048576) return Math.round(n / 1024) + ' KB'; if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB'; return (n / 1073741824).toFixed(2) + ' GB'; }
function when(iso){ if (!iso) return ''; var d = new Date(iso); return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
function join(a, b){ return (a === '/' ? '' : a) + '/' + b; }
async function api(url, body){
  var r = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  if (r.status === 401) { location.href = '/'; throw new Error('Log in again.'); }
  var j = await r.json().catch(function(){ return {}; });
  if (!r.ok) throw new Error(j.error || 'That did not work.');
  return j;
}
function showUsage(u){
  if (!u) return; var pct = Math.min(100, u.used / u.quota * 100);
  $('useTxt').textContent = size(u.used) + ' of ' + size(u.quota) + ' used · ' + u.files + (u.files === 1 ? ' file' : ' files');
  $('useBar').style.width = pct.toFixed(1) + '%'; $('useBar').className = pct > 90 ? 'full' : '';
}
function crumbs(){
  var parts = FOLDER.split('/').filter(Boolean), h = '<button data-go="/">My files</button>', acc = '';
  parts.forEach(function(p){ acc += '/' + p; h += '<span class="sep">/</span><button data-go="' + esc(acc) + '">' + esc(p) + '</button>'; });
  $('crumbs').innerHTML = Q ? '<span>Search results for “' + esc(Q) + '”</span> <button data-go="' + esc(FOLDER) + '">Clear</button>' : h;
}
function rowFolder(name){
  return '<tr><td class="nmc"><div class="nm"><span class="icon-tile">' + IC.layers + '</span><button class="open" data-folder="' + esc(join(FOLDER, name)) + '">' + esc(name) + '</button></div></td>' +
    '<td class="n" data-label="Size">—</td><td class="n" data-label="Modified"></td>' +
    '<td><div class="acts"><button data-rmfolder="' + esc(join(FOLDER, name)) + '" class="del">' + IC.trash + 'Remove</button></div></td></tr>';
}
function rowFile(f){
  var img = /\\.(png|jpe?g|webp|gif)$/i.test(f.name), pdf = /\\.pdf$/i.test(f.name);
  var href = '/api/myfiles/file?id=' + encodeURIComponent(f.id);
  return '<tr><td class="nmc"><div class="nm"><span class="icon-tile">' + (img ? IC.image : IC.file) + '</span>' +
    ((img || pdf) ? '<a href="' + href + '" target="_blank" rel="noopener">' + esc(f.name) + '</a>' : '<a href="' + href + '&download=1">' + esc(f.name) + '</a>') +
    (Q ? ' <span class="hint">' + esc(f.folder) + '</span>' : '') + '</div></td>' +
    '<td class="n" data-label="Size">' + size(f.size) + '</td><td class="n" data-label="Modified">' + when(f.updated_at || f.created_at) + '</td>' +
    '<td><div class="acts"><a href="' + href + '&download=1">' + IC.download + 'Download</a>' +
    '<button data-rename="' + esc(f.id) + '" data-name="' + esc(f.name) + '">' + IC.pen + 'Rename</button>' +
    '<button data-move="' + esc(f.id) + '">' + IC['arrow-right'] + 'Move</button>' +
    '<button data-attach="' + esc(f.id) + '">' + IC.link + 'Attach to a record</button>' +
    '<button data-del="' + esc(f.id) + '" data-name="' + esc(f.name) + '" class="del">' + IC.trash + 'Delete</button></div></td></tr>';
}
function render(){
  crumbs();
  var folders = Q ? [] : (D.folders || []), files = D.files || [];
  if (!folders.length && !files.length) {
    $('panel').innerHTML = '<div class="empty"><span class="icon-tile">' + IC.file + '</span><span>' +
      (Q ? 'Nothing matches “' + esc(Q) + '”.' : FOLDER === '/' ? 'No files yet. Upload some, or drop them anywhere on this page.' : 'This folder is empty.') + '</span></div>';
    return;
  }
  $('panel').innerHTML = '<table class="mf stack"><thead><tr><th>Name</th><th class="num">Size</th><th class="num">Modified</th><th><span class="sr">Actions</span></th></tr></thead><tbody>' +
    folders.map(rowFolder).join('') + files.map(rowFile).join('') + '</tbody></table>';
}
async function load(){
  try { D = Q ? await api('/api/myfiles/search?q=' + encodeURIComponent(Q)) : await api('/api/myfiles?folder=' + encodeURIComponent(FOLDER)); showUsage(D.usage); render(); }
  catch (e) { $('panel').innerHTML = '<div class="empty"><span>' + esc(e.message) + '</span></div>'; }
}
function go(f){ FOLDER = f || '/'; Q = ''; $('q').value = ''; load(); }

// Uploads: one at a time, each with its own progress bar.
function uploadOne(file){
  return new Promise(function(done){
    var row = document.createElement('div'); row.className = 'up';
    row.innerHTML = '<span>' + esc(file.name) + ' <span class="hint">' + size(file.size) + '</span></span><span class="st">Waiting…</span><div class="pb"><i></i></div>';
    $('ups').appendChild(row);
    var x = new XMLHttpRequest();
    x.open('POST', '/api/myfiles/upload?folder=' + encodeURIComponent(FOLDER) + '&name=' + encodeURIComponent(file.name));
    x.setRequestHeader('Content-Type', 'application/octet-stream');
    x.upload.onprogress = function(e){ if (e.lengthComputable) { row.querySelector('i').style.width = (e.loaded / e.total * 100).toFixed(1) + '%'; row.querySelector('.st').textContent = Math.round(e.loaded / e.total * 100) + '%'; } };
    x.onload = function(){
      var j = {}; try { j = JSON.parse(x.responseText); } catch (e) {}
      if (x.status >= 200 && x.status < 300) { row.className = 'up ok'; row.querySelector('.st').textContent = j.replaced ? 'Replaced' : 'Uploaded'; row.querySelector('i').style.width = '100%'; }
      else { row.className = 'up err'; row.querySelector('.st').textContent = j.error || 'Failed'; }
      done();
    };
    x.onerror = function(){ row.className = 'up err'; row.querySelector('.st').textContent = 'Could not reach the server'; done(); };
    x.send(file);
  });
}
async function uploadAll(list){
  for (var i = 0; i < list.length; i++) await uploadOne(list[i]);
  load();
  setTimeout(function(){ [].forEach.call(document.querySelectorAll('.up.ok'), function(r){ r.remove(); }); }, 4000);
}
$('upBtn').addEventListener('click', function(){ $('pick').click(); });
$('pick').addEventListener('change', function(){ uploadAll([].slice.call(this.files)); this.value = ''; });
var depth = 0;
document.addEventListener('dragenter', function(e){ if (e.dataTransfer && [].indexOf.call(e.dataTransfer.types, 'Files') >= 0) { depth++; $('drophint').classList.add('on'); e.preventDefault(); } });
document.addEventListener('dragover', function(e){ e.preventDefault(); });
document.addEventListener('dragleave', function(){ depth = Math.max(0, depth - 1); if (!depth) $('drophint').classList.remove('on'); });
document.addEventListener('drop', function(e){ e.preventDefault(); depth = 0; $('drophint').classList.remove('on'); if (e.dataTransfer && e.dataTransfer.files.length) uploadAll([].slice.call(e.dataTransfer.files)); });

$('newFolder').addEventListener('click', async function(){
  var n = prompt('Name the new folder'); if (!n) return;
  try { await api('/api/myfiles/folder', { path: join(FOLDER, n.trim()) }); load(); } catch (e) { toast(e.message, true); }
});
var qt = null;
$('q').addEventListener('input', function(){ clearTimeout(qt); var v = this.value.trim(); qt = setTimeout(function(){ Q = v; load(); }, 250); });

document.addEventListener('click', async function(e){
  var b = e.target.closest && e.target.closest('[data-go],[data-folder],[data-rename],[data-move],[data-attach],[data-del],[data-rmfolder]');
  if (!b) return;
  try {
    if (b.dataset.go !== undefined) return go(b.dataset.go);
    if (b.dataset.folder) return go(b.dataset.folder);
    if (b.dataset.rename) { var n = prompt('Rename to', b.dataset.name); if (!n || n === b.dataset.name) return; await api('/api/myfiles/rename', { id: b.dataset.rename, name: n.trim() }); toast('Renamed.'); return load(); }
    if (b.dataset.move) { var f = prompt('Move to which folder? (for example /Site photos/Level 3 — or / for the top)', FOLDER); if (!f) return; await api('/api/myfiles/move', { id: b.dataset.move, folder: f.trim() }); toast('Moved.'); return load(); }
    if (b.dataset.attach) { var ref = prompt('Attach a copy to which record on your current project? Type its reference, for example RFI-0001.'); if (!ref) return;
      var r = await api('/api/myfiles/attach', { id: b.dataset.attach, ref: ref.trim() }); toast('Attached to ' + (r.ref || ref.trim()) + '.'); return; }
    if (b.dataset.del) { if (!confirm('Delete ' + b.dataset.name + '? This cannot be undone.')) return; await api('/api/myfiles/delete', { id: b.dataset.del }); toast('Deleted.'); return load(); }
    if (b.dataset.rmfolder) { await api('/api/myfiles/folder/delete', { path: b.dataset.rmfolder }); toast('Folder removed.'); return load(); }
  } catch (x) { toast(x.message, true); }
});
load();
</script>
</body>
</html>`;
