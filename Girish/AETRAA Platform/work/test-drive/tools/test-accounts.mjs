// Accounts with a password (src/accounts.js): sign up, log in, reset, change,
// self-serve projects, and guessing — counted per email, and safe against a
// burst of parallel guesses at an emailed code.
//   node tools/test-accounts.mjs
import { db, env, call, check, done, onboard, mail } from './_harness.mjs';
import { hashPassword, verifyPassword, passwordProblem } from '../src/accounts.js';

const out = async () => { await call('/api/logout'); };
const lastCode = () => { const m = mail[mail.length - 1]; return m && /(\d{6}) —/.exec(m.subject) && /(\d{6}) —/.exec(m.subject)[1]; };

console.log('— the password itself —');
const h = await hashPassword(env, 'a long enough phrase');
check('kept as pbkdf2-sha256 with its own salt and rounds', /^pbkdf2-sha256\$600000\$[\w-]{22}\$[\w-]{43}$/.test(h), h);
check('the right password matches', await verifyPassword('a long enough phrase', h));
check('a wrong one does not', !(await verifyPassword('a long enough phrasE', h)));
check('two hashes of one password differ (salt)', (await hashPassword(env, 'a long enough phrase')) !== h);
check('too short is refused', !!passwordProblem('short1', 'a@b.c'));
check('a common one is refused', !!passwordProblem('password123', 'a@b.c'));
check('one containing the email name is refused', !!passwordProblem('ahmed-tower-2026', 'ahmed@x.ae'));
check('a decent one passes', passwordProblem('blue crane over site', 'ahmed@x.ae') === null);

console.log('\n— sign up —');
let r = await call('/api/signup', { name: 'Sara Haddad', company: 'Haddad Contracting', email: 'Sara@Haddad.test', password: 'short' });
check('a weak password is refused, pointing at the field', r.status === 400 && r.json.field === 'password', r.text);
r = await call('/api/signup', { name: 'Sara Haddad', company: 'Haddad Contracting', email: 'sara@haddad.test', password: 'blue crane over site' });
check('an account is made and signed in at once', r.status === 200 && r.json.ok && r.json.role === 'owner', r.text);
const sara = db.prepare("SELECT * FROM users WHERE email = 'sara@haddad.test'").get();
const org = db.prepare('SELECT * FROM orgs WHERE id = ?').get(sara.org_id);
check('the company is self-serve and active (no approval)', org.plan === 'self-serve' && org.status === 'active' && !org.trial_ends, org);
check('the person is its Principal, active', JSON.parse(sara.functions).includes('principal') && sara.status === 'active');
check('the password is not stored in the clear', sara.password_hash.startsWith('pbkdf2-sha256$') && !sara.password_hash.includes('blue crane'));
r = await call('/api/account');
check('the account page knows them', r.status === 200 && r.json.name === 'Sara Haddad' && r.json.has_password && r.json.may_create_project, r.text);
r = await call('/');
check('with no project yet, the home page is the welcome page', r.status === 200 && r.text.includes('Welcome') && r.text.includes('/api/self/project'));
r = await call('/api/signup', { name: 'Sara Again', email: 'sara@haddad.test', password: 'another long phrase' });
check('the same email cannot sign up twice', r.status === 409 && r.json.exists, r.text);

console.log('\n— their own project —');
r = await call('/api/self/project', { name: 'Haddad Villas', ref: 'HV-01', location: 'Dubai, UAE' });
check('a self-serve Principal creates a project', r.status === 200 && r.json.id, r.text);
const pid = r.json.id;
check('in their own company', db.prepare('SELECT org_id FROM projects WHERE id = ?').get(pid).org_id === sara.org_id);
r = await call('/');
check('and the home page is now the dashboard', r.status === 200 && r.text.includes('id="app"') && !r.text.includes('/api/self/project'));

console.log('\n— log in —');
await out();
r = await call('/api/login/password', { email: 'sara@haddad.test', password: 'wrong password here' });
check('a wrong password is refused', r.status === 401);
const wrongMsg = r.json.error;
r = await call('/api/login/password', { email: 'nobody@nowhere.test', password: 'whatever it might be' });
check('an unknown email gets the same words (no telling who has an account)', r.status === 401 && r.json.error === wrongMsg);
r = await call('/api/login/password', { email: 'SARA@haddad.test', password: 'blue crane over site' });
check('the right password logs in (email in any case)', r.status === 200 && r.json.ok && r.json.project === pid, r.text);
r = await call('/api/account');
check('and the session works', r.status === 200 && r.json.email === 'sara@haddad.test');

