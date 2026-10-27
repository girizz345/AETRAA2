// PROJECT INTAKE — classification, the no-write guarantee, resumable commit,
// and the contract terms that are never applied.
//
//   node tools/test-intake.mjs
//
// The two checks that matter most, and why:
//
//   SCAN WRITES NOTHING. The whole review screen rests on the promise that a
//   person can drop four hundred files, look at what the engine thinks, and
//   walk away with the project untouched. It would be easy to break by
//   accident while adding a routing case, so it is asserted by counting
//   register rows either side of a scan rather than by reading the code.
//
//   NO CONTRACT FIGURE IS EVER AUTO-APPLIED. Every payment certificate for the
//   life of a job is computed from these seven numbers. A wrong one is silent
//   and expensive. So every proposal must arrive unticked, however unambiguous
//   the sentence it came from.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import {
  classifyFile, classifySpreadsheet, classifyWord, classifyPdf, classifyImage,
  folderHint, tokensIn, templateTypeOf, looksLikeSheet, groupOf, summarise, extensionOf,
} from '../src/intake-classify.js';
import {
  findTerms, proposeTerms, acceptedTerms, sentenceAround, pageOf, TERM_KEYS,
} from '../src/contract-terms.js';
import {
  openBatch, scanFile, getBatch, confirmItems, commitItems, allowedInScope, learnFolders,
} from '../src/intake.js';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + String(d).slice(0, 300) : '')); if (!c) fails++; };

console.log('\n— the top level: extension picks the cascade —');
{
  check('.xer is the programme', classifyFile({ filename: 'Baseline Rev 3.xer' }).family === 'programme');
  check('.mpp is refused with a reason, not guessed',
    /\.xer/.test(classifyFile({ filename: 'plan.mpp' }).reason));
  check('.dwg is CAD', classifyFile({ filename: 'ST-101.dwg' }).family === 'cad');
  check('.dxf is CAD and records its format',
    classifyFile({ filename: 'ST-101.dxf' }).cad_format === 'dxf');
  check('.msg is correspondence', classifyFile({ filename: 'RE Approval.msg' }).family === 'correspondence');
  check('an unknown extension says which one it did not recognise',
    /\.pages/.test(classifyFile({ filename: 'notes.pages' }).reason));
  check('a file with no extension is still classified, not thrown away',
    classifyFile({ filename: 'Scan0012' }).family === 'unknown');
  check('extensionOf reads the last extension', extensionOf('a.tar.gz') === 'gz');
  check('every classification carries the reason it was reached',
    classifyFile({ filename: 'x.xer' }).reason.length > 0);
  check('every classification carries its build phase',
    classifyFile({ filename: 'x.xer' }).phase === 5);
}

console.log('\n— legacy formats are filed unread, never dropped and never guessed —');
{
  const doc = classifyFile({ filename: 'Letter to Engineer.doc' });
  check('.doc is filed rather than dropped', doc.family !== 'unknown', doc.family);
  check('.doc carries the reason it was not read', /legacy/.test(doc.unread_reason || ''), doc.unread_reason);
  check('.doc is NOT classified from its filename',
    doc.family !== 'correspondence', 'the filename said "Letter" and it must not have been believed');
  const rtf = classifyFile({ filename: 'Contract.rtf' });
  check('.rtf likewise is not read as a contract', rtf.family !== 'contract', rtf.family);
  const xls = classifyFile({ filename: 'BOQ.xls' }, { header: [], rowCount: 0 });
  check('an unreadable .xls is filed unread', /legacy/.test(xls.unread_reason || ''), xls.unread_reason);
}

console.log('\n— the folder hint: used when decisive, ignored when not —');
{
  check('a submittals folder decides', folderHint('/04 Submittals/').family === 'technical');
  check('a drawings folder decides', folderHint('/IFC Drawings/Structural/').family === 'drawing');
  check('the deepest meaningful folder wins',
    folderHint('/Project/Test Certificates/').family === 'quality');
  check('"New folder" says nothing', folderHint('/New folder (3)/') === null);
  check('a person\'s name says nothing', folderHint('/Ahmed/') === null);
  check('a bare number says nothing', folderHint('/2024/') === null);
  check('a two-letter folder says nothing', folderHint('/AB/') === null);
  check('an empty path says nothing', folderHint('') === null);
  check('a meaningless folder does not block a deeper meaningful one',
    folderHint('/Drawings/New folder/').family === 'drawing');
}

