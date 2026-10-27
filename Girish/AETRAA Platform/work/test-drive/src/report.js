// Daily and monthly progress reports.
//
// One code path builds the report for all three uses — the Reports page, the
// Download PDF button (the page prints itself), and the evening email. Every
// style is inline so the same HTML survives an email client, which strips
// stylesheets. It reads what is already in the database; nothing new is asked
// of site.

import { sCurve, lookAhead, registers, drawingsIssued, diaryCompliance, RECORD_LABEL } from './report-extras.js';
import { actionsSummary } from './meetings.js';
import { hseFigures } from './hse-monthly.js';

const NAVY = '#212d51';
const CYAN = '#17b9e4';
const RED = '#c8322b';
const AMBER = '#b6761d';
const GREEN = '#1f7a4d';
const INK = '#1b2437';
const MUTED = '#6a7590';
const RULE = '#e3e9f2';
const SURFACE = '#f5f8fc';

const esc = (v) =>
  String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

const dnum = (d) => (d && DATE_RE.test(d) ? Date.parse(d + 'T00:00:00Z') / 86400000 : null);
const dstr = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
const shiftDays = (d, n) => dstr(dnum(d) + n);

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

function prettyDate(d) {
  if (!d || !DATE_RE.test(d)) return d || '';
  const [y, m, day] = d.split('-');
  return `${Number(day)} ${MONTHS[Number(m) - 1].slice(0, 3)} ${y}`;
}
function prettyMonth(mk) {
  const [y, m] = mk.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}
const monthEnd = (mk) => {
  const [y, m] = mk.split('-').map(Number);
  return `${mk}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
};

// The Monday–Sunday week a date falls in. Site reports by the day, so a weekly
// report is just a seven-day window laid over the same records.
function weekRange(day) {
  const base = DATE_RE.test(day) ? day : todayUAE();
  const dow = new Date(base + 'T00:00:00Z').getUTCDay();   // 0 Sun … 6 Sat
  const from = shiftDays(base, -((dow + 6) % 7));           // back to Monday
  return { from, to: shiftDays(from, 6) };
}

const todayUAE = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);

const pc = (v, dp = 1) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(dp) + '%');
const n0 = (v) => (Number.isFinite(v) ? Math.round(v).toLocaleString('en-GB') : '0');

const STATUS_LABEL = {
  not_started: 'Not started', in_progress: 'In progress', complete: 'Complete',
  at_risk: 'At risk', delayed: 'Delayed', on_hold: 'On hold',
};
const FLAGGED = ['delayed', 'at_risk', 'on_hold'];

/* ------------------------------------------------------------- gathering */

// Where every activity stood as at the end of a given date, from what had been
// reported by then. Later corrections to earlier dates are respected, because
// the newest row wins within the cut-off.
async function snapshotAsAt(env, pid, asAt) {
  const { results } = await env.DB.prepare(
    `SELECT a.id, u.pct, u.status, u.report_date, u.actual_start, u.actual_finish
       FROM activities a
       LEFT JOIN updates u ON u.project_id = a.project_id AND u.id =
            (SELECT MAX(id) FROM updates
              WHERE project_id = a.project_id AND activity_id = a.id AND report_date <= ?)
      WHERE a.project_id = ? AND COALESCE(a.level,1) >= 1`
  ).bind(asAt, pid).all();
  const map = {};
  for (const r of results || []) map[r.id] = r;
  return map;
}

// Site activities only by default. The drawings, submittals and orders the
// programme derives for itself (source = 'derived') are deadlines, not work,
// so they stay out of percent complete — the look-ahead asks for them.
async function activityIndex(env, pid, withDerived = false) {
  let results;
  try {
    ({ results } = await env.DB.prepare(
      `SELECT id, name, wbs, trade, trade_group, floor, discipline, weight,
              planned_start, planned_finish, source, kind, work_starts
         FROM activities WHERE project_id = ? AND COALESCE(level,1) >= 1`
    ).bind(pid).all());
  } catch (e) {
    // An older database without the derived-activity columns.
    ({ results } = await env.DB.prepare(
      `SELECT id, name, wbs, trade, trade_group, floor, discipline, weight,
              planned_start, planned_finish
         FROM activities WHERE project_id = ? AND COALESCE(level,1) >= 1`
    ).bind(pid).all());
  }
  const map = {};
  for (const r of results || []) {
    if (!withDerived && r.source === 'derived') continue;
    map[r.id] = r;
  }
  return map;
}

// Weighted percent complete across the programme, and where the programme said
// we should be on that date. Weight falls back to duration, as on the dashboard.
function rollUp(acts, snap, asAt) {
  const at = dnum(asAt);
  let earned = 0, weight = 0, planned = 0, done = 0, total = 0;
  for (const a of Object.values(acts)) {
    const ps = dnum(a.planned_start), pf = dnum(a.planned_finish);
    const w = a.weight && a.weight > 0 ? a.weight : (ps !== null && pf !== null ? Math.max(1, pf - ps + 1) : 1);
    const s = snap[a.id] || {};
    const pct = Number.isFinite(s.pct) ? s.pct : 0;
    earned += pct * w;
    weight += w;
    total++;
    if (pct >= 100) done++;
    let f = 0;
    if (ps === null || pf === null) f = 0;
    else if (at >= pf) f = 1;
    else if (at <= ps) f = 0;
    else f = (at - ps) / Math.max(1, pf - ps);
    planned += f * 100 * w;
  }
  return {
    pct: weight ? earned / weight : 0,
    planned: weight ? planned / weight : 0,
    done, total,
  };
}

async function targetLines(env, pid, asAt) {
  const { results } = await env.DB.prepare(
    `SELECT t.activity_id, t.target_group, t.work, t.level, t.days_left, t.target_finish,
            a.name, a.trade,
            u.pct, u.status, u.report_date
       FROM targets t
       LEFT JOIN activities a ON a.project_id = t.project_id AND a.id = t.activity_id
       LEFT JOIN updates u ON u.project_id = t.project_id AND u.id =
            (SELECT MAX(id) FROM updates
              WHERE project_id = t.project_id AND activity_id = t.activity_id AND report_date <= ?)
      WHERE t.project_id = ?`
  ).bind(asAt, pid).all();
  return results || [];
}

/* ------------------------------------------------------------ the daily */

// The register, read as at a date. Kept here rather than imported so a database
// without the issues table simply reports nothing instead of failing the report.
async function issuesAsAt(env, pid, asAt) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT i.*, a.name AS activity_name FROM issues i
         LEFT JOIN activities a ON a.project_id = i.project_id AND a.id = i.activity_id
        WHERE i.project_id = ? AND i.raised_date <= ? ORDER BY i.raised_date DESC LIMIT 800`
    ).bind(pid, asAt).all();
    return results || [];
  } catch (err) {
    return null;   // not migrated yet
  }
}
const ISSUE_OPEN = ['draft', 'issued'];

