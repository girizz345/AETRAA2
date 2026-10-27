// Organisations and real people.
//
// Everything before this treated the app as one company's tool: a project handed
// out four shared codes, and whoever held one was "the site team". That is fine
// for one contractor. It cannot be sold, because there is nothing to bill, nothing
// to separate one customer's data from another's, and no way to answer the only
// question an auditor ever asks — who typed that number.
//
// So: an organisation owns projects; a person belongs to an organisation; and
// every request is attributable to a named person rather than to a code that
// three people share.
//
// Two ways in, because a site engineer in Dubai will not have a work email and
// nobody is going to give him one:
//
//   office        types their email, gets a six-digit code, types it back.
//                 No password is ever set, stored, reset or leaked.
//   site          gets a personal code on a card. Same shape as today's codes,
//                 but it belongs to one man, carries his name onto every update,
//                 and is withdrawn on its own without disturbing anyone else.
//
// Nothing here throws when the tables are missing. The app ran for months on
// shared codes and must keep running on them until the last one is retired.

import { ROLES } from './access.js';
import { cleanFunctions, legacyRole } from './functions.js';

export const ORG_STATUS = ['trial', 'active', 'suspended', 'closed'];

// No 0/O/1/I/L — these get read off a card and typed into a phone in daylight.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function randomCode(groups = 2, size = 4) {
  const bytes = crypto.getRandomValues(new Uint8Array(groups * size));
  const out = [];
  for (let g = 0; g < groups; g++) {
    let s = '';
    for (let i = 0; i < size; i++) s += ALPHABET[bytes[g * size + i] % ALPHABET.length];
    out.push(s);
  }
  return out.join('-');
}

// The email code is digits only. Six of them, from real randomness, and it dies
// after ten minutes or five wrong guesses.
export function randomDigits(n = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  let s = '';
  for (let i = 0; i < n; i++) s += String(bytes[i] % 10);
  return s;
}

const id = (prefix) => prefix + '_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
const nowISO = () => new Date().toISOString();

export const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
export const cleanEmail = (v) => String(v || '').trim().toLowerCase().slice(0, 200);

const parseList = (v) => {
  if (!v) return [];
  try { const j = JSON.parse(v); return Array.isArray(j) ? j.filter(Boolean).map(String) : []; }
  catch (e) { return []; }
};

/* ------------------------------------------------------------ the tenant */

/* Company email domains.
 *
 * A company can be locked to its own email domain(s) — e.g. naf.ae — so every
 * person added to it signs in with a company address: no Gmail, and nobody put
 * into the wrong company by a typo. Outside people who genuinely belong (a
 * subcontractor, a consultant) are let in by listing their domain or their full
 * address under "also allowed". A company with no domains set is not locked,
 * which is how every company made before this behaves.
 */
