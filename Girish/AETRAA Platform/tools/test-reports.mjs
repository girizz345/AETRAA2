// Exercises the report builder end to end against a throwaway SQLite database
// shaped exactly like the live one, so a broken query shows up here rather than
// in somebody's inbox.
//
//   node tools/test-reports.mjs            writes report-daily.html + report-monthly.html
//
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildReport, reportDocument, reportSubject } from '../src/report.js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));

// A D1 stand-in. Same three methods the Worker uses, nothing more.
const DB = {
  prepare(sql) {
    const st = db.prepare(sql);
    let args = [];
    const api = {
      bind(...a) { args = a; return api; },
      async all() { return { results: st.all(...args) }; },
      async first() { return st.get(...args) ?? null; },
      async run() { st.run(...args); return { success: true }; },
    };
    return api;
  },
};
const env = { DB };

/* ---------------------------------------------------------- fake project */

const PID = 'p1';
const DAY = '2026-09-11';
const MONTH = '2026-09';

db.prepare(`INSERT INTO projects (id, name, ref, target_name, target_deadline, sort_order, created_at)
            VALUES (?,?,?,?,?,1,datetime('now'))`)
  .run(PID, 'G+3P+4+R Building, Plot 6457759', 'Wadi Al Safa 03, Dubai',
       'Remaining work by 8 November', '2026-11-08');

const TRADES = ['Wooden Doors', 'HVAC Ducting', 'Gypsum Ceiling', 'Floor Tiles', 'Steel Fixing'];
const FLOORS = ['Ground Floor', 'Level 01', 'Level 02', 'Roof'];
const GROUPS = ['Drawings and Submittals', 'HVAC', 'Plaster Paint and Screed', 'Other Site Works'];

const actIns = db.prepare(
  `INSERT INTO activities (project_id, id, wbs, name, level, planned_start, planned_finish,
                           weight, trade, trade_group, floor, discipline, sort_order)
   VALUES (?,?,?,?,1,?,?,?,?,?,?,'Construction',?)`);
