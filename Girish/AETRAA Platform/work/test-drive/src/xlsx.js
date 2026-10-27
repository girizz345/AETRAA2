// A small, dependency-free .xlsx writer.
//
// A cell is a plain value (string, number, null, { date: 'YYYY-MM-DD' }) or an
// object { v, f, s }: v the value, f a formula (without "="), s a style name
// from STYLES below. A formula always carries its computed value too, so the
// file reads correctly even in a viewer that does not calculate; Excel and
// LibreOffice recalculate on open (fullCalcOnLoad).
//
// A sheet is { name, rows, cols?: [widths], freeze?: rowNumber }.
// buildXlsx(sheets, { header }) puts the X1 header on every sheet (see applyHeader).
// The zip is written uncompressed ("stored"), which every spreadsheet program reads.

const enc = new TextEncoder();

let CRC_TABLE = null;
function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zip(files) {                      // files: [{ name, data: Uint8Array }]
  const chunks = [], central = [];
  let offset = 0;
  const u16 = (v) => [v & 0xff, (v >>> 8) & 0xff];
  const u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
      ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0), ...name,
    ]);
    chunks.push(local, f.data);
    central.push(new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
      ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(offset), ...name,
    ]));
    offset += local.length + size;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
    ...u32(cdSize), ...u32(offset), ...u16(0),
  ]);
  const all = [...chunks, ...central, end];
  const out = new Uint8Array(all.reduce((s, c) => s + c.length, 0));
  let p = 0; for (const c of all) { out.set(c, p); p += c.length; }
  return out;
}

const xmlEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  // characters XML 1.0 forbids
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const colName = (i) => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

// Style name -> index in cellXfs (see styles.xml below).
export const STYLES = {
  date: 1, head: 2, money: 3, pct: 4, total: 5, bold: 6, section: 7, title: 8,
  input: 9, text: 10, totalPct: 11, muted: 12, totalLabel: 13, dateBox: 14, num: 15,
};

function valueXml(v, ref, s) {
  const st = s ? ` s="${s}"` : '';
  if (v === null || v === undefined || v === '') return s ? `<c r="${ref}"${st}/>` : '';
  if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
  if (typeof v === 'object' && v.date) {
    const t = Date.parse(String(v.date).slice(0, 10) + 'T00:00:00Z');
    if (!isFinite(t)) return s ? `<c r="${ref}"${st}/>` : '';
    const serial = t / 86400000 + 25569;                    // Excel's 1900 date system
    return `<c r="${ref}" s="${s || 1}"><v>${serial}</v></c>`;
  }
  return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
}

function cell(v, ref) {
  if (v !== null && typeof v === 'object' && !v.date) {
    const s = v.s ? (STYLES[v.s] || 0) : 0;
    if (v.f) {
      const val = v.v;
      const cached = typeof val === 'number' && isFinite(val) ? `<v>${val}</v>` : '';
      const t = typeof val === 'string' ? ' t="str"' : '';
      return `<c r="${ref}"${s ? ` s="${s}"` : ''}${t}><f>${xmlEsc(v.f)}</f>${cached || (t ? `<v>${xmlEsc(val)}</v>` : '')}</c>`;
    }
    return valueXml(v.v, ref, s);
  }
  return valueXml(v, ref, 0);
}

function sheetXml(sheet) {
  const rows = sheet.rows || [];
  const body = rows.map((r, ri) =>
    `<row r="${ri + 1}">${(r || []).map((v, ci) => cell(v, colName(ci) + (ri + 1))).join('')}</row>`).join('');
  const freeze = sheet.freeze
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sheet.freeze - 1}" topLeftCell="A${sheet.freeze}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : '';
  const cols = Array.isArray(sheet.cols) && sheet.cols.length
    ? `<cols>${sheet.cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Number(w) || 10}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const setup = sheet.landscape
    ? `<pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>` : '';
  const fit = sheet.landscape ? `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>` : '';
  const drawing = sheet.image ? '<drawing r:id="rId1"/>' : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${fit}${freeze}${cols}<sheetData>${body}</sheetData>${setup}${drawing}</worksheet>`;
}