const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
export function cleanDomains(v) {
  const list = Array.isArray(v) ? v : String(v || '').split(/[\s,;]+/);
  const out = [];
  for (let d of list) {
    d = String(d || '').trim().toLowerCase().replace(/^@/, '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!d) continue;
    if (EMAIL_RE.test(d) || DOMAIN_RE.test(d)) { if (!out.includes(d)) out.push(d); }
    else return { error: '“' + d + '” is not a domain (like naf.ae) or an email address' };
  }
  return out.slice(0, 20);
}
export function emailAllowed(org, email) {
  const domains = parseList(org && org.email_domains);
  if (!domains.length || !email) return true;
  const e = cleanEmail(email);
  const at = e.split('@')[1] || '';
  const allowed = domains.concat(parseList(org && org.email_allowed));
  // a listed domain also covers its sub-domains (site.naf.ae under naf.ae)
  return allowed.some((d) => d.includes('@') ? d === e : (at === d || at.endsWith('.' + d)));
}
let emailColumnsChecked = false;
export async function ensureOrgEmailColumns(env) {
  if (emailColumnsChecked) return;
  for (const col of ['email_domains', 'email_allowed']) {
    try { await env.DB.prepare(`SELECT ${col} FROM orgs LIMIT 1`).first(); }
    catch (e) { try { await env.DB.prepare(`ALTER TABLE orgs ADD COLUMN ${col} TEXT`).run(); } catch (e2) { /* there */ } }
  }
  emailColumnsChecked = true;
}
export async function setOrgEmailDomains(env, oid, domains, allowed) {
  await ensureOrgEmailColumns(env);
  const org = await getOrg(env, oid);
  if (!org) return { error: 'unknown organisation' };
  const d = cleanDomains(domains); if (d.error) return d;
  const a = cleanDomains(allowed); if (a.error) return a;
  await env.DB.prepare('UPDATE orgs SET email_domains = ?, email_allowed = ? WHERE id = ?')
    .bind(JSON.stringify(d), JSON.stringify(a), oid).run();
  return { ok: true, email_domains: d, email_allowed: a };
}

export async function createOrg(env, body) {
  const name = String(body.name || '').trim().slice(0, 200);
  if (!name) return { error: 'the organisation needs a name' };
  // Check the domains before anything is written, so a typo creates nothing.
  const domains = cleanDomains(body.email_domains);
  if (domains.error) return domains;
  const allowed = cleanDomains(body.email_allowed);
  if (allowed.error) return allowed;
  const oid = id('org');
  const trialDays = Number(body.trial_days) > 0 ? Math.min(180, Number(body.trial_days)) : 30;
  await env.DB.prepare(
    `INSERT INTO orgs (id, name, slug, country, plan, status, trial_ends, seats,
                       data_region, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    oid, name,
    String(body.slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40),
    String(body.country || 'AE').slice(0, 4).toUpperCase(),
    String(body.plan || 'trial').slice(0, 40),
    'trial',
    new Date(Date.now() + trialDays * 86400000).toISOString().slice(0, 10),
    Number(body.seats) > 0 ? Math.min(500, Number(body.seats)) : 10,
    String(body.data_region || env.DATA_REGION || '').slice(0, 40),
    nowISO()
  ).run();
  if (domains.length || allowed.length) {
    const r = await setOrgEmailDomains(env, oid, domains, allowed);
    if (r.error) return r;
  }
  return { ok: true, id: oid };
}

export async function getOrg(env, oid) {
  if (!oid) return null;
  try {
    return await env.DB.prepare('SELECT * FROM orgs WHERE id = ?').bind(oid).first();
  } catch (err) {
    return null;                    // not migrated
  }
}

export async function listOrgs(env) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT o.*,
              (SELECT COUNT(*) FROM users u WHERE u.org_id = o.id AND u.status != 'suspended') AS people,
              (SELECT COUNT(*) FROM projects p WHERE p.org_id = o.id) AS projects
         FROM orgs o ORDER BY o.created_at DESC`
    ).all();
    return results || [];
  } catch (err) {
    return null;
  }
}

export async function updateOrg(env, oid, body) {
  const row = await getOrg(env, oid);
  if (!row) return { error: 'unknown organisation' };
  const sets = [], args = [];
  if (body.name !== undefined) { sets.push('name = ?'); args.push(String(body.name).slice(0, 200)); }
  if (body.plan !== undefined) { sets.push('plan = ?'); args.push(String(body.plan).slice(0, 40)); }
  if (body.seats !== undefined) { sets.push('seats = ?'); args.push(Math.max(1, Math.min(500, Number(body.seats) || 1))); }
  if (body.trial_ends !== undefined) { sets.push('trial_ends = ?'); args.push(String(body.trial_ends).slice(0, 10)); }
  if (body.status !== undefined && ORG_STATUS.includes(body.status)) {
    sets.push('status = ?'); args.push(body.status);
  }
  if (!sets.length) return { error: 'nothing to change' };
  await env.DB.prepare(`UPDATE orgs SET ${sets.join(', ')} WHERE id = ?`).bind(...args, oid).run();
  return { ok: true };
}

// Suspended or closed means signed out, not merely warned. Checked on every
// request, so switching a customer off takes effect on their next tap.
export function orgBlocked(org) {
  if (!org) return null;
  if (org.status === 'suspended') return 'This account is suspended. Please contact us.';
  if (org.status === 'closed') return 'This account has been closed.';
  if (org.status === 'trial' && org.trial_ends && org.trial_ends < nowISO().slice(0, 10)) {
    return 'The trial period has ended. Please contact us to continue.';
  }
  return null;
}

/* -------------------------------------------------------------- the people */

export async function getUser(env, uid) {
  if (!uid) return null;
  try {
    return await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(uid).first();
  } catch (err) {
    return null;
  }
}

