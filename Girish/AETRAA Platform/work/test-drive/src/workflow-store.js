// THE APPROVAL LADDERS, AS THIS PROJECT RUNS THEM.
//
// Sixteen record types, each with its own ladder of steps, each step owned by
// the roles whose act it is. The platform ships a set that matches ordinary UAE
// contracting practice; from the moment a project exists the ladders belong to
// the Principal, and he may change them on a live job.
//
// WHY CHANGING A LIVE LADDER IS SAFE, which is not obvious.
//
// A record snapshots its own ladder when it is raised — records.workflow holds
// the copy, and pendingStep() reads that copy, not this table. So amending the
// submittal ladder in month eight leaves the forty submittals already running
// on the ladder they started on, and applies to the ones raised after. That is
// the behaviour anybody would want and it needs no migration, because the data
// was already stored this way.
//
// TWO THINGS THE PRINCIPAL MAY NOT DO. Both strand the project rather than
// merely misconfigure it, and after go-live AETRAA has no reach into the
// project to repair either one:
//
//   A STEP WITH NOBODY ON IT. A submittal sitting at a step no role can sign
//   can never move and never close. It is not an error anyone sees — the record
//   simply stops, and the register slowly fills with them.
//
//   A LADDER WITH NO STEPS. The same failure, arrived at from the other side.
//
// Everything else is his: rename a step, add one, remove one, change who signs
// it, put two roles on a step, move the issue and reply markers.

import { RECORD_TYPES, RESPONSE_DEFAULTS } from './records.js';
import { addColumns } from './db-cols.js';

const nowISO = () => new Date().toISOString();
const str = (v, n = 160) => String(v == null ? '' : v).trim().slice(0, n);

// What each record type is called on screen, and what it is for. The ladder
// editor is the first place anybody sees all sixteen at once, so they are named
// in words rather than by their prefix.
export const TYPE_LABEL = {
  submittal: 'Submittal',
  ms: 'Method statement',
  material: 'Material approval request',
  rfi: 'Request for information (RFI)',
  authority: 'Authority approval / NOC',
  letter: 'Outgoing letter',
  incoming: 'Incoming letter',
  variation: 'Variation',
  wir: 'Work inspection request (WIR)',
  mir: 'Material inspection request (MIR)',
  ncr: 'Non-conformance report (NCR)',
  ptw: 'Permit to work',
  obs: 'HSE observation',
  incident: 'HSE incident',
  mr: 'Material request',
  cert: 'Certificate / licence',
};

export const TYPE_GROUP = {
  submittal: 'To the Engineer', ms: 'To the Engineer', material: 'To the Engineer',
  rfi: 'To the Engineer', authority: 'To the Engineer',
  letter: 'Correspondence', incoming: 'Correspondence', variation: 'Commercial', mr: 'Commercial',
  wir: 'Inspection', mir: 'Inspection', ncr: 'Inspection',
  ptw: 'HSE', obs: 'HSE', incident: 'HSE', cert: 'HSE',
};

export const TYPES = Object.keys(TYPE_LABEL);

/* ----------------------------------------------------------------- the table */

let ready = false;
export async function ensureWorkflowTable(env) {
  if (ready) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS project_workflow (
         project_id TEXT NOT NULL, type TEXT NOT NULL,
         steps TEXT, days INTEGER, template_id TEXT, changed_by TEXT, changed_at TEXT,
         PRIMARY KEY (project_id, type))`
    ).run();
    // Added after the table shipped: which named workflow each document type
    // uses. A database that already has it throws at PREPARE, not at run.
    await addColumns(env, 'project_workflow', [['template_id', 'TEXT']]);

    /* NAMED WORKFLOWS, CHOSEN PER DOCUMENT TYPE.
     *
     * The first version of this screen asked "which steps does this role sign?"
     * — a question nobody in an office has. What a document controller asks is
     * "what happens to a submittal?", and the answer is a named route he can
     * pick for it and reuse on the next type.
     *
     * So the ladders live in a library. A type points at one. Several types can
     * share one, which is what actually happens: submittals, method statements
     * and material approvals all run the same route on most jobs. */
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS workflow_templates (
         project_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT, note TEXT,
         steps TEXT, builtin INTEGER DEFAULT 0,
         created_by TEXT, created_at TEXT,
         PRIMARY KEY (project_id, id))`
    ).run();
    ready = true;
    return true;
  } catch (e) { return false; }
}

