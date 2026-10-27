// K10 · v5 A2: THE CORRESPONDENCE REGISTER — every letter in and out, in one log.
//
//   1 DC drops the letter. The extraction program reads its text where there
//     is some and finds the records it names (RFI, VO, drawing numbers …), and
//     reads by rule what a letter states plainly (spec §6: "Our ref", the
//     subject line, the date, an email's headers). The AI reads the sender,
//     their reference, the date, subject, type, who must act, and writes a
//     two-line summary — filling only what the rules left empty.
//   2 DC edits and logs it (IN-00x, the typed path that already existed):
//     reply-by from the project's reply period; the action owner is told.
//   3 The action owner replies (a letter DC issues closes it) or closes it
//     with the reason.
//   Outgoing: every letter DC issues is logged and stored — one drafted here is
//   filed as issued; one signed outside the platform DC logs with its copy —
//   and closes the incoming letter it answers.
//
// What the AI must never do (v5 A2): log, route, reply or close a letter by
// itself. The reader writes only its own reading (letter_reads); logging is
// DC's, through the same route as a typed letter.
//
// Nothing linked is inferred (spec §6 "reply chains are proposed, never
// assumed", §29): the linked records are the references the letter states,
// that exist on this project. An Arabic letter is read and summarised in
// English by the AI, each value marked as translated for DC to check (Ajay,
// 6 Oct 2026, decision 4 — in place of §23 "detect, never translate"). An
// Outlook .msg is read like an .eml (msg.js; decision 15).

import { callModel, aiEnabled, AI_OFF_MESSAGE } from './ai.js';
import { parseMsg } from './msg.js';
import { pdfText, pdfPageLines } from './pdf-text.js';
import { probeDocx } from './intake-probe.js';
import { validNumber } from './sheet-reader.js';
import { putFile } from './storage.js';
import { dateOf, firstJson } from './ai-readers.js';
import { FUNCTIONS } from './functions.js';

export const LETTER_READER = 'a2-read-1', LETTER_PROMPT = 'a2-1';
const nowISO = () => new Date().toISOString();
const todayUAE = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clean = (s, n = 300) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const parse = (v, d) => { try { const j = JSON.parse(v || ''); return j == null ? d : j; } catch (e) { return d; } };
async function sha256Hex(u8) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', u8))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// The form's own lists (src/html/app.js FORMS.incoming).
export const LETTER_TYPES = ['Letter', 'Instruction', 'Notice', 'Email', 'Transmittal', 'Other'];
export const ACTION_ROLES = ['pm', 'commercial', 'design', 'planning', 'qaqc', 'hse', 'site', 'procurement', 'finance', 'dc', 'principal'];
export const actionLabels = () => ACTION_ROLES.map((f) => (FUNCTIONS[f] || {}).label || f).concat(['For information only']);
export const LETTER_FIELDS = ['From', 'Their reference', 'Letter date', 'Subject', 'Type', 'Action by', 'Summary'];

/* ------------------------------------------------------------ the text */

