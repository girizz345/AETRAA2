// READING ENOUGH OF A FILE TO CLASSIFY IT — and no more.
//
// The classifier asks questions: how many pages, how big is a page, what does
// the header row say, is there a {{token}} in here, what does the text look
// like. This answers them from the bytes.
//
// TWO RULES GOVERN EVERY FUNCTION HERE:
//
//   1. A probe that fails returns what it managed, never an exception. A single
//      corrupt PDF in four hundred must not cost the operator the other 399, so
//      every reader is wrapped and a failure degrades to "unknown", which the
//      classifier already handles by listing the file for a person.
//
//   2. Read a sample, not the file. A 600-page specification and a 200 MB CAD
//      file both have to be classified on a 1 GB server. Nothing here loads
//      more than it needs, and the text sample is capped.
//
// What it deliberately does NOT do: OCR. A scanned drawing carries no text at
// all, and page geometry already places it correctly. A scanned certificate
// comes back unidentified and is rescued by its folder or by a person — which
// is honest, and far better than a guess made from a filename.

import { unzipSync, strFromU8 } from 'fflate';

const TEXT_SAMPLE = 60000;     // enough for the cascades; not a whole contract

const safe = (fn, fallback) => { try { return fn(); } catch (e) { return fallback; } };

// ---------------------------------------------------------------- pdf
//
// Page geometry separates the three biggest families before a character of text
// is read, and it is the only signal a scanned sheet gives us at all.
//
// MediaBox is read straight out of the page dictionary rather than by parsing
// the PDF properly: the first MediaBox in the file is the first page's in every
// generator we have seen, and a drawing set is uniform. Being wrong here costs
// a misfiled family, which the review screen catches; parsing PDF properly
// costs a dependency and a great deal more that can break.
const MEDIABOX = /\/MediaBox\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]/;

export function probePdf(bytes) {
  const out = { pages: 0, page: null, text: '' };
  if (!bytes || !bytes.length) return out;
  const head = safe(() => latin1(bytes), '');
  if (!head) return out;

  // /Type /Page (not /Pages) once per page. /Count on the page tree is more
  // reliable when it is there, so it wins.
  const count = head.match(/\/Type\s*\/Pages[\s\S]{0,400}?\/Count\s+(\d+)/);
  if (count) out.pages = Number(count[1]) || 0;
  if (!out.pages) {
    const m = head.match(/\/Type\s*\/Page[^s]/g);
    out.pages = m ? m.length : 0;
  }

  const mb = head.match(MEDIABOX);
  if (mb) {
    const w = Math.abs(Number(mb[3]) - Number(mb[1]));
    const h = Math.abs(Number(mb[4]) - Number(mb[2]));
    if (w > 0 && h > 0) out.page = { width: w, height: h };
  }

  out.text = pdfText(head);
  return out;
}

// The text that sits in uncompressed content streams and in document metadata.
// Most modern PDFs compress their streams, so this finds text in some files and
// nothing in others — which is exactly why it is one signal among several and
// never the only one. Where it finds nothing, the file is reported as probably
// a scan rather than guessed at.
function pdfText(head) {
  const bits = [];
  // Text-showing operators: (string) Tj and [(a)(b)] TJ
  const re = /\(((?:\\.|[^\\()]){1,400})\)\s*(?:Tj|TJ|'|")/g;
  let m, n = 0;
  while ((m = re.exec(head)) && n < 4000) {
    const s = m[1].replace(/\\([()\\])/g, '$1').replace(/\\[0-9]{3}/g, ' ');
    if (s.trim()) { bits.push(s); n++; }
    if (bits.join(' ').length > TEXT_SAMPLE) break;
  }
  // Title and Subject from the info dictionary often name the document.
  const title = head.match(/\/(?:Title|Subject)\s*\(([^)]{1,200})\)/g);
  if (title) for (const t of title) bits.push(t.replace(/^.*?\(/, '').replace(/\)$/, ''));
  return bits.join(' ').slice(0, TEXT_SAMPLE);
}

