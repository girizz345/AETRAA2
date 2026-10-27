// E16 (K4): A CONSULTANT'S WORD FORM, READ THE WAY E10 READS AN EXCEL ONE.
//
// v5 E16: "Same as E10 for consultant forms that come as Word documents —
// fields and signature boxes from its tables; AI (A6) only when fewer than two
// fields are found." The form arrives as it was last used: the previous job's
// subject and description still typed into the boxes, no {{placeholders}}.
//
// HOW. The document's tables are laid onto one grid of cells with A1-style
// references, exactly the shape the Excel reader produces (template-preview.js
// readSheet): each table's rows in order, each cell at its grid column, a
// merged cell (gridSpan across, vMerge down) as a merge. Paragraphs outside
// the tables become full-width rows, so the drawn form shows the whole page.
// Everything built for E10 then works unchanged on a Word form: the drawing
// (sheetHTML), the clickable cells for the Fields editor and the signature
// picker, the signature map (A1 references), the field list.
//
// THE LABEL RULES ARE WORD'S OWN. Word forms are label | value tables, and
// the value is often short plain text ("Old subject") — which E10's "short text
// in the left two columns is a label" would take for a label. Here a cell is
// read left to right in pairs: a label owns the cell beside it, and that cell
// is its box, whatever it says. A label that runs the width of its table owns
// the cell under it. Signature rows, tick-box rows, numbered lists and the
// consultant's part of the form make no fields; old names in signature rows
// are cleared.
//
// THE WRITER puts {{token}} into each box and clears the last job's text,
// keeping the cell's own formatting (its properties, and the first paragraph's
// and run's properties). Signatures are written the same way at issue.
//
// Deterministic: the same file always gives the same fields, in grid order.
// No AI here (A6 is K9's; this marks what it read so A6 never changes it).

import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { colName, parseRef } from './template-preview.js';
import { labelFor } from './template-extract.js';