console.log('\n— the spreadsheet cascade —');
{
  const boq = classifySpreadsheet({ header: ['Section', 'Ref', 'Description', 'Unit', 'Qty', 'Rate', 'Amount'], rowCount: 400 });
  check('Rate + Amount is a priced BOQ', boq.family === 'commercial' && boq.commercial_kind === 'boq');
  const bom = classifySpreadsheet({ header: ['Ref', 'Material', 'Unit', 'Budget Qty', 'Rate'], rowCount: 200 });
  check('Budget Qty is a BOM', bom.family === 'commercial' && bom.commercial_kind === 'bom', bom.commercial_kind);
  const snag = classifySpreadsheet({ header: ['Ref', 'Description', 'Status'], rowCount: 80 });
  check('Ref + Description + Status is a snag list', snag.family === 'site', snag.family);
  const cert = classifySpreadsheet({ header: ['Cube Test Result', 'Date'], rowCount: 30 });
  check('certificate wording in the header is a quality record', cert.family === 'quality');
  check('an unrecognised header is unknown, not a BOQ',
    classifySpreadsheet({ header: ['A', 'B'], rowCount: 5 }).family === 'unknown');

  // The trap this ordering exists for.
  const blank = classifySpreadsheet({
    header: ['Item', 'Description', 'Qty', 'Rate', 'Amount'], rowCount: 0,
    tokens: ['ref', 'date'], filename: 'Inspection Checklist.xlsx',
  });
  check('a BLANK form carrying Rate and Amount is a template, not an empty BOQ',
    blank.family === 'template', blank.family);
  check('and its document type is read from the filename',
    blank.template_type === 'inspection', blank.template_type);
}

console.log('\n— the Word cascade —');
{
  check('tokens make it a template',
    classifyWord({ tokens: ['ref'], text: 'x', filename: 'RFI Form.docx' }).family === 'template');
  check('contract phrases make it a contract',
    classifyWord({ text: 'The Retention shall be 10% of each Interim Payment Certificate.' }).family === 'contract');
  check('a letterhead makes it correspondence',
    classifyWord({ text: 'Our Ref: ABC/001\nSubject: Delay\nDear Sir,' }).family === 'correspondence');
  check('section numbering makes it a specification',
    classifyWord({ text: 'SECTION 03 30 00 CAST-IN-PLACE CONCRETE' }).family === 'specification');
  check('ITP wording makes it technical',
    classifyWord({ text: 'Inspection and Test Plan for blockwork' }).family === 'technical');
  check('attendees make it minutes',
    classifyWord({ text: 'Minutes of Meeting\nAttendees: A, B, C' }).family === 'minutes');
  check('nothing recognised is unknown', classifyWord({ text: 'hello' }).family === 'unknown');
  check('a template is decided before a contract, even when both would match',
    classifyWord({ tokens: ['x'], text: 'retention sub-clause' }).family === 'template');
}

