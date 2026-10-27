// QUARANTINE — what the gate held, and what happens to it next.
//
// A held document is NOT a rejected one. It has been uploaded, it is visible to
// the person who sent it, and it carries the reason in words they can act on.
// What it is not is IN anything: not in a register, not in a total, not in an
// export, and not on its way to a consultant.
//
// Only the AETRAA Admin decides. That is the point of the control — a
// contractor cannot approve their own way past it. It is a deliberate
// bottleneck, and the two things that keep it from becoming an obstacle are in
// here: decisions are grouped by REASON rather than taken per file, and
// approving can WIDEN the project's rules so the same hold never recurs.

const nowISO = () => new Date().toISOString();
const uid = () => 'qtn_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const str = (v, n = 300) => String(v == null ? '' : v).slice(0, n);

export const STATUSES = ['held', 'approved', 'rejected'];
export const ACTIONS = ['approve', 'approve_widen', 'reject'];

let ready = false;
export async function ensureQuarantineTable(env) {
  if (ready) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS quarantine (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, org_id TEXT,
         kind TEXT, filename TEXT, ref TEXT, number TEXT, prefix TEXT,
         reason TEXT, evidence TEXT,
         payload TEXT, file_key TEXT,
         held_at TEXT, held_by TEXT, held_by_id TEXT,
         status TEXT, decided_by TEXT, decided_at TEXT, note TEXT,
         widened_rule TEXT, target_id TEXT)`
    ).run();
    await env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_qtn_project ON quarantine(project_id, status)`
    ).run();
    ready = true;
    return true;
  } catch (e) { return false; }
}

function shape(r) {
  let evidence = null, payload = null, widened = null;
  try { evidence = JSON.parse(r.evidence || 'null'); } catch (e) {}
  try { payload = JSON.parse(r.payload || 'null'); } catch (e) {}
  try { widened = JSON.parse(r.widened_rule || 'null'); } catch (e) {}
  return {
    id: r.id, project_id: r.project_id, org_id: r.org_id || null,
    kind: r.kind, filename: r.filename, ref: r.ref || null,
    number: r.number || null, prefix: r.prefix || null,
    reason: r.reason, evidence,
    held_at: r.held_at, held_by: r.held_by, held_by_id: r.held_by_id || null, status: r.status,
    decided_by: r.decided_by || null, decided_at: r.decided_at || null,
    note: r.note || null, widened_rule: widened, target_id: r.target_id || null,
    payload,
  };
}

// Hold one item. `payload` is whatever the importer would have written, kept
// verbatim so approving can replay it rather than reconstruct it — a
// reconstruction is a second chance to get it wrong.
// Spec §12: past this many held items on one project, something is wrong. The
// project is flagged and nothing more is queued silently — on every path to
// the queue, the single drawing upload as much as a folder drop.
export const HELD_LIMIT = 500;
export const HELD_FULL = 'This project already has 500 held items, so nothing more is held: something is wrong and AETRAA has been told. This file was not filed.';

export async function hold(env, pid, item, who) {
  const ok = await ensureQuarantineTable(env);
  if (!ok) return { error: 'quarantine is not available on this database' };
  if (await countHeld(env, pid) >= HELD_LIMIT) {
    try { await env.DB.prepare("UPDATE projects SET intake_flag = 'held_limit' WHERE id = ?").bind(pid).run(); } catch (e) { /* column added by intake */ }
    return { error: HELD_FULL, held_limit: true };
  }
  const id = uid();
  const ev = item.evidence ? JSON.stringify(item.evidence) : null;
  try {
    await env.DB.prepare(
      `INSERT INTO quarantine (id, project_id, org_id, kind, filename, ref, number, prefix,
         reason, evidence, payload, file_key, held_at, held_by, held_by_id, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      id, pid, str(item.org_id, 60) || null, str(item.kind, 40), str(item.filename, 300),
      str(item.ref, 60) || null, str(item.number, 60) || null, str(item.prefix, 20) || null,
      str(item.reason, 600), ev,
      item.payload ? JSON.stringify(item.payload) : null,
      str(item.file_key, 300) || null,
      nowISO(), str((who && who.name) || '', 120), str((who && who.id) || '', 60) || null,
      'held'
    ).run();
  } catch (e) { return { error: 'could not hold that item' }; }
  return { ok: true, id, held: true, reason: item.reason };
}

// What is held. The Admin sees every project; anyone else sees their own, so a
// document controller can tell the difference between "lost" and "with AETRAA".
export async function listHeld(env, opts = {}) {
  const ok = await ensureQuarantineTable(env);
  if (!ok) return [];
  const where = [], args = [];
  if (opts.project_id) { where.push('project_id = ?'); args.push(opts.project_id); }
  if (opts.org_id) { where.push('org_id = ?'); args.push(opts.org_id); }
  where.push('status = ?'); args.push(opts.status || 'held');
  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM quarantine WHERE ${where.join(' AND ')} ORDER BY held_at DESC`
    ).bind(...args).all();
    return (results || []).map(shape);
  } catch (e) { return []; }
}