// How much of what site claimed has anybody in the office actually looked at.
async function verifyAsAt(env, pid, asAt) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT u.activity_id, u.pct, v.status AS verdict, v.update_id AS verified_update, u.id AS update_id
         FROM activities a
         JOIN updates u ON u.project_id = a.project_id AND u.id =
              (SELECT MAX(id) FROM updates
                WHERE project_id = a.project_id AND activity_id = a.id
                  AND source = 'site' AND report_date <= ?)
         LEFT JOIN verifications v ON v.project_id = a.project_id AND v.activity_id = a.id
        WHERE a.project_id = ?`
    ).bind(asAt, pid).all();
    return results || [];
  } catch (err) {
    return null;
  }
}
const ISSUE_TYPE_LABEL = {
  rfi: 'Information required', drawing: 'Drawing discrepancy', access: 'Access not available',
  material: 'Material or approval', instruction: 'Instruction required',
  inspection: 'Inspection request', other: 'Other',
};

async function buildDaily(env, pid, project, day) {
  const prev = shiftDays(day, -1);
  const [acts, snap, snapPrev, tgt, todayRows, mpToday, mpPrev, photoRows, issues, checks] = await Promise.all([
    activityIndex(env, pid),
    snapshotAsAt(env, pid, day),
    snapshotAsAt(env, pid, prev),
    targetLines(env, pid, day),
    env.DB.prepare(
      `SELECT u.activity_id, u.pct, u.status, u.delay_reason, u.remarks, u.submitted_by,
              u.actual_start, u.actual_finish, u.created_at
         FROM updates u
        WHERE u.project_id = ? AND u.report_date = ? AND u.source = 'site'
        ORDER BY u.id`
    ).bind(pid, day).all(),
    env.DB.prepare(
      `SELECT trade, headcount, plant, submitted_by FROM manpower
        WHERE project_id = ? AND report_date = ? ORDER BY headcount DESC, trade`
    ).bind(pid, day).all(),
    env.DB.prepare(
      `SELECT SUM(headcount) AS n FROM manpower WHERE project_id = ? AND report_date = ?`
    ).bind(pid, prev).first(),
    env.DB.prepare(
      `SELECT id, activity_id, caption, submitted_by FROM photos
        WHERE project_id = ? AND report_date = ? ORDER BY created_at LIMIT 60`
    ).bind(pid, day).all(),
    issuesAsAt(env, pid, day),
    verifyAsAt(env, pid, day),
  ]);

  const now = rollUp(acts, snap, day);
  const was = rollUp(acts, snapPrev, day);

  // One line per activity touched today — the newest entry wins if it was sent twice.
  const byAct = {};
  for (const r of todayRows.results || []) byAct[r.activity_id] = r;

  const moved = [], flagged = [], completed = [];
  for (const [id, r] of Object.entries(byAct)) {
    const a = acts[id];
    if (!a) continue;
    const before = (snapPrev[id] || {}).pct;
    const row = {
      id, name: a.name, trade: a.trade || '', floor: a.floor || '',
      before: Number.isFinite(before) ? before : null,
      after: Number.isFinite(r.pct) ? r.pct : null,
      status: r.status || '', delay_reason: r.delay_reason || '',
      remarks: r.remarks || '', by: r.submitted_by || '',
      actual_start: r.actual_start, actual_finish: r.actual_finish,
    };
    moved.push(row);
    if (FLAGGED.includes(r.status)) flagged.push(row);
    if (row.after >= 100 && !(row.before >= 100)) completed.push(row);
  }
  moved.sort((x, y) => (y.after - y.before || 0) - (x.after - x.before || 0));

  // How many photographs stand behind each claim — the column that turns the
  // table from a list of numbers into something somebody can check.
  if (moved.length) {
    const ids = moved.map((r) => r.id).slice(0, 300);
    try {
      const counts = {};
      for (let i = 0; i < ids.length; i += 60) {
        const slice = ids.slice(i, i + 60);
        const { results } = await env.DB.prepare(
          `SELECT activity_id, COUNT(*) AS n FROM photos
            WHERE project_id = ? AND activity_id IN (${slice.map(() => '?').join(',')})
            GROUP BY activity_id`
        ).bind(pid, ...slice).all();
        for (const r of results || []) counts[r.activity_id] = r.n;
      }
      for (const r of moved) r.photos = counts[r.id] || 0;
    } catch (e) { /* photos are optional */ }
  }

  // Target lines: what fell due, what was cleared today, what is now overdue.
  const dn = dnum(day);
  const tOpen = [], tMissed = [], tClearedToday = [], tDueSoon = [];
  for (const t of tgt) {
    const done = Number.isFinite(t.pct) && t.pct >= 100;
    const fin = dnum(t.target_finish);
    if (done) {
      const before = (snapPrev[t.activity_id] || {}).pct;
      if (!(Number.isFinite(before) && before >= 100)) tClearedToday.push(t);
      continue;
    }
    tOpen.push(t);
    if (fin !== null && fin < dn) tMissed.push(t);
    else if (fin !== null && fin - dn <= 7) tDueSoon.push(t);
  }
  tMissed.sort((a, b) => String(a.target_finish).localeCompare(String(b.target_finish)));

  const manpower = mpToday.results || [];
  const headcount = manpower.reduce((s, r) => s + (r.headcount || 0), 0);
  const headcountPrev = (mpPrev && mpPrev.n) || 0;

  // Trades that had open work but sent nothing today — the silence worth chasing.
  const openByTrade = {}, reportedTrades = new Set();
  for (const a of Object.values(acts)) {
    const s = snap[a.id] || {};
    if (Number.isFinite(s.pct) && s.pct >= 100) continue;
    const t = a.trade || '';
    if (!t) continue;
    openByTrade[t] = (openByTrade[t] || 0) + 1;
  }
  for (const r of moved) if (r.trade) reportedTrades.add(r.trade);
  for (const r of manpower) if (r.trade) reportedTrades.add(r.trade);
  const silent = Object.entries(openByTrade)
    .filter(([t]) => !reportedTrades.has(t))
    .sort((a, b) => b[1] - a[1]).slice(0, 12);

  return {
    kind: 'daily', key: day, project,
    title: `Daily progress report — ${prettyDate(day)}`,
    now, was, moved, flagged, completed,
    target: {
      name: project.target_name || '', deadline: project.target_deadline || '',
      total: tgt.length, open: tOpen.length, cleared: tgt.length - tOpen.length,
      missed: tMissed.length, dueSoon: tDueSoon.length,
      clearedToday: tClearedToday, missedList: tMissed.slice(0, 25),
    },
    manpower, headcount, headcountPrev,
    photos: photoRows.results || [],
    silent,
    verify: checks === null ? null : (() => {
      const open = checks.filter((c) => !c.verified_update || c.verified_update < c.update_id);
      return {
        total: checks.length,
        awaiting: open.length,
        awaiting_complete: open.filter((c) => (c.pct || 0) >= 100).length,
        queried: checks.filter((c) => c.verified_update >= c.update_id && c.verdict === 'queried').length,
        verified: checks.filter((c) => c.verified_update >= c.update_id && c.verdict === 'verified').length,
      };
    })(),
    issues: issues === null ? null : {
      raisedToday: issues.filter((i) => i.raised_date === day),
      issuedToday: issues.filter((i) => i.issued_date === day),
      answeredToday: issues.filter((i) => i.answered_date === day),
      unissued: issues.filter((i) => i.status === 'draft'),
      overdue: issues.filter((i) => ISSUE_OPEN.includes(i.status) && i.reply_due && dnum(i.reply_due) < dn)
        .sort((a, b) => String(a.reply_due).localeCompare(String(b.reply_due))),
      open: issues.filter((i) => ISSUE_OPEN.includes(i.status)),
    },
  };
}

/* ---------------------------------------------------------- the monthly */

// One builder for any date window — the monthly and the weekly both come
// through here, differing only in the from/to they pass and how they are titled.
async function buildRange(env, pid, project, from, periodTo, kind, key, title) {
  const before = shiftDays(from, -1);
  // A week or month still running is reported to today, not to its last day —
  // otherwise the plan line runs ahead to a date site has not reached yet.
  const today = todayUAE();
  const to = periodTo > today ? (today < from ? from : today) : periodTo;

  const [acts, snapEnd, snapStart, tgt, mpRows, flagRows, disc, photoCount, issueRows] = await Promise.all([
    activityIndex(env, pid),
    snapshotAsAt(env, pid, to),
    snapshotAsAt(env, pid, before),
    targetLines(env, pid, to),
    env.DB.prepare(
      `SELECT report_date, trade, SUM(headcount) AS n FROM manpower
        WHERE project_id = ? AND report_date BETWEEN ? AND ?
        GROUP BY report_date, trade`
    ).bind(pid, from, to).all(),
    env.DB.prepare(
      `SELECT u.activity_id, u.status, u.delay_reason, u.remarks, u.report_date
         FROM updates u
        WHERE u.project_id = ? AND u.report_date BETWEEN ? AND ?
          AND u.status IN ('delayed','at_risk','on_hold')
          AND u.id = (SELECT MAX(id) FROM updates
                        WHERE project_id = u.project_id AND activity_id = u.activity_id
                          AND report_date <= ?)
        ORDER BY u.report_date`
    ).bind(pid, from, to, to).all(),
    env.DB.prepare(
      `SELECT COUNT(DISTINCT report_date) AS days, COUNT(*) AS entries
         FROM updates WHERE project_id = ? AND source = 'site' AND report_date BETWEEN ? AND ?`
    ).bind(pid, from, to).first(),
    env.DB.prepare(
      `SELECT COUNT(*) AS n FROM photos WHERE project_id = ? AND report_date BETWEEN ? AND ?`
    ).bind(pid, from, to).first(),
    issuesAsAt(env, pid, to),
  ]);

  const now = rollUp(acts, snapEnd, to);
  const was = rollUp(acts, snapStart, before);

  const completed = [], started = [];
  for (const a of Object.values(acts)) {
    const e = snapEnd[a.id] || {}, s = snapStart[a.id] || {};
    const ep = Number.isFinite(e.pct) ? e.pct : 0;
    const sp = Number.isFinite(s.pct) ? s.pct : 0;
    if (ep >= 100 && sp < 100) completed.push({ ...a, pct: ep });
    else if (ep > 0 && sp === 0) started.push({ ...a, pct: ep });
  }

  // Where the work sits by trade group, worst first.
  const groups = {};
  for (const t of tgt) {
    const g = t.target_group || 'Ungrouped';
    const row = groups[g] || (groups[g] = { group: g, total: 0, cleared: 0, open: 0, missed: 0, days: 0 });
    row.total++;
    const done = Number.isFinite(t.pct) && t.pct >= 100;
    if (done) row.cleared++;
    else {
      row.open++;
      row.days += t.days_left || 0;
      if (t.target_finish && dnum(t.target_finish) < dnum(to)) row.missed++;
    }
  }
  const groupRows = Object.values(groups).sort((a, b) => b.missed - a.missed || b.open - a.open);

  // Manpower across the month: peak day, average worked day, man-days by trade.
  const byDay = {}, byTrade = {};
  for (const r of mpRows.results || []) {
    byDay[r.report_date] = (byDay[r.report_date] || 0) + (r.n || 0);
    byTrade[r.trade] = (byTrade[r.trade] || 0) + (r.n || 0);
  }
  const dayList = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0]));
  const peak = dayList.reduce((m, d) => (d[1] > (m[1] || 0) ? d : m), ['', 0]);
  const manDays = dayList.reduce((s, d) => s + d[1], 0);
  const tradeDays = Object.entries(byTrade).sort((a, b) => b[1] - a[1]);

  // Delay reasons, biggest first — this is the narrative a monthly needs.
  const reasons = {};
  for (const r of flagRows.results || []) {
    const key = r.delay_reason || 'No reason given';
    (reasons[key] || (reasons[key] = [])).push(r);
  }
  const reasonRows = Object.entries(reasons)
    .map(([reason, list]) => ({
      reason, n: list.length,
      examples: list.slice(0, 4).map((r) => ({
        id: r.activity_id,
        name: (acts[r.activity_id] || {}).name || r.activity_id,
        status: r.status, remarks: r.remarks || '', date: r.report_date,
      })),
    }))
    .sort((a, b) => b.n - a.n);

  const daysInMonth = dnum(to) - dnum(from) + 1;

  // STEP 4 — the sections worked out from the programme, the registers and the
  // diary. Each is on its own: one that fails leaves a note, not a blank report.
  const safe = async (name, fn) => {
    try { return await fn(); } catch (e) { console.error('report section ' + name + ' failed:', (e && e.message) || e); return undefined; }
  };
  const allActs = await safe('activities', () => activityIndex(env, pid, true)) || acts;
  const [curve, look, regs, drawings, diary, actions, hse] = await Promise.all([
    safe('s-curve', () => sCurve(env, pid, acts, to)),
    safe('look-ahead', () => lookAhead(allActs, snapEnd, to, 21)),
    safe('registers', () => registers(env, pid, from, to)),
    safe('drawings', () => drawingsIssued(env, pid, from, to)),
    safe('diary', () => diaryCompliance(env, pid, project, from, to, today)),
    safe('actions', () => actionsSummary(env, pid, from, to)),
    safe('hse', () => hseFigures(env, pid, project, from, periodTo)),
  ]);

  return {
    kind, key, project, title,
    from, to, periodTo, running: to < periodTo, now, was,
    curve, look, regs, drawings, diary, actions, hse,
    completed: completed.sort((a, b) => String(a.wbs || '').localeCompare(String(b.wbs || ''))),
    started,
    target: {
      name: project.target_name || '', deadline: project.target_deadline || '',
      total: tgt.length,
      cleared: tgt.filter((t) => Number.isFinite(t.pct) && t.pct >= 100).length,
      missed: tgt.filter((t) => !(Number.isFinite(t.pct) && t.pct >= 100) &&
                                t.target_finish && dnum(t.target_finish) < dnum(to)).length,
      groups: groupRows,
    },
    manpower: { peakDay: peak[0], peak: peak[1], manDays, daysWorked: dayList.length, tradeDays },
    reasons: reasonRows,
    discipline: {
      daysReported: (disc && disc.days) || 0,
      entries: (disc && disc.entries) || 0,
      daysInMonth,
    },
    photos: (photoCount && photoCount.n) || 0,
    issues: issueRows === null ? null : (() => {
      const inMonth = issueRows.filter((i) => i.raised_date >= from && i.raised_date <= to);
      const open = issueRows.filter((i) => ISSUE_OPEN.includes(i.status));
      const byType = {};
      for (const i of issueRows) {
        const k = i.type || 'other';
        const r = byType[k] || (byType[k] = { type: k, raised: 0, open: 0, overdue: 0, days: 0, oldest: 0 });
        r.raised++;
        if (ISSUE_OPEN.includes(i.status)) {
          r.open++;
          r.days += i.impact_days || 0;
          r.oldest = Math.max(r.oldest, (dnum(to) - dnum(i.raised_date)) || 0);
          if (i.reply_due && dnum(i.reply_due) < dnum(to)) r.overdue++;
        }
      }
      // How long a reply actually takes, from the ones that came back. The number
      // that tells you whether chasing is working.
      const answered = issueRows.filter((i) => i.issued_date && i.answered_date);
      const turnaround = answered.length
        ? answered.reduce((s, i) => s + (dnum(i.answered_date) - dnum(i.issued_date)), 0) / answered.length
        : null;
      return {
        raisedThisMonth: inMonth.length,
        closedThisMonth: issueRows.filter((i) => i.closed_date >= from && i.closed_date <= to).length,
        open: open.length,
        overdue: open.filter((i) => i.reply_due && dnum(i.reply_due) < dnum(to)).length,
        unissued: open.filter((i) => i.status === 'draft').length,
        impactDays: Math.round(open.reduce((s, i) => s + (i.impact_days || 0), 0) * 10) / 10,
        turnaround,
        oldest: open.length ? Math.max(...open.map((i) => (dnum(to) - dnum(i.raised_date)) || 0)) : null,
        byType: Object.values(byType).sort((a, b) => b.open - a.open || b.raised - a.raised),
        worst: open.sort((a, b) => (dnum(a.raised_date) || 0) - (dnum(b.raised_date) || 0)).slice(0, 15),
      };
    })(),
  };
}

async function buildMonthly(env, pid, project, mk) {
  return buildRange(env, pid, project, `${mk}-01`, monthEnd(mk), 'monthly', mk,
    `Monthly progress report — ${prettyMonth(mk)}`);
}

async function buildWeekly(env, pid, project, day) {
  const { from, to } = weekRange(day);
  return buildRange(env, pid, project, from, to, 'weekly', from,
    `Weekly progress report — ${prettyDate(from)} to ${prettyDate(to)}`);
}

// The two short reports on the planner's dashboard: what is coming in the
// next three weeks, and where the programme stands today.
async function buildSnapshot(env, pid, project, kind, day) {
  const today = todayUAE();
  const asAt = day > today ? today : day;
  const [acts, allActs, snap] = await Promise.all([
    activityIndex(env, pid), activityIndex(env, pid, true), snapshotAsAt(env, pid, asAt),
  ]);
  const base = { kind, key: asAt, to: asAt, project };
  if (kind === 'lookahead') {
    return { ...base, title: `Three-week look-ahead — from ${prettyDate(asAt)}`,
      look: lookAhead(allActs, snap, asAt, 21), total: Object.keys(acts).length };
  }
  const now = rollUp(acts, snap, asAt);
  let curve;
  try { curve = await sCurve(env, pid, acts, asAt); } catch (e) { curve = undefined; }
  // Activities running late against their planned finish, worst first.
  const late = Object.values(acts).filter((a) => {
    const p = (snap[a.id] || {}).pct;
    return a.planned_finish && a.planned_finish < asAt && !(Number.isFinite(p) && p >= 100);
  }).map((a) => ({ name: a.name, discipline: a.discipline || a.trade || '', finish: a.planned_finish,
    pct: Number.isFinite((snap[a.id] || {}).pct) ? snap[a.id].pct : 0, days: dnum(asAt) - dnum(a.planned_finish) }))
    .sort((x, y) => y.days - x.days);
  return { ...base, title: `Programme status — ${prettyDate(asAt)}`, now, curve, late };
}

// Any from–to window — the progress report that goes with an IPC for its period.
export async function buildPeriodReport(env, pid, project, from, to) {
  if (!DATE_RE.test(from || '') || !DATE_RE.test(to || '') || to < from) throw new Error('a period needs from and to dates');
  return buildRange(env, pid, project, from, to, 'period', from,
    `Progress report — ${prettyDate(from)} to ${prettyDate(to)}`);
}

export async function buildReport(env, pid, project, kind, key) {
  if (kind === 'hse') {
    const mk = MONTH_RE.test(key || '') ? key : todayUAE().slice(0, 7);
    const h = await hseFigures(env, pid, project, mk + '-01', monthEnd(mk), { trend: true });
    return { kind: 'hse', key: mk, project, from: h.from, to: h.to, periodTo: h.periodTo, running: h.running,
      title: `Monthly HSE report — ${prettyMonth(mk)}`, hse: h };
  }
  if (kind === 'lookahead' || kind === 'programme') {
    return await buildSnapshot(env, pid, project, kind, DATE_RE.test(key || '') ? key : todayUAE());
  }
  if (kind === 'monthly') {
    const mk = MONTH_RE.test(key || '') ? key : todayUAE().slice(0, 7);
    return await buildMonthly(env, pid, project, mk);
  }
  if (kind === 'weekly') {
    const day = DATE_RE.test(key || '') ? key : todayUAE();
    return await buildWeekly(env, pid, project, day);
  }
  const day = DATE_RE.test(key || '') ? key : todayUAE();
  return await buildDaily(env, pid, project, day);
}

/* ------------------------------------------------------------ rendering */

const box = `border:1px solid ${RULE};border-radius:10px;`;
const th = `text-align:left;font:600 11px/1.3 Arial,Helvetica,sans-serif;letter-spacing:.04em;` +
           `text-transform:uppercase;color:${MUTED};padding:8px 10px;border-bottom:1px solid ${RULE};`;
const td = `font:400 13px/1.45 Arial,Helvetica,sans-serif;color:${INK};padding:8px 10px;` +
           `border-bottom:1px solid ${RULE};vertical-align:top;`;
const tdr = td + 'text-align:right;white-space:nowrap;';
const h2 = `font:700 16px/1.3 Arial,Helvetica,sans-serif;color:${NAVY};margin:26px 0 10px;`;
const small = `font:400 12px/1.5 Arial,Helvetica,sans-serif;color:${MUTED};`;

const stat = (value, label, color) => ({ value, label, color: color || NAVY });

// A row of figures. Cards share the width evenly, however many there are — so a
// section with four stats does not leave a gap where a fifth would have gone.
function statRow(cards) {
  const w = (100 / cards.length).toFixed(2);
  const cells = cards.map((c) => `<td style="padding:0 6px 0 0;width:${w}%;">
    <div style="${box}background:${SURFACE};padding:12px 14px;">
      <div style="font:700 24px/1.1 Arial,Helvetica,sans-serif;color:${c.color};">${c.value}</div>
      <div style="${small}margin-top:4px;">${esc(c.label)}</div>
    </div></td>`);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin:4px 0 2px;"><tr>${cells.join('')}</tr></table>`;
}

