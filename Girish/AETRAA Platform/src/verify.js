// Verifying what site has claimed.
//
// A claim is a number typed on a phone. What makes it evidence is a photograph
// taken at the moment it was claimed, and somebody in the office having looked
// at it. This holds the second half: a queue of claims nobody has checked, and
// the verdict against each.
//
// It is deliberately not a gate. Progress goes live the moment site sends it —
// verification records that a claim was examined, and leaves a trail saying so.

import { chunked, CHUNK } from './access.js';

const OPEN = 'awaiting';

// A claim is outstanding when site's newest update for an activity is newer than
// whatever was last verified against it.
const QUEUE_SQL = `
  SELECT a.id, a.name, a.wbs, a.trade, a.trade_group, a.floor,
         a.planned_start, a.planned_finish,
         u.id AS update_id, u.pct, u.status, u.report_date, u.remarks,
         u.delay_reason, u.submitted_by, u.created_at,
         v.status AS verdict, v.update_id AS verified_update, v.note AS verdict_note,
         v.by AS verdict_by, v.at AS verdict_at,
         (SELECT COUNT(*) FROM photos p
           WHERE p.project_id = a.project_id AND p.activity_id = a.id) AS photos,
         (SELECT MAX(pct) FROM updates
           WHERE project_id = a.project_id AND activity_id = a.id AND id < u.id) AS before_pct
    FROM activities a
    JOIN updates u ON u.project_id = a.project_id AND u.id =
         (SELECT MAX(id) FROM updates
           WHERE project_id = a.project_id AND activity_id = a.id AND source = 'site')
    LEFT JOIN verifications v ON v.project_id = a.project_id AND v.activity_id = a.id
   WHERE a.project_id = ?`;

export async function listQueue(env, pid, opts = {}) {
  const where = [];
  const args = [pid];
  if (opts.scopeSql && opts.scopeSql.sql !== '1=1') {
    where.push(opts.scopeSql.sql);
    args.push(...opts.scopeSql.args);
  }
  if (opts.state === 'awaiting') {
    where.push('(v.update_id IS NULL OR v.update_id < u.id)');
  } else if (opts.state === 'queried') {
    where.push(`v.status = 'queried' AND v.update_id >= u.id`);
  } else if (opts.state === 'verified') {
    where.push(`v.status = 'verified' AND v.update_id >= u.id`);
  }
  if (opts.complete) where.push('COALESCE(u.pct,0) >= 100');

  const { results } = await env.DB.prepare(
    `${QUEUE_SQL}${where.length ? ' AND ' + where.join(' AND ') : ''}
      ORDER BY u.id DESC LIMIT ${Math.min(400, opts.limit || 200)}`
  ).bind(...args).all();

  return (results || []).map((r) => ({
    ...r,
    awaiting: !r.verified_update || r.verified_update < r.update_id,
    // A verdict only stands for the claim it was given against. Site reporting
    // again puts the activity back in the queue, which is the point.
    verdict: (!r.verified_update || r.verified_update < r.update_id) ? OPEN : r.verdict,
  }));
}

// Photos for a set of activities, newest first, so the queue can show the proof
// beside the claim rather than making somebody go and look for it.
export async function photosFor(env, pid, ids, perActivity = 6) {
  if (!ids.length) return {};
  const out = {};
  for (const slice of chunked(ids)) {
    const { results } = await env.DB.prepare(
      `SELECT id, activity_id, report_date, caption, submitted_by, created_at
         FROM photos WHERE project_id = ? AND activity_id IN (${slice.map(() => '?').join(',')})
        ORDER BY created_at DESC LIMIT 400`
    ).bind(pid, ...slice).all();
    for (const p of results || []) {
      (out[p.activity_id] || (out[p.activity_id] = []));
      if (out[p.activity_id].length < perActivity) out[p.activity_id].push(p);
    }
  }
  return out;
}

