// K9 · v5 A1 step 1: "sends only the title-block corner of each sheet".
//
// A scanned sheet is one picture. Sending it whole would send every plan,
// section and note on it to the model — and a CropBox on the PDF only hides
// the rest, the whole scan still travels inside. So the corner is cut out
// here, as its own small image, and that image is all that leaves.
//
// The corner is the strip E4 reads the title block from (sheet-reader.js,
// titleBlockFields: the right 22% of the sheet, the bottom 36%), so the AI
// looks where the rule-based reader looks on a sheet that has text. The page's
// own rotation is applied first (pdf.js), so a sheet saved turned is cut where
// its title block is shown.
//
// Deterministic (the same file gives the same crop, kept against its
// SHA-256 so what was sent can be shown later). No AI here.
//
// pdf.js draws the page; @napi-rs/canvas (installed with pdf.js) is the
// surface. Both are loaded on first use; a server without the canvas library
// refuses rather than falling back to sending the whole sheet.

import { readPdfSheets } from './sheet-reader.js';
import { readable } from './gate.js';

export const CORNER = { left: 0.78, top: 0.64 };       // right 22%, bottom 36%
export const CORNER_READER = 'corner-1';
const LONGEST = 1400;                                  // px: legible, and small to send

export const NO_CANVAS = 'this server cannot cut out the title-block corner (the image library is not installed), so nothing was sent';

const kindOf = (filename, mime) => {
  const s = String(filename || '').toLowerCase() + ' ' + String(mime || '').toLowerCase();
  if (/\.pdf\b|application\/pdf/.test(s)) return 'pdf';
  if (/\.png\b|image\/png/.test(s)) return 'png';
  if (/\.jpe?g\b|image\/jpe?g/.test(s)) return 'jpeg';
  if (/\.tiff?\b|image\/tiff/.test(s)) return 'tiff';
  return '';
};

async function canvasLib() {
  try { return await import('@napi-rs/canvas'); } catch (e) { return null; }
}

// Is this sheet a scan — a page with no text the title-block reader (E4) could
// read? Images always are. The same test the project check uses (gate.js).
export async function isScanned(bytes, filename, mime) {
  const k = kindOf(filename, mime);
  if (k === 'png' || k === 'jpeg' || k === 'tiff') return true;
  if (k !== 'pdf') return false;
  const r = await readPdfSheets(bytes, { maxPages: 1 });
  if (r.error || !r.pages.length) return false;
  return !readable(r.pages[0].text);
}

// The title-block corner of the first page, as a PNG.
//   → { png, width, height, page: {w, h}, reader } or { error }
export async function titleBlockCorner(bytes, filename, mime) {
  const k = kindOf(filename, mime);
  if (!bytes || !bytes.length) return { error: 'the sheet could not be read back' };
  if (k === 'tiff') return { error: 'a TIFF scan cannot be cut here — save it as PDF, PNG or JPEG and add it again' };
  if (!k) return { error: 'only a PDF, PNG or JPEG sheet can be read' };
  const C = await canvasLib();
  if (!C || !C.createCanvas) return { error: NO_CANVAS };
  try {
    if (k === 'pdf') {
      const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
      // The 14 standard fonts a PDF may use without embedding them: pdf.js
      // draws them only with its own font files, else their text is blank.
      let fonts;
      try { const { fileURLToPath } = await import('node:url'); fonts = fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url)); } catch (e) { fonts = undefined; }
      const doc = await getDocument({ data: new Uint8Array(bytes), verbosity: 0, isEvalSupported: false, ...(fonts ? { standardFontDataUrl: fonts } : {}) }).promise;
      const page = await doc.getPage(1);
      const v1 = page.getViewport({ scale: 1 });
      const cw1 = v1.width * (1 - CORNER.left), ch1 = v1.height * (1 - CORNER.top);
      const scale = Math.max(0.5, Math.min(4, LONGEST / Math.max(cw1, ch1)));
      const full = page.getViewport({ scale });
      const x0 = Math.floor(full.width * CORNER.left), y0 = Math.floor(full.height * CORNER.top);
      const w = Math.max(1, Math.ceil(full.width) - x0), h = Math.max(1, Math.ceil(full.height) - y0);
      const vp = page.getViewport({ scale, offsetX: -x0, offsetY: -y0 });
      const canvas = C.createCanvas(w, h);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const png = new Uint8Array(await canvas.encode('png'));
      const out = { png, width: w, height: h, page: { w: Math.round(v1.width), h: Math.round(v1.height) }, reader: CORNER_READER };
      page.cleanup(); await doc.destroy();
      return out;
    }
    const img = await C.loadImage(Buffer.from(bytes));
    const x0 = Math.floor(img.width * CORNER.left), y0 = Math.floor(img.height * CORNER.top);
    const sw = img.width - x0, sh = img.height - y0;
    const scale = Math.min(1, LONGEST / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));
    const canvas = C.createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, x0, y0, sw, sh, 0, 0, w, h);
    return { png: new Uint8Array(await canvas.encode('png')), width: w, height: h, page: { w: img.width, h: img.height }, reader: CORNER_READER };
  } catch (e) {
    return { error: 'the title-block corner could not be cut out of that sheet' };
  }
}
