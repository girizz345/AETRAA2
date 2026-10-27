// K1 — THE PRICED BOQ AND THE BOM: READ, CHECKED, ACCEPTED, APPROVED.
//
// v5 E7 (approved 5 Oct 2026):
//   1 QS uploads the BOQ            → read sections, items, quantities, rates, amounts → preview with totals
//   2 Platform                      → checks totals, flags lines with no rate or a wrong sum → flag list
//   3 QS fixes or accepts flagged lines                                                 → clean BOQ
//   4 PM approves                                                                       → BOQ live for IPC
// v5 E8: the same for the BOM, by Procurement, with each material matched to a
// BOQ line and the unmatched list resolved before the PM approves; the approved
// BOM drives requests, orders and GRN.
//
// The gap this closes: importBOQ takes whatever Amount it is given and works out
// qty × rate only when the Amount is blank, so on its own it accepts a bill that
// does not add up — and a bill that does not add up produces certificates that
// do not add up (spec §18). So nothing reaches importBOQ from Setup, from intake
// or from the API without passing through here first: read, check, every flag
// fixed or explicitly accepted with a reason, then imported, then approved.
//
// The E-program condition (v5, every E tab): fully deterministic — the same
// file always gives the same result, kept against the file's SHA-256 and this
// reader's version; every row reported as read, not read or held, with the
// reason. No AI here.
//
// Money is worked in whole fils and quantities in thousandths (money.js), so
// the line count and the total match the source file exactly.

import { unzipSync, strFromU8 } from 'fflate';
import { colIndex, mapColumns } from './intake-probe.js';
import { fils, milli, lineAmount, decimalsOf, fmtFils, toAED } from './money.js';
import { importBOQ, ensureBoqTable } from './commercial.js';
import { importBOM, ensureBomTable } from './bom.js';
import { lineKey } from './ipc.js';
import { addColumns } from './db-cols.js';
import { putFile, getFile, bytesToB64 } from './storage.js';

export const READER_VERSION = 'bills-v1';
const nowISO = () => new Date().toISOString();
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const str = (v, n = 300) => String(v == null ? '' : v).slice(0, n);
const parse = (v, d) => { try { const j = JSON.parse(v || ''); return j == null ? d : j; } catch (e) { return d; } };
const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();

export const MAX_BILL_BYTES = 25 * 1024 * 1024;      // the attachment limit; a bill is far smaller
export const MAX_UNZIPPED = 120 * 1024 * 1024;       // measured before anything is inflated (§19)
export const MAX_LINES = 50000;                      // past this it is refused, never cut short (§15 test 8)

export const KIND_LABEL = { boq: 'priced BOQ', bom: 'bill of materials' };

/* ================================================================ reading
 *
 * Every worksheet, in workbook order, each row with its own row number, each
 * cell placed by its own reference (a writer leaves empty cells out, and
 * reading in order would shift the rate into the amount). A CSV is read with
 * its quotes honoured, so "Concrete, grade C40" is one cell.
 */

const xmlText = (s) => String(s)
  .replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&');