const updIns = db.prepare(
  `INSERT INTO updates (project_id, activity_id, report_date, pct, actual_start, actual_finish,
                        status, delay_reason, remarks, submitted_by, source, created_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
const tgtIns = db.prepare(
  `INSERT INTO targets (project_id, activity_id, target_group, work, level, days_left,
                        target_start, target_finish, sort_order)
   VALUES (?,?,?,?,?,?,?,?,?)`);

const N = 600;
for (let i = 1; i <= N; i++) {
  const id = 'ACT-' + String(i).padStart(4, '0');
  const start = new Date(Date.UTC(2026, 5, 1) + (i % 120) * 86400000).toISOString().slice(0, 10);
  const finish = new Date(Date.UTC(2026, 5, 1) + ((i % 120) + 14) * 86400000).toISOString().slice(0, 10);
  actIns.run(PID, id, 'Section ' + (1 + (i % 6)), 'Activity number ' + i, start, finish,
             5 + (i % 20), TRADES[i % TRADES.length], 'Civil', FLOORS[i % FLOORS.length], i);

  // A P6 snapshot, then daily site reports over the month.
  updIns.run(PID, id, '2026-08-31', i % 100, null, null, null, null, null, 'programme import', 'import',
             '2026-08-31T06:00:00Z');
  if (i % 3 === 0) {
    const d = '2026-09-' + String(1 + (i % 11)).padStart(2, '0');
    const pct = Math.min(100, (i % 100) + 20);
    const flag = i % 17 === 0;
    updIns.run(PID, id, d, pct, start, pct >= 100 ? d : null,
               flag ? ['delayed', 'at_risk', 'on_hold'][i % 3] : 'in_progress',
               flag ? ['Material not delivered', 'Access blocked', 'Drawing awaited'][i % 3] : null,
               flag ? 'Held up since last week' : '', 'Rakesh — Site Engineer', 'site',
               d + 'T13:00:00Z');
  }
  if (i % 4 === 0) {
    tgtIns.run(PID, id, GROUPS[(i / 4) % GROUPS.length], 'Work item ' + i, FLOORS[i % FLOORS.length],
               1 + (i % 9), '2026-09-01',
               new Date(Date.UTC(2026, 8, 1) + (i % 80) * 86400000).toISOString().slice(0, 10), i);
  }
}

const mpIns = db.prepare(
  `INSERT INTO manpower (project_id, report_date, trade, headcount, plant, submitted_by, created_at)
   VALUES (?,?,?,?,?,?,?)`);
for (let d = 1; d <= 12; d++) {
  const day = '2026-09-' + String(d).padStart(2, '0');
  for (const t of TRADES) {
    mpIns.run(PID, day, t, 4 + ((d * t.length) % 22), d % 4 === 0 ? 'Mobile crane, 2 hoists' : null,
              'Rakesh — Site Engineer', day + 'T13:00:00Z');
  }
}

const phIns = db.prepare(
  `INSERT INTO photos (id, project_id, activity_id, report_date, caption, mime, data, submitted_by, created_at)
   VALUES (?,?,?,?,?,?,?,?,?)`);
for (let i = 1; i <= 6; i++) {
  phIns.run('ph' + i, PID, 'ACT-' + String(i * 3).padStart(4, '0'), DAY,
            'Ceiling grid complete, level ' + i, 'image/jpeg', 'data:image/jpeg;base64,AA',
            'Rakesh — Site Engineer', DAY + 'T13:0' + i + ':00Z');
}

/* ------------------------------------------------------------------ run */

const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(PID);

function check(name, cond, detail) {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  — ' + detail : ''));
  if (!cond) process.exitCode = 1;
}

const daily = await buildReport(env, PID, project, 'daily', DAY);
console.log('\nDaily report — ' + DAY);
check('overall percent is a sane number', daily.now.pct > 0 && daily.now.pct <= 100, daily.now.pct.toFixed(2) + '%');
check('programme position computed', daily.now.planned > 0, daily.now.planned.toFixed(2) + '%');
check('activities reported today', daily.moved.length > 0, daily.moved.length + ' rows');
check('previous percent carried through', daily.moved.some((r) => r.before !== null));
check('flagged items separated out', daily.flagged.length > 0, daily.flagged.length);
check('target list counted', daily.target.total > 0,
      daily.target.open + ' open of ' + daily.target.total + ', ' + daily.target.missed + ' missed');
check('manpower picked up', daily.headcount > 0, daily.headcount + ' men');
check('yesterday compared', daily.headcountPrev > 0, daily.headcountPrev + ' yesterday');
check('photos listed', daily.photos.length === 6, daily.photos.length);
check('silent trades detected or all reported', Array.isArray(daily.silent), daily.silent.length + ' silent');

const monthly = await buildReport(env, PID, project, 'monthly', MONTH);
console.log('\nMonthly report — ' + MONTH);
check('month opened below where it closed', monthly.now.pct >= monthly.was.pct,
      monthly.was.pct.toFixed(2) + '% -> ' + monthly.now.pct.toFixed(2) + '%');
check('completions found', monthly.completed.length > 0, monthly.completed.length);
check('target groups ranked', monthly.target.groups.length > 0, monthly.target.groups.length + ' groups');
check('worst group first', monthly.target.groups.every((g, i, a) => i === 0 || a[i - 1].missed >= g.missed));
check('delay reasons grouped', monthly.reasons.length > 0,
      monthly.reasons.map((r) => r.reason + ' x' + r.n).join(', '));
check('man-days totalled', monthly.manpower.manDays > 0, monthly.manpower.manDays + ' man-days');
check('reporting days counted', monthly.discipline.daysReported > 0,
      monthly.discipline.daysReported + ' of ' + monthly.discipline.daysInMonth);

const weekly = await buildReport(env, PID, project, 'weekly', DAY);
console.log('\nWeekly report — ' + weekly.from + ' to ' + weekly.to);
check('weekly window is Monday to Sunday (7 days)',
      (Date.parse(weekly.to) - Date.parse(weekly.from)) / 86400000 === 6,
      weekly.from + ' … ' + weekly.to);
check('weekly starts on a Monday', new Date(weekly.from + 'T00:00:00Z').getUTCDay() === 1);
check('weekly rolls up progress', Number.isFinite(weekly.now.pct) && Number.isFinite(weekly.was.pct),
      weekly.was.pct.toFixed(1) + '% -> ' + weekly.now.pct.toFixed(1) + '%');
check('weekly re-uses the range builder shape', Array.isArray(weekly.target.groups) && 'manDays' in weekly.manpower);
check('weekly title names the week', /Weekly progress report/.test(weekly.title), weekly.title);
check('weekly subject names the week', /weekly report/.test(reportSubject(weekly)), reportSubject(weekly));

// A report that renders is not enough — it must not leak an unescaped tag or an
// undefined into the page.
for (const [name, d] of [['daily', daily], ['monthly', monthly], ['weekly', weekly]]) {
  const doc = reportDocument(d);
  writeFileSync(new URL(`../test-output/report-${name}.html`, import.meta.url), doc);
  console.log('\nRendered ' + name + ' — ' + (doc.length / 1024).toFixed(0) + ' KB');
  check('no undefined in the output', !/undefined/.test(doc));
  check('no NaN in the output', !/NaN/.test(doc));
  check('no empty cell placeholder', !/>null</.test(doc));
  check('has the project name', doc.includes('Plot 6457759'));
}

// An empty day must still produce a report, not an error.
const quiet = await buildReport(env, PID, project, 'daily', '2026-09-30');
console.log('\nA day with nothing reported');
check('builds without throwing', quiet.moved.length === 0, 'no movements');
check('still renders', reportDocument(quiet).includes('No progress was reported'));

console.log(process.exitCode ? '\nSome checks failed.\n' : '\nAll checks passed.\n');