export async function findUserByEmail(env, email) {
  const e = cleanEmail(email);
  if (!e) return null;
  try {
    return await env.DB.prepare(
      `SELECT * FROM users WHERE email = ? AND COALESCE(status,'active') != 'suspended' LIMIT 1`
    ).bind(e).first();
  } catch (err) {
    return null;
  }
}

export async function findUserByInvite(env, hash) {
  try {
    return await env.DB.prepare(
      `SELECT * FROM users WHERE invite_hash = ? AND COALESCE(status,'active') != 'suspended' LIMIT 1`
    ).bind(hash).first();
  } catch (err) {
    return null;
  }
}

// Any user holding this code, withdrawn or not. The login route needs this: once
// a code belongs to a named person, that person is the authority on whether it
// works. Without it, withdrawing somebody would fall through to the old
// project-wide code the same hash was adopted from, and let them straight back in.
export async function findUserByInviteAny(env, hash) {
  try {
    return await env.DB.prepare('SELECT * FROM users WHERE invite_hash = ? LIMIT 1')
      .bind(hash).first();
  } catch (err) {
    return null;
  }
}

export async function listUsers(env, oid) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, org_id, name, email, phone, role, functions, status, scope_groups, scope_trades,
              project_ids, invited_by, created_at, last_seen,
              CASE WHEN invite_hash IS NULL THEN 0 ELSE 1 END AS has_code
         FROM users WHERE org_id = ?
        ORDER BY CASE COALESCE(status,'active') WHEN 'suspended' THEN 1 ELSE 0 END,
                 role, name`
    ).bind(oid).all();
    return (results || []).map((r) => ({
      ...r,
      scope: { groups: parseList(r.scope_groups), trades: parseList(r.scope_trades) },
      projects: parseList(r.project_ids),
      functions: parseList(r.functions),
    }));
  } catch (err) {
    return null;
  }
}

// What this person may touch, in the same shape access.js already understands,
// so every existing scope check keeps working unchanged.
export const userScope = (user) => ({
  groups: parseList(user && user.scope_groups),
  trades: parseList(user && user.scope_trades),
});

// An empty list means every project in the organisation — the common case, and
// the one a project manager expects.
export const userProjects = (user) => parseList(user && user.project_ids);

export function userInProject(user, pid) {
  if (!user || !pid) return false;
  const list = userProjects(user);
  return !list.length || list.includes(String(pid));
}

// A demo account exists to be shown to somebody across a table. Its office
// people therefore carry a personal code like the site men do, so the whole
// platform can be walked through — PM, QS, HSE, Document Control — without an
// inbox in the room. Only an organisation the platform owner created on the
// 'demo' plan behaves this way; every real customer signs its office people in
// by email, as before.
export async function orgIsDemo(env, oid) {
  if (!oid) return false;
  try {
    const row = await env.DB.prepare('SELECT plan FROM orgs WHERE id = ?').bind(String(oid)).first();
    return !!row && String(row.plan || '').toLowerCase() === 'demo';
  } catch (err) {
    return false;
  }
}

export async function saveUser(env, oid, body, sha256) {
  const name = String(body.name || '').trim().slice(0, 120);
  if (!name) return { error: 'the person needs a name — it goes on every update they send' };
  // New model: a person holds one or more functions. The legacy `role` is derived
  // from them so every existing scope and login check keeps working. Old callers
  // that still send only `role` are unaffected.
  const fns = cleanFunctions(body.functions);
  let role = ROLES[body.role] || body.role === 'owner' ? body.role : 'site';
  if (fns.length) role = legacyRole(fns);
  const email = body.email ? cleanEmail(body.email) : null;
  if (email && !EMAIL_RE.test(email)) return { error: 'that email address does not look right' };

  // Office roles sign in by email; without one there is no way for them to get in.
  const officeRole = role === 'owner' || role === 'manager';
  const demoOrg = await orgIsDemo(env, oid);
  if (officeRole && !email) {
    return { error: 'a manager signs in by email, so this one needs an email address' };
  }

  // The company's email-domain lock. Checked when an address is new or changed,
  // so people already on the books can still be edited.
  if (email) {
    let before = null;
    if (body.id) {
      const cur = await env.DB.prepare('SELECT email FROM users WHERE id = ? AND org_id = ?')
        .bind(String(body.id), oid).first();
      before = cur && cur.email;
    }
    if (email !== before) {
      await ensureOrgEmailColumns(env);
      const org = await getOrg(env, oid);
      if (!emailAllowed(org, email)) {
        const ds = parseList(org.email_domains).map((d) => '@' + d).join(' or ');
        return { error: 'Only ' + ds + ' addresses can be added to ' + (org.name || 'this company') +
          '. For an outside person, ask AETRAA to allow their address.' };
      }
    }
  }

  if (email) {
    const clash = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ? AND id != ?'
    ).bind(email, String(body.id || '')).first();
    if (clash) return { error: 'somebody already uses that email address' };
  }

  const groups = Array.isArray(body.groups) ? body.groups.map((s) => String(s).slice(0, 120)) : [];
  const trades = Array.isArray(body.trades) ? body.trades.map((s) => String(s).slice(0, 120)) : [];
  const projects = Array.isArray(body.projects) ? body.projects.map((s) => String(s).slice(0, 40)) : [];
  // An owner or a manager is never scoped to one discipline.
  const scopeG = officeRole ? [] : groups;
  const scopeT = officeRole ? [] : trades;

  if (body.id) {
    const existing = await env.DB.prepare('SELECT * FROM users WHERE id = ? AND org_id = ?')
      .bind(String(body.id), oid).first();
    if (!existing) return { error: 'unknown person' };
    const sets = ['name = ?', 'role = ?', 'email = ?', 'phone = ?',
                  'scope_groups = ?', 'scope_trades = ?', 'project_ids = ?'];
    const args = [name, role, email, String(body.phone || '').slice(0, 40) || null,
                  JSON.stringify(scopeG), JSON.stringify(scopeT), JSON.stringify(projects)];
    if (body.status && ['invited', 'active', 'suspended'].includes(body.status)) {
      sets.push('status = ?'); args.push(body.status);
    }
    let code = null;
    if (body.new_code && (!officeRole || demoOrg)) {
      code = randomCode();
      sets.push('invite_hash = ?'); args.push(await sha256(code));
    } else if (officeRole && email && !demoOrg) {
      // They sign in by email now, so whatever code they were carrying — usually a
      // shared one adopted from the old world — stops working. Leaving it live
      // would mean the office code is still out there long after everybody thinks
      // it was retired.
      sets.push('invite_hash = NULL');
    }
    await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...args, String(body.id)).run();
    // Store the fine-grained functions separately — best-effort, so a database not
    // yet carrying the column never blocks saving a person.
    if (body.functions !== undefined) {
      try { await env.DB.prepare('UPDATE users SET functions = ? WHERE id = ?')
        .bind(JSON.stringify(fns), String(body.id)).run(); } catch (e) { /* not migrated */ }
    }
    return { ok: true, id: String(body.id), code };
  }

  const uid = id('usr');
  // A site man gets a code now, because he is standing in front of you. An office
  // person gets nothing to carry — they sign in with the email you just typed.
  const code = (officeRole && !demoOrg) ? null : randomCode();
  await env.DB.prepare(
    `INSERT INTO users (id, org_id, name, email, phone, role, status,
                        scope_groups, scope_trades, project_ids, invite_hash,
                        invited_by, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    uid, oid, name, email, String(body.phone || '').slice(0, 40) || null, role,
    (officeRole && !demoOrg) ? 'invited' : 'active',
    JSON.stringify(scopeG), JSON.stringify(scopeT), JSON.stringify(projects),
    code ? await sha256(code) : null,
    String(body.invited_by || '').slice(0, 120) || null, nowISO()
  ).run();
  if (body.functions !== undefined) {
    try { await env.DB.prepare('UPDATE users SET functions = ? WHERE id = ?')
      .bind(JSON.stringify(fns), uid).run(); } catch (e) { /* not migrated */ }
  }
  return { ok: true, id: uid, code };
}

