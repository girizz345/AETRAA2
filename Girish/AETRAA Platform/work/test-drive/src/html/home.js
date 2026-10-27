import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK, SWITCHER_CSS, SWITCHER_JS } from './shared.js';

// THE ADMIN'S HOME — every project on the platform, and the way into each.
//
// What this replaces: an Admin signed in and landed on a setup console with a
// project dropdown on it. Every other admin screen had a dropdown of its own,
// each remembering something different, and none of them showed the estate. To
// find out how a project was doing you opened five screens and read five
// pickers; to move between two projects you changed a dropdown five times.
//
// So a project is chosen HERE, once, by clicking the thing itself — and after
// that it is carried in the address, with the same tabs on every screen.
//
// EACH CARD SAYS WHAT TO DO NEXT, not just what is in it. "3 of 9" tells an
// Admin nothing about which screen to open. "5 of 9 dashboards still to check"
// names the work and the card takes him there. A project in setup is a job with
// a next action; a live project is a job being run.
//
// NO DROPDOWNS ON THIS SCREEN, deliberately. Choosing from a list you can see
// is not the same act as choosing from a list you have to open, and the whole
// reason this exists is that the second kind was being got wrong.

export const homeHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Projects · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1180px; }

/* Start a new project — a full-width row of its own, above everything, because
   it is the one action on this screen that is not about an existing project. */
.start { display: flex; gap: 14px; align-items: center; flex-wrap: wrap;
         background: var(--surface); border: 1.5px dashed var(--border); border-radius: 12px;
         padding: 16px 18px; margin-bottom: 18px; text-decoration: none; color: inherit; }
.start:hover { border-color: color-mix(in srgb, var(--good-ink) 45%, transparent); }
.start .plus { width: 40px; height: 40px; border-radius: 10px; background: var(--surface-2);
               display: grid; place-items: center; font-size: var(--fs-title); color: var(--muted); flex: 0 0 auto; }
.start:hover .plus { background: color-mix(in srgb, var(--good-ink) 16%, transparent); color: var(--good-ink); }
.start .t { flex: 1 1 260px; min-width: 0; }
.start .t b { display: block; font-size: var(--fs-body); }
.start .t small { color: var(--muted); font-size: var(--fs-secondary); }

.gname { font-size: var(--fs-label); font-weight: 500; letter-spacing: .07em; text-transform: uppercase;
         color: var(--muted); margin: 22px 0 9px 2px; }
.gname:first-of-type { margin-top: 0; }

.grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
.p { display: block; background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
     padding: 15px 16px; text-decoration: none; color: inherit; }
.p:hover { border-color: var(--ink-2); }
.p .hd { display: flex; gap: 9px; align-items: flex-start; }
.p h3 { margin: 0 0 2px; font-size: var(--fs-body); flex: 1 1 auto; min-width: 0; }
.p .co { font-size: var(--fs-secondary); color: var(--muted); }
.state { font-size: var(--fs-label); font-weight: 500; letter-spacing: .05em; text-transform: uppercase;
         padding: 2px 8px; border-radius: 5px; flex: 0 0 auto; }
.state.draft { background: color-mix(in srgb, var(--warn-ink) 16%, transparent); color: var(--warn-ink); }
.state.live  { background: color-mix(in srgb, var(--good-ink) 16%, transparent); color: var(--good-ink); }

.nums { display: flex; gap: 16px; flex-wrap: wrap; margin: 13px 0 0; }
.nums div { font-size: var(--fs-secondary); color: var(--muted); }
.nums b { display: block; font-size: var(--fs-headline); color: var(--ink); font-variant-numeric: tabular-nums;
          font-weight: 500; }
.nums b.zero { color: var(--muted); font-weight: 400; }

.bar { height: 5px; border-radius: 3px; background: var(--surface-2); overflow: hidden; margin: 13px 0 0; }
.bar i { display: block; height: 100%; background: var(--good); }

.next { margin-top: 11px; padding-top: 10px; border-top: 1px solid var(--border);
        font-size: var(--fs-secondary); display: flex; gap: 7px; align-items: center; }