function readXlsx(bytes) {
  let total = 0, tooBig = false, files;
  try {
    files = unzipSync(new Uint8Array(bytes), {
      filter(f) { total += f.originalSize || 0; if (total > MAX_UNZIPPED) tooBig = true; return !tooBig; },
    });
  } catch (e) { return { error: 'that workbook could not be opened — save it again as .xlsx and try once more' }; }
  if (tooBig) return { error: 'that workbook expands to more than ' + Math.round(MAX_UNZIPPED / 1048576) + ' MB, which is not a bill' };
  if (!files['xl/workbook.xml']) return { error: 'that file is not an Excel workbook' };

  const shared = [];
  if (files['xl/sharedStrings.xml']) {
    const xml = strFromU8(files['xl/sharedStrings.xml']);
    const re = /<si>([\s\S]*?)<\/si>/g;
    let m;
    while ((m = re.exec(xml))) {
      // rich text arrives as several <t> runs; phonetic runs (<rPh>) are not text
      const runs = m[1].replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
      const ts = runs.match(/<t(?:\s[^>]*)?>[\s\S]*?<\/t>/g) || [];
      shared.push(ts.map(xmlText).join('').trim());
    }
  }
  const wb = strFromU8(files['xl/workbook.xml']);
  const rels = files['xl/_rels/workbook.xml.rels'] ? strFromU8(files['xl/_rels/workbook.xml.rels']) : '';
  const target = {};
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = (m[1].match(/\bId="([^"]+)"/) || [])[1];
    const t = (m[1].match(/\bTarget="([^"]+)"/) || [])[1];
    if (id && t) target[id] = t.replace(/^\/?xl\//, '').replace(/^\//, '');
  }
  const sheets = [];
  for (const m of wb.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = xmlText((m[1].match(/\bname="([^"]*)"/) || [])[1] || 'Sheet');
    const state = (m[1].match(/\bstate="([^"]*)"/) || [])[1] || 'visible';
    const rid = (m[1].match(/\br:id="([^"]*)"/) || [])[1];
    const part = rid && target[rid] ? files['xl/' + target[rid]] : null;
    sheets.push({ name, hidden: state !== 'visible', rows: part ? sheetRows(strFromU8(part), shared) : [] });
  }
  // A workbook made on an old Mac counts its dates from 1904 (K6 reads dates).
  return { ok: true, format: 'xlsx', sheets, date1904: /<workbookPr\b[^>]*\bdate1904="(1|true)"/.test(wb) };
}

function sheetRows(xml, shared) {
  const rows = [];
  let n = 0;
  for (const r of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rn = Number((r[1].match(/\br="(\d+)"/) || [])[1]) || (n + 1);
    n = rn;
    const cells = [];
    for (const c of (r[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1] || '';
      const ref = (attrs.match(/\br="([A-Z]+)\d+"/) || [])[1];
      const type = (attrs.match(/\bt="(\w+)"/) || [])[1];
      const inner = c[2];
      let v = '';
      if (inner != null) {
        const raw = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        const inline = (inner.match(/<is>([\s\S]*?)<\/is>/) || [])[1];
        if (inline != null) v = xmlText(inline).trim();
        else if (type === 's' && raw != null) v = shared[Number(raw)] || '';
        else if (raw != null) v = xmlText(raw);
      }
      const at = ref ? colIndex(ref) : cells.length;
      while (cells.length < at) cells.push('');
      cells[at] = String(v);
    }
    rows.push({ n: rn, cells });
  }
  return rows;
}

export function readCsvText(text) {
  const s = String(text || '').replace(/^﻿/, '');
  const first = s.split(/\r?\n/)[0] || '';
  const delim = (first.split('\t').length > first.split(',').length) ? '\t'
    : (first.split(';').length > first.split(',').length ? ';' : ',');
  const rows = [];
  let row = [], field = '', quoted = false, line = 1, start = 1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else { if (ch === '\n') line++; field += ch; }
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\r') { /* ignore */ }
    else if (ch === '\n') { row.push(field); rows.push({ n: start, cells: row }); row = []; field = ''; line++; start = line; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push({ n: start, cells: row }); }
  return { ok: true, format: 'csv', sheets: [{ name: 'CSV', hidden: false, rows }] };
}

export function readBillFile(filename, bytes) {
  const e = (String(filename || '').toLowerCase().match(/\.([a-z0-9]{1,5})$/) || [])[1] || '';
  if (!bytes || !bytes.length) return { error: 'the file is empty' };
  if (bytes.length > MAX_BILL_BYTES) return { error: 'that file is larger than 25 MB — a bill is far smaller; check it is the right file' };
  if (e === 'xls') return { error: 'that is an old Excel file (.xls). Open it in Excel and save it as .xlsx, then upload that.' };
  if (e === 'csv') return readCsvText(new TextDecoder('utf-8').decode(bytes));
  if (e === 'xlsx' || e === 'xlsm') return readXlsx(bytes);
  return { error: 'a bill must be an Excel workbook (.xlsx) or a CSV file' };
}

/* ================================================================ mapping
 *
 * Each worksheet is judged on its own header row: the first of its top twenty
 * rows with two or more cells of words. A sheet whose header maps a description
 * and a figure is a bill sheet; anything else (a cover, an index, a blank tab)
 * is reported as not read, with the reason. A sheet named as a summary or a
 * collection repeats the other sheets' totals — read, but not imported, or the
 * bill would count itself twice.
 */

const EXTRA_WORDS = {
  boq_ref: [/^boq\s*(ref|item|no|code)/, /^bill\s*(ref|item)/],
  discipline: [/^discipline/, /^trade$/, /^package/],
};
const SUMMARY_SHEET = /^(main\s+|grand\s+|general\s+)?(summary|collection|cover|index|contents|bill\s+summary)\b/i;
const TOTAL_WORDS = /^(sub[\s-]*total|total|section\s+total|page\s+total|grand\s+total|collection|carried\s+(to|forward)|brought\s+forward|c\/f|b\/f|to\s+collection|to\s+summary)\b/i;
const COMPARABLE_TOTAL = /^(sub[\s-]*total|total|section\s+total|page\s+total)\b/i;
const GRAND_TOTAL = /^grand\s+total\b/i;

// The header row is the one that names a description AND a figure column —
// not merely the first row with words, because a consultant's bill opens with
// a title block ("BILL OF QUANTITIES · BILL NO. · PAGE NO.") above it. A header
// split over two rows ("ITEM / REF.", "UNIT / RATE", "TOTAL PRICE / AED") is
// read as one. Checked on a real bill (B+G+5, Sharjah), where the first-row
// rule read every sheet as having no description column.
const hcell = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
const isWordy = (x) => !!x && isNaN(Number(String(x).replace(/,/g, '')));
function headerOf(rows, kind) {
  const lim = Math.min(rows.length, 30);
  let best = null;
  const descOf = (col) => col.description != null || (kind === 'bom' && col.material != null);
  for (let i = 0; i < lim; i++) {
    const cells = rows[i].cells.map(hcell);
    if (cells.filter(isWordy).length < 2) continue;
    const next = rows[i + 1] && rows[i + 1].n === rows[i].n + 1 ? rows[i + 1].cells.map(hcell) : null;
    // A continuation row: words only, short, no figures.
    const cont = next && next.some(Boolean) && next.every((x) => !x || (isWordy(x) && x.length <= 20));
    for (const two of cont ? [false, true] : [false]) {
      const head = two ? cells.map((x, k) => [x, next[k] || ''].filter(Boolean).join(' ')) : cells;
      const col = columnsFor(head.map((x) => x.replace(/[.:]+(\s|$)/g, '$1').trim()));
      const figs = ['qty', 'budget_qty', 'rate', 'amount', 'unit'].filter((f) => col[f] != null).length;
      if (!descOf(col) || !figs) continue;
      // A second header row is taken only when it maps MORE ("UNIT / RATE"
      // gives the rate column); a heading under the header ("EXCAVATION")
      // adds nothing, so it stays a heading.
      const score = figs * 2 + (col.ref != null ? 1 : 0);
      if (!best || score > best.score) best = { index: i, header: head, span: two ? 2 : 1, score };
    }
    if (best && i > best.index + 1) break;
  }
  if (best) return best;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cells = rows[i].cells.map(hcell);
    if (cells.filter(isWordy).length >= 2) return { index: i, header: cells, span: 1 };
  }
  return null;
}

function columnsFor(header) {
  const col = mapColumns(header);
  const cells = header.map((h) => norm(h));
  for (const [field, tests] of Object.entries(EXTRA_WORDS)) {
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] && tests.some((re) => re.test(cells[i]))) { col[field] = i; break; }
    }
  }
  // "BOQ ref" also reads as a plain "ref"; it is the BOQ's reference, not the BOM's own
  if (col.boq_ref != null && col.ref === col.boq_ref) delete col.ref;
  if (col.boq_ref != null && col.section === col.boq_ref) delete col.section;   // "Bill ref" is not a section
  return col;
}

