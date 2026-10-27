// The records engine.
//
// One table behind every register/workflow window in the app: submittals,
// material submittals, RFIs, inspection requests (WIR/MIR), NCRs, variations,
// contractual letters, permits, HSE observations, incidents, material requests
// and authority approvals. Each record is numbered per project+type (SUB-0001,
// RFI-0001, VO-0001 …), carries the form data, and moves through a workflow
// ladder. This is what makes the design's "create → register → open → approve"
// loop real instead of sample.

import { FUNCTIONS } from './functions.js';
import { addColumns } from './db-cols.js';

const nowISO = () => new Date().toISOString();
// Local UAE time, to the minute: '2026-09-21 14:05'.
const stamp = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 16).replace('T', ' ');

// type -> { prefix, register bucket the design shows it in, workflow }
//
// Every step of every workflow has an OWNER — the function(s) whose act that
// step is. Only they may move a record past it (the Principal and the PM may
// act on any step, as the people who run the job). So the engineer who raises
// an RFI cannot also sign "PM approves", and nobody can mark something issued
// except Document Control.
//
// The platform is not connected to the consultant. Everything that leaves the
// contractor leaves through Document Control: after the PM approves, DC issues
// it (step marked issue:true — DC is then offered to notify the team), and when
// the consultant replies by letter or email DC records the reply and its code.
//
// The workflow is always this one. Whatever a browser sends is ignored.
const S = (st, by, extra) => Object.assign({ st, by }, extra || {});
const DC_ISSUE = (st) => S(st || 'Document Control issues', ['dc'], { issue: true });
const DC_REPLY = (st) => S(st || 'Consultant reply recorded by DC', ['dc'], { reply: true });

