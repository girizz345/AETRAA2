// ONE PROJECT, PICKED ONCE, CARRIED EVERYWHERE.
//
// The admin screens grew one at a time, and each arrived with a project
// dropdown of its own. Five screens, five pickers, each remembering a different
// project, and no way back to a list of them — an Admin who opened Documents
// for Tower A and then Organisation was looking at Tower C without being told.
//
// So: the project is chosen once, on the home screen, and after that it lives
// in the address. Every admin screen carries the same bar — the project's name,
// the tabs of everything that has to be done to it, and a way home — and every
// tab keeps the project it was opened with.
//
// THE TABS ARE THE ORDER THE WORK HAPPENS IN. Organisation before documents,
// because a document has no route until somebody is there to receive it.
// Documents before the checks, because a screen with nothing on it cannot be
// checked. The checks before go-live, because handover is irreversible. An
// Admin reading the tabs left to right is reading the job.

export const ADMIN_TABS = [
  { id: 'overview', href: '/project',  label: 'Overview' },
  { id: 'parties',  href: '/parties',  label: 'Parties' },
  { id: 'modules',  href: '/modules',  label: 'Modules' },
  { id: 'org',      href: '/org',      label: 'Organisation' },
  { id: 'workflows',href: '/workflows',label: 'Workflows' },
  { id: 'docs',     href: '/files',    label: 'Documents' },
  { id: 'setup',    href: '/setup',    label: 'Setup' },
  { id: 'test',     href: '/testdrive', label: 'Test' },
  { id: 'handover', href: '/handover', label: 'Handover' },
];

// THE ORDER SETTING A PROJECT UP HAPPENS IN.
//
// The tabs say where you can go; this says where you are. They are not the same
// list: the contract step is not a tab, because once it has been read there is
// nothing to come back to, and Overview is not a step, because it is the thing
// you look at afterwards.
//
// Each step is only answerable once the one before it is. The parties come from
// the contract, so the contract is read first. The modules belong to the
// parties, so the parties are settled first. A role can only be given to
// somebody once you know which side they are on, and a workflow route can only
// bind to a role that exists. Nothing here is an arbitrary ordering.
export const SETUP_STEPS = [
  { id: 'new',      href: '/new',      label: 'Name & party' },
  { id: 'contract', href: '/contract', label: 'Contract' },
  { id: 'parties',  href: '/parties',  label: 'Parties' },
  { id: 'modules',  href: '/modules',  label: 'Modules' },
  { id: 'org',      href: '/org',      label: 'People' },
  { id: 'workflows',href: '/workflows',label: 'Workflows' },
  { id: 'docs',     href: '/files',    label: 'Documents' },
  { id: 'test',     href: '/testdrive', label: 'Test' },
  { id: 'handover', href: '/handover', label: 'Go live' },
];

export const STEPS_CSS = `
.wsteps { display: flex; gap: 6px; flex-wrap: wrap; margin: 0 0 14px; font-size: var(--fs-secondary); }
.wsteps a, .wsteps span { padding: 4px 10px; border-radius: 6px; background: var(--surface-2);
        border: 1px solid var(--border); color: var(--muted); text-decoration: none; white-space: nowrap; }
.wsteps a:hover { color: var(--ink); }
.wsteps .on { background: var(--ink); color: var(--surface); border-color: transparent; font-weight: 500; }
.wsteps .n { opacity: .6; margin-right: 5px; }
`;

// The strip. `active` is a step id. `linked` false renders plain text, which is
// what the very first screen needs — there is no project yet, so there is
// nowhere for the other steps to go.
//
// When linked, each step carries its path in data-h and ADMIN_JS puts the
// project on the end. Building the href here would need the project id at
// render time, and the whole point of the admin bar is that the project lives
// in the address rather than in the page.
export const STEPS_BAR = (active, linked = true) => `
<div class="wsteps" id="wsteps">${SETUP_STEPS.map((s, i) => {
  const inner = `<span class="n">${i + 1}</span>${s.label}`;
  if (s.id === active) return `<span class="on">${inner}</span>`;
  if (!linked) return `<span>${inner}</span>`;
  return `<a data-h="${s.href}" href="${s.href}">${inner}</a>`;
}).join('')}</div>`;

