// K7 · v5 S0: SUBMITTED TO THE CONSULTANT, AND BACK.
//
//   1 Design prepares it on the consultant's form (existing: the New form)
//   2 internal steps sign it in turn (existing: the ladder)
//   3 the PM approves → "Approved internally", or sends it back with a comment
//     → "Returned to Design"; Design revises and resubmits
//   4 Document Control issues it from the platform to the consultant's email —
//     To and Cc set per project and editable on each issue, sent from the
//     platform address with DC's name, replies to DC — with the filled form →
//     "Issued for approval" with the date
//   5 DC records the reply: the code (A/B/C/D; an RFI is "Answered"), the
//     consultant's reply date and comments. E14 reads a returned Excel form for
//     them, deterministically, as a proposal DC confirms.
//   6 the code decides: A closed; B closed, its comments kept; C or D closed and
//     the NEXT REVISION opened ("SUB-001 Rev 1") with the comments as Design's
//     checklist — the PM cannot approve the revision until every comment is
//     answered. The reply goes to the originator, the PM and the Cc list.
//
// The tracker statuses, for every register and schedule: Prepared, Returned to
// Design, Approved internally, Issued for approval, then the code.
//
// A REVISION IS ITS OWN RECORD — same number, "Rev N", linked to the one before
// (revision_of) — so every register, attachment, report and K5's numbering
// keeps working by reference, and the history of each revision stays whole.

import { getRecord, createRecord, advanceRecord, pendingStep, RECORD_TYPES, ensureRecordsTable } from './records.js';
import { addColumns } from './db-cols.js';
import { readDate } from './past-registers.js';

// Inspections (WIR, MIR) too: Document Control issues them and records the
// Engineer's returned result, read by AI where it comes back scanned (v5 A3;
// Ajay, 6 Oct 2026, decision 9).
export const S0_TYPES = ['submittal', 'ms', 'material', 'rfi', 'wir', 'mir'];
export const CODES = { A: 'Code A — Approved', B: 'Code B — Approved as noted', C: 'Code C — Revise & resubmit', D: 'Code D — Rejected', answered: 'Answered' };
// Azure takes 10 MB a message, base64 included: about 7 MB of files.
export const MAX_ISSUE_BYTES = 7 * 1024 * 1024;
export const MAX_RECIPIENTS = 30;
export const E14_READER = 'e14-1';

const nowISO = () => new Date().toISOString();
const todayUAE = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
// A counter after the time, so ids made in the same millisecond still sort in
// the order they were made — a consultant's comments are a numbered list.
let SEQ = 0;
const uid = (p) => p + Date.now().toString(36) + (SEQ++ % 1296).toString(36).padStart(2, '0') + Math.random().toString(36).slice(2, 7);
const str = (v, n = 300) => String(v == null ? '' : v).trim().slice(0, n);
const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const EMAIL = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]+$/;
export const isS0 = (rec) => !!(rec && S0_TYPES.includes(rec.type) && !rec.imported);
export const baseRef = (ref) => String(ref || '').replace(/\s+Rev\s+\d+$/i, '');

let ready = false;
export async function ensureS0(env) {
  if (ready) return true;
  await ensureRecordsTable(env);
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS record_comments (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, ref TEXT NOT NULL, rev INTEGER, source TEXT,
         text TEXT, about TEXT, discipline TEXT, by TEXT, at TEXT,
         state TEXT, answer TEXT, answered_by TEXT, answered_at TEXT, from_ref TEXT)`
    ).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_record_comments ON record_comments(project_id, ref)').run();
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS reply_reads (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, ref TEXT, sha256 TEXT, reader TEXT, filename TEXT,
         proposal TEXT, confirmed TEXT, by TEXT, at TEXT)`
    ).run();
    await addColumns(env, 'projects', [['issue_to', 'TEXT'], ['issue_cc', 'TEXT']]);
    ready = true;
    return true;
  } catch (e) { return false; }
}

/* ------------------------------------------------------------ status */

