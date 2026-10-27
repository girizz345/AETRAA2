// THE MONTHLY PROGRAMME UPDATE — P6 → AETRAA.
//
// The Planning Engineer statuses the programme in Primavera P6 every month and
// uploads the updated .xer. This reads it, says plainly what changed since the
// last one (preview), and only then writes it (commit):
//
//   - activities are updated in place, matched on the P6 Activity ID, so every
//     site update, photo, issue and record against an activity stays with it;
//   - activities P6 no longer has are taken off the programme, but whatever site
//     recorded against them is kept;
//   - the logic, calendars, durations, status, actual dates and float are copied
//     from P6 (see xer-logic.js), so forecasts are P6's own;
//   - what the platform added itself (discipline, trade, floor set at set-up,
//     derived drawing / material / procurement deliverables) is kept.
//
// Nothing is written by preview. Commit refuses an upload that shares almost no
// Activity IDs with the current programme — that is a different project's file.

import { buildProgramme, saveProgramme } from './xer.js';
import { extract, applyLogic } from './xer-logic.js';

const d10 = (v) => (v == null || v === '' ? null : (typeof v === 'number' ? new Date(v).toISOString() : String(v)).slice(0, 10));
const days = (a, b) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 86400000) : 0);

async function current(env, pid) {
  const { results } = await env.DB.prepare(
    `SELECT id, name, wbs, discipline, trade, trade_group, floor, source, planned_finish,
            p6_early_finish, p6_total_float, status
       FROM activities WHERE project_id = ?`
  ).bind(pid).all();
  const progress = await env.DB.prepare(
    `SELECT activity_id, COUNT(*) AS n FROM updates WHERE project_id = ? GROUP BY activity_id`
  ).bind(pid).all().catch(() => ({ results: [] }));
  const withProgress = new Set((progress.results || []).map((r) => r.activity_id));
  const proj = await env.DB.prepare('SELECT data_date, contract_finish FROM projects WHERE id = ?').bind(pid).first();
  return { rows: results || [], withProgress, project: proj || {} };
}

// Work out everything, write nothing.
export async function analyseUpdate(env, pid, tables) {
  const built = buildProgramme(tables, {});
  if (built.error) return { error: built.error };
  const logic = extract(tables);
  const now = await current(env, pid);

  const old = new Map(now.rows.filter((r) => r.source !== 'derived').map((r) => [r.id, r]));
  const neu = new Map(built.activities.map((a) => [String(a.id), a]));
  const logicBy = new Map((logic.activities || []).map((a) => [a.id, a]));

  // Keep what the platform knew about each activity that P6 does not carry.
  for (const a of built.activities) {
    const o = old.get(String(a.id));
    if (!o) continue;
    if (!a.discipline && o.discipline) a.discipline = o.discipline;
    if (!a.trade && o.trade) a.trade = o.trade;
    if (!a.floor && o.floor) a.floor = o.floor;
  }

  const added = [...neu.keys()].filter((id) => !old.has(id));
  const removed = [...old.keys()].filter((id) => !neu.has(id));
  const kept = [...neu.keys()].filter((id) => old.has(id));
  const overlap = old.size ? kept.length / old.size : 1;

  const moved = [];
  let startedNow = 0, finishedNow = 0, negFloat = 0, newlyNeg = 0;
  for (const id of neu.keys()) {
    const L = logicBy.get(id) || {};
    const o = old.get(id);
    const newFin = d10(L.p6_early_finish);
    const fl = L.p6_total_float == null ? null : Math.round(L.p6_total_float / 60 / 8);   // minutes → ~working days
    if (fl != null && fl < 0) negFloat++;
    if (!o) continue;
    const oldFin = d10(o.p6_early_finish) || d10(o.planned_finish);
    const slip = days(oldFin, newFin);
    if (slip) moved.push({ id, name: neu.get(id).name, from: oldFin, to: newFin, days: slip });
    const oldFl = o.p6_total_float == null ? null : Math.round(o.p6_total_float / 60 / 8);
    if (fl != null && fl < 0 && (oldFl == null || oldFl >= 0)) newlyNeg++;
    if (L.status === 'in_progress' && o.status !== 'in_progress' && o.status !== 'complete') startedNow++;
    if (L.status === 'complete' && o.status !== 'complete') finishedNow++;
  }
  moved.sort((a, b) => b.days - a.days);

  const finishOf = (list) => list.filter(Boolean).sort().pop() || null;
  const newFinish = finishOf((logic.activities || []).map((a) => d10(a.p6_early_finish)));
  const oldFinish = finishOf(now.rows.filter((r) => r.source !== 'derived').map((r) => d10(r.p6_early_finish) || d10(r.planned_finish)));

  return {
    ok: true,
    built, logic,
    summary: {
      data_date: { from: d10(now.project.data_date), to: d10(logic.data_date) || built.dataDate },
      forecast_finish: { from: oldFinish, to: newFinish, days: days(oldFinish, newFinish) },
      contract_finish: d10(logic.float_against || logic.plan_finish) || d10(now.project.contract_finish),
      activities: { total: neu.size, before: old.size, added: added.length, removed: removed.length },
      removed_with_site_records: removed.filter((id) => now.withProgress.has(id)).length,
      started_since_last: startedNow,
      completed_since_last: finishedNow,
      negative_float: negFloat,
      newly_negative_float: newlyNeg,
      finish_later: moved.filter((m) => m.days > 0).length,
      finish_earlier: moved.filter((m) => m.days < 0).length,
      biggest_slips: moved.filter((m) => m.days > 0).slice(0, 10),
      added_sample: added.slice(0, 10).map((id) => ({ id, name: neu.get(id).name })),
      removed_sample: removed.slice(0, 10).map((id) => ({ id, name: old.get(id).name })),
      relationships: (logic.links || []).length,
      same_programme: old.size === 0 || overlap >= 0.3,
      overlap_pct: Math.round(overlap * 100),
    },
    removed,
  };
}

export async function commitUpdate(env, pid, tables) {
  const a = await analyseUpdate(env, pid, tables);
  if (a.error) return a;
  if (!a.summary.same_programme) {
    return { error: 'Only ' + a.summary.overlap_pct + '% of the Activity IDs in this file match the current programme — ' +
      'it looks like a different project’s file. Nothing was changed.' };
  }
  // Update / add first; only then take off what P6 no longer has — so a failure
  // part-way leaves the old programme, not a hole.
  const saved = await saveProgramme(env, pid, a.built.activities, { replace: false });
  if (saved.error) return saved;
  for (let i = 0; i < a.removed.length; i += 100) {
    await env.DB.batch(a.removed.slice(i, i + 100).map((id) =>
      env.DB.prepare(`DELETE FROM activities WHERE project_id = ? AND id = ? AND COALESCE(source,'programme') <> 'derived'`).bind(pid, id)));
  }
  const lg = await applyLogic(env, pid, a.logic);
  return { ok: true, summary: a.summary, saved: saved.saved, relationships: lg.links, calendars: lg.calendars };
}
