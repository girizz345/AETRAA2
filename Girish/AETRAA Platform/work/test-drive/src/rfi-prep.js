// K13 (A10) · v5 A10: RFI PREPARATION — from a short note and a photo (or a
// marked-up drawing), an RFI on the consultant's form, raised by the
// engineer and following S0 (K7).
//
//   1 The engineer picks "+ RFI", types a note, drops a photo. The extraction
//     program finds the drawing references (E3: the drawing register) and the
//     spec references (E13: the spec index); the AI prepares the RFI's text and
//     fields, checks the engineer's wording and says what is missing (a clearer
//     question, a drawing or spec reference, the location, the needed-by date).
//   2 The engineer edits, then Generate → Check → Confirm & submit — before
//     which the duplicate check runs (here and on the server).
//   3–5 S0: the PM approves, DC issues, DC records the answer — with a
//     "possible variation" flag to the QS when the answer changes scope.
//
// What the AI must never do (v5 A10): raise, route or issue the RFI. It
// drafts; the engineer raises it through the same route as any record. There
// is no proposed-solution field (v5): the AI is told an RFI asks and does not
// answer, and a form box for a proposal is left blank.

import { callModel, aiEnabled, AI_OFF_MESSAGE } from './ai.js';
import { firstJson, dateOf } from './ai-readers.js';
import { validNumber } from './sheet-reader.js';

export const RFI_PROMPT = 'a10-1';
export const DEFAULT_RFI_FIELDS = ['Subject', 'Discipline', 'Question', 'Drawing ref', 'Spec ref', 'Location', 'Impact', 'Priority', 'Reply needed by'];
const PROPOSAL = /propos|solution|suggest|recommend/i;
const clean = (s, n = 300) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const parse = (v, d) => { try { const j = JSON.parse(v || ''); return j == null ? d : j; } catch (e) { return d; } };
const todayUAE = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);

/* ------------------------------------------------------------ the references, by rule */

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'not', 'please', 'confirm', 'which', 'what', 'where', 'there', 'have', 'has', 'shall', 'will', 'into', 'level', 'grid']);
export const wordsOf = (s) => [...new Set(String(s || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))];

// Drawing numbers the note names that are in the register (E3), and spec
// sections it names by number or by a distinctive word of their title (E13).
//   ctx: { drawings: [{number, revision, title, status}], sections: [{code, title}] }
export function findRfiReferences(text, ctx) {
  const t = String(text || '').toUpperCase();
  const reg = new Map((ctx.drawings || []).map((d) => [String(d.number || '').toUpperCase(), d]));
  const drawings = [], unknown = [];
  for (const m of t.matchAll(/\b[A-Z]{1,6}\d{0,3}(?:-[A-Z0-9]{1,6}){0,4}-\d{2,5}[A-Z]?\b/g)) {
    const n = m[0];
    if (/^(RFI|SUB|MAR|NCR|WIR|MIR|IN|LTR|VO|MS)-/.test(n)) continue;
    const d = reg.get(n);
    if (d) { if (!drawings.some((x) => x.number === d.number)) drawings.push({ number: d.number, revision: d.revision || '', title: d.title || '' }); }
    else if (validNumber(n) && !unknown.includes(n)) unknown.push(n);
  }
  const specs = [];
  const tw = new Set(wordsOf(text));
  for (const s of ctx.sections || []) {
    const code = String(s.code || ''), bare = code.replace(/\s+/g, '');
    const byCode = code && (t.includes(code.toUpperCase()) || (bare.length >= 6 && t.replace(/\s+/g, '').includes(bare)));
    const hits = wordsOf(s.title).filter((w) => w.length >= 6 && tw.has(w));
    if (byCode || hits.length) specs.push({ code, title: s.title, by: byCode ? 'its number' : 'the word ' + hits.join(', ') });
  }
  return { drawings, unknown_drawings: unknown, specs: specs.slice(0, 6) };
}

