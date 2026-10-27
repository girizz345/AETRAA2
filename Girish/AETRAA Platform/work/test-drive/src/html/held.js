import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK, SWITCHER_CSS } from './shared.js';

// Spec §7, §21, §22: the held list. AETRAA works through what the gate held —
// every project at once, grouped by reason, so "142 sheets numbered SUB-" is
// one decision rather than 142 — and approves, approves and widens the
// numbering rule, or rejects with a reason the uploader is told. Anyone else
// sees their own project's held items, read-only, so a document that is with
// AETRAA is never mistaken for one that is lost.
export const heldHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Held documents · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1050px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-secondary); } td, th { padding: 6px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
th { font-size: var(--fs-secondary); color: var(--muted); }
textarea { width: 100%; min-height: 50px; font: inherit; padding: 6px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); color: var(--ink); }
.sub { font-size: var(--fs-secondary); color: var(--muted); }
.warn { border-left: 3px solid var(--critical); padding: 6px 10px; margin: 6px 0; font-size: var(--fs-secondary); background: var(--surface-2); }
h2 { margin: 0 0 6px; font-size: var(--fs-body); }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Held documents</h1><div class="sub">what the gate held, and why</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/intake-history">Intake history</a>
  <a class="btn" href="/">Home</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>
<div class="wrap">
  <div class="card"><div id="top" class="sub">Loading…</div><div id="say" class="sub" style="margin-top:6px"></div></div>
  <div id="groups"></div>
</div>
<script>
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
async function post(path, body){ var r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); return r.json().catch(function(){ return { error: 'no answer from the server' }; }); }
function say(t){ document.getElementById('say').textContent = t; }
var D = null;
function days(iso){ var n = Math.floor((Date.now() - Date.parse(iso || '')) / 86400000); return isNaN(n) ? '' : n === 0 ? 'today' : n === 1 ? '1 day' : n + ' days'; }
async function load(){
  D = await (await fetch('/api/quarantine?all=1', { cache: 'no-store' })).json();
  if (D.error) { document.getElementById('top').textContent = D.error; return; }
  var items = D.items || [], names = D.projects || {};
  var byProj = {}; items.forEach(function(i){ byProj[i.project_id] = (byProj[i.project_id] || 0) + 1; });
  document.getElementById('top').innerHTML = items.length
    ? '<b>' + items.length + ' held</b> on ' + Object.keys(byProj).length + ' project' + (Object.keys(byProj).length === 1 ? '' : 's') + '. ' +
      (D.may_decide ? 'Decide a group at once, or open a file first. A rejection needs a reason — whoever sent it is told.' : 'These are with AETRAA. Nothing for you to do; you will be told what is decided.') +
      Object.keys(byProj).filter(function(p){ return byProj[p] > 20; }).map(function(p){ return '<div class="warn">' + byProj[p] + ' items held on ' + esc(names[p] || p) + '. That is unusual — worth checking the numbering scheme before approving.</div>'; }).join('') +
      (D.tenant_warnings || []).map(function(t){ return '<div class="warn">' + esc(t.org_name || t.org_id || '') + ': ' + esc(t.held || t.count || '') + ' held in 90 days.</div>'; }).join('')
    : 'Nothing held. Everything loaded matched its project.';
  var byId = {}; items.forEach(function(i){ byId[i.id] = i; });
  document.getElementById('groups').innerHTML = (D.groups || []).map(function(g, gi){
    var list = g.ids.map(function(id){ return byId[id]; }).filter(Boolean);
    return '<div class="card"><h2>' + esc(g.count + ' × ' + (g.prefix ? 'numbered ' + g.prefix + '-' : g.kind)) + ' <span class="sub">· ' + esc(names[g.project_id] || g.project_id) + '</span></h2>' +
      '<div class="sub">' + esc(g.reason || '') + '</div>' +
      '<table style="margin-top:8px"><tr><th>File</th><th>Number</th><th>Sent by</th><th>Held</th><th></th></tr>' + list.map(function(i){
        return '<tr><td>' + esc(i.filename) + '</td><td>' + esc(i.number || i.ref || '') + '</td><td>' + esc(i.held_by || '') + '</td><td>' + esc(days(i.held_at)) + '</td>' +
          '<td><a class="btn" href="/api/quarantine/file?id=' + encodeURIComponent(i.id) + '" target="_blank">Open</a></td></tr>'; }).join('') + '</table>' +
      (D.may_decide ? '<div style="margin-top:8px"><textarea id="note' + gi + '" placeholder="Note — required to reject; the sender is told it in your words"></textarea>' +
        '<button class="btn prim dec" data-g="' + gi + '" data-a="approve">Approve and file all ' + g.count + '</button> ' +
        (g.prefix && g.kind === 'drawing' ? '<button class="btn dec" data-g="' + gi + '" data-a="approve_widen">Approve, and accept ' + esc(g.prefix) + '- on this project from now on</button> ' : '') +
        '<button class="btn dec" data-g="' + gi + '" data-a="reject">Reject</button></div>' : '') +
      '</div>';
  }).join('');
  [].forEach.call(document.querySelectorAll('button.dec'), function(b){ b.addEventListener('click', async function(){
    var g = D.groups[+b.getAttribute('data-g')], a = b.getAttribute('data-a'), note = document.getElementById('note' + b.getAttribute('data-g')).value.trim();
    if (a === 'reject' && !note) { say('Say why it is rejected — whoever sent it is told the reason.'); return; }
    if (!confirm((a === 'reject' ? 'Reject ' : 'Approve ') + g.count + ' item' + (g.count === 1 ? '' : 's') + '?')) return;
    b.disabled = true; say('Working…');
    var r = await post('/api/quarantine/decide', { ids: g.ids, action: a, note: note || undefined });
    say(r.error ? r.error : (r.decided || []).length + ' decided, ' + (r.filed || []).length + ' filed' + ((r.errors || []).length ? ', ' + r.errors.length + ' could not be: ' + r.errors.map(function(e){ return e.error; }).join('; ') : '') + '.');
    load();
  }); });
}
load();
</script>
</body>
</html>`;
