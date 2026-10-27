import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK, SWITCHER_CSS, SWITCHER_JS } from './shared.js';
import { ADMIN_CSS, ADMIN_BAR, ADMIN_JS } from './admin-nav.js';

// THE TEST TAB — after setup, before go-live.
//
// Every position on the project down the left. Pick one and the main window is
// that position's real dashboard, on this project's uploaded programme,
// documents and registers, where every workflow can be run for real: raise,
// approve, issue, record. Switch position to hand the work on.
//
// It all happens on a copy of the project (src/testdrive.js), so nothing done
// here reaches the real project. "Complete test" deletes the copy and every
// test record, and then the project can go live.

export const testdriveHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Test · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}${ADMIN_CSS}
.wrap { max-width: 1500px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
        padding: 14px 17px; margin-bottom: 12px; }
.head { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
.head h2 { margin: 0; font-size: var(--fs-body); }
.head .sub { font-size: var(--fs-secondary); color: var(--muted); line-height: 1.55; flex: 1 1 380px; }
.head .spacer { flex: 1; }
.btn.big { font-size: var(--fs-body); padding: 9px 18px; }
.btn.done { background: color-mix(in srgb, var(--good-ink) 16%, transparent); color: var(--good-ink); border-color: transparent; }
.btn.go { background: var(--accent); color: var(--on-accent); border-color: transparent; }
.pill { font-size: var(--fs-secondary); padding: 2px 8px; border-radius: 6px; background: color-mix(in srgb, var(--warn-ink) 15%, transparent); color: var(--warn-ink);
        border: 1px solid var(--line-strong); font-weight: 500; }
.bench { display: grid; grid-template-columns: 230px 1fr; gap: 12px; min-height: 72vh; }
.roles { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 8px;
         align-self: start; position: sticky; top: 10px; }
.roles .lbl { font-size: var(--fs-label); letter-spacing: .08em; text-transform: uppercase; color: var(--muted);
              padding: 6px 8px 8px; }
.role { display: block; width: 100%; text-align: left; border: 1px solid transparent; background: none;
        font: inherit; font-size: var(--fs-secondary); padding: 9px 10px; border-radius: 8px; cursor: pointer; color: var(--ink-2); }
.role:hover { background: var(--surface-2); }
.role.on { background: var(--accent); color: var(--on-accent); font-weight: 500; }
.role small { display: block; font-size: var(--fs-secondary); opacity: .75; font-weight: 400; }
.main { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; position: relative;
        min-height: 72vh; }
.main iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.empty { padding: 34px 26px; color: var(--ink-2); line-height: 1.65; font-size: var(--fs-body); max-width: 700px; }
.empty h3 { color: var(--ink); font-size: var(--fs-headline); margin: 0 0 8px; }
.empty ol { padding-left: 20px; }
@media (max-width: 820px) { .bench { grid-template-columns: 1fr; } .roles { position: static; } }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Test</h1><div class="sub">every position, every workflow, for real — then go live</div></div>
  <div class="spacer"></div>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  <a class="btn" href="/home">All projects</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  ${ADMIN_BAR}
  <div id="msg" class="msg" hidden></div>

  <div class="card">
    <div class="head">
      <h2>Test the project</h2><span class="pill" id="pill" hidden>TEST RUNNING</span>
      <div class="sub" id="sub">Loading…</div>
      <div class="spacer"></div>
      <button class="btn big prim" id="start" hidden>Start testing</button>
      <button class="btn big done" id="complete" hidden>Complete test</button>
      <button class="btn big go" id="golive" hidden>Go live</button>
    </div>
  </div>

  <div class="bench" id="bench" hidden>
    <div class="roles"><div class="lbl">Positions</div><div id="roles"></div></div>
    <div class="main" id="main"></div>
  </div>
</div>

<script>
var S = null, current = null, completed = false;
function el(id){ return document.getElementById(id); }
function pid(){ return window.PROJECT_ID || new URLSearchParams(location.search).get('p') || ''; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function say(t, ok){ var m = el('msg'); m.hidden = !t; m.innerHTML = t || ''; m.className = 'msg ' + (ok ? 'ok' : 'err'); }
async function call(path, body){
  var r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ project_id: pid() }, body)) } : { cache: 'no-store' });
  var d = await r.json().catch(function(){ return {}; });
  if (!r.ok || d.error) throw new Error(d.error || ('HTTP ' + r.status));
  return d;
}