const section = (title) => `<h2 style="${h2}">${esc(title)}</h2>`;

// What the report could not tell you. A quiet zero reads like an empty site; this
// says plainly when it is a gap in the record instead.
function warnBlock(items) {
  if (!items.length) return '';
  return `<div style="${box}border-color:#F0C98C;background:#FFF8EC;padding:12px 14px;margin:16px 0 4px;">
    <div style="font:700 12px/1.3 Arial,Helvetica,sans-serif;color:#8A5A12;letter-spacing:.04em;text-transform:uppercase;">
      What this report cannot tell you</div>
    <ul style="margin:8px 0 0;padding-left:18px;font:400 12.5px/1.6 Arial,Helvetica,sans-serif;color:#6B4A15;">
      ${items.map((t) => `<li>${esc(t)}</li>`).join('')}
    </ul>
  </div>`;
}
const note = (text) => `<p style="${small}margin:0 0 10px;">${esc(text)}</p>`;
const empty = (text) => `<p style="${small}margin:0 0 6px;font-style:italic;">${esc(text)}</p>`;

function table(headers, rows, aligns = []) {
  if (!rows.length) return '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;${box}">
    <tr>${headers.map((h, i) => `<th style="${th}${aligns[i] === 'r' ? 'text-align:right;' : ''}">${esc(h)}</th>`).join('')}</tr>
    ${rows.map((r) => `<tr>${r.map((c, i) => `<td style="${aligns[i] === 'r' ? tdr : td}">${c}</td>`).join('')}</tr>`).join('')}
  </table>`;
}

const delta = (v, dp = 1) => {
  if (!Number.isFinite(v)) return '—';
  const s = v > 0 ? '+' : '';
  const c = v > 0 ? GREEN : v < 0 ? RED : MUTED;
  return `<span style="color:${c};">${s}${v.toFixed(dp)}</span>`;
};

function head(d) {
  const p = d.project || {};
  const label = { daily: 'Daily report', weekly: 'Weekly report', monthly: 'Monthly report',
    lookahead: 'Three-week look-ahead', programme: 'Programme status', period: 'Progress report', hse: 'Monthly HSE report' }[d.kind] || 'Report';
  const when = (d.kind === 'daily' || d.kind === 'lookahead' || d.kind === 'programme') ? prettyDate(d.key)
    : (d.kind === 'weekly' || d.kind === 'period') ? `${prettyDate(d.from)} – ${prettyDate(d.periodTo || d.to)}`
    : prettyMonth(d.key);
  return `<div style="border-bottom:2px solid ${NAVY};padding-bottom:14px;margin-bottom:6px;">
    <div style="font:600 11px/1.3 Arial,Helvetica,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:${CYAN};">
      ${esc(label)}</div>
    <div style="font:700 22px/1.3 Arial,Helvetica,sans-serif;color:${NAVY};margin-top:6px;">${esc(p.name || 'Project')}</div>
    <div style="${small}margin-top:3px;">${esc([p.ref, when].filter(Boolean).join(' · '))}</div>
  </div>`;
}

function renderDaily(d) {
  const gain = d.now.pct - d.was.pct;
  const out = [head(d)];

  out.push(statRow([
    stat(pc(d.now.pct), 'complete, weighted', NAVY),
    stat(delta(gain, 2), 'percentage points today', NAVY),
    stat(n0(d.moved.length), 'activities reported today', d.moved.length ? NAVY : MUTED),
    stat(n0(d.flagged.length), 'flagged by site', d.flagged.length ? RED : GREEN),
    stat(n0(d.headcount), 'men on site', d.headcount ? NAVY : RED),
  ]));
  out.push(note(
    `Against a programme position of ${pc(d.now.planned)} for today — ` +
    `${Math.abs(d.now.pct - d.now.planned).toFixed(1)} points ` +
    `${d.now.pct >= d.now.planned ? 'ahead of' : 'behind'} plan. ` +
    `${n0(d.now.done)} of ${n0(d.now.total)} activities complete.`
  ));

  const warn = [];
  if (!d.moved.length) warn.push('No progress was reported from site at all today. This is a gap in the record, not proof that nothing was built.');
  if (!d.manpower.length) warn.push('No manpower was logged. The zero above means nobody entered it, not that the site was empty.');
  if (d.silent.length >= 5) warn.push(`${d.silent.length} trades with open work sent nothing today — the percentages for those trades are as they were yesterday.`);
  if (!d.target.total) warn.push('No target list is loaded for this project, so there is nothing to report against a fixed date.');
  if (d.verify && d.verify.awaiting_complete) {
    warn.push(`${d.verify.awaiting_complete} activit${d.verify.awaiting_complete === 1 ? 'y is' : 'ies are'} claimed complete but nobody in the office has checked the claim.`);
  }
  if (d.issues === null) warn.push('The issues register is not set up on this project, so RFIs and notices are not shown.');
  else if (d.issues.unissued.length) warn.push(`${d.issues.unissued.length} issue(s) raised on site have not been issued to anyone yet.`);
  if (!d.photos.length) warn.push('No photographs were attached today, so nothing here is evidenced by a picture.');
  out.push(warnBlock(warn));

  if (d.target.total) {
    out.push(section('Target list'));
    out.push(note(
      `${esc(d.target.name || 'Target list')}${d.target.deadline ? ' — due ' + prettyDate(d.target.deadline) : ''}: ` +
      `${n0(d.target.open)} of ${n0(d.target.total)} lines still open, ${n0(d.target.missed)} past their finish-by date, ` +
      `${n0(d.target.dueSoon)} due inside a week.`
    ));
    if (d.target.clearedToday.length) {
      out.push(table(['Cleared today', 'Group', 'Finish by'],
        d.target.clearedToday.slice(0, 20).map((t) => [
          esc(t.name || t.work || t.activity_id), esc(t.target_group || ''), prettyDate(t.target_finish),
        ])));
    }
    if (d.target.missedList.length) {
      out.push(`<div style="height:16px"></div>`);
      out.push(table(['Overdue line', 'Group', 'Finish by', '%'],
        d.target.missedList.map((t) => [
          esc(t.name || t.work || t.activity_id), esc(t.target_group || ''),
          `<span style="color:${RED};">${prettyDate(t.target_finish)}</span>`,
          Number.isFinite(t.pct) ? t.pct.toFixed(0) : '0',
        ]), ['', '', '', 'r']));
      if (d.target.missed > d.target.missedList.length) {
        out.push(note(`Showing the 25 oldest of ${n0(d.target.missed)} overdue lines.`));
      }
    }
  }

  out.push(section('What site reported today'));
  if (!d.moved.length) {
    out.push(empty('No progress was reported from site today.'));
  } else {
    out.push(table(['Activity', 'Trade', 'Floor', 'Was', 'Now', 'Proof', 'Status', 'Remark'],
      d.moved.slice(0, 60).map((r) => [
        esc(r.name), esc(r.trade), esc(r.floor),
        r.before === null ? '—' : r.before.toFixed(0),
        `<b>${r.after === null ? '—' : r.after.toFixed(0)}</b>`,
        r.photos ? `${r.photos} photo${r.photos === 1 ? '' : 's'}`
          : (r.after >= 100 ? `<span style="color:${RED};">none</span>` : '—'),
        r.status
          ? `<span style="color:${FLAGGED.includes(r.status) ? RED : INK};">${esc(STATUS_LABEL[r.status] || r.status)}</span>`
          : '',
        esc(r.remarks || ''),
      ]), ['', '', '', 'r', 'r', 'r', '', '']));
    if (d.moved.length > 60) out.push(note(`Showing 60 of ${n0(d.moved.length)} activities reported.`));
    if (d.verify) {
      out.push(note(
        `${n0(d.verify.verified)} of the project's current claims have been verified by the office, ` +
        `${n0(d.verify.awaiting)} are still to be checked` +
        (d.verify.queried ? `, and ${n0(d.verify.queried)} were queried back to site` : '') + '.'
      ));
    }
  }

  if (d.completed.length) {
    out.push(section('Completed today'));
    out.push(table(['Activity', 'Trade', 'Floor', 'Reported by'],
      d.completed.slice(0, 30).map((r) => [esc(r.name), esc(r.trade), esc(r.floor), esc(r.by)])));
  }

  if (d.flagged.length) {
    out.push(section('Flagged by site'));
    out.push(table(['Activity', 'Status', 'Reason', 'Remark'],
      d.flagged.map((r) => [
        esc(r.name),
        `<span style="color:${RED};">${esc(STATUS_LABEL[r.status] || r.status)}</span>`,
        esc(r.delay_reason || '—'), esc(r.remarks || ''),
      ])));
  }

  out.push(section('Manpower on site'));
  if (!d.manpower.length) {
    out.push(empty('No manpower was logged for this date.'));
  } else {
    out.push(table(['Trade', 'Men', 'Plant / equipment'],
      d.manpower.map((r) => [esc(r.trade), n0(r.headcount), esc(r.plant || '')]), ['', 'r', '']));
    out.push(note(
      `${n0(d.headcount)} on site today against ${n0(d.headcountPrev)} yesterday ` +
      `(${d.headcount - d.headcountPrev >= 0 ? '+' : ''}${d.headcount - d.headcountPrev}).`
    ));
  }

  if (d.silent.length) {
    out.push(section('No report received'));
    out.push(note('Trades that still have open work but sent nothing today — worth a call before tomorrow.'));
    out.push(table(['Trade', 'Activities still open'],
      d.silent.map(([t, n]) => [esc(t), n0(n)]), ['', 'r']));
  }

  const iss = d.issues;
  if (iss && (iss.open.length || iss.raisedToday.length || iss.answeredToday.length)) {
    out.push(section('Issues, RFIs and notices'));
    out.push(note(
      `${n0(iss.open.length)} open. ${n0(iss.unissued.length)} raised on site and not yet issued. ` +
      `${n0(iss.overdue.length)} past the date a reply was due.`
    ));
    if (iss.raisedToday.length) {
      out.push(table(['Raised today', 'Ref', 'Activity', 'By', 'Status'],
        iss.raisedToday.slice(0, 20).map((i) => [
          esc(i.title), `<b>${esc(i.ref)}</b>`, esc(i.activity_name || i.activity_id || '—'),
          esc(i.raised_by || ''),
          i.status === 'draft' ? `<span style="color:${AMBER};">not yet issued</span>` : esc(i.status),
        ])));
    }
    if (iss.overdue.length) {
      out.push(`<div style="height:16px"></div>`);
      out.push(table(['Awaiting a reply past its date', 'Ref', 'Issued', 'Reply was due', 'Days over'],
        iss.overdue.slice(0, 20).map((i) => [
          esc(i.title), `<b>${esc(i.ref)}</b>`, prettyDate(i.issued_date),
          `<span style="color:${RED};">${prettyDate(i.reply_due)}</span>`,
          n0(dnum(d.key) - dnum(i.reply_due)),
        ]), ['', '', '', '', 'r']));
    }
    if (iss.unissued.length) {
      out.push(`<div style="height:16px"></div>`);
      out.push(note(
        `${n0(iss.unissued.length)} item${iss.unissued.length === 1 ? '' : 's'} sitting in the register unissued — ` +
        `the oldest was raised ${n0(Math.max(...iss.unissued.map((i) => dnum(d.key) - dnum(i.raised_date) || 0)))} days ago. ` +
        `Nothing has left the office on ${iss.unissued.length === 1 ? 'it' : 'them'} yet.`
      ));
    }
  }

  if (d.photos.length) {
    out.push(section('Photographs'));
    out.push(note(`${n0(d.photos.length)} photograph${d.photos.length === 1 ? '' : 's'} attached today.`));
    out.push(table(['Activity', 'Caption', 'By'],
      d.photos.slice(0, 25).map((ph) => [esc(ph.activity_id || '—'), esc(ph.caption || ''), esc(ph.submitted_by || '')])));
  }

  return out.join('\n');
}


