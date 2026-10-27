// K12 · v5 A7: the material submittal package. A sample catalogue and spec
// section produce a complete package whose every compliance line opens its
// source page; nothing is issued without the PM and DC.
//   node tools/test-k12-material-package.mjs
import { db, env, call, admin, as, check, done, onboard } from './_harness.mjs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { clausesOf, figureCheck, quoteOn, brandStatus, settleMaterialLadder, materialSteps } from '../src/material-package.js';
import { ensureBoqTable } from '../src/commercial.js';
import { addItem, ensureScheduleTables } from '../src/schedules.js';

const b64 = (u8) => Buffer.from(u8).toString('base64');
const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
async function pdf(pages) {
  const d = await PDFDocument.create({ updateMetadata: false });
  const f = await d.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) { const pg = d.addPage([595, 842]); let y = 800; for (const l of lines) { pg.drawText(l, { x: 40, y, size: 10, font: f }); y -= 15; } }
  return new Uint8Array(await d.save({ useObjectStreams: false }));
}
const SPEC = await pdf([
  ['TABLE OF CONTENTS', '09 91 00 PAINTING 2', '09 30 00 TILING 3'],
  ['SECTION 09 91 00 - PAINTING', '2.1 MANUFACTURERS: 1. Jotun 2. Hempel or approved equal.', '2.2 EXTERIOR EMULSION', 'A. VOC content shall not exceed 50 g/l.',
   'B. Dry film thickness 2 coats x 40 microns minimum.', '3.1 APPLICATION', 'A. Apply at surface temperatures between 10 and 35 C.'],
  ['SECTION 09 30 00 - TILING', '2.1 TILES', 'A. Porcelain tiles 600 x 600 mm.'],
]);
const CATALOGUE = await pdf([
  ['JOTUN JOTASHIELD ANTIFADE COLOURS', 'Product data sheet', 'Exterior acrylic emulsion paint'],
  ['TECHNICAL DATA', 'VOC content: 45 g/l', 'Dry film thickness per coat: 40 microns', 'Recommended coats: 2'],
  ['APPLICATION', 'Apply by brush, roller or airless spray.', 'Surface temperature 10 to 40 C.', 'Store between 5 and 35 C.'],
]);
const CERT = await pdf([['TEST CERTIFICATE', 'Jotashield VOC test report No. VT-2026-118']]);

// The fake model: one answer per section, every request kept.
const sent = [];
const ANSWER = {
  compliance: { rows: [
    { clause: '2.2 A', requirement: 'VOC content shall not exceed 50 g/l', submitted: 'VOC content 45 g/l', complies: 'Y', deviation: '', page: 2, quote: 'VOC content: 45 g/l' },
    { clause: '2.2 B', requirement: 'Dry film thickness 2 coats x 40 microns minimum', submitted: '2 coats of 40 microns, 80 microns total', complies: 'Y', deviation: '', page: 2, quote: 'Dry film thickness per coat: 40 microns' },
    { clause: '3.1 A', requirement: 'Apply between 10 and 35 C', submitted: 'Surface temperature 10 to 40 C', complies: 'Partly', deviation: 'The catalogue allows up to 40 C; the specification 35 C.', page: 3, quote: 'Surface temperature 10 to 40 C.' },
    { clause: '2.1', requirement: 'Jotun or Hempel or approved equal', submitted: 'Jotun Jotashield', complies: 'Y', deviation: '', page: 1, quote: 'colour retention guaranteed' }] },
  form: { fields: [{ name: 'Material', value: 'Exterior acrylic emulsion paint', page: 1 }, { name: 'Manufacturer / brand', value: 'Jotun', page: 1 }, { name: 'Model / type', value: 'Jotashield Antifade Colours', page: 1 }] },
  method: { text: '1. Store between 5 and 35 C.\n2. Apply by brush, roller or airless spray at 10 to 35 C.', pages: [3] },
  explanations: { text: 'Jotashield is an exterior acrylic emulsion with VOC 45 g/l, within the 50 g/l limit, and a 12 year warranty.', pages: [2] },
};
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.anthropic.com/v1/messages')) {
    const body = JSON.parse(init.body); sent.push(body);
    const k = (String(body.system).match(/\[section: (\w+)\]/) || [])[1];
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(ANSWER[k]) }], usage: { input_tokens: 2000, output_tokens: 400 } }), { status: 200 });
  }
  return realFetch(url, init);
};