export async function suspendUser(env, oid, uid, on = true) {
  const row = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND org_id = ?')
    .bind(String(uid), oid).first();
  if (!row) return { error: 'unknown person' };
  await env.DB.prepare('UPDATE users SET status = ? WHERE id = ?')
    .bind(on ? 'suspended' : 'active', String(uid)).run();
  return { ok: true, suspended: !!on };
}

export async function touchUser(env, uid) {
  try {
    await env.DB.prepare(`UPDATE users SET last_seen = ?, status = CASE WHEN status = 'invited'
                            THEN 'active' ELSE status END WHERE id = ?`)
      .bind(nowISO(), uid).run();
  } catch (e) { /* never worth failing a sign-in over */ }
}

/* ----------------------------------------------------- signing in by email */

const CODE_MINUTES = 10;
const MAX_TRIES = 5;

// Returns the code for the caller to email. It is never stored in the clear and
// never returned to the browser — the only way to learn it is to read the inbox.
export async function startEmailSignIn(env, email, sha256) {
  const user = await findUserByEmail(env, email);
  if (!user) return { error: 'no-such-user' };
  const org = await getOrg(env, user.org_id);
  const blocked = orgBlocked(org);
  if (blocked) return { error: 'blocked', message: blocked };

  // One live code at a time, so an old email cannot be used after a new one is asked for.
  await env.DB.prepare('UPDATE sign_in_codes SET used = 1 WHERE user_id = ? AND used = 0')
    .bind(user.id).run();

  const code = randomDigits(6);
  await env.DB.prepare(
    `INSERT INTO sign_in_codes (id, user_id, code_hash, expires, used, tries, created_at)
     VALUES (?,?,?,?,0,0,?)`
  ).bind(
    id('sic'), user.id, await sha256(code),
    new Date(Date.now() + CODE_MINUTES * 60000).toISOString(), nowISO()
  ).run();

  return { ok: true, user, org, code, minutes: CODE_MINUTES };
}

