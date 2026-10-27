import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK, SWITCHER_CSS, SWITCHER_JS } from './shared.js';
import { STEPS_CSS, STEPS_BAR } from './admin-nav.js';
import { PARTIES } from '../parties.js';

// STARTING A PROJECT — its name, and its Principal.
//
// This used to be twenty fields on a shared console: client, consultant,
// contractor, location, completion date, currency, retention, retention cap,
// advance, payment days, notice clause, RFI reply days. Thirteen of them are on
// the first page of the contract, and typing them here before the contract has
// been loaded is how a project ends up with 10% retention because that was the
// number already in the box, not because the contract said so.
//
// So the form is the two things that cannot be read from anything: what the job
// is called, and who at the client is accountable for it. Everything else is
// extracted when the documents are loaded, and confirmed on the screen that
// shows the clause it came from.
//
// AND IT IS ALWAYS A DRAFT. There used to be a "Create project & go live"
// button beside this form. A project cannot be handed over at the moment it is
// created — before it has an organisation, a document in it, or a single screen
// checked — and offering a button that does it is offering a mistake.
//
// THE ONE QUESTION ADDED: WHICH SIDE ARE YOU ON.
//
// It cannot be read from the contract, because the contract names all three
// parties and says nothing about which of them is holding this screen. And
// nothing downstream works without it: a contractor, a consultant and a
// developer are offered different roles, different dashboards and different
// halves of every workflow route. The platform used to assume contractor
// everywhere, silently, which is why a consultant was offered Procurement and a
// developer could not be put on a project at all.
//
// It asks only about YOUR company. Who the other two are comes off the first
// page of the contract on step 3, confirmed against the clause. Asking an
// admin to type the Engineer's name here, before the contract has been loaded,
// is the same mistake as asking for the retention percentage.

export const newProjectHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Start a project · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}${STEPS_CSS}
.wrap { max-width: 720px; }
.parties { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 4px; }
@media (max-width: 620px) { .parties { grid-template-columns: 1fr; } }
.pcard { border: 1px solid var(--border); border-radius: 10px; padding: 12px 13px; cursor: pointer;
         background: var(--surface-2); transition: border-color .12s, background .12s; }
.pcard:hover { border-color: var(--ink-2); }
.pcard.on { border-color: var(--ink); background: var(--surface);
            box-shadow: inset 0 0 0 1px var(--ink); }
.pcard b { display: block; font-size: var(--fs-secondary); margin-bottom: 3px; }
.pcard span { font-size: var(--fs-secondary); color: var(--muted); line-height: 1.5; display: block; }
.pcard input { position: absolute; opacity: 0; pointer-events: none; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
        padding: 18px 20px; margin-bottom: 12px; }
.home { font-size: var(--fs-secondary); color: var(--muted); text-decoration: none; display: inline-block;
        margin-bottom: 12px; }