// ---------------------------------------------------------------- X1: the header
//
// Every schedule, log and tracker starts with the same header (workflow X1,
// approved 5 Oct 2026): company logo, project name, project ref / plot,
// client, consultant, contractor, contract no., document title, as-at date and
// time, the programme data date for dated schedules, and who downloaded it.
// A downloaded register leaves the platform, and a page with no project, no
// date and no name on it cannot be relied on once it has been printed.
//
// header: { title, project, ref, plot, client, consultant, contractor,
//           contract_no, as_at, data_date, dated, downloaded_by,
//           logo: { data: Uint8Array, ext: 'png' | 'jpeg' } }
export function headerRows(h) {
  const v = (x) => (x == null || String(x).trim() === '' ? '—' : String(x));
  const rows = [
    [{ v: v(h.title), s: 'title' }],
    ['Project: ' + v(h.project)],
    ['Project ref / plot: ' + v([h.ref, h.plot].filter((x) => x && String(x).trim()).join(' · '))],
    ['Client: ' + v(h.client)],
    ['Consultant: ' + v(h.consultant)],
    ['Contractor: ' + v(h.contractor)],
    ['Contract no.: ' + v(h.contract_no)],
    ['As at: ' + v(h.as_at)],
  ];
  if (h.dated) rows.push(['Programme data date: ' + v(h.data_date)]);
  rows.push(['Downloaded by: ' + v(h.downloaded_by)]);
  rows.push([]);
  return rows;
}

// The sheet's own heading lines (a title and an "as at" line above the column
// headings) are replaced by the header, so a register does not say its name
// twice; the column headings and everything below are untouched.
export function applyHeader(sheet, h) {
  const rows = sheet.rows || [];
  const isHead = (r) => (r || []).some((x) => x && typeof x === 'object' && x.s === 'head');
  let hi = rows.findIndex(isHead);
  if (hi < 0) hi = 0;
  const top = headerRows(h);
  const out = { ...sheet, rows: top.concat(rows.slice(hi)) };
  if (sheet.freeze) out.freeze = Math.max(1, sheet.freeze - hi + top.length);
  if (h.logo && h.logo.data && h.logo.data.length) {
    const width = Math.max(...out.rows.map((r) => (r || []).length), 1);
    out.image = { ...h.logo, col: Math.max(3, width - 2), row: 0 };
  }
  return out;
}

// Pixel size of a PNG or JPEG, so the logo keeps its proportions.
export function imageSize(bytes, ext) {
  try {
    const b = bytes;
    if (ext === 'png' && b.length > 24) {
      const w = (b[16] << 24 | b[17] << 16 | b[18] << 8 | b[19]) >>> 0;
      const h = (b[20] << 24 | b[21] << 16 | b[22] << 8 | b[23]) >>> 0;
      if (w && h) return { w, h };
    }
    if (ext === 'jpeg') {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xc3) return { h: b[i + 5] << 8 | b[i + 6], w: b[i + 7] << 8 | b[i + 8] };
        i += 2 + (b[i + 2] << 8 | b[i + 3]);
      }
    }
  } catch (e) { /* fall through */ }
  return { w: 200, h: 100 };
}

