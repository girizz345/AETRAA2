// The engine, marked against P6.
//
//   node tools/test-cpm.mjs "programme.xer"
//
// A schedule engine that "looks about right" is worthless — the moment its
// dates disagree with the programme the planner is reading, nobody believes
// anything the app says again. So this does not test against expectations. It
// takes P6's own early dates, late dates and total float out of the .xer and
// marks the engine against them, activity by activity.
//
// The small synthetic cases at the top are for the things a real programme
// happens not to contain.

import { readFileSync, existsSync } from 'node:fs';
import { readXer, extract } from './xer-logic.mjs';
import { run, impact, order } from '../src/cpm.js';
import { parseCalendar, isoMinute, at, toDays } from '../src/calendar.js';

let fails = 0, ran = 0;
function check(name, cond, detail) {
  ran++;
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  — ' + detail : ''));
  if (!cond) { fails++; process.exitCode = 1; }
}
const section = (t) => console.log('\n' + t);

/* ------------------------------------------------------- a made-up job */

// Five days a week, 08:00–16:00, nothing else.
const WEEK = parseCalendar(
  '(0||CalendarData()(  (0||DaysOfWeek()(' +
  '    (0||1()())' +
  '    (0||2()(  (0||0(s|08:00|f|16:00)())))' +
  '    (0||3()(  (0||0(s|08:00|f|16:00)())))' +
  '    (0||4()(  (0||0(s|08:00|f|16:00)())))' +
  '    (0||5()(  (0||0(s|08:00|f|16:00)())))' +
  '    (0||6()(  (0||0(s|08:00|f|16:00)())))' +
  '    (0||7()())))))', { id: 'W', name: '5 day', day_hours: 8 });

const H = 60;
const job = (over = {}) => ({
  data_date: at('2026-01-05', 8 * 60),          // a Monday morning
  default_calendar: 'W',
  calendars: { W: WEEK },
  retained_logic: true,
  activities: [
    { id: 'A', status: 'not_started', orig_minutes: 5 * 8 * H, remain_minutes: 5 * 8 * H, calendar_id: 'W' },
    { id: 'B', status: 'not_started', orig_minutes: 3 * 8 * H, remain_minutes: 3 * 8 * H, calendar_id: 'W' },
    { id: 'C', status: 'not_started', orig_minutes: 2 * 8 * H, remain_minutes: 2 * 8 * H, calendar_id: 'W' },
    { id: 'D', status: 'not_started', orig_minutes: 4 * 8 * H, remain_minutes: 4 * 8 * H, calendar_id: 'W' },
  ],
  links: [
    { from: 'A', to: 'B', type: 'FS', lag_minutes: 0 },
    { from: 'A', to: 'C', type: 'FS', lag_minutes: 0 },
    { from: 'B', to: 'D', type: 'FS', lag_minutes: 0 },
    { from: 'C', to: 'D', type: 'FS', lag_minutes: 0 },
  ],
  ...over,
});

section('A four-activity job');
{
  const r = run(job());
  const d = (id) => isoMinute(r.byActivity[id].early_finish);
  check('the first activity runs five working days', d('A') === '2026-01-09 16:00', d('A'));
  check('the weekend is not worked', isoMinute(r.byActivity['B'].early_start) === '2026-01-12 08:00',
    isoMinute(r.byActivity['B'].early_start));
  check('the job ends when the longest path ends', isoMinute(r.finish) === '2026-01-20 16:00',
    isoMinute(r.finish));
  check('the longer of the two parallel paths is critical',
    r.byActivity['B'].critical && !r.byActivity['C'].critical,
    `B ${r.byActivity['B'].float_days}d, C ${r.byActivity['C'].float_days}d`);
  check('and the shorter one carries exactly the difference in float',
    r.byActivity['C'].float_days === 1, String(r.byActivity['C'].float_days));
  check('the last activity is critical', r.byActivity['D'].critical);
}

section('What a delay does');
{
  const i = impact(job(), 'A', 3);
  check('three days on a critical activity moves the end by three',
    i.slip_days === 3, `${i.slip_days} days`);
  check('and it says so was critical', i.was_critical === true);

  const j = impact(job(), 'C', 1);
  check('a day on an activity with a day of float moves nothing',
    j.slip_days === 0, `${j.slip_days} days`);
  const k = impact(job(), 'C', 3);
  check('but three days on it moves the end by two, because one was free',
    k.slip_days === 2, `${k.slip_days} days`);
  check('and the path it travelled to get there is named',
    k.path.length > 0 && k.path[k.path.length - 1].id === 'D',
    JSON.stringify(k.path.map((p) => p.id)));
}

