// K6 · v5 E12: past registers — the old system's RFI / submittal / material /
// NCR logs brought in by Document Control: read whole, mapped, statuses and
// dates settled, every row read / not read / held with the reason, confirmed
// as imported records (K5), deterministic, and a second import adds nothing.
//   node tools/test-k6-past-registers.mjs
import { db, call, admin, as, check, done, onboard } from './_harness.mjs';
import { buildXlsx } from '../src/xlsx.js';
import { readDate, proposeRows, guessMapping } from '../src/past-registers.js';
import { readBillFile } from '../src/bills.js';

const b64 = (u8) => Buffer.from(u8).toString('base64');

console.log('— dates, as logs write them —');
check('an Excel serial number (45658 is 1 January 2025)', readDate('45730').date === '2025-03-14' && readDate('45658').date === '2025-01-01');
check('the 1904 system', readDate('44268', { date1904: true }).date === '2025-03-14');
check('ISO', readDate('2025-03-13').date === '2025-03-13');
check('13/03/2025 can only be day first', readDate('13/03/2025').date === '2025-03-13' && readDate('13/03/2025').proves === 'dmy');
check('03/04/2025 reads two ways and says both', JSON.stringify(readDate('03/04/2025').both) === '["2025-04-03","2025-03-04"]');
check('…and one way once the order is known', readDate('03/04/2025', { order: 'dmy' }).date === '2025-04-03');
check('3-Apr-2025', readDate('3-Apr-2025').date === '2025-04-03');
check('“TBC” is not a date', readDate('TBC').bad === 'TBC');
check('a log’s running number is never its reference', guessMapping(['Sr', 'RFI No', 'Subject', 'Date Raised', 'Status']).ref === 1);

// An RFI log as an old system kept it.
const H = ['Sr', 'RFI No', 'Subject', 'Discipline', 'Date Raised', 'Reply Due', 'Date Replied', 'Status'];
const rows = [H];
for (let i = 1; i <= 50; i++) {
  const ref = 'RFI-' + String(i).padStart(4, '0');
  const raised = i % 5 === 0 ? String(45600 + i) : String((i % 27) + 1).padStart(2, '0') + '/' + '01/2025';   // serials and day-first
  rows.push([i, ref, 'Question ' + i, i % 2 ? 'Structural' : 'MEP', raised, '', i % 3 ? '20/02/2025' : '', ['Open', 'Closed', 'Answered', 'Awaiting reply'][i % 4]]);
}
rows[8][1] = 'RFI-0007';                    // listed twice: rows 8 and 9 of the sheet are RFI-0007
rows[12][7] = 'Pending with Arch';          // a status the platform does not know
rows[15][4] = 'TBC';                         // not a date
rows.splice(20, 0, ['', '', 'BLOCK A — FOUNDATIONS', '', '', '', '', '']);   // a heading
rows.splice(30, 0, ['', 'SUB-001', 'A submittal in the RFI log', '', '01/02/2025', '', '', 'Open']);
const log = buildXlsx([{ name: 'RFI Log', rows }]);

