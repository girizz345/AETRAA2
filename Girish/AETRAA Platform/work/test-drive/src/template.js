// Consultant document templates.
//
// The AETRAA Admin uploads the consultant's own blank form for a document type
// (submittal, RFI, WIR, IPC, letter …) with {{placeholders}} typed where the
// values go. Every document the platform issues for that project is then
// produced in that exact format.
//
// BOTH WORD AND EXCEL FORMS ARE ACCEPTED, because consultants in this region
// issue most of their forms as Excel sheets — the ICONIC set for Al Warqaa is
// seven .xlsx files and not one .docx. A template that had to be Word meant
// re-typing the consultant's own form, which is the thing this engine exists
// to avoid.
//
// Both are a ZIP of XML, and the same two things make it fiddly either way:
//   1. The editor splits typed text across runs, so "{{ref}}" is often stored
//      as "{{re" + "f}}" with tags in between. repairXml() stitches those back,
//      bounded by the paragraph (Word) or the string / cell (Excel) so a stray
//      "{{" cannot swallow the file.
//   2. Values must be XML-escaped or the document will not open.
//
// Where the text lives:
//   .docx  word/document.xml, and the headers and footers
//   .xlsx  xl/sharedStrings.xml (nearly all cell text), any inline strings in
//          the sheets themselves, and the text boxes in the drawings

import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { isPdf, fillPdfForm } from './template-pdf.js';

// The parts of each format that can carry visible text.
const TEXT_PARTS = {
  docx: /^word\/(document|header\d*|footer\d*)\.xml$/,
  xlsx: /^xl\/(sharedStrings\.xml|worksheets\/sheet\d+\.xml|drawings\/drawing\d+\.xml)$/,
};

// Where a placeholder must stop. In Word a paragraph; in Excel a shared string,
// a cell, or a line of text in a drawing.
const BOUNDARY = {
  docx: '<\\/w:p>',
  xlsx: '<\\/si>|<\\/c>|<\\/a:p>',
};

export const FORMATS = {
  docx: {
    ext: 'docx',
    label: 'Word form',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  xlsx: {
    ext: 'xlsx',
    label: 'Excel form',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  // Ajay, 6 Oct 2026 (decision 14): a consultant's PDF form (template-pdf.js).
  pdf: {
    ext: 'pdf',
    label: 'PDF form',
    mime: 'application/pdf',
  },
};

// Which of the two is this? Read from the package, never from the file name —
// a form renamed .docx by whoever mailed it is still the sheet it always was.
export function formatOfParts(files) {
  if (!files) return null;
  if (files['word/document.xml']) return 'docx';
  if (files['xl/workbook.xml']) return 'xlsx';
  return null;
}

// The same, from the bytes. Returns null for anything that is not one of the two.
export function formatOf(bytes) {
  if (isPdf(bytes)) return 'pdf';
  try { return formatOfParts(unzipSync(new Uint8Array(bytes))); }
  catch (e) { return null; }
}

const xmlEscape = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// The editor breaks a placeholder across runs. Inside any {{ … }} that stays
// within one paragraph (Word) or one string or cell (Excel), drop the
// intervening tags so the placeholder reads as one string again. Bounded so a
// stray "{{" cannot swallow the document.
export function repairXml(xml, fmt) {
  const bound = BOUNDARY[fmt] || BOUNDARY.docx;
  const re = new RegExp('\\{\\{(?:(?!\\}\\}|' + bound + ')[\\s\\S]){0,600}?\\}\\}', 'g');
  return String(xml).replace(re, (m) => m.replace(/<[^>]+>/g, ''));
}

const TOKEN_RE = /\{\{\s*([^{}<>]{1,80}?)\s*\}\}/g;
const norm = (s) => String(s || '').toLowerCase().replace(/[\s_]+/g, ' ').trim();

const NOT_A_FORM = 'that is not a readable .docx or .xlsx form';

function openParts(bytes) {
  let files;
  try { files = unzipSync(new Uint8Array(bytes)); }
  catch (e) { return { error: NOT_A_FORM }; }
  const fmt = formatOfParts(files);
  if (!fmt) return { error: NOT_A_FORM };
  // K4 (spec §19): a macro-enabled package (.docm / .xlsm, whatever it is
  // named) is not a form. Its macros would be copied into every document
  // issued from it.
  if (files['word/vbaProject.bin'] || files['xl/vbaProject.bin']) {
    return { error: 'that form contains macros (a .docm or .xlsm) — open it, save it as a plain .docx or .xlsx, and upload that' };
  }
  return { files, fmt };
}

// <<placeholders>>, which some forms use and the filler does not (spec §6):
// listed so whoever uploads the form can retype them as {{…}}.
export function angleTokens(bytes) {
  const open = openParts(bytes);
  if (open.error) return [];
  const found = new Set();
  for (const name of Object.keys(open.files)) {
    if (!TEXT_PARTS[open.fmt].test(name)) continue;
    const text = strFromU8(open.files[name]).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    for (const m of text.matchAll(/<<\s*([^<>]{1,60}?)\s*>>/g)) found.add(m[1].trim());
  }
  return [...found].sort();
}

// Which placeholders does this template actually contain?
export function extractTokens(bytes) {
  // A PDF form has fields, not {{tokens}}: read when it is saved (template-pdf.js).
  if (isPdf(bytes)) return { ok: true, format: 'pdf', tokens: [] };
  const open = openParts(bytes);
  if (open.error) return { error: open.error };
  const { files, fmt } = open;
  const found = new Map();
  for (const name of Object.keys(files)) {
    if (!TEXT_PARTS[fmt].test(name)) continue;
    const xml = repairXml(strFromU8(files[name]), fmt);
    let m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(xml)) !== null) {
      const raw = m[1].trim();
      if (raw) found.set(norm(raw), raw);
    }
  }
  return { ok: true, format: fmt, tokens: [...found.values()] };
}