// An email saved as .eml: its headers say who, when and what, by rule.
const decodeWords = (s) => String(s || '').replace(/=\?([\w-]+)\?([BQ])\?([^?]*)\?=/gi, (m, cs, enc, txt) => {
  try {
    const bytes = enc.toUpperCase() === 'B' ? Uint8Array.from(atob(txt), (c) => c.charCodeAt(0))
      : Uint8Array.from(txt.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (x, h) => String.fromCharCode(parseInt(h, 16))), (c) => c.charCodeAt(0));
    return new TextDecoder(/utf-?8/i.test(cs) ? 'utf-8' : 'latin1').decode(bytes);
  } catch (e) { return txt; }
});
const qp = (s) => s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16)));
function headersOf(block) {
  const h = {};
  for (const line of block.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m && !(m[1].toLowerCase() in h)) h[m[1].toLowerCase()] = m[2];
  }
  return h;
}
export function parseEml(bytes) {
  const raw = new TextDecoder('utf-8').decode(bytes);
  const cut = raw.search(/\r?\n\r?\n/);
  if (cut < 0) return { headers: {}, text: '' };
  const h = headersOf(raw.slice(0, cut));
  let body = raw.slice(cut).replace(/^\r?\n\r?\n/, '');
  let type = h['content-type'] || 'text/plain', enc = (h['content-transfer-encoding'] || '').toLowerCase();
  const b = /boundary="?([^";]+)"?/i.exec(type);
  if (/multipart\//i.test(type) && b) {
    const parts = body.split('--' + b[1]).map((p) => p.replace(/^\r?\n/, ''));
    let pick = null;
    for (const p of parts) {
      const c2 = p.search(/\r?\n\r?\n/);
      if (c2 < 0) continue;
      const ph = headersOf(p.slice(0, c2));
      const pt = ph['content-type'] || 'text/plain';
      if (/text\/plain/i.test(pt) || (!pick && /text\/html/i.test(pt))) {
        pick = { h: ph, body: p.slice(c2).replace(/^\r?\n\r?\n/, '') };
        if (/text\/plain/i.test(pt)) break;
      }
    }
    if (pick) { body = pick.body; type = pick.h['content-type'] || 'text/plain'; enc = (pick.h['content-transfer-encoding'] || '').toLowerCase(); }
  }
  if (enc === 'base64') { try { body = new TextDecoder('utf-8').decode(Uint8Array.from(atob(body.replace(/\s+/g, '')), (c) => c.charCodeAt(0))); } catch (e) { /* as it is */ } }
  else if (enc === 'quoted-printable') body = qp(body);
  if (/text\/html/i.test(type)) body = body.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<br\s*\/?>|<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  return { headers: { from: decodeWords(h.from), to: decodeWords(h.to), date: h.date || '', subject: decodeWords(h.subject) }, text: body.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() };
}

const kindOf = (filename) => {
  const e = (String(filename || '').toLowerCase().match(/\.([a-z0-9]{1,5})$/) || [])[1] || '';
  return { pdf: 'pdf', docx: 'docx', eml: 'eml', msg: 'msg', txt: 'txt', png: 'png', jpg: 'jpeg', jpeg: 'jpeg' }[e] || '';
};

// The letter's own words, where it has some. Deterministic.
//   → { format, text, headers?, scan: bool, why? }
export async function letterText(bytes, filename) {
  const k = kindOf(filename);
  if (!k) return { format: '', text: '', scan: false, why: 'not a letter the platform reads (PDF, Word, .eml, text or a scan as PDF, PNG or JPEG)' };
  if (k === 'msg') {
    // Decision 15: read like an .eml (msg.js). One that cannot be opened is kept, as before.
    try { const m = parseMsg(bytes); return { format: 'msg', text: m.text.slice(0, 40000), headers: m.headers, scan: false }; }
    catch (e) { return { format: 'msg', text: '', scan: false, why: 'this Outlook .msg could not be opened (' + String(e && e.message || e) + ') — it is kept; save the email as .eml or PDF to have it read' }; }
  }
  if (k === 'png' || k === 'jpeg') return { format: k, text: '', scan: true };
  if (k === 'eml') { const e = parseEml(bytes); return { format: 'eml', text: e.text.slice(0, 40000), headers: e.headers, scan: false }; }
  if (k === 'docx') return { format: 'docx', text: probeDocx(bytes).text || '', scan: false };
  if (k === 'txt') return { format: 'txt', text: new TextDecoder('utf-8').decode(bytes).slice(0, 40000), scan: false };
  const t = await pdfLines(bytes, 6);
  return { format: 'pdf', text: t, scan: t.replace(/\s+/g, '').length < 40 };
}

// A PDF letter's words, line by line (pdf-text.js pdfPageLines) — so "Our
// Ref:" and "Date:" on their own lines stay apart.
async function pdfLines(bytes, maxPages) {
  const pages = await pdfPageLines(bytes, { pages: maxPages });
  return pages.length ? pages.join('\n').trim() : pdfText(bytes, { pages: maxPages });
}

/* ------------------------------------------------------------ what it states, by rule */