// The same code, made for somebody else to read out.
//
// Email is the one part of signing in that depends on something outside this
// app, and when it is down an office person has no other way in — his code was
// retired the day he was given an email address. So the owner can mint one and
// read it over the phone. It is the same ten minutes, the same five attempts,
// the same single use: what changes is who carries it from the app to the man,
// not how strong it is.
//
// This is also the only way one person can obtain another's sign-in, so every
// use of it is written to the audit by the caller, loudly.
export async function issueSignInCode(env, uid, sha256) {
  const user = await getUser(env, uid);
  if (!user) return { error: 'unknown person' };
  if (user.status === 'suspended') return { error: 'That access has been withdrawn.' };
  if (!user.email) {
    return { error: `${user.name} does not sign in by code — they carry a personal code on a card. ` +
                    'Issue a new one from Edit instead.' };
  }
  const org = await getOrg(env, user.org_id);
  const blocked = orgBlocked(org);
  if (blocked) return { error: blocked };

  await env.DB.prepare('UPDATE sign_in_codes SET used = 1 WHERE user_id = ? AND used = 0')
    .bind(user.id).run();

  const code = randomDigits(6);
  await env.DB.prepare(
    `INSERT INTO sign_in_codes (id, user_id, code_hash, expires, used, tries, created_at)
     VALUES (?,?,?,?,0,0,?)`
  ).bind(
    id('sic'), user.id, await sha256(code),
    new Date(Date.now() + CODE_MINUTES * 60000).toISOString(), nowISO()
  ).run();

  return { ok: true, code, minutes: CODE_MINUTES, name: user.name, email: user.email,
           org: org ? org.name : null };
}

export async function completeEmailSignIn(env, email, given, sha256) {
  const user = await findUserByEmail(env, email);
  if (!user) return { error: 'That code is not right, or it has expired.' };

  // Testing phase: one fixed code, held in the LOGIN_TEST_CODE secret, signs in
  // any known email with no email delivery. It exists only while that secret is
  // set — delete the secret and this branch is dead. Never leave it set once real
  // people are on the system.
  if (env && env.LOGIN_TEST_CODE && String(given || '').trim() === String(env.LOGIN_TEST_CODE)) {
    const org = await getOrg(env, user.org_id);
    const blocked = orgBlocked(org);
    if (blocked) return { error: blocked };
    await touchUser(env, user.id);
    return { ok: true, user, org, test: true };
  }

  const row = await env.DB.prepare(
    `SELECT * FROM sign_in_codes WHERE user_id = ? AND used = 0
      ORDER BY created_at DESC LIMIT 1`
  ).bind(user.id).first();
  if (!row) return { error: 'That code is not right, or it has expired.' };

  if (row.expires < nowISO()) {
    await env.DB.prepare('UPDATE sign_in_codes SET used = 1 WHERE id = ?').bind(row.id).run();
    return { error: 'That code has expired. Ask for a new one.' };
  }
  if ((row.tries || 0) >= MAX_TRIES) {
    await env.DB.prepare('UPDATE sign_in_codes SET used = 1 WHERE id = ?').bind(row.id).run();
    return { error: 'Too many attempts. Ask for a new code.' };
  }

  const hash = await sha256(String(given || '').replace(/\D/g, ''));
  if (hash !== row.code_hash) {
    await env.DB.prepare('UPDATE sign_in_codes SET tries = tries + 1 WHERE id = ?').bind(row.id).run();
    return { error: 'That code is not right.', left: MAX_TRIES - (row.tries || 0) - 1 };
  }

  const org = await getOrg(env, user.org_id);
  const blocked = orgBlocked(org);
  if (blocked) return { error: blocked };

  // Burn the code the moment it works. A code is good once.
  await env.DB.prepare('UPDATE sign_in_codes SET used = 1 WHERE id = ?').bind(row.id).run();
  await touchUser(env, user.id);
  return { ok: true, user, org };
}

