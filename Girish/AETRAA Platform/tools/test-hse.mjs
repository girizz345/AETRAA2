// THE HSE LOG AND THE SAFETY REPORT.
//
// The design's HSE report was invented from end to end — 108 men on site, 96%
// PPE, 142 days LTI-free, 0 incidents — and captioned "Generated from the HSE
// registers". This is a safety record. The one thing it must never do is give
// a client a number nobody entered.
//
//   node tools/test-hse.mjs
import { DatabaseSync } from 'node:sqlite';
import {
  ensureHseTable, saveHseLog, listHseLog, buildHseReport, hseReport, daysBetween, LOST_TIME,
} from '../src/hse.js';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + d : '')); if (!c) fails++; };

function makeDb() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql) => {
    const st = db.prepare(sql); let args = [];
    const api = { bind(...a) { args = a; return api; },
      async all() { return { results: st.all(...args), success: true }; },
      async first(c) { const r = st.get(...args) ?? null; return c && r ? r[c] : r; },
      async run() { st.run(...args); return { success: true, meta: {} }; } };
    return api;
  };
  return { prepare: stmt, async exec(s) { db.exec(s); return { count: 1 }; } };
}
const env = () => ({ DB: makeDb() });
const rec = (type, ref, on, data, status) => ({
  type, ref, title: ref + ' item', submitted: on, created_at: on + 'T08:00:00Z',
  data: data || {}, status: status || 'Open', cls: 'wp',
});
const stat = (r, k) => (r.stats.find((s) => s.k === k) || {});

// ---- days between -------------------------------------------------------
check('a day count is a whole number of days', daysBetween('2026-09-01', '2026-09-20') === 19);
check('the same day is zero', daysBetween('2026-09-20', '2026-09-20') === 0);
check('nonsense gives nothing, not a number', daysBetween('x', '2026-09-20') === null);

// ---- saving a day's log --------------------------------------------------
{
  const e = env();
  let r = await saveHseLog(e, 'p1', { log_date: '2026-09-20', men_on_site: 108,
    toolbox_talks: 2, toolbox_attended: 40, inductions: 3, ppe_checked: 50, ppe_compliant: 48 }, 'S. Rahman');
  check('a day is logged', r.ok === true, JSON.stringify(r));
  const rows = await listHseLog(e, 'p1', '2026-09-01', '2026-09-30');
  check('and reads back', rows.length === 1 && rows[0].men_on_site === 108, JSON.stringify(rows[0]));
  check('with the person who recorded it', rows[0].recorded_by === 'S. Rahman');

  // logging the same day again replaces it rather than doubling it
  await saveHseLog(e, 'p1', { log_date: '2026-09-20', men_on_site: 112 }, 'S. Rahman');
  const again = await listHseLog(e, 'p1', '2026-09-01', '2026-09-30');
  check('logging a day twice replaces it', again.length === 1 && again[0].men_on_site === 112,
    JSON.stringify(again.map((x) => x.men_on_site)));

  // the checks that stop a nonsense safety record
  r = await saveHseLog(e, 'p1', { log_date: '2026-09-21', ppe_checked: 10, ppe_compliant: 12 }, 'S');
  check('more passing the PPE check than were checked is refused', !!r.error, JSON.stringify(r));
  r = await saveHseLog(e, 'p1', { log_date: '2026-09-21', toolbox_talks: 0, toolbox_attended: 30 }, 'S');
  check('attendance against no toolbox talk is refused', !!r.error, JSON.stringify(r));
  check('another project sees none of it',
    (await listHseLog(e, 'p2', '2026-09-01', '2026-09-30')).length === 0);
}

// ======================================================================
// THE ONE THAT MATTERS: nothing entered must never read as a figure.
// ======================================================================
{
  const r = buildHseReport({ period: 'weekly', from: '2026-09-14', to: '2026-09-20',
    logs: [], records: [], project: { name: 'NAF Tower' } });
  check('with nothing logged, no statistic is invented',
    r.stats.filter((s) => s.v !== null).every((s) => s.v === 0),
    JSON.stringify(r.stats.map((s) => [s.k, s.v])));
  check('men, toolbox talks and PPE come back as nothing, not zero',
    stat(r, 'Toolbox talks').v === null && stat(r, 'PPE compliance').v === null &&
    stat(r, 'Inductions').v === null,
    'a blank a client reads as zero is worse than no report');
  check('the report says what is missing', r.missing.length > 0 && !r.complete,
    JSON.stringify(r.missing));
  check('and names the missing figures',
    r.missing.includes('Toolbox talks') && r.missing.includes('PPE compliance'), JSON.stringify(r.missing));

  check('with NO incident ever recorded there is no LTI-free count',
    stat(r, 'Days since a lost-time injury').v === null,
    'the design said 142 days on a project with no safety record at all');
  check('and it says why rather than showing a blank',
    /no lost-time injury has been recorded/i.test(stat(r, 'Days since a lost-time injury').note || ''),
    stat(r, 'Days since a lost-time injury').note);
}

