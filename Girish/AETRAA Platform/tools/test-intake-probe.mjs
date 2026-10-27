// READING ENOUGH OF A FILE TO CLASSIFY IT.
//
//   node tools/test-intake-probe.mjs
//
// These run against files this project's own writers produce, so the probe is
// checked against real .xlsx and .docx structures rather than fixtures written
// to match the reader — which would prove only that the reader agrees with
// itself.
//
// The other half of the job is degrading well. A 200 MB CAD file, a pre-2007
// .xls and a corrupt PDF all have to come back as SOMETHING, because a probe
// that throws takes the other 399 files in the batch down with it.
import { buildXlsx, zip } from '../src/xlsx.js';
import { probe, probePdf, probeDocx, probeXlsx, probeCsv, mapColumns, mapRows, colIndex } from '../src/intake-probe.js';
import { classifyFile, classifySpreadsheet, classifyWord } from '../src/intake-classify.js';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + String(d).slice(0, 300) : '')); if (!c) fails++; };

const enc = (s) => new TextEncoder().encode(s);

console.log('\n— a real .xlsx, written by this project and read back —');
{
  const boq = buildXlsx([{ name: 'BOQ', rows: [
    ['Section', 'Ref', 'Description', 'Unit', 'Qty', 'Rate', 'Amount'],
    ['A', '1.1', 'Concrete C40', 'm3', 100, 350, 35000],
    ['A', '1.2', 'Formwork', 'm2', 200, 90, 18000]] }]);
  const p = probeXlsx(boq);
  check('the header row is read', p.header[0] === 'Section' && p.header[6] === 'Amount', JSON.stringify(p.header));
  check('the data rows are counted', p.rowCount === 2, String(p.rowCount));
  check('and it classifies as a priced BOQ',
    classifySpreadsheet(p).commercial_kind === 'boq', JSON.stringify(classifySpreadsheet(p)));
  check('the rows themselves come back for the importer', p.rows.length === 2, String(p.rows.length));
  check('shared strings are resolved, not left as indexes',
    p.rows[0][2] === 'Concrete C40', JSON.stringify(p.rows[0]));

  const bom = buildXlsx([{ name: 'BOM', rows: [
    ['Ref', 'Material', 'Unit', 'Budget Qty', 'Rate'], ['M1', 'Rebar', 't', 50, 2600]] }]);
  check('a BOM is told apart from a BOQ',
    classifySpreadsheet(probeXlsx(bom)).commercial_kind === 'bom');

  // A title row before the real header is the normal case, not the exception.
  const titled = buildXlsx([{ name: 'S', rows: [
    ['TOWER A — BILL OF QUANTITIES'], [],
    ['Section', 'Description', 'Qty', 'Rate', 'Amount'], ['A', 'Concrete', 10, 5, 50]] }]);
  const tp = probeXlsx(titled);
  check('a title row above the header does not fool it',
    tp.header.includes('Rate') && tp.header.includes('Amount'), JSON.stringify(tp.header));
  check('and the data rows are still counted from the right place', tp.rowCount === 1, String(tp.rowCount));

  // The trap: a blank form whose columns look like a bill.
  const blank = buildXlsx([{ name: 'Form', rows: [
    ['Item', 'Description', 'Qty', 'Rate', 'Amount'], ['{{ref}}', '{{description}}', '', '', '']] }]);
  const bp = probeXlsx(blank);
  check('placeholder tokens in the cells are found', bp.tokens.length >= 2, JSON.stringify(bp.tokens));
}

console.log('\n— a real .docx —');
{
  // The smallest thing that is genuinely a .docx as far as the reader cares.
  const docx = (body) => zip([
    { name: '[Content_Types].xml', data: enc('<?xml version="1.0"?><Types/>') },
    { name: 'word/document.xml', data: enc(
      '<?xml version="1.0"?><w:document><w:body>' + body + '</w:body></w:document>') },
  ]);

  const plain = probeDocx(docx('<w:p><w:r><w:t>The Retention shall be 10% of each certificate.</w:t></w:r></w:p>'));
  check('the text is read', /Retention shall be 10%/.test(plain.text), plain.text.slice(0, 80));
  check('the XML tags are gone', !/<w:/.test(plain.text));
  check('and it classifies as a contract', classifyWord(plain).family === 'contract');

  const form = probeDocx(docx('<w:p><w:r><w:t>Ref: {{ref}} Date: {{date}}</w:t></w:r></w:p>'));
  check('tokens are found', form.tokens.length === 2, JSON.stringify(form.tokens));
  check('and it classifies as a template', classifyWord(form).family === 'template');

  // THE CASE THAT BREAKS NAIVE READERS: Word splits a typed placeholder across
  // runs, so {{ref}} is stored as "{{re" + "f}}" with tags between. Without
  // stitching, every consultant template reads as an ordinary document and is
  // filed as one.
  const split = probeDocx(docx(
    '<w:p><w:r><w:t>{{re</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>f}}</w:t></w:r></w:p>'));
  check('a placeholder split across Word runs is still found',
    split.tokens.includes('ref'), JSON.stringify(split.tokens));
  check('so a split template is still a template', classifyWord(split).family === 'template');

  check('a .docx that is not a zip degrades rather than throwing',
    probeDocx(enc('not a zip')).text === '');
}

