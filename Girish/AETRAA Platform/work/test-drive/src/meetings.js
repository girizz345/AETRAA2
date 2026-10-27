// STEP 8 — meeting minutes and the action tracker.
//
// A meeting is written up as a draft (attendees, the items discussed, the
// decisions, and every action with an owner and a date), then ISSUED by the PM,
// the Principal or Document Control. Issuing is what makes the actions real:
// each becomes a numbered action (AI-001…) in the tracker, its owner is told,
// and it stays open until somebody closes it with a note.
//
// The next meeting of the same kind starts with "matters arising": every action
// still open from the earlier meetings of that kind, to be closed, re-dated
// (with a reason) or carried forward. Nothing drops off the list by accident.
//
// People outside the platform (the Engineer, the client, a subcontractor) can
// own actions too — by name. Their actions are closed by whoever issues the
// minutes, when the next meeting confirms them.

import { addColumns } from './db-cols.js';

const nowISO = () => new Date().toISOString();
const todayUAE = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[a-z]{2,}$/i;
const str = (v, n = 200) => String(v == null ? '' : v).slice(0, n).trim();
const parse = (v, d) => { try { const j = JSON.parse(v || ''); return j == null ? d : j; } catch (e) { return d; } };

// The kinds of meeting, each numbered in its own series (PRG-012 is the
// twelfth progress meeting).
// K13 (v5 A11): two series — meetings with the consultant on the consultant's
// template, internal ones on the company's. Each kind starts in one; a draft
// may be moved.
export const SERIES = { consultant: 'The consultant’s meetings (their template)', company: 'Internal meetings (the company template)' };
export const seriesOf = (type, asked) => (SERIES[asked] ? asked : ['progress', 'design', 'mep'].includes(type) ? 'consultant' : 'company');
export const MEETING_TYPES = {
  progress:     { prefix: 'PRG', label: 'Progress meeting (Engineer / client)' },
  internal:     { prefix: 'INT', label: 'Internal project meeting' },
  design:       { prefix: 'DES', label: 'Design coordination' },
  mep:          { prefix: 'MEP', label: 'MEP coordination' },
  hse:          { prefix: 'HSE', label: 'HSE meeting' },
  subcontract:  { prefix: 'SCM', label: 'Subcontractor meeting' },
  other:        { prefix: 'MTG', label: 'Other meeting' },
};

// Who writes minutes, who issues them, who may close an action on someone's behalf.
const WRITERS = ['principal', 'pm', 'dc', 'planning', 'design', 'qaqc', 'hse', 'commercial', 'procurement', 'site'];
const ISSUERS = ['principal', 'pm', 'dc'];
export const mayWriteMinutes = (fns, role) => role === 'owner' || role === 'manager' || (fns || []).some((f) => WRITERS.includes(f));
export const mayIssueMinutes = (fns, role) => role === 'owner' || role === 'manager' || (fns || []).some((f) => ISSUERS.includes(f));