// Spec §23: an Arabic letter is detected and filed, not read.
export function isArabic(text) {
  const s = String(text || '');
  const ar = (s.match(/[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g) || []).length;
  const lat = (s.match(/[A-Za-z]/g) || []).length;
  return ar >= 20 && ar >= lat * 0.5;
}

// The records a letter names — every one, sorted. A record reference is its
// prefix and number ("RFI-042", "RFI 42", "VO-05"); a drawing number has the
// register's own shape and no record prefix.
export const RECORD_PREFIXES = ['RFI', 'VO', 'SUB', 'MAR', 'MS', 'NCR', 'WIR', 'MIR', 'IN', 'LTR', 'CVI', 'AUTH', 'IPC', 'PTW'];
const REC_RE = new RegExp('\\b(' + RECORD_PREFIXES.join('|') + ')[-\\s.]?(?:NO\\.?\\s*)?(\\d{1,5})\\b', 'g');
export function findReferences(text) {
  const s = String(text || '').toUpperCase();
  const recs = new Map(), drawings = new Set();
  for (const m of s.matchAll(REC_RE)) recs.set(m[1] + '-' + Number(m[2]), { prefix: m[1], no: Number(m[2]), as_written: m[0] });
  for (const m of s.matchAll(/\b[A-Z]{1,4}\d{0,2}-\d{2,5}[A-Z]?\b/g)) {
    const n = m[0];
    const pre = (n.match(/^[A-Z]+/) || [''])[0];
    if (RECORD_PREFIXES.includes(pre)) continue;
    if (validNumber(n)) drawings.add(n);
  }
  return { records: [...recs.entries()].sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true })).map(([k, v]) => ({ key: k, ...v })),
    drawings: [...drawings].sort() };
}
// Which of them are on this project: a record by prefix and number, a drawing
// by its number in the register. The rest are listed, never linked.
export async function matchReferences(env, pid, found) {
  const linked = [], unmatched = [];
  if (found.records.length) {
    const { results } = await env.DB.prepare('SELECT ref, type, title, no FROM records WHERE project_id = ?').bind(pid).all();
    const by = new Map();
    for (const r of results || []) {
      const m = String(r.ref || '').match(/^([A-Z]+)-0*(\d+)$/);
      if (m) by.set(m[1] + '-' + Number(m[2]), r);
    }
    for (const f of found.records) {
      const hit = by.get(f.key);
      if (hit) linked.push({ ref: hit.ref, kind: 'record', type: hit.type, title: hit.title });
      else unmatched.push({ ref: f.as_written.replace(/\s+/g, ' '), kind: 'record' });
    }
  }
  if (found.drawings.length) {
    let have = new Set();
    try {
      const { results } = await env.DB.prepare('SELECT DISTINCT number FROM drawings WHERE project_id = ?').bind(pid).all();
      have = new Set((results || []).map((x) => String(x.number || '').toUpperCase()));
    } catch (e) { have = new Set(); }
    for (const n of found.drawings) (have.has(n) ? linked : unmatched).push({ ref: n, kind: 'drawing' });
  }
  return { linked, unmatched };
}