export const RECORD_TYPES = {
  submittal:  { prefix: 'SUB', reg: 'submittals', pad: 3, wf: [
    S('Prepared', ['design']), S('PM approves to submit', ['pm']),
    DC_ISSUE('Document Control issues to consultant'), DC_REPLY('Consultant status recorded (Code A/B/C)')] },
  ms:         { prefix: 'MS',  reg: 'submittals', pad: 3, wf: [
    S('Method statement prepared', ['site', 'design', 'qaqc', 'hse']), S('QA/QC & HSE review', ['qaqc', 'hse']),
    S('PM approves to submit', ['pm']), DC_ISSUE('Document Control issues to consultant'),
    DC_REPLY('Consultant status recorded (Code A/B/C)')] },
  // K12 (v5 A7, 5 Oct 2026): no QA/QC step for now — the PM can add one to
  // the project's material ladder (material-package.js setMaterialQaqc).
  material:   { prefix: 'MAR', reg: 'matapp',     pad: 3, wf: [
    S('Submitted', ['design']), S('PM approves to submit', ['pm']),
    DC_ISSUE('Document Control issues to consultant'), DC_REPLY('Consultant approval recorded')] },
  rfi:        { prefix: 'RFI', reg: 'rfi',        pad: 4, wf: [
    S('Raised', ['design', 'site', 'qaqc', 'planning', 'commercial']), S('PM approves to issue', ['pm']),
    DC_ISSUE('Document Control issues to consultant'), DC_REPLY('Consultant answer recorded')] },
  // An instruction given by word of mouth on site, written down and sent back
  // to the Engineer for his signature. It is the document that turns "he told
  // us to do it" into something a variation can be built on, so it is raised
  // the same day and chased like an RFI.
  cvi:        { prefix: 'CVI', reg: 'letters',    pad: 3, wf: [
    S('Instruction written down', ['site', 'design', 'qaqc']), S('PM approves to issue', ['pm']),
    DC_ISSUE('Document Control issues to consultant'), DC_REPLY('Consultant confirmation recorded')] },
  authority:  { prefix: 'AUTH',reg: 'authority',  pad: 3, wf: [
    S('Prepared', ['design']), S('PM approves to submit', ['pm']),
    DC_ISSUE('Document Control submits to authority'), S('Under review', ['dc', 'design']),
    DC_REPLY('Approval / NOC recorded')] },
  letter:     { prefix: 'LTR', reg: 'letters',    pad: 3, wf: [
    S('Drafted', ['design', 'commercial']), S('PM / Director signs', ['pm', 'principal']),
    DC_ISSUE('Document Control issues & logs')] },
  // STEP 7 — a letter, instruction or email received from outside (the
  // Engineer, the client, an authority). Document Control logs it; the second
  // step belongs to whoever it was sent to for action, and is signed either by
  // a reply letter being issued (automatically) or by closing it with a reason.
  incoming:   { prefix: 'IN',  reg: 'letters',    pad: 3, wf: [
    S('Logged by Document Control', ['dc', 'pm']), S('Reply issued or closed', ['pm', 'dc'])] },
  variation:  { prefix: 'VO',  reg: 'variations', pad: 2, wf: [
    S('Priced by QS', ['commercial']), S('PM review', ['pm']), S('Director approval', ['principal']),
    DC_ISSUE('Document Control issues to client'), S('Client instruction recorded', ['commercial', 'dc'])] },
  wir:        { prefix: 'WIR', reg: 'inspections',pad: 3, wf: [
    S('Raised by engineer', ['site', 'qaqc']), S('QA/QC checks work ready', ['qaqc']),
    DC_ISSUE('Document Control issues to consultant'), DC_REPLY('Inspection result recorded by Document Control')] },
  mir:        { prefix: 'MIR', reg: 'inspections',pad: 3, wf: [
    S('Raised', ['qaqc', 'site']), S('QA/QC inspects delivery', ['qaqc']),
    DC_ISSUE('Document Control issues to consultant'), DC_REPLY('Inspection result recorded by Document Control')] },
  ncr:        { prefix: 'NCR', reg: 'ncr',        pad: 3, wf: [
    S('Raised by QA/QC', ['qaqc']), S('Site rectifies', ['site']), S('QA/QC verifies & closes', ['qaqc'])] },
  ptw:        { prefix: 'PTW', reg: 'permits',    pad: 3, wf: [
    S('Requested by site', ['site', 'hse']), S('HSE review & sign', ['hse']), S('Work proceeds', ['site']),
    S('HSE closes out at end of shift', ['hse'])] },
  obs:        { prefix: 'OBS', reg: 'hseobs',     pad: 3, wf: [
    S('Raised by HSE', ['hse']), S('Assigned to site', ['hse']), S('Rectified', ['site']), S('HSE verifies & closes', ['hse'])] },
  incident:   { prefix: 'INC', reg: 'hseobs',     pad: 3, wf: [
    S('Reported', ['hse', 'site']), S('Investigation', ['hse']), S('Corrective action', ['site', 'hse']),
    S('Closed & recorded', ['hse'])] },
  mr:         { prefix: 'MR',  reg: 'mr',         pad: 3, wf: [
    S('Raised by site', ['site']), S('PM reviews (checks BOM)', ['pm']), S('Procurement raises LPO', ['procurement'])] },
  // Third-party certificates, operator licences and inspection tags. Held as
  // records so each one carries its own certificate PDF as an attachment, and
  // so an expiry date is a date the platform can act on rather than a note in
  // somebody's folder.
  cert:       { prefix: 'CERT',reg: 'certs',      pad: 3, wf: [
    S('Logged', ['hse']), S('Checked by HSE', ['hse']), S('Valid on site', ['hse'])] },
};

/* ------------------------------------------------------------- due dates
 *
 * How long each kind of document may take, in CALENDAR days, unless the person
 * raising it enters a date. Set per project (AETRAA Admin → Response periods);
 * these are the defaults. The RFI period is the project's own "RFI reply
 * (days)" from set-up, when one was entered.
 *
 *   consultant  — from the day Document Control ISSUES it: the consultant's reply
 *   internal    — from the day it is RAISED: closing it out inside the team
 */
