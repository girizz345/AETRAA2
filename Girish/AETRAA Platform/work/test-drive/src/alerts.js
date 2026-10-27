// K3: who is told what about held documents and storage (spec §22).
//
//   first item held on a project      AETRAA Admin    email, at once
//   further holds                     AETRAA Admin    in the daily digest (06:00 UAE)
//   items held over 3 days            AETRAA Admin    daily email until cleared
//   more than 20 held on one project  AETRAA Admin    once, then weekly
//   database storage over 80%         AETRAA Admin    daily
//   a held item decided               the uploader    email + the bell, with the Admin's note
//                                                     and, when approved, where it was filed
//
// NOTHING IS NOTIFIED TWICE. Every message is written to notify_log under
// (rule, scope, period) BEFORE it is sent, and a second attempt for the same
// key finds the row and sends nothing — across restarts and across servers,
// which the scheduler's in-memory "already fired" cannot promise. A send that
// fails removes its row, so the next run tries again.
//
// The thresholds are the spec's (§22) and are Ajay's open decision D5 — so
// they are settings, not code: HELD_REMIND_DAYS (3), HELD_PROJECT_LIMIT (20),
// STORAGE_ALERT_PCT (80).

import { platformEmails } from './org.js';
import { heldByTenant, countHeld, ensureQuarantineTable } from './quarantine.js';
import { capacity } from './file-move.js';
import { ensureNotifyTable } from './notify.js';

const nowISO = () => new Date().toISOString();
const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

export const thresholds = (env) => ({
  remindDays: num(env && env.HELD_REMIND_DAYS, 3),
  projectLimit: num(env && env.HELD_PROJECT_LIMIT, 20),
  storagePct: num(env && env.STORAGE_ALERT_PCT, 80),
});

// ISO week, "2026-W41": the period of a weekly rule.
export function isoWeek(day) {
  const d = new Date(String(day).slice(0, 10) + 'T00:00:00Z');
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - (d.getUTCDay() || 7)));
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return t.getUTCFullYear() + '-W' + String(Math.ceil(((t - y) / 86400000 + 1) / 7)).padStart(2, '0');
}

/* ------------------------------------------------------------ once only */