console.log('\n— PDF geometry and text —');
{
  const pdf = (mediabox, extra) => enc(
    '%PDF-1.4\n1 0 obj<</Type/Pages/Count 1>>endobj\n' +
    '2 0 obj<</Type/Page /MediaBox [' + mediabox + ']>>endobj\n' + (extra || ''));

  const a1 = probePdf(pdf('0 0 2384 1684'));
  check('an A1 MediaBox is read', a1.page && a1.page.width === 2384, JSON.stringify(a1.page));
  check('the page count is read', a1.pages === 1, String(a1.pages));
  check('and it classifies as a drawing',
    classifyFile({ filename: 'x.pdf' }, a1).family === 'drawing');

  const a4 = probePdf(pdf('0 0 595 842'));
  check('an A4 MediaBox is read', a4.page && a4.page.width === 595);
  check('an A4 PDF with no text is not called a drawing',
    classifyFile({ filename: 'x.pdf' }, a4).family !== 'drawing');
  check('and it says it is probably a scan rather than guessing',
    /scan/.test(classifyFile({ filename: 'x.pdf' }, a4).reason));

  const withText = probePdf(pdf('0 0 595 842', '3 0 obj<<>>stream\n(RFI-0042 reply required) Tj\nendstream\n'));
  check('uncompressed text is read', /RFI-0042/.test(withText.text), withText.text.slice(0, 60));
  check('and it places the record', classifyFile({ filename: 'x.pdf' }, withText).record_type === 'rfi');

  const many = probePdf(enc('%PDF-1.4\n1 0 obj<</Type/Pages/Count 320>>endobj\n2 0 obj<</Type/Page /MediaBox [0 0 595 842]>>endobj'));
  check('a page count of 320 is read', many.pages === 320, String(many.pages));

  check('an empty file does not throw', probePdf(new Uint8Array(0)).pages === 0);
  check('rubbish does not throw', probePdf(enc('hello')).pages === 0);
  check('a PDF with no MediaBox gives no page size', probePdf(enc('%PDF-1.4')).page === null);
}

console.log('\n— csv —');
{
  const p = probeCsv(enc('Section,Ref,Description,Unit,Qty,Rate,Amount\nA,1.1,Concrete,m3,100,350,35000'));
  check('the header is split', p.header.length === 7, JSON.stringify(p.header));
  check('the rows are counted', p.rowCount === 1);
  check('and it classifies as a BOQ', classifySpreadsheet(p).commercial_kind === 'boq');
  check('quoted fields are unquoted',
    probeCsv(enc('"A","B"\n1,2')).header[0] === 'A');
  check('an empty file does not throw', probeCsv(enc('')).rowCount === 0);
}

console.log('\n— degrading well is the whole job —');
{
  check('an unknown extension gives an empty probe',
    Object.keys(probe('x.dwg', enc('binary'))).length === 0);
  check('a pre-2007 .xls reports itself unreadable', probe('x.xls', enc('x')).unreadable === true);
  check('and is therefore filed unread rather than dropped',
    /legacy/.test(classifyFile({ filename: 'x.xls' }, probe('x.xls', enc('x'))).unread_reason || ''));
  check('an empty file gives an empty probe', Object.keys(probe('x.pdf', new Uint8Array(0))).length === 0);
  check('a no-name file does not throw', Object.keys(probe('', enc('x'))).length === 0);
  check('a corrupt xlsx reports itself unreadable', probeXlsx(enc('not a zip')).unreadable === true);

  // The batch-level promise: one bad file must not stop the rest.
  const files = ['good.pdf', 'corrupt.xlsx', 'huge.dwg', 'legacy.doc', ''];
  let threw = null;
  for (const f of files) {
    try { classifyFile({ filename: f }, probe(f, enc('rubbish'))); }
    catch (e) { threw = f; }
  }
  check('no file in a mixed batch throws', threw === null, 'threw on ' + threw);
}