/* ------------------------------------------------ STEP 4 section renderers */

// The S-curve as an inline SVG — it prints, and it shows on the Reports page and
// in Outlook for Mac / Apple Mail. Gmail and Outlook for Windows drop SVG, so the
// table underneath carries the same numbers for them.
function curveSVG(c, to) {
  const pts = c.points;
  if (pts.length < 2) return '';
  const W = 880, H = 250, L = 44, R = 14, T = 14, B = 34;
  const x0 = dnum(pts[0].date), x1 = dnum(pts[pts.length - 1].date);
  const X = (d) => L + ((dnum(d) - x0) / Math.max(1, x1 - x0)) * (W - L - R);
  const Y = (v) => T + (1 - Math.max(0, Math.min(100, v)) / 100) * (H - T - B);
  const path = (list, key) => list.map((p, i) => (i ? 'L' : 'M') + X(p.date).toFixed(1) + ' ' + Y(p[key]).toFixed(1)).join(' ');
  const act = pts.filter((p) => p.actual !== null);
  const grid = [0, 25, 50, 75, 100].map((v) =>
    `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${RULE}" stroke-width="1"/>` +
    `<text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="10" fill="${MUTED}" font-family="Arial">${v}%</text>`).join('');
  const nt = Math.min(7, pts.length);
  const ticks = [];
  for (let i = 0; i < nt; i++) {
    const p = pts[Math.round(i * (pts.length - 1) / Math.max(1, nt - 1))];
    const anchor = i === 0 ? 'start' : i === nt - 1 ? 'end' : 'middle';     // keep the end labels inside the frame
    ticks.push(`<text x="${X(p.date)}" y="${H - 12}" text-anchor="${anchor}" font-size="10" fill="${MUTED}" font-family="Arial">${esc(prettyDate(p.date))}</text>`);
  }
  const now = `<line x1="${X(to)}" x2="${X(to)}" y1="${T}" y2="${H - B}" stroke="${AMBER}" stroke-width="1" stroke-dasharray="3 3"/>` +
    (X(to) > W * 0.8
      ? `<text x="${X(to) - 4}" y="${H - B - 6}" text-anchor="end" font-size="10" fill="${AMBER}" font-family="Arial">${esc(prettyDate(to))}</text>`
      : `<text x="${X(to) + 4}" y="${H - B - 6}" font-size="10" fill="${AMBER}" font-family="Arial">${esc(prettyDate(to))}</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block;margin:4px 0 6px;" role="img" aria-label="Planned against actual progress">
    ${grid}${ticks.join('')}${now}
    <path d="${path(pts, 'planned')}" fill="none" stroke="${NAVY}" stroke-width="2" stroke-dasharray="6 4"/>
    ${act.length > 1 ? `<path d="${path(act, 'actual')}" fill="none" stroke="${CYAN}" stroke-width="2.5"/>` : ''}
    ${act.length ? `<circle cx="${X(act[act.length - 1].date)}" cy="${Y(act[act.length - 1].actual)}" r="3.5" fill="${CYAN}"/>` : ''}
  </svg>
  <div style="${small}margin:0 0 10px;"><span style="color:${NAVY};">- - -</span> planned &nbsp; <span style="color:${CYAN};font-weight:700;">——</span> actual</div>`;
}

function renderCurve(d, opts) {
  const c = d.curve;
  const out = [section('Planned against actual')];
  if (c === undefined) { out.push(empty('The S-curve could not be worked out for this report.')); return out.join(''); }
  if (!c) { out.push(empty('No programme with planned dates is loaded, so there is no plan to measure against.')); return out.join(''); }
  if (!(opts && opts.noSvg)) out.push(curveSVG(c, d.to));
  const past = c.points.filter((p) => p.date <= d.to);
  const rows = past.slice(-8).map((p) => [
    prettyDate(p.date), pc(p.planned), p.actual === null ? '—' : pc(p.actual),
    p.actual === null ? '—' : delta(p.actual - p.planned),
  ]);
  out.push(table([c.step === 'month' ? 'Month end' : 'Week ending', 'Planned', 'Actual', 'Variance'], rows, ['', 'r', 'r', 'r']));
  const notes = [];
  if (c.first_actual && c.first_actual > c.start) {
    notes.push(`The actual line starts on ${prettyDate(c.first_actual)}, the first progress recorded on the platform; work before that is not on the curve.`);
  }
  if (!c.first_actual) notes.push('No progress has been recorded yet, so there is no actual line.');
  if (c.finish) notes.push(`Programme finish: ${prettyDate(c.finish)}.`);
  if (notes.length) out.push(note(notes.join(' ')));
  return out.join('');
}

function renderLookAhead(d) {
  const l = d.look;
  if (!l) return '';
  const out = [section(`Three-week look-ahead — ${prettyDate(l.from)} to ${prettyDate(l.to)}`)];
  if (!l.starting.length && !l.finishing.length && !l.late.length && !l.needed.length) {
    out.push(empty('Nothing in the programme starts or finishes in the next three weeks.'));
    return out.join('');
  }
  out.push(statRow([
    stat(n0(l.starting.length), 'due to start', NAVY),
    stat(n0(l.finishing.length), 'due to finish', NAVY),
    stat(n0(l.late.length), 'late to start', l.late.length ? RED : GREEN),
    stat(n0(l.needed.filter((x) => x.overdue).length), 'submissions / orders overdue', l.needed.some((x) => x.overdue) ? RED : GREEN),
  ]));
  const cap = 30;
  if (l.starting.length) {
    out.push(`<div style="height:12px"></div>`);
    out.push(table(['Due to start', 'Discipline', 'Floor', 'Starts'],
      l.starting.slice(0, cap).map((a) => [esc(a.name), esc(a.discipline), esc(a.floor), prettyDate(a.start)])));
    if (l.starting.length > cap) out.push(note(`and ${n0(l.starting.length - cap)} more due to start.`));
  }
  if (l.finishing.length) {
    out.push(`<div style="height:12px"></div>`);
    out.push(table(['Due to finish', 'Discipline', 'Now', 'Finish'],
      l.finishing.slice(0, cap).map((a) => [esc(a.name), esc(a.discipline), a.pct.toFixed(0) + '%', prettyDate(a.finish)]), ['', '', 'r', '']));
    if (l.finishing.length > cap) out.push(note(`and ${n0(l.finishing.length - cap)} more due to finish.`));
  }
  if (l.late.length) {
    out.push(`<div style="height:12px"></div>`);
    out.push(table(['Should have started — no progress yet', 'Discipline', 'Planned start', 'Days late'],
      l.late.slice(0, 20).map((a) => [esc(a.name), esc(a.discipline), prettyDate(a.start), `<b style="color:${RED};">${n0(a.days_late)}</b>`]),
      ['', '', '', 'r']));
    if (l.late.length > 20) out.push(note(`Showing the 20 longest overdue of ${n0(l.late.length)}.`));
  }
  if (l.needed.length) {
    out.push(`<div style="height:12px"></div>`);
    out.push(note('Submissions and orders the programme needs before this work can start:'));
    out.push(table(['Item', 'Submit / order by', 'For work starting'],
      l.needed.slice(0, 25).map((a) => [esc(a.name),
        a.overdue ? `<b style="color:${RED};">${prettyDate(a.start)}</b>` : prettyDate(a.start),
        prettyDate(a.work_starts)])));
  }
  return out.join('');
}

function renderRegisters(d, SPAN) {
  const g = d.regs;
  if (g === undefined) return section('Registers') + empty('The registers could not be read for this report.');
  if (!g || !g.types.length) return '';
  const T = g.totals;
  const out = [section('Registers')];
  out.push(statRow([
    stat(n0(T.raised), `raised this ${SPAN}`, NAVY),
    stat(n0(T.issued), 'issued by Document Control', NAVY),
    stat(n0(T.replied), 'replies recorded', NAVY),
    stat(n0(T.open), `open at ${prettyDate(d.to)}`, T.open ? NAVY : GREEN),
    stat(n0(T.overdue), 'past their due date', T.overdue ? RED : GREEN),
  ]));
  out.push(`<div style="height:8px"></div>`);
  out.push(table(['Register', 'Raised', 'Issued', 'Replied', 'Closed', 'Open', 'With consultant', 'Overdue'],
    g.types.map((r) => [esc(r.label), n0(r.raised), n0(r.issued), n0(r.replied), n0(r.closed), n0(r.open), n0(r.with_consultant),
      r.overdue ? `<b style="color:${RED};">${n0(r.overdue)}</b>` : '0']),
    ['', 'r', 'r', 'r', 'r', 'r', 'r', 'r']));
  out.push(note('Raised, issued, replied and closed count what happened inside the period; open, with consultant and overdue are the position on the last day.'));
  if (g.overdue.length) {
    out.push(`<div style="height:12px"></div>`);
    out.push(table(['Overdue', 'Subject', 'Register', 'Due', 'Days over', 'Waiting on'],
      g.overdue.slice(0, 20).map((r) => [`<b>${esc(r.ref)}</b>`, esc(r.title), esc(RECORD_LABEL[r.type] || r.type),
        `<span style="color:${RED};">${prettyDate(r.due)}</span>`, n0(r.days), esc(r.status)]),
      ['', '', '', '', 'r', '']));
    if (g.overdue.length > 20) out.push(note(`Showing the 20 longest overdue of ${n0(g.overdue.length)}.`));
  }
  return out.join('');
}

function renderDocuments(d, SPAN) {
  const g = d.regs, dr = d.drawings;
  const issued = (g && g.issued) || [], replies = (g && g.replies) || [], dwg = dr || [], rcvd = (g && g.received) || [];
  const out = [section('Documents issued and replies received')];
  if (!issued.length && !replies.length && !dwg.length && !rcvd.length) {
    out.push(empty(`Nothing was issued or received and no replies were recorded this ${SPAN}.`));
    return out.join('');
  }
  if (rcvd.length) {
    out.push(table(['Received', 'Ref', 'From', 'Subject', 'Status'],
      rcvd.slice(0, 40).map((r) => [prettyDate(r.date), `<b>${esc(r.ref)}</b>`, esc(r.from + (r.their_ref ? ' · ' + r.their_ref : '')), esc(r.title),
        /^Replied|^Closed|^Filed/.test(r.status) ? esc(r.status) : `<span style="color:${r.due && r.due < d.to ? RED : INK};">${esc(r.status)}</span>`])));
    out.push(`<div style="height:12px"></div>`);
  }
  if (issued.length) {
    out.push(table(['Issued', 'Ref', 'Subject', 'Register'],
      issued.slice(0, 40).map((r) => [prettyDate(r.date), `<b>${esc(r.ref)}</b>`, esc(r.title), esc(RECORD_LABEL[r.type] || r.type)])));
    if (issued.length > 40) out.push(note(`and ${n0(issued.length - 40)} more issued.`));
  }
  if (replies.length) {
    out.push(`<div style="height:12px"></div>`);
    out.push(table(['Reply recorded', 'Ref', 'Subject', 'Reply'],
      replies.slice(0, 40).map((r) => [prettyDate(r.date), `<b>${esc(r.ref)}</b>`, esc(r.title), esc(r.reply)])));
  }
  if (dwg.length) {
    out.push(`<div style="height:12px"></div>`);
    out.push(table(['Drawing issued', 'Rev', 'Title', 'Type', 'Date'],
      dwg.slice(0, 40).map((r) => [`<b>${esc(r.number)}</b>`, esc(r.revision || ''), esc(r.title || ''), esc(r.kind || ''), prettyDate(r.date)])));
    if (dwg.length > 40) out.push(note(`and ${n0(dwg.length - 40)} more drawings.`));
  }
  return out.join('');
}

function renderActions(d, SPAN) {
  const a = d.actions;
  if (!a || (!a.raised && !a.closed && !a.open)) return '';
  const out = [section('Meeting actions')];
  out.push(statRow([
    stat(n0(a.raised), `raised this ${SPAN}`, NAVY),
    stat(n0(a.closed), `closed this ${SPAN}`, a.closed ? GREEN : MUTED),
    stat(n0(a.open), `open at ${prettyDate(d.to)}`, NAVY),
    stat(n0(a.overdue.length), 'past their date', a.overdue.length ? RED : GREEN),
  ]));
  if (a.overdue.length) {
    out.push(`<div style="height:8px"></div>`);
    out.push(table(['Overdue action', 'By', 'Due', 'From'],
      a.overdue.slice(0, 20).map((x) => [`<b>${esc(x.ref)}</b> ${esc(x.text)}`, esc(x.owner || ''), `<span style="color:${RED};">${prettyDate(x.due)}</span>`, esc(x.meeting)])));
    if (a.overdue.length > 20) out.push(note(`Showing the 20 oldest of ${n0(a.overdue.length)}.`));
  }
  return out.join('');
}

/* ------------------------------------------------ STEP 9: HSE figures */

const mh = (v) => (v == null ? '—' : n0(v));
const rt = (v, dp = 2) => (v == null ? '—' : v.toFixed(dp));
const HSE_ROWS = [['fatality', 'Fatality'], ['lti', 'Lost-time injury (LTI)'], ['rwc', 'Restricted work case'], ['mtc', 'Medical treatment case'],
  ['fac', 'First aid case'], ['nm', 'Near-miss'], ['pd', 'Property damage'], ['env', 'Environmental'], ['do', 'Dangerous occurrence']];

function hseBasis(h) {
  const b = h.man_hours.basis;
  const parts = [];
  if (b.hse) parts.push(`${b.hse} day${b.hse === 1 ? '' : 's'} from HSE time sheets`);
  if (b.diary) parts.push(`${b.diary} from the site diary`);
  if (b.headcount) parts.push(`${b.headcount} from HSE's head count × ${h.hours_per_day} h`);
  if (b.manpower) parts.push(`${b.manpower} from site's manpower return × ${h.hours_per_day} h`);
  return parts.length ? 'Man-hours: ' + parts.join(', ') + '.' : '';
}

// The short version, inside the weekly and monthly progress reports.
function renderHseSummary(d, SPAN) {
  const h = d.hse;
  if (!h) return '';
  const i = h.incidents.period;
  const out = [section('Health & safety')];
  out.push(statRow([
    stat(mh(h.man_hours.period || null), `man-hours this ${SPAN}`, NAVY),
    stat(h.days_since_lti == null ? '—' : n0(h.days_since_lti), 'days since a lost-time injury', h.days_since_lti == null ? MUTED : GREEN),
    stat(n0(i.fatality + i.lti + i.rwc + i.mtc), `recordable injuries this ${SPAN}`, (i.fatality + i.lti + i.rwc + i.mtc) ? RED : GREEN),
    stat(n0(i.nm), 'near-misses', NAVY),
    stat(rt(h.rates.ltifr_to_date), 'LTIFR to date (per 1m man-hours)', NAVY),
  ]));
  out.push(note((h.last_lti ? `Last lost-time injury ${prettyDate(h.last_lti)}. ` : 'No lost-time injury recorded on this project. ') + hseBasis(h)));
  return out.join('');
}

// The monthly HSE report.
function renderHse(d) {
  const h = d.hse;
  const P = h.incidents.period, C = h.incidents.to_date, L = h.leading;
  const out = [head(d)];
  out.push(statRow([
    stat(mh(h.man_hours.period || null), 'man-hours this month', NAVY),
    stat(mh(h.man_hours.to_date || null), 'man-hours to date', NAVY),
    stat(h.days_since_lti == null ? '—' : n0(h.days_since_lti), h.last_lti ? 'days since the last LTI' : 'no LTI on this project', h.last_lti ? NAVY : GREEN),
    stat(mh(h.man_hours.safe_since_lti || null), h.last_lti ? 'safe man-hours since the last LTI' : 'safe man-hours to date', GREEN),
    stat(rt(h.rates.ltifr_to_date), 'LTIFR to date', NAVY),
  ]));
  if (d.running) out.push(note(`The month is still running — figures are to ${prettyDate(d.to)}.`));

  const warn = [];
  if (h.man_hours.gaps.length) warn.push(`${h.man_hours.gaps.length} working day${h.man_hours.gaps.length === 1 ? ' has' : 's have'} no man-hours record at all (${h.man_hours.gaps.slice(0, 6).map(prettyDate).join(', ')}${h.man_hours.gaps.length > 6 ? '…' : ''}). The man-hours — and every rate — are understated by those days.`);
  if (!h.man_hours.to_date) warn.push('No man-hours are recorded on this project, so no frequency rate can be worked out.');
  if (L.toolbox_talks == null && L.inductions == null && L.ppe_checked == null) warn.push('Nothing was entered in the HSE log this month, so toolbox talks, inductions and PPE checks are blank — not zero.');
  out.push(warnBlock(warn));

  out.push(section('Incidents — lagging indicators'));
  out.push(table(['Classification', 'This month', 'Project to date'],
    HSE_ROWS.map(([k, label]) => [esc(label), P[k] ? `<b style="color:${['fatality', 'lti', 'rwc', 'mtc'].includes(k) ? RED : INK};">${n0(P[k])}</b>` : '0', n0(C[k])])
      .concat([['Days lost (LTI)', n0(h.incidents.days_lost_period), n0(h.incidents.days_lost_to_date)]]), ['', 'r', 'r']));
  out.push(`<div style="height:12px"></div>`);
  out.push(table(['Rate', 'This month', 'Project to date'], [
    ['Lost-time injury frequency rate (LTIFR) — per 1,000,000 man-hours', rt(h.rates.ltifr_period), rt(h.rates.ltifr_to_date)],
    ['Total recordable injury rate (TRIR) — per 200,000 man-hours', rt(h.rates.trir_period), rt(h.rates.trir_to_date)],
    ['Severity rate — days lost per 200,000 man-hours', '—', rt(h.rates.severity_to_date)],
  ], ['', 'r', 'r']));
  out.push(note('Recordable = fatalities, lost-time injuries, restricted work and medical treatment cases. ' + hseBasis(h)));
  if (h.incidents.list.length) {
    out.push(`<div style="height:12px"></div>`);
    out.push(table(['Ref', 'Date', 'Classification', 'What happened', 'Status'],
      h.incidents.list.map((x) => [`<b>${esc(x.ref)}</b>`, prettyDate(x.date), esc(x.type), esc(x.title), esc(x.status)])));
  }

  out.push(section('Leading indicators'));
  const pt = Object.entries(L.permit_types).map(([k, v]) => `${esc(k)} ${v}`).join(', ');
  out.push(table(['Indicator', 'This month'], [
    ['Toolbox talks held', L.toolbox_talks == null ? '—' : n0(L.toolbox_talks) + (L.toolbox_attended != null ? ` (${n0(L.toolbox_attended)} attended)` : '')],
    ['Inductions', L.inductions == null ? '—' : n0(L.inductions)],
    ['PPE compliance', L.ppe_pct == null ? '—' : L.ppe_pct + '% of ' + n0(L.ppe_checked) + ' checked'],
    ['HSE observations raised / closed', `${n0(L.obs_raised)} / ${n0(L.obs_closed)}`],
    ['Observations open at month end', n0(L.obs_open) + (L.obs_high_open ? ` <b style="color:${RED};">(${L.obs_high_open} high risk)</b>` : '')],
    ['Average days to close an observation', L.obs_avg_close_days == null ? '—' : String(L.obs_avg_close_days)],
    ['Permits to work issued', n0(L.permits) + (pt ? ` — ${pt}` : '')],
  ], ['', 'r']));

  if (h.trend) {
    out.push(section('Last twelve months'));
    out.push(table(['Month', 'Man-hours', 'LTI', 'Recordable', 'Near-miss', 'First aid', 'Observations', 'LTIFR (cumulative)'],
      h.trend.map((t) => [prettyMonth(t.month), t.man_hours ? n0(t.man_hours) : '—', n0(t.lti), n0(t.recordable), n0(t.near_miss), n0(t.first_aid), n0(t.observations), rt(t.ltifr_cum)]),
      ['', 'r', 'r', 'r', 'r', 'r', 'r', 'r']));
  }
  return out.join('\n');
}

function renderDiary(d) {
  const y = d.diary;
  if (!y) return '';
  const out = [section('Site diary')];
  out.push(statRow([
    stat(n0(y.submitted) + ' / ' + n0(y.working), 'working days with a submitted diary', y.submitted === y.working ? GREEN : NAVY),
    stat(n0(y.draft), 'left as drafts', y.draft ? AMBER : GREEN),
    stat(n0(y.missing), 'with no diary at all', y.missing ? RED : GREEN),
    stat(n0(y.off), 'days off', MUTED),
  ]));
  if (y.missing_dates.length) {
    out.push(note('Not submitted: ' + y.missing_dates.map((x) => prettyDate(x.date) + (x.status === 'draft' ? ' (draft)' : '')).join(', ') + '.'));
  }
  if (y.off_days && y.off_days.length) out.push(note('Days off on this project: ' + y.off_days.join(', ') + '.'));
  return out.join('');
}

function renderRange(d, opts) {
  const SPAN = d.kind === 'weekly' ? 'week' : d.kind === 'period' ? 'period' : 'month';
  const gain = d.now.pct - d.was.pct;
  const out = [head(d)];

  out.push(statRow([
    stat(pc(d.now.pct), `complete at ${prettyDate(d.to)}`, NAVY),
    stat(delta(gain), `points gained this ${SPAN}`, NAVY),
    stat(n0(d.completed.length), 'activities completed', GREEN),
    stat(pc(d.now.planned), 'programme position', MUTED),
    stat(delta(d.now.pct - d.now.planned), 'points against plan',
             d.now.pct >= d.now.planned ? GREEN : RED),
  ]));
  out.push(note(
    `Opened the ${SPAN} at ${pc(d.was.pct)} and closed at ${pc(d.now.pct)}. ` +
    `${n0(d.now.done)} of ${n0(d.now.total)} activities are complete; ` +
    `${n0(d.started.length)} started during the ${SPAN}.`
  ));
  if (d.running) out.push(note(`This ${SPAN} is still running — figures are to ${prettyDate(d.to)}; the ${SPAN} ends ${prettyDate(d.periodTo)}.`));

  const mwarn = [];
  if (d.discipline.daysReported < d.discipline.daysInMonth * 0.5) {
    mwarn.push(`Site reported on only ${d.discipline.daysReported} of ${d.discipline.daysInMonth} days. Everything below rests on that.`);
  }
  if (!d.manpower.daysWorked) mwarn.push(`No manpower was logged at all, so there is no labour record for this ${SPAN}.`);
  if (!d.target.total) mwarn.push('No target list is loaded, so there is no fixed date to measure against.');
  if (d.issues === null) mwarn.push('The issues register is not set up, so no RFI or notice position is shown.');
  if (!d.photos) mwarn.push(`No photographs were attached this ${SPAN} — nothing here is evidenced by a picture.`);
  out.push(warnBlock(mwarn));

  out.push(renderCurve(d, opts));

  if (d.target.total) {
    out.push(section(`Target list at ${SPAN} end`));
    out.push(note(
      `${esc(d.target.name || 'Target list')}${d.target.deadline ? ' — due ' + prettyDate(d.target.deadline) : ''}: ` +
      `${n0(d.target.cleared)} of ${n0(d.target.total)} lines cleared, ${n0(d.target.missed)} past their finish-by date.`
    ));
    out.push(table(['Trade group', 'To clear', 'Cleared', 'Open', 'Missed', 'Days left'],
      d.target.groups.map((g) => [
        esc(g.group), n0(g.total), n0(g.cleared), n0(g.open),
        g.missed ? `<b style="color:${RED};">${n0(g.missed)}</b>` : '0',
        n0(g.days),
      ]), ['', 'r', 'r', 'r', 'r', 'r']));
  }

  out.push(section(`Completed this ${SPAN}`));
  if (!d.completed.length) {
    out.push(empty(`No activity reached 100% during the ${SPAN}.`));
  } else {
    out.push(table(['Activity', 'Section', 'Trade', 'Floor'],
      d.completed.slice(0, 60).map((a) => [esc(a.name), esc(a.wbs || ''), esc(a.trade || ''), esc(a.floor || '')])));
    if (d.completed.length > 60) out.push(note(`Showing 60 of ${n0(d.completed.length)} completed activities.`));
  }

  out.push(section('Delays and holds'));
  if (!d.reasons.length) {
    out.push(empty(`Nothing was flagged as delayed, at risk or on hold during the ${SPAN}.`));
  } else {
    out.push(note('Grouped by the reason site gave, biggest first.'));
    out.push(table(['Reason', 'Activities', 'Examples'],
      d.reasons.map((r) => [
        `<b>${esc(r.reason)}</b>`,
        `<span style="color:${RED};">${n0(r.n)}</span>`,
        r.examples.map((e) => esc(e.name) + (e.remarks ? ` <span style="color:${MUTED};">— ${esc(e.remarks)}</span>` : '')).join('<br>'),
      ]), ['', 'r', '']));
  }

  out.push(renderLookAhead(d));
  out.push(renderRegisters(d, SPAN));
  out.push(renderDocuments(d, SPAN));
  out.push(renderActions(d, SPAN));
  out.push(renderHseSummary(d, SPAN));

  const mi = d.issues;
  if (mi && (mi.open || mi.raisedThisMonth)) {
    out.push(section('Site issues log'));
    out.push(statRow([
      stat(n0(mi.raisedThisMonth), `raised this ${SPAN}`, NAVY),
      stat(n0(mi.open), 'still open', mi.open ? NAVY : GREEN),
      stat(n0(mi.overdue), 'past their reply date', mi.overdue ? RED : GREEN),
      stat(mi.oldest == null ? '—' : mi.oldest + 'd', 'oldest open item', mi.oldest > 21 ? RED : NAVY),
      stat(mi.turnaround == null ? '—' : mi.turnaround.toFixed(0) + 'd', 'average reply time', NAVY),
    ]));
    if (mi.unissued) {
      out.push(note(
        `${n0(mi.unissued)} item${mi.unissued === 1 ? '' : 's'} raised on site ` +
        `${mi.unissued === 1 ? 'is' : 'are'} still sitting unissued. Until something is issued, ` +
        `no clock is running on anybody but us.`
      ));
    }
    out.push(table(['Type', 'Raised', 'Open', 'Overdue', 'Oldest', 'Days claimed'],
      mi.byType.map((r) => [
        esc(ISSUE_TYPE_LABEL[r.type] || r.type), n0(r.raised), n0(r.open),
        r.overdue ? `<b style="color:${RED};">${n0(r.overdue)}</b>` : '0',
        r.oldest ? n0(r.oldest) + 'd' : '—',
        r.days ? String(Math.round(r.days * 10) / 10) : '—',
      ]), ['', 'r', 'r', 'r', 'r', 'r']));

    if (mi.worst.length) {
      out.push(`<div style="height:16px"></div>`);
      out.push(note('The oldest items still open — in a claim these are the ones you will be asked about first.'));
      out.push(table(['Ref', 'Raised', 'Subject', 'Activity', 'Status', 'Days open'],
        mi.worst.map((i) => [
          `<b>${esc(i.ref)}</b>`, prettyDate(i.raised_date), esc(i.title),
          esc(i.activity_name || i.activity_id || '—'),
          i.status === 'draft' ? `<span style="color:${AMBER};">not issued</span>` : esc(i.status),
          n0(dnum(d.to) - dnum(i.raised_date)),
        ]), ['', '', '', '', '', 'r']));
    }
  }

  out.push(section('Manpower'));
  if (!d.manpower.daysWorked) {
    out.push(empty(`No manpower was logged during the ${SPAN}.`));
  } else {
    out.push(statRow([
      stat(n0(d.manpower.manDays), 'man-days logged', NAVY),
      stat(n0(d.manpower.peak), `peak day (${prettyDate(d.manpower.peakDay)})`, NAVY),
      stat(n0(Math.round(d.manpower.manDays / d.manpower.daysWorked)), 'average on a worked day', NAVY),
      stat(n0(d.manpower.daysWorked), 'days with men logged', NAVY),
    ]));
    out.push(`<div style="height:8px"></div>`);
    out.push(table(['Trade', 'Man-days'],
      d.manpower.tradeDays.slice(0, 20).map(([t, n]) => [esc(t), n0(n)]), ['', 'r']));
  }

  out.push(renderDiary(d));

  out.push(section('Reporting discipline'));
  out.push(note(
    `Site reported on ${n0(d.discipline.daysReported)} of ${n0(d.discipline.daysInMonth)} days, ` +
    `${n0(d.discipline.entries)} entries in all, with ${n0(d.photos)} photographs attached. ` +
    `A ${SPAN} with few reporting days means the figures above are thinner than they look.`
  ));

  return out.join('\n');
}

// The report body. Inline styles throughout, so it renders the same on the
// Reports page, in a print-to-PDF, and inside an email.
function renderSnapshot(d, opts) {
  const out = [head(d)];
  if (d.kind === 'lookahead') {
    if (!d.total) out.push(empty('No programme has been loaded for this project yet.'));
    else out.push(renderLookAhead(d));
    return out.join('\n');
  }
  out.push(statRow([
    stat(pc(d.now.pct), 'complete, weighted', NAVY),
    stat(pc(d.now.planned), 'planned by today', MUTED),
    stat(delta(d.now.pct - d.now.planned), 'points against plan', d.now.pct >= d.now.planned ? GREEN : RED),
    stat(n0(d.late.length), 'past their planned finish', d.late.length ? RED : GREEN),
  ]));
  out.push(note(`${n0(d.now.done)} of ${n0(d.now.total)} activities complete.`));
  out.push(renderCurve(d, opts));
  if (d.late.length) {
    out.push(section('Past their planned finish'));
    out.push(table(['Activity', 'Discipline', 'Planned finish', 'Now', 'Days late'],
      d.late.slice(0, 30).map((a) => [esc(a.name), esc(a.discipline), prettyDate(a.finish), a.pct.toFixed(0) + '%',
        `<b style="color:${RED};">${n0(a.days)}</b>`]), ['', '', '', 'r', 'r']));
    if (d.late.length > 30) out.push(note(`Showing the 30 longest overdue of ${n0(d.late.length)}.`));
  }
  return out.join('\n');
}

export function reportHTML(d, opts) {
  const body = (d.kind === 'monthly' || d.kind === 'weekly' || d.kind === 'period') ? renderRange(d, opts)
    : (d.kind === 'lookahead' || d.kind === 'programme') ? renderSnapshot(d, opts)
    : d.kind === 'hse' ? renderHse(d) : renderDaily(d);
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:${INK};max-width:940px;margin:0 auto;">
    ${body}
    <div style="border-top:1px solid ${RULE};margin-top:28px;padding-top:12px;${small}">
      Generated automatically from the programme, site progress, the registers and the site diary. Nothing on this report is typed by hand.
    </div>
  </div>`;
}

// A complete document, for email and for saving.
export function reportDocument(d) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(d.title)} — ${esc((d.project || {}).name || '')}</title></head>
<body style="margin:0;padding:24px;background:#ffffff;">${reportHTML(d)}</body></html>`;
}

export const reportSubject = (d) =>
  `${(d.project || {}).name || 'Project'} — ${d.kind === 'hse' ? 'HSE report ' + prettyMonth(d.key) : d.kind === 'daily'
    ? 'daily report ' + prettyDate(d.key)
    : d.kind === 'weekly'
    ? 'weekly report ' + prettyDate(d.from) + ' to ' + prettyDate(d.periodTo || d.to)
    : 'monthly report ' + prettyMonth(d.key)}`;


// The same report as a file Word opens, edits and saves as .docx. Word reads
// HTML with its own page setup; the S-curve drawing is left out (Word does not
// draw inline SVG) and its table of figures stays.
export function reportWord(d) {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(d.title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
@page Section1 { size: 595.3pt 841.9pt; margin: 36pt 32pt 36pt 32pt; }
div.Section1 { page: Section1; }
table { border-collapse: collapse; }
td, th { mso-line-height-rule: exactly; }
</style></head>
<body><div class="Section1">${reportHTML(d, { noSvg: true })}</div></body></html>`;
}

// e.g. Tower-A_weekly_2026-09-14
export function reportFileName(d) {
  const name = String((d.project || {}).name || 'Project').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'Project';
  return name + '_' + d.kind + '_' + (d.kind === 'daily' ? d.key : d.kind === 'weekly' ? d.from : d.key);
}
