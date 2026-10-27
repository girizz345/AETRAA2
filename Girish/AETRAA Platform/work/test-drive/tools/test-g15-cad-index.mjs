// G15: CAD packages (spec §6, phase 7) and the project index with Check and
// complete (spec §29, phase 9).
//   node tools/test-g15-cad-index.mjs
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { db, call, admin, as, check, done, onboard } from './_harness.mjs';
import { dxfXrefs, readCad, laterRevision } from '../src/cad.js';
import { clausesFrom } from '../src/project-index.js';

const b64 = (u8) => Buffer.from(u8).toString('base64');
const enc = (s) => new TextEncoder().encode(s);
const dxf = (no, rev, title, xref) => enc(['0', 'SECTION', '2', 'BLOCKS']
  .concat(xref ? ['0', 'BLOCK', '2', 'XREF1', '70', '4', '1', 'C:\\xrefs\\' + xref, '0', 'ENDBLK'] : [])
  .concat(['0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES', '0', 'ATTRIB', '2', 'DWG_NO', '1', no, '0', 'ATTRIB', '2', 'REV', '1', rev,
    '0', 'ATTRIB', '2', 'TITLE', '1', title, '0', 'ENDSEC', '0', 'EOF']).join('\n'));
async function pdf(pages, size = [595, 842]) {
  const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) { const pg = d.addPage(size); let y = size[1] - 40; for (const l of lines) { pg.drawText(l, { x: 40, y, size: 9, font: f }); y -= 13; } }
  return d.save({ useObjectStreams: false });
}

console.log('— CAD: reading —');
const x = dxfXrefs(new TextDecoder().decode(dxf('ST-101', 'B', 'Slab', 'grid.dxf')));
check('xrefs are read from the BLOCK table', x.length === 1 && x[0].file === 'grid.dxf', x);
const rc = readCad('ST-101.dxf', dxf('ST-101', 'B', 'Ground floor slab', null));
check('a DXF title block gives number, revision and title', rc.number === 'ST-101' && rc.revision === 'B' && /slab/i.test(rc.title) && rc.read_from === 'DXF title block', rc);
check('a DWG is read from its name only, and says so', /converter/.test(readCad('AR-1 Rev A.dwg', new Uint8Array(10)).note));
check('revision order', laterRevision('B', 'A') && laterRevision('C2', 'C1') && !laterRevision('A', 'B'));

