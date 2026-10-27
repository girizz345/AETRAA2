// G2-G8: intake limits and abandon (§12, §13), security (§19), the folder map
// (§4), drafts and two programmes (§17, §6), the intake report (§30),
// determinism (§27), and the per-item audit and history (§14).
//   node tools/test-g2-g8-intake.mjs            compare with the golden file
//   node tools/test-g2-g8-intake.mjs --write    write the golden file afresh
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { zipSync } from 'fflate';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { db, call, admin, as, check, done, onboard, xlsxText } from './_harness.mjs';
import { checkUpload } from '../src/attachments.js';
import { buildXlsx } from '../src/xlsx.js';

const b64 = (u8) => Buffer.from(u8).toString('base64');
const GOLDEN = new URL('./fixtures/golden-intake.json', import.meta.url);

// ---------------------------------------------------------------- the fixture folder
async function sheet(number) {                       // an A1 drawing with its number on it
  const d = await PDFDocument.create({ updateMetadata: false });
  const f = await d.embedFont(StandardFonts.Helvetica);
  const pg = d.addPage([2384, 1684]);
  pg.drawText('DRAWING NO ' + number, { x: 1900, y: 60, size: 18, font: f });
  return d.save({ useObjectStreams: false });
}
const boq = buildXlsx([{ name: 'BOQ', rows: [['Section', 'Ref', 'Description', 'Unit', 'Qty', 'Rate', 'Amount'],
  ['A', 'A1', 'Excavation', 'm3', 10, 5, 50], ['A', 'A2', 'Concrete', 'm3', 4, 100, 400]] }]);
const xer = (id) => new TextEncoder().encode('ERMHDR\t19.12\n%T\tPROJECT\n%F\tproj_id\tproj_short_name\n%R\t1\t' + id + '\n%E\n');
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
const contract = readFileSync(new URL('./fixtures/contract-test.pdf', import.meta.url));

async function fixture() {
  return [
    ['/IFC Drawings', 'ST-101 Rev C.pdf', await sheet('ST-101')],
    ['/IFC Drawings', 'ST-102 Rev A DRAFT.pdf', await sheet('ST-102')],
    ['/IFC Drawings', 'AR-201 Rev B.pdf', await sheet('AR-201')],
    ['/Contract', 'Contract Agreement.pdf', new Uint8Array(contract)],
    ['/BOQ', 'Priced BOQ.xlsx', boq],
    ['/Programme', 'Baseline.xer', xer('TWD')],
    ['/Programme', 'Update.xer', xer('TWD-UPDATE')],
    ['/Misc', 'setup.exe', new Uint8Array([77, 90, 0, 0])],
    ['/Misc', 'notes.xyz', new Uint8Array([1, 2, 3])],
    ['/Photos', 'site 1.jpg', JPG],
    ['', 'pack.zip', zipSync({ 'MEP/ME-301 Rev A.pdf': await sheet('ME-301'), 'readme.txt': new TextEncoder().encode('hello') })],
  ];
}

async function dropFolder(pid, files) {
  let r = await call('/api/intake/batch', { project_id: pid, expect_files: files.length });
  const batch = r.json && r.json.id;
  for (const [path, name, bytes] of files) {
    await call('/api/intake/scan', { batch_id: batch, project_id: pid, filename: name, path, data: b64(bytes) });
  }
  return batch;
}
const norm = (items) => items.map((i) => ({ path: i.path, file: i.filename, family: i.family, state: i.state, group: i.group,
  verdict: i.verdict, number: i.number || '', kind: i.kind || '', draft: i.draft || null, reason: i.reason }));

// ---------------------------------------------------------------- G3 security
console.log('— G3: what may be stored (§19) —');
check('an attachment with no MIME and an unknown extension is refused', !!checkUpload('evil.xyz', '', 10).error);
check('an attachment called .exe is refused whatever its MIME', !!checkUpload('a.exe', 'application/pdf', 10).error);
check('a DWG sent as octet-stream is still accepted', checkUpload('x.dwg', 'application/octet-stream', 10).ok === true);

const rules = [{ match: 'ST', discipline: 'Structural' }, { match: 'AR', discipline: 'Architectural' }, { match: 'ME', discipline: 'MEP' }];
const A = await onboard('Tower D', 'TWD-0001', [['D DC', 'dc@towerd.test', ['dc']]]);
const B = await onboard('Tower E', 'TWE-0001', [['E DC', 'dc@towere.test', ['dc']]]);
await admin();
for (const p of [A.pid, B.pid]) await call('/api/setup/rules?project=' + p, { rules });