/* ---------------------------------------------------------- the library

   What ships with a project. Named for what they DO, not for the document
   they happen to be attached to — because the whole point is that a type can
   be pointed at a different one. */
const T = (st, by, extra) => Object.assign({ st, by }, extra || {});

export const TEMPLATE_SEED = [
  { id: 'to-engineer', name: 'To the Engineer — Design → PM → issue → reply',
    note: 'The standard route for anything that leaves the contractor and comes back with a status.',
    steps: [
      T('Prepared', ['design']),
      T('PM approves to submit', ['pm']),
      T('Document Control issues to the Engineer', ['dc'], { issue: true }),
      T('Engineer\u2019s status recorded (Code A/B/C)', ['dc'], { reply: true }),
    ] },

  { id: 'to-engineer-checked', name: 'To the Engineer, with QA/QC & HSE review first',
    note: 'For a method statement or anything that has to be checked inside the team before it goes.',
    steps: [
      T('Prepared', ['site', 'design', 'qaqc', 'hse']),
      T('QA/QC & HSE review', ['qaqc', 'hse']),
      T('PM approves to submit', ['pm']),
      T('Document Control issues to the Engineer', ['dc'], { issue: true }),
      T('Engineer\u2019s status recorded', ['dc'], { reply: true }),
    ] },

  { id: 'question', name: 'A question out — anyone raises, PM releases',
    note: 'An RFI. Whoever hits the problem raises it; the PM still sees it before it leaves.',
    steps: [
      T('Raised', ['design', 'site', 'qaqc', 'planning', 'commercial']),
      T('PM approves to issue', ['pm']),
      T('Document Control issues to the Engineer', ['dc'], { issue: true }),
      T('Engineer\u2019s answer recorded', ['dc'], { reply: true }),
    ] },

  { id: 'authority', name: 'To an authority — prepare → PM → submit → NOC',
    note: 'DCD, DEWA, the municipality. Longer, and the review step is its own.',
    steps: [
      T('Prepared', ['design']),
      T('PM approves to submit', ['pm']),
      T('Document Control submits to the authority', ['dc'], { issue: true }),
      T('Under review', ['dc', 'design']),
      T('Approval / NOC recorded', ['dc'], { reply: true }),
    ] },

  { id: 'letter-out', name: 'Letter out — drafted → signed → issued',
    steps: [
      T('Drafted', ['design', 'commercial']),
      T('PM / Director signs', ['pm', 'principal']),
      T('Document Control issues & logs', ['dc'], { issue: true }),
    ] },

  { id: 'letter-in', name: 'Letter in — logged → answered or closed',
    steps: [
      T('Logged by Document Control', ['dc', 'pm']),
      T('Reply issued or closed', ['pm', 'dc']),
    ] },

  { id: 'commercial', name: 'Commercial — priced → PM → Director → issued → instruction',
    note: 'A variation. The Director step is where a contractor usually puts a money threshold.',
    steps: [
      T('Priced by the QS', ['commercial']),
      T('PM review', ['pm']),
      T('Director approval', ['principal']),
      T('Document Control issues to the client', ['dc'], { issue: true }),
      T('Client instruction recorded', ['commercial', 'dc'], { reply: true }),
    ] },

  { id: 'inspection', name: 'Inspection — raised → QA/QC checks → issued → result',
    steps: [
      T('Raised', ['site', 'qaqc']),
      T('QA/QC checks the work is ready', ['qaqc']),
      T('Document Control issues to the Engineer', ['dc'], { issue: true }),
      // Ajay, 6 Oct 2026 (decision 9): Document Control records the Engineer's result.
      T('Inspection result recorded by Document Control', ['dc'], { reply: true }),
    ] },

  { id: 'internal-fix', name: 'Internal — raised → rectified → verified & closed',
    note: 'An NCR or an HSE observation. Nothing leaves the contractor.',
    steps: [
      T('Raised', ['qaqc', 'hse']),
      T('Site rectifies', ['site']),
      T('Verified & closed', ['qaqc', 'hse']),
    ] },

  { id: 'permit', name: 'Permit — requested → HSE signs → work → HSE closes',
    steps: [
      T('Requested by site', ['site', 'hse']),
      T('HSE review & sign', ['hse']),
      T('Work proceeds', ['site']),
      T('HSE closes out at end of shift', ['hse']),
    ] },

  { id: 'incident', name: 'Incident — reported → investigated → corrected → closed',
    steps: [
      T('Reported', ['hse', 'site']),
      T('Investigation', ['hse']),
      T('Corrective action', ['site', 'hse']),
      T('Closed & recorded', ['hse']),
    ] },

  { id: 'materials', name: 'Materials — site raises → PM checks the BOM → LPO',
    steps: [
      T('Raised by site', ['site']),
      T('PM reviews against the BOM', ['pm']),
      T('Procurement raises the LPO', ['procurement']),
    ] },

  { id: 'register-only', name: 'Register only — logged → checked → valid',
    note: 'A certificate or licence. No approval chain, just a record with an expiry.',
    steps: [
      T('Logged', ['hse', 'dc']),
      T('Checked', ['hse']),
      T('Valid on site', ['hse']),
    ] },
];