console.log('\n— CAD: through intake —');
const { pid } = await onboard('Tower C', 'TWC-0001', [['C PM', 'pm@towerc.test', ['pm']], ['C DC', 'dc@towerc.test', ['dc']], ['C Consultant', 'cons@towerc.test', ['consultant']]]);
await admin();
let r = await call('/api/intake/batch', { project_id: pid });
const bat = r.json.id;
const sheet = await pdf([['DRAWING NO ST-101 REV A']], [2384, 1684]);
const big = new Uint8Array(1_500_000); big.set(enc('AC1027'));
for (const [path, name, bytes] of [['/IFC Drawings', 'ST-101 Rev A.pdf', sheet], ['/CAD', 'ST-101.dxf', dxf('ST-101', 'B', 'Ground floor slab', 'grid.dxf')],
  ['/CAD', 'AR-500.dxf', dxf('AR-500', 'A', 'Roof plan', 'base.dxf')], ['/CAD', 'grid.dxf', dxf('GR-001', 'A', 'Grid', null)], ['/CAD', 'ME-900 Rev A.dwg', big]]) {
  await call('/api/intake/scan', { batch_id: bat, project_id: pid, filename: name, path, data: b64(bytes) });
}
let items = (await call('/api/intake/batch?id=' + bat)).json.items;
const bigItem = items.find((i) => i.filename === 'ME-900 Rev A.dwg');
check('a CAD file over the limit is "recognised, not stored"', bigItem.state === 'skipped' && /recognised, not stored/.test(bigItem.reason) && bigItem.group === 'left_out', bigItem);
check('and its bytes are not kept', db.prepare("SELECT file_key FROM intake_item WHERE id = ?").get(bigItem.id).file_key === null);
const pdfItem = items.find((i) => i.filename === 'ST-101 Rev A.pdf');
r = await call('/api/intake/commit', { batch_id: bat, ids: [pdfItem.id] });
r = await call('/api/intake/commit', { batch_id: bat, ids: items.filter((i) => i.family === 'cad' && i.state !== 'skipped').map((i) => i.id) });
const pk = db.prepare('SELECT * FROM cad_package WHERE project_id = ? ORDER BY number').all(pid);
const st = pk.find((p) => p.number === 'ST-101'), ar = pk.find((p) => p.number === 'AR-500');
check('the DXF is packaged with its sheet, not filed as a second drawing', st && st.drawing_id && db.prepare("SELECT COUNT(*) AS n FROM drawings WHERE project_id = ? AND number = 'ST-101'").get(pid).n === 1, pk);
check('drawn past the issued sheet is reported, and the PDF stays the sheet', st && /past the issued sheet/.test(st.flags) && db.prepare("SELECT revision FROM drawings WHERE project_id = ? AND number = 'ST-101'").get(pid).revision === 'A');
check('its xref in the drop travels with it', st && st.xref_keys.includes('grid.dxf') && st.missing_xrefs === '[]', st);
check('a CAD file with no PDF becomes the sheet, marked "no PDF issued"', ar && /no PDF issued/.test(ar.flags) && !!db.prepare("SELECT id FROM drawings WHERE project_id = ? AND number = 'AR-500'").get(pid));
check('its missing xref is listed', ar && ar.missing_xrefs.includes('base.dxf'), ar && ar.missing_xrefs);
r = await call('/api/cad-packages?project=' + pid);
check('the packages are listed', (r.json.packages || []).length >= 2);

console.log('\n— the index —');
check('clauses start at a heading, not at a reference inside a sentence', JSON.stringify(clausesFrom(['Sub-Clause 20.2.1 Notice of Claim The Contractor shall give notice within 28 days. Failure in accordance with Sub-Clause 20.1 is noted.']).map((c) => c.key)) === JSON.stringify(['Sub-Clause 20.2.1']));
await as('dc@towerc.test');
r = await call('/api/index/check', { draft: 'We hereby give notice of a delay to the substation works.' });
check('an empty index proposes nothing', r.status === 200 && r.json.empty === true && r.json.proposals.filter((p) => p.kind === 'clause').length === 0, r.text.slice(0, 200));
const contract = await pdf([['CONDITIONS OF CONTRACT'], ['PARTICULAR CONDITIONS.', 'Sub-Clause 20.2.1 Notice of Claim The Contractor shall give notice to the Engineer within 28 days after becoming aware of the event.',
  'Sub-Clause 14.3 Application for Interim Payment The Contractor shall submit a Statement monthly.']]);