export const RESPONSE_DEFAULTS = {
  rfi:       { days: 7,  from: 'issue',  what: 'consultant reply' },
  submittal: { days: 14, from: 'issue',  what: 'consultant review' },
  ms:        { days: 14, from: 'issue',  what: 'consultant review' },
  material:  { days: 14, from: 'issue',  what: 'consultant approval' },
  cvi:       { days: 7,  from: 'issue',  what: 'consultant confirmation' },
  authority: { days: 30, from: 'issue',  what: 'authority approval' },
  letter:    { days: 14, from: 'issue',  what: 'reply' },
  incoming:  { days: 7,  from: 'received', what: 'our reply' },
  variation: { days: 28, from: 'issue',  what: 'client instruction' },
  wir:       { days: 1,  from: 'issue',  what: 'inspection' },
  mir:       { days: 1,  from: 'issue',  what: 'inspection' },
  ncr:       { days: 7,  from: 'raised', what: 'close-out' },
  obs:       { days: 3,  from: 'raised', what: 'close-out' },
  incident:  { days: 7,  from: 'raised', what: 'investigation' },
  ptw:       { days: 1,  from: 'raised', what: 'sign-off' },
  mr:        { days: 3,  from: 'raised', what: 'LPO' },
};
export function responseDays(project, type) {
  const base = RESPONSE_DEFAULTS[type];
  if (!base) return null;
  let over = {};
  try { over = JSON.parse((project && project.response_days) || '{}') || {}; } catch (e) { over = {}; }
  let days = base.days;
  if (type === 'rfi' && project && Number(project.reply_days) > 0) days = Number(project.reply_days);
  if (Number(over[type]) > 0) days = Number(over[type]);
  return { days, from: base.from, what: base.what };
}
const addDays = (iso, n) => new Date(Date.parse(iso.slice(0, 10) + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const todayUAE = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);

// The step a record is waiting on: { i, st, by, issue, reply } — or null when
// it is closed. A record made before steps had owners borrows them from its
// type's workflow when the ladder is the same length.
export function pendingStep(rec) {
  if (!rec) return null;
  const wf = rec.workflow || [];
  const i = (rec.step || 0) + 1;
  if (i >= wf.length) return null;
  if (/closed|approved|rejected/i.test(rec.status || '') && !wf[i]) return null;
  const step = wf[i] || {};
  let by = Array.isArray(step.by) ? step.by : null;
  const t = RECORD_TYPES[rec.type];
  if (!by && t && t.wf.length === wf.length) by = t.wf[i].by;
  const tpl = t && t.wf.length === wf.length ? t.wf[i] : {};
  return { i, st: step.st || tpl.st || '', by: by || null, issue: !!(step.issue || tpl.issue), reply: !!(step.reply || tpl.reply) };
}

// Everyone who acts somewhere after raising — for "who approves this" in words.
export function approverFunctions(type) {
  const t = RECORD_TYPES[type];
  if (!t) return [];
  const out = [];
  t.wf.slice(1).forEach((s) => s.by.forEach((f) => { if (!out.includes(f)) out.push(f); }));
  return out;
}

// The pill colour for a workflow position: last step done = ok, first = warn, middle = wp.
function clsForStep(step, total, closed) {
  if (closed || step >= total - 1) return 'ok';
  if (step <= 0) return 'warn';
  return 'wp';
}

// Columns added after the table was first made, through addColumns (rule 4),
// once per process:
//   due_basis        how a due date was arrived at
//   K5 (spec §3, §17) — a record brought in from the old system:
//   imported         1: not raised on this platform. Created closed, status
//                    'Imported', no pending step, no owner, no due date, so no
//                    clock anywhere counts it.
//   imported_from    where it came from (the log file, sheet and row, the
//                    file's SHA-256 and the reader), as JSON or text
//   original_date    the day it was raised in the old system — a fact
//   original_status  what the old system said it was — a fact, never a state
//   continues        on a live record: the imported record it takes over
//   continued_by     on an imported record: the live record that took it over
let colsReady = false;
const RECORD_COLS = [['due_basis', 'TEXT'], ['imported', 'INTEGER'], ['imported_from', 'TEXT'],
  ['original_date', 'TEXT'], ['original_status', 'TEXT'], ['continues', 'TEXT'], ['continued_by', 'TEXT'],
  // K7 (S0, src/s0.js)
  ['code', 'TEXT'], ['replied_on', 'TEXT'], ['rev', 'INTEGER'], ['revision_of', 'TEXT'], ['originator_id', 'TEXT'],
  ['issued_to', 'TEXT'], ['issued_on', 'TEXT'], ['returned', 'INTEGER']];
// The added columns on a table that already exists — for a reader that must
// not create the table as a side effect (a report on a project with no records).
export async function ensureRecordColumns(env) {
  if (!colsReady) colsReady = await addColumns(env, 'records', RECORD_COLS);
  return colsReady;
}
export async function ensureRecordsTable(env) {
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS records (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, type TEXT NOT NULL,
         no INTEGER, ref TEXT, title TEXT, status TEXT, cls TEXT,
         data TEXT, workflow TEXT, step INTEGER DEFAULT 0,
         due TEXT, submitted TEXT, created_by TEXT, created_at TEXT, updated_at TEXT, due_basis TEXT)`
    ).run();
    await ensureRecordColumns(env);
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_records_pt ON records(project_id, type)`).run();
    return true;
  } catch (e) { return false; }
}