console.log('— the deterministic parts —');
const cl = clausesOf(['SECTION 09 91 00 - PAINTING\n2.2 EXTERIOR EMULSION\nA. VOC content shall not exceed 50 g/l.\n3.1 APPLICATION\nA. Apply at 10 to 35 C.'], 2);
check('clauses are split by their numbers, each lettered one known by its parent', cl.map((c) => c.no).join() === '2.2,2.2 A,3.1,3.1 A' && cl[1].page === 2);
check('a figure not on the page is caught; one that is passes', figureCheck('VOC 45 g/l, 80 microns', 'VOC content: 45 g/l. 40 microns per coat').join() === '80' && !figureCheck('1,200 kg', 'weight 1200 kg').length);
check('a quote is the page’s own words', quoteOn('VOC content: 45 g/l', 'TECHNICAL DATA\nVOC content: 45 g/l') && !quoteOn('VOC 30 g/l', 'VOC content: 45 g/l'));
check('a brand off the approved list is “Alternative / equivalent” only', brandStatus('Jotun', { names: ['Jotun', 'Hempel'] }).approved && brandStatus('Asian Paints', { names: ['Jotun'] }).label === 'Alternative / equivalent');
check('the PM’s QA/QC step goes in after Prepared, and comes out', materialSteps([{ st: 'Prepared' }, { st: 'PM approves' }], true)[1].st === 'QA/QC checks against spec' && materialSteps(materialSteps([{ st: 'Prepared' }], true), false).length === 1);

const { pid } = await onboard('Tower K12', 'TKC-0001', [['The Designer', 'design@tk12.test', ['design']], ['The PM', 'pm@tk12.test', ['pm']], ['The DC', 'dc@tk12.test', ['dc']],
  ['The Engineer', 'site@tk12.test', ['site']], ['The QA', 'qa@tk12.test', ['qaqc']]]);
await onboard('Tower N12', 'TNC-0001', [['Other designer', 'design@tn12.test', ['design']]]);
await as('dc@tk12.test');
let r = await call('/api/spec-index', { filename: 'Specification.pdf', data: b64(SPEC) });
await as('design@tk12.test');
await call('/api/spec-index/confirm', { id: r.json.id });              // E13 step 2: Design confirms the index
await ensureBoqTable(env);
db.prepare("INSERT INTO boq (id, project_id, section, ref, description, unit, qty, rate, amount, sort_order, created_at) VALUES ('bq1', ?, 'Finishes', '9.01', 'Emulsion paint to external walls', 'm2', 4200, 18, 75600, 1, ?)").run(pid, today);
await ensureScheduleTables(env);
const P3 = (await addItem(env, pid, 'material', { description: 'External emulsion paint', spec_code: '09 91 00', discipline: 'Architectural' }, 'The Designer')).id;

console.log('\n— started from the P3 item: the log line, the spec section, the BOQ line, the approved list —');
await as('site@tk12.test');
r = await call('/api/material/start', { title: 'x', spec: { code: '09 91 00' }, catalogue: { filename: 'c.pdf', data: b64(CATALOGUE) } });
check('a site engineer does not prepare material submittals', r.status === 403);
await as('design@tk12.test');
r = await call('/api/material');
check('Design sees the spec section and the P3 item', r.json.sections.some((s) => s.code === '09 91 00') && r.json.p3.some((x) => x.id === P3) && r.json.may.prepare, r.text.slice(0, 300));
r = await call('/api/material/start', { title: 'External emulsion paint', supplier: 'Jotun UAE', brand: 'Asian Paints', spec: { code: '09 91 00' }, boq_ref: '9.01', schedule_item: P3,
  catalogue: { filename: 'Jotashield.pdf', data: b64(CATALOGUE) }, certificates: [{ filename: 'VOC test.pdf', data: b64(CERT) }] });