// Lines, totals and every row's fate, in reading order.
//   include: the sheet names to read (default: every bill sheet not named as a summary)
export function mapBill(book, kind, include) {
  const lines = [], totals = [], rowsNotRead = [], sheets = [];
  for (const sh of book.sheets || []) {
    const s = { name: sh.name, hidden: !!sh.hidden, header_row: null, columns: {}, unmapped: [], lines: 0, status: '' };
    sheets.push(s);
    const H = headerOf(sh.rows, kind);
    if (!H) {
      s.status = sh.rows.length ? 'not read — no header row' : 'not read — the sheet is empty';
      continue;
    }
    const hi = H.index + H.span - 1;                       // the data starts under the header's last row
    const header = H.header;
    const col = columnsFor(header.map((x) => x.replace(/[.:]+(\s|$)/g, '$1').trim()));
    s.header_row = H.span > 1 ? sh.rows[H.index].n + '–' + sh.rows[H.index + 1].n : sh.rows[H.index].n;
    s.columns = Object.fromEntries(Object.entries(col).map(([k, i]) => [k, header[i]]));
    s.unmapped = header.filter((h, i) => h && !Object.values(col).includes(i));
    const descCol = kind === 'bom' ? (col.material != null ? 'material' : 'description') : 'description';
    const figure = kind === 'bom' ? (col.budget_qty != null || col.qty != null) : (col.qty != null || col.rate != null || col.amount != null);
    if (col[descCol] == null || !figure) {
      s.status = 'not read — the header (' + header.filter(Boolean).slice(0, 5).join(', ') + ') has no ' +
        (col[descCol] == null ? (kind === 'bom' ? 'material or description' : 'description') : (kind === 'bom' ? 'quantity' : 'quantity, rate or amount')) + ' column';
      continue;
    }
    const isSummary = SUMMARY_SHEET.test(sh.name);
    const chosen = include ? include.includes(sh.name) : !isSummary;
    if (!chosen) {
      s.status = isSummary ? 'not imported — a summary sheet repeats the other sheets’ totals' : 'not imported — left out by you';
      s.summary = isSummary;
      continue;
    }
    s.status = 'read';
    const at = (cells, f) => (col[f] == null ? '' : String(cells[col[f]] == null ? '' : cells[col[f]]).trim());
    let runFils = 0, sheetFils = 0;
    // With no section column, a line's section is the "SECTION D - MASONRY
    // WORK" heading above it, as a bill is laid out.
    let heading = '';
    // A printed bill repeats its title block and its column headings at the
    // top of every page. Those rows are the page, not the bill.
    const lc = (x) => hcell(x).toLowerCase();
    const titleFirst = new Set(sh.rows.slice(0, H.index).map((r) => lc(r.cells.find((x) => hcell(x)) || '')).filter(Boolean));
    const headRows = sh.rows.slice(H.index, H.index + H.span).map((r) => r.cells.map(lc));
    const repeatsHeader = (cells) => headRows.some((hr) => {
      const filled = cells.map(lc).map((x, k) => [x, k]).filter(([x]) => x);
      return (filled.length >= 1 && filled.every(([x, k]) => hr[k] === x && isWordy(x)))
        || (filled.length >= 2 && filled.filter(([x, k]) => hr[k] === x).length >= Math.max(2, filled.length - 1));
    });
    for (let i = hi + 1; i < sh.rows.length; i++) {
      const { n, cells } = sh.rows[i];
      const where = { sheet: sh.name, row: n };
      if (!cells.some((x) => String(x).trim())) continue;                      // a blank row: nothing to report
      if (titleFirst.has(lc(cells.find((x) => hcell(x)) || '')) || repeatsHeader(cells)) {
        rowsNotRead.push({ ...where, text: cells.filter((x) => hcell(x)).join(' · ').slice(0, 80), why: 'the page’s own heading, repeated' });
        continue;
      }
      const description = at(cells, descCol) || (kind === 'bom' ? at(cells, 'description') : '');
      const qtyRaw = kind === 'bom' ? (at(cells, 'budget_qty') || at(cells, 'qty')) : at(cells, 'qty');
      const rateRaw = at(cells, 'rate'), amountRaw = at(cells, 'amount');
      const hasFig = qtyRaw !== '' || rateRaw !== '' || amountRaw !== '';
      if (!hasFig) {
        if (col.section == null && /^section\b/i.test(description)) heading = description.replace(/\s+/g, ' ').trim().slice(0, 120);
        rowsNotRead.push({ ...where, text: description || cells.filter(Boolean).join(' · ').slice(0, 80), why: description ? 'heading' : 'no figures' });
        continue;
      }
      if (qtyRaw === '' && rateRaw === '' && TOTAL_WORDS.test(description)) {
        const stated = fils(amountRaw);
        if (COMPARABLE_TOTAL.test(description) || GRAND_TOTAL.test(description)) {
          totals.push({ ...where, text: description, raw: amountRaw, stated,
            computed: GRAND_TOTAL.test(description) ? sheetFils : runFils, grand: GRAND_TOTAL.test(description), decimals: decimalsOf(amountRaw) });
        } else {
          rowsNotRead.push({ ...where, text: description, why: 'carried / brought forward — not compared' });
        }
        if (COMPARABLE_TOTAL.test(description)) runFils = 0;
        continue;
      }
      const line = {
        i: lines.length, ...where,
        section: at(cells, 'section') || heading, ref: at(cells, 'ref'), description: description || '',
        unit: at(cells, 'unit'), qty: qtyRaw, rate: rateRaw, amount: amountRaw,
        billed_pct: at(cells, 'billed_pct'),
        ...(kind === 'bom' ? { boq_ref: at(cells, 'boq_ref'), discipline: at(cells, 'discipline') } : {}),
      };
      lines.push(line);
      s.lines++;
      const v = valueOf(line, kind);
      if (v != null) { runFils += v; sheetFils += v; }
    }
  }
  return { lines, totals, rows_not_read: rowsNotRead, sheets };
}

// A line's value in fils: the Amount as written, or qty × rate when it has none.
export function valueOf(line, kind) {
  const a = fils(line.amount);
  if (a != null) return a;
  const q = milli(kind === 'bom' && line.budget_qty != null ? line.budget_qty : line.qty);
  const r = fils(line.rate);
  return q != null && r != null ? lineAmount(q, r) : null;
}

/* ================================================================ checking
 *
 * Each line is checked, and each finding is a FLAG the QS must fix in the file
 * or accept with a reason. Nothing is corrected here: a wrong sum is reported
 * as read, with the arithmetic beside it, never "fixed".
 *
 *   wrong-sum       qty × rate is not the amount given, within the precision the
 *                   amount was written to (a fil; or half a dirham for whole dirhams)
 *   no-rate         no rate, or a rate that is a word ("Included") or 0
 *   no-amount       no amount, and qty × rate cannot be worked out
 *   bad-figure      a quantity or amount that is not a number
 *   negative        a negative amount (an omission or a credit)
 *   no-description  figures with no description
 *   total-mismatch  a sub-total or grand total in the bill that its lines do not add up to
 *   no-quantity     (BOM) a material with no budget quantity
 */