export async function listRecords(env, pid, type) {
  try {
    const q = type
      ? env.DB.prepare(`SELECT * FROM records WHERE project_id = ? AND type = ? ORDER BY id DESC`).bind(pid, type)
      : env.DB.prepare(`SELECT * FROM records WHERE project_id = ? ORDER BY id DESC`).bind(pid);
    const { results } = await q.all();
    return (results || []).map(shape);
  } catch (e) { return null; } // null => not migrated
}

export async function getRecord(env, pid, ref) {
  try {
    const r = await env.DB.prepare(`SELECT * FROM records WHERE project_id = ? AND ref = ?`).bind(pid, ref).first();
    return r ? shape(r) : null;
  } catch (e) { return null; }
}

function shape(r) {
  let data = {}, wf = [];
  try { data = JSON.parse(r.data || '{}'); } catch (e) {}
  try { wf = JSON.parse(r.workflow || '[]'); } catch (e) {}
  let from = r.imported_from || null;
  try { if (from && /^\{/.test(from)) from = JSON.parse(from); } catch (e) { /* kept as text */ }
  return {
    id: r.id, type: r.type, ref: r.ref, title: r.title,
    status: r.status, cls: r.cls, step: r.step || 0,
    due: r.due || null, due_basis: r.due_basis || null, sub: r.submitted || null,
    data, workflow: wf, created_by: r.created_by, created_at: r.created_at,
    imported: !!Number(r.imported || 0),
    ...(Number(r.imported || 0) ? { imported_from: from, original_date: r.original_date || null, original_status: r.original_status || null } : {}),
    continues: r.continues || null, continued_by: r.continued_by || null,
    // K7 (S0): the consultant's code and reply date, the revision, who raised
    // it, where and when it was issued, and whether the PM sent it back.
    code: r.code || null, replied_on: r.replied_on || null, rev: Number(r.rev || 0), revision_of: r.revision_of || null,
    originator_id: r.originator_id || null, issued_on: r.issued_on || null, returned: !!Number(r.returned || 0),
    issued_to: (() => { try { return r.issued_to ? JSON.parse(r.issued_to) : null; } catch (e) { return null; } })(),
  };
}

/* ------------------------------------------------- K5: imported records
 *
 * Spec §3 and §17, and the decision for K5: a record brought in from the old
 * system arrives CLOSED. Status 'Imported'; the old system's status and dates
 * kept as facts; no pending step, no step owner, no due date, no reply-by.
 * Every clock — Needs my attention, overdue counts, the register's Days late,
 * the weekly and monthly figures, HSE statistics, the IPC — skips it, because
 * a clock on an imported record would report the old system's delays as this
 * project's. It keeps its own reference, and the platform's next number for
 * that kind is above it. When a matter is still live, Document Control takes it
 * over as a new record on this platform, linked to the old one, with a fresh
 * clock from today.
 */
export const IMPORTED_STATUS = 'Imported';
export const IMPORTED_MARK = 'imported — not raised on this platform';

// The number in an imported reference that the platform's own numbering must
// stay above: the last group of digits, when the reference names this kind's
// prefix ("RFI-0042", "J179-RFI-ARC-0042", "RFI 42 Rev 1" → 42). A reference
// with no prefix of this kind ("0042", "MA-17" for an RFI) sets nothing.
export function importedNumber(type, ref) {
  const t = RECORD_TYPES[type];
  if (!t) return null;
  const s = String(ref || '').toUpperCase().replace(/\s+REV(ISION)?\.?\s*\w+$/, '');
  if (!new RegExp('(^|[^A-Z])' + t.prefix + '([^A-Z]|$)').test(s)) return null;
  const m = s.match(/(\d+)(?!.*\d)/);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 && n < 1e7 ? n : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const IMPORTED_REFUSAL = (rec) => rec.ref + ' was imported from the old system — it was not raised on this platform and has no step to sign.'
  + (rec.continued_by ? ' It continues as ' + rec.continued_by + '.' : rec.type === 'incoming' ? ' Answer it with a reply letter that names it.' : ' Document Control can take it over as a new live record.');

// One record from the old system, created closed.
//   rec: { type, ref, title, data, original_date, original_status, imported_from }
export async function importRecord(env, pid, rec, who) {
  const r = rec || {};
  const t = RECORD_TYPES[r.type];
  if (!t) return { error: 'unknown record type' + (r.type ? ' "' + String(r.type).slice(0, 30) + '"' : '') };
  const ref = String(r.ref || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (!ref) return { error: 'every imported record needs the reference it had' };
  // Spec §18: a reference already on the project is never filed twice.
  const dup = await env.DB.prepare('SELECT ref, imported FROM records WHERE project_id = ? AND lower(ref) = lower(?)').bind(pid, ref).first().catch(() => null);
  if (dup) return { error: ref + ' is already on this project' + (Number(dup.imported) ? ' (imported before)' : ' (raised on this platform)') + ' — it is not filed twice.', duplicate: true };
  const od = String(r.original_date || '').slice(0, 10);
  if (od && !DATE_RE.test(od)) return { error: ref + ': the original date "' + String(r.original_date).slice(0, 20) + '" is not a date (YYYY-MM-DD).' };
  const data = (r.data && typeof r.data === 'object') ? r.data : {};
  const title = String(r.title || data.Subject || data.Title || data.Description || data.Material || ref).slice(0, 200);
  const from = r.imported_from == null ? null : (typeof r.imported_from === 'object' ? JSON.stringify(r.imported_from) : String(r.imported_from)).slice(0, 1000);
  const at = nowISO();
  // One step, done: nothing is waiting, so pendingStep() is null and the record is closed everywhere.
  const wf = [{ st: 'Imported — not raised on this platform', by: [], issue: false, reply: false,
    who: who || 'Document Control', state: 'done', when: stamp() }];
  const id = 'rec_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  try {
    await env.DB.prepare(
      `INSERT INTO records (id,project_id,type,no,ref,title,status,cls,data,workflow,step,due,submitted,created_by,created_at,updated_at,due_basis,
         imported,imported_from,original_date,original_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, pid, r.type, importedNumber(r.type, ref), ref, title, IMPORTED_STATUS, '', JSON.stringify(data), JSON.stringify(wf), 0,
           null, od || null, who || '', at, at, null, 1, from, od || null, String(r.original_status || '').slice(0, 120) || null).run();
  } catch (e) { return { error: 'could not save ' + ref + ': ' + (e && e.message || e) }; }
  return { ok: true, ref, record: await getRecord(env, pid, ref) };
}

// Many at once: each one filed or refused with its reason, and the highest
// reference found per kind (spec §17), which is where the platform's own
// numbering now continues from.
export async function importRecords(env, pid, list, who) {
  const imported = [], refused = [];
  for (const r of Array.isArray(list) ? list : []) {
    const out = await importRecord(env, pid, r, who);
    if (out.ok) imported.push(out.ref); else refused.push({ ref: (r && r.ref) || '', error: out.error, duplicate: !!out.duplicate });
  }
  const highest = {};
  try {
    const { results } = await env.DB.prepare('SELECT type, MAX(no) AS n FROM records WHERE project_id = ? AND imported = 1 GROUP BY type').bind(pid).all();
    for (const x of results || []) if (x.n) highest[x.type] = { highest: Number(x.n), next: RECORD_TYPES[x.type].prefix + '-' + String(Number(x.n) + 1).padStart(RECORD_TYPES[x.type].pad, '0') };
  } catch (e) { /* nothing imported */ }
  return { ok: imported.length > 0 || !refused.length, imported, refused, highest };
}

// Fields that set a due date when a record is raised. An imported record's
// dates are history: carried over, they would start the new record overdue.
const DUE_FIELDS = ['Required reply by', 'Reply needed by', 'Required approval by', 'Needed by', 'Valid until',
  'Required issue by', 'Inspection date', 'Inspection date & time', 'Reply by'];

// Document Control takes an imported matter over: a new live record on this
// platform, from the first step of this project's ladder, its clock started
// today, linked both ways to the imported one. An incoming letter is not taken
// over — it is answered by a reply letter that names it.
export async function takeOverRecord(env, pid, ref, who, opts) {
  const old = await getRecord(env, pid, ref);
  if (!old) return { error: 'record not found' };
  if (!old.imported) return { error: old.ref + ' was raised on this platform — it is moved on, not taken over.' };
  if (old.continued_by) return { error: old.ref + ' was already taken over as ' + old.continued_by + '.' };
  if (old.type === 'incoming') return { error: 'An imported incoming letter is answered by a reply letter that names ' + old.ref + ' in "In reply to".' };
  const data = {};
  for (const [k, v] of Object.entries(old.data || {})) if (!DUE_FIELDS.includes(k)) data[k] = v;
  data.Continues = old.ref + (old.original_status ? ' (' + old.original_status + ' in the old system)' : '');
  const made = await createRecord(env, pid, { type: old.type, title: old.title, data }, who, opts);
  if (made.error) return made;
  await env.DB.prepare('UPDATE records SET continues = ? WHERE project_id = ? AND ref = ?').bind(old.ref, pid, made.ref).run();
  await env.DB.prepare('UPDATE records SET continued_by = ?, updated_at = ? WHERE project_id = ? AND ref = ?').bind(made.ref, nowISO(), pid, old.ref).run();
  return { ok: true, ref: made.ref, continues: old.ref, record: await getRecord(env, pid, made.ref) };
}

export async function createRecord(env, pid, body, who, opts) {
  const t = RECORD_TYPES[body && body.type];
  if (!t) return { error: 'unknown record type' };
  // An incoming letter is known by its subject, whatever the form sent first.
  const subj = body.type === 'incoming' && body.data && String(body.data.Subject || '').trim();
  const title = String((subj || body.title || (body.data && (body.data.Title || body.data.Subject || body.data.Description || body.data.Material || body.data.Finding)) || '').toString()).slice(0, 200) || t.prefix + ' record';
  // next sequence for this project + type
  let no = 1;
  try {
    const row = await env.DB.prepare(`SELECT MAX(no) AS n FROM records WHERE project_id = ? AND type = ?`).bind(pid, body.type).first();
    no = ((row && row.n) || 0) + 1;
  } catch (e) {}
  const ref = t.prefix + '-' + String(no).padStart(t.pad, '0');
  const id = 'rec_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  // THE LADDER THIS PROJECT RUNS, never one sent by the browser — a record
  // raised with a single step would close itself.
  //
  // A project may have amended its ladders (workflow-store.js); if it has, that
  // is the ladder. If it has not, the shipped one is used and nothing about
  // this project has changed. Either way the record keeps a COPY from here on,
  // so amending a ladder later never disturbs a record already running.
  const ladder = (opts && Array.isArray(opts.workflow) && opts.workflow.length)
    ? opts.workflow : t.wf;
  const wfSteps = ladder.map((s, i) => ({
    st: s.st, by: Array.isArray(s.by) ? s.by : [], issue: !!s.issue, reply: !!s.reply,
    // Until it is signed, a step shows whose it is ("Project Manager"), not "Assigned".
    who: i === 0 ? (who || 'You')
                 : (Array.isArray(s.by) ? s.by : [])
                     .map((f) => (opts && opts.labels && opts.labels[f]) || (FUNCTIONS[f] || {}).label || f)
                     .join(' or '),
    state: i === 0 ? 'done' : (i === 1 ? 'now' : 'wait'), when: i === 0 ? stamp() : '',
  }));
  const data = (body.data && typeof body.data === 'object') ? body.data : {};
  // A reply letter names the incoming letter it answers; it must exist.
  if (body.type === 'letter') {
    const refs = replyRefs(data);
    for (const r of refs) {
      const hit = await env.DB.prepare(`SELECT ref FROM records WHERE project_id = ? AND type = 'incoming' AND ref = ?`).bind(pid, r).first().catch(() => null);
      if (!hit) return { error: `"In reply to": there is no incoming letter ${r} on this project.` };
    }
    if (refs.length) data['In reply to'] = refs.join(', ');
  }
  const entered = String(data['Required reply by'] || data['Reply needed by'] || data['Required approval by'] || data['Needed by'] || data['Valid until'] || (body.type === 'cert' && data.Expires) || data['Required issue by'] || data['Inspection date'] || data['Inspection date & time'] || body.due || '').slice(0, 10);
  let due = /^\d{4}-\d{2}-\d{2}$/.test(entered) ? entered : null;
  let dueBasis = due ? 'entered' : null;
  // No date entered: the project's response period, for kinds that run from
  // the day they are raised. (Kinds that run from issue get theirs when issued.)
  const rp = responseDays(opts && opts.project, body.type);
  if (!due && rp && rp.from === 'raised') {
    due = addDays(todayUAE(), rp.days);
    dueBasis = rp.days + ' days from raised (' + rp.what + ')';
  }
  let status = wfSteps[1] ? wfSteps[1].st : 'Open';
  let cls = clsForStep(0, wfSteps.length, false);
  let step0 = 0, submitted = null;
  if (body.type === 'incoming') {
    const inc = incomingSetup(data, opts && opts.project);
    if (inc.error) return { error: inc.error };
    submitted = inc.received;
    if (inc.info) {
      // For information only: filed, nothing to answer.
      wfSteps[1] = { ...wfSteps[1], state: 'done', when: stamp(), who: who || 'Document Control', st: 'Filed — for information' };
      status = 'Filed — for information'; cls = 'ok'; step0 = 1; due = null; dueBasis = null;
    } else {
      wfSteps[1] = { ...wfSteps[1], by: inc.by, who: inc.who, st: 'Reply or close — ' + inc.who };
      status = 'With ' + inc.who + ' — reply by ' + inc.due;
      if (!due) { due = inc.due; dueBasis = inc.basis; }
    }
  }
  const at = nowISO();
  try {
    await env.DB.prepare(
      `INSERT INTO records (id,project_id,type,no,ref,title,status,cls,data,workflow,step,due,submitted,created_by,created_at,updated_at,due_basis)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, pid, body.type, no, ref, title, status, cls, JSON.stringify(data), JSON.stringify(wfSteps), step0, due, submitted || at.slice(0, 10), who || '', at, at, dueBasis).run();
  } catch (e) { return { error: 'could not save: ' + (e && e.message || e) }; }
  return { ok: true, ref, record: shape({ id, project_id: pid, type: body.type, no, ref, title, status, cls, data: JSON.stringify(data), workflow: JSON.stringify(wfSteps), step: step0, due, due_basis: dueBasis, submitted: submitted || at.slice(0, 10), created_by: who, created_at: at }) };
}

/* ---------------------------------------------- STEP 7: incoming letters */

// "IN-003" or "IN-003, IN-007" in a reply letter's "In reply to" field.
export function replyRefs(data) {
  const raw = String((data && (data['In reply to'] || data['In reply to (IN ref)'])) || '');
  return [...new Set(raw.toUpperCase().split(/[\s,;/]+/).filter((x) => /^IN-\d{1,6}$/.test(x))
    .map((x) => 'IN-' + x.slice(3).padStart(3, '0')))];
}

// Who an incoming letter goes to, and when our reply is due.
const INFO_ONLY = /information|no action|file only|none/i;
export function incomingSetup(data, project) {
  const d = data || {};
  const received = String(d['Date received'] || '').slice(0, 10) || todayUAE();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(received)) return { error: 'Enter the date it was received.' };
  if (received > todayUAE()) return { error: 'The date received cannot be in the future.' };
  const dated = String(d['Letter date'] || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dated) && dated > received) return { error: 'The letter is dated after the day it was received.' };
  if (!String(d.From || '').trim()) return { error: 'Say who it is from.' };
  const want = String(d['Action by'] || '').trim();
  if (!want || INFO_ONLY.test(want)) return { info: true, received };
  const fn = FUNCTIONS[want] ? want
    : Object.keys(FUNCTIONS).find((k) => FUNCTIONS[k].label.toLowerCase() === want.toLowerCase());
  if (!fn || fn === 'consultant') return { error: `"Action by": ${want} is not a role on this platform.` };
  const rp = responseDays(project, 'incoming');
  const typed = String(d['Reply by'] || '').slice(0, 10);
  const due = /^\d{4}-\d{2}-\d{2}$/.test(typed) ? typed : addDays(received, rp.days);
  return {
    received, fn, due,
    basis: /^\d{4}-\d{2}-\d{2}$/.test(typed) ? 'entered' : rp.days + ' days from receipt (' + rp.what + ')',
    by: [...new Set([fn, 'pm', 'dc'])],
    who: FUNCTIONS[fn].label,
  };
}

