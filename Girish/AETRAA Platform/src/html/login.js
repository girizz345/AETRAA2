import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, LOGO_DATA } from './shared.js';

// Two ways in, because the two halves of a project live differently.
//
// The office has email and no patience for another password. They type their
// address, we email six digits, they type them back. Nothing is set, nothing is
// stored, nothing can be reset by whoever gets into their inbox next year.
//
// Site has a code on a card and, half the time, no signal worth speaking of. So
// the code stays exactly where it was — first thing on the page, one field, one
// button. Nobody standing on a slab in August should have to wait for an email.

export const loginHTML = (what = 'dashboard') => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}
body { display: grid; place-items: center; min-height: 100dvh; padding: 16px; }
.box { width: 100%; max-width: 380px; }
.login-mark { display: flex; justify-content: center; margin-bottom: 20px; }
.login-mark img { height: 92px; width: auto; }
.err { color: var(--critical); font-size: 13px; margin-top: 10px; min-height: 18px; }
.ok { color: var(--good, #1a7f4b); font-size: 13px; margin-top: 10px; }
.sep { display: flex; align-items: center; gap: 10px; margin: 20px 0 16px;
       color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
.sep::before, .sep::after { content: ''; flex: 1; height: 1px; background: var(--border); }
.linkish { background: none; border: 0; padding: 0; color: var(--accent, #0b6bcb);
           font: inherit; font-size: 13px; cursor: pointer; text-decoration: underline; }
.digits { letter-spacing: 10px; font-size: 22px; text-align: center; font-weight: 600; }
</style>
</head>
<body>
<div class="box">
  <div class="login-mark"><img src="${LOGO_DATA}" alt="AETRAA"></div>
  <div class="card">
  <h1>AETRAA</h1>
  <p class="hint" style="margin:6px 0 18px">Sign in to open the ${what}.</p>

  <form id="f">
    <div class="field">
      <label for="code">Access code</label>
      <input id="code" name="code" type="password" autocomplete="current-password"
             inputmode="text" autocapitalize="off" autocorrect="off" required>
    </div>
    <button class="btn btn-primary btn-lg" style="width:100%" type="submit">Open</button>
    <div class="err" id="err" role="alert"></div>
  </form>

  <div class="sep">or</div>

  <div id="emailStep">
    <form id="fe">
      <div class="field">
        <label for="email">Sign in with your email</label>
        <input id="email" name="email" type="email" autocomplete="email"
               inputmode="email" autocapitalize="off" autocorrect="off"
               placeholder="you@company.ae" required>
      </div>
      <button class="btn btn-lg" style="width:100%" type="submit">Email me a code</button>
      <div class="err" id="err2" role="alert"></div>
    </form>
  </div>

  <div id="codeStep" hidden>
    <form id="fc">
      <div class="field">
        <label for="otp">Six-digit code</label>
        <input id="otp" class="digits" name="otp" type="text" inputmode="numeric"
               autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required>
      </div>
      <p class="hint" id="sentTo" style="margin:-6px 0 14px"></p>
      <button class="btn btn-primary btn-lg" style="width:100%" type="submit">Sign in</button>
      <div class="err" id="err3" role="alert"></div>
      <p style="margin:14px 0 0;text-align:center">
        <button type="button" class="linkish" id="again">Send another code</button>
      </p>
    </form>
  </div>
  </div>
</div>
<script>
const go = (j) => {
  location.href = j.role === 'site' ? '/site'
    : (j.role === 'owner' && !j.project ? '/portfolio' : '/');
};

const f = document.getElementById('f'), err = document.getElementById('err');
f.addEventListener('submit', async (e) => {
  e.preventDefault();
  err.textContent = '';
  const btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Checking…';
  try {
    const r = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: document.getElementById('code').value }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Could not sign in');
    go(j);
  } catch (e2) {
    err.textContent = e2.message;
    btn.disabled = false; btn.textContent = 'Open';
  }
});

const fe = document.getElementById('fe'), err2 = document.getElementById('err2');
const fc = document.getElementById('fc'), err3 = document.getElementById('err3');
const emailStep = document.getElementById('emailStep'), codeStep = document.getElementById('codeStep');

async function askForCode(quiet) {
  const email = document.getElementById('email').value.trim();
  if (!email) return;
  const btn = fe.querySelector('button');
  btn.disabled = true; btn.textContent = 'Sending…';
  err2.textContent = '';
  try {
    const r = await fetch('/api/signin/start', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Could not send the code');
    emailStep.hidden = true; codeStep.hidden = false;
    // Said the same way whether or not the address is on the system, so this form
    // cannot be used to find out who works here.
    document.getElementById('sentTo').textContent =
      'If ' + email + ' is on this system, a code is on its way. It lasts ten minutes.';
    document.getElementById('otp').focus();
  } catch (e2) {
    err2.textContent = e2.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Email me a code';
  }
}

fe.addEventListener('submit', (e) => { e.preventDefault(); askForCode(); });
document.getElementById('again').addEventListener('click', () => {
  codeStep.hidden = true; emailStep.hidden = false;
  document.getElementById('otp').value = ''; err3.textContent = '';
});

fc.addEventListener('submit', async (e) => {
  e.preventDefault();
  err3.textContent = '';
  const btn = fc.querySelector('button'); btn.disabled = true; btn.textContent = 'Checking…';
  try {
    const r = await fetch('/api/signin/code', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('email').value.trim(),
        code: document.getElementById('otp').value,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Could not sign in');
    go(j);
  } catch (e2) {
    err3.textContent = e2.message;
    btn.disabled = false; btn.textContent = 'Sign in';
  }
});
</script>
</body>
</html>`;