console.log('\n— the PDF cascade —');
{
  const A1 = { width: 2384, height: 1684 }, A4 = { width: 595, height: 842 };
  check('an A1 page is a sheet', looksLikeSheet(A1));
  check('an A4 page is not a sheet', !looksLikeSheet(A4));
  check('a missing page size is not a sheet', !looksLikeSheet(null));

  check('a drawing number in the filename wins',
    classifyPdf({ filename: 'ST-101 Rev C.pdf', drawingNumber: 'ST-101' }).family === 'drawing');
  check('one to three sheet-sized pages is a drawing',
    classifyPdf({ pages: 1, page: A1, text: '' }).family === 'drawing');
  check('an RFI reference places it as a technical record',
    classifyPdf({ pages: 2, page: A4, text: 'RFI-0042 request for information' }).record_type === 'rfi');
  check('and the reference itself is carried across',
    classifyPdf({ pages: 2, page: A4, text: 'RFI-0042' }).reference === 'RFI-0042');
  check('an NCR is a quality record',
    classifyPdf({ pages: 2, page: A4, text: 'NCR-07 non conformance' }).family === 'quality');
  check('contract phrases over many pages is a contract',
    classifyPdf({ pages: 60, page: A4, text: 'conditions of contract retention sub-clause 14.3' }).family === 'contract');
  check('section numbers over many pages is a specification',
    classifyPdf({ pages: 300, page: A4, text: 'SECTION 03 30 00' }).family === 'specification');
  check('an authority with approval wording is an authority document',
    classifyPdf({ pages: 2, page: A4, text: 'DEWA NOC approval granted' }).family === 'authority');

  const scan = classifyPdf({ pages: 4, page: A4, text: '' });
  check('a scanned PDF says it is probably a scan rather than guessing',
    scan.family === 'unknown' && /scan/.test(scan.reason), scan.reason);

  const foldered = classifyPdf({ filename: 'Scan_0012.pdf', path: '/04 Submittals/', pages: 3, page: A4, text: '' });
  check('the folder rescues a scan with no text', foldered.family === 'technical', foldered.family);
  check('and records that the folder was what decided', foldered.by_folder === true);

  // REGRESSION. The folder deciding first must not cost us the number: the
  // number is the gate's only strong signal, and without it the gate returns
  // UNKNOWN and files the sheet. A tidy /Drawings/ folder would then disable
  // the gate on exactly the projects most likely to have configured it.
  const byFolder = classifyPdf({ filename: 'ST-101 Rev C.pdf', path: '/Drawings/', pages: 1, page: A1, drawingNumber: 'ST-101' });
  check('a drawing placed BY ITS FOLDER still carries its number',
    byFolder.number === 'ST-101', JSON.stringify(byFolder));
  const byGeometry = classifyPdf({ pages: 1, page: A1, drawingNumber: 'ST-102' });
  check('a drawing placed by page geometry also carries its number',
    byGeometry.number === 'ST-102', JSON.stringify(byGeometry));
}

console.log('\n— logos are never guessed —');
{
  const named = classifyImage({ filename: 'client logo.png' });
  check('a named logo is placed', named.family === 'logo' && named.party === 'client');
  const unnamed = classifyImage({ filename: 'logo.png' });
  check('an unnamed logo is still a logo', unnamed.family === 'logo');
  check('but its party is left blank rather than guessed', unnamed.party === null,
    'the wrong logo on an issued document is worse than none');
  check('a photo in a photos folder is site',
    classifyImage({ filename: 'IMG_0021.jpg', path: '/Site Photos/' }).family === 'site');
  check('a bare image is unidentified', classifyImage({ filename: 'IMG_0021.jpg' }).family === 'unknown');
}

console.log('\n— tokens —');
{
  check('double braces are read', tokensIn('Ref: {{ref}} Date: {{date}}').length === 2);
  check('angle brackets are read', tokensIn('<<ref>>').length === 1);
  check('duplicates count once', tokensIn('{{ref}} {{ref}}').length === 1);
  check('plain text has no tokens', tokensIn('hello world').length === 0);
  check('the template type is read from the filename', templateTypeOf('RFI Form.docx', '') === 'rfi');
  check('an unknown form gives no type', templateTypeOf('Form.docx', '') === null);
}

console.log('\n— the five groups —');
{
  check('a conflict is held', groupOf({ verdict: 'conflict', family: 'drawing' }) === 'held');
  check('an unknown family is unidentified', groupOf({ verdict: 'match', family: 'unknown' }) === 'unidentified');
  check('a decision needed goes to decide',
    groupOf({ verdict: 'match', family: 'logo', needs_decision: true }) === 'decide');
  check('an unknown verdict is filed-but-unverified',
    groupOf({ verdict: 'unknown', family: 'drawing' }) === 'unverified');
  check('a match with nothing to decide is ready',
    groupOf({ verdict: 'match', family: 'drawing' }) === 'ready');
  check('a conflict is held even when a decision is also pending',
    groupOf({ verdict: 'conflict', family: 'logo', needs_decision: true }) === 'held');

  const s = summarise([
    { verdict: 'match', family: 'drawing' },
    { verdict: 'conflict', family: 'drawing' },
    { verdict: 'unknown', family: 'drawing', already_filed: true },
    { verdict: 'match', family: 'unknown' },
  ]);
  check('the summary counts every group', s.total === 4 && s.ready === 1 && s.held === 1 &&
    s.unverified === 1 && s.unidentified === 1, JSON.stringify(s));
  check('and separates already-filed from new, for later drops',
    s.already_filed === 1 && s.fresh === 3, JSON.stringify(s));
}

