// K8 · v5 E15: two subcontractors' timesheets for one day fill the diary's
// manpower and give the exact HSE man-hours; every row reported; nothing
// guessed; the rest of the diary untouched; a submitted diary revised with a
// reason; the same sheet twice adds nothing.
//   node tools/test-k8-timesheets.mjs
import { db, env, call, admin, as, check, done, onboard } from './_harness.mjs';
import { buildXlsx } from '../src/xlsx.js';
import { readTimesheet, timeOf } from '../src/timesheets.js';
import { readBillFile } from '../src/bills.js';
import { hseFigures } from '../src/hse-monthly.js';

const b64 = (u8) => Buffer.from(u8).toString('base64');
const DAY = '2026-09-15';

console.log('— times —');
check('07:00 → 7 h, 16:30 → 16.5 h, an Excel fraction, 0730', timeOf('07:00') === 700 && timeOf('16:30') === 1650 && timeOf('0.375') === 900 && timeOf('0730') === 750);
check('4:30 pm', timeOf('4:30 pm') === 1650);

// Al Noor Scaffolding: one row per worker, hours three ways.
const sheetA = buildXlsx([{ name: 'Timesheet', rows: [
  ['DAILY TIMESHEET'], ['Subcontractor:', 'Al Noor Scaffolding'], ['Date:', '15/09/2026'], [],
  ['S.No', 'Name', 'Designation', 'Time In', 'Time Out', 'Normal', 'OT'],
  [1, 'Ravi', 'Foreman', '', '', 9, 1],
  [2, 'Anil', 'Scaffolder', '', '', 9, ''], [3, 'Raju', 'Scaffolder', '', '', 9, ''], [4, 'Sunil', 'Scaffolder', '', '', 9, ''],
  [5, 'Kumar', 'Scaffolder', '', '', 9, ''], [6, 'Babu', 'Scaffolder', '', '', 9, ''],
  [7, 'Mohan', 'Scaffolder', '07:00', '16:30', '', ''],
  [8, 'Shiv', 'Scaffolder', '', '', '', ''],
  ['', 'TOTAL', '', '', '', 54, 1],
  ['Prepared by: site foreman', '', '', '', '', '', '']] }]);
// Gulf Masonry: one row per trade.
const sheetB = buildXlsx([{ name: 'Sheet1', rows: [['Company: Gulf Masonry LLC'], ['Date: 15-Sep-2026'], [],
  ['Trade', 'No.', 'Hours'], ['Mason', 3, 7.5], ['Helper', 2, 8], ['Total', 5, '']] }]);

console.log('\n— reading —');
const A = readTimesheet(readBillFile('a.xlsx', sheetA));
const g = A.groups[0];
check('the subcontractor and the day are read from the sheet', g.subcontractor === 'Al Noor Scaffolding' && g.day === DAY, g);
check('one row per worker, grouped by trade and hours', g.layout === 'one row per worker' && JSON.stringify(g.lines) === JSON.stringify([
  { trade: 'Foreman', count: 1, hours: 10, man_hours: 10 }, { trade: 'Scaffolder', count: 5, hours: 9, man_hours: 45 }, { trade: 'Scaffolder', count: 1, hours: 9.5, man_hours: 9.5 }]), g.lines);
check('7 men, 64.5 man-hours, exactly', g.men === 7 && g.man_hours === 64.5);
check('a worker with no hours is held, with the reason', g.rows.some((r) => r.row === 13 && r.outcome === 'held' && /no hours/.test(r.why)));
check('the total and signature rows are not read', g.rows.some((r) => r.outcome === 'not read' && r.why === 'a total row') && g.rows.some((r) => r.why === 'a signature row'));
check('the same file reads the same way twice', JSON.stringify(readTimesheet(readBillFile('a.xlsx', sheetA))) === JSON.stringify(A));
const B = readTimesheet(readBillFile('b.xlsx', sheetB)).groups[0];
check('one row per trade: 3 masons × 7.5 h and 2 helpers × 8 h', B.subcontractor === 'Gulf Masonry LLC' && B.day === DAY && B.men === 5 && B.man_hours === 38.5, B);
const amb = readTimesheet(readBillFile('c.xlsx', buildXlsx([{ name: 'S', rows: [['Date: 03/04/2026'], ['Trade', 'No.', 'Hours'], ['Mason', 2, 8]] }]))).groups[0];
check('a date that reads two ways, and no subcontractor named, are held — never guessed', amb.day === null && amb.held.some((h) => /reads as 2026-04-03 or 2026-03-04/.test(h)) && amb.held.some((h) => /subcontractor/.test(h)), amb.held);

