// G10 / E13: the specification index — split from the contents or headings
// only, manufacturers and requirements per section, pages with no text
// reported, Design confirms, sections searchable and downloadable alone.
//   node tools/test-g10-spec-index.mjs
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { db, call, as, admin, check, done, onboard, xlsxText } from './_harness.mjs';
import { buildIndex } from '../src/spec-index.js';

async function pdf(pages) {
  const d = await PDFDocument.create();
  const f = await d.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) {
    const pg = d.addPage([595, 842]);
    let y = 800;
    for (const l of lines) { pg.drawText(l, { x: 40, y, size: 9, font: f }); y -= 14; }
  }
  return d.save({ useObjectStreams: false });
}
const b64 = (u8) => Buffer.from(u8).toString('base64');

const spec = await pdf([
  ['TABLE OF CONTENTS', '03 30 00 CAST-IN-PLACE CONCRETE 3', '07 13 00 SHEET WATERPROOFING 5', '22 11 16 DOMESTIC WATER PIPING 7'],
  ['GENERAL', 'This specification applies to the works.'],
  ['SECTION 03 30 00 - CAST-IN-PLACE CONCRETE', 'PART 1 GENERAL', 'A. Submit shop drawings for reinforcement placing.', 'B. The Contractor shall carry out cube tests at 7 and 28 days.'],
  ['SECTION 03 30 00 - CAST-IN-PLACE CONCRETE', '2.1 MANUFACTURERS: 1. Fosroc 2. Sika 3. BASF or approved equal.', 'PART 3 EXECUTION'],
  ['SECTION 07 13 00 - SHEET WATERPROOFING', 'Submit samples of the membrane.', 'Acceptable manufacturers: a. Bitumat b. Henkel.', 'PART 3 EXECUTION'],
  ['SECTION 07 13 00 - SHEET WATERPROOFING', 'The Engineer shall be notified at the hold point before backfilling for inspection.'],
  ['SECTION 22 11 16 - DOMESTIC WATER PIPING', 'Submit product data for pipes and fittings.', 'Pressure test shall be carried out before concealment.'],
  [],
]);

console.log('— splitting —');
check('no structure: the document stays whole, with the reason', buildIndex(['some text', 'more text']).split === false &&
  /not split on a guess/.test(buildIndex(['some text', 'more text']).reason));
check('a fully scanned specification is not indexed', /scanned/.test(buildIndex(['', '']).reason));

const { pid } = await onboard('Tower S', 'TWS-0001', [['S DC', 'dc@towers.test', ['dc']], ['S Design', 'design@towers.test', ['design']], ['S PM', 'pm@towers.test', ['pm']]]);
await as('pm@towers.test');
let r = await call('/api/spec-index', { filename: 'Specification.pdf', data: b64(spec) });
check('the PM does not build the index', r.status === 403, r.status);
await as('dc@towers.test');
r = await call('/api/spec-index', { filename: 'Specification.pdf', data: b64(spec) });
check('Document Control builds it', r.status === 200 && r.json.result.split === true, r.text.slice(0, 300));
const res = r.json.result, id = r.json.id;
const sec = (c) => res.sections.find((s) => s.code === c) || {};
check('split from the table of contents', res.method === 'contents' && res.sections.length === 3, res.method + ' ' + res.sections.length);
check('03 30 00 spans pages 3 to 4', sec('03 30 00').page_from === 3 && sec('03 30 00').page_to === 4, sec('03 30 00'));
check('22 11 16 runs to the end', sec('22 11 16').page_from === 7 && sec('22 11 16').page_to === 8, sec('22 11 16'));
check('the discipline comes from the division', sec('03 30 00').discipline === 'Structural' && sec('22 11 16').discipline === 'Plumbing');
check('the manufacturers each section names', JSON.stringify(sec('03 30 00').manufacturers) === JSON.stringify(['Fosroc', 'Sika', 'BASF']) && sec('03 30 00').or_equal === true, sec('03 30 00').manufacturers);
check('shop drawings and testing found in 03 30 00, with the page', (sec('03 30 00').requirements.shop_drawings || [])[0]?.page === 3 && (sec('03 30 00').requirements.testing || []).length >= 1);
check('samples and inspection found in 07 13 00', (sec('07 13 00').requirements.samples || []).length && (sec('07 13 00').requirements.inspection || []).length);
check('the page with no text is reported as not read', JSON.stringify(res.unread_pages) === JSON.stringify([8]), res.unread_pages);
check('the specification was filed in the library', db.prepare("SELECT COUNT(*) AS n FROM library WHERE project_id = ? AND class = 'specification'").get(pid).n === 1);
r = await call('/api/spec-index/confirm', { id });
check('Document Control cannot confirm it', r.status === 403, r.status);

await as('design@towers.test');
r = await call('/api/spec-index/confirm', { id, edits: [{ code: '07 13 00', title: 'Sheet waterproofing membranes' }] });
check('Design confirms it', r.status === 200 && r.json.sections === 3, r.text);
r = await call('/api/spec-sections?q=waterproofing');
check('sections are searchable by title', r.json.sections.length === 1 && r.json.sections[0].title === 'Sheet waterproofing membranes', r.text.slice(0, 200));
r = await call('/api/spec-sections?q=033000');
check('and by number', r.json.sections.length === 1 && r.json.sections[0].code === '03 30 00');
const s1 = r.json.sections[0];
r = await call('/api/spec-sections/file?id=' + s1.id);
const part = r.status === 200 ? await PDFDocument.load(r.bytes) : null;
check('a section downloads as its own PDF with just its pages', part && part.getPageCount() === 2, r.status);
r = await call('/api/spec-sections/xlsx');
check('the index downloads as Excel with the X1 header', r.status === 200 && xlsxText(r.bytes).includes('Specification index') && xlsxText(r.bytes).includes('Downloaded by: S Design'));
r = await call('/spec');
check('the page opens', r.status === 200 && r.text.includes('Specification index'));

console.log('\n— rebuilding from the library replaces the live index —');
const libId = db.prepare("SELECT id FROM library WHERE project_id = ? AND class = 'specification'").get(pid).id;
await as('dc@towers.test');
r = await call('/api/spec-index', { library_id: libId });
const id2 = r.json.id;
await as('design@towers.test');
await call('/api/spec-index/confirm', { id: id2 });
check('one live set of sections, not two', db.prepare('SELECT COUNT(*) AS n FROM spec_section WHERE project_id = ?').get(pid).n === 3);
check('the earlier index is marked replaced', db.prepare('SELECT state FROM spec_index WHERE id = ?').get(id).state === 'replaced');
done();