console.log('\n— contract terms: found with their clause and page —');
{
  const pages = [
    'CONDITIONS OF CONTRACT. This Agreement is made between the parties.',
    'Sub-Clause 14.3. The Retention shall be 10% of the value of work executed, limited to 5% of the Accepted Contract Amount.',
    'The Employer shall pay within 56 days of the Engineer issuing an Interim Payment Certificate.',
    'Notice of a claim shall be given under Sub-Clause 20.2.1 within 28 days.',
    'An advance payment of 15% shall be made upon provision of an advance payment guarantee.',
  ];
  const text = pages.join('\n');
  const found = findTerms(text, pages);

  check('retention is found', found.retention_pct && found.retention_pct[0].value === 10,
    JSON.stringify(found.retention_pct));
  check('the retention CAP is found and is different from the rate',
    found.retention_cap_pct && found.retention_cap_pct[0].value === 5,
    JSON.stringify(found.retention_cap_pct));
  check('the cap is below the rate, which is the UAE/FIDIC shape',
    found.retention_cap_pct[0].value < found.retention_pct[0].value);
  check('the payment period is found', found.payment_days && found.payment_days[0].value === 56);
  check('the advance is found', found.advance_pct && found.advance_pct[0].value === 15);
  check('the notice clause is found',
    found.notice_clause && /20\.2\.1/.test(found.notice_clause[0].value), JSON.stringify(found.notice_clause));
  check('each hit carries its page', found.retention_pct[0].page === 2, found.retention_pct[0].page);
  check('each hit carries the sentence it came from',
    /Retention shall be 10%/.test(found.retention_pct[0].sentence), found.retention_pct[0].sentence);

  check('a figure out of range is not a hit',
    !(findTerms('retention of 900%').retention_pct || []).length);
  check('an empty contract finds nothing', Object.keys(findTerms('')).length === 0);
  check('pageOf returns null when no pages were supplied', pageOf(null, 10) === null);
  check('sentenceAround does not throw on an empty string', sentenceAround('', 0) === '');
}

console.log('\n— contract terms: proposed, NEVER applied —');
{
  const pages = ['The Retention shall be 10% of the value of work executed.'];
  const props = proposeTerms(pages.join('\n'), pages);
  const ret = props.find((p) => p.key === 'retention_pct');

  check('an unambiguous single hit is still only proposed', ret.value === 10 && ret.state === 'proposed');
  check('AND IT IS NOT TICKED', ret.accepted === false,
    'every certificate for the life of the job is computed from this figure');
  check('every term appears, found or not', props.length === TERM_KEYS.length);
  check('a term that was not found says so plainly',
    props.find((p) => p.key === 'advance_pct').state === 'not_found');
  check('a blank is described as a correct outcome, not an error',
    /type it/.test(props.find((p) => p.key === 'advance_pct').note || ''));
  check('nothing at all is ticked', props.every((p) => p.accepted === false));

  // The General / Particular Conditions case.
  const two = ['General Conditions: the Retention shall be 10% of each payment.',
               'Particular Conditions: the Retention shall be 5% of each payment.'];
  const conflicted = proposeTerms(two.join('\n'), two).find((p) => p.key === 'retention_pct');
  check('two different figures is a conflict', conflicted.state === 'conflict', conflicted.state);
  check('and NOTHING is preselected', conflicted.value === null,
    'the engine does not know that Particular Conditions prevail');
  check('both values are carried with their pages', conflicted.options.length === 2,
    JSON.stringify(conflicted.options));
  check('the person is told to choose', /choose/.test(conflicted.note || ''));

  // A figure already in use.
  const live = proposeTerms(pages.join('\n'), pages, { retention_pct: 5 }).find((p) => p.key === 'retention_pct');
  check('a proposal disagreeing with a live figure is flagged', live.state === 'disagrees');
  check('and the note says certificates were already computed from it',
    /certificates were computed/i.test(live.note || ''), live.note);
  check('it is still not ticked', live.accepted === false);

  check('acceptedTerms keeps only what was ticked',
    Object.keys(acceptedTerms(props)).length === 0);
  check('and writes a term once it is ticked',
    acceptedTerms([{ key: 'retention_pct', value: 10, accepted: true }]).retention_pct === 10);
  check('a ticked but empty term is not written',
    Object.keys(acceptedTerms([{ key: 'retention_pct', value: null, accepted: true }])).length === 0);
  check('an unknown key is never written',
    Object.keys(acceptedTerms([{ key: 'evil', value: 1, accepted: true }])).length === 0);
}

