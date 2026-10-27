// K1: the priced BOQ and the BOM (v5 E7, E8) — every sheet and row read, the
// totals checked, lines with no rate or a wrong sum flagged and fixed or
// accepted with a reason, the PM's approval before an IPC is valued or an
// order recorded, BOM materials matched to BOQ lines, money exact to the fil
// (spec §27 rule 5), and nobody reaching another company's bill.
//   node tools/test-k1-bills.mjs
import { db, call, admin, as, check, done, onboard } from './_harness.mjs';
import { buildXlsx } from '../src/xlsx.js';
import { fils, lineAmount, milli, pctOf, toAED } from '../src/money.js';
import { readCsvText, mapBill, checkBill, readBillFile } from '../src/bills.js';

const b64 = (u8) => Buffer.from(u8).toString('base64');

console.log('— money in whole fils (§27 rule 5) —');
check('0.1 + 0.2 is 0.30 to the fil', fils('0.1') + fils('0.2') === fils('0.3'));
check('1.005 rounds half away from zero, as Excel ROUND does', fils('1.005') === 101 && fils(1.005) === 101);
check('a credit in brackets is negative', fils('(1,250.50)') === -125050);
check('qty × rate rounds once per line', lineAmount(milli('3.333'), fils('12.5')) === 4166);
check('5% of AED 50m is exact', pctOf(fils('50000000'), 5) === fils('2500000'));
check('a word is not a number', fils('Included') === null && fils('-') === null);

console.log('\n— reading: CSV quotes, every sheet, headings, totals —');
const csv = readCsvText('Material,Unit,Budget qty,BOQ ref\n"Concrete, grade C40",m3,100,C1\n"Rebar ""T16""",t,12.5,\n');
check('a quoted comma stays in its cell', csv.sheets[0].rows[1].cells[0] === 'Concrete, grade C40' && csv.sheets[0].rows[1].cells.length === 4, csv.sheets[0].rows[1]);
check('a doubled quote is one quote', csv.sheets[0].rows[2].cells[0] === 'Rebar "T16"');
check('an old .xls is refused with what to do', /save it as \.xlsx/.test(readBillFile('bill.xls', new Uint8Array([1])).error || ''));

// Two bill sheets, a summary that repeats them, a heading, a sub-total that
// adds up, a line whose sum is wrong and a line with no rate.
const H = ['Ref', 'Description', 'Unit', 'Qty', 'Rate', 'Amount'];
const bill = buildXlsx([
  { name: 'Summary', rows: [['Bill', 'Description', 'Amount'], ['1', 'Substructure', 14550], ['2', 'Finishes', 1000.3]] },
  { name: 'Bill 1', rows: [['Bill No. 1 — Substructure'], H,
    ['', 'EXCAVATION', '', '', '', ''],
    ['1.1', 'Excavate to reduce levels', 'm3', 100, 50.5, 5050],
    ['1.2', 'Concrete grade C40 in slab', 'm3', 10, 950, 9500],
    ['', 'Sub-total', '', '', '', 14550],
    ['1.3', 'Hardcore filling', 'm3', 20, 30, 650],           // 20 × 30 = 600, not 650
    ['1.4', 'Dewatering', 'item', 1, 'Included', '']] },
  { name: 'Bill 2', rows: [H,
    ['2.1', 'Paint, two coats', 'm2', 0.1, 1000, 100],
    ['2.2', 'Skirting', 'm', 0.2, 1000, 200],
    ['2.3', 'Plaster to walls', 'm2', 3.333, 210.3, 700.93]] },  // 700.9299 → 700.93
]);
const book = readBillFile('Priced BOQ.xlsx', bill);
const mapped = mapBill(book, 'boq');
const chk = checkBill(mapped, 'boq');
check('every sheet is reported', mapped.sheets.length === 3, mapped.sheets.map((s) => s.name + ': ' + s.status));
check('the summary sheet is read but not imported', /summary sheet/.test(mapped.sheets[0].status));
check('the title row above the header is skipped', mapped.sheets[1].header_row === 2, mapped.sheets[1]);
check('every priced line is read: 4 + 3', mapped.lines.length === 7, mapped.lines.map((l) => l.ref));
check('each line keeps its sheet and row', mapped.lines[0].sheet === 'Bill 1' && mapped.lines[0].row === 4, mapped.lines[0]);
check('the heading is reported as not read, with the reason', mapped.rows_not_read.some((r) => r.text === 'EXCAVATION' && r.why === 'heading'));
check('the sub-total is checked, not imported', chk.totals.checked_totals.length === 1 && chk.totals.checked_totals[0].ok, chk.totals.checked_totals);
check('the wrong sum is flagged at its row', chk.flags.some((f) => f.kind === 'wrong-sum' && f.row === 7 && /600\.00/.test(f.text)), chk.flags);
check('the rate written as a word is flagged', chk.flags.some((f) => f.kind === 'no-rate' && f.ref === '1.4'), chk.flags);
check('exactly two flags', chk.flags.length === 2, chk.flags.map((f) => f.kind));
const want = 505000 + 950000 + 65000 + 10000 + 20000 + 70093;   // in fils; 1.4 has no amount
check('the total matches the file to the fil', chk.totals.total_fils === want, chk.totals.total_fils + ' vs ' + want);