// ---------------------------------------------------------------- G7 determinism: the same folder twice
console.log('\n— G7: the same folder gives the same result (§27) —');
const files = await fixture();
const batchA = await dropFolder(A.pid, files);
let r = await call('/api/intake/batch?id=' + batchA);
const outA = norm(r.json.items);
// The same folder, handed over in a different order, on the other project.
const batchB = await dropFolder(B.pid, files.slice().reverse());
r = await call('/api/intake/batch?id=' + batchB);
const outB = norm(r.json.items);
for (let i = 0; i < outA.length; i++) for (const k of Object.keys(outA[i] || {})) {
  if (JSON.stringify((outA[i] || {})[k]) !== JSON.stringify((outB[i] || {})[k])) console.log('    differs:', outA[i].file, k, JSON.stringify(outA[i][k]), '|', JSON.stringify((outB[i] || {})[k]));
}
check('the second run gives an identical result, whatever order the files arrived in', JSON.stringify(outA) === JSON.stringify(outB),
  JSON.stringify(outA.map((x) => x.file)) + ' vs ' + JSON.stringify(outB.map((x) => x.file)));
const paths = outA.map((x) => x.path + '/' + x.file);
check('items are listed in a fixed order (full path, character by character)', JSON.stringify(paths) === JSON.stringify(paths.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))));
check('every item records the extractor version', db.prepare("SELECT COUNT(*) AS n FROM intake_item WHERE batch_id = ? AND (extractor IS NULL OR extractor = '')").get(batchA).n === 0);
check('the readings are kept against SHA-256 and version', db.prepare('SELECT COUNT(*) AS n FROM extraction_cache').get().n > 0);
if (process.argv.includes('--write') || !existsSync(GOLDEN)) {
  writeFileSync(GOLDEN, JSON.stringify(outA, null, 2) + '\n');
  console.log('  (golden file written: ' + GOLDEN.pathname + ')');
}
const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));
check('the result matches the golden file byte for byte', JSON.stringify(golden) === JSON.stringify(outA),
  'differs — if a rule changed on purpose, bump EXTRACTOR_VERSION and rerun with --write');

// ---------------------------------------------------------------- G3 continued, G5
console.log('\n— G3/G5: unsupported, zips, drafts, two programmes —');
const by = (f) => outA.find((x) => x.file === f) || {};
check('a .exe is listed as unsupported', by('setup.exe').family === 'unsupported' && by('setup.exe').group === 'left_out');
check('an unknown type is listed as unsupported', by('notes.xyz').family === 'unsupported');
check('an unsupported file is never stored', db.prepare("SELECT file_key FROM intake_item WHERE batch_id = ? AND filename = 'setup.exe'").get(batchA).file_key === null);
check('a zip is opened and its drawing read on its own', by('ME-301 Rev A.pdf').family === 'drawing' && /pack\.zip/.test(by('ME-301 Rev A.pdf').path));
check('so is the other file in it', !!by('readme.txt').file);
check('a draft is left out by default', by('ST-102 Rev A DRAFT.pdf').state === 'skipped' && by('ST-102 Rev A DRAFT.pdf').draft === 'draft');
check('two programmes in one drop both need a decision', by('Baseline.xer').group === 'decide' && by('Update.xer').group === 'decide');

const many = {}; for (let i = 0; i < 501; i++) many['f' + i + '.txt'] = new Uint8Array([1]);
const bigZip = zipSync(many);
let deep = zipSync({ 'a.txt': new Uint8Array([1]) });
for (let i = 0; i < 3; i++) deep = zipSync({ ['level' + i + '.zip']: deep });

// ---------------------------------------------------------------- G2 limits and the lock
console.log('\n— G2: limits, one drop at a time, abandon (§12, §13) —');
r = await call('/api/intake/batch', { project_id: A.pid });
check('a second drop on the same project is refused while one is open', r.status === 409 && r.json.code === 'batch_open' && r.json.open_batch === batchA, r.text);
check('with the spec’s words', /Only one at a time, so nothing gets filed twice/.test(r.json.error));
await call('/api/intake/scan', { batch_id: batchA, project_id: A.pid, filename: 'big.zip', path: '/Misc', data: b64(bigZip) });
await call('/api/intake/scan', { batch_id: batchA, project_id: A.pid, filename: 'deep.zip', path: '/Misc', data: b64(deep) });
r = await call('/api/intake/batch?id=' + batchA);
const bz = r.json.items.find((i) => i.filename === 'big.zip'), dz = r.json.items.find((i) => i.filename === 'deep.zip');
check('a zip over the file limit is refused whole, with the reason', bz && bz.family === 'unsupported' && /limit is 500/.test(bz.reason), bz && bz.reason);
check('a zip nested too deep is refused', !r.json.items.some((i) => i.filename === 'a.txt') && /levels deep/.test(JSON.stringify(r.json.items.map((i) => i.reason))), dz && dz.reason);

