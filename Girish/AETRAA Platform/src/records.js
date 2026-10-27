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
  material:   { prefix: 'MAR', reg: 'matapp',     pad: 3, wf: [
    S('Submitted', ['design']), S('QA/QC checks against spec', ['qaqc']), S('PM approves to submit', ['pm']),
    DC_ISSUE('Document Control issues to consultant'), DC_REPLY('Consultant approval recorded')] },
  rfi:        { prefix: 'RFI', reg: 'rfi',        pad: 4, wf: [
    S('Raised', ['design', 'site', 'qaqc', 'planning', 'commercial']), S('PM approves to issue', ['pm']),
    DC_ISSUE('Document Control issues to consultant'), DC_REPLY('Consultant answer recorded')] },
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
    DC_ISSUE('Document Control issues to consultant'), S('Inspection result recorded', ['qaqc'])] },
  mir:        { prefix: 'MIR', reg: 'inspections',pad: 3, wf: [
    S('Raised', ['qaqc', 'site']), S('QA/QC inspects delivery', ['qaqc']),
    DC_ISSUE('Document Control issues to consultant'), S('Inspection result recorded', ['qaqc'])] },
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

let dueBasisChecked = false;
export async function ensureRecordsTable(env) {
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS records (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, type TEXT NOT NULL,
         no INTEGER, ref TEXT, title TEXT, status TEXT, cls TEXT,
         data TEXT, workflow TEXT, step INTEGER DEFAULT 0,
         due TEXT, submitted TEXT, created_by TEXT, created_at TEXT, updated_at TEXT, due_basis TEXT)`
    ).run();
    // Tables made before due dates had a basis get the column; harmless if there.
    if (!dueBasisChecked) {
      try { await env.DB.prepare('SELECT due_basis FROM records LIMIT 1').first(); }
      catch (e) { try { await env.DB.prepare('ALTER TABLE records ADD COLUMN due_basis TEXT').run(); } catch (e2) { /* there */ } }
      dueBasisChecked = true;
    }
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
  return {
    id: r.id, type: r.type, ref: r.ref, title: r.title,
    status: r.status, cls: r.cls, step: r.step || 0,
    due: r.due || null, due_basis: r.due_basis || null, sub: r.submitted || null,
    data, workflow: wf, created_by: r.created_by, created_at: r.created_at,
  };
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
  // Always the type's own workflow — never one sent by the browser, or a record
  // could be raised with a single step and close itself.
  const wfSteps = t.wf.map((s, i) => ({
    st: s.st, by: s.by, issue: !!s.issue, reply: !!s.reply,
    // Until it is signed, a step shows whose it is ("Project Manager"), not "Assigned".
    who: i === 0 ? (who || 'You') : s.by.map((f) => (FUNCTIONS[f] || {}).label || f).join(' or '),
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
  const entered = String(data['Required reply by'] || data['Reply needed by'] || data['Required approval by'] || data['Needed by'] || data['Valid until'] || data['Required issue by'] || data['Inspection date'] || data['Inspection date & time'] || body.due || '').slice(0, 10);
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
export async function closeIncomingByReply(env, pid, letter, who) {
  const refs = replyRefs(letter && letter.data);
  const closed = [];
  for (const r of refs) {
    const rec = await getRecord(env, pid, r);
    if (!rec || rec.type !== 'incoming' || !pendingStep(rec)) continue;
    const wf = rec.workflow || [];
    const last = wf.length - 1;
    wf.forEach((s, i) => { s.state = 'done'; if (i === last) { s.when = stamp(); s.who = who || s.who; } });
    const status = 'Replied — ' + letter.ref + ' issued ' + todayUAE();
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
