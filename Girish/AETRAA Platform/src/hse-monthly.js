// STEP 9 — the HSE figures a monthly report is judged on, from live records.
//
//   Man-hours     worked this period and since the project started. Taken, day
//                 by day, from the best record there is for that day:
//                   1. man-hours HSE entered from the time sheets (hse_log)
//                   2. the site diary: each trade × its own hours, plus
//                      subcontractor gangs × the standard day
//                   3. HSE's head count × the standard day
//                   4. site's manpower return × the standard day
//                 and the report says which basis carried how many days.
//   Incidents     by classification (fatality, lost-time, restricted work,
//                 medical treatment, first aid, near-miss, property damage,
//                 environmental, dangerous occurrence), with days lost.
//   Rates         LTIFR per 1,000,000 man-hours and TRIR per 200,000 (the OSHA
//                 basis), for the period and to date; severity rate; days and
//                 safe man-hours since the last lost-time injury.
//   Leading       toolbox talks, inductions, PPE compliance, observations raised
//                 / closed / open, permits by type.
//   Trend         the last twelve months.
//
// A figure with nothing behind it is null, and shown as a dash — never zero.

import { listRecords } from './records.js';
import { offDays } from './diary-checks.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dnum = (d) => Date.parse(d + 'T00:00:00Z') / 86400000;
const dstr = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
const num = (v) => { const n = Number(String(v == null ? '' : v).replace(/[, ]/g, '')); return Number.isFinite(n) ? n : 0; };
const parse = (v, d) => { try { const j = JSON.parse(v || ''); return j == null ? d : j; } catch (e) { return d; } };
const todayUAE = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);

export const DEFAULT_HOURS = 10;                // a standard UAE site day, overtime included
export const INCIDENT_TYPES = ['Near-miss', 'First aid', 'Medical treatment', 'Restricted work', 'Lost-time injury',
  'Fatality', 'Property damage', 'Environmental', 'Dangerous occurrence'];
const CLASS = [
  ['fatality', /fatal/i], ['lti', /lost.?time/i], ['rwc', /restricted/i], ['mtc', /medical/i],
  ['fac', /first.?aid/i], ['nm', /near.?miss/i], ['pd', /property/i], ['env', /environment/i], ['do', /dangerous/i],
];
export const classOf = (type) => (CLASS.find(([, re]) => re.test(String(type || ''))) || ['other'])[0];

export function hoursPerDay(project) {
  const t = parse(project && project.payment_terms, {});
  const h = num(t.hse_hours_per_day);
  return h > 0 && h <= 24 ? h : DEFAULT_HOURS;
}

// Man-hours for every day that has any record, and where each came from.
export async function dailyManHours(env, pid, project, to) {
  const H = hoursPerDay(project);
  const days = {};                               // date -> { mh, basis }
  const put = (d, mh, basis, rank) => {
    if (!DATE_RE.test(d || '') || d > to || !(mh > 0)) return;
    const cur = days[d];
    if (!cur || rank < cur.rank) days[d] = { mh, basis, rank };
  };
  try {
    const { results } = await env.DB.prepare(`SELECT * FROM hse_log WHERE project_id = ? AND log_date <= ?`).bind(pid, to).all();
    for (const r of results || []) {
      if (r.man_hours != null && r.man_hours !== '') put(r.log_date, num(r.man_hours), 'hse', 1);
      if (r.men_on_site != null && r.men_on_site !== '') put(r.log_date, num(r.men_on_site) * H, 'headcount', 3);
    }
  } catch (e) { /* no log table yet */ }
  try {
    const { results } = await env.DB.prepare(`SELECT report_date, staff, subs FROM diary WHERE project_id = ? AND report_date <= ?`).bind(pid, to).all();
    for (const r of results || []) {
      let mh = 0;
      for (const s of parse(r.staff, [])) mh += num(s.n) * (num(s.h) > 0 ? num(s.h) : H);
      for (const s of parse(r.subs, [])) mh += (s.c !== undefined && s.c !== '' ? num(s.c) : num(s.s) + num(s.l)) * H;
      put(r.report_date, mh, 'diary', 2);
    }
  } catch (e) { /* no diary */ }
  try {
    const { results } = await env.DB.prepare(
      `SELECT report_date, SUM(headcount) AS n FROM manpower WHERE project_id = ? AND report_date <= ? GROUP BY report_date`
    ).bind(pid, to).all();
    for (const r of results || []) put(r.report_date, num(r.n) * H, 'manpower', 4);
  } catch (e) { /* none */ }
  return { days, hours: H };
}