// What a letter states plainly, read by rule (spec §6).
export function ruleFields(text, headers) {
  const out = {};
  const h = headers || {};
  if (h.from) out.From = clean(h.from.replace(/<[^>]+>/, '').replace(/"/g, ''), 160) || clean(h.from, 160);
  if (h.subject) out.Subject = clean(h.subject.replace(/^(re|fw|fwd)\s*:\s*/i, ''), 200);
  if (h.date) { const m = h.date.match(/(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})/); if (m) { const d = dateOf(m[1] + ' ' + m[2] + ' ' + m[3]); if (d.iso && !d.blocks) out['Letter date'] = d.iso; } }
  const t = String(text || '');
  const ref = t.match(/\b(?:our\s+ref(?:erence)?|ref(?:erence)?\s*(?:no\.?|number|#)?)\s*[:.\-]\s*([A-Z0-9][A-Z0-9/\-_.]{1,40})/i);
  if (ref && !/^your\b/i.test(ref[0])) out['Their reference'] = clean(ref[1], 60).replace(/[.,;]+$/, '');
  if (!out.Subject) { const s = t.match(/(?:^|\n)\s*(?:subject|re)\s*[:.\-]\s*([^\n]{3,200})/i); if (s) out.Subject = clean(s[1], 200); }
  if (!out['Letter date']) {
    const dl = t.match(/(?:^|\n)\s*date[d]?\s*[:.\-]\s*([^\n]{6,30})/i);
    if (dl) { const d = dateOf(dl[1].replace(/[,.]$/, '')); if (d.iso && !d.blocks) out['Letter date'] = d.iso; }
  }
  if (/\bemail\b|^from:/i.test(t.slice(0, 200)) || h.from) out.Type = 'Email';
  return out;
}

/* ------------------------------------------------------------ the AI's reading */

const LETTER_SYSTEM = 'You read a letter, instruction or email that a construction contractor received, for the contractor\'s '
  + 'document controller, who checks every value before the letter is logged. Copy what is written; never guess a reference '
  + 'or a date; never convert or reorder a date. You never log, route, reply to or close a letter. Answer with JSON only.';
// Ajay, 6 Oct 2026 (decision 4): an Arabic letter is read and summarised too.
// The fields come back in English (a faithful translation, marked as such),
// the Arabic subject is kept as written, references and dates are copied.
const ARABIC_NOTE = 'The letter is written in Arabic. Give subject and summary in English, translated faithfully, and give subject_original: the subject exactly as written in Arabic. '
  + 'Copy references exactly as written. Give the date exactly as written; if it is a Hijri date, say so in date_calendar ("hijri"), otherwise "gregorian".\n';
export function letterPrompt(arabic) {
  return (arabic ? ARABIC_NOTE : '') + 'Read this incoming letter and give:\n'
    + '- from: who sent it (organisation, and the person if signed)\n'
    + '- their_ref: the sender\'s own reference for this letter, as written, or ""\n'
    + '- letter_date: the date of the letter, exactly as written\n'
    + '- subject: the subject line, or a short subject if there is none\n'
    + '- type: one of ' + LETTER_TYPES.join(', ') + '\n'
    + '- action_by: who at the contractor must act, one of: ' + actionLabels().join(', ') + '\n'
    + '- summary: two short lines in plain words of what the letter says and asks for — only what it says\n'
    + '- language: "en", "ar" or another code — the language the letter is written in\n'
    + '- sure: for each of from, their_ref, letter_date, subject: "high", "medium" or "low"\n'
    + 'Answer with JSON only, in exactly this shape:\n'
    + '{"from":"","their_ref":"","letter_date":"","subject":"","type":"","action_by":"","summary":"","language":"en","sure":{"from":"low","their_ref":"low","letter_date":"low","subject":"low"}'
    + (arabic ? ',"subject_original":"","date_calendar":"gregorian"' : '') + '}';
}
export function parseLetter(text) {
  const j = firstJson(text);
  if (!j || typeof j !== 'object') return null;
  const sure = j.sure && typeof j.sure === 'object' ? j.sure : {};
  const S = (v) => (['high', 'medium', 'low'].includes(String(v || '').toLowerCase()) ? String(v).toLowerCase() : 'low');
  return { from: clean(j.from, 160), their_ref: clean(j.their_ref, 60), letter_date: clean(j.letter_date, 40), subject: clean(j.subject, 200),
    type: clean(j.type, 30), action_by: clean(j.action_by, 60), summary: clean(j.summary, 400), language: clean(j.language, 8).toLowerCase() || 'en',
    ...(j.subject_original ? { subject_original: clean(j.subject_original, 200) } : {}),
    ...(j.date_calendar ? { date_calendar: clean(j.date_calendar, 12).toLowerCase() } : {}),
    sure: { from: S(sure.from), their_ref: S(sure.their_ref), letter_date: S(sure.letter_date), subject: S(sure.subject) } };
}

// The draft: what the rules read, and what the AI filled in only where they
// read nothing. A differing AI value is shown, never used.
// Arabic-Indic and Persian digits to 0-9, by rule (٢٠٢٦/٠٣/١٤ → 2026/03/14).
export const westernDigits = (s) => String(s || '').replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06F0));
export function draftOf(rule, ai, arabic) {
  const draft = {};
  if (ai && arabic) ai = { ...ai, their_ref: westernDigits(ai.their_ref), letter_date: ai.date_calendar === 'hijri' ? '' : westernDigits(ai.letter_date) };
  const aiOf = ai ? { From: [ai.from, ai.sure.from], 'Their reference': [ai.their_ref, ai.sure.their_ref], 'Letter date': [ai.letter_date, ai.sure.letter_date],
    Subject: [ai.subject, ai.sure.subject], Type: [ai.type, 'medium'], 'Action by': [ai.action_by, 'medium'], Summary: [ai.summary, 'medium'] } : {};
  for (const f of LETTER_FIELDS) {
    const r = rule[f];
    let [v, sure] = aiOf[f] || ['', ''];
    const flags = [];
    if (v && f === 'Letter date') { const d = dateOf(v); if (d.blocks) { flags.push(d.why); v = ''; } else v = d.iso; }
    if (v && f === 'Type' && !LETTER_TYPES.includes(v)) { flags.push('“' + v + '” is not one of the form’s types'); v = ''; }
    if (v && f === 'Action by' && !actionLabels().some((x) => x.toLowerCase() === v.toLowerCase())) { flags.push('“' + v + '” is not a role on this platform'); v = ''; }
    if (v && f === 'Action by') v = actionLabels().find((x) => x.toLowerCase() === v.toLowerCase());
    if (r) {
      draft[f] = { value: r, source: 'rule', ...(v && String(v).toUpperCase() !== String(r).toUpperCase() ? { ai: v, flags: flags.concat(['the AI read “' + v + '”; the value read by rule is kept']) } : flags.length ? { flags } : {}) };
    } else if (v) {
      if (arabic && ['From', 'Subject', 'Summary'].includes(f)) flags.push('translated from Arabic by AI — check it against the letter');
      if (arabic && f === 'Subject' && ai.subject_original) flags.push('as written: “' + ai.subject_original + '”');
      draft[f] = { value: v, source: 'ai', sure, ...(flags.length ? { flags } : {}) };
    }
    else draft[f] = { value: '', source: '', ...(flags.length ? { flags } : {}) };
  }
  // A Hijri date is not converted by the AI or by rule: the person types it.
  if (ai && arabic && ai.date_calendar === 'hijri') draft['Letter date'] = { ...draft['Letter date'], flags: ((draft['Letter date'] || {}).flags || []).concat(['dated in the Hijri calendar — type the Gregorian date']) };
  return draft;
}

/* ------------------------------------------------------------ the reading, kept */

let ready = false;
export async function ensureLetterReads(env) {
  if (ready) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS letter_reads (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, sha256 TEXT, reader TEXT, filename TEXT, file_key TEXT,
         format TEXT, language TEXT, refs TEXT, rule TEXT, ai TEXT, model TEXT, draft TEXT, why TEXT,
         state TEXT, logged_ref TEXT, logged_from TEXT, by TEXT, at TEXT, logged_by TEXT, logged_at TEXT)`
    ).run();
    ready = true;
    return true;
  } catch (e) { return false; }
}
export async function getLetterRead(env, pid, id) {
  await ensureLetterReads(env);
  const r = await env.DB.prepare('SELECT * FROM letter_reads WHERE project_id = ? AND id = ?').bind(pid, String(id || '')).first();
  if (!r) return null;
  return { id: r.id, filename: r.filename, sha256: r.sha256, reader: r.reader, format: r.format, language: r.language, file_key: r.file_key,
    refs: parse(r.refs, { linked: [], unmatched: [] }), rule: parse(r.rule, {}), ai: parse(r.ai, null), model: r.model || null,
    draft: parse(r.draft, {}), why: r.why || '', state: r.state, logged_ref: r.logged_ref || null, logged_from: parse(r.logged_from, null),
    by: r.by, at: r.at, logged_by: r.logged_by, logged_at: r.logged_at };
}

// Step 1: read the dropped letter. Keeps the file and the reading; logs
// nothing, routes nothing, notifies nobody. The same file dropped again is the
// reading already kept (and says if it was logged).
//   ctx: { who, useAi (the project's AI module on) }
export async function readLetter(env, pid, input, ctx) {
  await ensureLetterReads(env);
  const bytes = new Uint8Array(input.bytes || []);
  if (!bytes.length) return { error: 'that file is empty' };
  if (bytes.length > 25 * 1024 * 1024) return { error: 'that letter is larger than 25 MB' };
  const sha = await sha256Hex(bytes);
  const same = await env.DB.prepare('SELECT id FROM letter_reads WHERE project_id = ? AND sha256 = ? ORDER BY at DESC').bind(pid, sha).first().catch(() => null);
  if (same) {
    const r = await getLetterRead(env, pid, same.id);
    return { ...r, kept: true, ...(r.logged_ref ? { already: 'This letter was logged as ' + r.logged_ref + '.' } : {}) };
  }
  const t = await letterText(bytes, input.filename);
  if (!t.format) return { error: 'That is ' + t.why + '.' };
  const arabic = isArabic(t.text);
  const found = findReferences(t.text);
  const refs = await matchReferences(env, pid, found);
  const rule = arabic ? {} : ruleFields(t.text, t.headers);
  // The AI: where it is on, and the letter is not Arabic (§23). A letter with
  // text is sent as text; a scan as the file (a PDF page or a picture).
  let ai = null, model = null, why = t.why || '';
  const can = aiEnabled(env) && ctx.useAi !== false;
  if (arabic && !can) why = 'an Arabic letter: AI is not switched on, so type its details';
  else if (!can) why = why || (aiEnabled(env) ? 'AI is not switched on for this project — type the details' : AI_OFF_MESSAGE);
  else if (t.format !== 'msg' || t.text) {
    const docs = t.scan ? [{ bytes, media_type: t.format === 'pdf' ? 'application/pdf' : t.format === 'png' ? 'image/png' : 'image/jpeg' }] : [];
    const ans = await callModel(env, { task: 'a2-letter', system: LETTER_SYSTEM,
      prompt: (t.scan ? '' : 'The letter:\n"""\n' + t.text.slice(0, 16000) + '\n"""\n\n') + letterPrompt(arabic),
      documents: docs, max_tokens: 900, temperature: 0, project_id: pid, who: ctx.who });
    if (ans.error) why = 'the AI could not read it (' + ans.error + ') — type the details';
    else {
      ai = parseLetter(ans.text);
      model = ans.model;
      if (!ai) why = 'the AI’s answer could not be read — type the details';
      else if (!arabic && /^ar/.test(ai.language || '')) {
        // A scan the rules could not see was Arabic: read again with the Arabic instructions.
        const again = await callModel(env, { task: 'a2-letter', system: LETTER_SYSTEM, prompt: letterPrompt(true), documents: docs, max_tokens: 900, temperature: 0, project_id: pid, who: ctx.who });
        ai = again.error ? null : parseLetter(again.text);
        if (!ai) why = 'an Arabic letter the AI could not read — type its details';
      }
      if (ai && (arabic || /^ar/.test(ai.language || ''))) why = 'an Arabic letter, read and summarised in English by AI — check each value against the letter';
    }
  }
  const isAr = arabic || !!(ai && /^ar/.test(ai.language || ''));
  const draft = draftOf(rule, ai, isAr);
  const id = uid('lr_');
  const ext = (String(input.filename || '').match(/\.([a-z0-9]{1,5})$/i) || [])[1] || 'bin';
  const put = await putFile(env, 'letters/' + pid + '/' + id + '.' + ext.toLowerCase(), bytes, 'application/octet-stream');
  await env.DB.prepare(`INSERT INTO letter_reads (id, project_id, sha256, reader, filename, file_key, format, language, refs, rule, ai, model, draft, why, state, by, at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, pid, sha, LETTER_READER, clean(input.filename, 200), put && put.ok ? put.key : null, t.format, isAr ? 'ar' : (ai && ai.language) || '',
      JSON.stringify(refs), JSON.stringify(rule), ai ? JSON.stringify(ai) : null, model, JSON.stringify(draft), why, 'read', clean(ctx.who, 120), nowISO()).run();
  return getLetterRead(env, pid, id);
}

// Step 2's record: which value DC kept as read (by rule or by AI) and which
// they typed or changed — "read by AI, confirmed by …".
export function provenanceOf(read, data) {
  const out = {};
  for (const f of LETTER_FIELDS) {
    const v = clean(data && data[f]);
    if (!v) continue;
    const d = read.draft[f] || {};
    const same = d.value && clean(d.value).toUpperCase() === v.toUpperCase();
    out[f] = same ? d.source || 'typed' : 'typed';
  }
  return out;
}
export async function markLogged(env, pid, id, ref, from, who) {
  await env.DB.prepare("UPDATE letter_reads SET state = 'logged', logged_ref = ?, logged_from = ?, logged_by = ?, logged_at = ? WHERE project_id = ? AND id = ?")
    .bind(ref, JSON.stringify(from), clean(who, 120), nowISO(), pid, String(id)).run();
}

/* ------------------------------------------------------------ the register */

const isoDay = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).slice(0, 10) : '');
const issuedOn = (r) => {
  const wf = parse(r.workflow, []);
  const i = wf.findIndex((s) => s && s.issue);
  if (i >= 0 && (r.step || 0) >= i && wf[i].state === 'done') return isoDay(wf[i].when) || isoDay((String(r.status || '').match(/\d{4}-\d{2}-\d{2}/) || [])[0]);
  return '';
};

