import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, LOGO_DATA, PWA_BOOT } from './shared.js';
import { BUILDING_ART } from './art.js';
import { icon } from './icons.js';

// THE ACCOUNT SCREENS — log in, sign up, forgotten password, the account page
// and the welcome page a new account lands on. One shell for all of them: the
// brand and the line drawing on one side, the form on the other.

export const AUTH_CSS = `
body { display: grid; place-items: center; padding: var(--s4); }
.auth { width: 100%; max-width: 980px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  background: var(--card); border: 1px solid var(--line); border-radius: var(--r-frame); overflow: hidden; }
.auth-side { position: relative; padding: var(--s6); display: flex; flex-direction: column; justify-content: space-between;
  min-height: 560px; border-right: 1px solid var(--line); overflow: hidden;
  background: radial-gradient(600px 380px at 80% 10%, var(--glow), transparent 70%), var(--surface-2); }
.auth-side .art { position: absolute; right: -12%; bottom: -8%; width: 110%; height: 70%; color: var(--text-2); opacity: .35; }
.auth-brand { position: relative; display: flex; align-items: center; gap: var(--s3); }
.auth-brand img { height: 26px; width: auto; filter: brightness(0) opacity(.86); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .auth-brand img { filter: brightness(0) invert(.92); } }
:root[data-theme="dark"] .auth-brand img { filter: brightness(0) invert(.92); }
.auth-pitch { position: relative; }
.auth-pitch h2 { font-family: var(--font-display); font-weight: 400; font-size: var(--fs-d1); line-height: .95;
  letter-spacing: .015em; margin: 0 0 var(--s3); }
.auth-pitch p { color: var(--text-2); margin: 0; max-width: 34ch; }
.auth-main { padding: var(--s6); display: flex; flex-direction: column; justify-content: center; }
.auth-main h1 { font-family: var(--font-display); font-weight: 400; font-size: var(--fs-d2); line-height: 1; letter-spacing: .02em; margin: 0 0 var(--s2); }
.auth-main .lede { color: var(--text-2); margin: 0 0 var(--s5); }
.auth-main .field { margin-bottom: var(--s4); }
.auth-main .btn-primary { width: 100%; justify-content: center; min-height: 48px; }
.auth-row { display: flex; justify-content: space-between; align-items: center; gap: var(--s3); margin: calc(-1 * var(--s2)) 0 var(--s4);
  font-size: var(--fs-secondary); }
.auth-alt { margin-top: var(--s5); text-align: center; font-size: var(--fs-secondary); color: var(--text-2); }
.auth-alt a, .auth-row a, .linkish { color: var(--accent-text); }
.linkish { background: none; border: 0; padding: 0; font: inherit; cursor: pointer; text-decoration: underline; min-height: 0; }
.err { color: var(--bad-ink); font-size: var(--fs-secondary); margin-top: var(--s3); min-height: 19px; }
.okmsg { color: var(--good-ink); font-size: var(--fs-secondary); margin-top: var(--s3); }
.field-err { color: var(--bad-ink); font-size: var(--fs-secondary); margin-top: var(--s1); }
.pw { position: relative; }
.pw input { padding-right: 76px; }
.pw button { position: absolute; right: 2px; top: 50%; transform: translateY(-50%); min-height: 44px; padding: 0 var(--s3);
  border: 0; background: none; color: var(--text-2); font: inherit; font-size: var(--fs-secondary); cursor: pointer; }
.pw button:hover { color: var(--text); }
.meter { height: 4px; border-radius: var(--r-pill); background: var(--line); margin-top: var(--s2); overflow: hidden; }
.meter i { display: block; height: 100%; width: 0; background: var(--bad); }
.meter i.ok { background: var(--warn); } .meter i.good { background: var(--good); }
.hintline { font-size: var(--fs-secondary); color: var(--text-2); margin-top: var(--s1); }
details.other { margin-top: var(--s5); border-top: 1px solid var(--line); padding-top: var(--s4); }
details.other summary { cursor: pointer; color: var(--text-2); font-size: var(--fs-secondary); list-style: none; }
details.other summary::-webkit-details-marker { display: none; }
details.other summary::before { content: "+ "; }
details.other[open] summary::before { content: "– "; }
details.other .inner { display: grid; gap: var(--s4); margin-top: var(--s4); }
.digits { letter-spacing: 10px; font-size: var(--fs-title); text-align: center; }
@media (max-width: 760px) {
  .auth { grid-template-columns: 1fr; }
  .auth-side { min-height: 0; padding: var(--s5); border-right: 0; border-bottom: 1px solid var(--line); }
  .auth-side .art { width: 70%; height: 140%; right: -10%; bottom: -30%; opacity: .2; }
  .auth-pitch h2 { font-size: var(--fs-d3); }
  .auth-pitch p { display: none; }
  .auth-main { padding: var(--s5); }
}
`;

