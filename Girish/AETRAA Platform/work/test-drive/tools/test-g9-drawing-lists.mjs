// G9 / E11: the designer's drawing list against the register — missing,
// changed, not listed; DC confirms, the PM approves, missing sheets become
// "awaited" and are retired when the sheet arrives. Also: a bill longer than
// 400 lines is imported whole (the probe used to stop at 400).
//   node tools/test-g9-drawing-lists.mjs
import { db, call, as, check, done, onboard } from './_harness.mjs';
import { buildXlsx } from '../src/xlsx.js';
import { readList, compareList, mapListColumns } from '../src/drawing-lists.js';
import { probe } from '../src/intake-probe.js';

const b64 = (u8) => Buffer.from(u8).toString('base64');

console.log('— reading a list —');
check('the columns are found by their headings', JSON.stringify(mapListColumns(['Drawing No', 'Title', 'Rev', 'Date', 'Discipline', 'Status'])) ===
  JSON.stringify({ number: 0, title: 1, revision: 2, date: 3, discipline: 4, status: 5 }));
const rd = readList(['Dwg No', 'Description', 'Revision'], [['ST-101', 'Plan', 'C'], ['', 'blank', 'A'], ['ST-101', 'again', 'D'], ['X', 'odd', 'A'], ['ST-102', 'Section', 'Rev A']]);
check('every line is read or not read, with the reason', rd.rows.length === 5 && rd.rows.filter((r) => !r.read).length === 3, rd.rows);
check('a line listed twice keeps the first', rd.rows[2].read === false && /listed twice/.test(rd.rows[2].reason));
check('"Rev A" is read as A', rd.rows[4].revision === 'A');
const cmp = compareList(rd.rows, [{ number: 'ST-101', revision: 'B', title: 'Plan', status: 'current' }, { number: 'AR-9', revision: 'A', status: 'current' }]);
check('a listed sheet at another revision is "changed"', cmp.changed.length === 1 && cmp.changed[0].number === 'ST-101' && cmp.changed[0].register_revision === 'B');
check('a listed sheet not in the register is "missing"', cmp.missing.length === 1 && cmp.missing[0].number === 'ST-102');
check('a register sheet not on the list is "not listed"', cmp.not_listed.length === 1 && cmp.not_listed[0].number === 'AR-9');
check('the same list gives the same comparison', JSON.stringify(compareList(rd.rows, [{ number: 'ST-101', revision: 'B', title: 'Plan', status: 'current' }, { number: 'AR-9', revision: 'A', status: 'current' }])) === JSON.stringify(cmp));

console.log('\n— through the platform —');
const { pid } = await onboard('Tower L', 'TWL-0001', [['L DC', 'dc@towerl.test', ['dc']], ['L PM', 'pm@towerl.test', ['pm']]]);
const ins = db.prepare(`INSERT INTO drawings (project_id, id, number, revision, title, kind, status, uploaded_at) VALUES (?,?,?,?,?,?,?,?)`);
ins.run(pid, 'd1', 'ST-101', 'B', 'Ground floor plan', 'ifc', 'current', '2026-09-01');
ins.run(pid, 'd2', 'AR-201', 'A', 'Elevations', 'ifc', 'current', '2026-09-01');
ins.run(pid, 'd3', 'AR-999', 'A', 'Old sketch', 'ifc', 'current', '2026-09-01');
const list = buildXlsx([{ name: 'List', rows: [['Project drawing register'], [], ['Drawing No', 'Title', 'Rev', 'Date', 'Discipline', 'Status'],
  ['ST-101', 'Ground floor plan', 'C', '2026-10-01', 'Structural', 'IFC'],
  ['ST-102', 'First floor plan', 'A', '2026-10-01', 'Structural', 'IFC'],
  ['AR-201', 'Elevations', 'A', '2026-09-01', 'Architectural', 'IFC'],
  ['', 'no number', 'A', '', '', '']] }]);
await as('dc@towerl.test');
let r = await call('/api/drawing-lists', { filename: 'Drawing register.xlsx', data: b64(list) });
check('the DC drops the list and gets the comparison', r.status === 200 && r.json.comparison.counts.missing === 1 && r.json.comparison.counts.changed === 1 &&
  r.json.comparison.counts.same === 1 && r.json.comparison.counts.not_listed === 1, r.text.slice(0, 400));
const id = r.json.id;
check('the line with no number is reported, not dropped', r.json.rows.some((x) => !x.read && /no drawing number/.test(x.reason)));
r = await call('/api/drawing-lists/approve', { id });
check('the DC cannot approve it', r.status === 403, r.status);
r = await call('/api/drawing-lists/confirm', { id, exclude: [] });
check('the DC confirms the changes', r.status === 200 && r.json.state === 'confirmed', r.text);
await as('pm@towerl.test');
r = await call('/api/drawing-lists/approve', { id });
check('the PM approves: two sheets become awaited', r.status === 200 && r.json.result.awaited === 2, r.text);
const aw = db.prepare("SELECT number, revision FROM drawings WHERE project_id = ? AND status = 'awaited' ORDER BY number").all(pid);
check('ST-101 rev C and ST-102 rev A are awaited', JSON.stringify(aw) === JSON.stringify([{ number: 'ST-101', revision: 'C' }, { number: 'ST-102', revision: 'A' }]), aw);
check('the live ST-101 rev B is untouched', db.prepare("SELECT status FROM drawings WHERE id = 'd1'").get().status === 'current');
check('nothing on the register but not the list was changed', db.prepare("SELECT status FROM drawings WHERE id = 'd3'").get().status === 'current');
r = await call('/api/drawings');
check('the register shows the awaited sheets', (r.json.drawings || []).filter((d) => d.status === 'awaited').length === 2, r.text.slice(0, 200));
r = await call('/api/drawing', { number: 'ST-102', revision: 'A', title: 'First floor plan', kind: 'ifc', data: 'data:application/pdf;base64,' + b64(new Uint8Array([37, 80, 68, 70])) });
check('the real ST-102 is filed', r.status === 200 && r.json.ok, r.text);
check('and its awaited placeholder is gone', !db.prepare("SELECT id FROM drawings WHERE project_id = ? AND number = 'ST-102' AND status = 'awaited'").get(pid));

console.log('\n— a bill longer than 400 lines (E7) —');
const rows = [['Section', 'Ref', 'Description', 'Unit', 'Qty', 'Rate', 'Amount']];
for (let i = 1; i <= 650; i++) rows.push(['A', 'A' + i, 'Item ' + i, 'm3', 1, 10, 10]);
const bill = buildXlsx([{ name: 'BOQ', rows }]);
check('the probe still stops at 400 sheet rows for classification, and says so', probe('b.xlsx', bill).rows.length < 650 && probe('b.xlsx', bill).truncated === true);
check('an import reads every line', probe('b.xlsx', bill, { maxRows: 200000 }).rows.length === 650);
done();
