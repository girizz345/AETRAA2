// Access codes, and what each one is allowed to touch.
//
// A project can hand out as many codes as it needs. Each one carries a scope —
// the trade groups and trades it covers — and the server enforces that scope on
// every read and every write. A discipline engineer does not merely have the
// other discipline hidden from him; the server refuses it.
//
// Scope is resolved from the database on each request rather than carried in the
// cookie, so revoking a code takes effect on that person's next tap.

export const ROLES = {
  manager: { label: 'Project manager', scoped: false, dashboard: true, submit: true, review: true },
  lead:    { label: 'Discipline engineer', scoped: true, dashboard: true, submit: true, review: false },
  site:    { label: 'Site team', scoped: true, dashboard: false, submit: true, review: false },
  view:    { label: 'Read-only', scoped: true, dashboard: true, submit: false, review: false },
};

// D1 caps how many values a single statement may bind, and a programme of a few
// thousand activities runs straight past it. Every query that takes a list of
// ids goes through here.
export const CHUNK = 60;
export function chunked(list, size = CHUNK) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

const parse = (v) => {
  if (!v) return [];
  try { const j = JSON.parse(v); return Array.isArray(j) ? j.filter(Boolean).map(String) : []; }
  catch (e) { return []; }
};

export const readScope = (row) => ({
  groups: parse(row && row.scope_groups),
  trades: parse(row && row.scope_trades),
});

// No groups and no trades means the whole project.
export const isFullScope = (scope) =>
  !scope || ((!scope.groups || !scope.groups.length) && (!scope.trades || !scope.trades.length));

export function describeScope(scope) {
  if (isFullScope(scope)) return 'the whole project';
  const bits = [];
  if (scope.groups && scope.groups.length) bits.push(scope.groups.join(', '));
  if (scope.trades && scope.trades.length) {
    bits.push(scope.trades.length + ' named trade' + (scope.trades.length === 1 ? '' : 's'));
  }
  return bits.join(' + ');
}

// A WHERE fragment for the activities table. Returned as sql + args so it can be
// dropped into any query that has the activities table in scope.
export function scopeSql(scope, alias = 'a') {
  if (isFullScope(scope)) return { sql: '1=1', args: [] };
  const parts = [], args = [];
  if (scope.groups && scope.groups.length) {
    parts.push(`COALESCE(${alias}.trade_group,'') IN (${scope.groups.map(() => '?').join(',')})`);
    args.push(...scope.groups);
  }
  if (scope.trades && scope.trades.length) {
    parts.push(`COALESCE(${alias}.trade,'') IN (${scope.trades.map(() => '?').join(',')})`);
    args.push(...scope.trades);
  }
  return { sql: '(' + parts.join(' OR ') + ')', args };
}

export const tradeInScope = (scope, trade, group) => {
  if (isFullScope(scope)) return true;
  if (scope.groups && scope.groups.includes(group || '')) return true;
  if (scope.trades && scope.trades.includes(trade || '')) return true;
  return false;
};

// Which of these activity ids the holder may write to. Anything not returned is
// refused rather than silently dropped.
export async function activitiesInScope(env, pid, scope, ids) {
  if (isFullScope(scope)) return new Set(ids);
  if (!ids.length) return new Set();
  const { sql, args } = scopeSql(scope, 'a');
  const found = new Set();
  for (const slice of chunked(ids, CHUNK - args.length - 1)) {
    const { results } = await env.DB.prepare(
      `SELECT a.id FROM activities a
        WHERE a.project_id = ? AND a.id IN (${slice.map(() => '?').join(',')}) AND ${sql}`
    ).bind(pid, ...slice, ...args).all();
    for (const r of results || []) found.add(r.id);
  }
  return found;
}

/* ------------------------------------------------------------- the codes */

