// THE TEMPLATE IS THE FORM — on every project, for every document type.
//
// When a consultant's form is assigned to a document type (template upload on
// /setup, or a template filed through intake), the platform reads it there and
// then: which fields it asks for, and where it is signed. From then on:
//
//   RAISING   the New form asks for every field the template has — the ones
//             the standard form already covers are not asked twice — and the
//             filled template is drawn beside it as it is typed.
//   SIGNING   before every signature the approver sees the document as it
//             will be issued, with their signature shown in its box.
//   ISSUING   the downloaded / issued file carries each signature in the box
//             chosen for that step.
//
// A project with no template for a type keeps the plain form, unchanged.

import { buildValues, fillTemplate, extractTokens, STANDARD_TOKENS, angleTokens } from './template.js';
import { readSheet, sheetHTML, docxHTML, writeCells, suggestSignCells, parseRef } from './template-preview.js';
import { readWordSheet, extractWordFields, prepareWordForm, writeWordCells, suggestWordSignCells, WORD_EXTRACTOR } from './template-word.js';
import { addColumns } from './db-cols.js';
import { RECORD_TYPES } from './records.js';
import { isPdf, readPdfForm, fillPdfForm, pdfPreviewHtml, PDF_EXTRACTOR } from './template-pdf.js';

// E10's version, kept with each Excel form it read (E16's is in template-word.js).
export const EXCEL_EXTRACTOR = 'e10-1';

// Filled by the platform, never asked of the person raising the document.
const AUTO = new Set(['ref', 'title', 'type', 'status', 'date', 'today', 'due', 'submitted', 'raised by', 'author',
  'project name', 'project ref', 'client', 'consultant', 'contractor', 'location', 'currency', 'contract completion']);