console.log('\n— change it —');
r = await call('/api/password/change', { current: 'not it at all ok', password: 'green tower crane' });
check('changing needs the current password', r.status === 401 && r.json.field === 'current', r.text);
r = await call('/api/password/change', { current: 'blue crane over site', password: 'green tower crane' });
check('with it, the password changes', r.status === 200 && r.json.ok, r.text);
await out();
r = await call('/api/login/password', { email: 'sara@haddad.test', password: 'blue crane over site' });
check('the old one no longer works', r.status === 401);
r = await call('/api/login/password', { email: 'sara@haddad.test', password: 'green tower crane' });
check('the new one does', r.status === 200);

console.log('\n— forgotten —');
await out();
const before = mail.length;
r = await call('/api/password/reset/start', { email: 'sara@haddad.test' });
check('a code is emailed', r.status === 200 && mail.length === before + 1 && /reset your AETRAA password/.test(mail[mail.length - 1].subject), r.text);
r = await call('/api/password/reset/start', { email: 'nobody@nowhere.test' });
check('an unknown email gets the same answer, and nothing is sent', r.status === 200 && r.json.sent && mail.length === before + 1);
r = await call('/api/password/reset/complete', { email: 'sara@haddad.test', code: '000000', password: 'red lift shaft core' });
check('a wrong code does not reset it', r.status === 401);
r = await call('/api/password/reset/complete', { email: 'sara@haddad.test', code: lastCode(), password: 'red lift shaft core' });
check('the emailed code resets it and logs in', r.status === 200 && r.json.ok, r.text);
await out();
r = await call('/api/login/password', { email: 'sara@haddad.test', password: 'red lift shaft core' });
check('the reset password works', r.status === 200);

console.log('\n— guessing —');
await out();
let last;
for (let i = 0; i < 11; i++) last = await call('/api/login/password', { email: 'sara@haddad.test', password: 'guess number ' + i });
check('the 11th wrong password in 15 minutes is refused outright', last.status === 429 && last.json.throttled, last.text);
r = await call('/api/login/password', { email: 'sara@haddad.test', password: 'red lift shaft core' });
check('even the right password waits it out', r.status === 429);
db.prepare("DELETE FROM auth_throttle WHERE k LIKE 'login:%'").run();
r = await call('/api/login/password', { email: 'sara@haddad.test', password: 'red lift shaft core' });
check('after the window, it works again', r.status === 200);

// A burst of guesses at an emailed code, all at once: the old check let them all through.
await out();
const keep = env.LOGIN_TEST_CODE; delete env.LOGIN_TEST_CODE;
db.prepare('DELETE FROM auth_throttle').run();
await call('/api/signin/start', { email: 'sara@haddad.test' });
const code = lastCode();
const wrong = String((Number(code) + 1) % 1000000).padStart(6, '0');
const burst = [];
for (let i = 0; i < 30; i++) burst.push(call('/api/signin/code', { email: 'sara@haddad.test', code: wrong }));
burst.push(call('/api/signin/code', { email: 'sara@haddad.test', code }));
const res = await Promise.all(burst);
const tries = db.prepare("SELECT MAX(tries) AS t FROM sign_in_codes WHERE user_id = ?").get(sara.id).t;
check('30 parallel wrong guesses use at most the five tries', tries <= 5, tries);
check('and the right code sent in the same burst does not get in', res[30].status === 401, res[30].text);
env.LOGIN_TEST_CODE = keep;

console.log('\n— a company AETRAA set up —');
const { pid: mpid } = await onboard('Managed Tower', 'MT-1', []);
const principal = db.prepare("SELECT * FROM users WHERE email = 'principal@managedtower.test'").get();
await out();
await call('/api/signin/code', { email: principal.email, code: keep });
r = await call('/api/self/project', { name: 'Side job' });
check('its Principal cannot create projects (AETRAA sets them up)', r.status === 403, r.text);
r = await call('/api/account');
check('and the account page says so', r.status === 200 && r.json.may_create_project === false && r.json.has_password === false);
r = await call('/api/password/change', { password: 'my first own password' });
check('someone with no password yet can set one without a current one', r.status === 200, r.text);
await out();
r = await call('/api/login/password', { email: principal.email, password: 'my first own password' });
check('and then log in with it', r.status === 200 && r.json.project === mpid, r.text);

console.log('\n— switched off —');
await out();
env.SIGNUP_ENABLED = 'off';
r = await call('/api/signup', { name: 'Late Comer', email: 'late@comer.test', password: 'a perfectly good one' });
check('SIGNUP_ENABLED=off refuses new accounts', r.status === 403);
delete env.SIGNUP_ENABLED;

console.log('\n— the pages —');
r = await call('/');
check('the log-in page asks for email and password first', r.text.includes('id="pw"') && r.text.includes('/signup') && r.text.includes('/forgot'));
check('and keeps the email code and the site code', r.text.includes('Email me a code') && r.text.includes('Site access code'));
r = await call('/signup');
check('the sign-up page opens', r.status === 200 && r.text.includes('Create an account'));
r = await call('/forgot');
check('the reset page opens', r.status === 200 && r.text.includes('Reset your password'));

done();