console.log('\n— Document Control reads the log —');
const { pid } = await onboard('Tower P', 'TWP-0001', [['The DC', 'dc@towerp.test', ['dc']], ['The Designer', 'design@towerp.test', ['design']], ['The Site', 'site@towerp.test', ['site']]]);
const other = await onboard('Tower Q', 'TWQ-0001', [['Other DC', 'dc@towerq.test', ['dc']]]);
await as('design@towerp.test');
await call('/api/records', { type: 'rfi', title: 'Raised here', data: { Subject: 'Raised here' } });      // RFI-0001, live
await as('site@towerp.test');
let r = await call('/api/past-registers/read', { filename: 'RFI log.xlsx', data: b64(log) });
check('a site engineer cannot bring logs in', r.status === 403, r.status);
await as('dc@towerq.test');
r = await call('/api/past-registers/read?p=' + pid, { filename: 'RFI log.xlsx', data: b64(log) });
check('another company’s DC cannot either', r.status === 403, r.status);
await as('dc@towerp.test');
r = await call('/past-registers');
check('the page opens for Document Control', r.status === 200 && r.text.includes('Past registers'));
r = await call('/api/past-registers/read', { filename: 'RFI log.xlsx', data: b64(log) });
const P = r.json;
check('the log is read as an RFI log from its references', r.status === 200 && P.type === 'rfi' && P.mapping.ref === 1 && P.mapping.status === 7, r.text.slice(0, 300));
check('every row is accounted for: read + not read + held + already = rows', P.adds_up && P.counts.rows === 52 && P.counts.read + P.counts.not_read + P.counts.held + P.counts.already === 52, P.counts);
const at = (ref) => P.rows.find((x) => x.ref === ref);
const why = (ref) => (at(ref) || {}).why || '';
check('a reference listed twice is held, both rows', P.rows.filter((x) => x.ref === 'RFI-0007').every((x) => x.outcome === 'held' && /listed twice/.test(x.why)));
check('a reference already raised here is held', at('RFI-0001').outcome === 'held' && /already on this project \(raised here\)/.test(why('RFI-0001')));
check('a status it does not know is held, by name', /Pending with Arch/.test(why('RFI-0012')) && at('RFI-0012').outcome === 'held');
check('a date that is not a date is held', at('RFI-0015').outcome === 'held' && /"TBC" is not a date/.test(why('RFI-0015')));
check('a heading is not read, with the reason', P.rows.some((x) => !x.ref && x.outcome === 'not read' && /heading/.test(x.why)));
check('a submittal reference in an RFI log is not read', at('SUB-001').outcome === 'not read' && /Submittal reference/.test(why('SUB-001')));
check('the log settles its own date order (13/01 can only be day first)', P.date_order === 'dmy' && at('RFI-0013').dates.raised === '2025-01-14');
check('serial dates are read as dates', at('RFI-0010').dates.raised === '2024-11-14', at('RFI-0010').dates);
check('statuses are normalised: Answered → Closed — answered, Awaiting reply → Open', at('RFI-0002').status === 'Closed — answered' && at('RFI-0003').status === 'Open');
check('the highest reference and the gaps in the sequence are reported', P.sequence.some((q) => q.prefix === 'RFI' && q.highest === 50 && q.missing.includes(8)), P.sequence);
const again = (await call('/api/past-registers/read', { filename: 'RFI log.xlsx', data: b64(log) })).json;
check('the same file read again returns the proposal already kept', again.id === P.id && again.kept === true);

console.log('\n— DC settles what was held, then confirms —');
r = await call('/api/past-registers/map', { id: P.id, status_map: { 'Pending with Arch': 'Open' } });
const P2 = r.json;
check('saying what “Pending with Arch” means reads that row', r.status === 200 && P2.id !== P.id && P2.rows.find((x) => x.ref === 'RFI-0012').outcome === 'read' && P2.counts.read === P.counts.read + 1, r.text.slice(0, 200));
r = await call('/api/past-registers/confirm', { id: P.id });
check('the replaced reading cannot be confirmed', r.status === 400, r.text);
r = await call('/api/past-registers/confirm', { id: P2.id });
check('confirming brings in every row read', r.status === 200 && r.json.created === P2.counts.read, r.text.slice(0, 200));
const rec = db.prepare("SELECT * FROM records WHERE project_id = ? AND ref = 'RFI-0012'").get(pid);
check('each is an imported record: closed, the old status and date kept', Number(rec.imported) === 1 && rec.status === 'Imported' && rec.original_status === 'Open' && rec.due === null, rec);
check('with where it came from: the log, the sheet, the row and the file’s hash', /"file":"RFI log.xlsx"/.test(rec.imported_from) && /"sheet":"RFI Log"/.test(rec.imported_from) && /"sha256":"[0-9a-f]{64}"/.test(rec.imported_from));
check('and its facts', JSON.parse(rec.data).Discipline && JSON.parse(rec.data)['Date raised']);
r = await call('/api/attention');
check('none of it is in Needs my attention', !(r.json.items || []).some((i) => /RFI-00(1[0-9]|[2-4][0-9])/.test(i.ref)));
await as('design@towerp.test');
r = await call('/api/records', { type: 'rfi', title: 'Next', data: { Subject: 'Next' } });
check('the next live RFI is numbered above the log', r.json.ref === 'RFI-0051', r.json.ref);