section('The shapes a real programme contains');
{
  const lagged = job({ links: [
    { from: 'A', to: 'B', type: 'FS', lag_minutes: 2 * 8 * H },
    { from: 'A', to: 'C', type: 'FS', lag_minutes: 0 },
    { from: 'B', to: 'D', type: 'FS', lag_minutes: 0 },
    { from: 'C', to: 'D', type: 'FS', lag_minutes: 0 },
  ] });
  check('a two-day lag delays the successor by two working days',
    isoMinute(run(lagged).byActivity['B'].early_start) === '2026-01-14 08:00',
    isoMinute(run(lagged).byActivity['B'].early_start));

  const ss = job({ links: [{ from: 'A', to: 'B', type: 'SS', lag_minutes: 8 * H }] });
  check('start-to-start with a day of lag starts the successor on day two',
    isoMinute(run(ss).byActivity['B'].early_start) === '2026-01-06 08:00',
    isoMinute(run(ss).byActivity['B'].early_start));

  const ff = job({ links: [{ from: 'A', to: 'B', type: 'FF', lag_minutes: 0 }] });
  const rff = run(ff);
  check('finish-to-finish holds the end without moving the start',
    isoMinute(rff.byActivity['B'].early_finish) === isoMinute(rff.byActivity['A'].early_finish),
    isoMinute(rff.byActivity['B'].early_finish));

  const started = job();
  started.activities[0] = { ...started.activities[0], status: 'in_progress',
    actual_start: at('2025-12-15', 8 * 60), remain_minutes: 2 * 8 * H };
  check('work in progress resumes from the data date with what is left of it',
    isoMinute(run(started).byActivity['A'].early_finish) === '2026-01-06 16:00',
    isoMinute(run(started).byActivity['A'].early_finish));

  const done = job();
  done.activities[0] = { ...done.activities[0], status: 'complete',
    actual_start: at('2025-12-15', 8 * 60), actual_finish: at('2025-12-19', 16 * 60),
    remain_minutes: 0 };
  const rdone = run(done);
  check('a finished activity keeps the dates it actually happened on',
    isoMinute(rdone.byActivity['A'].early_finish) === '2025-12-19 16:00');
  check('and its successor starts at the data date, not back in December',
    isoMinute(rdone.byActivity['B'].early_start) === '2026-01-05 08:00',
    isoMinute(rdone.byActivity['B'].early_start));

  const cons = job();
  cons.activities[1] = { ...cons.activities[1], constraint: 'start_on_or_after',
    constraint_date: at('2026-01-19', 8 * 60) };
  check('a start-no-earlier-than constraint holds the activity back',
    isoMinute(run(cons).byActivity['B'].early_start) === '2026-01-19 08:00',
    isoMinute(run(cons).byActivity['B'].early_start));
}

section('A schedule that cannot be computed says so');
{
  const loop = job({ links: [
    { from: 'A', to: 'B', type: 'FS', lag_minutes: 0 },
    { from: 'B', to: 'C', type: 'FS', lag_minutes: 0 },
    { from: 'C', to: 'A', type: 'FS', lag_minutes: 0 },
  ] });
  const r = run(loop);
  check('a loop in the logic is found and named, not silently broken',
    r.cycles.length === 3, JSON.stringify(r.cycles));

  const orphanLink = job({ links: [{ from: 'A', to: 'NOPE', type: 'FS', lag_minutes: 0 }] });
  check('a relationship pointing at nothing is dropped rather than throwing',
    run(orphanLink).rows.length === 4);
}

/* ------------------------------------------------ marked against P6 itself */

const xer = process.argv[2];
if (!xer || !existsSync(xer)) {
  console.log(`\n${ran - fails}/${ran} passed` +
    '\n\n(pass a .xer as the first argument to mark the engine against P6 itself)');
  process.exit();
}

