// Reading the logic out of a P6 .xer.
//
//   node tools/xer-logic.mjs "MAJ-BL 114D.xer" --project=p1 > logic.sql
//
// Your converter already takes the activities. This takes the three things it
// left behind, which are the three things a forecast cannot be made without:
//
//   TASKPRED    what follows what, and by how long
//   CALENDAR    which days are worked, and which are Eid
//   TASK        the duration still to run, the constraints, and the status
//
// Nothing here interprets anything. It copies P6's own numbers across, so that
// the engine on the other side can be checked against P6's own answer.

import { readFileSync, writeFileSync } from 'node:fs';
import { isoMinute, pack } from '../src/calendar.js';

/* ------------------------------------------------------------ the reader */

export function readXer(buf) {
  const text = Buffer.isBuffer(buf) ? buf.toString('latin1') : String(buf);
  const tables = {};
  let cur = null, fields = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const p = line.split('\t');
    if (p[0] === '%T') { cur = p[1].trim(); tables[cur] = []; fields = null; }
    else if (p[0] === '%F') fields = p.slice(1).map((f) => f.trim());
    else if (p[0] === '%R' && cur && fields) {
      const row = {};
      for (let i = 0; i < fields.length; i++) row[fields[i]] = p[i + 1] === undefined ? '' : p[i + 1];
      tables[cur].push(row);
    }
  }
  return tables;
}

export { LINK, CONSTRAINT, STATUS, extract } from '../src/xer-logic.js';
import { extract } from '../src/xer-logic.js';

/* --------------------------------------------------------------- the SQL */

const q = (v) => v === null || v === undefined || v === ''
  ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
const n = (v) => (v === null || v === undefined || v === '' ? 'NULL' : Number(v));
const iso = (t) => (t ? q(isoMinute(t)) : 'NULL');

export function toSql(d, pid) {
  const out = [];
  out.push('-- logic, calendars and durations from P6');
  out.push(`DELETE FROM links WHERE project_id = ${q(pid)};`);
  out.push(`DELETE FROM calendars WHERE project_id = ${q(pid)};`);

  for (const [id, cal] of Object.entries(d.calendars)) {
    out.push(`INSERT INTO calendars (project_id, id, name, day_minutes, data) VALUES (` +
      `${q(pid)}, ${q(id)}, ${q(cal.name)}, ${n(cal.day_minutes)}, ${q(pack(cal))});`);
  }

  // Chunked, because D1 will not take an unbounded statement.
  const CHUNK = 200;
  for (let i = 0; i < d.links.length; i += CHUNK) {
    const vals = d.links.slice(i, i + CHUNK).map((l) =>
      `(${q(pid)}, ${q(l.from)}, ${q(l.to)}, ${q(l.type)}, ${n(l.lag_minutes)})`);
    out.push('INSERT OR IGNORE INTO links (project_id, from_id, to_id, type, lag_minutes) VALUES\n' +
      vals.join(',\n') + ';');
  }

  // The activity rows already exist — this fills in what they were missing.
  for (const a of d.activities) {
    out.push(`UPDATE activities SET calendar_id = ${q(a.calendar_id)}, ` +
      `act_type = ${q(a.type)}, status = ${q(a.status)}, ` +
      `orig_minutes = ${n(a.orig_minutes)}, remain_minutes = ${n(a.remain_minutes)}, ` +
      `phys_pct = ${n(a.phys_pct)}, ` +
      `actual_start = ${iso(a.actual_start)}, actual_finish = ${iso(a.actual_finish)}, ` +
      `constraint_type = ${q(a.constraint)}, constraint_date = ${iso(a.constraint_date)}, ` +
      `p6_early_start = ${iso(a.p6_early_start)}, p6_early_finish = ${iso(a.p6_early_finish)}, ` +
      `p6_total_float = ${n(a.p6_total_float)} ` +
      `WHERE project_id = ${q(pid)} AND id = ${q(a.id)};`);
  }

  out.push(`UPDATE projects SET data_date = ${iso(d.data_date)}, ` +
    `default_calendar = ${q(d.default_calendar)}, ` +
    `retained_logic = ${d.retained_logic ? 1 : 0}, ` +
    `contract_finish = ${iso(d.float_against || d.plan_finish)} WHERE id = ${q(pid)};`);

  return out.join('\n') + '\n';
}

/* ------------------------------------------------------------------ main */

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const pidArg = args.find((a) => a.startsWith('--project='));
  const pid = pidArg ? pidArg.split('=')[1] : null;
  const outArg = args.find((a) => a.startsWith('--out='));

  if (!file) {
    console.error('\n  node tools/xer-logic.mjs "programme.xer" --project=p1 --out=logic.sql\n');
    process.exit(1);
  }
  const d = extract(readXer(readFileSync(file)));

  const cals = Object.values(d.calendars);
  console.error(`\n  ${d.activities.length} activities, ${d.links.length} relationships, ` +
    `${cals.length} calendars`);
  console.error(`  data date ${isoMinute(d.data_date)}`);
  console.error(`  P6 finishes ${isoMinute(d.p6_finish)} against a plan of ${isoMinute(d.plan_finish)}`);
  console.error(`  scheduled with ${d.retained_logic ? 'retained logic' : 'PROGRESS OVERRIDE'}` +
    `${d.progress_override ? ' (progress override is on)' : ''}`);
  if (d.orphan) console.error(`  ${d.orphan} relationships point at activities not in this file`);
  for (const c of cals) {
    const days = c.week.filter((w) => w.length).length;
    console.error(`    ${c.name.padEnd(18)} ${days} days a week, ` +
      `${Object.values(c.exceptions).filter((e) => !e.length).length} holidays`);
  }

  if (!pid) {
    console.error('\n  Add --project=<id> to write the SQL.\n');
    process.exit(0);
  }
  const sql = toSql(d, pid);
  if (outArg) { writeFileSync(outArg.split('=')[1], sql); console.error(`\n  wrote ${outArg.split('=')[1]}\n`); }
  else process.stdout.write(sql);
}