// A printed bill as consultants send them (the shape of a real B+G+5 bill):
// a title block above a header split over two rows, sections as headings,
// and the page's title and headings repeated at the top of every page.
const T1 = ['G F S REAL ESTATE L.L.C', '', '', 'BILL OF QUANTITIES', '', '', 'BILL NO.', 'PAGE NO.'];
const HD = [['ITEM', '', 'ITEM DESCRIPTION', '', 'QUANTITY', 'UNIT', 'UNIT', 'TOTAL PRICE'], ['REF.', '', '', '', '', '', 'RATE', 'AED']];
const printed = buildXlsx([{ name: 'Masonry', rows: [T1, ['PROPOSED RESIDENTIAL BUILDING'], ['ARCHITECTURAL WORKS', '', '', 'MASONRY WORK', '', '', '1/1', '1/1/1'], [], ...HD, [],
  ['', '', 'SECTION D - MASONRY WORK'], [], ['', '', 'Hollow Block Walls'], [],
  ['A', '', 'Walls, 150mm thick', '', 294, 'm2', '', ''], [], ['B', '', 'Walls, 200mm thick', '', 10304, 'm2', '', ''], [],
  ['', '', '', 'To Collection'], [], T1, ['PROPOSED RESIDENTIAL BUILDING'], ['ARCHITECTURAL WORKS', '', '', 'MASONRY WORK', '', '', '1/1', '1/1/2'], [], ...HD, [],
  ['', '', 'SECTION D - MASONRY WORK (CONT\'D)'], [], ['C', '', 'Walls, 100mm thick', '', 5447, 'm2', '', ''], [], ['', '', '', '', '', '', '', 'AED']] }]);
const pm = mapBill(readBillFile('bill.xlsx', printed), 'boq');
const pc = checkBill(pm, 'boq');
check('a printed bill: the header is found under the title block, over two rows', pm.sheets[0].header_row === '5–6' && pm.sheets[0].columns.rate === 'UNIT RATE' && pm.sheets[0].columns.ref === 'ITEM REF.', pm.sheets[0]);
check('only the three items are lines; the repeated page headings are not', pm.lines.map((l) => l.ref).join('') === 'ABC' && pm.rows_not_read.filter((r) => /page’s own heading/.test(r.why)).length >= 4, pm.lines.map((l) => l.ref));
check('each line is in the section heading above it', pm.lines[0].section === 'SECTION D - MASONRY WORK' && pm.lines[2].section === 'SECTION D - MASONRY WORK (CONT\'D)');
check('an unpriced bill is flagged for its rates and nothing else', pc.flags.length === 3 && pc.flags.every((f) => f.kind === 'no-rate'), pc.flags.map((f) => f.kind));

console.log('\n— through the platform —');
const { pid } = await onboard('Tower K', 'TWK-0001', [
  ['The QS', 'qs@towerk.test', ['commercial']], ['The Buyer', 'buyer@towerk.test', ['procurement']],
  ['The PM', 'pm@towerk.test', ['pm']], ['The Engineer', 'site@towerk.test', ['site']]]);