console.log('\n— scope: a DC batch is drawings-only, enforced server-side —');
{
  check('a full batch takes a programme', allowedInScope('full', 'programme'));
  check('a DC batch takes a drawing', allowedInScope('drawings', 'drawing'));
  check('a DC batch REFUSES a programme', !allowedInScope('drawings', 'programme'));
  check('a DC batch refuses a contract', !allowedInScope('drawings', 'contract'));
  check('a DC batch refuses a BOQ', !allowedInScope('drawings', 'commercial'));
  check('a DC batch still lists unidentified files', allowedInScope('drawings', 'unknown'));
}

/* ------------------------------------------------------------ against a database */

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
for (const c of ['drawing_rules', 'aliases']) {
  try { db.exec(`ALTER TABLE projects ADD COLUMN ${c} TEXT`); } catch (e) {}
}
function stmt(sql) {
  const st = db.prepare(sql); let args = [];
  const api = {
    bind(...a) { args = a; return api; },
    async all() { return { results: st.all(...args), success: true }; },
    async first(col) { const r = st.get(...args) ?? null; return col && r ? r[col] : r; },
    async run() { st.run(...args); return { success: true, meta: {} }; },
  };
  return api;
}
const env = { DB: { prepare: stmt, async batch(l) { for (const s of l) await s.run(); return []; },
                    async exec(s) { db.exec(s); } } };

const project = { id: 'p1', ref: 'AET-001', name: 'Tower A',
                  drawing_rules: JSON.stringify([{ match: 'ST', on: 'number', discipline: 'Structural' }]) };
const bytesOf = (s) => new TextEncoder().encode(s);
const countRows = (t) => { try { return db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n; } catch (e) { return 0; } };

console.log('\n— THE GUARANTEE: scan writes nothing to any register —');
{
  const before = { drawings: countRows('drawings'), library: countRows('library') };

  const b = await openBatch(env, 'p1', { name: 'Ajay' }, { org_id: 'o1' });
  check('a batch opens', b.ok === true && !!b.id, JSON.stringify(b));

  const r1 = await scanFile(env, b.id, project, { filename: 'ST-101.pdf', path: '/Drawings/', bytes: bytesOf('sheet') },
    { pages: 1, page: { width: 2384, height: 1684 }, drawingNumber: 'ST-101' });
  check('a drawing scans', r1.ok === true && r1.family === 'drawing', JSON.stringify(r1));

  const r2 = await scanFile(env, b.id, project, { filename: 'Baseline.xer', bytes: bytesOf('xer') }, {});
  check('a programme scans', r2.family === 'programme');

  const r3 = await scanFile(env, b.id, project, { filename: 'Contract.pdf', bytes: bytesOf('c') },
    { pages: 60, page: { width: 595, height: 842 }, text: 'conditions of contract retention sub-clause' });
  check('a contract scans', r3.family === 'contract', r3.family);

  const after = { drawings: countRows('drawings'), library: countRows('library') };
  check('NO drawing register row was written by scanning', after.drawings === before.drawings,
    before.drawings + ' -> ' + after.drawings);
  check('NO library row was written by scanning', after.library === before.library,
    before.library + ' -> ' + after.library);

  const batch = await getBatch(env, b.id);
  check('but the batch records all three files', batch.items.length === 3, String(batch.items.length));
  check('and counts them into groups', batch.counts.total === 3, JSON.stringify(batch.counts));
  check('the batch knows its own file count', batch.file_count === 3, String(batch.file_count));
}