export async function listCodes(env, pid) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, label, role, scope_groups, scope_trades, active, created_at, last_used
         FROM access_codes WHERE project_id = ? ORDER BY active DESC, role, label`
    ).bind(pid).all();
    return (results || []).map((r) => ({
      id: r.id, label: r.label, role: r.role,
      scope: readScope(r),
      scope_text: describeScope(readScope(r)),
      active: !!r.active, created_at: r.created_at, last_used: r.last_used,
    }));
  } catch (err) {
    return null;   // table not there yet
  }
}

export async function getCode(env, aid) {
  try {
    return await env.DB.prepare(
      `SELECT * FROM access_codes WHERE id = ? AND COALESCE(active,1) = 1`
    ).bind(aid).first();
  } catch (err) {
    return null;
  }
}

// Codes are matched by hash, so the database never holds one that could be used.
export async function findByHash(env, hash) {
  try {
    return await env.DB.prepare(
      `SELECT * FROM access_codes WHERE code_hash = ? AND COALESCE(active,1) = 1 LIMIT 1`
    ).bind(hash).first();
  } catch (err) {
    return null;
  }
}

export async function touchCode(env, aid, when) {
  try {
    await env.DB.prepare('UPDATE access_codes SET last_used = ? WHERE id = ?').bind(when, aid).run();
  } catch (e) { /* never worth failing a sign-in over */ }
}

export async function saveCode(env, pid, body, sha256) {
  const label = String(body.label || '').trim().slice(0, 120);
  const role = ROLES[body.role] ? body.role : 'site';
  if (!label) return { error: 'give the code a label, so you know whose it is' };

  const groups = Array.isArray(body.groups) ? body.groups.map((s) => String(s).slice(0, 120)) : [];
  const trades = Array.isArray(body.trades) ? body.trades.map((s) => String(s).slice(0, 120)) : [];
  // A manager is the project's own code and is never scoped.
  const scopeG = role === 'manager' ? [] : groups;
  const scopeT = role === 'manager' ? [] : trades;

  const code = String(body.code || '').trim();
  if (code && code.length < 8) return { error: 'codes need to be at least 8 characters' };

  if (body.id) {
    const existing = await env.DB.prepare('SELECT id FROM access_codes WHERE id = ? AND project_id = ?')
      .bind(String(body.id), pid).first();
    if (!existing) return { error: 'unknown code' };
    const sets = ['label = ?', 'role = ?', 'scope_groups = ?', 'scope_trades = ?'];
    const args = [label, role, JSON.stringify(scopeG), JSON.stringify(scopeT)];
    if (code) { sets.push('code_hash = ?'); args.push(await sha256(code)); }
    if (body.active !== undefined) { sets.push('active = ?'); args.push(body.active ? 1 : 0); }
    await env.DB.prepare(`UPDATE access_codes SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...args, String(body.id)).run();
    return { ok: true, id: String(body.id) };
  }

  if (!code) return { error: 'a new code needs the code itself' };
  const id = 'ac_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  await env.DB.prepare(
    `INSERT INTO access_codes (id, project_id, label, role, scope_groups, scope_trades,
                               code_hash, active, created_at)
     VALUES (?,?,?,?,?,?,?,1,?)`
  ).bind(id, pid, label, role, JSON.stringify(scopeG), JSON.stringify(scopeT),
         await sha256(code), new Date().toISOString()).run();
  return { ok: true, id };
}

export async function deleteCode(env, pid, id) {
  const row = await env.DB.prepare('SELECT id FROM access_codes WHERE id = ? AND project_id = ?')
    .bind(String(id), pid).first();
  if (!row) return { error: 'unknown code' };
  await env.DB.prepare('DELETE FROM access_codes WHERE id = ?').bind(String(id)).run();
  return { ok: true };
}

/* ------------------------------------------------- reviewing a day's work */

// The PM signs off the day, not each line. Progress stays live the moment site
// sends it; this records that somebody in the office has looked at it.
export async function reviewDay(env, pid, day, by, note, undo) {
  if (undo) {
    await env.DB.prepare('DELETE FROM day_review WHERE project_id = ? AND report_date = ?')
      .bind(pid, day).run();
    return { ok: true, reviewed: false };
  }
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO day_review (project_id, report_date, reviewed_by, reviewed_at, note)
     VALUES (?,?,?,?,?)
     ON CONFLICT(project_id, report_date) DO UPDATE SET
       reviewed_by=excluded.reviewed_by, reviewed_at=excluded.reviewed_at, note=excluded.note`
  ).bind(pid, day, String(by || '').slice(0, 120), now, String(note || '').slice(0, 1000)).run();
  return { ok: true, reviewed: true, reviewed_at: now };
}

export async function getReview(env, pid, day) {
  try {
    return await env.DB.prepare(
      'SELECT * FROM day_review WHERE project_id = ? AND report_date = ?'
    ).bind(pid, day).first();
  } catch (err) {
    return undefined;   // not migrated
  }
}

export async function listReviews(env, pid, from, to) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT report_date, reviewed_by, reviewed_at FROM day_review
        WHERE project_id = ? AND report_date BETWEEN ? AND ?`
    ).bind(pid, from, to).all();
    return results || [];
  } catch (err) {
    return null;
  }
}
