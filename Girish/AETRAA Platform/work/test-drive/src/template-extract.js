// READING A CONSULTANT'S FORM — which boxes are filled in, and what each is called.
//
// Every project's consultant sends their own forms, and they arrive as they
// were last used: the previous job's reference, subject and description still
// typed in, and no {{placeholders}} anywhere. Document Control should not have
// to edit the consultant's file to make it usable. So the form is read:
//
//   A LABEL is text that names something: "SUBJECT DESCRIPTION", "DATE:",
//   "LOCATION OF THE WORK/S". A VALUE is what was typed against it last time:
//   a reference, a date, a sentence. The box a label owns is the cell to its
//   right (the usual layout), or the cell under it when the label runs across
//   the form ("DESCRIPTION OF REQUIRED INFORMATION" over a large box).
//
//   Each label + box becomes a field. The ones the platform knows — reference
//   number, date, project, location, client, consultant, contractor — are
//   filled by the platform; the rest are what the person raising the document
//   is asked for, under the form's own label, in the form's own order.
//
//   Rows with NAME & SIGN are signature rows: no field is made there, and
//   whatever name was left in the signature box is cleared.
//   Pictures (logos) are kept. Notes ("*Approval shall not relieve…"), the
//   form's title and tick-box options are left as they are.
//
// Document Control sees what was found on the drawn form and can rename,
// remove or add a field before saving (src/html/templates.js).

import { readSheet, writeCells, colName, parseRef } from './template-preview.js';

