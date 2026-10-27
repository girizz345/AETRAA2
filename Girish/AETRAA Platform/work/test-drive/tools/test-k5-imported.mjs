// K5: records from the old system arrive closed (spec §3, §17): status
// Imported, the old status and dates kept as facts, no pending step, owner,
// due date or reply-by — so no clock anywhere counts them. They keep their own
// references, the platform numbers above them, they are marked on screen and in
// every export, and Document Control can take one over as a new live record.
//   node tools/test-k5-imported.mjs
import { db, env, call, admin, as, check, done, onboard, xlsxText } from './_harness.mjs';
import { importedNumber } from '../src/records.js';
import { registers, drawingsIssued } from '../src/report-extras.js';
import { approvedVariations } from '../src/ipc.js';
import { hseFigures } from '../src/hse-monthly.js';
import { markDrawingImported } from '../src/drawings.js';

const day = (n) => new Date(Date.now() + 4 * 3600000 + n * 86400000).toISOString().slice(0, 10);
const yearAgo = day(-365), halfYear = day(-180), today = day(0);

console.log('— the number the platform stays above —');
check('RFI-0042 → 42', importedNumber('rfi', 'RFI-0042') === 42);
check('a compound reference J179-RFI-ARC-0050 → 50', importedNumber('rfi', 'J179-RFI-ARC-0050') === 50);
check('a revision is not the number: "RFI 42 Rev 1" → 42', importedNumber('rfi', 'RFI 42 Rev 1') === 42);
check('a reference without the kind’s prefix sets nothing', importedNumber('rfi', 'MA-17') === null && importedNumber('rfi', '0042') === null);

console.log('\n— bringing the old registers in —');
const { pid } = await onboard('Tower M', 'TWM-0001', [
  ['The DC', 'dc@towerm.test', ['dc']], ['The PM', 'pm@towerm.test', ['pm']], ['The Designer', 'design@towerm.test', ['design']],
  ['The HSE', 'hse@towerm.test', ['hse']], ['The QS', 'qs@towerm.test', ['commercial']]]);
const other = await onboard('Tower N', 'TWN-0001', [['Other DC', 'dc@towern.test', ['dc']]]);
const OLD = [
  // An RFI that looks open, with a reply-by date a year gone.
  { type: 'rfi', ref: 'RFI-0042', title: 'Slab edge detail at grid C', original_date: yearAgo, original_status: 'Open — awaiting consultant reply',
    data: { Subject: 'Slab edge detail at grid C', 'Raised by': 'J. Old', 'Required reply by': day(-358), Discipline: 'Structural' },
    imported_from: { file: 'Old RFI log.xlsx', sheet: 'RFI', row: 43, sha256: 'ab12', reader: 'test' } },
  { type: 'rfi', ref: 'J179-RFI-ARC-0050', title: 'Facade bracket', original_date: halfYear, original_status: 'Closed' },
  { type: 'ptw', ref: 'PTW-007', title: 'Hot work level 3', original_date: day(-3), original_status: 'Live' },
  { type: 'incident', ref: 'INC-003', title: 'Fall from ladder', original_date: day(-2), original_status: 'Open', data: { Type: 'Lost-time injury', 'Days lost': 4 } },
  { type: 'variation', ref: 'VO-05', title: 'Extra basement pump', original_date: halfYear, original_status: 'Approved', data: { 'Approved amount (AED)': 125000 } },
  { type: 'authority', ref: 'AUTH-002', title: 'Dubai Municipality', original_date: halfYear, original_status: 'NOC issued' },
  { type: 'incoming', ref: 'IN-012', title: 'Engineer’s letter on access', original_date: day(-30), original_status: 'Awaiting reply', data: { From: 'Engineer' } },
];
await as('design@towerm.test');
let r = await call('/api/records/import', { records: OLD });
check('a designer does not bring the old registers in', r.status === 403, r.status);
await as('dc@towern.test');
r = await call('/api/records/import?p=' + pid, { records: OLD });
check('another company’s DC cannot import into this project', r.status === 403, r.status);
await as('dc@towerm.test');
r = await call('/api/records/import', { records: OLD });
check('Document Control imports seven records', r.status === 200 && r.json.imported.length === 7 && !r.json.refused.length, r.text.slice(0, 300));
check('the highest reference per kind is reported', r.json.highest.rfi && r.json.highest.rfi.highest === 50 && r.json.highest.rfi.next === 'RFI-0051', r.json.highest);
r = await call('/api/records/import', { records: [OLD[0], { type: 'rfi', ref: 'rfi-0042' }, { type: 'nope', ref: 'X-1' }, { type: 'rfi', ref: 'RFI-0099', original_date: '12/03/2025' }] });
check('nothing is filed twice, and each refusal says why', r.status === 400 && r.json.refused.length === 4 && r.json.refused[0].duplicate && r.json.refused[1].duplicate
  && /unknown record type/.test(r.json.refused[2].error) && /not a date/.test(r.json.refused[3].error), r.text.slice(0, 400));
