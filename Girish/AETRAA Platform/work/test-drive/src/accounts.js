// ACCOUNTS WITH A PASSWORD — sign up, log in, forget it, change it.
//
// Until now nobody chose a password: the office signed in with a six-digit
// email code, site with a personal code on a card. Both still work. This adds
// what a person expects of any website: make an account with an email and a
// password, then log in with them.
//
//   signUp         a new company and its owner (the Principal), in one step,
//                  usable at once (Girish, 27 Oct 2026: "simple for now, no
//                  approval"). The company is marked self-serve, which is what
//                  lets it create its own projects (src/index.js).
//   passwordLogin  email + password.
//   setPassword    after a reset, or from the account page.
//   reset          by the same six-digit email code as before
//                  (startEmailSignIn / completeEmailSignIn in src/org.js),
//                  so proving you own the inbox is what lets you set a password.
//
// HOW A PASSWORD IS KEPT. Never in the clear: PBKDF2-SHA256 with a random
// 16-byte salt per person, stored as  pbkdf2-sha256$<rounds>$<salt>$<hash>.
// 600,000 rounds by default (OWASP's figure for PBKDF2-SHA256), set by
// PASSWORD_ITERATIONS; each hash carries its own count, so raising it later
// does not lock anybody out. (A Cloudflare Worker caps PBKDF2 at 100,000: set
// PASSWORD_ITERATIONS=100000 there.)
//
// GUESSING. Every attempt is counted, per email and per address it comes from,
// in one atomic statement (hit()) — not read, compared and then written, which
// a burst of parallel requests walks straight through.

import { createOrg, saveUser, findUserByEmail, getOrg, orgBlocked, touchUser, cleanEmail, EMAIL_RE } from './org.js';
import { addColumns } from './db-cols.js';

const enc = new TextEncoder();
const nowISO = () => new Date().toISOString();
const b64url = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export const PASSWORD_MIN = 10;
const DEFAULT_ROUNDS = 600000;

/* ---------------------------------------------------------------- tables */