const L = await onboard('Tower L', 'TWL-0001', [['Other QS', 'qs@towerl.test', ['commercial']]]);

await as('site@towerk.test');
let r = await call('/api/bills');
check('a site engineer does not reach the bills', r.status === 403, r.status);
await as('buyer@towerk.test');
r = await call('/api/bills/upload', { kind: 'boq', filename: 'Priced BOQ.xlsx', data: b64(bill) });
check('Procurement does not import the priced BOQ', r.status === 403, r.text);

await as('qs@towerk.test');
r = await call('/api/bills/upload', { kind: 'boq', filename: 'Priced BOQ.xlsx', data: b64(bill) });
const first = r.json;
check('the QS uploads: lines, total and flags come back', r.status === 200 && first.line_count === 7 && first.flags_open === 2 && first.total === '16,200.93', r.text.slice(0, 300));
check('kept against the file’s SHA-256 and the reader version', /^[0-9a-f]{64}$/.test(first.sha256) && first.reader === 'bills-v1');
r = await call('/api/bills/upload', { kind: 'boq', filename: 'Priced BOQ.xlsx', data: b64(bill) });
check('the same file gives the same result', r.json.sha256 === first.sha256 && r.json.total === first.total && JSON.stringify(r.json.flags.map((f) => f.id)) === JSON.stringify(first.flags.map((f) => f.id)));
check('a new upload replaces the one waiting', db.prepare("SELECT status FROM bill_imports WHERE id = ?").get(first.id).status === 'replaced');
const id = r.json.id;
r = await call('/api/attention');
check('the waiting check is in the QS’s Needs my attention', (r.json.items || []).some((i) => i.kind === 'bill' && /2 flagged lines/.test(i.need)), r.text.slice(0, 300));
r = await call('/api/bills/commit', { id });
check('nothing is imported while a flag is open', r.status === 409 && /neither fixed nor accepted/.test(r.json.error), r.text);
check('and nothing reached the bill', db.prepare('SELECT COUNT(*) AS n FROM boq WHERE project_id = ?').get(pid).n === 0);
r = await call('/api/bills/accept', { id, all: true, note: '' });
check('accepting needs a reason', r.status === 400 && /say why/.test(r.json.error), r.text);
const wrong = r.json && first.flags.find((f) => f.kind === 'wrong-sum');
r = await call('/api/bills/accept', { id, flags: [wrong.id], note: 'Amount agreed at tender; the quantity is provisional' });
check('one flag accepted, with who and why', r.status === 200 && r.json.flags_open === 1 && r.json.flags.find((f) => f.id === wrong.id).accepted.by === 'The QS', r.text.slice(0, 300));
r = await call('/api/bills/accept', { id, kind: 'no-rate', note: 'Dewatering included in the preliminaries' });
check('the rest accepted by kind', r.json.flags_open === 0 && r.json.ready === true);
r = await call('/api/bills/commit', { id });
check('then imported, and waiting for the PM', r.status === 200 && r.json.lines === 7 && r.json.state === 'pending', r.text);
r = await call('/api/boq');
check('the register total is the file’s total, to the fil', r.json.totals.value === 16200.93 && r.json.state === 'pending', r.json.totals);
check('each section carries its amount for the register', r.json.sections.every((s) => typeof s.amount === 'number'), r.json.sections);
r = await call('/api/ipc/propose', {});
check('no IPC is valued against a BOQ the PM has not approved', r.status === 400 && /waiting for the PM/.test(r.json.error), r.text);
r = await call('/api/bills/approve', { kind: 'boq' });
check('the QS cannot approve it', r.status === 403, r.status);