export const FLAG_TEXT = {
  'wrong-sum': 'quantity × rate is not the amount',
  'no-rate': 'no rate',
  'no-amount': 'no amount',
  'bad-figure': 'a figure that is not a number',
  'negative': 'a negative amount',
  'no-description': 'no description',
  'total-mismatch': 'the bill’s own total does not add up',
  'no-quantity': 'no budget quantity',
};

const tolerance = (raw) => { const d = decimalsOf(raw); return d >= 2 ? 1 : d === 1 ? 5 : 50; };

export function checkBill(mapped, kind) {
  const flags = [];
  const flag = (id, kind2, where, text) => flags.push({ id, kind: kind2, ...where, text });
  let total = 0;
  const bySection = new Map();
  for (const l of mapped.lines) {
    const where = { line: l.i, sheet: l.sheet, row: l.row, ref: l.ref, description: l.description };
    const q = milli(l.qty), r = fils(l.rate), a = fils(l.amount);
    if (!l.description) flag(l.i + ':no-description', 'no-description', where, 'row ' + l.row + ' has figures but no description');
    if (l.qty !== '' && q == null && a == null) flag(l.i + ':bad-figure', 'bad-figure', where, 'the quantity reads "' + l.qty + '"');
    if (l.amount !== '' && a == null) flag(l.i + ':bad-figure', 'bad-figure', where, 'the amount reads "' + l.amount + '"');
    if (kind === 'boq') {
      if (r == null) flag(l.i + ':no-rate', 'no-rate', where, l.rate === '' ? 'no rate' : 'the rate reads "' + l.rate + '"');
      else if (r === 0 && q) flag(l.i + ':no-rate', 'no-rate', where, 'the rate is 0');
    } else if (q == null) {
      flag(l.i + ':no-quantity', 'no-quantity', where, l.qty === '' ? 'no budget quantity' : 'the quantity reads "' + l.qty + '"');
    }
    if (q != null && r != null && a != null) {
      const computed = lineAmount(q, r);
      if (Math.abs(computed - a) > tolerance(l.amount)) {
        flag(l.i + ':wrong-sum', 'wrong-sum', where, l.qty + ' × ' + l.rate + ' = ' + fmtFils(computed) + ', but the amount given is ' + fmtFils(a));
      }
    }
    const v = valueOf(l, kind);
    // A line already flagged for its rate is not flagged again for the amount that rate would have made.
    if (v == null && kind === 'boq' && r != null) flag(l.i + ':no-amount', 'no-amount', where, 'no amount, and quantity × rate cannot be worked out');
    if (v != null && v < 0) flag(l.i + ':negative', 'negative', where, 'the amount is negative (' + fmtFils(v) + ')');
    l.value = v;
    if (v != null) {
      total += v;
      const k = l.section || '(no section)';
      bySection.set(k, (bySection.get(k) || 0) + v);
    }
  }
  for (const t of mapped.totals) {
    if (t.stated == null) {
      flag('t' + t.sheet + '!' + t.row + ':total-mismatch', 'total-mismatch', { sheet: t.sheet, row: t.row, description: t.text },
        t.text + ' reads "' + t.raw + '", which is not a number');
      continue;
    }
    const diff = Math.abs(t.stated - t.computed);
    t.ok = diff <= tolerance(t.raw);
    if (!t.ok && t.grand) { t.ok = Math.abs(t.stated - total) <= tolerance(t.raw); if (t.ok) t.computed = total; }
    if (!t.ok) {
      flag('t' + t.sheet + '!' + t.row + ':total-mismatch', 'total-mismatch', { sheet: t.sheet, row: t.row, description: t.text },
        t.text + ' in the bill is ' + fmtFils(t.stated) + ', but the lines above it add up to ' + fmtFils(t.computed));
    }
  }
  return {
    flags,
    totals: {
      lines: mapped.lines.length, total_fils: total, total: fmtFils(total),
      by_section: [...bySection.entries()].map(([section, v]) => ({ section, total_fils: v, total: fmtFils(v) })),
      checked_totals: mapped.totals.map((t) => ({ sheet: t.sheet, row: t.row, text: t.text, stated: t.stated == null ? null : fmtFils(t.stated), lines_add_up_to: fmtFils(t.computed), ok: !!t.ok })),
    },
  };
}

// Rows from a JSON caller (the setup console's old path, the demo seed): read
// as they are given, with no sheet.
export function mapRowsGiven(rows, kind) {
  const lines = [];
  (rows || []).forEach((r, i) => {
    if (!r || typeof r !== 'object') return;
    const s = (v) => (v == null ? '' : String(v).trim());
    const description = s(kind === 'bom' ? (r.material || r.description) : r.description);
    lines.push({
      i: lines.length, sheet: '', row: i + 1, section: s(r.section), ref: s(r.ref), description,
      unit: s(r.unit), qty: s(kind === 'bom' ? (r.budget_qty != null && r.budget_qty !== '' ? r.budget_qty : r.qty) : r.qty),
      rate: s(r.rate), amount: s(r.amount), billed_pct: s(r.billed_pct),
      ...(kind === 'bom' ? { boq_ref: s(r.boq_ref), discipline: s(r.discipline) } : {}),
    });
  });
  return { lines, totals: [], rows_not_read: [], sheets: [{ name: '(sent as rows)', status: 'read', lines: lines.length }] };
}

/* ================================================================ storage */