const side = (pitch, line) => `<aside class="auth-side">
  <div class="auth-brand"><img src="${LOGO_DATA}" alt="AETRAA"></div>
  ${BUILDING_ART}
  <div class="auth-pitch"><h2>${pitch}</h2><p>${line}</p></div>
</aside>`;

const page = (title, body, script) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${AUTH_CSS}</style>
</head>
<body>
${body}
<script>
${PWA_BOOT}
function $(id){ return document.getElementById(id); }
async function post(url, body){
  var r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  var j = await r.json().catch(function(){ return {}; });
  if (!r.ok) { var e = new Error(j.error || 'That did not work. Try again.'); e.field = j.field; throw e; }
  return j;
}
function busy(btn, on, label){ btn.disabled = on; if (label) btn.dataset.label = btn.dataset.label || btn.textContent; btn.textContent = on ? label : (btn.dataset.label || btn.textContent); }
// Show / hide on every password box.
document.querySelectorAll('.pw button').forEach(function(b){ b.addEventListener('click', function(){
  var i = b.parentNode.querySelector('input'); var show = i.type === 'password';
  i.type = show ? 'text' : 'password'; b.textContent = show ? 'Hide' : 'Show'; b.setAttribute('aria-pressed', show ? 'true' : 'false'); }); });
// How strong a new password is: length and variety, the same rule the server enforces at its floor.
function strength(v){ var s = 0; if (v.length >= 10) s++; if (v.length >= 14) s++; if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++; if (/[0-9]/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v)) s++; return s; }
document.querySelectorAll('input[data-meter]').forEach(function(i){ var m = $(i.dataset.meter); i.addEventListener('input', function(){
  var s = strength(i.value); m.style.width = Math.min(100, s * 20) + '%'; m.className = s >= 4 ? 'good' : s >= 2 ? 'ok' : ''; }); });
function go(j){ location.href = j.role === 'site' ? '/site' : '/'; }
${script}
</script>
</body>
</html>`;

const pwField = (id, label, auto, meter) => `<div class="field">
  <label for="${id}">${label}</label>
  <div class="pw"><input id="${id}" type="password" autocomplete="${auto}" required ${meter ? 'minlength="10" data-meter="' + id + 'M"' : ''}>
  <button type="button" aria-pressed="false" aria-label="Show password">Show</button></div>
  ${meter ? '<div class="meter"><i id="' + id + 'M"></i></div><div class="hintline">At least 10 characters. A few words together is easy to remember and hard to guess.</div>' : ''}
