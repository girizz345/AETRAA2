// NOTIFICATIONS — telling the team something has arrived.
//
// When Document Control uploads a drawing, attaches a file, or issues a record,
// they are offered "Notify the team": pick people (or whole functions, or the
// whole project team), add a line, and each person gets it under the bell in
// the app — and by email too, when email is set up and the sender asks for it.
//
// A notification is a row per recipient, so "read" is per person, and nobody
// outside the project — or outside the company — can ever be picked.

import { listUsers, userInProject } from './org.js';
import { userFunctions } from './functions.js';

const nowISO = () => new Date().toISOString();
const str = (v, n = 200) => String(v == null ? '' : v).slice(0, n);
const uid = () => 'ntf_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Who may send a notice to the team. Document Control is the reason this
// exists; the PM and the Principal run the job and may too.
export const NOTIFIERS = ['dc', 'pm', 'principal'];
export function mayNotify(me) {
  const f = userFunctions(me);
  return NOTIFIERS.some((x) => f.includes(x));
}

let tableReady = false;
export async function ensureNotifyTable(env) {
  if (tableReady) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS notifications (
         id TEXT PRIMARY KEY, org_id TEXT, project_id TEXT, user_id TEXT NOT NULL,
         title TEXT, message TEXT, ref TEXT, link TEXT, kind TEXT,
         sent_by TEXT, sent_by_name TEXT, created_at TEXT, read_at TEXT)`
    ).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_ntf_user ON notifications(user_id, read_at, created_at)`).run();
    tableReady = true;
    return true;
  } catch (e) { return false; }
}

// The people on this project, for the picker: id, name, functions. Active only.
export async function projectTeam(env, oid, pid) {
  const all = (await listUsers(env, oid)) || [];
  return all
    .filter((u) => u.status !== 'suspended' && userInProject(u, pid))
    // listUsers hands functions back already parsed; userFunctions reads the
    // stored JSON text (and falls back to the legacy role), so give it that.
    .map((u) => ({ id: u.id, name: u.name, email: u.email,
                   functions: userFunctions(Object.assign({}, u, {
                     functions: Array.isArray(u.functions) ? JSON.stringify(u.functions) : u.functions })) }));
}

// Send. `to` = { people: [user ids], functions: [function keys], all: bool }.
// Returns who it reached. `mailer(to[], subject, html)` sends the email copy.
export async function notifyTeam(env, { me, pid, projectName, to, title, message, ref, link, kind, email }, mailer) {
  if (!me) return { error: 'sign in as a person to notify the team' };
  if (!mayNotify(me)) return { error: 'Notifying the team is for Document Control and the Project Manager.' };
  if (!pid) return { error: 'which project?' };
  to = to || {};
  const team = await projectTeam(env, me.org_id, pid);
  const wantIds = new Set((Array.isArray(to.people) ? to.people : []).map(String));
  const wantFns = new Set((Array.isArray(to.functions) ? to.functions : []).map(String));
  const picked = team.filter((u) => u.id !== me.id && (
    to.all === true || wantIds.has(u.id) || u.functions.some((f) => wantFns.has(f))));
  if (!picked.length) return { error: 'Pick at least one person on this project.' };

  title = str(title, 160) || 'New from Document Control';
  message = str(message, 2000);
  await ensureNotifyTable(env);
  const at = nowISO();
  for (const u of picked) {
    await env.DB.prepare(
      `INSERT INTO notifications (id, org_id, project_id, user_id, title, message, ref, link, kind, sent_by, sent_by_name, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(uid(), me.org_id || null, pid, u.id, title, message, str(ref, 60) || null, str(link, 300) || null,
      str(kind, 30) || 'notice', me.id, str(me.name, 120), at).run();
  }

  let emailed = null;
  if (email && typeof mailer === 'function') {
    const addrs = picked.map((u) => u.email).filter(Boolean);
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const html = '<div style="font:15px/1.5 Arial,sans-serif;color:#1d2433">' +
      '<p style="margin:0 0 6px;color:#667">' + esc(projectName || '') + '</p>' +
      '<h2 style="margin:0 0 10px;font-size:18px">' + esc(title) + '</h2>' +
      (message ? '<p style="white-space:pre-wrap">' + esc(message) + '</p>' : '') +
      '<p style="color:#667">From ' + esc(me.name || 'Document Control') + ' — open AETRAA to see it.</p></div>';
    const r = await mailer(addrs, '[' + (projectName || 'AETRAA') + '] ' + title, html).catch(() => ({ ok: false }));
    emailed = !!(r && r.ok);
  }
  return { ok: true, sent: picked.length, to: picked.map((u) => u.name), emailed };
}

// Mine, newest first, with the unread count.
export async function myNotifications(env, userId, limit = 30) {
  await ensureNotifyTable(env);
  const { results } = await env.DB.prepare(
    `SELECT n.id, n.project_id, n.title, n.message, n.ref, n.link, n.kind, n.sent_by_name, n.created_at, n.read_at,
            p.name AS project_name
       FROM notifications n LEFT JOIN projects p ON p.id = n.project_id
      WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT ?`
  ).bind(userId, Math.min(Number(limit) || 30, 100)).all();
  const unread = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL`
  ).bind(userId).first();
  return { unread: Number((unread && unread.n) || 0), items: results || [] };
}

// Mark some (ids) or all of mine read. Only ever one's own.
export async function markRead(env, userId, ids) {
  await ensureNotifyTable(env);
  const at = nowISO();
  if (ids === 'all') {
    await env.DB.prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`).bind(at, userId).run();
    return { ok: true };
  }
  for (const id of (Array.isArray(ids) ? ids : []).slice(0, 200)) {
    await env.DB.prepare(`UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL`)
      .bind(at, String(id), userId).run();
  }
  return { ok: true };
}