console.log('\n— mapping a header row onto the importers\u2019 columns —');
{
  const H = ['Section', 'Ref', 'Description', 'Unit', 'Qty', 'Rate', 'Amount'];
  const col = mapColumns(H);
  check('every column is found', col.section === 0 && col.description === 2 && col.rate === 5 && col.amount === 6,
    JSON.stringify(col));
  check('headers are matched loosely',
    mapColumns(['Quantity', 'Unit Rate', 'Total']).qty === 0, JSON.stringify(mapColumns(['Quantity', 'Unit Rate', 'Total'])));
  check('an unrecognised header maps nothing', Object.keys(mapColumns(['a', 'b'])).length === 0);
  check('an empty header does not throw', Object.keys(mapColumns([])).length === 0);

  const rows = mapRows(H, [
    ['A', '1.1', 'Concrete C40', 'm3', 100, 350, 35000],
    ['A', '1.2', 'Formwork', 'm2', 200, 90, 18000],
    ['', '', 'SUBTOTAL', '', '', '', 53000],
    ['', '', 'TO COLLECTION', '', '', '', 53000],
    ['', '', '', '', '', '', ''],
    ['', '1.3', 'Allow for testing, lump sum', 'Item', '', '', 5000],
    ['B', '2.1', 'Blockwork', 'm2', 450, 55, 24750],
  ]);
  check('the priced lines come through', rows.length === 4, String(rows.length));
  check('a SUBTOTAL row is NOT imported as an item',
    !rows.some((r) => /subtotal/i.test(r.description)),
    'a bill that imports its own subtotals counts them twice and no longer adds up');
  check('nor is a TO COLLECTION row', !rows.some((r) => /collection/i.test(r.description)));
  check('but a LUMP SUM priced by amount alone IS kept',
    rows.some((r) => /lump sum/i.test(r.description) && r.amount === 5000),
    'dropping every amount-only row to catch subtotals deletes real money');
  check('a blank spacer row is dropped', !rows.some((r) => !r.description));
  check('the fields land where the importer expects them',
    rows[0].section === 'A' && rows[0].ref === '1.1' && rows[0].unit === 'm3' &&
    rows[0].qty === 100 && rows[0].rate === 350 && rows[0].amount === 35000, JSON.stringify(rows[0]));
  check('numbers with thousands separators are read',
    mapRows(H, [['A', '1', 'X', 'm', '1,200', '2,50', '']])[0].qty === 1200);

  const bom = mapRows(['Ref', 'Material', 'Unit', 'Budget Qty', 'Rate'],
    [['M1', 'Rebar T16', 't', 50, 2600]], 'bom');
  check('a BOM row carries material and budget_qty',
    bom[0].material === 'Rebar T16' && bom[0].budget_qty === 50, JSON.stringify(bom[0]));

  check('rows with no header mapping give nothing', mapRows([], [['a', 'b']]).length === 0);
  check('null rows do not throw', mapRows(H, null).length === 0);

  // REGRESSION, and the worst class of bug in this file. Spreadsheet writers
  // OMIT empty cells rather than writing a placeholder. Read cells in order
  // and a row with a blank Section shifts every later column left: the unit
  // becomes the quantity and the rate becomes the amount. The bill imports
  // with no error and the wrong money in it.
  const gappy = buildXlsx([{ name: 'BOQ', rows: [
    ['Section', 'Ref', 'Description', 'Unit', 'Qty', 'Rate', 'Amount'],
    ['A', '1.1', 'Concrete', 'm3', 100, 350, 35000],
    ['', '1.2', 'Formwork', 'm2', 200, 90, 18000],
  ] }]);
  const gp = probeXlsx(gappy);
  const gm = mapRows(gp.header, gp.rows);
  check('a row with a blank leading cell keeps its columns aligned',
    gm[1].unit === 'm2' && gm[1].qty === 200 && gm[1].rate === 90 && gm[1].amount === 18000,
    JSON.stringify(gm[1]));
  check('and its blank section really is blank, not the next column shifted in',
    gm[1].section === '', JSON.stringify(gm[1].section));
  check('column letters convert correctly', colIndex('A') === 0 && colIndex('Z') === 25 &&
    colIndex('AA') === 26 && colIndex('AB') === 27);
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
