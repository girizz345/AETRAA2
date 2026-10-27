// Organisations, named people, and signing in without a password.
//
//   node tools/test-org.mjs
//
// What this is guarding: that one customer cannot reach another's data, that a
// sign-in code is worth exactly one use, that a withdrawn person is out on their
// next tap, and that the shared codes already in people's wallets keep working
// the day this arrives.
//
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  createOrg, getOrg, listOrgs, updateOrg, orgBlocked,
  saveUser, getUser, listUsers, findUserByEmail, findUserByInvite, findUserByInviteAny, suspendUser,
  touchUser, userScope, userProjects, userInProject,
  startEmailSignIn, completeEmailSignIn, purgeSignInCodes, issueSignInCode,
  randomCode, randomDigits, cleanEmail, EMAIL_RE,
  audit, listAudit, adoptCodes, signInEmail,
} from '../src/org.js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
const DB = {
  prepare(sql) {
    const st = db.prepare(sql); let args = [];
    const api = { bind(...a) { args = a; return api; },
      async all() { return { results: st.all(...args) }; },
      async first() { return st.get(...args) ?? null; },
      async run() { st.run(...args); return { success: true }; } };
    return api;
  },
  async batch(l) { for (const s of l) await s.run(); return []; },
};
const env = { DB };

const sha256 = async (v) =>
  createHash('sha256').update(String(v)).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let fails = 0, ran = 0;
function check(name, cond, detail) {
  ran++;
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  — ' + detail : ''));
  if (!cond) { fails++; process.exitCode = 1; }
}
const section = (t) => console.log('\n' + t);

/* ------------------------------------------------------------- the codes */

section('Codes people have to read off a card and type into a phone');
{
  const c = randomCode();
  check('a personal code is two groups of four', /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c), c);
  const many = Array.from({ length: 400 }, () => randomCode()).join('');
  check('no 0, O, 1, I or L anywhere in 400 codes', !/[01OIL]/.test(many));
  check('400 codes, 400 different codes',
    new Set(Array.from({ length: 400 }, () => randomCode())).size === 400);
  const d = randomDigits(6);
  check('the email code is six digits', /^\d{6}$/.test(d), d);
  const spread = new Set(Array.from({ length: 300 }, () => randomDigits(6)));
  check('email codes are not repeating', spread.size > 290, spread.size + '/300');
}

/* --------------------------------------------------------------- the org */

section('The organisation is the customer');
let orgA, orgB;
{
  const a = await createOrg(env, { name: 'NAF Contracting LLC', country: 'ae' });
  const b = await createOrg(env, { name: 'Another Contractor', country: 'AE', trial_days: 14 });
  orgA = a.id; orgB = b.id;
  check('an organisation is created', !!a.ok && !!a.id);
  const bad = await createOrg(env, { name: '   ' });
  check('a nameless organisation is refused', !!bad.error, bad.error);

  const row = await getOrg(env, orgA);
  check('country is stored uppercase', row.country === 'AE', row.country);
  check('it starts on trial', row.status === 'trial', row.status);
  check('the trial has an end date', /^\d{4}-\d{2}-\d{2}$/.test(row.trial_ends), row.trial_ends);
  // Compare date to date. trial_ends is a plain date; Date.now() carries the
  // time of day, so the old timestamp subtraction quietly failed every
  // afternoon UTC — a test that passes in the morning proves nothing.
  const daysFromToday = (iso) =>
    Math.round((Date.parse(iso) - Date.parse(new Date().toISOString().slice(0, 10))) / 86400000);
  check('a default trial is 30 days', daysFromToday(row.trial_ends) === 30,
    row.trial_ends + ' is ' + daysFromToday(row.trial_ends) + ' days out');
  const rowB = await getOrg(env, orgB);
  check('a shorter trial is honoured', daysFromToday(rowB.trial_ends) === 14,
    rowB.trial_ends + ' is ' + daysFromToday(rowB.trial_ends) + ' days out');

  check('an unknown organisation is null, not an error', (await getOrg(env, 'org_nope')) === null);
  check('a blank id is null', (await getOrg(env, null)) === null);
}