console.log('\n— into the diary —');
const { pid, oid } = await onboard('Tower T8', 'TT8-0001', [['The Engineer', 'site@tt8.test', ['site']], ['The HSE', 'hse@tt8.test', ['hse']], ['The PM', 'pm@tt8.test', ['pm']], ['The QS', 'qs@tt8.test', ['commercial']]]);
const other = await onboard('Tower U8', 'TU8-0001', [['Other site', 'site@tu8.test', ['site']]]);
// The site engineer prepares the diary as the person the PM assigned
// (only DC and the assignee save it: Ajay, 6 Oct 2026, decision 11).
await admin(); await call('/api/diary/assignee', { user_id: db.prepare('SELECT id FROM users WHERE email = ?').get('site@tt8.test').id });
await as('site@tt8.test');
let r = await call('/api/diary', { report_date: DAY, staff: [{ t: 'Site Engineer', n: 2, h: '8' }], plant: [{ t: 'Tower crane', n: 1, h: '9' }],
  subs: [{ n: 'Al Noor Scaffolding', t: 'Scaffolder', p: '', c: '9', h: '' }], works: [{ a: 'Scaffolding to L4', q: '' }], weather: 'Sunny', prepared_by: 'The Engineer' });
check('the day’s diary has its own staff, plant, works and yesterday’s scaffolding gang', r.status === 200, r.text);
await as('qs@tt8.test');
r = await call('/api/diary/timesheets/read', { filename: 'Al Noor.xlsx', data: b64(sheetA) });
check('a QS does not read timesheets', r.status === 403, r.status);
await as('site@tu8.test');
r = await call('/api/diary/timesheets/read?p=' + pid, { filename: 'Al Noor.xlsx', data: b64(sheetA) });
check('another company’s engineer cannot', r.status === 403, r.status);
await as('site@tt8.test');
r = await call('/timesheets');
check('the timesheets page opens for site', r.status === 200 && r.text.includes('Timesheets'));
r = await call('/api/diary/timesheets/read', { filename: 'Al Noor.xlsx', data: b64(sheetA) });
const RA = r.json;
check('site reads Al Noor’s sheet: kept against its hash', r.status === 200 && /^[0-9a-f]{64}$/.test(RA.sha256) && RA.groups[0].man_hours === 64.5, r.text.slice(0, 300));
r = await call('/api/diary/timesheets/read', { filename: 'Al Noor.xlsx', data: b64(sheetA) });
check('the same sheet again returns what was kept', r.json.id === RA.id && r.json.kept === true);
r = await call('/api/diary/timesheets/apply', { id: RA.id });
check('applied to the diary', r.status === 200 && r.json.applied[0].men === 7, r.text);
r = await call('/api/diary?date=' + DAY);
let d = r.json;
const al = d.subs.filter((s) => s.n === 'Al Noor Scaffolding');
check('Al Noor’s lines are the timesheet’s — yesterday’s 9-man line replaced, not added to', al.length === 3 && al.reduce((s, x) => s + Number(x.c), 0) === 7, d.subs);
check('and the rest of the diary is as it was: staff, plant, works, weather', d.staff.find((x) => x.t === 'Site Engineer').n === 2 && d.plant.find((x) => x.t === 'Tower crane').n === 1 && d.works[0].a === 'Scaffolding to L4' && d.weather === 'Sunny');
await as('hse@tt8.test');
r = await call('/api/diary/timesheets/read', { filename: 'Gulf Masonry.xlsx', data: b64(sheetB) });
r = await call('/api/diary/timesheets/apply', { id: r.json.id });
check('HSE applies Gulf Masonry’s sheet', r.status === 200, r.text);
check('the diary is still prepared by the engineer who wrote it', db.prepare('SELECT prepared_by FROM diary WHERE project_id = ? AND report_date = ?').get(pid, DAY).prepared_by === 'The Engineer');
const proj = db.prepare('SELECT * FROM projects WHERE id = ?').get(pid);
const hf = await hseFigures(env, pid, proj, '2026-09-01', '2026-09-30');
check('the HSE man-hours are exact: 2 × 8 own staff + 64.5 + 38.5 = 119', hf.man_hours.period === 119, hf.man_hours);
const mp = db.prepare("SELECT trade, headcount, subcontractor FROM manpower WHERE project_id = ? AND report_date = ? ORDER BY subcontractor, trade").all(pid, DAY);
check('the manpower log carries both subcontractors’ gangs beside own staff', mp.some((x) => x.subcontractor === 'Gulf Masonry LLC' && x.trade === 'Mason' && x.headcount === 3) && mp.some((x) => !x.subcontractor && x.trade === 'Site Engineer'), mp);
await as('site@tt8.test');
r = await call('/api/diary/timesheets/apply', { id: RA.id });
d = (await call('/api/diary?date=' + DAY)).json;
check('applying the same sheet twice adds nothing', d.subs.filter((s) => s.n === 'Al Noor Scaffolding').length === 3 && d.subs.filter((s) => s.n === 'Gulf Masonry LLC').length === 2);

