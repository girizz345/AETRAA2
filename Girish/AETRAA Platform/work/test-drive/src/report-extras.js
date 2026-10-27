// STEP 4 — what the weekly and monthly reports add on top of site progress.
//
//   sCurve          planned against actual, week by week (or month by month on a
//                   long job), from programme dates and what site has reported
//   lookAhead       the three weeks after the period: what should start, what
//                   should finish, what is late to start, what has to be
//                   submitted or ordered first
//   registers       every register (RFI, submittal, MS, NCR, WIR…) as at the end
//                   of the period: raised, issued, replied, closed, open, overdue
//   documentsOut    what Document Control issued, and the replies recorded
//   diaryCompliance which days have a submitted diary and which do not
//
// Only reads. Everything is worked out from rows that are already in the
// database, so the report can be rebuilt for any past period and comes out
// the same.

import { RECORD_TYPES, pendingStep, ensureRecordColumns } from './records.js';
import { ensureDrawingImportColumns } from './drawings.js';
import { diaryStatus } from './diary-checks.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dnum = (d) => (d && DATE_RE.test(String(d).slice(0, 10)) ? Date.parse(String(d).slice(0, 10) + 'T00:00:00Z') / 86400000 : null);
const dstr = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
const shift = (d, n) => dstr(dnum(d) + n);
const d10 = (v) => String(v || '').slice(0, 10);
const parse = (v, d) => { try { const j = JSON.parse(v || ''); return j == null ? d : j; } catch (e) { return d; } };

export const RECORD_LABEL = {
  rfi: 'RFI', submittal: 'Submittal', ms: 'Method statement', material: 'Material approval',
  authority: 'Authority NOC', letter: 'Letter', incoming: 'Incoming letter', variation: 'Variation', wir: 'Inspection (WIR)',
  mir: 'Material inspection (MIR)', ncr: 'NCR', obs: 'HSE observation', incident: 'Incident',
  ptw: 'Permit to work', mr: 'Material request', cert: 'Certificate',
};

// Same weighting as the report's roll-up: the activity's own weight, or its
// planned duration in days, or 1.
export function weightOf(a) {
  const ps = dnum(a.planned_start), pf = dnum(a.planned_finish);
  return a.weight && a.weight > 0 ? a.weight : (ps !== null && pf !== null ? Math.max(1, pf - ps + 1) : 1);
}
function plannedFraction(a, at) {
  const ps = dnum(a.planned_start), pf = dnum(a.planned_finish);
  if (ps === null || pf === null) return 0;
  if (at >= pf) return 1;
  if (at <= ps) return 0;
  return (at - ps) / Math.max(1, pf - ps);
}

/* ---------------------------------------------------------------- S-curve */

// The dates to plot: every Sunday (or every month end on a job longer than
// about 18 months) from the programme's first start to its last finish, with
// the report's own end date always on the curve.
function curveDates(start, finish, to) {
  const s = dnum(start), f = Math.max(dnum(finish) || 0, dnum(to));
  if (s === null || f < s) return [to];
  const out = new Set();
  if (f - s <= 540) {
    // Sundays — a weekly report closes on a Sunday, so its end lands on a point.
    let d = s + ((7 - new Date(s * 86400000).getUTCDay()) % 7);
    for (; d <= f; d += 7) out.add(dstr(d));
    out.add(dstr(f));                                          // the plan line reaches 100%
  } else {
    let [y, m] = start.split('-').map(Number);
    for (let i = 0; i < 200; i++) {
      const end = dstr(Date.UTC(y, m, 0) / 86400000);          // last day of month m
      if (dnum(end) > f) { out.add(dstr(f)); break; }
      out.add(end);
      m++; if (m > 12) { m = 1; y++; }
    }
  }
  out.add(to);
  return [...out].sort();
}