// Which template each document type starts on. This is the mapping the screen
// shows in its dropdowns, and it matches what the platform ran on before the
// library existed.
export const TEMPLATE_FOR_TYPE = {
  submittal: 'to-engineer', material: 'to-engineer',
  ms: 'to-engineer-checked',
  rfi: 'question',
  authority: 'authority',
  letter: 'letter-out', incoming: 'letter-in',
  variation: 'commercial',
  wir: 'inspection', mir: 'inspection',
  ncr: 'internal-fix', obs: 'internal-fix',
  ptw: 'permit', incident: 'incident',
  mr: 'materials', cert: 'register-only',
};

const safeJson = (s, f) => { try { const v = JSON.parse(s || ''); return v == null ? f : v; } catch (e) { return f; } };

/* --------------------------------------------------------------- the seeding */

// Seeded on first read, so projects that already exist get their ladders
// without a migration anybody has to remember to run.
// The library, seeded on first read so projects that already exist get it
// without a migration anybody has to remember to run.
export async function seedTemplates(env, pid) {
  if (!(await ensureWorkflowTable(env))) return false;
  try {
    const has = await env.DB.prepare('SELECT id FROM workflow_templates WHERE project_id = ? LIMIT 1')
      .bind(pid).first();
    if (has) return false;
    for (const t of TEMPLATE_SEED) {
      await env.DB.prepare(
        `INSERT INTO workflow_templates (project_id, id, name, note, steps, builtin, created_by, created_at)
         VALUES (?,?,?,?,?,1,?,?)`
      ).bind(pid, t.id, t.name, t.note || null, JSON.stringify(t.steps), 'AETRAA', nowISO())
       .run().catch(() => {});
    }
    return true;
  } catch (e) { return false; }
}

export async function listTemplates(env, pid) {
  if (!(await ensureWorkflowTable(env))) return [];
  await seedTemplates(env, pid);
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM workflow_templates WHERE project_id = ?').bind(pid).all();
    return (results || []).map((r) => ({
      id: r.id, name: r.name || r.id, note: r.note || '',
      steps: safeJson(r.steps, []), builtin: !!r.builtin,
      created_by: r.created_by || '', created_at: r.created_at || '',
    })).sort((a, b) => (b.builtin ? 1 : 0) - (a.builtin ? 1 : 0) || a.name.localeCompare(b.name));
  } catch (e) { return []; }
}