// total_fils is REAL, not INTEGER: PostgreSQL's INTEGER is 4 bytes and stops at
// AED 21.4m in fils; REAL becomes an 8-byte DOUBLE PRECISION there
// (db-postgres.js), which holds every whole number of fils exactly.
let tablesReady = false;
export async function ensureBillTables(env) {
  if (tablesReady) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS bill_imports (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, org_id TEXT, kind TEXT, source TEXT,
         filename TEXT, sha256 TEXT, file_key TEXT, reader TEXT, status TEXT,
         sheets TEXT, lines TEXT, rows_not_read TEXT, flags TEXT, accepted TEXT, totals TEXT,
         line_count INTEGER, total_fils REAL, include_sheets TEXT,
         batch_id TEXT, item_id TEXT, created_by TEXT, created_at TEXT, decided_by TEXT, decided_at TEXT)`
    ).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_bill_imports_p ON bill_imports(project_id, kind, status)').run();
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS bom_links (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, mkey TEXT, boq_key TEXT, boq_label TEXT,
         how TEXT, state TEXT, note TEXT, by TEXT, at TEXT)`
    ).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_bom_links_p ON bom_links(project_id, mkey)').run();
    await ensureBoqTable(env);
    await ensureBomTable(env);
    await addColumns(env, 'bom', [['boq_ref', 'TEXT'], ['discipline', 'TEXT']]);
    await addColumns(env, 'projects', [
      ['boq_state', 'TEXT'], ['boq_import_id', 'TEXT'], ['boq_imported_by', 'TEXT'], ['boq_imported_at', 'TEXT'],
      ['boq_approved_by', 'TEXT'], ['boq_approved_at', 'TEXT'],
      ['bom_state', 'TEXT'], ['bom_import_id', 'TEXT'], ['bom_imported_by', 'TEXT'], ['bom_imported_at', 'TEXT'],
      ['bom_approved_by', 'TEXT'], ['bom_approved_at', 'TEXT'],
    ]);
    tablesReady = true;
    return true;
  } catch (e) { return false; }
}