let tablesDone = false;
export async function ensureMeetingTables(env) {
  if (tablesDone) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS meetings (
       id TEXT PRIMARY KEY, project_id TEXT NOT NULL, type TEXT NOT NULL, no INTEGER, ref TEXT,
       title TEXT, meeting_date TEXT, start_time TEXT, location TEXT, chair TEXT,
       attendees TEXT, items TEXT, arising TEXT, next_meeting TEXT,
       status TEXT, prepared_by TEXT, prepared_by_id TEXT, issued_by TEXT, issued_at TEXT,
       created_at TEXT, updated_at TEXT)`
  ).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_meetings_p ON meetings(project_id, type)`).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS actions (
       id TEXT PRIMARY KEY, project_id TEXT NOT NULL, no INTEGER, ref TEXT,
       meeting_ref TEXT, meeting_type TEXT, item_no TEXT, text TEXT,
       owner_user_id TEXT, owner_name TEXT, due TEXT, first_due TEXT,
       status TEXT, carried INTEGER DEFAULT 0, history TEXT,
       closed_note TEXT, closed_by TEXT, closed_at TEXT, created_at TEXT, updated_at TEXT)`
  ).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_actions_p ON actions(project_id, status)`).run();
  // K13 (v5 A11): the series a meeting is in (the consultant's or the
  // company's — which template its minutes go out on), the consultant's own
  // reference for minutes they issued, and how the minutes came in.
  await addColumns(env, 'meetings', [['series', 'TEXT'], ['their_ref', 'TEXT'], ['source', 'TEXT'], ['sent_log', 'TEXT']]);
  // Decision 16: the project's outside contacts (the Engineer, the client, a
  // subcontractor), kept from the minutes they attended.
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS meeting_contacts (
       project_id TEXT NOT NULL, email TEXT NOT NULL, name TEXT, company TEXT, updated_at TEXT,
       PRIMARY KEY (project_id, email))`
  ).run();
  tablesDone = true;
}

const shapeMeeting = (r) => r && ({ ...r, attendees: parse(r.attendees, []), items: parse(r.items, []), arising: parse(r.arising, []), sent_log: parse(r.sent_log, []) });
const shapeAction = (r) => r && ({ ...r, history: parse(r.history, []) });

export async function listMeetings(env, pid) {
  await ensureMeetingTables(env);
  const { results } = await env.DB.prepare(
    `SELECT id, type, no, ref, title, meeting_date, status, prepared_by, issued_at, chair, location, items, series, their_ref
       FROM meetings WHERE project_id = ? ORDER BY meeting_date DESC, no DESC`
  ).bind(pid).all();
  const open = await openActionCounts(env, pid);
  return (results || []).map((m) => {
    const items = parse(m.items, []);
    const nAct = items.reduce((s, it) => s + (it.actions || []).length, 0);
    return { id: m.id, type: m.type, type_label: (MEETING_TYPES[m.type] || {}).label || m.type, no: m.no, ref: m.ref,
      title: m.title, meeting_date: m.meeting_date, status: m.status, prepared_by: m.prepared_by, issued_at: m.issued_at,
      chair: m.chair, location: m.location, actions: nAct, open_actions: open[m.ref] || 0,
      series: m.series || seriesOf(m.type), their_ref: m.their_ref || '' };
  });
}
async function openActionCounts(env, pid) {
  const { results } = await env.DB.prepare(
    `SELECT meeting_ref, COUNT(*) AS n FROM actions WHERE project_id = ? AND status = 'open' GROUP BY meeting_ref`
  ).bind(pid).all();
  return Object.fromEntries((results || []).map((r) => [r.meeting_ref, Number(r.n)]));
}

export async function getMeeting(env, pid, ref) {
  await ensureMeetingTables(env);
  const m = shapeMeeting(await env.DB.prepare(`SELECT * FROM meetings WHERE project_id = ? AND ref = ?`).bind(pid, str(ref, 30)).first());
  if (!m) return null;
  // A draft shows what is still open from earlier meetings of this kind; an
  // issued meeting shows what was decided about them at the time.
  if (m.status === 'draft') m.arising_open = await openActions(env, pid, { type: m.type, before: m.ref });
  return m;
}

export async function openActions(env, pid, opts) {
  await ensureMeetingTables(env);
  const o = opts || {};
  const { results } = await env.DB.prepare(
    `SELECT * FROM actions WHERE project_id = ? AND status = 'open' ${o.type ? 'AND meeting_type = ?' : ''} ORDER BY due, no`
  ).bind(...(o.type ? [pid, o.type] : [pid])).all();
  return (results || []).map(shapeAction).filter((a) => a.meeting_ref !== o.before);
}

export async function listActions(env, pid, opts) {
  await ensureMeetingTables(env);
  const o = opts || {};
  const { results } = await env.DB.prepare(`SELECT * FROM actions WHERE project_id = ? ORDER BY no DESC`).bind(pid).all();
  const today = todayUAE();
  let list = (results || []).map(shapeAction).map((a) => ({ ...a, overdue: a.status === 'open' && !!a.due && a.due < today }));
  if (o.mine) list = list.filter((a) => a.owner_user_id === o.mine);
  if (o.status === 'open') list = list.filter((a) => a.status === 'open');
  if (o.status === 'overdue') list = list.filter((a) => a.overdue);
  if (o.status === 'closed') list = list.filter((a) => a.status === 'closed');
  return list;
}

/* ------------------------------------------------------------- the draft */

// Clean what the screen sent. team: [{id, name}] — the people on the project,
// so an owner picked from the list is stored by id and name.
function cleanDraft(b, team) {
  const byId = Object.fromEntries((team || []).map((u) => [u.id, u]));
  const attendees = (Array.isArray(b.attendees) ? b.attendees : []).slice(0, 80).map((a) => ({
    name: str(a.name, 120), company: str(a.company, 120), present: a.present !== false && a.present !== 'no',
    // Ajay, 6 Oct 2026 (decision 16): an outside attendee's email, so the
    // issued minutes can be sent to them.
    ...(EMAIL_RE.test(str(a.email, 160)) ? { email: str(a.email, 160).toLowerCase() } : {}),
  })).filter((a) => a.name);
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 150).map((it, i) => ({
    no: str(it.no, 12) || String(i + 1),
    subject: str(it.subject, 200), discussion: str(it.discussion, 4000), decision: str(it.decision, 1000),
    actions: (Array.isArray(it.actions) ? it.actions : []).slice(0, 30).map((a) => {
      const u = a.owner_user_id && byId[a.owner_user_id];
      // K13 (A11): an owner the AI proposed stays proposed until a person confirms it.
      const proposed = !!a.proposed && !a.confirmed;
      const sug = a.suggested_owner_user_id && byId[a.suggested_owner_user_id];
      return { text: str(a.text, 500), owner_user_id: u ? u.id : '', owner_name: u ? u.name : str(a.owner_name, 120), due: str(a.due, 10),
        ...(proposed ? { proposed: true, proposed_owner: str(a.proposed_owner, 120) } : {}),
        ...(sug ? { suggested_owner_user_id: sug.id } : {}) };
    }).filter((a) => a.text || a.owner_name || a.due),
  })).filter((it) => it.subject || it.discussion || it.decision || it.actions.length);
  const arising = (Array.isArray(b.arising) ? b.arising : []).slice(0, 300).map((a) => ({
    ref: str(a.ref, 20), decision: ['close', 'redate', 'carry'].includes(a.decision) ? a.decision : 'carry',
    note: str(a.note, 500), due: str(a.due, 10),
  })).filter((a) => a.ref);
  return {
    type: MEETING_TYPES[b.type] ? b.type : 'progress',
    series: seriesOf(MEETING_TYPES[b.type] ? b.type : 'progress', b.series),
    title: str(b.title, 200), meeting_date: str(b.meeting_date, 10), start_time: str(b.start_time, 5),
    location: str(b.location, 160), chair: str(b.chair, 120), next_meeting: str(b.next_meeting, 40),
    attendees, items, arising,
  };
}

//   opts (K13): { status: 'recorded', their_ref, source } — the consultant's
//   minutes, recorded as theirs.
export async function saveDraft(env, pid, body, who, team, opts) {
  await ensureMeetingTables(env);
  const d = cleanDraft(body || {}, team);
  const at = nowISO();
  if (body && body.ref) {
    const m = await getMeeting(env, pid, body.ref);
    if (!m) return { error: 'no meeting with that reference', status: 404 };
    if (m.status !== 'draft') return { error: `${m.ref} has been ${m.status === 'recorded' ? 'recorded as the consultant’s' : 'issued'}. Issued minutes are not edited — record a correction at the next meeting.`, status: 400 };
    // The series number stays with the meeting; its kind cannot change after numbering.
    await env.DB.prepare(
      `UPDATE meetings SET title=?, meeting_date=?, start_time=?, location=?, chair=?, next_meeting=?,
         attendees=?, items=?, arising=?, series=?, updated_at=? WHERE project_id=? AND id=?`
    ).bind(d.title, d.meeting_date, d.start_time, d.location, d.chair, d.next_meeting,
      JSON.stringify(d.attendees), JSON.stringify(d.items), JSON.stringify(d.arising), body.series ? d.series : (m.series || d.series), at, pid, m.id).run();
    return { ok: true, ref: m.ref, meeting: await getMeeting(env, pid, m.ref) };
  }
  const t = MEETING_TYPES[d.type];
  const row = await env.DB.prepare(`SELECT MAX(no) AS n FROM meetings WHERE project_id = ? AND type = ?`).bind(pid, d.type).first();
  const no = (Number(row && row.n) || 0) + 1;
  const ref = t.prefix + '-' + String(no).padStart(3, '0');
  await env.DB.prepare(
    `INSERT INTO meetings (id, project_id, type, no, ref, title, meeting_date, start_time, location, chair, attendees, items, arising,
       next_meeting, status, prepared_by, prepared_by_id, created_at, updated_at, series, their_ref, source)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(uid('mtg_'), pid, d.type, no, ref, d.title || t.label + ' ' + no, d.meeting_date, d.start_time, d.location, d.chair,
    JSON.stringify(d.attendees), JSON.stringify(d.items), JSON.stringify(d.arising), d.next_meeting, (opts && opts.status) || 'draft',
    str(who && who.name, 120), (who && who.id) || '', at, at, d.series, str(opts && opts.their_ref, 60) || null, str(opts && opts.source, 60) || null).run();
  return { ok: true, ref, meeting: await getMeeting(env, pid, ref) };
}