// One register for both directions — Ref, In/Out, Date, From / To, Their
// ref, Subject, Action by, Reply-by, Answered by, Status — overdue first.
//   Date        incoming: received (the reply clock runs from it); outgoing: issued
//   Their ref   incoming: the sender's own reference; outgoing: the reference of
//               the letter it answers
//   Action by   incoming: the role that must act (or "For information")
//   Reply-by    incoming, while open
//   Answered by incoming: the letter(s) that answered it, or "closed — <why>"
export async function correspondenceRegister(env, pid, today = todayUAE()) {
  const { results } = await env.DB.prepare(
    "SELECT ref, type, title, status, data, due, submitted, created_at, workflow, step, imported, original_date FROM records WHERE project_id = ? AND type IN ('incoming', 'letter', 'cvi')"
  ).bind(pid).all().catch(() => ({ results: [] }));
  const rows = results || [];
  const byRef = new Map(rows.map((r) => [r.ref, r]));
  const answered = {};
  for (const r of rows) {
    if (r.type === 'incoming') continue;
    const d = parse(r.data, {});
    const on = issuedOn(r);
    if (!on) continue;
    for (const x of String(d['In reply to'] || '').split(/[\s,;/]+/).filter((y) => /^IN-\d+$/i.test(y))) (answered[x.toUpperCase()] || (answered[x.toUpperCase()] = [])).push(r.ref);
  }
  const out = rows.map((r) => {
    const d = parse(r.data, {});
    const wf = parse(r.workflow, []);
    const open = (r.step || 0) < wf.length - 1 && !Number(r.imported);
    if (r.type === 'incoming') {
      const info = /for information/i.test(r.status || '') || /information/i.test(String(d['Action by'] || ''));
      const closedWhy = /^Closed/i.test(r.status || '') ? String(r.status).replace(/^Closed\s*—\s*/, 'closed — ') : '';
      const overdue = open && !!r.due && r.due < today;
      return { ref: r.ref, dir: 'In', date: isoDay(d['Date received']) || isoDay(r.submitted) || isoDay(r.original_date), from_to: clean(d.From, 160),
        their_ref: clean(d['Their reference'], 60), subject: r.title || clean(d.Subject, 200), action_by: info ? 'For information' : clean(d['Action by'], 60) || ((wf[1] || {}).who || ''),
        reply_by: open ? r.due || '' : '', answered_by: (answered[r.ref] || []).join(', ') || closedWhy, status: Number(r.imported) ? 'Imported — ' + (r.status || '') : r.status || '',
        overdue, days_late: overdue ? Math.round((Date.parse(today) - Date.parse(r.due)) / 86400000) : 0, open, imported: !!Number(r.imported),
        summary: clean(d.Summary, 400), linked: clean(d['Linked records'], 400) };
    }
    const ins = String(d['In reply to'] || '').split(/[\s,;/]+/).filter((y) => /^IN-\d+$/i.test(y)).map((y) => y.toUpperCase());
    const theirs = ins.map((x) => clean(parse((byRef.get(x) || {}).data, {})['Their reference'], 60)).filter(Boolean);
    return { ref: r.ref, dir: 'Out', date: issuedOn(r) || isoDay(d['Issued on']) || isoDay(r.original_date) || '', from_to: clean(d.To || (r.type === 'cvi' ? 'Consultant' : ''), 160),
      their_ref: theirs.join(', '), subject: r.title || clean(d.Subject, 200), action_by: '', reply_by: '', answered_by: '',
      status: Number(r.imported) ? 'Imported — ' + (r.status || '') : r.status || '', overdue: false, days_late: 0, open, imported: !!Number(r.imported),
      in_reply_to: ins.join(', '), summary: '', linked: '' };
  });
  out.sort((a, b) => (b.overdue - a.overdue) || (a.overdue && b.overdue ? String(a.reply_by).localeCompare(String(b.reply_by)) : 0)
    || String(b.date || '').localeCompare(String(a.date || '')) || String(b.ref).localeCompare(String(a.ref), 'en', { numeric: true }));
  return out;
}