export async function sCurve(env, pid, acts, to) {
  const list = Object.values(acts);
  const starts = list.map((a) => a.planned_start).filter((d) => DATE_RE.test(d || '')).sort();
  const finishes = list.map((a) => a.planned_finish).filter((d) => DATE_RE.test(d || '')).sort();
  if (!list.length || !starts.length) return null;
  const dates = curveDates(starts[0], finishes[finishes.length - 1] || to, to);

  // Every update up to the report date, in date order. Walking the dates in
  // order, the newest row per activity (highest id) within each cut-off is the
  // same row the report's snapshot picks.
  const { results } = await env.DB.prepare(
    `SELECT activity_id, report_date, pct, id FROM updates
      WHERE project_id = ? AND report_date <= ? ORDER BY report_date, id`
  ).bind(pid, to).all();
  const ups = results || [];
  const firstActual = ups.length ? ups[0].report_date : null;

  let W = 0;
  for (const a of list) W += weightOf(a);
  const best = new Map();      // activity -> {id, pct}
  let k = 0;
  const points = [];
  for (const date of dates) {
    const at = dnum(date);
    let planned = 0;
    for (const a of list) planned += plannedFraction(a, at) * 100 * weightOf(a);
    let actual = null;
    if (date <= to) {
      while (k < ups.length && ups[k].report_date <= date) {
        const u = ups[k++];
        const cur = best.get(u.activity_id);
        if (!cur || u.id > cur.id) best.set(u.activity_id, { id: u.id, pct: u.pct });
      }
      if (firstActual && date >= firstActual) {
        let earned = 0;
        for (const a of list) {
          const b = best.get(a.id);
          const p = b && Number.isFinite(b.pct) ? b.pct : 0;
          earned += p * weightOf(a);
        }
        actual = W ? earned / W : 0;
      }
    }
    points.push({ date, planned: W ? planned / W : 0, actual });
  }
  return {
    points,
    first_actual: firstActual,
    start: starts[0],
    finish: finishes[finishes.length - 1] || null,
    step: dnum(dates[dates.length - 1]) - dnum(dates[0]) > 540 ? 'month' : 'week',
  };
}

/* ------------------------------------------------------------- look-ahead */

// acts: every activity including derived ones; snap: where each stood at `to`.
export function lookAhead(acts, snap, to, days = 21) {
  const end = shift(to, days);
  const pctOf = (a) => { const s = snap[a.id] || {}; return Number.isFinite(s.pct) ? s.pct : 0; };
  const site = [], needed = [];
  for (const a of Object.values(acts)) (a.source === 'derived' ? needed : site).push(a);
  const row = (a) => ({ id: a.id, name: a.name, discipline: a.discipline || a.trade || '', floor: a.floor || '',
    start: a.planned_start || '', finish: a.planned_finish || '', pct: pctOf(a) });

  const late = site.filter((a) => a.planned_start && a.planned_start <= to && pctOf(a) === 0)
    .sort((x, y) => x.planned_start.localeCompare(y.planned_start)).map((a) => ({ ...row(a), days_late: dnum(to) - dnum(a.planned_start) }));
  const starting = site.filter((a) => a.planned_start > to && a.planned_start <= end && pctOf(a) === 0)
    .sort((x, y) => x.planned_start.localeCompare(y.planned_start)).map(row);
  const finishing = site.filter((a) => a.planned_finish > to && a.planned_finish <= end && pctOf(a) < 100)
    .sort((x, y) => x.planned_finish.localeCompare(y.planned_finish)).map(row);
  // Submissions and orders the programme needs before work in (or before) the
  // window can start. Derived items carry the date they must go by.
  const first = needed.filter((a) => a.planned_start && a.planned_start <= end && pctOf(a) < 100)
    .sort((x, y) => x.planned_start.localeCompare(y.planned_start))
    .map((a) => ({ ...row(a), kind: a.kind || '', work_starts: a.work_starts || '', overdue: a.planned_start <= to }));
  return { from: shift(to, 1), to: end, days, late, starting, finishing, needed: first };
}

/* -------------------------------------------------------------- registers */

// When each rung of a record's ladder was signed, read from its own workflow.
function recordDates(rec) {
  const wf = parse(rec.workflow, []);
  const t = RECORD_TYPES[rec.type];
  const tpl = t && t.wf.length === wf.length ? t.wf : [];
  let issued = null, replied = null, reply = '';
  wf.forEach((s, i) => {
    if (!s || s.state !== 'done' || !s.when) return;
    const isIssue = s.issue || (tpl[i] && tpl[i].issue);
    const isReply = s.reply || (tpl[i] && tpl[i].reply);
    if (isIssue) issued = d10(s.when);
    if (isReply) { replied = d10(s.when); reply = rec.status || ''; }
  });
  const open = !!pendingStep({ type: rec.type, workflow: wf, step: rec.step || 0, status: rec.status });
  const lastDone = wf.filter((s) => s && s.state === 'done' && s.when).map((s) => d10(s.when)).sort().pop() || null;
  // K7 (S0): the day it was issued and the consultant's own reply date, where
  // recorded, rather than the day Document Control signed the step.
  if (rec.issued_on) issued = d10(rec.issued_on);
  if (rec.replied_on) replied = d10(rec.replied_on);
  return {
    raised: d10(rec.submitted || rec.created_at),
    issued, replied, reply,
    closed: open ? null : (lastDone || d10(rec.updated_at) || null),
  };
}