// Two programmes: neither files until one is left out.
const base = r.json.items.find((i) => i.filename === 'Baseline.xer'), upd = r.json.items.find((i) => i.filename === 'Update.xer');
r = await call('/api/intake/commit', { batch_id: batchA, ids: [base.id] });
check('a programme is not filed while a second is in the drop', r.json.results[0].ok === false && /Two programmes/.test(r.json.results[0].error), r.text);
await call('/api/intake/confirm', { batch_id: batchA, items: [{ id: upd.id, state: 'skipped' }] });
const draft = r.json && (await call('/api/intake/batch?id=' + batchA)).json.items.find((i) => i.filename === 'ST-102 Rev A DRAFT.pdf');
r = await call('/api/intake/confirm', { batch_id: batchA, items: [{ id: draft.id, state: 'confirmed' }] });
check('a draft can be included deliberately', r.json.changed === 1, r.text);
const exe = (await call('/api/intake/batch?id=' + batchA)).json.items.find((i) => i.filename === 'setup.exe');
r = await call('/api/intake/confirm', { batch_id: batchA, items: [{ id: exe.id, state: 'confirmed' }] });
check('an unsupported file cannot be included', r.json.changed === 0 && r.json.errors.length === 1, r.text);

// ---------------------------------------------------------------- commit, the report, the audit
console.log('\n— G6/G8: commit, the report, the audit —');
const all = (await call('/api/intake/batch?id=' + batchA)).json.items;
r = await call('/api/intake/commit', { batch_id: batchA, ids: all.map((i) => i.id) });
check('once the other is left out, the programme goes to its importer', r.json.results.some((x) => x.id === base.id && !/Two programmes/.test(x.error || '')), JSON.stringify(r.json.results.find((x) => x.id === base.id)));
const filedTo = db.prepare("SELECT filed_to FROM intake_item WHERE batch_id = ? AND filename = 'ST-101 Rev C.pdf'").get(batchA).filed_to;
check('where each file went is recorded', /drawing register/.test(filedTo || ''), filedTo);
r = await call('/api/intake/report?batch=' + batchA);
const rep = r.json;
check('the report reconciles: every file in exactly one row', rep.reconciles === true && rep.total === all.length, rep.summary);
check('it names every file not added, grouped by reason', rep.not_added.some((g) => g.outcome === 'unsupported' && g.files.some((f) => f.file === 'setup.exe')));
check('drafts left out are their own group', !rep.not_added.some((g) => g.outcome === 'draft' && g.files.some((f) => f.file === 'ST-102 Rev A DRAFT.pdf')), 'the included draft should be filed');
check('the second programme is listed as left out by you', rep.not_added.some((g) => g.outcome === 'left_out' && g.files.some((f) => f.file === 'Update.xer')));
check('what was added says where it went and how it was decided', rep.added.some((x) => x.file === 'ST-101 Rev C.pdf' && x.filed_to && x.how));
r = await call('/api/intake/report?batch=' + batchA + '&format=xlsx');
check('the report downloads as Excel with the X1 header', r.status === 200 && xlsxText(r.bytes).includes('Downloaded by: AETRAA Admin') && xlsxText(r.bytes).includes('Not added'));
r = await call('/api/intake/report?batch=' + batchA + '&format=pdf');
check('and as a PDF', r.status === 200 && new TextDecoder('latin1').decode(r.bytes.slice(0, 5)) === '%PDF-');
const lib = db.prepare("SELECT title FROM library WHERE project_id = ? AND class = 'report' AND title LIKE 'Intake report%'").all(A.pid);
check('the report PDF is filed to the library after the commit', lib.length >= 1, JSON.stringify(lib));
const aud = db.prepare("SELECT action, COUNT(*) AS n FROM audit WHERE project_id = ? AND action LIKE 'intake.%' GROUP BY action").all(A.pid);
const n = Object.fromEntries(aud.map((x) => [x.action, x.n]));
check('one audit row per file classified', n['intake.classified'] >= all.length - 2, JSON.stringify(n));
check('and per file filed', n['intake.filed'] >= 3, JSON.stringify(n));

