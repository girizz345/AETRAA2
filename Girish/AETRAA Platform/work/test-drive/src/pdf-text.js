// The words on a PDF page, as a person reading it would see them.
//
// The intake probe only looks at a PDF's raw bytes, and a drawing's text sits in
// compressed streams — and, on most AutoCAD sheets, in "SHX text" annotations
// rather than ordinary text. Neither is visible to the probe, so the project
// check (gate.js) was reading nothing on real drawings.
//
// This reads both, with Mozilla's pdf.js: the page's text and the contents of
// its annotations. It is deterministic — the same file always gives the same
// text — and it never guesses: a scanned sheet comes back empty, and the caller
// treats empty as "nothing to judge by".
//
// Node only (loaded on first use). Any failure returns '' so one bad file never
// costs the rest of a folder.

export async function pdfText(bytes, opts = {}) {
  const maxPages = Math.max(1, Math.min(Number(opts.pages) || 2, 20));
  if (!bytes || !bytes.length) return '';
  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(bytes);           // pdf.js takes ownership of its copy
    const doc = await getDocument({ data, verbosity: 0, isEvalSupported: false }).promise;
    const parts = [];
    for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      parts.push(tc.items.map((x) => x.str).join(' '));
      const ann = await page.getAnnotations();
      parts.push(ann.map((a) => (a.contentsObj && a.contentsObj.str) || '').join(' '));
    }
    await doc.destroy();
    return parts.join('\n').replace(/[ \t]+/g, ' ').trim();
  } catch (e) {
    return '';
  }
}

// The same reading, one string per page, for documents whose figures must be
// quoted with the page they sit on (a contract's payment terms). A page with no
// text — a scan — comes back as '' in its place, so page numbers stay true.
export async function pdfPages(bytes, opts = {}) {
  const maxPages = Math.max(1, Math.min(Number(opts.pages) || 300, 1000));
  if (!bytes || !bytes.length) return [];
  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await getDocument({ data: new Uint8Array(bytes), verbosity: 0, isEvalSupported: false }).promise;
    const out = [];
    for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      out.push(tc.items.map((x) => x.str).join(' ').replace(/[ \t]+/g, ' ').trim());
    }
    await doc.destroy();
    return out;
  } catch (e) {
    return [];
  }
}

// The words of each page, line by line (K10, K12): pdf.js gives the pieces of
// text with their position; a new line starts where pdf.js ends one or where
// the height changes, so "Ref:" and "Date:" on their own lines stay apart and
// a clause number stays at the start of its clause. One string per page; a
// scanned page is ''. With `items`, each page's text pieces and their boxes in
// PDF units (x, y, w, h) come back too — what a highlight is drawn over.
export async function pdfPageLines(bytes, opts = {}) {
  const maxPages = Math.max(1, Math.min(Number(opts.pages) || 300, 1000));
  if (!bytes || !bytes.length) return [];
  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await getDocument({ data: new Uint8Array(bytes), verbosity: 0, isEvalSupported: false }).promise;
    const out = [];
    for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      const lines = [];
      let line = '', lastY = null;
      const boxes = [];
      for (const it of tc.items) {
        const y = it.transform ? it.transform[5] : lastY;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && line.trim()) { lines.push(line.trim()); line = ''; }
        line += (line && !/\s$/.test(line) && it.str && !/^\s/.test(it.str) ? ' ' : '') + (it.str || '');
        if (it.hasEOL && line.trim()) { lines.push(line.trim()); line = ''; }
        lastY = y;
        if (opts.items && it.str && it.str.trim() && it.transform) {
          boxes.push({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0, h: it.height || Math.abs(it.transform[3]) || 10 });
        }
      }
      if (line.trim()) lines.push(line.trim());
      const text = lines.join('\n').replace(/[ \t]+/g, ' ').trim();
      out.push(opts.items ? { text, items: boxes } : text);
      page.cleanup();
    }
    await doc.destroy();
    return out;
  } catch (e) {
    return [];
  }
}