section('Switching a customer off');
{
  check('an active trial is not blocked',
    orgBlocked({ status: 'trial', trial_ends: '2099-01-01' }) === null);
  check('an expired trial is blocked',
    /trial period has ended/i.test(orgBlocked({ status: 'trial', trial_ends: '2020-01-01' })));
  check('a paying customer with an old trial date is not blocked',
    orgBlocked({ status: 'active', trial_ends: '2020-01-01' }) === null);
  check('suspended is blocked', /suspended/i.test(orgBlocked({ status: 'suspended' })));
  check('closed is blocked', /closed/i.test(orgBlocked({ status: 'closed' })));
  check('no organisation at all is not blocked', orgBlocked(null) === null);

  await updateOrg(env, orgB, { status: 'suspended' });
  check('suspension is stored', (await getOrg(env, orgB)).status === 'suspended');
  await updateOrg(env, orgB, { status: 'active', plan: 'standard', seats: 25 });
  const b = await getOrg(env, orgB);
  check('it can be switched back on', b.status === 'active');
  check('the plan is stored', b.plan === 'standard', b.plan);
  check('seats are stored', b.seats === 25, String(b.seats));
  const bad = await updateOrg(env, orgB, { status: 'nonsense' });
  check('an unknown status is not written', !!bad.error || (await getOrg(env, orgB)).status === 'active');
  check('an unknown organisation cannot be updated',
    !!(await updateOrg(env, 'org_nope', { name: 'x' })).error);
  check('seats are capped', (await updateOrg(env, orgB, { seats: 99999 })).ok
    && (await getOrg(env, orgB)).seats === 500);
}

/* ------------------------------------------------------------ the people */

section('People, not codes');
let pm, lead, siteMan, viewer, siteCode, leadCode;
{
  const a = await saveUser(env, orgA, { name: 'Ajay', role: 'owner', email: 'AJAY@Example.com ' }, sha256);
  check('an owner is created', !!a.ok);
  const stored = await getUser(env, a.id);
  check('the email is stored folded and trimmed', stored.email === 'ajay@example.com', stored.email);
  check('an office person carries no code', stored.invite_hash === null);
  check('an office person starts as invited', stored.status === 'invited', stored.status);
  check('no code is handed back for an office person', a.code === null);

  const m = await saveUser(env, orgA, { name: 'Sajan', role: 'manager', email: 'pm@naf.ae' }, sha256);
  pm = m.id;

  const l = await saveUser(env, orgA,
    { name: 'Rakesh', role: 'lead', groups: ['Civil'] }, sha256);
  lead = l.id; leadCode = l.code;
  check('a site-side person is handed a code', /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(l.code || ''), l.code);
  check('they are active straight away — they are standing in front of you',
    (await getUser(env, lead)).status === 'active');
  check('their scope is kept', userScope(await getUser(env, lead)).groups.join() === 'Civil');

  const s = await saveUser(env, orgA,
    { name: 'Mohammed', role: 'site', groups: ['MEP'], phone: '+971 50 000 0000' }, sha256);
  siteMan = s.id; siteCode = s.code;
  const v = await saveUser(env, orgA, { name: 'Client rep', role: 'view' }, sha256);
  viewer = v.id;

  check('a nameless person is refused', !!(await saveUser(env, orgA, { role: 'site' }, sha256)).error);
  const noMail = await saveUser(env, orgA, { name: 'Boss', role: 'manager' }, sha256);
  check('a manager without an email is refused — they could never get in', !!noMail.error, noMail.error);
  const badMail = await saveUser(env, orgA,
    { name: 'X', role: 'manager', email: 'not-an-email' }, sha256);
  check('a malformed email is refused', !!badMail.error, badMail.error);
  const dupe = await saveUser(env, orgA, { name: 'Someone else', role: 'manager', email: 'pm@naf.ae' }, sha256);
  check('two people cannot share an email address', !!dupe.error, dupe.error);

  const scopedPM = await saveUser(env, orgA,
    { name: 'PM2', role: 'manager', email: 'pm2@naf.ae', groups: ['Civil'] }, sha256);
  check('a manager is never scoped to one discipline',
    userScope(await getUser(env, scopedPM.id)).groups.length === 0);
}