export const WORD_EXTRACTOR = 'e16-1';

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const xmlText = (s) => String(s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');
const xmlEsc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The text of a stretch of WordprocessingML: <w:t> runs, tabs and breaks;
// paragraphs on their own lines.
function textOf(xml) {
  let out = '';
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>|<\/w:p>/g;
  let m;
  while ((m = re.exec(String(xml)))) {
    if (m[1] !== undefined) out += xmlText(m[1]);
    else if (m[0] === '<w:tab/>') out += '\t';
    else out += '\n';
  }
  return out.replace(/\n+$/, '');
}
// Every run that carries text is bold.
function allBold(xml) {
  const runs = [...String(xml).matchAll(/<w:r\b[\s\S]*?<\/w:r>/g)].map((m) => m[0]).filter((r) => /<w:t\b/.test(r) && /<w:t(?:\s[^>]*)?>[^<]*\S/.test(r));
  return runs.length > 0 && runs.every((r) => /<w:b\/>|<w:b w:val="(1|true|on)"\/>/.test(r));
}

/* ------------------------------------------------------------ the grid */

// The body's top-level paragraphs and tables, each table's rows and cells,
// with where each cell sits in document.xml (for the writer).
function walk(xml) {
  const bodyAt = xml.indexOf('<w:body>');
  const items = [];
  const re = /<(\/?)(w:tbl|w:tr|w:tc|w:p)\b([^>]*?)(\/?)>/g;
  re.lastIndex = bodyAt < 0 ? 0 : bodyAt;
  let depthTbl = 0, table = null, row = null, cell = null, cellNest = 0, para = null;
  let m;
  while ((m = re.exec(xml))) {
    const [tag, close, name, , self] = m;
    const at = m.index, end = at + tag.length;
    if (name === 'w:tbl') {
      if (!close) {
        if (depthTbl === 0) { table = { start: at, rows: [], grid: [] }; }
        else if (cell) cellNest++;
        depthTbl++;
      } else {
        depthTbl--;
        if (depthTbl === 0 && table) {
          table.end = end;
          const g = xml.slice(table.start, end).match(/<w:tblGrid>([\s\S]*?)<\/w:tblGrid>/);
          table.grid = g ? [...g[1].matchAll(/<w:gridCol\b[^>]*?w:w="(\d+)"/g)].map((x) => Number(x[1])) : [];
          items.push({ kind: 'table', ...table }); table = null;
        } else if (cell) cellNest--;
      }
      continue;
    }
    if (depthTbl === 0) {
      if (name === 'w:p') {
        if (self) items.push({ kind: 'p', start: at, end, xml: tag });
        else if (!close) para = at;
        else if (para != null) { items.push({ kind: 'p', start: para, end, xml: xml.slice(para, end) }); para = null; }
      }
      continue;
    }
    if (depthTbl !== 1 || cellNest > 0) continue;            // inside a nested table
    if (name === 'w:tr') {
      if (!close) row = { start: at, cells: [] };
      else if (row) { row.end = end; table.rows.push(row); row = null; }
    } else if (name === 'w:tc') {
      if (!close) cell = { start: at };
      else if (cell && row) { cell.end = end; cell.xml = xml.slice(cell.start, end); row.cells.push(cell); cell = null; }
    }
  }
  return items;
}

// The form as a grid. cells['r:c'] = { ref, text, bold, para?, table?, tc: {start,end} }.
export function readWordSheet(bytes) {
  let files;
  try { files = unzipSync(new Uint8Array(bytes)); } catch (e) { return { error: 'that is not a readable .docx form' }; }
  if (!files['word/document.xml']) return { error: 'not a Word form' };
  const xml = strFromU8(files['word/document.xml']);
  const items = walk(xml);
  const tables = items.filter((i) => i.kind === 'table');
  const width = Math.max(1, ...tables.map((t) => Math.max(t.grid.length, ...t.rows.map((r) => r.cells.reduce((s, c) => s + span(c), 0)))));
  const cells = {}, merges = [], cols = {};
  // Column widths from the widest table (twips → px).
  const widest = tables.slice().sort((a, b) => b.grid.length - a.grid.length)[0];
  if (widest) widest.grid.forEach((w, i) => { cols[i + 1] = Math.max(30, Math.round(w / 15)); });
  let r = 0, ti = 0;
  for (const it of items) {
    if (it.kind === 'p') {
      const t = textOf(it.xml);
      if (!clean(t)) continue;
      r++;
      cells[r + ':1'] = { ref: 'A' + r, text: t, bold: allBold(it.xml), para: true, xf: { font: { b: allBold(it.xml) } } };
      if (width > 1) merges.push({ r1: r, c1: 1, r2: r, c2: width });
      continue;
    }
    ti++;
    const open = {};                                     // column → the merge a vMerge continues
    const tw = Math.max(it.grid.length, ...it.rows.map((x) => x.cells.reduce((s, c) => s + span(c), 0)));
    for (const row of it.rows) {
      r++;
      let c = 1;
      for (const cell of row.cells) {
        const sp = span(cell);
        const vm = (cell.xml.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/) || [''])[0].match(/<w:vMerge(?:\s+w:val="(\w+)")?\s*\/>/);
        if (vm && vm[1] !== 'restart' && open[c]) {
          open[c].r2 = r;                                  // continues the box above
        } else {
          const text = textOf(cell.xml.replace(/<w:tcPr>[\s\S]*?<\/w:tcPr>/, ''));
          cells[r + ':' + c] = { ref: colName(c) + r, text, bold: allBold(cell.xml), table: ti, tableCols: tw, tc: { start: cell.start, end: cell.end },
            xf: { border: { l: '1px solid #555', r: '1px solid #555', t: '1px solid #555', b: '1px solid #555' }, font: { b: allBold(cell.xml) }, wrap: true, v: 'top' } };
          const g = { r1: r, c1: c, r2: r, c2: c + sp - 1 };
          if (sp > 1 || (vm && vm[1] === 'restart')) merges.push(g);
          if (vm && vm[1] === 'restart') open[c] = g; else delete open[c];
        }
        c += sp;
      }
    }
  }
  return { ok: true, format: 'docx', cells, merges, area: { r1: 1, c1: 1, r2: Math.max(1, r), c2: width }, cols, rows: {}, defH: 22, floats: [], xml, files };
}
function span(cell) {
  const m = (cell.xml.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/) || [''])[0].match(/<w:gridSpan\s+w:val="(\d+)"/);
  return m ? Math.max(1, Number(m[1])) : 1;
}