const norm = (s) => String(s || '').toLowerCase().replace(/[\s_]+/g, ' ').trim();
const isSignToken = (t) => /^sign(_date|_role)?\s*[:\s]/i.test(String(t).trim()) || /^sign(ature)?$/i.test(String(t).trim());
export const labelOf = (tok) => {
  const s = String(tok).replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* ------------------------------------------------------------ the store */

// Once per process: a failed ALTER is not free on PostgreSQL, and it would
// otherwise be tried on every upload and every signature.
let SIGN_COL = false, FIELD_COLS = false;
export async function ensureSignColumn(env) {
  if (SIGN_COL) return;
  // Through addColumns (rule 4), not a bare ALTER that fails noisily on PostgreSQL.
  SIGN_COL = await addColumns(env, 'templates', [['sign_map', 'TEXT']]);
}
export function readSignMap(row) {
  let m = null;
  try { m = JSON.parse((row && row.sign_map) || 'null'); } catch (e) { m = null; }
  // K9 (A6): `ai` — signature boxes the AI proposed and Document Control kept,
  // each { cell, label }, shown beside the boxes read from the form.
  return m && typeof m === 'object' ? { suggested: m.suggested || [], steps: m.steps || {}, labels: m.labels || {}, ai: Array.isArray(m.ai) ? m.ai : [] }
    : { suggested: [], steps: {}, labels: {}, ai: [] };
}

// Read on upload: where the form is signed, and a first guess at which step
// signs where. The guess puts the contractor's signatory (the first approval
// after raising) in the first contractor signature box; the rest wait for the
// Admin, who confirms or moves them on the template itself.
export function captureSignBoxes(bytes, steps) {
  // E16: a Word form's tables are read onto the same grid, so its signature
  // boxes are found and mapped the same way.
  let sheet = readSheet(bytes), word = false;
  if (sheet.error) { sheet = readWordSheet(bytes); word = true; }
  if (sheet.error) return { suggested: [], steps: {}, labels: {} };
  const suggested = word ? suggestWordSignCells(sheet) : suggestSignCells(sheet);
  const labels = {};
  for (const ref of suggested) {
    const p = parseRef(ref);
    let label = '';
    for (let c = 1; c < p.c; c++) { const t = (sheet.cells[p.r + ':' + c] || {}).text; if (t && !/SIGN/i.test(t)) label = t; }
    labels[ref] = String(label).replace(/\s+/g, ' ').trim().slice(0, 80);
  }
  const map = {};
  const firstContractor = suggested.find((r) => /CONTRACTOR/i.test(labels[r] || '')) || suggested[0];
  const approval = (steps || []).findIndex((s, i) => i > 0 && !s.issue && !s.reply);
  if (firstContractor && approval > 0) map[approval] = firstContractor;
  return { suggested, steps: map, labels };
}

export async function saveSignMap(env, pid, docType, steps) {
  await ensureSignColumn(env);
  const row = await env.DB.prepare('SELECT sign_map FROM templates WHERE project_id = ? AND doc_type = ?').bind(pid, docType).first();
  if (!row) return { error: 'There is no template for that document on this project.' };
  const cur = readSignMap(row);
  const clean = {};
  for (const [k, v] of Object.entries(steps || {})) {
    if (!/^\d+$/.test(k)) continue;
    if (v && parseRef(v)) clean[k] = String(v).toUpperCase().replace(/\$/g, '');
  }
  cur.steps = clean;
  await env.DB.prepare('UPDATE templates SET sign_map = ? WHERE project_id = ? AND doc_type = ?')
    .bind(JSON.stringify(cur), pid, docType).run();
  return { ok: true, steps: clean };
}

/* ------------------------------------------------------------ what to ask */

// The fields the template needs that the standard form does not already give.
export function extraFields(tokens, labels, project) {
  const probe = {};
  for (const l of labels || []) probe[l] = 'x';
  const v = buildValues({ ref: 'x', title: 'x', data: probe, created_by: 'x', created_at: '2026-01-01' },
    { name: 'x', ref: 'x', client_name: 'x', engineer_name: 'x', contractor_name: 'x', location: 'x' });
  const have = new Set(Object.keys(v).filter((k) => String(v[k] || '') !== '').map(norm));
  const out = [], seen = new Set();
  for (const t of tokens || []) {
    const k = norm(t);
    if (AUTO.has(k) || have.has(k) || isSignToken(t) || seen.has(k)) continue;
    seen.add(k);
    out.push({ token: t, label: labelOf(t), long: /description|details|question|body|remarks|scope|response|reason/i.test(t) });
  }
  return out;
}

/* ------------------------------------------------------------ signatures */

const dmy = (s) => { const d = String(s || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : d; };

// Who has signed which step, and which step is next.
export function signaturesFor(record, steps, signMap, opts = {}) {
  const wf = (record && record.workflow) || [];
  const cells = {}, html = {}, word = {};
  wf.forEach((w, i) => {
    const cell = signMap.steps[i];
    const role = (steps[i] && steps[i].st) || w.st || '';
    if (w && w.state === 'done' && w.who) {
      const date = dmy(w.when);
      word['sign:' + i] = w.who; word['sign_date:' + i] = date; word['sign_role:' + i] = role;
      if (cell) {
        cells[cell] = w.who + ' — e-signed ' + date;
        html[cell] = { name: w.who, date, role };
      }
    } else if (cell && opts.pendingStep === i) {
      html[cell] = { pending: true, label: opts.pendingLabel || 'Signature goes here', role };
    }
  });
  return { cells, html, word };
}

/* ------------------------------------------------------------ draw / issue */

export async function drawTemplate(bytes, values, signHtml, opts = {}) {
  // Decision 14: a PDF form, filled and drawn as pictures of its pages, with
  // each signature so far (or the one about to be given) in its box.
  if (isPdf(bytes)) {
    const cells = {};
    for (const [cell, s] of Object.entries(signHtml || {})) cells[cell] = s.pending ? '[' + (s.label || 'signature') + ']' : s.name + ' — e-signed ' + s.date;
    const filled = await fillPdfForm(bytes, values, cells, {});
    if (filled.error) return { error: filled.error };
    return { ok: true, format: 'pdf', html: await pdfPreviewHtml(filled.bytes), missing: filled.missing };
  }
  const filled = fillTemplate(bytes, values);
  if (filled.error) return { error: filled.error };
  if (filled.format === 'xlsx') {
    const sheet = readSheet(filled.bytes);
    if (sheet.error) return { error: sheet.error };
    return { ok: true, format: 'xlsx', html: sheetHTML(sheet, signHtml || {}, opts), missing: filled.missing };
  }
  // E16: a Word form with tables is drawn on its grid, so its boxes can be
  // clicked (Fields, signature boxes) and its signatures shown in place.
  const ws = readWordSheet(filled.bytes);
  if (!ws.error && Object.values(ws.cells).some((c) => !c.para)) {
    return { ok: true, format: 'docx', html: sheetHTML(ws, signHtml || {}, opts), missing: filled.missing };
  }
  return { ok: true, format: 'docx', html: docxHTML(filled.bytes), missing: filled.missing };
}

// The file as issued: values filled, every signature so far in its box.
export async function issueFile(bytes, values, signCells) {
  // A PDF form as issued: filled, signed in its boxes, and flattened.
  if (isPdf(bytes)) return fillPdfForm(bytes, values, signCells || {}, { flatten: true });
  const filled = fillTemplate(bytes, values);
  if (filled.error) return filled;
  if (filled.format === 'xlsx' && Object.keys(signCells || {}).length) {
    return { ...filled, bytes: writeCells(filled.bytes, signCells) };
  }
  if (filled.format === 'docx' && Object.keys(signCells || {}).length) {
    return { ...filled, bytes: writeWordCells(filled.bytes, signCells) };
  }
  return filled;
}

/* ------------------------------------------------------------ what prints blank */

// Every placeholder a form uses that nothing will fill — spec §6: "report every
// token a template uses that the platform does not supply". Listed by name at
// upload and on the template list, before a document is issued from it.
//   - on a form whose fields were read (E10/E16), a {{token}} that is neither a
//     field nor filled by the platform: the New form does not ask for it
//   - {{sign:N}} for a step this document's workflow does not have
//   - <<token>>: the platform fills {{…}} only
// A form with no fields asks for every other token on the New form, so those
// are supplied.
const nk = (s) => String(s || '').toLowerCase().replace(/[\s_]+/g, ' ').trim();
export function unknownTokens(tokens, fields, wfLen, angles) {
  const std = new Set(STANDARD_TOKENS.map(nk));
  const own = new Set((fields || []).map((f) => nk(f.token)));
  const out = [];
  for (const t of tokens || []) {
    const sm = /^sign(_date|_role)?\s*:\s*(\d+)$/i.exec(String(t).trim());
    if (sm) {
      if (wfLen && Number(sm[2]) >= wfLen) out.push({ token: t, why: 'this document’s workflow has no step ' + sm[2] + ', so nobody ever signs it — it prints blank' });
      continue;
    }
    if (isSignToken(t) || std.has(nk(t)) || own.has(nk(t))) continue;
    if (fields && fields.length) out.push({ token: t, why: 'not one of this form’s fields and not filled by the platform — it prints blank' });
  }
  for (const a of angles || []) out.push({ token: '<<' + a + '>>', why: 'written <<…>>; the platform fills {{…}} — retype it as {{' + a + '}}' });
  return out;
}

export { buildValues, extractTokens };

/* ------------------------------------------------------------ forms read as they are sent */

import { extractFields, prepareForm, inputFields, fieldValues } from './template-extract.js';
import { saveTemplate, getTemplateBytes, deleteTemplate, ensureTemplatesTable } from './templates-store.js';
import { putFile, getFile } from './storage.js';
export { inputFields, fieldValues };

export async function ensureFieldColumns(env) {
  if (FIELD_COLS) return;
  await ensureTemplatesTable(env);
  await ensureSignColumn(env);
  // K4: the E-program record — the original's SHA-256 and the extractor that
  // read it, how many fields it found (A6 is offered under two), every row
  // read or not with the reason, and the placeholders nothing fills.
  FIELD_COLS = await addColumns(env, 'templates', [['fields', 'TEXT'], ['orig_key', 'TEXT'], ['sha256', 'TEXT'], ['extractor', 'TEXT'],
    ['field_count', 'INTEGER'], ['read_report', 'TEXT'], ['unknown_tokens', 'TEXT']]);
}
async function sha256Hex(u8) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', u8))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function readFields(row) {
  try { const f = JSON.parse((row && row.fields) || 'null'); return Array.isArray(f) ? f : null; } catch (e) { return null; }
}

// Save a consultant's form exactly as sent. An Excel form is read for its
// fields (template-extract.js) and made fillable; the original is kept, so
// the fields can be changed later without uploading it again.
export async function saveFormTemplate(env, pid, docType, filename, bytes, who, opts = {}) {
  await ensureFieldColumns(env);
  const u8 = new Uint8Array(bytes);
  const original = opts.original ? new Uint8Array(opts.original) : u8;
  if (isPdf(u8)) return savePdfForm(env, pid, docType, filename, u8, original, who, opts);
  const tokens0 = extractTokens(u8);
  if (tokens0.error) return { error: tokens0.error };             // not a form, or macro-enabled
  const wfLen = ((RECORD_TYPES[docType] || {}).wf || []).length;
  const sha = await sha256Hex(original);
  const isXlsx = tokens0.format === 'xlsx' && (() => { try { return !!readSheetQuick(u8); } catch (e) { return false; } })();
  // E16: a Word form is read from its tables. A Word form with no label table
  // (one that already carries {{tokens}}) is kept as it is, as before.
  const wx = tokens0.format === 'docx' ? extractWordFields(u8) : null;
  const wordFields = wx && !wx.error && (wx.fields.length || Array.isArray(opts.fields)) ? wx : null;
  if (!isXlsx && !wordFields) {
    const r = await saveTemplate(env, pid, docType, filename, u8, who);
    if (r.error) return r;
    const unknown = unknownTokens(r.tokens, null, wfLen, angleTokens(u8));
    await env.DB.prepare('UPDATE templates SET sha256 = ?, extractor = ?, field_count = ?, read_report = ?, unknown_tokens = ? WHERE id = ?')
      .bind(sha, tokens0.format === 'docx' ? WORD_EXTRACTOR : EXCEL_EXTRACTOR, 0,
        JSON.stringify(wx && !wx.error ? wx.read : []), JSON.stringify(unknown), r.id).run();
    return { ...r, field_count: 0, needs_ai: true, unknown_tokens: unknown, extractor: tokens0.format === 'docx' ? WORD_EXTRACTOR : EXCEL_EXTRACTOR };
  }
  const ex = isXlsx ? extractFields(u8) : wordFields;
  if (ex.error) return { error: ex.error };
  const fields = Array.isArray(opts.fields) ? opts.fields : ex.fields.map((f) => ({ ...f, by: f.by || 'extractor' }));
  const prepared = isXlsx ? prepareForm(u8, fields, ex.clear) : prepareWordForm(u8, fields, ex.clear);
  const keepSigns = opts.keepSigns || null;
  const r = await saveTemplate(env, pid, docType, filename, prepared, who);
  if (r.error) return r;
  const ext = isXlsx ? 'xlsx' : 'docx';
  const okey = 'templates/' + pid + '/' + docType + '/' + r.id + '.orig.' + ext;
  const put = await putFile(env, okey, original, isXlsx ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  // What the extractor itself found, for A6 (K9): offered only under two, and
  // never allowed to change a field the extractor read.
  const readCount = ex.fields.length;
  const unknown = unknownTokens(r.tokens, fields, wfLen, angleTokens(original));
  await env.DB.prepare('UPDATE templates SET fields = ?, orig_key = ?, sha256 = ?, extractor = ?, field_count = ?, read_report = ?, unknown_tokens = ? WHERE id = ?')
    .bind(JSON.stringify(fields), put && put.ok ? put.key : null, sha, isXlsx ? EXCEL_EXTRACTOR : WORD_EXTRACTOR, readCount,
      JSON.stringify(ex.read || []), JSON.stringify(unknown), r.id).run();
  if (keepSigns || Array.isArray(opts.keepAi)) {
    const row = await env.DB.prepare('SELECT sign_map FROM templates WHERE id = ?').bind(r.id).first();
    const sm = readSignMap(row);
    if (keepSigns) sm.steps = keepSigns;
    if (Array.isArray(opts.keepAi)) sm.ai = opts.keepAi;
    await env.DB.prepare('UPDATE templates SET sign_map = ? WHERE id = ?').bind(JSON.stringify(sm), r.id).run();
  }
  return { ...r, fields, inputs: inputFields(fields).length, field_count: readCount, needs_ai: readCount < 2,
    unknown_tokens: unknown, extractor: isXlsx ? EXCEL_EXTRACTOR : WORD_EXTRACTOR };
}
function readSheetQuick(u8) {
  // An .xlsx is a zip holding xl/workbook.xml; checked by the extractor itself.
  const ex = extractFields(u8);
  return ex && !ex.error;
}

// Document Control changes the fields: rebuilt from the original as it was sent.
//   opts.ai: { cells: Set of cells the AI proposed (A6) — kept marked 'ai';
//              signs: the AI's signature boxes Document Control kept }
export async function updateFields(env, pid, docType, fields, who, opts = {}) {
  await ensureFieldColumns(env);
  const row = await env.DB.prepare('SELECT * FROM templates WHERE project_id = ? AND doc_type = ?').bind(pid, docType).first();
  if (!row) return { error: 'There is no form for that document on this project.' };
  let orig = null;
  if (row.orig_key) { const f = await getFile(env, row.orig_key); if (f) orig = f.bytes; }
  if (!orig) { const t = await getTemplateBytes(env, pid, docType); orig = t && t.bytes; }
  if (!orig) return { error: 'The form could not be read back.' };
  // A field DC added or moved is theirs; one left as the extractor read it
  // keeps that mark (the A6 boundary, K9).
  const before = new Map((readFields(row) || []).map((f) => [String(f.cell) + '|' + f.token, f.by || 'extractor']));
  const clean = (Array.isArray(fields) ? fields : []).filter((f) => f && f.cell && f.label).map((f) => {
    const cell = String(f.cell).toUpperCase().replace(/\$/g, '');
    const token = String(f.token || f.label).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'field';
    const ai = opts.ai && opts.ai.cells && opts.ai.cells.has(cell);
    return { cell, label: String(f.label).slice(0, 80), token, auto: !!f.auto, long: !!f.long, by: before.get(cell + '|' + token) || (ai ? 'ai' : 'person') };
  });
  const sm = readSignMap(row);
  return saveFormTemplate(env, pid, docType, row.filename, orig, who,
    { fields: clean, original: orig, keepSigns: sm.steps, keepAi: opts.ai && Array.isArray(opts.ai.signs) ? opts.ai.signs : sm.ai });
}
export { deleteTemplate };

/* ------------------------------------------------------------ PDF forms (decision 14) */

// A consultant's PDF form, read for its fields (template-pdf.js) — a fillable
// one's own fields, or boxes added beside a flat one's labels. Its signature
// fields are its signature boxes, given in order to the workflow's steps until
// Document Control changes them. The form is kept as sent.
async function savePdfForm(env, pid, docType, filename, u8, original, who, opts) {
  const rd = await readPdfForm(original);
  if (rd.error) return { error: rd.error };
  const prepared = rd.prepared || original;
  const wfLen = ((RECORD_TYPES[docType] || {}).wf || []).length;
  const sha = await sha256Hex(original);
  const r = await saveTemplate(env, pid, docType, filename, prepared, who);
  if (r.error) return r;
  const fields = Array.isArray(opts.fields) ? opts.fields : rd.fields.map(({ cell, label, token, by }) => ({ cell, label, token, by }));
  const okey = 'templates/' + pid + '/' + docType + '/' + r.id + '.orig.pdf';
  const put = await putFile(env, okey, original, 'application/pdf');
  const read = rd.read.concat(rd.signs.map((s) => ({ label: s.label, read: true, sign: true, page: s.page + 1 })));
  await env.DB.prepare('UPDATE templates SET fields = ?, orig_key = ?, sha256 = ?, extractor = ?, field_count = ?, read_report = ?, unknown_tokens = ? WHERE id = ?')
    .bind(JSON.stringify(fields), put && put.ok ? put.key : null, sha, PDF_EXTRACTOR, rd.fields.length, JSON.stringify(read), '[]', r.id).run();
  const row = await env.DB.prepare('SELECT sign_map FROM templates WHERE id = ?').bind(r.id).first();
  const sm = readSignMap(row);
  if (opts.keepSigns) sm.steps = opts.keepSigns;
  else { sm.steps = {}; rd.signs.slice(0, wfLen || rd.signs.length).forEach((s, i) => { sm.steps[i] = s.cell; }); }
  await env.DB.prepare('UPDATE templates SET sign_map = ? WHERE id = ?').bind(JSON.stringify(sm), r.id).run();
  return { ...r, format: 'pdf', fields, inputs: inputFields(fields).length, field_count: rd.fields.length, needs_ai: false,
    signs: rd.signs.map((s) => s.cell), flat: rd.flat, unknown_tokens: [], extractor: PDF_EXTRACTOR };
}