await as('pm@towerk.test');
r = await call('/api/attention');
check('it is in the PM’s Needs my attention', (r.json.items || []).some((i) => i.kind === 'bill' && i.page === '/bills' && /waiting for your approval/.test(i.title)), r.text.slice(0, 300));
r = await call('/api/bills');
check('the PM sees it pending and may approve', r.json.boq.state === 'pending' && r.json.may.approve === true && r.json.may.import_boq === false, r.text.slice(0, 200));
r = await call('/bills');
check('the BOQ & BOM page opens for the PM', r.status === 200 && r.text.includes('BOQ &amp; BOM'));
r = await call('/api/bills/approve', { kind: 'boq' });
check('the PM approves it', r.status === 200 && r.json.state === 'approved', r.text);
check('approval recorded with the name', db.prepare('SELECT boq_state, boq_approved_by FROM projects WHERE id = ?').get(pid).boq_approved_by === 'The PM');
await as('qs@towerk.test');
r = await call('/api/ipc/propose', {});
check('the IPC is valued once it is approved', r.status === 200 && !(r.json && r.json.boq_pending), r.text.slice(0, 200));
const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const boqNow = (await call('/api/boq')).json.lines;
const keyOf = (ref) => { const l = boqNow.find((x) => x.ref === ref); return (l.section || '').toLowerCase().trim() + '|' + (l.ref || '').toLowerCase().trim(); };
r = await call('/api/ipc', { reviewed: true, period_from: today.slice(0, 8) + '01', period_to: today,
  lines: [{ key: keyOf('1.3'), pct: 33.335 }, { key: keyOf('2.3'), pct: 50 }] });
// 650.00 × 33.335% = 216.6775 → 216.68; 700.93 × 50% = 350.465 → 350.47 (half away from zero)
check('the application is valued line by line to the fil', r.status === 200 && r.json.work_done === 567.15, r.text.slice(0, 300));
r = await call('/api/ipc/xlsx?ref=' + encodeURIComponent(r.json.ref || ''));
const sheet = Buffer.from(r.bytes).toString('latin1');
check('the workbook rounds each value to the fil', r.status === 200 && /ROUND\(F\d+\*I\d+,2\)/.test(sheet), r.status);
{ const ipcRef = db.prepare('SELECT ref FROM ipc ORDER BY rowid DESC').get().ref; const pk = await call('/api/ipc/pack?ref=' + encodeURIComponent(ipcRef));
  check('the full IPC pack downloads as a zip (the covering letter in it)', pk.status === 200 && pk.bytes[0] === 0x50 && pk.bytes[1] === 0x4b, pk.status + ' ' + pk.text.slice(0, 120)); }