// A reply letter has been issued: every incoming letter it answers is closed.
// K10: `on` — the day the reply was issued, when it was not today (a letter
// signed and sent outside the platform, logged afterwards by DC).
export async function closeIncomingByReply(env, pid, letter, who, on) {
  const refs = replyRefs(letter && letter.data);
  const closed = [];
  for (const r of refs) {
    const rec = await getRecord(env, pid, r);
    if (!rec || rec.type !== 'incoming' || !pendingStep(rec)) continue;
    const wf = rec.workflow || [];
    const last = wf.length - 1;
    wf.forEach((s, i) => { s.state = 'done'; if (i === last) { s.when = stamp(); s.who = who || s.who; } });
    const status = 'Replied — ' + letter.ref + ' issued ' + (/^\d{4}-\d{2}-\d{2}$/.test(String(on || '')) ? on : todayUAE());
    await env.DB.prepare(`UPDATE records SET step=?, workflow=?, status=?, cls=?, updated_at=? WHERE project_id=? AND ref=?`)
      .bind(last, JSON.stringify(wf), status, 'ok', nowISO(), pid, r).run();
    closed.push(r);
  }
  return closed;
}

// Advance the workflow one step (or set a specific status), and recolour.
export async function advanceRecord(env, pid, body, who, opts) {
  const rec = await getRecord(env, pid, body && body.ref);
  if (!rec) return { error: 'record not found' };
  // K5: nothing on an imported record is signed — not even by AETRAA.
  if (rec.imported) return { error: IMPORTED_REFUSAL(rec) };
  // An incoming letter closed without a reply letter says why.
  if (rec.type === 'incoming' && body.action !== 'close') {
    const note = String(body.note || '').trim().slice(0, 200);
    if (body.action === 'reject') return { error: 'An incoming letter is not rejected — reply to it, or close it with the reason no reply is needed.' };
    if (!note) return { error: 'Say why no reply is needed (for example: answered at the progress meeting, or for information).' };
    body = { ...body, status: 'Closed — no reply needed: ' + note };
  }
  const wf = rec.workflow || [];
  let step = rec.step || 0;
  const close = body.action === 'close' || body.action === 'reject';
  if (!close) step = Math.min(step + 1, wf.length - 1);
  for (let i = 0; i < wf.length; i++) {
    // Signed steps are done; the one now waiting is 'now'. (The step just
    // signed used to stay 'now', so the panel read "awaiting signature" on a
    // step that had been signed a moment ago.)
    wf[i].state = i <= step ? 'done' : (i === step + 1 && !close ? 'now' : 'wait');
    // When a step is signed: a real date and time, so a register, a diary and
    // a dispute can all say when (the panel shows it as it likes).
    if (i === step) { wf[i].who = who || wf[i].who; wf[i].when = stamp(); }
  }
  const closed = close || step >= wf.length - 1;
  // A ladder that ends with Document Control issuing it (a letter) ends "Issued", not "approved".
  const endsIssued = closed && !close && wf[step] && wf[step].issue;
  const status = body.status ? String(body.status).slice(0, 120)
    : (closed ? (body.action === 'reject' ? 'Rejected' : endsIssued ? 'Issued ' + todayUAE() : 'Closed / approved') : (wf[step + 1] ? wf[step + 1].st : wf[step].st));
  const cls = body.action === 'reject' ? 'late' : clsForStep(step, wf.length, closed);
  // Issued by Document Control: the consultant's clock starts today, unless a
  // date was entered when the document was raised.
  let due = rec.due, dueBasis = rec.due_basis;
  if (!close && wf[step] && wf[step].issue && dueBasis !== 'entered') {
    const rp = responseDays(opts && opts.project, rec.type);
    if (rp && rp.from === 'issue') {
      due = addDays(todayUAE(), rp.days);
      dueBasis = rp.days + ' days from issue (' + rp.what + ')';
    }
  }
  try {
    await env.DB.prepare(`UPDATE records SET step=?, workflow=?, status=?, cls=?, due=?, due_basis=?, updated_at=? WHERE project_id=? AND ref=?`)
      .bind(step, JSON.stringify(wf), status, cls, due || null, dueBasis || null, nowISO(), pid, body.ref).run();
  } catch (e) { return { error: 'could not update' }; }
  return { ok: true, ref: body.ref, status, step, due: due || null, due_basis: dueBasis || null };
}
