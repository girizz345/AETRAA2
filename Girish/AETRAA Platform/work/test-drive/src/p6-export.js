// SITE PROGRESS → P6.
//
// The Planning Engineer downloads this, imports it into Primavera P6
// (File → Import → Spreadsheet), reschedules, and uploads the new .xer back.
//
// One row per P6 activity that site has reported on, from the latest update:
//   Activity ID · Activity Status · Actual Start · Actual Finish · Physical % Complete
//
// A completion is only sent as Completed (with its actual finish) once the PM
// has verified it on the platform. An unverified "100%" goes as In Progress at
// 99%, and a claim the PM queried is left out — P6 should not be told something
// the office has not accepted. The Review sheet lists every row and why.
//
// Activities the platform derived itself (DRV-…) are never sent: P6 has no such IDs.

import { buildXlsx } from './xlsx.js';

const d10 = (v) => (v ? String(v).slice(0, 10) : null);

export async function progressForP6(env, pid) {
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.name, a.status AS p6_status, a.source,
            u.report_date, u.pct, u.actual_start, u.actual_finish, u.status, u.submitted_by,
            v.status AS verified, v.by AS verified_by
       FROM activities a
       JOIN updates u ON u.project_id = a.project_id AND u.id =
            (SELECT MAX(id) FROM updates WHERE project_id = a.project_id AND activity_id = a.id)
       LEFT JOIN verifications v ON v.project_id = a.project_id AND v.activity_id = a.id
      WHERE a.project_id = ? AND COALESCE(a.source, 'programme') <> 'derived'
      ORDER BY COALESCE(a.sort_order, 999999)`
  ).bind(pid).all();

  const send = [], review = [];
  for (const r of results || []) {
    const pct = Math.max(0, Math.min(100, Number(r.pct) || 0));
    let status, finish = null, sentPct = pct, note;
    if (r.verified === 'queried') {
      review.push([r.id, r.name, pct, 'Not sent', 'PM queried this claim — site must correct it first', r.submitted_by || '', d10(r.report_date) || '']);
      continue;
    }
    if (pct >= 100 && r.verified === 'verified') {
      status = 'Completed'; finish = d10(r.actual_finish) || d10(r.report_date); note = 'Complete, verified by ' + (r.verified_by || 'PM');
    } else if (pct >= 100) {
      status = 'In Progress'; sentPct = 99; note = 'Site says complete; not yet verified by the PM — sent as 99%';
    } else if (pct > 0 || r.actual_start) {
      status = 'In Progress'; note = 'In progress';
    } else {
      status = 'Not Started'; note = 'No progress reported';
    }
    const start = status === 'Not Started' ? null : (d10(r.actual_start) || d10(r.report_date));
    send.push({ id: r.id, status, start, finish, pct: sentPct });
    review.push([r.id, r.name, pct, status + ' · ' + sentPct + '%', note, r.submitted_by || '', d10(r.report_date) || '']);
  }
  return { send, review };
}

// The workbook P6's spreadsheet import reads: a TASK sheet whose first row holds
// P6's own field names and second row the column titles, plus P6's USERDATA sheet.
export async function p6ProgressWorkbook(env, pid) {
  const { send, review } = await progressForP6(env, pid);
  const task = [
    ['task_code', 'status_code', 'act_start_date', 'act_end_date', 'phys_complete_pct'],
    ['Activity ID', 'Activity Status', 'Actual Start', 'Actual Finish', 'Physical % Complete'],
    ...send.map((s) => [s.id, s.status, s.start ? { date: s.start } : null, s.finish ? { date: s.finish } : null, s.pct]),
  ];
  const userdata = [
    ['user_data'],
    ['UserSettings Do Not Edit'],
    ['DurationQtyType=QT_Day'],
    ['ShowAsPercentage=0'],
    ['SmallScaleQtyType=QT_Hour'],
    ['DateFormat=dd-mmm-yy'],
    ['CurrencyFormat=Dollar'],
  ];
  const bytes = buildXlsx([{ name: 'TASK', rows: task }, { name: 'USERDATA', rows: userdata }]);
  const reviewBytes = buildXlsx([{ name: 'Review', rows: [
    ['Activity ID', 'Activity', 'Site %', 'Sent to P6', 'Why', 'Reported by', 'Last report'], ...review] }]);
  return { bytes, reviewBytes, count: send.length, review: review.length };
}
