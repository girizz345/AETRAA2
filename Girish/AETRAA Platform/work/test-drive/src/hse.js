// THE HSE LOG, AND THE SAFETY REPORT BUILT FROM IT.
//
// The design drew a daily and a weekly HSE report — 108 men on site, 96% PPE
// compliance, 142 days LTI-free, 0 incidents — captioned "Generated from the
// HSE registers — no re-keying." Nothing was behind it. Not one figure came
// from anywhere, and it is a safety record a PM would forward to a client.
//
// Some of it could always have been counted: permits, observations and
// incidents are ordinary records. The rest — men on site, toolbox talks,
// inductions, PPE checks — is nobody's record until somebody writes it down,
// so this module is the place it gets written down.
//
// Nothing here is estimated. A figure nobody has entered comes back as null,
// and the screen shows an em dash rather than a number a client might act on.

import { addColumns } from './db-cols.js';

const nowISO = () => new Date().toISOString();
const today = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);   // the UAE day
const uid = () => 'hse_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const str = (v, n = 400) => String(v == null ? '' : v).slice(0, n);
const int = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Math.round(Number(String(v).replace(/[, ]/g, '')));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const dateOnly = (v) => {
  const s = str(v, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

// A lost-time injury is the one that resets the counter. The incident form
// offers these four; only the last stops the clock.
export const LOST_TIME = 'Lost-time injury';

export async function ensureHseTable(env) {
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS hse_log (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, log_date TEXT NOT NULL,
         men_on_site INTEGER, toolbox_talks INTEGER, toolbox_attended INTEGER,
         inductions INTEGER, ppe_checked INTEGER, ppe_compliant INTEGER,
         notes TEXT, recorded_by TEXT, recorded_at TEXT)`
    ).run();
    await env.DB.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_hse_pd ON hse_log(project_id, log_date)`
    ).run();
    // Step 9: man-hours from the time sheets, when HSE has them.
    // addColumns (db-cols.js): looked up first. A failed SELECT-then-ALTER can
    // leave the column missing on PostgreSQL behind a connection pool.
    await addColumns(env, 'hse_log', [['man_hours', 'REAL']]);
    return true;
  } catch (e) { return false; }
}

// One entry per day per project, replaced if the day is logged again.
export async function saveHseLog(env, pid, body, who) {
  if (!pid) return { error: 'which project?' };
  await ensureHseTable(env);
  const b = body || {};
  const d = dateOnly(b.log_date) || today();

  const checked = int(b.ppe_checked);
  const compliant = int(b.ppe_compliant);
  if (checked !== null && compliant !== null && compliant > checked) {
    return { error: 'more people passed the PPE check than were checked' };
  }
  if (d > today()) return { error: 'the log cannot be for a day that has not happened' };
  const mh = int(b.man_hours), men = int(b.men_on_site);
  if (mh !== null && men !== null && men > 0 && mh > men * 24) return { error: 'more man-hours than the men on site could work in a day' };
  const talks = int(b.toolbox_talks);
  const attended = int(b.toolbox_attended);
  if (talks === 0 && attended) {
    return { error: 'attendance recorded against no toolbox talk' };
  }

  try {
    await env.DB.prepare(`DELETE FROM hse_log WHERE project_id = ? AND log_date = ?`).bind(pid, d).run();
    await env.DB.prepare(
      `INSERT INTO hse_log (id,project_id,log_date,men_on_site,toolbox_talks,toolbox_attended,
                            inductions,ppe_checked,ppe_compliant,notes,recorded_by,recorded_at,man_hours)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(uid(), pid, d, int(b.men_on_site), talks, attended, int(b.inductions),
           checked, compliant, str(b.notes, 2000), str(who, 120), nowISO(), int(b.man_hours)).run();
  } catch (e) { return { error: 'could not save the log' }; }
  return { ok: true, log_date: d };
}

export async function listHseLog(env, pid, from, to) {
  await ensureHseTable(env);
  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM hse_log WHERE project_id = ? AND log_date >= ? AND log_date <= ?
        ORDER BY log_date DESC`
    ).bind(pid, dateOnly(from) || '0000-01-01', dateOnly(to) || '9999-12-31').all();
    return results || [];
  } catch (e) { return []; }
}

export function daysBetween(a, b) {
  const x = Date.parse(a + 'T00:00:00Z'), y = Date.parse(b + 'T00:00:00Z');
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return Math.round((y - x) / 86400000);
}

// Add up a list of logs, keeping null where nothing was ever entered. A sum of
// nothing is not zero — zero men on site is a claim, absence of a record is not.
function total(rows, field) {
  let any = false, sum = 0;
  for (const r of rows) {
    if (r[field] === null || r[field] === undefined) continue;
    any = true; sum += Number(r[field]) || 0;
  }
  return any ? sum : null;
}