function issueIndex(rec) {
  const wf = rec.workflow || [];
  let i = wf.findIndex((s) => s && s.issue);
  if (i < 0) { const t = RECORD_TYPES[rec.type]; if (t && t.wf.length === wf.length) i = t.wf.findIndex((s) => s.issue); }
  return i;
}
export function s0Status(rec) {
  if (!isS0(rec)) return rec.status;
  if (rec.code) return CODES[rec.code] || rec.status;
  if (rec.returned) return 'Returned to Design';
  const ii = issueIndex(rec), step = rec.step || 0;
  if (ii >= 0 && step >= ii) return 'Issued for approval' + (rec.issued_on ? ' ' + rec.issued_on : '');
  if (ii >= 0 && step === ii - 1) return 'Approved internally';
  return 'Prepared';
}
async function setStatus(env, pid, ref, extra = {}) {
  const rec = await getRecord(env, pid, ref);
  if (!rec) return null;
  const merged = { ...rec, ...extra };
  const status = s0Status(merged);
  const cls = merged.code ? ({ A: 'ok', B: 'ok', answered: 'ok', C: 'warn', D: 'late' }[merged.code] || 'ok') : merged.returned ? 'warn' : rec.cls;
  await env.DB.prepare('UPDATE records SET status = ?, cls = ?, updated_at = ? WHERE project_id = ? AND ref = ?').bind(status, cls, nowISO(), pid, ref).run();
  return status;
}
export async function afterAdvance(env, pid, ref) {
  const rec = await getRecord(env, pid, ref);
  if (isS0(rec)) return setStatus(env, pid, ref);
  return null;
}

/* ------------------------------------------------------------ comments */