// ---- the weekly report, with real material ------------------------------
{
  const logs = [
    { log_date: '2026-09-20', men_on_site: 108, toolbox_talks: 2, toolbox_attended: 40, inductions: 3, ppe_checked: 50, ppe_compliant: 48 },
    { log_date: '2026-09-19', men_on_site: 101, toolbox_talks: 1, toolbox_attended: 18, inductions: 2, ppe_checked: 40, ppe_compliant: 39 },
  ];
  const records = [
    rec('ptw', 'PTW-001', '2026-09-18', { 'Activity / type': 'Hot work' }, 'Awaiting HSE sign'),
    rec('ptw', 'PTW-002', '2026-09-16', {}, 'Closed out'),
    rec('obs', 'OBS-001', '2026-09-17', { Risk: 'High' }, 'Open'),
    rec('obs', 'OBS-002', '2026-09-15', { Risk: 'Low' }, 'Closed'),
    rec('incident', 'INC-001', '2026-09-16', { Type: 'Near-miss' }, 'Closed & recorded'),
    rec('incident', 'INC-002', '2026-06-01', { Type: LOST_TIME }, 'Closed & recorded'),
  ];
  const r = buildHseReport({ period: 'weekly', from: '2026-09-14', to: '2026-09-20',
    logs, records, project: { name: 'NAF Tower' } });

  check('toolbox talks are added up across the week', stat(r, 'Toolbox talks').v === 3, String(stat(r, 'Toolbox talks').v));
  check('and the attendance travels with them', /58 attended/.test(stat(r, 'Toolbox talks').note || ''),
    stat(r, 'Toolbox talks').note);
  check('inductions are added up', stat(r, 'Inductions').v === 5, String(stat(r, 'Inductions').v));
  check('PPE compliance is computed, not typed', stat(r, 'PPE compliance').v === '97%',
    stat(r, 'PPE compliance').v + ' — 87 of 90');
  check('and shows the sample it came from', /87 of 90/.test(stat(r, 'PPE compliance').note || ''),
    stat(r, 'PPE compliance').note);

  check('permits issued this week are counted', stat(r, 'Permits issued').v === 2, String(stat(r, 'Permits issued').v));
  check('observations this week are counted', stat(r, 'Observations').v === 2, String(stat(r, 'Observations').v));
  check('with how many were closed', /1 closed/.test(stat(r, 'Observations').note || ''), stat(r, 'Observations').note);
  check('near-misses are counted from the incidents', stat(r, 'Near-misses').v === 1, String(stat(r, 'Near-misses').v));

  check('the LTI-free count runs from the real lost-time injury',
    stat(r, 'Days since a lost-time injury').v === daysBetween('2026-06-01', '2026-09-20'),
    String(stat(r, 'Days since a lost-time injury').v));
  check('and says when it was', /last was 2026-06-01/.test(stat(r, 'Days since a lost-time injury').note || ''),
    stat(r, 'Days since a lost-time injury').note);
  check('a near-miss does NOT reset the lost-time counter',
    stat(r, 'Days since a lost-time injury').v > 100,
    'only a lost-time injury stops that clock');

  check('open observations are listed', r.open_observations.length === 1 &&
    r.open_observations[0].ref === 'OBS-001', JSON.stringify(r.open_observations));
  check('with their risk, from the record', r.open_observations[0].risk === 'High');
  check('open permits are listed', r.permits_open.length === 1 && r.permits_open[0].ref === 'PTW-001',
    JSON.stringify(r.permits_open));
  check('the report knows it is complete', r.complete === true && r.missing.length === 0,
    JSON.stringify(r.missing));
  check('and how many days were actually logged', r.days_logged === 2, String(r.days_logged));
}

// ---- the daily report ----------------------------------------------------
{
  const logs = [{ log_date: '2026-09-20', men_on_site: 108, toolbox_talks: 2, toolbox_attended: 40,
    ppe_checked: 50, ppe_compliant: 48 }];
  const records = [rec('ptw', 'PTW-001', '2026-09-18', {}, 'Work proceeds under permit')];
  const r = buildHseReport({ period: 'daily', from: '2026-09-20', to: '2026-09-20', logs, records });
  check('the daily report shows the men actually logged', stat(r, 'Men on site').v === 108);
  check('permits live counts the open ones, whenever they were raised',
    stat(r, 'Permits live').v === 1, String(stat(r, 'Permits live').v));
  check('nothing raised today counts as nothing raised today',
    stat(r, 'Observations raised').v === 0 && stat(r, 'Incidents').v === 0);

  const blank = buildHseReport({ period: 'daily', from: '2026-09-21', to: '2026-09-21', logs: [], records });
  check('a day nobody logged shows no men, not zero men', stat(blank, 'Men on site').v === null,
    'zero men on site is a claim; an unlogged day is not');
}

// ---- through the database ------------------------------------------------
{
  const e = env();
  await saveHseLog(e, 'p1', { log_date: '2026-09-20', men_on_site: 90, toolbox_talks: 1,
    toolbox_attended: 20, inductions: 1, ppe_checked: 20, ppe_compliant: 20 }, 'S');
  await saveHseLog(e, 'p1', { log_date: '2026-09-13', men_on_site: 80 }, 'S');   // outside the week
  const r = await hseReport(e, 'p1', 'weekly',
    [rec('obs', 'OBS-001', '2026-09-18', { Risk: 'Medium' }, 'Open')],
    { name: 'NAF Tower' }, '2026-09-20');
  check('the weekly window is seven days', r.from === '2026-09-14' && r.to === '2026-09-20',
    r.from + ' → ' + r.to);
  check('a day outside the window is not counted', r.days_logged === 1, String(r.days_logged));
  check('and its toolbox talks are not either', stat(r, 'Toolbox talks').v === 1, String(stat(r, 'Toolbox talks').v));
  check('PPE at 100% reads as 100%', stat(r, 'PPE compliance').v === '100%', stat(r, 'PPE compliance').v);
}

console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