const addendum = await pdf([['ADDENDUM 1.', 'Sub-Clause 14.3 Application for Interim Payment The Contractor shall submit a Statement every two weeks.']]);
await admin();
for (const [n, bytes] of [['Contract.pdf', contract], ['Addendum 1.pdf', addendum]]) {
  db.prepare("INSERT INTO library (id, project_id, class, title, filename, file_key, bytes, added_at) VALUES (?,?,?,?,?,?,?,?)")
    .run('lib_' + n.length, pid, 'contract', n, n, 'k_' + n.length, bytes.length, n === 'Contract.pdf' ? '2026-01-01' : '2026-06-01');
  db.prepare("INSERT INTO files (key, mime, size, data, created_at) VALUES (?,?,?,?,?)").run('k_' + n.length, 'application/pdf', bytes.length, b64(bytes), '2026-01-01');
}
db.prepare("UPDATE projects SET notice_clause = 'Sub-Clause 20.2.1', engineer_name = 'Consult Co', client_name = 'Dubai Holding' WHERE id = ?").run(pid);
await call('/api/records?project=' + pid);
const ir = db.prepare('INSERT INTO records (id, project_id, type, no, ref, title, status, data, workflow, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
ir.run('r1', pid, 'rfi', 42, 'RFI-0042', 'Substation energisation date', 'With consultant', '{}', '[]', '2026-03-12');
ir.run('r2', pid, 'incoming', 14, 'IN-014', 'Substation energisation programme from DEWA', 'Open', '{}', '[]', '2026-04-03');
ir.run('r3', pid, 'letter', 15, 'LTR-015', 'Reply on substation energisation', 'Issued', '{"In reply to":"IN-014"}', '[]', '2026-04-10');
await as('dc@towerc.test');
r = await call('/api/index/rebuild', {});
check('the index is built from the contract, records and drawings', r.status === 200 && r.json.clauses === 3 && r.json.entries >= 6, r.text);
check('a letter that says what it replies to gives a stated link', r.json.links === 1);
const c143 = db.prepare("SELECT * FROM index_entry WHERE project_id = ? AND key = 'Sub-Clause 14.3' ORDER BY occurred_on").all(pid);
check('D14: the addendum’s clause governs; the earlier one is kept and marked superseded', c143.length === 2 && c143[0].superseded_by === c143[1].id && !c143[1].superseded_by);
r = await call('/api/index/rebuild', {});
const again = db.prepare("SELECT kind, key, text FROM index_entry WHERE project_id = ? ORDER BY id").all(pid);
check('rebuilding gives the same index', again.length === r.json.entries);

const draft = 'We hereby give notice that the delay to the substation energisation commenced on 3 March 2026. As previously advised, the substation is not energised. RFI-0042 remains unanswered. See also RFI-9999. We will claim the additional cost.';
r = await call('/api/index/check', { draft });
const P = r.json.proposals || [];
const clause = P.find((p) => p.kind === 'clause');
check('the notice clause is quoted verbatim, with its page', clause && clause.verbatim && /within 28 days/.test(clause.propose) && clause.source.page === 2, clause);
const arith = P.find((p) => p.kind === 'arithmetic');
check('the date arithmetic is shown', arith && /gives 28 days from the event\. You have dated the event 2026-03-03\. Today is \d{4}-\d{2}-\d{2} — day \d+\./.test(arith.note), arith);
check('and never concluded', !/time-?barred|valid|preserved/i.test(JSON.stringify(P)));
check('a vague reference becomes a checkable one, marked possibly related', P.some((p) => p.says && /previously advised/i.test(p.says) && p.basis === 'inferred' && /IN-014|LTR-015/.test(p.propose)));
check('a named record is cited with its date', P.some((p) => p.kind === 'reference' && p.says === 'RFI-0042' && /2026-03-12/.test(p.propose)));
check('a reference that does not exist is flagged', P.some((p) => p.kind === 'missing' && /RFI-9999/.test(p.flag)));
check('the addressee comes from the parties', P.some((p) => p.kind === 'distribution' && /Consult Co/.test(p.propose)));
check('every proposal opens its source', P.filter((p) => p.propose).every((p) => p.source && p.source.link));
r = await call('/api/index/confirm', { draft, proposals: P, decisions: [{ id: clause.id, choice: 'edit', text: 'Notice under Sub-Clause 20.2.1 within 28 days' }, { id: P.find((p) => p.says === 'RFI-0042').id, choice: 'accept' }], final_text: draft });
check('the decisions are recorded; an edited quotation is recorded as paraphrase', r.status === 200 && r.json.edited === 1 && r.json.paraphrased === 1 && r.json.accepted === 1, r.text);
check('confirming does not issue the letter', /goes through its own workflow/.test(r.json.note) && db.prepare("SELECT COUNT(*) AS n FROM records WHERE project_id = ? AND type = 'letter'").get(pid).n === 1);
await as('cons@towerc.test');
r = await call('/api/index/check', { draft });
check('D15: the consultant has no access to the index', r.status === 403, r.status);
r = await call('/letter-check');
check('the page opens', r.status === 200);
done();