section('Which projects a person may open');
{
  const u = await getUser(env, siteMan);
  check('no list means every project in the organisation', userProjects(u).length === 0);
  check('and so they are in any project', userInProject(u, 'maj') && userInProject(u, 'other'));

  await saveUser(env, orgA, { id: siteMan, name: 'Mohammed', role: 'site',
    groups: ['MEP'], projects: ['maj'] }, sha256);
  const u2 = await getUser(env, siteMan);
  check('a named project is kept', userProjects(u2).join() === 'maj');
  check('they are in that project', userInProject(u2, 'maj'));
  check('and refused another', !userInProject(u2, 'other'));
  check('nobody is in a nameless project', !userInProject(u2, null));
  check('and nothing is in a project', !userInProject(null, 'maj'));
}

section('Editing a person');
{
  const before = await getUser(env, lead);
  const r = await saveUser(env, orgA,
    { id: lead, name: 'Rakesh Kumar', role: 'lead', groups: ['Civil', 'Architecture'] }, sha256);
  check('an edit keeps the id', r.ok && r.id === lead);
  const after = await getUser(env, lead);
  check('the name is changed', after.name === 'Rakesh Kumar');
  check('the scope is changed', userScope(after).groups.length === 2);
  check('an edit does not quietly reissue their code', after.invite_hash === before.invite_hash);
  check('and hands back no code', r.code === null || r.code === undefined);

  const re = await saveUser(env, orgA,
    { id: lead, name: 'Rakesh Kumar', role: 'lead', groups: ['Civil'], new_code: true }, sha256);
  check('asking for a new code gives one', /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(re.code || ''));
  check('and the old one stops working',
    (await getUser(env, lead)).invite_hash !== before.invite_hash);
  leadCode = re.code;

  check('an unknown person cannot be edited',
    !!(await saveUser(env, orgA, { id: 'usr_nope', name: 'X', role: 'site' }, sha256)).error);
  check("another organisation's person cannot be edited from here",
    !!(await saveUser(env, orgB, { id: lead, name: 'Hijack', role: 'owner' }, sha256)).error);
}

section('Signing in with a personal code');
{
  const found = await findUserByInvite(env, await sha256(siteCode));
  check('the code finds the man', found && found.id === siteMan);
  check('a wrong code finds nobody', (await findUserByInvite(env, await sha256('AAAA-BBBB'))) === null);

  await suspendUser(env, orgA, siteMan, true);
  check('a suspended man cannot sign in with it',
    (await findUserByInvite(env, await sha256(siteCode))) === null);
  check('and his email lookup fails too',
    (await findUserByEmail(env, 'ajay@example.com')) !== null);
  await suspendUser(env, orgA, siteMan, false);
  check('and he is back when reinstated',
    (await findUserByInvite(env, await sha256(siteCode))).id === siteMan);
  check("another organisation cannot suspend him",
    !!(await suspendUser(env, orgB, siteMan, true)).error);
  check('an unknown person cannot be suspended',
    !!(await suspendUser(env, orgA, 'usr_nope', true)).error);
}

/* ------------------------------------------------------ email sign-in */

section('Signing in by email, with no password anywhere');
{
  const unknown = await startEmailSignIn(env, 'nobody@nowhere.com', sha256);
  check('an unknown address gets no code', unknown.error === 'no-such-user');

  const start = await startEmailSignIn(env, 'PM@naf.ae', sha256);
  check('a known address gets a code', !!start.ok && /^\d{6}$/.test(start.code));
  check('the address is matched case-insensitively', start.user.id === pm);
  check('the code lasts ten minutes', start.minutes === 10);

  const stored = db.prepare('SELECT * FROM sign_in_codes WHERE user_id = ?').get(pm);
  check('the code is stored hashed, never in the clear',
    stored.code_hash !== start.code && stored.code_hash === await sha256(start.code));

  const wrong = await completeEmailSignIn(env, 'pm@naf.ae', '000000', sha256);
  check('a wrong code is refused', !!wrong.error);
  check('and it says how many tries are left', wrong.left === 4, String(wrong.left));

  const ok = await completeEmailSignIn(env, 'pm@naf.ae', start.code, sha256);
  check('the right code lets them in', !!ok.ok && ok.user.id === pm);
  check('and the organisation comes back with them', ok.org && ok.org.id === orgA);
  check('signing in turns invited into active', (await getUser(env, pm)).status === 'active');
  check('and stamps when they were last seen', !!(await getUser(env, pm)).last_seen);

  const again = await completeEmailSignIn(env, 'pm@naf.ae', start.code, sha256);
  check('the same code cannot be used twice', !!again.error, again.error);
}