let READY = false;
export async function ensureAccountTables(env) {
  if (READY) return;
  await addColumns(env, 'users', [['password_hash', 'TEXT'], ['password_set_at', 'TEXT'], ['email_verified_at', 'TEXT']]);
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS auth_throttle (
       k     TEXT PRIMARY KEY,
       n     INTEGER NOT NULL,
       since TEXT NOT NULL
     )`
  ).run();
  READY = true;
}

/* -------------------------------------------------------------- hashing */

async function derive(password, salt, rounds) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(env, password) {
  const rounds = Math.max(100000, Number(env && env.PASSWORD_ITERATIONS) || DEFAULT_ROUNDS);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, rounds);
  return 'pbkdf2-sha256$' + rounds + '$' + b64url(salt) + '$' + b64url(hash);
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false;
  const rounds = Number(parts[1]);
  if (!(rounds >= 1000 && rounds <= 10000000)) return false;
  let salt, want;
  try { salt = unb64url(parts[2]); want = unb64url(parts[3]); } catch (e) { return false; }
  const got = await derive(password, salt, rounds);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

// A hash worked out for nobody, so a wrong email takes as long to refuse as a
// wrong password — the timing does not tell a stranger who has an account.
let DUMMY = null;
async function burnTime(env) {
  if (!DUMMY) DUMMY = await hashPassword(env, 'not-a-password-' + Math.random());
  await verifyPassword('x', DUMMY);
}

/* ------------------------------------------------------------- the rules */

const COMMON = new Set(['password', 'password1', 'password123', '1234567890', '12345678910', 'qwertyuiop',
  'qwerty1234', 'iloveyou12', 'aetraa1234', 'letmein123', 'welcome123', 'admin12345', '1q2w3e4r5t',
  'abcdefghij', 'passw0rd12', 'password12']);

export function passwordProblem(password, email) {
  const p = String(password || '');
  if (p.length < PASSWORD_MIN) return 'Use at least ' + PASSWORD_MIN + ' characters.';
  if (p.length > 200) return 'That password is too long (200 characters at most).';
  if (/^(.)\1+$/.test(p)) return 'That password is one character repeated. Choose another.';
  if (COMMON.has(p.toLowerCase())) return 'That password is one of the most common. Choose another.';
  const local = String(email || '').split('@')[0].toLowerCase();
  if (local.length >= 4 && p.toLowerCase().includes(local)) return 'Do not use your email address in your password.';
  return null;
}

/* ------------------------------------------------------------ throttling */

// One attempt counted, atomically. Returns how many there have been in the
// window, this one included; over `limit` means refuse.
export async function hit(env, key, windowMin) {
  await ensureAccountTables(env);
  const now = nowISO();
  const cutoff = new Date(Date.now() - windowMin * 60000).toISOString();
  const row = await env.DB.prepare(
    `INSERT INTO auth_throttle (k, n, since) VALUES (?, 1, ?)
     ON CONFLICT (k) DO UPDATE SET
       n     = CASE WHEN auth_throttle.since < ? THEN 1 ELSE auth_throttle.n + 1 END,
       since = CASE WHEN auth_throttle.since < ? THEN ? ELSE auth_throttle.since END
     RETURNING n`
  ).bind(String(key).slice(0, 300), now, cutoff, cutoff, now).first();
  return row ? Number(row.n) : 1;
}

export async function clearHits(env, key) {
  try { await env.DB.prepare('DELETE FROM auth_throttle WHERE k = ?').bind(String(key).slice(0, 300)).run(); } catch (e) { /* nothing depends on this */ }
}

export async function purgeThrottle(env) {
  try {
    await env.DB.prepare('DELETE FROM auth_throttle WHERE since < ?')
      .bind(new Date(Date.now() - 86400000).toISOString()).run();
  } catch (e) { /* the table may not exist yet */ }
}

// Where a request came from: the address the load balancer / Caddy saw.
export function clientIp(req) {
  const h = (n) => (req.headers.get(n) || '').trim();
  return (h('cf-connecting-ip') || h('x-forwarded-for').split(',')[0] || h('x-real-ip') || 'unknown').slice(0, 64);
}

// Per email is the real guard. Per address is set high, because a whole site
// office often shares one internet address and logs in at the start of a shift.
export const LIMITS = {
  loginPerEmail: [10, 15],      // 10 tries per email per 15 minutes
  loginPerIp: [300, 15],        // 300 per address per 15 minutes
  signupPerIp: [20, 60],        // 20 accounts per address per hour
  codePerEmail: [5, 15],        // 5 emailed codes per email per 15 minutes
  codePerIp: [100, 15],
};

export async function overLimit(env, key, [limit, windowMin]) {
  return (await hit(env, key, windowMin)) > limit;
}

/* --------------------------------------------------------------- sign up */

export async function signUp(env, body, sha256) {
  await ensureAccountTables(env);
  const name = String(body.name || '').trim().slice(0, 120);
  const email = cleanEmail(body.email);
  const company = String(body.company || '').trim().slice(0, 200) || (name ? name + '’s company' : '');
  if (!name) return { error: 'Please enter your name.', field: 'name' };
  if (!EMAIL_RE.test(email)) return { error: 'That email address does not look right.', field: 'email' };
  const bad = passwordProblem(body.password, email);
  if (bad) return { error: bad, field: 'password' };

  if (await findUserByEmail(env, email)) {
    return { error: 'An account with this email already exists. Log in, or reset your password.', field: 'email', exists: true };
  }

  const org = await createOrg(env, { name: company, plan: 'self-serve', trial_days: 1 });
  if (org.error) return { error: org.error, field: 'company' };
  // Usable at once: no trial clock, no approval.
  await env.DB.prepare("UPDATE orgs SET status = 'active', trial_ends = NULL WHERE id = ?").bind(org.id).run();

  const u = await saveUser(env, org.id, { name, email, functions: ['principal'], invited_by: 'self sign-up' }, sha256);
  if (u.error) {
    try { await env.DB.prepare('DELETE FROM orgs WHERE id = ?').bind(org.id).run(); } catch (e) { /* best effort */ }
    return { error: u.error, field: 'email' };
  }
  await env.DB.prepare("UPDATE users SET status = 'active', password_hash = ?, password_set_at = ? WHERE id = ?")
    .bind(await hashPassword(env, body.password), nowISO(), u.id).run();
  return { ok: true, user_id: u.id, org_id: org.id };
}

/* ---------------------------------------------------------------- log in */

export async function passwordLogin(env, email, password) {
  await ensureAccountTables(env);
  const em = cleanEmail(email);
  const user = EMAIL_RE.test(em) ? await findUserByEmail(env, em) : null;
  const row = user ? await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first() : null;
  if (!row || !row.password_hash) {
    await burnTime(env);
    return { error: 'That email and password do not match an account.' };
  }
  if (!(await verifyPassword(password, row.password_hash))) {
    return { error: 'That email and password do not match an account.' };
  }
  if (user.status === 'suspended') return { error: 'That access has been withdrawn.' };
  const org = await getOrg(env, user.org_id);
  const blocked = orgBlocked(org);
  if (blocked) return { error: blocked };
  await touchUser(env, user.id);
  // An invited person who sets a password and logs in is now active.
  if (user.status === 'invited') {
    try { await env.DB.prepare("UPDATE users SET status = 'active' WHERE id = ?").bind(user.id).run(); } catch (e) { /* cosmetic */ }
  }
  return { ok: true, user, org };
}

export async function setPassword(env, uid, password) {
  await ensureAccountTables(env);
  const u = await env.DB.prepare('SELECT id, email FROM users WHERE id = ?').bind(String(uid)).first();
  if (!u) return { error: 'unknown person' };
  const bad = passwordProblem(password, u.email);
  if (bad) return { error: bad, field: 'password' };
  await env.DB.prepare('UPDATE users SET password_hash = ?, password_set_at = ? WHERE id = ?')
    .bind(await hashPassword(env, password), nowISO(), u.id).run();
  return { ok: true };
}

export async function hasPassword(env, uid) {
  await ensureAccountTables(env);
  const r = await env.DB.prepare('SELECT password_set_at FROM users WHERE id = ?').bind(String(uid)).first();
  return !!(r && r.password_set_at);
}

// A company that signed itself up runs itself: it may create its own projects.
export async function isSelfServe(env, oid) {
  if (!oid) return false;
  const org = await getOrg(env, oid);
  return !!(org && String(org.plan || '') === 'self-serve');
}