export async function discardDraft(env, pid, ref) {
  const m = await getMeeting(env, pid, ref);
  if (!m) return { error: 'no meeting with that reference', status: 404 };
  if (m.status !== 'draft') return { error: 'Issued minutes stay on the record.', status: 400 };
  await env.DB.prepare(`DELETE FROM meetings WHERE project_id = ? AND id = ?`).bind(pid, m.id).run();
  return { ok: true };
}

/* ------------------------------------------------------------- issuing */

// What would stop these minutes being issued.
export function minutesChecks(m, arisingOpen) {
  const blockers = [], warnings = [];
  const today = todayUAE();
  if (!DATE_RE.test(m.meeting_date || '')) blockers.push('Enter the date of the meeting.');
  else if (m.meeting_date > today) blockers.push('Minutes are issued after the meeting — its date is in the future.');
  if (!(m.attendees || []).some((a) => a.present)) blockers.push('Record who attended.');
  if (!(m.items || []).length) blockers.push('Record at least one item discussed.');
  (m.items || []).forEach((it) => {
    if (!it.subject) blockers.push(`Item ${it.no}: give it a subject.`);
    (it.actions || []).forEach((a, i) => {
      const lbl = `Item ${it.no}, action ${i + 1}`;
      if (!a.text) blockers.push(`${lbl}: say what is to be done.`);
      if (!a.owner_user_id && !a.owner_name) blockers.push(`${lbl}: say who is to do it.`);
      // K13 (A11): the AI never assigns an action — a person confirms each owner it proposed.
      else if (a.proposed) blockers.push(`${lbl}: confirm the owner the AI proposed (${a.owner_name || a.proposed_owner || 'nobody named'}).`);
      if (!DATE_RE.test(a.due || '')) blockers.push(`${lbl}: give it a date.`);
      else if (DATE_RE.test(m.meeting_date || '') && a.due < m.meeting_date) blockers.push(`${lbl}: the date is before the meeting.`);
    });
  });
  const decided = Object.fromEntries((m.arising || []).map((a) => [a.ref, a]));
  for (const a of arisingOpen || []) {
    const d = decided[a.ref];
    if (!d || d.decision === 'carry') continue;
    if (!d.note) blockers.push(`${a.ref}: say why it is ${d.decision === 'close' ? 'closed' : 're-dated'}.`);
    if (d.decision === 'redate' && !DATE_RE.test(d.due || '')) blockers.push(`${a.ref}: give the new date.`);
  }
  const carried = (arisingOpen || []).filter((a) => !decided[a.ref] || decided[a.ref].decision === 'carry');
  const stale = carried.filter((a) => a.due && a.due < (m.meeting_date || today));
  if (stale.length) warnings.push(`${stale.length} action${stale.length === 1 ? ' is' : 's are'} carried forward past ${stale.length === 1 ? 'its' : 'their'} date without being re-dated: ${stale.map((a) => a.ref).join(', ')}.`);
  if (!(m.items || []).some((it) => (it.actions || []).length)) warnings.push('No actions came out of this meeting.');
  return { blockers, warnings, ok: !blockers.length };
}