export async function setVerdict(env, pid, body, who) {
  const activity_id = String(body.activity_id || '').slice(0, 60);
  const status = body.status === 'queried' ? 'queried' : 'verified';
  if (!activity_id) return { error: 'which activity?' };
  if (status === 'queried' && !String(body.note || '').trim()) {
    return { error: 'say what is wrong with it, so site knows what to fix' };
  }

  // Verify the claim as it stands now, not whatever was on screen a moment ago.
  const latest = await env.DB.prepare(
    `SELECT MAX(id) AS id FROM updates
      WHERE project_id = ? AND activity_id = ? AND source = 'site'`
  ).bind(pid, activity_id).first();
  if (!latest || !latest.id) return { error: 'site has not claimed anything on that activity' };

  const cur = await env.DB.prepare(
    'SELECT pct FROM updates WHERE id = ?'
  ).bind(latest.id).first();

  await env.DB.prepare(
    `INSERT INTO verifications (project_id, activity_id, update_id, pct, status, by, at, note)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(project_id, activity_id) DO UPDATE SET
       update_id=excluded.update_id, pct=excluded.pct, status=excluded.status,
       by=excluded.by, at=excluded.at, note=excluded.note`
  ).bind(
    pid, activity_id, latest.id, cur ? cur.pct : null, status,
    String(who || '').slice(0, 120), new Date().toISOString(),
    String(body.note || '').slice(0, 2000)
  ).run();

  return { ok: true, activity_id, status, update_id: latest.id };
}

// Counts for the badge and for the report, in one pass.
export async function verifyCounts(env, pid, scopeSql) {
  const extra = scopeSql && scopeSql.sql !== '1=1' ? ' AND ' + scopeSql.sql : '';
  const args = [pid, ...(scopeSql && scopeSql.sql !== '1=1' ? scopeSql.args : [])];
  try {
    const row = await env.DB.prepare(
      `SELECT
         SUM(CASE WHEN v.update_id IS NULL OR v.update_id < u.id THEN 1 ELSE 0 END) AS awaiting,
         SUM(CASE WHEN v.update_id >= u.id AND v.status = 'verified' THEN 1 ELSE 0 END) AS verified,
         SUM(CASE WHEN v.update_id >= u.id AND v.status = 'queried' THEN 1 ELSE 0 END) AS queried,
         SUM(CASE WHEN (v.update_id IS NULL OR v.update_id < u.id) AND COALESCE(u.pct,0) >= 100
                  THEN 1 ELSE 0 END) AS awaiting_complete
       FROM activities a
       JOIN updates u ON u.project_id = a.project_id AND u.id =
            (SELECT MAX(id) FROM updates
              WHERE project_id = a.project_id AND activity_id = a.id AND source = 'site')
       LEFT JOIN verifications v ON v.project_id = a.project_id AND v.activity_id = a.id
      WHERE a.project_id = ?${extra}`
    ).bind(...args).first();
    return {
      awaiting: (row && row.awaiting) || 0,
      verified: (row && row.verified) || 0,
      queried: (row && row.queried) || 0,
      awaiting_complete: (row && row.awaiting_complete) || 0,
    };
  } catch (err) {
    return null;   // not migrated
  }
}

// What site needs to know: which of their activities came back queried, and why.
export async function verdictsFor(env, pid, ids) {
  if (!ids.length) return {};
  try {
    const out = {};
    for (const slice of chunked(ids)) {
      const { results } = await env.DB.prepare(
        `SELECT v.activity_id, v.status, v.note, v.by, v.at, v.update_id,
                (SELECT MAX(id) FROM updates
                  WHERE project_id = v.project_id AND activity_id = v.activity_id AND source = 'site') AS latest
           FROM verifications v
          WHERE v.project_id = ? AND v.activity_id IN (${slice.map(() => '?').join(',')})`
      ).bind(pid, ...slice).all();
      for (const r of results || []) {
        // A verdict given against an older claim is spent — site has answered it.
        if (r.latest && r.update_id < r.latest) continue;
        out[r.activity_id] = { status: r.status, note: r.note, by: r.by, at: r.at };
      }
    }
    return out;
  } catch (err) {
    return {};
  }
}

// How many photographs each of these activities carries — what turns a number
// into a claim somebody can check.
export async function photoCounts(env, pid, ids) {
  if (!ids.length) return {};
  const out = {};
  for (const slice of chunked(ids)) {
    const { results } = await env.DB.prepare(
      `SELECT activity_id, COUNT(*) AS n FROM photos
        WHERE project_id = ? AND activity_id IN (${slice.map(() => '?').join(',')})
        GROUP BY activity_id`
    ).bind(pid, ...slice).all();
    for (const r of results || []) out[r.activity_id] = r.n;
  }
  return out;
}

// The rule: an activity cannot be claimed complete without a photograph of it.
export async function missingProof(env, pid, ids) {
  if (!ids.length) return [];
  const counts = await photoCounts(env, pid, ids);
  return ids.filter((id) => !counts[id]);
}
