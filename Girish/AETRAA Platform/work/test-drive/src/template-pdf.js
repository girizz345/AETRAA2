// PDF reference forms (Ajay, 6 Oct 2026, decision 14).
//
// A consultant's form sent as a PDF, used like the Excel and Word ones: its
// fields are read when it is uploaded, the New form asks for them, the filled
// form is shown before each signature, and the issued file carries every
// signature in its box.
//
//   A FILLABLE PDF (AcroForm): its own fields are the form's fields — the
//   field's tooltip (/TU) is its label where it has one, else its name. A
//   signature field, or a field named "signature", is a signature box.
//   A FLAT PDF: every "Label:" it states (a short line ending in a colon) is a
//   field, and a fillable box is added to the right of it, on the same line.
//   The form is kept as sent; the prepared copy carries the boxes.
//
// Deterministic throughout. Nothing is guessed: a field with no value prints
// blank, and an issued form is flattened so its values cannot be edited.

import { PDFDocument, PDFName, PDFString, PDFHexString, PDFTextField, PDFCheckBox, PDFDropdown, PDFSignature, StandardFonts, rgb } from 'pdf-lib';

export const PDF_EXTRACTOR = 'e16-pdf-1';
export const isPdf = (b) => !!(b && b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46);
const norm = (s) => String(s || '').toLowerCase().replace(/[\s_]+/g, ' ').trim();
export const tokenOf = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'field';
const human = (name) => String(name || '').replace(/[_.]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
const SIGN_RE = /sign(ature|ed)?\b/i;

async function load(bytes) {
  let doc;
  try { doc = await PDFDocument.load(new Uint8Array(bytes), { updateMetadata: false }); }
  catch (e) { return { error: /encrypt/i.test(String(e && e.message)) ? 'that PDF is password-protected — save an unprotected copy and upload that' : 'that PDF could not be read' }; }
  try { if (!doc.getPageCount()) return { error: 'that PDF could not be read — it has no pages' }; doc.getForm(); }
  catch (e) { return { error: 'that PDF could not be read' }; }
  return { doc };
}
function tooltip(field) {
  const tu = field.acroField.dict.get(PDFName.of('TU'));
  return tu instanceof PDFString || tu instanceof PDFHexString ? tu.decodeText() : '';
}
function placeOf(doc, field) {
  const w = field.acroField.getWidgets()[0];
  if (!w) return { page: 0, rect: null };
  const pages = doc.getPages();
  let page = pages.findIndex((p) => w.P() && p.ref === w.P());
  if (page < 0) page = pages.findIndex((p) => { const an = p.node.Annots(); return an && an.asArray().some((a) => a === field.acroField.getWidgets()[0].dict || String(a) === String(w.dict)); });
  return { page: Math.max(0, page), rect: w.getRectangle() };
}
const kindOf = (f) => (f instanceof PDFSignature ? 'signature' : f instanceof PDFCheckBox ? 'checkbox' : f instanceof PDFDropdown ? 'dropdown' : f instanceof PDFTextField ? 'text' : 'other');

// The labels a flat form states, with where each one ends — pdf.js text items.
async function flatLabels(bytes, maxPages = 4) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await getDocument({ data: new Uint8Array(bytes), verbosity: 0, isEvalSupported: false }).promise;
  const out = [];
  for (let n = 1; n <= Math.min(pdf.numPages, maxPages); n++) {
    const page = await pdf.getPage(n);
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      const s = String(it.str || '').trim();
      if (!/^[A-Za-z][A-Za-z0-9 ./&()'-]{1,40}:$/.test(s)) continue;
      const [, , , , x, y] = it.transform;
      out.push({ label: s.slice(0, -1).trim(), page: n - 1, x: x + (it.width || s.length * 5) + 4, y, size: Math.abs(it.transform[3]) || 9 });
    }
    page.cleanup();
  }
  await pdf.destroy();
  return out;
}

// Read the form. → { fields, signs, flat, read, prepared? } or { error }
//   fields: [{ cell, label, token, kind, page, by }]   cell = the PDF field's name
export async function readPdfForm(bytes) {
  try { return await readPdfFormInner(bytes); } catch (e) { return { error: 'that PDF form could not be read (' + String(e && e.message || e).slice(0, 80) + ')' }; }
}
async function readPdfFormInner(bytes) {
  const L = await load(bytes);
  if (L.error) return L;
  const doc = L.doc;
  let form = doc.getForm();
  let list = form.getFields();
  const read = [];
  let prepared = null, flat = false;
  if (!list.length) {
    // A flat form: a box beside each label it states.
    flat = true;
    let labels = [];
    try { labels = await flatLabels(bytes); } catch (e) { labels = []; }
    const seen = new Map();
    for (const l of labels) {
      let name = tokenOf(l.label);
      const k = (seen.get(name) || 0) + 1; seen.set(name, k);
      if (k > 1) name += '_' + k;
      const page = doc.getPage(l.page);
      const width = Math.max(60, Math.min(page.getWidth() - l.x - 24, 260));
      if (width < 30) { read.push({ label: l.label, read: false, why: 'no room beside the label for a box' }); continue; }
      const tf = form.createTextField(name);
      tf.addToPage(page, { x: l.x, y: l.y - 2, width, height: Math.max(10, l.size + 4), borderWidth: 0, backgroundColor: undefined });
      tf.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText(l.label));
      read.push({ label: l.label, read: true, page: l.page + 1 });
    }
    prepared = await doc.save({ useObjectStreams: false });
    list = form.getFields();
  }
  const fields = [], signs = [];
  for (const f of list) {
    const name = f.getName();
    const label = (tooltip(f) || human(name)).slice(0, 80);
    const kind = kindOf(f);
    const place = placeOf(doc, f);
    if (kind === 'signature' || SIGN_RE.test(name) || SIGN_RE.test(label)) { signs.push({ cell: name, label, page: place.page }); continue; }
    if (kind === 'other') { read.push({ label, read: false, why: 'a button or a field kind the platform does not fill' }); continue; }
    fields.push({ cell: name, label, token: tokenOf(name), kind, page: place.page, by: 'extractor' });
    if (!flat) read.push({ label, read: true, page: place.page + 1 });
  }
  return { ok: true, fields, signs, flat, read, ...(prepared ? { prepared } : {}) };
}