check('an accepted amount goes in as the bill’s own figure, not qty × rate', sheet.includes('<v>650</v>') && !/ROUND\(D7\*E7/.test(sheet));

console.log('\n— the BOM: matched to the BOQ, then approved —');
const bomCsv = new TextEncoder().encode('Material,Unit,Budget qty,BOQ ref,Discipline\n' +
  '"Ready-mix concrete, C40",m3,12,1.2,Structural\nHardcore,m3,25,,Civil\nScaffold tube,m,400,,Temporary works\n');
await as('buyer@towerk.test');
r = await call('/api/bills/upload', { kind: 'bom', filename: 'BOM.csv', data: b64(bomCsv) });
check('Procurement uploads the BOM: three materials, nothing flagged', r.status === 200 && r.json.line_count === 3 && r.json.flags_open === 0, r.text.slice(0, 300));
r = await call('/api/bills/commit', { id: r.json.id });
check('matched by reference, by name, and not at all', r.status === 200 && r.json.matched === 1 && r.json.proposed === 1 && r.json.unmatched === 2, r.text);
r = await call('/api/bom/order', { material: 'Hardcore', qty: 5 });
check('no order against a BOM the PM has not approved', r.status === 409 && /waiting for the PM/.test(r.json.error), r.text);
await as('pm@towerk.test');
r = await call('/api/bills/approve', { kind: 'bom' });
check('the PM cannot approve while materials are unmatched', r.status === 400 && /not matched/.test(r.json.error), r.text);
await as('buyer@towerk.test');
r = await call('/api/bills/match');
const hard = r.json.matching.lines.find((l) => l.mkey === 'hardcore');
check('the name match is a proposal, shown with the BOQ line', hard.state === 'proposed' && /Hardcore filling/.test(hard.links[0].boq_label), hard);
check('the discipline is kept', r.json.matching.lines.find((l) => l.mkey === 'scaffold tube').discipline === 'Temporary works');
r = await call('/api/bills/match', { mkey: 'Scaffold tube', not_in_boq: '' });
check('“not in the BOQ” needs a reason', r.status === 400, r.text);
r = await call('/api/bills/match', { mkey: 'Scaffold tube', not_in_boq: 'Temporary works — contractor’s own' });
r = await call('/api/bills/match', { mkey: 'hardcore', confirm: hard.links.map((l) => l.id) });
check('every material resolved', r.status === 200 && r.json.matching.open === 0, r.json.matching);
await as('pm@towerk.test');
r = await call('/api/bills/approve', { kind: 'bom' });
check('then the PM approves the BOM', r.status === 200 && r.json.state === 'approved', r.text);
await as('buyer@towerk.test');
r = await call('/api/bom/order', { material: 'Hardcore', qty: '0.1' });
r = await call('/api/bom/order', { material: 'Hardcore', qty: '0.2' });
r = await call('/api/bom');
const hl = r.json.lines.find((l) => l.mkey === 'hardcore');
check('0.1 + 0.2 ordered is 0.3, and 24.7 remain', hl.ordered_qty === 0.3 && hl.remaining === 24.7, hl);

console.log('\n— nobody reaches another company’s bill —');
await as('qs@towerl.test');
for (const [path, body] of [['/api/boq?project=' + pid], ['/api/bills?project=' + pid], ['/api/bom?project=' + pid],
  ['/api/boq/import', { project_id: pid, rows: [{ description: 'x', qty: 1, rate: 1 }] }],
  ['/api/bills/upload', { project_id: pid, kind: 'boq', filename: 'x.csv', data: b64(bomCsv) }]]) {
  r = await call(path, body);
  check('refused: ' + path, r.status === 403 && !/Hardcore/.test(r.text), r.status + ' ' + r.text.slice(0, 120));
}
r = await call('/api/boq');
check('their own bill is still theirs', r.status === 200 && r.json.lines.length === 0);

console.log('\n— the rows API, intake, and a bill from before approval —');
await admin();
r = await call('/api/boq/import', { project_id: L.pid, rows: [{ description: 'Piling', unit: 'nr', qty: 3, rate: 100, amount: 350 }] });
check('rows that do not add up come back with the flags', r.status === 409 && r.json.check && r.json.check.flags_open === 1, r.text.slice(0, 200));
r = await call('/api/boq/import', { project_id: L.pid, rows: [{ description: 'Piling', unit: 'nr', qty: 3, rate: 100, amount: 350 }], accept: { note: 'Lump sum agreed' } });
check('and are imported when accepted with a reason', r.status === 200 && r.json.lines === 1 && r.json.value === 350, r.text);

const flagged = buildXlsx([{ name: 'BOQ', rows: [H, ['1', 'Blockwork', 'm2', 10, 40, 500]] }]);
r = await call('/api/intake/batch', { project_id: L.pid, expect_files: 1 });
const batch = r.json.id;
await call('/api/intake/scan', { batch_id: batch, project_id: L.pid, filename: 'Priced BOQ.xlsx', path: '/BOQ', data: b64(flagged) });
const items = (await call('/api/intake/batch?id=' + batch)).json.items;
r = await call('/api/intake/commit', { batch_id: batch, ids: items.map((i) => i.id) });
const res = r.json.results.find((x) => x.ok);
check('a flagged bill from intake waits for the QS, nothing imported', res && /check/.test(res.where) && /flagged/.test(res.where), JSON.stringify(r.json.results));
check('the bill on the project is unchanged', db.prepare('SELECT COUNT(*) AS n FROM boq WHERE project_id = ?').get(L.pid).n === 1);
check('the check knows the intake batch', db.prepare("SELECT batch_id FROM bill_imports WHERE project_id = ? AND source = 'intake'").get(L.pid).batch_id === batch);

db.prepare('UPDATE projects SET boq_state = NULL WHERE id = ?').run(L.pid);
r = await call('/api/bills?project=' + L.pid);
check('a BOQ from before approval existed counts as approved', r.json.boq.state === 'approved' && r.json.boq.legacy === true, r.json.boq);
done();