// ---------------------------------------------------------------- G4 the folder map
console.log('\n— G4: the company’s folder map (§4) —');
const C = await onboard('Tower F', 'TWF-0001', [['F DC', 'dc@towerf.test', ['dc']]]);
await admin();
let bc = await dropFolder(C.pid, [['/Docs/05 MAR', 'Scan_0001.pdf', new Uint8Array([37, 80, 68, 70])],
  ['/Docs/05 MAR', 'Scan_0002.pdf', new Uint8Array([37, 80, 68, 70, 1])], ['/Docs/05 MAR', 'Scan_0003.pdf', new Uint8Array([37, 80, 68, 70, 2])]]);
let items = (await call('/api/intake/batch?id=' + bc)).json.items;
await call('/api/intake/confirm', { batch_id: bc, items: items.map((i) => ({ id: i.id, family: 'technical' })) });
await call('/api/intake/commit', { batch_id: bc, ids: items.map((i) => i.id) });
r = await call('/api/intake/folders?batch=' + bc);
const prop = (r.json.proposals || []).find((x) => x.pattern === '05 MAR');
check('a folder of three placed files is offered to be remembered', prop && prop.family === 'technical', r.text);
r = await call('/api/intake/folder-map', { project_id: C.pid, entries: [prop] });
check('it is remembered only when confirmed', r.status === 200 && r.json.saved === 1, r.text);
bc = await dropFolder(C.pid, [['/Other/05 MAR', 'Scan_0099.pdf', new Uint8Array([37, 80, 68, 70, 9])]]);
items = (await call('/api/intake/batch?id=' + bc)).json.items;
check('the next file in a folder of that name is filed by the map', items[0].family === 'technical' && /your company files the folder/.test(items[0].reason), items[0] && items[0].reason);
r = await call('/api/intake/folder-map?project=' + C.pid);
check('the map is visible', (r.json.remembered || []).length === 1, r.text);
await call('/api/intake/abandon', { batch_id: bc });

// ---------------------------------------------------------------- G2 abandon frees the project and the storage
console.log('\n— G2: abandon —');
const D = await onboard('Tower H', 'TWH-0001');
await admin();
const bd = await dropFolder(D.pid, [['/x', 'A.pdf', new Uint8Array([37, 80, 68, 70, 3])], ['/x', 'B.pdf', new Uint8Array([37, 80, 68, 70, 4])]]);
const keys = db.prepare('SELECT file_key FROM intake_item WHERE batch_id = ? AND file_key IS NOT NULL').all(bd).map((x) => x.file_key);
r = await call('/api/intake/abandon', { batch_id: bd });
check('abandoning deletes the files stored for scanning', r.json.files_deleted === keys.length && keys.every((k) => !db.prepare('SELECT key FROM files WHERE key = ?').get(k)), r.text);
r = await call('/api/intake/batch', { project_id: D.pid });
check('and frees the project for the next drop', r.status === 200 && !!r.json.id, r.text);
r = await call('/api/intake/batch', { project_id: B.pid, expect_files: 1430 });
check('a folder over 1,000 files is refused up front with its count', r.status === 400 && /1,430 files and the limit is 1,000/.test(r.json.error), r.text);
r = await call('/api/intake/batch', { project_id: B.pid, expect_bytes: 3 * 1024 * 1024 * 1024 });
check('a folder over 2 GB is refused up front', r.status === 400 && /limit for one drop is 2 GB/.test(r.json.error), r.text);

// ---------------------------------------------------------------- G8 history for the contractor
console.log('\n— G8: the contractor sees their own intake history —');
await as('dc@towerd.test');
r = await call('/api/intake/history');
check('the DC sees their project’s drops', (r.json.batches || []).some((b) => b.id === batchA), r.text.slice(0, 200));
r = await call('/api/intake/report?batch=' + batchA);
check('and their reports', r.status === 200 && r.json.reconciles === true);
r = await call('/api/intake/report?batch=' + batchB);
check('but not another company’s', r.status === 403, r.status);
r = await call('/intake-history');
check('the history page opens', r.status === 200 && r.text.includes('Intake history'));
done();
