// THE CONSULTANT'S FORM, DRAWN IN THE BROWSER — and signed where it is signed.
//
// fillTemplate (template.js) puts a record's values into the consultant's own
// .xlsx or .docx. That file is what is issued, but nobody could see it before
// it was issued: the person raising the record typed into a plain form, and
// the person approving it signed a record without ever looking at the document
// that would go out under their name.
//
// This draws the filled form as HTML — the same cells, merges, column widths,
// row heights, borders, fonts and logos as the sheet — so it can be checked on
// the form screen while it is being typed, and in the record before every
// signature. It also writes each signature into the cell the Admin chose for
// that step, in the preview and in the file that is downloaded or issued.
//
// Excel forms are drawn cell for cell (the ICONIC set is all .xlsx). Word forms
// are drawn as their paragraphs and tables, which is enough to read them; their
// signatures go where the author typed {{sign:N}} / {{sign_date:N}}.

import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unxml = (s) => String(s == null ? '' : s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&');
const attr = (tag, name) => { const m = new RegExp('\\s' + name + '="([^"]*)"').exec(tag); return m ? m[1] : null; };

/* ------------------------------------------------------------- cell maths */

export function colNum(letters) {
  let n = 0;
  for (const ch of String(letters).toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}
export function colName(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
export function parseRef(ref) {
  const m = /^\$?([A-Z]+)\$?(\d+)$/i.exec(String(ref || '').trim());
  return m ? { c: colNum(m[1]), r: Number(m[2]) } : null;
}
function parseRange(ref) {
  const [a, b] = String(ref).split(':');
  const p = parseRef(a), q = parseRef(b || a);
  return p && q ? { c1: Math.min(p.c, q.c), r1: Math.min(p.r, q.r), c2: Math.max(p.c, q.c), r2: Math.max(p.r, q.r) } : null;
}

/* ------------------------------------------------------------- the workbook */

function firstSheetPath(files) {
  const wb = strFromU8(files['xl/workbook.xml'] || new Uint8Array());
  const sheet = /<sheet\b[^>]*>/.exec(wb);
  const rid = sheet ? attr(sheet[0], 'r:id') : null;
  const rels = strFromU8(files['xl/_rels/workbook.xml.rels'] || new Uint8Array());
  if (rid) {
    const m = new RegExp('<Relationship[^>]*Id="' + rid + '"[^>]*>').exec(rels);
    const t = m ? attr(m[0], 'Target') : null;
    if (t) return 'xl/' + t.replace(/^\/?xl\//, '').replace(/^\.\//, '');
  }
  return 'xl/worksheets/sheet1.xml';
}

function printArea(files) {
  const wb = strFromU8(files['xl/workbook.xml'] || new Uint8Array());
  const m = /<definedName[^>]*name="_xlnm\.Print_Area"[^>]*localSheetId="0"[^>]*>([^<]*)<\/definedName>/.exec(wb)
         || /<definedName[^>]*name="_xlnm\.Print_Area"[^>]*>([^<]*)<\/definedName>/.exec(wb);
  if (!m) return null;
  const ref = unxml(m[1]).split(',')[0].replace(/^.*!/, '').replace(/\$/g, '');
  return parseRange(ref);
}

function sharedStrings(files) {
  const x = files['xl/sharedStrings.xml'] ? strFromU8(files['xl/sharedStrings.xml']) : '';
  const out = [];
  const re = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = re.exec(x))) out.push(textOf(m[1]));
  return out;
}
const textOf = (xml) => {
  let s = '';
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t\/>/g;
  let m;
  while ((m = re.exec(xml))) s += m[1] ? unxml(m[1]) : '';
  return s;
};

const THEME_RGB = ['FFFFFF', '000000', 'EEECE1', '1F497D', '4F81BD', 'C0504D', '9BBB59', '8064A2', '4BACC6', 'F79646'];
function colorOf(xml) {
  if (!xml) return null;
  const rgb = attr(xml, 'rgb');
  if (rgb && rgb.length >= 6) return '#' + rgb.slice(-6);
  const th = attr(xml, 'theme');
  if (th != null) {
    // theme 0/1 are the light/dark text pair; Excel draws text "theme 1" as black.
    const i = Number(th);
    return '#' + (i === 1 ? '000000' : i === 0 ? 'FFFFFF' : THEME_RGB[i] || '000000');
  }
  return null;
}

function styles(files) {
  const x = files['xl/styles.xml'] ? strFromU8(files['xl/styles.xml']) : '';
  const block = (name) => { const m = new RegExp('<' + name + '[^>]*>([\\s\\S]*?)</' + name + '>').exec(x); return m ? m[1] : ''; };
  const items = (xml, tag) => {
    const out = [];
    const re = new RegExp('<' + tag + '(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</' + tag + '>)', 'g');
    let m;
    while ((m = re.exec(xml))) out.push({ head: m[0].slice(0, m[0].indexOf('>') + 1), body: m[1] || '' });
    return out;
  };
  const fonts = items(block('fonts'), 'font').map(({ body }) => ({
    b: /<b\/>|<b val="1"/.test(body), i: /<i\/>/.test(body), u: /<u\/>|<u /.test(body),
    sz: Number((/<sz val="([\d.]+)"/.exec(body) || [])[1] || 11),
    color: colorOf((/<color[^>]*\/>/.exec(body) || [])[0]),
    name: (/<name val="([^"]+)"/.exec(body) || [])[1] || 'Calibri',
  }));
  const fills = items(block('fills'), 'fill').map(({ body }) => {
    if (!/patternType="solid"/.test(body)) return null;
    // Only an explicit colour. A theme colour carries a tint that would have to be
    // worked out against the workbook's theme; guessed, it paints cells the
    // wrong colour, which is worse than leaving them white.
    const fg = (/<fgColor[^>]*\/>/.exec(body) || [])[0] || '';
    const rgb = attr(fg, 'rgb');
    return rgb && rgb.length >= 6 && !/^(FF)?FFFFFF$/i.test(rgb) ? '#' + rgb.slice(-6) : null;
  });
  const W = { thin: '1px solid', hair: '1px solid', medium: '2px solid', thick: '3px solid', double: '3px double',
    dashed: '1px dashed', dotted: '1px dotted', mediumDashed: '2px dashed' };
  const borders = items(block('borders'), 'border').map(({ body }) => {
    const side = (s) => {
      const m = new RegExp('<' + s + '(\\s[^>]*)?(?:/>|>([\\s\\S]*?)</' + s + '>)').exec(body);
      if (!m) return null;
      const st = attr(m[0], 'style');
      if (!st) return null;
      return (W[st] || '1px solid') + ' ' + (colorOf((/<color[^>]*\/>/.exec(m[2] || '') || [])[0]) || '#000');
    };
    return { l: side('left'), r: side('right'), t: side('top'), b: side('bottom') };
  });
  const xfs = items(block('cellXfs'), 'xf').map(({ head, body }) => {
    const al = (/<alignment[^>]*\/>/.exec(body) || [])[0] || '';
    return {
      font: fonts[Number(attr(head, 'fontId') || 0)] || fonts[0] || {},
      fill: fills[Number(attr(head, 'fillId') || 0)] || null,
      border: borders[Number(attr(head, 'borderId') || 0)] || {},
      h: attr(al, 'horizontal'), v: attr(al, 'vertical'), wrap: attr(al, 'wrapText') === '1',
    };
  });
  return xfs;
}

// Pictures placed in cells (Excel's "Place in cell"), by value-metadata index.
function cellPictures(files) {
  const out = {};
  const rv = files['xl/richData/rdrichvalue.xml'] ? strFromU8(files['xl/richData/rdrichvalue.xml']) : '';
  const rel = files['xl/richData/richValueRel.xml'] ? strFromU8(files['xl/richData/richValueRel.xml']) : '';
  const rr = files['xl/richData/_rels/richValueRel.xml.rels'] ? strFromU8(files['xl/richData/_rels/richValueRel.xml.rels']) : '';
  if (!rv || !rel) return out;
  const relIds = [...rel.matchAll(/<rel [^>]*r:id="([^"]+)"/g)].map((m) => m[1]);
  const target = (id) => { const m = new RegExp('<Relationship[^>]*Id="' + id + '"[^>]*>').exec(rr); return m ? attr(m[0], 'Target') : null; };
  [...rv.matchAll(/<rv[^>]*>([\s\S]*?)<\/rv>/g)].forEach((m, i) => {
    const first = /<v>(\d+)<\/v>/.exec(m[1]);
    const t = first ? target(relIds[Number(first[1])]) : null;
    const path = t ? 'xl/' + t.replace(/^\.\.\//, '') : null;
    if (path && files[path]) out[i + 1] = dataUri(path, files[path]);
  });
  return out;
}
function dataUri(path, bytes) {
  const mime = /\.png$/i.test(path) ? 'image/png' : /\.jpe?g$/i.test(path) ? 'image/jpeg' : /\.gif$/i.test(path) ? 'image/gif' : 'image/png';
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return 'data:' + mime + ';base64,' + btoa(bin);
}

// Floating pictures (logos placed over the sheet), with where they sit.
function floatingPictures(files, sheetPath) {
  const out = [];
  const relsPath = sheetPath.replace(/worksheets\//, 'worksheets/_rels/') + '.rels';
  const srels = files[relsPath] ? strFromU8(files[relsPath]) : '';
  const dm = /<Relationship[^>]*Type="[^"]*\/drawing"[^>]*>/.exec(srels);
  const dTarget = dm ? attr(dm[0], 'Target') : null;
  if (!dTarget) return out;
  const dPath = 'xl/' + dTarget.replace(/^\.\.\//, '');
  const dxml = files[dPath] ? strFromU8(files[dPath]) : '';
  const drelsPath = dPath.replace(/drawings\//, 'drawings/_rels/') + '.rels';
  const drels = files[drelsPath] ? strFromU8(files[drelsPath]) : '';
  for (const m of dxml.matchAll(/<xdr:(?:twoCellAnchor|oneCellAnchor)[\s\S]*?<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g)) {
    const a = m[0];
    if (!/<xdr:pic>/.test(a)) continue;
    const emb = (/r:embed="([^"]+)"/.exec(a) || [])[1];
    const rel = emb ? new RegExp('<Relationship[^>]*Id="' + emb + '"[^>]*>').exec(drels) : null;
    const path = rel ? 'xl/' + attr(rel[0], 'Target').replace(/^\.\.\//, '') : null;
    if (!path || !files[path]) continue;
    const num = (tag, part) => Number((new RegExp('<xdr:' + part + '>[\\s\\S]*?<xdr:' + tag + '>(-?\\d+)</xdr:' + tag + '>').exec(a) || [])[1] || 0);
    const ext = /<xdr:ext cx="(\d+)" cy="(\d+)"/.exec(a) || /<a:ext cx="(\d+)" cy="(\d+)"/.exec(a);
    out.push({
      from: { c: num('col', 'from') + 1, r: num('row', 'from') + 1, dx: num('colOff', 'from') / 9525, dy: num('rowOff', 'from') / 9525 },
      to: /<xdr:to>/.test(a) ? { c: num('col', 'to') + 1, r: num('row', 'to') + 1, dx: num('colOff', 'to') / 9525, dy: num('rowOff', 'to') / 9525 } : null,
      w: ext ? Number(ext[1]) / 9525 : null, h: ext ? Number(ext[2]) / 9525 : null,
      src: dataUri(path, files[path]),
    });
  }
  return out;
}

/* ------------------------------------------------------------- read a sheet */

export function readSheet(bytes) {
  let files;
  try { files = unzipSync(new Uint8Array(bytes)); } catch (e) { return { error: 'not a readable form' }; }
  if (!files['xl/workbook.xml']) return { error: 'not an Excel form' };
  const path = firstSheetPath(files);
  const sx = files[path] ? strFromU8(files[path]) : '';
  const ss = sharedStrings(files);
  const xfs = styles(files);
  const pics = cellPictures(files);

  const cols = {};
  for (const m of sx.matchAll(/<col\b[^>]*\/?>/g)) {
    const min = Number(attr(m[0], 'min')), max = Number(attr(m[0], 'max')), w = Number(attr(m[0], 'width') || 9.14);
    const hidden = attr(m[0], 'hidden') === '1';
    for (let c = min; c <= Math.min(max, 200); c++) cols[c] = hidden ? 0 : Math.round(w * 7 + 5);
  }
  const defH = Number((/<sheetFormatPr[^>]*defaultRowHeight="([\d.]+)"/.exec(sx) || [])[1] || 15);
  const rows = {}, cells = {};
  for (const rm of sx.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const r = Number(attr(rm[0], 'r'));
    const ht = attr(rm[0], 'ht');
    rows[r] = attr(rm[0], 'hidden') === '1' ? 0 : Math.round((ht ? Number(ht) : defH) * 4 / 3);
    for (const cm of (rm[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const head = cm[0].slice(0, cm[0].indexOf('>') + 1);
      const ref = attr(head, 'r');
      const p = parseRef(ref);
      if (!p) continue;
      const t = attr(head, 't'), s = Number(attr(head, 's') || 0), vm = attr(head, 'vm');
      const body = cm[2] || '';
      let text = '';
      if (t === 's') text = ss[Number((/<v>(\d+)<\/v>/.exec(body) || [])[1])] || '';
      else if (t === 'inlineStr') text = textOf(body);
      else { const v = /<v>([\s\S]*?)<\/v>/.exec(body); text = v ? unxml(v[1]) : ''; }
      if (t === 'e') text = '';
      cells[p.r + ':' + p.c] = { ref, text, xf: xfs[s] || xfs[0] || {}, pic: vm ? pics[Number(vm)] || null : null };
    }
  }
  const merges = [...sx.matchAll(/<mergeCell ref="([^"]+)"/g)].map((m) => parseRange(m[1])).filter(Boolean);

  // What to draw: the print area if there is one, else what is actually used.
  let area = printArea(files);
  if (!area) {
    let c2 = 1, r2 = 1;
    for (const k of Object.keys(cells)) {
      const [r, c] = k.split(':').map(Number);
      if (cells[k].text || cells[k].pic) { r2 = Math.max(r2, r); c2 = Math.max(c2, c); }
    }
    for (const g of merges) { if (g.r1 <= r2 + 2 && g.c1 <= c2 + 2) { r2 = Math.max(r2, g.r2); c2 = Math.max(c2, g.c2); } }
    area = { c1: 1, r1: 1, c2: Math.min(c2, 40), r2: Math.min(r2, 400) };
  }
  return { files, path, cols, rows, defH: Math.round(defH * 4 / 3), cells, merges, area,
    floats: floatingPictures(files, path) };
}

/* ------------------------------------------------------------- draw a sheet */

// signs: { "D23": { name, date, role, pending } } — drawn in that cell.
// opts.pick: every cell is clickable (data-cell), for choosing signature places.
export function sheetHTML(sheet, signs = {}, opts = {}) {
  const { cols, rows, cells, merges, area, floats } = sheet;
  const colW = (c) => (cols[c] != null ? cols[c] : 69);
  const rowH = (r) => (rows[r] != null ? rows[r] : sheet.defH);
  const covered = new Set(), span = {};
  for (const g of merges) {
    if (g.r1 < area.r1 || g.c1 < area.c1 || g.r1 > area.r2 || g.c1 > area.c2) continue;
    span[g.r1 + ':' + g.c1] = { rs: Math.min(g.r2, area.r2) - g.r1 + 1, cs: Math.min(g.c2, area.c2) - g.c1 + 1, g };
    for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) if (r !== g.r1 || c !== g.c1) covered.add(r + ':' + c);
  }
  const signAt = {};
  for (const [ref, s] of Object.entries(signs || {})) { const p = parseRef(ref); if (p) signAt[p.r + ':' + p.c] = s; }

  let html = '<colgroup>';
  for (let c = area.c1; c <= area.c2; c++) html += '<col style="width:' + colW(c) + 'px">';
  html += '</colgroup>';
  for (let r = area.r1; r <= area.r2; r++) {
    const h = rowH(r);
    html += '<tr style="height:' + h + 'px">';
    for (let c = area.c1; c <= area.c2; c++) {
      const key = r + ':' + c;
      if (covered.has(key)) continue;
      const cell = cells[key] || { ref: colName(c) + r, text: '', xf: {} };
      const sp = span[key];
      // A merged range is bordered on the outside by the cells along its edge.
      const edge = (rr, cc) => (cells[rr + ':' + cc] || {}).xf || {};
      const b = cell.xf.border || {};
      const right = sp ? (edge(r, sp.g.c2).border || {}).r : b.r;
      const bottom = sp ? (edge(sp.g.r2, c).border || {}).b : b.b;
      const f = cell.xf.font || {};
      const st = [
        b.l ? 'border-left:' + b.l : '', right ? 'border-right:' + right : '',
        b.t ? 'border-top:' + b.t : '', bottom ? 'border-bottom:' + bottom : '',
        cell.xf.fill ? 'background:' + cell.xf.fill : '',
        'font-size:' + Math.round((f.sz || 11) * 4 / 3) + 'px',
        f.b ? 'font-weight:700' : '', f.i ? 'font-style:italic' : '', f.u ? 'text-decoration:underline' : '',
        f.color && f.color !== '#000000' ? 'color:' + f.color : '',
        'text-align:' + ({ center: 'center', right: 'right', centerContinuous: 'center', justify: 'justify' }[cell.xf.h] || 'left'),
        'vertical-align:' + ({ center: 'middle', top: 'top', bottom: 'bottom' }[cell.xf.v] || 'bottom'),
        cell.xf.wrap || (sp && sp.rs > 1) ? 'white-space:pre-wrap' : 'white-space:nowrap',
      ].filter(Boolean).join(';');
      const sg = signAt[key];
      let inner;
      if (sg) {
        inner = '<span class="tp-sig' + (sg.pending ? ' tp-pending' : '') + '">' +
          (sg.pending ? '<b>' + esc(sg.label || 'Your signature goes here') + '</b>'
            : '<span class="tp-script">' + esc(sg.name) + '</span>') +
          '<small>' + esc([sg.role, sg.date].filter(Boolean).join(' · ')) + '</small></span>';
      } else if (cell.pic) {
        inner = '<img src="' + cell.pic + '" alt="" style="max-width:100%;max-height:' + ((sp ? spanH(sp, rowH, r) : h) - 4) + 'px;object-fit:contain">';
      } else {
        inner = esc(cell.text);
      }
      html += '<td' + (sp ? (sp.rs > 1 ? ' rowspan="' + sp.rs + '"' : '') + (sp.cs > 1 ? ' colspan="' + sp.cs + '"' : '') : '') +
        (opts.pick ? ' data-cell="' + cell.ref + '"' : '') + ' style="' + st + '">' + inner + '</td>';
    }
    html += '</tr>';
  }
  // Logos placed over the sheet.
  const x = (c, dx) => { let s = 0; for (let k = area.c1; k < c; k++) s += colW(k); return s + (dx || 0); };
  const y = (r, dy) => { let s = 0; for (let k = area.r1; k < r; k++) s += rowH(k); return s + (dy || 0); };
  let over = '';
  for (const p of floats || []) {
    if (p.from.r < area.r1 || p.from.c < area.c1 || p.from.r > area.r2 || p.from.c > area.c2) continue;
    const left = x(p.from.c, p.from.dx), top = y(p.from.r, p.from.dy);
    const w = p.to ? x(p.to.c, p.to.dx) - left : p.w, hh = p.to ? y(p.to.r, p.to.dy) - top : p.h;
    over += '<img src="' + p.src + '" alt="" style="position:absolute;left:' + left + 'px;top:' + top + 'px;width:' + w + 'px;height:' + hh + 'px">';
  }
  return '<div class="tp-sheet"><table class="tp">' + html + '</table>' + over + '</div>';
}
function spanH(sp, rowH, r) { let s = 0; for (let k = r; k < r + sp.rs; k++) s += rowH(k); return s; }

export const PREVIEW_CSS = `
.tp-wrap { overflow:auto; background:#e9ecf1; padding:16px; border-radius:10px; }
.tp-sheet { position:relative; display:inline-block; background:#fff; box-shadow:0 1px 6px rgba(0,0,0,.15); }
table.tp { border-collapse:collapse; table-layout:fixed; font-family:'Century Gothic',Calibri,Arial,sans-serif; color:#000; }
table.tp td { padding:1px 4px; overflow:hidden; line-height:1.25; }
table.tp td[data-cell] { cursor:crosshair; }
table.tp td[data-cell]:hover { outline:2px solid #2f6fd6; outline-offset:-2px; }
table.tp td.tp-chosen { outline:3px solid #1d7a3e; outline-offset:-3px; background:#e9f6ee !important; }
.tp-sig { display:inline-flex; flex-direction:column; line-height:1.1; }
.tp-sig small { font-size:10px; color:#444; }
.tp-script { font-family:'Brush Script MT','Segoe Script','Snell Roundhand',cursive; font-size:19px; color:#0b2f6b; }
.tp-pending { background:#fff4cc; border:1px dashed #c98a00; padding:2px 6px; border-radius:4px; }
.tp-doc { background:#fff; padding:28px 34px; max-width:820px; box-shadow:0 1px 6px rgba(0,0,0,.15); font-family:Calibri,Arial,sans-serif; }
.tp-doc table { border-collapse:collapse; width:100%; } .tp-doc td { border:1px solid #888; padding:4px 6px; vertical-align:top; }
`;

/* ------------------------------------------------------------- Word, simply */

export function docxHTML(bytes) {
  let files;
  try { files = unzipSync(new Uint8Array(bytes)); } catch (e) { return '<div class="tp-doc">Not a readable form.</div>'; }
  const x = files['word/document.xml'] ? strFromU8(files['word/document.xml']) : '';
  const para = (p) => {
    const bold = /<w:b\/>|<w:b w:val="(1|true)"/.test(p);
    const t = textOf(p.replace(/<w:t\b/g, '<t').replace(/<\/w:t>/g, '</t>').replace(/<w:tab\/>/g, '<t>\t</t>').replace(/<w:br\/>/g, '<t>\n</t>'));
    return '<p style="margin:0 0 6px;white-space:pre-wrap' + (bold ? ';font-weight:700' : '') + '">' + esc(t) + '</p>';
  };
  const body = x.replace(/<w:tbl>([\s\S]*?)<\/w:tbl>/g, (m) => {
    const rows = [...m.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((r) =>
      '<tr>' + [...r[0].matchAll(/<w:tc>([\s\S]*?)<\/w:tc>/g)].map((c) =>
        '<td>' + [...c[1].matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((p) => para(p[0])).join('') + '</td>').join('') + '</tr>').join('');
    return '\u0000T' + rows + '\u0000E';
  });
  let html = '';
  for (const part of body.split(/(\u0000T[\s\S]*?\u0000E)/)) {
    if (part.startsWith('\u0000T')) html += '<table>' + part.slice(2, -2) + '</table>';
    else for (const p of part.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)) html += para(p[0]);
  }
  return '<div class="tp-doc">' + html + '</div>';
}

/* ------------------------------------------------------------- write cells */

// Puts text into cells of the first sheet of an .xlsx and gives back the file.
// Used to write each signature into the place chosen for it.
export function writeCells(bytes, values) {
  const entries = Object.entries(values || {}).filter(([ref]) => parseRef(ref));
  if (!entries.length) return bytes;
  let files;
  try { files = unzipSync(new Uint8Array(bytes)); } catch (e) { return bytes; }
  if (!files['xl/workbook.xml']) return bytes;
  const path = firstSheetPath(files);
  let sx = strFromU8(files[path]);
  const cellXml = (ref, style, text) => '<c r="' + ref + '"' + (style ? ' s="' + style + '"' : '') +
    ' t="inlineStr"><is><t xml:space="preserve">' + String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</t></is></c>';
  for (const [ref0, text] of entries) {
    const ref = ref0.toUpperCase().replace(/\$/g, '');
    const p = parseRef(ref);
    const cellRe = new RegExp('<c r="' + ref + '"([^>]*?)(?:/>|>[\\s\\S]*?</c>)');
    const hit = cellRe.exec(sx);
    if (hit) {
      sx = sx.replace(cellRe, cellXml(ref, attr('<c' + hit[1] + '>', 's'), text));
      continue;
    }
    const rowRe = new RegExp('(<row\\b[^>]*\\br="' + p.r + '"[^>]*)(/>|>([\\s\\S]*?)</row>)');
    const rm = rowRe.exec(sx);
    if (rm) {
      if (rm[2] === '/>') { sx = sx.replace(rowRe, rm[1] + '>' + cellXml(ref, null, text) + '</row>'); continue; }
      // Cells in a row must stay in column order.
      const inner = rm[3];
      let placed = false;
      const rebuilt = inner.replace(/<c r="([A-Z]+)\d+"/g, (m, col) => {
        if (!placed && colNum(col) > p.c) { placed = true; return cellXml(ref, null, text) + m; }
        return m;
      });
      sx = sx.replace(rowRe, rm[1] + '>' + (placed ? rebuilt : inner + cellXml(ref, null, text)) + '</row>');
      continue;
    }
    // No such row: add it, in row order.
    let placed = false;
    sx = sx.replace(/<row\b[^>]*\br="(\d+)"/g, (m, rn) => {
      if (!placed && Number(rn) > p.r) { placed = true; return '<row r="' + p.r + '">' + cellXml(ref, null, text) + '</row>' + m; }
      return m;
    });
    if (!placed) sx = sx.replace('</sheetData>', '<row r="' + p.r + '">' + cellXml(ref, null, text) + '</row></sheetData>');
  }
  files[path] = strToU8(sx);
  // Text no cell uses any more — the last job's subject, reference, names — is
  // emptied too, so it does not travel inside the file to the next consultant.
  if (files['xl/sharedStrings.xml']) {
    const used = new Set();
    for (const n of Object.keys(files)) {
      if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(n)) continue;
      for (const m of strFromU8(files[n]).matchAll(/<c\b[^>]*\bt="s"[^>]*>\s*<v>(\d+)<\/v>/g)) used.add(Number(m[1]));
    }
    let i = -1;
    const ssx = strFromU8(files['xl/sharedStrings.xml']).replace(/<si>[\s\S]*?<\/si>/g, (m) => {
      i++;
      return used.has(i) ? m : '<si><t></t></si>';
    });
    files['xl/sharedStrings.xml'] = strToU8(ssx);
  }
  try { return zipSync(files, { level: 6 }); } catch (e) { return bytes; }
}

/* ------------------------------------------------------------- where to sign */

// A first guess at where each signature goes: the cell just right of every
// "NAME & SIGN" / "SIGNATURE" label, in the order they appear on the form.
// The Admin confirms or moves each one; this only saves the first clicks.
export function suggestSignCells(sheet) {
  const out = [];
  const keys = Object.keys(sheet.cells).map((k) => k.split(':').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const covered = (r, c) => sheet.merges.some((g) => r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2 && !(r === g.r1 && c === g.c1));
  for (const [r, c] of keys) {
    const t = String(sheet.cells[r + ':' + c].text || '');
    if (!/\bSIGN(ATURE)?\b/i.test(t)) continue;
    const g = sheet.merges.find((m) => m.r1 === r && m.c1 === c);
    let nc = (g ? g.c2 : c) + 1;
    while (nc <= sheet.area.c2 && covered(r, nc)) nc++;
    if (nc <= sheet.area.c2) out.push(colName(nc) + r);
  }
  return out;
}