// The report. Records supply the permits, observations and incidents; the log
// supplies everything a person has to write down.
export function buildHseReport(opts) {
  const { period, from, to, logs, records, project } = opts;
  // K5 (spec §17): an imported permit is not live, and an imported incident is
  // not in this project's statistics — not even "days since a lost-time injury".
  const recs = (records || []).filter((r) => !r.imported);
  const inWindow = (r) => {
    const d = (r.submitted || (r.created_at || '').slice(0, 10) || '');
    return d && d >= from && d <= to;
  };
  const closed = (r) => /closed|approved|rectified|verified/i.test(r.status || '');

  const permits = recs.filter((r) => r.type === 'ptw');
  const obs = recs.filter((r) => r.type === 'obs');
  const incidents = recs.filter((r) => r.type === 'incident');

  // Days since the last lost-time injury. Never invented: with no incident
  // recorded at all the honest answer is that the count has no start date.
  const lti = incidents
    .filter((r) => String((r.data || {}).Type || '') === LOST_TIME)
    .map((r) => r.submitted || (r.created_at || '').slice(0, 10))
    .filter(Boolean)
    .sort();
  const lastLti = lti.length ? lti[lti.length - 1] : null;

  const checked = total(logs, 'ppe_checked');
  const compliant = total(logs, 'ppe_compliant');

  const stats = [];
  const add = (k, v, note) => stats.push({ k, v, note: note || null });

  if (period === 'daily') {
    const d = logs[0] || {};
    add('Men on site', d.men_on_site === null || d.men_on_site === undefined ? null : d.men_on_site);
    add('Toolbox talks', d.toolbox_talks === null || d.toolbox_talks === undefined ? null : d.toolbox_talks,
        d.toolbox_attended != null ? d.toolbox_attended + ' attended' : null);
    add('PPE compliance',
        (d.ppe_checked && d.ppe_compliant !== null && d.ppe_compliant !== undefined)
          ? Math.round(d.ppe_compliant / d.ppe_checked * 100) + '%' : null,
        d.ppe_checked ? d.ppe_compliant + ' of ' + d.ppe_checked + ' checked' : null);
    add('Permits live', permits.filter((r) => !closed(r)).length);
    add('Observations raised', obs.filter(inWindow).length);
    add('Incidents', incidents.filter(inWindow).length);
  } else {
    add('Days since a lost-time injury',
        lastLti ? daysBetween(lastLti, to) : null,
        lastLti ? 'last was ' + lastLti : 'no lost-time injury has been recorded on this project');
    add('Permits issued', permits.filter(inWindow).length);
    add('Observations', obs.filter(inWindow).length,
        obs.filter(inWindow).filter(closed).length + ' closed');
    add('Near-misses', incidents.filter(inWindow)
        .filter((r) => /near-miss/i.test(String((r.data || {}).Type || ''))).length);
    add('Toolbox talks', total(logs, 'toolbox_talks'),
        total(logs, 'toolbox_attended') === null ? null : total(logs, 'toolbox_attended') + ' attended');
    add('Inductions', total(logs, 'inductions'));
    add('PPE compliance',
        (checked && compliant !== null) ? Math.round(compliant / checked * 100) + '%' : null,
        checked ? compliant + ' of ' + checked + ' checked' : null);
  }

  const missing = stats.filter((s) => s.v === null || s.v === undefined).map((s) => s.k);

  return {
    period, from, to,
    project: (project || {}).name || '',
    stats,
    open_observations: obs.filter((r) => !closed(r)).map((r) => ({
      ref: r.ref, title: r.title,
      risk: (r.data || {}).Risk || '—',
      status: r.status, cls: r.cls,
    })),
    incidents: incidents.filter(inWindow).map((r) => ({
      ref: r.ref, title: r.title, type: (r.data || {}).Type || '—', status: r.status,
    })),
    permits_open: permits.filter((r) => !closed(r)).map((r) => ({
      ref: r.ref, title: r.title, status: r.status, cls: r.cls,
    })),
    days_logged: logs.length,
    // Said plainly at the top of the report, so nobody forwards it believing
    // a blank is a zero.
    missing,
    complete: missing.length === 0,
  };
}

export async function hseReport(env, pid, period, records, project, ref) {
  await ensureHseTable(env);
  const to = dateOnly(ref) || today();
  const from = period === 'weekly'
    ? new Date(Date.parse(to + 'T00:00:00Z') - 6 * 86400000).toISOString().slice(0, 10)
    : to;
  const logs = await listHseLog(env, pid, from, to);
  return buildHseReport({ period, from, to, logs, records, project });
}