// Save a named workflow — new, or a change to one. A built-in may be edited:
// it is this project's copy, and the whole point is that the Principal owns it.
export async function saveTemplate(env, pid, body, who, validRoles) {
  if (!(await ensureWorkflowTable(env))) return { error: 'workflows are not available on this database' };
  await seedTemplates(env, pid);

  const name = str(body && body.name, 120);
  if (!name) return { error: 'give the workflow a name — it is what you will pick it by' };

  const steps = cleanSteps(body && body.steps, validRoles);
  if (!steps.length) return { error: 'a workflow needs at least one step' };
  const orphan = steps.findIndex((x, i) => i > 0 && !x.by.length);
  if (orphan >= 0) {
    return { error: 'Step ' + (orphan + 1) + ', \u201c' + steps[orphan].st + '\u201d, has nobody on it. ' +
                    'Every document on this route would stop there and could never be closed.' };
  }
  if (!steps[0].by.length) {
    return { error: 'The first step is who raises it. With nobody on it, nothing can be raised at all.' };
  }

  const existing = str(body && body.id, 40);
  if (existing) {
    const row = await env.DB.prepare('SELECT id FROM workflow_templates WHERE project_id = ? AND id = ?')
      .bind(pid, existing).first();
    if (!row) return { error: 'no such workflow' };
    await env.DB.prepare(
      'UPDATE workflow_templates SET name = ?, note = ?, steps = ?, created_by = ?, created_at = ? WHERE project_id = ? AND id = ?'
    ).bind(name, str(body.note, 300) || null, JSON.stringify(steps),
           (who && who.name) || 'AETRAA', nowISO(), pid, existing).run();
    // Every type on this workflow follows the change from now on. Records
    // already running keep the ladder they were raised on.
    await applyTemplateEverywhere(env, pid, existing, steps, who);
    return { ok: true, id: existing, updated: true };
  }

  const taken = (await listTemplates(env, pid)).map((t) => t.id);
  let base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'workflow';
  let id = base;
  for (let i = 2; taken.includes(id) && i < 90; i++) id = base + '-' + i;

  await env.DB.prepare(
    `INSERT INTO workflow_templates (project_id, id, name, note, steps, builtin, created_by, created_at)
     VALUES (?,?,?,?,?,0,?,?)`
  ).bind(pid, id, name, str(body.note, 300) || null, JSON.stringify(steps),
         (who && who.name) || 'AETRAA', nowISO()).run();
  return { ok: true, id, created: true };
}

// Editing a workflow updates every document type pointed at it.
async function applyTemplateEverywhere(env, pid, templateId, steps, who) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT type FROM project_workflow WHERE project_id = ? AND template_id = ?').bind(pid, templateId).all();
    for (const r of results || []) {
      await env.DB.prepare(
        'UPDATE project_workflow SET steps = ?, changed_by = ?, changed_at = ? WHERE project_id = ? AND type = ?'
      ).bind(JSON.stringify(steps), (who && who.name) || 'AETRAA', nowISO(), pid, r.type).run().catch(() => {});
    }
  } catch (e) { /* nothing pointed at it yet */ }
}

