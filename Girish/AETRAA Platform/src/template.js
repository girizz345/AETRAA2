// Consultant document templates.
//
// The AETRAA Admin uploads the consultant's own blank Word form for a document
// type (submittal, RFI, WIR, IPC, letter …) with {{placeholders}} typed where
// the values go. Every document the platform issues for that project is then
// produced in that exact format.
//
// A .docx is a ZIP of XML. Two things make this fiddly and both are handled:
//   1. Word splits typed text across runs, so "{{ref}}" is often stored as
//      "{{re" + "f}}" with tags in between. repairXml() stitches those back.
//   2. Values must be XML-escaped or the document will not open.

import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

// The parts of a .docx that can carry visible text.
const TEXT_PARTS = /^word\/(document|header\d*|footer\d*)\.xml$/;

const xmlEscape = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// Word breaks a placeholder across runs. Inside any {{ … }} that stays within
// one paragraph, drop the intervening tags so the placeholder reads as one
// string again. Bounded so a stray "{{" cannot swallow the document.
export function repairXml(xml) {
  return String(xml).replace(
    /\{\{(?:(?!\}\}|<\/w:p>)[\s\S]){0,600}?\}\}/g,
    (m) => m.replace(/<[^>]+>/g, '')
  );
}

const TOKEN_RE = /\{\{\s*([^{}<>]{1,80}?)\s*\}\}/g;
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// Which placeholders does this template actually contain?
export function extractTokens(bytes) {
  let files;
  try { files = unzipSync(new Uint8Array(bytes)); }
  catch (e) { return { error: 'that is not a readable .docx file' }; }
  if (!files['word/document.xml']) return { error: 'that .docx has no document body' };
  const found = new Map();
  for (const name of Object.keys(files)) {
    if (!TEXT_PARTS.test(name)) continue;
    const xml = repairXml(strFromU8(files[name]));
    let m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(xml)) !== null) {
      const raw = m[1].trim();
      if (raw) found.set(norm(raw), raw);
    }
  }
  return { ok: true, tokens: [...found.values()] };
}

// Fill the template. Values are matched case-insensitively and space-insensitively,
// so {{Spec Section}} and {{spec section}} both resolve.
export function fillTemplate(bytes, values) {
  let files;
  try { files = unzipSync(new Uint8Array(bytes)); }
  catch (e) { return { error: 'that is not a readable .docx file' }; }
  if (!files['word/document.xml']) return { error: 'that .docx has no document body' };

  const lookup = new Map();
  for (const k of Object.keys(values || {})) lookup.set(norm(k), values[k]);

  const filled = new Set(), missing = new Set();
  const out = {};
  for (const name of Object.keys(files)) {
    if (!TEXT_PARTS.test(name)) { out[name] = files[name]; continue; }
    let xml = repairXml(strFromU8(files[name]));
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
  return { ok: true, bytes: zipped, filled: [...filled], missing: [...missing] };
}

// The standard values every document gets, plus the record's own form fields.
// A form field is reachable by its own label, so {{Discipline}} works when the
// form had a "Discipline" field.
export function buildValues(record, project, extra) {
  const r = record || {}, p = project || {};
  const today = new Date().toISOString().slice(0, 10);
  const v = {
    ref: r.ref || '', title: r.title || '', type: r.type || '',
    status: r.status || '', date: (r.created_at || '').slice(0, 10) || today,
    today, due: r.due || '', submitted: r.sub || '',
    raised_by: r.created_by || '', author: r.created_by || '',
    project_name: p.name || '', project_ref: p.ref || '',
    client: p.client_name || '', consultant: p.engineer_name || '',
    contractor: p.contractor_name || '', location: p.location || '',
    currency: p.currency || 'AED', contract_completion: p.contract_completion || '',
  };
  // the record's own form fields, by their label
  const data = (r && r.data) || {};
  for (const k of Object.keys(data)) if (!(k in v)) v[k] = data[k];
  for (const k of Object.keys(extra || {})) v[k] = extra[k];
  return v;
}

// The tokens we can always offer, so the console can tell the Admin what to type.
export const STANDARD_TOKENS = [
  'ref', 'title', 'type', 'status', 'date', 'today', 'due', 'submitted',
  'raised_by', 'author', 'project_name', 'project_ref', 'client', 'consultant',
  'contractor', 'location', 'currency', 'contract_completion',
];
