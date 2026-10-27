// STEP 3 — the daily diary, checked before it is issued, and chased when missing.
//
//   diaryChecks   what stops a diary being submitted (blockers) and what the
//                 office should look at first (warnings)
//   diaryContext  the facts the checks compare against: yesterday's diary,
//                 today's site progress, today's photos
//   diaryStatus   the last N days: submitted / draft / missing / day off
//   todaysProgress the activities site reported on today — offered as lines
//                 for "Description of works"
//
// Nothing here writes. Friday is the site's day off unless the project says
// otherwise (projects.diary_off_days, e.g. "5" or "5,6"; 0 = Sunday).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const parse = (v, d) => { try { const j = JSON.parse(v || ''); return j == null ? d : j; } catch (e) { return d; } };
const shift = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const dow = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function offDays(project) {
  const raw = project && project.diary_off_days;
  if (raw == null || raw === '') return [5];
  const list = String(raw).split(/[,\s]+/).map(Number).filter((n) => n >= 0 && n <= 6);
  return list;
}

const menOf = (staff) => (Array.isArray(staff) ? staff : []).reduce((s, r) => s + num(r.n), 0);

// The facts the checks need, gathered in three small queries.
export async function diaryContext(env, pid, day) {
  const prev = await env.DB.prepare(
    `SELECT report_date, staff FROM diary WHERE project_id = ? AND report_date < ? ORDER BY report_date DESC LIMIT 1`
  ).bind(pid, day).first().catch(() => null);
  const progress = await todaysProgress(env, pid, day);
  const photos = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM photos WHERE project_id = ? AND (report_date = ? OR substr(created_at, 1, 10) = ?)`
  ).bind(pid, day, day).first().catch(() => null);
  return {
    prev_date: prev ? prev.report_date : null,
    prev_men: prev ? menOf(parse(prev.staff, [])) : null,
    progress,
    photos: Number((photos && photos.n) || 0),
  };
}

// The activities site updated on this day, latest update per activity.
export async function todaysProgress(env, pid, day) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT u.activity_id, u.pct, u.status, u.submitted_by, a.name, a.discipline
         FROM updates u LEFT JOIN activities a ON a.project_id = u.project_id AND a.id = u.activity_id
        WHERE u.project_id = ? AND u.report_date = ? AND u.source = 'site'
          AND u.id = (SELECT MAX(id) FROM updates x WHERE x.project_id = u.project_id
                        AND x.activity_id = u.activity_id AND x.report_date = u.report_date)
        ORDER BY a.sort_order`
    ).bind(pid, day).all();
    return (results || []).map((r) => ({
      id: r.activity_id, name: r.name || r.activity_id, pct: num(r.pct), status: r.status || '',
      by: r.submitted_by || '', discipline: r.discipline || '',
    }));
  } catch (e) { return []; }
}

// d is the diary as loadDiary returns it; ctx from diaryContext.
export function diaryChecks(d, ctx) {
  const blockers = [], warnings = [];
  const men = menOf(d.staff);
  const subs = (d.subs || []).reduce((s, r) => s + (r.c !== undefined && r.c !== '' ? num(r.c) : num(r.s) + num(r.l)), 0);
  const works = (d.works || []).filter((w) => String(w.a || '').trim());
  const remark = String((d.remarks || '') + ' ' + (d.problems || '')).trim();
  const closed = /no work|site closed|holiday|stoppage|suspend|rain|weather/i.test(remark);

  if (!String(d.weather || '').trim()) blockers.push('Pick the weather.');
  if (!String(d.prepared_by || '').trim()) blockers.push('Say who prepared it.');
  if (men + subs === 0 && !closed) blockers.push('No manpower is recorded. Enter the headcount, or say in Remarks why nobody was on site.');
  // K13 (v5 A12, agreed 5 Oct): the diary has no work-done-against-activity
  // section for now, so an empty works list no longer stops a submission.

  const c = ctx || {};
  if (c.prev_men && men && Math.abs(men - c.prev_men) / c.prev_men > 0.5) {
    warnings.push('Own manpower is ' + men + ' against ' + c.prev_men + ' on ' + c.prev_date + ' — a change of more than half. Check the headcount.');
  }
  // No works section any more (Ajay, 6 Oct 2026, decision 12): nothing to
  // compare site's progress against, so no warning about it.
  if ((men + subs) && !c.photos) warnings.push('No site photos are recorded for this day.');
  if (!(d.tomorrow || []).some((w) => String(w.a || '').trim())) warnings.push('Nothing is planned for tomorrow.');
  return { blockers, warnings, ok: !blockers.length };
}

// The last `days` days, oldest first, ending on `today`.
export async function diaryStatus(env, pid, project, today, days = 14) {
  const from = shift(today, -(days - 1));
  const { results } = await env.DB.prepare(
    `SELECT report_date, status, prepared_by, submitted_at FROM diary WHERE project_id = ? AND report_date BETWEEN ? AND ?`
  ).bind(pid, from, today).all().catch(() => ({ results: [] }));
  const have = Object.fromEntries((results || []).map((r) => [r.report_date, r]));
  const off = offDays(project);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = shift(today, -i);
    const r = have[d];
    const started = String((project && project.created_at) || '').slice(0, 10);
    let status = r ? (r.status === 'submitted' ? 'submitted' : 'draft')
      : (started && d < started) ? 'off'                       // before the project was on the platform
      : (off.includes(dow(d)) ? 'off' : 'missing');
    if (d === today && status === 'missing') status = 'today';
    out.push({ date: d, day: DAYS[dow(d)].slice(0, 3), status, prepared_by: r ? r.prepared_by || '' : '' });
  }
  return {
    days: out,
    missing: out.filter((x) => x.status === 'missing').length,
    draft: out.filter((x) => x.status === 'draft' && x.date !== today).length,
    off_days: off.map((n) => DAYS[n]),
  };
}

export const isDate = (v) => DATE_RE.test(v || '');