export async function registers(env, pid, from, to) {
  await ensureRecordColumns(env).catch(() => {});   // the K5 columns, before they are read
  let rows;
  try {
    ({ results: rows } = await env.DB.prepare(
      `SELECT type, ref, title, status, workflow, step, due, submitted, created_at, updated_at, data, imported, issued_on, replied_on
         FROM records WHERE project_id = ?`
    ).bind(pid).all());
  } catch (e) { return null; }       // no records table yet
  const inP = (d) => d && d >= from && d <= to;
  const byType = {};
  const overdue = [], issued = [], replies = [], received = [];
  let importedInPeriod = 0;
  for (const r of rows || []) {
    // K5: an imported record was not raised, issued, answered or closed on this
    // platform, and is never open or overdue here. It is counted on its own,
    // in the period it was brought in.
    if (Number(r.imported)) { if (inP(String(r.created_at || '').slice(0, 10))) importedInPeriod++; continue; }
    const d = recordDates(r);
    if (!d.raised || d.raised > to) continue;                 // did not exist yet
    const openAtEnd = !d.closed || d.closed > to;
    const t = byType[r.type] || (byType[r.type] = { type: r.type, label: RECORD_LABEL[r.type] || r.type,
      raised: 0, issued: 0, replied: 0, closed: 0, open: 0, overdue: 0, with_consultant: 0 });
    if (inP(d.raised)) t.raised++;
    if (r.type === 'incoming' && inP(d.raised)) {
      const data = parse(r.data, {});
      received.push({ ref: r.ref, title: r.title, from: data.From || '', their_ref: data['Their reference'] || '',
        date: d.raised, status: r.status || '', due: r.due || '' });
    }
    if (inP(d.issued)) { t.issued++; issued.push({ ref: r.ref, type: r.type, title: r.title, date: d.issued }); }
    if (inP(d.replied)) { t.replied++; replies.push({ ref: r.ref, type: r.type, title: r.title, date: d.replied, reply: d.reply }); }
    if (inP(d.closed)) t.closed++;
    if (openAtEnd) {
      t.open++;
      if (d.issued && d.issued <= to && !(d.replied && d.replied <= to)) t.with_consultant++;
      if (r.due && r.due < to) {
        t.overdue++;
        overdue.push({ ref: r.ref, type: r.type, title: r.title, due: r.due, days: dnum(to) - dnum(r.due),
          issued: d.issued, status: r.status || '' });
      }
    }
  }
  const order = Object.keys(RECORD_LABEL);
  const list = Object.values(byType).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  const sum = (k) => list.reduce((s, r) => s + r[k], 0);
  return {
    types: list,
    totals: { raised: sum('raised'), issued: sum('issued'), replied: sum('replied'), closed: sum('closed'),
      open: sum('open'), overdue: sum('overdue'), with_consultant: sum('with_consultant'), imported: importedInPeriod },
    overdue: overdue.sort((a, b) => b.days - a.days),
    issued: issued.sort((a, b) => a.date.localeCompare(b.date)),
    replies: replies.sort((a, b) => a.date.localeCompare(b.date)),
    received: received.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/* ------------------------------------------------------ drawings issued */

export async function drawingsIssued(env, pid, from, to) {
  await ensureDrawingImportColumns(env).catch(() => {});
  try {
    // K5: a sheet loaded from the old system was not issued in this period.
    const { results } = await env.DB.prepare(
      `SELECT number, revision, title, kind, discipline, status, uploaded_at, approved_at
         FROM drawings WHERE project_id = ?
          AND substr(COALESCE(approved_at, uploaded_at), 1, 10) BETWEEN ? AND ?
          AND status IN ('current','superseded') AND COALESCE(imported, 0) = 0
        ORDER BY COALESCE(approved_at, uploaded_at)`
    ).bind(pid, from, to).all();
    return (results || []).map((r) => ({ ...r, date: d10(r.approved_at || r.uploaded_at) }));
  } catch (e) { return null; }
}

/* ------------------------------------------------------ diary compliance */

export async function diaryCompliance(env, pid, project, from, to, todayStr) {
  const days = dnum(to) - dnum(from) + 1;
  const st = await diaryStatus(env, pid, project, to, days);
  // diaryStatus calls its last day "today" when nothing is there yet. For a
  // period that has already closed that day is simply missing.
  const list = st.days.map((d) => (d.status === 'today' && to < todayStr ? { ...d, status: 'missing' } : d));
  const n = (s) => list.filter((d) => d.status === s).length;
  const working = list.filter((d) => d.status !== 'off').length;
  return {
    days: list, working,
    submitted: n('submitted'), draft: n('draft'), missing: n('missing'), off: n('off'),
    missing_dates: list.filter((d) => d.status === 'missing' || d.status === 'draft').map((d) => ({ date: d.date, status: d.status })),
    off_days: st.off_days,
  };
}