const row = db.prepare("SELECT * FROM records WHERE project_id = ? AND ref = 'RFI-0042'").get(pid);
check('it is stored closed: status Imported, no due date, no reply-by basis', row.status === 'Imported' && row.due === null && row.due_basis === null && Number(row.imported) === 1, row);
check('the old status and date are kept as facts', row.original_status === 'Open — awaiting consultant reply' && row.original_date === yearAgo);
check('where it came from is kept', /Old RFI log\.xlsx/.test(row.imported_from) && /"row":43/.test(row.imported_from));

console.log('\n— no clock counts it —');
r = await call('/api/records');
const rfi = r.json.records.find((x) => x.ref === 'RFI-0042');
check('it has no next step and nobody can act on it', rfi.imported === true && rfi.next_step === null && rfi.can_act === false, rfi);
check('DC may take it over', rfi.may_take_over === true);
for (const who of ['dc@towerm.test', 'pm@towerm.test', 'hse@towerm.test', 'qs@towerm.test']) {
  await as(who);
  r = await call('/api/attention');
  check('nothing imported in ' + who.split('@')[0] + '’s Needs my attention', r.status === 200 && !(r.json.items || []).some((i) => /RFI-0042|PTW-007|INC-003|VO-05|IN-012|AUTH-002/.test(i.ref + ' ' + i.title)), r.text.slice(0, 300));
}
for (const [label, from, to] of [['the month it was raised', day(-372), day(-358)], ['a month in between', day(-200), day(-170)], ['the week it was imported', day(-6), today]]) {
  const g = await registers(env, pid, from, to);
  check('report figures leave it out — ' + label, g.totals.raised === 0 && g.totals.open === 0 && g.totals.closed === 0 && g.totals.overdue === 0 && !g.overdue.length, g.totals);
}
check('and count it on its own in the week it came in', (await registers(env, pid, day(-6), today)).totals.imported === 7);
await as('pm@towerm.test');
r = await call('/api/hse?period=weekly');
const st = Object.fromEntries((r.json.stats || []).map((s) => [s.k, s.v]));
check('an imported lost-time injury is not this project’s', st['Days since a lost-time injury'] === null && !(r.json.incidents || []).length, r.json.stats);
r = await call('/api/hse?period=daily');
check('an imported permit is not live', Object.fromEntries((r.json.stats || []).map((s) => [s.k, s.v]))['Permits live'] === 0 && !(r.json.permits_open || []).length);
const proj = db.prepare('SELECT * FROM projects WHERE id = ?').get(pid);
const hm = await hseFigures(env, pid, proj, day(-30), today);
check('nor in the monthly HSE figures', !JSON.stringify(hm).includes('INC-003'));
const vos = await approvedVariations(env, pid);
check('an imported variation posts nothing to the IPC', !vos.some((v) => v.ref === 'VO-05'));

console.log('\n— nothing is signed on it —');
await admin();
r = await call('/api/record/advance?p=' + pid, { ref: 'RFI-0042', action: 'advance' });
check('not even by AETRAA', r.status === 403 && /was imported from the old system/.test(r.json.error), r.text);
check('its status is untouched', db.prepare("SELECT status FROM records WHERE project_id = ? AND ref = 'RFI-0042'").get(pid).status === 'Imported');
await as('pm@towerm.test');
r = await call('/api/record/advance', { ref: 'RFI-0042', action: 'close' });
check('nor closed early by the PM', r.status === 403, r.status);
r = await call('/api/record/doc?ref=RFI-0042');
check('no platform form is generated for it', r.status === 409 && /imported/.test(r.json.error), r.text);