const ID = r.json.id;
check('the package is started: being prepared, nothing numbered', r.status === 200 && r.json.state === 'preparing', r.text);
r = await call('/api/material/one?id=' + ID);
let K = r.json.package;
check('the section’s clauses are collected, each with its page', K.inputs.clauses.some((c) => c.no === '2.2 A' && c.page === 2) && K.inputs.clauses.length >= 5, K.inputs.clauses);
check('the approved manufacturers come from the section; the BOQ line is found', JSON.stringify(K.approved.names) === JSON.stringify(['Jotun', 'Hempel']) && K.approved.or_equal && K.boq.ref === '9.01', K.approved);
check('a brand not on the list is labelled “Alternative / equivalent”', K.sections.brand.label === 'Alternative / equivalent');
r = await call('/api/material');
check('the log shows it “Being prepared”, not yet numbered', r.json.log.some((x) => x.package === ID && x.status === 'Being prepared' && !x.ref));
r = await call('/api/material/draft', { id: ID });
check('with AI off, the AI is not offered', r.status === 400 && r.json.disabled);

console.log('\n— the AI drafts; every figure checked against its page —');
env.ANTHROPIC_API_KEY = 'test-key';
r = await call('/api/material/draft', { id: ID });
check('the AI drafts the four sections', r.status === 200 && r.json.done.join() === 'compliance,form,method,explanations' && r.json.state === 'ready', r.text.slice(0, 300));
check('the AI was given the clauses and the catalogue’s pages, as text', sent.length === 4 && /\[2\.2 A\] \(spec page 2\)/.test(sent[0].messages[0].content) && /\[Catalogue page 2\]/.test(sent[0].messages[0].content));
K = (await call('/api/material/one?id=' + ID)).json.package;
const row = (c) => K.sections.compliance.find((x) => x.clause === c);
check('a line whose figures are on its page stands', row('2.2 A').flags.length === 0);
check('a figure the catalogue does not print (80) is flagged', row('2.2 B').flags.some((f) => /80/.test(f)));
check('a quote that is not the page’s words is flagged', row('2.1').flags.some((f) => /quoted words/.test(f)));
check('a deviation is noted, with the AI’s remark kept', row('3.1 A').complies === 'Partly' && /40 C/.test(row('3.1 A').ai_remark));
check('a figure in the explanations not in the sources (12) is flagged', K.sections.explanations.flags.some((f) => /12/.test(f)));
check('nothing is submitted or numbered', (() => { try { return !db.prepare("SELECT ref FROM records WHERE type = 'material' AND project_id = ?").get(pid); } catch (e) { return true; } })());
console.log('\n— every compliance line opens its source page —');
let allOpen = true;
for (const x of K.sections.compliance) {
  if (x.page) {
    const pr = await call('/api/material/page?id=' + ID + '&src=catalogue&page=' + x.page);
    const doc = pr.status === 200 ? await PDFDocument.load(pr.bytes) : null;
    if (!doc || doc.getPageCount() !== 1) allOpen = false;
  }
  const sr = await call('/api/material/page?id=' + ID + '&src=spec&page=' + x.spec_page);
  if (sr.status !== 200) allOpen = false;
}
check('each line’s catalogue page and spec page open, one page each', allOpen && K.sections.compliance.length === 4);
r = await call('/api/material/page?id=' + ID + '&src=catalogue&page=9');
check('a page that is not there is refused', r.status === 404);