export async function getHeld(env, id) {
  const ok = await ensureQuarantineTable(env);
  if (!ok) return null;
  try {
    const r = await env.DB.prepare('SELECT * FROM quarantine WHERE id = ?').bind(String(id)).first();
    return r ? shape(r) : null;
  } catch (e) { return null; }
}

// Grouped by reason, because a decision should be about a pattern rather than a
// file. "142 sheets numbered SUB-" is one decision; 142 files is an obstacle,
// and an obstacle gets cleared by approving everything unread.
export function groupByReason(items) {
  const groups = {};
  for (const it of items) {
    const key = it.prefix ? (it.kind + ':' + it.prefix) : (it.kind + ':' + (it.reason || '').slice(0, 60));
    const g = groups[key] || (groups[key] = {
      key, kind: it.kind, prefix: it.prefix || null, reason: it.reason,
      project_id: it.project_id, count: 0, ids: [], examples: [],
    });
    g.count++;
    g.ids.push(it.id);
    if (g.examples.length < 3) g.examples.push(it.filename);
  }
  return Object.values(groups).sort((a, b) => b.count - a.count);
}

// Record the decision. Filing the approved item is the caller's job — this
// module never writes to a register, so there is exactly one route in and the
// gate still guards it.
export async function decide(env, id, action, who, note, widened) {
  if (!ACTIONS.includes(action)) return { error: 'unknown action' };
  const item = await getHeld(env, id);
  if (!item) return { error: 'no such held item' };
  if (item.status !== 'held') return { error: 'that item has already been decided' };
  // A rejection with no reason reads as arbitrary, and one arbitrary rejection
  // teaches a document controller to stop using the loader.
  if (action === 'reject' && !String(note || '').trim()) {
    return { error: 'say why it is rejected — whoever sent it is told the reason' };
  }
  const status = action === 'reject' ? 'rejected' : 'approved';
  try {
    await env.DB.prepare(
      `UPDATE quarantine SET status = ?, decided_by = ?, decided_at = ?, note = ?, widened_rule = ?
         WHERE id = ?`
    ).bind(status, str((who && who.name) || 'AETRAA Admin', 120), nowISO(),
      str(note, 600) || null, widened ? JSON.stringify(widened) : null, String(id)).run();
  } catch (e) { return { error: 'could not record that decision' }; }
  return { ok: true, id: String(id), status, item };
}

export async function markFiled(env, id, targetId) {
  try {
    await env.DB.prepare('UPDATE quarantine SET target_id = ? WHERE id = ?')
      .bind(str(targetId, 60), String(id)).run();
  } catch (e) { /* the decision is recorded; the link is a convenience */ }
}

export async function countHeld(env, pid) {
  const ok = await ensureQuarantineTable(env);
  if (!ok) return 0;
  try {
    const r = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM quarantine WHERE project_id = ? AND status = 'held'`
    ).bind(pid).first();
    return (r && r.n) || 0;
  } catch (e) { return 0; }
}

// How many documents a tenant has had parked recently. Three or more is the
// signal P1 agreed to report to the AETRAA Admin: a tenant may be filing a
// second project into the one it pays for. A report only, never a block.
export const TENANT_WARN_AT = 3;
export async function heldByTenant(env, days = 90) {
  const ok = await ensureQuarantineTable(env);
  if (!ok) return [];
  const since = new Date(Date.now() - days * 86400000).toISOString();
  try {
    const { results } = await env.DB.prepare(
      `SELECT org_id, COUNT(*) AS held FROM quarantine
        WHERE org_id IS NOT NULL AND held_at >= ? GROUP BY org_id ORDER BY held DESC`
    ).bind(since).all();
    return (results || []).map((r) => ({ org_id: r.org_id, held: Number(r.held) || 0,
      warn: (Number(r.held) || 0) >= TENANT_WARN_AT }));
  } catch (e) { return []; }
}