// Before raising (v5 A10): an RFI already asked — open, answered or brought
// in from the old system — on the same drawing or in the same words. Both RFI
// stores are searched (the records register and the issues register).
export function similarity(a, b) {
  const A = new Set(wordsOf(a)), B = new Set(wordsOf(b));
  if (!A.size || !B.size) return 0;
  let n = 0; for (const w of A) if (B.has(w)) n++;
  return n / (A.size + B.size - n);
}
export async function rfiDuplicates(env, pid, draft) {
  const words = [draft.subject, draft.question].filter(Boolean).join(' ');
  const refs = String(draft.drawing || '').toUpperCase().split(/[\s,;/]+/).filter(Boolean);
  const out = [];
  let recs = [], iss = [];
  try { recs = (await env.DB.prepare("SELECT ref, title, status, data FROM records WHERE project_id = ? AND type = 'rfi'").bind(pid).all()).results || []; } catch (e) { recs = []; }
  try { iss = (await env.DB.prepare("SELECT ref, title, detail, status FROM issues WHERE project_id = ? AND type = 'rfi'").bind(pid).all()).results || []; } catch (e) { iss = []; }
  for (const r of recs) {
    if (draft.not_ref && r.ref === draft.not_ref) continue;
    const d = parse(r.data, {});
    const sim = similarity(words, [r.title, d.Question, d.Subject].join(' '));
    const sameDwg = refs.length && refs.some((x) => String(d['Drawing ref'] || '').toUpperCase().includes(x));
    if (sim >= 0.5 || (sameDwg && sim >= 0.25)) out.push({ ref: r.ref, title: r.title, status: r.status, why: sameDwg ? 'the same drawing and similar words' : 'similar words', score: Math.round(sim * 100) / 100 });
  }
  for (const r of iss) {
    const sim = similarity(words, [r.title, r.detail].join(' '));
    if (sim >= 0.5) out.push({ ref: r.ref, title: r.title, status: r.status, why: 'similar words (issues register)', score: Math.round(sim * 100) / 100 });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

/* ------------------------------------------------------------ the AI's draft */

const RFI_SYSTEM = 'You prepare a request for information (RFI) from a construction contractor to the consultant, for the engineer who '
  + 'raises it. An RFI asks; it never answers: never propose a solution, a design or a fix. Use only what the note, the photo or '
  + 'drawing, and the references given say — never invent a drawing number, a clause, a dimension or a date. The impact is what is '
  + 'held up on site, in plain words — never a claim, a notice or an entitlement. Answer with JSON only.';
export function rfiPrompt(fields, refs, note) {
  return 'The engineer\'s note:\n"""\n' + note + '\n"""\n'
    + (refs.drawings.length ? 'Drawings in the register it names: ' + refs.drawings.map((d) => d.number + (d.title ? ' (' + d.title + ')' : '')).join('; ') + '\n' : '')
    + (refs.specs.length ? 'Specification sections it may concern: ' + refs.specs.map((s) => s.code + ' ' + s.title).join('; ') + '\n' : '')
    + 'Fill the fields of the RFI form: ' + JSON.stringify(fields) + '. Leave a field "" if the note does not give it.\n'
    + 'Then check the wording: list what is missing or unclear for the consultant to answer (a clearer question, a drawing or spec reference, the location, the date it is needed by).\n'
    + 'Answer with JSON only: {"fields":{"<field>":"<value>"},"missing":["…"]}';
}
// What the person sends — never applied by the AI; the form fills, the
// engineer edits, the engineer raises it.
//   input: { note, photo: {bytes, filename} | null }   ctx: { fields, drawings, sections, who }
export async function draftRfi(env, pid, input, ctx) {
  const note = String(input.note || '').trim().slice(0, 4000);
  if (!note && !input.photo) return { error: 'Type a short note (and add a photo or the marked-up drawing).' };
  const refs = findRfiReferences(note, ctx);
  const askFields = (ctx.fields || DEFAULT_RFI_FIELDS).filter((f) => !PROPOSAL.test(f));
  const out = { refs, fields: {}, missing: [], left_blank: (ctx.fields || []).filter((f) => PROPOSAL.test(f)), model: null };
  if (!aiEnabled(env) || ctx.useAi === false) { out.why = aiEnabled(env) ? 'AI is not switched on for this project — type the RFI.' : AI_OFF_MESSAGE; }
  else {
    const docs = [];
    if (input.photo && input.photo.bytes && input.photo.bytes.length) {
      const fn = String(input.photo.filename || '').toLowerCase();
      const media = /\.pdf$/.test(fn) ? 'application/pdf' : /\.png$/.test(fn) ? 'image/png' : /\.jpe?g$/.test(fn) ? 'image/jpeg' : '';
      if (!media) return { error: 'The photo or drawing must be a JPEG, PNG or PDF.' };
      docs.push({ bytes: input.photo.bytes, media_type: media });
    }
    const ans = await callModel(env, { task: 'a10-rfi', system: RFI_SYSTEM, prompt: rfiPrompt(askFields, refs, note || '(see the photo)'), documents: docs,
      max_tokens: 1500, temperature: 0, project_id: pid, who: ctx.who });
    if (ans.error) out.why = 'The AI could not draft it (' + ans.error + ') — type the RFI.';
    else {
      const j = firstJson(ans.text);
      if (!j) out.why = 'The AI’s answer could not be read — type the RFI.';
      else {
        for (const f of askFields) { const v = j.fields && j.fields[f]; if (v != null && String(v).trim()) out.fields[f] = String(v).trim().slice(0, f === 'Question' ? 3000 : 300); }
        out.missing = (Array.isArray(j.missing) ? j.missing : []).map((x) => clean(x, 200)).filter(Boolean).slice(0, 10);
        out.model = ans.model;
      }
    }
  }
  // The references found by rule go in where the form asks for them, and
  // where the AI named something else it is shown, not used.
  const dwgField = askFields.find((f) => /drawing/i.test(f)), specField = askFields.find((f) => /spec/i.test(f));
  if (dwgField && refs.drawings.length) out.fields[dwgField] = refs.drawings.map((d) => d.number).join(', ');
  if (specField && refs.specs.length && !out.fields[specField]) out.fields[specField] = refs.specs.map((s) => s.code).join(', ');
  // What the checks find missing, by rule, beside what the AI said.
  const has = (re) => askFields.some((f) => re.test(f) && String(out.fields[f] || '').trim());
  const byRule = [];
  if (!refs.drawings.length) byRule.push('no drawing in the register is named' + (refs.unknown_drawings.length ? ' (' + refs.unknown_drawings.join(', ') + ' is not in the register)' : ''));
  if (askFields.some((f) => /location/i.test(f)) && !has(/location/i)) byRule.push('the location');
  const need = askFields.find((f) => /needed|reply|required/i.test(f));
  if (need) {
    const d = out.fields[need] ? dateOf(out.fields[need], '2999-12-31') : {};
    if (d.iso && !d.blocks) out.fields[need] = d.iso; else { if (out.fields[need]) byRule.push(need.toLowerCase() + ': “' + out.fields[need] + '” ' + (d.why || 'is not a date')); delete out.fields[need]; byRule.push('the date it is needed by'); }
  }
  out.missing = byRule.map((x) => 'Missing: ' + x).concat(out.missing);
  out.duplicates = await rfiDuplicates(env, pid, { subject: out.fields.Subject || '', question: out.fields.Question || note, drawing: out.fields[dwgField] || '' });
  return { ok: true, ...out };
}

/* ------------------------------------------------------------ the log */

// The RFI log, by discipline (v5 A10): Sr, Discipline, Subject, Raised, Issued,
// Reply by, Answered, Days open, Status, Variation flag.
export async function rfiLog(env, pid, today = todayUAE()) {
  let rows = [];
  try { rows = (await env.DB.prepare("SELECT ref, title, status, data, due, created_at, created_by, workflow, issued_on, replied_on, imported, original_date, original_status FROM records WHERE project_id = ? AND type = 'rfi'").bind(pid).all()).results || []; }
  catch (e) { rows = []; }
  const out = rows.map((r) => {
    const d = parse(r.data, {});
    const wf0 = parse(r.workflow, [])[0] || {};
    // K5: a record from the old system says so in every export, with its own
    // raised-by and the status it had there.
    const imp = Number(r.imported);
    const raised = String(Number(r.imported) ? r.original_date || '' : r.created_at || '').slice(0, 10);
    const answered = String(r.replied_on || '').slice(0, 10);
    const end = answered || today;
    const days = raised ? Math.max(0, Math.round((Date.parse(end) - Date.parse(raised)) / 86400000)) : '';
    return { ref: r.ref, discipline: d.Discipline || '', subject: r.title || d.Subject || '', raised, issued: String(r.issued_on || '').slice(0, 10),
      reply_by: r.due || '', answered, days_open: imp ? '' : days,
      status: imp ? 'Imported' + (r.original_status ? ' — was "' + r.original_status + '" in the old system' : '') : r.status || '',
      variation: d['Variation flag'] || '', raised_by: imp ? d['Raised by'] || '' : (wf0.state === 'done' && wf0.who) || r.created_by || '',
      origin: imp ? 'imported — not raised on this platform' : '' };
  });
  out.sort((a, b) => String(a.discipline).localeCompare(String(b.discipline)) || String(a.ref).localeCompare(String(b.ref), 'en', { numeric: true }));
  out.forEach((r, i) => { r.sr = i + 1; });
  return out;
}