async function sha256Hex(bytes) {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function shapeImport(r) {
  if (!r) return null;
  const flags = parse(r.flags, []), accepted = parse(r.accepted, {});
  const open = flags.filter((f) => !accepted[f.id]);
  const notRead = parse(r.rows_not_read, []);
  const reasons = {};
  for (const x of notRead) (reasons[x.why] || (reasons[x.why] = [])).push(x);
  return {
    id: r.id, project_id: r.project_id, kind: r.kind, source: r.source, filename: r.filename, sha256: r.sha256,
    reader: r.reader, status: r.status, sheets: parse(r.sheets, []), totals: parse(r.totals, {}),
    line_count: r.line_count, total: fmtFils(Number(r.total_fils) || 0),
    flags: flags.map((f) => ({ ...f, accepted: accepted[f.id] || null })),
    flags_open: open.length, flags_total: flags.length,
    flag_counts: Object.fromEntries(Object.keys(FLAG_TEXT).map((k) => [k, flags.filter((f) => f.kind === k).length]).filter(([, n]) => n)),
    rows_not_read: Object.entries(reasons).map(([why, rows]) => ({ why, count: rows.length, rows: rows.slice(0, 500) })),
    created_by: r.created_by, created_at: r.created_at, decided_by: r.decided_by, decided_at: r.decided_at,
    batch_id: r.batch_id || null, item_id: r.item_id || null,
    ready: !open.length && r.status === 'checking',
  };
}

export async function getImport(env, pid, id) {
  await ensureBillTables(env);
  const r = await env.DB.prepare('SELECT * FROM bill_imports WHERE project_id = ? AND id = ?').bind(pid, str(id, 60)).first();
  return r ? Object.assign(shapeImport(r), { _lines: parse(r.lines, []) }) : null;
}

// Read and check a bill, and keep it waiting for the QS. A new check of the
// same kind replaces the one waiting before it — there is one bill in check
// per project per kind.
//   src: { kind, source, filename, bytes } or { kind, source, rows }
export async function stageBill(env, pid, src, ctx) {
  const kind = src.kind === 'bom' ? 'bom' : 'boq';
  await ensureBillTables(env);
  const proj = await env.DB.prepare('SELECT id, org_id FROM projects WHERE id = ?').bind(pid).first();
  if (!proj) return { error: 'no such project' };
  let mapped, sha = null, fileKey = src.file_key || null;
  if (src.bytes) {
    const book = readBillFile(src.filename, src.bytes);
    if (book.error) return { error: book.error };
    mapped = mapBill(book, kind, Array.isArray(src.include_sheets) ? src.include_sheets : null);
    sha = await sha256Hex(src.bytes);
  } else {
    mapped = mapRowsGiven(src.rows, kind);
  }
  if (!mapped.lines.length) {
    const why = mapped.sheets.map((s) => s.name + ': ' + s.status).join('; ');
    return { error: 'no ' + (kind === 'bom' ? 'material' : 'priced') + ' lines could be read' + (why ? ' (' + why + ')' : ''), sheets: mapped.sheets };
  }
  if (mapped.lines.length > MAX_LINES) {
    return { error: 'that bill has ' + mapped.lines.length + ' lines and the limit is ' + MAX_LINES + '. Split it by trade and import each part.' };
  }
  const check = checkBill(mapped, kind);
  const id = uid('bill_');
  if (src.bytes && !fileKey) {
    const put = await putFile(env, 'bills/' + pid + '/' + id + '/' + str(src.filename, 120).replace(/[^\w.\- ]+/g, '_'), src.bytes,
      /\.csv$/i.test(src.filename || '') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    if (put.ok) fileKey = put.key;
  }
  await env.DB.prepare(
    `UPDATE bill_imports SET status = 'replaced', decided_by = ?, decided_at = ? WHERE project_id = ? AND kind = ? AND status = 'checking'`
  ).bind(str(ctx.who, 120), nowISO(), pid, kind).run();
  await env.DB.prepare(
    `INSERT INTO bill_imports (id, project_id, org_id, kind, source, filename, sha256, file_key, reader, status, sheets, lines,
       rows_not_read, flags, accepted, totals, line_count, total_fils, include_sheets, batch_id, item_id, created_by, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, pid, proj.org_id || null, kind, str(src.source, 20) || 'api', str(src.filename, 300) || null, sha, fileKey,
         READER_VERSION, 'checking', JSON.stringify(mapped.sheets), JSON.stringify(mapped.lines),
         JSON.stringify(mapped.rows_not_read), JSON.stringify(check.flags), '{}', JSON.stringify(check.totals),
         mapped.lines.length, check.totals.total_fils,
         Array.isArray(src.include_sheets) ? JSON.stringify(src.include_sheets) : null,
         str(src.batch_id, 60) || null, str(src.item_id, 60) || null, str(ctx.who, 120), nowISO()).run();
  return getImport(env, pid, id);
}

// Read the same stored file again with a different choice of sheets.
export async function restageBill(env, pid, id, includeSheets, ctx) {
  const imp = await getImport(env, pid, id);
  if (!imp) return { error: 'no such bill check' };
  if (imp.status !== 'checking') return { error: 'that bill is no longer waiting to be checked' };
  const row = await env.DB.prepare('SELECT file_key FROM bill_imports WHERE id = ?').bind(imp.id).first();
  const f = row && row.file_key ? await getFile(env, row.file_key) : null;
  if (!f) return { error: 'the uploaded file is not kept for this check — upload it again' };
  return stageBill(env, pid, { kind: imp.kind, source: imp.source, filename: imp.filename, bytes: f.bytes,
    file_key: row.file_key, include_sheets: includeSheets, batch_id: imp.batch_id, item_id: imp.item_id }, ctx);
}

// The QS accepts flagged lines: all of them, one kind, or a list. A reason is
// required — "accepted" with no reason is not an explanation anyone can check
// later. Each acceptance is kept with who and when.
export async function acceptFlags(env, pid, id, body, who) {
  const imp = await getImport(env, pid, id);
  if (!imp) return { error: 'no such bill check' };
  if (imp.status !== 'checking') return { error: 'that bill is no longer waiting to be checked' };
  const note = str(body && body.note, 500).trim();
  if (!note) return { error: 'say why these lines are accepted as they are — the reason is kept with the bill' };
  const want = body.all ? imp.flags.map((f) => f.id)
    : body.kind ? imp.flags.filter((f) => f.kind === body.kind).map((f) => f.id)
    : (Array.isArray(body.flags) ? body.flags.map(String) : []);
  const known = new Set(imp.flags.map((f) => f.id));
  const row = await env.DB.prepare('SELECT accepted FROM bill_imports WHERE id = ?').bind(imp.id).first();
  const accepted = parse(row && row.accepted, {});
  let n = 0;
  for (const fid of want) {
    if (!known.has(fid) || accepted[fid]) continue;
    accepted[fid] = { by: str(who, 120), at: nowISO(), note };
    n++;
  }
  if (!n) return { error: 'nothing to accept — those lines are already accepted, or are not flagged' };
  await env.DB.prepare('UPDATE bill_imports SET accepted = ? WHERE id = ?').bind(JSON.stringify(accepted), imp.id).run();
  return Object.assign(await getImport(env, pid, id), { accepted_now: n });
}

export async function discardBill(env, pid, id, who) {
  const imp = await getImport(env, pid, id);
  if (!imp) return { error: 'no such bill check' };
  if (imp.status !== 'checking') return { error: 'that bill is no longer waiting to be checked' };
  await env.DB.prepare(`UPDATE bill_imports SET status = 'discarded', decided_by = ?, decided_at = ? WHERE id = ?`)
    .bind(str(who, 120), nowISO(), imp.id).run();
  return { ok: true };
}

// The rows the importers receive. Money as exact fils turned back into dirhams
// to two places; a missing rate (accepted by the QS) imports as 0.
function rowsForImport(lines, kind) {
  return lines.map((l) => {
    const v = valueOf(l, kind);
    const q = milli(l.qty), r = fils(l.rate);
    const base = { section: l.section, ref: l.ref, description: l.description || '(no description)', unit: l.unit,
      qty: q == null ? 0 : q / 1000, rate: r == null ? 0 : toAED(r), amount: v == null ? 0 : toAED(v) };
    if (kind === 'bom') return { ...base, material: l.description || '(no description)', budget_qty: q == null ? 0 : q / 1000,
      boq_ref: l.boq_ref || '', discipline: l.discipline || '' };
    const bp = fils(l.billed_pct);
    return { ...base, billed_pct: bp == null ? 0 : Math.max(0, Math.min(100, bp / 100)) };
  });
}

// Import a checked bill. Refused while any flag is neither fixed nor accepted
// (E7 step 3). After it, the bill waits for the PM (E7/E8 step 4).
export async function commitBill(env, pid, id, who) {
  const imp = await getImport(env, pid, id);
  if (!imp) return { error: 'no such bill check' };
  if (imp.status !== 'checking') return { error: 'that bill has already been ' + imp.status };
  if (imp.flags_open) {
    return { error: imp.flags_open + ' flagged line' + (imp.flags_open === 1 ? ' is' : 's are') +
             ' neither fixed nor accepted. Fix them in the file and upload it again, or accept each one with a reason.',
             flags_open: imp.flags_open };
  }
  const rows = rowsForImport(imp._lines, imp.kind);
  const r = imp.kind === 'bom' ? await importBOM(env, pid, rows) : await importBOQ(env, pid, rows);
  if (r.error) return r;
  const at = nowISO();
  await env.DB.prepare(`UPDATE bill_imports SET status = 'imported', decided_by = ?, decided_at = ? WHERE id = ?`)
    .bind(str(who, 120), at, imp.id).run();
  const k = imp.kind;
  await env.DB.prepare(
    `UPDATE projects SET ${k}_state = 'pending', ${k}_import_id = ?, ${k}_imported_by = ?, ${k}_imported_at = ?,
       ${k}_approved_by = NULL, ${k}_approved_at = NULL WHERE id = ?`
  ).bind(imp.id, str(who, 120), at, pid).run();
  let match = null;
  if (k === 'bom') match = await matchBom(env, pid, who);
  return { ok: true, kind: k, lines: r.lines, total: imp.total, value: r.value, import_id: imp.id, state: 'pending',
           ...(match ? { matched: match.matched, proposed: match.proposed, unmatched: match.unmatched } : {}) };
}

/* ================================================================ approval
 *
 * The PM approves the BOQ before it is live for IPC valuation, and the BOM
 * before it drives orders and deliveries (E7/E8 step 4). A project that had a
 * BOQ before approval existed (no state recorded) is treated as approved: its
 * certificates were already computed from it, and stopping them on the day
 * this ships would stop real payments.
 */

export async function billState(env, pid) {
  await ensureBillTables(env);
  const p = await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(pid).first();
  if (!p) return null;
  const count = async (sql) => { try { return await env.DB.prepare(sql).bind(pid).first(); } catch (e) { return null; } };
  const boq = await count('SELECT COUNT(*) AS n, SUM(ROUND(COALESCE(amount,0) * 100)) AS f FROM boq WHERE project_id = ?');
  const bom = await count('SELECT COUNT(*) AS n FROM bom WHERE project_id = ?');
  const side = (k, lines, f) => {
    const n = Number(lines) || 0;
    const st = p[k + '_state'] || (n ? 'approved' : 'none');
    return {
      state: st, legacy: !p[k + '_state'] && n > 0, lines: n,
      ...(f != null ? { total: fmtFils(Number(f) || 0) } : {}),
      imported_by: p[k + '_imported_by'] || null, imported_at: p[k + '_imported_at'] || null,
      approved_by: p[k + '_approved_by'] || null, approved_at: p[k + '_approved_at'] || null,
      import_id: p[k + '_import_id'] || null,
    };
  };
  const waiting = async (k) => {
    const r = await env.DB.prepare(`SELECT * FROM bill_imports WHERE project_id = ? AND kind = ? AND status = 'checking' ORDER BY created_at DESC LIMIT 1`)
      .bind(pid, k).first();
    return r ? shapeImport(r) : null;
  };
  const out = { boq: side('boq', boq && boq.n, boq && boq.f), bom: side('bom', bom && bom.n, null) };
  out.boq.checking = await waiting('boq');
  out.bom.checking = await waiting('bom');
  if (out.bom.lines) out.bom.matching = await bomMatching(env, pid);
  return out;
}

export const BOQ_PENDING = 'The priced BOQ is waiting for the PM’s approval. Nothing is valued against it until the PM approves it (v5 E7 step 4).';
export const BOM_PENDING = 'The bill of materials is waiting for the PM’s approval. Orders and deliveries are recorded against it once the PM approves it (v5 E8 step 4).';

export async function approveBill(env, pid, kind, who) {
  const k = kind === 'bom' ? 'bom' : 'boq';
  const st = await billState(env, pid);
  if (!st) return { error: 'no such project' };
  const s = st[k];
  if (s.state === 'none') return { error: 'there is no ' + KIND_LABEL[k] + ' on this project to approve' };
  if (s.state !== 'pending') return { ok: true, already: true, state: s.state };
  if (k === 'bom' && s.matching && s.matching.open) {
    return { error: s.matching.open + ' material' + (s.matching.open === 1 ? ' is' : 's are') +
             ' not matched to a BOQ line yet. Procurement resolves them first (v5 E8 step 3).', open: s.matching.open };
  }
  await env.DB.prepare(`UPDATE projects SET ${k}_state = 'approved', ${k}_approved_by = ?, ${k}_approved_at = ? WHERE id = ?`)
    .bind(str(who, 120), nowISO(), pid).run();
  return { ok: true, state: 'approved' };
}

export async function billIsPending(env, pid, kind) {
  await ensureBillTables(env);
  const k = kind === 'bom' ? 'bom' : 'boq';
  const p = await env.DB.prepare(`SELECT ${k}_state AS s FROM projects WHERE id = ?`).bind(pid).first();
  return !!(p && p.s === 'pending');
}

/* ================================================================ BOM ↔ BOQ
 *
 * Each material is matched to the BOQ line(s) it is used in (E8 step 2). Two
 * deterministic rules, in order:
 *   ref    the BOM names a BOQ reference ("BOQ ref" column) and that line exists — a match
 *   name   every significant word of the material appears in a BOQ line's
 *          description — a PROPOSAL, which Procurement confirms (a word match
 *          can be wrong, and a wrong link misleads every schedule built on it)
 * A material with no confirmed link and not marked "not in the BOQ" is
 * unmatched, and the PM cannot approve the BOM until Procurement resolves it
 * (E8 step 3). Links are kept by the material's name and the BOQ line's
 * section and reference, so they survive a re-import of either bill.
 */

const STOP = new Set(['and', 'the', 'for', 'with', 'from', 'all', 'per', 'incl', 'including', 'supply', 'install', 'installation',
  'fixing', 'type', 'size', 'grade', 'class', 'mm', 'nos', 'no', 'each', 'item', 'items', 'works', 'work', 'complete', 'm2', 'm3']);
const words = (s) => norm(s).replace(/[^a-z0-9؀-ۿ ]+/g, ' ').split(' ').filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
const bomKey = (s) => norm(s);
const boqLabel = (l) => [l.ref, l.description].filter(Boolean).join(' ').slice(0, 160);

export async function matchBom(env, pid, who) {
  await ensureBillTables(env);
  const { results: bom } = await env.DB.prepare('SELECT * FROM bom WHERE project_id = ? ORDER BY COALESCE(sort_order,999999)').bind(pid).all();
  const { results: boq } = await env.DB.prepare('SELECT * FROM boq WHERE project_id = ? ORDER BY COALESCE(sort_order,999999)').bind(pid).all();
  const { results: links } = await env.DB.prepare('SELECT * FROM bom_links WHERE project_id = ?').bind(pid).all();
  const have = new Set((links || []).map((l) => l.mkey + '|' + l.boq_key));
  const decided = new Set((links || []).filter((l) => l.state === 'confirmed').map((l) => l.mkey));
  const byRef = new Map();
  for (const l of boq || []) if (l.ref) byRef.set(norm(l.ref), l);
  const boqWords = (boq || []).map((l) => ({ l, w: new Set(words(l.description)) }));
  let matched = 0, proposed = 0;
  const add = async (mk, l, how, state) => {
    const k = lineKey(l);
    if (have.has(mk + '|' + k)) return;
    have.add(mk + '|' + k);
    await env.DB.prepare(`INSERT INTO bom_links (id, project_id, mkey, boq_key, boq_label, how, state, note, by, at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .bind(uid('bml_'), pid, mk, k, boqLabel(l), how, state, null, str(who, 120), nowISO()).run();
  };
  for (const m of bom || []) {
    const mk = m.mkey || bomKey(m.material);
    if (decided.has(mk)) continue;
    const byBoqRef = m.boq_ref ? String(m.boq_ref).split(/[,;/]+/).map((x) => byRef.get(norm(x))).filter(Boolean) : [];
    if (byBoqRef.length) {
      for (const l of byBoqRef) await add(mk, l, 'ref', 'confirmed');
      matched++;
      continue;
    }
    const mw = words(m.material);
    if (!mw.length) continue;
    const hits = boqWords.filter((x) => mw.every((w) => x.w.has(w))).slice(0, 20);
    for (const h of hits) await add(mk, h.l, 'name', 'proposed');
    if (hits.length) proposed++;
  }
  const m = await bomMatching(env, pid);
  return { matched, proposed, unmatched: m.open };
}

// Where each material stands. open = neither confirmed nor marked not-in-BOQ.
export async function bomMatching(env, pid) {
  await ensureBillTables(env);
  const { results: bom } = await env.DB.prepare('SELECT id, material, mkey, unit, budget_qty, boq_ref, discipline FROM bom WHERE project_id = ? ORDER BY COALESCE(sort_order,999999)').bind(pid).all();
  const { results: links } = await env.DB.prepare('SELECT * FROM bom_links WHERE project_id = ? ORDER BY at, id').bind(pid).all();
  const by = new Map();
  for (const l of links || []) (by.get(l.mkey) || by.set(l.mkey, []).get(l.mkey)).push(l);
  const lines = (bom || []).map((m) => {
    const ls = by.get(m.mkey) || [];
    const confirmed = ls.filter((l) => l.state === 'confirmed');
    const notInBoq = confirmed.find((l) => l.how === 'none');
    return {
      material: m.material, mkey: m.mkey, unit: m.unit, budget_qty: m.budget_qty, discipline: m.discipline || null,
      state: notInBoq ? 'not in the BOQ' : confirmed.length ? 'matched' : ls.length ? 'proposed' : 'unmatched',
      note: notInBoq ? notInBoq.note : null,
      links: ls.filter((l) => l.how !== 'none').map((l) => ({ id: l.id, boq_key: l.boq_key, boq_label: l.boq_label, how: l.how, state: l.state, by: l.by, at: l.at })),
    };
  });
  return {
    lines,
    matched: lines.filter((l) => l.state === 'matched').length,
    not_in_boq: lines.filter((l) => l.state === 'not in the BOQ').length,
    proposed: lines.filter((l) => l.state === 'proposed').length,
    unmatched: lines.filter((l) => l.state === 'unmatched').length,
    open: lines.filter((l) => l.state === 'proposed' || l.state === 'unmatched').length,
  };
}

// Procurement resolves one material: confirm proposed links, link it to chosen
// BOQ lines, or mark it as not in the BOQ (with the reason).
//   body: { mkey, confirm: [linkIds] | confirm_all, link: [boq_key], not_in_boq: note }
export async function resolveBom(env, pid, body, who) {
  await ensureBillTables(env);
  const at = nowISO();
  if (body.confirm_all) {
    await env.DB.prepare(`UPDATE bom_links SET state = 'confirmed', by = ?, at = ? WHERE project_id = ? AND state = 'proposed'`)
      .bind(str(who, 120), at, pid).run();
    return { ok: true, matching: await bomMatching(env, pid) };
  }
  const mkey = norm(body.mkey);
  const m = await env.DB.prepare('SELECT mkey FROM bom WHERE project_id = ? AND mkey = ?').bind(pid, mkey).first();
  if (!m) return { error: 'that material is not in the BOM' };
  if (body.not_in_boq != null) {
    const note = str(body.not_in_boq, 300).trim();
    if (!note) return { error: 'say why it is not in the BOQ — for example, a temporary works material' };
    await env.DB.prepare(`DELETE FROM bom_links WHERE project_id = ? AND mkey = ? AND state = 'proposed'`).bind(pid, mkey).run();
    await env.DB.prepare(`INSERT INTO bom_links (id, project_id, mkey, boq_key, boq_label, how, state, note, by, at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .bind(uid('bml_'), pid, mkey, '', '', 'none', 'confirmed', note, str(who, 120), at).run();
    return { ok: true, matching: await bomMatching(env, pid) };
  }
  if (Array.isArray(body.confirm) && body.confirm.length) {
    for (const lid of body.confirm) {
      await env.DB.prepare(`UPDATE bom_links SET state = 'confirmed', by = ?, at = ? WHERE project_id = ? AND mkey = ? AND id = ?`)
        .bind(str(who, 120), at, pid, mkey, str(lid, 60)).run();
    }
    await env.DB.prepare(`DELETE FROM bom_links WHERE project_id = ? AND mkey = ? AND state = 'proposed'`).bind(pid, mkey).run();
    return { ok: true, matching: await bomMatching(env, pid) };
  }
  if (Array.isArray(body.link) && body.link.length) {
    const { results: boq } = await env.DB.prepare('SELECT * FROM boq WHERE project_id = ?').bind(pid).all();
    const byKey = new Map((boq || []).map((l) => [lineKey(l), l]));
    const chosen = body.link.map((k) => byKey.get(String(k))).filter(Boolean);
    if (!chosen.length) return { error: 'none of those BOQ lines is on this project' };
    await env.DB.prepare(`DELETE FROM bom_links WHERE project_id = ? AND mkey = ? AND (state = 'proposed' OR how = 'none')`).bind(pid, mkey).run();
    for (const l of chosen) {
      const k = lineKey(l);
      const ex = await env.DB.prepare('SELECT id FROM bom_links WHERE project_id = ? AND mkey = ? AND boq_key = ?').bind(pid, mkey, k).first();
      if (ex) await env.DB.prepare(`UPDATE bom_links SET state = 'confirmed', how = 'person', by = ?, at = ? WHERE id = ?`).bind(str(who, 120), at, ex.id).run();
      else await env.DB.prepare(`INSERT INTO bom_links (id, project_id, mkey, boq_key, boq_label, how, state, note, by, at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .bind(uid('bml_'), pid, mkey, k, boqLabel(l), 'person', 'confirmed', null, str(who, 120), at).run();
    }
    return { ok: true, matching: await bomMatching(env, pid) };
  }
  return { error: 'confirm a proposed match, choose BOQ lines, or say it is not in the BOQ' };
}

// The BOQ lines, for Procurement to choose from.
export async function boqChoices(env, pid) {
  await ensureBoqTable(env);
  const { results } = await env.DB.prepare('SELECT section, ref, description, unit FROM boq WHERE project_id = ? ORDER BY COALESCE(sort_order,999999)').bind(pid).all();
  return (results || []).map((l) => ({ key: lineKey(l), label: boqLabel(l), section: l.section || '' }));
}

export { bytesToB64 };