let logReady = false;
export async function ensureNotifyLog(env) {
  if (logReady) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS notify_log (
         rule TEXT NOT NULL, scope TEXT NOT NULL, period TEXT NOT NULL,
         sent_at TEXT, detail TEXT, PRIMARY KEY (rule, scope, period))`
    ).run();
    logReady = true;
    return true;
  } catch (e) { return false; }
}

// Send once per (rule, scope, period). `send()` returns falsy or { error }.
export async function once(env, rule, scope, period, detail, send) {
  if (!(await ensureNotifyLog(env))) return { error: 'no log' };
  try {
    await env.DB.prepare('INSERT INTO notify_log (rule, scope, period, sent_at, detail) VALUES (?,?,?,?,?)')
      .bind(rule, String(scope), String(period), nowISO(), detail == null ? null : String(detail).slice(0, 4000)).run();
  } catch (e) { return { skipped: true }; }                 // already sent for this period
  let r;
  try { r = await send(); } catch (e) { r = { error: String(e && e.message || e) }; }
  if (r && r.error) {
    await env.DB.prepare('DELETE FROM notify_log WHERE rule = ? AND scope = ? AND period = ?').bind(rule, String(scope), String(period)).run().catch(() => {});
    return { error: r.error };
  }
  return { sent: true };
}

export async function sentLog(env, rule) {
  await ensureNotifyLog(env);
  try {
    const { results } = await env.DB.prepare('SELECT * FROM notify_log WHERE rule = ? ORDER BY sent_at').bind(rule).all();
    return results || [];
  } catch (e) { return []; }
}

/* ------------------------------------------------------------ new holds */

const heldLine = (h) => '<li><b>' + esc(h.filename || h.number || 'a document') + '</b> — ' + esc(h.reason || '') + '</li>';

// New holds on a project (not ones already in the queue). The FIRST item held
// on a project — nothing else of it waiting — is emailed to AETRAA at once;
// anything held while others wait goes in the next daily digest.
export async function onNewHolds(env, proj, quarantineIds, mailer) {
  const ids = (quarantineIds || []).filter(Boolean);
  if (!ids.length || !proj) return { first: false };
  await ensureQuarantineTable(env);
  const waiting = await countHeld(env, proj.id);
  if (waiting > ids.length) return { first: false };      // others already waiting → the digest
  const to = platformEmails(env);
  if (!to.length) return { first: true, sent: false, why: 'PLATFORM_EMAILS is not set' };
  const items = await heldItems(env, ids);
  const counts = await heldByTenant(env, 90);
  const mine = counts.find((c) => c.org_id === proj.org_id);
  const r = await once(env, 'held.first', proj.id, ids[0], JSON.stringify(ids), () => mailer(to,
    (mine && mine.warn ? 'Warning: ' : '') + items.length + ' document(s) held on ' + (proj.name || proj.id),
    '<p>' + items.length + ' document(s) on <b>' + esc(proj.name || proj.id) + '</b> were held for AETRAA to check, and wait for your decision in the held queue.</p>'
      + '<ul>' + items.slice(0, 20).map(heldLine).join('') + '</ul>'
      + (mine && mine.warn ? '<p><b>This company has had ' + mine.held + ' documents held in the last 90 days.</b> They may be loading another project’s documents into this one.</p>' : '')
      + '<p>Anything else held on this project while these wait comes in the daily digest.</p>'));
  return { first: true, ...r };
}

async function heldItems(env, ids) {
  const out = [];
  for (const id of ids) {
    const r = await env.DB.prepare('SELECT * FROM quarantine WHERE id = ?').bind(String(id)).first().catch(() => null);
    if (r) out.push(r);
  }
  return out;
}

/* ------------------------------------------------------------ the daily run */

// 06:00 UAE, with the attention digest. Each rule sends once per its period.
export async function runAdminAlerts(env, today, mailer, opts = {}) {
  const to = platformEmails(env);
  const out = { digest: null, over_days: null, over_limit: [], storage: null };
  if (!to.length) return { ...out, skipped: 'PLATFORM_EMAILS is not set' };
  await ensureQuarantineTable(env);
  const T = thresholds(env);
  const now = opts.now ? new Date(opts.now) : new Date();
  const names = {};
  try { for (const p of (await env.DB.prepare('SELECT id, name FROM projects').all()).results || []) names[p.id] = p.name; } catch (e) {}
  const held = (await env.DB.prepare("SELECT * FROM quarantine WHERE status = 'held' ORDER BY project_id, held_at").all().catch(() => ({ results: [] }))).results || [];

  // 1. the digest: held in the last day, other than those already emailed as a first hold
  const told = new Set();
  for (const r of await sentLog(env, 'held.first')) { try { for (const id of JSON.parse(r.detail || '[]')) told.add(id); } catch (e) {} }
  const since = new Date(now.getTime() - 86400000).toISOString();
  const recent = held.filter((h) => String(h.held_at) >= since && !told.has(h.id));
  if (recent.length) {
    const by = group(recent);
    out.digest = await once(env, 'held.digest', 'platform', today, recent.map((h) => h.id).join(','), () => mailer(to,
      'AETRAA: ' + recent.length + ' more document(s) held — ' + today,
      '<p>Held for AETRAA to check since yesterday, besides the ones already sent to you:</p>'
        + Object.keys(by).map((pid) => '<p><b>' + esc(names[pid] || pid) + '</b> (' + by[pid].length + ')</p><ul>' + by[pid].slice(0, 20).map(heldLine).join('') + '</ul>').join('')));
  }

  // 2. held over N days, daily until cleared
  const cutoff = new Date(now.getTime() - T.remindDays * 86400000).toISOString();
  const old = held.filter((h) => String(h.held_at) < cutoff);
  if (old.length) {
    const by = group(old);
    out.over_days = await once(env, 'held.over_days', 'platform', today, old.map((h) => h.id).join(','), () => mailer(to,
      'AETRAA: ' + old.length + ' document(s) held more than ' + T.remindDays + ' days',
      '<p>These have waited for a decision for more than ' + T.remindDays + ' days. Whoever loaded them cannot use them until you decide.</p>'
        + Object.keys(by).map((pid) => '<p><b>' + esc(names[pid] || pid) + '</b> (' + by[pid].length + ', the oldest since ' + esc(String(by[pid][0].held_at).slice(0, 10)) + ')</p><ul>'
          + by[pid].slice(0, 20).map(heldLine).join('') + '</ul>').join('')));
  }

  // 3. more than N held on one project: once, then weekly
  const counts = {};
  for (const h of held) counts[h.project_id] = (counts[h.project_id] || 0) + 1;
  for (const [pid, n] of Object.entries(counts)) {
    if (n <= T.projectLimit) continue;
    const r = await once(env, 'held.over_limit', pid, isoWeek(today), String(n), () => mailer(to,
      'AETRAA: ' + n + ' documents held on ' + (names[pid] || pid),
      '<p><b>' + esc(names[pid] || pid) + '</b> has ' + n + ' documents held — more than ' + T.projectLimit + '. That many usually means one cause: a numbering scheme the gate does not know, or another project’s set loaded into this one. Decide them by reason in the held queue rather than one by one.</p>'));
    out.over_limit.push({ project_id: pid, held: n, ...r });
  }

  // 4. database storage over N%
  const cap = await capacity(env).catch(() => null);
  const pct = cap && cap.database ? cap.database.used_pct : null;
  if (pct != null && pct >= T.storagePct) {
    out.storage = await once(env, 'storage.over', 'platform', today, String(pct), () => mailer(to,
      'AETRAA: the database is ' + pct + '% full',
      '<p>The platform’s database holds ' + Math.round(cap.database.bytes / 1048576) + ' MB of its ' + cap.database.limit_gb + ' GB (' + pct + '%). '
        + cap.database.files_still_in_database + ' file(s) are still kept in it'
        + (cap.driver === 'database' ? ', and no object store is configured — set up Azure Blob (deploy/azure/STORAGE.md).' : '. Move them to ' + esc(cap.driver_label) + ' on the Storage screen.')
        + '</p>'));
  }
  return out;
}

function group(list) {
  const by = {};
  for (const h of list) (by[h.project_id] || (by[h.project_id] = [])).push(h);
  return by;
}

/* ------------------------------------------------------------ decisions */

// The person who loaded a held document is told what was decided, with the
// Admin's own words, and where it went. One email and one bell notice per
// person per decision call; each item is reported once ever.
export async function tellUploaders(env, decided, mailer) {
  const byUser = {};
  for (const d of decided) {
    if (!d.held_by_id) continue;
    (byUser[d.held_by_id] || (byUser[d.held_by_id] = [])).push(d);
  }
  const out = [];
  for (const [userId, list] of Object.entries(byUser)) {
    const u = await env.DB.prepare('SELECT id, name, email, org_id FROM users WHERE id = ?').bind(userId).first().catch(() => null);
    if (!u) continue;
    const fresh = [];
    for (const d of list) {
      const r = await once(env, 'held.decided', d.id, d.status, d.note || '', () => null);
      if (r.sent) fresh.push(d);
    }
    if (!fresh.length) continue;
    const line = (d) => (d.filename || d.number || 'a document') + ': '
      + (d.status === 'approved' ? 'approved' + (d.filed_to ? ' and filed to ' + d.filed_to : '') : 'rejected')
      + (d.note ? ' — “' + d.note + '”' : '');
    const title = fresh.length === 1 ? 'Held document ' + (fresh[0].status === 'approved' ? 'approved' : 'rejected') + ': ' + (fresh[0].filename || fresh[0].number || '')
      : fresh.length + ' held documents decided by AETRAA';
    if (await ensureNotifyTable(env)) {
      await env.DB.prepare(`INSERT INTO notifications (id, org_id, project_id, user_id, title, message, ref, link, kind, sent_by, sent_by_name, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(uid('ntf_'), u.org_id || null, fresh[0].project_id, u.id, title.slice(0, 200), fresh.map(line).join('\n').slice(0, 2000),
          null, '/intake-history', 'held', null, 'AETRAA', nowISO()).run().catch(() => {});
    }
    if (u.email && mailer) {
      await mailer([u.email], 'AETRAA: ' + title,
        '<p>AETRAA has decided ' + (fresh.length === 1 ? 'a document' : fresh.length + ' documents') + ' you loaded that were held for checking:</p><ul>'
          + fresh.map((d) => '<li>' + esc(line(d)) + '</li>').join('') + '</ul>').catch(() => {});
    }
    out.push({ user_id: u.id, items: fresh.length });
  }
  return out;
}