// Fill the template. Values are matched case-insensitively and space-insensitively,
// so {{Spec Section}} and {{spec section}} both resolve.
//   A PDF form is filled by pdf-lib, which works asynchronously: for a PDF this
//   returns a promise, so every caller awaits (awaiting the Word and Excel
//   result, a plain object, changes nothing).
export function fillTemplate(bytes, values) {
  if (isPdf(bytes)) return fillPdfForm(bytes, values, null, {});
  const open = openParts(bytes);
  if (open.error) return { error: open.error };
  const { files, fmt } = open;

  const lookup = new Map();
  for (const k of Object.keys(values || {})) lookup.set(norm(k), values[k]);

  const filled = new Set(), missing = new Set();
  const out = {};
  for (const name of Object.keys(files)) {
    if (!TEXT_PARTS[fmt].test(name)) { out[name] = files[name]; continue; }
    let xml = repairXml(strFromU8(files[name]), fmt);
    xml = xml.replace(TOKEN_RE, (whole, tok) => {
      const k = norm(tok);
      if (lookup.has(k)) {
        const v = lookup.get(k);
        filled.add(tok.trim());
        return xmlEscape(v == null ? '' : v);
      }
      missing.add(tok.trim());
      return '';                        // an unmapped slot prints blank, never "{{x}}"
    });
    out[name] = strToU8(xml);
  }
  let zipped;
  try { zipped = zipSync(out, { level: 6 }); }
  catch (e) { return { error: 'could not rebuild the document' }; }
  return { ok: true, format: fmt, bytes: zipped, filled: [...filled], missing: [...missing] };
}

// The standard values every document gets, plus the record's own form fields.
// A form field is reachable by its own label, so {{Discipline}} works when the
// form had a "Discipline" field.
export function buildValues(record, project, extra) {
  const r = record || {}, p = project || {};
  const today = new Date().toISOString().slice(0, 10);
  const data = (r && r.data) || {};
  // A consultant's own form asks for the same thing under whichever name its
  // author happened to use. These read the record once and answer to all of them.
  const pick = (...names) => {
    for (const n of names) {
      for (const k of Object.keys(data)) if (norm(k) === norm(n) && String(data[k] ?? '') !== '') return data[k];
    }
    return '';
  };
  const v = {
    ref: r.ref || '', title: r.title || '', type: r.type || '',
    status: r.status || '', date: (r.created_at || '').slice(0, 10) || today,
    today, due: r.due || '', submitted: r.sub || '',
    raised_by: r.created_by || '', author: r.created_by || '',
    project_name: p.name || '', project_ref: p.ref || '',
    client: p.client_name || '', consultant: p.engineer_name || '',
    contractor: p.contractor_name || '', location: p.location || '',
    currency: p.currency || 'AED', contract_completion: p.contract_completion || '',
    // Named the way the consultant's forms name them.
    subject: r.title || '',
    description: pick('description', 'work description', 'details', 'question', 'body', 'what happened',
      'activity / scope of work', 'basis of claim', 'precautions taken', 'action required', 'notes') || r.title || '',
    reference: pick('reference', 'drawing ref', 'drawing no', 'drawing number', 'their reference', 'approved material ref', 'spec section'),
    discipline: pick('discipline', 'department', 'trade'),
    location_of_works: pick('location of works', 'location of the works', 'area', 'area of application'),
    revision: pick('revision', 'rev', 'rev no'),
  };
  // the record's own form fields, by their label
  for (const k of Object.keys(data)) if (!(k in v)) v[k] = data[k];
  for (const k of Object.keys(extra || {})) v[k] = extra[k];
  return v;
}

// The tokens we can always offer, so the console can tell the Admin what to type.
export const STANDARD_TOKENS = [
  'ref', 'title', 'subject', 'type', 'status', 'date', 'today', 'due', 'submitted',
  'raised_by', 'author', 'project_name', 'project_ref', 'client', 'consultant',
  'contractor', 'location', 'currency', 'contract_completion',
  'description', 'reference', 'discipline', 'location_of_works', 'revision',
];