console.log('\n— the engineer reviews, overrides with a reason, completes —');
const rows = K.sections.compliance.map((x, i) => ({ i, clause: x.clause, requirement: x.requirement, submitted: x.submitted, complies: x.complies, deviation: x.deviation, page: x.page, quote: x.quote }));
rows[1].submitted = '2 coats of 40 microns';
rows[3].quote = '';
rows[2].complies = 'N';
r = await call('/api/material/edit', { id: ID, compliance: rows });
check('changing the AI’s “Partly” needs a reason', r.status === 400 && /say why/.test(r.json.error));
rows[2].override_note = 'Site temperatures reach 38 C — not acceptable';
r = await call('/api/material/complete', { id: ID });
check('a package with flagged lines is not completed', r.status === 400 && /flagged/.test(r.json.error));
r = await call('/api/material/edit', { id: ID, compliance: rows, explanations: { text: 'Jotashield is an exterior acrylic emulsion with VOC 45 g/l, within the 50 g/l limit.' }, brand: 'Jotun' });
K = (await call('/api/material/one?id=' + ID)).json.package;
check('the override is kept with who and why, and the AI’s remark beside it', K.sections.compliance[2].override.to === 'N' && /38 C/.test(K.sections.compliance[2].override.note) && K.sections.compliance[2].ai_remark);
check('with the brand corrected to Jotun it is an approved manufacturer', /Approved manufacturer/.test(K.sections.brand.label));
r = await call('/api/material/draft', { id: ID, sections: ['method'] });
check('a section can be regenerated on its own', r.status === 200 && r.json.done.join() === 'method' && sent.length === 5);
r = await call('/api/material/complete', { id: ID });
check('completed: Rev 1 formed', r.status === 200 && r.json.rev === 1, r.text);
const kept = db.prepare('SELECT * FROM material_package_rev WHERE package_id = ? AND rev = 0').get(ID);
check('Rev 0 — the AI’s draft — is kept', kept && /AI/.test(kept.note) && JSON.parse(kept.snapshot).sections.compliance.length === 4);

console.log('\n— the package: one PDF, the consultant’s form, submitted —');
r = await call('/api/material/pdf?id=' + ID);
const out = await PDFDocument.load(r.bytes);
if (process.env.K12_DUMP) (await import('node:fs')).writeFileSync(process.env.K12_DUMP, r.bytes);      // to look at it
check('one PDF: contents, compliance, method, explanations, the cited catalogue pages, the certificate', r.status === 200 && out.getPageCount() === 1 + 1 + 1 + 1 + 3 + 1, out.getPageCount());
r = await call('/api/material/submit', { id: ID });
const MAR = r.json.ref;
const rec = db.prepare('SELECT * FROM records WHERE ref = ? AND project_id = ?').get(MAR, pid);
const wf = JSON.parse(rec.workflow);
check('submitted: MAR-001 numbered now, the package PDF filed on it', r.status === 200 && MAR === 'MAR-001' && db.prepare("SELECT filename FROM attachments WHERE ref = ?").get(MAR).filename === 'MAR-001 material package Rev 1.pdf', r.text);
check('its data carries the brand, its status, the spec section, the BOQ line and Rev 1', JSON.parse(rec.data).Brand === 'Jotun' && /Approved/.test(JSON.parse(rec.data)['Brand status']) && /09 91 00/.test(JSON.parse(rec.data)['Spec section']) && JSON.parse(rec.data).Rev === '1');
check('no QA/QC step: Prepared → PM → DC issues → reply', wf.map((s) => s.st).join(' | ') === 'Submitted | PM approves to submit | Document Control issues to consultant | Consultant approval recorded', wf.map((s) => s.st));
check('the P3 line now follows MAR-001', db.prepare('SELECT record_ref FROM schedule_item WHERE id = ?').get(P3).record_ref === MAR);
r = await call('/api/material/submit', { id: ID });
check('a package is submitted once', r.status === 400);

console.log('\n— nothing is issued without the PM and DC —');
await as('dc@tk12.test');
r = await call('/api/s0/issue', { ref: MAR, outside: true, note: 'T-1' });
check('DC cannot issue before the PM approves', r.status === 400 && /not waiting to be issued/.test(r.json.error), r.text);
await as('pm@tk12.test');
r = await call('/api/record/advance', { ref: MAR, action: 'advance' });
check('the PM approves', r.status === 200, r.text.slice(0, 200));
r = await call('/api/s0/issue', { ref: MAR, outside: true, note: 'T-1' });
check('the PM does not issue', r.status === 403);
r = await call('/api/record/advance', { ref: MAR, action: 'advance' });
check('nor through the drawer', r.status === 403 || r.status === 400, r.status);
await as('dc@tk12.test');
r = await call('/api/s0/issue', { ref: MAR, outside: true, note: 'Transmittal T-1' });
check('Document Control issues it', r.status === 200 && /^Issued for approval/.test(r.json.status), r.text.slice(0, 200));