.home:hover { color: var(--ink); }
h2 { margin: 0 0 4px; font-size: var(--fs-headline); }
.lede { font-size: var(--fs-secondary); color: var(--muted); line-height: 1.6; margin-bottom: 20px; }
h3 { margin: 22px 0 3px; font-size: var(--fs-secondary); }
h3:first-of-type { margin-top: 0; }
.why { font-size: var(--fs-secondary); color: var(--muted); margin-bottom: 10px; line-height: 1.55; }
.f { margin-bottom: 11px; }
.f label { display: block; font-size: var(--fs-secondary); color: var(--muted); margin-bottom: 4px; }
.f input, .f select { width: 100%; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
@media (max-width: 560px) { .two { grid-template-columns: 1fr; } }
.later { margin-top: 20px; padding: 13px 15px; border-radius: 10px; background: var(--surface-2);
         border: 1px solid var(--border); font-size: var(--fs-secondary); color: var(--muted); line-height: 1.65; }
.later b { color: var(--ink); }
.go { margin-top: 20px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.btn.big { font-size: var(--fs-body); padding: 10px 22px; }
.steps { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 9px; font-size: var(--fs-secondary); color: var(--muted); }
.steps span { padding: 3px 9px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--border); }
.steps span.on { background: var(--ink); color: var(--surface); border-color: transparent; font-weight: 500; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Start a project</h1><div class="sub">two things, and the rest comes from the contract</div></div>
  <div class="spacer"></div>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  <a class="btn" href="/home">All projects</a>
</div></div>

<div class="wrap">
  <a class="home" href="/home">&larr; All projects</a>
  <div id="msg" class="msg" hidden></div>

  <div class="card">
    <h2>A new project</h2>
    <div class="lede">
      Its name, and its Principal. The client, the Engineer, the completion date and all seven
      commercial figures are on the contract — they are read from it when you load the documents,
      and you confirm them there against the clause they came from.
    </div>
    ${STEPS_BAR('new', false)}

    <h3 style="margin-top:24px">Your organisation</h3>
    <div class="why">Whose platform this project sits on. The email domain decides whose addresses
      may be added to it later.</div>
    <div class="f"><label>Company</label>
      <select id="company_id"><option value="">— A new company —</option></select></div>
    <div id="newCo">
      <div class="f"><label>Company name</label>
        <input id="company_name" placeholder="Company name" autocomplete="off"></div>
      <div class="two">
        <div class="f"><label>Email domain(s)</label>
          <input id="company_domains" placeholder="company.com" autocomplete="off"></div>
        <div class="f"><label>Also allowed — optional</label>
          <input id="company_allowed" placeholder="partner.com" autocomplete="off"></div>
      </div>
    </div>

    <h3>Which side are you on, on this project?</h3>
    <div class="why">The one thing the contract cannot tell us — it names all three parties and
      does not know which of them is you. It decides the roles you are offered, the dashboards
      those roles open, and which half of each workflow route is yours. The other parties are
      read off the contract on step 3.</div>
    <div class="parties">
      ${PARTIES.map((p) => `<label class="pcard" data-party="${p.id}">
        <input type="radio" name="self_party" value="${p.id}"${p.id === 'contractor' ? ' checked' : ''}>
        <b>${p.short}</b><span>${p.note}</span></label>`).join('')}
    </div>

    <h3>The project</h3>
    <div class="f"><label>Project name</label>
      <input id="p_name" placeholder="Project name" autocomplete="off"></div>

    <h3>The Principal</h3>
    <div class="why" id="prWhy">Your organisation's top person on this job. They hold the project
      after handover, so there must be one from the start — and they cannot be removed later.</div>
    <div class="two">
      <div class="f"><label>Full name</label><input id="pr_name" placeholder="Full name" autocomplete="off"></div>
      <div class="f"><label>Email — their sign-in</label>
        <input id="pr_email" placeholder="name@company.com" autocomplete="off"></div>
    </div>

    <div class="later">
      It is created as a <b>draft</b>: nobody can sign in and it is visible only to AETRAA.
      Next you load the <b>contract</b> and everything else is read from it — the other parties,
      the completion date and all seven commercial figures. Then the <b>modules</b> each party
      runs, the <b>people</b>, the <b>workflows</b>, the <b>documents</b>, and a look at each
      dashboard the way the person who will use it sees it. Only after that can it go live.
    </div>

    <div class="go">
      <button class="btn prim big" id="go">Create and load the contract</button>
      <a class="btn" href="/home">Cancel</a>
    </div>
  </div>
</div>

<script>
function el(id){ return document.getElementById(id); }
function val(id){ var e=el(id); return e ? e.value.trim() : ''; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function say(t, ok){ var m=el('msg'); m.hidden=false; m.textContent=t; m.className='msg '+(ok?'ok':'err'); }

el('company_id').addEventListener('change', function(){
  el('newCo').hidden = !!this.value;
});

// The party cards. A radio, drawn as a card so the note under each one is
// readable — the choice is not obvious and the three sentences are the whole
// explanation.
var PR_WHY = {
  developer: "Your organisation's accountable person for this development. They hold the project "
           + 'after handover, so there must be one from the start — and they cannot be removed later.',
  consultant: "The Engineer named in the contract, or their delegate. They hold the project after "
           + 'handover, so there must be one from the start — and they cannot be removed later.',
  contractor: "Your organisation's top person on this job. They hold the project after handover, so "
           + 'there must be one from the start — and they cannot be removed later.'
};
function paintParty(){
  var cards = document.querySelectorAll('.pcard');
  for (var i = 0; i < cards.length; i++) {
    var on = cards[i].querySelector('input').checked;
    cards[i].className = 'pcard' + (on ? ' on' : '');
    if (on) el('prWhy').textContent = PR_WHY[cards[i].getAttribute('data-party')] || '';
  }
}
document.querySelectorAll('input[name=self_party]').forEach(function(r){
  r.addEventListener('change', paintParty);
});
paintParty();
function selfParty(){
  var r = document.querySelector('input[name=self_party]:checked');
  return r ? r.value : 'contractor';
}

el('go').addEventListener('click', async function(){
  var body = {
    company_id: val('company_id') || undefined,
    company: val('company_id') ? undefined : { name: val('company_name'),
      email_domains: val('company_domains'), email_allowed: val('company_allowed') },
    project: { name: val('p_name'), currency: 'AED', setup_state: 'draft' },
    self_party: selfParty(),
    principal: val('pr_email') ? { name: val('pr_name'), email: val('pr_email') } : undefined,
  };
  if (!body.company_id && !(body.company && body.company.name)) {
    say('Give the company a name, or pick an existing one.', false); return; }
  if (!body.company_id && !val('company_domains')
      && !confirm("No email domain entered \\u2014 any address at all (Gmail included) could be added to this company. Continue?")) return;
  if (!body.project.name) { say('Give the project a name.', false); return; }
  // Refused rather than warned: a project with no Principal is one nobody can
  // ever be given access to, and it is not obvious from anywhere else.
  if (!body.principal) {
    say('A project needs its Principal. Without one, nobody can be given access to it.', false); return; }

  this.disabled = true; this.textContent = 'Creating…';
  try {
    var r = await fetch('/api/setup/onboard', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    var d = await r.json();
    if (d.ok && d.project_id) {
      // Straight on to step 2 rather than back to a list. The project exists
      // and has nothing in it; the next act is always the contract, because
      // every other question on the way to go-live is answered by it.
      location.href = '/contract?p=' + encodeURIComponent(d.project_id);
      return;
    }
    // IT NEVER JUST SITS THERE. A reply that is neither a project nor an error
    // left the button pressed and the page unchanged, with nothing to read and
    // nothing to click — which is how it looked when the Principal's address
    // was refused: created, then refused, then silence.
    if (d.ok) { location.href = '/home'; return; }
    say(d.error || 'Could not create it — the server gave no reason.', false);
    window.scrollTo(0, 0);
  } catch (e) { say('Could not reach the server.', false); }
  this.disabled = false; this.textContent = 'Create and load the contract';
});

(async function(){
  try {
    var r = await fetch('/api/admin-home', { cache: 'no-store' });
    var d = await r.json();
    el('company_id').innerHTML = '<option value="">— A new company —</option>'
      + (d.companies || []).map(function(c){
          return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('');
  } catch (e) { /* a new company is still possible without the list */ }
})();
${SWITCHER_JS}
${PWA_BOOT}
</script>
</body>
</html>`;