console.log('\n— a second import of the same log adds nothing —');
await as('dc@towerp.test');
r = await call('/api/past-registers/read', { filename: 'RFI log.xlsx', data: b64(log), status_map: { 'Pending with Arch': 'Open' } });
check('every row it brought in is “already imported from this log”', r.status === 200 && r.json.counts.read === 0 && r.json.counts.already === P2.counts.read, r.json.counts);
const before = db.prepare('SELECT COUNT(*) AS n FROM records WHERE project_id = ?').get(pid).n;
r = await call('/api/past-registers/confirm', { id: r.json.id });
check('confirming it creates nothing', r.status === 200 && r.json.created === 0 && db.prepare('SELECT COUNT(*) AS n FROM records WHERE project_id = ?').get(pid).n === before, r.text);

console.log('\n— a long log, and dates that read two ways —');
const long = [['Submittal No', 'Description', 'Date Submitted', 'Status', 'Code']];
for (let i = 1; i <= 450; i++) long.push(['SUB-' + String(i).padStart(3, '0'), 'Item ' + i, String(45500 + i), 'Returned', i % 2 ? 'A' : 'B']);
r = await call('/api/past-registers/read', { filename: 'Submittal log.xlsx', data: b64(buildXlsx([{ name: 'Log', rows: long }])), type: 'submittal' });
check('450 rows read whole (the old reader stopped at 400)', r.status === 200 && r.json.counts.rows === 450 && r.json.counts.read === 450, r.json.counts);
check('the code column gives the consultant’s code', r.json.rows[0].status === 'Code A — Approved' && r.json.rows[1].status === 'Code B — Approved as noted');
const amb = [['MAR No', 'Material', 'Date Submitted', 'Status'], ['MAR-001', 'Cement', '03/04/2025', 'Approved'], ['MAR-002', 'Rebar', '05/06/2025', 'Approved']];
r = await call('/api/past-registers/read', { filename: 'MAR log.xlsx', data: b64(buildXlsx([{ name: 'MAR', rows: amb }])) });
check('when nothing in the log settles the order, each such date is held with both readings', r.json.counts.held === 2 && /reads as 2025-04-03 or 2025-03-04/.test(r.json.rows[0].why), r.json.rows[0]);
r = await call('/api/past-registers/map', { id: r.json.id, date_order: 'dmy' });
check('DC says day first once, and they are read', r.json.counts.read === 2 && r.json.rows[0].dates.raised === '2025-04-03');

console.log('\n— refused —');
await admin();
await call('/api/setup/modules', { project_id: pid, modules: ['core', 'planning', 'site', 'design', 'dc', 'registers', 'gate'] });
await as('dc@towerp.test');
r = await call('/api/past-registers/read', { filename: 'NCR log.xlsx', data: b64(buildXlsx([{ name: 'NCR', rows: [['NCR No', 'Description', 'Date', 'Status'], ['NCR-001', 'Honeycombing', '13/01/2025', 'Closed']] }])) });
check('an NCR log while QA/QC is switched off', r.status === 403 && /not switched on/.test(r.json.error), r.text);
await as('dc@towerq.test');
r = await call('/api/past-registers/confirm', { id: P2.id });
check('another project’s log cannot be confirmed from here', r.status === 404, r.status);
r = await call('/api/past-registers/read', { filename: 'x.xls', data: b64(new Uint8Array([1, 2, 3])) });
check('an old .xls: save it as .xlsx', r.status === 400 && /\.xlsx/.test(r.json.error));

console.log('\n— deterministic —');
const book = readBillFile('RFI log.xlsx', log);
const one = proposeRows(book, null, { read_at: '2026-10-06T00:00:00Z' }, new Map());
const two = proposeRows(readBillFile('RFI log.xlsx', log), null, { read_at: '2026-10-06T00:00:00Z' }, new Map());
check('the same file gives the same proposal, row for row', JSON.stringify(one) === JSON.stringify(two) && one.rows.length === 52);
done();
