// K9 · v5 A1, A3, A6: THE AI READERS. The model reads; a person commits.
//
//   A1  a scanned drawing sheet: number, revision, title, date and discipline
//       off its title-block corner, each with how sure. DC confirms or
//       corrects each value; the PM approves the sheet into the register.
//   A3  a consultant's reply that came back scanned or stamped (S0 step 5):
//       the code, each comment as its own line with its drawing or clause and
//       discipline, the reply date. DC confirms with one click (S0 step 6).
//       An Excel or Word return is read by E14 instead (s0.js).
//   A6  a consultant's form E10/E16 found fewer than two fields on: fields and
//       signature boxes proposed on the drawn form; DC reviews and saves.
//
// What none of them ever does (v5, "AI must never"):
//   A1  overwrite a value read by rule; approve a drawing
//   A3  close or reject a record by itself; apply a code DC has not confirmed
//   A6  change a form the extractor already read
//
// So each reader only PROPOSES. A proposal is kept on its own (ai_proposals),
// apart from every value read by rule, with the model that made it and what
// was sent (§27 rule 9): nothing in a register, record or template changes
// until the person's confirmation arrives at the route that applies it, and
// that route re-checks the proposal itself rather than trusting the page.
//
// The checks around the model are deterministic (the E-programs' rules): the
// number's pattern and the project's numbering, the revision order, the
// reference matching the record, dates read as K6 reads them — a date that
// reads two ways is put to the person, never resolved (§18).
//
// Calls go only through src/ai.js (callModel), which logs each one with its
// cost. With AI switched off every reader says so and writes nothing.

import { callModel, aiEnabled, AI_OFF_MESSAGE } from './ai.js';
import { readDate } from './past-registers.js';
import { putFile } from './storage.js';
import { titleBlockCorner } from './sheet-corner.js';
import { checkIncoming, identityMismatches } from './gate.js';
import { codeOf, baseRef } from './s0.js';
import { parseRef, colName } from './template-preview.js';
import { tokenOf } from './template-extract.js';

export const A1_PROMPT = 'a1-1', A3_PROMPT = 'a3-1', A6_PROMPT = 'a6-1';
const nowISO = () => new Date().toISOString();
const todayUAE = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clean = (s, n = 300) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const parse = (v, d) => { try { const j = JSON.parse(v || ''); return j == null ? d : j; } catch (e) { return d; } };
async function sha256Hex(u8) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', u8))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ------------------------------------------------------------ the store */