function paint(){
  var live = S.project && S.project.state !== 'draft';
  el('pill').hidden = !S.running;
  el('start').hidden = S.running || completed;
  el('complete').hidden = !S.running;
  el('golive').hidden = S.running || !completed || live;
  el('bench').hidden = !S.running;
  if (!S.running) {
    el('sub').innerHTML = completed
      ? '<b>Test complete.</b> Every test record and test person has been deleted. The project is exactly as it was set up' + (live ? ', and it is live.' : ' \\u2014 go live when you are ready.')
      : 'Start testing to get every position on this project down the left. Pick one and you are in their real dashboard, '
        + 'with this project\\u2019s uploaded programme, documents and registers. Raise, approve, issue and record as each of them. '
        + 'Everything you do is on a test copy: <b>Complete test</b> deletes all of it, and then you go live.';
    return;
  }
  el('sub').innerHTML = 'Testing since ' + esc(String(S.started_at || '').replace('T', ' ').slice(0, 16))
    + ' \\u00b7 ' + S.actions + ' actions so far. Nothing here reaches the real project. '
    + 'Press <b>Complete test</b> when every workflow has been tried.';
  el('roles').innerHTML = S.personas.map(function(x){
    return '<button class="role' + (current === x.role ? ' on' : '') + '" data-role="' + esc(x.role) + '">'
      + esc(x.label) + '</button>';
  }).join('');
  Array.prototype.forEach.call(el('roles').querySelectorAll('[data-role]'), function(b){
    b.addEventListener('click', function(){ act(b.getAttribute('data-role')); });
  });
  if (!current) el('main').innerHTML = '<div class="empty"><h3>Pick a position on the left</h3>'
    + '<ol><li>You see that position\\u2019s own dashboard, as they will on the day.</li>'
    + '<li>Do their work \\u2014 e.g. as the <b>Project Manager</b> prepare a letter and sign it.</li>'
    + '<li>Pick the next position \\u2014 e.g. <b>Document Control</b> \\u2014 and the letter is waiting for them to issue.</li>'
    + '<li>When every workflow has been tried, press <b>Complete test</b>.</li></ol></div>';
}

async function load(){
  try { S = await call('/api/testdrive?project=' + encodeURIComponent(pid())); paint(); }
  catch (e) { say(esc(e.message), false); }
}
el('start').addEventListener('click', async function(){
  var b = this; b.disabled = true; b.textContent = 'Preparing the test copy\\u2026';
  try { await call('/api/testdrive/start', {}); say('', true); completed = false; await load(); }
  catch (e) { say(esc(e.message), false); }
  b.disabled = false; b.textContent = 'Start testing';
});
async function act(role){
  try {
    await call('/api/testdrive/as', { role: role });
    current = role; paint();
    el('main').innerHTML = '<iframe title="Test" src="/?test=' + Date.now() + '"></iframe>';
  } catch (e) { say(esc(e.message), false); }
}
el('complete').addEventListener('click', async function(){
  if (!confirm('Complete the test?\\n\\nEvery test record, document, approval and test person is deleted now. '
    + 'The real project is not touched.')) return;
  var b = this; b.disabled = true; b.textContent = 'Deleting test data\\u2026';
  try {
    var d = await call('/api/testdrive/end', {});
    current = null; completed = true; el('main').innerHTML = '';
    say('Test complete \\u2014 ' + d.removed + ' test rows and ' + d.people + ' test people deleted.', true);
    await load();
  } catch (e) { say(esc(e.message), false); }
  b.disabled = false; b.textContent = 'Complete test';
});
el('golive').addEventListener('click', async function(){
  var name = (S.project && S.project.name) || 'this project';
  if (!confirm('Take ' + name + ' live?\\n\\nIts people can sign in from that moment, and documents can no longer be deleted.')) return;
  var b = this; b.disabled = true;
  try {
    await call('/api/setup/golive', {});
    say('Live. ' + esc(name) + ' has been handed over.', true);
    await load();
  } catch (e) {
    say(esc(e.message) + ' <a href="/handover?p=' + encodeURIComponent(pid()) + '">Open Handover</a>', false);
    b.disabled = false;
  }
});
// Leaving the page hands the Admin their own session back.
window.addEventListener('pagehide', function(){
  try { navigator.sendBeacon('/api/testdrive/back', new Blob([JSON.stringify({ project_id: pid() })], { type: 'application/json' })); } catch (e) {}
});
load();
${SWITCHER_JS}
${PWA_BOOT}
</script>
${ADMIN_JS('test')}
</body>
</html>`;