.next .w { flex: 1 1 auto; min-width: 0; }
.next.todo .w { color: var(--warn-ink); font-weight: 500; }
.next.ready .w { color: var(--good-ink); font-weight: 500; }
.next.done .w { color: var(--muted); }
.next .go { color: var(--muted); font-size: var(--fs-body); }

.wrapc { position: relative; }
.kill { position: absolute; right: 12px; bottom: 11px; font-size: var(--fs-secondary); color: var(--muted);
        background: none; border: 0; cursor: pointer; padding: 3px 6px; border-radius: 6px; }
.kill:hover { color: var(--bad-ink); background: var(--surface-2); }
.confirm { background: var(--surface); border: 1px solid color-mix(in srgb, var(--warn-ink) 45%, transparent); border-radius: 12px;
           padding: 14px 16px; }
.confirm b { display: block; font-size: var(--fs-body); margin-bottom: 3px; }
.confirm p { margin: 0 0 11px; font-size: var(--fs-secondary); color: var(--muted); line-height: 1.55; }
.confirm .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.confirm input { flex: 1 1 200px; }
.btn.red { background: color-mix(in srgb, var(--bad-ink) 16%, transparent); color: var(--bad-ink); border-color: transparent; }
.empty { background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
         padding: 30px 18px; text-align: center; color: var(--muted); font-size: var(--fs-secondary); }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>AETRAA Admin</h1><div class="sub">every project on the platform</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/launch-check" title="What this server has been given, and what it still needs before launch">Launch check</a>
  <a class="btn" href="/held" title="What the gate held on every project, to approve or reject">Held</a>
  <a class="btn" href="/storage" title="What each project holds, and where its files are kept">Storage</a>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  <div id="msg" class="msg" hidden></div>

  <a class="start" href="/new">
    <div class="plus">+</div>
    <div class="t"><b>Start a new project</b>
      <small>Its name and its Principal. Everything else is read from the contract.</small></div>
    <span class="btn">Begin →</span>
  </a>

  <div id="body"></div>
</div>

