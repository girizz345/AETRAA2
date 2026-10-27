// READING A DRAWING PDF SHEET BY SHEET (P1 step 2, E3/E4).
//
// Three things the intake could not do, all deterministic — the same file
// always gives the same answer, and nothing here calls AI:
//
//   1. THE NUMBER FROM THE SHEET ITSELF. A drawing office prints the drawing
//      number in the title block's bottom-right corner. Measured on Al Warqa'a:
//      every sheet of every combined set carries it there (A0-01 at 96% across,
//      3% up). A file named "ARCHITECTURAL DRAWIN - Sheet 25.pdf" has no number
//      in its name; its face does.
//   2. COMBINED SETS, ONE ENTRY PER SHEET. A consultant's portal hands out
//      "floor_plans.pdf" with eight sheets in it. Filed whole, the register
//      gets one row with no number. Split, it gets eight sheets, each with its
//      own number — and the ones already filed individually are archived as
//      duplicates instead of filed twice.
//   3. A REPORT IS NOT A DRAWING. An A4 soil report or calculation sits in the
//      drawings folder as often as not. Paper size says what it is.
//
// pdf.js reads the text and the AutoCAD "SHX text" annotations; pdf-lib copies
// pages into single-sheet PDFs. Both are pure JavaScript, loaded on first use.

// A drawing number as this trade writes them: A0-01, S1-01A, AC-12, DR-04,
// SIMR3-BW-UAI-ZZ-ZZ-00-PL-DR-00001 is handled by the register's own rules.
export const NUMBER_SHAPE = /^[A-Z]{1,4}\d{0,2}-\d{2,5}[A-Z]?$/;
const NUMBER_IN_TEXT = /\b([A-Z]{1,4}\d{0,2}-\d{2,5}[A-Z]?)\b/g;
// "JULY-2025" has the shape of a number and is a date.
const MONTHS = /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC|JANUARY|FEBRUARY|MARCH|APRIL|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)-\d{2,4}$/;

export function validNumber(n) {
  const s = String(n || '').trim().toUpperCase();
  return NUMBER_SHAPE.test(s) && !MONTHS.test(s);
}

// The title block corner, as fractions of the sheet: right-hand 20%, bottom 18%.
const CORNER = { x: 0.80, y: 0.18 };

// The drawing number printed in the title block corner, or ''.
// items: [{ s, x, y }] with x, y as fractions of the page (y up from the bottom).
export function numberFromItems(items) {
  const found = [];
  for (const it of items || []) {
    if (!(it.x >= CORNER.x && it.y <= CORNER.y)) continue;
    for (const m of String(it.s || '').toUpperCase().matchAll(NUMBER_IN_TEXT)) {
      if (validNumber(m[1])) found.push({ n: m[1], score: it.x - it.y });
    }
  }
  if (!found.length) return '';
  // Nearest the very corner wins; ties broken by the number itself, so the
  // answer never depends on the order pdf.js happened to return the text in.
  found.sort((a, b) => (b.score - a.score) || a.n.localeCompare(b.n));
  return found[0].n;
}

// THE TITLE BLOCK'S OWN FIELDS, by position: a label ("Drawing Title:",
// "REV:", "Scale:") and the text printed under it in the same box. Measured
// on Al Warqa'a: the title sits on one or two lines under "Drawing Title:",
// the revision under "REV:", each value a few points below its label and
// slightly right of it. Only the title-block strip is read (right 20%, bottom
// third), so a note elsewhere on the sheet is never mistaken for a title.
const LABELS = {
  title: /^(DRAWING\s*TITLE|DWG\.?\s*TITLE|SHEET\s*TITLE|TITLE)\s*:?$/i,
  revision: /^(REV(ISION)?\.?(\s*NO\.?)?)\s*:?$/i,
  scale: /^SCALE\s*:?$/i,
  date: /^DATE\s*:?$/i,
  number: /^(DRAWING|DWG\.?|SHEET)\s*(NO\.?|NUMBER)\s*:?$/i,
};
const ANY_LABEL = /:\s*$|^(SIZE|REV\.?|DATE|SCALE|DRAWN|CHK\.?|APP\.?|DESCRIPTION|PROJECT|CLIENT|CONSULTANT|CONTRACTOR)\b/i;