// POINT ONE DOCUMENT TYPE AT ONE WORKFLOW. This is the act the screen is built
// around: pick a submittal's route from a dropdown.
//
// The template's steps are COPIED onto the type rather than referenced, because
// the engine reads the type's own ladder and must keep working if a template is
// later deleted. The template id is kept so the screen can show which one was
// chosen and so editing it can follow through.
export async function useTemplate(env, pid, type, templateId, who) {
  if (!TYPE_LABEL[type]) return { error: 'unknown record type' };
  const tpl = (await listTemplates(env, pid)).find((t) => t.id === String(templateId));
  if (!tpl) return { error: 'no such workflow' };
  await seedWorkflow(env, pid);

  await env.DB.prepare(
    `INSERT INTO project_workflow (project_id, type, steps, days, template_id, changed_by, changed_at)
     VALUES (?,?,?,(SELECT days FROM project_workflow WHERE project_id = ? AND type = ?),?,?,?)
     ON CONFLICT(project_id, type) DO UPDATE SET steps = excluded.steps,
       template_id = excluded.template_id, changed_by = excluded.changed_by,
       changed_at = excluded.changed_at`
  ).bind(pid, String(type), JSON.stringify(tpl.steps), pid, String(type),
         tpl.id, (who && who.name) || 'AETRAA', nowISO()).run();

  return { ok: true, type, template: tpl.id, name: tpl.name, steps: tpl.steps };
}

export async function seedWorkflow(env, pid, force = false) {
  if (!(await ensureWorkflowTable(env))) return false;
  try {
    if (!force) {
      const has = await env.DB.prepare('SELECT type FROM project_workflow WHERE project_id = ? LIMIT 1')
        .bind(pid).first();
      if (has) return false;
    }
    for (const type of TYPES) {
      const t = RECORD_TYPES[type];
      if (!t) continue;
      const steps = t.wf.map((s) => ({
        st: s.st, by: Array.isArray(s.by) ? s.by.slice() : [],
        issue: !!s.issue, reply: !!s.reply,
      }));
      const days = (RESPONSE_DEFAULTS[type] || {}).days || null;
      await env.DB.prepare(
        `INSERT INTO project_workflow (project_id, type, steps, days, template_id, changed_by, changed_at)
         VALUES (?,?,?,?,?,?,?)`
      ).bind(pid, type, JSON.stringify(steps), days, TEMPLATE_FOR_TYPE[type] || null,
             'AETRAA', nowISO()).run().catch(() => {});
    }
    return true;
  } catch (e) { return false; }
}

/* ----------------------------------------------------------------- reading */

// Every ladder on this project, grouped the way the screen shows them.
export async function listWorkflow(env, pid) {
  if (!(await ensureWorkflowTable(env))) return [];
  await seedWorkflow(env, pid);
  let rows = [];
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM project_workflow WHERE project_id = ?').bind(pid).all();
    rows = results || [];
  } catch (e) { rows = []; }

  const by = {};
  for (const r of rows) by[r.type] = r;

  return TYPES.map((type) => {
    const r = by[type];
    const t = RECORD_TYPES[type] || { wf: [] };
    const steps = r ? safeJson(r.steps, null) : null;
    return {
      type,
      label: TYPE_LABEL[type] || type,
      group: TYPE_GROUP[type] || 'Other',
      prefix: t.prefix || '',
      // A ladder never read from the table still answers with the shipped one,
      // so the screen is never blank and the engine never has nothing to run.
      steps: Array.isArray(steps) && steps.length
        ? steps
        : t.wf.map((s) => ({ st: s.st, by: s.by.slice(), issue: !!s.issue, reply: !!s.reply })),
      days: r && r.days != null ? r.days : ((RESPONSE_DEFAULTS[type] || {}).days || null),
      response: RESPONSE_DEFAULTS[type] || null,
      template_id: (r && r.template_id) || TEMPLATE_FOR_TYPE[type] || '',
      changed_by: (r && r.changed_by) || '',
      changed_at: (r && r.changed_at) || '',
      edited: !!(r && r.changed_by && r.changed_by !== 'AETRAA'),
    };
  });
}

// One ladder, for the engine. Returns null when the project has no override, so
// the caller falls back to the shipped RECORD_TYPES and nothing changes for a
// project that has never been edited.
export async function workflowFor(env, pid, type) {
  if (!(await ensureWorkflowTable(env))) return null;
  try {
    const r = await env.DB.prepare(
      'SELECT steps FROM project_workflow WHERE project_id = ? AND type = ?').bind(pid, String(type)).first();
    const steps = r ? safeJson(r.steps, null) : null;
    return Array.isArray(steps) && steps.length ? steps : null;
  } catch (e) { return null; }
}