function drawingXml(img) {
  const px = imageSize(img.data, img.ext);
  const height = 60;                                   // pixels on the sheet
  const width = Math.round(px.w * height / (px.h || 1));
  const EMU = 9525;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<xdr:oneCellAnchor><xdr:from><xdr:col>${img.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${img.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
    `<xdr:ext cx="${width * EMU}" cy="${height * EMU}"/>` +
    `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Logo"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>` +
    `<xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
    `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width * EMU}" cy="${height * EMU}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>` +
    `</xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`;
}

// sheets: [{ name, rows: [[...], ...] }]  →  Uint8Array of an .xlsx file
export function buildXlsx(sheets, opts) {
  if (opts && opts.header) sheets = sheets.map((sh) => applyHeader(sh, opts.header));
  const files = [];
  const pics = sheets.map((sh, i) => (sh.image ? i : -1)).filter((i) => i >= 0);
  const add = (name, text) => files.push({ name, data: enc.encode(text) });
  add('[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    (pics.length ? `<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/>` : '') +
    pics.map((i) => `<Override PartName="/xl/drawings/drawing${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`).join('') +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
    `</Types>`);
  add('_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  add('xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
    sheets.map((s, i) => `<sheet name="${xmlEsc(s.name).slice(0, 31)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
    `</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`);
  add('xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
    `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  // Fonts: 0 normal, 1 bold, 2 bold white, 3 bold 14, 4 italic grey.
  // Fills: 0 none, 1 gray125 (required), 2 navy, 3 light blue-grey, 4 pale yellow.
  // Borders: 0 none, 1 thin grey all round.
  const XF = (fmt, font, fill, border, extra = '') =>
    `<xf numFmtId="${fmt}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0"` +
    `${fmt ? ' applyNumberFormat="1"' : ''}${font ? ' applyFont="1"' : ''}${fill ? ' applyFill="1"' : ''}${border ? ' applyBorder="1"' : ''}` +
    (extra ? ` applyAlignment="1">${extra}</xf>` : '/>');
  const wrap = '<alignment wrapText="1" vertical="top"/>';
  const xfs = [
    XF(0, 0, 0, 0),              // 0 default
    XF(164, 0, 0, 0),            // 1 date
    XF(0, 2, 2, 1, wrap),        // 2 head
    XF(4, 0, 0, 1),              // 3 money  #,##0.00
    XF(10, 0, 0, 1),             // 4 pct    0.00%
    XF(4, 1, 3, 1),              // 5 total money
    XF(0, 1, 0, 0),              // 6 bold
    XF(0, 1, 3, 1),              // 7 section row
    XF(0, 3, 0, 0),              // 8 title
    XF(10, 0, 4, 1),             // 9 input pct (the column to edit)
    XF(0, 0, 0, 1, wrap),        // 10 text in a box
    XF(10, 1, 3, 1),             // 11 total pct
    XF(0, 4, 0, 0),              // 12 muted
    XF(0, 1, 3, 1),              // 13 total label
    XF(164, 0, 0, 1),            // 14 date in a box
    XF(4, 0, 0, 1),              // 15 number (same look as money)
  ];
  add('xl/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<numFmts count="1"><numFmt numFmtId="164" formatCode="dd-mmm-yy"/></numFmts>` +
    `<fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font>` +
    `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font>` +
    `<font><i/><sz val="10"/><color rgb="FF6A7590"/><name val="Calibri"/></font></fonts>` +
    `<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="FF212D51"/><bgColor indexed="64"/></patternFill></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="FFEEF3F9"/><bgColor indexed="64"/></patternFill></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="FFFFF6D5"/><bgColor indexed="64"/></patternFill></fill></fills>` +
    `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>` +
    `<border><left style="thin"><color rgb="FFD0D7E2"/></left><right style="thin"><color rgb="FFD0D7E2"/></right>` +
    `<top style="thin"><color rgb="FFD0D7E2"/></top><bottom style="thin"><color rgb="FFD0D7E2"/></bottom><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`);
  sheets.forEach((s, i) => add(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)));
  for (const i of pics) {
    const img = sheets[i].image;
    const media = `logo${i + 1}.${img.ext === 'jpeg' ? 'jpeg' : 'png'}`;
    files.push({ name: 'xl/media/' + media, data: img.data });
    add(`xl/drawings/drawing${i + 1}.xml`, drawingXml(img));
    add(`xl/drawings/_rels/drawing${i + 1}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${media}"/></Relationships>`);
    add(`xl/worksheets/_rels/sheet${i + 1}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${i + 1}.xml"/></Relationships>`);
  }
  return zip(files);
}