const incidentDate = (r) => {
  const d = String((r.data || {})['Date of incident'] || '').slice(0, 10);
  return DATE_RE.test(d) ? d : (r.sub || String(r.created_at || '').slice(0, 10));
};
const closedOn = (r) => {
  const wf = r.workflow || [];
  if ((r.step || 0) < wf.length - 1) return null;
  return String((wf[wf.length - 1] || {}).when || '').slice(0, 10) || null;
};

// The figures for any from–to window, with project-to-date alongside.
export async function hseFigures(env, pid, project, from, periodTo, opts) {
  const today = todayUAE();
  const to = periodTo > today ? (today < from ? from : today) : periodTo;
  const recs = (await listRecords(env, pid)) || [];
  const { days, hours } = await dailyManHours(env, pid, project, to);
  const inP = (d) => d && d >= from && d <= to;

  // ---- man-hours
  let mhPeriod = 0, mhToDate = 0;
  const basis = { hse: 0, diary: 0, headcount: 0, manpower: 0 };
  for (const [d, x] of Object.entries(days)) {
    mhToDate += x.mh;
    if (inP(d)) { mhPeriod += x.mh; basis[x.basis]++; }
  }
  // Working days in the window with no man-hours record at all.
  const off = offDays(project);
  const started = String((project && project.created_at) || '').slice(0, 10);
  const gaps = [];
  for (let n = dnum(from); n <= dnum(to); n++) {
    const d = dstr(n);
    if (started && d < started) continue;
    if (off.includes(new Date(n * 86400000).getUTCDay())) continue;
    if (!days[d]) gaps.push(d);
  }

  // ---- incidents
  const incidents = recs.filter((r) => r.type === 'incident').map((r) => ({
    ref: r.ref, title: r.title, date: incidentDate(r), type: (r.data || {}).Type || '', cls: classOf((r.data || {}).Type),
    days_lost: num((r.data || {})['Days lost'] || (r.data || {})['Days lost (lost-time injury)']), status: r.status || '',
  })).filter((i) => i.date && i.date <= to);
  const count = (list, c) => list.filter((i) => i.cls === c).length;
  const inPeriod = incidents.filter((i) => inP(i.date));
  const byClass = (list) => Object.fromEntries(['fatality', 'lti', 'rwc', 'mtc', 'fac', 'nm', 'pd', 'env', 'do', 'other'].map((c) => [c, count(list, c)]));
  const P = byClass(inPeriod), C = byClass(incidents);
  const ltiLike = (x) => x.fatality + x.lti;
  const recordable = (x) => x.fatality + x.lti + x.rwc + x.mtc;
  const rate = (n, mh, base) => (mh > 0 ? n * base / mh : null);
  const daysLostPeriod = inPeriod.filter((i) => i.cls === 'lti').reduce((s, i) => s + i.days_lost, 0);
  const daysLostToDate = incidents.filter((i) => i.cls === 'lti').reduce((s, i) => s + i.days_lost, 0);

  const ltis = incidents.filter((i) => i.cls === 'lti' || i.cls === 'fatality').map((i) => i.date).sort();
  const lastLti = ltis.length ? ltis[ltis.length - 1] : null;
  let safeMh = 0;
  for (const [d, x] of Object.entries(days)) if (!lastLti || d > lastLti) safeMh += x.mh;

  // ---- leading indicators
  let logs = [];
  try {
    ({ results: logs } = await env.DB.prepare(`SELECT * FROM hse_log WHERE project_id = ? AND log_date BETWEEN ? AND ?`).bind(pid, from, to).all());
  } catch (e) { logs = []; }
  const sum = (f) => { let any = false, s = 0; for (const r of logs || []) { if (r[f] == null || r[f] === '') continue; any = true; s += num(r[f]); } return any ? s : null; };
  const ppeChecked = sum('ppe_checked'), ppeOk = sum('ppe_compliant');
  const obs = recs.filter((r) => r.type === 'obs');
  const obsRaised = obs.filter((r) => inP(r.sub));
  const obsClosed = obs.filter((r) => inP(closedOn(r)));
  const obsOpen = obs.filter((r) => r.sub && r.sub <= to && !(closedOn(r) && closedOn(r) <= to));
  const closeDays = obsClosed.map((r) => dnum(closedOn(r)) - dnum(r.sub)).filter((n) => Number.isFinite(n));
  const permits = recs.filter((r) => r.type === 'ptw' && inP(r.sub));
  const permitTypes = {};
  for (const r of permits) { const k = (r.data || {})['Activity / type'] || 'Other'; permitTypes[k] = (permitTypes[k] || 0) + 1; }

  const out = {
    from, to, periodTo, running: to < periodTo, hours_per_day: hours,
    man_hours: { period: Math.round(mhPeriod), to_date: Math.round(mhToDate), basis, gaps, safe_since_lti: Math.round(safeMh) },
    incidents: { period: P, to_date: C, list: inPeriod.sort((a, b) => a.date.localeCompare(b.date)),
      days_lost_period: daysLostPeriod, days_lost_to_date: daysLostToDate },
    rates: {
      ltifr_period: rate(ltiLike(P), mhPeriod, 1e6), ltifr_to_date: rate(ltiLike(C), mhToDate, 1e6),
      trir_period: rate(recordable(P), mhPeriod, 2e5), trir_to_date: rate(recordable(C), mhToDate, 2e5),
      severity_to_date: rate(daysLostToDate, mhToDate, 2e5),
    },
    last_lti: lastLti, days_since_lti: lastLti ? dnum(to) - dnum(lastLti) : null,
    leading: {
      toolbox_talks: sum('toolbox_talks'), toolbox_attended: sum('toolbox_attended'), inductions: sum('inductions'),
      ppe_pct: ppeChecked ? Math.round(ppeOk / ppeChecked * 1000) / 10 : null, ppe_checked: ppeChecked,
      obs_raised: obsRaised.length, obs_closed: obsClosed.length, obs_open: obsOpen.length,
      obs_high_open: obsOpen.filter((r) => /high/i.test((r.data || {}).Risk || '')).length,
      obs_avg_close_days: closeDays.length ? Math.round(closeDays.reduce((s, n) => s + n, 0) / closeDays.length * 10) / 10 : null,
      permits: permits.length, permit_types: permitTypes,
    },
  };

  // ---- the last twelve months, for a monthly report
  if (opts && opts.trend) {
    const trend = [];
    const [y0, m0] = periodTo.slice(0, 7).split('-').map(Number);
    let cumMh = 0, cumLti = 0;
    const months = [];
    for (let k = 11; k >= 0; k--) {
      const dt = new Date(Date.UTC(y0, m0 - 1 - k, 1));
      months.push(dt.toISOString().slice(0, 7));
    }
    // Everything before the first month counts toward the cumulative rate.
    for (const [d, x] of Object.entries(days)) if (d < months[0] + '-01') cumMh += x.mh;
    cumLti = incidents.filter((i) => i.date < months[0] + '-01' && (i.cls === 'lti' || i.cls === 'fatality')).length;
    for (const mk of months) {
      const inM = (d) => d && d.slice(0, 7) === mk;
      let mh = 0;
      for (const [d, x] of Object.entries(days)) if (inM(d)) mh += x.mh;
      const inc = incidents.filter((i) => inM(i.date));
      const c = byClass(inc);
      cumMh += mh; cumLti += ltiLike(c);
      trend.push({ month: mk, man_hours: Math.round(mh), lti: ltiLike(c), recordable: recordable(c), near_miss: c.nm, first_aid: c.fac,
        observations: obs.filter((r) => inM(r.sub)).length, ltifr_cum: rate(cumLti, cumMh, 1e6) });
    }
    out.trend = trend;
  }
  return out;
}