console.log('\n— numbering and the register —');
await as('design@towerm.test');
r = await call('/api/records', { type: 'rfi', title: 'New question', data: { Subject: 'New question' } });
check('the next live RFI is numbered above the imported ones', r.status === 200 && r.json.ref === 'RFI-0051', r.text.slice(0, 200));
await as('dc@towerm.test');
r = await call('/api/register/xlsx?reg=rfi');
const x = xlsxText(r.bytes);
check('the register export marks it', r.status === 200 && x.includes('imported — not raised on this platform') && x.includes('was &quot;Open — awaiting consultant reply&quot; in the old system'), r.status);
check('raised by and on are the old system’s, not the importer’s', x.includes('J. Old'));

console.log('\n— Document Control takes one over —');
await as('design@towerm.test');
r = await call('/api/records/take-over', { ref: 'RFI-0042' });
check('a designer cannot', r.status === 403, r.status);
await as('dc@towerm.test');
r = await call('/api/records/take-over', { ref: 'IN-012' });
check('an incoming letter is answered, not taken over', r.status === 400 && /reply letter/.test(r.json.error), r.text);
r = await call('/api/records/take-over', { ref: 'RFI-0042' });
check('a new live RFI, linked to the old one', r.status === 200 && r.json.ref === 'RFI-0052' && r.json.continues === 'RFI-0042', r.text.slice(0, 300));
const nu = r.json.record;
check('its clock starts fresh — nothing carried from the old reply-by', nu.due === null && !('Required reply by' in nu.data) && /RFI-0042/.test(nu.data.Continues) && nu.status !== 'Imported', nu);
check('it is live: waiting on the PM', nu.workflow.length > 1 && nu.workflow[1].state === 'now');
r = await call('/api/record?ref=RFI-0042');
check('the old one says where it continues', r.json.record.continued_by === 'RFI-0052' && r.json.record.may_take_over === false);
r = await call('/api/records/take-over', { ref: 'RFI-0042' });
check('it is not taken over twice', r.status === 400 && /already taken over as RFI-0052/.test(r.json.error), r.text);
r = await call('/api/records/take-over', { ref: 'RFI-0051' });
check('a live record is not “taken over”', r.status === 400, r.status);

console.log('\n— drawings and authorities —');
db.prepare('INSERT INTO drawings (project_id, id, number, revision, title, kind, status, uploaded_at) VALUES (?,?,?,?,?,?,?,?)')
  .run(pid, 'd1', 'AR-101', 'C', 'Ground floor plan', 'ifc', 'current', today + 'T08:00:00Z');
db.prepare('INSERT INTO drawings (project_id, id, number, revision, title, kind, status, uploaded_at) VALUES (?,?,?,?,?,?,?,?)')
  .run(pid, 'd2', 'AR-102', 'A', 'First floor plan', 'ifc', 'current', today + 'T08:00:00Z');
r = await markDrawingImported(env, pid, 'd1', { imported_from: 'Old drawing register.xlsx row 9', original_date: halfYear });
check('a sheet can be marked as imported', r.ok === true, r);
const iss = await drawingsIssued(env, pid, day(-6), today);
check('an imported sheet was not “issued this week”', iss.length === 1 && iss[0].number === 'AR-102', iss);
r = await call('/api/register/xlsx?reg=drawings');
check('the drawing register export marks it', r.status === 200 && xlsxText(r.bytes).includes('imported — not raised on this platform'));
await admin();
r = await call('/api/setup/authorities', { project_id: pid, authorities: [{ name: 'Dubai Municipality' }, { name: 'DEWA' }] });
check('seeding authorities does not add a second Dubai Municipality beside the imported one', r.status === 200 && r.json.added.length === 1 && r.json.already[0].ref === 'AUTH-002', r.text);
r = await call('/api/records/import?p=' + other.pid, { records: [{ type: 'rfi', ref: 'RFI-0042' }] });
check('the same reference on another project is that project’s own', r.status === 200 && r.json.imported[0] === 'RFI-0042', r.text);
done();