/* ------------------------------------------------- which steps a role signs

   The inverse view, and the one the organisation screen is built on: pick a
   role, see every step in the project it signs, tick and untick. Assigning a
   role is one act on one screen, not three acts in three places. */

export async function stepsForRole(env, pid, roleId) {
  const all = await listWorkflow(env, pid);
  const out = [];
  for (const w of all) {
    w.steps.forEach((s, i) => {
      out.push({
        type: w.type, label: w.label, group: w.group,
        i, st: s.st, on: (s.by || []).includes(roleId),
        alone: (s.by || []).length === 1 && (s.by || [])[0] === roleId,
      });
    });
  }
  return out;
}

// Every step, anywhere on the project, that ONLY this role can sign. What
// retiring a role has to refuse on.
export async function stepsOnlyRole(env, pid, roleId) {
  return (await stepsForRole(env, pid, roleId))
    .filter((s) => s.alone)
    .map((s) => s.label + ' — ' + s.st);
}

/* ----------------------------------------------------------------- writing */

function cleanSteps(list, validRoles) {
  const out = [];
  for (const s of Array.isArray(list) ? list : []) {
    const st = str(s && s.st, 160);
    if (!st) continue;
    const by = [];
    const seen = {};
    for (const r of Array.isArray(s && s.by) ? s.by : []) {
      const id = String(r);
      if (seen[id]) continue;
      if (validRoles && !validRoles.includes(id)) continue;
      seen[id] = 1;
      by.push(id);
    }
    out.push({ st, by, issue: !!(s && s.issue), reply: !!(s && s.reply),
               ...(s && s.sign ? { sign: true } : {}) });
  }
  return out;
}

/* THE REPRESENTATIVE SIGNS EVERYTHING THAT GOES OUT.
 *
 * Every party acts through one named person, and that person's signature is on
 * every letter and submittal the party sends. On a route, that means one step
 * immediately before the step where it is issued: signed by the Representative.
 *
 * This puts that step into every route on the project that issues anything
 * and does not already have it. Internal routes — an NCR, a permit, a material
 * request — issue nothing, so they are left alone.
 *
 * WHY IT IS AN ACT AND NOT A DEFAULT. Written into the shipped routes, it would
 * appear on every project already running, including live ones where nobody
 * holds the Representative role yet — and every new submittal would stop at a
 * signature nobody can give. So the caller refuses it on a live project until
 * somebody holds the role, and it runs only when asked.
 *
 * Returns the document types it changed, and the ones that already had it. */
export async function addSignatory(env, pid, roleId, label, who, validRoles, opts = {}) {
  if (!(await ensureWorkflowTable(env))) return { error: 'workflows are not available on this database' };
  const rid = String(roleId || '');
  if (!rid) return { error: 'which role signs?' };
  if (validRoles && !validRoles.includes(rid)) return { error: 'that role is not on this project' };

  const only = Array.isArray(opts.types) && opts.types.length ? opts.types.map(String) : null;
  const all = await listWorkflow(env, pid);
  const changed = [], already = [], internal = [];

  for (const w of all) {
    if (only && !only.includes(w.type)) continue;
    const at = w.steps.findIndex((s) => s.issue);
    if (at < 0) { internal.push(w.label); continue; }

    // Already signed by this person, anywhere before it goes out. Never a
    // second signature step — that is the kind of edit that makes a route
    // unreadable and nobody can say afterwards why it is there twice.
    const signedBefore = w.steps.slice(0, at).some((s) => (s.by || []).includes(rid) && (s.sign || s.by.length === 1));
    if (signedBefore) { already.push(w.label); continue; }

    const steps = w.steps.map((s) => ({ ...s, by: (s.by || []).slice() }));
    steps.splice(at, 0, { st: 'Signed by the ' + (label || 'Representative'), by: [rid], issue: false, reply: false, sign: true });
    const r = await saveWorkflow(env, pid, w.type, { steps, days: w.days }, who, validRoles);
    if (r.error) return { error: w.label + ': ' + r.error };
    changed.push(w.label);
  }
  return { ok: true, changed, already, internal };
}