/* ------------------------------------------------------------ K11: certificate expiry */

// v5 A5 "expiry alerts". A certificate is emailed about once when it comes
// within 30 days of its expiry and once when it has expired — to the
// project's HSE and PM (`peopleFor(project)` gives their addresses). The
// period is the expiry date itself, so a renewed certificate with a new date
// is told about again. A certificate from the old system has no clock (K5).
//   mailer(to[], subject, html)
export async function runCertAlerts(env, today, mailer, peopleFor) {
  const { certExpiries } = await import('./diary-docs.js');
  let projects = [];
  try {
    const r = await env.DB.prepare("SELECT id, name, ref, org_id FROM projects WHERE COALESCE(archived, 0) = 0").all();
    projects = r.results || [];
  } catch (e) { return [{ ok: false, error: 'no projects' }]; }
  const out = [];
  for (const p of projects) {
    const list = (await certExpiries(env, p.id, today).catch(() => [])).filter((c) => c.state === 'expired' || c.state === 'expiring');
    if (!list.length) continue;
    const to = await peopleFor(p).catch(() => []);
    if (!to.length) { out.push({ project: p.id, skipped: 'nobody with HSE or PM on the project' }); continue; }
    for (const c of list) {
      const expired = c.state === 'expired';
      const subject = (p.name || 'Project') + ' — ' + c.ref + (expired ? ' has expired (' + c.expiry + ')' : ' expires on ' + c.expiry);
      const html = '<p><b>' + esc(c.ref) + '</b> — ' + esc(c.title || '') + '</p><p>' + (expired
        ? 'It expired on <b>' + esc(c.expiry) + '</b>. Renew it, or take what it covers out of use.'
        : 'It expires on <b>' + esc(c.expiry) + '</b>, in ' + c.days + ' day' + (c.days === 1 ? '' : 's') + '. Arrange the renewal before then.') + '</p>';
      const r = await once(env, expired ? 'cert-expired' : 'cert-expiring', p.id + ':' + c.ref, c.expiry, subject, () => mailer(to, subject, html));
      out.push({ project: p.id, ref: c.ref, state: c.state, ...r });
    }
  }
  return out;
}