export const ADMIN_CSS = `
.abar { background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
        padding: 11px 14px 0; margin-bottom: 12px; }
.abar .top { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
.abar .home { font-size: var(--fs-secondary); color: var(--muted); text-decoration: none; white-space: nowrap; }
.abar .home:hover { color: var(--ink); }
.abar h2 { margin: 0; font-size: var(--fs-headline); flex: 1 1 auto; min-width: 0; }
.abar .ref { font-size: var(--fs-secondary); color: var(--muted); }
.abar .state { font-size: var(--fs-label); font-weight: 500; letter-spacing: .05em; text-transform: uppercase;
               padding: 2px 8px; border-radius: 5px; }
.abar .state.draft { background: color-mix(in srgb, var(--warn-ink) 16%, transparent); color: var(--warn-ink); }
.abar .state.live  { background: color-mix(in srgb, var(--good-ink) 16%, transparent); color: var(--good-ink); }
.abar .tabs { display: flex; gap: 2px; margin-top: 11px; flex-wrap: wrap; }
.abar .tabs a { padding: 8px 13px; font-size: var(--fs-secondary); text-decoration: none; color: var(--ink-2);
                border-bottom: 2px solid transparent; white-space: nowrap; }
.abar .tabs a:hover { color: var(--ink); }
.abar .tabs a.on { color: var(--ink); font-weight: 500; border-bottom-color: var(--ink); }
.abar .tabs a .dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%;
                     background: var(--warn); margin-left: 5px; vertical-align: 1px; }
.abar .none { padding: 6px 0 12px; font-size: var(--fs-secondary); color: var(--muted); }
`;

// The bar itself. Rendered empty and filled by ADMIN_JS once the project is
// known, so every screen holds the same markup and there is one place to change
// how it looks.
export const ADMIN_BAR = `
<div class="abar" id="abar">
  <div class="top">
    <a class="home" href="/home">&larr; All projects</a>
    <h2 id="abName">&mdash;</h2>
    <span class="ref" id="abRef"></span>
    <span class="state" id="abState" hidden></span>
  </div>
  <div class="tabs" id="abTabs"></div>
  <div class="none" id="abNone" hidden>
    No project chosen. <a href="/home">Pick one from the home screen</a>.
  </div>
</div>`;

// `active` is one of the ids in ADMIN_TABS.
//
// A screen opened with no project in the address sends the Admin home rather
// than guessing one. Guessing is what the five separate dropdowns did, and it
// is how somebody ends up loading Tower C's contract into Tower A.
export const ADMIN_JS = (active) => `
<script>
(function(){
  var TABS = ${JSON.stringify(ADMIN_TABS)};
  var ACTIVE = ${JSON.stringify(active)};

  function qp(){ return new URLSearchParams(location.search).get('p') || ''; }
  window.PROJECT_ID = qp();

  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  function paintTabs(pid, flags){
    document.getElementById('abTabs').innerHTML = TABS.map(function(t){
      var mark = flags && flags[t.id] ? '<span class="dot" title="something outstanding"></span>' : '';
      return '<a href="' + t.href + '?p=' + encodeURIComponent(pid) + '"'
           + (t.id === ACTIVE ? ' class="on"' : '') + '>' + esc(t.label) + mark + '</a>';
    }).join('');
  }

  async function boot(){
    var pid = qp();
    if (!pid) {
      document.getElementById('abNone').hidden = false;
      document.getElementById('abName').textContent = 'No project';
      // Nothing on this screen can be right without one, so go and choose.
      location.replace('/home');
      return;
    }
    paintTabs(pid, null);
    // The setup strip, where a screen carries one.
    var ws = document.getElementById('wsteps');
    if (ws) {
      var links = ws.querySelectorAll('a[data-h]');
      for (var i = 0; i < links.length; i++) {
        links[i].href = links[i].getAttribute('data-h') + '?p=' + encodeURIComponent(pid);
      }
    }
    try {
      var r = await fetch('/api/admin-home', { cache: 'no-store' });
      var d = await r.json();
      var p = (d.projects || []).filter(function(x){ return x.id === pid; })[0];
      if (!p) { document.getElementById('abName').textContent = 'Unknown project'; return; }
      document.getElementById('abName').textContent = p.name;
      document.getElementById('abRef').textContent = [p.company, p.ref].filter(Boolean).join(' \\u00b7 ');
      var st = document.getElementById('abState');
      st.hidden = false;
      st.textContent = p.state === 'draft' ? 'In setup' : 'Live';
      st.className = 'state ' + (p.state === 'draft' ? 'draft' : 'live');
      // A dot marks a tab with work outstanding, so the bar says where to go
      // next without an Admin opening each one to find out.
      paintTabs(pid, {
        org: !p.people,
        docs: !(p.drawings + p.documents),
        handover: p.state === 'draft' && !(p.checks && p.checks.ready),
      });
      window.PROJECT = p;
      document.dispatchEvent(new CustomEvent('project-ready', { detail: p }));
    } catch (e) { /* the bar stays as it is; the screen still works */ }
  }
  boot();
})();
</script>`;