// Fill it. values: by token, name or label (as fillTemplate's); signCells:
// { fieldName: 'Name — e-signed 06/10/2026' }. → { ok, format, bytes, filled, missing }
export async function fillPdfForm(bytes, values, signCells, opts = {}) {
  try { return await fillPdfFormInner(bytes, values, signCells, opts); } catch (e) { return { error: 'the PDF form could not be filled (' + String(e && e.message || e).slice(0, 80) + ')' }; }
}
async function fillPdfFormInner(bytes, values, signCells, opts) {
  const L = await load(bytes);
  if (L.error) return L;
  const doc = L.doc, form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const lookup = new Map();
  for (const k of Object.keys(values || {})) lookup.set(norm(k), values[k]);
  const filled = [], missing = [];
  for (const f of form.getFields()) {
    const name = f.getName(), label = tooltip(f) || human(name);
    if (signCells && signCells[name] !== undefined) continue;
    const key = [norm(tokenOf(name)), norm(name), norm(label)].find((k) => lookup.has(k));
    const v = key ? lookup.get(key) : undefined;
    if (v == null || v === '') { if (kindOf(f) !== 'signature') missing.push(label); continue; }
    try {
      if (f instanceof PDFTextField) { f.setText(String(v)); filled.push(label); }
      else if (f instanceof PDFCheckBox) { if (/^(yes|y|x|true|1|✓|checked)$/i.test(String(v).trim())) f.check(); else f.uncheck(); filled.push(label); }
      else if (f instanceof PDFDropdown) { const o = f.getOptions().find((x) => norm(x) === norm(v)); if (o) { f.select(o); filled.push(label); } else missing.push(label); }
    } catch (e) { missing.push(label); }
  }
  // Signatures: written in the box, in the box's own place.
  for (const [name, text] of Object.entries(signCells || {})) {
    let f = null; try { f = form.getField(name); } catch (e) { f = null; }
    if (!f) continue;
    if (f instanceof PDFTextField) { try { f.setText(String(text)); } catch (e) { /* left blank */ } continue; }
    const place = placeOf(doc, f);
    if (!place.rect) continue;
    const page = doc.getPage(place.page);
    page.drawText(String(text).slice(0, 80), { x: place.rect.x + 2, y: place.rect.y + Math.max(2, place.rect.height / 2 - 4), size: 8, font, color: rgb(0.05, 0.1, 0.35) });
  }
  try { form.updateFieldAppearances(font); } catch (e) { /* appearances as they were */ }
  if (opts.flatten) { try { form.flatten(); } catch (e) { /* left fillable */ } }
  return { ok: true, format: 'pdf', bytes: new Uint8Array(await doc.save({ useObjectStreams: false })), filled, missing };
}

// The filled form as pictures of its pages, for the screens that show it.
export async function pdfPreviewHtml(bytes, maxPages = 3) {
  let C = null;
  try { C = await import('@napi-rs/canvas'); } catch (e) { C = null; }
  if (!C || !C.createCanvas) return '<div class="hint">This server cannot draw the PDF here — download it to check it.</div>';
  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    let fonts;
    try { const { fileURLToPath } = await import('node:url'); fonts = fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url)); } catch (e) { fonts = undefined; }
    const pdf = await getDocument({ data: new Uint8Array(bytes), verbosity: 0, isEvalSupported: false, ...(fonts ? { standardFontDataUrl: fonts } : {}) }).promise;
    const imgs = [];
    for (let n = 1; n <= Math.min(pdf.numPages, maxPages); n++) {
      const page = await pdf.getPage(n);
      const v1 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: Math.min(2, 900 / v1.width) });
      const cv = C.createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
      const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      await page.render({ canvasContext: ctx, viewport: vp, annotationMode: 2 }).promise;
      imgs.push('<img alt="page ' + n + '" style="width:100%;border:1px solid #ccd;margin-bottom:8px" src="data:image/png;base64,' + Buffer.from(await cv.encode('png')).toString('base64') + '">');
      page.cleanup();
    }
    const more = pdf.numPages > maxPages ? '<div class="hint">' + (pdf.numPages - maxPages) + ' more page(s) in the file.</div>' : '';
    await pdf.destroy();
    return '<div class="pdf-form">' + imgs.join('') + more + '</div>';
  } catch (e) { return '<div class="hint">The PDF could not be drawn here — download it to check it.</div>'; }
}