/* ------------------------------------------------------------ batch interrupted (spec §22) */

// A drop whose filing started and then stopped — the connection dropped, the
// laptop closed — with sheets still not filed and nothing heard from it for
// `quietMin` minutes. Whoever ran it is told once, on the bell and by email,
// how many were filed and how many remain, with the link that reopens it.
//   mailer(to[], subject, html)
export async function runBatchAlerts(env, nowMs, mailer, quietMin = 15) {
  const out = { told: 0 };
  const since = new Date((nowMs || Date.now()) - quietMin * 60000).toISOString();
  let rows = [];
  try {
    rows = (await env.DB.prepare(
      `SELECT b.id, b.project_id, b.org_id, b.started_by, b.started_by_id, b.updated_at,
              SUM(CASE WHEN i.state = 'filed' THEN 1 ELSE 0 END) AS filed,
              SUM(CASE WHEN i.state IN ('proposed','confirmed') THEN 1 ELSE 0 END) AS remaining,
              COUNT(i.id) AS total
         FROM intake_batch b JOIN intake_item i ON i.batch_id = b.id
        WHERE b.status IN ('committing','partly_committed') AND COALESCE(b.updated_at, b.started_at) < ?
        GROUP BY b.id, b.project_id, b.org_id, b.started_by, b.started_by_id, b.updated_at`
    ).bind(since).all()).results || [];
  } catch (e) { return { error: 'intake not available' }; }
  for (const b of rows) {
    const filed = Number(b.filed) || 0, remaining = Number(b.remaining) || 0, total = Number(b.total) || 0;
    if (!remaining || !filed) continue;                    // not started, or finished
    const u = b.started_by_id ? await env.DB.prepare('SELECT id, name, email, org_id FROM users WHERE id = ?').bind(b.started_by_id).first().catch(() => null) : null;
    const proj = await env.DB.prepare('SELECT name FROM projects WHERE id = ?').bind(b.project_id).first().catch(() => null);
    const base = String((env && env.PUBLIC_URL) || '').replace(/\/+$/, '');
    const reopen = '/intake?batch=' + encodeURIComponent(b.id);       // AETRAA's page: continues the drop
    const title = 'Filing stopped at ' + filed + ' of ' + total + (proj ? ' on ' + proj.name : '');
    const what = 'The filing stopped — the connection dropped or the page was closed. The first ' + filed + ' are filed; ' + remaining + ' are not.';
    // Whoever ran it (a project user): the bell and an email. Only AETRAA can
    // reopen a drop, so AETRAA is told too, with the link that continues it.
    const userMsg = what + ' Start your next drop and you will be offered to continue this one; AETRAA has been told too.';
    const bell = u ? await once(env, 'batch.interrupted.bell', b.id, 'once', title, async () => {
      if (!(await ensureNotifyTable(env))) return { error: 'no notifications table' };
      await env.DB.prepare(`INSERT INTO notifications (id, org_id, project_id, user_id, title, message, ref, link, kind, sent_by, sent_by_name, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(uid('ntf_'), u.org_id || b.org_id || null, b.project_id, u.id, title.slice(0, 200), userMsg, null, '/intake-history', 'intake', null, 'AETRAA', nowISO()).run();
      return null;
    }) : {};
    // An email that fails is tried on the next run, without a second bell.
    const mailUser = u && u.email && mailer ? await once(env, 'batch.interrupted', b.id + ':' + u.id, 'once', title, () =>
      mailer([u.email], 'AETRAA: ' + title, '<p>' + esc(userMsg) + '</p>')) : {};
    const admins = platformEmails(env);
    const mailAdmin = admins.length && mailer ? await once(env, 'batch.interrupted', b.id + ':aetraa', 'once', title, () =>
      mailer(admins, 'AETRAA: ' + title + (b.started_by ? ' (' + b.started_by + ')' : ''),
        '<p>' + esc(what) + '</p><p><a href="' + esc(base + reopen) + '">Open the drop and continue</a></p>')) : {};
    if (bell.sent || mailUser.sent || mailAdmin.sent) out.told++;
  }
  return out;
}