/* ------------------------------------------------------------ outgoing */

// A letter signed and sent outside the platform, logged by Document Control
// with its signed copy: an LTR record already issued, closing the incoming
// letters it answers. Checks only; the route writes it.
export function checkOutgoing(b, today = todayUAE()) {
  const to = clean(b.to, 160), subject = clean(b.subject, 200), issued = String(b.issued_on || '').slice(0, 10);
  if (!to) return { error: 'Say who the letter went to.' };
  if (!subject) return { error: 'Give the letter’s subject.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issued)) return { error: 'Enter the date it was issued.' };
  if (issued > today) return { error: 'The date it was issued cannot be in the future.' };
  if (!b.file || !b.file.bytes || !b.file.bytes.length) return { error: 'Attach the signed copy — every letter DC issues is stored.' };
  return { to, subject, issued, our_ref: clean(b.our_ref, 60), type: LETTER_TYPES.includes(b.type) ? b.type : 'Letter', signed_by: clean(b.signed_by, 120) };
}

// The letter as issued, when it was drafted here and there is no letter
// template to fill: a plain PDF of what was issued, kept on the record.
export async function letterPdf(rec, project) {
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const pdf = await PDFDocument.create({ updateMetadata: false });
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const safe = (s) => String(s == null ? '' : s).replace(/[^\x20-\x7E -ÿ\n]/g, '?');
  let page = pdf.addPage([595, 842]), y = 790;
  const line = (txt, f = font, size = 10.5) => {
    for (const para of safe(txt).split('\n')) {
      let cur = '';
      for (const w of para.split(' ')) {
        const tryL = cur ? cur + ' ' + w : w;
        if (f.widthOfTextAtSize(tryL, size) > 495) { page.drawText(cur, { x: 50, y, size, font: f }); y -= size + 5; cur = w; if (y < 60) { page = pdf.addPage([595, 842]); y = 790; } }
        else cur = tryL;
      }
      page.drawText(cur, { x: 50, y, size, font: f }); y -= size + 5;
      if (y < 60) { page = pdf.addPage([595, 842]); y = 790; }
    }
  };
  const d = rec.data || {};
  line((project && project.name ? project.name : '') + (project && project.ref ? '  ·  ' + project.ref : ''), bold, 12);
  y -= 6;
  line('Ref: ' + rec.ref + '      Issued: ' + (issuedOn({ workflow: JSON.stringify(rec.workflow || []), step: rec.step, status: rec.status }) || todayUAE()));
  if (d.To) line('To: ' + d.To);
  if (d['In reply to']) line('In reply to: ' + d['In reply to']);
  line('Subject: ' + (d.Subject || rec.title || ''), bold);
  y -= 6;
  for (const [k, v] of Object.entries(d)) {
    if (['Subject', 'To', 'In reply to', 'Type'].includes(k) || v == null || v === '' || typeof v === 'object') continue;
    line(k === 'Body' ? String(v) : k + ': ' + v);
  }
  y -= 10;
  for (const s of rec.workflow || []) if (s && s.state === 'done') line(s.st + ' — ' + (s.who || '') + (s.when ? ', ' + String(s.when).slice(0, 16).replace('T', ' ') : ''), font, 9);
  return new Uint8Array(await pdf.save({ useObjectStreams: false }));
}