// Housekeeping, run from the cron. Spent codes are worthless but they are still
// rows, and the table would otherwise grow forever.
export async function purgeSignInCodes(env) {
  try {
    await env.DB.prepare(
      `DELETE FROM sign_in_codes WHERE used = 1 OR expires < ?`
    ).bind(new Date(Date.now() - 86400000).toISOString()).run();
  } catch (e) { /* nothing depends on this */ }
}

export function signInEmail(code, org, minutes = CODE_MINUTES) {
  const who = (org && org.name) || 'AETRAA';
  return `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <p style="margin:0 0 18px;color:#334">Your sign-in code for <strong>${escapeHTML(who)}</strong>:</p>
    <p style="font-size:34px;letter-spacing:8px;font-weight:700;margin:0 0 18px;color:#0b2239">${code}</p>
    <p style="margin:0 0 6px;color:#667;font-size:13px">It works once, and for ${minutes} minutes.</p>
    <p style="margin:0;color:#667;font-size:13px">If you did not ask for this, ignore it — nobody can get in without the code.</p>
  </div>`;
}

const escapeHTML = (s) => String(s || '').replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ------------------------------------------------------------------ audit */

// Who did what. Written on the way past; a failure here never fails the action
// it was recording, because losing an audit line is better than losing the work.
export async function audit(env, entry) {
  try {
    await env.DB.prepare(
      `INSERT INTO audit (org_id, project_id, user_id, who, action, detail, at)
       VALUES (?,?,?,?,?,?,?)`
    ).bind(
      entry.org_id || null, entry.project_id || null, entry.user_id || null,
      String(entry.who || '').slice(0, 120), String(entry.action || '').slice(0, 60),
      String(entry.detail || '').slice(0, 1000), nowISO()
    ).run();
  } catch (e) { /* deliberately silent */ }
}

export async function listAudit(env, oid, opts = {}) {
  try {
    const args = [oid];
    let where = 'org_id = ?';
    if (opts.project_id) { where += ' AND project_id = ?'; args.push(opts.project_id); }
    if (opts.action) { where += ' AND action = ?'; args.push(opts.action); }
    const { results } = await env.DB.prepare(
      `SELECT * FROM audit WHERE ${where} ORDER BY id DESC LIMIT ${Math.min(500, opts.limit || 200)}`
    ).bind(...args).all();
    return results || [];
  } catch (err) {
    return null;
  }
}

/* ------------------------------------------------- moving the old world in */

// Every shared access code becomes a named person, so nothing stops working the
// day organisations arrive and nobody has to be told a new code. The code itself
// is carried across unchanged — the card in his wallet still works.
export async function adoptCodes(env, oid) {
  let moved = 0;
  try {
    const { results } = await env.DB.prepare(
      `SELECT ac.* FROM access_codes ac
        WHERE COALESCE(ac.active,1) = 1
          AND NOT EXISTS (SELECT 1 FROM users u WHERE u.invite_hash = ac.code_hash)`
    ).all();
    for (const ac of results || []) {
      await env.DB.prepare(
        `INSERT INTO users (id, org_id, name, email, phone, role, status,
                            scope_groups, scope_trades, project_ids, invite_hash, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        id('usr'), oid, ac.label || 'Site team', null, null,
        ROLES[ac.role] ? ac.role : 'site', 'active',
        ac.scope_groups || '[]', ac.scope_trades || '[]',
        JSON.stringify([ac.project_id]), ac.code_hash, ac.created_at || nowISO()
      ).run();
      moved++;
    }
  } catch (err) {
    return { error: String(err.message || err) };
  }
  return { ok: true, moved };
}