export async function issueMinutes(env, pid, ref, who) {
  const m = await getMeeting(env, pid, ref);
  if (!m) return { error: 'no meeting with that reference', status: 404 };
  if (m.status === 'recorded') return { error: `${m.ref} is the consultant’s minutes, recorded as received — they are not issued by us.`, status: 400 };
  if (m.status !== 'draft') return { error: `${m.ref} is already issued.`, status: 400 };
  const arisingOpen = m.arising_open || [];
  const c = minutesChecks(m, arisingOpen);
  if (!c.ok) return { error: c.blockers[0], checks: c, status: 400 };
  const at = nowISO(), today = todayUAE();

  // Matters arising: what this meeting decided about each earlier action.
  const decided = Object.fromEntries((m.arising || []).map((a) => [a.ref, a]));
  const arisingRecord = [];
  const stmts = [];
  for (const a of arisingOpen) {
    const d = decided[a.ref] || { decision: 'carry' };
    const hist = a.history || [];
    if (d.decision === 'close') {
      hist.push({ at, by: who.name, what: 'closed at ' + m.ref, note: d.note });
      stmts.push(env.DB.prepare(`UPDATE actions SET status='closed', closed_note=?, closed_by=?, closed_at=?, history=?, updated_at=? WHERE project_id=? AND id=?`)
        .bind(d.note, who.name, today, JSON.stringify(hist), at, pid, a.id));
    } else if (d.decision === 'redate') {
      hist.push({ at, by: who.name, what: 're-dated at ' + m.ref + ' from ' + a.due + ' to ' + d.due, note: d.note });
      stmts.push(env.DB.prepare(`UPDATE actions SET due=?, carried=?, history=?, updated_at=? WHERE project_id=? AND id=?`)
        .bind(d.due, (Number(a.carried) || 0) + 1, JSON.stringify(hist), at, pid, a.id));
    } else {
      hist.push({ at, by: who.name, what: 'carried forward at ' + m.ref });
      stmts.push(env.DB.prepare(`UPDATE actions SET carried=?, history=?, updated_at=? WHERE project_id=? AND id=?`)
        .bind((Number(a.carried) || 0) + 1, JSON.stringify(hist), at, pid, a.id));
    }
    arisingRecord.push({ ref: a.ref, text: a.text, owner_name: a.owner_name, due: a.due, from: a.meeting_ref,
      decision: d.decision, note: d.note || '', new_due: d.decision === 'redate' ? d.due : '' });
  }

  // New actions, numbered across the project.
  const row = await env.DB.prepare(`SELECT MAX(no) AS n FROM actions WHERE project_id = ?`).bind(pid).first();
  let no = Number(row && row.n) || 0;
  const created = [];
  const items = m.items.map((it) => ({ ...it, actions: (it.actions || []).map((a) => {
    no++;
    const aref = 'AI-' + String(no).padStart(3, '0');
    created.push({ ...a, ref: aref, item_no: it.no });
    stmts.push(env.DB.prepare(
      `INSERT INTO actions (id, project_id, no, ref, meeting_ref, meeting_type, item_no, text, owner_user_id, owner_name, due, first_due,
         status, carried, history, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(uid('act_'), pid, no, aref, m.ref, m.type, it.no, a.text, a.owner_user_id || null, a.owner_name, a.due, a.due,
      'open', 0, JSON.stringify([{ at, by: who.name, what: 'raised at ' + m.ref }]), at, at));
    return { ...a, ref: aref };
  }) }));
  stmts.push(env.DB.prepare(`UPDATE meetings SET status='issued', items=?, arising=?, issued_by=?, issued_at=?, updated_at=? WHERE project_id=? AND id=?`)
    .bind(JSON.stringify(items), JSON.stringify(arisingRecord), who.name, today, at, pid, m.id));
  for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100));
  return { ok: true, ref: m.ref, created, warnings: c.warnings, meeting: await getMeeting(env, pid, m.ref) };
}

/* ------------------------------------------------------ the tracker */

// Close an action, or give it a new date — always with a note.
export async function updateAction(env, pid, body, me, fns, role) {
  await ensureMeetingTables(env);
  const a = shapeAction(await env.DB.prepare(`SELECT * FROM actions WHERE project_id = ? AND ref = ?`).bind(pid, str(body.ref, 20)).first());
  if (!a) return { error: 'no action with that reference', status: 404 };
  if (a.status !== 'open') return { error: `${a.ref} is already closed.`, status: 400 };
  const owner = me && a.owner_user_id && a.owner_user_id === me.id;
  if (!owner && !mayIssueMinutes(fns, role)) {
    return { error: 'Only its owner, the PM, the Principal or Document Control can update this action.', status: 403 };
  }
  const note = str(body.note, 500);
  if (!note) return { error: 'Add a note — what was done, or why the date moves.', status: 400 };
  const at = nowISO(), today = todayUAE();
  const hist = a.history || [];
  const name = (me && me.name) || role;
  if (body.close) {
    hist.push({ at, by: name, what: 'closed', note });
    await env.DB.prepare(`UPDATE actions SET status='closed', closed_note=?, closed_by=?, closed_at=?, history=?, updated_at=? WHERE project_id=? AND id=?`)
      .bind(note, name, today, JSON.stringify(hist), at, pid, a.id).run();
  } else {
    const due = str(body.due, 10);
    if (!DATE_RE.test(due)) return { error: 'Give the new date.', status: 400 };
    if (due < today) return { error: 'The new date is already past.', status: 400 };
    hist.push({ at, by: name, what: 're-dated from ' + a.due + ' to ' + due, note });
    await env.DB.prepare(`UPDATE actions SET due=?, history=?, updated_at=? WHERE project_id=? AND id=?`)
      .bind(due, JSON.stringify(hist), at, pid, a.id).run();
  }
  return { ok: true, action: shapeAction(await env.DB.prepare(`SELECT * FROM actions WHERE project_id = ? AND id = ?`).bind(pid, a.id).first()) };
}

// For the weekly / monthly report: raised, closed, open and overdue as at `to`.
export async function actionsSummary(env, pid, from, to) {
  try {
    await ensureMeetingTables(env);
    const { results } = await env.DB.prepare(`SELECT ref, text, owner_name, due, status, closed_at, created_at, meeting_ref FROM actions WHERE project_id = ?`).bind(pid).all();
    const rows = results || [];
    const r10 = (v) => String(v || '').slice(0, 10);
    const existing = rows.filter((a) => r10(a.created_at) <= to);
    const openAtEnd = existing.filter((a) => a.status === 'open' || (a.closed_at && a.closed_at > to));
    return {
      raised: existing.filter((a) => r10(a.created_at) >= from).length,
      closed: rows.filter((a) => a.closed_at && a.closed_at >= from && a.closed_at <= to).length,
      open: openAtEnd.length,
      overdue: openAtEnd.filter((a) => a.due && a.due < to).sort((a, b) => a.due.localeCompare(b.due))
        .map((a) => ({ ref: a.ref, text: a.text, owner: a.owner_name, due: a.due, meeting: a.meeting_ref })),
    };
  } catch (e) { return null; }
}

/* ------------------------------------------- outside attendees (decision 16) */

// The outside contacts a project's minutes have named, newest first.
export async function listContacts(env, pid) {
  await ensureMeetingTables(env);
  const { results } = await env.DB.prepare('SELECT email, name, company FROM meeting_contacts WHERE project_id = ? ORDER BY updated_at DESC LIMIT 300').bind(pid).all();
  return results || [];
}
// Attendees with an email who are not on the platform team are kept as contacts.
export async function rememberContacts(env, pid, attendees, team) {
  await ensureMeetingTables(env);
  const ours = new Set((team || []).map((u) => String(u.email || '').toLowerCase()).filter(Boolean));
  for (const a of attendees || []) {
    if (!a.email || ours.has(a.email)) continue;
    await env.DB.prepare(`INSERT INTO meeting_contacts (project_id, email, name, company, updated_at) VALUES (?,?,?,?,?)
      ON CONFLICT (project_id, email) DO UPDATE SET name = excluded.name, company = excluded.company, updated_at = excluded.updated_at`)
      .bind(pid, a.email, str(a.name, 120), str(a.company, 120), nowISO()).run().catch(() => {});
  }
}
// Who the issued minutes go to: attendees with an email who are not on the team.
export function outsideRecipients(m, team) {
  const ours = new Set((team || []).map((u) => String(u.email || '').toLowerCase()).filter(Boolean));
  const seen = new Set();
  return (m.attendees || []).filter((a) => a.email && !ours.has(a.email) && !seen.has(a.email) && seen.add(a.email))
    .map((a) => ({ name: a.name, company: a.company, email: a.email }));
}
export async function logSent(env, pid, m, entry) {
  const log = (m.sent_log || []).concat([entry]).slice(-50);
  await env.DB.prepare('UPDATE meetings SET sent_log = ?, updated_at = ? WHERE project_id = ? AND id = ?').bind(JSON.stringify(log), nowISO(), pid, m.id).run();
  return log;
}

/* ------------------------- the consultant's actions, into our tracker (decision 8) */

// The consultant's recorded minutes keep their actions as text. Document
// Control (or the PM / Principal) confirms each one they want tracked: its
// owner (someone on the team, or a name) and its date. Only then is it a
// numbered action in our tracker; the minute notes which, so it is never
// added twice. The AI's reading only ever proposed the owner.
//   decisions: [{ item_no, index, owner_user_id?, owner_name?, due }]
export async function trackConsultantActions(env, pid, ref, decisions, who, team) {
  const m = await getMeeting(env, pid, ref);
  if (!m) return { error: 'no meeting with that reference', status: 404 };
  if (m.status !== 'recorded') return { error: m.ref + ' is not the consultant\u2019s recorded minutes; its actions are raised when it is issued.', status: 400 };
  const byId = Object.fromEntries((team || []).map((u) => [u.id, u]));
  const row = await env.DB.prepare('SELECT MAX(no) AS n FROM actions WHERE project_id = ?').bind(pid).first();
  let no = Number(row && row.n) || 0;
  const at = nowISO();
  const created = [], errors = [];
  const items = m.items.map((it) => ({ ...it, actions: (it.actions || []).map((a) => ({ ...a })) }));
  for (const dc of (decisions || []).slice(0, 200)) {
    const it = items.find((x) => String(x.no) === String(dc.item_no));
    const a = it && it.actions[Number(dc.index)];
    const lbl = 'Item ' + (dc.item_no || '?') + ', action ' + (Number(dc.index) + 1);
    if (!a) { errors.push(lbl + ': no such action in the minute.'); continue; }
    if (a.tracked_ref) { errors.push(lbl + ' is already in the tracker as ' + a.tracked_ref + '.'); continue; }
    const u = dc.owner_user_id && byId[dc.owner_user_id];
    const ownerName = u ? u.name : str(dc.owner_name, 120);
    if (!ownerName) { errors.push(lbl + ': say who is to do it.'); continue; }
    if (!DATE_RE.test(str(dc.due, 10))) { errors.push(lbl + ': give it a date.'); continue; }
    no++;
    const aref = 'AI-' + String(no).padStart(3, '0');
    await env.DB.prepare(
      `INSERT INTO actions (id, project_id, no, ref, meeting_ref, meeting_type, item_no, text, owner_user_id, owner_name, due, first_due,
         status, carried, history, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(uid('act_'), pid, no, aref, m.ref, m.type, it.no, a.text, u ? u.id : null, ownerName, dc.due, dc.due, 'open', 0,
      JSON.stringify([{ at, by: who.name, what: 'from the consultant\u2019s minutes ' + m.ref + (m.their_ref ? ' (their ' + m.their_ref + ')' : '') + ', confirmed by ' + who.name }]), at, at).run();
    a.tracked_ref = aref;
    created.push({ ref: aref, text: a.text, owner_user_id: u ? u.id : '', owner_name: ownerName, due: dc.due, item_no: it.no });
  }
  if (created.length) await env.DB.prepare('UPDATE meetings SET items = ?, updated_at = ? WHERE project_id = ? AND id = ?').bind(JSON.stringify(items), at, pid, m.id).run();
  return { ok: !errors.length, created, errors, meeting: await getMeeting(env, pid, m.ref) };
}
