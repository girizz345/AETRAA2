// K13 (A11) · v5 A11: MINUTES — from typed notes or a scanned sheet (no audio).
//
//   1 DC or the PM opens a draft meeting and gives the notes or the scan. The
//     AI prepares the minutes: attendance, items, decisions, and the actions
//     with a proposed owner and date — into the draft on screen, for a person
//     to check. Nothing is saved until they save.
//   2 Each owner the AI proposed is confirmed by the person before the minutes
//     can be issued: the AI never assigns an action (v5 A11).
//   3 Issuing is as before (the PM, the Principal or DC).
//   The consultant's issued minutes are uploaded and read too — recorded as
//   theirs (status "recorded", never issued by us), their decisions and
//   actions kept as text within the minute, not raised as live actions (spec
//   §6 "actions inside imported minutes are not created as live actions").
//
// What the AI must never do (v5 A11): issue minutes or assign actions.

import { callModel, aiEnabled, AI_OFF_MESSAGE } from './ai.js';
import { firstJson, dateOf } from './ai-readers.js';
import { letterText } from './correspondence.js';

export const MINUTES_PROMPT = 'a11-1';
const clean = (s, n = 300) => String(s == null ? '' : s).replace(/[ \t]+/g, ' ').trim().slice(0, n);

const SYSTEM = 'You write the minutes of a construction project meeting for the document controller or project manager, who checks '
  + 'every line before the minutes are issued. Use only what the notes or the sheet say: never invent a decision, an action, a '
  + 'name or a date. An action\'s owner is only proposed — a person confirms it. Never convert or reorder a date. Answer with JSON only.';
const SHAPE = '{"title":"","meeting_date":"","location":"","chair":"","attendees":[{"name":"","company":"","present":true}],'
  + '"items":[{"subject":"","discussion":"","decision":"","actions":[{"text":"","owner":"","due":""}]}],"next_meeting":""}';
export function notesPrompt(kind, team) {
  return 'These are the notes of a ' + kind + '. Prepare the minutes: who attended (and apologies), each item discussed with what was agreed, '
    + 'and each action with who the notes say does it and by when (exactly as written). '
    + (team.length ? 'People on the project team: ' + team.map((u) => u.name).join(', ') + '. ' : '')
    + 'Answer with JSON only, in this shape:\n' + SHAPE;
}
export const CONSULTANT_PROMPT = 'These are minutes issued by the consultant. Record them as they are written: their own reference for the minutes, '
  + 'the date, who attended, each item with its discussion and what was decided, and each action with who and by when as they wrote it. '
  + 'Answer with JSON only, in this shape:\n' + SHAPE.replace('{"title"', '{"their_ref":"","title"');

// The model's minutes, cleaned; owners matched to the project team by name
// (deterministic — an exact name, or a name the owner text contains), each
// one marked proposed; dates read one way or left for the person.
export function shapeMinutes(j, team) {
  if (!j || typeof j !== 'object') return null;
  const people = (team || []).map((u) => ({ id: u.id, name: u.name, low: String(u.name || '').toLowerCase() }));
  const match = (o) => {
    const t = String(o || '').toLowerCase().trim();
    if (!t) return null;
    const hits = people.filter((p) => p.low && (p.low === t || t.includes(p.low) || p.low.split(' ').some((w) => w.length > 2 && t.split(/\W+/).includes(w))));
    return hits.length === 1 ? hits[0] : null;
  };
  const date = (raw) => { const d = dateOf(raw, '2999-12-31'); return d.iso && !d.blocks ? { iso: d.iso } : { why: raw ? d.why || 'not a date' : '' }; };
  const md = date(j.meeting_date);
  const items = (Array.isArray(j.items) ? j.items : []).slice(0, 80).map((it, i) => ({
    no: String(i + 1), subject: clean(it && it.subject, 200), discussion: clean(it && it.discussion, 4000), decision: clean(it && it.decision, 1000),
    actions: (Array.isArray(it && it.actions) ? it.actions : []).slice(0, 30).map((a) => {
      const who = match(a && a.owner), due = date(a && a.due);
      return { text: clean(a && a.text, 500), owner_user_id: who ? who.id : '', owner_name: who ? who.name : clean(a && a.owner, 120),
        due: due.iso || '', proposed: true, proposed_owner: clean(a && a.owner, 120), ...(due.why ? { due_note: 'the date “' + clean(a && a.due, 40) + '” ' + due.why } : {}) };
    }).filter((a) => a.text),
  })).filter((it) => it.subject || it.discussion || it.decision || it.actions.length);
  return {
    title: clean(j.title, 200), meeting_date: md.iso || '', location: clean(j.location, 160), chair: clean(j.chair, 120), next_meeting: clean(j.next_meeting, 40),
    attendees: (Array.isArray(j.attendees) ? j.attendees : []).slice(0, 80).map((a) => ({ name: clean(a && a.name, 120), company: clean(a && a.company, 120), present: !(a && a.present === false) })).filter((a) => a.name),
    items, their_ref: clean(j.their_ref, 60), ...(md.why ? { date_note: 'the meeting date “' + clean(j.meeting_date, 40) + '” ' + md.why } : {}),
  };
}