</div>`;

/* ----------------------------------------------------------------- log in */

export const loginPage = (what = 'dashboard') => page('Log in', `
<main class="auth">
  ${side('Construction, run on one record', 'Programme, site, drawings, submittals, payments and reports — for every project your company runs.')}
  <section class="auth-main">
    <h1>Log in</h1>
    <p class="lede">Log in to open the ${what}.</p>
    <form id="fp" novalidate>
      <div class="field"><label for="em">Email</label>
        <input id="em" type="email" autocomplete="email" inputmode="email" autocapitalize="off" required placeholder="you@company.ae"></div>
      ${pwField('pw', 'Password', 'current-password', false)}
      <div class="auth-row"><span></span><a href="/forgot">Forgot your password?</a></div>
      <button class="btn btn-primary" type="submit">Log in</button>
      <div class="err" id="errP" role="alert"></div>
    </form>
    <p class="auth-alt">New here? <a href="/signup">Create an account</a></p>

    <details class="other">
      <summary>Other ways to sign in</summary>
      <div class="inner">
        <form id="fe">
          <div class="field"><label for="email">Email me a one-time code instead</label>
            <input id="email" type="email" autocomplete="email" inputmode="email" autocapitalize="off" placeholder="you@company.ae"></div>
          <button class="btn" type="submit" style="width:100%">Email me a code</button>
          <div class="err" id="err2" role="alert"></div>
        </form>
        <form id="fc" hidden>
          <div class="field"><label for="otp">Six-digit code</label>
            <input id="otp" class="digits" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}"></div>
          <p class="hintline" id="sentTo"></p>
          <button class="btn btn-primary" type="submit">Sign in</button>
          <div class="err" id="err3" role="alert"></div>
          <p style="text-align:center;margin:var(--s3) 0 0"><button type="button" class="linkish" id="again">Send another code</button></p>
        </form>
        <form id="f">
          <div class="field"><label for="code">Site access code</label>
            <input id="code" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" placeholder="ABCD-EFGH"></div>
          <button class="btn" type="submit" style="width:100%">Open</button>
          <div class="err" id="err" role="alert"></div>
        </form>
      </div>
    </details>
  </section>
</main>`, `
$('fp').addEventListener('submit', async function(e){
  e.preventDefault(); var btn = this.querySelector('button[type=submit]'); $('errP').textContent = '';
  if (!$('em').value.trim() || !$('pw').value) { $('errP').textContent = 'Enter your email and password.'; return; }
  busy(btn, true, 'Logging in…');
  try { go(await post('/api/login/password', { email: $('em').value.trim(), password: $('pw').value })); }
  catch (x) { $('errP').textContent = x.message; busy(btn, false); }
});
$('f').addEventListener('submit', async function(e){
  e.preventDefault(); var btn = this.querySelector('button'); $('err').textContent = '';
  busy(btn, true, 'Checking…');
  try { var j = await post('/api/login', { code: $('code').value }); location.href = j.role === 'site' ? '/site' : (j.role === 'owner' && !j.project ? '/portfolio' : '/'); }
  catch (x) { $('err').textContent = x.message; busy(btn, false); }
});
$('fe').addEventListener('submit', async function(e){
  e.preventDefault(); var em = $('email').value.trim(); if (!em) return; var btn = this.querySelector('button');
  $('err2').textContent = ''; busy(btn, true, 'Sending…');
  try { await post('/api/signin/start', { email: em }); $('fe').hidden = true; $('fc').hidden = false;
    // Said the same way whether or not the address is on the system.
    $('sentTo').textContent = 'If ' + em + ' is on this system, a code is on its way. It lasts ten minutes.'; $('otp').focus(); }
  catch (x) { $('err2').textContent = x.message; }
  finally { busy(btn, false); }
});
$('again').addEventListener('click', function(){ $('fc').hidden = true; $('fe').hidden = false; $('otp').value = ''; $('err3').textContent = ''; });
$('fc').addEventListener('submit', async function(e){
  e.preventDefault(); var btn = this.querySelector('button[type=submit]'); $('err3').textContent = ''; busy(btn, true, 'Checking…');
  try { go(await post('/api/signin/code', { email: $('email').value.trim(), code: $('otp').value })); }
  catch (x) { $('err3').textContent = x.message; busy(btn, false); }
});
`);

/* ---------------------------------------------------------------- sign up */

export const signupHTML = () => page('Create an account', `
<main class="auth">
  ${side('Start in minutes', 'Create your company’s account, set up your first project, and invite your team.')}
  <section class="auth-main">
    <h1>Create an account</h1>
    <p class="lede">Your email is your ID; you choose the password.</p>
    <form id="fs" novalidate>
      <div class="field"><label for="nm">Your name</label><input id="nm" autocomplete="name" required></div>
      <div class="field"><label for="co">Company</label><input id="co" autocomplete="organization" placeholder="e.g. Al Noor Contracting LLC"></div>
      <div class="field"><label for="em">Work email</label>
        <input id="em" type="email" autocomplete="email" inputmode="email" autocapitalize="off" required placeholder="you@company.ae"></div>
      ${pwField('pw', 'Password', 'new-password', true)}
      ${pwField('pw2', 'Confirm password', 'new-password', false)}
      <button class="btn btn-primary" type="submit">Create account</button>
      <div class="err" id="err" role="alert"></div>
    </form>
    <p class="auth-alt">Already have an account? <a href="/">Log in</a></p>
  </section>