const KNOWN = [
  // [label test, token, filled by the platform]
  [/\bref(erence)?\.?\s*no\b|\bref\.?\s*#|\bref\.?\s*number\b|request.*ref/i, 'ref', true],
  [/^\s*date\s*:?\s*$|^\s*date of (issue|submission)/i, 'date', true],
  [/project details|project name|^\s*project\s*:?\s*$/i, 'project_name', true],
  [/^\s*location\s*:?\s*$/i, 'location', true],
  [/^\s*client\s*:?\s*$|^\s*employer\s*:?\s*$/i, 'client', true],
  [/^\s*consultant\s*:?\s*$|^\s*engineer\s*:?\s*$/i, 'consultant', true],
  [/^\s*contractor\s*:?\s*$/i, 'contractor', true],
  [/subject/i, 'subject', false],
  [/location of (the )?work/i, 'location_of_works', false],
  [/description|required information|details of|work description/i, 'description', false],
  [/^\s*reference\s*:?\s*$/i, 'reference', false],
];

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const isSignText = (t) => /\bSIGN(ATURE)?\b/i.test(t);
const isNote = (t) => /^\s*\*/.test(t) || clean(t).length > 90;
// A tick-box option is typed with a run of spaces in front ("      APPROVED").
const isOption = (raw) => /^\s{3,}\S/.test(String(raw || '')) || /^\s*(yes|no|n\/a)\s*$/i.test(String(raw || ''));
// Text that names something rather than records it.
function labelLike(t, raw) {
  const s = clean(t);
  if (!s || s.length > 70 || isOption(raw)) return false;
  if (/^[\d.,/\-\s:]+$/.test(s)) return false;                         // a number or a date
  if (/\d/.test(s) && /[-/]/.test(s) && !/:$/.test(s)) return false;  // a reference
  if (/:\s*$/.test(s)) return true;
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (letters.length < 3) return false;
  return s.replace(/[^A-Z]/g, '').length / letters.length >= 0.8;
}
// A short, plain name in the form's left column is a label too ("Project Name", "Employer").
function leftLabel(t, raw, c, area) {
  const s = clean(t);
  return c <= area.c1 + 1 && s.length <= 45 && !/\d/.test(s) && !isOption(raw) && /[A-Za-z]{3}/.test(s);
}
const slug = (s) => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'field';
export const labelFor = (s) => {
  const t = clean(s).replace(/\s*:\s*$/, '').trim();
  return t.charAt(0) + t.slice(1).toLowerCase();
};
const AUTO = ['ref', 'date', 'project_name', 'location', 'client', 'consultant', 'contractor'];
// K9 (A6): the token a label is filed under, and whether the platform fills
// it — the same rule the extractor applies to the labels it finds.
export function tokenOf(label) {
  const text = clean(label);
  const k = KNOWN.find(([re]) => re.test(text));
  const token = k ? k[1] : slug(text);
  return { token, auto: AUTO.includes(token) };
}

export function extractFields(bytes) {
  const sheet = readSheet(bytes);
  if (sheet.error) return { error: sheet.error };
  const { cells, merges } = sheet;
  // A print area left over from somewhere else is not the form.
  const all = Object.keys(cells).filter((k) => clean(cells[k].text) || cells[k].pic).map((k) => k.split(':').map(Number));
  let area = sheet.area;
  const inside = all.filter(([r, c]) => r >= area.r1 && r <= area.r2 && c >= area.c1 && c <= area.c2).length;
  if (all.length && inside < all.length * 0.5) {
    area = { r1: 1, c1: 1, r2: Math.max(...all.map((x) => x[0])), c2: Math.min(40, Math.max(...all.map((x) => x[1]))) };
    sheet.area = area;
  }
  const at = (r, c) => cells[r + ':' + c] || null;
  const mergeAt = (r, c) => merges.find((g) => g.r1 === r && g.c1 === c) || null;
  const covered = (r, c) => merges.some((g) => r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2 && !(r === g.r1 && c === g.c1));
  const signRows = new Set();
  for (const k of Object.keys(cells)) if (isSignText(cells[k].text)) signRows.add(Number(k.split(':')[0]));
  const keys = Object.keys(cells).map((k) => k.split(':').map(Number))
    .filter(([r, c]) => r >= area.r1 && r <= area.r2 && c >= area.c1 && c <= area.c2)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const isLabel = (r, c) => {
    const x = at(r, c);
    if (!x || x.pic) return false;
    const t = clean(x.text);
    if (!t || /\{\{/.test(t) || isNote(t)) return false;
    if (labelLike(t, x.text) || leftLabel(t, x.text, c, area)) return true;
    if (KNOWN.some(([re]) => re.test(t)) && t.length <= 45) return true;
    // "Rev No", "MIR Submitted By": a short name on a row that is already a label row.
    // Never the box right beside a label (LOCATION: | Al Warqa First): that is its value.
    const left = merges.find((g) => r >= g.r1 && r <= g.r2 && c - 1 >= g.c1 && c - 1 <= g.c2);
    const lx = left ? at(left.r1, left.c1) : at(r, c - 1);
    if (lx && labelLike(clean(lx.text), lx.text)) return false;
    // Not the box right beside that label, which is its value.
    return t.length <= 45 && !/\d/.test(t) && !isOption(x.text) && keys.some(([rr, cc]) => {
      if (rr !== r || cc >= c || !leftLabel(clean(at(rr, cc).text), at(rr, cc).text, cc, area)) return false;
      const g = mergeAt(rr, cc);
      let nc = (g ? g.c2 : cc) + 1;
      while (covered(rr, nc)) nc++;
      return c > nc;
    });
  };
  // The consultant's part of the form (their response, approval, Part B) is not
  // filled in by whoever raises the document.
  let consultantFrom = Infinity;
  for (const [r, c] of keys) {
    const t = clean(at(r, c).text);
    if (/by the (engineer|consultant)|consultants?['\u2019]?s? +(response|approval|comment)|^for,? .*(consultant|engineer)/i.test(t)) { consultantFrom = Math.min(consultantFrom, r); }
  }
  const optionRows = new Set(keys.filter(([r, c]) => /^\s*(yes|no)\s*$/i.test(String(at(r, c).text || ''))).map(([r]) => r));
  // Tables (S.NO. / DESCRIPTION over numbered rows) are lists, not fields.
  const tableRows = new Set();
  for (const [r, c] of keys) {
    const t = clean(at(r, c).text);
    if (/^s\.?\s*no\.?$|^item$|^sr\.?\s*no\.?$/i.test(t)) {
      tableRows.add(r);
      for (let rr = r + 1; rr <= area.r2 && /^\d+$/.test(clean((at(rr, c) || {}).text)); rr++) tableRows.add(rr);
    }
  }
  const labels = keys.filter(([r, c]) => !signRows.has(r) && !tableRows.has(r) && !optionRows.has(r) && r < consultantFrom && isLabel(r, c));
  const labelSet = new Set(labels.map(([r, c]) => r + ':' + c));
  const used = new Set(), found = [];
  const take = (r, c, box) => {
    const k = box.r + ':' + box.c;
    if (used.has(k) || labelSet.has(k)) return false;
    used.add(k); found.push({ r, c, box }); return true;
  };
  const boxOK = (r, c) => {
    const x = at(r, c);
    if (!x) return r >= area.r1 && r <= area.r2 && c >= area.c1 && c <= area.c2;   // a blank box
    if (x.pic) return false;
    const t = clean(x.text);
    if (!t || /\{\{/.test(t)) return true;
    if (isOption(x.text) && !/\d/.test(t)) return false;          // a tick-box option, not a box
    return !labelLike(t, x.text);
  };
  // 1. The box to the right of each label.
  const done = new Set();
  for (const [r, c] of labels) {
    const g = mergeAt(r, c);
    let nc = (g ? g.c2 : c) + 1;
    while (nc <= area.c2 && covered(r, nc)) nc++;
    if (nc <= area.c2 && boxOK(r, nc) && take(r, c, { r, c: nc })) done.add(r + ':' + c);
  }
  // 2. The box under a label that runs across the form, or under a column header.
  for (const [r, c] of labels) {
    if (done.has(r + ':' + c)) continue;
    const g = mergeAt(r, c);
    const r2 = g ? g.r2 : r, wide = (g ? g.c2 - g.c1 + 1 : 1) >= Math.max(3, Math.floor((area.c2 - area.c1 + 1) * 0.6));
    const header = labels.filter(([rr]) => rr === r).length >= 2;
    if (!wide && !header) continue;
    const D = at(r2 + 1, c);
    const dt = clean(D && D.text);
    if (!D || D.pic || !dt || /^\d+$/.test(dt) || /^\s*\*/.test(dt) || !boxOK(r2 + 1, c)) continue;
    if (take(r, c, { r: r2 + 1, c })) done.add(r + ':' + c);
  }
  found.sort((a, b) => a.box.r - b.box.r || a.box.c - b.box.c);
  const fields = [], seen = {};
  for (const { r, c, box } of found) {
    const text = clean(at(r, c).text);
    const existing = /\{\{\s*([^{}]+?)\s*\}\}/.exec((at(box.r, box.c) || {}).text || '');
    const k = KNOWN.find(([re]) => re.test(text));
    let token = existing ? existing[1].trim() : (k ? k[1] : slug(text));
    let auto = AUTO.includes(token);
    if (seen[token] && ['contractor', 'consultant', 'client', 'project_name', 'ref'].includes(token) && !existing) continue;
    if (seen[token]) {                       // a second "Date" is not the document's date
      seen[token]++;
      if (!existing) { token = token + '_' + seen[token]; auto = false; }
    } else seen[token] = 1;
    const bm = mergeAt(box.r, box.c);
    const tall = bm ? bm.r2 - bm.r1 + 1 : 1;
    fields.push({ cell: colName(box.c) + box.r, label: labelFor(text), token, auto,
      long: tall >= 3 || (/description|details|information|remarks|comment/i.test(text) && !/subject|title/i.test(text)) });
  }
  // Whatever is left in a signature row from the last job.
  const clear = [];
  for (const [rr, cc] of keys) {
    if (!signRows.has(rr)) continue;
    const x = at(rr, cc), t = clean(x.text);
    if (t && !x.pic && !labelLike(t, x.text) && !leftLabel(t, x.text, cc, area) && !isSignText(t) && !/^\s*date\s*:?\s*$/i.test(t) && !/\(name of/i.test(t)) clear.push(colName(cc) + rr);
  }
  return { ok: true, fields, clear, sheet };
}

// The fillable form: each field's box carries its {{token}}, old names cleared.
export function prepareForm(bytes, fields, clear) {
  const put = {};
  for (const f of fields || []) if (parseRef(f.cell)) put[f.cell] = '{{' + f.token + '}}';
  for (const c of clear || []) if (!put[c]) put[c] = '';
  return writeCells(bytes, put);
}

// What the person raising the document is asked for, in the form's order.
export const inputFields = (fields) => (fields || []).filter((f) => !f.auto);

// Their answers, keyed by label on the record, read back by token for the form.
export function fieldValues(fields, data) {
  const out = {};
  const d = data || {};
  for (const f of fields || []) {
    if (f.auto) continue;
    if (d[f.label] !== undefined) out[f.token] = d[f.label];
  }
  return out;
}