export function titleBlockFields(items) {
  const strip = (items || []).filter((i) => i.s && i.s.trim() && i.x >= 0.78 && i.y <= 0.36)
    .map((i) => ({ ...i, s: i.s.trim() }));
  const labels = strip.filter((i) => ANY_LABEL.test(i.s) || Object.values(LABELS).some((re) => re.test(i.s)));
  const out = {};
  for (const [field, re] of Object.entries(LABELS)) {
    // A label written with a colon is the box's own label ("REV:"); one without
    // is usually a column heading of the revision table ("REV."). The box wins,
    // and among boxes the lowest, nearest the corner.
    const found = strip.filter((i) => re.test(i.s));
    const boxes = found.filter((i) => /:\s*$/.test(i.s));
    const lab = (boxes.length ? boxes : found).sort((a, b) => a.y - b.y)[0];
    if (!lab) continue;
    // The next label below this one in the same column ends this box.
    const below = labels.filter((l) => l !== lab && l.y < lab.y - 0.002 && Math.abs(l.x - lab.x) < 0.012)
      .sort((a, b) => b.y - a.y)[0];
    const floor = below ? below.y : lab.y - 0.05;
    const vals = strip.filter((i) => i !== lab && !labels.includes(i) && i.y < lab.y - 0.002 && i.y > floor - 0.001
      && i.x >= lab.x - 0.012 && i.x <= lab.x + 0.06 && lab.y - i.y <= 0.05)
      .sort((a, b) => (b.y - a.y) || (a.x - b.x));
    const text = vals.map((v) => v.s).join(' ').replace(/\s+/g, ' ').trim();
    if (text) out[field] = text;
  }
  // "0.", "0. R0", "R0 0." — the same revision printed twice in one box. A
  // lettered form (R0, P1, C) is kept when there is one, else the first.
  if (out.revision) {
    const toks = out.revision.split(/\s+/).map((t) => t.replace(/\.+$/, '')).filter((t) => /^[A-Z]{0,2}\d{0,3}$/i.test(t) && t);
    const lettered = toks.find((t) => /[A-Z]/i.test(t));
    out.revision = (lettered || toks[0] || '').toUpperCase().slice(0, 6);
    if (!out.revision) delete out.revision;
  }
  if (out.title) out.title = out.title.slice(0, 200);
  return out;
}

// What kind of paper. Drawings are A3 and larger; a report is A4 or letter.
export function paperOf(w, h) {
  const big = Math.max(w, h), small = Math.min(w, h);
  if (big <= 1010 && small <= 640) return 'document';    // A4, letter, legal
  return 'sheet';
}

// Every page: size, text (with annotations) and the corner number.
// maxPages caps a huge binder; pages beyond it are reported, never dropped silently.
export async function readPdfSheets(bytes, opts = {}) {
  const maxPages = Math.max(1, Math.min(Number(opts.maxPages) || 120, 400));
  const out = { pages: [], numPages: 0, truncated: false, error: '' };
  if (!bytes || !bytes.length) { out.error = 'empty file'; return out; }
  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await getDocument({ data: new Uint8Array(bytes), verbosity: 0, isEvalSupported: false }).promise;
    out.numPages = doc.numPages;
    out.truncated = doc.numPages > maxPages;
    for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
      const page = await doc.getPage(i);
      const [x0, y0, x1, y1] = page.view;
      const W = Math.max(1, x1 - x0), H = Math.max(1, y1 - y0);
      const tc = await page.getTextContent();
      const ann = await page.getAnnotations();
      const items = tc.items.map((t) => ({ s: t.str, x: (t.transform[4] - x0) / W, y: (t.transform[5] - y0) / H }))
        .concat(ann.filter((a) => a.contentsObj && a.contentsObj.str && Array.isArray(a.rect))
          .map((a) => ({ s: a.contentsObj.str, x: (a.rect[0] - x0) / W, y: (a.rect[1] - y0) / H })));
      const text = items.map((t) => t.s).join(' ').replace(/[ \t]+/g, ' ').trim();
      out.pages.push({ page: i, w: Math.round(W), h: Math.round(H), paper: paperOf(W, H),
        text, number: numberFromItems(items), fields: titleBlockFields(items) });
      page.cleanup();
    }
    await doc.destroy();
  } catch (e) {
    out.error = 'the PDF could not be read';
  }
  return out;
}

// One page of a PDF as its own single-sheet PDF. No creation or modification
// date is written, so the same page always gives the same bytes (and the same
// fingerprint) — which is what lets a re-drop be recognised.
export async function pdfPage(bytes, pageIndex) {
  const { PDFDocument } = await import('pdf-lib');
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const out = await PDFDocument.create({ updateMetadata: false });
  const [copy] = await out.copyPages(src, [pageIndex]);
  out.addPage(copy);
  return out.save({ useObjectStreams: false });
}

// The words of a sheet, stripped of spacing, as a fingerprint of its content.
// Two files carrying the same drawing (a sheet saved twice, or a page of a
// combined set and the same sheet issued alone) read the same.
export function textKey(text) {
  return String(text || '').toUpperCase().replace(/\s+/g, '');
}
