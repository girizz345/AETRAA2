// AUTHORITY-APPROVED DRAWINGS (P1, agreed 5 Oct 2026).
//
// A sheet an authority has approved — Dubai Municipality, Civil Defence, DEWA,
// Etisalat / du, RTA and the rest — is filed in its own section of the drawing
// register, under that authority, with the approval number and date.
//
// Two readers, in order:
//   1. CODE: the folder it arrived in. A consultant's DM-portal download comes
//      in a "DM" folder with "DCD", "Telephone" or "Drainage" beneath it. Used
//      only when nothing else gave the sheet a stage, so an IFC folder's
//      "04-ETISALAT" discipline sub-folder is never read as an approval.
//   2. AI: the approval stamp itself. On real sheets (Al Warqa'a) the stamp is
//      an image: no text tells a DM-approved sheet from an IFC one. The AI
//      reads the stamp's authority, approval number and date, and says how
//      sure it is. Document Control confirms on the review screen.

import { AUTHORITIES } from './authorities.js';

// Folder words → authority code. Longest, most specific first.
const PATH_HINTS = [
  [/\b(DCD|CIVIL[\s_-]*DEFEN[CS]E)\b/i, 'DCD'],
  [/\bADCD\b/i, 'ADCD'], [/\bSCD\b/i, 'SCD'],
  [/\b(DEWA)\b/i, 'DEWA'], [/\b(ADDC)\b/i, 'ADDC'], [/\b(SEWA)\b/i, 'SEWA'], [/\b(FEWA)\b/i, 'FEWA'],
  [/\b(ETISALAT|TELEPHONE|TELECOM)\b/i, 'DU-ETIS'],
  [/\b(RTA)\b/i, 'RTA'], [/\b(EMPOWER)\b/i, 'EMPOWER'], [/\b(TRAKHEES)\b/i, 'TRAKHEES'],
  [/\b(DDA)\b/i, 'DDA'], [/\b(NAKHEEL)\b/i, 'NAKHEEL'],
  [/\b(DM|DUBAI[\s_-]*MUNICIPALITY)\b/i, 'DM'], [/\b(DMT)\b/i, 'DMT'], [/\bSM\b/, 'SM'],
];

// The authority a file's folders name, deepest folder first (so
// "01. DM / 1. 12-05-2026 / DCD" is Civil Defence, "01. DM / Arch" is DM).
export function authorityFromPath(path) {
  const parts = String(path || '').split('/').slice(0, -1).reverse();
  for (const part of parts) {
    for (const [re, code] of PATH_HINTS) if (re.test(part)) return code;
  }
  return '';
}

// Every authority the platform knows, by code, with its full name.
const BY_CODE = {};
for (const list of Object.values(AUTHORITIES)) for (const a of list) if (!BY_CODE[a.code]) BY_CODE[a.code] = a.name;
export function authorityName(code) { return BY_CODE[code] || code || ''; }

// What the AI wrote → a code: "Dubai Municipality" → DM, "Dubai Civil Defence" → DCD.
export function authorityCode(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  if (BY_CODE[t.toUpperCase()]) return t.toUpperCase();
  const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '');
  for (const [code, name] of Object.entries(BY_CODE)) if (norm(name) === norm(t)) return code;
  for (const [re, code] of PATH_HINTS) if (re.test(t)) return code;
  return '';
}

export const STAMP_SYSTEM = 'You read construction drawings for a UAE contractor. Report only what is on the sheet. Never guess a number or a date.';
export const STAMP_PROMPT =
  'This is one construction drawing sheet from a UAE project. Look for an AUTHORITY APPROVAL STAMP ' +
  '(for example Dubai Municipality, Dubai Civil Defence, DEWA, Etisalat, du, RTA, Abu Dhabi or Sharjah authorities). ' +
  'A consultant\'s own "approved" note is not an authority stamp. ' +
  'Reply with ONE JSON object and nothing else: ' +
  '{"approved": true|false, "authority": "full name as on the stamp, or empty", "approval_no": "the approval / permit / ' +
  'reference number on the stamp, or empty", "approval_date": "YYYY-MM-DD, or empty", "date_as_printed": "", ' +
  '"drawing_number": "the DRAWING NO. printed in the title block, or empty", "drawing_title": "the DRAWING TITLE in the title block, or empty", ' +
  '"where": "where on the sheet the stamp is", "confidence": "high|medium|low"}. ' +
  'Always copy the stamp\'s date exactly as printed into date_as_printed. If it could be read two ways, leave approval_date empty.';

// "12/05/26", "12-05-2026", "12.5.2026" → 2026-05-12 (day, month, year).
export function dayFirst(printed) {
  const m = String(printed || '').match(/^\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})\s*$/);
  if (!m) return '';
  const d = +m[1], mo = +m[2], y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return '';
  return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

// "05/06/2026": the 5th of June or the 6th of May — both parts could be the month.
export function ambiguousDate(printed) {
  const m = String(printed || '').match(/^\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})\s*$/);
  return !!(m && +m[1] <= 12 && +m[2] <= 12 && +m[1] !== +m[2]);
}

// The AI's answer, parsed and checked. Anything not in the expected shape is dropped.
export function parseStamp(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  let j;
  try { j = JSON.parse(m[0]); } catch (e) { return null; }
  // A date printed "25/05/26" can only be day first. One printed "12/05/26"
  // could be either, so it is left for Document Control to type when they
  // confirm the reading — and so is the AI's own YYYY-MM-DD for it.
  const printed = String(j.date_as_printed || '');
  const amb = ambiguousDate(printed);
  let date = !amb && /^\d{4}-\d{2}-\d{2}$/.test(String(j.approval_date || '')) ? j.approval_date : '';
  if (!date && !amb) date = dayFirst(printed);
  return {
    approved: j.approved === true,
    authority_text: String(j.authority || '').slice(0, 80),
    authority: authorityCode(j.authority),
    approval_no: String(j.approval_no || '').replace(/[^A-Za-z0-9/._-]/g, '').slice(0, 60),
    approval_date: date,
    date_as_printed: String(j.date_as_printed || '').slice(0, 30),
    where: String(j.where || '').slice(0, 200),
    drawing_number: String(j.drawing_number || '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 60),
    drawing_title: String(j.drawing_title || '').trim().slice(0, 200),
    confidence: ['high', 'medium', 'low'].includes(j.confidence) ? j.confidence : 'low',
  };
}