<script>
function el(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function say(t){ var m=el('msg'); m.hidden=false; m.textContent=t; m.className='msg err'; }
function money(n){ return n ? 'AED ' + Number(n).toLocaleString('en-AE', { maximumFractionDigits: 0 }) : '—'; }
function num(n){ return '<b' + (n ? '' : ' class="zero"') + '>' + (n || 0) + '</b>'; }

function card(p){
  // Where clicking the card lands: the screen with the outstanding work on it,
  // not always the same tab. A project waiting on its organisation opens on
  // Organisation; a live one opens on its overview.
  var href = (p.next && p.next.where ? p.next.where : '/project') + '?p=' + encodeURIComponent(p.id);
  var cls = p.next && p.next.done ? 'done' : (p.next && p.next.ready ? 'ready' : 'todo');
  var pct = p.checks && p.checks.total ? Math.round(100 * p.checks.done / p.checks.total) : 0;

  return '<div class="wrapc"><a class="p" href="' + href + '">'
    + '<div class="hd"><div style="flex:1 1 auto;min-width:0">'
    + '<h3>' + esc(p.name) + '</h3>'
    + '<div class="co">' + esc([p.company, p.ref].filter(Boolean).join(' · ')) + '</div></div>'
    + '<span class="state ' + (p.state === 'draft' ? 'draft' : 'live') + '">'
    + (p.state === 'draft' ? 'In setup' : 'Live') + '</span></div>'

    + '<div class="nums">'
    + '<div>' + num(p.people) + 'people</div>'
    + '<div>' + num(p.drawings) + 'drawings</div>'
    + '<div>' + num(p.documents) + 'documents</div>'
    + '<div>' + num(p.boq_lines) + 'BOQ lines</div>'
    + (p.boq_total ? '<div><b>' + esc(money(p.boq_total)) + '</b>contract</div>' : '')
    + '</div>'

    + (p.state === 'draft' && p.checks && p.checks.total
        ? '<div class="bar"><i style="width:' + pct + '%"></i></div>' : '')

    + '<div class="next ' + cls + '"><span class="w">'
    + esc((p.next && p.next.what) || '') + '</span><span class="go">→</span></div>'
    + '</a>'
    /* DELETE, WHERE IT IS ACTUALLY LOOKED FOR.
     *
     * It existed on the project's own page, behind a typed name — and stayed
     * unfound, because a project you have abandoned is one you never open
     * again. Three empty drafts sat on this screen with no way to clear them
     * from it.
     *
     * Only while in setup. Once a project is live it holds the client's
     * documents and deletion closes for good; that is the whole point of the
     * handover. */
    + (p.state === 'draft'
        ? '<button class="kill" data-del="' + esc(p.id) + '" title="Delete this draft">Delete</button>'
        : '') + '</div>';
}

function paint(d){
  var all = (d.projects || []).filter(function(p){ return !p.archived; });
  if (!all.length) {
    el('body').innerHTML = '<div class="empty">No projects yet. Start one above — it takes a name '
      + 'and a Principal, and nothing else.</div>';
    return;
  }
  var setup = all.filter(function(p){ return p.state === 'draft'; });
  var live  = all.filter(function(p){ return p.state !== 'draft'; });

  var out = '';
  // In setup first: those are the ones with work waiting on somebody here.
  if (setup.length) {
    out += '<div class="gname">In setup — ' + setup.length + '</div>'
         + '<div class="grid">' + setup.map(card).join('') + '</div>';
  }
  if (live.length) {
    out += '<div class="gname">Live — ' + live.length + '</div>'
         + '<div class="grid">' + live.map(card).join('') + '</div>';
  }
  el('body').innerHTML = out;

  Array.prototype.forEach.call(el('body').querySelectorAll('[data-del]'), function(b){
    b.addEventListener('click', function(ev){
      ev.preventDefault(); ev.stopPropagation();
      askDelete((d.projects || []).filter(function(x){ return x.id === b.getAttribute('data-del'); })[0]);
    });
  });
}

/* THE NAME HAS TO BE TYPED, and that is not theatre.
 *
 * Three drafts on this screen carry the SAME name and differ by one character
 * of id. A confirm dialog would be clicked through; typing the name makes the
 * operator read what is in front of him. The server checks it again — this is
 * the second lock, not the only one. */
function askDelete(p){
  if (!p) return;
  var box = document.createElement('div');
  box.className = 'confirm';
  box.innerHTML = '<b>Delete “' + esc(p.name) + '”?</b>'
    + '<p>This project, and everything in it. It cannot be undone. '
    + 'Type the project name to confirm.</p>'
    + '<div class="row"><input id="delIn" placeholder="' + esc(p.name) + '" autocomplete="off">'
    + '<button class="btn red" id="delGo">Delete for good</button>'
    + '<button class="btn" id="delNo">Cancel</button></div>';
  el('body').insertBefore(box, el('body').firstChild);
  el('delIn').focus();
  window.scrollTo(0, 0);

  el('delNo').addEventListener('click', function(){ box.remove(); });
  el('delGo').addEventListener('click', async function(){
    if (el('delIn').value.trim() !== (p.name || '').trim()) {
      say('The name does not match. Nothing was deleted.'); return;
    }
    this.disabled = true;
    try {
      var r = await fetch('/api/project', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: p.id, confirm_name: el('delIn').value.trim() }) });
      var d = await r.json();
      if (d.ok) { box.remove(); await reload(); }
      else { say(d.error || 'Could not delete it.'); this.disabled = false; }
    } catch (e) { say('Could not reach the server.'); this.disabled = false; }
  });
}

async function reload(){
  try {
    var r = await fetch('/api/admin-home', { cache: 'no-store' });
    var d = await r.json();
    if (!r.ok) { say(d.error || 'Could not read the projects.'); return; }
    el('msg').hidden = true;
    paint(d);
  } catch (e) { say('Could not reach the server.'); }
}
reload();
${SWITCHER_JS}
${PWA_BOOT}
</script>
</body>
</html>`;