async function sendToModel(env, pid, input, prompt, task, who) {
  const docs = [];
  let text = String(input.notes || '').trim().slice(0, 20000);
  if (input.file && input.file.bytes && input.file.bytes.length) {
    const t = await letterText(input.file.bytes, input.file.filename);
    if (!t.format || (t.format === 'msg' && !t.text)) return { error: 'Give the notes as a PDF, Word, text file, an email or a photo (PNG, JPEG).' };
    if (t.scan) docs.push({ bytes: input.file.bytes, media_type: t.format === 'pdf' ? 'application/pdf' : t.format === 'png' ? 'image/png' : 'image/jpeg' });
    else text = (text ? text + '\n\n' : '') + t.text.slice(0, 30000);
  }
  if (!text && !docs.length) return { error: 'Type the notes, or add the scanned sheet.' };
  return callModel(env, { task, system: SYSTEM, prompt: (text ? 'The text:\n"""\n' + text + '\n"""\n\n' : '') + prompt, documents: docs,
    max_tokens: 6000, temperature: 0, project_id: pid, who });
}

// Step 1: the AI's draft of the minutes — returned to the screen, not saved.
export async function draftMinutes(env, pid, input, ctx) {
  if (!aiEnabled(env)) return { error: AI_OFF_MESSAGE, disabled: true };
  const ans = await sendToModel(env, pid, input, notesPrompt(ctx.kindLabel || 'project meeting', ctx.team || []), 'a11-minutes', ctx.who);
  if (ans.error) return { error: ans.error, disabled: !!ans.disabled };
  const d = shapeMinutes(firstJson(ans.text), ctx.team);
  if (!d) return { error: 'The model’s answer could not be read — nothing was changed; write the minutes by hand.' };
  return { ok: true, draft: d, model: ans.model };
}
// The consultant's issued minutes, read for the person to record as theirs.
export async function readConsultantMinutes(env, pid, input, ctx) {
  if (!aiEnabled(env)) return { error: AI_OFF_MESSAGE, disabled: true };
  const ans = await sendToModel(env, pid, input, CONSULTANT_PROMPT, 'a11-consultant', ctx.who);
  if (ans.error) return { error: ans.error, disabled: !!ans.disabled };
  const d = shapeMinutes(firstJson(ans.text), ctx.team);
  if (!d) return { error: 'The model’s answer could not be read — record the consultant’s minutes by hand.' };
  // Their actions are theirs: kept as text, never proposed to our tracker.
  // Decision 8: the owner the AI matched is kept as a suggestion only, for
  // Document Control when they confirm an action into our tracker.
  d.items.forEach((it) => it.actions.forEach((a) => { if (a.owner_user_id) a.suggested_owner_user_id = a.owner_user_id; delete a.proposed; delete a.owner_user_id; }));
  return { ok: true, draft: d, model: ans.model };
}