section('What a code is worth');
{
  const first = await startEmailSignIn(env, 'pm@naf.ae', sha256);
  const second = await startEmailSignIn(env, 'pm@naf.ae', sha256);
  check('asking again kills the first code',
    !!(await completeEmailSignIn(env, 'pm@naf.ae', first.code, sha256)).error);
  check('and the newest one works',
    !!(await completeEmailSignIn(env, 'pm@naf.ae', second.code, sha256)).ok);

  const s = await startEmailSignIn(env, 'pm@naf.ae', sha256);
  for (let i = 0; i < 5; i++) await completeEmailSignIn(env, 'pm@naf.ae', '111111', sha256);
  const locked = await completeEmailSignIn(env, 'pm@naf.ae', s.code, sha256);
  check('five wrong guesses burns the code even if the sixth is right',
    !!locked.error && /too many/i.test(locked.error), locked.error);

  const e = await startEmailSignIn(env, 'pm@naf.ae', sha256);
  db.prepare('UPDATE sign_in_codes SET expires = ? WHERE user_id = ? AND used = 0')
    .run('2020-01-01T00:00:00.000Z', pm);
  const expired = await completeEmailSignIn(env, 'pm@naf.ae', e.code, sha256);
  check('an expired code is refused', !!expired.error && /expired/i.test(expired.error), expired.error);
  check('and is burned, so it cannot be un-expired',
    db.prepare('SELECT used FROM sign_in_codes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(pm).used === 1);

  check('a code with no request behind it is refused',
    !!(await completeEmailSignIn(env, 'ajay@example.com', '123456', sha256)).error);
}

section('A code the owner reads down the phone');
{
  // Email is the only way an office person gets in, and email is the one part of
  // this that depends on something outside the app. So the owner can make the
  // same code by hand. It must be the same code in every way that matters — or
  // it is a back door rather than a fallback.
  const made = await issueSignInCode(env, pm, sha256);
  check('it makes one', !!made.ok && /^\d{6}$/.test(made.code), JSON.stringify(made));
  check('it comes back with who it is for, so it cannot be read to the wrong man',
    made.name === (await getUser(env, pm)).name && made.email === 'pm@naf.ae',
    made.name + ' / ' + made.email);
  check('ten minutes, like every other code', made.minutes === 10);

  const stored = db.prepare(
    'SELECT * FROM sign_in_codes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(pm);
  check('and it is stored hashed, exactly like an emailed one',
    stored.code_hash === await sha256(made.code) && stored.code_hash !== made.code);

  check('it lets him in', !!(await completeEmailSignIn(env, 'pm@naf.ae', made.code, sha256)).ok);
  check('once only', !!(await completeEmailSignIn(env, 'pm@naf.ae', made.code, sha256)).error);

  const a = await issueSignInCode(env, pm, sha256);
  const b = await issueSignInCode(env, pm, sha256);
  check('making a second one kills the first',
    !!(await completeEmailSignIn(env, 'pm@naf.ae', a.code, sha256)).error);
  check('and the newest works', !!(await completeEmailSignIn(env, 'pm@naf.ae', b.code, sha256)).ok);

  const e = await issueSignInCode(env, pm, sha256);
  for (let i = 0; i < 5; i++) await completeEmailSignIn(env, 'pm@naf.ae', '111111', sha256);
  check('five wrong guesses burn it, like any other code',
    !!(await completeEmailSignIn(env, 'pm@naf.ae', e.code, sha256)).error);

  check('a person who is not there gets no code',
    !!(await issueSignInCode(env, 'usr_nope', sha256)).error);

  await suspendUser(env, orgA, pm, true);
  const gone = await issueSignInCode(env, pm, sha256);
  check('and a man whose access was withdrawn cannot be let back in this way',
    !!gone.error && /withdrawn/i.test(gone.error), gone.error);
  await suspendUser(env, orgA, pm, false);

  const onSite = await saveUser(env, orgA, { name: 'Gate man', role: 'site', new_code: true }, sha256);
  const refused = await issueSignInCode(env, onSite.id, sha256);
  check('somebody who carries a card rather than an email is refused, and told which',
    !!refused.error && /card/i.test(refused.error), refused.error);
}

section('A suspended customer cannot sign in, however valid the code');
{
  await updateOrg(env, orgA, { status: 'suspended' });
  const start = await startEmailSignIn(env, 'pm@naf.ae', sha256);
  check('no code is even sent', start.error === 'blocked', start.error);
  check('and they are told why, plainly', /suspended/i.test(start.message || ''), start.message);

  await updateOrg(env, orgA, { status: 'active' });
  const good = await startEmailSignIn(env, 'pm@naf.ae', sha256);
  await updateOrg(env, orgA, { status: 'suspended' });
  const held = await completeEmailSignIn(env, 'pm@naf.ae', good.code, sha256);
  check('a code issued before suspension is refused after it', !!held.error, held.error);
  await updateOrg(env, orgA, { status: 'active' });
}

section('Housekeeping');
{
  await startEmailSignIn(env, 'pm@naf.ae', sha256);
  const before = db.prepare('SELECT COUNT(*) AS n FROM sign_in_codes').get().n;
  await purgeSignInCodes(env);
  const after = db.prepare('SELECT COUNT(*) AS n FROM sign_in_codes').get().n;
  check('spent codes are cleared out', after < before, `${before} -> ${after}`);
  check('the live code survives the purge',
    db.prepare('SELECT COUNT(*) AS n FROM sign_in_codes WHERE used = 0').get().n === 1);

  const body = signInEmail('123456', { name: 'NAF Contracting <Ltd>' });
  check('the email carries the code', body.includes('123456'));
  check('and escapes the customer name', body.includes('&lt;Ltd&gt;') && !body.includes('<Ltd>'));
}

/* ------------------------------------------------------------ the tenant wall */

section('One customer cannot see another');
{
  await saveUser(env, orgB, { name: 'Rival PM', role: 'manager', email: 'rival@other.ae' }, sha256);
  const a = await listUsers(env, orgA);
  const b = await listUsers(env, orgB);
  check('each list holds only its own people',
    a.every((u) => u.org_id === orgA) && b.every((u) => u.org_id === orgB));
  check('and the rival is not in ours', !a.some((u) => u.email === 'rival@other.ae'));
  check('suspended people sort to the bottom',
    a.filter((u) => u.status === 'suspended').every((u, i, arr) =>
      a.indexOf(u) >= a.length - arr.length));
  check('the list never carries the code hash',
    a.every((u) => u.invite_hash === undefined));
  check('but says whether they have one', a.some((u) => u.has_code === 1));
}

section('The books');
{
  await audit(env, { org_id: orgA, project_id: 'maj', user_id: pm, who: 'Sajan',
    action: 'update', detail: '12 activities' });
  await audit(env, { org_id: orgA, project_id: 'maj', user_id: lead, who: 'Rakesh',
    action: 'signin', detail: '' });
  await audit(env, { org_id: orgB, who: 'Rival PM', action: 'signin' });

  const all = await listAudit(env, orgA);
  check('entries come back newest first', all.length === 2 && all[0].who === 'Rakesh');
  check("and never another customer's", all.every((r) => r.org_id === orgA));
  check('filtering by action works', (await listAudit(env, orgA, { action: 'update' })).length === 1);
  check('filtering by project works', (await listAudit(env, orgA, { project_id: 'maj' })).length === 2);

  const broken = { DB: { prepare() { throw new Error('no such table: audit'); } } };
  let threw = false;
  try { await audit(broken, { who: 'x', action: 'y' }); } catch (e) { threw = true; }
  check('a missing audit table never breaks the action it was recording', !threw);
  check('and reading it returns null rather than exploding',
    (await listAudit(broken, orgA)) === null);
}

/* ---------------------------------------------------- the old world moves in */

section('The codes already in people\'s wallets keep working');
{
  db.prepare(`INSERT INTO projects (id,name,sort_order,created_at)
              VALUES ('maj','Plot 6457759',1,datetime('now'))`).run();
  const codes = [
    ['ac_1', 'Civil / Architecture — Rakesh', 'lead', '["Civil"]', 'MAJ-Civil-AAAA-BBBB'],
    ['ac_2', 'MEP — Mohammed', 'lead', '["MEP"]', 'MAJ-MEP-CCCC-DDDD'],
    ['ac_3', 'Site team', 'site', '[]', 'MAJ-Site-EEEE-FFFF'],
  ];
  for (const [cid, label, role, groups, code] of codes) {
    db.prepare(`INSERT INTO access_codes (id,project_id,label,role,scope_groups,scope_trades,
                                          code_hash,active,created_at)
                VALUES (?,?,?,?,?,'[]',?,1,datetime('now'))`)
      .run(cid, 'maj', label, role, groups, await sha256(code));
  }

  const moved = await adoptCodes(env, orgA);
  check('every live code becomes a named person', moved.ok && moved.moved === 3, JSON.stringify(moved));

  const rakesh = await findUserByInvite(env, await sha256('MAJ-Civil-AAAA-BBBB'));
  check('the card in his wallet still works', !!rakesh);
  check('the label became his name', rakesh.name === 'Civil / Architecture — Rakesh');
  check('his discipline came with him', userScope(rakesh).groups.join() === 'Civil');
  check('and he is tied to the project the code was for', userProjects(rakesh).join() === 'maj');
  check('he belongs to the right customer', rakesh.org_id === orgA);

  const twice = await adoptCodes(env, orgA);
  check('running it again moves nobody — it is safe to repeat', twice.ok && twice.moved === 0);
}

section('Nothing here falls over on a database that has not been migrated');
{
  const bare = { DB: { prepare() { throw new Error('no such table: users'); } } };
  check('getUser returns null', (await getUser(bare, 'usr_1')) === null);
  check('findUserByEmail returns null', (await findUserByEmail(bare, 'a@b.com')) === null);
  check('findUserByInvite returns null', (await findUserByInvite(bare, 'x')) === null);
  check('listUsers returns null', (await listUsers(bare, orgA)) === null);
  check('getOrg returns null', (await getOrg(bare, orgA)) === null);
  check('listOrgs returns null', (await listOrgs(bare)) === null);
  check('adoptCodes reports rather than throws', !!(await adoptCodes(bare, orgA)).error);
  let threw = false;
  try { await purgeSignInCodes(bare); } catch (e) { threw = true; }
  check('purging is silent', !threw);
}

section('Retiring the old shared codes');
{
  // An adopted shared code becomes a person. Withdrawing that person must stop the
  // code, and giving them an email must retire it — otherwise "we moved to
  // accounts" is a story people tell while the old office code is still live.
  const adopted = await findUserByInvite(env, await sha256('MAJ-Civil-AAAA-BBBB'));
  await suspendUser(env, orgA, adopted.id, true);
  const any = await findUserByInviteAny(env, await sha256('MAJ-Civil-AAAA-BBBB'));
  check('a withdrawn holder is still findable, so login can refuse them',
    any && any.id === adopted.id && any.status === 'suspended');
  check('but the ordinary lookup will not have them',
    (await findUserByInvite(env, await sha256('MAJ-Civil-AAAA-BBBB'))) === null);
  await suspendUser(env, orgA, adopted.id, false);

  const pmCode = 'MAJ-PM-OLDSHARED';
  const shared = await saveUser(env, orgA,
    { name: 'Project manager — Plot 6457759', role: 'lead' }, sha256);
  db.prepare('UPDATE users SET invite_hash = ? WHERE id = ?').run(await sha256(pmCode), shared.id);
  check('the shared code opens it while it is still a site-side role',
    !!(await findUserByInvite(env, await sha256(pmCode))));

  await saveUser(env, orgA,
    { id: shared.id, name: 'Sajan Kumar', role: 'manager', email: 'sajan@naf.ae' }, sha256);
  check('naming them and giving them an email retires the shared code',
    (await findUserByInviteAny(env, await sha256(pmCode))) === null);
  check('and they are still there, signing in by email',
    (await findUserByEmail(env, 'sajan@naf.ae')).id === shared.id);

  const site = await saveUser(env, orgA, { name: 'Storekeeper', role: 'site' }, sha256);
  await saveUser(env, orgA, { id: site.id, name: 'Storekeeper', role: 'site', phone: '050' }, sha256);
  check('an ordinary edit to a site man leaves his code alone',
    !!(await findUserByInvite(env, await sha256(site.code))));
}

console.log(`\n${ran - fails}/${ran} passed`);
if (fails) console.log(`${fails} failed`);