// "A" -> 0, "Z" -> 25, "AA" -> 26. Spreadsheet column letters are base-26
// with no zero, which is why this is not a straight base conversion.
export function colIndex(letters) {
  let n = 0;
  const s = String(letters || '').toUpperCase();
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i) - 64;
    if (c < 1 || c > 26) return 0;
    n = n * 26 + c;
  }
  return n - 1;
}

function latin1(bytes) {
  const u8 = new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  }
  return s;
}

// ---------------------------------------------------------------- docx
export function probeDocx(bytes) {
  const out = { text: '', tokens: [] };
  const files = safe(() => unzipSync(new Uint8Array(bytes)), null);
  if (!files) return out;
  const parts = Object.keys(files).filter((n) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n));
  let xml = '';
  for (const n of parts) {
    xml += safe(() => strFromU8(files[n]), '');
    if (xml.length > TEXT_SAMPLE * 2) break;
  }
  if (!xml) return out;
  // Word splits a typed placeholder across runs, so "{{ref}}" is often stored
  // as "{{re" + "f}}" with tags between. Stitch those back before looking for
  // tokens, or every template reads as an ordinary document.
  const repaired = xml.replace(/\{\{(?:(?!\}\}|<\/w:p>)[\s\S]){0,600}?\}\}/g,
    (m) => m.replace(/<[^>]+>/g, ''));
  out.text = repaired.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, TEXT_SAMPLE);
  const found = new Set();
  const re = /\{\{\s*([^{}<>]{1,80}?)\s*\}\}|<<\s*([^<>{}]{1,80}?)\s*>>/g;
  let m;
  while ((m = re.exec(out.text)) && found.size < 80) {
    const t = (m[1] || m[2] || '').trim();
    if (t) found.add(t);
  }
  out.tokens = [...found];
  return out;
}