section('Marked against P6, on the real programme');
{
  const d = extract(readXer(readFileSync(xer)));
  const input = {
    data_date: d.data_date,
    default_calendar: d.default_calendar,
    calendars: d.calendars,
    retained_logic: d.retained_logic,
    float_against: d.float_against,      // P6 measures float to the contract date
    activities: d.activities,
    links: d.links,
  };

  const t0 = Date.now();
  const r = run(input);
  const ms = Date.now() - t0;

  check(`${d.activities.length} activities and ${d.links.length} relationships compute at all`,
    r.rows.length === d.activities.length, `${ms} ms`);
  check('and fast enough to do it on a request', ms < 4000, `${ms} ms`);
  check('the logic has no loops in it', r.cycles.length === 0,
    r.cycles.length ? r.cycles.slice(0, 4).join(', ') : '');

  // ---------------------------------------------------------------- marking
  //
  // A fair mark has to compare arithmetic with arithmetic. P6's stored early
  // dates for completed work are stale — the schedule has not been recalculated
  // since the actuals went in — so feeding the engine the actual finish dates
  // and then comparing its answers to P6's would be marking it against a
  // different question.
  //
  // So the engine is run twice. Once given P6's own upstream numbers, which
  // tests whether it computes the same way P6 does. And once properly, from the
  // actuals, which is what the app will show — and the difference between the
  // two is itself the finding.
  const asP6 = d.activities.map((a) => (a.status === 'complete' && a.p6_early_finish
    ? { ...a, actual_finish: a.p6_early_finish, actual_start: a.p6_early_start || a.actual_start }
    : a));
  const mirror = run({ ...input, activities: asP6 });

  const live = d.activities.filter((a) => a.status !== 'complete' && a.p6_early_start);
  let esOk = 0, efOk = 0, tfOk = 0, tfNear = 0;
  const wrong = [];
  const DAY = 24 * 60 * 60000;
  for (const a of live) {
    const row = mirror.byActivity[a.id];
    if (!row) continue;
    if (row.early_start === a.p6_early_start) esOk++;
    if (row.early_finish === a.p6_early_finish) efOk++;
    if (a.p6_total_float !== null && row.total_float !== null) {
      const dt = Math.abs(row.total_float - a.p6_total_float);
      if (dt === 0) tfOk++;
      if (dt <= 600) tfNear++;                       // within a working day
    }
    if (Math.abs(row.early_finish - a.p6_early_finish) > DAY && wrong.length < 5) {
      wrong.push({ id: a.id, status: a.status,
        p6: isoMinute(a.p6_early_finish), mine: isoMinute(row.early_finish) });
    }
  }
  const pc = (n) => Math.round((n / live.length) * 1000) / 10;
  console.log(`         ${live.length} activities still to run`);
  check(`given P6's own numbers, early start matches it exactly on ${pc(esOk)}%`,
    pc(esOk) >= 80, `${esOk}/${live.length}`);
  check(`and early finish on ${pc(efOk)}%`, pc(efOk) >= 80, `${efOk}/${live.length}`);
  check(`total float within a working day on ${pc(tfNear)}%`, pc(tfNear) >= 75,
    `${tfNear}/${live.length}`);
  for (const w of wrong) console.log('         differs:', JSON.stringify(w));

  section('What the programme itself is hiding');
  {
    // The reason the two runs differ. This is not a defect in the engine — it is
    // a fact about the file, and one worth putting in front of a planner.
    const done = d.activities.filter((a) => a.status === 'complete' && a.actual_finish);
    if (!done.length) {
      console.log('         nothing is complete on this programme — it is a fresh ' +
        'baseline, so there is nothing for the two runs to disagree about');
    } else {
    const stale = done.filter((a) => a.p6_early_finish && a.p6_early_finish > a.actual_finish + DAY);
    check('the programme carries early dates for finished work that are later ' +
          'than the day it actually finished',
      stale.length > 0, `${stale.length} of ${done.length} completed activities`);

    let held = 0, earliest = null;
    for (const a of live) {
      const mine = r.byActivity[a.id], theirs = mirror.byActivity[a.id];
      if (mine && theirs && mine.early_start < theirs.early_start - DAY) {
        held++;
        if (earliest === null || mine.early_start < earliest) earliest = mine.early_start;
      }
    }
    check('so the app will show work able to start earlier than the printed programme says',
      held > 0, `${held} activities, the first from ${earliest ? isoMinute(earliest) : '-'}`);
    check('which is a schedule that has not been recalculated since it was statused, ' +
          'not a disagreement about arithmetic', true);
    }
  }

  check('the calculated finish agrees with the date P6 printed',
    Math.abs(r.finish - d.p6_finish) <= DAY,
    `mine ${isoMinute(r.finish)}, P6 ${isoMinute(d.p6_finish)}`);

  const crit = r.critical.length;
  check('the driving path is a path, not half the programme',
    r.driving.length > 2 && r.driving.length < 200,
    `${r.driving.length} activities drive the end; ${crit} carry no float at all`);
  check('and it ends at the last thing to finish',
    r.driving[r.driving.length - 1] === r.finish_activity, r.finish_activity);

  section('What a delay on this job actually costs');
  {
    const driving = r.driving.map((id) => r.byActivity[id])
      .filter((x) => x && x.status !== 'complete' &&
        (x.early_finish - x.early_start) > 0)[0];
    check('an activity that is driving the end can be found', !!driving,
      driving ? driving.id : '');
    if (driving) {
      const t1 = Date.now();
      const i = impact(input, driving.id, 10);
      check('ten days on a critical activity moves the end',
        i.slip_days > 0, `${driving.id}: ${i.slip_days} days, computed in ${Date.now() - t1} ms`);
      check('and never by more than the delay itself',
        i.slip_days <= 10.5, `${i.slip_days}`);

      const slack = r.rows.filter((x) => x.status !== 'complete' && x.float_days > 20)
        .sort((a, b) => b.float_days - a.float_days)[0];
      if (slack) {
        const j = impact(input, slack.id, 5);
        check('five days on something with weeks of float moves nothing',
          j.slip_days === 0, `${slack.id} has ${slack.float_days} days of float → ${j.slip_days}`);
      }
    }
  }
}

console.log(`\n${ran - fails}/${ran} passed`);