console.log('\n— the gate runs during intake, and a conflict is held not filed —');
{
  const b = await openBatch(env, 'p1', { name: 'Ajay' }, { org_id: 'o1' });
  const r = await scanFile(env, b.id, project,
    { filename: 'ME-900.pdf', path: '/Drawings/', bytes: bytesOf('x') },
    { pages: 1, page: { width: 2384, height: 1684 }, drawingNumber: 'ME-900' });
  check('a drawing numbered under another scheme is a conflict', r.verdict === 'conflict', JSON.stringify(r));
  check('and lands in the held group', r.group === 'held', r.group);

  const foreign = await scanFile(env, b.id, project,
    { filename: 'letter.pdf', bytes: bytesOf('y') },
    { pages: 2, page: { width: 595, height: 842 }, text: 'Our Ref: x. Project DIA-R-0270 refers. Dear Sir,' });
  check('a document naming another project is a conflict', foreign.verdict === 'conflict', JSON.stringify(foreign));
}

console.log('\n— a DC batch refuses what it may not load —');
{
  const b = await openBatch(env, 'p1', { name: 'DC' }, { org_id: 'o1', scope: 'drawings' });
  check('the batch records its scope', b.scope === 'drawings');
  const r = await scanFile(env, b.id, project, { filename: 'Baseline.xer', bytes: bytesOf('x') }, {});
  check('a .xer is refused', r.skipped === true, JSON.stringify(r));
  check('and the refusal names who does load it',
    /administrator/i.test(r.reason || ''), r.reason);
  const ok = await scanFile(env, b.id, project, { filename: 'ST-205.pdf', bytes: bytesOf('x') },
    { pages: 1, page: { width: 2384, height: 1684 }, drawingNumber: 'ST-205' });
  check('a drawing is accepted', ok.ok === true && !ok.skipped);
}

console.log('\n— confirm records decisions and still writes no register row —');
{
  const b = await openBatch(env, 'p1', { name: 'Ajay' }, { org_id: 'o1' });
  await scanFile(env, b.id, project, { filename: 'logo.png', bytes: bytesOf('img') }, {});
  let batch = await getBatch(env, b.id);
  const logo = batch.items.find((i) => i.family === 'logo');
  check('an unassigned logo needs a decision', logo.needs_decision === true);
  check('and sits in the decide group', logo.group === 'decide', logo.group);

  const before = countRows('library');
  const c = await confirmItems(env, b.id, [{ id: logo.id, extracted: { party: 'client' } }], { name: 'Ajay' });
  check('the decision is recorded', c.changed === 1, JSON.stringify(c));
  check('confirming writes no register row', countRows('library') === before);

  batch = await getBatch(env, b.id);
  const after = batch.items.find((i) => i.id === logo.id);
  check('the item is now confirmed', after.state === 'confirmed', after.state);
  check('the decision cleared the flag', after.needs_decision === false);
  check('and the party was kept', after.extracted.party === 'client');
}

console.log('\n— commit: routes, records and is resumable —');
{
  const b = await openBatch(env, 'p1', { name: 'Ajay' }, { org_id: 'o1' });
  await scanFile(env, b.id, project, { filename: 'O&M Manual Chillers.pdf', path: '/Handover/', bytes: bytesOf('m') },
    { pages: 120, page: { width: 595, height: 842 }, text: 'operation and maintenance' });
  await scanFile(env, b.id, project, { filename: 'Baseline.xer', bytes: bytesOf('x') }, {});

  let batch = await getBatch(env, b.id);
  const lib = batch.items.find((i) => i.family === 'handover');
  const prog = batch.items.find((i) => i.family === 'programme');
  check('the O&M manual was recognised', !!lib, JSON.stringify(batch.items.map((i) => i.family)));

  const calls = [];
  const routes = {
    getBytes: async () => bytesOf('file'),
    programme: async (pid) => { calls.push('programme'); return { ok: true }; },
  };

  const r = await commitItems(env, b.id, [lib.id, prog.id], project, { name: 'Ajay' }, routes);
  const byId = Object.fromEntries(r.results.map((x) => [x.id, x]));
  check('the O&M manual filed to the library', byId[lib.id].ok && /library/.test(byId[lib.id].where),
    JSON.stringify(byId[lib.id]));
  check('a library row now exists', countRows('library') >= 1);
  check('the programme was routed to the xer importer', calls.includes('programme'));

  // Re-running the same items must be safe.
  const again = await commitItems(env, b.id, [lib.id], project, { name: 'Ajay' }, routes);
  check('re-committing a filed item is a no-op, not a duplicate',
    again.results[0].already === true, JSON.stringify(again.results[0]));

  // A route that is not wired in fails that item alone.
  const b2 = await openBatch(env, 'p1', { name: 'Ajay' }, { org_id: 'o1' });
  await scanFile(env, b2.id, project, { filename: 'Baseline2.xer', bytes: bytesOf('x') }, {});
  const only = (await getBatch(env, b2.id)).items[0];
  const r2 = await commitItems(env, b2.id, [only.id], project, { name: 'Ajay' }, { getBytes: async () => null });
  check('a missing importer fails that item with a reason', r2.results[0].ok === false &&
    /not wired/.test(r2.results[0].error), JSON.stringify(r2.results[0]));
  const failed = (await getBatch(env, b2.id)).items[0];
  check('and the failure is recorded on the item so a re-run can retry it',
    failed.state === 'failed' && !!failed.error, failed.state);
}