/* ------------------------------------------------------------ the fields */

const KNOWN = [
  [/\bref(erence)?\.?\s*no\b|\bref\.?\s*#|\bref\.?\s*number\b|request.*ref|^(rfi|submittal|wir|mir|ncr)\s*(no|ref)/i, 'ref', true],
  [/^\s*date\s*:?\s*$|^\s*date of (issue|submission)/i, 'date', true],
  [/project details|project name|^\s*project\s*:?\s*$|^\s*project title/i, 'project_name', true],
  [/^\s*location\s*:?\s*$/i, 'location', true],
  [/^\s*client\s*:?\s*$|^\s*employer\s*:?\s*$/i, 'client', true],
  [/^\s*consultant\s*:?\s*$|^\s*engineer\s*:?\s*$/i, 'consultant', true],
  [/^\s*contractor\s*:?\s*$/i, 'contractor', true],
  [/subject|^\s*title\s*:?\s*$/i, 'subject', false],
  [/location of (the )?work/i, 'location_of_works', false],
  [/description|required information|details of|work description|question|query/i, 'description', false],
];
const AUTO = ['ref', 'date', 'project_name', 'location', 'client', 'consultant', 'contractor'];
const isSignText = (t) => /\bSIGN(ATURE|ED)?\b/i.test(t);
const isNote = (t) => /^\s*\*/.test(t) || clean(t).length > 90;
const isOption = (t) => /[☐☑☒□■]/.test(t) || /^\s*(yes|no|n\/a|approved|rejected)\s*$/i.test(t);
const slug = (s) => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'field';

function isWordLabel(x) {
  if (!x || x.para) return false;
  const t = clean(x.text);
  if (!t || t.length > 60 || /\{\{/.test(t) || isNote(t) || isOption(x.text)) return false;
  if (/^[\d.,/\-\s:]+$/.test(t)) return false;                       // a number or a date
  if (/:\s*$/.test(t) || x.bold) return true;
  if (KNOWN.some(([re]) => re.test(t))) return true;
  const letters = t.replace(/[^A-Za-z]/g, '');
  return letters.length >= 3 && t.replace(/[^A-Z]/g, '').length / letters.length >= 0.8 && !/\d/.test(t);
}

export function extractWordFields(bytes) {
  const sheet = readWordSheet(bytes);
  if (sheet.error) return { error: sheet.error };
  const { cells } = sheet;
  const rowsOf = {};
  for (const k of Object.keys(cells)) {
    const [r, c] = k.split(':').map(Number);
    if (cells[k].para) continue;
    (rowsOf[r] || (rowsOf[r] = [])).push(c);
  }
  const rowNums = Object.keys(rowsOf).map(Number).sort((a, b) => a - b);
  for (const r of rowNums) rowsOf[r].sort((a, b) => a - b);
  const at = (r, c) => cells[r + ':' + c] || null;
  const merge = (r, c) => sheet.merges.find((g) => g.r1 === r && g.c1 === c) || null;
  // The consultant's part, a numbered list, a tick-box row, a signature row: no fields.
  let consultantFrom = Infinity;
  for (const r of rowNums) for (const c of rowsOf[r]) {
    if (/by the (engineer|consultant)|consultants?['’]?s? +(response|approval|comment|reply)|^for,? .*(consultant|engineer)|for (consultant|engineer)['’]?s? use/i.test(clean(at(r, c).text))) consultantFrom = Math.min(consultantFrom, r);
  }
  for (const k of Object.keys(cells)) {
    if (!cells[k].para) continue;
    const r = Number(k.split(':')[0]);
    if (/by the (engineer|consultant)|consultants?['’]?s? +(response|approval|comment|reply)|for (consultant|engineer)['’]?s? use/i.test(clean(cells[k].text))) consultantFrom = Math.min(consultantFrom, r);
  }
  const signRows = new Set(rowNums.filter((r) => rowsOf[r].some((c) => isSignText(at(r, c).text))));
  const optionRows = new Set(rowNums.filter((r) => rowsOf[r].some((c) => isOption(at(r, c).text))));
  const listRows = new Set();
  for (const r of rowNums) for (const c of rowsOf[r]) {
    if (/^s\.?\s*no\.?$|^item\s*(no\.?)?$|^sr\.?\s*no\.?$/i.test(clean(at(r, c).text))) {
      listRows.add(r);
      for (let rr = r + 1; rowsOf[rr] && /^\d+\.?$/.test(clean((at(rr, c) || {}).text)); rr++) listRows.add(rr);
    }
  }
  const found = [], used = new Set(), read = [];
  for (const r of rowNums) {
    const skip = r >= consultantFrom ? 'the consultant’s part' : signRows.has(r) ? 'a signature row' : listRows.has(r) ? 'a numbered list'
      : optionRows.has(r) ? 'tick-box options' : null;
    if (skip) { read.push({ row: r, read: false, why: skip }); continue; }
    const cs = rowsOf[r];
    let made = 0;
    // A row of label | value pairs: a plain short name in a pair's first cell
    // is a label even unformatted ("Discipline | MEP").
    const paired = cs.length >= 2 && cs.length % 2 === 0;
    const plainName = (x) => { const t = clean(x.text); return t.length <= 40 && !/\d/.test(t) && /[A-Za-z]{3}/.test(t) && !isOption(x.text) && !/\{\{/.test(t); };
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i], x = at(r, c);
      if (!isWordLabel(x) && !(paired && i % 2 === 0 && x && !x.para && plainName(x))) continue;
      const next = cs[i + 1];
      const nx = next != null ? at(r, next) : null;
      if (nx && !nx.para && !(clean(nx.text).endsWith(':') && isWordLabel(nx)) && !used.has(r + ':' + next)) {
        // The cell beside a label is its box, whatever was typed there last time.
        used.add(r + ':' + next); found.push({ r, c, box: { r, c: next } }); made++; i++;
        continue;
      }
      // A label across its table owns the cell under it.
      const g = merge(r, c);
      const wide = (g ? g.c2 - g.c1 + 1 : 1) >= Math.max(2, x.tableCols || 2);
      const below = rowsOf[(g ? g.r2 : r) + 1];
      if (wide && below && below.length === 1 && !used.has(((g ? g.r2 : r) + 1) + ':' + below[0])) {
        const bx = at((g ? g.r2 : r) + 1, below[0]);
        // The box under it may hold the last job's sentence, which can mention
        // "question" or "details": only a cell set out as a label (bold, or
        // ending in a colon) is not a box.
        const setOut = bx && (bx.bold || /:\s*$/.test(clean(bx.text)));
        if (bx && !bx.para && !setOut && !signRows.has((g ? g.r2 : r) + 1)) {
          used.add(((g ? g.r2 : r) + 1) + ':' + below[0]); found.push({ r, c, box: { r: (g ? g.r2 : r) + 1, c: below[0] } }); made++;
        }
      }
    }
    read.push({ row: r, read: made > 0 || used.has(r + ':' + cs[0]), why: made ? made + ' field' + (made === 1 ? '' : 's') : (used.has(r + ':' + cs[0]) ? 'a box' : 'no label and box') });
  }
  found.sort((a, b) => a.box.r - b.box.r || a.box.c - b.box.c);
  const fields = [], seen = {};
  for (const { r, c, box } of found) {
    const text = clean(at(r, c).text);
    const existing = /\{\{\s*([^{}]+?)\s*\}\}/.exec((at(box.r, box.c) || {}).text || '');
    const k = KNOWN.find(([re]) => re.test(text));
    let token = existing ? existing[1].trim() : (k ? k[1] : slug(text));
    let auto = AUTO.includes(token);
    if (seen[token] && AUTO.includes(token) && !existing) continue;
    if (seen[token]) { seen[token]++; if (!existing) { token = token + '_' + seen[token]; auto = false; } } else seen[token] = 1;
    const bm = merge(box.r, box.c);
    const tall = bm ? bm.r2 - bm.r1 + 1 : 1;
    fields.push({ cell: colName(box.c) + box.r, label: labelFor(text), token, auto, by: 'extractor',
      long: tall >= 3 || (/description|details|information|remarks|comment|question|query/i.test(text) && !/subject|title/i.test(text)) });
  }
  // Names left in signature rows by the last job, and the consultant's last
  // answers: a new document must not go out carrying the previous one's.
  const clear = [];
  for (const r of rowNums) {
    if (!signRows.has(r) && !(r >= consultantFrom)) continue;
    for (const c of rowsOf[r]) {
      const x = at(r, c), t = clean(x.text);
      if (t && !x.bold && !/:\s*$/.test(t) && !isWordLabel(x) && !isSignText(t) && !/^\s*date\s*:?\s*$/i.test(t) && !/\(name of/i.test(t) && !isOption(x.text)) clear.push(colName(c) + r);
    }
  }
  clear.sort((a, b) => parseRef(a).r - parseRef(b).r || parseRef(a).c - parseRef(b).c);
  return { ok: true, fields, clear, sheet, read, extractor: WORD_EXTRACTOR };
}

/* ------------------------------------------------------------ the writer */

// Put text into cells of a Word form (A1 references on the grid above) and give
// back the file. The cell keeps its properties and the first paragraph's and
// run's formatting; its old text goes.
export function writeWordCells(bytes, values) {
  const sheet = readWordSheet(bytes);
  if (sheet.error) return new Uint8Array(bytes);
  const edits = [];
  for (const [ref, val] of Object.entries(values || {})) {
    const p = parseRef(ref);
    const cell = p && sheet.cells[p.r + ':' + p.c];
    if (!cell || !cell.tc) continue;
    edits.push({ ...cell.tc, val: String(val == null ? '' : val) });
  }
  if (!edits.length) return new Uint8Array(bytes);
  edits.sort((a, b) => b.start - a.start);
  let xml = sheet.xml;
  for (const e of edits) {
    const tc = xml.slice(e.start, e.end);
    const open = tc.match(/^<w:tc\b[^>]*>/)[0];
    const tcPr = (tc.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/) || [''])[0];
    const p1 = tc.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>|<w:p\b[^>]*\/>/);
    const pOpen = p1 ? (p1[0].match(/^<w:p\b[^>]*?\/?>/)[0].replace(/\/>$/, '>')) : '<w:p>';
    const pPr = p1 ? (p1[0].match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [''])[0] : '';
    const rPr = p1 ? (p1[0].match(/<w:r\b[^>]*>\s*(<w:rPr>[\s\S]*?<\/w:rPr>)/) || ['', ''])[1] : '';
    const lines = e.val.split('\n');
    const runs = lines.map((l, i) => (i ? '<w:r>' + rPr + '<w:br/></w:r>' : '') + (l ? '<w:r>' + rPr + '<w:t xml:space="preserve">' + xmlEsc(l) + '</w:t></w:r>' : '')).join('');
    xml = xml.slice(0, e.start) + open + tcPr + pOpen + pPr + runs + '</w:p></w:tc>' + xml.slice(e.end);
  }
  const files = { ...sheet.files, 'word/document.xml': strToU8(xml) };
  return zipSync(files, { level: 6 });
}

// The fillable form: each field's box carries its {{token}}, old names cleared.
export function prepareWordForm(bytes, fields, clear) {
  const put = {};
  for (const f of fields || []) if (parseRef(f.cell)) put[f.cell] = '{{' + f.token + '}}';
  for (const c of clear || []) if (!put[c]) put[c] = '';
  return writeWordCells(bytes, put);
}

// Where it is signed: the cell beside each "Signature" / "Name & sign" label.
export function suggestWordSignCells(sheet) {
  const out = [];
  const keys = Object.keys(sheet.cells).map((k) => k.split(':').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const [r, c] of keys) {
    const x = sheet.cells[r + ':' + c];
    if (x.para || !/\bSIGN(ATURE)?\b/i.test(String(x.text || ''))) continue;
    const next = keys.find(([rr, cc]) => rr === r && cc > c);
    if (next) out.push(colName(next[1]) + r);
  }
  return out;
}