// ---------------------------------------------------------------- xlsx
//
// The first worksheet's header row decides what a spreadsheet is, so that is
// all this reads: the shared strings table, the first sheet, and the first row
// that looks like a header.
// opts.maxRows: the probe only needs the top of a sheet to classify it (400
// rows), but an IMPORT needs every row. A priced bill or a drawing list read
// through the probe's default was cut off at 400 lines without a word, which
// is a bill that silently does not add up — so importers pass a large limit,
// and a sheet that still reaches it says so (`truncated`).
export function probeXlsx(bytes, opts = {}) {
  const maxRows = Math.max(1, Number(opts.maxRows) || 400);
  const out = { header: [], rowCount: 0, tokens: [], rows: [] };
  const files = safe(() => unzipSync(new Uint8Array(bytes)), null);
  if (!files) return { ...out, unreadable: true };

  const shared = [];
  if (files['xl/sharedStrings.xml']) {
    const xml = safe(() => strFromU8(files['xl/sharedStrings.xml']), '');
    const re = /<si>([\s\S]*?)<\/si>/g;
    let m;
    while ((m = re.exec(xml)) && shared.length < 50000) {
      shared.push(m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim());
    }
  }

  const sheetName = Object.keys(files).find((n) => /^xl\/worksheets\/sheet\d*\.xml$/.test(n));
  if (!sheetName) return { ...out, unreadable: true };
  const sheet = safe(() => strFromU8(files[sheetName]), '');
  if (!sheet) return { ...out, unreadable: true };

  // A cell is placed by its OWN reference — the r="C5" attribute — not by the
  // order it appears in.
  //
  // This matters more than it looks. Excel and most writers OMIT empty cells
  // entirely rather than writing a placeholder, so a row whose Section column
  // is blank arrives with one fewer <c> than the header has columns. Read the
  // cells in order and every column after the gap shifts left: the unit becomes
  // the quantity, the rate becomes the amount, and a bill imports silently
  // wrong. Continuation lines with a blank section are the normal shape of a
  // real BOQ, so this is not an edge case.
  const rows = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let r;
  while ((r = rowRe.exec(sheet))) {
    if (rows.length >= maxRows) { out.truncated = true; break; }
    const cells = [];
    const cRe = /<c([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let c;
    while ((c = cRe.exec(r[1]))) {
      const attrs = c[1] || '';
      const ref = (attrs.match(/\sr="([A-Z]+)\d+"/) || [])[1];
      const type = (attrs.match(/\st="(\w+)"/) || [])[1];
      const inner = c[2];
      let value = '';
      if (inner != null) {
        const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        const inline = (inner.match(/<is>([\s\S]*?)<\/is>/) || [])[1];
        if (inline != null) value = inline.replace(/<[^>]+>/g, '').trim();
        else if (type === 's' && v != null) value = shared[Number(v)] || '';
        else value = v == null ? '' : String(v);
      }
      const at = ref ? colIndex(ref) : cells.length;
      while (cells.length < at) cells.push('');       // fill the gap the writer left out
      cells[at] = value;
    }
    rows.push(cells);
  }
  if (!rows.length) return out;

  // The header is the first row carrying two or more non-numeric cells. A
  // workbook often opens with a title row and a blank row before the real one.
  let hi = 0;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const words = rows[i].filter((x) => x && isNaN(Number(x)));
    if (words.length >= 2) { hi = i; break; }
  }
  out.header = rows[hi] || [];
  out.rows = rows.slice(hi + 1).filter((row) => row.some((x) => String(x).trim() !== ''));
  out.rowCount = out.rows.length;

  const joined = rows.flat().join(' ');
  const found = new Set();
  const re = /\{\{\s*([^{}]{1,60}?)\s*\}\}|<<\s*([^<>]{1,60}?)\s*>>/g;
  let m;
  while ((m = re.exec(joined)) && found.size < 60) {
    const t = (m[1] || m[2] || '').trim();
    if (t) found.add(t);
  }
  out.tokens = [...found];
  return out;
}

// ---------------------------------------------------------------- csv
export function probeCsv(bytes, opts = {}) {
  const full = Number(opts.maxRows) > 400;
  const text = safe(() => new TextDecoder().decode(full ? bytes : bytes.slice(0, 200000)), '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { header: [], rowCount: 0, rows: [] };
  const split = (l) => l.split(',').map((s) => s.replace(/^"|"$/g, '').trim());
  const rows = lines.slice(1).map(split);
  return { header: split(lines[0]), rowCount: rows.length, rows, tokens: [] };
}

// ---------------------------------------------------------------- the front door
//
// One call, whatever the file. `filename` picks the reader; anything it cannot
// read comes back as an empty probe, which the classifier turns into
// "unidentified" and the review screen turns into a question for a person.
export function probe(filename, bytes, opts = {}) {
  const ext = String(filename || '').toLowerCase().match(/\.([a-z0-9]{1,5})$/);
  const e = ext ? ext[1] : '';
  if (!bytes || !bytes.length) return {};
  if (e === 'pdf') return probePdf(bytes);
  if (e === 'docx') return probeDocx(bytes);
  if (e === 'xlsx' || e === 'xlsm') return probeXlsx(bytes, opts);
  if (e === 'csv') return probeCsv(bytes, opts);
  if (e === 'xls') return { unreadable: true };          // pre-2007 binary: filed unread
  return {};
}

// The drawing number from a filename, reusing the register's own reader so
// intake and the manual upload screen agree about what a number looks like.
export function numberFromName(filename, fromFileName) {
  if (typeof fromFileName !== 'function') return null;
  const r = safe(() => fromFileName(String(filename || '')), null);
  return (r && r.number) || null;
}

// ---------------------------------------------------------------- column mapping
//
// A probe returns rows of cells. The importers want objects keyed by what each
// column MEANS — section, ref, description, unit, qty, rate, amount. Something
// has to map one to the other, and until this existed intake handed the BOQ
// importer an empty list and reported "no rows to import" on a workbook that
// had four hundred of them.
//
// The header row decides. Matching is loose on purpose: a header reads "Qty",
// "Quantity", "QTY." or "Qty (m3)" depending on who built the bill, and all
// four mean the same thing.
const COLUMN_WORDS = {
  section:     [/^sect/, /^bill/, /^trade/],
  ref:         [/^ref/, /^item\s*(no|code|ref)?$/, /^code$/, /^sr\.?\s*no/],
  description: [/^desc/, /^particular/, /^work/, /^item\s*desc/],
  material:    [/^material/, /^product/],
  unit:        [/^unit$/, /^uom$/, /^u\.?o\.?m/],
  qty:         [/^qty/, /^quantit/, /^nr$/, /^no\.?$/],
  budget_qty:  [/^budget\s*(qty|quantit)/, /^budget$/],
  rate:        [/^rate/, /^unit\s*(rate|price|cost)/, /^price/],
  amount:      [/^amount/, /^total/, /^value/, /^sum$/],
  billed_pct:  [/^billed/, /^%\s*(complete|billed)/, /^progress/],
};

export function mapColumns(header) {
  const out = {};
  const cells = (header || []).map((h) => String(h == null ? '' : h).toLowerCase().replace(/\s+/g, ' ').trim());
  for (const [field, tests] of Object.entries(COLUMN_WORDS)) {
    for (let i = 0; i < cells.length; i++) {
      if (out[field] != null) break;
      if (!cells[i]) continue;
      if (tests.some((re) => re.test(cells[i]))) out[field] = i;
    }
  }
  return out;
}

// Rows of cells → rows the importers understand. A row with nothing in any
// mapped column is dropped rather than imported as a blank line: bills are full
// of spacer rows, section headings and subtotals, and importing those as items
// makes a bill that does not add up.
// The wording a bill uses for its own arithmetic.
const TOTAL_WORDS = /^(sub[\s-]*total|total|collection|carried\s+(to|forward)|brought\s+forward|c\/f|b\/f|to\s+collection|to\s+summary|page\s+total|grand\s+total)\b/i;

export function mapRows(header, rows, kind) {
  const col = mapColumns(header);
  const at = (r, f) => (col[f] == null ? '' : String(r[col[f]] == null ? '' : r[col[f]]).trim());
  const num = (v) => {
    const n = Number(String(v).replace(/[, ]/g, ''));
    return isFinite(n) ? n : 0;
  };
  const out = [];
  for (const r of rows || []) {
    if (!Array.isArray(r)) continue;
    const description = at(r, 'description') || at(r, 'material');
    const qtyRaw = kind === 'bom' ? (at(r, 'budget_qty') || at(r, 'qty')) : at(r, 'qty');
    const rate = at(r, 'rate'), amount = at(r, 'amount');

    // A heading carries a description and no figures. Not an item.
    if (!description) continue;
    if (!qtyRaw && !rate && !amount) continue;

    // A bill's own arithmetic — subtotals, collections, amounts carried
    // forward — must never be imported as items, or the bill counts its own
    // totals twice and no longer adds up.
    //
    // The test is deliberately narrow: the row must BOTH read like a total AND
    // carry no quantity and no rate. A lump-sum item priced with an amount
    // alone is legitimate and common, and dropping every amount-only row to
    // catch subtotals would quietly delete real money from the bill.
    if (!qtyRaw && !rate && TOTAL_WORDS.test(description)) continue;
    const row = {
      section: at(r, 'section'), ref: at(r, 'ref'), description,
      unit: at(r, 'unit'),
      qty: num(qtyRaw), rate: num(rate),
      amount: amount === '' ? '' : num(amount),
      billed_pct: at(r, 'billed_pct') === '' ? 0 : num(at(r, 'billed_pct')),
    };
    if (kind === 'bom') { row.material = description; row.budget_qty = row.qty; }
    out.push(row);
  }
  return out;
}