let ready = false;
export async function ensureAiProposals(env) {
  if (ready) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS ai_proposals (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, reader TEXT, target_kind TEXT, target_id TEXT,
         model TEXT, provider TEXT, prompt TEXT, sent_sha TEXT, sent_key TEXT, sent_what TEXT,
         proposal TEXT, state TEXT, by TEXT, at TEXT, decided_by TEXT, decided_at TEXT, applied TEXT)`
    ).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_ai_proposals ON ai_proposals(project_id, target_kind, target_id)').run();
    ready = true;
    return true;
  } catch (e) { return false; }
}
async function keep(env, row) {
  await ensureAiProposals(env);
  const id = uid('aip_');
  await env.DB.prepare(`INSERT INTO ai_proposals (id, project_id, reader, target_kind, target_id, model, provider, prompt,
      sent_sha, sent_key, sent_what, proposal, state, by, at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(row.id || id, row.project_id, row.reader, row.target_kind, String(row.target_id), row.model || '', row.provider || '', row.prompt,
      row.sent_sha || null, row.sent_key || null, row.sent_what || '', JSON.stringify(row.proposal), 'proposed', clean(row.by, 120), nowISO()).run();
  return row.id || id;
}
export async function getProposal(env, pid, id) {
  await ensureAiProposals(env);
  const r = await env.DB.prepare('SELECT * FROM ai_proposals WHERE project_id = ? AND id = ?').bind(pid, String(id || '')).first();
  return r ? { ...r, proposal: parse(r.proposal, {}), applied: parse(r.applied, null) } : null;
}
export async function latestProposal(env, pid, kind, targetId) {
  await ensureAiProposals(env);
  const r = await env.DB.prepare("SELECT id FROM ai_proposals WHERE project_id = ? AND target_kind = ? AND target_id = ? ORDER BY at DESC").bind(pid, kind, String(targetId)).first();
  return r ? getProposal(env, pid, r.id) : null;
}
export async function decide(env, pid, id, who, applied, state = 'confirmed') {
  await env.DB.prepare('UPDATE ai_proposals SET state = ?, decided_by = ?, decided_at = ?, applied = ? WHERE project_id = ? AND id = ?')
    .bind(state, clean(who, 120), nowISO(), JSON.stringify(applied), pid, String(id)).run();
}

// The model's answer is JSON, perhaps fenced, perhaps with a sentence around it.
export function firstJson(text) {
  const s = String(text || '').replace(/```(?:json)?/gi, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
}
const SURE = (v) => {
  if (typeof v === 'number') return v >= 0.8 ? 'high' : v >= 0.5 ? 'medium' : 'low';
  const s = String(v || '').toLowerCase();
  return ['high', 'medium', 'low'].includes(s) ? s : 'low';
};

// A date as a person wrote it, read as K6 reads dates; "March 14, 2026" too.
// Never resolved by guessing which way round (§18): two readings are reported.
export function dateOf(raw, today = todayUAE()) {
  let s = clean(raw, 40);
  if (!s) return {};
  const m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/);
  if (m) s = m[2] + ' ' + m[1] + ' ' + m[3];
  s = s.replace(/^(\d{1,2})(?:st|nd|rd|th)\b/i, '$1');
  const d = readDate(s);
  if (d.both) return { raw: s, why: 'reads as ' + d.both[0] + ' or ' + d.both[1] + ' — say which', blocks: true };
  if (!d.date) return { raw: s, why: '“' + s + '” could not be read as a date — type it', blocks: true };
  if (d.date > today) return { raw: s, iso: d.date, why: d.date + ' is after today', blocks: true };
  if (d.date < '1990-01-01') return { raw: s, iso: d.date, why: d.date + ' is too early to be right', blocks: true };
  return { raw: s, iso: d.date };
}

/* ------------------------------------------------------------ A1: a scanned sheet */

export const SHEET_FIELDS = ['number', 'revision', 'title', 'date', 'discipline'];
const SHEET_SYSTEM = 'You read the title block of a construction drawing sheet for a document controller, who checks '
  + 'every value you give before it is used. Copy exactly what is printed. Never guess, never complete a value that is '
  + 'not legible, never convert or reorder a date. Answer with JSON only.';
const SHEET_PROMPT = 'This image is the title-block corner of one scanned drawing sheet. Read six values from it:\n'
  + '- number: the drawing number (for example A1-101, S-201, AETR-ARC-DR-1001)\n'
  + '- revision: the sheet\'s current revision as printed in its revision box (for example C, P2, 03)\n'
  + '- title: the drawing title\n'
  + '- date: the date of the sheet or of its current revision, exactly as written — do not convert it\n'
  + '- discipline: the discipline (Architectural, Structural, Mechanical, Electrical, Plumbing, Civil, Landscape, Interior, Fire) only if the title block states it\n'
  + '- project: the project name, project or contract number and plot number exactly as printed in the title block, on one line\n'
  + 'For each, say how sure you are: "high" (printed clearly), "medium" (legible but partly unclear) or "low" (barely legible). '
  + 'If a value is not on it or cannot be read, give "" and "low".\n'
  + 'Answer with JSON only, in exactly this shape:\n'
  + '{"number":{"value":"","sure":"low"},"revision":{"value":"","sure":"low"},"title":{"value":"","sure":"low"},'
  + '"date":{"value":"","sure":"low"},"discipline":{"value":"","sure":"low"},"project":{"value":"","sure":"low"}}';

export function parseSheet(text) {
  const j = firstJson(text);
  if (!j || typeof j !== 'object') return null;
  const out = {};
  for (const f of SHEET_FIELDS) {
    const v = j[f];
    const value = v && typeof v === 'object' ? v.value : v;
    out[f] = { value: clean(value, f === 'title' ? 200 : 80), sure: SURE(v && typeof v === 'object' ? v.sure : 'low') };
  }
  // The project line is never applied to the sheet; it is only checked (sheetProject).
  const pv = j.project;
  out.project = { value: clean(pv && typeof pv === 'object' ? pv.value : pv, 300), sure: SURE(pv && typeof pv === 'object' ? pv.sure : 'low') };
  return out;
}

// P1 step 2a on a scan (Ajay, 6 Oct 2026, decision 3): the project line the AI
// read from the title block, checked by the gate's own rules. A sheet that
// states another plot or contract is held for AETRAA, when the AI read it
// clearly ("high" or "medium"); a barely legible one is only flagged. A sheet
// that states nothing, or this project's own plot, is not held.
export function sheetProject(ai, project) {
  const pr = ai && ai.project;
  if (!pr || !pr.value || !project) return null;
  let wrong = [];
  try { wrong = identityMismatches(project, { kind: 'drawing', text: pr.value }).filter((w) => !w.weak && w.stated); } catch (e) { wrong = []; }
  if (!wrong.length) return { value: pr.value, sure: pr.sure, holds: false };
  return { value: pr.value, sure: pr.sure, holds: pr.sure !== 'low',
    reason: 'The title block (read by AI, ' + pr.sure + ') reads \u201c' + pr.value.slice(0, 120) + '\u201d. ' + wrong.map((w) => w.says).join(' '),
    evidence: { mismatches: wrong, read_by: 'AI (A1)', sure: pr.sure } };
}

// A drawing number, loosely (intake.js plausibleNumber): letters and digits
// with a separator, no spaces, no colon.
export function plausibleNumber(n) {
  const s = String(n || '').trim();
  return /^[A-Za-z0-9][A-Za-z0-9._/-]{2,60}$/.test(s) && /\d/.test(s) && /[-_./]/.test(s) && !/:/.test(s);
}
const REV_SHAPE = /^[A-Z]{0,2}\d{0,3}[A-Z]?$/;
// The order of two revisions of one series: A < C, P1 < P2, 01 < 03, R0 < R1.
// Two different series (P2 and C1) are not ordered — nothing is claimed.
export function revCompare(a, b) {
  const A = String(a || '').toUpperCase().trim(), B = String(b || '').toUpperCase().trim();
  const ma = A.match(/^([A-Z]*)(\d*)$/), mb = B.match(/^([A-Z]*)(\d*)$/);
  if (!A || !B || !ma || !mb) return null;
  if (ma[2] && mb[2] && ma[1] === mb[1]) return Math.sign(Number(ma[2]) - Number(mb[2]));
  if (!ma[2] && !mb[2] && ma[1].length === 1 && mb[1].length === 1) return Math.sign(ma[1].charCodeAt(0) - mb[1].charCodeAt(0));
  return null;
}

// The checks on what the AI read (A1 step 2), against what is already there.
//   ai:   parseSheet's result
//   ctx:  { current: {number, revision, title, date, discipline}, sources: {…},
//           project, revisionsByNumber: { NUMBER: [{revision, status}] }, today }
// Each field: the AI's value, how sure, what is kept (a value read by rule or
// typed by a person — never overwritten), the flags (a blocking one means the
// value cannot be taken with one click; the person types it), and whether it
// may be taken as read.
export function checkSheet(ai, ctx = {}) {
  const cur = ctx.current || {}, src = ctx.sources || {};
  const out = {};
  // The revisions already in the register for this sheet's number — the one
  // it carries, else the one the AI read.
  const num = String(cur.number || (ai && ai.number && ai.number.value) || '').toUpperCase().replace(/\s+/g, '');
  const revisions = (ctx.revisionsByNumber && ctx.revisionsByNumber[num]) || ctx.revisions || [];
  for (const f of SHEET_FIELDS) {
    const a = (ai && ai[f]) || { value: '', sure: 'low' };
    let value = a.value;
    const flags = [];
    let iso = null;
    if (f === 'number' && value) {
      value = value.toUpperCase().replace(/\s+/g, '');
      if (!plausibleNumber(value)) flags.push({ why: 'does not look like a drawing number', blocks: true });
      else if (ctx.project) {
        let g = null;
        try { g = checkIncoming(ctx.project, { kind: 'drawing', number: value, filename: value, text: '' }); } catch (e) { g = null; }
        if (g && g.verdict === 'conflict') flags.push({ why: 'not this project’s numbering — the gate would hold it: ' + clean(g.reason, 200), blocks: false });
      }
    }
    if (f === 'revision' && value) {
      value = value.toUpperCase().replace(/^REV\.?\s*/, '').replace(/\s+/g, '');
      if (!REV_SHAPE.test(value) || value.length > 6) flags.push({ why: 'does not look like a revision', blocks: true });
      else {
        const later = revisions.map((x) => x.revision).filter((r) => r && revCompare(value, r) !== null);
        const same = later.find((r) => revCompare(value, r) === 0);
        const newer = later.filter((r) => revCompare(value, r) < 0).sort((x, y) => revCompare(y, x))[0];
        if (same) flags.push({ why: 'Rev ' + same + ' of this sheet is already in the register', blocks: false });
        else if (newer) flags.push({ why: 'older than Rev ' + newer + ', already in the register', blocks: false });
      }
    }
    if (f === 'date' && value) {
      const d = dateOf(value, ctx.today);
      if (d.why) flags.push({ why: d.why, blocks: !!d.blocks });
      iso = d.blocks ? null : d.iso || null;
    }
    const kept = clean(cur[f]);
    const norm = (s) => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
    if (kept && value && norm(kept) !== norm(f === 'date' ? (iso || value) : value)) {
      flags.push({ why: 'differs from ' + kept + ', the value already there' + (src[f] ? ' (' + src[f] + ')' : '') + ', which is kept — type a value to change it', blocks: false });
    }
    out[f] = { ai: value, sure: a.sure, iso, kept: kept || null, source: kept ? (src[f] || 'already there') : null, flags,
      may_take: !kept && !!value && !flags.some((x) => x.blocks) };
  }
  return out;
}

// A person's own value for a field, checked the same way.
function typedValue(f, v, today) {
  const s = clean(v, f === 'title' ? 200 : 80);
  if (!s) return { error: 'empty' };
  if (f === 'number') { const n = s.toUpperCase().replace(/\s+/g, ''); return plausibleNumber(n) ? { value: n } : { error: n + ' does not look like a drawing number' }; }
  if (f === 'revision') { const n = s.toUpperCase().replace(/\s+/g, ''); return REV_SHAPE.test(n) && n.length <= 6 ? { value: n } : { error: n + ' does not look like a revision' }; }
  if (f === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { error: 'give the date as a date' };
    if (s > today) return { error: s + ' is after today' };
    return { value: s };
  }
  return { value: s };
}

// Step 1: read the corner. Writes the proposal and the image that was sent,
// nothing else.
//   sheet: { bytes, filename, mime }   ctx: as checkSheet, plus who
export async function readSheetWithAI(env, pid, target, sheet, ctx) {
  if (!aiEnabled(env)) return { error: AI_OFF_MESSAGE, disabled: true };
  const corner = await titleBlockCorner(sheet.bytes, sheet.filename, sheet.mime);
  if (corner.error) return { error: corner.error };
  const id = uid('aip_');
  const ans = await callModel(env, { task: 'a1-sheet', system: SHEET_SYSTEM, prompt: SHEET_PROMPT,
    documents: [{ bytes: corner.png, media_type: 'image/png' }], max_tokens: 600, temperature: 0,
    project_id: pid, who: ctx.who });
  if (ans.error) return { error: ans.error, disabled: !!ans.disabled };
  const ai = parseSheet(ans.text);
  if (!ai) return { error: 'the model’s answer could not be read — nothing was changed; read it again or type the values' };
  const sha = await sha256Hex(corner.png);
  const put = await putFile(env, 'ai/' + pid + '/' + id + '.png', corner.png, 'image/png');
  const fields = checkSheet(ai, ctx);
  const project_check = sheetProject(ai, ctx.project);
  const proposal = { fields, read: ai, project_check, corner: { width: corner.width, height: corner.height, page: corner.page, reader: corner.reader } };
  await keep(env, { id, project_id: pid, reader: 'A1', target_kind: target.kind, target_id: target.id, model: ans.model, provider: ans.provider,
    prompt: A1_PROMPT, sent_sha: sha, sent_key: put && put.ok ? put.key : null,
    sent_what: 'the title-block corner only (' + corner.width + ' × ' + corner.height + ' px of a ' + corner.page.w + ' × ' + corner.page.h + ' sheet)',
    proposal, by: ctx.who });
  return { ok: true, id, model: ans.model, fields, project_check, sent: { sha256: sha, width: corner.width, height: corner.height }, corner_url: '/api/ai-read/corner?id=' + id };
}

// Step 2: what the person chose. Each field is 'ai' (take the AI's value — only
// where nothing is kept and no check blocks it), { value } (typed), or left out.
// The checks are run again on the current values, so a page cannot take a
// value the server would not offer.
export function settleSheet(prop, decisions, ctx) {
  const fields = checkSheet(prop.proposal.read, ctx);
  const values = {}, how = {}, refused = [];
  for (const f of SHEET_FIELDS) {
    const d = decisions && decisions[f];
    if (d == null || d === '' || d === false) continue;
    if (d === 'ai') {
      if (!fields[f].may_take) { refused.push(f + ': ' + (fields[f].kept ? 'a value is already there and is kept' : (fields[f].flags.find((x) => x.blocks) || {}).why || 'nothing was read')); continue; }
      values[f] = f === 'date' ? fields[f].iso : fields[f].ai; how[f] = 'ai';
    } else if (typeof d === 'object' && d.value != null) {
      const t = typedValue(f, d.value, ctx.today || todayUAE());
      if (t.error) { refused.push(f + ': ' + t.error); continue; }
      values[f] = t.value; how[f] = 'typed';
    }
  }
  return { values, how, refused, fields };
}

/* ------------------------------------------------------------ A3: a consultant's reply */

const REPLY_SYSTEM = 'You read a consultant\'s returned submittal, RFI answer, inspection result or comment sheet for a document controller, '
  + 'who checks it before anything is recorded. Copy what is written; never guess a code, a reference or a date, and never '
  + 'convert or reorder a date. Answer with JSON only.';
export function replyPrompt(type) {
  return 'This document is a consultant\'s reply to a ' + (type === 'rfi' ? 'request for information (RFI)' : type === 'ms' ? 'method statement'
    : type === 'material' ? 'material submittal' : type === 'wir' ? 'work inspection request (WIR)' : type === 'mir' ? 'material inspection request (MIR)' : 'submittal') + ': a letter, a stamped drawing or a comment sheet. Read:\n'
    + '- reference: the reference of the submittal or RFI it replies to, as written (for example SUB-001, MAR-004 Rev 1, RFI-012), or ""\n'
    + '- code: the review code stamped, ticked or written: A, B, C or D, or "" if none is marked' + (type === 'rfi' ? '; "answered" if it answers the RFI' : '') + '\n'
    + '- code_words: the words beside the code as written (for example "Approved as noted"), or ""\n'
    + '- date: the date of the reply, exactly as written\n'
    + '- comments: each comment as its own item, in order: {"text": the comment as written, "about": the drawing number or clause it refers to, or "", "discipline": Architectural, Structural, MEP, Civil and so on if stated, or ""}\n'
    + (type === 'rfi' ? '- answer: the answer given, as written\n- scope_change: {"likely": true or false, "why": ""} — whether the answer asks for work beyond the drawings and specification as they were (a possible variation)\n' : '')
    + '- code_sure and date_sure: "high", "medium" or "low"\n'
    + 'Answer with JSON only, in exactly this shape:\n'
    + '{"reference":"","code":"","code_words":"","date":"","comments":[{"text":"","about":"","discipline":""}],' + (type === 'rfi' ? '"answer":"",' : '') + '"code_sure":"low","date_sure":"low"}';
}
export function parseReply(text) {
  const j = firstJson(text);
  if (!j || typeof j !== 'object') return null;
  const comments = (Array.isArray(j.comments) ? j.comments : []).slice(0, 80).map((c) => (typeof c === 'string' ? { text: c } : c || {}))
    .map((c) => ({ text: clean(c.text, 2000), about: clean(c.about, 120), discipline: clean(c.discipline, 60) })).filter((c) => c.text);
  const sc = j.scope_change && typeof j.scope_change === 'object' ? j.scope_change : null;
  return { reference: clean(j.reference, 80), code: clean(j.code, 20), code_words: clean(j.code_words, 120), date: clean(j.date, 40),
    comments, answer: clean(j.answer, 4000), code_sure: SURE(j.code_sure), date_sure: SURE(j.date_sure),
    // K13 (A10): a suggestion only — DC decides whether to flag it to the QS.
    ...(sc && sc.likely === true ? { scope_change: { likely: true, why: clean(sc.why, 300) } } : {}) };
}
const refKey = (s) => baseRef(String(s || '')).toUpperCase().replace(/[\s_]+/g, '').replace(/[–—]/g, '-');

// The deterministic half of A3 step 1: the reference matches this record, the
// code is one the record can take, the date reads one way and falls between
// the issue and today; a C or D carries its comments. Anything that fails
// leaves the draft for DC to record by hand — never applied.
export function checkReply(ai, rec, today = todayUAE()) {
  const flags = [];
  if (!ai.reference) flags.push({ part: 'reference', why: 'no reference could be read — check it is the reply to ' + rec.ref, blocks: true });
  else if (refKey(ai.reference) !== refKey(rec.ref)) flags.push({ part: 'reference', why: 'the reply reads as for ' + ai.reference + ', not ' + rec.ref, blocks: true });
  let code = codeOf(ai.code, rec.type) || codeOf(ai.code_words, rec.type);
  if (rec.type === 'rfi' && !code && ai.answer) code = 'answered';
  const okCodes = rec.type === 'rfi' ? ['answered', 'A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D'];
  if (!code || !okCodes.includes(code)) flags.push({ part: 'code', why: ai.code || ai.code_words ? '“' + (ai.code || ai.code_words) + '” is not a code this record takes' : 'no code could be read', blocks: true });
  const d = ai.date ? dateOf(ai.date, today) : { why: 'no date could be read', blocks: true };
  if (d.why) flags.push({ part: 'date', why: d.why, blocks: !!d.blocks });
  const iso = d.blocks ? null : d.iso || null;
  if (iso && rec.issued_on && iso < rec.issued_on) flags.push({ part: 'date', why: iso + ' is before ' + rec.ref + ' was issued (' + rec.issued_on + ')', blocks: true });
  const comments = ai.comments.slice();
  if (rec.type === 'rfi' && ai.answer && !comments.length) comments.push({ text: ai.answer, about: '', discipline: '' });
  if ((code === 'C' || code === 'D') && !comments.length) flags.push({ part: 'comments', why: 'a Code ' + code + ' comes with comments, and none could be read', blocks: true });
  if (ai.code_sure === 'low' && code) flags.push({ part: 'code', why: 'the code was barely legible — check it on the reply', blocks: false });
  return { code: code || null, replied_on: iso, comments, flags, may_confirm: !flags.some((f) => f.blocks), ...(ai.scope_change ? { scope_change: ai.scope_change } : {}) };
}

//   file: { bytes, filename, mime, attachment_id }
export async function readReplyWithAI(env, pid, rec, file, who) {
  if (!aiEnabled(env)) return { error: AI_OFF_MESSAGE, disabled: true };
  const mime = /\.pdf$/i.test(file.filename || '') || /pdf/i.test(file.mime || '') ? 'application/pdf'
    : /\.png$/i.test(file.filename || '') || /png/i.test(file.mime || '') ? 'image/png'
    : /\.jpe?g$/i.test(file.filename || '') || /jpe?g/i.test(file.mime || '') ? 'image/jpeg' : '';
  if (!mime) return { error: 'the AI reads a PDF, PNG or JPEG reply — an Excel or Word return is read by the form reader (E14)' };
  const ans = await callModel(env, { task: 'a3-reply', system: REPLY_SYSTEM, prompt: replyPrompt(rec.type),
    documents: [{ bytes: file.bytes, media_type: mime }], max_tokens: 2500, temperature: 0, project_id: pid, who });
  if (ans.error) return { error: ans.error, disabled: !!ans.disabled };
  const ai = parseReply(ans.text);
  if (!ai) return { error: 'the model’s answer could not be read — nothing was recorded; record the reply by hand' };
  const checked = checkReply(ai, rec);
  const sha = await sha256Hex(file.bytes);
  const id = await keep(env, { project_id: pid, reader: 'A3', target_kind: 'record', target_id: rec.ref, model: ans.model, provider: ans.provider,
    prompt: A3_PROMPT, sent_sha: sha, sent_what: 'the reply as uploaded: ' + clean(file.filename, 120),
    proposal: { read: ai, checked, attachment_id: file.attachment_id || null }, by: who });
  return { ok: true, id, model: ans.model, read: ai, ...checked };
}

/* ------------------------------------------------------------ A6: fields on an unusual form */

const FORM_SYSTEM = 'You find the fill-in boxes on a consultant\'s blank form for a document controller, who checks '
  + 'every box you propose before the form is used. Use only the cells listed; never invent a cell. Answer with JSON only.';
// What is sent: the cell text and positions (v5 A6 step 1) — not the file.
export function formPayload(sheet, taken) {
  const area = sheet.area || { r1: 1, c1: 1, r2: 60, c2: 12 };
  const lines = [];
  const keys = Object.keys(sheet.cells || {}).map((k) => k.split(':').map(Number))
    .filter(([r, c]) => r >= area.r1 && r <= area.r2 && c >= area.c1 && c <= area.c2).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const [r, c] of keys) {
    const x = sheet.cells[r + ':' + c];
    const t = clean(x && x.text, 120);
    if (t) lines.push(colName(c) + r + ': ' + JSON.stringify(t));
    else if (x && x.pic) lines.push(colName(c) + r + ': [picture]');
  }
  const merges = (sheet.merges || []).filter((g) => g.r1 >= area.r1 && g.r1 <= area.r2)
    .map((g) => colName(g.c1) + g.r1 + ':' + colName(g.c2) + g.r2);
  return 'The form occupies ' + colName(area.c1) + area.r1 + ':' + colName(area.c2) + area.r2 + '. A cell not listed is blank.\n'
    + 'Cells with text:\n' + lines.slice(0, 600).join('\n') + '\n'
    + (merges.length ? 'Merged blocks (a value goes in the first cell of a block): ' + merges.slice(0, 200).join(', ') + '\n' : '')
    + ((taken || []).length ? 'Already fields (leave them out): ' + taken.join(', ') + '\n' : '');
}
const FORM_PROMPT = 'Propose where the person filling this form types each value, and where each party signs.\n'
  + '- fields: [{"cell": the blank cell the value goes in (usually right of or under its label), "label": the field\'s name from its label, "long": true if it is several lines of text}]\n'
  + '- signatures: [{"cell": the blank cell where a party signs, "label": whose signature (for example Contractor, Consultant)}]\n'
  + 'Only blank cells inside the form. At most 40 fields and 8 signatures. Answer with JSON only: {"fields":[],"signatures":[]}';
export function parseForm(text) {
  const j = firstJson(text);
  if (!j || typeof j !== 'object') return null;
  const one = (x) => ({ cell: clean(x && x.cell, 12).toUpperCase().replace(/\$/g, ''), label: clean(x && x.label, 80), long: !!(x && x.long) });
  return { fields: (Array.isArray(j.fields) ? j.fields : []).slice(0, 80).map(one), signatures: (Array.isArray(j.signatures) ? j.signatures : []).slice(0, 20).map(one) };
}
// Each proposal checked against the drawn form: a real cell, inside the form,
// blank (not a label, not a picture), the first cell of a merged block, not a
// field the extractor already read, not proposed twice. What fails is listed
// with the reason, never kept.
export function checkForm(ai, sheet, existing) {
  const area = sheet.area || { r1: 1, c1: 1, r2: 400, c2: 40 };
  const have = new Set((existing || []).map((f) => String(f.cell).toUpperCase()));
  const used = new Set(), tokens = new Set((existing || []).map((f) => f.token));
  const why = (cell) => {
    const p = parseRef(cell);
    if (!p) return 'not a cell';
    if (p.r < area.r1 || p.r > area.r2 || p.c < area.c1 || p.c > area.c2) return 'outside the form';
    const x = sheet.cells[p.r + ':' + p.c];
    if (x && x.pic) return 'a picture';
    if (x && clean(x.text) && !/\{\{/.test(x.text)) return 'has text on the form ("' + clean(x.text, 40) + '")';
    const g = (sheet.merges || []).find((m) => p.r >= m.r1 && p.r <= m.r2 && p.c >= m.c1 && p.c <= m.c2);
    if (g && (g.r1 !== p.r || g.c1 !== p.c)) return 'inside a merged block that starts at ' + colName(g.c1) + g.r1;
    if (have.has(cell)) return 'a field the extractor already read — left as it is';
    if (used.has(cell)) return 'proposed twice';
    return null;
  };
  const fields = [], signatures = [], dropped = [];
  for (const f of ai.fields.slice(0, 40)) {
    const w = !f.label ? 'no label' : why(f.cell);
    if (w) { dropped.push({ cell: f.cell, label: f.label, why: w }); continue; }
    used.add(f.cell);
    let { token, auto } = tokenOf(f.label);
    let n = 1; const base = token;
    while (tokens.has(token)) { n++; token = base + '_' + n; auto = false; }
    tokens.add(token);
    fields.push({ cell: f.cell, label: f.label.charAt(0).toUpperCase() + f.label.slice(1), token, auto, long: f.long, by: 'ai' });
  }
  for (const s of ai.signatures.slice(0, 8)) {
    const w = why(s.cell);
    if (w) { dropped.push({ cell: s.cell, label: s.label, why: w, signature: true }); continue; }
    used.add(s.cell);
    signatures.push({ cell: s.cell, label: s.label || 'Signature' });
  }
  return { fields, signatures, dropped };
}

//   form: { sheet, existing (fields the extractor read), doc_type }
export async function findFieldsWithAI(env, pid, form, who) {
  if (!aiEnabled(env)) return { error: AI_OFF_MESSAGE, disabled: true };
  const payload = formPayload(form.sheet, (form.existing || []).map((f) => f.cell));
  const ans = await callModel(env, { task: 'a6-fields', system: FORM_SYSTEM, prompt: payload + '\n' + FORM_PROMPT,
    max_tokens: 2500, temperature: 0, project_id: pid, who });
  if (ans.error) return { error: ans.error, disabled: !!ans.disabled };
  const ai = parseForm(ans.text);
  if (!ai) return { error: 'the model’s answer could not be read — the form is unchanged; add the fields by hand' };
  const checked = checkForm(ai, form.sheet, form.existing);
  const sha = await sha256Hex(new TextEncoder().encode(payload));
  const id = await keep(env, { project_id: pid, reader: 'A6', target_kind: 'template', target_id: form.doc_type, model: ans.model, provider: ans.provider,
    prompt: A6_PROMPT, sent_sha: sha, sent_what: 'the cell text and positions of the form (' + payload.length + ' characters), not the file',
    proposal: { read: ai, ...checked }, by: who });
  return { ok: true, id, model: ans.model, ...checked };
}