export async function listComments(env, pid, ref) {
  await ensureS0(env);
  const { results } = await env.DB.prepare('SELECT * FROM record_comments WHERE project_id = ? AND ref = ? ORDER BY at, id').bind(pid, ref).all();
  return results || [];
}
export async function openComments(env, pid, ref) {
  return (await listComments(env, pid, ref)).filter((c) => c.state === 'open');
}
async function addComment(env, pid, ref, c, who) {
  await env.DB.prepare(`INSERT INTO record_comments (id, project_id, ref, rev, source, text, about, discipline, by, at, state, from_ref)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(uid('cm_'), pid, ref, c.rev || 0, c.source, str(c.text, 2000), str(c.about, 120) || null,
    str(c.discipline, 60) || null, str(who, 120), nowISO(), c.state || 'open', c.from_ref || null).run();
}

// Design answers each comment — or says why it does not apply. Both need words.
export async function answerComment(env, pid, ref, id, body, who) {
  await ensureS0(env);
  const c = await env.DB.prepare('SELECT * FROM record_comments WHERE project_id = ? AND ref = ? AND id = ?').bind(pid, ref, String(id || '')).first();
  if (!c) return { error: 'no such comment on ' + ref };
  const answer = str(body && body.answer, 1000);
  if (!answer) return { error: 'say what was changed for this comment — or why it does not apply' };
  await env.DB.prepare('UPDATE record_comments SET state = ?, answer = ?, answered_by = ?, answered_at = ? WHERE id = ?')
    .bind(body.not_applicable ? 'not applicable' : 'answered', answer, str(who, 120), nowISO(), c.id).run();
  await setStatus(env, pid, ref);
  return { ok: true, open: (await openComments(env, pid, ref)).length };
}

/* ------------------------------------------------------------ step 3: returned to Design */

export async function returnToDesign(env, pid, rec, note, who) {
  await ensureS0(env);
  const n = str(note, 1000);
  if (!n) return { error: 'say what Design must change — it goes back to them with your comment' };
  await env.DB.prepare('UPDATE records SET returned = 1 WHERE project_id = ? AND ref = ?').bind(pid, rec.ref).run();
  await addComment(env, pid, rec.ref, { rev: rec.rev, source: 'internal', text: n }, who);
  const status = await setStatus(env, pid, rec.ref);
  return { ok: true, ref: rec.ref, status, returned: true };
}

// Design revises: the title and the form's fields may change; every internal
// comment is answered with what changed; it goes back to the step it was at.
export async function resubmit(env, pid, rec, body, who) {
  await ensureS0(env);
  if (!rec.returned) return { error: rec.ref + ' has not been returned — there is nothing to resubmit' };
  const note = str(body && body.note, 1000);
  if (!note) return { error: 'say what was changed — the PM reads it with the resubmission' };
  const data = { ...(rec.data || {}), ...((body && body.data && typeof body.data === 'object') ? body.data : {}) };
  const title = str(body && body.title, 200) || rec.title;
  await env.DB.prepare('UPDATE records SET returned = 0, data = ?, title = ?, updated_at = ? WHERE project_id = ? AND ref = ?')
    .bind(JSON.stringify(data), title, nowISO(), pid, rec.ref).run();
  for (const c of await openComments(env, pid, rec.ref)) {
    if (c.source !== 'internal') continue;
    await env.DB.prepare("UPDATE record_comments SET state = 'answered', answer = ?, answered_by = ?, answered_at = ? WHERE id = ?").bind(note, str(who, 120), nowISO(), c.id).run();
  }
  const status = await setStatus(env, pid, rec.ref);
  return { ok: true, ref: rec.ref, status };
}

/* ------------------------------------------------------------ step 4: issued */

export async function issueList(env, pid) {
  await ensureS0(env);
  const p = await env.DB.prepare('SELECT issue_to, issue_cc FROM projects WHERE id = ?').bind(pid).first();
  const parse = (v) => { try { return JSON.parse(v || '[]') || []; } catch (e) { return []; } };
  let to = parse(p && p.issue_to), cc = parse(p && p.issue_cc);
  let fromParty = false;
  if (!to.length) {
    try {
      const c = await env.DB.prepare("SELECT contact_email FROM project_parties WHERE project_id = ? AND role IN ('consultant','engineer') AND contact_email IS NOT NULL AND contact_email <> '' LIMIT 1").bind(pid).first();
      if (c && c.contact_email) { to = [c.contact_email]; fromParty = true; }
    } catch (e) { /* no parties */ }
  }
  return { to, cc, to_from_party: fromParty };
}
export function cleanAddresses(list) {
  const raw = (Array.isArray(list) ? list : String(list || '').split(/[,;\s]+/)).map((x) => String(x || '').trim()).filter(Boolean);
  const bad = raw.filter((x) => !EMAIL.test(x));
  const ok = [...new Set(raw.filter((x) => EMAIL.test(x)).map((x) => x.toLowerCase()))];
  return { ok, bad };
}
export async function setIssueList(env, pid, body) {
  await ensureS0(env);
  const to = cleanAddresses(body.to), cc = cleanAddresses(body.cc);
  if (to.bad.length || cc.bad.length) return { error: 'not email addresses: ' + to.bad.concat(cc.bad).join(', ') };
  if (to.ok.length + cc.ok.length > MAX_RECIPIENTS) return { error: 'at most ' + MAX_RECIPIENTS + ' addresses on an issue' };
  await env.DB.prepare('UPDATE projects SET issue_to = ?, issue_cc = ? WHERE id = ?').bind(JSON.stringify(to.ok), JSON.stringify(cc.ok), pid).run();
  return { ok: true, to: to.ok, cc: cc.ok };
}

//   ctx: { who, me, project, mailer(to, subject, html, opts), emailOn,
//          formFor(rec) → { filename, contentType, bytes } | null,
//          attachment(id) → { filename, mime, bytes } | null }
export async function issueRecord(env, pid, rec, body, ctx) {
  await ensureS0(env);
  const next = pendingStep(rec);
  if (!next || !next.issue) return { error: rec.ref + ' is not waiting to be issued' };
  if (rec.returned) return { error: rec.ref + ' was returned to Design — it is issued after it is resubmitted and approved' };
  const date = todayUAE();
  if (body && body.outside) {
    const note = str(body.note, 300);
    if (!note) return { error: 'say how it was issued (for example: hand-delivered with transmittal T-014)' };
    const r = await advanceRecord(env, pid, { ref: rec.ref, action: 'advance' }, ctx.who, { project: ctx.project });
    if (r.error) return r;
    await env.DB.prepare('UPDATE records SET issued_on = ?, issued_to = ? WHERE project_id = ? AND ref = ?')
      .bind(date, JSON.stringify({ outside: true, note, by: ctx.who, at: nowISO() }), pid, rec.ref).run();
    return { ok: true, ref: rec.ref, status: await setStatus(env, pid, rec.ref), outside: true, due: r.due };
  }
  if (!ctx.emailOn) return { error: 'Email is not set up on this platform, so it cannot be sent from here. Issue it by hand and record it as issued outside the platform.', email_off: true };
  const list = await issueList(env, pid);
  const to = cleanAddresses(body && body.to != null ? body.to : list.to), cc = cleanAddresses(body && body.cc != null ? body.cc : list.cc);
  if (to.bad.length || cc.bad.length) return { error: 'not email addresses: ' + to.bad.concat(cc.bad).join(', ') };
  if (!to.ok.length) return { error: 'who is it going to? Set the consultant’s address (To) for this project, or type it here' };
  if (to.ok.length + cc.ok.length > MAX_RECIPIENTS) return { error: 'at most ' + MAX_RECIPIENTS + ' addresses on an issue' };
  // The files: the consultant's form, filled and signed, and what DC chose.
  const files = [];
  const form = ctx.formFor ? await ctx.formFor(rec) : null;
  if (form && form.bytes) files.push({ filename: form.filename, contentType: form.contentType, bytes: form.bytes });
  for (const id of Array.isArray(body && body.attachments) ? body.attachments : []) {
    const a = ctx.attachment ? await ctx.attachment(String(id)) : null;
    if (!a) return { error: 'an attachment chosen for the issue is not on ' + rec.ref };
    files.push({ filename: a.filename, contentType: a.mime, bytes: a.bytes });
  }
  const size = files.reduce((s, f) => s + f.bytes.length, 0);
  if (size > MAX_ISSUE_BYTES) {
    return { error: 'the files come to ' + (size / 1048576).toFixed(1) + ' MB and an email takes ' + (MAX_ISSUE_BYTES / 1048576) + ' MB. Send fewer attachments with this issue, or issue it by hand and record it as issued outside the platform.',
      too_big: true, files: files.map((f) => ({ filename: f.filename, mb: +(f.bytes.length / 1048576).toFixed(2) })) };
  }
  const project = ctx.project || {};
  const subject = rec.ref + ' — ' + rec.title + ' — for ' + (rec.type === 'rfi' ? 'your reply' : (rec.type === 'wir' || rec.type === 'mir') ? 'inspection' : 'approval') + ' (' + (project.name || '') + ')';
  const html = '<p>Dear Sir / Madam,</p><p>Please find ' + esc(rec.ref) + ' — <b>' + esc(rec.title) + '</b>' + (rec.rev ? ' (revision ' + rec.rev + ')' : '')
    + ' submitted for your ' + (rec.type === 'rfi' ? 'reply' : (rec.type === 'wir' || rec.type === 'mir') ? 'inspection' : 'review and approval') + ' on ' + esc(project.name || 'the project') + '.</p>'
    + '<table cellpadding="4" style="border-collapse:collapse;font:13px Arial">'
    + '<tr><td><b>Reference</b></td><td>' + esc(rec.ref) + '</td></tr><tr><td><b>Subject</b></td><td>' + esc(rec.title) + '</td></tr>'
    + '<tr><td><b>Issued</b></td><td>' + date + '</td></tr>'
    + (files.length ? '<tr><td valign="top"><b>Enclosed</b></td><td>' + files.map((f) => esc(f.filename)).join('<br>') + '</td></tr>' : '') + '</table>'
    + '<p>Kind regards,<br>' + esc(ctx.who) + '<br>Document Control, ' + esc(project.contractor_name || '') + '</p>';
  const sent = await ctx.mailer(to.ok, subject, html, { cc: cc.ok, attachments: files, fromName: ctx.who + ' (Document Control) via AETRAA',
    replyTo: ctx.me && ctx.me.email ? ctx.me.email : undefined });
  if (!sent || !sent.ok) return { error: 'The email was not sent: ' + ((sent && sent.error) || 'unknown') + '. Nothing was marked as issued.', send_failed: true };
  const r = await advanceRecord(env, pid, { ref: rec.ref, action: 'advance' }, ctx.who, { project: ctx.project });
  if (r.error) return r;
  await env.DB.prepare('UPDATE records SET issued_on = ?, issued_to = ? WHERE project_id = ? AND ref = ?')
    .bind(date, JSON.stringify({ to: to.ok, cc: cc.ok, files: files.map((f) => f.filename), by: ctx.who, at: nowISO() }), pid, rec.ref).run();
  return { ok: true, ref: rec.ref, status: await setStatus(env, pid, rec.ref), sent: { to: to.ok, cc: cc.ok, files: files.map((f) => f.filename) }, due: r.due };
}

/* ------------------------------------------------------------ steps 5–6: the reply */

export function codeOf(raw, type) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^answer/i.test(s)) return 'answered';
  const m = s.match(/^(?:code\s*)?([ABCD])\b/i);
  if (m) return m[1].toUpperCase();
  if (/approved as noted|approved with comments/i.test(s)) return 'B';
  if (/revise|resubmit/i.test(s)) return 'C';
  if (/reject/i.test(s)) return 'D';
  if (/^approved/i.test(s)) return 'A';
  return null;
}

//   body: { code, replied_on, comments: [{ text, about, discipline }], attachment_id }
export async function recordReply(env, pid, rec, body, ctx) {
  await ensureS0(env);
  const next = pendingStep(rec);
  if (!next || !next.reply) return { error: rec.ref + ' is not waiting for the consultant’s reply' };
  const code = codeOf(body && body.code, rec.type);
  if (rec.type === 'rfi' ? !['answered', 'A', 'B', 'C', 'D'].includes(code) : !['A', 'B', 'C', 'D'].includes(code)) {
    return { error: rec.type === 'rfi' ? 'record the RFI as Answered' : 'the code must be A, B, C or D' };
  }
  const replied = String((body && body.replied_on) || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(replied)) return { error: 'enter the date of the consultant’s reply' };
  if (replied > todayUAE()) return { error: 'the reply date is after today' };
  if (rec.issued_on && replied < rec.issued_on) return { error: 'the reply date is before ' + rec.ref + ' was issued (' + rec.issued_on + ')' };
  const comments = (Array.isArray(body && body.comments) ? body.comments : []).map((c) => (typeof c === 'string' ? { text: c } : c)).filter((c) => c && str(c.text));
  if ((code === 'C' || code === 'D') && !comments.length) return { error: 'a Code ' + code + ' comes with the consultant’s comments — enter them; they become Design’s checklist for the next revision' };
  const r = await advanceRecord(env, pid, { ref: rec.ref, action: 'advance', status: CODES[code] }, ctx.who, { project: ctx.project });
  if (r.error) return r;
  await env.DB.prepare('UPDATE records SET code = ?, replied_on = ? WHERE project_id = ? AND ref = ?').bind(code, replied, pid, rec.ref).run();
  for (const c of comments) await addComment(env, pid, rec.ref, { rev: rec.rev, source: 'consultant', text: c.text, about: c.about, discipline: c.discipline, state: code === 'B' ? 'kept' : code === 'A' || code === 'answered' ? 'kept' : 'carried' }, ctx.who);
  const status = await setStatus(env, pid, rec.ref);
  // C or D: the next revision, the comments its checklist.
  let revision = null;
  if (code === 'C' || code === 'D') {
    const nextRev = (rec.rev || 0) + 1;
    const base = baseRef(rec.ref);
    const newRef = base + ' Rev ' + nextRev;
    const exists = await getRecord(env, pid, newRef);
    if (!exists) {
      const data = { ...(rec.data || {}) };
      for (const k of ['Required reply by', 'Reply needed by', 'Required approval by', 'Needed by', 'Required issue by']) delete data[k];
      const made = await createRecord(env, pid, { type: rec.type, title: rec.title, data }, rec.created_by || ctx.who, { project: ctx.project, workflow: ctx.workflow, labels: ctx.labels });
      if (made.error) return { ok: true, code, status, error_revision: made.error };
      const row = await env.DB.prepare('SELECT no FROM records WHERE project_id = ? AND ref = ?').bind(pid, base).first();
      await env.DB.prepare('UPDATE records SET ref = ?, no = ?, rev = ?, revision_of = ?, originator_id = ? WHERE project_id = ? AND ref = ?')
        .bind(newRef, row ? row.no : null, nextRev, rec.ref, rec.originator_id || null, pid, made.ref).run();
      for (const c of comments) await addComment(env, pid, newRef, { rev: nextRev, source: 'consultant', text: c.text, about: c.about, discipline: c.discipline, from_ref: rec.ref }, 'consultant');
      await setStatus(env, pid, newRef);
    }
    revision = newRef;
  }
  // The reply goes to the originator, the PM and the Cc list (S0 step 6).
  let told = null;
  if (ctx.emailOn && ctx.mailer) {
    const list = await issueList(env, pid);
    const people = [];
    if (rec.originator_id) {
      const u = await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(rec.originator_id).first().catch(() => null);
      if (u && u.email) people.push(u.email);
    }
    for (const e of ctx.pmEmails || []) people.push(e);
    const to = [...new Set(people.map((x) => x.toLowerCase()))];
    if (to.length) {
      const files = [];
      if (body.attachment_id && ctx.attachment) { const a = await ctx.attachment(String(body.attachment_id)); if (a) files.push({ filename: a.filename, contentType: a.mime, bytes: a.bytes }); }
      const sent = await ctx.mailer(to, rec.ref + ': ' + CODES[code] + ' — ' + rec.title,
        '<p>The consultant replied to <b>' + esc(rec.ref) + '</b> — ' + esc(rec.title) + ' on ' + replied + ': <b>' + esc(CODES[code]) + '</b>.</p>'
        + (comments.length ? '<p>Their comments:</p><ol>' + comments.map((c) => '<li>' + esc(c.text) + (c.about ? ' <i>(' + esc(c.about) + ')</i>' : '') + '</li>').join('') + '</ol>' : '')
        + (revision ? '<p><b>' + esc(revision) + '</b> is opened for the revision, with these comments as its checklist. The PM approves it once every comment is answered.</p>' : ''),
        { cc: list.cc, attachments: files }).catch(() => null);
      told = sent && sent.ok ? to.concat(list.cc) : null;
    }
  }
  return { ok: true, ref: rec.ref, code, status, replied_on: replied, comments: comments.length, revision, told };
}

/* ------------------------------------------------------------ E14: a returned form, read */

const TICK = /^\s*(x|✓|✔|√|☑|☒|■|●|•|yes|y)\s*$/i;
const TICK_IN = /[✓✔√☑☒■●]|^\s*\[\s*x\s*\]|^\s*x\s+/i;
const CONSULTANT = /consultant'?s?['’]?\s*(response|reply|comments?|use|review|action)|for (consultant|engineer)['’]?s?\s*use|by the (engineer|consultant)|engineer'?s? (response|comments?)/i;

// Read the code ticked, the reply date, the comments and the reference from a
// returned form laid out as cells (template-preview readSheet / template-word
// readWordSheet). Deterministic; nothing guessed: two ticks, no tick, or a date
// that reads two ways are reported, not resolved.
export function readReturnedSheet(sheet, opts = {}) {
  const cells = sheet.cells || {};
  const keys = Object.keys(cells).map((k) => k.split(':').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const at = (r, c) => (cells[r + ':' + c] ? String(cells[r + ':' + c].text || '') : '');
  const read = [];
  let from = 0;
  for (const [r, c] of keys) if (CONSULTANT.test(at(r, c))) { from = r; break; }
  read.push({ part: 'the consultant’s section', read: !!from, why: from ? 'from row ' + from : 'no consultant section found — the whole form was searched' });
  const inSec = keys.filter(([r]) => r >= from);
  // The code: an option whose own cell or neighbour carries a tick.
  const options = [];
  for (const [r, c] of inSec) {
    const t = at(r, c);
    const k = codeOf(t.replace(TICK_IN, '').replace(/^\s*[-–:.]\s*/, ''), opts.type);
    if (!k || k === 'answered' || t.length > 60) continue;
    if (!/code|approv|revise|resubmit|reject|^\s*\W?\s*[ABCD]\b/i.test(t)) continue;
    const ticked = TICK_IN.test(t) || TICK.test(at(r, c - 1)) || TICK.test(at(r, c + 1));
    options.push({ code: k, row: r, col: c, ticked });
  }
  const ticked = [...new Set(options.filter((o) => o.ticked).map((o) => o.code))];
  let code = null, codeWhy;
  if (ticked.length === 1) { code = ticked[0]; codeWhy = 'Code ' + code + ' is ticked'; }
  else if (ticked.length > 1) codeWhy = 'more than one code is ticked (' + ticked.join(', ') + ') — DC decides';
  else codeWhy = options.length ? 'no code is ticked' : 'no code options were found on the form';
  read.push({ part: 'the code', read: !!code, why: codeWhy });
  // The reply date: the cell beside (or under) a "Date" label in the section.
  let replied = null, dateWhy = 'no date in the consultant’s section';
  for (const [r, c] of inSec) {
    if (!/^\s*date\b/i.test(at(r, c))) continue;
    const raw = at(r, c + 1) || at(r + 1, c);
    if (!raw.trim()) continue;
    const d = readDate(raw, { date1904: opts.date1904 });
    if (d.date) { replied = d.date; dateWhy = 'read as ' + d.date; }
    else if (d.both) dateWhy = '"' + raw + '" reads as ' + d.both[0] + ' or ' + d.both[1] + ' — DC decides';
    else dateWhy = '"' + raw + '" is not a date';
    break;
  }
  read.push({ part: 'the reply date', read: !!replied, why: dateWhy });
  // The comments: the box beside or under a "Comments / Remarks" label.
  const comments = [];
  for (const [r, c] of inSec) {
    if (!/^\s*(comments?|remarks?|observations?)\b/i.test(at(r, c))) continue;
    const raw = (at(r, c + 1).trim() ? at(r, c + 1) : at(r + 1, c)).trim();
    for (const line of raw.split(/\n|(?=\s\d{1,2}[.)]\s)/)) {
      const t = line.replace(/^\s*\d{1,2}[.)]\s*/, '').trim();
      if (t) comments.push({ text: t });
    }
    break;
  }
  read.push({ part: 'the comments', read: comments.length > 0, why: comments.length ? comments.length + ' comment' + (comments.length === 1 ? '' : 's') : 'none written' });
  // The reference, where the form's own reference field is.
  let refRead = '';
  const refCell = (opts.fields || []).find((f) => f.token === 'ref');
  if (refCell) {
    const m = String(refCell.cell).match(/^([A-Z]+)(\d+)$/);
    if (m) { const col = m[1].split('').reduce((s, ch) => s * 26 + ch.charCodeAt(0) - 64, 0); refRead = at(Number(m[2]), col).trim(); }
  }
  if (!refRead) {
    for (const [r, c] of keys) if (/\bref(erence)?\.?\s*(no|number)?\s*:?\s*$/i.test(at(r, c)) || /^(rfi|sub(mittal)?|mar|ms)\s*(no|ref)\.?\s*:?\s*$/i.test(at(r, c))) { refRead = at(r, c + 1).trim(); if (refRead) break; }
  }
  const refOk = !!refRead && baseRef(refRead).toLowerCase() === baseRef(opts.ref || '').toLowerCase();
  read.push({ part: 'the reference', read: !!refRead, why: refRead ? (refOk ? refRead + ' — this record' : refRead + ' is not ' + opts.ref) : 'no reference found on the form' });
  return { code, replied_on: replied, comments, ref_read: refRead || null, ref_ok: refOk, read, reader: E14_READER };
}

export async function keepReplyRead(env, pid, ref, sha, filename, proposal, who) {
  await ensureS0(env);
  const id = uid('rr_');
  await env.DB.prepare('INSERT INTO reply_reads (id, project_id, ref, sha256, reader, filename, proposal, by, at) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(id, pid, ref, sha, E14_READER, str(filename, 200), JSON.stringify(proposal), str(who, 120), nowISO()).run();
  return id;
}
export async function confirmReplyRead(env, pid, id, confirmed) {
  await env.DB.prepare('UPDATE reply_reads SET confirmed = ? WHERE project_id = ? AND id = ?').bind(JSON.stringify(confirmed), pid, String(id || '')).run();
}