console.log('\n— Code C opens the next revision; its package starts from this one —');
r = await call('/api/s0/reply', { ref: MAR, code: 'C', replied_on: today, comments: [{ text: 'Provide the colour card', about: '2.2 A' }] });
check('Code C opens MAR-001 Rev 1', r.status === 200 && r.json.revision === MAR + ' Rev 1', r.text.slice(0, 200));
await as('design@tk12.test');
r = await call('/api/material/revise', { ref: MAR + ' Rev 1' });
const ID2 = r.json.id;
let K2 = (await call('/api/material/one?id=' + ID2)).json;
check('the revision’s package carries the comments beside it', r.status === 200 && K2.comments.some((c) => /colour card/.test(c.text)) && K2.package.rev === 1);
r = await call('/api/material/complete', { id: ID2 });
r = await call('/api/material/submit', { id: ID2 });
check('completed and filed on MAR-001 Rev 1 as package Rev 2 — no new number', r.status === 200 && r.json.ref === MAR + ' Rev 1' && r.json.rev === 2
  && !!db.prepare("SELECT id FROM attachments WHERE ref = ? AND filename = ?").get(MAR + ' Rev 1', MAR + ' Rev 1 material package Rev 2.pdf'), r.text);

console.log('\n— the PM can add a QA/QC step; the log —');
await as('design@tk12.test');
r = await call('/api/material/qaqc', { on: true });
check('Design cannot change the workflow', r.status === 403);
await as('pm@tk12.test');
r = await call('/api/material/qaqc', { on: true });
check('the PM adds a QA/QC step to the material workflow', r.status === 200 && r.json.steps[1].st === 'QA/QC checks against spec', r.text.slice(0, 200));
await as('design@tk12.test');
r = await call('/api/material/start', { title: 'Wall tiles', brand: 'RAK Ceramics', spec: { code: '09 30 00' }, catalogue: { filename: 'tiles.pdf', data: b64(await pdf([['RAK porcelain 600 x 600 mm']])) } });
const ID3 = r.json.id;
await call('/api/material/edit', { id: ID3, compliance: [{ clause: '2.1 A', requirement: 'Porcelain tiles 600 x 600 mm', submitted: 'Porcelain 600 x 600 mm', complies: 'Y', deviation: '', page: 1, quote: '' }] });
await call('/api/material/complete', { id: ID3 });
r = await call('/api/material/submit', { id: ID3 });
check('typed by hand (no AI), it is submitted — and now through QA/QC first', r.status === 200 && JSON.parse(db.prepare('SELECT workflow FROM records WHERE ref = ? AND project_id = ?').get(r.json.ref, pid).workflow)[1].st === 'QA/QC checks against spec', r.text);
db.prepare("INSERT INTO project_workflow (project_id, type, steps, days, template_id, changed_by, changed_at) VALUES ('old-proj', 'material', ?, 14, 'to-engineer', 'AETRAA', ?)")
  .run(JSON.stringify(['Submitted', 'QA/QC checks against spec', 'PM approves to submit', 'Document Control issues to consultant', 'Consultant approval recorded'].map((st) => ({ st, by: ['x'] }))), today);
check('a project left on the shipped ladder from before A7 is moved to A7’s (no QA/QC)', (await settleMaterialLadder(env, 'old-proj')).length === 4);
r = await call('/api/material');
const log = r.json.log;
check('the material log, by discipline: Sr, Discipline, Description, Supplier, Brand, Submitted, Rev, Status', log.some((x) => x.ref === MAR && x.brand === 'Jotun' && x.submitted && x.rev === '1') && log.every((x, i) => x.sr === i + 1), log);
r = await call('/api/material/log.xlsx');
check('and as Excel', r.status === 200 && new TextDecoder().decode(r.bytes).includes('Material submittal log'));
await as('design@tn12.test');
r = await call('/api/material/one?id=' + ID);
check('another company cannot open the package', r.status === 404);
r = await call('/material');
check('the page opens', r.status === 200 && r.text.includes('Material submittals'));
check('every AI call went through the one door and was logged', db.prepare("SELECT COUNT(*) AS n FROM ai_usage WHERE task LIKE 'a7-%'").get().n === sent.length);
done();