console.log('\n— held until the person says —');
const unnamed = buildXlsx([{ name: 'S', rows: [['Date: 03/09/2026'], ['Trade', 'No.', 'Hours'], ['Painter', 4, 8]] }]);
r = await call('/api/diary/timesheets/read', { filename: 'painters.xlsx', data: b64(unnamed) });
const RU = r.json;
r = await call('/api/diary/timesheets/apply', { id: RU.id });
check('a sheet with no subcontractor and a two-way date is not put in the diary', r.status === 400 && /subcontractor/.test(r.json.error) && /reads as/.test(r.json.error), r.text);
r = await call('/api/diary/timesheets/read', { filename: 'painters.xlsx', data: b64(unnamed), subcontractor: 'Colour Coat', day: DAY });
check('once site says whose and which day, it reads', r.status === 200 && r.json.groups[0].held.length === 0 && r.json.id !== RU.id);

console.log('\n— a submitted diary is revised, with the reason —');
await as('pm@tt8.test');
r = await call('/api/diary', { report_date: DAY, submit: true });
check('the PM submits the diary', r.status === 200 && r.json.status === 'submitted', r.text.slice(0, 200));
await as('site@tt8.test');
const RC = (await call('/api/diary/timesheets/read', { filename: 'painters.xlsx', data: b64(unnamed), subcontractor: 'Colour Coat', day: DAY })).json;
r = await call('/api/diary/timesheets/apply', { id: RC.id });
check('a submitted diary is not changed without a reason', r.status === 400 && r.json.submitted === true, r.text);
r = await call('/api/diary/timesheets/apply', { id: RC.id, reason: 'Colour Coat sent their sheet late' });
check('with one, it is revised and the submitted version kept', r.status === 200 && r.json.applied[0].revised === true, r.text);
check('the diary stays submitted', db.prepare('SELECT status FROM diary WHERE project_id = ? AND report_date = ?').get(pid, DAY).status === 'submitted');
const kept = db.prepare('SELECT * FROM diary_versions WHERE project_id = ? AND report_date = ?').all(pid, DAY);
check('the version as submitted is kept, with who changed it and why', kept.length === 1 && /late/.test(kept[0].reason) && kept[0].kept_by === 'The Engineer' && !String(kept[0].row).includes('Colour Coat') && String(kept[0].row).includes('Gulf Masonry'), kept);

console.log('\n— the log, and the module wall —');
r = await call('/api/diary/manpower.xlsx?from=2026-09-01&to=2026-09-30');
const x = new TextDecoder().decode(r.bytes);
check('Manpower by trade and day downloads with the X1 header', r.status === 200 && x.includes('Manpower by trade and day') && x.includes('Al Noor Scaffolding') && x.includes('Colour Coat'));
await admin();
await call('/api/setup/modules', { project_id: pid, modules: ['core', 'planning', 'design', 'dc', 'registers', 'gate', 'hse'] });
await as('site@tt8.test');
r = await call('/api/diary/timesheets/read', { filename: 'Al Noor.xlsx', data: b64(sheetA) });
check('with the Site module off, timesheets are refused', r.status === 403 && /not switched on/.test(r.json.error), r.text);
done();
