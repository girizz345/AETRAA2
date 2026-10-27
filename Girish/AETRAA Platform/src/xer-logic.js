// The logic, calendars, durations, status and float out of a P6 .xer — the
// part of the programme a forecast cannot be made without — and writing it
// onto a project. Shared by the AETRAA Admin import, the planner's monthly
// update, and tools/xer-logic.mjs.
//
// Nothing here interprets anything. It copies P6's own numbers across, so that
// the engine can be checked against P6's own answer.

import { parseCalendar, pack, parseDate, isoMinute } from './calendar.js';

// P6 relationship types, in the app's own words.
export const LINK = {
  PR_FS: 'FS', PR_SS: 'SS', PR_FF: 'FF', PR_SF: 'SF',
};

// Constraints. The two that freeze a forecast — mandatory start and finish —
// are carried across under their own names so the engine can refuse to hide
// what they are doing.
export const CONSTRAINT = {
  CS_MSO: 'start_on', CS_MSOA: 'start_on_or_after', CS_MSOB: 'start_on_or_before',
  CS_MEO: 'finish_on', CS_MEOA: 'finish_on_or_after', CS_MEOB: 'finish_on_or_before',
  CS_MANDSTART: 'mandatory_start', CS_MANDFIN: 'mandatory_finish',
  CS_ALAP: 'as_late_as_possible',
};

export const STATUS = {
  TK_Complete: 'complete', TK_Active: 'in_progress', TK_NotStart: 'not_started',
};

export function extract(tables) {
  const project = (tables.PROJECT || [])[0] || {};
  const opts = (tables.SCHEDOPTIONS || [])[0] || {};

  const calendars = {};
  for (const c of tables.CALENDAR || []) {
    calendars[c.clndr_id] = parseCalendar(c.clndr_data, {
      id: c.clndr_id, name: c.clndr_name, day_hours: c.day_hr_cnt,
    });
  }

  const byId = {};
  const activities = [];
  for (const t of tables.TASK || []) {
    byId[t.task_id] = t.task_code;
    activities.push({
      id: t.task_code,
      task_id: t.task_id,
      calendar_id: t.clndr_id,
      type: t.task_type,                                  // TT_Task | TT_Mile | TT_FinMile | TT_LOE
      status: STATUS[t.status_code] || 'not_started',
      orig_minutes: Math.round((Number(t.target_drtn_hr_cnt) || 0) * 60),
      remain_minutes: Math.round((Number(t.remain_drtn_hr_cnt) || 0) * 60),
      phys_pct: Number(t.phys_complete_pct) || 0,
      actual_start: parseDate(t.act_start_date),
      actual_finish: parseDate(t.act_end_date),
      constraint: CONSTRAINT[t.cstr_type] || null,
      constraint_date: parseDate(t.cstr_date),
      constraint2: CONSTRAINT[t.cstr_type2] || null,
      constraint2_date: parseDate(t.cstr_date2),
      // P6's own answer, kept so the engine can be marked against it.
      p6_early_start: parseDate(t.early_start_date),
      p6_early_finish: parseDate(t.early_end_date),
      p6_late_start: parseDate(t.late_start_date),
      p6_late_finish: parseDate(t.late_end_date),
      p6_total_float: t.total_float_hr_cnt === '' ? null
        : Math.round(Number(t.total_float_hr_cnt) * 60),
      target_start: parseDate(t.target_start_date),
      target_finish: parseDate(t.target_end_date),
    });
  }

  const links = [];
  let orphan = 0;
  for (const r of tables.TASKPRED || []) {
    const to = byId[r.task_id], from = byId[r.pred_task_id];
    if (!to || !from) { orphan++; continue; }
    links.push({
      from, to,
      type: LINK[r.pred_type] || 'FS',
      lag_minutes: Math.round((Number(r.lag_hr_cnt) || 0) * 60),
    });
  }

  return {
    data_date: parseDate(project.last_recalc_date) || parseDate(project.plan_start_date),
    plan_start: parseDate(project.plan_start_date),
    plan_finish: parseDate(project.plan_end_date),
    p6_finish: parseDate(project.scd_end_date),
    // How P6 was told to behave. The engine must be told the same, or it will
    // disagree with the programme everybody else is reading.
    retained_logic: opts.sched_retained_logic !== 'N',
    progress_override: opts.sched_progress_override === 'Y',
    lag_calendar: opts.sched_calendar_on_relationship_lag || 'rcal_Predecessor',
    float_from_project_end: opts.sched_use_project_end_date_for_float === 'Y',
    // Where float is measured to. With the project-end flag set — which is the
    // usual setting, and the one this job uses — P6 measures every activity's
    // float against the contract completion date, not against the date the
    // programme currently calculates. That is why float here is mostly
    // negative: the job is forecasting past its contract date.
    float_against: opts.sched_use_project_end_date_for_float === 'Y'
      ? parseDate(project.plan_end_date) : null,
    default_calendar: project.clndr_id,
    calendars, activities, links, orphan,
  };
}


/* ------------------------------------------------------------ the write */

// Same statements as tools/xer-logic.mjs toSql(), but bound, and in batches.
export async function applyLogic(env, pid, d) {
  const iso = (t) => (t ? isoMinute(t) : null);
  const num = (v) => (v === null || v === undefined || v === '' || !isFinite(Number(v)) ? null : Number(v));
  const st = [];
  st.push(env.DB.prepare('DELETE FROM links WHERE project_id = ?').bind(pid));
  st.push(env.DB.prepare('DELETE FROM calendars WHERE project_id = ?').bind(pid));
  for (const [id, cal] of Object.entries(d.calendars || {})) {
    st.push(env.DB.prepare('INSERT INTO calendars (project_id, id, name, day_minutes, data) VALUES (?,?,?,?,?)')
      .bind(pid, String(id), cal.name || null, num(cal.day_minutes), pack(cal)));
  }
  const seen = new Set();
  for (const l of d.links || []) {
    const k = l.from + '|' + l.to + '|' + l.type;
    if (seen.has(k)) continue; seen.add(k);
    st.push(env.DB.prepare('INSERT INTO links (project_id, from_id, to_id, type, lag_minutes) VALUES (?,?,?,?,?)')
      .bind(pid, l.from, l.to, l.type, num(l.lag_minutes)));
  }
  for (const a of d.activities || []) {
    st.push(env.DB.prepare(
      `UPDATE activities SET calendar_id = ?, act_type = ?, status = ?, orig_minutes = ?, remain_minutes = ?,
              phys_pct = ?, actual_start = ?, actual_finish = ?, constraint_type = ?, constraint_date = ?,
              p6_early_start = ?, p6_early_finish = ?, p6_total_float = ?
        WHERE project_id = ? AND id = ?`
    ).bind(a.calendar_id || null, a.type || null, a.status || null, num(a.orig_minutes), num(a.remain_minutes),
      num(a.phys_pct), iso(a.actual_start), iso(a.actual_finish), a.constraint || null, iso(a.constraint_date),
      iso(a.p6_early_start), iso(a.p6_early_finish), num(a.p6_total_float), pid, a.id));
  }
  st.push(env.DB.prepare(
    'UPDATE projects SET data_date = ?, default_calendar = ?, retained_logic = ?, contract_finish = ? WHERE id = ?'
  ).bind(iso(d.data_date), d.default_calendar || null, d.retained_logic ? 1 : 0,
    iso(d.float_against || d.plan_finish), pid));
  for (let i = 0; i < st.length; i += 100) await env.DB.batch(st.slice(i, i + 100));
  return { ok: true, links: seen.size, calendars: Object.keys(d.calendars || {}).length };
}