</main>`, `
$('fs').addEventListener('submit', async function(e){
  e.preventDefault(); var btn = this.querySelector('button[type=submit]'); $('err').textContent = '';
  if (!$('nm').value.trim()) { $('err').textContent = 'Please enter your name.'; $('nm').focus(); return; }
  if ($('pw').value !== $('pw2').value) { $('err').textContent = 'The two passwords are not the same.'; $('pw2').focus(); return; }
  busy(btn, true, 'Creating your account…');
  try { go(await post('/api/signup', { name: $('nm').value.trim(), company: $('co').value.trim(), email: $('em').value.trim(), password: $('pw').value })); }
  catch (x) { $('err').textContent = x.message; if (x.field && $(({ name: 'nm', company: 'co', email: 'em', password: 'pw' })[x.field])) $(({ name: 'nm', company: 'co', email: 'em', password: 'pw' })[x.field]).focus(); busy(btn, false); }
});
`);

/* --------------------------------------------------------- forgot password */

export const forgotHTML = () => page('Reset your password', `
<main class="auth">
  ${side('Back in, in a minute', 'We email you a six-digit code. Type it here with your new password.')}
  <section class="auth-main">
    <h1>Reset your password</h1>
    <form id="f1" novalidate>
      <p class="lede">Enter the email you log in with.</p>
      <div class="field"><label for="em">Email</label>
        <input id="em" type="email" autocomplete="email" inputmode="email" autocapitalize="off" required placeholder="you@company.ae"></div>
      <button class="btn btn-primary" type="submit">Email me a code</button>
      <div class="err" id="err1" role="alert"></div>
    </form>
    <form id="f2" novalidate hidden>
      <p class="lede" id="sentTo"></p>
      <div class="field"><label for="otp">Six-digit code</label>
        <input id="otp" class="digits" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required></div>
      ${pwField('pw', 'New password', 'new-password', true)}
      ${pwField('pw2', 'Confirm new password', 'new-password', false)}
      <button class="btn btn-primary" type="submit">Set password and log in</button>
      <div class="err" id="err2" role="alert"></div>
    </form>
    <p class="auth-alt"><a href="/">Back to log in</a></p>
  </section>
</main>`, `
$('f1').addEventListener('submit', async function(e){
  e.preventDefault(); var em = $('em').value.trim(); if (!em) return; var btn = this.querySelector('button');
  $('err1').textContent = ''; busy(btn, true, 'Sending…');
  try { await post('/api/password/reset/start', { email: em }); $('f1').hidden = true; $('f2').hidden = false;
    $('sentTo').textContent = 'If ' + em + ' has an account, a code is on its way. It lasts ten minutes.'; $('otp').focus(); }
  catch (x) { $('err1').textContent = x.message; }
  finally { busy(btn, false); }
});
$('f2').addEventListener('submit', async function(e){
  e.preventDefault(); var btn = this.querySelector('button[type=submit]'); $('err2').textContent = '';
  if ($('pw').value !== $('pw2').value) { $('err2').textContent = 'The two passwords are not the same.'; return; }
  busy(btn, true, 'Saving…');
  try { go(await post('/api/password/reset/complete', { email: $('em').value.trim(), code: $('otp').value, password: $('pw').value })); }
  catch (x) { $('err2').textContent = x.message; busy(btn, false); }
});
`);

/* ------------------------------------------------------------ the account */

export const accountHTML = () => page('Your account', `
<main class="auth">
  ${side('Your account', 'Your details, and the password you log in with.')}
  <section class="auth-main">
    <h1>Your account</h1>
    <p class="lede" id="who">Loading…</p>
    <form id="fpw" novalidate>
      <div id="curWrap">${pwField('cur', 'Current password', 'current-password', false)}</div>
      ${pwField('pw', 'New password', 'new-password', true)}
      ${pwField('pw2', 'Confirm new password', 'new-password', false)}
      <button class="btn btn-primary" type="submit">Save password</button>
      <div class="err" id="err" role="alert"></div><div class="okmsg" id="ok" role="status"></div>
    </form>
    <p class="auth-alt"><a href="/">Back to the dashboard</a> · <a href="/myfiles">My files</a> · <a href="/api/logout">Log out</a></p>
  </section>