console.log('\n— commit sends conflicts to the held queue, never to a register —');
{
  const b = await openBatch(env, 'p1', { name: 'Ajay' }, { org_id: 'o1' });
  await scanFile(env, b.id, project, { filename: 'XX-900.pdf', bytes: bytesOf('x') },
    { pages: 1, page: { width: 2384, height: 1684 }, drawingNumber: 'XX-900' });
  const item = (await getBatch(env, b.id)).items[0];
  check('it scanned as a conflict', item.verdict === 'conflict');

  const beforeD = countRows('drawings');
  let drawingCalled = false;
  const r = await commitItems(env, b.id, [item.id], project, { name: 'Ajay' },
    { getBytes: async () => bytesOf('x'), drawing: async () => { drawingCalled = true; return { ok: true }; } });
  check('committing a conflict holds it', r.results[0].held === true, JSON.stringify(r.results[0]));
  check('the drawing importer was never called', drawingCalled === false);
  check('no drawing register row was written', countRows('drawings') === beforeD);
  check('the reason travels with it', !!r.results[0].reason);
  const held = (await getBatch(env, b.id)).items[0];
  check('and the item is marked held', held.state === 'held', held.state);
}

console.log('\n— skipped items are left out, not filed —');
{
  const b = await openBatch(env, 'p1', { name: 'Ajay' }, { org_id: 'o1' });
  await scanFile(env, b.id, project, { filename: 'random.pdf', bytes: bytesOf('x') },
    { pages: 2, page: { width: 595, height: 842 }, text: '' });
  const item = (await getBatch(env, b.id)).items[0];
  await confirmItems(env, b.id, [{ id: item.id, state: 'skipped' }], { name: 'Ajay' });
  const before = countRows('library');
  const r = await commitItems(env, b.id, [item.id], project, { name: 'Ajay' }, { getBytes: async () => null });
  check('a skipped item is not filed', r.results[0].skipped === true, JSON.stringify(r.results[0]));
  check('and nothing was written', countRows('library') === before);
}

console.log('\n— the folder map is proposed, never silent —');
{
  const b = await openBatch(env, 'p1', { name: 'Ajay' }, { org_id: 'o1' });
  for (let i = 0; i < 3; i++) {
    await scanFile(env, b.id, project,
      { filename: 'sub' + i + '.pdf', path: '/05 MAR/', bytes: bytesOf('x') },
      { pages: 2, page: { width: 595, height: 842 }, text: 'MAR-00' + i });
  }
  const items = (await getBatch(env, b.id)).items;
  await confirmItems(env, b.id, items.map((i) => ({ id: i.id, family: 'technical' })), { name: 'Ajay' });
  const learned = await learnFolders(env, b.id, 'o1');
  check('a repeated folder is offered as a mapping', learned.length >= 1, JSON.stringify(learned));
  check('and it is NOT confirmed by default',
    learned.every((l) => l.confirmed === false), 'a mapping applies only once a person confirms it');
  check('the mapping is the folder name, not the whole path',
    learned[0].pattern === '05 MAR', learned[0].pattern);
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