// Save one ladder. The refusals are the point of this function — see the head
// of the file for why each of them strands a project rather than merely
// misconfiguring it.
export async function saveWorkflow(env, pid, type, body, who, validRoles) {
  if (!(await ensureWorkflowTable(env))) return { error: 'workflows are not available on this database' };
  if (!TYPE_LABEL[type]) return { error: 'unknown record type' };
  await seedWorkflow(env, pid);

  const steps = cleanSteps(body && body.steps, validRoles);

  if (!steps.length) {
    return { error: 'A ' + TYPE_LABEL[type].toLowerCase() + ' needs at least one step. ' +
                    'With none, one can be raised and never closed.' };
  }

  // THE REFUSAL THAT MATTERS.
  const orphan = steps.findIndex((s, i) => i > 0 && !s.by.length);
  if (orphan >= 0) {
    return { error: 'Step ' + (orphan + 1) + ', “' + steps[orphan].st + '”, has nobody on it. ' +
                    'Every ' + TYPE_LABEL[type].toLowerCase() + ' would stop there and could never be ' +
                    'closed — and after go-live nobody can repair it from outside the project. ' +
                    'Put at least one role on it.' };
  }
  // The first step is who RAISES it, and it may legitimately be open to several
  // roles — but not to none, or nobody can start one.
  if (!steps[0].by.length) {
    return { error: 'The first step is who raises it. With nobody on it, no ' +
                    TYPE_LABEL[type].toLowerCase() + ' can be raised at all.' };
  }

  const days = Number(body && body.days);
  const keepDays = Number.isFinite(days) && days > 0 && days < 400 ? Math.round(days) : null;

  await env.DB.prepare(
    `INSERT INTO project_workflow (project_id, type, steps, days, changed_by, changed_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(project_id, type) DO UPDATE SET steps = excluded.steps, days = excluded.days,
       changed_by = excluded.changed_by, changed_at = excluded.changed_at`
  ).bind(pid, String(type), JSON.stringify(steps), keepDays,
         (who && who.name) || 'AETRAA', nowISO()).run();

  return { ok: true, type, steps, days: keepDays };
}

// Put ONE role on, or off, one step — what the organisation screen's checkboxes
// send. Goes through saveWorkflow so it cannot create an orphaned step by the
// back door: unticking the last role on a step is refused with the same words.
export async function setRoleOnStep(env, pid, { type, step, role, on }, who, validRoles) {
  const all = await listWorkflow(env, pid);
  const w = all.find((x) => x.type === type);
  if (!w) return { error: 'unknown record type' };
  const i = Number(step);
  if (!Number.isInteger(i) || i < 0 || i >= w.steps.length) return { error: 'no such step' };

  const steps = w.steps.map((s) => ({ ...s, by: (s.by || []).slice() }));
  const by = steps[i].by;
  const at = by.indexOf(String(role));
  if (on && at < 0) by.push(String(role));
  if (!on && at >= 0) by.splice(at, 1);

  return saveWorkflow(env, pid, type, { steps, days: w.days }, who, validRoles);
}

// Put a ladder back to what the platform ships with. The way out of an edit
// that went wrong, which is why it exists at all.
export async function resetWorkflow(env, pid, type, who) {
  const t = RECORD_TYPES[type];
  if (!t) return { error: 'unknown record type' };
  const steps = t.wf.map((s) => ({ st: s.st, by: s.by.slice(), issue: !!s.issue, reply: !!s.reply }));
  return saveWorkflow(env, pid, type, { steps, days: (RESPONSE_DEFAULTS[type] || {}).days || null }, who, null);
}