</main>`, `
(async function(){
  var r = await fetch('/api/account', { cache: 'no-store' }); if (r.status === 401) { location.href = '/'; return; }
  var a = await r.json();
  $('who').textContent = a.name + (a.email ? ' · ' + a.email : '') + (a.company ? ' · ' + a.company : '');
  if (!a.has_password) { $('curWrap').hidden = true; $('who').textContent += ' — you have not set a password yet; set one below.'; }
})();
$('fpw').addEventListener('submit', async function(e){
  e.preventDefault(); var btn = this.querySelector('button[type=submit]'); $('err').textContent = ''; $('ok').textContent = '';
  if ($('pw').value !== $('pw2').value) { $('err').textContent = 'The two passwords are not the same.'; return; }
  busy(btn, true, 'Saving…');
  try { await post('/api/password/change', { current: $('cur').value, password: $('pw').value });
    $('ok').textContent = 'Saved. Use it the next time you log in.'; $('cur').value = $('pw').value = $('pw2').value = ''; $('curWrap').hidden = false; }
  catch (x) { $('err').textContent = x.message; }
  finally { busy(btn, false); }
});
`);

/* --------------------------------------------- welcome: a new account, no project */

export const welcomeHTML = () => page('Welcome', `
<main class="auth">
  ${side('Welcome to AETRAA', 'Everything on AETRAA belongs to a project. Start your first one, or wait to be added to one.')}
  <section class="auth-main">
    <h1 id="hello">Welcome</h1>
    <div id="create" hidden>
      <p class="lede">Create a project. You can fill in the rest — programme, BOQ, drawings, team — once it is open.</p>
      <form id="fp" novalidate>
        <div class="field"><label for="pn">Project name</label><input id="pn" required placeholder="e.g. Residential Tower — G+2P+12"></div>
        <div class="field"><label for="pr">Project reference <span class="hintline" style="display:inline">(optional)</span></label><input id="pr" placeholder="e.g. PRJ-0001"></div>
        <div class="field"><label for="pl">Location <span class="hintline" style="display:inline">(optional)</span></label><input id="pl" placeholder="e.g. Dubai, UAE"></div>
        <div class="field"><label for="pd">Contract completion <span class="hintline" style="display:inline">(optional)</span></label><input id="pd" type="date"></div>
        <button class="btn btn-primary" type="submit">Create project</button>
        <div class="err" id="err" role="alert"></div>
      </form>
    </div>
    <div id="wait" hidden>
      <p class="lede">You are not on a project yet. When the person who runs your company’s account adds you to one, it opens here.</p>
    </div>
    <p class="auth-alt"><a href="/">Dashboard</a> · <a href="/myfiles">${icon('file', 14)} My files</a> · <a href="/account">Your account</a> · <a href="/api/logout">Log out</a></p>
  </section>
</main>`, `
(async function(){
  var r = await fetch('/api/account', { cache: 'no-store' }); if (r.status === 401) { location.href = '/'; return; }
  var a = await r.json();
  $('hello').textContent = 'Welcome, ' + String(a.name || '').split(' ')[0];
  (a.may_create_project ? $('create') : $('wait')).hidden = false;
})();
$('fp').addEventListener('submit', async function(e){
  e.preventDefault(); var btn = this.querySelector('button[type=submit]'); $('err').textContent = '';
  if (!$('pn').value.trim()) { $('err').textContent = 'Give the project a name.'; $('pn').focus(); return; }
  busy(btn, true, 'Creating…');
  try { await post('/api/self/project', { name: $('pn').value.trim(), ref: $('pr').value.trim(), location: $('pl').value.trim(), contract_completion: $('pd').value });
    location.href = '/'; }
  catch (x) { $('err').textContent = x.message; busy(btn, false); }
});
`);
